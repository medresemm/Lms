import { test } from "node:test";
import assert from "node:assert/strict";
import { isGroupRow, isScheduleRow, isTeacherlessGroup, studentVisibleRows } from "./resourceGroupsCore.js";

const flagged = new Set([3]);

test("teacher rows are groups with or without the flag; teacher-less rows only when flagged", () => {
  assert.equal(isGroupRow({ id: 1, teacherClerkUserId: "t1" }, new Set()), true);
  assert.equal(isGroupRow({ id: 2, teacherClerkUserId: null }, flagged), false);
  assert.equal(isScheduleRow({ id: 2, teacherClerkUserId: null }, flagged), true);
  assert.equal(isGroupRow({ id: 3, teacherClerkUserId: null }, flagged), true);
  assert.equal(isTeacherlessGroup({ id: 3, teacherClerkUserId: null }, flagged), true);
  assert.equal(isTeacherlessGroup({ id: 1, teacherClerkUserId: "t1" }, flagged), false);
});

test("students never see teacher-less groups or schedule rows", () => {
  const rows = [
    { id: 1, courseId: 10, teacherClerkUserId: "t1" },
    { id: 3, courseId: 10, teacherClerkUserId: null },
    { id: 4, courseId: 20, teacherClerkUserId: null },
  ];
  // Assigned to the teacher-less group: sees nothing for course 10 (not the other teacher's group).
  assert.deepEqual(studentVisibleRows(rows, new Set([3]), new Set(), flagged).map((row) => row.id), []);
  // Assigned to the teacher group: sees it.
  assert.deepEqual(studentVisibleRows(rows, new Set([1]), new Set(), flagged).map((row) => row.id), [1]);
  // Unassigned and the course has two groups (one teacher-less): no single-group fallback.
  assert.deepEqual(studentVisibleRows(rows, new Set(), new Set(), flagged).map((row) => row.id), []);
});

test("legacy single-group fallback and removed courses still work", () => {
  const rows = [
    { id: 1, courseId: 10, teacherClerkUserId: "t1" },
    { id: 2, courseId: 20, teacherClerkUserId: "t2" },
  ];
  assert.deepEqual(studentVisibleRows(rows, new Set(), new Set(), new Set()).map((row) => row.id), [1, 2]);
  assert.deepEqual(studentVisibleRows(rows, new Set(), new Set([20]), new Set()).map((row) => row.id), [1]);
});
