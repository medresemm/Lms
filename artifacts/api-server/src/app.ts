import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { clerkClient, clerkMiddleware } from "@clerk/express";
import { pool } from "@workspace/db";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware.js";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { libraryTablesDiagnostics } from "./lib/library/tableDiagnostics.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: { id?: unknown; method?: unknown; url?: unknown }) {
        return {
          id: req.id,
          method: req.method,
          url: typeof req.url === "string" ? req.url.split("?")[0] : req.url,
        };
      },
      res(res: { statusCode?: unknown }) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Clerk açarları yoxdursa clerkMiddleware hər sorğuda xəta verir; healthz onlardan əvvəl qeydə alınır ki,
// Vercel Function-un özünün işlədiyini ayrıca yoxlamaq mümkün olsun.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error(`${ms}ms ərzində cavab gəlmədi`), { code: "TIMEOUT" })), ms),
    ),
  ]);
}

function describeDatabaseUrl(url: string | undefined) {
  if (!url) return "yoxdur";
  const host = url.replace(/^[a-z]+:\/\/[^@]*@/i, "").split(/[/?]/)[0] ?? "";
  if (/\.pooler\.supabase\.com/i.test(host)) return `pooler (${host.split(":")[1] ?? "port yoxdur"})`;
  if (/^db\.[a-z0-9]+\.supabase\.co/i.test(host)) return `birbaşa Supabase (${host.split(":")[1] ?? "port yoxdur"}) - Vercel üçün uyğun deyil, Transaction Pooler lazımdır`;
  return `başqa host (${host.split(":")[1] ?? "port yoxdur"})`;
}

// Supabase layihə ref-i (məs. «abcd…») — gizli deyil (açıq URL-lərdə də görünür); hansı layihəyə qoşulduğunu
// sahibin Supabase panelindəki layihə ilə müqayisə etmək üçün. Parol/istifadəçi adı göstərilmir.
function supabaseProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  const pooledUser = /^[a-z]+:\/\/postgres\.([a-z0-9]{20})[:@]/i.exec(url)?.[1];
  if (pooledUser) return pooledUser;
  const host = /(?:^|[/@.])(?:db\.)?([a-z0-9]{20})\.(?:storage\.)?supabase\.(?:co|in)/i.exec(url)?.[1];
  return host ?? null;
}

function databaseEnvRefs() {
  return {
    DATABASE_URL: supabaseProjectRef(process.env.DATABASE_URL),
    POSTGRES_URL: process.env.POSTGRES_URL ? supabaseProjectRef(process.env.POSTGRES_URL) ?? "başqa host" : null,
    SUPABASE_URL: process.env.SUPABASE_URL ? supabaseProjectRef(process.env.SUPABASE_URL) ?? "başqa host" : null,
    SUPABASE_S3_ENDPOINT: supabaseProjectRef(process.env.SUPABASE_S3_ENDPOINT),
  };
}

// Adi sorğu: {"status":"ok"}. `DEBUG_API_ERRORS=1` env dəyişəni təyin olunubsa və ?deep=1 verilibsə,
// bazanın və Clerk-in əlçatanlığı yoxlanılır (parol/açar göstərilmir, yalnız bəli/xeyr və xəta kodu).
app.get("/api/healthz", async (req, res) => {
  if (req.query.deep !== "1" || process.env.DEBUG_API_ERRORS !== "1") {
    res.json({ status: "ok" });
    return;
  }
  const report: Record<string, unknown> = {
    status: "ok",
    env: {
      DATABASE_URL: describeDatabaseUrl(process.env.DATABASE_URL),
      CLERK_SECRET_KEY: Boolean(process.env.CLERK_SECRET_KEY),
      CLERK_PUBLISHABLE_KEY: Boolean(process.env.CLERK_PUBLISHABLE_KEY),
      SYSTEM_OWNER_EMAIL: Boolean(process.env.SYSTEM_OWNER_EMAIL),
      RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
      SUPABASE_S3_ENDPOINT: Boolean(process.env.SUPABASE_S3_ENDPOINT),
    },
    supabaseProjectRefs: databaseEnvRefs(),
  };
  const dbStarted = Date.now();
  try {
    const result = await withTimeout(
      pool.query("select to_regclass('public.lms_applications') is not null as applications_table, (select count(*)::int from information_schema.tables where table_schema = 'public') as public_tables"),
      8000,
    );
    report.db = { ok: true, ms: Date.now() - dbStarted, ...result.rows[0] };
    try {
      const diag = await withTimeout(libraryTablesDiagnostics(), 8000);
      report.libraryTables = { database: diag.database, searchPath: diag.searchPath, inPublic: diag.inPublic, foundInSchemas: diag.foundInSchemas };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      report.libraryTables = { ok: false, code: err.code ?? "unknown", message: String(err.message ?? "").slice(0, 200) };
    }
  } catch (error) {
    const err = error as { code?: string; message?: string };
    report.db = { ok: false, ms: Date.now() - dbStarted, code: err.code ?? "unknown", message: String(err.message ?? "").slice(0, 200) };
  }
  const clerkStarted = Date.now();
  try {
    await withTimeout(clerkClient.users.getUserList({ limit: 1 }), 8000);
    report.clerk = { ok: true, ms: Date.now() - clerkStarted };
  } catch (error) {
    const err = error as { status?: number; code?: string; message?: string };
    report.clerk = { ok: false, ms: Date.now() - clerkStarted, status: err.status, code: err.code, message: String(err.message ?? "").slice(0, 200) };
  }
  res.json(report);
});
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
const allowedOrigins = new Set([
  "https://madinahacademy.net",
  "https://www.madinahacademy.net",
]);

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, origin ?? true);
      return;
    }
    if (process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, origin);
      return;
    }
    callback(null, false);
  },
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

export default app;
