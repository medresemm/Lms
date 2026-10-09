import assert from "node:assert/strict";
import test from "node:test";
import { internalAiProvider, normalizeText } from "./internalProvider.js";
import type { AdminAiContext, AiStudentMatch, StudentAiContext } from "./aiProvider.js";

const allDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function studentContext(approved = true): StudentAiContext {
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

const students: AiStudentMatch[] = [
  { profileId: 1, studentNumber: 12, firstName: "Aişə", lastName: "Həsənova", email: "aise@example.com", phone: "+994501234567", username: "aise", currentTermNumber: 1 },
  { profileId: 2, studentNumber: 13, firstName: "Əli", lastName: "Məmmədov", email: "ali@example.com", phone: "+994551112233", username: "ali", currentTermNumber: 2 },
  { profileId: 3, studentNumber: 14, firstName: "Əli", lastName: "Quliyev", email: "aliq@example.com", phone: "+994701112244", username: "aliq", currentTermNumber: 2 },
];

function adminContext(permissions: string[] = ["students", "schedule"]): AdminAiContext {
  return {
    mode: "admin",
    permissions: new Set(permissions),
    isOwner: false,
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
    courses: async () => [{ courseId: 1, title: "Quran", category: "Quran elmləri", instructor: "", lessons: [{ resourceId: 1, courseId: 1, courseTitle: "Quran", termNumber: 1, title: "Quran", kind: "lesson", body: "", url: null, lessonDays: ["monday"], lessonTime: "18:00", teacherName: "Ustad Əli", isMandatory: true }] }],
    courseStudents: async () => [students[0]],
    teacherSchedule: async () => [{ resourceId: 1, courseId: 1, courseTitle: "Quran", termNumber: 1, title: "Quran", kind: "lesson", body: "", url: null, lessonDays: ["monday"], lessonTime: "18:00", teacherName: "Ustad Əli", isMandatory: true }],
  };
}

const ask = (message: string, context: StudentAiContext | AdminAiContext) => internalAiProvider.answer({ message, history: [] }, context);

test("normalizes Azerbaijani and Turkish letters", () => {
  assert.equal(normalizeText("Qiymətlərim NƏDİR? Öğrenci şçğ"), "qiymetlerim nedir ogrenci scg");
});

test("student schedule, today and locked schedule", async () => {
  assert.match((await ask("Dərs cədvəlim", studentContext())).reply, /Bazar ertəsi:[\s\S]*Fiqh/);
  assert.match((await ask("Bu gün dərsim var?", studentContext())).reply, /Bu gün .*Quran/s);
  assert.match((await ask("ders programim ne zaman", studentContext(false))).reply, /hələ açılmayıb[\s\S]*Qəbul testi/);
});

test("student assignments, exams, grades, attendance, resources", async () => {
  assert.match((await ask("Tapşırıqlarım", studentContext())).reply, /Fatihə əzbəri.*təhvil verilməyib/);
  assert.match((await ask("ödevlerim neler", studentContext())).reply, /95\/100/);
  assert.match((await ask("imtahanlarım", studentContext())).reply, /Təcvid testi/);
  assert.match((await ask("Qiymətlərim", studentContext())).reply, /Quran: 4\.5/);
  assert.match((await ask("Fiqh notum", studentContext())).reply, /Fiqh: daxil edilməyib/);
  assert.doesNotMatch((await ask("Fiqh notum", studentContext())).reply, /Quran:/);
  assert.match((await ask("davamiyyətim", studentContext())).reply, /Quran: 1 qayıb/);
  assert.match((await ask("Resurslar", studentContext())).reply, /zoom\.example/);
  assert.match((await ask("elanlar", studentContext())).reply, /Bayram/);
});

test("student cannot ask about other students and gets help fallback", async () => {
  assert.match((await ask("başqa tələbələrin qiymətləri", studentContext())).reply, /yalnız sizin öz/);
  assert.match((await ask("asdfgh", studentContext())).reply, /başa düşmədim/);
  assert.match((await ask("Salam", studentContext())).reply, /Salam, Aişə/);
});

test("admin search: single match returns full details, multiple returns list", async () => {
  const single = await ask("Aişə Həsənova haqqında məlumat", adminContext());
  assert.match(single.reply, /T0012[\s\S]*aise@example\.com[\s\S]*Quran[\s\S]*Təcvid testi — Quran: 7\/10/);
  assert.match((await ask("T0013", adminContext())).reply, /Məmmədov/);
  assert.match((await ask("ali@example.com", adminContext())).reply, /Məmmədov/);
  const multi = await ask("Əli", adminContext());
  assert.match(multi.reply, /2 tələbə tapıldı/);
  assert.deepEqual(multi.suggestions, ["T0013", "T0014"]);
  assert.match((await ask("Əlinin qiymətləri", adminContext())).reply, /2 tələbə tapıldı/);
});

test("admin courses, teacher schedule, stats and permissions", async () => {
  assert.match((await ask("Kurs siyahısı", adminContext())).reply, /Quran \(Quran elmləri\)/);
  assert.match((await ask("Quran tələbələri", adminContext())).reply, /Tələbələr \(1\)[\s\S]*T0012/);
  assert.match((await ask("Müəllim cədvəli", adminContext())).reply, /Ustad Əli:[\s\S]*Bazar ertəsi 18:00/);
  assert.match((await ask("Tələbə statistikası", adminContext())).reply, /tələbə sayı: 3/);
  assert.match((await ask("Müəllim cədvəli", adminContext(["students"]))).reply, /icazə/);
  assert.match((await ask("Tələbə axtar", adminContext())).reply, /Kimi axtarım/);
});
