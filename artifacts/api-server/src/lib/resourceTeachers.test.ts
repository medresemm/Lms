import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/pg-core";
import { resourceTeachersTable } from "@workspace/db/schema";
import { joinTeacherNames, planTeacherSet, resourceTeacherIds, teacherNameList, userTeachesResourceWith } from "./resourceTeachersCore.js";
import { isMissingTableError } from "./library/uploads.js";

const co = new Map<number, string[]>([[1, ["b", "c", "a"]], [2, ["x"]]]);

test("resourceTeacherIds: main first, co-teachers deduped; skeleton lessons have none", () => {
  assert.deepEqual(resourceTeacherIds({ id: 1, teacherClerkUserId: "a" }, co), ["a", "b", "c"]);
  assert.deepEqual(resourceTeacherIds({ id: 3, teacherClerkUserId: "a" }, co), ["a"]);
  assert.deepEqual(resourceTeacherIds({ id: 2, teacherClerkUserId: null }, co), []);
});

test("co-teacher has the same access as the main teacher on that group only", () => {
  assert.ok(userTeachesResourceWith("a", { id: 1, teacherClerkUserId: "a" }, co));
  assert.ok(userTeachesResourceWith("c", { id: 1, teacherClerkUserId: "a" }, co));
  assert.ok(!userTeachesResourceWith("c", { id: 3, teacherClerkUserId: "a" }, co));
  assert.ok(!userTeachesResourceWith("x", { id: 2, teacherClerkUserId: null }, co));
  assert.ok(!userTeachesResourceWith(null, { id: 1, teacherClerkUserId: "a" }, co));
});

test("teacher names are joined for students, schedule PDF and AI", () => {
  const names = new Map<string, string | null>([["a", "Əli Məmmədov"], ["b", "Vəli Həsənov"], ["c", null]]);
  assert.equal(joinTeacherNames(["a", "b", "c"], names), "Əli Məmmədov, Vəli Həsənov");
  assert.deepEqual(teacherNameList(["b", "a"], names), ["Vəli Həsənov", "Əli Məmmədov"]);
  assert.equal(joinTeacherNames(["c"], names), null);
});

test("planTeacherSet: add, remove, keep at least one, promote when main removed", () => {
  const add = planTeacherSet("a", [], ["a", "b"]);
  assert.ok(add.ok);
  if (add.ok) {
    assert.equal(add.mainTeacherId, "a");
    assert.deepEqual(add.coTeacherIds, ["b"]);
    assert.deepEqual(add.added, ["b"]);
    assert.deepEqual(add.removed, []);
    assert.equal(add.mainChanged, false);
  }
  const remove = planTeacherSet("a", ["b", "c"], ["c", "a"]);
  assert.ok(remove.ok);
  if (remove.ok) {
    assert.equal(remove.mainTeacherId, "a");
    assert.deepEqual(remove.coTeacherIds, ["c"]);
    assert.deepEqual(remove.removed, ["b"]);
  }
  const promote = planTeacherSet("a", ["b"], ["b"]);
  assert.ok(promote.ok);
  if (promote.ok) {
    assert.equal(promote.mainTeacherId, "b");
    assert.deepEqual(promote.coTeacherIds, []);
    assert.deepEqual(promote.removed, ["a"]);
    assert.equal(promote.mainChanged, true);
  }
  const empty = planTeacherSet("a", ["b"], []);
  assert.equal(empty.ok, false);
  const blanks = planTeacherSet("a", [], ["  ", ""]);
  assert.equal(blanks.ok, false);
  assert.equal(planTeacherSet("a", [], Array.from({ length: 11 }, (_, i) => `t${i}`)).ok, false);
});

test("missing lms_resource_teachers is detected as missing table (graceful degradation)", () => {
  const error = Object.assign(new Error('relation "lms_resource_teachers" does not exist'), { code: "42P01" });
  assert.ok(isMissingTableError(error, "lms_resource_teachers"));
  assert.ok(!isMissingTableError(error, "lms_course_books"));
});

function sqlColumns(sql: string, table: string) {
  const match = new RegExp(`CREATE TABLE IF NOT EXISTS "${table}" \\(([\\s\\S]*?)\\n\\);`).exec(sql);
  assert.ok(match, `${table} SQL-də tapılmadı`);
  return match[1]!.split("\n").map((line) => line.trim()).filter((line) => line.startsWith('"'))
    .map((line) => { const [, name, type] = /^"([^"]+)"\s+(\w+)/.exec(line)!; return { name: name!, type: type! }; });
}

test("manual SQL for lms_resource_teachers matches the drizzle schema", () => {
  const sql = readFileSync(new URL("../../../../lib/db/manual-sql/2026-10-10-resource-teachers.sql", import.meta.url), "utf8");
  const typeOf: Record<string, string> = { PgSerial: "serial", PgText: "text", PgInteger: "integer", PgTimestamp: "timestamp" };
  const config = getTableConfig(resourceTeachersTable);
  const expected = config.columns.map((column) => ({ name: column.name, type: typeOf[column.columnType] ?? column.columnType }));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  assert.deepEqual(sqlColumns(sql, config.name).sort(byName), expected.sort(byName));
  for (const index of config.indexes) assert.ok(sql.includes(`"${index.config.name}"`), `${index.config.name} SQL-də yoxdur`);
});
