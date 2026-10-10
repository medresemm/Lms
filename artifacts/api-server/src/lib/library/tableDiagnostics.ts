// Kitabxana cədvəllərinin serverin qoşulduğu bazada həqiqətən olub-olmadığını yoxlayır.
// «Cədvəl yaradılmayıb» mesajı çıxanda sahib SQL-i başqa layihədə/sxemdə işə salıbsa, bu fərqi göstərir.
import { pool } from "@workspace/db";
import type { LibraryTablesDiagnostics } from "./tableDiagnosticsText.js";

export { describeTableDiagnostics, type LibraryTablesDiagnostics } from "./tableDiagnosticsText.js";

export const LIBRARY_TABLES = ["lms_library_books", "lms_course_books", "lms_lesson_join_events"] as const;


let cache: { at: number; value: LibraryTablesDiagnostics } | null = null;
const CACHE_MS = 15_000;

export async function libraryTablesDiagnostics(): Promise<LibraryTablesDiagnostics> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const tables = [...LIBRARY_TABLES];
  const [meta, regs, found] = await Promise.all([
    pool.query<{ database: string; current_schema: string | null; search_path: string }>(
      "select current_database() as database, current_schema() as current_schema, current_setting('search_path') as search_path",
    ),
    pool.query<{ name: string; present: boolean }>(
      "select t.name, to_regclass('public.' || quote_ident(t.name)) is not null as present from unnest($1::text[]) as t(name)",
      [tables],
    ),
    pool.query<{ relname: string; nspname: string }>(
      "select c.relname, n.nspname from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r','p','v','m','f') and c.relname = any($1::text[]) order by n.nspname",
      [tables],
    ),
  ]);
  const inPublic: Record<string, boolean> = {};
  const foundInSchemas: Record<string, string[]> = {};
  for (const table of tables) {
    inPublic[table] = Boolean(regs.rows.find((row) => row.name === table)?.present);
    foundInSchemas[table] = found.rows.filter((row) => row.relname === table).map((row) => row.nspname);
  }
  const value: LibraryTablesDiagnostics = {
    database: meta.rows[0]?.database ?? null,
    currentSchema: meta.rows[0]?.current_schema ?? null,
    searchPath: meta.rows[0]?.search_path ?? null,
    inPublic,
    foundInSchemas,
  };
  cache = { at: Date.now(), value };
  return value;
}
