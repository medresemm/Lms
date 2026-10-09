import assert from "node:assert/strict";
import test from "node:test";
import { internalAiProvider, normalizeText } from "./internalProvider.js";
import type { AdminAiContext, AiRosterStudent, AiStudentMatch, StudentAiContext } from "./aiProvider.js";

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

const quranLesson = { resourceId: 1, courseId: 1, courseTitle: "Quran", termNumber: 1, title: "Quran", kind: "lesson", body: "", url: null, lessonDays: ["monday"], lessonTime: "18:00", teacherName: "Ustad Əli", isMandatory: true };
const fiqhLesson = { resourceId: 2, courseId: 2, courseTitle: "Fiqh", termNumber: 2, title: "Fiqh", kind: "lesson", body: "", url: null, lessonDays: ["wednesday"], lessonTime: "19:00", teacherName: "Ustad Ömər", isMandatory: true };

const roster: AiRosterStudent[] = [
  { ...students[0], program: "İslam elmləri proqramı", arabicLevel: "Başlanğıc", scheduleApproved: true, gradeAverage: 92, gradedCourses: 2, absences: 0, missingAssignments: [], courseTitles: ["Quran"], teacherNames: ["Ustad Əli"] },
  { ...students[1], program: "İslam elmləri proqramı", arabicLevel: "Orta", scheduleApproved: true, gradeAverage: 55, gradedCourses: 1, absences: 5, missingAssignments: [{ title: "Fiqh esse", courseTitle: "Fiqh", dueAt: new Date(Date.now() - 86_400_000), overdue: true }], courseTitles: ["Fiqh"], teacherNames: ["Ustad Ömər"] },
  { ...students[2], program: "Hafizlik proqramı", arabicLevel: "Orta", scheduleApproved: false, gradeAverage: 71, gradedCourses: 1, absences: 2, missingAssignments: [], courseTitles: ["Fiqh"], teacherNames: ["Ustad Ömər"] },
];

function adminContext(permissions: string[] = ["students", "schedule", "applications", "assignments", "announcements", "excuses"], options: { isOwner?: boolean; role?: string } = {}): AdminAiContext {
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

test("student site guide: how/where questions win over data questions", async () => {
  const cases: Array<[string, RegExp]> = [
    ["Tapşırığı necə göndərim?", /Ev tapşırığını göndərmək[\s\S]*«Təhvili göndər»/],
    ["Dərs cədvəlini harada görüm?", /Dərs cədvəlinə baxmaq[\s\S]*«Dərs Cədvəlim»/],
    ["Qayıb üzrlü necə yazım?", /Qayıb üçün üzr bildirmək[\s\S]*«Üzr bildir»[\s\S]*«Üzrü göndər»/],
    ["Resurslar haradadır?", /Resurslar, kitablar və materiallar[\s\S]*«PDF və bütün linklərə bax»/],
    ["Müəllimə necə mesaj yazım?", /Müəllimə mesaj yazmaq[\s\S]*«Müəllim seçin»/],
    ["Sual-cavab necə işləyir?", /Sual-cavab bölməsi[\s\S]*«Sualı göndər»/],
    ["Profilimi necə dəyişim?", /Şəxsi məlumatları dəyişmək[\s\S]*«Dəyişiklikləri yadda saxla»/],
    ["İmtahan necə verilir?", /İmtahan və test vermək[\s\S]*«Cavabları göndər»/],
    ["Bildirişlər harada?", /Bildirişlər və yeniliklər[\s\S]*«Bildirişləri göstər»/],
    ["Çıxış necə edim?", /Hesabdan çıxmaq[\s\S]*«Çıxış»/],
    ["çıxış", /Hesabdan çıxmaq/],
    ["Saytdan istifadə", /Tələbə kabinetindən istifadə[\s\S]*«Menyunu aç»/],
    ["ödevimi nasıl yüklerim", /Ev tapşırığını göndərmək/],
    ["derse nasıl katılırım", /Onlayn dərsə qoşulmaq/],
    ["Şifrəmi unutdum", /Şifrəni unutmusunuzsa[\s\S]*«Bərpa kodunu göndər»/],
    ["şifrəmi necə dəyişim", /Şifrəni dəyişmək[\s\S]*«Mövcud şifrə»/],
    ["müəllimi necə dəyişim", /Fənləri və müəllimi idarə etmək[\s\S]*«Müəllimi dəyiş»/],
  ];
  for (const [question, expected] of cases) {
    assert.match((await ask(question, studentContext())).reply, expected, question);
  }
});

test("data questions without how/where cues still return data", async () => {
  assert.match((await ask("Tapşırıqlarım", studentContext())).reply, /Fatihə əzbəri/);
  assert.match((await ask("Neçə qayıbım var?", studentContext())).reply, /Quran: 1 qayıb/);
  assert.match((await ask("Neçə tələbə var?", adminContext())).reply, /tələbə sayı: 3/);
  assert.match((await ask("salam", studentContext())).reply, /Tapşırığı necə göndərim/);
});

test("admin site guide", async () => {
  assert.match((await ask("Elanı necə yayımlayım?", adminContext())).reply, /«Elanı yayımla»/);
  assert.match((await ask("Tələbələri harada idarə edim?", adminContext())).reply, /«Tələbələri idarə et»[\s\S]*«Qiymətləndirmə»/);
  assert.match((await ask("Test necə yaradım?", adminContext())).reply, /«Yeni test»/);
  assert.match((await ask("Mesajlara necə cavab verim?", adminContext())).reply, /«Məsləhətləşmə \/ Əlaqə»/);
  assert.match((await ask("Admin paneldən necə istifadə edim?", adminContext())).reply, /Admin paneldən istifadə/);
  assert.doesNotMatch((await ask("Tapşırığı necə göndərim?", adminContext())).reply, /Ev tapşırığını göndərmək/);
});

test("admin fuzzy student search tolerates typos, order and transliteration", async () => {
  assert.match((await ask("Aishe Hesenova", adminContext())).reply, /T0012[\s\S]*aise@example\.com/);
  assert.match((await ask("Hesenova Aise", adminContext())).reply, /T0012/);
  assert.match((await ask("Mamedov Ali", adminContext())).reply, /Məmmədov \(T0013\)/);
  assert.match((await ask("Əli Mämmädov", adminContext())).reply, /T0013/);
  assert.match((await ask("Məmədof", adminContext())).reply, /T0013/);
  assert.match((await ask("Kuliyev", adminContext())).reply, /Quliyev \(T0014\)/);
  assert.match((await ask("Алиев Мамедов", adminContext())).reply, /T0013/);
  assert.match((await ask("055 111 22 33", adminContext())).reply, /T0013/);
  assert.match((await ask("+994 70 111 22 44", adminContext())).reply, /T0014/);
  assert.match((await ask("t13", adminContext())).reply, /Məmmədov/);
});

test("admin typo-tolerant intents and filters", async () => {
  assert.match((await ask("qayıbı çox olanlar", adminContext())).reply, /3 və daha çox qayıb[\s\S]*T0013 — Əli Məmmədov[\s\S]*5 qayıb/);
  assert.match((await ask("davamiyet", adminContext())).reply, /qayıbı olan tələbələr: 2 \/ 3/);
  assert.match((await ask("ortalaması 60-dan aşağı olanlar", adminContext())).reply, /60-dən aşağı[\s\S]*T0013[\s\S]*ortalama: 55/);
  assert.doesNotMatch((await ask("ortalaması 60-dan aşağı olanlar", adminContext())).reply, /T0012/);
  assert.match((await ask("qiymtlr", adminContext())).reply, /Ən aşağı ortalamalar/);
  assert.match((await ask("2-ci semestr tələbələri", adminContext())).reply, /2-ci semestr[\s\S]*2 tələbə tapıldı/);
  assert.match((await ask("neçə tələbə var 2 semestr", adminContext())).reply, /Uyğun tələbə sayı: 2/);
  assert.match((await ask("tapşırığı təhvil verməyənlər", adminContext())).reply, /T0013[\s\S]*Fiqh esse/);
  assert.match((await ask("tapsirigi vermeyen telebeler", adminContext())).reply, /T0013/);
  assert.match((await ask("Hafizlik proqramı tələbələri", adminContext())).reply, /T0014/);
  assert.match((await ask("ərəb dili orta olanlar", adminContext())).reply, /T0013[\s\S]*T0014/);
  assert.match((await ask("cədvəli açılmayan tələbələr", adminContext())).reply, /T0014/);
  assert.match((await ask("Ustad Ömər qrupunun tələbələri", adminContext())).reply, /T0013[\s\S]*T0014/);
});

test("admin teachers, staff and other entities", async () => {
  assert.match((await ask("neçə müəllim var", adminContext())).reply, /Müəllim sayı: 2/);
  assert.match((await ask("nece muelim var", adminContext())).reply, /Müəllim sayı: 2/);
  assert.match((await ask("Ustad Omer", adminContext())).reply, /Ustad Ömər[\s\S]*tələbə sayı: 2[\s\S]*Fiqh/);
  assert.match((await ask("müəllimlər", adminContext(["students"]))).reply, /icazə/);
  assert.match((await ask("heyət siyahısı", adminContext())).reply, /yalnız sahib/);
  assert.match((await ask("heyət siyahısı", adminContext([], { isOwner: true }))).reply, /Heyət üzvləri: 3[\s\S]*nergiz@example\.com/);
  assert.match((await ask("neçə admin var", adminContext([], { isOwner: true }))).reply, /Admin sayı: 1/);
  assert.match((await ask("neçə müraciət gözləyir", adminContext())).reply, /«gözləyir» statuslu müraciətlər: 2/);
  assert.match((await ask("muracietler", adminContext())).reply, /Rəşad Kərimov[\s\S]*Murad Səfərov/);
  assert.match((await ask("rədd edilən müraciətlər", adminContext())).reply, /Murad Səfərov[\s\S]*Natamam sənəd/);
  assert.match((await ask("müraciətlər", adminContext(["students"]))).reply, /icazə/);
  assert.match((await ask("fənn silmə müraciətləri", adminContext())).reply, /Əli Quliyev[\s\S]*Fiqh/);
  assert.match((await ask("gözləyən üzrlər", adminContext())).reply, /Əli Məmmədov[\s\S]*Xəstə idim/);
  assert.match((await ask("cavabsız suallar", adminContext())).reply, /Təcvid qaydaları/);
  assert.doesNotMatch((await ask("cavabsız suallar", adminContext())).reply, /Namaz vaxtları/);
  assert.match((await ask("son elanlar", adminContext())).reply, /Bayram tətili/);
  assert.match((await ask("tapşırıqlar", adminContext())).reply, /Fiqh esse[\s\S]*Fatihə əzbəri/);
  assert.match((await ask("yoxlanılmamış tapşırıqlar", adminContext())).reply, /Fiqh esse/);
  assert.match((await ask("Fiqh esse tapşırığı", adminContext())).reply, /Təhvil verməyən \(cari qrupda\): 1[\s\S]*Əli Məmmədov/);
  assert.match((await ask("Quran imtahan nəticələri", adminContext())).reply, /Təcvid testi[\s\S]*Aişə Həsənova[\s\S]*9\/10 \(90%\)/);
  assert.match((await ask("imtahnlar", adminContext())).reply, /Testlər: 2/);
  assert.match((await ask("neçə kurs var", adminContext())).reply, /Dərslər \(2\)/);
  assert.match((await ask("ümumi statistika", adminContext())).reply, /Aktiv tələbə: 3[\s\S]*Müəllim: 2[\s\S]*Müraciətlər: 3/);
});

test("admin global search and did-you-mean suggestions", async () => {
  const global = await ask("Bayram", adminContext());
  assert.match(global.reply, /Elanlar \(1\)[\s\S]*Bayram tətili/);
  assert.match((await ask("Təcvid", adminContext())).reply, /Testlər[\s\S]*Təcvid testi/);
  const near = await ask("Hüsenzade", adminContext());
  assert.match(near.reply, /Bunu nəzərdə tuturdunuz\?/);
  assert.match((await ask("zzqxwv", adminContext())).reply, /başa düşmədim/);
});
