import { test } from "node:test";
import assert from "node:assert/strict";
import { formatStudentNumber, staffStudentNote } from "./staff-student-note";

const record = { clerkUserId: "u1", profileId: 7, studentNumber: 95, groupCount: 2 };

test("no note without a student record or when the account stays a student", () => {
  assert.equal(staffStudentNote(undefined, "none", "teacher"), null);
  assert.equal(staffStudentNote(record, "none", "none"), null);
  assert.equal(staffStudentNote(record, "teacher", "none"), null);
});

test("promoting a student shows number, group count and that data is kept", () => {
  const note = staffStudentNote(record, "none", "teacher")!;
  assert.match(note, /T0095/);
  assert.match(note, /2 müəllim qrupunda/);
  assert.match(note, /Müəllim rolu/);
  assert.match(note, /silinmir/);
  assert.doesNotMatch(note, /LMS/);
});

test("already-staff account gets the shorter hidden note; zero groups omits the group clause", () => {
  const note = staffStudentNote({ ...record, groupCount: 0 }, "owner_assistant", "owner_assistant")!;
  assert.match(note, /göstərilmir/);
  assert.doesNotMatch(note, /qrupunda/);
  assert.equal(formatStudentNumber(1), "T0001");
});
