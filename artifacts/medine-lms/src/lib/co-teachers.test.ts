import { test } from "node:test";
import assert from "node:assert/strict";
import { isCoTaught, orderedTeacherSelection, resourceTeacherIds, resourceTeacherLabel, sameTeacherSet, teachesResource } from "./co-teachers";

test("resourceTeacherIds: main first, co-teachers deduped, none without main", () => {
  assert.deepEqual(resourceTeacherIds({ teacherClerkUserId: "a", coTeacherClerkUserIds: ["b", "a", "c", "b"] }), ["a", "b", "c"]);
  assert.deepEqual(resourceTeacherIds({ teacherClerkUserId: null, coTeacherClerkUserIds: ["b"] }), []);
  assert.deepEqual(resourceTeacherIds({ teacherClerkUserId: "a" }), ["a"]);
});

test("teachesResource / isCoTaught", () => {
  const r = { teacherClerkUserId: "a", coTeacherClerkUserIds: ["b"] };
  assert.ok(teachesResource(r, "a"));
  assert.ok(teachesResource(r, "b"));
  assert.ok(!teachesResource(r, "c"));
  assert.ok(!teachesResource(r, null));
  assert.ok(isCoTaught(r));
  assert.ok(!isCoTaught({ teacherClerkUserId: "a", coTeacherClerkUserIds: [] }));
});

test("resourceTeacherLabel joins all names", () => {
  assert.equal(resourceTeacherLabel({ teacherNames: ["Əli", "Vəli"], teacherName: "Əli, Vəli" }), "Əli, Vəli");
  assert.equal(resourceTeacherLabel({ teacherName: "Əli" }), "Əli");
  assert.equal(resourceTeacherLabel({}), "Müəllim təyin edilməyib");
});

test("orderedTeacherSelection keeps the main teacher first", () => {
  assert.deepEqual(orderedTeacherSelection("a", ["c", "a", "b"]), ["a", "c", "b"]);
  assert.deepEqual(orderedTeacherSelection("a", ["c", "b"]), ["c", "b"]);
  assert.deepEqual(orderedTeacherSelection(null, ["c", "c"]), ["c"]);
  assert.ok(sameTeacherSet(["a", "b", "c"], ["a", "c", "b"]));
  assert.ok(!sameTeacherSet(["a", "b"], ["b", "a"]));
});
