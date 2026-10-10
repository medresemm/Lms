import { Router, type IRouter, type Response } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import {
  applicationsTable,
  coursesTable,
  db,
  lessonJoinEventsTable,
  resourcesTable,
  studentAcademicProfilesTable,
  studentAttendanceRecordsTable,
  studentCourseSelectionsTable,
  studentTeacherChoicesTable,
} from "@workspace/db";
import { recordAuditEvent } from "../lib/audit.js";
import { logger } from "../lib/logger.js";
import { coTeacherMap, resourceTeacherIds, userTeachesResource } from "../lib/resourceTeachers.js";
import {
  JOIN_WINDOW_EARLY_MINUTES,
  JOIN_WINDOW_LATE_MINUTES,
  SESSION_LOOKBACK_DAYS,
  academyToday,
  buildSessionRows,
  isIsoDate,
  joinableSession,
  lessonStartUtc,
  lessonTimeForDay,
  parsePlatform,
  recentSessionDates,
  resolveConfirmation,
  resolveRollCallMarks,
  rollCallDefaultStatus,
  resolveMeetingUrl,
  rosterForResource,
  sessionSummary,
  weekdayOf,
  type RosterStudent,
} from "../lib/lessonAttendance.js";
import {
  currentTermNumber,
  getApprovedStudentProfile,
  getClerkUser,
  getStudentVisibleCourseIds,
  metadataRole,
  ownerDisplayNameParts,
  requireTeacher,
  resourceLinkIsExpired,
  resourceTeacherLabels,
  userIsSystemOwner,
} from "./lms.js";

const router: IRouter = Router();

type ResourceRow = typeof resourcesTable.$inferSelect;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] ?? char));
}

/** Yeni tabda açılan qoşulma linki üçün sadə Azərbaycan dilində məlumat səhifəsi (JSON əvəzinə). */
function sendJoinPage(res: Response, status: number, title: string, message: string, meetingUrl?: string | null) {
  const link = meetingUrl
    ? `<p><a href="${escapeHtml(meetingUrl)}" rel="noreferrer">Yenə də dərs linkini aç</a></p>`
    : `<p><a href="/">Akademiya saytına qayıt</a></p>`;
  res.status(status).type("html").send(`<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,sans-serif;background:#fbfaf5;color:#173b51;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:460px;padding:28px;border:1px solid #e5dcc5;border-radius:18px;background:#fff}h1{font-size:20px;margin:0 0 10px}p{line-height:1.55;font-size:15px}a{color:#9e782a;font-weight:700}</style></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${link}</main></body></html>`);
}

async function studentRosterData(profileIds?: number[]) {
  const filters = [eq(applicationsTable.status, "approved"), isNull(applicationsTable.deletedAt)];
  if (profileIds) filters.push(inArray(studentAcademicProfilesTable.id, profileIds.length ? profileIds : [-1]));
  const rows = await db.select({ profile: studentAcademicProfilesTable, firstName: applicationsTable.firstName, lastName: applicationsTable.lastName })
    .from(studentAcademicProfilesTable)
    .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
    .where(and(...filters));
  const ids = rows.map((row) => row.profile.id);
  const [removed, choices] = ids.length ? await Promise.all([
    db.select({ profileId: studentCourseSelectionsTable.profileId, courseId: studentCourseSelectionsTable.courseId, termNumber: studentCourseSelectionsTable.termNumber })
      .from(studentCourseSelectionsTable)
      .where(and(inArray(studentCourseSelectionsTable.profileId, ids), eq(studentCourseSelectionsTable.selected, false))),
    db.select({ profileId: studentTeacherChoicesTable.profileId, resourceId: studentTeacherChoicesTable.resourceId })
      .from(studentTeacherChoicesTable)
      .where(and(inArray(studentTeacherChoicesTable.profileId, ids), eq(studentTeacherChoicesTable.status, "approved"))),
  ]) : [[], []];
  const students: Array<RosterStudent & { studentName: string; studentNumber: number }> = rows.map((row) => {
    const term = currentTermNumber(row.profile);
    return {
      profileId: row.profile.id,
      currentTermNumber: term,
      removedCourseIds: new Set(removed.filter((item) => item.profileId === row.profile.id && item.termNumber === term).map((item) => item.courseId)),
      approvedResourceIds: new Set(choices.filter((item) => item.profileId === row.profile.id).map((item) => item.resourceId)),
      studentName: `${row.firstName} ${row.lastName}`.trim() || "Tələbə",
      studentNumber: row.profile.studentNumber,
    };
  });
  return students;
}

async function courseTermResources(resource: Pick<ResourceRow, "courseId" | "termNumber">) {
  return db.select().from(resourcesTable).where(and(eq(resourcesTable.courseId, resource.courseId), eq(resourcesTable.termNumber, resource.termNumber)));
}

async function recordJoinIfOpen(resource: ResourceRow, profileId: number) {
  const session = joinableSession(resource);
  if (!session.ok) return session;
  const joinedAt = new Date().toISOString();
  await db.insert(lessonJoinEventsTable).values({
    resourceId: resource.id, profileId, termNumber: resource.termNumber,
    sessionDate: session.sessionDate, joinedAt, punctuality: session.punctuality,
  }).onConflictDoNothing({
    target: [lessonJoinEventsTable.resourceId, lessonJoinEventsTable.profileId, lessonJoinEventsTable.sessionDate],
  });
  return session;
}

/**
 * Tələbənin "Dərsə qoşul" linki: qoşulmanı serverdə qeyd edir və Zoom/Google Meet linkinə yönləndirir.
 * GET /api/lessons/:resourceId/join?platform=zoom|meet|lesson
 * GET /api/courses/:courseId/join?platform=zoom|meet|lesson (tələbənin həmin fənn üzrə qrupu tapılır)
 */
async function handleJoin(res: Response, userId: string | null | undefined, target: { resourceId?: number; courseId?: number }, platformValue: unknown) {
  if (!userId) {
    sendJoinPage(res, 401, "Giriş tələb olunur", "Dərsə qoşulmaq üçün əvvəlcə akademiya saytında hesabınıza daxil olun, sonra linkə yenidən klikləyin.");
    return;
  }
  const profile = await getApprovedStudentProfile(userId);
  if (!profile) {
    sendJoinPage(res, 403, "Giriş icazəsi yoxdur", "Bu link yalnız təsdiqlənmiş tələbələr üçündür.");
    return;
  }
  const platform = parsePlatform(platformValue);
  const term = currentTermNumber(profile);
  let resource: ResourceRow | undefined;
  let courseId = target.courseId;
  if (target.resourceId) {
    [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, target.resourceId)).limit(1);
    if (!resource) { sendJoinPage(res, 404, "Dərs tapılmadı", "Bu dərs artıq mövcud deyil."); return; }
    courseId = resource.courseId;
  }
  const [course] = courseId ? await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1) : [];
  if (!course) { sendJoinPage(res, 404, "Fənn tapılmadı", "Bu fənn artıq mövcud deyil."); return; }
  if (!(await getStudentVisibleCourseIds(profile, [course])).has(course.id)) {
    sendJoinPage(res, 403, "Bu fənn sizin üçün aktiv deyil", "Bu fənn sizin cari semestrinizdə aktiv deyil.");
    return;
  }

  const [student] = await studentRosterData([profile.id]);
  const group = await courseTermResources({ courseId: course.id, termNumber: resource?.termNumber ?? term });
  const assigned = student ? group.filter((item) => rosterForResource(item, group, [student]).includes(profile.id)) : [];
  if (resource && !assigned.some((item) => item.id === resource!.id)) {
    sendJoinPage(res, 403, "Bu dərs sizin qrupunuz deyil", "Bu dərs qrupu sizin üçün təyin edilməyib.");
    return;
  }
  if (!resource) {
    if (!student || student.removedCourseIds.has(course.id)) {
      sendJoinPage(res, 403, "Bu fənn sizin üçün aktiv deyil", "Bu fənn sizin cari semestrinizdə aktiv deyil.");
      return;
    }
    resource = assigned.find((item) => joinableSession(item).ok) ?? assigned[0];
  }

  const resourceUrl = resource && !resourceLinkIsExpired(resource) ? resource.url : null;
  const meetingUrl = resolveMeetingUrl(resourceUrl, course, platform);
  if (!meetingUrl) {
    sendJoinPage(res, 404, "Dərs linki hələ yoxdur", "Müəllim bu dərs üçün hələ Zoom və ya Google Meet linki yerləşdirməyib.");
    return;
  }
  // Qeyd uğursuz olsa belə (məs. DB müvəqqəti əlçatmazdır) tələbə dərsə yönləndirilir; dərsə girişi bloklamırıq.
  if (resource) await recordJoinIfOpen(resource, profile.id).catch((error: unknown) => {
    logger.error({ err: error, resourceId: resource?.id }, "Lesson join could not be recorded");
  });
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.redirect(302, meetingUrl);
}

router.get("/lessons/:resourceId/join", async (req, res, next) => {
  try {
    const resourceId = Number(req.params.resourceId);
    if (!Number.isInteger(resourceId) || resourceId <= 0) { sendJoinPage(res, 400, "Link düzgün deyil", "Dərs linki düzgün deyil."); return; }
    await handleJoin(res, getAuth(req).userId, { resourceId }, req.query.platform);
  } catch (error) { next(error); }
});

router.get("/courses/:courseId/join", async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) { sendJoinPage(res, 400, "Link düzgün deyil", "Dərs linki düzgün deyil."); return; }
    await handleJoin(res, getAuth(req).userId, { courseId }, req.query.platform);
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// Müəllim/admin: dərs məşğələsi üzrə avtomatik davamiyyət və tək "Təsdiq et".
// Yol "/attendance" ehtiva edir, ona görə requireTeacher "attendance" icazəsini yoxlayır.
// ---------------------------------------------------------------------------

async function viewerAccess(userId: string) {
  const clerkUser = await getClerkUser(userId);
  const all = await userIsSystemOwner(userId, clerkUser) || metadataRole(clerkUser?.publicMetadata) === "admin";
  return { clerkUser, all };
}

function sessionIsOpenForReview(resource: ResourceRow, date: string, now = new Date()) {
  const lessonTime = lessonTimeForDay(resource.lessonTime, weekdayOf(date));
  if (!isIsoDate(date) || !lessonTime || !resource.lessonDays.includes(weekdayOf(date))) return false;
  return lessonStartUtc(date, lessonTime) - JOIN_WINDOW_EARLY_MINUTES * 60_000 <= now.getTime();
}

async function sessionDetail(resource: ResourceRow, date: string) {
  const [group, students, joins, records, courses] = await Promise.all([
    courseTermResources(resource),
    studentRosterData(),
    db.select().from(lessonJoinEventsTable).where(and(eq(lessonJoinEventsTable.resourceId, resource.id), eq(lessonJoinEventsTable.sessionDate, date))),
    db.select().from(studentAttendanceRecordsTable).where(and(eq(studentAttendanceRecordsTable.courseId, resource.courseId), eq(studentAttendanceRecordsTable.attendanceDate, date))),
    db.select({ id: coursesTable.id, title: coursesTable.title }).from(coursesTable).where(eq(coursesTable.id, resource.courseId)),
  ]);
  const rosterIds = new Set(rosterForResource(resource, group, students));
  // Siyahıdan sonradan çıxmış, amma bu məşğələyə qoşulmuş tələbələr də göstərilir.
  for (const join of joins) rosterIds.add(join.profileId);
  const roster = students.filter((student) => rosterIds.has(student.profileId));
  const rows = buildSessionRows(
    roster.map(({ profileId, studentName, studentNumber }) => ({ profileId, studentName, studentNumber })),
    joins,
    records.filter((record) => rosterIds.has(record.profileId)),
  );
  const teacherLabels = await resourceTeacherLabels([resource]);
  return {
    resourceId: resource.id,
    courseId: resource.courseId,
    courseTitle: courses[0]?.title ?? "Naməlum fənn",
    teacherName: teacherLabels.get(resource.id) ?? null,
    termNumber: resource.termNumber,
    lessonTime: resource.lessonTime,
    sessionDate: date,
    joinWindow: { earlyMinutes: JOIN_WINDOW_EARLY_MINUTES, lateMinutes: JOIN_WINDOW_LATE_MINUTES },
    summary: sessionSummary(rows),
    rows,
  };
}

async function loadManagedResource(req: { params: Record<string, unknown> }, res: Response, userId: string) {
  const resourceId = Number(req.params.resourceId);
  const date = typeof req.params.date === "string" ? req.params.date : "";
  if (!Number.isInteger(resourceId) || resourceId <= 0 || !isIsoDate(date)) {
    res.status(400).json({ error: "Dərs və tarix düzgün seçilməyib." });
    return null;
  }
  const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, resourceId)).limit(1);
  if (!resource) { res.status(404).json({ error: "Dərs tapılmadı." }); return null; }
  const access = await viewerAccess(userId);
  if (!access.all && !await userTeachesResource(userId, resource)) {
    res.status(403).json({ error: "Bu dərsin davamiyyətini yalnız məsul müəllim və ya admin idarə edə bilər." });
    return null;
  }
  if (!sessionIsOpenForReview(resource, date)) {
    res.status(400).json({ error: "Bu tarixdə həmin dərs planlaşdırılmayıb və ya hələ başlamayıb." });
    return null;
  }
  return { resource, date, access };
}

router.get("/admin/attendance/lesson-sessions", requireTeacher, async (req, res, next) => {
  try {
    const userId = getAuth(req).userId!;
    const access = await viewerAccess(userId);
    const coTeachers = await coTeacherMap();
    const resources = (await db.select().from(resourcesTable))
      .filter((resource) => resource.lessonDays.some((day) => lessonTimeForDay(resource.lessonTime, day)) && (access.all || resourceTeacherIds(resource, coTeachers).includes(userId)));
    if (!resources.length) { res.json([]); return; }
    const since = (() => {
      const [year, month, day] = academyToday().date.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, day - SESSION_LOOKBACK_DAYS)).toISOString().slice(0, 10);
    })();
    const resourceIds = resources.map((resource) => resource.id);
    const courseIds = Array.from(new Set(resources.map((resource) => resource.courseId)));
    const [allResources, students, joins, records, courses] = await Promise.all([
      db.select().from(resourcesTable).where(inArray(resourcesTable.courseId, courseIds)),
      studentRosterData(),
      db.select().from(lessonJoinEventsTable).where(and(inArray(lessonJoinEventsTable.resourceId, resourceIds), gte(lessonJoinEventsTable.sessionDate, since))),
      db.select().from(studentAttendanceRecordsTable).where(and(inArray(studentAttendanceRecordsTable.courseId, courseIds), gte(studentAttendanceRecordsTable.attendanceDate, since))),
      db.select({ id: coursesTable.id, title: coursesTable.title }).from(coursesTable).where(inArray(coursesTable.id, courseIds)),
    ]);
    const teacherLabels = await resourceTeacherLabels(resources);
    const sessions = resources.flatMap((resource) => {
      const rosterIds = new Set(rosterForResource(resource, allResources, students));
      return recentSessionDates(resource).map((date) => {
        const sessionJoins = joins.filter((join) => join.resourceId === resource.id && join.sessionDate === date);
        const ids = new Set(rosterIds);
        for (const join of sessionJoins) ids.add(join.profileId);
        const rows = buildSessionRows(
          students.filter((student) => ids.has(student.profileId)).map(({ profileId, studentName, studentNumber }) => ({ profileId, studentName, studentNumber })),
          sessionJoins,
          records.filter((record) => record.courseId === resource.courseId && record.attendanceDate === date && ids.has(record.profileId)),
        );
        return {
          resourceId: resource.id,
          courseId: resource.courseId,
          courseTitle: courses.find((course) => course.id === resource.courseId)?.title ?? "Naməlum fənn",
          teacherName: teacherLabels.get(resource.id) ?? null,
          termNumber: resource.termNumber,
          lessonTime: resource.lessonTime,
          sessionDate: date,
          summary: sessionSummary(rows),
        };
      });
    }).sort((a, b) => b.sessionDate.localeCompare(a.sessionDate) || (b.lessonTime ?? "").localeCompare(a.lessonTime ?? ""));
    res.json(sessions);
  } catch (error) { next(error); }
});

router.get("/admin/attendance/lesson-sessions/:resourceId/:date", requireTeacher, async (req, res, next) => {
  try {
    const loaded = await loadManagedResource(req, res, getAuth(req).userId!);
    if (!loaded) return;
    res.json(await sessionDetail(loaded.resource, loaded.date));
  } catch (error) { next(error); }
});

router.post("/admin/attendance/lesson-sessions/:resourceId/:date/confirm", requireTeacher, async (req, res, next) => {
  try {
    const userId = getAuth(req).userId!;
    const loaded = await loadManagedResource(req, res, userId);
    if (!loaded) return;
    const rawOverrides = req.body?.overrides;
    const overrides: Record<number, string> = {};
    if (rawOverrides && typeof rawOverrides === "object" && !Array.isArray(rawOverrides)) {
      for (const [key, value] of Object.entries(rawOverrides as Record<string, unknown>)) {
        const profileId = Number(key);
        if (!Number.isInteger(profileId) || profileId <= 0) continue;
        if (value !== "present" && value !== "late" && value !== "absent") {
          res.status(400).json({ error: "Davamiyyət statusu yalnız iştirak, gecikmə və ya qayıb ola bilər." });
          return;
        }
        overrides[profileId] = value;
      }
    }
    const before = await sessionDetail(loaded.resource, loaded.date);
    const writes = resolveConfirmation(before.rows, overrides);
    const clerkUser = loaded.access.clerkUser;
    const nameParts = clerkUser ? ownerDisplayNameParts(clerkUser) : null;
    const teacherName = nameParts ? [nameParts.firstName, nameParts.lastName].filter(Boolean).join(" ") || "Akademiya müəllimi" : "Akademiya müəllimi";
    const now = new Date().toISOString();
    if (writes.length) {
      await db.transaction(async (tx) => {
        for (const write of writes) {
          await tx.insert(studentAttendanceRecordsTable).values({
            profileId: write.profileId, courseId: loaded.resource.courseId, termNumber: loaded.resource.termNumber,
            attendanceDate: loaded.date, status: write.status, teacherName, recordedAt: now,
          }).onConflictDoUpdate({
            target: [studentAttendanceRecordsTable.profileId, studentAttendanceRecordsTable.courseId, studentAttendanceRecordsTable.attendanceDate],
            set: { status: write.status, teacherName, recordedAt: now, termNumber: loaded.resource.termNumber },
          });
        }
      });
    }
    await recordAuditEvent({
      eventType: "attendance.lesson_session.confirmed",
      actorClerkUserId: userId,
      targetType: "lesson_session",
      targetId: `${loaded.resource.id}:${loaded.date}`,
      details: {
        resourceId: loaded.resource.id, courseId: loaded.resource.courseId, sessionDate: loaded.date,
        present: writes.filter((write) => write.status === "present").length,
        late: writes.filter((write) => write.status === "late").length,
        absent: writes.filter((write) => write.status === "absent").length,
        overrides: Object.keys(overrides).length,
      },
      deduplicationKey: `attendance.lesson_session.confirmed:${loaded.resource.id}:${loaded.date}:${now}`,
      notifyOwner: false,
    });
    res.json({ ...(await sessionDetail(loaded.resource, loaded.date)), written: writes.length });
  } catch (error) { next(error); }
});

// ---------------------------------------------------------------------------
// Yoxlama (roll-call): yuxarıda dərs + tarix seçilir, dərsin tələbələri sətir-sətir işarələnir və
// hamısı bir dəfəyə yazılır. İlkin işarələr onlayn qoşulma məlumatından gəlir (girib → iştirak,
// girməyib → qayıb); mövcud yekun qeyd üstündür. Müəllim yalnız özünə təyin olunmuş dərsləri,
// sahib / admin / nəzarətçi / idarə heyəti (davamiyyət icazəsi ilə) bütün dərsləri görür.
// Yol "/attendance" ehtiva edir, ona görə requireTeacher "attendance" icazəsini yoxlayır.
// ---------------------------------------------------------------------------

async function rollCallAccess(userId: string) {
  const clerkUser = await getClerkUser(userId);
  const owner = await userIsSystemOwner(userId, clerkUser);
  const role = metadataRole(clerkUser?.publicMetadata);
  return { clerkUser, all: owner || (role !== null && role !== "teacher") };
}

async function loadRollCallResource(req: { params: Record<string, unknown> }, res: Response, userId: string) {
  const resourceId = Number(req.params.resourceId);
  const date = typeof req.params.date === "string" ? req.params.date : "";
  if (!Number.isInteger(resourceId) || resourceId <= 0 || !isIsoDate(date)) {
    res.status(400).json({ error: "Dərs və tarix düzgün seçilməyib." });
    return null;
  }
  if (date > academyToday().date) {
    res.status(400).json({ error: "Gələcək tarix üçün davamiyyət yazmaq olmaz." });
    return null;
  }
  const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, resourceId)).limit(1);
  if (!resource) { res.status(404).json({ error: "Dərs tapılmadı." }); return null; }
  const access = await rollCallAccess(userId);
  if (!access.all && !await userTeachesResource(userId, resource)) {
    res.status(403).json({ error: "Bu dərsin davamiyyətini yalnız məsul müəllim və ya rəhbərlik idarə edə bilər." });
    return null;
  }
  return { resource, date, access };
}

async function rollCallDetail(resource: ResourceRow, date: string) {
  const detail = await sessionDetail(resource, date);
  const profileIds = detail.rows.map((row) => row.profileId);
  const history = profileIds.length
    ? await db.select({ profileId: studentAttendanceRecordsTable.profileId, attendanceDate: studentAttendanceRecordsTable.attendanceDate, status: studentAttendanceRecordsTable.status })
      .from(studentAttendanceRecordsTable)
      .where(and(eq(studentAttendanceRecordsTable.courseId, resource.courseId), inArray(studentAttendanceRecordsTable.profileId, profileIds)))
      .orderBy(desc(studentAttendanceRecordsTable.attendanceDate))
    : [];
  const weekday = weekdayOf(date);
  return {
    ...detail,
    lessonDays: resource.lessonDays,
    scheduled: resource.lessonDays.includes(weekday) && Boolean(lessonTimeForDay(resource.lessonTime, weekday)),
    rows: detail.rows
      .map((row) => {
        const own = history.filter((item) => item.profileId === row.profileId);
        return {
          ...row,
          defaultStatus: rollCallDefaultStatus(row),
          absenceCount: own.filter((item) => item.status === "absent").length,
          history: own.slice(0, 8).map(({ attendanceDate, status }) => ({ attendanceDate, status })),
        };
      })
      .sort((a, b) => Number(b.joined) - Number(a.joined) || a.studentName.localeCompare(b.studentName, "az")),
  };
}

router.get("/admin/attendance/roll-call/lessons", requireTeacher, async (req, res, next) => {
  try {
    const userId = getAuth(req).userId!;
    const access = await rollCallAccess(userId);
    const coTeachers = await coTeacherMap();
    const resources = (await db.select().from(resourcesTable)).filter((resource) => access.all || resourceTeacherIds(resource, coTeachers).includes(userId));
    if (!resources.length) { res.json([]); return; }
    const since = (() => {
      const [year, month, day] = academyToday().date.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, day - SESSION_LOOKBACK_DAYS)).toISOString().slice(0, 10);
    })();
    const resourceIds = resources.map((resource) => resource.id);
    const courseIds = Array.from(new Set(resources.map((resource) => resource.courseId)));
    const [allResources, students, courses, joins, records] = await Promise.all([
      db.select().from(resourcesTable).where(inArray(resourcesTable.courseId, courseIds)),
      studentRosterData(),
      db.select({ id: coursesTable.id, title: coursesTable.title }).from(coursesTable).where(inArray(coursesTable.id, courseIds)),
      db.select().from(lessonJoinEventsTable).where(and(inArray(lessonJoinEventsTable.resourceId, resourceIds), gte(lessonJoinEventsTable.sessionDate, since))),
      db.select().from(studentAttendanceRecordsTable).where(and(inArray(studentAttendanceRecordsTable.courseId, courseIds), gte(studentAttendanceRecordsTable.attendanceDate, since))),
    ]);
    const teacherLabels = await resourceTeacherLabels(resources);
    const lessons = resources
      .filter((resource) => courses.some((course) => course.id === resource.courseId))
      .map((resource) => {
        const rosterIds = rosterForResource(resource, allResources, students);
        const recentSessions = recentSessionDates(resource).map((date) => {
          const sessionJoins = joins.filter((join) => join.resourceId === resource.id && join.sessionDate === date);
          const ids = new Set(rosterIds);
          for (const join of sessionJoins) ids.add(join.profileId);
          const rows = buildSessionRows(
            students.filter((student) => ids.has(student.profileId)).map(({ profileId, studentName, studentNumber }) => ({ profileId, studentName, studentNumber })),
            sessionJoins,
            records.filter((record) => record.courseId === resource.courseId && record.attendanceDate === date && ids.has(record.profileId)),
          );
          return { sessionDate: date, summary: sessionSummary(rows) };
        });
        return {
          resourceId: resource.id,
          courseId: resource.courseId,
          courseTitle: courses.find((course) => course.id === resource.courseId)?.title ?? "Naməlum fənn",
          title: resource.title,
          teacherName: teacherLabels.get(resource.id) ?? null,
          termNumber: resource.termNumber,
          lessonDays: resource.lessonDays,
          lessonTime: resource.lessonTime,
          studentCount: rosterIds.length,
          recentSessions,
        };
      })
      .sort((a, b) => a.termNumber - b.termNumber || a.courseTitle.localeCompare(b.courseTitle, "az") || a.resourceId - b.resourceId);
    res.setHeader("Cache-Control", "no-store");
    res.json(lessons);
  } catch (error) { next(error); }
});

router.get("/admin/attendance/roll-call/:resourceId/:date", requireTeacher, async (req, res, next) => {
  try {
    const loaded = await loadRollCallResource(req, res, getAuth(req).userId!);
    if (!loaded) return;
    res.setHeader("Cache-Control", "no-store");
    res.json(await rollCallDetail(loaded.resource, loaded.date));
  } catch (error) { next(error); }
});

router.post("/admin/attendance/roll-call/:resourceId/:date", requireTeacher, async (req, res, next) => {
  try {
    const userId = getAuth(req).userId!;
    const loaded = await loadRollCallResource(req, res, userId);
    if (!loaded) return;
    const before = await sessionDetail(loaded.resource, loaded.date);
    const resolved = resolveRollCallMarks(before.rows.map((row) => row.profileId), req.body?.marks);
    if ("error" in resolved) { res.status(400).json({ error: resolved.error }); return; }
    const clerkUser = loaded.access.clerkUser;
    const nameParts = clerkUser ? ownerDisplayNameParts(clerkUser) : null;
    const teacherName = nameParts ? [nameParts.firstName, nameParts.lastName].filter(Boolean).join(" ") || "Akademiya müəllimi" : "Akademiya müəllimi";
    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      for (const write of resolved.writes) {
        await tx.insert(studentAttendanceRecordsTable).values({
          profileId: write.profileId, courseId: loaded.resource.courseId, termNumber: loaded.resource.termNumber,
          attendanceDate: loaded.date, status: write.status, teacherName, recordedAt: now,
        }).onConflictDoUpdate({
          target: [studentAttendanceRecordsTable.profileId, studentAttendanceRecordsTable.courseId, studentAttendanceRecordsTable.attendanceDate],
          set: { status: write.status, teacherName, recordedAt: now, termNumber: loaded.resource.termNumber },
        });
      }
    });
    const count = (status: string) => resolved.writes.filter((write) => write.status === status).length;
    await recordAuditEvent({
      eventType: "attendance.roll_call.saved",
      actorClerkUserId: userId,
      targetType: "lesson_session",
      targetId: `${loaded.resource.id}:${loaded.date}`,
      details: {
        resourceId: loaded.resource.id, courseId: loaded.resource.courseId, sessionDate: loaded.date,
        present: count("present"), late: count("late"), absent: count("absent"), excused: count("excused"),
      },
      deduplicationKey: `attendance.roll_call.saved:${loaded.resource.id}:${loaded.date}:${now}`,
      notifyOwner: false,
    });
    res.json({ ...(await rollCallDetail(loaded.resource, loaded.date)), written: resolved.writes.length });
  } catch (error) { next(error); }
});

export default router;
