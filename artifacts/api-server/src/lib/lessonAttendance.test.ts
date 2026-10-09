import assert from "node:assert/strict";
import test from "node:test";
import {
  academyToday,
  buildSessionRows,
  joinableSession,
  recentSessionDates,
  resolveConfirmation,
  resolveMeetingUrl,
  rosterForResource,
  sessionSummary,
  type RosterStudent,
} from "./lessonAttendance.js";

// 2026-10-12 bazar ertəsi; dərs Bakı vaxtı 18:00 = 14:00 UTC.
const monday = { lessonDays: ["monday"], lessonTime: "18:00" };
const at = (iso: string) => new Date(iso);

test("akademiya tarixi Bakı vaxtı ilə hesablanır", () => {
  assert.deepEqual(academyToday(at("2026-10-11T20:30:00Z")), { date: "2026-10-12", weekday: "monday" });
});

test("qoşulma pəncərəsi: 15 dəq əvvəl açılır, 3 saat sonra bağlanır, 20 dəq-dən sonra gecikmə", () => {
  assert.deepEqual(joinableSession(monday, at("2026-10-12T13:40:00Z")).ok, false);
  const early = joinableSession(monday, at("2026-10-12T13:50:00Z"));
  assert.equal(early.ok && early.punctuality, "on_time");
  assert.equal(early.ok && early.sessionDate, "2026-10-12");
  const late = joinableSession(monday, at("2026-10-12T14:30:00Z"));
  assert.equal(late.ok && late.punctuality, "late");
  assert.equal(joinableSession(monday, at("2026-10-12T17:01:00Z")).ok, false);
  const wrongDay = joinableSession(monday, at("2026-10-13T14:00:00Z"));
  assert.equal(!wrongDay.ok && wrongDay.reason, "not_today");
  assert.equal(joinableSession({ lessonDays: ["monday"], lessonTime: null }, at("2026-10-12T14:00:00Z")).ok, false);
});

test("son 14 günün başlamış dərs tarixləri", () => {
  assert.deepEqual(recentSessionDates(monday, at("2026-10-12T13:00:00Z")), ["2026-10-05", "2026-09-28"]);
  assert.deepEqual(recentSessionDates(monday, at("2026-10-12T14:00:00Z")), ["2026-10-12", "2026-10-05", "2026-09-28"]);
});

test("dərs qrupunun siyahısı tələbə panelindəki görünmə qaydasına uyğundur", () => {
  const groupA = { id: 1, courseId: 10, termNumber: 1 };
  const groupB = { id: 2, courseId: 10, termNumber: 1 };
  const student = (profileId: number, extra: Partial<RosterStudent> = {}): RosterStudent => ({
    profileId, currentTermNumber: 1, removedCourseIds: new Set(), approvedResourceIds: new Set(), ...extra,
  });
  const students = [
    student(1, { approvedResourceIds: new Set([1]) }),
    student(2, { approvedResourceIds: new Set([2]) }),
    student(3),
    student(4, { currentTermNumber: 2 }),
    student(5, { removedCourseIds: new Set([10]), approvedResourceIds: new Set([1]) }),
  ];
  assert.deepEqual(rosterForResource(groupA, [groupA, groupB], students), [1]);
  assert.deepEqual(rosterForResource(groupB, [groupA, groupB], students), [2]);
  // Fənnin yeganə qrupu: başqa qrupa bağlı olmayan bütün cari semestr tələbələri.
  assert.deepEqual(rosterForResource(groupA, [groupA], students), [1, 2, 3]);
});

test("qoşulanlar «girib», qoşulmayanlar «girməyib»; təsdiq bir dəfəyə yazır", () => {
  const rows = buildSessionRows(
    [{ profileId: 1, studentName: "Əli", studentNumber: 1 }, { profileId: 2, studentName: "Aygün", studentNumber: 2 }, { profileId: 3, studentName: "Zəhra", studentNumber: 3 }],
    [{ profileId: 1, joinedAt: "2026-10-12T14:01:00.000Z", punctuality: "on_time" }],
    [{ id: 9, profileId: 3, status: "excused", teacherName: "Müəllim", recordedAt: "2026-10-12T15:00:00.000Z" }],
  );
  assert.deepEqual(rows.map((row) => [row.profileId, row.joined, row.autoStatus, row.suggestedStatus]), [
    [1, true, "present", "present"],
    [2, false, "absent", "absent"],
    [3, false, "absent", "excused"],
  ]);
  assert.equal(rows[0].joinedAt, "2026-10-12T14:01:00.000Z");
  assert.deepEqual(sessionSummary(rows), { total: 3, joined: 1, notJoined: 2, confirmed: 1, state: "partial" });
  // Müəllim heç nə seçmədən təsdiqləyir: avtomatik statuslar yazılır, üzrlü qeyd toxunulmaz qalır.
  assert.deepEqual(resolveConfirmation(rows, {}), [{ profileId: 1, status: "present" }, { profileId: 2, status: "absent" }]);
  // İstəyə bağlı düzəliş.
  assert.deepEqual(resolveConfirmation(rows, { 2: "late", 3: "absent" }), [
    { profileId: 1, status: "present" }, { profileId: 2, status: "late" }, { profileId: 3, status: "absent" },
  ]);
});

test("qoşulma linki: müəllimin aktiv qrup linki, sonra fənnin Zoom/Meet linki; təhlükəli sxemlər rədd edilir", () => {
  const course = { zoomUrl: "https://zoom.us/j/1", googleMeetUrl: "https://meet.google.com/abc", lessonUrl: null };
  assert.equal(resolveMeetingUrl("https://meet.google.com/group", course, null), "https://meet.google.com/group");
  assert.equal(resolveMeetingUrl("https://meet.google.com/group", course, "zoom"), "https://zoom.us/j/1");
  assert.equal(resolveMeetingUrl(null, course, "meet"), "https://meet.google.com/abc");
  assert.equal(resolveMeetingUrl("javascript:alert(1)", { zoomUrl: null, googleMeetUrl: null, lessonUrl: null }, null), null);
});
