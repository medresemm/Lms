// Mədinə AI — admin rejimi.
//
// Səhvlərə dözümlü niyyət tanıma və bütün LMS obyektləri üzrə axtarış: tələbələr, müəllimlər, heyət,
// kurslar, müraciətlər, tapşırıqlar, testlər, elanlar/bildirişlər, üzrlər, sual-cavab.
// Hər məlumat növü öz icazəsi ilə qorunur (server kontekstində icazə yoxdursa metod null qaytarır).
// Mühərrik heç nə saxlamır; bütün hesablamalar sorğu daxilində yaddaşda aparılır.
import type {
  AdminAiContext,
  AiApplication,
  AiAssignmentOverview,
  AiExamOverview,
  AiReply,
  AiRosterStudent,
  AiStudentDetails,
  AiStudentMatch,
  AiTeacher,
} from "./aiProvider.js";
import { countKeywords, fuzzyKeywordMatch, hasKeyword, normalizeText, tokenize, type ParsedMessage } from "./text.js";
import { KW, STOPWORDS } from "./keywords.js";
import { IGNORED_TITLE_WORDS, detectWeekday, formatDate, formatGrade, lessonDaysLabel, reply, snippet, studentCode } from "./format.js";
import { answerGuide } from "./siteGuide.js";
import { bestMatches, looseSimilarity, normalizePhone, phoneMatches, rankItems, tokenSimilarity, type Ranked } from "./fuzzy.js";

// ---------------------------------------------------------------------------
// Açar sözlər
// ---------------------------------------------------------------------------

const ENTITY = {
  subjectRequest: ["fenn silme", "fennin silinme", "fenni silme", "silme muraciet", "silinme muraciet", "fenn imtina", "fennden imtina", "fenden imtina"],
  excuse: ["uzr", "uzur", "mazeret"],
  application: ["muraciet", "basvuru", "ariza", "application", "namized"],
  staff: ["heyet", "isci", "emekdas", "personal", "staff", "admin", "adminler", "istifadeci", "rol", "rollar", "kadr", "nezaretci", "supervayzer", "supervisor", "assistent", "komekci", "rehberlik"],
  question: ["sual", "soru", "suallar"],
  announcement: ["elan", "duyuru"],
  notification: ["bildiris", "bildirim"],
  assignment: ["tapsiriq", "odev", "ev isi", "homework", "tehvil"],
  exam: ["imtahan", "sinav", "test", "quiz", "exam"],
  attendance: ["davamiyyet", "qayib", "qaib", "devamsiz", "devamsizlik", "istirak", "gelmeyen", "gelmedi"],
  grade: ["qiymet", "ortalama", "orta bal", "bal", "gpa", "not", "notlar", "akademik gosterici", "ugur"],
  teacher: ["muellim", "ogretmen", "hoca", "ustad", "ustaz", "teacher", "pedaqoq"],
  resource: ["resurs", "material"],
  course: ["kurs", "fenn", "fennler", "fenler", "ders", "predmet"],
  student: ["telebe", "ogrenci", "sagird", "student"],
} as const;
type Entity = keyof typeof ENTITY;

const COUNT_WORDS = ["nece", "neçe", "nefer", "sayi", "say", "kac", "statistika", "istatistik", "cemi", "toplam", "umumi say", "nece dene"];
const STATUS = {
  pending: ["gozley", "gozlem", "bekley", "pending", "baxilmamis", "baxilmayan", "yoxlanilmamis", "yoxlanilmayan", "cavabsiz", "cavablanmamis", "cavab verilmemis", "acıq", "yeni"],
  approved: ["tesdiq", "qebul edil", "qebul olun", "onay", "approved", "cavablanmis", "cavablandirilmis"],
  rejected: ["imtina", "redd", "rejected", "red edil"],
  graduated: ["mezun"],
} as const;
type Status = keyof typeof STATUS;

const BELOW = ["asagi", "az", "kicik", "alt", "zeif", "dusuk", "asagidir", "pis"];
const ABOVE = ["yuxari", "cox", "artiq", "boyuk", "ust", "fazla", "yuksek", "ela"];
const NEGATION = ["vermeyen", "vermemis", "vermeyib", "gondermeyen", "gondermemis", "etmeyen", "etmemis", "eksik", "catdirmayan", "yuklemeyen", "yazmayan", "olmayan", "yoxdur", "tehvilsiz", "edilmemis", "verilmemis"];
const OVERDUE = ["gecikmis", "gecikmis", "vaxti kecmis", "muddeti kecmis", "gecikib"];
const LIST_WORDS = ["siyahi", "liste", "list", "hamisi", "butun", "goster", "kimler", "hansilar", "olanlar"];
const RESULT_WORDS = ["netice", "sonuc", "bal", "faiz", "natice"];
const ROLE_LABELS: Record<string, string> = {
  owner: "Sahib", owner_assistant: "Sahib köməkçisi", admin: "Admin", teacher: "Müəllim", supervisor: "Nəzarətçi",
};
const ROLE_WORDS: Array<[string, string[]]> = [
  ["owner_assistant", ["komekci", "assistent", "owner assistant"]],
  ["supervisor", ["nezaretci", "supervayzer", "supervisor"]],
  ["admin", ["admin", "adminler"]],
  ["teacher", ["muellim", "ogretmen", "hoca", "ustad"]],
];
const STATUS_LABELS: Record<string, string> = {
  pending: "gözləyir", approved: "təsdiqlənib", rejected: "rədd edilib", graduated: "məzun", submitted: "yoxlanılır", graded: "qiymətləndirilib",
  resubmission_requested: "yenidən təhvil tələb olunub", open: "açıq", closed: "bağlı",
};

// Ad axtarışında nəzərə alınmayan bütün xidməti sözlər.
export const SERVICE_WORDS: string[] = [
  ...Object.values(ENTITY).flat(), ...COUNT_WORDS, ...Object.values(STATUS).flat(), ...BELOW, ...ABOVE, ...NEGATION, ...OVERDUE,
  ...LIST_WORDS, ...RESULT_WORDS, ...ROLE_WORDS.flatMap(([, words]) => words),
  ...KW.greeting, ...KW.thanks, ...KW.help, ...KW.search, ...KW.listWords, ...KW.stats,
  "semestr", "donem", "yariyil", "kurs", "proqram", "program", "ereb", "arab", "seviyye", "seviye", "qrup", "qrupu", "grup", "cedvel", "cizelge",
  "olan", "olanlar", "olanlari", "var", "yox", "dan", "den", "tan", "ten", "cox", "en", "son", "hansi", "kim", "kimdir", "nedir", "ne", "goster",
  "acilmayan", "acilmamis", "aciq", "acilan", "bagli", "giris", "erisim", "verilmeyen", "aktiv", "passiv", "silinmis", "silinen", "neticesi", "neticeleri",
  "umumi", "veziyyet", "hesabat", "icmal", "dashboard", "edenler", "eden", "olunan", "olunmus", "edilen", "edilmis", "ucun", "uzre", "gore", "ve", "ya", "veya", "ile", "bu", "hefte", "ay", "il", "gun",
];

// ---------------------------------------------------------------------------
// Köməkçilər
// ---------------------------------------------------------------------------

function has(parsed: ParsedMessage, words: readonly string[]) {
  return countKeywords(parsed, words) > 0;
}

export function isServiceToken(token: string) {
  if (STOPWORDS.has(token)) return true;
  return SERVICE_WORDS.some((word) => !word.includes(" ") && (token === word || (word.length >= 3 && token.startsWith(word)) || fuzzyKeywordMatch(token, word)));
}

/** Sorğudan ad/başlıq axtarışı üçün qalan mənalı sözlər. */
export function residualTokens(parsed: ParsedMessage) {
  return parsed.tokens.filter((token) => token.length >= 2 && !/^\d+$/.test(token) && !/^t\d+$/.test(token) && !token.includes("@") && !isServiceToken(token));
}

export function detectEntities(parsed: ParsedMessage) {
  const found = new Set<Entity>();
  for (const [entity, words] of Object.entries(ENTITY) as Array<[Entity, readonly string[]]>) {
    if (has(parsed, words)) found.add(entity);
  }
  // «Fəndən imtina» fənn silmə müraciətidir, qəbul müraciəti deyil.
  if (found.has("subjectRequest")) found.delete("application");
  if (found.has("excuse")) found.delete("application");
  return found;
}

function detectStatus(parsed: ParsedMessage, entities: Set<Entity>): Status | null {
  for (const status of ["graduated", "rejected", "approved", "pending"] as Status[]) {
    if (status === "rejected" && entities.has("subjectRequest") && !hasKeyword(parsed, "redd")) continue;
    if (has(parsed, STATUS[status])) return status;
  }
  return null;
}

function firstNumber(parsed: ParsedMessage) {
  const match = parsed.text.replace(/\bt\s*\d+/g, " ").match(/(?:^|\s)(\d{1,3})(?=\s|$|-)/);
  return match ? Number(match[1]) : null;
}

function detectTerm(parsed: ParsedMessage): number | null {
  const text = parsed.text;
  const match = text.match(/\b([1-8])\s*-?\s*(?:ci|cu|nci|inci|uncu|ncu|ci)?\s*(?:semestr|semester|donem|yariyil)/)
    ?? text.match(/(?:semestr|semester|donem|yariyil)\s*-?\s*([1-8])\b/);
  return match ? Number(match[1]) : null;
}

function termLabel(term: number) {
  return `${term}-ci semestr`;
}

function bullet(lines: string[], items: string[], cap: number, more = "nəfər") {
  lines.push(...items.slice(0, cap));
  if (items.length > cap) lines.push(`…və daha ${items.length - cap} ${more}. Sorğunu dəqiqləşdirin.`);
}

function studentLine(student: AiStudentMatch, extra?: string) {
  return `• ${studentCode(student.studentNumber)} — ${student.firstName} ${student.lastName} · ${termLabel(student.currentTermNumber)}${extra ? ` · ${extra}` : ""}`;
}

function noPermission(label: string) {
  return reply([`Bu məlumat «${label}» icazəsi tələb edir. Rolunuz üçün bu icazə verilməyib.`], ["Tələbə axtar", "Ümumi statistika"]);
}

function significantTitleWords(title: string) {
  return tokenize(normalizeText(title)).filter((word) => word.length >= 3 && !IGNORED_TITLE_WORDS.has(word));
}

/** Sorğuda adı keçən kurs başlıqları (səhvlərə dözümlü). */
function matchTitles(parsed: ParsedMessage, titles: string[]) {
  const tokens = parsed.tokens.filter((token) => token.length >= 3 && !STOPWORDS.has(token));
  const scored = titles.map((title) => {
    const words = significantTitleWords(title);
    if (!words.length) return { title, score: 0 };
    const normalizedTitle = normalizeText(title);
    if (normalizedTitle.length >= 3 && ` ${parsed.text} `.includes(` ${normalizedTitle}`)) return { title, score: 2 };
    const hits = words.filter((word) => tokens.some((token) => tokenSimilarity(token, word) >= 0.8 || (word.length >= 4 && token.startsWith(word))));
    return { title, score: hits.length / words.length };
  }).filter((item) => item.score >= 0.5);
  if (!scored.length) return [];
  const top = Math.max(...scored.map((item) => item.score));
  return scored.filter((item) => item.score >= top - 0.01).map((item) => item.title);
}

function statusFilter<T extends { status: string }>(items: T[], status: Status | null) {
  return status ? items.filter((item) => item.status === status) : items;
}

function countByStatus(items: Array<{ status: string }>) {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  return Array.from(counts.entries()).map(([status, count]) => `${STATUS_LABELS[status] ?? status}: ${count}`).join(" · ");
}

// ---------------------------------------------------------------------------
// Kömək
// ---------------------------------------------------------------------------

export const ADMIN_SUGGESTIONS = ["Tələbə axtar", "Qayıbı çox olanlar", "Neçə müraciət gözləyir?", "Ümumi statistika"];

export function adminHelp(ctx: AdminAiContext) {
  const can = (permission: string) => ctx.isOwner || ctx.permissions.has(permission);
  return reply([
    "Mən Mədinə AI-yam — admin paneli üçün daxili köməkçi. Cavablar yalnız LMS bazasındakı məlumatlardan qurulur; hərf səhvlərini də başa düşürəm.",
    "Nümunələr:",
    "• Tələbə: «Əli Məmmədov», «mammadov ali», «T0012», «ali@mail.com», «050 123 45 67»",
    "• Filtrlər: «2-ci semestr tələbələri», «qayıbı çox olanlar», «ortalaması 60-dan aşağı olanlar», «tapşırığı təhvil verməyənlər», «ərəb dili səviyyəsi»",
    can("schedule") ? "• Müəllim və dərslər: «Neçə müəllim var?», «Ustad Əli», «Əli müəllimin tələbələri», «Müəllim cədvəli», «Dərs siyahısı», «Quran tələbələri»" : null,
    "• Testlər: «Quran imtahan nəticələri», «testlər»",
    can("assignments") ? "• Tapşırıqlar: «tapşırıqlar», «yoxlanılmamış tapşırıqlar», «Fatihə tapşırığı»" : null,
    can("applications") ? "• Müraciətlər: «Neçə müraciət gözləyir?», «rədd edilən müraciətlər», «fənn silmə müraciətləri»" : null,
    can("excuses") ? "• Üzrlər: «gözləyən üzrlər»" : null,
    can("announcements") ? "• Elan və bildirişlər: «son elanlar», «bildirişlər»" : null,
    "• Sual-cavab: «cavabsız suallar»",
    (ctx.isOwner || ctx.role === "owner_assistant") && can("userRoleManagement") ? "• Heyət: «heyət siyahısı», «neçə admin var»" : null,
    "• «Ümumi statistika» — bütün göstəricilər bir yerdə",
    "• Paneldən istifadə: «Elanı necə yayımlayım?», «Tələbələri harada idarə edim?»",
  ], ADMIN_SUGGESTIONS);
}

// ---------------------------------------------------------------------------
// Tələbə axtarışı və detallar
// ---------------------------------------------------------------------------

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
  return reply(lines, ["Tələbə axtar", "Ümumi statistika"]);
}

async function showStudents(ctx: AdminAiContext, matches: AiStudentMatch[], heading?: string): Promise<AiReply> {
  if (matches.length === 1) {
    const details = await ctx.studentDetails(matches[0].profileId);
    if (!details) return reply(["Tələbə tapıldı, amma akademik profili əlçatan deyil."], ADMIN_SUGGESTIONS);
    return studentDetailsReply(details);
  }
  const lines = [heading ?? `${matches.length} tələbə tapıldı. Tam məlumat üçün T-nömrəni yazın:`];
  bullet(lines, matches.map((student) => `${studentLine(student)} · ${student.email}`), 15);
  return reply(lines, matches.slice(0, 4).map((student) => studentCode(student.studentNumber)));
}

/** E-poçt, T-nömrə, tələbə nömrəsi və ya telefonla dəqiq axtarış. */
function strongLookup(students: AiStudentMatch[], parsed: ParsedMessage): AiStudentMatch[] | null {
  const email = parsed.raw.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0]?.toLowerCase();
  if (email) return students.filter((student) => student.email.toLowerCase() === email || student.email.toLowerCase().includes(email));
  const emailLocal = parsed.raw.match(/([^\s@]{3,})@\s*$/)?.[1]?.toLowerCase();
  if (emailLocal) return students.filter((student) => student.email.toLowerCase().startsWith(emailLocal));
  const tNumber = parsed.text.match(/\bt\s*0*(\d{1,6})\b/);
  if (tNumber) return students.filter((student) => student.studentNumber === Number(tNumber[1]));
  const digits = parsed.raw.replace(/[^\d+]/g, "");
  if (normalizePhone(digits).length >= 7) {
    const byPhone = students.filter((student) => phoneMatches(digits, student.phone));
    if (byPhone.length) return byPhone;
  }
  const plainNumber = parsed.text.match(/^(?:#|no\s*)?0*(\d{1,6})$/);
  if (plainNumber) return students.filter((student) => student.studentNumber === Number(plainNumber[1]));
  return null;
}

function rankStudents(students: AiStudentMatch[], tokens: string[]) {
  return rankItems(students, tokens, (student) => [student.firstName, student.lastName, student.username, student.email.split("@")[0]]);
}

// ---------------------------------------------------------------------------
// Tələbə filtrləri (semestr, kurs, müəllim qrupu, proqram, ərəb dili, qiymət, qayıb, tapşırıq)
// ---------------------------------------------------------------------------

interface StudentFilter {
  label: string;
  test: (student: AiRosterStudent) => boolean;
  metric?: (student: AiRosterStudent) => string;
  sort?: (a: AiRosterStudent, b: AiRosterStudent) => number;
}

interface FilterResult {
  filters: StudentFilter[];
  denied: string | null;
  /** Ad axtarışı üçün istifadə olunmuş (filtr dəyəri olan) sözlər. */
  consumed: Set<string>;
}

async function studentFilters(ctx: AdminAiContext, parsed: ParsedMessage, entities: Set<Entity>, roster: AiRosterStudent[]): Promise<FilterResult> {
  const filters: StudentFilter[] = [];
  const consumed = new Set<string>();
  let denied: string | null = null;
  const canSchedule = ctx.isOwner || ctx.permissions.has("schedule");
  const number = firstNumber(parsed);

  const term = detectTerm(parsed);
  if (term) filters.push({ label: termLabel(term), test: (student) => student.currentTermNumber === term });

  // Kurs filtri
  const allCourses = Array.from(new Set(roster.flatMap((student) => student.courseTitles)));
  const courseHits = matchTitles(parsed, allCourses);
  if (courseHits.length && (entities.has("student") || entities.has("course") || entities.has("attendance") || entities.has("grade"))) {
    if (!canSchedule) denied = "Cədvəl";
    else {
      const keys = new Set(courseHits);
      filters.push({ label: `fənn: ${courseHits.join(", ")}`, test: (student) => student.courseTitles.some((title) => keys.has(title)) });
      for (const title of courseHits) for (const word of significantTitleWords(title)) consumed.add(word);
    }
  }

  // Müəllim qrupu
  if (entities.has("teacher") || hasKeyword(parsed, "qrup") || hasKeyword(parsed, "grup")) {
    const teacherNames = Array.from(new Set(roster.flatMap((student) => student.teacherNames)));
    const nameTokens = residualTokens(parsed).filter((token) => !consumed.has(token));
    const ranked = bestMatches(rankItems(teacherNames, nameTokens, (name) => [name]), 0.6);
    if (ranked.length) {
      if (!canSchedule) denied = "Cədvəl";
      else {
        const names = new Set(ranked.map((entry) => entry.item));
        filters.push({ label: `müəllim qrupu: ${Array.from(names).join(", ")}`, test: (student) => student.teacherNames.some((name) => names.has(name)) });
        for (const token of nameTokens) consumed.add(token);
      }
    }
  }

  // Proqram
  if (has(parsed, ["proqram", "program"])) {
    const programs = Array.from(new Set(roster.map((student) => student.program).filter((value): value is string => Boolean(value))));
    const hits = matchTitles(parsed, programs);
    if (hits.length) {
      const keys = new Set(hits);
      filters.push({ label: `proqram: ${hits.join(", ")}`, test: (student) => Boolean(student.program && keys.has(student.program)) });
      for (const title of hits) for (const word of significantTitleWords(title)) consumed.add(word);
    }
  }

  // Ərəb dili səviyyəsi
  if (has(parsed, ["ereb", "arab", "seviyye", "seviye"])) {
    const levels = Array.from(new Set(roster.map((student) => student.arabicLevel).filter((value): value is string => Boolean(value))));
    const residual = residualTokens(parsed).filter((token) => !consumed.has(token));
    const hits = levels.filter((level) => residual.length && tokenize(normalizeText(level)).some((word) => residual.some((token) => tokenSimilarity(token, word) >= 0.8)));
    if (hits.length) {
      const keys = new Set(hits);
      filters.push({ label: `ərəb dili: ${hits.join(", ")}`, test: (student) => Boolean(student.arabicLevel && keys.has(student.arabicLevel)), metric: (student) => `ərəb dili: ${student.arabicLevel ?? "—"}` });
      for (const token of residual) consumed.add(token);
    } else {
      filters.push({ label: "ərəb dili səviyyəsi üzrə", test: () => true, metric: (student) => `ərəb dili: ${student.arabicLevel ?? "—"}`, sort: (a, b) => (a.arabicLevel ?? "").localeCompare(b.arabicLevel ?? "", "az") });
    }
  }

  // Cədvəl girişi
  if (has(parsed, ["cedvel", "giris", "erisim"]) && entities.has("student")) {
    if (has(parsed, ["acilmayan", "acilmamis", "bagli", "verilmeyen", "verilmemis", "tesdiqlenmemis", "gozley", "gozlem"])) {
      filters.push({ label: "cədvəl girişi açılmayıb", test: (student) => !student.scheduleApproved });
    } else if (has(parsed, ["acilan", "acilmis", "aciq", "verilen", "verilmis"])) {
      filters.push({ label: "cədvəl girişi açıqdır", test: (student) => student.scheduleApproved });
    }
  }

  // Qiymət
  const wantsGrade = entities.has("grade");
  if (wantsGrade && (has(parsed, BELOW) || (number !== null && !has(parsed, ABOVE)))) {
    const limit = number ?? 60;
    filters.push({
      label: `orta qiymət ${limit}-dən aşağı`,
      test: (student) => student.gradeAverage !== null && student.gradeAverage < limit,
      metric: (student) => `ortalama: ${formatGrade(student.gradeAverage)}`,
      sort: (a, b) => (a.gradeAverage ?? 0) - (b.gradeAverage ?? 0),
    });
  } else if (wantsGrade && has(parsed, ABOVE)) {
    const limit = number ?? 85;
    filters.push({
      label: `orta qiymət ${limit} və yuxarı`,
      test: (student) => student.gradeAverage !== null && student.gradeAverage >= limit,
      metric: (student) => `ortalama: ${formatGrade(student.gradeAverage)}`,
      sort: (a, b) => (b.gradeAverage ?? 0) - (a.gradeAverage ?? 0),
    });
  } else if (wantsGrade && has(parsed, ["daxil edilmeyen", "qiymetsiz", "qiymeti olmayan", "qiymet yox"])) {
    filters.push({ label: "cari semestrdə qiyməti yoxdur", test: (student) => student.gradeAverage === null });
  }

  // Qayıb
  if (entities.has("attendance")) {
    if (has(parsed, ["qayibi olmayan", "qayibsiz", "qayib yox", "qayibi yox", "hec qayib"])) {
      filters.push({ label: "qayıbı yoxdur", test: (student) => student.absences === 0 });
    } else if (has(parsed, ABOVE) || number !== null) {
      const limit = number ?? 3;
      const strict = number !== null && has(parsed, ["cox", "artiq", "yuxari", "fazla"]);
      filters.push({
        label: strict ? `${limit}-dən çox qayıb` : `${limit} və daha çox qayıb`,
        test: (student) => (strict ? student.absences > limit : student.absences >= limit),
        metric: (student) => `${student.absences} qayıb`,
        sort: (a, b) => b.absences - a.absences,
      });
    }
  }

  // Təhvil verilməmiş tapşırıqlar
  if (entities.has("assignment") && has(parsed, NEGATION)) {
    const overdueOnly = has(parsed, OVERDUE);
    filters.push({
      label: overdueOnly ? "son tarixi keçmiş, təhvil verilməmiş tapşırığı var" : "təhvil verilməmiş tapşırığı var",
      test: (student) => student.missingAssignments.some((item) => !overdueOnly || item.overdue),
      metric: (student) => {
        const items = student.missingAssignments.filter((item) => !overdueOnly || item.overdue);
        return `${items.length} tapşırıq: ${items.slice(0, 2).map((item) => item.title).join(", ")}${items.length > 2 ? "…" : ""}`;
      },
      sort: (a, b) => b.missingAssignments.length - a.missingAssignments.length,
    });
  }

  return { filters, denied, consumed };
}

async function studentBranch(ctx: AdminAiContext, parsed: ParsedMessage, entities: Set<Entity>, isCount: boolean): Promise<AiReply | null> {
  const roster = await ctx.roster();
  const { filters, denied, consumed } = await studentFilters(ctx, parsed, entities, roster);
  if (denied && !filters.length) return noPermission(denied);
  const nameTokens = residualTokens(parsed).filter((token) => !consumed.has(token));

  // Ad ilə axtarış (filtrlə birlikdə də işləyir: «2-ci semestr Əli»)
  if (nameTokens.length) {
    const pool = roster.filter((student) => filters.every((filter) => filter.test(student)));
    const ranked = rankStudents(pool, nameTokens);
    const matches = bestMatches(ranked);
    if (matches.length) return showStudents(ctx, matches.map((entry) => entry.item));
    if (!filters.length) return null;
  }

  if (!filters.length) {
    if (entities.has("attendance")) {
      const withAbsences = roster.filter((student) => student.absences > 0).sort((a, b) => b.absences - a.absences);
      const lines = [`Cari semestrdə qayıbı olan tələbələr: ${withAbsences.length} / ${roster.length}`];
      bullet(lines, withAbsences.map((student) => studentLine(student, `${student.absences} qayıb`)), 15);
      if (!withAbsences.length) lines.push("Cari semestrdə qayıb qeydə alınmayıb.");
      return reply(lines, ["Qayıbı çox olanlar", "3-dən çox qayıbı olanlar", "Ortalaması 60-dan aşağı olanlar"]);
    }
    if (entities.has("grade")) {
      const graded = roster.filter((student) => student.gradeAverage !== null).sort((a, b) => (a.gradeAverage ?? 0) - (b.gradeAverage ?? 0));
      const average = graded.length ? graded.reduce((sum, student) => sum + (student.gradeAverage ?? 0), 0) / graded.length : null;
      const lines = [
        `Cari semestr qiymətləri: ${graded.length} tələbənin qiyməti daxil edilib (cəmi ${roster.length}).`,
        average !== null ? `Ümumi ortalama: ${formatGrade(average)} (100 ballıq şkala)` : null,
      ].filter((line): line is string => Boolean(line));
      if (graded.length) {
        lines.push("", "Ən aşağı ortalamalar:");
        bullet(lines, graded.slice(0, 10).map((student) => studentLine(student, `ortalama: ${formatGrade(student.gradeAverage)}`)), 10);
        lines.push("", "Ən yüksək ortalamalar:");
        lines.push(...[...graded].reverse().slice(0, 5).map((student) => studentLine(student, `ortalama: ${formatGrade(student.gradeAverage)}`)));
      }
      return reply(lines, ["Ortalaması 60-dan aşağı olanlar", "Ortalaması 90-dan yuxarı olanlar", "Qayıbı çox olanlar"]);
    }
    if (!isCount && countKeywords(parsed, KW.search) && !nameTokens.length) {
      return reply(["Kimi axtarım? Tələbənin adını, soyadını, e-poçtunu, telefonunu və ya T-nömrəsini yazın (məs. «T0012»). Hərf səhvləri olsa da tapıram."], ADMIN_SUGGESTIONS);
    }
    if (isCount || entities.has("student")) return studentStats(roster);
    return null;
  }

  let result = roster.filter((student) => filters.every((filter) => filter.test(student)));
  const sorter = filters.find((filter) => filter.sort)?.sort;
  result = sorter ? [...result].sort(sorter) : result;
  const metrics = filters.map((filter) => filter.metric).filter((metric): metric is NonNullable<StudentFilter["metric"]> => Boolean(metric));
  const heading = `Filtr: ${filters.map((filter) => filter.label).join(" · ")}`;
  if (isCount) {
    const byTerm = new Map<number, number>();
    for (const student of result) byTerm.set(student.currentTermNumber, (byTerm.get(student.currentTermNumber) ?? 0) + 1);
    return reply([
      heading,
      `Uyğun tələbə sayı: ${result.length} (cəmi aktiv tələbə: ${roster.length})`,
      ...Array.from(byTerm.entries()).sort(([a], [b]) => a - b).map(([term, count]) => `• ${termLabel(term)}: ${count} nəfər`),
    ], ["Siyahını göstər", "Ümumi statistika"]);
  }
  const lines = [heading, `${result.length} tələbə tapıldı.`];
  if (!result.length) lines.push("Bu filtrə uyğun tələbə yoxdur.");
  bullet(lines, result.map((student) => studentLine(student, metrics.map((metric) => metric(student)).join(" · ") || undefined)), 25);
  return reply(lines, result.slice(0, 4).map((student) => studentCode(student.studentNumber)));
}

function studentStats(roster: AiRosterStudent[]) {
  const byTerm = new Map<number, number>();
  for (const student of roster) byTerm.set(student.currentTermNumber, (byTerm.get(student.currentTermNumber) ?? 0) + 1);
  const locked = roster.filter((student) => !student.scheduleApproved).length;
  return reply([
    `Aktiv (təsdiqlənmiş) tələbə sayı: ${roster.length}`,
    ...Array.from(byTerm.entries()).sort(([a], [b]) => a - b).map(([term, count]) => `• ${termLabel(term)}: ${count} nəfər`),
    locked ? `• Cədvəl girişi açılmayan: ${locked} nəfər` : null,
  ].filter((line): line is string => Boolean(line)), ["Qayıbı çox olanlar", "Ortalaması 60-dan aşağı olanlar", "Ümumi statistika"]);
}

// ---------------------------------------------------------------------------
// Müəllimlər və heyət
// ---------------------------------------------------------------------------

function teacherLessonLines(teacher: AiTeacher) {
  return teacher.lessons.map((lesson) => `• ${lesson.courseTitle} — ${termLabel(lesson.termNumber)} · ${lessonDaysLabel(lesson.lessonDays)}${lesson.lessonTime ? ` ${lesson.lessonTime}` : ""}`);
}

async function teacherBranch(ctx: AdminAiContext, parsed: ParsedMessage, entities: Set<Entity>, isCount: boolean): Promise<AiReply> {
  const teachers = await ctx.teachers();
  if (!teachers) return noPermission("Cədvəl");
  const nameTokens = residualTokens(parsed);
  const matched = nameTokens.length ? bestMatches(rankItems(teachers, nameTokens, (teacher) => [teacher.name, teacher.email?.split("@")[0]]), 0.6).map((entry) => entry.item) : [];

  if (matched.length && entities.has("student")) {
    const roster = await ctx.roster();
    const names = new Set(matched.map((teacher) => teacher.name));
    const students = roster.filter((student) => student.teacherNames.some((name) => names.has(name)));
    const lines = [`${Array.from(names).join(", ")} — qrupundakı tələbələr (${students.length}):`];
    bullet(lines, students.map((student) => studentLine(student, student.courseTitles.join(", "))), 30);
    return reply(lines, students.slice(0, 4).map((student) => studentCode(student.studentNumber)));
  }

  const weekday = detectWeekday(parsed);
  if (weekday || has(parsed, ["cedvel", "cizelge"])) {
    const pool = matched.length ? matched : teachers;
    const lines = [weekday ? `${weekday.label} üzrə müəllim cədvəli:` : "Müəllim cədvəli (aktiv semestrlər):"];
    for (const teacher of [...pool].sort((a, b) => a.name.localeCompare(b.name, "az"))) {
      const lessons = teacher.lessons.filter((lesson) => !weekday || lesson.lessonDays.includes(weekday.day));
      if (!lessons.length) continue;
      lines.push("", `${teacher.name}:`, ...teacherLessonLines({ ...teacher, lessons }));
    }
    if (lines.length === 1) lines.push("Bu filtrə uyğun dərs tapılmadı.");
    return reply(lines, ["Dərs siyahısı", "Neçə müəllim var?"]);
  }

  if (matched.length) {
    const lines: string[] = [];
    for (const teacher of matched.slice(0, 3)) {
      lines.push(`${teacher.name} — ${ROLE_LABELS[teacher.role] ?? teacher.role}`);
      if (teacher.email) lines.push(`• E-poçt: ${teacher.email}`);
      lines.push(`• Aktiv dərs qrupları: ${teacher.lessons.length} · tələbə sayı: ${teacher.studentCount}`, ...teacherLessonLines(teacher), "");
    }
    return reply(lines, [`${matched[0].name} tələbələri`, "Müəllim cədvəli"]);
  }

  const sorted = [...teachers].sort((a, b) => a.name.localeCompare(b.name, "az"));
  const lines = [`Müəllim sayı: ${teachers.length}`];
  if (!isCount || teachers.length <= 30) {
    bullet(lines, sorted.map((teacher) => `• ${teacher.name} — ${teacher.lessons.length} dərs qrupu · ${teacher.studentCount} tələbə${teacher.email ? ` · ${teacher.email}` : ""}`), 30, "müəllim");
  }
  return reply(lines, ["Müəllim cədvəli", ...sorted.slice(0, 2).map((teacher) => `${teacher.name} tələbələri`)]);
}

async function staffBranch(ctx: AdminAiContext, parsed: ParsedMessage, isCount: boolean): Promise<AiReply> {
  const staff = await ctx.staff();
  if (!staff) {
    // Heyət siyahısı yalnız sahib/sahib köməkçisinə açıqdır; müəllim sayı isə «Cədvəl» icazəsi ilə görünür.
    const teachers = await ctx.teachers();
    if (teachers && has(parsed, ENTITY.teacher)) return teacherBranch(ctx, parsed, new Set(["teacher"]), isCount);
    return reply(["Heyət siyahısı yalnız sahib və «İstifadəçi idarəetməsi» icazəsi olan sahib köməkçisi üçün açıqdır."], ["Neçə müəllim var?", "Ümumi statistika"]);
  }
  const roleFilter = ROLE_WORDS.find(([, words]) => has(parsed, words))?.[0] ?? null;
  const pool = roleFilter ? staff.filter((member) => member.role === roleFilter) : staff;
  const nameTokens = residualTokens(parsed);
  if (nameTokens.length) {
    const matches = bestMatches(rankItems(pool, nameTokens, (member) => [member.name, member.email?.split("@")[0]]));
    if (matches.length) {
      return reply(matches.slice(0, 10).map(({ item }) => `• ${item.name} — ${ROLE_LABELS[item.role] ?? item.role}${item.email ? ` · ${item.email}` : ""}`), ["Heyət siyahısı"]);
    }
  }
  const counts = new Map<string, number>();
  for (const member of staff) counts.set(member.role, (counts.get(member.role) ?? 0) + 1);
  const lines = [
    roleFilter ? `${ROLE_LABELS[roleFilter]} sayı: ${pool.length}` : `Heyət üzvləri: ${staff.length}`,
    roleFilter ? null : Array.from(counts.entries()).map(([role, count]) => `${ROLE_LABELS[role] ?? role}: ${count}`).join(" · "),
  ].filter((line): line is string => Boolean(line));
  if (!isCount || pool.length <= 30) {
    bullet(lines, [...pool].sort((a, b) => a.name.localeCompare(b.name, "az")).map((member) => `• ${member.name} — ${ROLE_LABELS[member.role] ?? member.role}${member.email ? ` · ${member.email}` : ""}`), 30, "nəfər");
  }
  return reply(lines, ["Neçə müəllim var?", "Neçə admin var?"]);
}

// ---------------------------------------------------------------------------
// Müraciətlər, üzrlər, sual-cavab, elanlar
// ---------------------------------------------------------------------------

async function applicationBranch(ctx: AdminAiContext, parsed: ParsedMessage, status: Status | null, isCount: boolean): Promise<AiReply> {
  const all = await ctx.applications();
  if (!all) return noPermission("Müraciətlər");
  const showDeleted = has(parsed, ["silinmis", "silinen"]);
  const active = all.filter((item) => item.deleted === showDeleted);
  const filtered = statusFilter(active, status);
  const nameTokens = residualTokens(parsed);
  const email = parsed.raw.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0]?.toLowerCase();
  let list: AiApplication[] = filtered;
  if (email) list = filtered.filter((item) => item.email.toLowerCase().includes(email));
  else if (nameTokens.length) {
    const matches = bestMatches(rankItems(filtered, nameTokens, (item) => [item.firstName, item.lastName, item.username, item.email.split("@")[0]]));
    if (matches.length) list = matches.map((entry) => entry.item);
  }
  const label = status ? `«${STATUS_LABELS[status]}» statuslu ` : "";
  const lines = [
    `${showDeleted ? "Silinmiş " : ""}${label}müraciətlər: ${list.length}`,
    !status && list === filtered ? `Statuslar: ${countByStatus(active) || "—"}` : null,
  ].filter((line): line is string => Boolean(line));
  if (!isCount) {
    bullet(lines, list.map((item) => `• ${item.firstName} ${item.lastName} · ${item.email} · ${item.phone} · ərəb dili: ${item.arabicLevel} · ${STATUS_LABELS[item.status] ?? item.status} · ${formatDate(item.createdAt)}${item.rejectionReason ? ` · səbəb: ${snippet(item.rejectionReason, 60)}` : ""}`), 20, "müraciət");
  }
  return reply(lines, ["Gözləyən müraciətlər", "Rədd edilən müraciətlər", "Fənn silmə müraciətləri"]);
}

async function subjectRequestBranch(ctx: AdminAiContext, status: Status | null, isCount: boolean): Promise<AiReply> {
  const all = await ctx.subjectRequests();
  if (!all) return noPermission("Müraciətlər");
  const list = statusFilter(all, status);
  const lines = [`Fənn silmə müraciətləri${status ? ` («${STATUS_LABELS[status]}»)` : ""}: ${list.length}`, status ? null : `Statuslar: ${countByStatus(all) || "—"}`]
    .filter((line): line is string => Boolean(line));
  if (!isCount) bullet(lines, list.map((item) => `• ${item.studentName}${item.studentNumber ? ` (${studentCode(item.studentNumber)})` : ""} — ${item.courseTitle} · ${termLabel(item.termNumber)} · ${STATUS_LABELS[item.status] ?? item.status} · ${snippet(item.reason, 60)}`), 20, "müraciət");
  return reply(lines, ["Gözləyən müraciətlər", "Gözləyən üzrlər"]);
}

async function excuseBranch(ctx: AdminAiContext, parsed: ParsedMessage, status: Status | null, isCount: boolean): Promise<AiReply> {
  const all = await ctx.excuses();
  if (!all) return noPermission("Üzrlər");
  let list = statusFilter(all, status);
  const nameTokens = residualTokens(parsed);
  if (nameTokens.length) {
    const matches = bestMatches(rankItems(list, nameTokens, (item) => [item.studentName, item.courseTitle]));
    if (matches.length) list = matches.map((entry) => entry.item);
  }
  const lines = [`Davamiyyət üzrləri${status ? ` («${STATUS_LABELS[status]}»)` : ""}: ${list.length}`, status ? null : `Statuslar: ${countByStatus(all) || "—"}`]
    .filter((line): line is string => Boolean(line));
  if (!isCount) bullet(lines, list.map((item) => `• ${item.studentName}${item.studentNumber ? ` (${studentCode(item.studentNumber)})` : ""} — ${item.courseTitle}${item.attendanceDate ? ` · ${formatDate(item.attendanceDate)}` : ""} · ${STATUS_LABELS[item.status] ?? item.status} · ${snippet(item.reason, 70)}`), 20, "üzr");
  return reply(lines, ["Gözləyən üzrlər", "Qayıbı çox olanlar"]);
}

async function questionBranch(ctx: AdminAiContext, parsed: ParsedMessage, status: Status | null, isCount: boolean): Promise<AiReply> {
  const all = await ctx.questions();
  const unansweredOnly = status === "pending" || has(parsed, ["cavabsiz", "cavablanmamis", "cavab verilmemis", "cavabi olmayan"]);
  const answeredOnly = !unansweredOnly && status === "approved";
  let list = all.filter((item) => (unansweredOnly ? !item.answered : answeredOnly ? item.answered : true));
  const nameTokens = residualTokens(parsed);
  if (nameTokens.length) {
    const matches = bestMatches(rankItems(list, nameTokens, (item) => [item.title]));
    if (matches.length) list = matches.map((entry) => entry.item);
  }
  const unanswered = all.filter((item) => !item.answered).length;
  const lines = [`Sual-cavab: ${list.length} sual${unansweredOnly ? " (cavabsız)" : answeredOnly ? " (cavablanmış)" : ` · cavabsız: ${unanswered}`}`];
  if (!isCount) bullet(lines, list.map((item) => `• ${item.title} · ${formatDate(item.createdAt)} · ${item.answered ? `cavablandırıb: ${item.answeredByName ?? "—"}` : "cavab gözləyir"}`), 15, "sual");
  return reply(lines, ["Cavabsız suallar", "Gözləyən üzrlər"]);
}

async function noticeBranch(ctx: AdminAiContext, parsed: ParsedMessage, entities: Set<Entity>, isCount: boolean): Promise<AiReply> {
  const all = await ctx.notices();
  if (!all) return noPermission("Elanlar");
  const kind = entities.has("notification") && !entities.has("announcement") ? "notification" : entities.has("announcement") && !entities.has("notification") ? "announcement" : null;
  let list = kind ? all.filter((item) => item.kind === kind) : all;
  const nameTokens = residualTokens(parsed);
  if (nameTokens.length) {
    const matches = bestMatches(rankItems(list, nameTokens, (item) => [item.title, item.body]));
    if (matches.length) list = matches.map((entry) => entry.item);
  }
  const title = kind === "notification" ? "Tələbə bildirişləri" : kind === "announcement" ? "Elanlar" : "Elan və bildirişlər";
  const lines = [`${title}: ${list.length}`];
  if (!isCount) bullet(lines, list.map((item) => `• ${item.kind === "announcement" ? "Elan" : "Bildiriş"}: ${item.title} · ${formatDate(item.date)}${item.target ? ` · ${item.target}` : ""}${item.body ? ` — ${snippet(item.body, 80)}` : ""}`), 10, "qeyd");
  return reply(lines, ["Son elanlar", "Bildirişlər"]);
}

// ---------------------------------------------------------------------------
// Tapşırıqlar və testlər
// ---------------------------------------------------------------------------

function filterByCourse<T extends { courseTitle: string }>(parsed: ParsedMessage, items: T[]) {
  const hits = matchTitles(parsed, Array.from(new Set(items.map((item) => item.courseTitle))));
  if (!hits.length) return { items, hits, consumed: new Set<string>() };
  const keys = new Set(hits);
  const consumed = new Set(hits.flatMap((title) => significantTitleWords(title)));
  return { items: items.filter((item) => keys.has(item.courseTitle)), hits, consumed };
}

async function assignmentBranch(ctx: AdminAiContext, parsed: ParsedMessage, entities: Set<Entity>, isCount: boolean): Promise<AiReply> {
  const all = await ctx.assignmentsOverview();
  if (!all) return noPermission("Tapşırıqlar");
  const term = detectTerm(parsed);
  const byCourse = filterByCourse(parsed, term ? all.filter((item) => item.termNumber === term) : all);
  let list: AiAssignmentOverview[] = byCourse.items;
  const pendingReview = has(parsed, ["yoxlanilmamis", "yoxlanilmayan", "qiymetlendirilmemis", "baxilmamis", "yoxlanilir", "yoxlama gozley"]);
  if (pendingReview) list = list.filter((item) => item.pendingReview > 0);
  if (has(parsed, ["aciq", "aktiv"])) list = list.filter((item) => item.status === "open");
  const nameTokens = residualTokens(parsed).filter((token) => !byCourse.consumed.has(token));
  if (nameTokens.length) {
    const matches = bestMatches(rankItems(list, nameTokens, (item) => [item.title, item.teacherName]));
    if (matches.length) list = matches.map((entry) => entry.item);
  }
  if (list.length === 1 && !isCount) {
    const item = list[0];
    const lines = [
      `${item.title} — ${item.courseTitle} · ${termLabel(item.termNumber)}`,
      `• Müəllim: ${item.teacherName ?? "—"} · son tarix: ${formatDate(item.dueAt)} · maks. bal: ${item.maxScore} · ${STATUS_LABELS[item.status] ?? item.status}`,
      `• Təhvil verən: ${item.submitted} · qiymətləndirilib: ${item.graded} · yoxlama gözləyir: ${item.pendingReview}${item.averageScore !== null ? ` · orta bal: ${item.averageScore}` : ""}`,
      `• Təhvil verməyən (cari qrupda): ${item.missingStudents.length}`,
    ];
    bullet(lines, item.missingStudents.map((student) => `  – ${student.name}${student.studentNumber ? ` (${studentCode(student.studentNumber)})` : ""}`), 30);
    return reply(lines, ["Tapşırığı təhvil verməyənlər", "Yoxlanılmamış tapşırıqlar"]);
  }
  const heading = [`Tapşırıqlar${byCourse.hits.length ? ` (${byCourse.hits.join(", ")})` : ""}${term ? ` · ${termLabel(term)}` : ""}${pendingReview ? " · yoxlama gözləyən" : ""}: ${list.length}`];
  if (!isCount) {
    bullet(heading, list.map((item) => `• ${item.title} — ${item.courseTitle} · ${termLabel(item.termNumber)} · son tarix ${formatDate(item.dueAt)} · təhvil: ${item.submitted}, yoxlanılmayıb: ${item.pendingReview}, verməyən: ${item.missingStudents.length}`), 15, "tapşırıq");
  } else {
    heading.push(`Yoxlama gözləyən təhvillər: ${list.reduce((sum, item) => sum + item.pendingReview, 0)}`);
  }
  void entities;
  return reply(heading, ["Tapşırığı təhvil verməyənlər", "Yoxlanılmamış tapşırıqlar"]);
}

function examSummary(exam: AiExamOverview) {
  const average = exam.results.length ? Math.round(exam.results.reduce((sum, item) => sum + item.percentage, 0) / exam.results.length) : null;
  return `• ${exam.title} — ${exam.courseTitle}${exam.isOnboarding ? " (qəbul testi)" : ` · ${termLabel(exam.termNumber)}`} · ${STATUS_LABELS[exam.status] ?? exam.status} · ${exam.results.length} nəticə${average !== null ? ` · orta: ${average}%` : ""}`;
}

async function examBranch(ctx: AdminAiContext, parsed: ParsedMessage, isCount: boolean): Promise<AiReply> {
  const all = await ctx.examsOverview();
  const term = detectTerm(parsed);
  const onboarding = has(parsed, ["qebul testi", "qebul imtahan"]);
  const base = all.filter((exam) => (!term || exam.termNumber === term) && (!onboarding || exam.isOnboarding));
  const byCourse = filterByCourse(parsed, base);
  let list = byCourse.items;
  let narrowed = false;
  const nameTokens = residualTokens(parsed).filter((token) => !byCourse.consumed.has(token));
  if (nameTokens.length) {
    const matches = bestMatches(rankItems(list, nameTokens, (exam) => [exam.title]));
    if (matches.length) { list = matches.map((entry) => entry.item); narrowed = true; }
  }
  const wantsResults = has(parsed, RESULT_WORDS) || byCourse.hits.length > 0 || narrowed;
  if (!isCount && wantsResults && list.length && list.length <= 3) {
    const lines: string[] = [];
    for (const exam of list) {
      lines.push(examSummary(exam).slice(2));
      if (!exam.results.length) lines.push("  Hələ nəticə yoxdur.");
      bullet(lines, exam.results.map((result) => `  – ${result.studentName}${result.studentNumber ? ` (${studentCode(result.studentNumber)})` : ""}: ${result.correctCount}/${result.totalQuestions} (${result.percentage}%)`), 25);
      lines.push("");
    }
    return reply(lines, ["Testlər", "Ortalaması 60-dan aşağı olanlar"]);
  }
  const lines = [`Testlər${byCourse.hits.length ? ` (${byCourse.hits.join(", ")})` : ""}: ${list.length} · nəticə sayı: ${list.reduce((sum, exam) => sum + exam.results.length, 0)}`];
  if (!isCount) bullet(lines, list.map(examSummary), 15, "test");
  return reply(lines, list.slice(0, 2).map((exam) => `${exam.title} nəticələri`));
}

// ---------------------------------------------------------------------------
// Kurslar
// ---------------------------------------------------------------------------

async function courseBranch(ctx: AdminAiContext, parsed: ParsedMessage, entities: Set<Entity>, isCount: boolean): Promise<AiReply | null> {
  if (!(ctx.isOwner || ctx.permissions.has("schedule"))) return noPermission("Cədvəl");
  const courses = await ctx.courses();
  const hits = new Set(matchTitles(parsed, courses.map((course) => course.title)));
  const matched = courses.filter((course) => hits.has(course.title));
  if (matched.length) {
    const lines: string[] = [];
    const wantsStudents = entities.has("student") || has(parsed, KW.listWords);
    for (const course of matched.slice(0, 3)) {
      lines.push(`${course.title} (${course.category})`);
      for (const lesson of course.lessons) {
        lines.push(`• ${termLabel(lesson.termNumber)} · ${lesson.teacherName ?? course.instructor ?? "—"} · ${lessonDaysLabel(lesson.lessonDays)}${lesson.lessonTime ? ` ${lesson.lessonTime}` : ""}${lesson.isMandatory ? "" : " (seçmə)"}`);
      }
      if (wantsStudents) {
        const students = await ctx.courseStudents(course.courseId);
        lines.push(`Tələbələr (${students.length}):`);
        bullet(lines, students.map((student) => studentLine(student)), 40);
      }
      lines.push("");
    }
    return reply(lines, wantsStudents ? ["Dərs siyahısı", "Tələbə axtar"] : matched.slice(0, 2).map((course) => `${course.title} tələbələri`));
  }
  if (!entities.has("course") && !entities.has("resource")) return null;
  const lines = [`Dərslər (${courses.length}):`];
  if (!isCount) {
    for (const course of courses) {
      const terms = Array.from(new Set(course.lessons.map((lesson) => lesson.termNumber))).sort((a, b) => a - b);
      const teachers = Array.from(new Set(course.lessons.map((lesson) => lesson.teacherName).filter((name): name is string => Boolean(name))));
      lines.push(`• ${course.title} (${course.category}) — müəllim: ${teachers.length ? teachers.join(", ") : course.instructor || "—"}${terms.length ? ` · semestr: ${terms.join(", ")}` : ""}`);
    }
    lines.push("", "Dərsin tələbə siyahısı üçün yazın: «<dərs adı> tələbələri».");
  }
  return reply(lines, courses.slice(0, 3).map((course) => `${course.title} tələbələri`));
}

// ---------------------------------------------------------------------------
// Ümumi statistika və qlobal axtarış
// ---------------------------------------------------------------------------

async function overallStats(ctx: AdminAiContext): Promise<AiReply> {
  const [roster, teachers, applications, excuses, questions, assignments, exams, notices, subjectRequests] = await Promise.all([
    ctx.roster(), ctx.teachers(), ctx.applications(), ctx.excuses(), ctx.questions(), ctx.assignmentsOverview(), ctx.examsOverview(), ctx.notices(), ctx.subjectRequests(),
  ]);
  const canSchedule = ctx.isOwner || ctx.permissions.has("schedule");
  const courses = canSchedule ? await ctx.courses() : null;
  const byTerm = new Map<number, number>();
  for (const student of roster) byTerm.set(student.currentTermNumber, (byTerm.get(student.currentTermNumber) ?? 0) + 1);
  const lines = [
    "Ümumi statistika:",
    `• Aktiv tələbə: ${roster.length} (${Array.from(byTerm.entries()).sort(([a], [b]) => a - b).map(([term, count]) => `${term}-ci sem.: ${count}`).join(", ") || "—"})`,
    `• Cari semestrdə qayıbı 3+ olan: ${roster.filter((student) => student.absences >= 3).length} · ortalaması 60-dan aşağı: ${roster.filter((student) => student.gradeAverage !== null && student.gradeAverage < 60).length}`,
    teachers ? `• Müəllim: ${teachers.length}` : null,
    courses ? `• Dərs: ${courses.length}` : null,
    applications ? `• Müraciətlər: ${applications.filter((item) => !item.deleted).length} (${countByStatus(applications.filter((item) => !item.deleted)) || "—"})` : null,
    subjectRequests ? `• Fənn silmə müraciəti gözləyir: ${subjectRequests.filter((item) => item.status === "pending").length}` : null,
    excuses ? `• Üzrlər: ${excuses.length} (gözləyir: ${excuses.filter((item) => item.status === "pending").length})` : null,
    assignments ? `• Tapşırıqlar: ${assignments.length} (açıq: ${assignments.filter((item) => item.status === "open").length}, yoxlama gözləyən təhvil: ${assignments.reduce((sum, item) => sum + item.pendingReview, 0)})` : null,
    `• Testlər: ${exams.length} (nəticə: ${exams.reduce((sum, exam) => sum + exam.results.length, 0)})`,
    `• Sual-cavab: ${questions.length} (cavabsız: ${questions.filter((item) => !item.answered).length})`,
    notices ? `• Elan: ${notices.filter((item) => item.kind === "announcement").length} · bildiriş: ${notices.filter((item) => item.kind === "notification").length}` : null,
  ];
  return reply(lines, ["Qayıbı çox olanlar", "Gözləyən müraciətlər", "Cavabsız suallar"]);
}

interface SearchCandidate {
  type: string;
  label: string;
  query: string;
  fields: Array<string | null | undefined>;
}

async function searchCandidates(ctx: AdminAiContext): Promise<SearchCandidate[]> {
  const [roster, teachers, staff, applications, assignments, exams, notices, questions] = await Promise.all([
    ctx.roster(), ctx.teachers(), ctx.staff(), ctx.applications(), ctx.assignmentsOverview(), ctx.examsOverview(), ctx.notices(), ctx.questions(),
  ]);
  const canSchedule = ctx.isOwner || ctx.permissions.has("schedule");
  const courses = canSchedule ? await ctx.courses() : [];
  const candidates: SearchCandidate[] = [];
  for (const student of roster) {
    candidates.push({ type: "Tələbələr", label: `${student.firstName} ${student.lastName} (${studentCode(student.studentNumber)})`, query: studentCode(student.studentNumber), fields: [student.firstName, student.lastName, student.username, student.email.split("@")[0]] });
  }
  for (const teacher of teachers ?? []) candidates.push({ type: "Müəllimlər", label: teacher.name, query: teacher.name, fields: [teacher.name, teacher.email?.split("@")[0]] });
  const teacherIds = new Set((teachers ?? []).map((teacher) => teacher.clerkUserId));
  for (const member of staff ?? []) {
    if (teacherIds.has(member.clerkUserId)) continue;
    candidates.push({ type: "Heyət", label: `${member.name} — ${ROLE_LABELS[member.role] ?? member.role}`, query: `heyət ${member.name}`, fields: [member.name, member.email?.split("@")[0]] });
  }
  for (const course of courses) candidates.push({ type: "Dərslər", label: course.title, query: course.title, fields: [course.title, course.category] });
  for (const item of applications ?? []) {
    if (item.deleted || item.status === "approved") continue;
    candidates.push({ type: "Müraciətlər", label: `${item.firstName} ${item.lastName} — ${STATUS_LABELS[item.status] ?? item.status}`, query: `müraciət ${item.firstName} ${item.lastName}`, fields: [item.firstName, item.lastName, item.username, item.email.split("@")[0]] });
  }
  for (const item of assignments ?? []) candidates.push({ type: "Tapşırıqlar", label: `${item.title} — ${item.courseTitle}`, query: `${item.title} tapşırığı`, fields: [item.title] });
  for (const exam of exams) candidates.push({ type: "Testlər", label: `${exam.title} — ${exam.courseTitle}`, query: `${exam.title} nəticələri`, fields: [exam.title] });
  for (const item of notices ?? []) candidates.push({ type: item.kind === "announcement" ? "Elanlar" : "Bildirişlər", label: item.title, query: `${item.kind === "announcement" ? "elan" : "bildiriş"} ${item.title}`, fields: [item.title] });
  for (const item of questions) candidates.push({ type: "Sual-cavab", label: item.title, query: `sual ${item.title}`, fields: [item.title] });
  return candidates;
}

async function globalSearch(ctx: AdminAiContext, tokens: string[]): Promise<AiReply | null> {
  const candidates = await searchCandidates(ctx);
  const ranked = rankItems(candidates, tokens, (candidate) => candidate.fields);
  const matches = bestMatches(ranked);
  if (matches.length) {
    // Yalnız bir tələbə tapılıbsa, birbaşa tam məlumat göstər.
    if (matches.length === 1 && matches[0].item.type === "Tələbələr") {
      const roster = await ctx.roster();
      const student = roster.find((item) => studentCode(item.studentNumber) === matches[0].item.query);
      if (student) return showStudents(ctx, [student]);
    }
    const groups = new Map<string, Ranked<SearchCandidate>[]>();
    for (const entry of matches) {
      if (!groups.has(entry.item.type)) groups.set(entry.item.type, []);
      groups.get(entry.item.type)!.push(entry);
    }
    const lines = [`Axtarış nəticələri (${matches.length}):`];
    for (const [type, entries] of groups) {
      lines.push("", `${type} (${entries.length}):`);
      bullet(lines, entries.map((entry) => `• ${entry.item.label}`), 5, "nəticə");
    }
    return reply(lines, matches.slice(0, 4).map((entry) => entry.item.query));
  }
  const near = candidates
    .map((item) => ({ item, score: looseSimilarity(tokens, item.fields) }))
    .filter((entry) => entry.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  if (!near.length) return null;
  return reply([
    "Dəqiq uyğunluq tapılmadı. Bunu nəzərdə tuturdunuz?",
    ...near.map((entry) => `• ${entry.item.label} (${entry.item.type.toLocaleLowerCase("az-AZ")})`),
  ], near.slice(0, 4).map((entry) => entry.item.query));
}

// ---------------------------------------------------------------------------
// Əsas yönləndirici
// ---------------------------------------------------------------------------

export async function answerAdmin(parsed: ParsedMessage, ctx: AdminAiContext): Promise<AiReply> {
  if (!parsed.tokens.length) return adminHelp(ctx);

  const guide = answerGuide(parsed, "admin");
  if (guide) return guide;

  // 1) Dəqiq identifikatorlar: e-poçt, T-nömrə, telefon.
  const strong = strongLookup(await ctx.allStudents(), parsed);
  if (strong && strong.length) return showStudents(ctx, strong);
  const emailLocal = parsed.raw.match(/([^\s@]+)@[^\s@]+\.[^\s@]+/)?.[1];
  if (strong && emailLocal) {
    // Tələbə deyilsə: müraciət, müəllim və ya heyət üzvünün e-poçtu ola bilər.
    const other = await globalSearch(ctx, [normalizeText(emailLocal).replace(/[\s.-]+/g, "")].filter(Boolean));
    if (other) return other;
  }

  const entities = detectEntities(parsed);
  const isCount = has(parsed, COUNT_WORDS);
  const status = detectStatus(parsed, entities);
  const residual = residualTokens(parsed);

  if (!entities.size && !residual.length) {
    if (countKeywords(parsed, KW.thanks)) return reply(["Dəyməz! Başqa nə lazım olsa, yazın."], ADMIN_SUGGESTIONS);
    if (isCount || has(parsed, ["statistika", "istatistik", "umumi"])) return overallStats(ctx);
    if (strong) return reply(["Bu identifikatora uyğun tələbə tapılmadı. E-poçtu, telefonu və ya T-nömrəni yoxlayın."], ADMIN_SUGGESTIONS);
    return adminHelp(ctx);
  }
  if (strong && !residual.length && !entities.size) {
    return reply(["Bu identifikatora uyğun tələbə tapılmadı. E-poçtu, telefonu və ya T-nömrəni yoxlayın."], ADMIN_SUGGESTIONS);
  }
  if (has(parsed, ["umumi statistika", "umumi veziyyet", "hesabat", "dashboard", "icmal"]) && !residual.length) return overallStats(ctx);

  // 2) Müraciət, üzr, heyət, sual, elan kimi aydın obyektlər.
  if (entities.has("subjectRequest")) return subjectRequestBranch(ctx, status, isCount);
  if (entities.has("excuse")) return excuseBranch(ctx, parsed, status, isCount);
  if (entities.has("application")) return applicationBranch(ctx, parsed, status, isCount);
  if (entities.has("staff") && !entities.has("student")) return staffBranch(ctx, parsed, isCount);
  if (entities.has("question") && !entities.has("student")) return questionBranch(ctx, parsed, status, isCount);
  if ((entities.has("announcement") || entities.has("notification")) && !entities.has("student")) return noticeBranch(ctx, parsed, entities, isCount);

  // 3) Tapşırıq/test: «təhvil verməyənlər» tələbə filtridir.
  const missingFilter = entities.has("assignment") && has(parsed, NEGATION);
  if (entities.has("assignment") && !missingFilter && !entities.has("student")) return assignmentBranch(ctx, parsed, entities, isCount);
  if (entities.has("exam") && !entities.has("student")) return examBranch(ctx, parsed, isCount);

  // 4) Müəllim (tələbə sözü yoxdursa və ya «Əli müəllimin tələbələri»).
  if (entities.has("teacher") && !entities.has("attendance") && !entities.has("grade")) {
    if (!entities.has("student") || residual.length) return teacherBranch(ctx, parsed, entities, isCount);
  }

  // 5) Kurs (tələbə filtrləri olmadan): «Kurs siyahısı», «Quran tələbələri», «neçə kurs var».
  const studentFilterWords = detectTerm(parsed) !== null || entities.has("attendance") || entities.has("grade") || missingFilter;
  if ((entities.has("course") || entities.has("resource")) && !studentFilterWords && !(entities.has("student") && residual.length > 1)) {
    const result = await courseBranch(ctx, parsed, entities, isCount);
    if (result) return result;
  } else if (!studentFilterWords && entities.has("student") && (ctx.isOwner || ctx.permissions.has("schedule"))) {
    const result = await courseBranch(ctx, parsed, entities, isCount);
    if (result) return result;
  }

  // 6) Tələbələr: filtr, statistika və ya ad axtarışı.
  const studentResult = await studentBranch(ctx, parsed, entities, isCount);
  if (studentResult) return studentResult;

  if (isCount && !residual.length) return overallStats(ctx);

  // 7) Qeyri-müəyyən sorğu: bütün obyektlər üzrə səhvlərə dözümlü axtarış.
  if (residual.length) {
    const global = await globalSearch(ctx, residual);
    if (global) return global;
  }

  if (countKeywords(parsed, KW.thanks)) return reply(["Dəyməz! Başqa nə lazım olsa, yazın."], ADMIN_SUGGESTIONS);
  if (countKeywords(parsed, KW.greeting) || countKeywords(parsed, KW.help)) return adminHelp(ctx);
  if (entities.has("student") || countKeywords(parsed, KW.search)) {
    return reply([
      residual.length
        ? "Bu sorğuya uyğun tələbə tapılmadı. Ad, soyad, e-poçt, telefon və ya T-nömrəni yoxlayın."
        : "Kimi axtarım? Tələbənin adını, soyadını, e-poçtunu, telefonunu və ya T-nömrəsini yazın (məs. «T0012»).",
    ], ADMIN_SUGGESTIONS);
  }
  return reply([
    "Bu sualı başa düşmədim və ya uyğun məlumat tapmadım.",
    "Ad, e-poçt, T-nömrə, dərs və ya tapşırıq adı yazın, yaxud «Ümumi statistika», «Qayıbı çox olanlar», «Neçə müəllim var?» kimi sorğulardan istifadə edin.",
  ], ADMIN_SUGGESTIONS);
}
