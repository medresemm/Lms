// Mədinə AI üçün provayder interfeysi.
//
// Hazırda yalnız "internal" provayder var: heç bir xarici xidmətə müraciət etmir, API açarı tələb
// etmir və cavabları LMS-in öz məlumatlarından deterministik qaydada qurur. Gələcəkdə real dil modeli
// qoşmaq lazım olsa, yeni provayder bu interfeysi tətbiq edib `MEDINE_AI_PROVIDER` env dəyişəni ilə
// seçilə bilər. Provayder heç nə saxlamamalıdır: söhbət tarixçəsi yalnız brauzerdə (localStorage) qalır.
import { internalAiProvider } from "./internalProvider.js";

export type AiMode = "student" | "admin";

export interface AiChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AiReply {
  reply: string;
  suggestions: string[];
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

export interface AdminAiContext {
  mode: "admin";
  /** İstifadəçinin rol icazələri (sahib üçün hamısı). */
  permissions: ReadonlySet<string>;
  isOwner: boolean;
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
