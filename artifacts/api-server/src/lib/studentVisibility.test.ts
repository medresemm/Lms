import test from "node:test";
import assert from "node:assert/strict";
import { isStaffRole, isVisibleStudent, rosterIdsToKeep, staffIdsFrom, withoutStaff } from "./studentVisibility.js";

test("every non-student role counts as staff", () => {
  for (const role of ["owner", "admin", "teacher", "supervisor", "owner_assistant"] as const) assert.equal(isStaffRole(role), true, role);
  assert.equal(isStaffRole("none"), false);
  assert.equal(isStaffRole(null), false);
});

test("staffIdsFrom collects staff roles and configured admin ids", () => {
  const ids = staffIdsFrom([
    { id: "u_student", role: "none" },
    { id: "u_teacher", role: "teacher" },
    { id: "u_board", role: "owner_assistant" },
    { id: "u_owner", role: "owner" },
  ], ["u_env_admin", ""]);
  assert.deepEqual([...ids].sort(), ["u_board", "u_env_admin", "u_owner", "u_teacher"]);
});

test("promoted account is hidden, demoted account reappears, unlinked rows stay", () => {
  const rows = [
    { name: "Tələbə", clerkUserId: "u_student" },
    { name: "Mahir (müəllim)", clerkUserId: "u_mahir" },
    { name: "Hesabsız", clerkUserId: null },
  ];
  const promoted = withoutStaff(rows, (row) => row.clerkUserId, new Set(["u_mahir"]));
  assert.deepEqual(promoted.map((row) => row.name), ["Tələbə", "Hesabsız"]);
  const demoted = withoutStaff(rows, (row) => row.clerkUserId, new Set());
  assert.equal(demoted.length, 3);
  assert.equal(isVisibleStudent(undefined, new Set(["x"])), true);
});

test("rewriting a group roster keeps hidden staff memberships", () => {
  assert.deepEqual(rosterIdsToKeep([1, 2], [2, 3, 9], new Set([9])).sort(), [1, 2, 9]);
  assert.deepEqual(rosterIdsToKeep([], [9], new Set([9])), [9]);
  assert.deepEqual(rosterIdsToKeep([4], [5], new Set()), [4]);
});
