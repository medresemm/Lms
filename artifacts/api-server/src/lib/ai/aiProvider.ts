// Mədinə AI üçün provayder interfeysi.
//
// Hazırda yalnız "internal" provayder var: heç bir xarici xidmətə müraciət etmir, API açarı tələb
// etmir və cavabları LMS-in öz məlumatlarından deterministik qaydada qurur. Gələcəkdə real dil modeli
// qoşmaq lazım olsa, yeni provayder bu interfeysi tətbiq edib `MEDINE_AI_PROVIDER` env dəyişəni ilə
// seçilə bilər. Provayder heç nə saxlamamalıdır: söhbət tarixçəsi yalnız brauzerdə (localStorage) qalır.
import { internalAiProvider } from "./internalProvider.js";
import type { AiBlock } from "./blocks.js";

export type AiMode = "student" | "admin";

export interface AiChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AiReply {
  reply: string;
  suggestions: string[];
  /** Strukturlu kart blokları (bax: blocks.ts). Köhnə müştərilər `reply` mətnini göstərir. */
  blocks?: AiBlock[];
}

export interface AiScheduleAccess {
  approved: boolean;
  onboardingRequired: boolean;
  onboardingExamTitle: string | null;
}

export interface AiStudentOverview {
  firstName: string;
  lastName: string;
  studentNumber: number;
  currentTermNumber: number;
  termLabel: string;
  program: string | null;
  scheduleAccess: AiScheduleAccess;
}

export interface AiSubject {
  courseId: number;
  title: string;
  instructor: string;
  isMandatory: boolean;
  grade: number | null;
  credits: number | null;
  gradingComponents: Array<{ name: string; score: number | null }>;
  absenceCount: number;
  absencePercent: number | null;
}

export interface AiSemester {
  termNumber: number;
  label: string;
  gpa: number | null;
  absencePercent: number | null;
  subjects: AiSubject[];
  attendanceRecords: Array<{ courseTitle: string; attendanceDate: string; status: string }>;
}

export interface AiLesson {
  resourceId: number;
  courseId: number;
  courseTitle: string;
  termNumber: number;
  title: string;
  kind: string;
  body: string;
  url: string | null;
  lessonDays: string[];
  lessonTime: string | null;
  teacherName: string | null;
  isMandatory: boolean;
}

export interface AiAssignment {
  id: number;
  courseTitle: string;
  teacherName: string;
  title: string;
  dueAt: Date;
  maxScore: number;
  status: "open" | "closed";
  submission: { status: string; submittedAt: Date | string | null; score: number | null; feedback: string | null } | null;
}

export interface AiExam {
  id: number;
  courseTitle: string;
  title: string;
  status: "open" | "closed";
  isOnboarding: boolean;
  durationMinutes: number | null;
  result: { correctCount: number; totalQuestions: number; percentage: number } | null;
  submittedAt: Date | string | null;
}

export interface AiNotice {
  title: string;
  body: string;
  date: string | null;
}

export interface StudentAiContext {
  mode: "student";
  overview(): Promise<AiStudentOverview>;
  semesters(): Promise<AiSemester[]>;
  lessons(): Promise<AiLesson[]>;
  assignments(): Promise<AiAssignment[]>;
  exams(): Promise<AiExam[]>;
  notices(): Promise<{ announcements: AiNotice[]; notifications: AiNotice[] }>;
}

export interface AiStudentMatch {
  profileId: number;
  studentNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  username: string | null;
  currentTermNumber: number;
}

export interface AiStudentDetails {
  match: AiStudentMatch;
  birthDate: string | null;
  arabicLevel: string | null;
  program: string | null;
  termLabel: string;
  semesters: AiSemester[];
  assignments: Array<{ courseTitle: string; title: string; dueAt: Date; maxScore: number; submissionStatus: string | null; score: number | null }>;
  exams: Array<{ courseTitle: string; title: string; isOnboarding: boolean; percentage: number; correctCount: number; totalQuestions: number; submittedAt: Date | string | null }>;
}

export interface AiCourseInfo {
  courseId: number;
  title: string;
  category: string;
  instructor: string;
  lessons: AiLesson[];
}

/** Admin axtarışı üçün tələbə sətri (cari semestr üzrə toplanmış göstəricilərlə). */
export interface AiRosterStudent extends AiStudentMatch {
  program: string | null;
  arabicLevel: string | null;
  scheduleApproved: boolean;
  /** Cari semestr qiymətlərinin ortalaması, 100 ballıq şkala ilə. */
  gradeAverage: number | null;
  gradedCourses: number;
  /** Cari semestrdə «qayıb» qeydlərinin sayı. */
  absences: number;
  /** Cari semestrdə təhvil verilməmiş tapşırıqlar. */
  missingAssignments: Array<{ title: string; courseTitle: string; dueAt: Date; overdue: boolean }>;
  /** Cari semestrdə oxuduğu fənlər və müəllim qrupları. */
  courseTitles: string[];
  teacherNames: string[];
}

export interface AiTeacher {
  clerkUserId: string;
  name: string;
  /** Yalnız istifadəçi idarəetməsi icazəsi olanlara göstərilir. */
  email: string | null;
  role: string;
  lessons: AiLesson[];
  studentCount: number;
}

export interface AiStaffMember {
  clerkUserId: string;
  name: string;
  email: string | null;
  role: string;
}

export interface AiApplication {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  username: string;
  arabicLevel: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  deleted: boolean;
}

export interface AiSubjectRequest {
  studentName: string;
  studentNumber: number | null;
  courseTitle: string;
  termNumber: number;
  status: string;
  reason: string;
  createdAt: string;
}

export interface AiAssignmentOverview {
  id: number;
  courseTitle: string;
  title: string;
  termNumber: number;
  teacherName: string | null;
  dueAt: Date;
  maxScore: number;
  status: string;
  submitted: number;
  graded: number;
  pendingReview: number;
  averageScore: number | null;
  missingStudents: Array<{ name: string; studentNumber: number }>;
}

export interface AiExamOverview {
  id: number;
  courseTitle: string;
  title: string;
  termNumber: number;
  isOnboarding: boolean;
  status: string;
  results: Array<{ studentName: string; studentNumber: number | null; percentage: number; correctCount: number; totalQuestions: number; submittedAt: Date | string | null }>;
}

export interface AiNoticeItem {
  kind: "announcement" | "notification";
  title: string;
  body: string;
  date: string | null;
  target: string | null;
}

export interface AiExcuse {
  studentName: string;
  studentNumber: number | null;
  courseTitle: string;
  attendanceDate: string | null;
  status: string;
  reason: string;
  createdAt: string;
}

export interface AiQuestionItem {
  title: string;
  answered: boolean;
  answeredByName: string | null;
  createdAt: string;
}

export interface AdminAiContext {
  mode: "admin";
  /** İstifadəçinin rol icazələri (sahib üçün hamısı). */
  permissions: ReadonlySet<string>;
  isOwner: boolean;
  /** Clerk rolu (owner, owner_assistant, admin, teacher, supervisor). */
  role: string;
  /** Aktiv tələbələr və cari semestr göstəriciləri («students» icazəsi). */
  roster(): Promise<AiRosterStudent[]>;
  /** Müəllimlər, dərsləri və tələbə sayı («schedule» icazəsi; yoxdursa null). */
  teachers(): Promise<AiTeacher[] | null>;
  /** Bütün heyət üzvləri və e-poçtları (sahib/sahib köməkçisi + «userRoleManagement»; yoxdursa null). */
  staff(): Promise<AiStaffMember[] | null>;
  /** Qəbul müraciətləri («applications»; yoxdursa null). */
  applications(): Promise<AiApplication[] | null>;
  /** Fəndən imtina müraciətləri («applications»; yoxdursa null). */
  subjectRequests(): Promise<AiSubjectRequest[] | null>;
  /** Tapşırıqlar və təhvil statistikası («assignments»; yoxdursa null). */
  assignmentsOverview(): Promise<AiAssignmentOverview[] | null>;
  /** Testlər və nəticələr. */
  examsOverview(): Promise<AiExamOverview[]>;
  /** Elanlar və tələbə bildirişləri («announcements»; yoxdursa null). */
  notices(): Promise<AiNoticeItem[] | null>;
  /** Davamiyyət üzrləri («excuses»; yoxdursa null). */
  excuses(): Promise<AiExcuse[] | null>;
  /** Sual-cavab bölməsinin sualları (yalnız başlıq və status). */
  questions(): Promise<AiQuestionItem[]>;
  allStudents(): Promise<AiStudentMatch[]>;
  studentDetails(profileId: number): Promise<AiStudentDetails | null>;
  courses(): Promise<AiCourseInfo[]>;
  courseStudents(courseId: number): Promise<AiStudentMatch[]>;
  teacherSchedule(): Promise<AiLesson[]>;
}

export type AiContext = StudentAiContext | AdminAiContext;

export interface AiProvider {
  readonly name: string;
  answer(input: { message: string; history: AiChatTurn[] }, context: AiContext): Promise<AiReply>;
}

let warnedUnknownProvider = false;

export function getAiProvider(): AiProvider {
  const configured = (process.env.MEDINE_AI_PROVIDER ?? "internal").trim().toLowerCase();
  if (configured && configured !== "internal" && !warnedUnknownProvider) {
    warnedUnknownProvider = true;
    // Xarici provayder hələ qoşulmayıb; təhlükəsiz olaraq daxili mühərrikə qayıdırıq.
    console.warn(`MEDINE_AI_PROVIDER="${configured}" dəstəklənmir; daxili mühərrik istifadə olunur.`);
  }
  return internalAiProvider;
}
