import { test } from "node:test";
import assert from "node:assert/strict";
import { candidateStatus, capacityError, INACTIVE_STUDENT_ERROR, managesAllGroups, OTHER_GROUP_ERROR, OTHER_GROUP_REASON, planRosterAdd } from "./groupRoster.js";

const base = {
  eligibleIds: new Set([1, 2, 3, 4, 5]),
  visibleMemberIds: [1],
  otherGroupProfileIds: new Set<number>([4]),
  pendingProfileIds: [] as number[],
  capacity: 0,
};

test("adds new students and skips existing members", () => {
  assert.deepEqual(planRosterAdd({ ...base, requested: [1, 2, 3] }), { ok: true, toAdd: [2, 3] });
});

test("a student in another group of the same subject is refused with the verbatim reason", () => {
  const plan = planRosterAdd({ ...base, requested: [2, 4] });
  assert.equal(plan.ok, false);
  assert.equal(!plan.ok && plan.error, OTHER_GROUP_ERROR);
  assert.equal(OTHER_GROUP_ERROR, "Seçilən tələbələrdən biri həmin fənn üzrə başqa müəllim qrupundadır.");
});

test("staff / inactive accounts cannot be added", () => {
  const plan = planRosterAdd({ ...base, requested: [9] });
  assert.equal(!plan.ok && plan.error, INACTIVE_STUDENT_ERROR);
});

test("capacity counts members plus additions and pending choices", () => {
  const over = planRosterAdd({ ...base, capacity: 2, requested: [2, 3] });
  assert.equal(!over.ok && over.error, capacityError(2));
  const pending = planRosterAdd({ ...base, capacity: 2, pendingProfileIds: [5], requested: [2] });
  assert.equal(pending.ok, false);
  assert.equal(!pending.ok && pending.status, 409);
  assert.deepEqual(planRosterAdd({ ...base, capacity: 2, requested: [2] }), { ok: true, toAdd: [2] });
});

test("empty and duplicate selections are rejected", () => {
  assert.equal(planRosterAdd({ ...base, requested: [] }).ok, false);
  assert.equal(planRosterAdd({ ...base, requested: [2, 2] }).ok, false);
});

test("candidate status marks members and other-group students", () => {
  assert.deepEqual(candidateStatus(1, new Set([1]), new Set([4])), { profileId: 1, inGroup: true, unavailableReason: null });
  assert.deepEqual(candidateStatus(4, new Set([1]), new Set([4])), { profileId: 4, inGroup: false, unavailableReason: OTHER_GROUP_REASON });
  assert.deepEqual(candidateStatus(2, new Set([1]), new Set([4])), { profileId: 2, inGroup: false, unavailableReason: null });
});

test("owner, board and admin manage all groups; teachers only their own", () => {
  assert.ok(managesAllGroups("owner"));
  assert.ok(managesAllGroups("owner_assistant"));
  assert.ok(managesAllGroups("admin"));
  assert.ok(managesAllGroups("none", true));
  assert.ok(!managesAllGroups("teacher"));
  assert.ok(!managesAllGroups("supervisor"));
});
