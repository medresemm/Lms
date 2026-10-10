import { test } from "node:test";
import assert from "node:assert/strict";
import { filterGroups, groupCapacityLabel, groupIsFull, groupScheduleLabel, matchesStudentSearch, type GroupView } from "./groups";

const group = (patch: Partial<GroupView>): GroupView => ({
  id: 1, courseId: 10, courseTitle: "Quran", termNumber: 1, teacherClerkUserId: "t1", coTeacherClerkUserIds: [], teacherName: "Fərman İsayev",
  teacherNames: ["Fərman İsayev"], lessonDays: ["monday"], lessonTime: "18:00", studentCapacity: 0, studentCount: 0, pendingCount: 0,
  canManageStudents: true, canDelete: true, ...patch,
});

test("schedule label formats per-day JSON times in week order", () => {
  assert.equal(groupScheduleLabel(group({ lessonDays: ["saturday", "monday"], lessonTime: '{"monday":"22:13","saturday":"21:13"}' })), "Bazar ertəsi 22:13, Şənbə 21:13");
  assert.equal(groupScheduleLabel(group({ lessonDays: ["friday"], lessonTime: "19:30" })), "Cümə 19:30");
  assert.equal(groupScheduleLabel(group({ lessonDays: [] })), "Gün təyin edilməyib");
});

test("capacity label and full state", () => {
  assert.equal(groupCapacityLabel(group({ studentCount: 3, studentCapacity: 10 })), "3 / 10 tələbə");
  assert.equal(groupCapacityLabel(group({ studentCount: 3 })), "3 tələbə · limitsiz");
  assert.ok(groupIsFull(group({ studentCount: 10, studentCapacity: 10 })));
  assert.ok(!groupIsFull(group({ studentCount: 10, studentCapacity: 0 })));
});

test("filters by semester, subject, teacher (incl. co-teacher) and search", () => {
  const groups = [
    group({ id: 1 }),
    group({ id: 2, termNumber: 2, courseId: 11, courseTitle: "Ərəb dili", teacherClerkUserId: "t2", coTeacherClerkUserIds: ["t1"], teacherNames: ["Əli", "Fərman İsayev"] }),
  ];
  const base = { termNumber: null, courseId: null, teacherId: "", search: "" };
  assert.deepEqual(filterGroups(groups, { ...base, termNumber: 2 }).map((g) => g.id), [2]);
  assert.deepEqual(filterGroups(groups, { ...base, courseId: 10 }).map((g) => g.id), [1]);
  assert.deepEqual(filterGroups(groups, { ...base, teacherId: "t1" }).map((g) => g.id), [1, 2]);
  assert.deepEqual(filterGroups(groups, { ...base, search: "ereb" }).map((g) => g.id), [2]);
});

test("student search matches names and T-number", () => {
  const student = { firstName: "Məryəm", lastName: "Əliyeva", studentNumber: 7 };
  assert.ok(matchesStudentSearch(student, "meryem"));
  assert.ok(matchesStudentSearch(student, "T0007"));
  assert.ok(!matchesStudentSearch(student, "hüseyn"));
});
