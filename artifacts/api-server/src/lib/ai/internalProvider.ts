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
import { countKeywords, hasKeyword, normalizeText, parse, tokenize, type ParsedMessage } from "./text.js";
import { KW } from "./keywords.js";
import {
  ATTENDANCE_STATUS, WEEKDAY_LABELS, WEEKDAY_ORDER, bakuWeekday, detectTermNumber, detectWeekday, formatDate, formatDateTime,
  formatGrade, lessonDaysLabel, reply, snippet, studentCode, titleMatches,
} from "./format.js";
import { answerAdmin } from "./admin.js";
import { answerGuide, guideTopicList } from "./siteGuide.js";

export { normalizeText } from "./text.js";

// ---------------------------------------------------------------------------
// Tələbə rejimi
// ---------------------------------------------------------------------------

const STUDENT_SUGGESTIONS = ["Dərs cədvəlim", "Tapşırıqlarım", "Qiymətlərim", "Saytdan istifadə"];

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
    "",
    "Saytdan istifadə ilə bağlı da soruşa bilərsiniz, məsələn:",
    "• «Tapşırığı necə göndərim?», «Dərs cədvəlini harada görüm?», «Qayıb üçün üzr necə yazım?»",
    "• «Resurslar haradadır?», «Müəllimə necə mesaj yazım?», «Sual-cavab necə işləyir?»",
    "• «Profilimi necə dəyişim?», «İmtahan necə verilir?», «Bildirişlər harada?», «Çıxış necə edim?»",
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

  // "Necə / harada" sualları məlumat sorğularından üstündür: saytdan istifadə bələdçisi.
  const guide = answerGuide(parsed, "student");
  if (guide) return guide;

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
    "Bu sualı tam başa düşmədim. Mən daxili köməkçiyəm və yalnız sizin Akademiya məlumatlarınız əsasında cavab verirəm.",
    "Bunları soruşa bilərsiniz: dərs cədvəli, tapşırıqlar, imtahanlar, qiymətlər, davamiyyət, resurslar, fənlər, profil, elanlar.",
    `Saytdan istifadə mövzuları: ${guideTopicList("student").join(", ")}. Məsələn: «Tapşırığı necə göndərim?»`,
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
// Provayder
// ---------------------------------------------------------------------------

export const internalAiProvider: AiProvider = {
  name: "internal",
  async answer(input: { message: string; history: AiChatTurn[] }, context: AiContext): Promise<AiReply> {
    const parsed = parse(input.message, context.mode === "admin");
    return context.mode === "student" ? answerStudent(parsed, context) : answerAdmin(parsed, context);
  },
};
