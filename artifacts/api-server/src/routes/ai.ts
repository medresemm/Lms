// Mədinə AI marşrutları.
//
// - POST /api/ai/student/chat — yalnız təsdiqlənmiş tələbə; istifadəçi kimliyi yalnız Clerk sessiyasından
//   (getAuth) götürülür, sorğu gövdəsindən heç bir ID qəbul edilmir. Kontekst yalnız həmin tələbənin öz
//   məlumatlarından qurulur.
// - POST /api/ai/admin/chat — sahib və «students» icazəsi olan heyət üzvləri.
//
// Server heç nə saxlamır: söhbət üçün cədvəl yoxdur, mesaj mətni log edilmir, bazaya yazılmır.
// Söhbət tarixçəsi yalnız brauzerin localStorage-ində qalır.
import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { and, asc, desc, eq, inArray, isNull, lte } from "drizzle-orm";
import {
  applicationsTable,
  assignmentSubmissionsTable,
  assignmentsTable,
  db,
  examSubmissionsTable,
  examsTable,
  onboardingExamAssignmentsTable,
  resourcesTable,
  studentAcademicProfilesTable,
  studentCourseSelectionsTable,
  studentNotificationDismissalsTable,
  studentNotificationsTable,
  studentTeacherChoicesTable,
} from "@workspace/db";
import {
  assignmentView,
  buildAcademicProfile,
  currentTermNumber,
  getAcademicProfileForAdmin,
  getActiveTermNumbers,
  getAdmissionExamRequired,
  getAnnouncements,
  getApprovedStudentProfile,
  getClerkUser,
  getCourses,
  loadExamResult,
  metadataRole,
  permissionsForClerkUser,
  requireApprovedStudent,
  resourceLinkIsExpired,
  resourceViews,
  rolePermissionKeys,
  studentMayAttendResource,
  termDetails,
  userIsSystemOwner,
} from "./lms.js";
import {
  getAiProvider,
  type AdminAiContext,
  type AiChatTurn,
  type AiCourseInfo,
  type AiExam,
  type AiLesson,
  type AiScheduleAccess,
  type AiSemester,
  type AiStudentMatch,
  type StudentAiContext,
} from "../lib/ai/aiProvider.js";

const router: IRouter = Router();

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_TURNS = 10;
const RATE_LIMIT_PER_MINUTE = 30;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function allowRequest(userId: string) {
  const now = Date.now();
  if (rateBuckets.size > 5000) {
    for (const [key, bucket] of rateBuckets) if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
  const bucket = rateBuckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_PER_MINUTE;
}

function parseChatBody(body: unknown): { message: string; history: AiChatTurn[] } | null {
  if (!body || typeof body !== "object") return null;
  const { message, history } = body as { message?: unknown; history?: unknown };
  if (typeof message !== "string") return null;
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return null;
  const turns = Array.isArray(history)
    ? history
      .filter((turn): turn is { role: "user" | "assistant"; text: string } => Boolean(turn) && typeof turn === "object"
        && ((turn as { role?: unknown }).role === "user" || (turn as { role?: unknown }).role === "assistant")
        && typeof (turn as { text?: unknown }).text === "string")
      .slice(-MAX_HISTORY_TURNS)
      .map((turn) => ({ role: turn.role, text: turn.text.slice(0, MAX_MESSAGE_LENGTH) }))
    : [];
  return { message: trimmed, history: turns };
}

function memo<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined;
  return () => {
    promise ??= load();
    return promise;
  };
}

type ProfileRow = typeof studentAcademicProfilesTable.$inferSelect;
type ApplicationRow = typeof applicationsTable.$inferSelect;
type ResourceRow = typeof resourcesTable.$inferSelect;

// Mövcud scheduleAccessState ilə eyni qərarı verir, amma onboarding testini təyin etmir (bazaya yazmır).
async function readOnlyScheduleAccess(profile: ProfileRow): Promise<AiScheduleAccess> {
  const admissionExamRequired = await getAdmissionExamRequired();
  if (!admissionExamRequired) {
    return { approved: profile.scheduleAccessApproved || profile.onboardingExamEligible, onboardingRequired: false, onboardingExamTitle: null };
  }
  if (!profile.onboardingExamEligible) {
    return { approved: profile.scheduleAccessApproved, onboardingRequired: false, onboardingExamTitle: null };
  }
  const [assignment] = await db.select().from(onboardingExamAssignmentsTable)
    .where(eq(onboardingExamAssignmentsTable.profileId, profile.id)).limit(1);
  const [exam] = assignment
    ? await db.select().from(examsTable).where(and(
      eq(examsTable.id, assignment.examId),
      eq(examsTable.isOnboarding, true),
      eq(examsTable.status, "open"),
    )).limit(1)
    : [];
  const [submission] = exam
    ? await db.select({ id: examSubmissionsTable.id }).from(examSubmissionsTable).where(and(
      eq(examSubmissionsTable.examId, exam.id),
      eq(examSubmissionsTable.profileId, profile.id),
    )).limit(1)
    : [];
  const approved = Boolean(exam && submission && assignment?.reviewStatus === "approved");
  return { approved, onboardingRequired: !approved, onboardingExamTitle: exam?.title ?? null };
}

function toAiSemesters(semesters: Awaited<ReturnType<typeof buildAcademicProfile>>["semesters"]): AiSemester[] {
  return semesters.map((semester) => ({
    termNumber: semester.termNumber,
    label: semester.label,
    gpa: semester.gpa,
    absencePercent: semester.attendancePercent,
    subjects: semester.subjects.map((subject) => ({
      courseId: subject.courseId,
      title: subject.title,
      instructor: subject.instructor,
      isMandatory: subject.isMandatory,
      grade: subject.grade,
      credits: subject.credits,
      gradingComponents: subject.gradingComponents,
      absenceCount: subject.absenceCount,
      absencePercent: subject.attendancePercent,
    })),
    attendanceRecords: semester.attendanceRecords.map((record) => ({
      courseTitle: record.courseTitle,
      attendanceDate: record.attendanceDate,
      status: record.status,
    })),
  }));
}

async function toAiLessons(rows: ResourceRow[]): Promise<AiLesson[]> {
  if (!rows.length) return [];
  const [views, courses] = await Promise.all([resourceViews(rows), getCourses()]);
  const titles = new Map(courses.map((course) => [course.id, course.title.trim()]));
  return views.map((view) => ({
    resourceId: view.id,
    courseId: view.courseId,
    courseTitle: titles.get(view.courseId) || `Fənn #${view.courseId}`,
    termNumber: view.termNumber,
    title: view.title,
    kind: view.kind,
    body: view.body,
    url: view.url,
    lessonDays: view.lessonDays,
    lessonTime: view.lessonTime,
    teacherName: view.teacherName,
    isMandatory: view.isMandatory,
  }));
}

function buildStudentContext(profile: ProfileRow, application: ApplicationRow): StudentAiContext {
  const terms = memo(async () => {
    const activeTerms = await getActiveTermNumbers();
    const currentTerm = currentTermNumber(profile);
    const visibleTerms = activeTerms.filter((termNumber) => termNumber <= currentTerm);
    const visibleThroughTerm = Math.min(currentTerm, Math.max(...activeTerms));
    const displayedTerm = visibleTerms[visibleTerms.length - 1] ?? visibleThroughTerm;
    return { activeTerms, currentTerm, visibleThroughTerm, displayedTerm };
  });
  const access = memo(() => readOnlyScheduleAccess(profile));
  const termAllowed = async (termNumber: number) => {
    const { activeTerms, currentTerm } = await terms();
    return termNumber <= currentTerm && activeTerms.includes(termNumber);
  };

  const overview = memo(async () => {
    const [{ displayedTerm }, scheduleAccess] = await Promise.all([terms(), access()]);
    return {
      firstName: application.firstName,
      lastName: application.lastName,
      studentNumber: profile.studentNumber,
      currentTermNumber: displayedTerm,
      termLabel: termDetails(displayedTerm).label,
      program: profile.program,
      scheduleAccess,
    };
  });

  const semesters = memo(async () => {
    const { visibleThroughTerm } = await terms();
    const academicProfile = await buildAcademicProfile(profile, application, visibleThroughTerm);
    return toAiSemesters(academicProfile.semesters);
  });

  // /api/resources ilə eyni qaydalar + tələbənin müəllim seçiminə görə filtr.
  const lessons = memo(async () => {
    const [{ displayedTerm }, scheduleAccess] = await Promise.all([terms(), access()]);
    if (!scheduleAccess.approved || !(await termAllowed(displayedTerm))) return [];
    const [rows, selections] = await Promise.all([
      db.select().from(resourcesTable).where(eq(resourcesTable.termNumber, displayedTerm)).orderBy(asc(resourcesTable.id)),
      db.select({ courseId: studentCourseSelectionsTable.courseId, selected: studentCourseSelectionsTable.selected })
        .from(studentCourseSelectionsTable)
        .where(and(eq(studentCourseSelectionsTable.profileId, profile.id), eq(studentCourseSelectionsTable.termNumber, displayedTerm))),
    ]);
    const removed = new Set(selections.filter((selection) => !selection.selected).map((selection) => selection.courseId));
    const visible: ResourceRow[] = [];
    for (const row of rows) {
      if (removed.has(row.courseId) || resourceLinkIsExpired(row)) continue;
      if (await studentMayAttendResource(profile.id, row)) visible.push(row);
    }
    return toAiLessons(visible);
  });

  // /api/assignments ilə eyni qaydalar.
  const assignments = memo(async () => {
    const { displayedTerm } = await terms();
    if (!(await termAllowed(displayedTerm))) return [];
    const rows = await db.select().from(assignmentsTable)
      .where(eq(assignmentsTable.termNumber, displayedTerm))
      .orderBy(desc(assignmentsTable.dueAt), asc(assignmentsTable.id));
    const visible = [];
    for (const assignment of rows) {
      const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, assignment.resourceId)).limit(1);
      if (!resource || !(await studentMayAttendResource(profile.id, resource))) continue;
      const view = await assignmentView(assignment, profile.id);
      visible.push({
        id: view.id,
        courseTitle: view.courseTitle,
        teacherName: view.teacherName,
        title: view.title,
        dueAt: view.dueAt,
        maxScore: view.maxScore,
        status: view.status,
        submission: view.submission ? {
          status: view.submission.status,
          submittedAt: view.submission.submittedAt,
          score: view.submission.score,
          feedback: view.submission.feedback,
        } : null,
      });
    }
    return visible;
  });

  // /api/exams ilə eyni görünürlük; nəticələr tələbənin öz cavablarından hesablanır. Bazaya yazmır.
  const exams = memo(async () => {
    const { displayedTerm } = await terms();
    if (!(await termAllowed(displayedTerm))) return [];
    const [onboardingAssignment] = await db.select().from(onboardingExamAssignmentsTable)
      .where(eq(onboardingExamAssignmentsTable.profileId, profile.id)).limit(1);
    const rows = await db.select().from(examsTable)
      .where(eq(examsTable.termNumber, displayedTerm))
      .orderBy(desc(examsTable.createdAt));
    const onboardingRows = onboardingAssignment
      ? await db.select().from(examsTable).where(and(eq(examsTable.id, onboardingAssignment.examId), eq(examsTable.isOnboarding, true))).limit(1)
      : [];
    const courses = await getCourses();
    const titles = new Map(courses.map((course) => [course.id, course.title.trim()]));
    const visible: AiExam[] = [];
    for (const exam of [...onboardingRows, ...rows.filter((row) => !row.isOnboarding)]) {
      if (!exam.isOnboarding) {
        if (exam.resourceId <= 0) continue;
        const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, exam.resourceId)).limit(1);
        if (!resource || !(await studentMayAttendResource(profile.id, resource))) continue;
      }
      const [submission] = await db.select().from(examSubmissionsTable).where(and(
        eq(examSubmissionsTable.examId, exam.id),
        eq(examSubmissionsTable.profileId, profile.id),
      )).limit(1);
      // Bağlanmış və cavab verilməmiş testləri göstərmirik (UI-da da görünmür).
      if (exam.status !== "open" && !submission) continue;
      visible.push({
        id: exam.id,
        courseTitle: exam.isOnboarding ? "Ümumi qəbul testi" : titles.get(exam.courseId) || `Fənn #${exam.courseId}`,
        title: exam.title,
        status: exam.status === "closed" ? "closed" : "open",
        isOnboarding: exam.isOnboarding,
        durationMinutes: exam.durationMinutes,
        result: submission ? await loadExamResult(exam.id, submission.answers) : null,
        submittedAt: submission?.submittedAt ?? null,
      });
    }
    return visible;
  });

  // /api/announcements və /api/student/notifications ilə eyni qaydalar.
  const notices = memo(async () => {
    const termNumber = currentTermNumber(profile);
    const [announcementRows, notificationRows, dismissals] = await Promise.all([
      getAnnouncements(),
      db.select().from(studentNotificationsTable).orderBy(desc(studentNotificationsTable.id)),
      db.select({ notificationId: studentNotificationDismissalsTable.notificationId }).from(studentNotificationDismissalsTable)
        .where(eq(studentNotificationDismissalsTable.profileId, profile.id)),
    ]);
    const dismissed = new Set(dismissals.map((item) => item.notificationId));
    return {
      announcements: announcementRows.slice(0, 5).map((item) => ({ title: item.title, body: item.body, date: item.date })),
      notifications: notificationRows
        .filter((item) => item.destination !== "gmail"
          && (item.targetProfileIds.includes(profile.id) || (!item.targetProfileIds.length && item.targetTerms.includes(termNumber)))
          && !dismissed.has(item.id))
        .slice(0, 5)
        .map((item) => ({ title: item.title, body: item.body, date: item.createdAt })),
    };
  });

  return { mode: "student", overview, semesters, lessons, assignments, exams, notices };
}

function toMatch(profile: ProfileRow, application: ApplicationRow): AiStudentMatch {
  return {
    profileId: profile.id,
    studentNumber: profile.studentNumber,
    firstName: application.firstName,
    lastName: application.lastName,
    email: application.email,
    phone: application.phone,
    username: application.username,
    currentTermNumber: currentTermNumber(profile),
  };
}

function buildAdminContext(permissions: ReadonlySet<string>, isOwner: boolean): AdminAiContext {
  const studentRows = memo(async () => db.select({ profile: studentAcademicProfilesTable, application: applicationsTable })
    .from(studentAcademicProfilesTable)
    .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
    .where(and(eq(applicationsTable.status, "approved"), isNull(applicationsTable.deletedAt)))
    .orderBy(asc(applicationsTable.firstName), asc(applicationsTable.lastName)));

  const allStudents = memo(async () => (await studentRows()).map(({ profile, application }) => toMatch(profile, application)));

  const courses = memo(async (): Promise<AiCourseInfo[]> => {
    const [courseRows, resourceRows] = await Promise.all([
      getCourses(),
      db.select().from(resourcesTable).orderBy(asc(resourcesTable.termNumber), asc(resourcesTable.id)),
    ]);
    const lessons = await toAiLessons(resourceRows);
    return courseRows.map((course) => ({
      courseId: course.id,
      title: course.title.trim(),
      category: course.category,
      instructor: course.instructor,
      lessons: lessons.filter((lesson) => lesson.courseId === course.id),
    }));
  });

  async function studentDetails(profileId: number) {
    const row = await getAcademicProfileForAdmin(profileId);
    if (!row) return null;
    const { profile, application } = row;
    const currentTerm = currentTermNumber(profile);
    const academicProfile = await buildAcademicProfile(profile, application, currentTerm, true);

    const [assignmentRows, submissionRows, selectionRows, examSubmissionRows, courseRows] = await Promise.all([
      db.select().from(assignmentsTable).where(lte(assignmentsTable.termNumber, currentTerm)).orderBy(desc(assignmentsTable.dueAt)),
      db.select().from(assignmentSubmissionsTable).where(eq(assignmentSubmissionsTable.profileId, profile.id)),
      db.select().from(studentCourseSelectionsTable).where(eq(studentCourseSelectionsTable.profileId, profile.id)),
      db.select().from(examSubmissionsTable).where(eq(examSubmissionsTable.profileId, profile.id)).orderBy(desc(examSubmissionsTable.submittedAt)),
      getCourses(),
    ]);
    const titles = new Map(courseRows.map((course) => [course.id, course.title.trim()]));
    const removed = new Set(selectionRows.filter((item) => !item.selected).map((item) => `${item.termNumber}:${item.courseId}`));
    const resourceIds = Array.from(new Set(assignmentRows.map((item) => item.resourceId)));
    const choices = resourceIds.length
      ? await db.select({ resourceId: studentTeacherChoicesTable.resourceId, profileId: studentTeacherChoicesTable.profileId })
        .from(studentTeacherChoicesTable)
        .where(and(inArray(studentTeacherChoicesTable.resourceId, resourceIds), eq(studentTeacherChoicesTable.status, "approved")))
      : [];
    const submissions = new Map(submissionRows.map((item) => [item.assignmentId, item]));
    const assignments = assignmentRows
      .filter((assignment) => {
        if (removed.has(`${assignment.termNumber}:${assignment.courseId}`)) return false;
        const approved = choices.filter((choice) => choice.resourceId === assignment.resourceId);
        return approved.length === 0 || approved.some((choice) => choice.profileId === profile.id) || submissions.has(assignment.id);
      })
      .map((assignment) => {
        const submission = submissions.get(assignment.id);
        return {
          courseTitle: titles.get(assignment.courseId) || `Fənn #${assignment.courseId}`,
          title: assignment.title,
          dueAt: assignment.dueAt,
          maxScore: assignment.maxScore,
          submissionStatus: submission?.status ?? null,
          score: submission?.score ?? null,
        };
      });

    const examIds = examSubmissionRows.map((item) => item.examId);
    const examRows = examIds.length ? await db.select().from(examsTable).where(inArray(examsTable.id, examIds)) : [];
    const examsById = new Map(examRows.map((exam) => [exam.id, exam]));
    const exams = [];
    for (const submission of examSubmissionRows) {
      const exam = examsById.get(submission.examId);
      if (!exam) continue;
      const result = await loadExamResult(exam.id, submission.answers);
      exams.push({
        courseTitle: exam.isOnboarding ? "Ümumi qəbul testi" : titles.get(exam.courseId) || `Fənn #${exam.courseId}`,
        title: exam.title,
        isOnboarding: exam.isOnboarding,
        ...result,
        submittedAt: submission.submittedAt,
      });
    }

    return {
      match: toMatch(profile, application),
      birthDate: application.birthDate,
      arabicLevel: application.arabicLevel,
      program: profile.program,
      termLabel: termDetails(currentTerm).label,
      semesters: toAiSemesters(academicProfile.semesters),
      assignments,
      exams,
    };
  }

  // Kursun bu semestrdə dərsini keçən tələbələr: kursun resursu olan semestrdə oxuyan, fənni silməmiş və
  // (müəllim qrupu seçimi varsa) həmin qrupa təsdiqlənmiş tələbələr.
  async function courseStudents(courseId: number) {
    const [rows, resources, selections] = await Promise.all([
      studentRows(),
      db.select().from(resourcesTable).where(eq(resourcesTable.courseId, courseId)),
      db.select().from(studentCourseSelectionsTable).where(eq(studentCourseSelectionsTable.courseId, courseId)),
    ]);
    if (!resources.length) return [];
    const choices = await db.select({ resourceId: studentTeacherChoicesTable.resourceId, profileId: studentTeacherChoicesTable.profileId })
      .from(studentTeacherChoicesTable)
      .where(and(inArray(studentTeacherChoicesTable.resourceId, resources.map((item) => item.id)), eq(studentTeacherChoicesTable.status, "approved")));
    const removed = new Set(selections.filter((item) => !item.selected).map((item) => `${item.profileId}:${item.termNumber}`));
    return rows
      .filter(({ profile }) => {
        const term = currentTermNumber(profile);
        const termResources = resources.filter((resource) => resource.termNumber === term);
        if (!termResources.length || removed.has(`${profile.id}:${term}`)) return false;
        return termResources.some((resource) => {
          const approved = choices.filter((choice) => choice.resourceId === resource.id);
          return approved.length === 0 || approved.some((choice) => choice.profileId === profile.id);
        });
      })
      .map(({ profile, application }) => toMatch(profile, application));
  }

  const teacherSchedule = memo(async () => {
    const activeTerms = await getActiveTermNumbers();
    const rows = activeTerms.length
      ? await db.select().from(resourcesTable).where(inArray(resourcesTable.termNumber, activeTerms)).orderBy(asc(resourcesTable.termNumber), asc(resourcesTable.id))
      : [];
    return toAiLessons(rows);
  });

  return { mode: "admin", permissions, isOwner, allStudents, studentDetails, courses, courseStudents, teacherSchedule };
}

const requireAiStaff: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." });
      return;
    }
    const clerkUser = await getClerkUser(userId);
    if (await userIsSystemOwner(userId, clerkUser)) {
      res.locals.aiPermissions = new Set<string>(rolePermissionKeys);
      res.locals.aiIsOwner = true;
      next();
      return;
    }
    const role = metadataRole(clerkUser?.publicMetadata);
    if (!clerkUser || !role) {
      res.status(403).json({ error: "Bu bölməyə giriş üçün sizə icazə verilməyib." });
      return;
    }
    const permissions = await permissionsForClerkUser(clerkUser, role);
    if (!permissions.includes("students")) {
      res.status(403).json({ error: "Mədinə AI admin rejimi üçün «Tələbələr» icazəsi lazımdır." });
      return;
    }
    res.locals.aiPermissions = new Set<string>(permissions);
    res.locals.aiIsOwner = false;
    next();
  } catch (error) {
    next(error);
  }
};

const rateLimit: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (userId && !allowRequest(userId)) {
    res.status(429).json({ error: "Çox sürətli sorğu göndərilir. Bir dəqiqə sonra yenidən cəhd edin." });
    return;
  }
  next();
};

const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};

router.post("/ai/student/chat", noStore, requireApprovedStudent, rateLimit, async (req, res, next) => {
  try {
    const input = parseChatBody(req.body);
    if (!input) {
      res.status(400).json({ error: `Mesaj boş olmamalı və ${MAX_MESSAGE_LENGTH} simvoldan uzun olmamalıdır.` });
      return;
    }
    const userId = getAuth(req).userId as string;
    const profile = await getApprovedStudentProfile(userId);
    if (!profile) {
      res.status(404).json({ error: "Tələbə profili tapılmadı." });
      return;
    }
    const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, profile.applicationId)).limit(1);
    if (!application) {
      res.status(404).json({ error: "Tələbə profili tapılmadı." });
      return;
    }
    const result = await getAiProvider().answer(input, buildStudentContext(profile, application));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/ai/admin/chat", noStore, requireAiStaff, rateLimit, async (req, res, next) => {
  try {
    const input = parseChatBody(req.body);
    if (!input) {
      res.status(400).json({ error: `Mesaj boş olmamalı və ${MAX_MESSAGE_LENGTH} simvoldan uzun olmamalıdır.` });
      return;
    }
    const context = buildAdminContext(res.locals.aiPermissions as ReadonlySet<string>, res.locals.aiIsOwner === true);
    const result = await getAiProvider().answer(input, context);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
