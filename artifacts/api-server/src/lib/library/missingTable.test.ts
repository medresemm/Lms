import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/pg-core";
import { courseBooksTable, libraryBooksTable } from "@workspace/db/schema";
import { describeDbError, isMissingTableError } from "./uploads.js";
import { describeTableDiagnostics, type LibraryTablesDiagnostics } from "./tableDiagnosticsText.js";

function pgError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}
// drizzle-orm DrizzleQueryError: «Failed query: ...», əsl pg xətası cause-dadır.
function drizzleWrapped(cause: unknown) {
  return Object.assign(new Error('Failed query: select "id" from "lms_library_books"'), { cause });
}

test("isMissingTableError: only 42P01 for the named table counts as missing", () => {
  assert.ok(isMissingTableError(pgError("42P01", 'relation "lms_library_books" does not exist')));
  assert.ok(isMissingTableError(pgError("42P01", 'relation "public.lms_library_books" does not exist')));
  assert.ok(isMissingTableError(drizzleWrapped(pgError("42P01", 'relation "lms_library_books" does not exist'))));
  assert.ok(isMissingTableError({ message: "query failed", cause: { code: "42P01" } }));
  assert.ok(isMissingTableError(pgError("42P01", 'relation "lms_course_books" does not exist'), "lms_course_books"));
  // başqa cədvəl yoxdur — bizim cədvəl «yaradılmayıb» deyil
  assert.ok(!isMissingTableError(pgError("42P01", 'relation "lms_audit_events" does not exist')));
  assert.ok(!isMissingTableError(pgError("42P01", 'relation "lms_library_books" does not exist'), "lms_course_books"));
  // sütun uyğunsuzluğu, icazə, bağlantı — «cədvəl yoxdur» deyil
  assert.ok(!isMissingTableError(pgError("42703", 'column "short_title" of relation "lms_library_books" does not exist')));
  assert.ok(!isMissingTableError(drizzleWrapped(pgError("42703", 'column "has_cover" does not exist'))));
  assert.ok(!isMissingTableError(pgError("42501", "permission denied for table lms_library_books")));
  assert.ok(!isMissingTableError(new Error("connection refused")));
  assert.ok(!isMissingTableError(null));
});

test("describeDbError walks the cause chain with codes", () => {
  const text = describeDbError(drizzleWrapped(pgError("42P01", 'relation "lms_library_books" does not exist')));
  assert.match(text, /Failed query/);
  assert.match(text, /\[42P01\] relation "lms_library_books" does not exist/);
});

test("describeTableDiagnostics explains wrong project vs wrong schema vs present", () => {
  const base: LibraryTablesDiagnostics = {
    database: "postgres",
    currentSchema: "public",
    searchPath: '"$user", public',
    inPublic: { lms_library_books: false },
    foundInSchemas: { lms_library_books: [] },
  };
  assert.match(describeTableDiagnostics(base, "lms_library_books"), /heç bir sxemdə yoxdur/);
  assert.match(describeTableDiagnostics({ ...base, foundInSchemas: { lms_library_books: ["extensions"] } }, "lms_library_books"), /«extensions» sxemində/);
  assert.match(describeTableDiagnostics({ ...base, inPublic: { lms_library_books: true }, foundInSchemas: { lms_library_books: ["public"] } }, "lms_library_books"), /mövcuddur/);
});

function sqlColumns(sql: string, table: string) {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS "${table}"`);
  assert.ok(start >= 0, `${table} SQL-də yoxdur`);
  const body = sql.slice(sql.indexOf("(", start) + 1, sql.indexOf("\n);", start));
  return body.split("\n").map((line) => /^\s*"([a-z_]+)"\s+(\w+)/.exec(line)).filter(Boolean)
    .map((match) => ({ name: match![1], type: match![2] }));
}

test("manual SQL for library tables matches the drizzle schema exactly", () => {
  const sql = readFileSync(new URL("../../../../../lib/db/manual-sql/2026-10-09-library-tables.sql", import.meta.url), "utf8");
  const typeOf: Record<string, string> = { PgSerial: "serial", PgText: "text", PgInteger: "integer", PgJsonb: "jsonb", PgBoolean: "boolean", PgTimestamp: "timestamp" };
  for (const table of [libraryBooksTable, courseBooksTable]) {
    const config = getTableConfig(table);
    assert.equal(config.schema, undefined, "cədvəl public sxemində olmalıdır (pgSchema yoxdur)");
    const expected = config.columns.map((column) => ({ name: column.name, type: typeOf[column.columnType] ?? column.columnType }));
    assert.deepEqual(sqlColumns(sql, config.name).sort((a, b) => a.name.localeCompare(b.name)), expected.sort((a, b) => a.name.localeCompare(b.name)));
  }
});
