// Mədinə AI testləri üçün saxta Akademiya məlumatları (internalProvider və aiPolish testləri paylaşır).
import type { AdminAiContext, AiRosterStudent, AiStudentMatch, StudentAiContext } from "./aiProvider.js";

export const allDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function studentContext(approved = true): StudentAiContext {
  return {
    mode: "student",
    overview: async () => ({
      firstName: "Aişə", lastName: "Həsənova", studentNumber: 12, currentTermNumber: 1, termLabel: "1-ci Semestr", program: "İslam elmləri proqramı",
      scheduleAccess: { approved, onboardingRequired: !approved, onboardingExamTitle: approved ? null : "Qəbul testi" },
    }),
    semesters: async () => [{
      termNumber: 1, label: "1-ci Semestr", gpa: 4.5, absencePercent: 5,
      subjects: [
        { courseId: 1, title: "Quran", instructor: "Ustad Əli", isMandatory: true, grade: 4.5, credits: 3, gradingComponents: [{ name: "Ara imtahan", score: 90 }], absenceCount: 1, absencePercent: 5 },
        { courseId: 2, title: "Fiqh", instructor: "Ustad Ömər", isMandatory: true, grade: null, credits: 2, gradingComponents: [], absenceCount: 0, absencePercent: null },
      ],
      attendanceRecords: [{ courseTitle: "Quran", attendanceDate: "2026-10-01", status: "absent" }],
    }],
    lessons: async () => [
      { resourceId: 1, courseId: 1, courseTitle: "Quran", termNumber: 1, title: "Quran qrupu", kind: "lesson", body: "Təcvid", url: "https://zoom.example/1", lessonDays: allDays, lessonTime: "18:00", teacherName: "Ustad Əli", isMandatory: true },
      { resourceId: 2, courseId: 2, courseTitle: "Fiqh", termNumber: 1, title: "Fiqh", kind: "lesson", body: "", url: null, lessonDays: ["monday"], lessonTime: "19:00", teacherName: "Ustad Ömər", isMandatory: true },
    ],
    assignments: async () => [
      { id: 1, courseTitle: "Quran", teacherName: "Ustad Əli", title: "Fatihə əzbəri", dueAt: new Date(Date.now() + 86_400_000), maxScore: 100, status: "open", submission: null },
      { id: 2, courseTitle: "Fiqh", teacherName: "Ustad Ömər", title: "Dəstəmaz", dueAt: new Date(Date.now() - 86_400_000), maxScore: 100, status: "closed", submission: { status: "graded", submittedAt: new Date(), score: 95, feedback: "Əla" } },
    ],
    exams: async () => [{ id: 1, courseTitle: "Quran", title: "Təcvid testi", status: "open", isOnboarding: false, durationMinutes: 20, result: null, submittedAt: null }],
    notices: async () => ({ announcements: [{ title: "Bayram", body: "Dərslər olmayacaq", date: "2026-10-01" }], notifications: [] }),
  };
}

export const students: AiStudentMatch[] = [
  { profileId: 1, studentNumber: 12, firstName: "Aişə", lastName: "Həsənova", email: "aise@example.com", phone: "+994501234567", username: "aise", currentTermNumber: 1 },
  { profileId: 2, studentNumber: 13, firstName: "Əli", lastName: "Məmmədov", email: "ali@example.com", phone: "+994551112233", username: "ali", currentTermNumber: 2 },
  { profileId: 3, studentNumber: 14, firstName: "Əli", lastName: "Quliyev", email: "aliq@example.com", phone: "+994701112244", username: "aliq", currentTermNumber: 2 },
];

export const quranLesson = { resourceId: 1, courseId: 1, courseTitle: "Quran", termNumber: 1, title: "Quran", kind: "lesson", body: "", url: null, lessonDays: ["monday"], lessonTime: "18:00", teacherName: "Ustad Əli", isMandatory: true };
export const fiqhLesson = { resourceId: 2, courseId: 2, courseTitle: "Fiqh", termNumber: 2, title: "Fiqh", kind: "lesson", body: "", url: null, lessonDays: ["wednesday"], lessonTime: "19:00", teacherName: "Ustad Ömər", isMandatory: true };

export const roster: AiRosterStudent[] = [
  { ...students[0], program: "İslam elmləri proqramı", arabicLevel: "Başlanğıc", scheduleApproved: true, gradeAverage: 92, gradedCourses: 2, absences: 0, missingAssignments: [], courseTitles: ["Quran"], teacherNames: ["Ustad Əli"] },
  { ...students[1], program: "İslam elmləri proqramı", arabicLevel: "Orta", scheduleApproved: true, gradeAverage: 55, gradedCourses: 1, absences: 5, missingAssignments: [{ title: "Fiqh esse", courseTitle: "Fiqh", dueAt: new Date(Date.now() - 86_400_000), overdue: true }], courseTitles: ["Fiqh"], teacherNames: ["Ustad Ömər"] },
  { ...students[2], program: "Hafizlik proqramı", arabicLevel: "Orta", scheduleApproved: false, gradeAverage: 71, gradedCourses: 1, absences: 2, missingAssignments: [], courseTitles: ["Fiqh"], teacherNames: ["Ustad Ömər"] },
];

export function adminContext(permissions: string[] = ["students", "schedule", "applications", "assignments", "announcements", "excuses"], options: { isOwner?: boolean; role?: string } = {}): AdminAiContext {
  const can = (permission: string) => options.isOwner || permissions.includes(permission);
  return {
    mode: "admin",
    permissions: new Set(permissions),
    isOwner: options.isOwner ?? false,
    role: options.role ?? "admin",
    allStudents: async () => students,
    studentDetails: async (profileId) => {
      const match = students.find((item) => item.profileId === profileId);
      if (!match) return null;
      return {
        match, birthDate: "2000-01-01", arabicLevel: "Orta", program: "İslam elmləri proqramı", termLabel: "2-ci Semestr",
        semesters: [{ termNumber: 2, label: "2-ci Semestr", gpa: 4, absencePercent: 10, subjects: [{ courseId: 1, title: "Quran", instructor: "Ustad Əli", isMandatory: true, grade: 4, credits: 3, gradingComponents: [], absenceCount: 2, absencePercent: 10 }], attendanceRecords: [] }],
        assignments: [{ courseTitle: "Quran", title: "Fatihə", dueAt: new Date(), maxScore: 100, submissionStatus: "graded", score: 80 }],
        exams: [{ courseTitle: "Quran", title: "Təcvid testi", isOnboarding: false, percentage: 70, correctCount: 7, totalQuestions: 10, submittedAt: new Date() }],
      };
    },
    courses: async () => [
      { courseId: 1, title: "Quran", category: "Quran elmləri", instructor: "", lessons: [quranLesson] },
      { courseId: 2, title: "Fiqh", category: "Fiqh", instructor: "", lessons: [fiqhLesson] },
    ],
    courseStudents: async (courseId) => (courseId === 1 ? [students[0]] : [students[1], students[2]]),
    teacherSchedule: async () => [quranLesson, fiqhLesson],
    roster: async () => roster,
    teachers: async () => (can("schedule") ? [
      { clerkUserId: "u1", name: "Ustad Əli", email: null, role: "teacher", lessons: [quranLesson], studentCount: 1 },
      { clerkUserId: "u2", name: "Ustad Ömər", email: null, role: "teacher", lessons: [fiqhLesson], studentCount: 2 },
    ] : null),
    staff: async () => ((options.isOwner || options.role === "owner_assistant") && can("userRoleManagement") ? [
      { clerkUserId: "u1", name: "Ustad Əli", email: "ali.teacher@example.com", role: "teacher" },
      { clerkUserId: "u2", name: "Ustad Ömər", email: "omar@example.com", role: "teacher" },
      { clerkUserId: "u3", name: "Nərgiz Abbasova", email: "nergiz@example.com", role: "admin" },
    ] : null),
    applications: async () => (can("applications") ? [
      { id: 1, firstName: "Rəşad", lastName: "Kərimov", email: "resad@example.com", phone: "+994 50 999 88 77", username: "resad", arabicLevel: "Yoxdur", status: "pending", rejectionReason: null, createdAt: "2026-10-01", deleted: false },
      { id: 2, firstName: "Leyla", lastName: "Hüseynova", email: "leyla@example.com", phone: "0551234567", username: "leyla", arabicLevel: "Orta", status: "pending", rejectionReason: null, createdAt: "2026-10-02", deleted: false },
      { id: 3, firstName: "Murad", lastName: "Səfərov", email: "murad@example.com", phone: "0701234567", username: "murad", arabicLevel: "Yoxdur", status: "rejected", rejectionReason: "Natamam sənəd", createdAt: "2026-09-20", deleted: false },
    ] : null),
    subjectRequests: async () => (can("applications") ? [{ studentName: "Əli Quliyev", studentNumber: 14, courseTitle: "Fiqh", termNumber: 2, status: "pending", reason: "Vaxt uyğun deyil", createdAt: "2026-10-03" }] : null),
    assignmentsOverview: async () => (can("assignments") ? [
      { id: 1, courseTitle: "Fiqh", title: "Fiqh esse", termNumber: 2, teacherName: "Ustad Ömər", dueAt: new Date(Date.now() - 86_400_000), maxScore: 100, status: "open", submitted: 1, graded: 0, pendingReview: 1, averageScore: null, missingStudents: [{ name: "Əli Məmmədov", studentNumber: 13 }] },
      { id: 2, courseTitle: "Quran", title: "Fatihə əzbəri", termNumber: 1, teacherName: "Ustad Əli", dueAt: new Date(Date.now() + 86_400_000), maxScore: 100, status: "open", submitted: 1, graded: 1, pendingReview: 0, averageScore: 95, missingStudents: [] },
    ] : null),
    examsOverview: async () => [
      { id: 1, courseTitle: "Quran", title: "Təcvid testi", termNumber: 1, isOnboarding: false, status: "open", results: [{ studentName: "Aişə Həsənova", studentNumber: 12, percentage: 90, correctCount: 9, totalQuestions: 10, submittedAt: new Date() }] },
      { id: 2, courseTitle: "Ümumi qəbul testi", title: "Qəbul testi", termNumber: 1, isOnboarding: true, status: "open", results: [] },
    ],
    notices: async () => (can("announcements") ? [
      { kind: "announcement", title: "Bayram tətili", body: "Dərslər olmayacaq", date: "2026-10-01", target: null },
      { kind: "notification", title: "İmtahan xatırlatması", body: "Sabah test var", date: "2026-10-05", target: "1-ci semestr" },
    ] : null),
    excuses: async () => (can("excuses") ? [{ studentName: "Əli Məmmədov", studentNumber: 13, courseTitle: "Fiqh", attendanceDate: "2026-10-02", status: "pending", reason: "Xəstə idim", createdAt: "2026-10-02" }] : null),
    questions: async () => [
      { title: "Təcvid qaydaları haqqında", answered: false, answeredByName: null, createdAt: "2026-10-04" },
      { title: "Namaz vaxtları", answered: true, answeredByName: "Ustad Əli", createdAt: "2026-10-01" },
    ],
  };
}
