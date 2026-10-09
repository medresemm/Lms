// Mədinə AI daxili mühərriki.
//
// Bu provayder heç bir xarici AI xidmətinə müraciət etmir. Sual Azərbaycan və Türk dilindəki açar
// sözlərə görə niyyətlərə (intent) ayrılır və cavab yalnız ötürülən kontekstin (StudentAiContext və ya
// AdminAiContext) qaytardığı LMS məlumatlarından qurulur. Tələbə kontekstində başqa tələbəyə aid məlumat
// almaq üçün heç bir metod yoxdur. Mühərrik heç nə saxlamır və mesaj mətnini log etmir.
import type {
  AdminAiContext,
  AiAssignment,
  AiChatTurn,
  AiContext,
  AiExam,
  AiLesson,
  AiProvider,
  AiReply,
  AiSemester,
  AiStudentDetails,
  AiStudentMatch,
  StudentAiContext,
} from "./aiProvider.js";

// ---------------------------------------------------------------------------
// Mətn normallaşdırması
// ---------------------------------------------------------------------------

export function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("az-AZ")
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9@.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(normalized: string) {
  return normalized.split(/[\s.\-]+/).filter(Boolean);
}

interface ParsedMessage {
  raw: string;
  text: string;
  tokens: string[];
}

function parse(message: string): ParsedMessage {
  const text = normalizeText(message);
  return { raw: message, text, tokens: tokenize(text) };
}

/** Açar söz: boşluq varsa ifadə kimi, yoxdursa söz başlanğıcı (şəkilçilərə dözümlü) kimi yoxlanır. */
function hasKeyword(parsed: ParsedMessage, keyword: string) {
  if (keyword.includes(" ")) return ` ${parsed.text} `.includes(` ${keyword}`);
  return parsed.tokens.some((token) => token === keyword || (keyword.length >= 3 && token.startsWith(keyword)));
}

function countKeywords(parsed: ParsedMessage, keywords: readonly string[]) {
  return keywords.reduce((total, keyword) => total + (hasKeyword(parsed, keyword) ? 1 : 0), 0);
}

// ---------------------------------------------------------------------------
// Açar sözlər (normallaşdırılmış: ə→e, ı→i, ö→o, ü→u, ş→s, ç→c, ğ→g)
// ---------------------------------------------------------------------------

const KW = {
  greeting: ["salam", "merhaba", "selam", "aleykum", "salamun", "hey", "xos gordu"],
  thanks: ["tesekkur", "sag ol", "sagol", "cox sag", "eyvallah", "minnetdar", "allah razi", "tsk", "sagolun"],
  help: ["komek", "yardim", "ne bacarir", "neler", "ne ede biler", "help", "nece istifade", "ne sorus", "ne soru", "menu"],
  scheduleStrong: ["cedvel", "cizelge", "bugun", "bu gun", "sabah", "yarin", "hefte", "hafta", "zoom", "meet", "telegram", "ders vaxt", "ders saat", "ne vaxt ders", "dersim var", "ders var", "dersler ne vaxt"],
  scheduleWeak: ["vaxt", "saat", "zaman", "proqram", "program", "gun"],
  assignments: ["tapsiriq", "odev", "ev isi", "ev tapsir", "homework", "teslim", "deadline", "son tarix", "muddet", "tehvil"],
  exams: ["imtahan", "sinav", "test", "quiz", "exam"],
  grades: ["qiymet", "not", "bal", "gpa", "ortalama", "orta bal", "puan", "netice", "sonuc", "karne", "transkript", "transcript", "akademik"],
  attendance: ["davamiyyet", "devam", "qayib", "qaib", "istirak", "katilim", "gelmedi", "buraxdig", "kacirdig", "uzrlu", "gecikme"],
  resources: ["resurs", "material", "kitab", "pdf", "link", "kaynak", "qaynaq", "fayl", "dosya", "video", "muhazire", "konspekt", "sened", "belge", "kecid"],
  courses: ["ders", "fenn", "fenler", "kurs", "muellim", "ogretmen", "hoca", "ustad", "ustaz", "predmet"],
  profile: ["profil", "semestr", "donem", "sinif", "nomrem", "numaram", "melumatim", "haqqimda", "hakkimda", "kimem", "kim oldug", "adim", "statusum", "veziyyet"],
  notices: ["elan", "duyuru", "bildiris", "bildirim", "xeber", "haber", "yenilik"],
  others: ["diger telebe", "basqa telebe", "diger ogrenci", "baska ogrenci", "yoldas", "sinif arkadas", "qrup yoldas", "telebelerin", "butun telebe", "hamisinin", "ogrencilerin"],
  // Admin
  studentWords: ["telebe", "ogrenci", "sagird", "student"],
  search: ["axtar", "tap", "ara", "bul", "goster", "haqqinda", "hakkinda", "melumat", "bilgi", "kimdir", "profil"],
  stats: ["nece telebe", "nece nefer", "statistika", "istatistik", "sayi", "say", "cemi", "toplam", "kac ogrenci", "kac telebe"],
  teacher: ["muellim", "ogretmen", "hoca", "ustaz", "ustad", "teacher"],
  courseList: ["kurs", "kurslar", "ders", "dersler", "fenn", "fenler", "fennler", "predmet"],
  listWords: ["siyahi", "liste", "list", "kimler", "hansi telebe", "telebeleri", "ogrencileri", "qeydiyyat", "oxuyur", "oxuyan"],
} as const;

const STOPWORDS = new Set([
  "ve", "ile", "da", "de", "bu", "o", "mene", "bana", "zehmet", "olmasa", "lutfen", "xahis", "edirem", "ederim", "ver", "verin",
  "goster", "gostar", "goster", "gosterin", "tap", "tapin", "axtar", "axtarin", "ara", "bul", "bulun", "haqqinda", "hakkinda",
  "melumat", "melumati", "melumatlari", "bilgi", "bilgileri", "telebe", "telebenin", "telebeni", "telebeler", "ogrenci", "ogrencinin",
  "ogrenciyi", "sagird", "student", "kimdir", "kim", "ne", "nedir", "neler", "hansi", "olan", "adli", "adinda", "isimli",
  "qiymet", "qiymetleri", "qiymetlerini", "notlari", "notlarini", "davamiyyet", "davamiyyeti", "devamsizlik", "profil", "profili",
  "tam", "butun", "her", "sey", "hamisi", "infos", "info", "pls", "zehmet", "olmasa", "salam", "merhaba", "selam", "nomre", "nomresi",
  "numara", "numarasi", "email", "e-poct", "poct", "telefon", "nin", "nun", "in", "un", "un", "ucun", "icin", "uzre", "imtahan", "tapsiriq",
  "netice", "neticeleri", "akademik", "haqqinda", "barede", "barəsində", "baresinde", "bax", "baxim", "isteyirem", "istiyorum",
]);

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
type Weekday = typeof WEEKDAYS[number];
const WEEKDAY_ORDER: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const WEEKDAY_LABELS: Record<string, string> = {
  monday: "Bazar ertəsi",
  tuesday: "Çərşənbə axşamı",
  wednesday: "Çərşənbə",
  thursday: "Cümə axşamı",
  friday: "Cümə",
  saturday: "Şənbə",
  sunday: "Bazar",
};
// Uzun ifadələr əvvəl yoxlanılır ("cersenbe axsami" "cersenbe"-dən əvvəl).
const WEEKDAY_KEYWORDS: Array<[string, Weekday]> = [
  ["bazar ertesi", "monday"], ["cersenbe axsami", "tuesday"], ["cume axsami", "thursday"], ["cumartesi", "saturday"],
  ["pazartesi", "monday"], ["persembe", "thursday"], ["carsamba", "wednesday"], ["cersenbe", "wednesday"],
  ["senbe", "saturday"], ["cume", "friday"], ["cuma", "friday"], ["sali", "tuesday"], ["bazar", "sunday"], ["pazar", "sunday"],
];

const ATTENDANCE_STATUS: Record<string, string> = {
  present: "iştirak edib",
  absent: "qayıb",
  late: "gecikmə",
  excused: "üzrlü",
};

const IGNORED_TITLE_WORDS = new Set(["dili", "elmi", "elmleri", "tarixi", "esaslari", "giris", "ve", "ile", "dersi", "fenni"]);

// ---------------------------------------------------------------------------
// Köməkçi formatlayıcılar
// ---------------------------------------------------------------------------

function bakuParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  }).formatToParts(date);
  const value = (name: string) => parts.find((part) => part.type === name)?.value ?? "";
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), weekday: value("weekday") };
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const p = bakuParts(date);
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}.${month}.${year}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const p = bakuParts(date);
  return `${p.day}.${p.month}.${p.year}`;
}

function bakuWeekday(offsetDays = 0): Weekday {
  const p = bakuParts(new Date(Date.now() + offsetDays * 86_400_000));
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return WEEKDAYS[index >= 0 ? index : 0];
}

function studentCode(studentNumber: number) {
  return `T${String(studentNumber).padStart(4, "0")}`;
}

function formatGrade(grade: number | null | undefined) {
  if (grade === null || grade === undefined) return "daxil edilməyib";
  return String(Math.round(grade * 100) / 100);
}

function snippet(value: string | null | undefined, max = 140) {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function lessonDaysLabel(days: string[]) {
  const labels = WEEKDAY_ORDER.filter((day) => days.includes(day)).map((day) => WEEKDAY_LABELS[day]);
  return labels.length ? labels.join(", ") : "gün təyin olunmayıb";
}

function reply(lines: Array<string | null | undefined | false>, suggestions: string[] = []): AiReply {
  return {
    reply: lines.filter((line): line is string => typeof line === "string").join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    suggestions: suggestions.slice(0, 4),
  };
}

function detectWeekday(parsed: ParsedMessage): { day: Weekday; label: string } | null {
  if (hasKeyword(parsed, "bugun") || hasKeyword(parsed, "bu gun")) {
    const day = bakuWeekday(0);
    return { day, label: `Bu gün (${WEEKDAY_LABELS[day]})` };
  }
  if (hasKeyword(parsed, "yarin") || hasKeyword(parsed, "sabah")) {
    const day = bakuWeekday(1);
    return { day, label: `Sabah (${WEEKDAY_LABELS[day]})` };
  }
  for (const [keyword, day] of WEEKDAY_KEYWORDS) {
    if (` ${parsed.text} `.includes(` ${keyword}`)) return { day, label: WEEKDAY_LABELS[day] };
  }
  return null;
}

function detectTermNumber(parsed: ParsedMessage): number | null {
  const match = parsed.text.match(/\b([1-8])\s*(?:-?\s*(?:ci|cu|ci|cı|nci|inci|uncu|ncu)?)\s*(?:semestr|donem|yariyil)/);
  return match ? Number(match[1]) : null;
}

function titleMatches(parsed: ParsedMessage, title: string) {
  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) return false;
  if (normalizedTitle.length >= 3 && ` ${parsed.text} `.includes(` ${normalizedTitle}`)) return true;
  const words = tokenize(normalizedTitle).filter((word) => word.length >= 4 && !IGNORED_TITLE_WORDS.has(word));
  return words.some((word) => parsed.tokens.some((token) => token === word || token.startsWith(word)));
}

// ---------------------------------------------------------------------------
// Tələbə rejimi
// ---------------------------------------------------------------------------

const STUDENT_SUGGESTIONS = ["Dərs cədvəlim", "Tapşırıqlarım", "Qiymətlərim", "Resurslar"];

function studentHelp(name?: string) {
  return reply([
    name ? `Salam, ${name}! Mən Mədinə AI-yam — akademiyanın daxili köməkçisi.` : "Mən Mədinə AI-yam — akademiyanın daxili köməkçisi.",
    "Yalnız sizin öz tədris məlumatlarınıza əsasən cavab verirəm. Məsələn, soruşa bilərsiniz:",
    "• «Dərs cədvəlim» və ya «Bu gün dərsim var?»",
    "• «Tapşırıqlarım» — açıq ev tapşırıqları və son tarixlər",
    "• «İmtahanlarım» — testlər və nəticələr",
    "• «Qiymətlərim» — fənn qiymətləri və orta bal",
    "• «Davamiyyətim» — qayıblar",
    "• «Resurslar» — dərs materialları və linklər",
    "• «Fənlərim», «Profilim», «Elanlar»",
    "Fənnin adını da yaza bilərsiniz, məsələn: «Quran qiymətim».",
  ], STUDENT_SUGGESTIONS);
}

async function studentSchedule(ctx: StudentAiContext, parsed: ParsedMessage, courseFilter: Set<number> | null) {
  const overview = await ctx.overview();
  if (!overview.scheduleAccess.approved) {
    return reply([
      "Dərs cədvəliniz hələ açılmayıb.",
      overview.scheduleAccess.onboardingRequired && overview.scheduleAccess.onboardingExamTitle
        ? `Əvvəlcə «${overview.scheduleAccess.onboardingExamTitle}» qəbul testini tamamlamalısınız; müəllim təsdiqindən sonra cədvəl açılacaq.`
        : "Müəllim təsdiqindən sonra cədvəl avtomatik açılacaq.",
    ], ["Profilim", "İmtahanlarım"]);
  }
  const lessons = (await ctx.lessons()).filter((lesson) => !courseFilter || courseFilter.has(lesson.courseId));
  if (!lessons.length) {
    return reply([`${overview.termLabel} üçün hələ dərs cədvəli əlavə olunmayıb.`], ["Fənlərim", "Elanlar"]);
  }
  const weekday = detectWeekday(parsed);
  const lessonLine = (lesson: AiLesson) => `• ${lesson.lessonTime ?? "saat təyin olunmayıb"} — ${lesson.courseTitle}${lesson.title && lesson.title !== lesson.courseTitle ? ` (${lesson.title})` : ""}${lesson.teacherName ? ` · ${lesson.teacherName}` : ""}`;
  const byTime = (left: AiLesson, right: AiLesson) => (left.lessonTime ?? "99").localeCompare(right.lessonTime ?? "99");
  if (weekday) {
    const dayLessons = lessons.filter((lesson) => lesson.lessonDays.includes(weekday.day)).sort(byTime);
    return reply([
      dayLessons.length ? `${weekday.label} dərsləriniz:` : `${weekday.label} dərsiniz yoxdur.`,
      ...dayLessons.map(lessonLine),
      dayLessons.length ? "Dərs linkləri «Resurslar» bölməsindədir." : null,
    ], ["Dərs cədvəlim", "Resurslar"]);
  }
  const lines: string[] = [`${overview.termLabel} üzrə həftəlik dərs cədvəliniz:`];
  for (const day of WEEKDAY_ORDER) {
    const dayLessons = lessons.filter((lesson) => lesson.lessonDays.includes(day)).sort(byTime);
    if (!dayLessons.length) continue;
    lines.push("", `${WEEKDAY_LABELS[day]}:`, ...dayLessons.map(lessonLine));
  }
  const unscheduled = lessons.filter((lesson) => !lesson.lessonDays.length);
  if (unscheduled.length) lines.push("", "Günü təyin olunmayan:", ...unscheduled.map(lessonLine));
  return reply(lines, ["Bu gün dərsim var?", "Resurslar", "Tapşırıqlarım"]);
}

async function studentResources(ctx: StudentAiContext, courseFilter: Set<number> | null) {
  const overview = await ctx.overview();
  if (!overview.scheduleAccess.approved) {
    return reply(["Dərs materiallarınız cədvəl təsdiqləndikdən sonra açılacaq."], ["Profilim"]);
  }
  const lessons = (await ctx.lessons()).filter((lesson) => !courseFilter || courseFilter.has(lesson.courseId));
  if (!lessons.length) return reply(["Hazırda sizə açıq resurs yoxdur."], ["Dərs cədvəlim"]);
  const lines = [`${overview.termLabel} üzrə sizə açıq resurslar:`];
  for (const lesson of lessons.slice(0, 20)) {
    lines.push(`• ${lesson.courseTitle}${lesson.title && lesson.title !== lesson.courseTitle ? ` — ${lesson.title}` : ""}${lesson.teacherName ? ` (${lesson.teacherName})` : ""}`);
    const body = snippet(lesson.body);
    if (body) lines.push(`  ${body}`);
    if (lesson.url) lines.push(`  Link: ${lesson.url}`);
  }
  if (lessons.length > 20) lines.push(`…və daha ${lessons.length - 20} resurs. Tam siyahı kabinetinizdədir.`);
  return reply(lines, ["Dərs cədvəlim", "Tapşırıqlarım"]);
}

function submissionLabel(assignment: AiAssignment) {
  const submission = assignment.submission;
  if (!submission) return assignment.status === "open" ? "təhvil verilməyib" : "təhvil verilməyib (müddət bitib)";
  if (submission.status === "graded") return `qiymətləndirilib: ${submission.score ?? "—"}/${assignment.maxScore}`;
  if (submission.status === "resubmission_requested") return "yenidən təhvil vermək tələb olunub";
  return `təhvil verilib (${formatDateTime(submission.submittedAt)}), yoxlanılır`;
}

async function studentAssignments(ctx: StudentAiContext, courseFilter: Set<number> | null, courseTitles: Map<number, string>) {
  const titleFilter = courseFilter ? new Set(Array.from(courseFilter).map((id) => courseTitles.get(id)).filter(Boolean)) : null;
  const assignments = (await ctx.assignments()).filter((assignment) => !titleFilter || titleFilter.has(assignment.courseTitle));
  if (!assignments.length) return reply(["Hazırda sizə verilmiş ev tapşırığı yoxdur."], ["İmtahanlarım", "Dərs cədvəlim"]);
  const open = assignments.filter((item) => item.status === "open").sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const closed = assignments.filter((item) => item.status !== "open").sort((a, b) => b.dueAt.getTime() - a.dueAt.getTime());
  const pending = open.filter((item) => !item.submission || item.submission.status === "resubmission_requested");
  const line = (item: AiAssignment) => {
    const feedback = item.submission?.feedback ? ` · rəy: ${snippet(item.submission.feedback, 90)}` : "";
    return `• ${item.title} — ${item.courseTitle} · son tarix: ${formatDateTime(item.dueAt)} · ${submissionLabel(item)}${feedback}`;
  };
  return reply([
    `Cəmi ${assignments.length} tapşırıq: ${open.length} açıq${pending.length ? `, ${pending.length} təhvil gözləyir` : ""}.`,
    open.length ? "" : null,
    open.length ? "Açıq tapşırıqlar:" : null,
    ...open.slice(0, 10).map(line),
    closed.length ? "" : null,
    closed.length ? "Bağlanmış tapşırıqlar:" : null,
    ...closed.slice(0, 8).map(line),
    pending.length ? "\nTəhvil vermək üçün kabinetdə «Ev tapşırıqları» bölməsini açın." : null,
  ], ["İmtahanlarım", "Qiymətlərim"]);
}

async function studentExams(ctx: StudentAiContext, courseFilter: Set<number> | null, courseTitles: Map<number, string>) {
  const titleFilter = courseFilter ? new Set(Array.from(courseFilter).map((id) => courseTitles.get(id)).filter(Boolean)) : null;
  const exams = (await ctx.exams()).filter((exam) => !titleFilter || titleFilter.has(exam.courseTitle));
  if (!exams.length) return reply(["Hazırda sizə açıq imtahan və ya test yoxdur."], ["Tapşırıqlarım", "Qiymətlərim"]);
  const line = (exam: AiExam) => {
    const result = exam.result
      ? `nəticə: ${exam.result.correctCount}/${exam.result.totalQuestions} (${exam.result.percentage}%)`
      : exam.status === "open" ? "hələ cavab verməmisiniz" : "cavab verilməyib";
    const duration = exam.durationMinutes ? ` · ${exam.durationMinutes} dəq.` : "";
    return `• ${exam.title} — ${exam.courseTitle}${exam.isOnboarding ? " (qəbul testi)" : ""} · ${exam.status === "open" ? "açıq" : "bağlanıb"}${duration} · ${result}`;
  };
  const open = exams.filter((exam) => exam.status === "open" && !exam.result);
  return reply([
    `İmtahan və testləriniz (${exams.length}):`,
    ...exams.slice(0, 15).map(line),
    open.length ? `\n${open.length} test sizi gözləyir — kabinetdə «İmtahan və testlər» bölməsindən başlaya bilərsiniz.` : null,
  ], ["Tapşırıqlarım", "Qiymətlərim"]);
}

function semesterGradeLines(semester: AiSemester, courseFilter: Set<number> | null) {
  const subjects = semester.subjects.filter((subject) => !courseFilter || courseFilter.has(subject.courseId));
  const lines = [`${semester.label} — orta bal: ${formatGrade(semester.gpa)}`];
  if (!subjects.length) lines.push("• Bu semestr üçün fənn yoxdur.");
  for (const subject of subjects) {
    const components = subject.gradingComponents.filter((component) => component.score !== null);
    lines.push(`• ${subject.title}: ${formatGrade(subject.grade)}${components.length ? ` (${components.map((component) => `${component.name}: ${component.score}`).join(", ")})` : ""}`);
  }
  return lines;
}

async function studentGrades(ctx: StudentAiContext, parsed: ParsedMessage, courseFilter: Set<number> | null) {
  const semesters = await ctx.semesters();
  if (!semesters.length) return reply(["Hələ qiymət məlumatınız yoxdur."], ["Fənlərim"]);
  const requestedTerm = detectTermNumber(parsed);
  const selected = requestedTerm ? semesters.filter((item) => item.termNumber === requestedTerm) : [...semesters].reverse();
  if (!selected.length) return reply([`${requestedTerm}-ci semestr üzrə məlumat sizə hələ açıq deyil.`], ["Qiymətlərim"]);
  const lines = ["Qiymətləriniz (5 bal şkalası ilə):"];
  for (const semester of selected) lines.push("", ...semesterGradeLines(semester, courseFilter));
  return reply(lines, ["Davamiyyətim", "Tapşırıqlarım"]);
}

async function studentAttendance(ctx: StudentAiContext, parsed: ParsedMessage, courseFilter: Set<number> | null) {
  const semesters = await ctx.semesters();
  if (!semesters.length) return reply(["Davamiyyət məlumatınız hələ yoxdur."], ["Qiymətlərim"]);
  const requestedTerm = detectTermNumber(parsed);
  const selected = requestedTerm ? semesters.filter((item) => item.termNumber === requestedTerm) : semesters.slice(-1);
  if (!selected.length) return reply([`${requestedTerm}-ci semestr üzrə məlumat sizə hələ açıq deyil.`], ["Davamiyyətim"]);
  const lines: string[] = [];
  for (const semester of selected) {
    lines.push(`${semester.label} — ümumi qayıb faizi: ${semester.absencePercent === null ? "hesablanmayıb" : `${semester.absencePercent}%`}`);
    for (const subject of semester.subjects.filter((item) => !courseFilter || courseFilter.has(item.courseId))) {
      lines.push(`• ${subject.title}: ${subject.absenceCount} qayıb${subject.absencePercent === null ? "" : ` · ${subject.absencePercent}%`}`);
    }
    const records = semester.attendanceRecords.filter((record) => record.status !== "present").slice(0, 6);
    if (records.length) {
      lines.push("", "Son qeydlər:");
      lines.push(...records.map((record) => `• ${formatDate(record.attendanceDate)} — ${record.courseTitle}: ${ATTENDANCE_STATUS[record.status] ?? record.status}`));
    }
    lines.push("");
  }
  lines.push("Qayıb üçün üzrlü səbəb bildirmək istəsəniz, kabinetdə davamiyyət bölməsindən müraciət edə bilərsiniz.");
  return reply(lines, ["Qiymətlərim", "Dərs cədvəlim"]);
}

async function studentCourses(ctx: StudentAiContext) {
  const [overview, semesters, lessons] = await Promise.all([ctx.overview(), ctx.semesters(), ctx.overview().then((item) => item.scheduleAccess.approved ? ctx.lessons() : [])]);
  const current = semesters.find((item) => item.termNumber === overview.currentTermNumber) ?? semesters[semesters.length - 1];
  if (!current || !current.subjects.length) return reply([`${overview.termLabel} üçün fənn siyahısı hələ hazır deyil.`], ["Profilim"]);
  const lines = [`${current.label} fənləriniz:`];
  for (const subject of current.subjects) {
    const subjectLessons = lessons.filter((lesson) => lesson.courseId === subject.courseId);
    const days = Array.from(new Set(subjectLessons.flatMap((lesson) => lesson.lessonDays)));
    const time = subjectLessons.find((lesson) => lesson.lessonTime)?.lessonTime;
    lines.push(`• ${subject.title} — ${subject.instructor || "müəllim təyin olunmayıb"}${subject.isMandatory ? "" : " (seçmə)"}${subject.credits ? ` · ${subject.credits} kredit` : ""}${days.length ? ` · ${lessonDaysLabel(days)}${time ? ` ${time}` : ""}` : ""}`);
  }
  return reply(lines, ["Dərs cədvəlim", "Qiymətlərim"]);
}

async function studentProfile(ctx: StudentAiContext) {
  const [overview, semesters] = await Promise.all([ctx.overview(), ctx.semesters()]);
  const current = semesters.find((item) => item.termNumber === overview.currentTermNumber);
  return reply([
    `${overview.firstName} ${overview.lastName} (${studentCode(overview.studentNumber)})`,
    `• Cari semestr: ${overview.termLabel}`,
    overview.program ? `• Proqram: ${overview.program}` : null,
    `• Dərs cədvəli: ${overview.scheduleAccess.approved ? "açıqdır" : overview.scheduleAccess.onboardingRequired ? "qəbul testi tamamlanmalıdır" : "müəllim təsdiqini gözləyir"}`,
    current ? `• Bu semestr orta bal: ${formatGrade(current.gpa)}` : null,
    current ? `• Fənn sayı: ${current.subjects.length}` : null,
    "Şəxsi məlumatları dəyişmək üçün kabinetdə «Məlumatlarımı düzəlt» bölməsindən istifadə edin.",
  ], ["Fənlərim", "Qiymətlərim"]);
}

async function studentNotices(ctx: StudentAiContext) {
  const { announcements, notifications } = await ctx.notices();
  if (!announcements.length && !notifications.length) return reply(["Hazırda yeni elan və ya bildiriş yoxdur."], STUDENT_SUGGESTIONS);
  return reply([
    notifications.length ? "Sizə aid bildirişlər:" : null,
    ...notifications.slice(0, 5).map((item) => `• ${item.title}${item.date ? ` (${formatDate(item.date)})` : ""}: ${snippet(item.body, 160)}`),
    announcements.length ? `${notifications.length ? "\n" : ""}Son elanlar:` : null,
    ...announcements.slice(0, 3).map((item) => `• ${item.title}${item.date ? ` (${formatDate(item.date)})` : ""}: ${snippet(item.body, 160)}`),
  ], ["Dərs cədvəlim", "Tapşırıqlarım"]);
}

async function studentCourseFocus(ctx: StudentAiContext, courseIds: Set<number>) {
  const [overview, semesters] = await Promise.all([ctx.overview(), ctx.semesters()]);
  const lessons = overview.scheduleAccess.approved ? await ctx.lessons() : [];
  const lines: string[] = [];
  for (const courseId of courseIds) {
    const subject = [...semesters].reverse().flatMap((item) => item.subjects).find((item) => item.courseId === courseId);
    const courseLessons = lessons.filter((lesson) => lesson.courseId === courseId);
    const title = subject?.title ?? courseLessons[0]?.courseTitle;
    if (!title) continue;
    lines.push(`${title}:`);
    if (subject) {
      lines.push(`• Müəllim: ${subject.instructor || "təyin olunmayıb"}`);
      lines.push(`• Qiymət: ${formatGrade(subject.grade)} · qayıb: ${subject.absenceCount}`);
    }
    if (courseLessons.length) {
      const days = Array.from(new Set(courseLessons.flatMap((lesson) => lesson.lessonDays)));
      const time = courseLessons.find((lesson) => lesson.lessonTime)?.lessonTime;
      lines.push(`• Dərs günləri: ${lessonDaysLabel(days)}${time ? `, saat ${time}` : ""}`);
      const link = courseLessons.find((lesson) => lesson.url)?.url;
      if (link) lines.push(`• Link: ${link}`);
    }
    lines.push("");
  }
  if (!lines.length) return null;
  return reply(lines, ["Tapşırıqlarım", "Qiymətlərim"]);
}

async function answerStudent(parsed: ParsedMessage, ctx: StudentAiContext): Promise<AiReply> {
  if (!parsed.tokens.length) return studentHelp();

  // Fənn adına görə filtr (yalnız tələbənin öz fənləri arasında).
  const [semesters, overview] = await Promise.all([ctx.semesters(), ctx.overview()]);
  const courseTitles = new Map<number, string>();
  for (const subject of semesters.flatMap((item) => item.subjects)) courseTitles.set(subject.courseId, subject.title);
  if (overview.scheduleAccess.approved) {
    for (const lesson of await ctx.lessons()) if (!courseTitles.has(lesson.courseId)) courseTitles.set(lesson.courseId, lesson.courseTitle);
  }
  const matchedCourses = new Set(Array.from(courseTitles.entries()).filter(([, title]) => titleMatches(parsed, title)).map(([id]) => id));
  const courseFilter = matchedCourses.size ? matchedCourses : null;

  if (countKeywords(parsed, KW.others)) {
    return reply([
      "Bağışlayın, mən yalnız sizin öz tədris məlumatlarınız haqqında danışa bilərəm. Digər tələbələrin məlumatları məxfidir.",
    ], STUDENT_SUGGESTIONS);
  }

  const scores = {
    schedule: countKeywords(parsed, KW.scheduleStrong) * 2,
    assignments: countKeywords(parsed, KW.assignments) * 2,
    exams: countKeywords(parsed, KW.exams) * 2,
    grades: countKeywords(parsed, KW.grades) * 2,
    attendance: countKeywords(parsed, KW.attendance) * 2,
    resources: countKeywords(parsed, KW.resources) * 2,
    profile: countKeywords(parsed, KW.profile) * 2,
    notices: countKeywords(parsed, KW.notices) * 2,
  };
  const hasSpecific = Object.values(scores).some((score) => score > 0);
  if (!hasSpecific && countKeywords(parsed, KW.scheduleWeak)) scores.schedule = 1;

  const order: Array<keyof typeof scores> = ["schedule", "assignments", "exams", "grades", "attendance", "resources", "notices", "profile"];
  const intents = order.filter((intent) => scores[intent] > 0);
  // "Qiymət" sözü testlə birlikdə gələndə test nəticələri kifayətdir.
  const results: AiReply[] = [];
  for (const intent of intents.slice(0, 3)) {
    if (intent === "schedule") results.push(await studentSchedule(ctx, parsed, courseFilter));
    if (intent === "assignments") results.push(await studentAssignments(ctx, courseFilter, courseTitles));
    if (intent === "exams") results.push(await studentExams(ctx, courseFilter, courseTitles));
    if (intent === "grades") results.push(await studentGrades(ctx, parsed, courseFilter));
    if (intent === "attendance") results.push(await studentAttendance(ctx, parsed, courseFilter));
    if (intent === "resources") results.push(await studentResources(ctx, courseFilter));
    if (intent === "notices") results.push(await studentNotices(ctx));
    if (intent === "profile") results.push(await studentProfile(ctx));
  }
  if (results.length) return mergeReplies(results);

  if (courseFilter) {
    const focus = await studentCourseFocus(ctx, courseFilter);
    if (focus) return focus;
  }
  if (countKeywords(parsed, KW.courses)) return studentCourses(ctx);
  if (countKeywords(parsed, KW.thanks)) return reply(["Dəyməz! Başqa sualınız olsa, buradayam."], STUDENT_SUGGESTIONS);
  if (countKeywords(parsed, KW.greeting)) return studentHelp(overview.firstName);
  if (countKeywords(parsed, KW.help)) return studentHelp();
  return reply([
    "Bu sualı tam başa düşmədim. Mən daxili köməkçiyəm və yalnız sizin LMS məlumatlarınız əsasında cavab verirəm.",
    "Bunları soruşa bilərsiniz: dərs cədvəli, tapşırıqlar, imtahanlar, qiymətlər, davamiyyət, resurslar, fənlər, profil, elanlar.",
    "Dini və ya elmi suallar üçün kabinetdəki «Sual-cavab» bölməsindən müəllimlərə yaza bilərsiniz.",
  ], STUDENT_SUGGESTIONS);
}

function mergeReplies(replies: AiReply[]): AiReply {
  if (replies.length === 1) return replies[0];
  return {
    reply: replies.map((item) => item.reply).join("\n\n— — —\n\n"),
    suggestions: Array.from(new Set(replies.flatMap((item) => item.suggestions))).slice(0, 4),
  };
}

// ---------------------------------------------------------------------------
// Admin rejimi
// ---------------------------------------------------------------------------

const ADMIN_SUGGESTIONS = ["Tələbə axtar", "Kurs siyahısı", "Müəllim cədvəli", "Tələbə statistikası"];

function adminHelp(ctx: AdminAiContext) {
  const schedule = ctx.permissions.has("schedule");
  return reply([
    "Mən Mədinə AI-yam — admin paneli üçün daxili köməkçi. Cavablar yalnız LMS bazasındakı məlumatlardan qurulur.",
    "Nə soruşa bilərsiniz:",
    "• Tələbə axtarışı: ad, soyad, e-poçt, telefon və ya T-nömrə ilə (məs. «Əli Məmmədov», «T0012», «ali@mail.com»)",
    "• Tək nəticə tapılanda tələbənin tam akademik məlumatı: profil, qiymətlər, davamiyyət, fənlər, tapşırıq və test nəticələri",
    "• «Tələbə statistikası» — semestrlər üzrə tələbə sayı",
    schedule ? "• «Kurs siyahısı», «Quran dərsinin tələbələri»" : null,
    schedule ? "• «Müəllim cədvəli» və ya müəllimin adı ilə cədvəl" : null,
  ], ADMIN_SUGGESTIONS.filter((item) => schedule || (item !== "Kurs siyahısı" && item !== "Müəllim cədvəli")));
}

function noSchedulePermission() {
  return reply(["Bu məlumat «Cədvəl» icazəsi tələb edir. Rolunuz üçün bu icazə verilməyib."], ["Tələbə axtar", "Tələbə statistikası"]);
}

function matchStudents(students: AiStudentMatch[], parsed: ParsedMessage) {
  const email = parsed.raw.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0]?.toLowerCase();
  if (email) return students.filter((student) => student.email.toLowerCase() === email || student.email.toLowerCase().includes(email));
  const numberMatch = parsed.text.match(/\bt\s*0*(\d{1,6})\b/) ?? parsed.text.match(/(?:^|\s)#?0*(\d{1,6})(?:\s|$)/);
  const phoneDigits = parsed.raw.replace(/\D/g, "");
  if (phoneDigits.length >= 7) {
    const byPhone = students.filter((student) => (student.phone ?? "").replace(/\D/g, "").endsWith(phoneDigits.slice(-9)));
    if (byPhone.length) return byPhone;
  }
  if (numberMatch) {
    const studentNumber = Number(numberMatch[1]);
    const byNumber = students.filter((student) => student.studentNumber === studentNumber);
    if (byNumber.length) return byNumber;
  }
  const queryTokens = parsed.tokens.filter((token) => token.length >= 2 && !STOPWORDS.has(token) && !/^\d+$/.test(token));
  if (!queryTokens.length) return [];
  return students.filter((student) => {
    const fields = tokenize(normalizeText(`${student.firstName} ${student.lastName} ${student.username ?? ""} ${student.email.split("@")[0]}`));
    return queryTokens.every((query) => fields.some((field) => field.startsWith(query) || (field.length >= 3 && query.startsWith(field))));
  });
}

function hasStudentLookupHint(parsed: ParsedMessage) {
  return /@/.test(parsed.raw) || /\bt\s*0*\d{1,6}\b/.test(parsed.text) || /(?:^|\s)#?\d{1,6}(?:\s|$)/.test(parsed.text) || parsed.raw.replace(/\D/g, "").length >= 7;
}

function studentDetailsReply(details: AiStudentDetails): AiReply {
  const { match } = details;
  const lines: string[] = [
    `${match.firstName} ${match.lastName} (${studentCode(match.studentNumber)})`,
    `• E-poçt: ${match.email}`,
    match.phone ? `• Telefon: ${match.phone}` : "",
    match.username ? `• İstifadəçi adı: ${match.username}` : "",
    details.birthDate ? `• Doğum tarixi: ${formatDate(details.birthDate)}` : "",
    details.arabicLevel ? `• Ərəb dili səviyyəsi: ${details.arabicLevel}` : "",
    details.program ? `• Proqram: ${details.program}` : "",
    `• Cari semestr: ${details.termLabel}`,
  ].filter(Boolean);
  for (const semester of [...details.semesters].reverse()) {
    lines.push("", `${semester.label} — orta bal: ${formatGrade(semester.gpa)} · qayıb faizi: ${semester.absencePercent === null ? "—" : `${semester.absencePercent}%`}`);
    if (!semester.subjects.length) lines.push("• Fənn yoxdur");
    for (const subject of semester.subjects) {
      lines.push(`• ${subject.title} (${subject.instructor || "müəllim yoxdur"}): qiymət ${formatGrade(subject.grade)}, ${subject.absenceCount} qayıb`);
    }
  }
  if (details.assignments.length) {
    const graded = details.assignments.filter((item) => item.submissionStatus === "graded").length;
    const missing = details.assignments.filter((item) => !item.submissionStatus).length;
    lines.push("", `Tapşırıqlar: ${details.assignments.length} (qiymətləndirilib: ${graded}, təhvil verilməyib: ${missing})`);
    for (const item of details.assignments.slice(0, 8)) {
      const status = !item.submissionStatus ? "təhvil verilməyib"
        : item.submissionStatus === "graded" ? `${item.score ?? "—"}/${item.maxScore}`
        : item.submissionStatus === "resubmission_requested" ? "yenidən təhvil tələb olunub" : "yoxlanılır";
      lines.push(`• ${item.title} — ${item.courseTitle} · son tarix ${formatDate(item.dueAt)} · ${status}`);
    }
  }
  if (details.exams.length) {
    lines.push("", `Test nəticələri (${details.exams.length}):`);
    for (const exam of details.exams.slice(0, 8)) {
      lines.push(`• ${exam.title} — ${exam.courseTitle}${exam.isOnboarding ? " (qəbul testi)" : ""}: ${exam.correctCount}/${exam.totalQuestions} (${exam.percentage}%) · ${formatDate(exam.submittedAt)}`);
    }
  }
  return reply(lines, ["Tələbə axtar", "Tələbə statistikası"]);
}

async function adminStudentSearch(ctx: AdminAiContext, parsed: ParsedMessage): Promise<AiReply | null> {
  const students = await ctx.allStudents();
  const matches = matchStudents(students, parsed);
  if (!matches.length) return null;
  if (matches.length === 1) {
    const details = await ctx.studentDetails(matches[0].profileId);
    if (!details) return reply(["Tələbə tapıldı, amma akademik profili əlçatan deyil."], ADMIN_SUGGESTIONS);
    return studentDetailsReply(details);
  }
  return reply([
    `${matches.length} tələbə tapıldı. Tam məlumat üçün T-nömrəni yazın:`,
    ...matches.slice(0, 15).map((student) => `• ${studentCode(student.studentNumber)} — ${student.firstName} ${student.lastName} · ${student.email} · ${student.currentTermNumber}-ci semestr`),
    matches.length > 15 ? `…və daha ${matches.length - 15} nəfər. Axtarışı dəqiqləşdirin.` : null,
  ], matches.slice(0, 4).map((student) => studentCode(student.studentNumber)));
}

async function adminStats(ctx: AdminAiContext) {
  const students = await ctx.allStudents();
  const byTerm = new Map<number, number>();
  for (const student of students) byTerm.set(student.currentTermNumber, (byTerm.get(student.currentTermNumber) ?? 0) + 1);
  return reply([
    `Aktiv (təsdiqlənmiş) tələbə sayı: ${students.length}`,
    ...Array.from(byTerm.entries()).sort(([a], [b]) => a - b).map(([term, count]) => `• ${term}-ci semestr: ${count} nəfər`),
  ], ["Tələbə axtar", "Kurs siyahısı"]);
}

async function adminCourseList(ctx: AdminAiContext) {
  const courses = await ctx.courses();
  if (!courses.length) return reply(["Sistemdə kurs tapılmadı."], ADMIN_SUGGESTIONS);
  const lines = [`Kurslar (${courses.length}):`];
  for (const course of courses) {
    const terms = Array.from(new Set(course.lessons.map((lesson) => lesson.termNumber))).sort((a, b) => a - b);
    const teachers = Array.from(new Set(course.lessons.map((lesson) => lesson.teacherName).filter((name): name is string => Boolean(name))));
    lines.push(`• ${course.title} (${course.category}) — müəllim: ${teachers.length ? teachers.join(", ") : course.instructor || "—"}${terms.length ? ` · semestr: ${terms.join(", ")}` : ""}`);
  }
  lines.push("", "Kursun tələbə siyahısı üçün yazın: «<kurs adı> tələbələri».");
  return reply(lines, courses.slice(0, 3).map((course) => `${course.title} tələbələri`));
}

async function adminCourseDetails(ctx: AdminAiContext, parsed: ParsedMessage, wantsStudents: boolean) {
  const courses = (await ctx.courses()).filter((course) => titleMatches(parsed, course.title));
  if (!courses.length) return null;
  const lines: string[] = [];
  for (const course of courses.slice(0, 3)) {
    lines.push(`${course.title} (${course.category})`);
    for (const lesson of course.lessons) {
      lines.push(`• ${lesson.termNumber}-ci semestr · ${lesson.teacherName ?? course.instructor ?? "—"} · ${lessonDaysLabel(lesson.lessonDays)}${lesson.lessonTime ? ` ${lesson.lessonTime}` : ""}${lesson.isMandatory ? "" : " (seçmə)"}`);
    }
    if (wantsStudents) {
      const students = await ctx.courseStudents(course.courseId);
      lines.push(`Tələbələr (${students.length}):`);
      lines.push(...students.slice(0, 40).map((student) => `• ${studentCode(student.studentNumber)} — ${student.firstName} ${student.lastName} (${student.currentTermNumber}-ci semestr)`));
      if (students.length > 40) lines.push(`…və daha ${students.length - 40} nəfər.`);
    }
    lines.push("");
  }
  return reply(lines, wantsStudents ? ["Kurs siyahısı", "Tələbə axtar"] : courses.slice(0, 2).map((course) => `${course.title} tələbələri`));
}

async function adminTeacherSchedule(ctx: AdminAiContext, parsed: ParsedMessage) {
  const lessons = await ctx.teacherSchedule();
  if (!lessons.length) return reply(["Aktiv semestrlərdə müəllim cədvəli tapılmadı."], ADMIN_SUGGESTIONS);
  const teacherNames = Array.from(new Set(lessons.map((lesson) => lesson.teacherName ?? "Müəllim təyin olunmayıb")));
  const nameTokens = parsed.tokens.filter((token) => token.length >= 3 && !STOPWORDS.has(token) && !KW.teacher.some((word) => token.startsWith(word)) && !["cedvel", "cedveli", "cizelge", "dersleri", "programi"].some((word) => token.startsWith(word)));
  const filteredNames = nameTokens.length
    ? teacherNames.filter((name) => {
      const fields = tokenize(normalizeText(name));
      return nameTokens.some((query) => fields.some((field) => field.startsWith(query) || (field.length >= 3 && query.startsWith(field))));
    })
    : teacherNames;
  const names = filteredNames.length ? filteredNames : teacherNames;
  const weekday = detectWeekday(parsed);
  const lines = [weekday ? `${weekday.label} üzrə müəllim cədvəli:` : "Müəllim cədvəli (aktiv semestrlər):"];
  for (const name of names.sort((a, b) => a.localeCompare(b, "az"))) {
    const teacherLessons = lessons
      .filter((lesson) => (lesson.teacherName ?? "Müəllim təyin olunmayıb") === name)
      .filter((lesson) => !weekday || lesson.lessonDays.includes(weekday.day));
    if (!teacherLessons.length) continue;
    lines.push("", `${name}:`);
    lines.push(...teacherLessons.map((lesson) => `• ${lesson.courseTitle} — ${lesson.termNumber}-ci semestr · ${lessonDaysLabel(lesson.lessonDays)}${lesson.lessonTime ? ` ${lesson.lessonTime}` : ""}`));
  }
  if (lines.length === 1) lines.push("Bu filtrə uyğun dərs tapılmadı.");
  return reply(lines, ["Kurs siyahısı", "Tələbə axtar"]);
}

async function answerAdmin(parsed: ParsedMessage, ctx: AdminAiContext): Promise<AiReply> {
  if (!parsed.tokens.length) return adminHelp(ctx);
  const canSchedule = ctx.permissions.has("schedule");

  const strongLookup = /@/.test(parsed.raw) || /\bt\s*0*\d{1,6}\b/.test(parsed.text);
  if (!strongLookup && countKeywords(parsed, KW.stats)) return adminStats(ctx);
  if (hasStudentLookupHint(parsed)) {
    const result = await adminStudentSearch(ctx, parsed);
    if (result) return result;
  }

  const wantsList = countKeywords(parsed, KW.listWords) > 0 || (countKeywords(parsed, KW.studentWords) > 0 && countKeywords(parsed, KW.courseList) > 0);

  if (countKeywords(parsed, KW.teacher) || (countKeywords(parsed, KW.scheduleStrong) && !countKeywords(parsed, KW.studentWords))) {
    return canSchedule ? adminTeacherSchedule(ctx, parsed) : noSchedulePermission();
  }

  if (canSchedule) {
    const courseDetails = await adminCourseDetails(ctx, parsed, wantsList || countKeywords(parsed, KW.studentWords) > 0);
    if (courseDetails) return courseDetails;
  }
  if (countKeywords(parsed, KW.courseList) && !countKeywords(parsed, KW.studentWords)) {
    return canSchedule ? adminCourseList(ctx) : noSchedulePermission();
  }

  const searchResult = await adminStudentSearch(ctx, parsed);
  if (searchResult) return searchResult;

  if (countKeywords(parsed, KW.thanks)) return reply(["Dəyməz! Başqa nə lazım olsa, yazın."], ADMIN_SUGGESTIONS);
  if (countKeywords(parsed, KW.greeting) || countKeywords(parsed, KW.help)) return adminHelp(ctx);
  if (countKeywords(parsed, KW.search) || countKeywords(parsed, KW.studentWords)) {
    const meaningful = parsed.tokens.filter((token) => token.length >= 2 && !STOPWORDS.has(token));
    return reply([
      meaningful.length
        ? "Bu sorğuya uyğun tələbə tapılmadı. Ad, soyad, e-poçt, telefon və ya T-nömrəni yoxlayın."
        : "Kimi axtarım? Tələbənin adını, soyadını, e-poçtunu, telefonunu və ya T-nömrəsini yazın (məs. «T0012»).",
    ], ADMIN_SUGGESTIONS);
  }
  return reply([
    "Bu sualı başa düşmədim və ya uyğun məlumat tapmadım.",
    "Tələbə adı/e-poçt/T-nömrə yazın, yaxud «Tələbə statistikası», «Kurs siyahısı», «Müəllim cədvəli» kimi sorğulardan istifadə edin.",
  ], ADMIN_SUGGESTIONS.filter((item) => canSchedule || (item !== "Kurs siyahısı" && item !== "Müəllim cədvəli")));
}

// ---------------------------------------------------------------------------
// Provayder
// ---------------------------------------------------------------------------

export const internalAiProvider: AiProvider = {
  name: "internal",
  async answer(input: { message: string; history: AiChatTurn[] }, context: AiContext): Promise<AiReply> {
    const parsed = parse(input.message);
    return context.mode === "student" ? answerStudent(parsed, context) : answerAdmin(parsed, context);
  },
};
