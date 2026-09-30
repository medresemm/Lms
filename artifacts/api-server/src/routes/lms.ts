import { Router, type IRouter, type RequestHandler } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, notInArray, or, sql } from "drizzle-orm";
import { getApplicationWindowStatus, type ApplicationWindow } from "../lib/applicationWindow.js";
import {
  applicationUploadIntentsTable,
  applicationSettingsTable,
  applicationsTable,
  articlesTable,
  db,
  announcementsTable,
  attendanceExcusesTable,
  coursesTable,
  dailyBenefitsTable,
  resourcesTable,
  studentTeacherChoicesTable,
  studentCourseSelectionsTable,
  subjectRemovalRequestsTable,
  studentAcademicProfilesTable,
  studentAttendanceRecordsTable,
  lessonJoinEventsTable,
  studentGradesTable,
  studentDeletionAuditTable,
  auditEventsTable,
  messagesTable,
  questionsTable,
  studentNotificationsTable,
  studentNotificationDismissalsTable,
  assignmentUploadIntentsTable,
  assignmentsTable,
  assignmentAttachmentsTable,
  assignmentSubmissionsTable,
  examsTable,
  onboardingExamAssignmentsTable,
  examQuestionsTable,
  examOptionsTable,
  examSubmissionsTable,
  examAttemptsTable,
  graduateCertificatesTable,
} from "@workspace/db";
import {
  CreateAnnouncementBody,
  CreateArticleBody,
  CreateCourseBody,
  CreateResourceBody,
  CreateDailyBenefitBody,
  DecideApplicationBody,
  DecideApplicationParams,
  DecideApplicationResponse,
  AssignApplicationTeacherParams,
  AssignApplicationTeacherResponse,
  GetAdminApplicationsResponse,
  GetAnnouncementsResponse,
  GetAdminAnnouncementsResponse,
  GetArticlesResponse,
  GetAdminArticlesResponse,
  GetDailyBenefitResponse,
  GetAdminDailyBenefitsResponse,
  GetResourcesResponse,
  GetCourseResponse,
  GetCoursesResponse,
  GetDashboardResponse,
  GetStudentAcademicProfileResponse,
  GetAdminAcademicProfilesResponse,
  GetAdminAcademicProfileParams,
  GetAdminAcademicProfileResponse,
  GetAdminCourseStudentsResponse,
  GetAdminStudentsResponse,
  GetGraduationCandidatesResponse,
  GraduateStudentResponse,
  RestoreGraduatedStudentResponse,
  GetAdminGraduationCertificatesResponse,
  CreateAdminGraduationCertificateResponse,
  UpdateAdminGraduationCertificateStatusBody,
  UpdateAdminGraduationCertificateStatusResponse,
  VerifyGraduationCertificateResponse,
  GetAdminUsersResponse,
  RequestApplicationUploadUrlBody,
  RequestApplicationUploadUrlResponse,
  RequestCourseUploadUrlBody,
  RequestCourseUploadUrlResponse,
  SubmitApplicationBody,
  SubmitApplicationResponse,
  UpdateAcademicProfileBody,
  UpdateAcademicProfileParams,
  UpdateAcademicProfileResponse,
  PromoteAcademicProfileBody,
  DemoteAcademicProfileBody,
  BulkPromoteAcademicProfilesBody,
  UpdateAcademicProfileGradesBody,
  UpdateAcademicProfileGradesParams,
  UpdateAcademicProfileGradesResponse,
  UpdateAcademicProfileAttendanceBody,
  UpdateAcademicProfileAttendanceParams,
  UpdateAcademicProfileAttendanceResponse,
  UpdateAdminUserRoleBody,
  UpdateAdminUserRoleParams,
  UpdateAdminUserRoleResponse,
  GetAdminUserProfileParams,
  GetAdminUserProfileResponse,
  GetAdminUserProfileHistoryResponse,
  UpdateAdminUserProfileBody,
  UpdateAdminUserProfileParams,
  UpdateAdminUserProfileResponse,
  DeleteAdminUserParams,
  CreateAttendanceExcuseBody,
  GetAdminAttendanceExcusesResponse,
  GetStudentSubjectRemovalRequestsResponse,
  CreateStudentSubjectRemovalRequestResponse,
  GetAdminSubjectRemovalRequestsResponse,
  DecideSubjectRemovalRequestBody,
  DecideSubjectRemovalRequestResponse,
  DeleteAdminStudentBody,
  StudentDeletionNotice,
  GetStudentDeletionNoticeResponse,
  GetAdminStudentDeletionAuditResponse,
  GetApplicationWindowResponse,
  GetAdminApplicationWindowResponse,
  UpdateAdminApplicationWindowBody,
  UpdateAdminApplicationWindowResponse,
  GetAdminAdmissionModeResponse,
  UpdateAdminAdmissionModeBody,
  UpdateAdminAdmissionModeResponse,
  UpdateAdminCourseActivationBody,
  GetAdminCourseActivationResponse,
  UpdateAdminCourseActivationResponse,
  RecordLessonJoinBody,
  RecordLessonJoinResponse,
  GetAdminLessonAttendanceResponse,
  ConfirmLessonAttendanceParams,
  ConfirmLessonAttendanceBody,
  ConfirmLessonAttendanceResponse,
  GetStudentAssignmentsQueryParams,
  GetStudentAssignmentsResponse,
  GetStudentAssignmentParams,
  GetStudentAssignmentResponse,
  RequestStudentAssignmentUploadUrlParams,
  RequestStudentAssignmentUploadUrlBody,
  RequestStudentAssignmentUploadUrlResponse,
  SubmitAssignmentParams,
  SubmitAssignmentBody,
  SubmitAssignmentResponse,
  RequestAdminAssignmentUploadUrlBody,
  RequestAdminAssignmentUploadUrlResponse,
  GetAdminAssignmentsQueryParams,
  GetAdminAssignmentsResponse,
  CreateAssignmentBody,
  CreateAssignmentResponse,
  UpdateAssignmentParams,
  UpdateAssignmentBody,
  UpdateAssignmentResponse,
  GetAssignmentSubmissionsParams,
  GetAssignmentSubmissionsResponse,
  GradeAssignmentSubmissionParams,
  GradeAssignmentSubmissionBody,
  GradeAssignmentSubmissionResponse,
  RequestAssignmentResubmissionParams,
  RequestAssignmentResubmissionBody,
  RequestAssignmentResubmissionResponse,
  GetAssignmentAttachmentParams,
  GetStudentExamsQueryParams,
  GetStudentExamParams,
  GetStudentExamsResponse,
  GetStudentExamResponse,
  SubmitExamParams,
  SubmitExamBody,
  SubmitExamResponse,
  GetAdminExamsResponse,
  CreateExamBody,
  CreateExamResponse,
  UpdateExamParams as UpdateExamRouteParams,
  UpdateExamBody as UpdateExamRouteBody,
  UpdateExamResponse as UpdateExamRouteResponse,
  DeleteExamParams,
  GetExamSubmissionsParams,
  GetExamSubmissionsResponse,
  ResendExamToStudentResponse,
  ApproveExamSubmissionResponse,
  GetTeachersResponse,
  GetMessagesResponse,
  CreateMessageBody,
  CreateMessageResponse,
  UpdateMessageParams,
  UpdateMessageBody,
  UpdateMessageResponse,
  MarkMessageReadParams,
  MarkMessageReadResponse,
  ReplyToMessageParams,
  ReplyToMessageBody,
  ReplyToMessageResponse,
  DeleteMessageParams,
} from "@workspace/api-zod";
import { createApplicationUploadUrl, createAssignmentUploadUrl, createCourseUploadUrl, deleteApplicationFile, deleteAssignmentFile, deleteCourseFile, getApplicationFile, getAssignmentFile, getCourseFile } from "../lib/applicationStorage.js";
import { sendApplicationDecisionEmail, sendGraduationCertificateEmail, sendSubjectRemovalDecisionEmail, sendStudentNotificationEmail } from "../lib/applicationEmail.js";
import { deleteAllAuditEvents, deleteAuditEvent, listAuditEvents, recordAuditEvent } from "../lib/audit.js";
import { buildGraduationCertificatePdf } from "../lib/graduationCertificatePdf.js";

const router: IRouter = Router();
const uploadAttempts = new Map<string, { count: number; resetAt: number }>();
const decisionInProgress = new Set<number>();
// One application needs two upload URLs. Leave room for a few legitimate retries
// without allowing an IP to create an unbounded number of upload intents.
const applicationUploadLimit = 20;
const applicationUploadWindowMs = 15 * 60 * 1000;
const maxApplicationFileSize = 3 * 1024 * 1024;
const maxCoursePdfSize = 25 * 1024 * 1024;
const permittedApplicationFileTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

function mayRequestApplicationUpload(ip: string) {
  const now = Date.now();
  const state = uploadAttempts.get(ip);
  if (!state || state.resetAt <= now) {
    uploadAttempts.set(ip, { count: 1, resetAt: now + applicationUploadWindowMs });
    return true;
  }
  if (state.count >= applicationUploadLimit) return false;
  state.count += 1;
  return true;
}

async function removeExpiredApplicationUploadIntents() {
  const expired = await db.select().from(applicationUploadIntentsTable)
    .where(lt(applicationUploadIntentsTable.expiresAt, new Date().toISOString()))
    .limit(20);
  if (!expired.length) return;
  await Promise.all(expired.map((intent) => deleteApplicationFile(intent.objectPath).catch(() => undefined)));
  await db.delete(applicationUploadIntentsTable).where(inArray(applicationUploadIntentsTable.id, expired.map((intent) => intent.id)));
}

type SemesterDateEntry = { termNumber: number; startDate: string | null; endDate: string | null };

function parseSemesterDates(value: string | null | undefined): Record<string, { startDate: string | null; endDate: string | null }> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseActiveTermNumbers(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "{}") as { activeTerms?: unknown };
    const activeTerms = Array.isArray(parsed.activeTerms)
      ? parsed.activeTerms.filter((term): term is number => Number.isInteger(term) && term >= 1 && term <= 8)
      : [];
    return Array.from(new Set([1, 2, 3, 4, ...activeTerms])).sort((left, right) => left - right);
  } catch {
    return [1, 2, 3, 4];
  }
}

async function getActiveTermNumbers() {
  const [settings] = await db.select({ semesterDates: applicationSettingsTable.semesterDates })
    .from(applicationSettingsTable).where(eq(applicationSettingsTable.id, 1)).limit(1);
  return parseActiveTermNumbers(settings?.semesterDates);
}

async function getSemesterDates(): Promise<SemesterDateEntry[]> {
  const [settings] = await db.select({ semesterDates: applicationSettingsTable.semesterDates })
    .from(applicationSettingsTable).where(eq(applicationSettingsTable.id, 1)).limit(1);
  const dates = parseSemesterDates(settings?.semesterDates);
  return Array.from({ length: 8 }, (_, index) => index + 1).map((termNumber) => ({
    termNumber,
    startDate: dates[String(termNumber)]?.startDate ?? null,
    endDate: dates[String(termNumber)]?.endDate ?? null,
  }));
}

async function getApplicationWindow(): Promise<ApplicationWindow> {
  const [settings] = await db.select().from(applicationSettingsTable).where(eq(applicationSettingsTable.id, 1)).limit(1);
  const opensAt = settings?.opensAt ?? null;
  const closesAt = settings?.closesAt ?? null;
  return getApplicationWindowStatus(opensAt, closesAt);
}

async function getAdmissionExamRequired() {
  const [settings] = await db.select({ admissionExamRequired: applicationSettingsTable.admissionExamRequired })
    .from(applicationSettingsTable).where(eq(applicationSettingsTable.id, 1)).limit(1);
  return settings?.admissionExamRequired ?? false;
}

type SystemStatistics = {
  teachers: number;
  currentStudents: number;
  graduatedStudents: number;
  visible: boolean;
};

async function getSystemStatistics(): Promise<SystemStatistics> {
  const users = await getClerkDirectory();
  const [currentStudents, graduatedStudents, settings] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(applicationsTable)
      .where(and(eq(applicationsTable.status, "approved"), isNull(applicationsTable.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(applicationsTable)
      .where(eq(applicationsTable.status, "graduated")),
    db.select({ statisticsVisible: applicationSettingsTable.statisticsVisible })
      .from(applicationSettingsTable).where(eq(applicationSettingsTable.id, 1)).limit(1),
  ]);
  return {
    teachers: users.filter((user) => roleForClerkUser(user) === "teacher").length,
    currentStudents: Number(currentStudents[0]?.count ?? 0),
    graduatedStudents: Number(graduatedStudents[0]?.count ?? 0),
    visible: settings[0]?.statisticsVisible ?? false,
  };
}

async function requireOpenApplicationWindow(res: Parameters<RequestHandler>[1]) {
  const window = await getApplicationWindow();
  if (!window.isOpen) {
    res.status(403).json({
      error: window.status === "not_started"
        ? "Müraciətlər hələ açılmayıb."
        : "Müraciət qəbulu artıq bağlanıb.",
      applicationWindow: window,
    });
    return false;
  }
  return true;
}

async function accountIsDeleted(userId: string) {
  const [application] = await db.select({ deletedAt: applicationsTable.deletedAt })
    .from(applicationsTable)
    .where(eq(applicationsTable.clerkUserId, userId))
    .limit(1);
  return Boolean(application?.deletedAt);
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." });
    return;
  }
  try {
    if (await accountIsDeleted(userId)) {
      res.status(403).json({ error: "Hesabınız deaktiv edilib. Bu məlumatlara giriş mümkün deyil." });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const requireApprovedStudent: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." });
      return;
    }
    const [application] = await db.select({ status: applicationsTable.status, deletedAt: applicationsTable.deletedAt })
      .from(applicationsTable)
      .where(eq(applicationsTable.clerkUserId, userId))
      .limit(1);
    if (!application || application.status !== "approved" || application.deletedAt) {
      res.status(403).json({
        error: application?.deletedAt
          ? "Hesabınız deaktiv edilib. Ətraflı məlumat üçün aşağıdakı bildirişə baxın."
          : application?.status === "rejected"
          ? "Müraciətinizə imtina verilib. Ətraflı məlumat üçün akademiya ilə əlaqə saxlayın."
          : "Hesabınız hələ Gözləmədə (Pending) statusundadır.",
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

function metadataRole(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("role" in metadata)) return null;
  const role = (metadata as { role?: unknown }).role;
  return role === "admin" || role === "teacher" || role === "supervisor" || role === "owner_assistant" ? role : null;
}

function hasStaffRole(metadata: unknown) {
  const role = metadataRole(metadata);
  return role === "admin" || role === "teacher" || role === "supervisor" || role === "owner_assistant";
}

function normalizedEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

const userProfileAuditFields = [
  "firstName",
  "lastName",
  "username",
  "email",
  "phone",
  "birthDate",
  "arabicLevel",
] as const;
type UserProfileAuditField = typeof userProfileAuditFields[number];
type UserProfileSnapshot = Record<UserProfileAuditField, string | null>;

async function getClerkUser(userId: string) {
  const cached = clerkUserCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const inFlight = clerkUserRequests.get(userId);
  if (inFlight) return inFlight;

  const request = clerkClient.users.getUser(userId)
    .catch(() => null)
    .then((user) => {
      clerkUserCache.set(userId, { expiresAt: Date.now() + clerkCacheTtlMs, value: user });
      return user;
    })
    .finally(() => {
      clerkUserRequests.delete(userId);
    });
  clerkUserRequests.set(userId, request);
  return request;
}

async function getClerkDirectory(): Promise<ClerkUser[]> {
  if (clerkDirectoryCache && clerkDirectoryCache.expiresAt > Date.now()) return clerkDirectoryCache.value;
  if (clerkDirectoryRequest) return clerkDirectoryRequest;

  clerkDirectoryRequest = (async () => {
    const users: ClerkUser[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await clerkClient.users.getUserList({ limit: 100, offset });
      users.push(...page.data);
      if (page.data.length < 100) break;
    }
    clerkDirectoryCache = { expiresAt: Date.now() + clerkCacheTtlMs, value: users };
    return users;
  })().finally(() => {
    clerkDirectoryRequest = null;
  });
  return clerkDirectoryRequest;
}

function userProfileSnapshot(
  clerkUser: NonNullable<Awaited<ReturnType<typeof getClerkUser>>>,
  application?: Pick<typeof applicationsTable.$inferSelect, "firstName" | "lastName" | "username" | "email" | "phone" | "birthDate" | "arabicLevel">,
): UserProfileSnapshot {
  return {
    firstName: clerkUser.firstName || application?.firstName || "",
    lastName: clerkUser.lastName || application?.lastName || "",
    username: clerkUser.username || application?.username || null,
    email: clerkUser.primaryEmailAddress?.emailAddress || application?.email || "",
    phone: application?.phone ?? "",
    birthDate: application?.birthDate ?? "",
    arabicLevel: application?.arabicLevel ?? "Orta",
  };
}

function userProfileDiff(previous: UserProfileSnapshot, next: UserProfileSnapshot) {
  const changedFields = userProfileAuditFields.filter((field) => {
    if (field === "email") return normalizedEmail(previous[field]) !== normalizedEmail(next[field]);
    return previous[field] !== next[field];
  });
  return {
    changedFields,
    previousValues: Object.fromEntries(changedFields.map((field) => [field, previous[field]])),
    newValues: Object.fromEntries(changedFields.map((field) => [field, next[field]])),
  };
}

async function userIsSystemOwner(userId: string, clerkUser?: Awaited<ReturnType<typeof getClerkUser>>) {
  const ownerEmail = normalizedEmail(process.env.SYSTEM_OWNER_EMAIL);
  if (!ownerEmail) return false;
  const user = clerkUser === undefined ? await getClerkUser(userId) : clerkUser;
  return normalizedEmail(user?.primaryEmailAddress?.emailAddress) === ownerEmail;
}

function roleForClerkUser(clerkUser: NonNullable<Awaited<ReturnType<typeof getClerkUser>>>) {
  const ownerEmail = normalizedEmail(process.env.SYSTEM_OWNER_EMAIL);
  if (ownerEmail && normalizedEmail(clerkUser.primaryEmailAddress?.emailAddress) === ownerEmail) return "owner" as const;
  return metadataRole(clerkUser.publicMetadata) ?? "none" as const;
}

function ownerDisplayNameParts(clerkUser: NonNullable<Awaited<ReturnType<typeof getClerkUser>>>) {
  const configuredName = process.env.SYSTEM_OWNER_NAME?.trim();
  const isOwner = roleForClerkUser(clerkUser) === "owner";
  if (!configuredName || !isOwner) {
    return { firstName: clerkUser.firstName ?? "", lastName: clerkUser.lastName ?? "" };
  }
  const [firstName, ...lastNameParts] = configuredName.split(/\s+/);
  return { firstName, lastName: lastNameParts.join(" ") };
}

function toAdminUser(
  clerkUser: NonNullable<Awaited<ReturnType<typeof getClerkUser>>>,
  application?: Pick<typeof applicationsTable.$inferSelect, "firstName" | "lastName">,
) {
  const displayName = ownerDisplayNameParts(clerkUser);
  return {
    id: clerkUser.id,
    firstName: application?.firstName?.trim() || displayName.firstName,
    lastName: application?.lastName?.trim() || displayName.lastName,
    username: clerkUser.username ?? null,
    email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
    role: roleForClerkUser(clerkUser),
  };
}

async function userHasTeacherAccess(userId: string) {
  const configuredIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configuredIds.includes(userId)) return true;

  const clerkUser = await getClerkUser(userId);
  return hasStaffRole(clerkUser?.publicMetadata) || await userIsSystemOwner(userId, clerkUser);
}

async function canManageResourceRoster(userId: string, resource: typeof resourcesTable.$inferSelect) {
  if (await userIsSystemOwner(userId)) return true;
  const clerkUser = await getClerkUser(userId);
  return metadataRole(clerkUser?.publicMetadata) === "owner_assistant" || resource.teacherClerkUserId === userId;
}

const rolePermissionKeys = [
  "applications",
  "students",
  "grading",
  "attendance",
  "excuses",
  "announcements",
  "articles",
  "dailyBenefits",
  "schedule",
  "assignments",
  "teacherAssignment",
  "userRoleManagement",
] as const;
type RolePermission = typeof rolePermissionKeys[number];
type ClerkUser = Awaited<ReturnType<typeof clerkClient.users.getUser>>;
const clerkCacheTtlMs = 15_000;
const clerkUserCache = new Map<string, { expiresAt: number; value: ClerkUser | null }>();
const clerkUserRequests = new Map<string, Promise<ClerkUser | null>>();
let clerkDirectoryCache: { expiresAt: number; value: ClerkUser[] } | null = null;
let clerkDirectoryRequest: Promise<ClerkUser[]> | null = null;
const sharedPermissionsCache = new Map<string, { expiresAt: number; value: RolePermission[] }>();
const sharedPermissionsRequests = new Map<string, Promise<RolePermission[]>>();
const resourceLinkLifetimeMs = 2 * 60 * 60 * 1000;

function resourceLinkExpiresAt(url: string | null) {
  return url ? new Date(Date.now() + resourceLinkLifetimeMs) : null;
}

function resourceLinkIsExpired(resource: { url: string | null; expiresAt: Date | null }) {
  return Boolean(resource.url && resource.expiresAt && resource.expiresAt.getTime() <= Date.now());
}

const defaultRolePermissions: Record<"teacher" | "supervisor" | "owner_assistant", RolePermission[]> = {
  teacher: [...rolePermissionKeys],
  supervisor: ["students", "applications", "announcements", "articles", "dailyBenefits", "schedule"],
  owner_assistant: ["applications", "teacherAssignment"],
};

function configuredRolePermissions(metadata: unknown, role: "teacher" | "supervisor" | "owner_assistant") {
  const configured = metadata && typeof metadata === "object" && "rolePermissions" in metadata
    ? (metadata as { rolePermissions?: unknown }).rolePermissions
    : null;
  const values = configured && typeof configured === "object" && role in configured
    ? (configured as Record<string, unknown>)[role]
    : null;
  if (!Array.isArray(values)) return defaultRolePermissions[role];
  return rolePermissionKeys.filter((key) => values.includes(key));
}

function individualRolePermissions(metadata: unknown) {
  const configured = metadata && typeof metadata === "object" && "individualRolePermissions" in metadata
    ? (metadata as { individualRolePermissions?: unknown }).individualRolePermissions
    : null;
  return Array.isArray(configured)
    ? rolePermissionKeys.filter((key) => configured.includes(key))
    : null;
}

async function sharedRolePermissions(role: "teacher" | "supervisor" | "owner_assistant") {
  const cached = sharedPermissionsCache.get(role);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const inFlight = sharedPermissionsRequests.get(role);
  if (inFlight) return inFlight;

  const ownerEmail = normalizedEmail(process.env.SYSTEM_OWNER_EMAIL);
  const request = (async () => {
    if (!ownerEmail) return defaultRolePermissions[role];
    const ownerPage = await clerkClient.users.getUserList({ emailAddress: [ownerEmail], limit: 1 });
    const owner = ownerPage.data[0];
    return configuredRolePermissions(owner?.publicMetadata, role);
  })().then((permissions) => {
    sharedPermissionsCache.set(role, { expiresAt: Date.now() + clerkCacheTtlMs, value: permissions });
    return permissions;
  }).finally(() => {
    sharedPermissionsRequests.delete(role);
  });
  sharedPermissionsRequests.set(role, request);
  return request;
}

async function permissionsForClerkUser(
  clerkUser: NonNullable<Awaited<ReturnType<typeof getClerkUser>>>,
  role: "teacher" | "supervisor" | "owner_assistant" | "admin",
) {
  const individual = individualRolePermissions(clerkUser.publicMetadata);
  if (individual && role !== "admin") return individual;
  return sharedRolePermissions(role === "admin" ? "teacher" : role);
}

function permissionForAdminRequest(path: string, method: string): RolePermission | null {
  if (path.startsWith("/admin/users")) return "userRoleManagement";
  if (path.startsWith("/admin/teacher-courses")) return "schedule";
  if (path.startsWith("/admin/courses")) return "schedule";
  if (path.startsWith("/admin/applications/") && path.endsWith("/teacher-role")) return "teacherAssignment";
  if (path.startsWith("/admin/applications")) return "applications";
  if (path.includes("/grades")) return "grading";
  if (path.includes("/attendance")) return "attendance";
  if (path.startsWith("/admin/students") || path.startsWith("/admin/academic-profiles")) return "students";
  if (path.startsWith("/admin/attendance-excuses")) return "excuses";
  if (path.startsWith("/admin/teacher-choices")) return "schedule";
  if (path.startsWith("/admin/semester-subject-removal-requests")) return "applications";
  if (path.startsWith("/admin/announcements")) return "announcements";
  if (path.startsWith("/admin/student-notifications")) return "announcements";
  if (path.startsWith("/admin/articles")) return "articles";
  if (path.startsWith("/admin/daily-benefits")) return "dailyBenefits";
  if (path.startsWith("/admin/assignments") || path === "/admin/assignment-upload-url") return "assignments";
  if (path.startsWith("/admin/resources")) return "schedule";
  if (path.startsWith("/admin/teacher-schedule") || path.startsWith("/admin/teachers")) return "schedule";
  return null;
}

export const requireTeacher: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const { userId } = auth;
    if (!userId) {
      res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." });
      return;
    }

    const clerkUser = await getClerkUser(userId);
    if (await userIsSystemOwner(userId, clerkUser)) {
      next();
      return;
    }
    const role = metadataRole(clerkUser?.publicMetadata);
    const permission = permissionForAdminRequest(req.path, req.method);
    const permissionRole = role === "admin" ? "teacher" : role;
    const teacherManagementRestricted = role === "teacher"
      && (req.path.startsWith("/admin/users") || req.path.startsWith("/admin/course-activation"));
    if (teacherManagementRestricted) {
      res.status(403).json({ error: "Bu bölməyə yalnız sahib və sahib köməkçisi daxil ola bilər." });
      return;
    }
    if (role === "owner_assistant" && req.path === "/admin/resources" && req.method === "GET" &&
      (await permissionsForClerkUser(clerkUser!, "owner_assistant")).includes("assignments")) {
      next();
      return;
    }
    // Teachers may create their own course/resource even when the owner has
    // limited the broader schedule-management permission. Resource creation
    // assigns the authenticated teacher on the server, so this cannot be used
    // to create a course under somebody else's name.
    const isTeacherCreation = role === "teacher"
      && req.method === "POST"
      && (req.path === "/admin/resources" || req.path === "/admin/courses" || req.path === "/admin/courses/upload-url");
    if (isTeacherCreation) {
      next();
      return;
    }
    if (permissionRole && (!permission || (await permissionsForClerkUser(clerkUser!, permissionRole)).includes(permission))) {
      next();
      return;
    }

    res.status(403).json({ error: "Bu bölməyə giriş üçün sizə icazə verilməyib." });
  } catch (error) {
    next(error);
  }
};

export const requireSystemOwner: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." });
      return;
    }
    if (await userIsSystemOwner(userId)) {
      next();
      return;
    }
    res.status(403).json({ error: "İstifadəçi rollarını yalnız sistem sahibi idarə edə bilər." });
  } catch (error) {
    next(error);
  }
};

const requireCertificateManager: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." });
      return;
    }
    const clerkUser = await getClerkUser(userId);
    if (await userIsSystemOwner(userId, clerkUser) || metadataRole(clerkUser?.publicMetadata) === "owner_assistant") {
      next();
      return;
    }
    res.status(403).json({ error: "Şəhadətnamələri yalnız sahib və sahib köməkçisi idarə edə bilər." });
  } catch (error) {
    next(error);
  }
};

export const requireOwnerOrAssistant: RequestHandler = async (req, res, next) => {
  return requireOwnerOrAssistantPermission("userRoleManagement")(req, res, next);
};

export function requireOwnerOrAssistantPermission(permission: RolePermission): RequestHandler {
  return async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." });
      return;
    }
    const clerkUser = await getClerkUser(userId);
    if (await userIsSystemOwner(userId, clerkUser)) {
      next();
      return;
    }
    if (metadataRole(clerkUser?.publicMetadata) === "owner_assistant" && clerkUser &&
      (await permissionsForClerkUser(clerkUser, "owner_assistant")).includes(permission)) {
      next();
      return;
    }
    res.status(403).json({ error: "Bu əməliyyat üçün sahib köməkçisinə uyğun icazə verilməyib." });
  } catch (error) {
    next(error);
  }
  }
}

export const requireApprovedStudentOrTeacher: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const { userId } = auth;
    if (!userId) {
      res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." });
      return;
    }
    if (await userHasTeacherAccess(userId)) {
      next();
      return;
    }

    const [application] = await db.select({ status: applicationsTable.status, deletedAt: applicationsTable.deletedAt })
      .from(applicationsTable)
      .where(eq(applicationsTable.clerkUserId, userId))
      .limit(1);
    if (!application || application.status !== "approved" || application.deletedAt) {
      res.status(403).json({
        error: application?.deletedAt
          ? "Hesabınız deaktiv edilib. Tədris materiallarına girişiniz bağlanıb."
          : application?.status === "rejected"
          ? "Müraciətinizə imtina verilib. Ətraflı məlumat üçün akademiya ilə əlaqə saxlayın."
          : "Hesabınız hələ Gözləmədə (Pending) statusundadır.",
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

const seedCourses = [
  {
    title: "Quran",
    category: "Quran elmləri",
    instructor: "",
    progress: 68,
    completedLessons: 17,
    totalLessons: 25,
    color: "teal",
    nextLesson: "Surələrin düzgün oxunuşu",
    pdfUrl: null,
    telegramUrl: null,
    lessonUrl: null,
    description: "Quranı düzgün oxumağı, təcvid qaydalarını və surələrin mənalarını mərhələli şəkildə öyrənin.",
    curriculum: ["Quran oxunuşuna giriş", "Təcvidin əsas qaydaları", "Qısa surələrin əzbəri", "Surələrin məna və mesajları"],
    lessonDescription: "Bu dərsdə surələrin düzgün tələffüzü, dayanma və başlama qaydaları üzərində işləyəcəyik.",
  },
  {
    title: "Hadis",
    category: "İslam elmləri",
    instructor: "",
    progress: 42,
    completedLessons: 10,
    totalLessons: 24,
    color: "blue",
    nextLesson: "Hədislərin təsnifatı",
    pdfUrl: null,
    telegramUrl: null,
    lessonUrl: null,
    description: "Rəsulullahın (sallallahu aleyhi və səlləm) sünnəsini tanımaq və hədis elminin əsaslarını öyrənmək üçün giriş dərsi.",
    curriculum: ["Hədis nədir?", "Hədislərin təsnifatı", "Rəvayət və sənəd anlayışı", "Seçilmiş hədislərin şərhi"],
    lessonDescription: "Növbəti dərsdə hədislərin səhih, həsən və zəif olaraq təsnif edilməsinin əsas meyarlarını araşdıracağıq.",
  },
  {
    title: "Əqidə",
    category: "İslam elmləri",
    instructor: "",
    progress: 24,
    completedLessons: 6,
    totalLessons: 25,
    color: "amber",
    nextLesson: "İmanın əsasları",
    pdfUrl: null,
    telegramUrl: null,
    lessonUrl: null,
    description: "İmanın əsaslarını, tövhid anlayışını və müsəlmanın etiqadını mötəbər mənbələr əsasında öyrənin.",
    curriculum: ["Əqidə elminə giriş", "Tövhid və iman", "İmanın əsasları", "Əhli-sünnə etiqadının xüsusiyyətləri"],
    lessonDescription: "Bu dərsdə imanın altı əsasını və onların gündəlik həyatda əks olunmasını aydın nümunələrlə izah edəcəyik.",
  },
  {
    title: "Fiqh",
    category: "İslam hüququ",
    instructor: "",
    progress: 36,
    completedLessons: 9,
    totalLessons: 25,
    color: "rose",
    nextLesson: "Təmizlik və dəstəmaz",
    pdfUrl: null,
    telegramUrl: null,
    lessonUrl: null,
    description: "İbadətlərin düzgün yerinə yetirilməsi üçün zəruri olan fiqh qaydalarını sistemli şəkildə öyrənin.",
    curriculum: ["Fiqh elminə giriş", "Təmizlik və dəstəmaz", "Namazın hökmləri", "Oruc və gündəlik ibadətlər"],
    lessonDescription: "Növbəti mövzuda təmizlik, dəstəmazın fərzləri və onu pozan hallar haqqında danışacağıq.",
  },
  {
    title: "Ərəb dili",
    category: "Dil öyrənmə",
    instructor: "",
    progress: 51,
    completedLessons: 13,
    totalLessons: 25,
    color: "violet",
    nextLesson: "Ərəb əlifbası və hərflər",
    pdfUrl: null,
    telegramUrl: null,
    lessonUrl: null,
    description: "Ərəb dilinin əsaslarını öyrənərək Quran və hədis mətnlərini daha yaxşı anlamağa ilk addımı atın.",
    curriculum: ["Ərəb əlifbası", "Hərflərin yazılışı və oxunuşu", "Əsas sözlər və ifadələr", "Sadə cümlə quruluşu"],
    lessonDescription: "Bu dərsdə ərəb əlifbasının hərflərini tanıyacaq, onların sözün əvvəlində, ortasında və sonunda yazılışını öyrənəcəyik.",
  },
] as const;

const seedAnnouncements = [
  {
    title: "Yeni dərs materialları əlavə edildi",
    body: "Quran fənnində növbəti mövzu üçün yeni çalışma vərəqləri artıq əlçatandır.",
    date: "2026-08-22",
    type: "info" as const,
  },
  {
    title: "Sınaq imtahanı həftəsi",
    body: "Yekun hazırlıq qrupları üçün sınaq imtahanları 26–29 avqust tarixlərində keçiriləcək.",
    date: "2026-08-20",
    type: "important" as const,
  },
  {
    title: "Canlı görüş: Suallarınıza cavab",
    body: "Müəllimlərlə açıq görüşə qoşulun və dərslərlə bağlı suallarınızı verin.",
    date: "2026-08-18",
    type: "event" as const,
  },
];

const seedDailyBenefit = {
  body: "Allah kimə xeyir vermək istəyərsə, onu dində dərin anlayış sahibi (fəqih) edər.",
  source: "Səhih əl-Buxari və Səhih Müslim",
};

const seedArticles = [
  {
    title: "Elm öyrənməyə necə davam etməli?",
    excerpt: "Davamlı öyrənmə üçün sadə və praktik addımlar.",
    body: "Elm öyrənmək səbir, nizam və davamlılıq tələb edir. Hər gün az da olsa mütaliə etmək və öyrəndiklərini təkrar etmək möhkəm nəticə yaradır.",
    author: "Mədinə Tədris Akademiyası",
  },
  {
    title: "Dərsə hazırlığın əhəmiyyəti",
    excerpt: "Dərsdən əvvəl hazırlıq öyrənməni necə asanlaşdırır?",
    body: "Dərsdən əvvəl mövzuya qısa nəzər salmaq, sualları qeyd etmək və dərsdən sonra təkrar etmək öyrənilən məlumatın daha yaxşı yadda qalmasına kömək edir.",
    author: "Mədinə Tədris Akademiyası",
  },
];

let seedPromise: Promise<void> | undefined;

async function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await db.select({ id: coursesTable.id }).from(coursesTable).limit(1);
      if (existing.length === 0) {
        await db.insert(coursesTable).values(
          seedCourses.map((course) => ({
            ...course,
            curriculum: [...course.curriculum],
          })),
        );
      }
      const existingAnnouncements = await db.select({ id: announcementsTable.id }).from(announcementsTable).limit(1);
      if (existingAnnouncements.length === 0) await db.insert(announcementsTable).values(seedAnnouncements);
      const existingArticles = await db.select({ id: articlesTable.id }).from(articlesTable).limit(1);
      if (existingArticles.length === 0) {
        const createdAt = new Date().toISOString();
        await db.insert(articlesTable).values(seedArticles.map((article) => ({ ...article, createdAt })));
      }
      const existingResources = await db.select({ id: resourcesTable.id }).from(resourcesTable).limit(1);
      if (existingResources.length === 0) {
        const seededCourses = await db.select({ id: coursesTable.id, title: coursesTable.title }).from(coursesTable);
        const resources = seededCourses.map((course) => ({
          courseId: course.id,
          termNumber: 1,
          kind: "lesson",
          title: `${course.title} — giriş dərsi`,
          body: `${course.title} dərsi üzrə əsas mövzulara giriş və həftəlik çalışma.`,
          url: null,
          lessonDays: [],
          lessonTime: null,
          isMandatory: true,
          teacherClerkUserId: null,
          studentCapacity: 0,
        }));
        if (resources.length) await db.insert(resourcesTable).values(resources);
      }
      const existingSettings = await db.select({ id: applicationSettingsTable.id }).from(applicationSettingsTable).limit(1);
      if (existingSettings.length === 0) {
        await db.insert(applicationSettingsTable).values({ id: 1, opensAt: null, closesAt: null, statisticsVisible: false, admissionExamRequired: false, semesterDates: "{}", updatedAt: new Date().toISOString() });
      }
      await db.delete(dailyBenefitsTable).where(or(eq(dailyBenefitsTable.body, "Ttt"), eq(dailyBenefitsTable.source, "Ttt")));
      const existingBenefit = await db.select({ id: dailyBenefitsTable.id }).from(dailyBenefitsTable).limit(1);
      if (existingBenefit.length === 0) {
        await db.insert(dailyBenefitsTable).values({
          ...seedDailyBenefit,
          createdAt: new Date().toISOString(),
        });
      }
    })();
  }
  await seedPromise;
}

function toCourse(row: typeof coursesTable.$inferSelect, studentView = false) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    instructor: row.instructor,
    progress: studentView ? 0 : row.progress,
    completedLessons: studentView ? 0 : row.completedLessons,
    totalLessons: row.totalLessons,
    color: row.color,
    credits: row.credits,
    hours: row.hours,
    nextLesson: row.nextLesson,
    pdfUrl: row.pdfUrl,
    telegramUrl: row.telegramUrl,
    zoomUrl: row.zoomUrl,
    googleMeetUrl: row.googleMeetUrl,
    lessonUrl: row.lessonUrl,
    lessonDays: row.lessonDays,
    lessonTime: row.lessonTime,
  };
}

function toAnnouncement(row: typeof announcementsTable.$inferSelect) {
  return { id: row.id, title: row.title, body: row.body, date: row.date, type: row.type };
}

function toArticle(row: typeof articlesTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    author: row.author,
    createdAt: row.createdAt,
  };
}

function toDailyBenefit(row: typeof dailyBenefitsTable.$inferSelect) {
  return {
    id: row.id,
    body: row.body,
    source: row.source,
    dayOfWeek: row.dayOfWeek,
    createdAt: row.createdAt,
  };
}

function toResource(row: typeof resourcesTable.$inferSelect) {
  return {
    id: row.id,
    courseId: row.courseId,
    termNumber: row.termNumber,
    kind: row.kind,
    title: row.title,
    body: row.body,
    url: row.url,
    expiresAt: row.expiresAt,
    lessonDays: row.lessonDays,
    lessonTime: row.lessonTime,
    isMandatory: row.isMandatory,
    teacherClerkUserId: row.teacherClerkUserId,
    studentCapacity: row.studentCapacity,
    teacherName: null,
  };
}

function clerkDisplayName(user: NonNullable<Awaited<ReturnType<typeof getClerkUser>>>) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Müəllim";
}

async function activeTeachers() {
  const users = await getClerkDirectory();
  const applicationRows = users.length
    ? await db.select({
        clerkUserId: applicationsTable.clerkUserId,
        firstName: applicationsTable.firstName,
        lastName: applicationsTable.lastName,
      }).from(applicationsTable).where(inArray(applicationsTable.clerkUserId, users.map((user) => user.id)))
    : [];
  const applicationNames = new Map(applicationRows.map((application) => [
    application.clerkUserId,
    [application.firstName, application.lastName].filter(Boolean).join(" ").trim(),
  ]));
  const ownerAssistantTeacherIds = new Set(
    (await Promise.all(users
      .filter((user) => roleForClerkUser(user) === "owner_assistant")
      .map(async (user) => (await permissionsForClerkUser(user, "owner_assistant")).includes("teacherAssignment") ? user.id : null)))
      .filter((userId): userId is string => Boolean(userId)),
  );
  return users
    .filter((user) => {
      const role = roleForClerkUser(user);
      return role === "teacher" || role === "owner" || (role === "owner_assistant" && ownerAssistantTeacherIds.has(user.id));
    })
    .map((user) => {
      const role = roleForClerkUser(user);
      const displayName = role === "owner"
        ? applicationNames.get(user.id) || "Fərman İsayev"
        : applicationNames.get(user.id) || clerkDisplayName(user) || "Müəllim";
      const [firstName, ...lastNameParts] = displayName.split(/\s+/);
      return {
        clerkUserId: user.id,
        firstName: firstName ?? "",
        lastName: lastNameParts.join(" "),
        displayName,
      };
    });
}

async function teacherNameMap(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids));
  const users = await Promise.all(uniqueIds.map(async (id) => [id, await getClerkUser(id)] as const));
  const applicationRows = uniqueIds.length
    ? await db.select({
        clerkUserId: applicationsTable.clerkUserId,
        firstName: applicationsTable.firstName,
        lastName: applicationsTable.lastName,
      }).from(applicationsTable).where(inArray(applicationsTable.clerkUserId, uniqueIds))
    : [];
  const applicationNames = new Map(applicationRows.map((application) => [
    application.clerkUserId,
    [application.firstName, application.lastName].filter(Boolean).join(" ").trim(),
  ]));
  return new Map(users.map(([id, user]) => {
    if (!user) return [id, null] as const;
    const displayName = roleForClerkUser(user) === "owner"
      ? applicationNames.get(id) || "Fərman İsayev"
      : applicationNames.get(id) || clerkDisplayName(user);
    return [id, displayName] as const;
  }));
}

async function resourceViews(rows: Array<typeof resourcesTable.$inferSelect>) {
  const ids = Array.from(new Set(rows.map((row) => row.teacherClerkUserId).filter((id): id is string => Boolean(id))));
  const names = await teacherNameMap(ids);
  return rows.map((row) => ({
    ...toResource(row),
    teacherName: row.teacherClerkUserId ? names.get(row.teacherClerkUserId) ?? null : null,
  }));
}

async function validateTeacherAssignment(teacherClerkUserId: unknown) {
  if (typeof teacherClerkUserId !== "string" || !teacherClerkUserId.trim()) return null;
  const user = await getClerkUser(teacherClerkUserId.trim());
  if (!user) return null;
  const role = roleForClerkUser(user);
  return role === "teacher" || role === "owner" || role === "owner_assistant" ? user : null;
}

async function subjectRequestView(request: typeof subjectRemovalRequestsTable.$inferSelect) {
  const [profile, course] = await Promise.all([
    db.select().from(studentAcademicProfilesTable).where(eq(studentAcademicProfilesTable.id, request.profileId)).limit(1),
    db.select({ title: coursesTable.title }).from(coursesTable).where(eq(coursesTable.id, request.courseId)).limit(1),
  ]);
  const application = profile[0] ? await db.select().from(applicationsTable).where(eq(applicationsTable.id, profile[0].applicationId)).limit(1) : [];
  return {
    id: request.id, profileId: request.profileId, courseId: request.courseId, termNumber: request.termNumber,
    courseTitle: course[0]?.title?.trim() || `Dərs #${request.courseId}`,
    studentName: application[0] ? `${application[0].firstName} ${application[0].lastName}` : "Tələbə",
    reason: request.reason, status: request.status, rejectionReason: request.rejectionReason,
    createdAt: request.createdAt, reviewedAt: request.reviewedAt,
  };
}

function safeResourceUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("/objects/courses/") && value.length > "/objects/courses/".length) return value;
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("Material linki yalnız təhlükəsiz HTTPS ünvanı ola bilər.");
  }
  return url.toString();
}

const coursePdfObjectPathPattern = /^\/objects\/courses\/[a-zA-Z0-9-]+\.pdf$/;

const weekDayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function scheduledLessonCount(startDate: string | null, endDate: string | null, lessonDays: string[]) {
  if (!startDate || !endDate || !lessonDays.length) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return null;
  const selectedDays = new Set(lessonDays);
  let count = 0;
  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    if (selectedDays.has(weekDayKeys[date.getUTCDay()])) count += 1;
  }
  return count;
}

function calculateAttendancePercent(
  records: Array<{ status: string }>,
  schedule?: { startDate: string | null; endDate: string | null; lessonDays: string[] },
) {
  const expectedLessons = schedule ? scheduledLessonCount(schedule.startDate, schedule.endDate, schedule.lessonDays) : null;
  if (expectedLessons !== null) {
    if (expectedLessons === 0) return null;
    const absentCount = records.filter((record) => record.status === "absent").length;
    return Math.min(100, Math.round((absentCount / expectedLessons) * 100));
  }
  return null;
}

function gradePointsToFiveScale(gradePoints: number) {
  return gradePoints > 100 ? gradePoints / 100 : gradePoints / 20;
}

function parseComponentGrades(value: string | null | undefined) {
  if (!value) return {} as Record<string, number | null>;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).filter(([name, score]) =>
      name.trim().length > 0 && (score === null || (typeof score === "number" && Number.isFinite(score))),
    )) as Record<string, number | null>;
  } catch {
    return {} as Record<string, number | null>;
  }
}

function calculateComponentGrade(componentNames: string[], componentGrades: Record<string, number | null>) {
  const scores = componentNames.map((name) => componentGrades[name]).filter((score): score is number => typeof score === "number");
  return scores.length
    ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100
    : null;
}

function validateTermNumber(value: number) {
  return !Number.isInteger(value) || value < 1 || value > 8
    ? "Semestr 1 ilə 8 arasında tam ədəd olmalıdır."
    : null;
}

function isValidIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validateAttendancePercent(value: number | null) {
  return value !== null && (!Number.isInteger(value) || value < 0 || value > 100)
    ? "Davamiyyət 0 ilə 100 arasında tam faiz olmalıdır."
    : null;
}

function toApplication(row: typeof applicationsTable.$inferSelect) {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    username: row.username || undefined,
    phone: row.phone,
    email: row.email,
    birthDate: row.birthDate,
    arabicLevel: row.arabicLevel,
    recommendationPaths: row.recommendationPaths,
    recommendationNames: row.recommendationNames,
    clerkUserId: row.clerkUserId,
    status: row.status,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
  };
}

async function cleanupRejectedApplicationFiles(application: typeof applicationsTable.$inferSelect) {
  if (application.status !== "rejected") return;
  await Promise.allSettled(application.recommendationPaths.map(async (objectPath) => {
    try {
      await deleteApplicationFile(objectPath);
    } catch (error) {
      console.error("Rədd edilmiş müraciətin PDF-i silinə bilmədi.", {
        applicationId: application.id,
        objectPath,
        error,
      });
    }
  }));
}

function termDetails(termNumber: number) {
  const courseYear = Math.ceil(termNumber / 2);
  const semester = termNumber % 2 === 0 ? 2 : 1;
  const ordinalSuffixes = ['-ci', '-ci', '-cü', '-cü', '-ci', '-cı', '-ci', '-ci'];
  const termLabel = `${termNumber}${ordinalSuffixes[termNumber - 1] ?? '-ci'}`;
  return {
    courseYear,
    semester,
    label: `${termLabel} Semestr`,
  };
}

function currentTermNumber(profile: typeof studentAcademicProfilesTable.$inferSelect) {
  return (profile.courseYear - 1) * 2 + profile.semester;
}

async function getApprovedStudentProfile(userId: string) {
  const [row] = await db.select({ profile: studentAcademicProfilesTable }).from(studentAcademicProfilesTable)
    .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
    .where(and(eq(studentAcademicProfilesTable.clerkUserId, userId), eq(applicationsTable.status, "approved"), isNull(applicationsTable.deletedAt)))
    .limit(1);
  return row?.profile ?? null;
}

async function ensureAcademicProfile(application: typeof applicationsTable.$inferSelect) {
  if (!application.clerkUserId) {
    throw new Error("Tələbə hesabı ilə müraciət əlaqələndirilməyib.");
  }
  const now = new Date().toISOString();
  await db.insert(studentAcademicProfilesTable).values({
    applicationId: application.id,
    clerkUserId: application.clerkUserId,
    courseYear: 1,
    semester: 1,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing({ target: studentAcademicProfilesTable.applicationId });
  const [profile] = await db.select().from(studentAcademicProfilesTable)
    .where(eq(studentAcademicProfilesTable.applicationId, application.id)).limit(1);
  if (!profile) {
    throw new Error("Bu hesab artıq başqa bir akademik profilə bağlıdır.");
  }
  return profile;
}

async function ensureProfilesForApprovedStudents() {
  const approvedApplications = await db.select().from(applicationsTable)
    .where(and(eq(applicationsTable.status, "approved"), isNull(applicationsTable.deletedAt)));
  await Promise.all(approvedApplications
    .filter((application) => Boolean(application.clerkUserId))
    .map((application) => ensureAcademicProfile(application)));
}

function toAcademicSummary(
  profile: typeof studentAcademicProfilesTable.$inferSelect,
  application: typeof applicationsTable.$inferSelect,
) {
  const status = termDetails(currentTermNumber(profile));
  return {
    id: profile.id,
    studentNumber: profile.studentNumber,
    applicationId: application.id,
    firstName: application.firstName,
    lastName: application.lastName,
    email: application.email,
    courseYear: profile.courseYear,
    semester: profile.semester,
    statusLabel: status.label,
    program: profile.program,
  };
}

function termToCoursePosition(termNumber: number) {
  return {
    courseYear: Math.ceil(termNumber / 2),
    semester: termNumber % 2 === 0 ? 2 : 1,
  };
}

async function buildAcademicProfile(
  profile: typeof studentAcademicProfilesTable.$inferSelect,
  application: typeof applicationsTable.$inferSelect,
  visibleThroughTerm = 4,
  includePromotionMetadata = false,
) {
  await ensureSeeded();
  const [activeTerms, courseRows, gradeRows, attendanceRecordRows, resourceRows, selectionRows, semesterDateRows, teacherChoiceRows] = await Promise.all([
    getActiveTermNumbers(),
    getCourses(),
    db.select().from(studentGradesTable).where(eq(studentGradesTable.profileId, profile.id)),
    db.select().from(studentAttendanceRecordsTable).where(eq(studentAttendanceRecordsTable.profileId, profile.id)).orderBy(desc(studentAttendanceRecordsTable.attendanceDate), desc(studentAttendanceRecordsTable.id)),
    db.select().from(resourcesTable),
    db.select().from(studentCourseSelectionsTable).where(eq(studentCourseSelectionsTable.profileId, profile.id)),
    getSemesterDates(),
    db.select().from(studentTeacherChoicesTable).where(and(eq(studentTeacherChoicesTable.profileId, profile.id), eq(studentTeacherChoicesTable.status, "approved"))),
  ]);
  const semesterDates = new Map(semesterDateRows.map((item) => [item.termNumber, item]));
  const grades = new Map(gradeRows.map((grade) => [`${grade.termNumber}:${grade.courseId}`, grade]));
  const selections = new Map(selectionRows.map((selection) => [`${selection.termNumber}:${selection.courseId}`, selection.selected]));
   const teacherIds = Array.from(new Set(resourceRows.map((resource) => resource.teacherClerkUserId).filter((id): id is string => Boolean(id))));
   const teacherNames = await teacherNameMap(teacherIds);
  const semesters = Array.from({ length: 8 }, (_, index) => index + 1)
    .filter((termNumber) => activeTerms.includes(termNumber) && termNumber <= visibleThroughTerm)
    .map((termNumber) => {
    const details = termDetails(termNumber);
    const termAttendanceRecords = attendanceRecordRows.filter((record) => record.termNumber === termNumber);
    const termResources = resourceRows.filter((resource) => resource.termNumber === termNumber);
    const subjectCourses = Array.from(new Map(termResources.map((resource) => [resource.courseId, { courseId: resource.courseId, isMandatory: resource.isMandatory }])).values())
      .filter(({ courseId }) => selections.get(`${termNumber}:${courseId}`) !== false);
    const subjects = subjectCourses.map(({ courseId, isMandatory }) => {
       const course = courseRows.find((item) => item.id === courseId);
       if (!course) return null;
      const approvedChoice = teacherChoiceRows.find((choice) => termResources.some((item) => item.id === choice.resourceId && item.courseId === course.id));
      const resource = approvedChoice ? termResources.find((item) => item.id === approvedChoice.resourceId) : termResources.find((item) => item.courseId === course.id);
      const gradeRecord = grades.get(`${termNumber}:${course.id}`);
      const componentNames = course.gradingComponents ?? [];
      const componentGrades = parseComponentGrades(gradeRecord?.componentGrades);
      const calculatedGrade = componentNames.length
        ? calculateComponentGrade(componentNames, componentGrades)
        : gradeRecord?.gradePoints;
      const courseRecords = termAttendanceRecords.filter((record) => record.courseId === course.id);
      const schedule = resource
        ? { startDate: semesterDates.get(termNumber)?.startDate ?? null, endDate: semesterDates.get(termNumber)?.endDate ?? null, lessonDays: resource.lessonDays }
        : { startDate: semesterDates.get(termNumber)?.startDate ?? null, endDate: semesterDates.get(termNumber)?.endDate ?? null, lessonDays: course.lessonDays };
      return {
        courseId: course.id,
        title: course.title,
         instructor: resource?.teacherClerkUserId ? teacherNames.get(resource.teacherClerkUserId) ?? course.instructor : course.instructor,
        isMandatory,
        grade: calculatedGrade === null || calculatedGrade === undefined ? null : gradePointsToFiveScale(calculatedGrade),
        credits: course.credits,
        hours: course.hours,
        gradingComponents: componentNames.map((name) => ({ name, score: componentGrades[name] ?? null })),
        absenceCount: courseRecords.filter((record) => record.status === "absent").length,
        attendancePercent: calculateAttendancePercent(courseRecords, schedule),
      };
    }).filter((subject): subject is NonNullable<typeof subject> => Boolean(subject));
    const enteredGrades = subjects.flatMap((subject) => subject.grade === null ? [] : [subject.grade]);
    const gpa = enteredGrades.length
      ? Math.round((enteredGrades.reduce((total, grade) => total + grade, 0) / enteredGrades.length) * 100) / 100
      : null;
    const attendanceRecords = termAttendanceRecords
      .map((record) => ({
        id: record.id,
        courseId: record.courseId,
        courseTitle: courseRows.find((course) => course.id === record.courseId)?.title ?? "Naməlum fənn",
        attendanceDate: record.attendanceDate,
        status: record.status,
        teacherName: record.teacherName,
      }));
    const termSchedules = Array.from(new Map(termResources.map((resource) => [resource.courseId, resource])).values())
      .map((resource) => ({
          startDate: semesterDates.get(termNumber)?.startDate ?? null,
          endDate: semesterDates.get(termNumber)?.endDate ?? null,
          lessonDays: resource.lessonDays,
        }));
    const expectedTermLessons = termSchedules.reduce((total, schedule) => total + (scheduledLessonCount(schedule.startDate, schedule.endDate, schedule.lessonDays) ?? 0), 0);
    const absentTermLessons = termAttendanceRecords.filter((record) => record.status === "absent").length;
    const termAttendancePercent = termSchedules.length && expectedTermLessons > 0
      ? Math.min(100, Math.round((absentTermLessons / expectedTermLessons) * 100))
      : calculateAttendancePercent(termAttendanceRecords);
    return { termNumber, ...details, gpa, attendancePercent: termAttendancePercent, subjects, attendanceRecords };
  });
  return {
    ...toAcademicSummary(profile, application),
    username: application.username,
    phone: application.phone,
    birthDate: application.birthDate,
    arabicLevel: application.arabicLevel,
    currentTermNumber: currentTermNumber(profile),
    ...(includePromotionMetadata ? {
      promotionApprovedAt: profile.promotionApprovedAt,
      promotionApprovedBy: profile.promotionApprovedBy,
      promotionFromTerm: profile.promotionFromTerm,
    } : {}),
    semesters,
  };
}

async function getCourses() {
  return db.select().from(coursesTable).orderBy(asc(coursesTable.id));
}

async function getStudentVisibleCourseIds(
  profile: Awaited<ReturnType<typeof getApprovedStudentProfile>>,
  courseRows: Awaited<ReturnType<typeof getCourses>>,
) {
  const [activeTerms, resources, selections] = await Promise.all([
    getActiveTermNumbers(),
    db.select({ courseId: resourcesTable.courseId, termNumber: resourcesTable.termNumber }).from(resourcesTable),
    db.select({ courseId: studentCourseSelectionsTable.courseId, termNumber: studentCourseSelectionsTable.termNumber, selected: studentCourseSelectionsTable.selected }).from(studentCourseSelectionsTable).where(eq(studentCourseSelectionsTable.profileId, profile.id)),
  ]);
  const visibleTerms = new Set(activeTerms.filter((termNumber) => termNumber <= currentTermNumber(profile)));
  const currentTerm = currentTermNumber(profile);
  const removed = new Set(selections.filter((selection) => !selection.selected).map((selection) => `${selection.termNumber}:${selection.courseId}`));
  const resourceTermsByCourse = new Map<number, number[]>();
  for (const resource of resources) {
    resourceTermsByCourse.set(resource.courseId, [...(resourceTermsByCourse.get(resource.courseId) ?? []), resource.termNumber]);
  }
  return new Set(courseRows
    .filter((course) => {
      const courseTerms = resourceTermsByCourse.get(course.id);
      const currentTermCourse = courseTerms?.filter((termNumber) => termNumber === currentTerm);
      if (currentTermCourse?.length) return currentTermCourse.some((termNumber) => !removed.has(`${termNumber}:${course.id}`));
      return !courseTerms || courseTerms.some((termNumber) => visibleTerms.has(termNumber) && !removed.has(`${termNumber}:${course.id}`));
    })
    .map((course) => course.id));
}

async function getAnnouncements() {
  return db.select().from(announcementsTable).orderBy(desc(announcementsTable.id));
}

async function getArticles() {
  return db.select().from(articlesTable).orderBy(desc(articlesTable.createdAt), desc(articlesTable.id));
}

async function getDailyBenefits() {
  const rows = await db.select().from(dailyBenefitsTable).orderBy(desc(dailyBenefitsTable.createdAt), desc(dailyBenefitsTable.id));
  const seenDays = new Set<string>();
  return rows.filter((row) => {
    if (seenDays.has(row.dayOfWeek)) return false;
    seenDays.add(row.dayOfWeek);
    return true;
  });
}

router.get("/articles", async (_req, res, next) => {
  try {
    await ensureSeeded();
    res.json(GetArticlesResponse.parse((await getArticles()).map(toArticle)));
  } catch (error) {
    next(error);
  }
});

router.get("/daily-benefit", async (_req, res, next) => {
  try {
    await ensureSeeded();
    const benefits = await getDailyBenefits();
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Riyadh" }).format(new Date()).toLowerCase();
    const benefit = benefits.find((item) => item.dayOfWeek === weekday) ?? benefits[0];
    if (!benefit) {
      res.status(404).json({ error: "Günün faydası tapılmadı." });
      return;
    }
    res.json(GetDailyBenefitResponse.parse(toDailyBenefit(benefit)));
  } catch (error) {
    next(error);
  }
});

router.post("/auth/resolve-student-number", async (req, res, next) => {
  try {
    const rawIdentifier = typeof req.body?.identifier === "string" ? req.body.identifier.trim() : "";
    const digits = rawIdentifier.replace(/^T/i, "");
    if (!/^\d+$/.test(digits)) {
      res.status(400).json({ error: "Tələbə nömrəsi düzgün deyil." });
      return;
    }
    const studentNumber = Number(digits);
    const [student] = await db.select({ email: applicationsTable.email })
      .from(studentAcademicProfilesTable)
      .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
      .where(and(eq(studentAcademicProfilesTable.studentNumber, studentNumber), eq(applicationsTable.status, "approved"), isNull(applicationsTable.deletedAt)))
      .limit(1);
    if (!student?.email) {
      res.status(404).json({ error: "Tələbə nömrəsi tapılmadı." });
      return;
    }
    res.json({ email: student.email });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard", requireApprovedStudent, async (req, res, next) => {
  try {
    await ensureSeeded();
    const studentProfile = await getApprovedStudentProfile(getAuth(req).userId as string);
    const [courseRows, announcementRows, studentApplication] = await Promise.all([
      getCourses(),
      getAnnouncements(),
      db.select().from(applicationsTable).where(eq(applicationsTable.id, studentProfile.applicationId)).limit(1).then(([application]) => application),
    ]);
    const visibleCourseIds = await getStudentVisibleCourseIds(studentProfile, courseRows);
    const courses = courseRows.filter((course) => visibleCourseIds.has(course.id)).map((course) => toCourse(course, true));
    const announcements = announcementRows.map(toAnnouncement);
    const studentName = studentApplication
      ? `${studentApplication.firstName} ${studentApplication.lastName}`.trim()
      : "Tələbə";
    const data = GetDashboardResponse.parse({
      studentName,
      greeting: `Xoş gəldin, ${studentName}`,
      courses,
      announcements,
      nextLesson: courses.find((course) => course.nextLesson)?.title ?? null,
    });
    req.log.info({ courseCount: courses.length }, "Student dashboard loaded");
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/student/deletion-notice", async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." });
      return;
    }
    const [audit] = await db.select().from(studentDeletionAuditTable)
      .where(eq(studentDeletionAuditTable.studentClerkUserId, userId))
      .orderBy(desc(studentDeletionAuditTable.deletedAt))
      .limit(1);
    res.json(GetStudentDeletionNoticeResponse.parse(audit ? {
      studentName: `${audit.studentFirstName} ${audit.studentLastName}`.trim(),
      reason: audit.reason,
      deletedByName: audit.deletedByName,
      deletedAt: audit.deletedAt,
    } : null));
  } catch (error) {
    next(error);
  }
});

router.get("/profile", requireApprovedStudent, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const [application] = await db.select().from(applicationsTable)
      .where(eq(applicationsTable.clerkUserId, userId as string)).limit(1);
    if (!application) {
      res.status(404).json({ error: "Tələbə profili tapılmadı." });
      return;
    }
    const profile = await ensureAcademicProfile(application);
    const activeTerms = await getActiveTermNumbers();
    const currentTerm = currentTermNumber(profile);
    const visibleTerms = activeTerms.filter((termNumber) => termNumber <= currentTerm);
    const visibleThroughTerm = Math.min(currentTerm, Math.max(...activeTerms));
    const displayedCurrentTerm = visibleTerms[visibleTerms.length - 1] ?? Math.min(currentTerm, Math.max(...activeTerms));
    const academicProfile = await buildAcademicProfile(profile, application, visibleThroughTerm);
    res.json(GetStudentAcademicProfileResponse.parse({ ...academicProfile, currentTermNumber: displayedCurrentTerm }));
  } catch (error) {
    next(error);
  }
});

router.get("/student/schedule-access", requireApprovedStudent, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const profile = await getApprovedStudentProfile(userId as string);
    if (!profile) { res.status(404).json({ error: "Tələbə profili tapılmadı." }); return; }
    const access = await scheduleAccessState(profile);
    res.json({
      approved: access.approved,
      onboardingRequired: access.onboardingRequired,
      onboardingExamId: access.onboardingExamId,
      onboardingExamTitle: access.onboardingExamTitle,
    });
  } catch (error) { next(error); }
});

router.get("/teachers", requireApprovedStudent, async (_req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const options = await activeTeachers();
    const teachers = await Promise.all(options.map(async (option) => {
      const user = await getClerkUser(option.clerkUserId);
      return user && roleForClerkUser(user) === "teacher" ? option : null;
    }));
    res.json(GetTeachersResponse.parse(teachers.filter((teacher): teacher is NonNullable<typeof teacher> => Boolean(teacher))));
  } catch (error) { next(error); }
});

async function messageView(message: typeof messagesTable.$inferSelect) {
  const [sender, recipient] = await Promise.all([getClerkUser(message.senderClerkUserId), getClerkUser(message.recipientClerkUserId)]);
  const [application, academicProfile] = await Promise.all([
    db.select({ firstName: applicationsTable.firstName, lastName: applicationsTable.lastName, email: applicationsTable.email, phone: applicationsTable.phone, username: applicationsTable.username })
      .from(applicationsTable).where(eq(applicationsTable.clerkUserId, message.senderClerkUserId)).limit(1),
    db.select({ studentNumber: studentAcademicProfilesTable.studentNumber, program: studentAcademicProfilesTable.program, courseYear: studentAcademicProfilesTable.courseYear, semester: studentAcademicProfilesTable.semester })
      .from(studentAcademicProfilesTable).where(eq(studentAcademicProfilesTable.clerkUserId, message.senderClerkUserId)).limit(1),
  ]);
  const senderName = [sender?.firstName, sender?.lastName].filter(Boolean).join(" ").trim() || `${application[0]?.firstName ?? ""} ${application[0]?.lastName ?? ""}`.trim() || sender?.username || "İstifadəçi";
  return {
    id: message.id,
    senderClerkUserId: message.senderClerkUserId,
    recipientClerkUserId: message.recipientClerkUserId,
    senderName,
    senderEmail: sender?.primaryEmailAddress?.emailAddress ?? application[0]?.email ?? "",
    senderPhone: application[0]?.phone ?? "",
    senderUsername: sender?.username ?? application[0]?.username ?? null,
    senderStudentNumber: academicProfile[0]?.studentNumber ?? null,
    senderProgram: academicProfile[0]?.program ?? null,
    senderCourseYear: academicProfile[0]?.courseYear ?? null,
    senderSemester: academicProfile[0]?.semester ?? null,
    recipientName: [recipient?.firstName, recipient?.lastName].filter(Boolean).join(" ").trim() || recipient?.username || "İstifadəçi",
    subject: message.subject,
    body: message.body,
    parentMessageId: message.parentMessageId,
    readAt: message.readAt,
    createdAt: message.createdAt,
  };
}

async function questionView(question: typeof questionsTable.$inferSelect) {
  return {
    id: question.id,
    title: question.title,
    body: question.body,
    answer: question.answer,
    answeredByName: question.answeredByName,
    answeredAt: question.answeredAt,
    createdAt: question.createdAt,
  };
}

router.get("/questions", async (_req, res, next) => {
  try {
    const rows = await db.select().from(questionsTable).orderBy(desc(questionsTable.createdAt));
    res.json(await Promise.all(rows.map(questionView)));
  } catch (error) { next(error); }
});

router.post("/questions", requireApprovedStudent, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!title || !body) { res.status(400).json({ error: "Sual başlığı və sual mətni tələb olunur." }); return; }
    if (title.length > 160 || body.length > 5000) { res.status(400).json({ error: "Sual başlığı 160, sual mətni isə 5000 simvoldan uzun ola bilməz." }); return; }
    const [created] = await db.insert(questionsTable).values({ authorClerkUserId: userId as string, title, body, createdAt: new Date().toISOString() }).returning();
    if (created) await recordAuditEvent({
      eventType: "question.created",
      actorClerkUserId: userId as string,
      targetType: "question",
      targetId: created.id,
      details: { title },
      deduplicationKey: `question.created:${created.id}`,
    });
    res.status(201).json(await questionView(created));
  } catch (error) { next(error); }
});

router.post("/questions/:id/answer", requireTeacher, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const answer = typeof req.body?.answer === "string" ? req.body.answer.trim() : "";
    const id = Number(req.params.id);
    if (!answer) { res.status(400).json({ error: "Cavab mətni boş ola bilməz." }); return; }
    const clerkUser = await getClerkUser(userId as string);
    if (!clerkUser) { res.status(404).json({ error: "Müəllim hesabı tapılmadı." }); return; }
    const display = ownerDisplayNameParts(clerkUser);
    const [updated] = await db.update(questionsTable).set({ answer, answeredByClerkUserId: userId as string, answeredByName: `${display.firstName} ${display.lastName}`.trim() || clerkUser.username || "Müəllim", answeredAt: new Date().toISOString() }).where(eq(questionsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Sual tapılmadı." }); return; }
    res.json(await questionView(updated));
  } catch (error) { next(error); }
});

router.get("/messages", requireAuth, async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { userId } = getAuth(req);
    const rows = await db.select().from(messagesTable)
      .where(and(or(eq(messagesTable.senderClerkUserId, userId as string), eq(messagesTable.recipientClerkUserId, userId as string)), isNull(messagesTable.deletedAt)))
      .orderBy(desc(messagesTable.createdAt));
    res.json(GetMessagesResponse.parse(await Promise.all(rows.map(messageView))));
  } catch (error) { next(error); }
});

router.get("/messages/unread-count", requireAuth, async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { userId } = getAuth(req);
    const rows = await db.select({ id: messagesTable.id }).from(messagesTable)
      .where(and(eq(messagesTable.recipientClerkUserId, userId as string), isNull(messagesTable.readAt), isNull(messagesTable.deletedAt)));
    res.json({ count: rows.length });
  } catch (error) { next(error); }
});

router.post("/messages", requireApprovedStudent, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const parsedInput = CreateMessageBody.safeParse(req.body);
    if (!parsedInput.success) { res.status(400).json({ error: "Müəllim və mesaj mətni düzgün daxil edilməlidir." }); return; }
    const recipientClerkUserId = parsedInput.data.recipientClerkUserId.trim();
    const body = parsedInput.data.body.trim();
    if (!recipientClerkUserId || !body) { res.status(400).json({ error: "Müəllim və mesaj mətni tələb olunur." }); return; }
    const recipient = await getClerkUser(recipientClerkUserId);
    if (!recipient || roleForClerkUser(recipient) !== "teacher") { res.status(404).json({ error: "Müəllim tapılmadı." }); return; }
    const [created] = await db.insert(messagesTable).values({ senderClerkUserId: userId as string, recipientClerkUserId, subject: parsedInput.data.subject?.trim() || "Məsləhətləşmə", body, createdAt: new Date().toISOString() }).returning();
    if (created) await recordAuditEvent({
      eventType: "message.created",
      actorClerkUserId: userId as string,
      targetType: "message",
      targetId: created.id,
      details: { recipientClerkUserId, subject: created.subject },
      deduplicationKey: `message.created:${created.id}`,
    });
    res.status(201).json(CreateMessageResponse.parse(await messageView(created)));
  } catch (error) { next(error); }
});

router.patch("/messages/:id", requireApprovedStudent, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const parsedParams = UpdateMessageParams.safeParse(req.params);
    const parsedInput = UpdateMessageBody.safeParse(req.body);
    if (!parsedParams.success || !parsedInput.success) { res.status(400).json({ error: "Mesaj məlumatları düzgün daxil edilməyib." }); return; }
    const id = parsedParams.data.id;
    const body = parsedInput.data.body.trim();
    if (!body) { res.status(400).json({ error: "Mesaj mətni boş ola bilməz." }); return; }
    const [message] = await db.select().from(messagesTable).where(and(
      eq(messagesTable.id, id),
      eq(messagesTable.senderClerkUserId, userId as string),
      isNull(messagesTable.parentMessageId),
      isNull(messagesTable.deletedAt),
    )).limit(1);
    if (!message) { res.status(404).json({ error: "Redaktə ediləcək mesaj tapılmadı." }); return; }
    const [updated] = await db.update(messagesTable).set({ body }).where(eq(messagesTable.id, id)).returning();
    res.json(UpdateMessageResponse.parse(await messageView(updated)));
  } catch (error) { next(error); }
});

router.patch("/messages/:id/read", requireAuth, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const parsedParams = MarkMessageReadParams.safeParse(req.params);
    if (!parsedParams.success) { res.status(400).json({ error: "Mesaj ID-si düzgün deyil." }); return; }
    const id = parsedParams.data.id;
    const [message] = await db.select().from(messagesTable).where(and(eq(messagesTable.id, id), eq(messagesTable.recipientClerkUserId, userId as string), isNull(messagesTable.deletedAt))).limit(1);
    if (!message) { res.status(404).json({ error: "Mesaj tapılmadı." }); return; }
    const [updated] = await db.update(messagesTable).set({ readAt: message.readAt ?? new Date().toISOString() }).where(eq(messagesTable.id, id)).returning();
    res.json(MarkMessageReadResponse.parse(await messageView(updated)));
  } catch (error) { next(error); }
});

router.post("/messages/:id/reply", requireTeacher, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const parsedParams = ReplyToMessageParams.safeParse(req.params);
    const parsedInput = ReplyToMessageBody.safeParse(req.body);
    if (!parsedParams.success || !parsedInput.success) { res.status(400).json({ error: "Cavab məlumatları düzgün daxil edilməyib." }); return; }
    const id = parsedParams.data.id;
    const body = parsedInput.data.body.trim();
    if (!body) { res.status(400).json({ error: "Cavab mətni boş ola bilməz." }); return; }
    const [original] = await db.select().from(messagesTable).where(and(eq(messagesTable.id, id), eq(messagesTable.recipientClerkUserId, userId as string), isNull(messagesTable.parentMessageId), isNull(messagesTable.deletedAt))).limit(1);
    if (!original) { res.status(404).json({ error: "Mesaj tapılmadı." }); return; }
    const recipientClerkUserId = original.senderClerkUserId === userId ? original.recipientClerkUserId : original.senderClerkUserId;
    if (!(await getApprovedStudentProfile(recipientClerkUserId))) {
      res.status(403).json({ error: "Yalnız təsdiqlənmiş tələbə ilə yazışmaya cavab vermək olar." });
      return;
    }
    const [created] = await db.insert(messagesTable).values({ senderClerkUserId: userId as string, recipientClerkUserId, subject: original.subject, body, parentMessageId: original.id, createdAt: new Date().toISOString() }).returning();
    if (created) await recordAuditEvent({
      eventType: "message.reply.created",
      actorClerkUserId: userId as string,
      targetType: "message",
      targetId: created.id,
      details: { recipientClerkUserId, parentMessageId: original.id },
      deduplicationKey: `message.created:${created.id}`,
    });
    res.status(201).json(ReplyToMessageResponse.parse(await messageView(created)));
  } catch (error) { next(error); }
});

router.delete("/messages/:id", requireTeacher, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const parsedParams = DeleteMessageParams.safeParse(req.params);
    if (!parsedParams.success) { res.status(400).json({ error: "Mesaj ID-si düzgün deyil." }); return; }
    const id = parsedParams.data.id;
    const [message] = await db.select().from(messagesTable).where(and(eq(messagesTable.id, id), eq(messagesTable.recipientClerkUserId, userId as string), isNull(messagesTable.parentMessageId), isNull(messagesTable.deletedAt))).limit(1);
    if (!message) { res.status(404).json({ error: "Mesaj tapılmadı." }); return; }
    const deletedAt = new Date().toISOString();
    await db.update(messagesTable).set({ deletedAt }).where(or(eq(messagesTable.id, id), eq(messagesTable.parentMessageId, id)));
    res.status(204).send();
  } catch (error) { next(error); }
});

router.get("/account/profile", async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." }); return; }
    if (await accountIsDeleted(userId)) { res.status(403).json({ error: "Hesabınız deaktiv edilib. Profil məlumatlarına giriş mümkün deyil." }); return; }
    const clerkUser = await getClerkUser(userId);
    if (!clerkUser) { res.status(404).json({ error: "İstifadəçi tapılmadı." }); return; }
    const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.clerkUserId, userId)).limit(1);
    const role = roleForClerkUser(clerkUser);
    const rolePermissions = role === "owner"
      ? [...rolePermissionKeys]
      : role === "admin" || role === "teacher" || role === "supervisor" || role === "owner_assistant"
        ? await permissionsForClerkUser(clerkUser, role)
          : [];
    res.json(GetAdminUserProfileResponse.parse({
      id: userId,
      firstName: clerkUser.firstName || application?.firstName || "",
      lastName: clerkUser.lastName || application?.lastName || "",
      username: clerkUser.username || application?.username || null,
      email: clerkUser.primaryEmailAddress?.emailAddress || application?.email || "",
      phone: application?.phone ?? "",
      birthDate: application?.birthDate ?? "",
      arabicLevel: application?.arabicLevel ?? "Orta",
      role,
      rolePermissions,
    }));
  } catch (error) { next(error); }
});

router.patch("/account/profile", async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." }); return; }
    if (await accountIsDeleted(userId)) { res.status(403).json({ error: "Hesabınız deaktiv edilib. Profil məlumatları dəyişdirilə bilməz." }); return; }
    const input = UpdateAdminUserProfileBody.parse(req.body);
    const clerkUser = await getClerkUser(userId);
    if (!clerkUser) { res.status(404).json({ error: "İstifadəçi tapılmadı." }); return; }
    const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.clerkUserId, userId)).limit(1);
    const previousProfile = userProfileSnapshot(clerkUser, application);
    const updatedClerkUser = await clerkClient.users.updateUser(userId, {
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username || undefined,
    });
    const currentEmail = normalizedEmail(clerkUser.primaryEmailAddress?.emailAddress);
    let finalClerkUser = updatedClerkUser;
    if (currentEmail !== normalizedEmail(input.email)) {
      const emailAddress = await clerkClient.emailAddresses.createEmailAddress({ userId, emailAddress: input.email });
      finalClerkUser = await clerkClient.users.updateUser(userId, { primaryEmailAddressID: emailAddress.id });
    }
    if (application) {
      await db.update(applicationsTable).set({
        firstName: input.firstName, lastName: input.lastName, username: input.username || "",
        email: input.email, phone: input.phone, birthDate: input.birthDate, arabicLevel: input.arabicLevel,
      }).where(eq(applicationsTable.id, application.id));
    }
    const updatedProfile = {
      firstName: finalClerkUser.firstName ?? input.firstName,
      lastName: finalClerkUser.lastName ?? input.lastName,
      username: finalClerkUser.username ?? input.username,
      email: finalClerkUser.primaryEmailAddress?.emailAddress ?? input.email,
      phone: input.phone,
      birthDate: input.birthDate,
      arabicLevel: input.arabicLevel,
    } satisfies UserProfileSnapshot;
    const profileDiff = userProfileDiff(previousProfile, updatedProfile);
    if (profileDiff.changedFields.length) await recordAuditEvent({
      eventType: "user.profile.updated",
      actorClerkUserId: userId,
      targetType: "user",
      targetId: userId,
      details: profileDiff,
      deduplicationKey: `user.profile.updated:${userId}:${finalClerkUser.updatedAt ?? Date.now()}`,
    });
    res.json(UpdateAdminUserProfileResponse.parse({
      id: userId, firstName: finalClerkUser.firstName ?? input.firstName, lastName: finalClerkUser.lastName ?? input.lastName,
      username: finalClerkUser.username ?? input.username, email: finalClerkUser.primaryEmailAddress?.emailAddress ?? input.email,
      phone: input.phone, birthDate: input.birthDate, arabicLevel: input.arabicLevel, role: roleForClerkUser(finalClerkUser),
    }));
  } catch (error) { next(error); }
});

router.get("/attendance-excuses", requireApprovedStudent, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.clerkUserId, userId as string)).limit(1);
    if (!application) { res.status(404).json({ error: "Tələbə profili tapılmadı." }); return; }
    const profile = await ensureAcademicProfile(application);
    const [excuses, records, courses] = await Promise.all([
      db.select().from(attendanceExcusesTable).where(eq(attendanceExcusesTable.profileId, profile.id)).orderBy(desc(attendanceExcusesTable.createdAt)),
      db.select().from(studentAttendanceRecordsTable).where(eq(studentAttendanceRecordsTable.profileId, profile.id)),
      getCourses(),
    ]);
    const recordMap = new Map(records.map((record) => [record.id, record]));
    const courseMap = new Map(courses.map((course) => [course.id, course]));
    res.json(GetAdminAttendanceExcusesResponse.parse(excuses.map((excuse) => {
      const record = recordMap.get(excuse.attendanceRecordId);
      return { id: excuse.id, attendanceRecordId: excuse.attendanceRecordId, profileId: excuse.profileId, studentName: `${application.firstName} ${application.lastName}`, courseId: excuse.courseId, courseTitle: courseMap.get(excuse.courseId)?.title ?? "Naməlum fənn", attendanceDate: record?.attendanceDate ?? "", teacherName: record?.teacherName ?? "Naməlum müəllim", reason: excuse.reason, status: excuse.status, createdAt: excuse.createdAt };
    })));
  } catch (error) { next(error); }
});

router.get("/semester-subject-removal-requests", requireApprovedStudent, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.clerkUserId, userId as string)).limit(1);
    if (!application) { res.status(404).json({ error: "Tələbə profili tapılmadı." }); return; }
    const profile = await ensureAcademicProfile(application);
    const requests = await db.select().from(subjectRemovalRequestsTable).where(eq(subjectRemovalRequestsTable.profileId, profile.id)).orderBy(desc(subjectRemovalRequestsTable.createdAt));
    res.json(GetStudentSubjectRemovalRequestsResponse.parse(await Promise.all(requests.map(subjectRequestView))));
  } catch (error) { next(error); }
});

router.post("/semester-subject-removal-requests", requireApprovedStudent, async (req, res, next) => {
  try {
    const courseId = Number(req.body?.courseId);
    const termNumber = Number(req.body?.termNumber);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!Number.isInteger(courseId) || !Number.isInteger(termNumber) || termNumber < 1 || termNumber > 8 || reason.length < 3 || reason.length > 1000) { res.status(400).json({ error: "Fənn, semestr və ən azı 3 simvolluq səbəb yazılmalıdır." }); return; }
    const { userId } = getAuth(req);
    const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.clerkUserId, userId as string)).limit(1);
    if (!application) { res.status(404).json({ error: "Tələbə profili tapılmadı." }); return; }
    const profile = await ensureAcademicProfile(application);
    const [resource] = await db.select().from(resourcesTable).where(and(eq(resourcesTable.courseId, courseId), eq(resourcesTable.termNumber, termNumber))).limit(1);
    if (!resource) { res.status(404).json({ error: "Bu semestr üçün fənn tapılmadı." }); return; }
    if (resource.isMandatory !== true) { res.status(400).json({ error: "İxtiyari fənni müraciətsiz silə bilərsiniz." }); return; }
    const [existing] = await db.select().from(subjectRemovalRequestsTable).where(and(eq(subjectRemovalRequestsTable.profileId, profile.id), eq(subjectRemovalRequestsTable.courseId, courseId), eq(subjectRemovalRequestsTable.termNumber, termNumber), eq(subjectRemovalRequestsTable.status, "pending"))).limit(1);
    if (existing) { res.status(409).json({ error: "Bu fənn üçün artıq gözləmədə müraciət var." }); return; }
    const [created] = await db.insert(subjectRemovalRequestsTable).values({ profileId: profile.id, courseId, termNumber, reason, createdAt: new Date().toISOString() }).returning();
    res.status(201).json(CreateStudentSubjectRemovalRequestResponse.parse(await subjectRequestView(created)));
  } catch (error) { next(error); }
});

router.delete("/semester-subjects/:courseId/:termNumber", requireApprovedStudent, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId); const termNumber = Number(req.params.termNumber);
    if (!Number.isInteger(courseId) || !Number.isInteger(termNumber) || termNumber < 1 || termNumber > 8) { res.status(400).json({ error: "Fənn və semestr düzgün seçilməyib." }); return; }
    const { userId } = getAuth(req);
    const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.clerkUserId, userId as string)).limit(1);
    if (!application) { res.status(404).json({ error: "Tələbə profili tapılmadı." }); return; }
    const profile = await ensureAcademicProfile(application);
    const [resource] = await db.select().from(resourcesTable).where(and(eq(resourcesTable.courseId, courseId), eq(resourcesTable.termNumber, termNumber))).limit(1);
    if (!resource) { res.status(404).json({ error: "Bu semestr üçün fənn tapılmadı." }); return; }
    if (resource.isMandatory) { res.status(400).json({ error: "İcbari fənn üçün müraciət göndərilməlidir." }); return; }
    await db.insert(studentCourseSelectionsTable).values({ profileId: profile.id, courseId, termNumber, selected: false, updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: [studentCourseSelectionsTable.profileId, studentCourseSelectionsTable.courseId, studentCourseSelectionsTable.termNumber], set: { selected: false, updatedAt: new Date().toISOString() } });
    res.status(204).send();
  } catch (error) { next(error); }
});

router.post("/attendance-excuses", requireApprovedStudent, async (req, res, next) => {
  try {
    const input = CreateAttendanceExcuseBody.parse(req.body);
    const { userId } = getAuth(req);
    const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.clerkUserId, userId as string)).limit(1);
    if (!application) {
      res.status(404).json({ error: "Tələbə profili tapılmadı." });
      return;
    }
    const profile = await ensureAcademicProfile(application);
    const [record] = await db.select().from(studentAttendanceRecordsTable)
      .where(and(eq(studentAttendanceRecordsTable.id, input.attendanceRecordId), eq(studentAttendanceRecordsTable.profileId, profile.id), eq(studentAttendanceRecordsTable.status, "absent"))).limit(1);
    if (!record) {
      res.status(404).json({ error: "Üzr bildirmək üçün uyğun qayıb qeydi tapılmadı." });
      return;
    }
    const [existing] = await db.select().from(attendanceExcusesTable).where(eq(attendanceExcusesTable.attendanceRecordId, record.id)).limit(1);
    if (existing) {
      res.status(409).json({ error: "Bu qayıb üçün artıq üzr göndərilib." });
      return;
    }
    const [excuse] = await db.insert(attendanceExcusesTable).values({
      attendanceRecordId: record.id, profileId: profile.id, courseId: record.courseId, termNumber: record.termNumber,
      reason: input.reason.trim(), createdAt: new Date().toISOString(),
    }).returning();
    res.status(201).json({ id: excuse.id, attendanceRecordId: excuse.attendanceRecordId, profileId: excuse.profileId, studentName: `${application.firstName} ${application.lastName}`, courseId: excuse.courseId, courseTitle: (await db.select().from(coursesTable).where(eq(coursesTable.id, excuse.courseId)).limit(1))[0]?.title ?? "Naməlum fənn", attendanceDate: record.attendanceDate, teacherName: record.teacherName, reason: excuse.reason, status: excuse.status, createdAt: excuse.createdAt });
  } catch (error) { next(error); }
});

router.get("/admin/attendance-excuses", requireTeacher, async (_req, res, next) => {
  try {
    const [excuses, records, profiles, applications, courses] = await Promise.all([
      db.select().from(attendanceExcusesTable).orderBy(desc(attendanceExcusesTable.createdAt)),
      db.select().from(studentAttendanceRecordsTable),
      db.select().from(studentAcademicProfilesTable),
      db.select().from(applicationsTable),
      getCourses(),
    ]);
    const recordMap = new Map(records.map((record) => [record.id, record]));
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const applicationMap = new Map(applications.map((application) => [application.id, application]));
    const courseMap = new Map(courses.map((course) => [course.id, course]));
    res.json(GetAdminAttendanceExcusesResponse.parse(excuses.map((excuse) => {
      const record = recordMap.get(excuse.attendanceRecordId);
      const profile = profileMap.get(excuse.profileId);
      const application = profile ? applicationMap.get(profile.applicationId) : undefined;
      return { id: excuse.id, attendanceRecordId: excuse.attendanceRecordId, profileId: excuse.profileId, studentName: application ? `${application.firstName} ${application.lastName}` : "Tələbə", courseId: excuse.courseId, courseTitle: courseMap.get(excuse.courseId)?.title ?? "Naməlum fənn", attendanceDate: record?.attendanceDate ?? "", teacherName: record?.teacherName ?? "Naməlum müəllim", reason: excuse.reason, status: excuse.status, createdAt: excuse.createdAt };
    })));
  } catch (error) { next(error); }
});

router.get("/admin/semester-subject-removal-requests", requireTeacher, async (_req, res, next) => {
  try {
    const requests = await db.select().from(subjectRemovalRequestsTable).orderBy(desc(subjectRemovalRequestsTable.createdAt));
    res.json(GetAdminSubjectRemovalRequestsResponse.parse(await Promise.all(requests.map(subjectRequestView))));
  } catch (error) { next(error); }
});

router.patch("/admin/semester-subject-removal-requests/:requestId", requireTeacher, async (req, res, next) => {
  try {
    const requestId = Number(req.params.requestId);
    const parsedDecision = DecideSubjectRemovalRequestBody.safeParse(req.body);
    if (!Number.isInteger(requestId) || !parsedDecision.success) { res.status(400).json({ error: "Qərar düzgün seçilməyib." }); return; }
    const decision = parsedDecision.data.decision;
    const rejectionReason = typeof parsedDecision.data.rejectionReason === "string" ? parsedDecision.data.rejectionReason.trim() : "";
    if (decision === "rejected" && (rejectionReason.length < 3 || rejectionReason.length > 1000)) {
      res.status(400).json({ error: "Rədd səbəbi ən azı 3 simvol olmalıdır." });
      return;
    }
    const [request] = await db.update(subjectRemovalRequestsTable).set({
      status: decision,
      rejectionReason: decision === "rejected" ? rejectionReason : null,
      reviewedAt: new Date().toISOString(),
    }).where(and(eq(subjectRemovalRequestsTable.id, requestId), eq(subjectRemovalRequestsTable.status, "pending"))).returning();
    if (!request) { res.status(404).json({ error: "Gözləmədə olan müraciət tapılmadı." }); return; }
    if (decision === "approved") {
      await db.insert(studentCourseSelectionsTable).values({ profileId: request.profileId, courseId: request.courseId, termNumber: request.termNumber, selected: false, updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: [studentCourseSelectionsTable.profileId, studentCourseSelectionsTable.courseId, studentCourseSelectionsTable.termNumber], set: { selected: false, updatedAt: new Date().toISOString() } });
    }
    const view = await subjectRequestView(request);
    const [studentProfile] = await db.select({ applicationId: studentAcademicProfilesTable.applicationId })
      .from(studentAcademicProfilesTable)
      .where(eq(studentAcademicProfilesTable.id, request.profileId))
      .limit(1);
    const [studentApplication] = studentProfile
      ? await db.select({
          email: applicationsTable.email,
          firstName: applicationsTable.firstName,
          lastName: applicationsTable.lastName,
        }).from(applicationsTable).where(eq(applicationsTable.id, studentProfile.applicationId)).limit(1)
      : [];
    if (studentApplication?.email) {
      void sendSubjectRemovalDecisionEmail({
        to: studentApplication.email,
        studentName: `${studentApplication.firstName} ${studentApplication.lastName}`.trim() || "Tələbə",
        courseTitle: view.courseTitle,
        termNumber: request.termNumber,
        approved: decision === "approved",
        rejectionReason: request.rejectionReason ?? undefined,
      }).catch(() => undefined);
    }
    res.json(DecideSubjectRemovalRequestResponse.parse(view));
  } catch (error) { next(error); }
});

router.delete("/admin/attendance-excuses/:excuseId", requireTeacher, async (req, res, next) => {
  try {
    const excuseId = Number(req.params.excuseId);
    if (!Number.isInteger(excuseId) || excuseId <= 0) { res.status(400).json({ error: "Üzr müraciəti düzgün seçilməyib." }); return; }
    const deleted = await db.delete(attendanceExcusesTable).where(eq(attendanceExcusesTable.id, excuseId)).returning({ id: attendanceExcusesTable.id });
    if (!deleted.length) { res.status(404).json({ error: "Üzr müraciəti tapılmadı." }); return; }
    res.status(204).send();
  } catch (error) { next(error); }
});

router.delete("/admin/attendance-records/:recordId", requireTeacher, async (req, res, next) => {
  try {
    const recordId = Number(req.params.recordId);
    if (!Number.isInteger(recordId) || recordId <= 0) { res.status(400).json({ error: "Qayıb qeydi düzgün seçilməyib." }); return; }
    const deleted = await db.delete(studentAttendanceRecordsTable).where(eq(studentAttendanceRecordsTable.id, recordId)).returning({ id: studentAttendanceRecordsTable.id });
    if (!deleted.length) { res.status(404).json({ error: "Qayıb qeydi tapılmadı." }); return; }
    await db.delete(attendanceExcusesTable).where(eq(attendanceExcusesTable.attendanceRecordId, recordId));
    res.status(204).send();
  } catch (error) { next(error); }
});

router.get("/courses", requireApprovedStudentOrTeacher, async (_req, res, next) => {
  try {
    await ensureSeeded();
    const { userId } = getAuth(_req);
    const isTeacher = userId ? await userHasTeacherAccess(userId) : false;
    const courseRows = await getCourses();
    const visibleCourseIds = !isTeacher && userId
      ? await getStudentVisibleCourseIds(await getApprovedStudentProfile(userId), courseRows)
      : null;
    const courses = visibleCourseIds ? courseRows.filter((course) => visibleCourseIds.has(course.id)) : courseRows;
    res.json(GetCoursesResponse.parse(courses.map((course) => toCourse(course, !isTeacher))));
  } catch (error) {
    next(error);
  }
});

router.get("/courses/:courseId", requireApprovedStudent, async (req, res, next) => {
  try {
    await ensureSeeded();
    const { userId } = getAuth(req);
    const studentProfile = userId ? await getApprovedStudentProfile(userId) : null;
    const courseId = Number(req.params.courseId);
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
    if (!course) {
      res.status(404).json({ error: "Fənn tapılmadı" });
      return;
    }
    const resources = await db.select().from(resourcesTable)
      .where(eq(resourcesTable.courseId, courseId))
      .orderBy(asc(resourcesTable.id));
    const activeTerms = await getActiveTermNumbers();
    const visibleCourseIds = studentProfile
      ? await getStudentVisibleCourseIds(studentProfile, [course])
      : null;
    if (studentProfile && !visibleCourseIds?.has(courseId)) {
      res.status(403).json({ error: "Bu dərs hazırda aktiv deyil." });
      return;
    }
    const visibleResources = studentProfile
      ? resources.filter((resource) => resource.termNumber === currentTermNumber(studentProfile) &&
        activeTerms.includes(resource.termNumber) && !resourceLinkIsExpired(resource))
      : resources;
    res.json(GetCourseResponse.parse({
      ...toCourse(course, true),
      description: course.description,
      curriculum: course.curriculum,
      lessonDescription: course.lessonDescription,
       resources: await resourceViews(visibleResources),
    }));
  } catch (error) {
    next(error);
  }
});

router.get("/courses/:courseId/pdf", requireApprovedStudentOrTeacher, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId)) {
      res.status(404).json({ error: "Fayl tapılmadı." });
      return;
    }
    const { userId } = getAuth(req);
    const isTeacher = userId ? await userHasTeacherAccess(userId) : false;
    const studentProfile = !isTeacher && userId ? await getApprovedStudentProfile(userId) : null;
    const [course] = await db.select({ title: coursesTable.title, pdfUrl: coursesTable.pdfUrl })
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .limit(1);
    if (!course?.pdfUrl?.startsWith("/objects/courses/")) {
      res.status(404).json({ error: "Bu dərs üçün PDF əlavə edilməyib." });
      return;
    }
    if (studentProfile) {
      const activeTerms = await getActiveTermNumbers();
      const access = await scheduleAccessState(studentProfile);
      const visibleResource = await db.select({ id: resourcesTable.id }).from(resourcesTable)
        .where(and(
          eq(resourcesTable.courseId, courseId),
          inArray(resourcesTable.termNumber, activeTerms.filter((termNumber) => termNumber <= currentTermNumber(studentProfile))),
          or(isNull(resourcesTable.expiresAt), gt(resourcesTable.expiresAt, new Date())),
        ))
        .limit(1);
      if (!access.approved || !visibleResource.length) {
        res.status(403).json({ error: "Bu dərs hazırda aktiv deyil." });
        return;
      }
    }
    const file = await getCourseFile(course.pdfUrl);
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", "application/pdf");
    const disposition = req.query.download === "1" ? "attachment" : "inline";
    res.setHeader("Content-Disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(`${course.title}.pdf`)}`);
    res.setHeader("Content-Length", String(metadata.size ?? ""));
    file.createReadStream().on("error", next).pipe(res);
  } catch (error) {
    next(error);
  }
});

router.get("/resources/:resourceId/file", requireApprovedStudentOrTeacher, async (req, res, next) => {
  try {
    const resourceId = Number(req.params.resourceId);
    if (!Number.isInteger(resourceId) || resourceId <= 0) {
      res.status(404).json({ error: "Fayl tapılmadı." });
      return;
    }
    const [resource] = await db.select({ title: resourcesTable.title, url: resourcesTable.url, expiresAt: resourcesTable.expiresAt })
      .from(resourcesTable).where(eq(resourcesTable.id, resourceId)).limit(1);
    if (!resource?.url?.startsWith("/objects/courses/")) {
      res.status(404).json({ error: "Bu resurs üçün PDF əlavə edilməyib." });
      return;
    }
    const userId = getAuth(req).userId;
    if (!userId || !(await userHasTeacherAccess(userId))) {
      const studentProfile = userId ? await getApprovedStudentProfile(userId) : null;
      const activeTerms = await getActiveTermNumbers();
      const [resourceRow] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, resourceId)).limit(1);
      const access = studentProfile ? await scheduleAccessState(studentProfile) : null;
      if (!studentProfile || !resourceRow ||
        !access?.approved ||
        resourceRow.termNumber > currentTermNumber(studentProfile) ||
        !activeTerms.includes(resourceRow.termNumber) ||
        resourceLinkIsExpired(resourceRow) ||
        !(await studentMayAttendResource(studentProfile.id, resourceRow))) {
        res.status(403).json({ error: "Bu dərs materialına giriş icazəniz yoxdur." });
        return;
      }
    }
    const file = await getCourseFile(resource.url);
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", "application/pdf");
    const disposition = req.query.download === "1" ? "attachment" : "inline";
    res.setHeader("Content-Disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(`${resource.title}.pdf`)}`);
    res.setHeader("Content-Length", String(metadata.size ?? ""));
    file.createReadStream().on("error", next).pipe(res);
  } catch (error) {
    next(error);
  }
});

router.get("/announcements", async (_req, res, next) => {
  try {
    await ensureSeeded();
    res.json(GetAnnouncementsResponse.parse((await getAnnouncements()).map(toAnnouncement)));
  } catch (error) {
    next(error);
  }
});

router.get("/assignment-attachments/:attachmentId", requireAuth, async (req, res, next) => {
  try {
    const { attachmentId } = GetAssignmentAttachmentParams.parse(req.params);
    const [attachment] = await db.select().from(assignmentAttachmentsTable)
      .where(eq(assignmentAttachmentsTable.id, attachmentId)).limit(1);
    const [assignment] = attachment
      ? await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, attachment.assignmentId)).limit(1)
      : [];
    const userId = getAuth(req).userId;
    if (!attachment || !assignment || !userId) {
      res.status(404).json({ error: "Fayl tapılmadı." });
      return;
    }
    const isTeacher = await userHasTeacherAccess(userId);
    let allowed = isTeacher && await canManageAssignment(userId, assignment);
    if (!allowed) {
      const profile = await getApprovedStudentProfile(userId).catch(() => null);
      const resource = await assignmentResource(assignment);
      const activeTerms = profile ? await getActiveTermNumbers() : [];
      if (profile && resource && activeTerms.includes(assignment.termNumber) && assignment.termNumber <= currentTermNumber(profile)) {
        allowed = await studentMayAttendResource(profile.id, resource);
        if (allowed && attachment.submissionId) {
          const [submission] = await db.select({ profileId: assignmentSubmissionsTable.profileId })
            .from(assignmentSubmissionsTable).where(eq(assignmentSubmissionsTable.id, attachment.submissionId)).limit(1);
          allowed = submission?.profileId === profile.id;
        }
      }
    }
    if (!allowed) {
      res.status(403).json({ error: "Bu fayla giriş icazəniz yoxdur." });
      return;
    }
    const file = await getAssignmentFile(attachment.objectPath);
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", attachment.contentType);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`);
    res.setHeader("Content-Length", String(metadata.size ?? attachment.size));
    file.createReadStream().on("error", next).pipe(res);
  } catch (error) { next(error); }
});

router.get("/student/notifications", requireApprovedStudent, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const profile = userId ? await getApprovedStudentProfile(userId) : null;
    if (!profile) { res.status(403).json({ error: "Tələbə profili tapılmadı." }); return; }
    const termNumber = currentTermNumber(profile);
    const [notifications, dismissals] = await Promise.all([
      db.select().from(studentNotificationsTable).orderBy(desc(studentNotificationsTable.id)),
      db.select({ notificationId: studentNotificationDismissalsTable.notificationId }).from(studentNotificationDismissalsTable).where(eq(studentNotificationDismissalsTable.profileId, profile.id)),
    ]);
    const dismissed = new Set(dismissals.map((item) => item.notificationId));
    res.json(notifications.filter((notification) => notification.destination !== "gmail" && (notification.targetProfileIds.includes(profile.id) || (!notification.targetProfileIds.length && notification.targetTerms.includes(termNumber))) && !dismissed.has(notification.id)).slice(0, 5));
  } catch (error) { next(error); }
});

router.post("/student/notifications/:notificationId/dismiss", requireApprovedStudent, async (req, res, next) => {
  try {
    const notificationId = Number(req.params.notificationId);
    const { userId } = getAuth(req);
    const profile = userId ? await getApprovedStudentProfile(userId) : null;
    if (!Number.isInteger(notificationId) || notificationId <= 0 || !profile) { res.status(400).json({ error: "Bildiriş məlumatı düzgün deyil." }); return; }
    const [notification] = await db.select({ id: studentNotificationsTable.id }).from(studentNotificationsTable).where(eq(studentNotificationsTable.id, notificationId)).limit(1);
    if (!notification) { res.status(404).json({ error: "Bildiriş tapılmadı." }); return; }
    await db.insert(studentNotificationDismissalsTable).values({ notificationId, profileId: profile.id, dismissedAt: new Date().toISOString() }).onConflictDoNothing();
    res.status(204).send();
  } catch (error) { next(error); }
});

router.get("/resources", requireApprovedStudent, async (req, res, next) => {
  try {
    const termNumber = Number(req.query.termNumber);
    if (!Number.isInteger(termNumber) || termNumber < 1 || termNumber > 8) {
      res.status(400).json({ error: "Semestr 1 ilə 8 arasında olmalıdır." });
      return;
    }
    const { userId } = getAuth(req);
    const studentProfile = userId ? await getApprovedStudentProfile(userId) : null;
    const activeTerms = await getActiveTermNumbers();
    const access = studentProfile ? await scheduleAccessState(studentProfile) : null;
    if (!studentProfile || !access?.approved || termNumber > currentTermNumber(studentProfile) || !activeTerms.includes(termNumber)) {
      res.status(403).json({ error: "Bu semestr hələ aktiv deyil. Müəllim təsdiqindən sonra açılacaq." });
      return;
    }
    await ensureSeeded();
    const resources = await db.select().from(resourcesTable)
      .where(eq(resourcesTable.termNumber, termNumber))
      .orderBy(asc(resourcesTable.id));
    const selections = await db.select({ courseId: studentCourseSelectionsTable.courseId, selected: studentCourseSelectionsTable.selected })
      .from(studentCourseSelectionsTable)
      .where(and(eq(studentCourseSelectionsTable.profileId, studentProfile.id), eq(studentCourseSelectionsTable.termNumber, termNumber)));
    const removedCourseIds = new Set(selections.filter((selection) => !selection.selected).map((selection) => selection.courseId));
    res.json(GetResourcesResponse.parse(await resourceViews(resources.filter((resource) =>
      !removedCourseIds.has(resource.courseId) && !resourceLinkIsExpired(resource)))));
  } catch (error) {
    next(error);
  }
});

router.get("/assignments", requireApprovedStudent, async (req, res, next) => {
  try {
    const { termNumber } = GetStudentAssignmentsQueryParams.parse(req.query);
    const profile = await getApprovedStudentProfile(getAuth(req).userId!);
    const activeTerms = await getActiveTermNumbers();
    if (termNumber > currentTermNumber(profile) || !activeTerms.includes(termNumber)) {
      res.status(403).json({ error: "Bu semestr hələ aktiv deyil." });
      return;
    }
    const assignments = await db.select().from(assignmentsTable)
      .where(eq(assignmentsTable.termNumber, termNumber))
      .orderBy(desc(assignmentsTable.dueAt), asc(assignmentsTable.id));
    const visible = [];
    for (const assignment of assignments) {
      const resource = await assignmentResource(assignment);
      if (resource && await studentMayAttendResource(profile.id, resource)) {
        visible.push(await assignmentView(assignment, profile.id));
      }
    }
    res.json(GetStudentAssignmentsResponse.parse(visible));
  } catch (error) { next(error); }
});

router.get("/assignments/:assignmentId", requireApprovedStudent, async (req, res, next) => {
  try {
    const { assignmentId } = GetStudentAssignmentParams.parse(req.params);
    const profile = await getApprovedStudentProfile(getAuth(req).userId!);
    const activeTerms = await getActiveTermNumbers();
    const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId)).limit(1);
    const resource = assignment && await assignmentResource(assignment);
    if (!assignment || !resource || !activeTerms.includes(assignment.termNumber) || assignment.termNumber > currentTermNumber(profile) || !await studentMayAttendResource(profile.id, resource)) {
      res.status(404).json({ error: "Tapşırıq tapılmadı." });
      return;
    }
    res.json(GetStudentAssignmentResponse.parse(await assignmentView(assignment, profile.id)));
  } catch (error) { next(error); }
});

router.post("/assignments/:assignmentId/submission-upload-url", requireApprovedStudent, async (req, res, next) => {
  try {
    const { assignmentId } = RequestStudentAssignmentUploadUrlParams.parse(req.params);
    const parsedInput = RequestStudentAssignmentUploadUrlBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Fayl məlumatları düzgün göndərilməyib." });
      return;
    }
    const input = parsedInput.data;
    const profile = await getApprovedStudentProfile(getAuth(req).userId!);
    const activeTerms = await getActiveTermNumbers();
    const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId)).limit(1);
    const resource = assignment && await assignmentResource(assignment);
    if (!assignment || !resource || !activeTerms.includes(assignment.termNumber) || assignment.termNumber > currentTermNumber(profile) || !await studentMayAttendResource(profile.id, resource) || assignmentStatus(assignment) === "closed") {
      res.status(403).json({ error: "Bu tapşırığa təhvil göndərmək mümkün deyil." });
      return;
    }
    const uploaded = await createAssignmentUploadIntent(profile.clerkUserId, input, "submission", assignmentId);
    res.json(RequestStudentAssignmentUploadUrlResponse.parse(uploaded));
  } catch (error) { next(error); }
});

router.post("/assignments/:assignmentId/submissions", requireApprovedStudent, async (req, res, next) => {
  try {
    const { assignmentId } = SubmitAssignmentParams.parse(req.params);
    const parsedInput = SubmitAssignmentBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Təhvil məlumatları düzgün göndərilməyib." });
      return;
    }
    const input = parsedInput.data;
    const profile = await getApprovedStudentProfile(getAuth(req).userId!);
    const activeTerms = await getActiveTermNumbers();
    const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId)).limit(1);
    const resource = assignment && await assignmentResource(assignment);
    if (!assignment || !resource || !activeTerms.includes(assignment.termNumber) || assignment.termNumber > currentTermNumber(profile) || !await studentMayAttendResource(profile.id, resource)) {
      res.status(404).json({ error: "Tapşırıq tapılmadı." });
      return;
    }
    if (assignmentStatus(assignment) === "closed") {
      res.status(409).json({ error: "Tapşırığın son tarixi keçib və ya tapşırıq bağlanıb." });
      return;
    }
    const intentIds = input.attachmentIntentIds ?? [];
    const intents = await loadUploadIntents(intentIds, profile.clerkUserId, "submission", assignmentId);
    if (!input.answerText.trim() && !intents.length) {
      res.status(400).json({ error: "Mətn cavabı və ya ən azı bir fayl əlavə edin." });
      return;
    }
    const [existing] = await db.select().from(assignmentSubmissionsTable).where(and(
      eq(assignmentSubmissionsTable.assignmentId, assignmentId),
      eq(assignmentSubmissionsTable.profileId, profile.id),
    )).limit(1);
    if (existing) {
      const oldAttachments = await db.delete(assignmentAttachmentsTable).where(eq(assignmentAttachmentsTable.submissionId, existing.id)).returning();
      await Promise.all(oldAttachments.map((attachment) => deleteAssignmentFile(attachment.objectPath).catch(() => undefined)));
    }
    const [submission] = existing
      ? await db.update(assignmentSubmissionsTable).set({
          answerText: input.answerText.trim(),
          status: "submitted",
          submittedAt: new Date(),
          score: null,
          feedback: null,
          reviewedAt: null,
          reviewedByClerkUserId: null,
          updatedAt: new Date(),
        }).where(eq(assignmentSubmissionsTable.id, existing.id)).returning()
      : await db.insert(assignmentSubmissionsTable).values({
          assignmentId,
          profileId: profile.id,
          answerText: input.answerText.trim(),
          status: "submitted",
        }).returning();
    if (!submission) throw new Error("Təhvil yadda saxlanmadı.");
    await attachUploadIntents(intents, assignmentId, profile.clerkUserId, "submission", submission.id);
    await syncAssignmentGrade(assignment, profile.id, null);
    await recordAuditEvent({
      eventType: existing ? "assignment.submission.resubmitted" : "assignment.submission.created",
      actorClerkUserId: profile.clerkUserId,
      targetType: "assignment_submission",
      targetId: submission.id,
      details: { assignmentId },
      deduplicationKey: `assignment.submission:${submission.id}:${submission.updatedAt.toISOString()}`,
    });
    res.json(SubmitAssignmentResponse.parse(await submissionView(submission)));
  } catch (error) { next(error); }
});

router.get("/exams", requireApprovedStudent, async (req, res, next) => {
  try {
    const { termNumber } = GetStudentExamsQueryParams.parse(req.query);
    const profile = await getApprovedStudentProfile(getAuth(req).userId!);
    const activeTerms = await getActiveTermNumbers();
    if (termNumber > currentTermNumber(profile) || !activeTerms.includes(termNumber)) {
      res.status(403).json({ error: "Bu semestr hələ aktiv deyil." });
      return;
    }
    const assignedOnboardingExam = termNumber === currentTermNumber(profile)
      ? await ensureOnboardingExamAssignment(profile)
      : null;
    const exams = await db.select().from(examsTable).where(and(
      eq(examsTable.status, "open"),
      or(eq(examsTable.termNumber, termNumber), eq(examsTable.isOnboarding, true)),
    )).orderBy(desc(examsTable.createdAt));
    const visible = [];
    for (const exam of exams) {
      const resource = await examResource(exam);
      const onboardingVisible = exam.isOnboarding && assignedOnboardingExam?.id === exam.id;
      if ((exam.isOnboarding && onboardingVisible) || (!exam.isOnboarding && resource && await studentMayAttendResource(profile.id, resource))) {
        visible.push(await examView(exam, profile.id));
      }
    }
    res.json(GetStudentExamsResponse.parse(visible));
  } catch (error) { next(error); }
});

router.get("/exams/:examId", requireApprovedStudent, async (req, res, next) => {
  try {
    const { examId } = GetStudentExamParams.parse(req.params);
    const profile = await getApprovedStudentProfile(getAuth(req).userId!);
    const activeTerms = await getActiveTermNumbers();
    const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId)).limit(1);
    const resource = exam && await examResource(exam);
    const assignedOnboardingExam = exam?.isOnboarding
      ? await ensureOnboardingExamAssignment(profile)
      : null;
    const onboardingVisible = Boolean(exam?.isOnboarding && assignedOnboardingExam?.id === exam.id);
    if (!exam || exam.status !== "open" || (!exam.isOnboarding && (!resource || !activeTerms.includes(exam.termNumber) || exam.termNumber > currentTermNumber(profile) || !await studentMayAttendResource(profile.id, resource))) || (exam.isOnboarding && !onboardingVisible)) {
      res.status(404).json({ error: "Test tapılmadı." });
      return;
    }
    await ensureExamAttempt(exam.id, profile.id);
    res.json(GetStudentExamResponse.parse(await examView(exam, profile.id)));
  } catch (error) { next(error); }
});

router.post("/exams/:examId/submissions", requireApprovedStudent, async (req, res, next) => {
  try {
    const { examId } = SubmitExamParams.parse(req.params);
    const parsedInput = SubmitExamBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Test cavabları düzgün göndərilməyib." });
      return;
    }
    const input = parsedInput.data;
    const profile = await getApprovedStudentProfile(getAuth(req).userId!);
    const activeTerms = await getActiveTermNumbers();
    const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId)).limit(1);
    const resource = exam && await examResource(exam);
    const assignedOnboardingExam = exam?.isOnboarding
      ? await ensureOnboardingExamAssignment(profile)
      : null;
    const onboardingVisible = Boolean(exam?.isOnboarding && assignedOnboardingExam?.id === exam.id);
    if (!exam || !examResourceAllowedForStudent(exam, resource, activeTerms, currentTermNumber(profile), onboardingVisible) || (!exam.isOnboarding && !await studentMayAttendResource(profile.id, resource!))) {
      res.status(404).json({ error: "Test tapılmadı." });
      return;
    }
    if (exam.status !== "open") {
      res.status(409).json({ error: "Bağlanmış testə cavab göndərmək mümkün deyil." });
      return;
    }
    const attempt = await ensureExamAttempt(exam.id, profile.id);
    const expired = exam.durationMinutes !== null
      && Date.now() >= attempt.startedAt.getTime() + exam.durationMinutes * 60_000;
    const questions = await db.select().from(examQuestionsTable).where(eq(examQuestionsTable.examId, examId));
    const questionIds = new Set(questions.map((question) => String(question.id)));
    const answerKeys = Object.keys(input.answers);
    if ((!expired && answerKeys.length !== questions.length) || answerKeys.some((questionId) => !questionIds.has(questionId))) {
      res.status(400).json({ error: "Bütün sualları cavablandırın və yalnız bu testin suallarını göndərin." });
      return;
    }
    const optionRows = await db.select().from(examOptionsTable).where(inArray(examOptionsTable.questionId, questions.map((question) => question.id)));
    const validOptionsByQuestion = new Map<number, Set<number>>();
    for (const option of optionRows) {
      const valid = validOptionsByQuestion.get(option.questionId) ?? new Set<number>();
      valid.add(option.id);
      validOptionsByQuestion.set(option.questionId, valid);
    }
    for (const [questionId, optionId] of Object.entries(input.answers)) {
      if (!validOptionsByQuestion.get(Number(questionId))?.has(optionId)) {
        res.status(400).json({ error: "Cavab variantlarından biri bu testə aid deyil." });
        return;
      }
    }
    const [existing] = await db.select({ id: examSubmissionsTable.id }).from(examSubmissionsTable).where(and(
      eq(examSubmissionsTable.examId, examId),
      eq(examSubmissionsTable.profileId, profile.id),
    )).limit(1);
    if (existing) {
      res.status(409).json({ error: "Bu test üçün cavabınız artıq göndərilib." });
      return;
    }
    const [submission] = await db.insert(examSubmissionsTable).values({
      examId,
      profileId: profile.id,
      answers: input.answers,
    }).returning();
    if (!submission) throw new Error("Test cavabları yadda saxlanmadı.");
    const result = calculateExamResult(questions, optionRows, submission.answers);
    await recordAuditEvent({
      eventType: "exam.submission.created",
      actorClerkUserId: profile.clerkUserId,
      targetType: "exam_submission",
      targetId: submission.id,
      details: { examId },
      deduplicationKey: `exam.submission:${submission.id}`,
    });
    res.status(201).json(SubmitExamResponse.parse({ ...submission, result }));
  } catch (error) { next(error); }
});

const bakuWeekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function bakuToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(new Date());
  const value = (name: string) => parts.find((part) => part.type === name)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value("weekday"));
  return { date: `${value("year")}-${value("month")}-${value("day")}`, weekday: bakuWeekdays[weekday] };
}
function scheduledLessonStartUtc(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  // The academy's existing schedule convention is Asia/Baku (UTC+04:00).
  return Date.UTC(year, month - 1, day, hour - 4, minute);
}

async function studentMayAttendResource(profileId: number, resource: typeof resourcesTable.$inferSelect) {
  const [selection] = await db.select({ selected: studentCourseSelectionsTable.selected })
    .from(studentCourseSelectionsTable)
    .where(and(
      eq(studentCourseSelectionsTable.profileId, profileId),
      eq(studentCourseSelectionsTable.courseId, resource.courseId),
      eq(studentCourseSelectionsTable.termNumber, resource.termNumber),
    ))
    .limit(1);
  if (selection && !selection.selected) return false;
  const approvedChoices = await db.select({ profileId: studentTeacherChoicesTable.profileId })
    .from(studentTeacherChoicesTable)
    .where(and(
      eq(studentTeacherChoicesTable.resourceId, resource.id),
      eq(studentTeacherChoicesTable.status, "approved"),
    ));
  return approvedChoices.length === 0 || approvedChoices.some((choice) => choice.profileId === profileId);
}

const assignmentUploadContentTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "text/plain",
]);
const maxAssignmentFileSize = 10 * 1024 * 1024;

function assignmentStatus(assignment: typeof assignmentsTable.$inferSelect) {
  return assignment.status === "closed" || assignment.dueAt.getTime() <= Date.now() ? "closed" as const : "open" as const;
}

function attachmentView(row: typeof assignmentAttachmentsTable.$inferSelect) {
  return {
    id: row.id,
    originalName: row.originalName,
    contentType: row.contentType,
    size: row.size,
    kind: row.kind,
    downloadUrl: `/api/assignment-attachments/${row.id}`,
  };
}

async function submissionView(submission: typeof assignmentSubmissionsTable.$inferSelect | undefined) {
  if (!submission) return null;
  const attachments = await db.select().from(assignmentAttachmentsTable).where(and(
    eq(assignmentAttachmentsTable.assignmentId, submission.assignmentId),
    eq(assignmentAttachmentsTable.submissionId, submission.id),
    eq(assignmentAttachmentsTable.kind, "submission"),
  ));
  return {
    id: submission.id,
    assignmentId: submission.assignmentId,
    profileId: submission.profileId,
    answerText: submission.answerText,
    status: submission.status,
    submittedAt: submission.submittedAt,
    score: submission.score,
    feedback: submission.feedback,
    reviewedAt: submission.reviewedAt,
    attachments: attachments.map(attachmentView),
  };
}

async function assignmentView(assignment: typeof assignmentsTable.$inferSelect, profileId?: number) {
  const [course, teacher, attachments, submission] = await Promise.all([
    db.select({ title: coursesTable.title }).from(coursesTable).where(eq(coursesTable.id, assignment.courseId)).limit(1),
    teacherNameMap([assignment.teacherClerkUserId]),
    db.select().from(assignmentAttachmentsTable).where(and(
      eq(assignmentAttachmentsTable.assignmentId, assignment.id),
      eq(assignmentAttachmentsTable.kind, "assignment"),
      isNull(assignmentAttachmentsTable.submissionId),
    )),
    profileId === undefined
      ? Promise.resolve([])
      : db.select().from(assignmentSubmissionsTable).where(and(
        eq(assignmentSubmissionsTable.assignmentId, assignment.id),
        eq(assignmentSubmissionsTable.profileId, profileId),
      )).limit(1),
  ]);
  return {
    id: assignment.id,
    courseId: assignment.courseId,
    resourceId: assignment.resourceId,
    termNumber: assignment.termNumber,
    courseTitle: course[0]?.title?.trim() || `Fənn #${assignment.courseId}`,
    teacherName: teacher.get(assignment.teacherClerkUserId) ?? "Müəllim",
    title: assignment.title,
    description: assignment.description,
    dueAt: assignment.dueAt,
    maxScore: assignment.maxScore,
    status: assignmentStatus(assignment),
    attachments: attachments.map(attachmentView),
    submission: await submissionView(submission[0]),
  };
}

async function assignmentResource(assignment: typeof assignmentsTable.$inferSelect) {
  const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, assignment.resourceId)).limit(1);
  return resource;
}

async function canManageAssignment(userId: string, assignment: typeof assignmentsTable.$inferSelect) {
  const resource = await assignmentResource(assignment);
  return Boolean(resource && await canManageResourceRoster(userId, resource));
}

async function examResource(exam: typeof examsTable.$inferSelect) {
  if (exam.resourceId <= 0) return undefined;
  const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, exam.resourceId)).limit(1);
  return resource;
}

async function ensureExamAttempt(examId: number, profileId: number) {
  await db.insert(examAttemptsTable).values({ examId, profileId }).onConflictDoNothing({
    target: [examAttemptsTable.examId, examAttemptsTable.profileId],
  });
  const [attempt] = await db.select().from(examAttemptsTable).where(and(
    eq(examAttemptsTable.examId, examId),
    eq(examAttemptsTable.profileId, profileId),
  )).limit(1);
  if (!attempt) throw new Error("Testə başlamaq mümkün olmadı.");
  return attempt;
}

function examResourceAllowedForStudent(
  exam: typeof examsTable.$inferSelect,
  resource: typeof resourcesTable.$inferSelect | undefined,
  activeTerms: number[],
  currentTerm: number,
  onboardingVisible: boolean,
) {
  if (exam.isOnboarding) return onboardingVisible;
  return Boolean(resource && activeTerms.includes(exam.termNumber) && exam.termNumber <= currentTerm);
}

async function ensureOnboardingExamAssignment(profile: typeof studentAcademicProfilesTable.$inferSelect) {
  if (!profile.onboardingExamEligible) return null;
  const [existingAssignment] = await db.select().from(onboardingExamAssignmentsTable)
    .where(eq(onboardingExamAssignmentsTable.profileId, profile.id))
    .limit(1);
  if (existingAssignment) {
    const [assignedExam] = await db.select().from(examsTable).where(and(
      eq(examsTable.id, existingAssignment.examId),
      eq(examsTable.isOnboarding, true),
      eq(examsTable.status, "open"),
    )).limit(1);
    if (assignedExam) return assignedExam;
  }

  const [candidate] = await db.select().from(examsTable).where(and(
    eq(examsTable.isOnboarding, true),
    eq(examsTable.status, "open"),
  )).orderBy(sql`random()`).limit(1);
  if (!candidate) return null;

  if (existingAssignment) {
    if (existingAssignment.examId !== candidate.id) {
      await db.update(onboardingExamAssignmentsTable).set({
        examId: candidate.id,
        reviewStatus: "pending",
        reviewedAt: null,
        reviewedByClerkUserId: null,
      }).where(eq(onboardingExamAssignmentsTable.profileId, profile.id));
    }
  } else {
    await db.insert(onboardingExamAssignmentsTable).values({
      profileId: profile.id,
      examId: candidate.id,
    }).onConflictDoNothing({ target: [onboardingExamAssignmentsTable.profileId] });
  }
  const [assignment] = await db.select().from(onboardingExamAssignmentsTable)
    .where(eq(onboardingExamAssignmentsTable.profileId, profile.id))
    .limit(1);
  if (!assignment) return null;
  const [assignedExam] = await db.select().from(examsTable).where(and(
    eq(examsTable.id, assignment.examId),
    eq(examsTable.isOnboarding, true),
    eq(examsTable.status, "open"),
  )).limit(1);
  return assignedExam ?? null;
}

async function scheduleAccessState(profile: typeof studentAcademicProfilesTable.$inferSelect) {
  const admissionExamRequired = await getAdmissionExamRequired();
  if (!admissionExamRequired) {
    return {
      approved: profile.scheduleAccessApproved || profile.onboardingExamEligible,
      onboardingRequired: false,
      onboardingExamId: null,
      onboardingExamTitle: null,
    };
  }
  if (!profile.onboardingExamEligible) {
    return {
      approved: profile.scheduleAccessApproved,
      onboardingRequired: false,
      onboardingExamId: null,
      onboardingExamTitle: null,
    };
  }
  const onboardingExam = await ensureOnboardingExamAssignment(profile);
  const onboardingAssignment = onboardingExam
    ? await db.select().from(onboardingExamAssignmentsTable).where(and(
      eq(onboardingExamAssignmentsTable.profileId, profile.id),
      eq(onboardingExamAssignmentsTable.examId, onboardingExam.id),
    )).limit(1)
    : [];
  const onboardingSubmission = onboardingExam
    ? await db.select({ id: examSubmissionsTable.id }).from(examSubmissionsTable).where(and(
      eq(examSubmissionsTable.examId, onboardingExam.id),
      eq(examSubmissionsTable.profileId, profile.id),
    )).limit(1)
    : [];
  const onboardingApproved = Boolean(onboardingExam && onboardingSubmission.length && onboardingAssignment[0]?.reviewStatus === "approved");
  const onboardingRequired = !onboardingApproved;
  return {
    approved: onboardingApproved,
    onboardingRequired,
    onboardingExamId: onboardingExam?.id ?? null,
    onboardingExamTitle: onboardingExam?.title ?? null,
  };
}

class ExamValidationError extends Error {}

function normalizeExamQuestions(questions: Array<{ prompt: string; options: string[]; correctOptionIndex: number }>) {
  return questions.map((question) => {
    const prompt = question.prompt.trim();
    const options = question.options.map((option) => option.trim());
    const duplicateOptions = new Set(options.map((option) => option.toLocaleLowerCase("az")));
    if (duplicateOptions.size !== options.length) {
      throw new ExamValidationError("Bir sualın cavab variantları təkrarlana bilməz.");
    }
    if (!prompt || options.some((option) => !option)) {
      throw new ExamValidationError("Sual və cavab variantları boş qala bilməz.");
    }
    if (!Number.isInteger(question.correctOptionIndex) || question.correctOptionIndex < 0 || question.correctOptionIndex >= options.length) {
      throw new ExamValidationError("Hər sual üçün düzgün cavab variantı seçilməlidir.");
    }
    return { prompt, options, correctOptionIndex: question.correctOptionIndex };
  });
}

function calculateExamResult(
  questions: Array<{ id: number }>,
  options: Array<{ id: number; questionId: number; isCorrect: boolean }>,
  answers: Record<string, number>,
) {
  const correctOptionByQuestion = new Map(
    options.filter((option) => option.isCorrect).map((option) => [option.questionId, option.id]),
  );
  const correctCount = questions.reduce((count, question) => (
    count + (answers[String(question.id)] === correctOptionByQuestion.get(question.id) ? 1 : 0)
  ), 0);
  const totalQuestions = questions.length;
  return {
    correctCount,
    totalQuestions,
    percentage: totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0,
  };
}

async function loadExamResult(examId: number, answers: Record<string, number>) {
  const questions = await db.select({ id: examQuestionsTable.id }).from(examQuestionsTable)
    .where(eq(examQuestionsTable.examId, examId));
  const options = questions.length
    ? await db.select({
      id: examOptionsTable.id,
      questionId: examOptionsTable.questionId,
      isCorrect: examOptionsTable.isCorrect,
    }).from(examOptionsTable).where(inArray(examOptionsTable.questionId, questions.map((question) => question.id)))
    : [];
  return calculateExamResult(questions, options, answers);
}

function seededQuestionOrder<T extends { id: number }>(questions: T[], seed: string) {
  const hash = (value: string) => {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  };
  return [...questions].sort((left, right) => (
    hash(`${seed}:${left.id}`) - hash(`${seed}:${right.id}`)
  ));
}

async function examQuestionViews(examId: number, includeCorrect = false, shuffleSeed?: string) {
  const [questions, options] = await Promise.all([
    db.select().from(examQuestionsTable).where(eq(examQuestionsTable.examId, examId)).orderBy(asc(examQuestionsTable.position)),
    db.select().from(examOptionsTable).where(inArray(
      examOptionsTable.questionId,
      (await db.select({ id: examQuestionsTable.id }).from(examQuestionsTable).where(eq(examQuestionsTable.examId, examId))).map((question) => question.id),
    )),
  ]);
  const byQuestion = new Map<number, typeof examOptionsTable.$inferSelect[]>();
  for (const option of options) {
    const current = byQuestion.get(option.questionId) ?? [];
    current.push(option);
    byQuestion.set(option.questionId, current);
  }
  const orderedQuestions = shuffleSeed ? seededQuestionOrder(questions, shuffleSeed) : questions;
  return orderedQuestions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    position: question.position,
    options: (byQuestion.get(question.id) ?? []).sort((a, b) => a.position - b.position).map((option) => ({
      id: option.id,
      label: option.label,
      position: option.position,
    })),
    ...(includeCorrect ? {
      correctOptionId: (byQuestion.get(question.id) ?? []).find((option) => option.isCorrect)?.id ?? null,
    } : {}),
  }));
}

async function examView(exam: typeof examsTable.$inferSelect, profileId?: number, includeCorrect = false) {
  const [course, teacher, questions, submission, attempt] = await Promise.all([
    db.select({ title: coursesTable.title }).from(coursesTable).where(eq(coursesTable.id, exam.courseId)).limit(1),
    teacherNameMap([exam.teacherClerkUserId]),
    examQuestionViews(exam.id, includeCorrect, profileId === undefined ? undefined : `${exam.id}:${profileId}`),
    profileId === undefined
      ? Promise.resolve([])
      : db.select().from(examSubmissionsTable).where(and(
        eq(examSubmissionsTable.examId, exam.id),
        eq(examSubmissionsTable.profileId, profileId),
      )).limit(1),
    profileId === undefined
      ? Promise.resolve([])
      : db.select({ startedAt: examAttemptsTable.startedAt }).from(examAttemptsTable).where(and(
        eq(examAttemptsTable.examId, exam.id),
        eq(examAttemptsTable.profileId, profileId),
      )).limit(1),
  ]);
  const result = submission[0] ? await loadExamResult(exam.id, submission[0].answers) : null;
  return {
    id: exam.id,
    courseId: exam.courseId,
    resourceId: exam.resourceId,
    termNumber: exam.termNumber,
    courseTitle: exam.isOnboarding ? "Ümumi qəbul testi" : course[0]?.title?.trim() || `Fənn #${exam.courseId}`,
    teacherName: teacher.get(exam.teacherClerkUserId) ?? "Müəllim",
    title: exam.title,
    description: exam.description,
    status: exam.status === "closed" ? "closed" as const : "open" as const,
    isOnboarding: exam.isOnboarding,
    durationMinutes: exam.durationMinutes,
    startedAt: attempt[0]?.startedAt ?? null,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
    questions,
    submission: submission[0] ? {
      id: submission[0].id,
      examId: submission[0].examId,
      profileId: submission[0].profileId,
      answers: submission[0].answers,
      submittedAt: submission[0].submittedAt,
      result,
    } : null,
  };
}

async function canManageExam(userId: string, exam: typeof examsTable.$inferSelect) {
  if (exam.isOnboarding && exam.resourceId <= 0) return true;
  const resource = await examResource(exam);
  return Boolean(resource && await canManageResourceRoster(userId, resource));
}

async function adminExamView(exam: typeof examsTable.$inferSelect) {
  const [submissionCount] = await db.select({ count: sql<number>`count(*)` })
    .from(examSubmissionsTable).where(eq(examSubmissionsTable.examId, exam.id));
  return {
    ...(await examView(exam, undefined, true)),
    teacherClerkUserId: exam.teacherClerkUserId,
    submissionCount: Number(submissionCount?.count ?? 0),
  };
}

async function replaceExamQuestions(examId: number, questions: Array<{ prompt: string; options: string[]; correctOptionIndex: number }>) {
  const oldQuestions = await db.select({ id: examQuestionsTable.id }).from(examQuestionsTable).where(eq(examQuestionsTable.examId, examId));
  if (oldQuestions.length) {
    await db.delete(examOptionsTable).where(inArray(examOptionsTable.questionId, oldQuestions.map((question) => question.id)));
  }
  await db.delete(examQuestionsTable).where(eq(examQuestionsTable.examId, examId));
  for (const [position, question] of questions.entries()) {
    const [created] = await db.insert(examQuestionsTable).values({
      examId,
      prompt: question.prompt,
      position,
    }).returning();
    if (!created) throw new Error("Test sualı yadda saxlanmadı.");
    await db.insert(examOptionsTable).values(question.options.map((label, optionPosition) => ({
      questionId: created.id,
      label,
      position: optionPosition,
      isCorrect: optionPosition === question.correctOptionIndex,
    })));
  }
}

async function loadUploadIntents(ids: number[], userId: string, kind: "assignment" | "submission", assignmentId?: number) {
  if (!ids.length) return [];
  const uniqueIds = Array.from(new Set(ids));
  const intents = await db.select().from(assignmentUploadIntentsTable).where(inArray(assignmentUploadIntentsTable.id, uniqueIds));
  if (intents.length !== uniqueIds.length) throw new Error("Fayl yükləmə sessiyası tapılmadı.");
  const results: typeof intents = [];
  for (const intent of intents) {
    if (intent.uploadedByClerkUserId !== userId || intent.kind !== kind || intent.usedAt || intent.expiresAt.getTime() <= Date.now()) {
      throw new Error("Fayl yükləmə sessiyası artıq etibarlı deyil.");
    }
    if (kind === "assignment" && intent.assignmentId !== null) {
      throw new Error("Tapşırıq faylının əlaqəsi düzgün deyil.");
    }
    if (kind === "submission" && intent.assignmentId !== assignmentId) {
      throw new Error("Fayl bu tapşırığa aid deyil.");
    }
    const file = await getAssignmentFile(intent.objectPath);
    const [metadata] = await file.getMetadata();
    const actualSize = Number(metadata.size);
    const actualContentType = metadata.contentType?.split(";")[0]?.trim();
    if (actualSize !== intent.size || actualContentType !== intent.contentType) {
      throw new Error("Yüklənmiş faylın metadata məlumatları uyğun gəlmir.");
    }
    results.push(intent);
  }
  return results;
}

async function attachUploadIntents(
  intents: Awaited<ReturnType<typeof loadUploadIntents>>,
  assignmentId: number,
  uploadedByClerkUserId: string,
  kind: "assignment" | "submission",
  submissionId?: number,
) {
  if (!intents.length) return;
  await db.insert(assignmentAttachmentsTable).values(intents.map((intent) => ({
    assignmentId,
    submissionId: submissionId ?? null,
    kind,
    objectPath: intent.objectPath,
    originalName: intent.originalName,
    contentType: intent.contentType,
    size: intent.size,
    uploadedByClerkUserId,
  })));
  await db.update(assignmentUploadIntentsTable).set({ usedAt: new Date() })
    .where(inArray(assignmentUploadIntentsTable.id, intents.map((intent) => intent.id)));
}

async function syncAssignmentGrade(
  assignment: typeof assignmentsTable.$inferSelect,
  profileId: number,
  score: number | null,
) {
  const [course] = await db.select({
    gradingComponents: coursesTable.gradingComponents,
  }).from(coursesTable).where(eq(coursesTable.id, assignment.courseId)).limit(1);
  if (!course) return;
  const [existingGrade] = await db.select().from(studentGradesTable).where(and(
    eq(studentGradesTable.profileId, profileId),
    eq(studentGradesTable.courseId, assignment.courseId),
    eq(studentGradesTable.termNumber, assignment.termNumber),
  )).limit(1);
  const componentName = `Tapşırıq: ${assignment.title}`.trim();
  const componentGrades = parseComponentGrades(existingGrade?.componentGrades);
  const componentNames = score === null
    ? (course.gradingComponents ?? [])
    : Array.from(new Set([...(course.gradingComponents ?? []), componentName]));
  if (score === null) delete componentGrades[componentName];
  else componentGrades[componentName] = Math.round((score / assignment.maxScore) * 100);
  const gradePoints = calculateComponentGrade(componentNames, componentGrades);
  if (existingGrade) {
    await db.update(studentGradesTable).set({
      gradePoints: gradePoints === null ? null : Math.round(gradePoints),
      componentGrades: JSON.stringify(componentGrades),
      updatedAt: new Date().toISOString(),
    }).where(eq(studentGradesTable.id, existingGrade.id));
  } else if (score !== null) {
    await db.insert(studentGradesTable).values({
      profileId,
      courseId: assignment.courseId,
      termNumber: assignment.termNumber,
      gradePoints: gradePoints === null ? null : Math.round(gradePoints),
      componentGrades: JSON.stringify(componentGrades),
      updatedAt: new Date().toISOString(),
    });
  }
  if (score !== null && JSON.stringify(course.gradingComponents ?? []) !== JSON.stringify(componentNames)) {
    await db.update(coursesTable).set({ gradingComponents: componentNames }).where(eq(coursesTable.id, assignment.courseId));
  }
}

async function createAssignmentUploadIntent(userId: string, input: { name: string; size: number; contentType: string }, kind: "assignment" | "submission", assignmentId?: number) {
  if (!assignmentUploadContentTypes.has(input.contentType) || input.size < 1 || input.size > maxAssignmentFileSize) {
    throw new Error("Faylın formatı və ölçüsü uyğun deyil.");
  }
  const uploaded = await createAssignmentUploadUrl(input.contentType);
  const [intent] = await db.insert(assignmentUploadIntentsTable).values({
    objectPath: uploaded.objectPath,
    uploadedByClerkUserId: userId,
    assignmentId: assignmentId ?? null,
    kind,
    originalName: input.name.trim(),
    contentType: input.contentType,
    size: input.size,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  }).returning();
  if (!intent) throw new Error("Fayl yükləmə sessiyası yaradıla bilmədi.");
  return { ...uploaded, id: intent.id };
}

router.post("/student/lesson-joins", requireApprovedStudent, async (req, res, next) => {
  try {
    const input = RecordLessonJoinBody.parse(req.body);
    const { userId } = getAuth(req);
    const profile = userId ? await getApprovedStudentProfile(userId) : null;
    if (!profile) { res.status(403).json({ error: "Tələbə profili tapılmadı." }); return; }
    const [resource] = await db.select().from(resourcesTable).where(and(
      eq(resourcesTable.id, input.resourceId), eq(resourcesTable.termNumber, input.termNumber),
    )).limit(1);
    if (!resource || !resource.lessonTime || !resource.lessonDays.length) {
      res.status(400).json({ error: "Bu resurs üçün canlı dərs cədvəli yoxdur." }); return;
    }
    if (!await studentMayAttendResource(profile.id, resource)) {
      res.status(403).json({ error: "Bu dərs qrupu sizin üçün təyin edilməyib." });
      return;
    }
    const session = bakuToday();
    if (!resource.lessonDays.includes(session.weekday)) {
      res.status(400).json({ error: "Bu gün üçün planlaşdırılmış dərs yoxdur." }); return;
    }
    const now = new Date();
    const start = scheduledLessonStartUtc(session.date, resource.lessonTime);
    if (now.getTime() < start) {
      res.status(400).json({ error: "Dərs hələ başlamayıb." }); return;
    }
    const punctuality = now.getTime() <= start + 20 * 60 * 1000 ? "on_time" : "late";
    const joinedAt = now.toISOString();
    const [event] = await db.insert(lessonJoinEventsTable).values({
      resourceId: resource.id, profileId: profile.id, termNumber: resource.termNumber,
      sessionDate: session.date, joinedAt, punctuality,
    }).onConflictDoNothing({
      target: [lessonJoinEventsTable.resourceId, lessonJoinEventsTable.profileId, lessonJoinEventsTable.sessionDate],
    }).returning();
    if (event) { res.status(201).json(RecordLessonJoinResponse.parse(event)); return; }
    const [existing] = await db.select().from(lessonJoinEventsTable).where(and(
      eq(lessonJoinEventsTable.resourceId, resource.id), eq(lessonJoinEventsTable.profileId, profile.id),
      eq(lessonJoinEventsTable.sessionDate, session.date),
    )).limit(1);
    res.status(201).json(RecordLessonJoinResponse.parse(existing));
  } catch (error) { next(error); }
});

router.get("/admin/lesson-attendance", requireTeacher, async (req, res, next) => {
  try {
    const allEvents = await db.select().from(lessonJoinEventsTable).orderBy(desc(lessonJoinEventsTable.sessionDate), desc(lessonJoinEventsTable.joinedAt));
    const profiles = await db.select().from(studentAcademicProfilesTable);
    const applications = await db.select().from(applicationsTable);
    const resources = await db.select().from(resourcesTable);
    const courses = await getCourses();
    const profileMap = new Map(profiles.map((item) => [item.id, item]));
    const applicationMap = new Map(applications.map((item) => [item.id, item]));
    const resourceMap = new Map(resources.map((item) => [item.id, item]));
    const viewerId = getAuth(req).userId;
    const viewer = viewerId ? await getClerkUser(viewerId) : null;
    const viewerRole = metadataRole(viewer?.publicMetadata);
    const visibleEvents = viewerId && (viewerRole === "admin" || await userIsSystemOwner(viewerId, viewer))
      ? allEvents
      : allEvents.filter((event) => {
        const resource = resourceMap.get(event.resourceId);
        return Boolean(resource && viewerId && resource.teacherClerkUserId === viewerId);
      });
    const events = (await Promise.all(visibleEvents.map(async (event) => {
      const resource = resourceMap.get(event.resourceId);
      return resource && await studentMayAttendResource(event.profileId, resource) ? event : null;
    }))).filter((event): event is typeof allEvents[number] => event !== null);
    const attendance = await db.select().from(studentAttendanceRecordsTable);
    const result = events.map((event) => {
      const resource = resourceMap.get(event.resourceId);
      const profile = profileMap.get(event.profileId);
      const application = profile ? applicationMap.get(profile.applicationId) : undefined;
      const final = resource && profile ? attendance.find((item) => item.profileId === profile.id && item.courseId === resource.courseId && item.attendanceDate === event.sessionDate) : undefined;
      return { ...event, studentName: application ? `${application.firstName} ${application.lastName}` : "Tələbə", courseTitle: courses.find((item) => item.id === resource?.courseId)?.title ?? "Naməlum fənn", finalStatus: final?.status === "excused" ? null : final?.status ?? null };
    });
    res.json(GetAdminLessonAttendanceResponse.parse(result));
  } catch (error) { next(error); }
});

router.patch("/admin/lesson-attendance/:eventId", requireTeacher, async (req, res, next) => {
  try {
    const parsedParams = ConfirmLessonAttendanceParams.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: "Dərsə qoşulma qeydi düzgün seçilməyib." });
      return;
    }
    const parsedBody = ConfirmLessonAttendanceBody.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: "Davamiyyət qərarı düzgün seçilməyib." });
      return;
    }
    const { eventId } = parsedParams.data;
    const { status } = parsedBody.data;
    const [event] = await db.select().from(lessonJoinEventsTable).where(eq(lessonJoinEventsTable.id, eventId)).limit(1);
    if (!event) { res.status(404).json({ error: "Dərsə qoşulma qeydi tapılmadı." }); return; }
    const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, event.resourceId)).limit(1);
    if (!resource) { res.status(404).json({ error: "Dərs resursu tapılmadı." }); return; }
    if (!await studentMayAttendResource(event.profileId, resource)) {
      res.status(403).json({ error: "Bu tələbə həmin dərs qrupu üçün təyin edilməyib." });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    const clerkViewer = clerkUserId ? await getClerkUser(clerkUserId) : null;
    if (resource.teacherClerkUserId && resource.teacherClerkUserId !== clerkUserId &&
      metadataRole(clerkViewer?.publicMetadata) !== "admin" && !(clerkUserId && await userIsSystemOwner(clerkUserId, clerkViewer))) {
      res.status(403).json({ error: "Bu dərsin davamiyyətini yalnız məsul müəllim idarə edə bilər." }); return;
    }
    const clerkUser = clerkViewer;
    const teacherName = clerkUser ? [ownerDisplayNameParts(clerkUser).firstName, ownerDisplayNameParts(clerkUser).lastName].filter(Boolean).join(" ") : "Akademiya müəllimi";
    await db.insert(studentAttendanceRecordsTable).values({
      profileId: event.profileId, courseId: resource.courseId, termNumber: event.termNumber,
      attendanceDate: event.sessionDate, status, teacherName, recordedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: [studentAttendanceRecordsTable.profileId, studentAttendanceRecordsTable.courseId, studentAttendanceRecordsTable.attendanceDate],
      set: { status, teacherName, recordedAt: new Date().toISOString(), termNumber: event.termNumber },
    });
    const [application] = await db.select().from(studentAcademicProfilesTable).innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id)).where(eq(studentAcademicProfilesTable.id, event.profileId)).limit(1);
    const course = (await getCourses()).find((item) => item.id === resource.courseId);
    res.json(ConfirmLessonAttendanceResponse.parse({ ...event, studentName: application?.lms_applications ? `${application.lms_applications.firstName} ${application.lms_applications.lastName}` : "Tələbə", courseTitle: course?.title ?? "Naməlum fənn", finalStatus: status }));
  } catch (error) { next(error); }
});

router.post("/applications/upload-url", async (req, res, next) => {
  try {
    if (!await requireOpenApplicationWindow(res)) return;
    const input = RequestApplicationUploadUrlBody.parse(req.body);
    await removeExpiredApplicationUploadIntents();
    if (!mayRequestApplicationUpload(req.ip ?? "naməlum")) {
      res.status(429).json({ error: "Fayl yükləmə limiti müvəqqəti olaraq dolub. Bir az sonra yenidən cəhd edin." });
      return;
    }
    if (!Number.isInteger(input.size) || input.size > maxApplicationFileSize || !permittedApplicationFileTypes.has(input.contentType)) {
      res.status(400).json({ error: "Yalnız PDF, Word, JPG və PNG faylları, maksimum 3 MB olmaqla yüklənə bilər." });
      return;
    }
    const upload = await createApplicationUploadUrl();
    const [intent] = await db.insert(applicationUploadIntentsTable).values({
      objectPath: upload.objectPath,
      contentType: input.contentType,
      size: input.size,
      expiresAt: new Date(Date.now() + applicationUploadWindowMs).toISOString(),
    }).returning({ id: applicationUploadIntentsTable.id });
    if (!intent) throw new Error("Fayl yükləmə niyyəti yadda saxlanmadı.");
    res.json(RequestApplicationUploadUrlResponse.parse({ ...upload, id: intent.id }));
  } catch (error) {
    next(error);
  }
});

router.post("/applications", requireAuth, async (req, res, next) => {
  try {
    if (!await requireOpenApplicationWindow(res)) return;
    const input = SubmitApplicationBody.parse(req.body);
    const { userId } = getAuth(req);
    const clerkUserId = userId as string;
    const clerkUser = await clerkClient.users.getUser(clerkUserId).catch(() => null);
    const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
    if (!clerkUser || clerkEmail !== input.email.trim().toLowerCase()) {
      res.status(400).json({ error: "Müraciət məlumatları yaradılmış hesabla uyğun gəlmir." });
      return;
    }
    const [existingApplication] = await db.select({ id: applicationsTable.id }).from(applicationsTable)
      .where(eq(applicationsTable.clerkUserId, clerkUserId)).limit(1);
    if (existingApplication) {
      res.status(409).json({ error: "Bu hesab üçün artıq müraciət göndərilib." });
      return;
    }
    await removeExpiredApplicationUploadIntents();
    const paths = input.recommendationPaths;
    if (new Set(paths).size !== 2 || paths.some((path) => !path.startsWith("/objects/applications/"))) {
      res.status(400).json({ error: "Tövsiyə məktublarının fayl yolları düzgün deyil." });
      return;
    }
    const intents = await db.select().from(applicationUploadIntentsTable)
      .where(inArray(applicationUploadIntentsTable.objectPath, paths));
    const now = new Date().toISOString();
    if (intents.length !== 2 || intents.some((intent) => intent.usedAt || intent.expiresAt <= now)) {
      res.status(400).json({ error: "Fayl yükləmə vaxtı bitib. Məktubları yenidən seçin." });
      return;
    }
    for (const intent of intents) {
      try {
        const file = await getApplicationFile(intent.objectPath);
        const [metadata] = await file.getMetadata();
        if (Number(metadata.size) === intent.size && metadata.contentType === intent.contentType) continue;
        await deleteApplicationFile(intent.objectPath).catch(() => undefined);
        res.status(400).json({ error: "Yüklənən faylın ölçüsü və ya növü uyğun deyil." });
        return;
      } catch {
        res.status(400).json({ error: "Tövsiyə məktubu yüklənməyib və ya vaxtı bitib." });
        return;
      }
    }
    const generatedUsername = clerkUser.username?.trim() || `student_${clerkUserId.replace(/[^a-zA-Z0-9]/g, "").slice(-16)}`;
    const [application] = await db.insert(applicationsTable).values({
      ...input,
      username: generatedUsername,
      birthDate: input.birthDate,
      clerkUserId,
      status: "pending",
      createdAt: new Date().toISOString(),
    }).returning();
    await recordAuditEvent({
      eventType: "application.submitted",
      actorClerkUserId: clerkUserId,
      targetType: "application",
      targetId: application.id,
      details: { recommendationCount: paths.length },
      deduplicationKey: `application.submitted:${application.id}`,
    });
    await db.update(applicationUploadIntentsTable).set({ usedAt: now })
      .where(inArray(applicationUploadIntentsTable.id, intents.map((intent) => intent.id)));
    res.status(201).json(SubmitApplicationResponse.parse(application && toApplication(application)));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/courses/upload-url", requireTeacher, async (req, res, next) => {
  try {
    const input = RequestCourseUploadUrlBody.parse(req.body);
    if (!Number.isInteger(input.size) || input.size <= 0 || input.size > maxCoursePdfSize || input.contentType !== "application/pdf") {
      res.status(400).json({ error: "Yalnız PDF faylı, maksimum 25 MB olmaqla yüklənə bilər." });
      return;
    }
    const upload = await createCourseUploadUrl();
    res.json(RequestCourseUploadUrlResponse.parse(upload));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/courses", requireTeacher, async (req, res, next) => {
  try {
    const input = CreateCourseBody.parse(req.body);
    const pdfUrl = input.pdfUrl?.trim() || null;
    if (pdfUrl && !/^\/objects\/courses\/[a-zA-Z0-9-]+\.pdf$/.test(pdfUrl)) {
      res.status(400).json({ error: "PDF fayl yolu düzgün deyil." });
      return;
    }
    if (pdfUrl?.startsWith("/objects/courses/")) {
      try {
        const file = await getCourseFile(pdfUrl);
        const [metadata] = await file.getMetadata();
        if (metadata.contentType !== "application/pdf" || Number(metadata.size) <= 0 || Number(metadata.size) > maxCoursePdfSize) {
          await deleteCourseFile(pdfUrl).catch(() => undefined);
          res.status(400).json({ error: "Yüklənən PDF faylı düzgün deyil və ya ölçüsü çox böyükdür." });
          return;
        }
      } catch {
        res.status(400).json({ error: "PDF faylı tapılmadı. Zəhmət olmasa yenidən yükləyin." });
        return;
      }
    }
    const [course] = await db.insert(coursesTable).values({
      ...input,
      progress: input.progress ?? 0,
      completedLessons: input.completedLessons ?? 0,
      curriculum: input.curriculum ?? [],
      nextLesson: input.nextLesson ?? null,
      pdfUrl,
      telegramUrl: input.telegramUrl ?? null,
      zoomUrl: input.zoomUrl ?? null,
      googleMeetUrl: input.googleMeetUrl ?? null,
      lessonUrl: input.lessonUrl ?? null,
      lessonDays: input.lessonDays,
      lessonTime: input.lessonTime,
    }).returning();
    if (course) {
      const actorId = getAuth(req).userId;
      await recordAuditEvent({
        eventType: "course.created",
        actorClerkUserId: actorId ?? "unknown",
        targetType: "course",
        targetId: course.id,
        details: { title: course.title },
        deduplicationKey: `course.created:${course.id}`,
      });
    }
    res.status(201).json(course && toCourse(course));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/teacher-courses", requireTeacher, async (req, res, next) => {
  try {
    const teacherClerkUserId = getAuth(req).userId;
    if (!teacherClerkUserId) {
      res.status(401).json({ error: "Müəllim hesabı tapılmadı." });
      return;
    }
    const requestedTerm = Number(req.query.termNumber);
    const termFilter = Number.isInteger(requestedTerm) && requestedTerm >= 1 && requestedTerm <= 8
      ? eq(resourcesTable.termNumber, requestedTerm)
      : undefined;
    const resources = await db.select({ courseId: resourcesTable.courseId })
      .from(resourcesTable)
      .where(termFilter
        ? and(eq(resourcesTable.teacherClerkUserId, teacherClerkUserId), termFilter)
        : eq(resourcesTable.teacherClerkUserId, teacherClerkUserId));
    const courseIds = new Set(resources.map((resource) => resource.courseId));
    const courses = await getCourses();
    res.json(courses.filter((course) => courseIds.has(course.id)));
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/courses/:courseId", requireTeacher, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const teacherClerkUserId = getAuth(req).userId;
    if (!teacherClerkUserId) {
      res.status(401).json({ error: "Müəllim hesabı tapılmadı." });
      return;
    }
    const clerkUser = await getClerkUser(teacherClerkUserId);
    const role = clerkUser ? roleForClerkUser(clerkUser) : "none";
    if (role !== "owner" && role !== "owner_assistant") {
      const [assignment] = await db.select({ id: resourcesTable.id })
        .from(resourcesTable)
        .where(and(eq(resourcesTable.courseId, courseId), eq(resourcesTable.teacherClerkUserId, teacherClerkUserId)))
        .limit(1);
      if (!assignment) {
        res.status(403).json({ error: "Yalnız sizə təyin olunmuş dərsi redaktə edə bilərsiniz." });
        return;
      }
    }
    const hasTotalLessons = req.body?.totalLessons !== undefined;
    const totalLessons = hasTotalLessons ? Number(req.body.totalLessons) : undefined;
    const hasCredits = req.body?.credits !== undefined;
    const credits = hasCredits ? Number(req.body.credits) : undefined;
    const hasHours = req.body?.hours !== undefined;
    const hours = hasHours ? Number(req.body.hours) : undefined;
    const instructor = typeof req.body?.instructor === "string" ? req.body.instructor.trim() : undefined;
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : undefined;
    const lessonDescription = typeof req.body?.lessonDescription === "string" ? req.body.lessonDescription.trim() : undefined;
    const nextLesson = req.body?.nextLesson === null ? null : typeof req.body?.nextLesson === "string" ? req.body.nextLesson.trim() : undefined;
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : undefined;
    const category = typeof req.body?.category === "string" ? req.body.category.trim() : undefined;
    const color = typeof req.body?.color === "string" ? req.body.color.trim() : undefined;
    const pdfUrl = req.body?.pdfUrl === null ? null : typeof req.body?.pdfUrl === "string" ? req.body.pdfUrl.trim() : undefined;
    const telegramUrl = req.body?.telegramUrl === null ? null : typeof req.body?.telegramUrl === "string" ? req.body.telegramUrl.trim() : undefined;
    const zoomUrl = req.body?.zoomUrl === null ? null : typeof req.body?.zoomUrl === "string" ? req.body.zoomUrl.trim() : undefined;
    const googleMeetUrl = req.body?.googleMeetUrl === null ? null : typeof req.body?.googleMeetUrl === "string" ? req.body.googleMeetUrl.trim() : undefined;
    const lessonUrl = req.body?.lessonUrl === null ? null : typeof req.body?.lessonUrl === "string" ? req.body.lessonUrl.trim() : undefined;
    const lessonDays = Array.isArray(req.body?.lessonDays) ? req.body.lessonDays.filter((day: unknown): day is string => typeof day === "string") : undefined;
    const lessonTime = req.body?.lessonTime === null ? null : typeof req.body?.lessonTime === "string" ? req.body.lessonTime.trim() : undefined;
    const curriculum = Array.isArray(req.body?.curriculum) && req.body.curriculum.every((item: unknown) => typeof item === "string")
      ? req.body.curriculum.map((item: string) => item.trim()).filter(Boolean)
      : undefined;
    const validLessonDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const validLessonTime = lessonTime === null || (typeof lessonTime === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(lessonTime));
    if (!Number.isInteger(courseId) || courseId <= 0 || (hasTotalLessons && (totalLessons === undefined || !Number.isInteger(totalLessons) || totalLessons < 0)) || (hasCredits && (credits === undefined || !Number.isFinite(credits) || credits < 0)) || (hasHours && (hours === undefined || !Number.isInteger(hours) || hours < 0)) || (instructor !== undefined && instructor.length > 120) || (title !== undefined && !title) || (category !== undefined && !category) || (color !== undefined && !color) || (curriculum === undefined && req.body?.curriculum !== undefined) || (lessonDays !== undefined && (!lessonDays.length || lessonDays.some((day: string) => !validLessonDays.includes(day)))) || (lessonTime !== undefined && !validLessonTime)) {
      res.status(400).json({ error: "Kredit 0 və ya daha böyük rəqəm, saat isə 0 və ya daha böyük tam ədəd olmalıdır; müəllim adı isə ən çox 120 simvol ola bilər." });
      return;
    }
    const update = {
      ...(hasTotalLessons ? { totalLessons } : {}),
      ...(hasCredits ? { credits } : {}),
      ...(hasHours ? { hours } : {}),
      ...(instructor !== undefined ? { instructor } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(color !== undefined ? { color } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(lessonDescription !== undefined ? { lessonDescription } : {}),
      ...(nextLesson !== undefined ? { nextLesson: nextLesson || null } : {}),
      ...(curriculum !== undefined ? { curriculum } : {}),
      ...(pdfUrl !== undefined ? { pdfUrl: pdfUrl || null } : {}),
      ...(telegramUrl !== undefined ? { telegramUrl: telegramUrl || null } : {}),
      ...(zoomUrl !== undefined ? { zoomUrl: zoomUrl || null } : {}),
      ...(googleMeetUrl !== undefined ? { googleMeetUrl: googleMeetUrl || null } : {}),
      ...(lessonUrl !== undefined ? { lessonUrl: lessonUrl || null } : {}),
      ...(lessonDays !== undefined ? { lessonDays } : {}),
      ...(lessonTime !== undefined ? { lessonTime: lessonTime || null } : {}),
    };
    const [course] = await db.update(coursesTable)
      .set(update)
      .where(eq(coursesTable.id, courseId))
      .returning();
    if (!course) {
      res.status(404).json({ error: "Dərs tapılmadı." });
      return;
    }
    await recordAuditEvent({
      eventType: "course.updated",
      actorClerkUserId: teacherClerkUserId,
      targetType: "course",
      targetId: course.id,
      details: { changedFields: Object.keys(update) },
      deduplicationKey: `course.updated:${course.id}:${Date.now()}`,
    });
    res.json(toCourse(course));
  } catch (error) {
    next(error);
  }
});

router.delete("/admin/courses/:courseId", requireTeacher, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const actorId = getAuth(req).userId;
    if (!Number.isInteger(courseId) || courseId <= 0) { res.status(400).json({ error: "Dərs seçilməyib." }); return; }
    const [course] = await db.select({ id: coursesTable.id }).from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
    if (!course) { res.status(404).json({ error: "Dərs tapılmadı." }); return; }
    await db.transaction(async (tx) => {
      await tx.delete(attendanceExcusesTable).where(eq(attendanceExcusesTable.courseId, courseId));
      await tx.delete(studentGradesTable).where(eq(studentGradesTable.courseId, courseId));
      await tx.delete(studentAttendanceRecordsTable).where(eq(studentAttendanceRecordsTable.courseId, courseId));
      await tx.delete(resourcesTable).where(eq(resourcesTable.courseId, courseId));
      await tx.delete(coursesTable).where(eq(coursesTable.id, courseId));
    });
    if (actorId) await recordAuditEvent({
      eventType: "course.deleted",
      actorClerkUserId: actorId,
      targetType: "course",
      targetId: courseId,
      deduplicationKey: `course.deleted:${courseId}:${Date.now()}`,
    });
    res.status(204).send();
  } catch (error) { next(error); }
});

router.get("/admin/courses/:courseId", requireTeacher, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const teacherClerkUserId = getAuth(req).userId;
    if (!teacherClerkUserId) {
      res.status(401).json({ error: "Müəllim hesabı tapılmadı." });
      return;
    }
    const clerkUser = await getClerkUser(teacherClerkUserId);
    const role = clerkUser ? roleForClerkUser(clerkUser) : "none";
    if (!Number.isInteger(courseId) || courseId <= 0) {
      res.status(400).json({ error: "Dərs nömrəsi düzgün deyil." });
      return;
    }
    if (role !== "owner" && role !== "owner_assistant") {
      const [assignment] = await db.select({ id: resourcesTable.id })
        .from(resourcesTable)
        .where(and(eq(resourcesTable.courseId, courseId), eq(resourcesTable.teacherClerkUserId, teacherClerkUserId)))
        .limit(1);
      if (!assignment) {
        res.status(403).json({ error: "Yalnız sizə təyin olunmuş dərsi görə bilərsiniz." });
        return;
      }
    }
    const [course] = await db.select().from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
    if (!course) {
      res.status(404).json({ error: "Dərs tapılmadı." });
      return;
    }
    res.json({
      ...toCourse(course),
      description: course.description,
      curriculum: course.curriculum,
      lessonDescription: course.lessonDescription,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/announcements", requireTeacher, async (_req, res, next) => {
  try {
    res.json(GetAdminAnnouncementsResponse.parse((await getAnnouncements()).map(toAnnouncement)));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/announcements", requireTeacher, async (req, res, next) => {
  try {
    const input = CreateAnnouncementBody.parse(req.body);
    const [announcement] = await db.insert(announcementsTable).values(input).returning();
    res.status(201).json(announcement && toAnnouncement(announcement));
  } catch (error) {
    next(error);
  }
});

const studentNotificationDeduplicationWindowMs = 30_000;

function sameNumberArray(left: number[], right: number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

router.post("/admin/student-notifications", requireTeacher, async (req, res, next) => {
  try {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    const activeTerms = await getActiveTermNumbers();
    const requestedTerms: unknown[] = Array.isArray(req.body?.targetTerms) ? req.body.targetTerms : [];
    const targetTerms: number[] = Array.from(new Set(requestedTerms.filter((term): term is number => typeof term === "number" && Number.isInteger(term) && activeTerms.includes(term)))).sort((left, right) => left - right);
    const requestedProfileIds: unknown[] = Array.isArray(req.body?.targetProfileIds) ? req.body.targetProfileIds : [];
    const requestedIds = Array.from(new Set(requestedProfileIds.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0))).sort((left, right) => left - right);
    const selectedProfiles = requestedIds.length
      ? await db.select({ id: studentAcademicProfilesTable.id, semester: studentAcademicProfilesTable.semester, currentTerm: studentAcademicProfilesTable.courseYear })
        .from(studentAcademicProfilesTable)
        .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
        .where(and(inArray(studentAcademicProfilesTable.id, requestedIds), eq(applicationsTable.status, "approved"), isNull(applicationsTable.deletedAt)))
      : [];
    const targetProfileIds = selectedProfiles.map((profile) => profile.id);
    const destination = req.body?.destination === "gmail" || req.body?.destination === "both" ? req.body.destination : "home";
    if (!title || title.length > 160 || !body || body.length > 5000 || (!targetTerms.length && !targetProfileIds.length) || (requestedIds.length > 0 && !targetProfileIds.length)) {
      res.status(400).json({ error: "Başlıq, mətn və ən azı bir tələbə və ya semestr seçilməlidir." });
      return;
    }
    const userId = getAuth(req).userId;
    if (!userId) { res.status(401).json({ error: "Hesaba giriş tələb olunur." }); return; }
    const deduplicationKey = JSON.stringify([userId, title, body, targetTerms, targetProfileIds, destination]);
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${deduplicationKey}, 0))`);
      const recentNotifications = await tx.select().from(studentNotificationsTable)
        .where(and(
          eq(studentNotificationsTable.title, title),
          eq(studentNotificationsTable.body, body),
          eq(studentNotificationsTable.destination, destination),
          eq(studentNotificationsTable.senderClerkUserId, userId),
        ))
        .orderBy(desc(studentNotificationsTable.id))
        .limit(20);
      const duplicate = recentNotifications.find((notification) =>
        Date.now() - new Date(notification.createdAt).getTime() <= studentNotificationDeduplicationWindowMs
        && sameNumberArray(notification.targetTerms, targetTerms)
        && sameNumberArray(notification.targetProfileIds, targetProfileIds),
      );
      if (duplicate) return { notification: duplicate, created: false } as const;
      const [notification] = await tx.insert(studentNotificationsTable).values({
        title,
        body,
        targetTerms,
        targetProfileIds,
        destination,
        senderClerkUserId: userId,
        createdAt: new Date().toISOString(),
      }).returning();
      if (!notification) throw new Error("Bildiriş yaradılmadı.");
      return { notification, created: true } as const;
    });
    const { notification } = result;
    if (result.created && (destination === "gmail" || destination === "both")) {
      const recipients = await db.select({ email: applicationsTable.email, firstName: applicationsTable.firstName, lastName: applicationsTable.lastName })
        .from(studentAcademicProfilesTable).innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
        .where(and(eq(applicationsTable.status, "approved"), isNull(applicationsTable.deletedAt), targetProfileIds.length
          ? inArray(studentAcademicProfilesTable.id, targetProfileIds)
          : inArray(studentAcademicProfilesTable.semester, targetTerms.map((term) => term % 2 === 0 ? 2 : 1))));
      await Promise.all(recipients.map((recipient) => sendStudentNotificationEmail({ to: recipient.email, studentName: `${recipient.firstName} ${recipient.lastName}`.trim(), title, body })));
    }
    res.status(result.created ? 201 : 200).json({ id: notification.id, title: notification.title, body: notification.body, targetTerms: notification.targetTerms, targetProfileIds: notification.targetProfileIds, destination: notification.destination, createdAt: notification.createdAt });
  } catch (error) { next(error); }
});

router.patch("/admin/announcements/:announcementId", requireTeacher, async (req, res, next) => {
  try {
    const announcementId = Number(req.params.announcementId);
    const input = CreateAnnouncementBody.parse(req.body);
    if (!Number.isInteger(announcementId) || announcementId <= 0) {
      res.status(400).json({ error: "Elan nömrəsi düzgün deyil." });
      return;
    }
    const [announcement] = await db.update(announcementsTable)
      .set(input)
      .where(eq(announcementsTable.id, announcementId))
      .returning();
    if (!announcement) {
      res.status(404).json({ error: "Elan tapılmadı." });
      return;
    }
    res.json(toAnnouncement(announcement));
  } catch (error) {
    next(error);
  }
});

router.delete("/admin/announcements/:announcementId", requireTeacher, async (req, res, next) => {
  try {
    const announcementId = Number(req.params.announcementId);
    if (!Number.isInteger(announcementId) || announcementId <= 0) {
      res.status(400).json({ error: "Elan nömrəsi düzgün deyil." });
      return;
    }
    const deleted = await db.delete(announcementsTable)
      .where(eq(announcementsTable.id, announcementId))
      .returning({ id: announcementsTable.id });
    if (!deleted.length) {
      res.status(404).json({ error: "Elan tapılmadı." });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/admin/articles", requireTeacher, async (_req, res, next) => {
  try {
    res.json(GetAdminArticlesResponse.parse((await getArticles()).map(toArticle)));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/articles", requireTeacher, async (req, res, next) => {
  try {
    const input = CreateArticleBody.parse(req.body);
    const title = input.title.trim();
    const excerpt = input.excerpt.trim();
    const body = input.body.trim();
    const author = input.author.trim();
    if (!title || !excerpt || !body || !author) {
      res.status(400).json({ error: "Məqalənin bütün sahələrini doldurun." });
      return;
    }
    const [article] = await db.insert(articlesTable).values({
      title,
      excerpt,
      body,
      author,
      createdAt: new Date().toISOString(),
    }).returning();
    res.status(201).json(article && toArticle(article));
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/articles/:articleId", requireTeacher, async (req, res, next) => {
  try {
    const articleId = Number(req.params.articleId);
    const input = CreateArticleBody.parse(req.body);
    const values = { title: input.title.trim(), excerpt: input.excerpt.trim(), body: input.body.trim(), author: input.author.trim() };
    if (!Number.isInteger(articleId) || articleId <= 0 || Object.values(values).some((value) => !value)) {
      res.status(400).json({ error: "Məqalənin bütün sahələrini doldurun." });
      return;
    }
    const [article] = await db.update(articlesTable).set(values).where(eq(articlesTable.id, articleId)).returning();
    if (!article) {
      res.status(404).json({ error: "Məqalə tapılmadı." });
      return;
    }
    res.json(toArticle(article));
  } catch (error) { next(error); }
});

router.delete("/admin/articles/:articleId", requireTeacher, async (req, res, next) => {
  try {
    const articleId = Number(req.params.articleId);
    if (!Number.isInteger(articleId) || articleId <= 0) {
      res.status(400).json({ error: "Məqalə nömrəsi düzgün deyil." });
      return;
    }
    const deleted = await db.delete(articlesTable).where(eq(articlesTable.id, articleId)).returning({ id: articlesTable.id });
    if (!deleted.length) {
      res.status(404).json({ error: "Məqalə tapılmadı." });
      return;
    }
    res.status(204).send();
  } catch (error) { next(error); }
});

router.get("/admin/daily-benefits", requireTeacher, async (_req, res, next) => {
  try {
    res.json(GetAdminDailyBenefitsResponse.parse((await getDailyBenefits()).map(toDailyBenefit)));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/daily-benefits", requireTeacher, async (req, res, next) => {
  try {
    const input = CreateDailyBenefitBody.parse(req.body);
    const body = input.body.trim();
    const source = input.source.trim();
    if (!body || !source) {
      res.status(400).json({ error: "Günün faydası və mənbəni doldurun." });
      return;
    }
    const createdAt = new Date().toISOString();
    const [existing] = await db.select().from(dailyBenefitsTable)
      .where(eq(dailyBenefitsTable.dayOfWeek, input.dayOfWeek)).limit(1);
    const [benefit] = existing
      ? await db.update(dailyBenefitsTable).set({ body, source, createdAt }).where(eq(dailyBenefitsTable.id, existing.id)).returning()
      : await db.insert(dailyBenefitsTable).values({ body, source, dayOfWeek: input.dayOfWeek, createdAt }).returning();
    res.status(201).json(benefit && toDailyBenefit(benefit));
  } catch (error) {
    next(error);
  }
});

router.delete("/admin/daily-benefits/:dayOfWeek", requireTeacher, async (req, res, next) => {
  try {
    const dayOfWeek = Array.isArray(req.params.dayOfWeek) ? req.params.dayOfWeek[0] : req.params.dayOfWeek;
    await db.delete(dailyBenefitsTable).where(eq(dailyBenefitsTable.dayOfWeek, dayOfWeek));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/admin/resources", requireTeacher, async (_req, res, next) => {
  try {
    await ensureSeeded();
    const actorId = getAuth(_req).userId;
    const actor = actorId ? await getClerkUser(actorId) : null;
    const actorRole = actor ? roleForClerkUser(actor) : "none";
    const resources = await db.select().from(resourcesTable).orderBy(asc(resourcesTable.id));
    const visibleResources = actorRole === "owner" || actorRole === "owner_assistant"
      ? resources
      : resources.filter((resource) => resource.teacherClerkUserId === actorId);
    res.json(await resourceViews(visibleResources));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/selected-courses", requireTeacher, async (req, res, next) => {
  try {
    const termNumber = Number(req.query.termNumber);
    if (!Number.isInteger(termNumber) || termNumber < 1 || termNumber > 8) { res.status(400).json({ error: "Semestr düzgün seçilməyib." }); return; }
    const rows = await db.select({ courseId: resourcesTable.courseId }).from(resourcesTable).where(eq(resourcesTable.termNumber, termNumber));
    const ids = new Set(rows.map((row) => row.courseId));
    const courses = await getCourses();
    res.json(ids.size ? courses.filter((course) => ids.has(course.id)) : courses);
  } catch (error) { next(error); }
});

router.get("/admin/teachers", requireTeacher, async (_req, res, next) => {
  try {
    res.json(await activeTeachers());
  } catch (error) {
    next(error);
  }
});

router.get("/admin/teacher-schedule", requireTeacher, async (req, res, next) => {
  try {
    const termNumber = Number(req.query.termNumber);
    if (!Number.isInteger(termNumber) || termNumber < 1 || termNumber > 8) {
      res.status(400).json({ error: "Semestr 1 ilə 8 arasında olmalıdır." });
      return;
    }
    const teacherClerkUserId = getAuth(req).userId;
    if (!teacherClerkUserId) {
      res.status(401).json({ error: "Müəllim hesabı tapılmadı." });
      return;
    }
    const resources = await db.select().from(resourcesTable)
      .where(and(eq(resourcesTable.termNumber, termNumber), eq(resourcesTable.teacherClerkUserId, teacherClerkUserId)))
      .orderBy(asc(resourcesTable.id));
    res.json(await resourceViews(resources));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/resources", requireTeacher, async (req, res, next) => {
  try {
    const input = CreateResourceBody.parse(req.body);
    const actorId = getAuth(req).userId;
    const actor = actorId ? await getClerkUser(actorId) : null;
    const actorRole = actor ? roleForClerkUser(actor) : "none";
    const assignedTeacherId = actorRole === "teacher" ? actorId : input.teacherClerkUserId;
    const termError = validateTermNumber(input.termNumber);
    if (termError) {
      res.status(400).json({ error: termError });
      return;
    }
    let url: string | null;
    try {
      url = safeResourceUrl(input.url);
    } catch {
      res.status(400).json({ error: "Material linki yalnız düzgün HTTPS ünvanı ola bilər." });
      return;
    }
    if (input.kind === "pdf" && (!url || !coursePdfObjectPathPattern.test(url))) {
      res.status(400).json({ error: "PDF materialı yalnız təhlükəsiz PDF fayl yolu ilə əlavə edilə bilər." });
      return;
    }
    const [course] = await db.select({ id: coursesTable.id }).from(coursesTable)
      .where(eq(coursesTable.id, input.courseId)).limit(1);
    if (!course) {
      res.status(404).json({ error: "Fənn tapılmadı" });
      return;
    }
    if (!await validateTeacherAssignment(assignedTeacherId)) {
      res.status(400).json({ error: "Yalnız aktiv müəllim hesabı təyin edilə bilər." });
      return;
    }
    const [resource] = await db.insert(resourcesTable).values({
      ...input,
      teacherClerkUserId: assignedTeacherId,
      url,
      expiresAt: resourceLinkExpiresAt(url),
    }).returning();
    if (actorId && resource) await recordAuditEvent({
      eventType: "resource.created",
      actorClerkUserId: actorId,
      targetType: "resource",
      targetId: resource.id,
      details: { courseId: resource.courseId, kind: resource.kind },
      deduplicationKey: `resource.created:${resource.id}`,
    });
     res.status(201).json(resource && (await resourceViews([resource]))[0]);
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/resources/:resourceId", requireTeacher, async (req, res, next) => {
  try {
    const resourceId = Number(req.params.resourceId);
    const actorId = getAuth(req).userId;
    const courseId = Number(req.body?.courseId);
    const termNumber = Number(req.body?.termNumber);
    const [existingResource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, resourceId)).limit(1);
    const actor = actorId ? await getClerkUser(actorId) : null;
    const actorRole = actor ? roleForClerkUser(actor) : "none";
    const canManageAnyResource = actorRole === "owner" || actorRole === "owner_assistant";
    if (!existingResource) {
      res.status(404).json({ error: "Material tapılmadı." });
      return;
    }
    if (!canManageAnyResource && existingResource.teacherClerkUserId !== actorId) {
      res.status(403).json({ error: "Yalnız sizə təyin olunmuş dərsin materialını redaktə edə bilərsiniz." });
      return;
    }
    const kind = typeof req.body?.kind === "string" ? req.body.kind.trim() : existingResource?.kind;
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : existingResource?.title;
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : existingResource?.body;
    const lessonDays = Array.isArray(req.body?.lessonDays) ? req.body.lessonDays.filter((day: unknown): day is string => typeof day === "string") : existingResource?.lessonDays;
    const lessonTime = typeof req.body?.lessonTime === "string" ? req.body.lessonTime.trim() : existingResource?.lessonTime;
    const isMandatory = typeof req.body?.isMandatory === "boolean" ? req.body.isMandatory : existingResource?.isMandatory;
    const requestedStudentCapacity = Number(req.body?.studentCapacity);
    const studentCapacity = Number.isInteger(requestedStudentCapacity) && requestedStudentCapacity >= 0 ? requestedStudentCapacity : (existingResource?.studentCapacity ?? 0);
     const teacherClerkUserId = typeof req.body?.teacherClerkUserId === "string" ? req.body.teacherClerkUserId.trim() : existingResource?.teacherClerkUserId;
    let url: string | null | undefined = req.body?.url === null ? null : typeof req.body?.url === "string" ? req.body.url.trim() || null : undefined;
    const validLessonDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const validLessonTime = typeof lessonTime === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(lessonTime);
     if (!existingResource || !Number.isInteger(resourceId) || resourceId <= 0 || !Number.isInteger(courseId) || courseId <= 0 ||
       validateTermNumber(termNumber) || !kind || !title || !body || !lessonDays?.length || lessonDays.some((day: string) => !validLessonDays.includes(day)) || !validLessonTime || isMandatory === undefined || !teacherClerkUserId || !Number.isInteger(studentCapacity) || studentCapacity < 0) {
      res.status(400).json({ error: "Fənn, semestr, kitab adı və kitab məlumatı düzgün doldurulmalıdır." });
      return;
    }
    if (!canManageAnyResource && teacherClerkUserId !== actorId) {
      res.status(403).json({ error: "Müəllim təyinatını yalnız sahib və sahib köməkçisi dəyişə bilər." });
      return;
    }
    if (url) {
      try { url = safeResourceUrl(url); } catch {
        res.status(400).json({ error: "Material linki yalnız düzgün HTTPS ünvanı ola bilər." });
        return;
      }
    }
    if (kind === "pdf" && (!url || !coursePdfObjectPathPattern.test(url))) {
      res.status(400).json({ error: "PDF materialı yalnız təhlükəsiz PDF fayl yolu ilə əlavə edilə bilər." });
      return;
    }
    const [course] = await db.select({ id: coursesTable.id }).from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
    if (!course) { res.status(404).json({ error: "Fənn tapılmadı." }); return; }
     if (!await validateTeacherAssignment(teacherClerkUserId)) { res.status(400).json({ error: "Yalnız aktiv müəllim hesabı təyin edilə bilər." }); return; }
     const assignedProfiles = await db.select({ profileId: studentTeacherChoicesTable.profileId })
       .from(studentTeacherChoicesTable)
       .where(and(
         eq(studentTeacherChoicesTable.resourceId, resourceId),
         eq(studentTeacherChoicesTable.status, "approved"),
       ));
     if (studentCapacity > 0 && assignedProfiles.length > studentCapacity) {
       res.status(400).json({ error: `Bu qrupda artıq ${assignedProfiles.length} tələbə var; tutum ${studentCapacity}-dən az ola bilməz.` });
       return;
     }
     const assignedProfileIds = assignedProfiles.map((choice) => choice.profileId);
     if (assignedProfileIds.length) {
       const otherResources = await db.select({ id: resourcesTable.id }).from(resourcesTable).where(and(
         eq(resourcesTable.courseId, courseId),
         eq(resourcesTable.termNumber, termNumber),
         ne(resourcesTable.id, resourceId),
       ));
       if (otherResources.length) {
         const duplicate = await db.select({ profileId: studentTeacherChoicesTable.profileId })
           .from(studentTeacherChoicesTable)
           .where(and(
             inArray(studentTeacherChoicesTable.profileId, assignedProfileIds),
             inArray(studentTeacherChoicesTable.resourceId, otherResources.map((item) => item.id)),
             or(eq(studentTeacherChoicesTable.status, "pending"), eq(studentTeacherChoicesTable.status, "approved")),
           ))
           .limit(1);
         if (duplicate.length) {
           res.status(409).json({ error: "Bu qrupun dəyişiklikləri tələbəni həmin fənn üzrə başqa müəllim qrupuna sala bilər." });
           return;
         }
       }
     }
    const expiresAt = url === undefined || url === existingResource.url
      ? existingResource.expiresAt
      : resourceLinkExpiresAt(url);
    const [resource] = await db.update(resourcesTable).set({
      courseId, termNumber, kind, title, body, url, expiresAt, lessonDays, lessonTime, isMandatory, teacherClerkUserId, studentCapacity,
    })
     .where(eq(resourcesTable.id, resourceId)).returning();
   if (!resource) { res.status(404).json({ error: "Material tapılmadı." }); return; }
    if (actorId) await recordAuditEvent({
      eventType: "resource.updated",
      actorClerkUserId: actorId,
      targetType: "resource",
      targetId: resourceId,
      details: { courseId, termNumber },
      deduplicationKey: `resource.updated:${resourceId}:${Date.now()}`,
    });
     res.json((await resourceViews([resource]))[0]);
  } catch (error) { next(error); }
});

router.delete("/admin/resources/:resourceId", requireTeacher, async (req, res, next) => {
  try {
    const resourceId = Number(req.params.resourceId);
    if (!Number.isInteger(resourceId) || resourceId <= 0) { res.status(400).json({ error: "Material seçilməyib." }); return; }
    const actorId = getAuth(req).userId;
    const actor = actorId ? await getClerkUser(actorId) : null;
    const actorRole = actor ? roleForClerkUser(actor) : "none";
    const [existingResource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, resourceId)).limit(1);
    if (!existingResource) { res.status(404).json({ error: "Material tapılmadı." }); return; }
    if (actorRole !== "owner" && actorRole !== "owner_assistant" && existingResource.teacherClerkUserId !== actorId) {
      res.status(403).json({ error: "Yalnız sizə təyin olunmuş dərsin materialını silə bilərsiniz." });
      return;
    }
    const deleted = await db.delete(resourcesTable).where(eq(resourcesTable.id, resourceId)).returning({ id: resourcesTable.id });
    if (!deleted.length) { res.status(404).json({ error: "Material tapılmadı." }); return; }
    if (actorId) await recordAuditEvent({
      eventType: "resource.deleted",
      actorClerkUserId: actorId,
      targetType: "resource",
      targetId: resourceId,
      deduplicationKey: `resource.deleted:${resourceId}:${Date.now()}`,
    });
    res.status(204).send();
  } catch (error) { next(error); }
});

router.post("/admin/assignment-upload-url", requireTeacher, async (req, res, next) => {
  try {
    const userId = getAuth(req).userId;
    const parsedInput = RequestAdminAssignmentUploadUrlBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Fayl məlumatları düzgün göndərilməyib." });
      return;
    }
    const input = parsedInput.data;
    if (!userId) { res.status(401).json({ error: "Müəllim hesabı tapılmadı." }); return; }
    const uploaded = await createAssignmentUploadIntent(userId, input, "assignment");
    res.json(RequestAdminAssignmentUploadUrlResponse.parse(uploaded));
  } catch (error) { next(error); }
});

router.get("/admin/assignments", requireTeacher, async (req, res, next) => {
  try {
    const { termNumber } = GetAdminAssignmentsQueryParams.parse(req.query);
    const userId = getAuth(req).userId;
    if (!userId) { res.status(401).json({ error: "Müəllim hesabı tapılmadı." }); return; }
    const rows = await db.select().from(assignmentsTable)
      .where(termNumber ? eq(assignmentsTable.termNumber, termNumber) : undefined)
      .orderBy(desc(assignmentsTable.dueAt), asc(assignmentsTable.id));
    const views = [];
    for (const assignment of rows) {
      if (!await canManageAssignment(userId, assignment)) continue;
      const view = await assignmentView(assignment);
      const [counts] = await db.select({
        submissionCount: sql<number>`count(*)`,
        gradedCount: sql<number>`count(*) filter (where ${assignmentSubmissionsTable.status} = 'graded')`,
      }).from(assignmentSubmissionsTable).where(eq(assignmentSubmissionsTable.assignmentId, assignment.id));
      views.push({
        ...view,
        teacherClerkUserId: assignment.teacherClerkUserId,
        submissionCount: Number(counts?.submissionCount ?? 0),
        gradedCount: Number(counts?.gradedCount ?? 0),
      });
    }
    res.json(GetAdminAssignmentsResponse.parse(views));
  } catch (error) { next(error); }
});

router.post("/admin/assignments", requireTeacher, async (req, res, next) => {
  try {
    const parsedInput = CreateAssignmentBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Tapşırıq məlumatları düzgün göndərilməyib." });
      return;
    }
    const input = parsedInput.data;
    const actorId = getAuth(req).userId;
    if (!actorId) { res.status(401).json({ error: "Müəllim hesabı tapılmadı." }); return; }
    if (input.dueAt.getTime() <= Date.now()) {
      res.status(400).json({ error: "Son tarix gələcək vaxt olmalıdır." });
      return;
    }
    const title = input.title.trim();
    const description = input.description.trim();
    if (!title || !description) {
      res.status(400).json({ error: "Tapşırığın başlığı və izahı boş qala bilməz." });
      return;
    }
    const [resource] = await db.select().from(resourcesTable).where(and(
      eq(resourcesTable.id, input.resourceId),
      eq(resourcesTable.courseId, input.courseId),
      eq(resourcesTable.termNumber, input.termNumber),
    )).limit(1);
    if (!resource || !resource.teacherClerkUserId || !await canManageResourceRoster(actorId, resource)) {
      res.status(403).json({ error: "Bu müəllim qrupuna tapşırıq əlavə etmək icazəniz yoxdur." });
      return;
    }
    const intentIds = input.attachmentIntentIds ?? [];
    const intents = await loadUploadIntents(intentIds, actorId, "assignment");
    const [assignment] = await db.insert(assignmentsTable).values({
      courseId: input.courseId,
      resourceId: input.resourceId,
      termNumber: input.termNumber,
      teacherClerkUserId: resource.teacherClerkUserId,
      title,
      description,
      dueAt: input.dueAt,
      maxScore: input.maxScore,
      status: "open",
    }).returning();
    if (!assignment) throw new Error("Tapşırıq yaradılmadı.");
    await attachUploadIntents(intents, assignment.id, actorId, "assignment");
    await recordAuditEvent({
      eventType: "assignment.created",
      actorClerkUserId: actorId,
      targetType: "assignment",
      targetId: assignment.id,
      details: { courseId: assignment.courseId, resourceId: assignment.resourceId, termNumber: assignment.termNumber },
      deduplicationKey: `assignment.created:${assignment.id}`,
    });
    res.status(201).json(CreateAssignmentResponse.parse({
      ...(await assignmentView(assignment)),
      teacherClerkUserId: assignment.teacherClerkUserId,
      submissionCount: 0,
      gradedCount: 0,
    }));
  } catch (error) { next(error); }
});

router.patch("/admin/assignments/:assignmentId", requireTeacher, async (req, res, next) => {
  try {
    const { assignmentId } = UpdateAssignmentParams.parse(req.params);
    const parsedInput = UpdateAssignmentBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Tapşırıq yeniləmə məlumatları düzgün göndərilməyib." });
      return;
    }
    const input = parsedInput.data;
    const actorId = getAuth(req).userId;
    if (!actorId) { res.status(401).json({ error: "Müəllim hesabı tapılmadı." }); return; }
    const [existing] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId)).limit(1);
    if (!existing || !await canManageAssignment(actorId, existing)) {
      res.status(404).json({ error: "Tapşırıq tapılmadı." });
      return;
    }
    if (input.dueAt && input.dueAt.getTime() <= Date.now() && assignmentStatus(existing) === "open") {
      res.status(400).json({ error: "Açıq tapşırığın son tarixi gələcək vaxt olmalıdır." });
      return;
    }
    const title = input.title?.trim();
    const description = input.description?.trim();
    if ((input.title !== undefined && !title) || (input.description !== undefined && !description)) {
      res.status(400).json({ error: "Tapşırığın başlığı və izahı boş qala bilməz." });
      return;
    }
    if (input.maxScore !== undefined) {
      const [maximum] = await db.select({ score: sql<number>`max(${assignmentSubmissionsTable.score})` })
        .from(assignmentSubmissionsTable).where(eq(assignmentSubmissionsTable.assignmentId, assignmentId));
      if (Number(maximum?.score ?? 0) > input.maxScore) {
        res.status(400).json({ error: "Maksimum bal mövcud qiymətlərdən aşağı ola bilməz." });
        return;
      }
    }
    const intents = input.attachmentIntentIds
      ? await loadUploadIntents(input.attachmentIntentIds, actorId, "assignment")
      : [];
    const [assignment] = await db.update(assignmentsTable).set({
      ...(title === undefined ? {} : { title }),
      ...(description === undefined ? {} : { description }),
      ...(input.dueAt === undefined ? {} : { dueAt: input.dueAt }),
      ...(input.maxScore === undefined ? {} : { maxScore: input.maxScore }),
      ...(input.status === undefined ? {} : { status: input.status }),
      updatedAt: new Date(),
    }).where(eq(assignmentsTable.id, assignmentId)).returning();
    if (!assignment) throw new Error("Tapşırıq yenilənmədi.");
    await attachUploadIntents(intents, assignmentId, actorId, "assignment");
    await recordAuditEvent({
      eventType: "assignment.updated",
      actorClerkUserId: actorId,
      targetType: "assignment",
      targetId: assignmentId,
      details: { changedFields: Object.keys(input) },
      deduplicationKey: `assignment.updated:${assignmentId}:${assignment.updatedAt.toISOString()}`,
    });
    const [counts] = await db.select({
      submissionCount: sql<number>`count(*)`,
      gradedCount: sql<number>`count(*) filter (where ${assignmentSubmissionsTable.status} = 'graded')`,
    }).from(assignmentSubmissionsTable).where(eq(assignmentSubmissionsTable.assignmentId, assignmentId));
    res.json(UpdateAssignmentResponse.parse({
      ...(await assignmentView(assignment)),
      teacherClerkUserId: assignment.teacherClerkUserId,
      submissionCount: Number(counts?.submissionCount ?? 0),
      gradedCount: Number(counts?.gradedCount ?? 0),
    }));
  } catch (error) { next(error); }
});

router.get("/admin/assignments/:assignmentId/submissions", requireTeacher, async (req, res, next) => {
  try {
    const { assignmentId } = GetAssignmentSubmissionsParams.parse(req.params);
    const actorId = getAuth(req).userId;
    const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId)).limit(1);
    if (!actorId || !assignment || !await canManageAssignment(actorId, assignment)) {
      res.status(404).json({ error: "Tapşırıq tapılmadı." });
      return;
    }
    const rows = await db.select().from(assignmentSubmissionsTable)
      .where(eq(assignmentSubmissionsTable.assignmentId, assignmentId))
      .orderBy(desc(assignmentSubmissionsTable.submittedAt));
    const views = [];
    for (const submission of rows) {
      const [student] = await db.select({
        studentNumber: studentAcademicProfilesTable.studentNumber,
        firstName: applicationsTable.firstName,
        lastName: applicationsTable.lastName,
        email: applicationsTable.email,
      }).from(studentAcademicProfilesTable)
        .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
        .where(eq(studentAcademicProfilesTable.id, submission.profileId)).limit(1);
      views.push({
        ...(await submissionView(submission)),
        studentName: student ? `${student.firstName} ${student.lastName}`.trim() : "Tələbə",
        studentNumber: student?.studentNumber ?? 0,
        email: student?.email ?? "",
      });
    }
    res.json(GetAssignmentSubmissionsResponse.parse(views));
  } catch (error) { next(error); }
});

router.post("/admin/assignments/:assignmentId/submissions/:submissionId/grade", requireTeacher, async (req, res, next) => {
  try {
    const { assignmentId, submissionId } = GradeAssignmentSubmissionParams.parse(req.params);
    const parsedInput = GradeAssignmentSubmissionBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Qiymətləndirmə məlumatları düzgün göndərilməyib." });
      return;
    }
    const input = parsedInput.data;
    const actorId = getAuth(req).userId;
    const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId)).limit(1);
    const [submission] = await db.select().from(assignmentSubmissionsTable).where(and(
      eq(assignmentSubmissionsTable.id, submissionId),
      eq(assignmentSubmissionsTable.assignmentId, assignmentId),
    )).limit(1);
    if (!actorId || !assignment || !submission || !await canManageAssignment(actorId, assignment)) {
      res.status(404).json({ error: "Təhvil tapılmadı." });
      return;
    }
    if (input.score > assignment.maxScore) {
      res.status(400).json({ error: `Bal ${assignment.maxScore}-dən çox ola bilməz.` });
      return;
    }
    const [updated] = await db.update(assignmentSubmissionsTable).set({
      score: input.score,
      feedback: input.feedback.trim() || null,
      status: "graded",
      reviewedAt: new Date(),
      reviewedByClerkUserId: actorId,
      updatedAt: new Date(),
    }).where(eq(assignmentSubmissionsTable.id, submissionId)).returning();
    if (!updated) throw new Error("Qiymət yadda saxlanmadı.");
    await syncAssignmentGrade(assignment, submission.profileId, input.score);
    await recordAuditEvent({
      eventType: "assignment.submission.graded",
      actorClerkUserId: actorId,
      targetType: "assignment_submission",
      targetId: submissionId,
      details: { assignmentId, score: input.score },
      deduplicationKey: `assignment.submission.graded:${submissionId}:${updated.updatedAt.toISOString()}`,
    });
    res.json(GradeAssignmentSubmissionResponse.parse(await submissionView(updated)));
  } catch (error) { next(error); }
});

router.post("/admin/assignments/:assignmentId/submissions/:submissionId/request-resubmission", requireTeacher, async (req, res, next) => {
  try {
    const { assignmentId, submissionId } = RequestAssignmentResubmissionParams.parse(req.params);
    const parsedInput = RequestAssignmentResubmissionBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Yenidən təhvil məlumatları düzgün göndərilməyib." });
      return;
    }
    const input = parsedInput.data;
    if (!input.feedback.trim()) {
      res.status(400).json({ error: "Yenidən təhvil üçün rəy boş qala bilməz." });
      return;
    }
    const actorId = getAuth(req).userId;
    const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId)).limit(1);
    const [submission] = await db.select().from(assignmentSubmissionsTable).where(and(
      eq(assignmentSubmissionsTable.id, submissionId),
      eq(assignmentSubmissionsTable.assignmentId, assignmentId),
    )).limit(1);
    if (!actorId || !assignment || !submission || !await canManageAssignment(actorId, assignment)) {
      res.status(404).json({ error: "Təhvil tapılmadı." });
      return;
    }
    if (assignmentStatus(assignment) === "closed") {
      res.status(409).json({ error: "Bağlanmış tapşırıq üçün yenidən təhvil tələb edilə bilməz." });
      return;
    }
    const [updated] = await db.update(assignmentSubmissionsTable).set({
      status: "resubmission_requested",
      score: null,
      feedback: input.feedback.trim(),
      reviewedAt: new Date(),
      reviewedByClerkUserId: actorId,
      updatedAt: new Date(),
    }).where(eq(assignmentSubmissionsTable.id, submissionId)).returning();
    if (!updated) throw new Error("Yenidən təhvil tələbi yadda saxlanmadı.");
    await syncAssignmentGrade(assignment, submission.profileId, null);
    await recordAuditEvent({
      eventType: "assignment.submission.resubmission_requested",
      actorClerkUserId: actorId,
      targetType: "assignment_submission",
      targetId: submissionId,
      details: { assignmentId },
      deduplicationKey: `assignment.submission.resubmission:${submissionId}:${updated.updatedAt.toISOString()}`,
    });
    res.json(RequestAssignmentResubmissionResponse.parse(await submissionView(updated)));
  } catch (error) { next(error); }
});

router.get("/admin/exams", requireTeacher, async (req, res, next) => {
  try {
    const actorId = getAuth(req).userId;
    if (!actorId) { res.status(401).json({ error: "Müəllim hesabı tapılmadı." }); return; }
    const exams = await db.select().from(examsTable).orderBy(desc(examsTable.createdAt));
    const visible = [];
    for (const exam of exams) {
      if (await canManageExam(actorId, exam)) visible.push(await adminExamView(exam));
    }
    res.json(GetAdminExamsResponse.parse(visible));
  } catch (error) { next(error); }
});

router.post("/admin/exams", requireTeacher, async (req, res, next) => {
  try {
    const parsedInput = CreateExamBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Test məlumatları düzgün göndərilməyib." });
      return;
    }
    const input = parsedInput.data;
    const actorId = getAuth(req).userId;
    if (!actorId) { res.status(401).json({ error: "Müəllim hesabı tapılmadı." }); return; }
    const resourceId = input.resourceId;
    const [resource] = resourceId
      ? await db.select().from(resourcesTable).where(eq(resourcesTable.id, resourceId)).limit(1)
      : [];
    if (!input.isOnboarding && (!resource || !await canManageResourceRoster(actorId, resource) || !resource.teacherClerkUserId)) {
      res.status(403).json({ error: "Bu müəllim qrupu üçün test yaratmağa icazəniz yoxdur." });
      return;
    }
    if (input.isOnboarding && !await userIsSystemOwner(actorId)) {
      res.status(403).json({ error: "Qəbul testini yalnız sistem sahibi idarə edə bilər." });
      return;
    }
    const questions = normalizeExamQuestions(input.questions);
    const [exam] = await db.insert(examsTable).values({
      courseId: resource?.courseId ?? 0,
      resourceId: resource?.id ?? 0,
      termNumber: resource?.termNumber ?? 1,
      teacherClerkUserId: resource?.teacherClerkUserId ?? actorId,
      title: input.title.trim(),
      description: input.description.trim(),
      status: input.status ?? "open",
      isOnboarding: input.isOnboarding ?? false,
      durationMinutes: input.durationMinutes ?? null,
    }).returning();
    if (!exam) throw new Error("Test yaradılmadı.");
    await replaceExamQuestions(exam.id, questions);
    await recordAuditEvent({
      eventType: "exam.created",
      actorClerkUserId: actorId,
      targetType: "exam",
      targetId: exam.id,
      details: { resourceId: resource?.id ?? null, isOnboarding: input.isOnboarding ?? false, questionCount: questions.length },
      deduplicationKey: `exam.created:${exam.id}`,
    });
    res.status(201).json(CreateExamResponse.parse(await adminExamView(exam)));
  } catch (error) {
    if (error instanceof ExamValidationError) { res.status(400).json({ error: error.message }); return; }
    next(error);
  }
});

router.patch("/admin/exams/:examId", requireTeacher, async (req, res, next) => {
  try {
    const { examId } = UpdateExamRouteParams.parse(req.params);
    const parsedInput = UpdateExamRouteBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Test yeniləmə məlumatları düzgün göndərilməyib." });
      return;
    }
    const input = parsedInput.data;
    const actorId = getAuth(req).userId;
    if (!actorId) { res.status(401).json({ error: "Müəllim hesabı tapılmadı." }); return; }
    const [existing] = await db.select().from(examsTable).where(eq(examsTable.id, examId)).limit(1);
    if (!existing || !await canManageExam(actorId, existing)) {
      res.status(404).json({ error: "Test tapılmadı." });
      return;
    }
    if ((existing.isOnboarding || input.isOnboarding) && !await userIsSystemOwner(actorId)) {
      res.status(403).json({ error: "Qəbul testini yalnız sistem sahibi idarə edə bilər." });
      return;
    }
    const questions = input.questions ? normalizeExamQuestions(input.questions) : undefined;
    const [exam] = await db.update(examsTable).set({
      ...(input.title === undefined ? {} : { title: input.title.trim() }),
      ...(input.description === undefined ? {} : { description: input.description.trim() }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.isOnboarding === undefined ? {} : { isOnboarding: input.isOnboarding }),
      ...(input.durationMinutes === undefined ? {} : { durationMinutes: input.durationMinutes }),
      updatedAt: new Date(),
    }).where(eq(examsTable.id, examId)).returning();
    if (!exam) throw new Error("Test yenilənmədi.");
    if (questions) await replaceExamQuestions(exam.id, questions);
    await recordAuditEvent({
      eventType: "exam.updated",
      actorClerkUserId: actorId,
      targetType: "exam",
      targetId: exam.id,
      details: { changedFields: Object.keys(input) },
      deduplicationKey: `exam.updated:${exam.id}:${exam.updatedAt.toISOString()}`,
    });
    res.json(UpdateExamRouteResponse.parse(await adminExamView(exam)));
  } catch (error) {
    if (error instanceof ExamValidationError) { res.status(400).json({ error: error.message }); return; }
    next(error);
  }
});

router.delete("/admin/exams/:examId", requireTeacher, async (req, res, next) => {
  try {
    const { examId } = DeleteExamParams.parse(req.params);
    const actorId = getAuth(req).userId;
    if (!actorId) { res.status(401).json({ error: "Müəllim hesabı tapılmadı." }); return; }
    const [existing] = await db.select().from(examsTable).where(eq(examsTable.id, examId)).limit(1);
    if (!existing || !await canManageExam(actorId, existing)) {
      res.status(404).json({ error: "Test tapılmadı." });
      return;
    }
    if (existing.isOnboarding && !await userIsSystemOwner(actorId)) {
      res.status(403).json({ error: "Qəbul testini yalnız sistem sahibi silə bilər." });
      return;
    }
    await db.transaction(async (tx) => {
      const questions = await tx.select({ id: examQuestionsTable.id })
        .from(examQuestionsTable).where(eq(examQuestionsTable.examId, examId));
      if (questions.length) {
        await tx.delete(examOptionsTable).where(inArray(examOptionsTable.questionId, questions.map((question) => question.id)));
      }
      await tx.delete(examSubmissionsTable).where(eq(examSubmissionsTable.examId, examId));
      await tx.delete(examAttemptsTable).where(eq(examAttemptsTable.examId, examId));
      await tx.delete(onboardingExamAssignmentsTable).where(eq(onboardingExamAssignmentsTable.examId, examId));
      await tx.delete(examQuestionsTable).where(eq(examQuestionsTable.examId, examId));
      const deleted = await tx.delete(examsTable).where(eq(examsTable.id, examId)).returning({ id: examsTable.id });
      if (!deleted.length) throw new Error("Test silinmədi.");
    });
    await recordAuditEvent({
      eventType: "exam.deleted",
      actorClerkUserId: actorId,
      targetType: "exam",
      targetId: examId,
      details: { isOnboarding: existing.isOnboarding, title: existing.title },
      deduplicationKey: `exam.deleted:${examId}:${new Date().toISOString()}`,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/admin/exams/:examId/submissions", requireTeacher, async (req, res, next) => {
  try {
    const { examId } = GetExamSubmissionsParams.parse(req.params);
    const actorId = getAuth(req).userId;
    const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId)).limit(1);
    if (!actorId || !exam || !await canManageExam(actorId, exam)) {
      res.status(404).json({ error: "Test tapılmadı." });
      return;
    }
    const [questions, submissions] = await Promise.all([
      db.select().from(examQuestionsTable).where(eq(examQuestionsTable.examId, examId)),
      db.select().from(examSubmissionsTable).where(eq(examSubmissionsTable.examId, examId)).orderBy(desc(examSubmissionsTable.submittedAt)),
    ]);
    const options = questions.length
      ? await db.select().from(examOptionsTable).where(inArray(examOptionsTable.questionId, questions.map((question) => question.id)))
      : [];
    const optionLabels = new Map(options.map((option) => [option.id, option.label]));
    const questionNumbers = new Map(questions.map((question, index) => [question.id, index + 1]));
    const result = [];
    for (const submission of submissions) {
      const [profile] = await db.select().from(studentAcademicProfilesTable).where(eq(studentAcademicProfilesTable.id, submission.profileId)).limit(1);
      const [application] = profile
        ? await db.select().from(applicationsTable).where(eq(applicationsTable.id, profile.applicationId)).limit(1)
        : [];
      if (!profile || !application) continue;
      const [assignment] = exam.isOnboarding
        ? await db.select({ reviewStatus: onboardingExamAssignmentsTable.reviewStatus })
          .from(onboardingExamAssignmentsTable)
          .where(and(
            eq(onboardingExamAssignmentsTable.examId, examId),
            eq(onboardingExamAssignmentsTable.profileId, submission.profileId),
          )).limit(1)
        : [];
      result.push({
        id: submission.id,
        examId: submission.examId,
        profileId: submission.profileId,
        answers: submission.answers,
        submittedAt: submission.submittedAt,
         result: calculateExamResult(questions, options, submission.answers),
        studentName: `${application.firstName} ${application.lastName}`.trim(),
        studentNumber: profile.studentNumber,
        email: application.email,
        reviewStatus: exam.isOnboarding ? assignment?.reviewStatus ?? "pending" : "approved",
        answerLabels: Object.fromEntries(Object.entries(submission.answers).map(([questionId, optionId]) => [
          questionId,
          `${questionNumbers.get(Number(questionId)) ?? "?"}. ${optionLabels.get(optionId) ?? "Variant tapılmadı"}`,
        ])),
      });
    }
    res.json(GetExamSubmissionsResponse.parse(result));
  } catch (error) { next(error); }
});

router.post("/admin/exams/:examId/submissions/:profileId/resend", requireTeacher, async (req, res, next) => {
  try {
    const examId = Number(req.params.examId);
    const profileId = Number(req.params.profileId);
    const actorId = getAuth(req).userId;
    if (!Number.isInteger(examId) || examId <= 0 || !Number.isInteger(profileId) || profileId <= 0) {
      res.status(400).json({ error: "Test və tələbə nömrəsi düzgün deyil." });
      return;
    }
    const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId)).limit(1);
    if (!actorId || !exam || !await canManageExam(actorId, exam)) {
      res.status(404).json({ error: "Test tapılmadı." });
      return;
    }
    if (exam.status !== "open") {
      res.status(409).json({ error: "Bağlanmış test yenidən göndərilə bilməz." });
      return;
    }
    const [profile] = await db.select({
      profile: studentAcademicProfilesTable,
      application: applicationsTable,
    }).from(studentAcademicProfilesTable)
      .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
      .where(and(eq(studentAcademicProfilesTable.id, profileId), eq(applicationsTable.status, "approved"), isNull(applicationsTable.deletedAt)))
      .limit(1);
    if (!profile) {
      res.status(404).json({ error: "Təsdiqlənmiş tələbə tapılmadı." });
      return;
    }
    if (!exam.isOnboarding) {
      const resource = await examResource(exam);
      if (!resource || !await studentMayAttendResource(profileId, resource)) {
        res.status(403).json({ error: "Bu tələbəyə həmin testi yenidən göndərmək mümkün deyil." });
        return;
      }
    }
    await db.delete(examSubmissionsTable).where(and(
      eq(examSubmissionsTable.examId, examId),
      eq(examSubmissionsTable.profileId, profileId),
    ));
    await db.delete(examAttemptsTable).where(and(
      eq(examAttemptsTable.examId, examId),
      eq(examAttemptsTable.profileId, profileId),
    ));
    if (exam.isOnboarding) {
      await db.update(studentAcademicProfilesTable)
        .set({ onboardingExamEligible: true, updatedAt: new Date().toISOString() })
        .where(eq(studentAcademicProfilesTable.id, profileId));
      await db.update(onboardingExamAssignmentsTable).set({
        reviewStatus: "pending",
        reviewedAt: null,
        reviewedByClerkUserId: null,
      }).where(and(
        eq(onboardingExamAssignmentsTable.examId, examId),
        eq(onboardingExamAssignmentsTable.profileId, profileId),
      ));
    }
    await recordAuditEvent({
      eventType: "exam.submission.resent",
      actorClerkUserId: actorId,
      targetType: "exam",
      targetId: examId,
      details: { profileId },
      deduplicationKey: `exam.submission.resent:${examId}:${profileId}:${Date.now()}`,
    });
    res.json(ResendExamToStudentResponse.parse({ examId, profileId, resent: true }));
  } catch (error) { next(error); }
});

router.post("/admin/exams/:examId/submissions/:profileId/approve", requireTeacher, async (req, res, next) => {
  try {
    const examId = Number(req.params.examId);
    const profileId = Number(req.params.profileId);
    const actorId = getAuth(req).userId;
    if (!Number.isInteger(examId) || examId <= 0 || !Number.isInteger(profileId) || profileId <= 0) {
      res.status(400).json({ error: "Test və tələbə nömrəsi düzgün deyil." });
      return;
    }
    const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId)).limit(1);
    if (!actorId || !exam || !await canManageExam(actorId, exam)) {
      res.status(404).json({ error: "Test tapılmadı." });
      return;
    }
    if (!exam.isOnboarding) {
      res.status(400).json({ error: "Yalnız qəbul testləri təsdiqlənə bilər." });
      return;
    }
    const [submission] = await db.select().from(examSubmissionsTable).where(and(
      eq(examSubmissionsTable.examId, examId),
      eq(examSubmissionsTable.profileId, profileId),
    )).limit(1);
    if (!submission) {
      res.status(404).json({ error: "Tələbənin imtahan cavabı tapılmadı." });
      return;
    }
    const [assignment] = await db.update(onboardingExamAssignmentsTable).set({
      reviewStatus: "approved",
      reviewedAt: new Date(),
      reviewedByClerkUserId: actorId,
    }).where(and(
      eq(onboardingExamAssignmentsTable.examId, examId),
      eq(onboardingExamAssignmentsTable.profileId, profileId),
    )).returning();
    if (!assignment) {
      res.status(404).json({ error: "Tələbənin qəbul imtahanı təyinatı tapılmadı." });
      return;
    }
    await recordAuditEvent({
      eventType: "exam.submission.approved",
      actorClerkUserId: actorId,
      targetType: "exam",
      targetId: examId,
      details: { profileId },
      deduplicationKey: `exam.submission.approved:${examId}:${profileId}:${assignment.reviewedAt?.toISOString() ?? Date.now()}`,
    });
    res.json(ApproveExamSubmissionResponse.parse({ examId, profileId, reviewStatus: "approved" }));
  } catch (error) { next(error); }
});

router.get("/admin/resources/:resourceId/students", requireTeacher, async (req, res, next) => {
  try {
    const resourceId = Number(req.params.resourceId);
    const { userId } = getAuth(req);
    const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, resourceId)).limit(1);
    if (!resource) { res.status(404).json({ error: "Dərs tapılmadı." }); return; }
    if (!userId || !await canManageResourceRoster(userId, resource)) {
      res.status(403).json({ error: "Bu müəllim qrupuna giriş icazəniz yoxdur." });
      return;
    }
    const rows = await db.select({
      profileId: studentAcademicProfilesTable.id,
      studentNumber: studentAcademicProfilesTable.studentNumber,
      firstName: applicationsTable.firstName,
      lastName: applicationsTable.lastName,
      username: applicationsTable.username,
    }).from(studentAcademicProfilesTable)
      .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
      .where(and(eq(applicationsTable.status, "approved"), isNull(applicationsTable.deletedAt)))
      .orderBy(asc(applicationsTable.firstName), asc(applicationsTable.lastName));
    const selected = await db.select({ profileId: studentTeacherChoicesTable.profileId })
      .from(studentTeacherChoicesTable)
      .where(and(eq(studentTeacherChoicesTable.resourceId, resourceId), eq(studentTeacherChoicesTable.status, "approved")));
    const sameCourseResources = await db.select({ id: resourcesTable.id }).from(resourcesTable).where(and(
      eq(resourcesTable.courseId, resource.courseId),
      eq(resourcesTable.termNumber, resource.termNumber),
    ));
    const otherResourceIds = sameCourseResources.map((item) => item.id).filter((id) => id !== resourceId);
    const unavailable = otherResourceIds.length
      ? await db.select({ profileId: studentTeacherChoicesTable.profileId })
        .from(studentTeacherChoicesTable)
        .where(and(inArray(studentTeacherChoicesTable.resourceId, otherResourceIds), or(eq(studentTeacherChoicesTable.status, "pending"), eq(studentTeacherChoicesTable.status, "approved"))))
      : [];
    res.json({
      students: rows,
      selectedProfileIds: selected.map((item) => item.profileId),
      unavailableProfileIds: unavailable.map((item) => item.profileId),
    });
  } catch (error) { next(error); }
});

router.put("/admin/resources/:resourceId/students", requireTeacher, async (req, res, next) => {
  try {
    const resourceId = Number(req.params.resourceId);
    const { userId } = getAuth(req);
    const profileIds = Array.isArray(req.body?.profileIds)
      ? req.body.profileIds.filter((id: unknown): id is number => typeof id === "number" && Number.isInteger(id) && id > 0)
      : [];
    const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, resourceId)).limit(1);
    if (!resource) { res.status(404).json({ error: "Dərs tapılmadı." }); return; }
    if (!userId || !await canManageResourceRoster(userId, resource)) {
      res.status(403).json({ error: "Bu müəllim qrupuna giriş icazəniz yoxdur." });
      return;
    }
    if (new Set(profileIds).size !== profileIds.length) { res.status(400).json({ error: "Tələbə seçimi təkrarlana bilməz." }); return; }
    if (resource.studentCapacity > 0 && profileIds.length > resource.studentCapacity) {
      res.status(400).json({ error: `Bu qrup üçün ən çox ${resource.studentCapacity} tələbə seçə bilərsiniz.` });
      return;
    }
    const result = await db.transaction(async (tx) => {
      // Serialize roster changes for the same subject/semester so two groups
      // cannot claim the same student at the same time.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${"teacher-choice:" + resource.courseId + ":" + resource.termNumber}, 0))`);
      const courseResources = await tx.select({ id: resourcesTable.id }).from(resourcesTable).where(and(
        eq(resourcesTable.courseId, resource.courseId),
        eq(resourcesTable.termNumber, resource.termNumber),
      ));
      const otherResourceIds = courseResources.map((item) => item.id).filter((id) => id !== resourceId);
      const approvedProfiles = await tx.select({ id: studentAcademicProfilesTable.id })
        .from(studentAcademicProfilesTable)
        .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
        .where(and(inArray(studentAcademicProfilesTable.id, profileIds), eq(applicationsTable.status, "approved"), isNull(applicationsTable.deletedAt)));
      const validIds = approvedProfiles.map((item) => item.id);
      if (validIds.length !== profileIds.length) return { status: 400, error: "Seçilən tələbələrdən biri artıq aktiv deyil." } as const;
      const pendingChoices = await tx.select({ profileId: studentTeacherChoicesTable.profileId })
        .from(studentTeacherChoicesTable)
        .where(and(
          eq(studentTeacherChoicesTable.resourceId, resourceId),
          eq(studentTeacherChoicesTable.status, "pending"),
        ));
      const pendingOutsideRoster = pendingChoices.filter((choice) => !validIds.includes(choice.profileId));
      if (resource.studentCapacity > 0 && new Set([...validIds, ...pendingOutsideRoster.map((choice) => choice.profileId)]).size > resource.studentCapacity) {
        return { status: 409, error: `Bu müəllim qrupu artıq doludur. ${pendingOutsideRoster.length} gözləmədə olan seçim əvvəlcə qərarlandırılmalıdır.` } as const;
      }
      if (otherResourceIds.length && validIds.length) {
        const duplicate = await tx.select({ profileId: studentTeacherChoicesTable.profileId })
          .from(studentTeacherChoicesTable)
          .where(and(
            inArray(studentTeacherChoicesTable.profileId, validIds),
            inArray(studentTeacherChoicesTable.resourceId, otherResourceIds),
            or(eq(studentTeacherChoicesTable.status, "pending"), eq(studentTeacherChoicesTable.status, "approved")),
          ))
          .limit(1);
        if (duplicate.length) return { status: 409, error: "Seçilən tələbələrdən biri həmin fənn üzrə başqa müəllim qrupundadır." } as const;
      }
      await tx.delete(studentTeacherChoicesTable).where(and(
        eq(studentTeacherChoicesTable.resourceId, resourceId),
        eq(studentTeacherChoicesTable.status, "approved"),
        ...(validIds.length ? [notInArray(studentTeacherChoicesTable.profileId, validIds)] : []),
      ));
      if (validIds.length) {
        const now = new Date().toISOString();
        await tx.insert(studentTeacherChoicesTable).values(validIds.map((profileId) => ({
          profileId,
          resourceId,
          status: "approved",
          createdAt: now,
          reviewedAt: now,
        }))).onConflictDoUpdate({
          target: [studentTeacherChoicesTable.profileId, studentTeacherChoicesTable.resourceId],
          set: { status: "approved", reviewedAt: now },
        });
      }
      return { status: 200, selectedProfileIds: validIds } as const;
    });
    if ("error" in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ selectedProfileIds: result.selectedProfileIds });
  } catch (error) { next(error); }
});

router.get("/student/teacher-choices", requireApprovedStudent, async (req, res, next) => {
  try {
    const termNumber = Number(req.query.termNumber);
    const { userId } = getAuth(req);
    const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.clerkUserId, userId as string)).limit(1);
    if (!application || !Number.isInteger(termNumber) || termNumber < 1 || termNumber > 8) { res.status(400).json({ error: "Semestr düzgün seçilməyib." }); return; }
    const profile = await ensureAcademicProfile(application);
    const [resources, courses] = await Promise.all([
      db.select().from(resourcesTable).where(eq(resourcesTable.termNumber, termNumber)).orderBy(asc(resourcesTable.id)),
      getCourses(),
    ]);
    const courseNames = new Map(courses.map((course) => [course.id, course.title]));
    const choices = await db.select().from(studentTeacherChoicesTable).where(eq(studentTeacherChoicesTable.profileId, profile.id));
    const activeChoiceCounts = resources.length
      ? await db.select({
        resourceId: studentTeacherChoicesTable.resourceId,
        count: sql<number>`count(*)`,
      }).from(studentTeacherChoicesTable).where(and(
        inArray(studentTeacherChoicesTable.resourceId, resources.map((resource) => resource.id)),
        or(eq(studentTeacherChoicesTable.status, "pending"), eq(studentTeacherChoicesTable.status, "approved")),
      )).groupBy(studentTeacherChoicesTable.resourceId)
      : [];
    const activeChoiceCountByResource = new Map(activeChoiceCounts.map((row) => [row.resourceId, Number(row.count)]));
    const teacherNames = new Map((await activeTeachers()).map((teacher) => [teacher.clerkUserId, teacher.displayName]));
    res.json(resources.filter((resource) => resource.teacherClerkUserId).map((resource) => ({
      resourceId: resource.id, courseId: resource.courseId, termNumber: resource.termNumber,
      courseTitle: courseNames.get(resource.courseId) ?? "Fənn", teacherClerkUserId: resource.teacherClerkUserId,
      teacherName: teacherNames.get(resource.teacherClerkUserId as string) ?? "Müəllim",
      status: choices.find((choice) => choice.resourceId === resource.id)?.status ?? null,
      studentCapacity: resource.studentCapacity,
      activeChoiceCount: activeChoiceCountByResource.get(resource.id) ?? 0,
      isFull: resource.studentCapacity > 0 && (activeChoiceCountByResource.get(resource.id) ?? 0) >= resource.studentCapacity,
    })));
  } catch (error) { next(error); }
});

router.post("/student/teacher-choices", requireApprovedStudent, async (req, res, next) => {
  try {
    const resourceId = Number(req.body?.resourceId);
    const { userId } = getAuth(req);
    if (!Number.isInteger(resourceId) || resourceId <= 0) { res.status(400).json({ error: "Müəllim seçimi düzgün deyil." }); return; }
    const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.clerkUserId, userId as string)).limit(1);
    if (!application) { res.status(404).json({ error: "Tələbə profili tapılmadı." }); return; }
    const profile = await ensureAcademicProfile(application);
    const [resource] = await db.select().from(resourcesTable).where(eq(resourcesTable.id, resourceId)).limit(1);
    if (!resource || !resource.teacherClerkUserId) { res.status(404).json({ error: "Müəllim qrupu tapılmadı." }); return; }
    const result = await db.transaction(async (tx) => {
      // Serialize all choices for this subject/semester so simultaneous requests
      // cannot reserve more seats than the group capacity.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${"teacher-choice:" + resource.courseId + ":" + resource.termNumber}, 0))`);
      const courseResources = await tx.select({ id: resourcesTable.id }).from(resourcesTable).where(and(
        eq(resourcesTable.courseId, resource.courseId),
        eq(resourcesTable.termNumber, resource.termNumber),
        sql`${resourcesTable.teacherClerkUserId} IS NOT NULL`,
      ));
      const resourceIds = courseResources.map((item) => item.id);
      const existingChoices = resourceIds.length
        ? await tx.select().from(studentTeacherChoicesTable).where(and(
          eq(studentTeacherChoicesTable.profileId, profile.id),
          inArray(studentTeacherChoicesTable.resourceId, resourceIds),
          or(eq(studentTeacherChoicesTable.status, "pending"), eq(studentTeacherChoicesTable.status, "approved")),
        ))
        : [];
      if (existingChoices.some((choice) => choice.resourceId === resourceId)) {
        return { status: 409, error: "Bu müəllim üçün artıq seçim göndərilib." } as const;
      }
      if (existingChoices.length) {
        return { status: 409, error: "Bu fənn üzrə artıq aktiv müəllim seçiminiz var." } as const;
      }
      const groupChoices = await tx.select({ id: studentTeacherChoicesTable.id }).from(studentTeacherChoicesTable).where(and(
        eq(studentTeacherChoicesTable.resourceId, resourceId),
        or(eq(studentTeacherChoicesTable.status, "pending"), eq(studentTeacherChoicesTable.status, "approved")),
      ));
      if (resource.studentCapacity > 0 && groupChoices.length >= resource.studentCapacity) {
        return { status: 409, error: "Bu müəllim qrupu artıq doludur." } as const;
      }
      const [created] = await tx.insert(studentTeacherChoicesTable).values({
        profileId: profile.id,
        resourceId,
        createdAt: new Date().toISOString(),
      }).returning();
      return { status: 201, created } as const;
    });
    if ("error" in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const [activeChoiceCountRow, courseList, teacherList] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(studentTeacherChoicesTable).where(and(
        eq(studentTeacherChoicesTable.resourceId, resource.id),
        or(eq(studentTeacherChoicesTable.status, "pending"), eq(studentTeacherChoicesTable.status, "approved")),
      )),
      getCourses(),
      activeTeachers(),
    ]);
    const activeChoiceCount = Number(activeChoiceCountRow[0]?.count ?? 0);
    res.status(201).json({
      resourceId: resource.id,
      courseId: resource.courseId,
      termNumber: resource.termNumber,
      courseTitle: courseList.find((course) => course.id === resource.courseId)?.title ?? "Fənn",
      teacherClerkUserId: resource.teacherClerkUserId,
      teacherName: teacherList.find((teacher) => teacher.clerkUserId === resource.teacherClerkUserId)?.displayName ?? "Müəllim",
      status: result.created.status,
      studentCapacity: resource.studentCapacity,
      activeChoiceCount,
      isFull: resource.studentCapacity > 0 && activeChoiceCount >= resource.studentCapacity,
    });
  } catch (error) { next(error); }
});

router.get("/admin/teacher-choices", requireTeacher, async (req, res, next) => {
  try {
    const rows = await db.select().from(studentTeacherChoicesTable).orderBy(desc(studentTeacherChoicesTable.createdAt));
    const resources = await db.select().from(resourcesTable);
    const activeChoiceCounts = resources.length
      ? await db.select({
        resourceId: studentTeacherChoicesTable.resourceId,
        count: sql<number>`count(*)`,
      }).from(studentTeacherChoicesTable).where(and(
        inArray(studentTeacherChoicesTable.resourceId, resources.map((resource) => resource.id)),
        or(eq(studentTeacherChoicesTable.status, "pending"), eq(studentTeacherChoicesTable.status, "approved")),
      )).groupBy(studentTeacherChoicesTable.resourceId)
      : [];
    const activeChoiceCountByResource = new Map(activeChoiceCounts.map((row) => [row.resourceId, Number(row.count)]));
    const resourceMap = new Map(resources.map((resource) => [resource.id, resource]));
    const teacherNames = new Map((await activeTeachers()).map((teacher) => [teacher.clerkUserId, teacher.displayName]));
    const profiles = await db.select().from(studentAcademicProfilesTable);
    const applications = await db.select().from(applicationsTable);
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const applicationMap = new Map(applications.map((application) => [application.id, application]));
    res.json(rows.filter((row) => resourceMap.has(row.resourceId)).map((row) => {
      const resource = resourceMap.get(row.resourceId)!;
      const profile = profileMap.get(row.profileId);
      const application = profile ? applicationMap.get(profile.applicationId) : undefined;
       const activeChoiceCount = activeChoiceCountByResource.get(resource.id) ?? 0;
       return { id: row.id, resourceId: row.resourceId, courseId: resource.courseId, termNumber: resource.termNumber, teacherName: teacherNames.get(resource.teacherClerkUserId as string) ?? "Müəllim", studentName: application ? `${application.firstName} ${application.lastName}` : "Tələbə", status: row.status, createdAt: row.createdAt, studentCapacity: resource.studentCapacity, activeChoiceCount, isFull: resource.studentCapacity > 0 && activeChoiceCount >= resource.studentCapacity };
    }));
  } catch (error) { next(error); }
});

router.patch("/admin/teacher-choices/:choiceId", requireOwnerOrAssistantPermission("schedule"), async (req, res, next) => {
  try {
    const choiceId = Number(req.params.choiceId);
    const decision = req.body?.decision;
    if (!Number.isInteger(choiceId) || !["approved", "rejected"].includes(decision)) { res.status(400).json({ error: "Qərar düzgün seçilməyib." }); return; }
    const result = await db.transaction(async (tx) => {
      const [pendingChoice] = await tx.select().from(studentTeacherChoicesTable).where(and(
        eq(studentTeacherChoicesTable.id, choiceId),
        eq(studentTeacherChoicesTable.status, "pending"),
      )).limit(1);
      if (!pendingChoice) return { status: 404, error: "Gözləmədə olan seçim tapılmadı." } as const;
      const [resource] = await tx.select().from(resourcesTable).where(eq(resourcesTable.id, pendingChoice.resourceId)).limit(1);
      if (!resource) return { status: 404, error: "Müəllim qrupu tapılmadı." } as const;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${"teacher-choice:" + resource.courseId + ":" + resource.termNumber}, 0))`);
      const courseResources = await tx.select({ id: resourcesTable.id }).from(resourcesTable).where(and(
        eq(resourcesTable.courseId, resource.courseId),
        eq(resourcesTable.termNumber, resource.termNumber),
        sql`${resourcesTable.teacherClerkUserId} IS NOT NULL`,
      ));
      const activeChoices = await tx.select({ id: studentTeacherChoicesTable.id }).from(studentTeacherChoicesTable).where(and(
        eq(studentTeacherChoicesTable.resourceId, pendingChoice.resourceId),
        or(eq(studentTeacherChoicesTable.status, "pending"), eq(studentTeacherChoicesTable.status, "approved")),
      ));
      if (decision === "approved" && resource.studentCapacity > 0 && activeChoices.length > resource.studentCapacity) {
        return { status: 409, error: "Bu müəllim qrupu artıq doludur." } as const;
      }
      const duplicateSubjectChoice = courseResources.length
        ? await tx.select({ id: studentTeacherChoicesTable.id }).from(studentTeacherChoicesTable).where(and(
          eq(studentTeacherChoicesTable.profileId, pendingChoice.profileId),
          inArray(studentTeacherChoicesTable.resourceId, courseResources.map((item) => item.id)),
          or(eq(studentTeacherChoicesTable.status, "approved"), eq(studentTeacherChoicesTable.status, "pending")),
          sql`${studentTeacherChoicesTable.id} <> ${pendingChoice.id}`,
        )).limit(1)
        : [];
      if (decision === "approved" && duplicateSubjectChoice.length) {
        return { status: 409, error: "Bu tələbənin həmin fənn üzrə başqa aktiv müəllim seçimi var." } as const;
      }
      const [choice] = await tx.update(studentTeacherChoicesTable).set({ status: decision, reviewedAt: new Date().toISOString() }).where(and(
        eq(studentTeacherChoicesTable.id, choiceId),
        eq(studentTeacherChoicesTable.status, "pending"),
      )).returning();
      return choice ? { status: 200, choice } as const : { status: 404, error: "Gözləmədə olan seçim tapılmadı." } as const;
    });
    if ("error" in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const actorId = getAuth(req).userId;
    const [studentProfile] = await db.select({ clerkUserId: studentAcademicProfilesTable.clerkUserId })
      .from(studentAcademicProfilesTable)
      .where(eq(studentAcademicProfilesTable.id, result.choice.profileId))
      .limit(1);
    if (actorId && studentProfile?.clerkUserId) {
      const approved = result.choice.status === "approved";
      await db.insert(messagesTable).values({
          senderClerkUserId: actorId,
          recipientClerkUserId: studentProfile.clerkUserId,
          subject: "Müəllim seçimi barədə qərar",
          body: approved
            ? "Müəllim seçiminiz təsdiqləndi. Seçdiyiniz müəllim qrupu artıq dərs cədvəlinizdə aktivdir."
            : "Müəllim seçiminiz təsdiqlənmədi. Dərs üçün başqa müəllim qrupunu seçə bilərsiniz.",
          createdAt: new Date().toISOString(),
        }).catch(() => undefined);
      await recordAuditEvent({
        eventType: `teacher.choice.${result.choice.status}`,
        actorClerkUserId: actorId,
        targetType: "teacher_choice",
        targetId: result.choice.id,
        details: { profileId: result.choice.profileId, resourceId: result.choice.resourceId },
        deduplicationKey: `teacher.choice.${result.choice.status}:${result.choice.id}`,
      });
    }
    res.json(result.choice);
  } catch (error) { next(error); }
});

router.get("/admin/applications", requireTeacher, async (_req, res, next) => {
  try {
    const applications = await db.select().from(applicationsTable).orderBy(desc(applicationsTable.id));
    await Promise.all(applications.map(cleanupRejectedApplicationFiles));
    res.json(GetAdminApplicationsResponse.parse(applications.map(toApplication)));
  } catch (error) {
    next(error);
  }
});

router.get("/application-window", async (_req, res, next) => {
  try {
    res.json(GetApplicationWindowResponse.parse(await getApplicationWindow()));
  } catch (error) {
    next(error);
  }
});

router.get("/system-statistics", async (_req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(await getSystemStatistics());
  } catch (error) {
    next(error);
  }
});

router.get("/admin/application-window", requireOwnerOrAssistant, async (_req, res, next) => {
  try {
    res.json(GetAdminApplicationWindowResponse.parse(await getApplicationWindow()));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/admission-mode", requireSystemOwner, async (_req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(GetAdminAdmissionModeResponse.parse({ examRequired: await getAdmissionExamRequired() }));
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/admission-mode", requireSystemOwner, async (req, res, next) => {
  try {
    const input = UpdateAdminAdmissionModeBody.parse(req.body);
    const updatedAt = new Date().toISOString();
    await db.insert(applicationSettingsTable).values({
      id: 1,
      opensAt: null,
      closesAt: null,
      admissionExamRequired: input.examRequired,
      updatedAt,
    }).onConflictDoUpdate({
      target: applicationSettingsTable.id,
      set: { admissionExamRequired: input.examRequired, updatedAt },
    });
    const actorId = getAuth(req).userId;
    if (actorId) {
      await recordAuditEvent({
        eventType: "admission.mode.updated",
        actorClerkUserId: actorId,
        targetType: "application_settings",
        targetId: "1",
        details: { examRequired: input.examRequired },
        deduplicationKey: `admission.mode.updated:${updatedAt}`,
      });
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(UpdateAdminAdmissionModeResponse.parse({ examRequired: input.examRequired }));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/system-statistics", requireSystemOwner, async (_req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(await getSystemStatistics());
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/system-statistics", requireSystemOwner, async (req, res, next) => {
  try {
    if (typeof req.body?.visible !== "boolean") {
      res.status(400).json({ error: "Görünürlük seçimi düzgün göndərilməyib." });
      return;
    }
    const updatedAt = new Date().toISOString();
    await db.insert(applicationSettingsTable).values({
      id: 1,
      opensAt: null,
      closesAt: null,
      statisticsVisible: req.body.visible,
      updatedAt,
    }).onConflictDoUpdate({
      target: applicationSettingsTable.id,
      set: { statisticsVisible: req.body.visible, updatedAt },
    });
    res.setHeader("Cache-Control", "no-store");
    res.json(await getSystemStatistics());
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/application-window", requireOwnerOrAssistant, async (req, res, next) => {
  try {
    const input = UpdateAdminApplicationWindowBody.parse(req.body);
    if ((input.opensAt === null) !== (input.closesAt === null)) {
      res.status(400).json({ error: "Başlama və bitmə vaxtlarını birlikdə daxil edin və ya hər ikisini təmizləyin." });
      return;
    }
    if (input.opensAt && input.closesAt) {
      const opens = input.opensAt.getTime();
      const closes = input.closesAt.getTime();
      if (!Number.isFinite(opens) || !Number.isFinite(closes) || closes <= opens) {
        res.status(400).json({ error: "Bitmə vaxtı başlama vaxtından sonra olmalıdır." });
        return;
      }
    }
    const updatedAt = new Date().toISOString();
    const opensAt = input.opensAt?.toISOString() ?? null;
    const closesAt = input.closesAt?.toISOString() ?? null;
    await db.insert(applicationSettingsTable).values({
      id: 1,
      opensAt,
      closesAt,
      updatedAt,
    }).onConflictDoUpdate({
      target: applicationSettingsTable.id,
      set: { opensAt, closesAt, updatedAt },
    });
    res.json(UpdateAdminApplicationWindowResponse.parse(await getApplicationWindow()));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/semester-dates", requireTeacher, async (_req, res, next) => {
  try {
    res.json(await getSemesterDates());
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/semester-dates/:termNumber", requireTeacher, async (req, res, next) => {
  try {
    const termNumber = Number(req.params.termNumber);
    const { startDate, endDate } = req.body ?? {};
    if (!Number.isInteger(termNumber) || termNumber < 1 || termNumber > 8) {
      res.status(400).json({ error: "Semestr 1 ilə 8 arasında olmalıdır." });
      return;
    }
    if ((startDate && !endDate) || (!startDate && endDate)) {
      res.status(400).json({ error: "Başlama və bitmə tarixlərini birlikdə daxil edin." });
      return;
    }
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if ((startDate && !datePattern.test(startDate)) || (endDate && !datePattern.test(endDate))) {
      res.status(400).json({ error: "Tarix formatı düzgün deyil." });
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      res.status(400).json({ error: "Bitmə tarixi başlama tarixindən sonra olmalıdır." });
      return;
    }
    const [settings] = await db.select().from(applicationSettingsTable)
      .where(eq(applicationSettingsTable.id, 1)).limit(1);
    const dates = parseSemesterDates(settings?.semesterDates);
    dates[String(termNumber)] = { startDate: startDate || null, endDate: endDate || null };
    const updatedAt = new Date().toISOString();
    await db.insert(applicationSettingsTable).values({
      id: 1,
      opensAt: settings?.opensAt ?? null,
      closesAt: settings?.closesAt ?? null,
      statisticsVisible: settings?.statisticsVisible ?? false,
      semesterDates: JSON.stringify(dates),
      updatedAt,
    }).onConflictDoUpdate({
      target: applicationSettingsTable.id,
      set: { semesterDates: JSON.stringify(dates), updatedAt },
    });
    res.json(await getSemesterDates());
  } catch (error) {
    next(error);
  }
});

router.get("/admin/course-activation", requireTeacher, async (_req, res, next) => {
  try {
    res.json(GetAdminCourseActivationResponse.parse({ activeTermNumbers: await getActiveTermNumbers() }));
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/course-activation", requireOwnerOrAssistant, async (req, res, next) => {
  try {
    const input = UpdateAdminCourseActivationBody.parse(req.body);
    const activeTermNumbers = Array.from(new Set([1, 2, 3, 4, ...input.activeTermNumbers])).sort((left, right) => left - right);
    const [settings] = await db.select().from(applicationSettingsTable)
      .where(eq(applicationSettingsTable.id, 1)).limit(1);
    const semesterSettings = parseSemesterDates(settings?.semesterDates) as Record<string, unknown>;
    semesterSettings.activeTerms = activeTermNumbers;
    const updatedAt = new Date().toISOString();
    await db.insert(applicationSettingsTable).values({
      id: 1,
      opensAt: settings?.opensAt ?? null,
      closesAt: settings?.closesAt ?? null,
      statisticsVisible: settings?.statisticsVisible ?? false,
      semesterDates: JSON.stringify(semesterSettings),
      updatedAt,
    }).onConflictDoUpdate({
      target: applicationSettingsTable.id,
      set: { semesterDates: JSON.stringify(semesterSettings), updatedAt },
    });
    res.json(UpdateAdminCourseActivationResponse.parse({ activeTermNumbers }));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/users", requireOwnerOrAssistant, async (_req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const users = [];
    let offset = 0;
    do {
      const page = await clerkClient.users.getUserList({ limit: 100, offset, orderBy: "-created_at" });
      users.push(...page.data);
      offset += page.data.length;
      if (offset >= page.totalCount) break;
    } while (true);
    const applications = await db.select({
      clerkUserId: applicationsTable.clerkUserId,
      firstName: applicationsTable.firstName,
      lastName: applicationsTable.lastName,
    }).from(applicationsTable);
    const applicationNames = new Map(
      applications
        .filter((application) => Boolean(application.clerkUserId))
        .map((application) => [
          application.clerkUserId as string,
          { firstName: application.firstName, lastName: application.lastName },
        ]),
    );
    res.json(GetAdminUsersResponse.parse(users.map((user) => toAdminUser(user, user.id ? applicationNames.get(user.id) : undefined))));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/role-permissions", requireSystemOwner, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." }); return; }
    const owner = await getClerkUser(userId);
    res.json({
      teacher: configuredRolePermissions(owner?.publicMetadata, "teacher"),
      supervisor: configuredRolePermissions(owner?.publicMetadata, "supervisor"),
      owner_assistant: configuredRolePermissions(owner?.publicMetadata, "owner_assistant"),
      available: rolePermissionKeys,
    });
  } catch (error) { next(error); }
});

router.patch("/admin/role-permissions", requireSystemOwner, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." }); return; }
    const body = req.body as { teacher?: unknown; supervisor?: unknown; owner_assistant?: unknown };
    const clean = (value: unknown) => Array.isArray(value)
      ? rolePermissionKeys.filter((key) => value.includes(key))
      : null;
    const teacher = clean(body.teacher);
    const supervisor = clean(body.supervisor);
    const ownerAssistant = clean(body.owner_assistant);
    if (!teacher || !supervisor || !ownerAssistant) {
      res.status(400).json({ error: "Rol icazələri düzgün seçilməyib." });
      return;
    }
    const owner = await getClerkUser(userId);
    if (!owner) { res.status(404).json({ error: "Sistem sahibi tapılmadı." }); return; }
    const publicMetadata = owner.publicMetadata && typeof owner.publicMetadata === "object"
      ? { ...owner.publicMetadata }
      : {};
    publicMetadata.rolePermissions = { teacher, supervisor, owner_assistant: ownerAssistant };
    await clerkClient.users.updateUserMetadata(userId, { publicMetadata });
    res.json({ teacher, supervisor, owner_assistant: ownerAssistant, available: rolePermissionKeys });
  } catch (error) { next(error); }
});

router.patch("/admin/users/:userId/role", requireOwnerOrAssistant, async (req, res, next) => {
  try {
    const { userId } = UpdateAdminUserRoleParams.parse(req.params);
    const input = UpdateAdminUserRoleBody.parse(req.body);
    const actorId = getAuth(req).userId;
    const clerkUser = await getClerkUser(userId);
    if (!clerkUser) {
      res.status(404).json({ error: "İstifadəçi tapılmadı." });
      return;
    }
    if (await userIsSystemOwner(userId, clerkUser)) {
      res.status(409).json({ error: "Sistem sahibinin rolu dəyişdirilə bilməz." });
      return;
    }
    if (input.permissions !== undefined && (!actorId || !(await userIsSystemOwner(actorId)))) {
      res.status(403).json({ error: "Fərdi rol icazələrini yalnız sistem sahibi dəyişə bilər." });
      return;
    }
    const previousRole = roleForClerkUser(clerkUser);
    const publicMetadata = clerkUser.publicMetadata && typeof clerkUser.publicMetadata === "object"
      ? { ...clerkUser.publicMetadata }
      : {};
    if (input.role === "none") publicMetadata.role = null;
    else publicMetadata.role = input.role;
    if (input.permissions !== undefined && input.role !== "none") {
      publicMetadata.individualRolePermissions = rolePermissionKeys.filter((key) => input.permissions?.includes(key));
    } else if (input.role === "none" || previousRole !== input.role) {
      delete publicMetadata.individualRolePermissions;
    }
    await clerkClient.users.updateUserMetadata(userId, { publicMetadata });
    const updated = await getClerkUser(userId);
    if (!updated) {
      res.status(404).json({ error: "İstifadəçi yeniləndikdən sonra tapılmadı." });
      return;
    }
    if (actorId) await recordAuditEvent({
      eventType: "user.role.updated",
      actorClerkUserId: actorId,
      targetType: "user",
      targetId: userId,
      details: {
        previousRole,
        newRole: input.role,
        individualPermissionsUpdated: input.permissions !== undefined,
      },
      deduplicationKey: `user.role.updated:${userId}:${input.role}:${Date.now()}`,
    });
    res.json(UpdateAdminUserRoleResponse.parse({
      ...toAdminUser(updated),
      role: input.role,
    }));
  } catch (error) {
    next(error);
  }
});

router.delete("/admin/users/:userId", requireSystemOwner, async (req, res, next) => {
  try {
    const { userId } = DeleteAdminUserParams.parse(req.params);
    const clerkUser = await getClerkUser(userId);
    if (!clerkUser) {
      res.status(404).json({ error: "İstifadəçi tapılmadı." });
      return;
    }
    if (await userIsSystemOwner(userId, clerkUser)) {
      res.status(409).json({ error: "Sistem sahibi silinə bilməz." });
      return;
    }
    if (roleForClerkUser(clerkUser) !== "none") {
      res.status(409).json({ error: "Aktiv müəllim və ya nəzarətçi hesabı əvvəlcə adi istifadəçi roluna qaytarılmalıdır." });
      return;
    }
    await clerkClient.users.deleteUser(userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/admin/users/:userId/profile", requireOwnerOrAssistant, async (req, res, next) => {
  try {
    const { userId } = GetAdminUserProfileParams.parse(req.params);
    const clerkUser = await getClerkUser(userId);
    if (!clerkUser) { res.status(404).json({ error: "İstifadəçi tapılmadı." }); return; }
    const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.clerkUserId, userId)).limit(1);
    const role = roleForClerkUser(clerkUser);
    const rolePermissions = role === "owner"
      ? [...rolePermissionKeys]
      : role === "admin" || role === "teacher" || role === "supervisor" || role === "owner_assistant"
        ? await permissionsForClerkUser(clerkUser, role)
          : [];
    res.json(GetAdminUserProfileResponse.parse({
      id: clerkUser.id,
      firstName: clerkUser.firstName || application?.firstName || "",
      lastName: clerkUser.lastName || application?.lastName || "",
      username: clerkUser.username || application?.username || null,
      email: clerkUser.primaryEmailAddress?.emailAddress || application?.email || "",
      phone: application?.phone ?? "",
      birthDate: application?.birthDate ?? "",
      arabicLevel: application?.arabicLevel ?? "Orta",
      role,
      rolePermissions,
    }));
  } catch (error) { next(error); }
});

router.patch("/admin/users/:userId/profile", requireOwnerOrAssistant, async (req, res, next) => {
  try {
    const { userId } = UpdateAdminUserProfileParams.parse(req.params);
    const input = UpdateAdminUserProfileBody.parse(req.body);
    const clerkUser = await getClerkUser(userId);
    if (!clerkUser) { res.status(404).json({ error: "İstifadəçi tapılmadı." }); return; }
    if (await userIsSystemOwner(userId, clerkUser)) {
      res.status(409).json({ error: "Sistem sahibinin məlumatları bu bölmədən dəyişdirilə bilməz." });
      return;
    }
    const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.clerkUserId, userId)).limit(1);
    const previousProfile = userProfileSnapshot(clerkUser, application);
    let updatedClerkUser = await clerkClient.users.updateUser(userId, {
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username || undefined,
    });
    const currentEmail = normalizedEmail(clerkUser.primaryEmailAddress?.emailAddress);
    if (currentEmail !== normalizedEmail(input.email)) {
      const emailAddress = await clerkClient.emailAddresses.createEmailAddress({
        userId,
        emailAddress: input.email,
      });
      updatedClerkUser = await clerkClient.users.updateUser(userId, {
        primaryEmailAddressID: emailAddress.id,
      });
    }
    if (application) {
      await db.update(applicationsTable).set({
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username || "",
        email: input.email,
        phone: input.phone,
        birthDate: input.birthDate,
        arabicLevel: input.arabicLevel,
      }).where(eq(applicationsTable.id, application.id));
    }
    const actorId = getAuth(req).userId;
    const updatedProfile = {
      firstName: updatedClerkUser.firstName ?? input.firstName,
      lastName: updatedClerkUser.lastName ?? input.lastName,
      username: updatedClerkUser.username ?? input.username,
      email: updatedClerkUser.primaryEmailAddress?.emailAddress ?? input.email,
      phone: input.phone,
      birthDate: input.birthDate,
      arabicLevel: input.arabicLevel,
    } satisfies UserProfileSnapshot;
    const profileDiff = userProfileDiff(previousProfile, updatedProfile);
    if (actorId && profileDiff.changedFields.length) await recordAuditEvent({
      eventType: "user.profile.updated",
      actorClerkUserId: actorId,
      targetType: "user",
      targetId: userId,
      details: profileDiff,
      deduplicationKey: `user.profile.updated:${userId}:${updatedClerkUser.updatedAt ?? Date.now()}`,
    });
    res.json(UpdateAdminUserProfileResponse.parse({
      id: updatedClerkUser.id,
      firstName: updatedClerkUser.firstName ?? "",
      lastName: updatedClerkUser.lastName ?? "",
      username: updatedClerkUser.username ?? null,
      email: updatedClerkUser.primaryEmailAddress?.emailAddress ?? input.email,
      phone: input.phone,
      birthDate: input.birthDate,
      arabicLevel: input.arabicLevel,
      role: roleForClerkUser(updatedClerkUser),
    }));
  } catch (error) { next(error); }
});

router.get("/admin/users/:userId/profile-history", requireSystemOwner, async (req, res, next) => {
  try {
    const { userId } = GetAdminUserProfileParams.parse(req.params);
    const clerkUser = await getClerkUser(userId);
    if (!clerkUser) { res.status(404).json({ error: "İstifadəçi tapılmadı." }); return; }
    const rows = await db.select({
      id: auditEventsTable.id,
      eventType: auditEventsTable.eventType,
      actorClerkUserId: auditEventsTable.actorClerkUserId,
      details: auditEventsTable.details,
      createdAt: auditEventsTable.createdAt,
    }).from(auditEventsTable)
      .where(and(
        eq(auditEventsTable.eventType, "user.profile.updated"),
        eq(auditEventsTable.targetType, "user"),
        eq(auditEventsTable.targetId, userId),
      ))
      .orderBy(desc(auditEventsTable.createdAt), desc(auditEventsTable.id))
      .limit(200);
    const actorIds = Array.from(new Set(rows.map((row) => row.actorClerkUserId)));
    const actorUsers = await Promise.all(actorIds.map(async (id) => [id, await getClerkUser(id)] as const));
    const actorNames = new Map(actorUsers
      .filter((entry): entry is readonly [string, NonNullable<typeof entry[1]>] => Boolean(entry[1]))
      .map(([id, user]) => [id, clerkDisplayName(user)]));
    const profileFields = new Set<string>(userProfileAuditFields);
    const snapshotValues = (value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return {};
      return Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .filter(([key, item]) => profileFields.has(key) && (typeof item === "string" || item === null)));
    };
    res.json(GetAdminUserProfileHistoryResponse.parse(rows.map((row) => {
      const details = row.details && typeof row.details === "object" && !Array.isArray(row.details)
        ? row.details as Record<string, unknown>
        : {};
      const changedFields = Array.isArray(details.changedFields)
        ? details.changedFields.filter((field): field is string => typeof field === "string" && profileFields.has(field))
        : [];
      return {
        id: row.id,
        eventType: row.eventType,
        actorClerkUserId: row.actorClerkUserId,
        actorName: actorNames.get(row.actorClerkUserId) ?? "Sistem istifadəçisi",
        changedFields,
        previousValues: snapshotValues(details.previousValues),
        newValues: snapshotValues(details.newValues),
        createdAt: row.createdAt,
      };
    })));
  } catch (error) { next(error); }
});

router.get("/admin/courses/:courseId/students", requireTeacher, async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId < 1) {
      res.status(400).json({ error: "Dərs seçimi düzgün deyil." });
      return;
    }
    const hasTermFilter = req.query.termNumber !== undefined;
    const termNumber = Number(req.query.termNumber);
    if (hasTermFilter && (!Number.isInteger(termNumber) || termNumber < 1 || termNumber > 8)) {
      res.status(400).json({ error: "Semestr düzgün seçilməyib." });
      return;
    }
    const termFilter = hasTermFilter ? termDetails(termNumber) : null;
    const [course] = await db.select().from(coursesTable)
      .where(eq(coursesTable.id, courseId)).limit(1);
    if (!course) {
      res.status(404).json({ error: "Dərs tapılmadı." });
      return;
    }
    const rows = await db.select({
      profile: studentAcademicProfilesTable,
      application: applicationsTable,
    }).from(studentAcademicProfilesTable)
      .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
      .where(and(
        eq(applicationsTable.status, "approved"),
        isNull(applicationsTable.deletedAt),
        ...(termFilter ? [eq(studentAcademicProfilesTable.courseYear, termFilter.courseYear), eq(studentAcademicProfilesTable.semester, termFilter.semester)] : []),
      ))
      .orderBy(asc(applicationsTable.firstName), asc(applicationsTable.lastName));
    const [courseResources, semesterDates] = await Promise.all([
      db.select().from(resourcesTable).where(eq(resourcesTable.courseId, courseId)),
      getSemesterDates(),
    ]);
    const students = await Promise.all(rows.map(async ({ profile, application }) => {
      const [gradeRows, attendanceRecordRows] = await Promise.all([
        db.select({ termNumber: studentGradesTable.termNumber, gradePoints: studentGradesTable.gradePoints, componentGrades: studentGradesTable.componentGrades })
          .from(studentGradesTable)
          .where(and(eq(studentGradesTable.profileId, profile.id), eq(studentGradesTable.courseId, courseId))),
        db.select({ termNumber: studentAttendanceRecordsTable.termNumber, status: studentAttendanceRecordsTable.status })
          .from(studentAttendanceRecordsTable)
          .where(and(eq(studentAttendanceRecordsTable.profileId, profile.id), eq(studentAttendanceRecordsTable.courseId, courseId))),
      ]);
      return {
        profileId: profile.id,
        studentNumber: profile.studentNumber,
        firstName: application.firstName,
        lastName: application.lastName,
        username: application.username,
        email: application.email,
        phone: application.phone,
        courseYear: profile.courseYear,
        semester: profile.semester,
        grades: Array.from({ length: 8 }, (_, index) => index + 1).map((termNumber) => ({
          termNumber,
          grade: (gradeRows.find((item) => item.termNumber === termNumber)?.gradePoints ?? null) === null
            ? null
            : gradePointsToFiveScale(gradeRows.find((item) => item.termNumber === termNumber)?.gradePoints ?? 0),
          gradingComponents: (course.gradingComponents ?? []).map((name) => ({
            name,
            score: parseComponentGrades(gradeRows.find((item) => item.termNumber === termNumber)?.componentGrades)[name] ?? null,
          })),
        })),
        attendance: Array.from({ length: 8 }, (_, index) => index + 1).map((termNumber) => ({
          termNumber,
          attendancePercent: calculateAttendancePercent(
            attendanceRecordRows.filter((item) => item.termNumber === termNumber),
            {
              startDate: semesterDates.find((item) => item.termNumber === termNumber)?.startDate ?? null,
              endDate: semesterDates.find((item) => item.termNumber === termNumber)?.endDate ?? null,
              lessonDays: courseResources.find((resource) => resource.termNumber === termNumber)?.lessonDays ?? course.lessonDays,
            },
          ),
        })),
      };
    }));
    res.json(GetAdminCourseStudentsResponse.parse(students));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/students", requireTeacher, async (_req, res, next) => {
  try {
    await ensureProfilesForApprovedStudents();
    const rows = await db.select({
      profile: studentAcademicProfilesTable,
      application: applicationsTable,
    }).from(studentAcademicProfilesTable)
      .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
      .where(and(eq(applicationsTable.status, "approved"), isNull(applicationsTable.deletedAt)))
      .orderBy(asc(applicationsTable.firstName), asc(applicationsTable.lastName));
    const students = rows.map(({ profile, application }) => ({
      profileId: profile.id,
      clerkUserId: application.clerkUserId,
      studentNumber: profile.studentNumber,
      applicationId: application.id,
      firstName: application.firstName,
      lastName: application.lastName,
      username: application.username,
      email: application.email,
      phone: application.phone,
      registeredAt: application.createdAt,
      courseYear: profile.courseYear,
      semester: profile.semester,
      currentTermNumber: currentTermNumber(profile),
      deletedAt: application.deletedAt,
    }));
    res.json(GetAdminStudentsResponse.parse(students));
  } catch (error) {
    next(error);
  }
});

async function graduationTermNumber() {
  const activeTerms = await getActiveTermNumbers();
  if (activeTerms.includes(7) && activeTerms.includes(8)) return 8;
  if (activeTerms.includes(5) && activeTerms.includes(6)) return 6;
  return 4;
}

router.get("/admin/graduation-candidates", requireSystemOwner, async (_req, res, next) => {
  try {
    await ensureProfilesForApprovedStudents();
    const termNumber = await graduationTermNumber();
    const rows = await db.select({
      profile: studentAcademicProfilesTable,
      application: applicationsTable,
    }).from(studentAcademicProfilesTable)
      .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
      .where(and(eq(applicationsTable.status, "approved"), isNull(applicationsTable.deletedAt)))
      .orderBy(asc(applicationsTable.firstName), asc(applicationsTable.lastName));
    const students = rows
      .filter(({ profile }) => currentTermNumber(profile) === termNumber)
      .map(({ profile, application }) => ({
        profileId: profile.id,
        studentNumber: profile.studentNumber,
        firstName: application.firstName,
        lastName: application.lastName,
        username: application.username,
        email: application.email,
        currentTermNumber: termNumber,
      }));
    res.json(GetGraduationCandidatesResponse.parse({ graduationTerm: termNumber, students }));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/students/:profileId/graduate", requireSystemOwner, async (req, res, next) => {
  try {
    const profileId = Number(req.params.profileId);
    if (!Number.isInteger(profileId) || profileId <= 0) {
      res.status(404).json({ error: "Tələbə tapılmadı." });
      return;
    }
    const row = await getAcademicProfileForAdmin(profileId);
    if (!row || row.application.status !== "approved" || row.application.deletedAt) {
      res.status(404).json({ error: "Təsdiqlənmiş tələbə tapılmadı." });
      return;
    }
    const termNumber = await graduationTermNumber();
    const activeTerms = await getActiveTermNumbers();
    if (!activeTerms.includes(termNumber - 1) || !activeTerms.includes(termNumber)) {
      res.status(409).json({ error: "Məzuniyyət üçün uyğun semestr cütü hələ aktiv deyil." });
      return;
    }
    if (currentTermNumber(row.profile) !== termNumber) {
      res.status(409).json({ error: `Yalnız ${termNumber}-ci semestr tələbələri təxərrüc edilə bilər.` });
      return;
    }
    const [updated] = await db.update(applicationsTable).set({ status: "graduated" })
      .where(and(eq(applicationsTable.id, row.application.id), eq(applicationsTable.status, "approved")))
      .returning({ id: applicationsTable.id });
    if (!updated) {
      res.status(409).json({ error: "Tələbənin statusu artıq dəyişdirilib. Siyahını yeniləyin." });
      return;
    }
    const actorId = getAuth(req).userId;
    if (actorId) await recordAuditEvent({
      eventType: "student.graduated",
      actorClerkUserId: actorId,
      targetType: "student",
      targetId: profileId,
      details: { graduationTerm: termNumber },
      deduplicationKey: `student.graduated:${profileId}:${termNumber}`,
    });
    res.json(GraduateStudentResponse.parse({
      profileId,
      studentName: `${row.application.firstName} ${row.application.lastName}`.trim(),
      graduationTerm: termNumber,
    }));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/students/:profileId/ungraduate", requireSystemOwner, async (req, res, next) => {
  try {
    const profileId = Number(req.params.profileId);
    if (!Number.isInteger(profileId) || profileId <= 0) {
      res.status(404).json({ error: "Tələbə tapılmadı." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [row] = await tx.select({
        profile: studentAcademicProfilesTable,
        application: applicationsTable,
      }).from(studentAcademicProfilesTable)
        .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
        .where(and(eq(studentAcademicProfilesTable.id, profileId), eq(applicationsTable.status, "graduated")))
        .for("update")
        .limit(1);
      if (!row || row.application.deletedAt) return { kind: "not-found" as const };

      const [certificate] = await tx.select({ id: graduateCertificatesTable.id })
        .from(graduateCertificatesTable)
        .where(eq(graduateCertificatesTable.profileId, profileId))
        .limit(1);
      if (certificate) return { kind: "certificate" as const };

      const [updated] = await tx.update(applicationsTable).set({ status: "approved" })
        .where(and(eq(applicationsTable.id, row.application.id), eq(applicationsTable.status, "graduated")))
        .returning({ id: applicationsTable.id });
      if (!updated) return { kind: "changed" as const };
      return {
        kind: "updated" as const,
        studentName: `${row.application.firstName} ${row.application.lastName}`.trim(),
      };
    });
    if (result.kind === "not-found") {
      res.status(404).json({ error: "Məzun tələbə tapılmadı." });
      return;
    }
    if (result.kind === "certificate") {
      res.status(409).json({ error: "Şəhadətnaməsi olan tələbənin məzuniyyət statusu geri alına bilməz. Əvvəlcə sənədi ləğv edin." });
      return;
    }
    if (result.kind === "changed") {
      res.status(409).json({ error: "Tələbənin statusu artıq dəyişdirilib. Siyahını yeniləyin." });
      return;
    }
    const actorId = getAuth(req).userId;
    if (actorId) await recordAuditEvent({
      eventType: "student.graduation_reversed",
      actorClerkUserId: actorId,
      targetType: "student",
      targetId: profileId,
      details: { restoredStatus: "approved" },
      deduplicationKey: `student.graduation_reversed:${profileId}:${new Date().toISOString()}`,
    });
    res.json(RestoreGraduatedStudentResponse.parse({
      profileId,
      studentName: result.studentName,
      status: "approved",
    }));
  } catch (error) {
    next(error);
  }
});

router.delete("/admin/students/:profileId", requireTeacher, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const profileId = Number(req.params.profileId);
    const parsedInput = DeleteAdminStudentBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Silinmə səbəbi düzgün daxil edilməyib." });
      return;
    }
    const { reason } = parsedInput.data;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      res.status(400).json({ error: "Silinmə səbəbi boş ola bilməz." });
      return;
    }
    if (!Number.isInteger(profileId) || profileId <= 0) {
      res.status(404).json({ error: "Tələbə tapılmadı." });
      return;
    }
    const [student] = await db.select({
      profile: studentAcademicProfilesTable,
      application: applicationsTable,
    }).from(studentAcademicProfilesTable)
      .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
      .where(eq(studentAcademicProfilesTable.id, profileId))
      .limit(1);
    if (!student || student.application.status !== "approved") {
      res.status(404).json({ error: "Təsdiqlənmiş tələbə tapılmadı." });
      return;
    }
    const actor = userId ? await getClerkUser(userId) : null;
    const deletedByName = actor ? clerkDisplayName(actor) : "Müəllim";
    const deletedAt = new Date().toISOString();
    let deletionAuditId: number | null = null;
    await db.transaction(async (tx) => {
      const [audit] = await tx.insert(studentDeletionAuditTable).values({
        profileId: student.profile.id,
        applicationId: student.application.id,
        studentClerkUserId: student.profile.clerkUserId,
        studentFirstName: student.application.firstName,
        studentLastName: student.application.lastName,
        studentEmail: student.application.email,
        reason: trimmedReason,
        deletedByClerkUserId: userId as string,
        deletedByName,
        deletedAt,
      }).returning({ id: studentDeletionAuditTable.id });
      deletionAuditId = audit?.id ?? null;
      if (!deletionAuditId) throw new Error("Silinmə tarixçəsi yadda saxlanmadı.");
      await tx.update(applicationsTable).set({ deletedAt }).where(eq(applicationsTable.id, student.application.id));
    });
    try {
      await clerkClient.users.deleteUser(student.profile.clerkUserId);
    } catch {
      await db.transaction(async (tx) => {
        if (deletionAuditId) {
          await tx.delete(studentDeletionAuditTable).where(eq(studentDeletionAuditTable.id, deletionAuditId));
        }
        await tx.update(applicationsTable).set({ deletedAt: null })
          .where(and(eq(applicationsTable.id, student.application.id), eq(applicationsTable.deletedAt, deletedAt)));
      });
      res.status(502).json({ error: "Tələbə hesabı tam silinə bilmədi. Zəhmət olmasa yenidən cəhd edin." });
      return;
    }
    if (userId) await recordAuditEvent({
      eventType: "student.deleted",
      actorClerkUserId: userId,
      targetType: "student",
      targetId: profileId,
      details: { reason: trimmedReason },
      deduplicationKey: `student.deleted:${profileId}:${deletedAt}`,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

function certificateStudentName(application: typeof applicationsTable.$inferSelect) {
  return `${application.firstName} ${application.lastName}`.trim();
}

const defaultCertificateTitle = "MƏZUN ŞƏHADƏTNAMƏSİ";
const defaultCertificateBodyText = "Bu şəhadətnamə ilə təsdiq olunur ki, yuxarıda adı qeyd olunan məzun {term}-ci semestr üzrə akademik proqramı uğurla tamamlamışdır.";
const defaultCertificateHonorText = "Akademiyanın tədris və qiymətləndirmə tələblərinə uyğun olaraq məzun elan edilmişdir.";

function graduationCategoryForGpa(gpa: number) {
  if (gpa < 2.5) return "Zəif" as const;
  if (gpa < 3.5) return "Orta" as const;
  if (gpa < 4.5) return "Əla" as const;
  return "Fərqlənmə ilə bitirən" as const;
}

async function calculateCertificateGpa(profileId: number) {
  const [gradeRows, courses] = await Promise.all([
    db.select().from(studentGradesTable).where(eq(studentGradesTable.profileId, profileId)),
    getCourses(),
  ]);
  const courseMap = new Map(courses.map((course) => [course.id, course]));
  const enteredGrades = gradeRows.flatMap((grade) => {
    const course = courseMap.get(grade.courseId);
    if (!course) return [];
    const componentNames = course.gradingComponents ?? [];
    const componentGrades = parseComponentGrades(grade.componentGrades);
    const calculatedGrade = componentNames.length
      ? calculateComponentGrade(componentNames, componentGrades)
      : grade.gradePoints;
    if (calculatedGrade === null || calculatedGrade === undefined || !Number.isFinite(calculatedGrade)) return [];
    return [Math.max(0, Math.min(5, gradePointsToFiveScale(calculatedGrade)))];
  });
  return enteredGrades.length
    ? Math.round((enteredGrades.reduce((total, grade) => total + grade, 0) / enteredGrades.length) * 100) / 100
    : 0;
}

function certificateVerificationUrl(req: Parameters<RequestHandler>[0], token: string) {
  const protocolHeader = req.headers["x-forwarded-proto"];
  const hostHeader = req.headers["x-forwarded-host"];
  const protocol = (typeof protocolHeader === "string" ? protocolHeader.split(",")[0] : req.protocol) || "https";
  const host = (typeof hostHeader === "string" ? hostHeader.split(",")[0] : req.get("host")) || "";
  const basePath = process.env.BASE_PATH?.replace(/\/$/, "") || "/medine-lms";
  return host
    ? `${protocol}://${host}${basePath}/verify/certificate/${encodeURIComponent(token)}`
    : `/verify/certificate/${encodeURIComponent(token)}`;
}

function toGraduationCertificate(
  certificate: typeof graduateCertificatesTable.$inferSelect,
  profile: typeof studentAcademicProfilesTable.$inferSelect,
  application: typeof applicationsTable.$inferSelect,
) {
  return CreateAdminGraduationCertificateResponse.parse({
    id: certificate.id,
    profileId: profile.id,
    studentName: certificateStudentName(application),
    graduationTerm: certificate.graduationTerm,
    gpa: certificate.gpa,
    graduationCategory: certificate.graduationCategory,
    certificateNumber: certificate.certificateNumber,
    verificationToken: certificate.verificationToken,
    issuedAt: certificate.issuedAt,
    revokedAt: certificate.revokedAt,
    verificationLocked: certificate.verificationLocked,
    directorTitle: certificate.directorTitle,
    directorName: certificate.directorName,
    showDirector: certificate.showDirector,
    showSeal: certificate.showSeal,
    showGpa: certificate.showGpa,
    showGraduationCategory: certificate.showGraduationCategory,
    certificateTitle: certificate.certificateTitle,
    bodyText: certificate.bodyText,
    honorText: certificate.honorText,
  });
}

router.get("/admin/graduation-certificates", requireCertificateManager, async (_req, res, next) => {
  try {
    const rows = await db.select({
      profile: studentAcademicProfilesTable,
      application: applicationsTable,
      certificate: graduateCertificatesTable,
    }).from(studentAcademicProfilesTable)
      .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
      .leftJoin(graduateCertificatesTable, eq(graduateCertificatesTable.profileId, studentAcademicProfilesTable.id))
      .where(eq(applicationsTable.status, "graduated"))
      .orderBy(asc(applicationsTable.firstName), asc(applicationsTable.lastName));
    res.json(GetAdminGraduationCertificatesResponse.parse(rows.map(({ profile, application, certificate }) => ({
      profileId: profile.id,
      studentNumber: profile.studentNumber,
      firstName: application.firstName,
      lastName: application.lastName,
      email: application.email,
      graduationTerm: certificate?.graduationTerm ?? currentTermNumber(profile),
      certificate: certificate ? toGraduationCertificate(certificate, profile, application) : null,
    }))));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/students/:profileId/certificate/pdf", requireCertificateManager, async (req, res, next) => {
  try {
    const profileId = Number(req.params.profileId);
    if (!Number.isInteger(profileId) || profileId <= 0) {
      res.status(404).json({ error: "Şəhadətnamə tapılmadı." });
      return;
    }
    const [row] = await db.select({
      profile: studentAcademicProfilesTable,
      application: applicationsTable,
      certificate: graduateCertificatesTable,
    }).from(studentAcademicProfilesTable)
      .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
      .innerJoin(graduateCertificatesTable, eq(graduateCertificatesTable.profileId, studentAcademicProfilesTable.id))
      .where(and(
        eq(studentAcademicProfilesTable.id, profileId),
        eq(applicationsTable.status, "graduated"),
        isNull(applicationsTable.deletedAt),
      ))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Şəhadətnamə tapılmadı." });
      return;
    }
    const pdf = await buildGraduationCertificatePdf({
      studentName: certificateStudentName(row.application),
      studentNumber: row.profile.studentNumber,
      graduationTerm: row.certificate.graduationTerm,
      certificateNumber: row.certificate.certificateNumber,
      issuedAt: row.certificate.issuedAt,
      verificationUrl: certificateVerificationUrl(req, row.certificate.verificationToken),
      gpa: row.certificate.gpa,
      graduationCategory: row.certificate.graduationCategory,
      directorTitle: row.certificate.directorTitle,
      directorName: row.certificate.directorName,
      showDirector: row.certificate.showDirector,
      showSeal: row.certificate.showSeal,
      showGpa: row.certificate.showGpa,
      showGraduationCategory: row.certificate.showGraduationCategory,
      certificateTitle: row.certificate.certificateTitle,
      bodyText: row.certificate.bodyText,
      honorText: row.certificate.honorText,
    });
    const filename = `Medine-Shehadetname-${row.certificate.certificateNumber}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdf.length);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

router.post("/admin/students/:profileId/certificate", requireCertificateManager, async (req, res, next) => {
  try {
    const profileId = Number(req.params.profileId);
    if (!Number.isInteger(profileId) || profileId <= 0) {
      res.status(404).json({ error: "Tələbə tapılmadı." });
      return;
    }
    const issuance = await db.transaction(async (tx) => {
      const [row] = await tx.select({
        profile: studentAcademicProfilesTable,
        application: applicationsTable,
      }).from(studentAcademicProfilesTable)
        .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
        .where(and(eq(studentAcademicProfilesTable.id, profileId), eq(applicationsTable.status, "graduated")))
        .for("update")
        .limit(1);
      if (!row || row.application.deletedAt) return { kind: "not-graduated" as const };

      const [existing] = await tx.select().from(graduateCertificatesTable)
        .where(eq(graduateCertificatesTable.profileId, profileId))
        .limit(1);
      if (existing) return { kind: "existing" as const, certificate: existing, row };

      const gpa = await calculateCertificateGpa(profileId);
      const [inserted] = await tx.insert(graduateCertificatesTable).values({
        profileId,
        graduationTerm: currentTermNumber(row.profile),
        gpa,
        graduationCategory: graduationCategoryForGpa(gpa),
        certificateNumber: `CERT-PENDING-${randomUUID()}`,
        verificationToken: `verify-${randomUUID()}-${randomUUID()}`,
        issuedAt: new Date().toISOString(),
        verificationLocked: false,
        directorTitle: "Akademiya Rəhbəri",
        directorName: "Fərman İsayev",
        showDirector: true,
        showSeal: true,
        showGpa: true,
        showGraduationCategory: true,
        certificateTitle: defaultCertificateTitle,
        bodyText: defaultCertificateBodyText,
        honorText: defaultCertificateHonorText,
      }).onConflictDoNothing({ target: graduateCertificatesTable.profileId }).returning();
      if (!inserted) {
        const [raced] = await tx.select().from(graduateCertificatesTable)
          .where(eq(graduateCertificatesTable.profileId, profileId))
          .limit(1);
        if (!raced) throw new Error("Şəhadətnamə yaradılmadı.");
        return { kind: "existing" as const, certificate: raced, row };
      }

      const [updated] = await tx.update(graduateCertificatesTable)
        .set({ certificateNumber: `CERT-${new Date(inserted.issuedAt).getUTCFullYear()}-${String(inserted.id).padStart(4, "0")}` })
        .where(eq(graduateCertificatesTable.id, inserted.id))
        .returning();
      return { kind: "created" as const, certificate: updated ?? inserted, created: true, row };
    });
    if (issuance.kind === "not-graduated") {
      res.status(409).json({ error: "Şəhadətnamə yalnız məzun tələbələr üçün yaradıla bilər." });
      return;
    }
    const certificate = issuance.certificate;
    const actorId = getAuth(req).userId;
    if (actorId) await recordAuditEvent({
      eventType: "student.graduation_certificate.created",
      actorClerkUserId: actorId,
      targetType: "student",
      targetId: profileId,
      details: { certificateNumber: certificate.certificateNumber },
      deduplicationKey: `student.graduation_certificate.created:${certificate.id}`,
    });
    if (issuance.kind === "created") {
      try {
        await sendGraduationCertificateEmail({
          to: issuance.row.application.email,
          studentName: certificateStudentName(issuance.row.application),
          studentNumber: issuance.row.profile.studentNumber,
          graduationTerm: certificate.graduationTerm,
          certificateNumber: certificate.certificateNumber,
          issuedAt: certificate.issuedAt,
          verificationUrl: certificateVerificationUrl(req, certificate.verificationToken),
          gpa: certificate.gpa,
          graduationCategory: certificate.graduationCategory,
          directorTitle: certificate.directorTitle,
          directorName: certificate.directorName,
          showDirector: certificate.showDirector,
          showSeal: certificate.showSeal,
          showGpa: certificate.showGpa,
          showGraduationCategory: certificate.showGraduationCategory,
          certificateTitle: certificate.certificateTitle,
          bodyText: certificate.bodyText,
          honorText: certificate.honorText,
        });
      } catch (emailError) {
        console.error("Graduation certificate email delivery failed:", emailError);
      }
    }
    res.json(toGraduationCertificate(certificate, issuance.row.profile, issuance.row.application));
  } catch (error) {
    next(error);
  }
});

router.patch("/admin/students/:profileId/certificate", requireSystemOwner, async (req, res, next) => {
  try {
    const profileId = Number(req.params.profileId);
    if (!Number.isInteger(profileId) || profileId <= 0) {
      res.status(404).json({ error: "Şəhadətnamə tapılmadı." });
      return;
    }
    const parsedInput = UpdateAdminGraduationCertificateStatusBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Şəhadətnamə dəyişiklikləri düzgün göndərilməyib." });
      return;
    }
    const input = parsedInput.data;
    if (!Object.keys(input).length) {
      res.status(400).json({ error: "Ən azı bir şəhadətnamə dəyişikliyi göndərilməlidir." });
      return;
    }
    const updateResult = await db.transaction(async (tx) => {
      const [row] = await tx.select({
        profile: studentAcademicProfilesTable,
        application: applicationsTable,
        certificate: graduateCertificatesTable,
      }).from(graduateCertificatesTable)
        .innerJoin(studentAcademicProfilesTable, eq(graduateCertificatesTable.profileId, studentAcademicProfilesTable.id))
        .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
        .where(eq(graduateCertificatesTable.profileId, profileId))
        .for("update")
        .limit(1);
      if (!row) return { kind: "not-found" as const };
      if (input.revoked === false && row.application.status !== "graduated") {
        return { kind: "not-graduated" as const };
      }

      const previousRevokedAt = row.certificate.revokedAt;
      const nextRevokedAt = input.revoked === undefined
        ? previousRevokedAt
        : input.revoked ? (previousRevokedAt ?? new Date().toISOString()) : null;
      const updates: Partial<typeof graduateCertificatesTable.$inferInsert> = {};
      if (nextRevokedAt !== previousRevokedAt) updates.revokedAt = nextRevokedAt;
      if (input.verificationLocked !== undefined) updates.verificationLocked = input.verificationLocked;
      if (input.directorTitle !== undefined) updates.directorTitle = input.directorTitle.trim();
      if (input.directorName !== undefined) updates.directorName = input.directorName.trim();
      if (input.showDirector !== undefined) updates.showDirector = input.showDirector;
      if (input.showSeal !== undefined) updates.showSeal = input.showSeal;
      if (input.showGpa !== undefined) updates.showGpa = input.showGpa;
      if (input.showGraduationCategory !== undefined) updates.showGraduationCategory = input.showGraduationCategory;
      if (input.certificateTitle !== undefined) updates.certificateTitle = input.certificateTitle.trim();
      if (input.bodyText !== undefined) updates.bodyText = input.bodyText.trim();
      if (input.honorText !== undefined) updates.honorText = input.honorText.trim();
      const certificate = Object.keys(updates).length
        ? ((await tx.update(graduateCertificatesTable)
          .set(updates)
          .where(eq(graduateCertificatesTable.id, row.certificate.id))
          .returning())[0] ?? row.certificate)
        : row.certificate;
      return { kind: "updated" as const, certificate, row, changed: Object.keys(updates).length > 0 };
    });
    if (updateResult.kind === "not-found") {
      res.status(404).json({ error: "Şəhadətnamə tapılmadı." });
      return;
    }
    if (updateResult.kind === "not-graduated") {
      res.status(409).json({ error: "Şəhadətnamə yalnız məzun tələbə üçün bərpa edilə bilər." });
      return;
    }
    const { certificate, row, changed } = updateResult;

    const actorId = getAuth(req).userId;
    if (changed && actorId) {
      const eventType = input.revoked === true && row.certificate.revokedAt !== certificate.revokedAt
        ? "student.graduation_certificate.revoked"
        : input.revoked === false && row.certificate.revokedAt !== certificate.revokedAt
          ? "student.graduation_certificate.restored"
          : "student.graduation_certificate.updated";
      await recordAuditEvent({
        eventType,
        actorClerkUserId: actorId,
        targetType: "student",
        targetId: profileId,
        details: {
          certificateNumber: certificate.certificateNumber,
          revokedAt: certificate.revokedAt,
          verificationLocked: certificate.verificationLocked,
          showDirector: certificate.showDirector,
          showSeal: certificate.showSeal,
          showGpa: certificate.showGpa,
          showGraduationCategory: certificate.showGraduationCategory,
        },
        deduplicationKey: `${eventType}:${certificate.id}:${randomUUID()}`,
      });
    }
    res.json(UpdateAdminGraduationCertificateStatusResponse.parse(toGraduationCertificate(certificate, row.profile, row.application)));
  } catch (error) {
    next(error);
  }
});

router.get("/certificates/verify/:verificationToken", async (req, res, next) => {
  try {
    const token = typeof req.params.verificationToken === "string" ? req.params.verificationToken : "";
    const [row] = await db.select({
      certificate: graduateCertificatesTable,
      profile: studentAcademicProfilesTable,
      application: applicationsTable,
    }).from(graduateCertificatesTable)
      .innerJoin(studentAcademicProfilesTable, eq(graduateCertificatesTable.profileId, studentAcademicProfilesTable.id))
      .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
      .where(eq(graduateCertificatesTable.verificationToken, token))
      .limit(1);
    const valid = Boolean(row && !row.certificate.revokedAt && !row.certificate.verificationLocked && row.application.status === "graduated");
    const result = {
      valid,
      certificateNumber: valid ? row?.certificate.certificateNumber ?? null : null,
      studentName: valid && row ? certificateStudentName(row.application) : null,
      graduationTerm: valid ? row?.certificate.graduationTerm ?? null : null,
      graduationDate: valid ? row?.certificate.issuedAt ?? null : null,
      academyName: "Mədinə Tədris Akademiyası",
      gpa: valid && row?.certificate.showGpa ? row.certificate.gpa : null,
      graduationCategory: valid && row?.certificate.showGraduationCategory ? row.certificate.graduationCategory : null,
      directorTitle: valid && row?.certificate.showDirector ? row.certificate.directorTitle : null,
      directorName: valid && row?.certificate.showDirector ? row.certificate.directorName : null,
    };
    res.json(VerifyGraduationCertificateResponse.parse(result));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/student-deletion-audit", requireSystemOwner, async (_req, res, next) => {
  try {
    const rows = await db.select().from(studentDeletionAuditTable)
      .orderBy(desc(studentDeletionAuditTable.deletedAt));
    res.json(GetAdminStudentDeletionAuditResponse.parse(rows.map((row) => ({
      id: row.id,
      profileId: row.profileId,
      applicationId: row.applicationId,
      studentName: `${row.studentFirstName} ${row.studentLastName}`.trim(),
      email: row.studentEmail,
      reason: row.reason,
      deletedByName: row.deletedByName,
      deletedAt: row.deletedAt,
    }))));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/audit-events", requireSystemOwner, async (req, res, next) => {
  try {
    const requested = Number(req.query.limit ?? 200);
    const queryValue = (value: unknown) => Array.isArray(value) ? value[0] : value;
    const eventType = queryValue(req.query.eventType);
    const targetType = queryValue(req.query.targetType);
    const fromDate = queryValue(req.query.fromDate);
    const toDate = queryValue(req.query.toDate);
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if ([fromDate, toDate].some((value) => value !== undefined && (typeof value !== "string" || !datePattern.test(value)))) {
      res.status(400).json({ error: "Audit tarixləri YYYY-MM-DD formatında olmalıdır." });
      return;
    }
    const rows = await listAuditEvents({
      limit: Number.isFinite(requested) ? requested : 200,
      eventType: typeof eventType === "string" && eventType !== "all" ? eventType : undefined,
      targetType: typeof targetType === "string" && targetType !== "all" ? targetType : undefined,
      fromDate: typeof fromDate === "string" ? fromDate : undefined,
      toDate: typeof toDate === "string" ? toDate : undefined,
    });
    const resourceIds = rows
      .filter((row) => row.targetType === "resource" && row.targetId)
      .map((row) => Number(row.targetId))
      .filter((id) => Number.isInteger(id) && id > 0);
    const resources = resourceIds.length
      ? await db.select({ id: resourcesTable.id, courseId: resourcesTable.courseId })
        .from(resourcesTable)
        .where(inArray(resourcesTable.id, resourceIds))
      : [];
    const courseIds = rows
      .filter((row) => row.targetType === "course" && row.targetId)
      .map((row) => Number(row.targetId))
      .filter((id) => Number.isInteger(id) && id > 0)
      .concat(resources.map((resource) => resource.courseId));
    const courses = courseIds.length
      ? await db.select({ id: coursesTable.id, title: coursesTable.title })
        .from(coursesTable)
        .where(inArray(coursesTable.id, courseIds))
      : [];
    const actorIds = Array.from(new Set(rows.map((row) => row.actorClerkUserId).filter(Boolean)));
    const actorUsers = await Promise.all(actorIds.map(async (id) => [id, await getClerkUser(id)] as const));
    const actorNames = new Map(actorUsers
      .filter((entry): entry is readonly [string, NonNullable<typeof entry[1]>] => Boolean(entry[1]))
      .map(([id, user]) => [id, clerkDisplayName(user)]));
    res.json(rows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      actorClerkUserId: row.actorClerkUserId,
      actorName: actorNames.get(row.actorClerkUserId) ?? null,
      targetType: row.targetType,
      targetId: row.targetId,
      targetName: row.targetType === "course"
        ? courses.find((course) => course.id === Number(row.targetId))?.title ?? null
        : row.targetType === "resource"
          ? courses.find((course) => course.id === resources.find((resource) => resource.id === Number(row.targetId))?.courseId)?.title ?? null
          : null,
      details: row.details,
      createdAt: row.createdAt,
    })));
  } catch (error) {
    next(error);
  }
});

router.delete("/admin/audit-events", requireSystemOwner, async (_req, res, next) => {
  try {
    const deletedCount = await deleteAllAuditEvents();
    res.json({ deletedCount });
  } catch (error) {
    next(error);
  }
});

router.delete("/admin/audit-events/:id", requireSystemOwner, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Audit qeydinin nömrəsi düzgün deyil." });
      return;
    }
    const deleted = await deleteAuditEvent(id);
    if (!deleted) {
      res.status(404).json({ error: "Audit qeydi tapılmadı." });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/admin/academic-profiles", requireTeacher, async (_req, res, next) => {
  try {
    await ensureProfilesForApprovedStudents();
    const rows = await db.select({
      profile: studentAcademicProfilesTable,
      application: applicationsTable,
    }).from(studentAcademicProfilesTable)
      .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
      .where(and(eq(applicationsTable.status, "approved"), isNull(applicationsTable.deletedAt)))
      .orderBy(desc(studentAcademicProfilesTable.id));
    res.json(GetAdminAcademicProfilesResponse.parse(rows.map(({ profile, application }) => toAcademicSummary(profile, application))));
  } catch (error) {
    next(error);
  }
});

async function getAcademicProfileForAdmin(profileId: number) {
  const [row] = await db.select({
    profile: studentAcademicProfilesTable,
    application: applicationsTable,
  }).from(studentAcademicProfilesTable)
    .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
      .where(and(
        eq(studentAcademicProfilesTable.id, profileId),
        eq(applicationsTable.status, "approved"),
        isNull(applicationsTable.deletedAt),
      ))
    .limit(1);
  return row;
}

router.get("/admin/academic-profiles/:profileId", requireTeacher, async (req, res, next) => {
  try {
    const { profileId } = GetAdminAcademicProfileParams.parse(req.params);
    const row = await getAcademicProfileForAdmin(profileId);
    if (!row) {
      res.status(404).json({ error: "Tələbə akademik profili tapılmadı." });
      return;
    }
    res.json(GetAdminAcademicProfileResponse.parse(await buildAcademicProfile(row.profile, row.application, currentTermNumber(row.profile), true)));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/search", requireTeacher, async (req, res, next) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim().toLocaleLowerCase("az-AZ") : "";
    if (query.length < 2) {
      res.json([]);
      return;
    }
    const [students, applications, courses] = await Promise.all([
      db.select({
        profileId: studentAcademicProfilesTable.id,
        studentNumber: studentAcademicProfilesTable.studentNumber,
        firstName: applicationsTable.firstName,
        lastName: applicationsTable.lastName,
        email: applicationsTable.email,
        phone: applicationsTable.phone,
      }).from(studentAcademicProfilesTable)
        .innerJoin(applicationsTable, eq(studentAcademicProfilesTable.applicationId, applicationsTable.id))
        .where(and(eq(applicationsTable.status, "approved"), isNull(applicationsTable.deletedAt))),
      db.select({
        id: applicationsTable.id,
        firstName: applicationsTable.firstName,
        lastName: applicationsTable.lastName,
        email: applicationsTable.email,
        status: applicationsTable.status,
      }).from(applicationsTable).where(isNull(applicationsTable.deletedAt)),
      db.select({ id: coursesTable.id, title: coursesTable.title, instructor: coursesTable.instructor }).from(coursesTable),
    ]);
    const matches = [
      ...students.filter((student) => [student.firstName, student.lastName, student.email, student.phone, String(student.studentNumber), `t${String(student.studentNumber).padStart(4, "0")}`].join(" ").toLocaleLowerCase("az-AZ").includes(query)).map((student) => ({
        kind: "student" as const,
        id: `student:${student.profileId}`,
        profileId: student.profileId,
        title: `${student.firstName} ${student.lastName}`.trim(),
        subtitle: `T${String(student.studentNumber).padStart(4, "0")} · ${student.email}`,
      })),
      ...applications.filter((application) => [application.firstName, application.lastName, application.email, application.status].join(" ").toLocaleLowerCase("az-AZ").includes(query)).map((application) => ({
        kind: "application" as const,
        id: `application:${application.id}`,
        profileId: null,
        title: `${application.firstName} ${application.lastName}`.trim(),
        subtitle: `${application.email} · ${application.status === "pending" ? "Gözləmədə" : application.status === "approved" ? "Təsdiqlənib" : application.status}`,
      })),
      ...courses.filter((course) => `${course.title} ${course.instructor}`.toLocaleLowerCase("az-AZ").includes(query)).map((course) => ({
        kind: "course" as const,
        id: `course:${course.id}`,
        profileId: null,
        title: course.title,
        subtitle: `Dərs · ${course.instructor}`,
      })),
    ].slice(0, 30);
    res.json(matches);
  } catch (error) {
    next(error);
  }
});

router.post("/admin/academic-profiles/bulk-promote", requireTeacher, async (req, res, next) => {
  try {
    const parsedInput = BulkPromoteAcademicProfilesBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Toplu semestr keçidi üçün tələbə siyahısı və cari semestr məlumatı düzgün göndərilməyib." });
      return;
    }
    const requestedIds: unknown[] = parsedInput.data.profileIds;
    const profileIds = Array.from(new Set(requestedIds.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0)));
    if (!profileIds.length || profileIds.length > 200) {
      res.status(400).json({ error: "Ən azı bir və ən çox 200 tələbə seçilməlidir." });
      return;
    }
    const expectedTermByProfileId = new Map(parsedInput.data.expectedCurrentTerms.map((item) => [item.profileId, item.expectedTermNumber]));
    if (expectedTermByProfileId.size !== profileIds.length || profileIds.some((profileId) => !expectedTermByProfileId.has(profileId))) {
      res.status(400).json({ error: "Hər seçilmiş tələbə üçün cari semestr məlumatı göndərilməlidir." });
      return;
    }
    const activeTerms = await getActiveTermNumbers();
    const promotedProfileIds: number[] = [];
    const failures: Array<{ profileId: number; studentName: string; error: string }> = [];
    for (const profileId of profileIds) {
      const row = await getAcademicProfileForAdmin(profileId);
      const studentName = row ? `${row.application.firstName} ${row.application.lastName}`.trim() : "Naməlum tələbə";
      if (!row) {
        failures.push({ profileId, studentName, error: "Təsdiqlənmiş tələbə profili tapılmadı." });
        continue;
      }
      const fromTerm = currentTermNumber(row.profile);
      const expectedTermNumber = expectedTermByProfileId.get(profileId);
      if (fromTerm !== expectedTermNumber) {
        failures.push({ profileId, studentName, error: "Tələbənin semestri artıq yenilənib. Siyahını yeniləyin." });
        continue;
      }
      if (fromTerm >= 8) {
        failures.push({ profileId, studentName, error: "Tələbə artıq son semestrdədir." });
        continue;
      }
      if (!activeTerms.includes(fromTerm + 1)) {
        failures.push({ profileId, studentName, error: "Növbəti semestr hələ aktivləşdirilməyib." });
        continue;
      }
      const { courseYear, semester } = termToCoursePosition(fromTerm + 1);
      const approvedBy = getAuth(req).userId ?? "unknown";
      const [updated] = await db.update(studentAcademicProfilesTable).set({
        courseYear,
        semester,
        promotionApprovedAt: new Date().toISOString(),
        promotionApprovedBy: approvedBy,
        promotionFromTerm: fromTerm,
        updatedAt: new Date().toISOString(),
      }).where(and(
        eq(studentAcademicProfilesTable.id, profileId),
        eq(studentAcademicProfilesTable.courseYear, row.profile.courseYear),
        eq(studentAcademicProfilesTable.semester, row.profile.semester),
      )).returning({ id: studentAcademicProfilesTable.id });
      if (!updated) {
        failures.push({ profileId, studentName, error: "Tələbənin semestri artıq yenilənib. Siyahını yeniləyin." });
        continue;
      }
      promotedProfileIds.push(profileId);
      if (approvedBy !== "unknown") {
        await recordAuditEvent({
          eventType: "student.bulk_promoted",
          actorClerkUserId: approvedBy,
          targetType: "student",
          targetId: profileId,
          details: { fromTerm, toTerm: fromTerm + 1 },
          deduplicationKey: `student.bulk_promoted:${profileId}:${fromTerm + 1}`,
        });
      }
    }
    res.json({ promotedProfileIds, failures });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/academic-profiles/:profileId/promote", requireTeacher, async (req, res, next) => {
  try {
    const { profileId } = GetAdminAcademicProfileParams.parse(req.params);
    const parsedInput = PromoteAcademicProfileBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Keçid üçün tələbənin cari semestri düzgün göndərilməyib." });
      return;
    }
    const row = await getAcademicProfileForAdmin(profileId);
    if (!row || row.application.status !== "approved" || row.application.deletedAt) {
      res.status(404).json({ error: "Təsdiqlənmiş tələbə profili tapılmadı." });
      return;
    }
    const fromTerm = currentTermNumber(row.profile);
    if (fromTerm !== parsedInput.data.expectedTermNumber) {
      res.status(409).json({ error: "Tələbənin semestri artıq yenilənib. Səhifəni yeniləyin." });
      return;
    }
    if (fromTerm >= 8) {
      res.status(409).json({ error: "Tələbə artıq son semestrdədir." });
      return;
    }
    const { courseYear, semester } = termToCoursePosition(fromTerm + 1);
    if (!(await getActiveTermNumbers()).includes(fromTerm + 1)) {
      res.status(409).json({ error: "Növbəti semestr hələ aktivləşdirilməyib." });
      return;
    }
    const approvedBy = getAuth(req).userId ?? "unknown";
    const [updated] = await db.update(studentAcademicProfilesTable).set({
      courseYear,
      semester,
      promotionApprovedAt: new Date().toISOString(),
      promotionApprovedBy: approvedBy,
      promotionFromTerm: fromTerm,
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(studentAcademicProfilesTable.id, profileId),
      eq(studentAcademicProfilesTable.courseYear, row.profile.courseYear),
      eq(studentAcademicProfilesTable.semester, row.profile.semester),
    )).returning();
    if (!updated) {
      res.status(409).json({ error: "Tələbənin semestri artıq yenilənib. Səhifəni yeniləyin." });
      return;
    }
    const updatedRow = await getAcademicProfileForAdmin(profileId);
    if (!updatedRow) throw new Error("Yenilənmiş tələbə profili tapılmadı.");
    res.json(UpdateAcademicProfileResponse.parse(await buildAcademicProfile(updatedRow.profile, updatedRow.application, currentTermNumber(updatedRow.profile), true)));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/academic-profiles/:profileId/demote", requireTeacher, async (req, res, next) => {
  try {
    const { profileId } = GetAdminAcademicProfileParams.parse(req.params);
    const parsedInput = DemoteAcademicProfileBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Qaytarma üçün tələbənin cari semestri düzgün göndərilməyib." });
      return;
    }
    const row = await getAcademicProfileForAdmin(profileId);
    if (!row || row.application.status !== "approved" || row.application.deletedAt) {
      res.status(404).json({ error: "Təsdiqlənmiş tələbə profili tapılmadı." });
      return;
    }
    const fromTerm = currentTermNumber(row.profile);
    if (fromTerm !== parsedInput.data.expectedTermNumber) {
      res.status(409).json({ error: "Tələbənin semestri artıq dəyişib. Səhifəni yeniləyin." });
      return;
    }
    if (fromTerm <= 1) {
      res.status(409).json({ error: "Tələbə artıq ilk semestrdədir." });
      return;
    }
    const { courseYear, semester } = termToCoursePosition(fromTerm - 1);
    const [updated] = await db.update(studentAcademicProfilesTable).set({
      courseYear,
      semester,
      promotionApprovedAt: null,
      promotionApprovedBy: null,
      promotionFromTerm: null,
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(studentAcademicProfilesTable.id, profileId),
      eq(studentAcademicProfilesTable.courseYear, row.profile.courseYear),
      eq(studentAcademicProfilesTable.semester, row.profile.semester),
    )).returning();
    if (!updated) {
      res.status(409).json({ error: "Tələbənin semestri artıq dəyişib. Səhifəni yeniləyin." });
      return;
    }
    const updatedRow = await getAcademicProfileForAdmin(profileId);
    if (!updatedRow) throw new Error("Yenilənmiş tələbə profili tapılmadı.");
    res.json(UpdateAcademicProfileResponse.parse(await buildAcademicProfile(updatedRow.profile, updatedRow.application, currentTermNumber(updatedRow.profile), true)));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/academic-profiles/:profileId/schedule-access", requireTeacher, async (req, res, next) => {
  try {
    const { profileId } = GetAdminAcademicProfileParams.parse(req.params);
    const row = await getAcademicProfileForAdmin(profileId);
    if (!row || row.application.status !== "approved" || row.application.deletedAt) { res.status(404).json({ error: "Təsdiqlənmiş tələbə profili tapılmadı." }); return; }
    res.json({ approved: row.profile.scheduleAccessApproved, onboardingRequired: false, onboardingExamId: null, onboardingExamTitle: null });
  } catch (error) { next(error); }
});

router.post("/admin/academic-profiles/:profileId/schedule-access", requireTeacher, async (req, res, next) => {
  try {
    const { profileId } = GetAdminAcademicProfileParams.parse(req.params);
    const row = await getAcademicProfileForAdmin(profileId);
    if (!row || row.application.status !== "approved" || row.application.deletedAt) { res.status(404).json({ error: "Təsdiqlənmiş tələbə profili tapılmadı." }); return; }
    const approved = req.body?.approved === undefined ? true : req.body.approved;
    if (typeof approved !== "boolean") { res.status(400).json({ error: "Cədvəl giriş statusu düzgün göndərilməyib." }); return; }
    const [updated] = await db.update(studentAcademicProfilesTable).set({ scheduleAccessApproved: approved, updatedAt: new Date().toISOString() }).where(eq(studentAcademicProfilesTable.id, profileId)).returning();
    res.json({ approved: updated?.scheduleAccessApproved ?? row.profile.scheduleAccessApproved, onboardingRequired: false, onboardingExamId: null, onboardingExamTitle: null });
  } catch (error) { next(error); }
});

router.patch("/admin/academic-profiles/:profileId", requireTeacher, async (req, res, next) => {
  try {
    const parsedParams = UpdateAcademicProfileParams.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: "Tələbə akademik profili düzgün seçilməyib." });
      return;
    }
    const parsedInput = UpdateAcademicProfileBody.safeParse(req.body);
    if (!parsedInput.success || !parsedInput.data.program.trim()) {
      res.status(400).json({ error: "Akademik profil məlumatları düzgün göndərilməyib." });
      return;
    }
    const { profileId } = parsedParams.data;
    const input = parsedInput.data;
    const current = await getAcademicProfileForAdmin(profileId);
    if (!current) {
      res.status(404).json({ error: "Tələbə akademik profili tapılmadı." });
      return;
    }
    if (input.courseYear !== current.profile.courseYear || input.semester !== current.profile.semester) {
      res.status(409).json({ error: "Semestr birbaşa dəyişdirilə bilməz. Növbəti semestrə keçid təsdiqindən istifadə edin." });
      return;
    }
    const [updatedProfile] = await db.update(studentAcademicProfilesTable)
      .set({ program: input.program.trim(), updatedAt: new Date().toISOString() })
      .where(eq(studentAcademicProfilesTable.id, profileId))
      .returning();
    res.json(UpdateAcademicProfileResponse.parse(await buildAcademicProfile(updatedProfile ?? current.profile, current.application, currentTermNumber(current.profile), true)));
  } catch (error) {
    next(error);
  }
});

router.put("/admin/academic-profiles/:profileId/grades", requireTeacher, async (req, res, next) => {
  try {
    const { profileId } = UpdateAcademicProfileGradesParams.parse(req.params);
    const parsedInput = UpdateAcademicProfileGradesBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Qiymət məlumatları düzgün göndərilməyib." });
      return;
    }
    const input = parsedInput.data;
    const termError = validateTermNumber(input.termNumber);
    if (termError) {
      res.status(400).json({ error: termError });
      return;
    }
    const row = await getAcademicProfileForAdmin(profileId);
    if (!row) {
      res.status(404).json({ error: "Tələbə akademik profili tapılmadı." });
      return;
    }
    await ensureSeeded();
    const courses = await getCourses();
    const validCourseIds = new Set(courses.map((course) => course.id));
    const receivedCourseIds = input.grades.map((grade) => grade.courseId);
    if (new Set(receivedCourseIds).size !== receivedCourseIds.length || receivedCourseIds.some((id) => !validCourseIds.has(id))) {
      res.status(400).json({ error: "Qiymətləndirmə üçün seçilən fənn düzgün deyil." });
      return;
    }
    const removedSelections = await db.select({ courseId: studentCourseSelectionsTable.courseId }).from(studentCourseSelectionsTable)
      .where(and(
        eq(studentCourseSelectionsTable.profileId, profileId),
        eq(studentCourseSelectionsTable.termNumber, input.termNumber),
        eq(studentCourseSelectionsTable.selected, false),
        inArray(studentCourseSelectionsTable.courseId, receivedCourseIds),
      ));
    if (removedSelections.length) {
      res.status(400).json({ error: "Təsdiqlənmiş fənn silinməsi olan fənnə qiymət yazmaq olmaz." });
      return;
    }
    const normalizedGrades = input.grades.map((grade) => {
      const course = courses.find((item) => item.id === grade.courseId);
      const componentNames = (grade.componentNames ?? []).map((name) => name.trim()).filter(Boolean);
      if (new Set(componentNames).size !== componentNames.length) {
        return { error: "Qiymət meyarları təkrarlana bilməz." } as const;
      }
      const submittedComponentGrades = grade.componentGrades ?? {};
      const componentGrades = Object.fromEntries(componentNames.map((name) => [name, submittedComponentGrades[name] ?? null]));
      const invalidComponent = Object.values(componentGrades).some((score) => score !== null && (!Number.isFinite(score) || score < 0 || score > 100));
      if (invalidComponent) {
        return { error: "Qiymət komponenti 0 ilə 100 arasında olmalıdır." } as const;
      }
      return { course, grade, componentNames, componentGrades } as const;
    });
    const validationError = normalizedGrades.find((item) => "error" in item);
    if (validationError) {
      res.status(400).json({ error: validationError.error });
      return;
    }
    const validGrades = normalizedGrades.flatMap((item) => "error" in item ? [] : [item]);
    const now = new Date().toISOString();
    await Promise.all(validGrades.map(async ({ course, grade, componentNames, componentGrades }) => {
      const calculatedGrade = componentNames.length
        ? calculateComponentGrade(componentNames, componentGrades)
        : grade.grade;
      if (course && JSON.stringify(course.gradingComponents ?? []) !== JSON.stringify(componentNames)) {
        await db.update(coursesTable).set({ gradingComponents: componentNames }).where(eq(coursesTable.id, course.id));
      }
      return db.insert(studentGradesTable).values({
        profileId,
        courseId: grade.courseId,
        termNumber: input.termNumber,
        gradePoints: calculatedGrade === null ? null : Math.round(calculatedGrade),
        componentGrades: JSON.stringify(componentGrades),
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [studentGradesTable.profileId, studentGradesTable.courseId, studentGradesTable.termNumber],
        set: {
          gradePoints: calculatedGrade === null ? null : Math.round(calculatedGrade),
          componentGrades: JSON.stringify(componentGrades),
          updatedAt: now,
        },
      });
    }));
    const actorId = getAuth(req).userId;
    if (actorId) await recordAuditEvent({
      eventType: "grades.updated",
      actorClerkUserId: actorId,
      targetType: "academic_profile",
      targetId: profileId,
      details: { termNumber: input.termNumber, courseCount: input.grades.length },
      deduplicationKey: `grades.updated:${profileId}:${input.termNumber}:${now}`,
    });
    res.json(UpdateAcademicProfileGradesResponse.parse(await buildAcademicProfile(row.profile, row.application, currentTermNumber(row.profile))));
  } catch (error) {
    next(error);
  }
});

router.put("/admin/academic-profiles/:profileId/attendance", requireTeacher, async (req, res, next) => {
  try {
    const { profileId } = UpdateAcademicProfileAttendanceParams.parse(req.params);
    const parsedInput = UpdateAcademicProfileAttendanceBody.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({ error: "Davamiyyət məlumatları düzgün göndərilməyib." });
      return;
    }
    const input = parsedInput.data;
    const termError = validateTermNumber(input.termNumber);
    if (termError) {
      res.status(400).json({ error: termError });
      return;
    }
    if (!isValidIsoDate(input.attendanceDate)) {
      res.status(400).json({ error: "Davamiyyət tarixi düzgün təqvim tarixi olmalıdır." });
      return;
    }
    const row = await getAcademicProfileForAdmin(profileId);
    if (!row) {
      res.status(404).json({ error: "Tələbə akademik profili tapılmadı." });
      return;
    }
    const now = new Date().toISOString();
    const clerkUserId = getAuth(req).userId;
    const clerkUser = clerkUserId ? await getClerkUser(clerkUserId) : null;
    const teacherName = clerkUser
      ? [ownerDisplayNameParts(clerkUser).firstName, ownerDisplayNameParts(clerkUser).lastName].filter(Boolean).join(" ")
      : "Akademiya müəllimi";
    const course = (await getCourses()).find((item) => item.id === input.courseId);
    if (!course) {
      res.status(400).json({ error: "Davamiyyət üçün düzgün fənn seçilməlidir." });
      return;
    }
    const [removedSelection] = await db.select({ courseId: studentCourseSelectionsTable.courseId }).from(studentCourseSelectionsTable)
      .where(and(
        eq(studentCourseSelectionsTable.profileId, profileId),
        eq(studentCourseSelectionsTable.courseId, input.courseId),
        eq(studentCourseSelectionsTable.termNumber, input.termNumber),
        eq(studentCourseSelectionsTable.selected, false),
      )).limit(1);
    if (removedSelection) {
      res.status(400).json({ error: "Təsdiqlənmiş fənn silinməsi olan fənnə qiyab yazmaq olmaz." });
      return;
    }
    await db.insert(studentAttendanceRecordsTable).values({
      profileId,
      courseId: input.courseId,
      termNumber: input.termNumber,
      attendanceDate: input.attendanceDate,
      status: input.status,
      teacherName,
      recordedAt: now,
    }).onConflictDoUpdate({
      target: [studentAttendanceRecordsTable.profileId, studentAttendanceRecordsTable.courseId, studentAttendanceRecordsTable.attendanceDate],
      set: {
        termNumber: input.termNumber,
        status: input.status,
        teacherName,
        recordedAt: now,
      },
    });
    if (clerkUserId) await recordAuditEvent({
      eventType: "attendance.updated",
      actorClerkUserId: clerkUserId,
      targetType: "academic_profile",
      targetId: profileId,
      details: { courseId: input.courseId, termNumber: input.termNumber, attendanceDate: input.attendanceDate, status: input.status },
      deduplicationKey: `attendance.updated:${profileId}:${input.courseId}:${input.attendanceDate}:${now}`,
      notifyOwner: false,
    });
    res.json(UpdateAcademicProfileAttendanceResponse.parse(await buildAcademicProfile(row.profile, row.application, currentTermNumber(row.profile))));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/applications/:applicationId/decision", requireTeacher, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (userId) {
      const actingUser = await getClerkUser(userId);
      if (metadataRole(actingUser?.publicMetadata) === "owner_assistant") {
        res.status(403).json({ error: "Sahib köməkçisi yalnız müəllim təyinatını idarə edə bilər." });
        return;
      }
    }
    const parsedParams = DecideApplicationParams.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: "Müraciət nömrəsi düzgün deyil." });
      return;
    }
    const parsedDecision = DecideApplicationBody.safeParse(req.body);
    if (!parsedDecision.success) {
      res.status(400).json({ error: "Qərar düzgün seçilməyib." });
      return;
    }
    const { applicationId } = parsedParams.data;
    const decision = parsedDecision.data;
    const rejectionReason = decision.rejectionReason?.replace(/\u200B/g, "").trim();
    const [application] = await db.select().from(applicationsTable)
      .where(eq(applicationsTable.id, applicationId)).limit(1);
    if (!application) {
      res.status(404).json({ error: "Müraciət tapılmadı." });
      return;
    }
    if (application.status !== "pending") {
      res.status(409).json({ error: "Bu müraciət üçün artıq qərar verilib." });
      return;
    }
    if (decision.status === "approved" && !application.clerkUserId) {
      res.status(400).json({ error: "Tələbə hesabı ilə əlaqələndirilməmiş müraciət təsdiqlənə bilməz." });
      return;
    }
    if (decisionInProgress.has(applicationId)) {
      res.status(409).json({ error: "Bu müraciət üzrə artıq qərar verilir. Bir az sonra yenidən yoxlayın." });
      return;
    }
    const admissionExamRequired = decision.status === "approved" ? await getAdmissionExamRequired() : false;
    decisionInProgress.add(applicationId);
    try {
      await sendApplicationDecisionEmail({
        to: application.email,
        studentName: `${application.firstName} ${application.lastName}`.trim(),
        approved: decision.status === "approved",
        admissionExamRequired,
        rejectionReason,
      });
      const updated = await db.transaction(async (tx) => {
        if (decision.status === "approved") {
          const now = new Date().toISOString();
          await tx.insert(studentAcademicProfilesTable).values({
            applicationId: application.id,
            clerkUserId: application.clerkUserId as string,
            courseYear: 1,
            semester: 1,
            scheduleAccessApproved: !admissionExamRequired,
            onboardingExamEligible: admissionExamRequired,
            createdAt: now,
            updatedAt: now,
          }).onConflictDoUpdate({
            target: studentAcademicProfilesTable.applicationId,
            set: {
              scheduleAccessApproved: !admissionExamRequired,
              onboardingExamEligible: admissionExamRequired,
              updatedAt: now,
            },
          });
          const [profile] = await tx.select({ id: studentAcademicProfilesTable.id }).from(studentAcademicProfilesTable)
            .where(eq(studentAcademicProfilesTable.applicationId, application.id)).limit(1);
          if (!profile) throw new Error("Tələbə akademik profili yaradıla bilmədi.");
        }
        const [savedApplication] = await tx.update(applicationsTable)
          .set({
            status: decision.status,
            rejectionReason: decision.status === "rejected" ? rejectionReason ?? null : null,
          })
          .where(and(eq(applicationsTable.id, applicationId), eq(applicationsTable.status, "pending")))
          .returning();
        if (!savedApplication) throw new Error("Müraciət qərarı təhlükəsiz şəkildə yadda saxlanıla bilmədi.");
        return savedApplication;
      });
      if (decision.status === "rejected") {
        await cleanupRejectedApplicationFiles({ ...application, status: "rejected" });
      }
      const actorId = getAuth(req).userId;
      if (actorId) await recordAuditEvent({
        eventType: `application.${decision.status}`,
        actorClerkUserId: actorId,
        targetType: "application",
        targetId: applicationId,
        details: { rejectionReason: decision.status === "rejected" ? rejectionReason ?? null : null },
        deduplicationKey: `application.${decision.status}:${applicationId}`,
      });
      res.json(DecideApplicationResponse.parse(toApplication(updated)));
    } catch (error) {
      throw error;
    } finally {
      decisionInProgress.delete(applicationId);
    }
  } catch (error) {
    next(error);
  }
});

router.post("/admin/applications/:applicationId/teacher-role", requireOwnerOrAssistantPermission("teacherAssignment"), async (req, res, next) => {
  try {
    const { applicationId } = AssignApplicationTeacherParams.parse(req.params);
    const [application] = await db.select().from(applicationsTable)
      .where(eq(applicationsTable.id, applicationId)).limit(1);
    if (!application) {
      res.status(404).json({ error: "Müraciət tapılmadı." });
      return;
    }
    if (!application.clerkUserId) {
      res.status(409).json({ error: "Bu müraciət istifadəçi hesabı ilə əlaqələndirilməyib." });
      return;
    }
    const clerkUser = await getClerkUser(application.clerkUserId);
    if (!clerkUser) {
      res.status(404).json({ error: "Müraciətçinin Clerk hesabı tapılmadı." });
      return;
    }
    if (await userIsSystemOwner(application.clerkUserId, clerkUser)) {
      res.status(409).json({ error: "Sistem sahibinə müəllim rolu verilə bilməz." });
      return;
    }
    const publicMetadata = clerkUser.publicMetadata && typeof clerkUser.publicMetadata === "object"
      ? { ...clerkUser.publicMetadata, role: "teacher" }
      : { role: "teacher" };
    const updated = await clerkClient.users.updateUserMetadata(application.clerkUserId, { publicMetadata });
    const actorId = getAuth(req).userId;
    if (actorId) await recordAuditEvent({
      eventType: "teacher.assignment",
      actorClerkUserId: actorId,
      targetType: "application",
      targetId: applicationId,
      details: { assignedUserId: application.clerkUserId },
      deduplicationKey: `teacher.assignment:${applicationId}:${application.clerkUserId}`,
    });
    res.json(AssignApplicationTeacherResponse.parse(toAdminUser(updated)));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/applications/:applicationId/recommendations/:fileIndex", requireTeacher, async (req, res, next) => {
  try {
    const applicationId = Number(req.params.applicationId);
    const fileIndex = Number(req.params.fileIndex);
    if (!Number.isInteger(applicationId) || !Number.isInteger(fileIndex) || fileIndex < 0 || fileIndex > 1) {
      res.status(404).json({ error: "Fayl tapılmadı." });
      return;
    }
    const [application] = await db.select().from(applicationsTable)
      .where(eq(applicationsTable.id, applicationId)).limit(1);
    if (!application || application.status === "rejected") {
      res.status(404).json({ error: "Fayl tapılmadı." });
      return;
    }
    const objectPath = application.recommendationPaths[fileIndex];
    if (!objectPath) {
      res.status(404).json({ error: "Fayl tapılmadı." });
      return;
    }
    const file = await getApplicationFile(objectPath);
    const [metadata] = await file.getMetadata();
    const filename = application.recommendationNames[fileIndex]?.replace(/["\r\n]/g, "") || "tovsiye-mektubu";
    res.setHeader("Content-Type", String(metadata.contentType || "application/octet-stream"));
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    file.createReadStream().on("error", next).pipe(res);
  } catch (error) {
    next(error);
  }
});

export default router;