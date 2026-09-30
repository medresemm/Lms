import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Bağlantı sətrindəki `sslmode=...` pg-nin yeni versiyalarında sertifikatı sərt yoxlayır və Supabase ilə
// "self-signed certificate in certificate chain" xətası verir. Parol hissəsinə toxunmadan yalnız sorğu
// parametrlərindən ssl ilə bağlı olanları silirik; SSL aşağıda açıq şəkildə konfiqurasiya olunur.
function stripSslParams(url: string): string {
  const queryStart = url.indexOf("?");
  if (queryStart === -1) return url;
  const kept = url
    .slice(queryStart + 1)
    .split("&")
    .filter((part) => part && !/^(sslmode|ssl|sslcert|sslkey|sslrootcert|uselibpqcompat)=/i.test(part));
  return url.slice(0, queryStart) + (kept.length ? `?${kept.join("&")}` : "");
}

const databaseUrl = stripSslParams(process.env.DATABASE_URL);
const isLocalDatabase = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(databaseUrl);
const isServerless = Boolean(process.env.VERCEL);

// Vercel Function-larında hər instance öz pool-unu açır, ona görə bağlantı sayı kiçik saxlanılır
// (Supabase Transaction Pooler ilə birlikdə). Supabase üçün SSL lazımdır.
export const pool = new Pool({
  connectionString: databaseUrl,
  max: isServerless ? 3 : 10,
  idleTimeoutMillis: isServerless ? 10_000 : 30_000,
  connectionTimeoutMillis: 10_000,
  ...(isLocalDatabase || process.env.DATABASE_SSL === "disable"
    ? {}
    : { ssl: { rejectUnauthorized: false } }),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
