// Mədinə AI marşrutları.
//
// - POST /api/ai/student/chat — yalnız təsdiqlənmiş tələbə; istifadəçi kimliyi yalnız Clerk sessiyasından
//   (getAuth) götürülür, sorğu gövdəsindən heç bir ID qəbul edilmir. Kontekst yalnız həmin tələbənin öz
//   məlumatlarından qurulur.
// - POST /api/ai/admin/chat — sahib və bütün heyət rolları. Gövdədə `source`: "internal" (yalnız LMS, «students»
//   icazəsi tələb olunur) və ya "external" (yalnız Şamilə/Dorar; `target`: shamela | dorar | all). Rejimlər
//   qarışmır — bax lib/ai/adminRouting.ts.
// - POST /api/ai/admin/shamela/page — Şamilə səhifəsini canlı açır (heyət üçün; heç nə saxlanmır).
//
// Server heç nə saxlamır: söhbət üçün cədvəl yoxdur, mesaj mətni log edilmir, bazaya yazılmır.
// Söhbət tarixçəsi yalnız brauzerin localStorage-ində qalır.
import { Router, type IRouter, type RequestHandler } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { and, asc, desc, eq, inArray, isNull, lte } from "drizzle-orm";
import {
  announcementsTable,
  applicationsTable,
  attendanceExcusesTable,
  examOptionsTable,
  examQuestionsTable,
  questionsTable,
  studentAttendanceRecordsTable,
  studentGradesTable,
  subjectRemovalRequestsTable,
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
  activeTeachers,
  clerkDisplayName,
  getClerkDirectory,
  getClerkUser,
  getCourses,
  roleForClerkUser,
  teacherNameMap,
  loadExamResult,
  metadataRole,
  permissionsForClerkUser,
  requireApprovedStudent,
  resourceLinkIsExpired,
  resourceViews,
  studentResourceViews,
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
  type AiRosterStudent,
  type AiTeacher,
  type StudentAiContext,
} from "../lib/ai/aiProvider.js";
import { logger } from "../lib/logger.js";
import { parseSourceSelection, routeAdminMessage } from "../lib/ai/adminRouting.js";
import {
  readStudentExternalSetting,
  routeStudentExternal,
  studentExternalEnabled,
  updateStudentExternalSetting,
  type StudentExternalSetting,
} from "../lib/ai/studentExternal.js";
import { answerResearch, openShamelaPage, type UpstreamStatusEvent, ResearchUpstreamError, shamelaPageUrl } from "../lib/ai/research.js";

const router: IRouter = Router();

// Tələbələr üçün «Xarici» axtarış ayarı sistem sahibinin Clerk publicMetadata-sındadır (bax lib/ai/studentExternal.ts).
// Qısa müddətli yaddaş (30 s) Clerk-ə hər sorğuda müraciət etməmək üçündür; xəta olarsa ayar «söndürülüb» sayılır.
const STUDENT_EXTERNAL_CACHE_MS = 30_000;
let studentExternalCache: { expiresAt: number; value: StudentExternalSetting } | null = null;

async function findSystemOwnerUser() {
  const ownerEmail = process.env.SYSTEM_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) return null;
  const page = await clerkClient.users.getUserList({ emailAddress: [ownerEmail], limit: 1 });
  return page.data[0] ?? null;
}

async function getStudentExternalSetting(): Promise<StudentExternalSetting> {
  if (studentExternalCache && studentExternalCache.expiresAt > Date.now()) return studentExternalCache.value;
  let value: StudentExternalSetting;
  try {
    value = readStudentExternalSetting((await findSystemOwnerUser())?.publicMetadata);
  } catch {
    value = { shamela: false, dorar: false };
  }
  studentExternalCache = { expiresAt: Date.now() + STUDENT_EXTERNAL_CACHE_MS, value };
  return value;
}

// Xarici mənbə nəticəsini yalnız status kodu ilə qeyd edir — sorğu mətni heç vaxt log edilmir.
function logUpstreamStatus(event: UpstreamStatusEvent) {
  const entry = { upstream: event.upstream, status: event.status, code: event.code, cfMitigated: event.cfMitigated, contentType: event.contentType.split(";")[0] };
  if (event.code === "ok") logger.info(entry, "research upstream ok");
  else logger.warn(entry, "research upstream failed");
}

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

async function toAiLessons(rows: ResourceRow[], forStudent = false): Promise<AiLesson[]> {
  if (!rows.length) return [];
  // Tələbəyə Zoom/Meet linki birbaşa deyil, qoşulmanı qeyd edən sayt linki ilə göstərilir.
  const [views, courses] = await Promise.all([forStudent ? studentResourceViews(rows) : resourceViews(rows), getCourses()]);
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
    return toAiLessons(visible, true);
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

function buildAdminContext(permissions: ReadonlySet<string>, isOwner: boolean, role: string): AdminAiContext {
  const can = (permission: string) => isOwner || permissions.has(permission);
  const canManageUsers = (isOwner || role === "owner_assistant") && can("userRoleManagement");
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

  // --- Geniş admin axtarışı üçün toplu məlumat (hər sorğuda bir dəfə, lazım olduqda yüklənir) ---

  const courseTitles = memo(async () => new Map((await getCourses()).map((course) => [course.id, course.title.trim()])));

  // Bütün profillər (təsdiqlənməmiş/məzun da daxil) — ad göstərmək üçün.
  const profileNames = memo(async () => {
    const rows = await db.select({ profileId: studentAcademicProfilesTable.id, studentNumber: studentAcademicProfilesTable.studentNumber, firstName: applicationsTable.firstName, lastName: applicationsTable.lastName })
      .from(studentAcademicProfilesTable)
      .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id));
    return new Map(rows.map((row) => [row.profileId, { name: `${row.firstName} ${row.lastName}`.trim(), studentNumber: row.studentNumber }]));
  });

  // Hansı tələbə cari semestrdə hansı dərs qrupunda (resursda) oxuyur: courseStudents ilə eyni qayda.
  const enrollment = memo(async () => {
    const [rows, resources, removedRows, choices] = await Promise.all([
      studentRows(),
      db.select().from(resourcesTable),
      db.select().from(studentCourseSelectionsTable).where(eq(studentCourseSelectionsTable.selected, false)),
      db.select({ resourceId: studentTeacherChoicesTable.resourceId, profileId: studentTeacherChoicesTable.profileId })
        .from(studentTeacherChoicesTable).where(eq(studentTeacherChoicesTable.status, "approved")),
    ]);
    const removed = new Set(removedRows.map((item) => `${item.profileId}:${item.courseId}:${item.termNumber}`));
    const chosenBy = new Map<number, Set<number>>();
    for (const choice of choices) {
      if (!chosenBy.has(choice.resourceId)) chosenBy.set(choice.resourceId, new Set());
      chosenBy.get(choice.resourceId)!.add(choice.profileId);
    }
    const resourcesByTerm = new Map<number, typeof resources>();
    for (const resource of resources) {
      if (!resourcesByTerm.has(resource.termNumber)) resourcesByTerm.set(resource.termNumber, []);
      resourcesByTerm.get(resource.termNumber)!.push(resource);
    }
    const studentResources = new Map<number, typeof resources>();
    const resourceStudents = new Map<number, number[]>();
    for (const { profile } of rows) {
      const term = currentTermNumber(profile);
      const attended = (resourcesByTerm.get(term) ?? []).filter((resource) => {
        if (removed.has(`${profile.id}:${resource.courseId}:${term}`)) return false;
        const chosen = chosenBy.get(resource.id);
        return !chosen || chosen.size === 0 || chosen.has(profile.id);
      });
      studentResources.set(profile.id, attended);
      for (const resource of attended) {
        if (!resourceStudents.has(resource.id)) resourceStudents.set(resource.id, []);
        resourceStudents.get(resource.id)!.push(profile.id);
      }
    }
    return { resources, studentResources, resourceStudents };
  });

  const resourceTeacherNames = memo(async () => {
    const { resources } = await enrollment();
    const names = await teacherNameMap(resources.map((resource) => resource.teacherClerkUserId ?? "").filter(Boolean));
    return new Map(resources.map((resource) => [resource.id, resource.teacherClerkUserId ? names.get(resource.teacherClerkUserId) ?? null : null]));
  });

  const assignmentData = memo(async () => {
    const [assignments, submissions] = await Promise.all([
      db.select().from(assignmentsTable).orderBy(desc(assignmentsTable.dueAt)),
      db.select({ assignmentId: assignmentSubmissionsTable.assignmentId, profileId: assignmentSubmissionsTable.profileId, status: assignmentSubmissionsTable.status, score: assignmentSubmissionsTable.score })
        .from(assignmentSubmissionsTable),
    ]);
    return { assignments, submissions };
  });

  const roster = memo(async (): Promise<AiRosterStudent[]> => {
    const [rows, { studentResources }, titles, teacherNames, grades, absences, { assignments, submissions }] = await Promise.all([
      studentRows(),
      enrollment(),
      courseTitles(),
      resourceTeacherNames(),
      db.select({ profileId: studentGradesTable.profileId, termNumber: studentGradesTable.termNumber, gradePoints: studentGradesTable.gradePoints }).from(studentGradesTable),
      db.select({ profileId: studentAttendanceRecordsTable.profileId, termNumber: studentAttendanceRecordsTable.termNumber })
        .from(studentAttendanceRecordsTable).where(eq(studentAttendanceRecordsTable.status, "absent")),
      assignmentData(),
    ]);
    const submitted = new Set(submissions.map((item) => `${item.assignmentId}:${item.profileId}`));
    const now = Date.now();
    return rows.map(({ profile, application }) => {
      const term = currentTermNumber(profile);
      const points = grades
        .filter((grade) => grade.profileId === profile.id && grade.termNumber === term && grade.gradePoints !== null)
        .map((grade) => (grade.gradePoints! > 100 ? grade.gradePoints! / 5 : grade.gradePoints!));
      const attended = studentResources.get(profile.id) ?? [];
      const attendedIds = new Set(attended.map((resource) => resource.id));
      const missing = assignments
        .filter((assignment) => assignment.termNumber === term && attendedIds.has(assignment.resourceId) && !submitted.has(`${assignment.id}:${profile.id}`))
        .map((assignment) => ({
          title: assignment.title,
          courseTitle: titles.get(assignment.courseId) || `Fənn #${assignment.courseId}`,
          dueAt: assignment.dueAt,
          overdue: assignment.dueAt.getTime() < now,
        }));
      return {
        ...toMatch(profile, application),
        program: profile.program,
        arabicLevel: application.arabicLevel,
        scheduleApproved: profile.scheduleAccessApproved,
        gradeAverage: points.length ? Math.round((points.reduce((sum, value) => sum + value, 0) / points.length) * 10) / 10 : null,
        gradedCourses: points.length,
        absences: absences.filter((record) => record.profileId === profile.id && record.termNumber === term).length,
        missingAssignments: missing,
        courseTitles: Array.from(new Set(attended.map((resource) => titles.get(resource.courseId) || `Fənn #${resource.courseId}`))),
        teacherNames: Array.from(new Set(attended.map((resource) => teacherNames.get(resource.id)).filter((name): name is string => Boolean(name)))),
      };
    });
  });

  const staffDirectory = memo(async () => {
    const users = await getClerkDirectory();
    return users
      .map((user) => ({ user, role: roleForClerkUser(user) }))
      .filter(({ role: userRole }) => userRole !== "none");
  });

  const teachers = memo(async (): Promise<AiTeacher[] | null> => {
    if (!can("schedule")) return null;
    const [list, lessons, { resourceStudents, resources }, directory] = await Promise.all([
      activeTeachers(),
      teacherSchedule(),
      enrollment(),
      canManageUsers ? staffDirectory() : Promise.resolve([]),
    ]);
    const teacherByResource = new Map(resources.map((resource) => [resource.id, resource.teacherClerkUserId]));
    const directoryById = new Map(directory.map(({ user, role: userRole }) => [user.id, { email: user.primaryEmailAddress?.emailAddress ?? null, role: userRole }]));
    return list.map((teacher) => {
      const teacherLessons = lessons.filter((lesson) => teacherByResource.get(lesson.resourceId) === teacher.clerkUserId);
      const students = new Set(teacherLessons.flatMap((lesson) => resourceStudents.get(lesson.resourceId) ?? []));
      const info = directoryById.get(teacher.clerkUserId);
      return {
        clerkUserId: teacher.clerkUserId,
        name: teacher.displayName,
        email: canManageUsers ? info?.email ?? null : null,
        role: info?.role ?? "teacher",
        lessons: teacherLessons,
        studentCount: students.size,
      };
    });
  });

  const staff = memo(async () => {
    if (!canManageUsers) return null;
    const directory = await staffDirectory();
    const names = await teacherNameMap(directory.map(({ user }) => user.id));
    return directory.map(({ user, role: userRole }) => ({
      clerkUserId: user.id,
      name: names.get(user.id) || clerkDisplayName(user),
      email: user.primaryEmailAddress?.emailAddress ?? null,
      role: userRole,
    }));
  });

  const applications = memo(async () => {
    if (!can("applications")) return null;
    const rows = await db.select().from(applicationsTable).orderBy(desc(applicationsTable.id));
    return rows.map((row) => ({
      id: row.id, firstName: row.firstName, lastName: row.lastName, email: row.email, phone: row.phone, username: row.username,
      arabicLevel: row.arabicLevel, status: row.status, rejectionReason: row.rejectionReason, createdAt: row.createdAt, deleted: Boolean(row.deletedAt),
    }));
  });

  const subjectRequests = memo(async () => {
    if (!can("applications")) return null;
    const [rows, names, titles] = await Promise.all([
      db.select().from(subjectRemovalRequestsTable).orderBy(desc(subjectRemovalRequestsTable.id)),
      profileNames(),
      courseTitles(),
    ]);
    return rows.map((row) => ({
      studentName: names.get(row.profileId)?.name ?? "Tələbə",
      studentNumber: names.get(row.profileId)?.studentNumber ?? null,
      courseTitle: titles.get(row.courseId) || `Fənn #${row.courseId}`,
      termNumber: row.termNumber,
      status: row.status,
      reason: row.reason,
      createdAt: row.createdAt,
    }));
  });

  const assignmentsOverview = memo(async () => {
    if (!can("assignments")) return null;
    const [{ assignments, submissions }, titles, { resourceStudents }, names, teacherNames] = await Promise.all([
      assignmentData(), courseTitles(), enrollment(), profileNames(), resourceTeacherNames(),
    ]);
    return assignments.map((assignment) => {
      const own = submissions.filter((item) => item.assignmentId === assignment.id);
      const submittedIds = new Set(own.map((item) => item.profileId));
      const scores = own.map((item) => item.score).filter((score): score is number => score !== null);
      return {
        id: assignment.id,
        courseTitle: titles.get(assignment.courseId) || `Fənn #${assignment.courseId}`,
        title: assignment.title,
        termNumber: assignment.termNumber,
        teacherName: teacherNames.get(assignment.resourceId) ?? null,
        dueAt: assignment.dueAt,
        maxScore: assignment.maxScore,
        status: assignment.status,
        submitted: own.length,
        graded: own.filter((item) => item.status === "graded").length,
        pendingReview: own.filter((item) => item.status === "submitted").length,
        averageScore: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
        missingStudents: (resourceStudents.get(assignment.resourceId) ?? [])
          .filter((profileId) => !submittedIds.has(profileId))
          .map((profileId) => ({ name: names.get(profileId)?.name ?? "Tələbə", studentNumber: names.get(profileId)?.studentNumber ?? 0 })),
      };
    });
  });

  const examsOverview = memo(async () => {
    const [exams, questions, options, submissions, titles, names] = await Promise.all([
      db.select().from(examsTable).orderBy(desc(examsTable.id)),
      db.select({ id: examQuestionsTable.id, examId: examQuestionsTable.examId }).from(examQuestionsTable),
      db.select({ id: examOptionsTable.id, questionId: examOptionsTable.questionId }).from(examOptionsTable).where(eq(examOptionsTable.isCorrect, true)),
      db.select().from(examSubmissionsTable),
      courseTitles(),
      profileNames(),
    ]);
    const correctByQuestion = new Map(options.map((option) => [option.questionId, option.id]));
    return exams.map((exam) => {
      const examQuestions = questions.filter((question) => question.examId === exam.id);
      return {
        id: exam.id,
        courseTitle: exam.isOnboarding ? "Ümumi qəbul testi" : titles.get(exam.courseId) || `Fənn #${exam.courseId}`,
        title: exam.title,
        termNumber: exam.termNumber,
        isOnboarding: exam.isOnboarding,
        status: exam.status,
        results: submissions.filter((submission) => submission.examId === exam.id).map((submission) => {
          const correctCount = examQuestions.reduce((count, question) => count + (submission.answers[String(question.id)] === correctByQuestion.get(question.id) ? 1 : 0), 0);
          const totalQuestions = examQuestions.length;
          return {
            studentName: names.get(submission.profileId)?.name ?? "Tələbə",
            studentNumber: names.get(submission.profileId)?.studentNumber ?? null,
            correctCount,
            totalQuestions,
            percentage: totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0,
            submittedAt: submission.submittedAt,
          };
        }).sort((a, b) => b.percentage - a.percentage),
      };
    });
  });

  const notices = memo(async () => {
    if (!can("announcements")) return null;
    const [announcements, notifications] = await Promise.all([
      db.select().from(announcementsTable).orderBy(desc(announcementsTable.id)),
      db.select().from(studentNotificationsTable).orderBy(desc(studentNotificationsTable.id)),
    ]);
    return [
      ...announcements.map((item) => ({ kind: "announcement" as const, title: item.title, body: item.body, date: item.date, target: null })),
      ...notifications.map((item) => ({
        kind: "notification" as const, title: item.title, body: item.body, date: item.createdAt,
        target: item.targetProfileIds.length ? `${item.targetProfileIds.length} tələbə` : item.targetTerms.length ? `${item.targetTerms.join(", ")}-ci semestr` : null,
      })),
    ];
  });

  const excuses = memo(async () => {
    if (!can("excuses")) return null;
    const [rows, names, titles] = await Promise.all([
      db.select({ excuse: attendanceExcusesTable, attendanceDate: studentAttendanceRecordsTable.attendanceDate })
        .from(attendanceExcusesTable)
        .leftJoin(studentAttendanceRecordsTable, eq(attendanceExcusesTable.attendanceRecordId, studentAttendanceRecordsTable.id))
        .orderBy(desc(attendanceExcusesTable.createdAt)),
      profileNames(),
      courseTitles(),
    ]);
    return rows.map(({ excuse, attendanceDate }) => ({
      studentName: names.get(excuse.profileId)?.name ?? "Tələbə",
      studentNumber: names.get(excuse.profileId)?.studentNumber ?? null,
      courseTitle: titles.get(excuse.courseId) || `Fənn #${excuse.courseId}`,
      attendanceDate: attendanceDate ?? null,
      status: excuse.status,
      reason: excuse.reason,
      createdAt: excuse.createdAt,
    }));
  });

  const questions = memo(async () => {
    const rows = await db.select({ title: questionsTable.title, answer: questionsTable.answer, answeredByName: questionsTable.answeredByName, createdAt: questionsTable.createdAt })
      .from(questionsTable).orderBy(desc(questionsTable.id));
    return rows.map((row) => ({ title: row.title, answered: Boolean(row.answer), answeredByName: row.answeredByName, createdAt: row.createdAt }));
  });

  return {
    mode: "admin", permissions, isOwner, role,
    allStudents, studentDetails, courses, courseStudents, teacherSchedule,
    roster, teachers, staff, applications, subjectRequests, assignmentsOverview, examsOverview, notices, excuses, questions,
  };
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
      res.locals.aiRole = "owner";
      next();
      return;
    }
    const role = metadataRole(clerkUser?.publicMetadata);
    if (!clerkUser || !role) {
      res.status(403).json({ error: "Bu bölməyə giriş üçün sizə icazə verilməyib." });
      return;
    }
    const permissions = await permissionsForClerkUser(clerkUser, role);
    res.locals.aiPermissions = new Set<string>(permissions);
    res.locals.aiIsOwner = false;
    res.locals.aiRole = role;
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
    const selection = parseSourceSelection(req.body);
    if (!selection) {
      res.status(400).json({ error: "Mənbə rejimi düzgün deyil." });
      return;
    }
    if (selection.mode === "external") {
      // Akademiya məlumatlarına bu yolda baxılmır; ayar söndürülübsə xarici sayta da müraciət edilmir.
      const result = await routeStudentExternal(
        { message: input.message, target: selection.target },
        await getStudentExternalSetting(),
        (intent) => answerResearch(intent, { onUpstreamStatus: logUpstreamStatus }),
      );
      res.status(result.status).json(result.body);
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
    const selection = parseSourceSelection(req.body);
    if (!selection) {
      res.status(400).json({ error: "Mənbə rejimi düzgün deyil." });
      return;
    }
    const permissions = res.locals.aiPermissions as ReadonlySet<string>;
    const isOwner = res.locals.aiIsOwner === true;
    const result = await routeAdminMessage(
      { message: input.message, mode: selection.mode, target: selection.target, canReadLms: isOwner || permissions.has("students") },
      {
        internal: () => getAiProvider().answer(input, buildAdminContext(permissions, isOwner, String(res.locals.aiRole ?? ""))),
        research: (intent) => answerResearch(intent, { onUpstreamStatus: logUpstreamStatus }),
      },
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

const shamelaPageHandler: RequestHandler = async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as { bookId?: unknown; pageId?: unknown };
    const bookId = typeof body.bookId === "number" ? body.bookId : Number(body.bookId);
    const pageId = typeof body.pageId === "number" ? body.pageId : Number(body.pageId);
    if (!Number.isSafeInteger(bookId) || !Number.isSafeInteger(pageId) || bookId < 1 || pageId < 1) {
      res.status(400).json({ error: "Kitab və səhifə nömrəsi düzgün deyil." });
      return;
    }
    try {
      res.json({ page: await openShamelaPage(bookId, pageId) });
    } catch (error) {
      if (!(error instanceof ResearchUpstreamError)) throw error;
      res.status(502).json({
        error: "Şamilə hal-hazırda cavab vermir. Bir az sonra yenidən cəhd edin.",
        sourceUrl: shamelaPageUrl(bookId, pageId),
      });
    }
  } catch (error) {
    next(error);
  }
};

const requireStudentShamela: RequestHandler = async (_req, res, next) => {
  try {
    if (!(await getStudentExternalSetting()).shamela) {
      res.status(403).json({ error: "Xarici axtarış tələbələr üçün hazırda söndürülüb." });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

router.post("/ai/admin/shamela/page", noStore, requireAiStaff, rateLimit, shamelaPageHandler);
router.post("/ai/student/shamela/page", noStore, requireApprovedStudent, rateLimit, requireStudentShamela, shamelaPageHandler);

// Tələbə interfeysi üçün: «Xarici» rejim açıqdırmı və hansı mənbələr.
router.get("/ai/student/config", noStore, requireApprovedStudent, async (_req, res, next) => {
  try {
    const setting = await getStudentExternalSetting();
    res.json({ external: { enabled: studentExternalEnabled(setting), shamela: setting.shamela, dorar: setting.dorar } });
  } catch (error) {
    next(error);
  }
});

// Sistem sahibi: tələbələr üçün «Xarici» axtarış ayarı.
const requireOwnerForSetting: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." });
      return;
    }
    if (!(await userIsSystemOwner(userId))) {
      res.status(403).json({ error: "Bu ayarı yalnız sistem sahibi dəyişə bilər." });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

router.get("/ai/admin/student-external", noStore, requireOwnerForSetting, async (_req, res, next) => {
  try {
    const owner = await findSystemOwnerUser();
    res.json(readStudentExternalSetting(owner?.publicMetadata));
  } catch (error) {
    next(error);
  }
});

router.put("/ai/admin/student-external", noStore, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." });
      return;
    }
    const actorIsOwner = await userIsSystemOwner(userId);
    const owner = actorIsOwner ? await findSystemOwnerUser() : null;
    if (actorIsOwner && !owner) {
      res.status(404).json({ error: "Sistem sahibi tapılmadı." });
      return;
    }
    const result = await updateStudentExternalSetting(
      { actorIsOwner, body: req.body, ownerMetadata: owner?.publicMetadata },
      async (publicMetadata) => {
        await clerkClient.users.updateUserMetadata(owner!.id, { publicMetadata });
        studentExternalCache = null;
      },
    );
    res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
});

export default router;
