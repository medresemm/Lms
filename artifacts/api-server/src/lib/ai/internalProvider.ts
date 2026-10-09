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
import { blockReply, ensureBlocks, type AiBlock, type AiItem, type AiRow } from "./blocks.js";
import { answerAdmin } from "./admin.js";
import { answerGuide, guideTopicList } from "./siteGuide.js";

export { normalizeText } from "./text.js";

// ---------------------------------------------------------------------------
// Tələbə rejimi
// ---------------------------------------------------------------------------

const STUDENT_SUGGESTIONS = ["Dərs cədvəlim", "Tapşırıqlarım", "Qiymətlərim", "Saytdan istifadə"];

function plural(count: number, word: string) {
  return `${count} ${word}`;
}

function studentHelp(name?: string) {
  return blockReply([
    { type: "text", text: name ? `Salam, ${name}! Mən Mədinə AI-yam. Dərsləriniz, tapşırıqlarınız və nəticələrinizlə bağlı sizə kömək edə bilərəm.` : "Mən Mədinə AI-yam. Dərsləriniz, tapşırıqlarınız və nəticələrinizlə bağlı sizə kömək edə bilərəm." },
    {
      type: "card",
      title: "Məndən soruşa bilərsiniz",
      items: [
        { title: "Dərs cədvəlim", detail: "və ya «Bu gün dərsim var?»" },
        { title: "Tapşırıqlarım", detail: "açıq ev tapşırıqları və son tarixlər" },
        { title: "İmtahanlarım", detail: "testlər və nəticələr" },
        { title: "Qiymətlərim", detail: "fənlər üzrə qiymətlər və orta bal" },
        { title: "Davamiyyətim", detail: "buraxılan dərslər" },
        { title: "Resurslar", detail: "dərs materialları və linklər" },
        { title: "Fənlərim, Profilim, Elanlar" },
      ],
      note: "Fənnin adını da yaza bilərsiniz, məsələn: «Quran qiymətim».",
    },
    {
      type: "card",
      title: "Saytdan istifadə",
      items: [
        { title: "Tapşırığı necə göndərim?" },
        { title: "Qayıb üçün üzr necə yazım?" },
        { title: "Müəllimə necə mesaj yazım?" },
        { title: "Profilimi necə dəyişim?" },
      ],
    },
  ], STUDENT_SUGGESTIONS);
}

function lessonItem(lesson: AiLesson, joinToday = false): AiItem {
  return {
    title: lesson.courseTitle,
    detail: lesson.title && lesson.title !== lesson.courseTitle ? lesson.title : undefined,
    meta: [lesson.lessonTime ? `saat ${lesson.lessonTime}` : "saatı hələ bəlli deyil", lesson.teacherName ? lesson.teacherName : null].filter((part): part is string => Boolean(part)),
    action: joinToday && lesson.lessonTime ? { label: "Dərsə qoşul", href: `/api/lessons/${lesson.resourceId}/join` } : undefined,
  };
}

async function studentSchedule(ctx: StudentAiContext, parsed: ParsedMessage, courseFilter: Set<number> | null) {
  const overview = await ctx.overview();
  if (!overview.scheduleAccess.approved) {
    return blockReply([{
      type: "card",
      title: "Dərs cədvəliniz hələ açılmayıb",
      badge: { text: "gözləmədə", tone: "warn" },
      note: overview.scheduleAccess.onboardingRequired && overview.scheduleAccess.onboardingExamTitle
        ? `Əvvəlcə «${overview.scheduleAccess.onboardingExamTitle}» qəbul testini tamamlayın. Müəllim təsdiqləyəndən sonra cədvəliniz açılacaq.`
        : "Müəllim təsdiqləyən kimi cədvəliniz avtomatik açılacaq.",
    }], ["Profilim", "İmtahanlarım"]);
  }
  const lessons = (await ctx.lessons()).filter((lesson) => !courseFilter || courseFilter.has(lesson.courseId));
  if (!lessons.length) {
    return blockReply([{ type: "text", text: `${overview.termLabel} üçün dərs cədvəli hələ hazırlanmayıb. Hazır olanda burada görəcəksiniz.` }], ["Fənlərim", "Elanlar"]);
  }
  const weekday = detectWeekday(parsed);
  const today = bakuWeekday(0);
  const byTime = (left: AiLesson, right: AiLesson) => (left.lessonTime ?? "99").localeCompare(right.lessonTime ?? "99");
  if (weekday) {
    const dayLessons = lessons.filter((lesson) => lesson.lessonDays.includes(weekday.day)).sort(byTime);
    if (!dayLessons.length) {
      return blockReply([{ type: "text", text: `${weekday.label} dərsiniz yoxdur — istirahət edə bilərsiniz.` }], ["Dərs cədvəlim", "Tapşırıqlarım"]);
    }
    return blockReply([
      { type: "text", text: `${weekday.label} ${plural(dayLessons.length, "dərsiniz")} var:` },
      { type: "card", title: weekday.label, items: dayLessons.map((lesson) => lessonItem(lesson, weekday.day === today)), note: "Dərs linkləri «Resurslar» bölməsində də var." },
    ], ["Dərs cədvəlim", "Resurslar"]);
  }
  const blocks: AiBlock[] = [];
  let weeklyCount = 0;
  for (const day of WEEKDAY_ORDER) {
    const dayLessons = lessons.filter((lesson) => lesson.lessonDays.includes(day)).sort(byTime);
    if (!dayLessons.length) continue;
    weeklyCount += dayLessons.length;
    blocks.push({ type: "card", title: WEEKDAY_LABELS[day], badge: day === today ? { text: "bu gün", tone: "good" } : undefined, items: dayLessons.map((lesson) => lessonItem(lesson, day === today)) });
  }
  const unscheduled = lessons.filter((lesson) => !lesson.lessonDays.length);
  if (unscheduled.length) blocks.push({ type: "card", title: "Günü hələ bəlli olmayan dərslər", items: unscheduled.map((lesson) => lessonItem(lesson)) });
  return blockReply([
    { type: "text", text: weeklyCount ? `Bu həftə ${plural(weeklyCount, "dərsiniz")} var (${overview.termLabel}):` : `${overview.termLabel} üzrə dərsləriniz:` },
    ...blocks,
  ], ["Bu gün dərsim var?", "Resurslar", "Tapşırıqlarım"]);
}

async function studentResources(ctx: StudentAiContext, courseFilter: Set<number> | null) {
  const overview = await ctx.overview();
  if (!overview.scheduleAccess.approved) {
    return blockReply([{ type: "text", text: "Dərs materialları cədvəliniz təsdiqlənəndən sonra açılacaq." }], ["Profilim"]);
  }
  const lessons = (await ctx.lessons()).filter((lesson) => !courseFilter || courseFilter.has(lesson.courseId));
  if (!lessons.length) return blockReply([{ type: "text", text: "Hazırda sizə açıq material yoxdur." }], ["Dərs cədvəlim"]);
  return blockReply([
    { type: "text", text: `${overview.termLabel} üzrə ${plural(lessons.length, "material")} sizə açıqdır:` },
    {
      type: "card",
      title: "Dərs materialları",
      items: lessons.slice(0, 40).map((lesson) => ({
        title: lesson.courseTitle,
        detail: [lesson.title && lesson.title !== lesson.courseTitle ? lesson.title : null, snippet(lesson.body)].filter(Boolean).join(" — ") || undefined,
        meta: lesson.teacherName ? [lesson.teacherName] : undefined,
        action: lesson.url ? { label: "Linki aç", href: lesson.url } : undefined,
      })),
    },
  ], ["Dərs cədvəlim", "Tapşırıqlarım"]);
}

function submissionBadge(assignment: AiAssignment): AiItem["badge"] {
  const submission = assignment.submission;
  if (!submission) return assignment.status === "open" ? { text: "göndərilməyib", tone: "warn" } : { text: "vaxtı bitib", tone: "muted" };
  if (submission.status === "graded") return { text: `qiymət: ${submission.score ?? "—"}/${assignment.maxScore}`, tone: "good" };
  if (submission.status === "resubmission_requested") return { text: "yenidən göndərin", tone: "warn" };
  return { text: "yoxlanılır", tone: "default" };
}

async function studentAssignments(ctx: StudentAiContext, courseFilter: Set<number> | null, courseTitles: Map<number, string>) {
  const titleFilter = courseFilter ? new Set(Array.from(courseFilter).map((id) => courseTitles.get(id)).filter(Boolean)) : null;
  const assignments = (await ctx.assignments()).filter((assignment) => !titleFilter || titleFilter.has(assignment.courseTitle));
  if (!assignments.length) return blockReply([{ type: "text", text: "Hazırda sizə verilmiş ev tapşırığı yoxdur." }], ["İmtahanlarım", "Dərs cədvəlim"]);
  const open = assignments.filter((item) => item.status === "open").sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const closed = assignments.filter((item) => item.status !== "open").sort((a, b) => b.dueAt.getTime() - a.dueAt.getTime());
  const pending = open.filter((item) => !item.submission || item.submission.status === "resubmission_requested");
  const item = (assignment: AiAssignment): AiItem => ({
    title: assignment.title,
    detail: assignment.submission?.feedback ? `Müəllimin rəyi: ${snippet(assignment.submission.feedback, 120)}` : undefined,
    meta: [assignment.courseTitle, `son tarix: ${formatDateTime(assignment.dueAt)}`],
    badge: submissionBadge(assignment),
  });
  const intro = pending.length
    ? `Sizi ${plural(pending.length, "tapşırıq")} gözləyir. Cəmi ${plural(assignments.length, "tapşırığınız")} var.`
    : `Cəmi ${plural(assignments.length, "tapşırığınız")} var, gözləyən tapşırıq yoxdur — əla!`;
  return blockReply([
    { type: "text", text: intro },
    open.length ? { type: "card", title: "Açıq tapşırıqlar", items: open.map(item), note: pending.length ? "Göndərmək üçün kabinetdə «Ev tapşırıqları» bölməsini açın." : undefined } : null,
    closed.length ? { type: "card", title: "Bağlanmış tapşırıqlar", items: closed.slice(0, 30).map(item) } : null,
  ], ["İmtahanlarım", "Qiymətlərim"]);
}

async function studentExams(ctx: StudentAiContext, courseFilter: Set<number> | null, courseTitles: Map<number, string>) {
  const titleFilter = courseFilter ? new Set(Array.from(courseFilter).map((id) => courseTitles.get(id)).filter(Boolean)) : null;
  const exams = (await ctx.exams()).filter((exam) => !titleFilter || titleFilter.has(exam.courseTitle));
  if (!exams.length) return blockReply([{ type: "text", text: "Hazırda sizə açıq imtahan və ya test yoxdur." }], ["Tapşırıqlarım", "Qiymətlərim"]);
  const waiting = exams.filter((exam) => exam.status === "open" && !exam.result);
  return blockReply([
    { type: "text", text: waiting.length ? `Sizi ${plural(waiting.length, "test")} gözləyir. Kabinetdə «İmtahan və testlər» bölməsindən başlaya bilərsiniz.` : `${plural(exams.length, "test")} üzrə məlumatınız:` },
    {
      type: "card",
      title: "İmtahan və testlər",
      items: exams.slice(0, 40).map((exam) => ({
        title: exam.title,
        meta: [exam.courseTitle, exam.isOnboarding ? "qəbul testi" : null, exam.durationMinutes ? `${exam.durationMinutes} dəqiqə` : null].filter((part): part is string => Boolean(part)),
        badge: exam.result
          ? { text: `${exam.result.correctCount}/${exam.result.totalQuestions} düzgün (${exam.result.percentage}%)`, tone: "good" }
          : exam.status === "open" ? { text: "hələ verməmisiniz", tone: "warn" } : { text: "bağlanıb", tone: "muted" },
      })),
    },
  ], ["Tapşırıqlarım", "Qiymətlərim"]);
}

function gradeTable(semester: AiSemester, courseFilter: Set<number> | null): AiBlock {
  const subjects = semester.subjects.filter((subject) => !courseFilter || courseFilter.has(subject.courseId));
  if (!subjects.length) return { type: "card", title: semester.label, note: "Bu semestrdə fənn yoxdur." };
  return {
    type: "card",
    title: semester.label,
    badge: { text: `orta bal: ${formatGrade(semester.gpa)}`, tone: semester.gpa === null ? "muted" : "good" },
    items: subjects.map((subject) => {
      const components = subject.gradingComponents.filter((component) => component.score !== null);
      return {
        title: subject.title,
        detail: components.length ? components.map((component) => `${component.name}: ${component.score}`).join(", ") : undefined,
        badge: { text: subject.grade === null ? "hələ qiymət yoxdur" : String(formatGrade(subject.grade)), tone: subject.grade === null ? "muted" : "default" },
      };
    }),
  };
}

async function studentGrades(ctx: StudentAiContext, parsed: ParsedMessage, courseFilter: Set<number> | null) {
  const semesters = await ctx.semesters();
  if (!semesters.length) return blockReply([{ type: "text", text: "Hələ qiymətiniz yoxdur. Müəllimlər qiymət yazan kimi burada görünəcək." }], ["Fənlərim"]);
  const requestedTerm = detectTermNumber(parsed);
  const selected = requestedTerm ? semesters.filter((item) => item.termNumber === requestedTerm) : [...semesters].reverse();
  if (!selected.length) return blockReply([{ type: "text", text: `${requestedTerm}-ci semestrin məlumatları sizə hələ açılmayıb.` }], ["Qiymətlərim"]);
  return blockReply([
    { type: "text", text: "Qiymətləriniz (5 ballıq şkala ilə):" },
    ...selected.map((semester) => gradeTable(semester, courseFilter)),
  ], ["Davamiyyətim", "Tapşırıqlarım"]);
}

async function studentAttendance(ctx: StudentAiContext, parsed: ParsedMessage, courseFilter: Set<number> | null) {
  const semesters = await ctx.semesters();
  if (!semesters.length) return blockReply([{ type: "text", text: "Davamiyyət məlumatınız hələ yoxdur." }], ["Qiymətlərim"]);
  const requestedTerm = detectTermNumber(parsed);
  const selected = requestedTerm ? semesters.filter((item) => item.termNumber === requestedTerm) : semesters.slice(-1);
  if (!selected.length) return blockReply([{ type: "text", text: `${requestedTerm}-ci semestrin məlumatları sizə hələ açılmayıb.` }], ["Davamiyyətim"]);
  const blocks: AiBlock[] = [];
  for (const semester of selected) {
    const subjects = semester.subjects.filter((item) => !courseFilter || courseFilter.has(item.courseId));
    const total = subjects.reduce((sum, subject) => sum + subject.absenceCount, 0);
    blocks.push({ type: "text", text: total ? `${semester.label} ərzində ${plural(total, "dərs")} buraxmısınız.` : `${semester.label} ərzində heç bir dərs buraxmamısınız — əla!` });
    blocks.push({
      type: "card",
      title: semester.label,
      badge: semester.absencePercent === null ? undefined : { text: `qayıb: ${semester.absencePercent}%`, tone: semester.absencePercent >= 20 ? "warn" : "good" },
      items: subjects.map((subject) => ({
        title: subject.title,
        badge: { text: subject.absenceCount ? `${subject.absenceCount} qayıb${subject.absencePercent === null ? "" : ` (${subject.absencePercent}%)`}` : "qayıb yoxdur", tone: subject.absenceCount ? "warn" : "good" },
      })),
    });
    const records = semester.attendanceRecords.filter((record) => record.status !== "present").slice(0, 20);
    if (records.length) {
      blocks.push({
        type: "card",
        title: "Son qeydlər",
        items: records.map((record) => ({ title: record.courseTitle, meta: [formatDate(record.attendanceDate)], badge: { text: ATTENDANCE_STATUS[record.status] ?? "qeyd olunub", tone: record.status === "excused" ? "muted" : "warn" } })),
      });
    }
  }
  blocks.push({ type: "text", text: "Üzrlü səbəbiniz varsa, kabinetdə «Davamiyyətə görə üzr» düyməsi ilə bildirə bilərsiniz.", tone: "muted" });
  return blockReply(blocks, ["Qiymətlərim", "Dərs cədvəlim"]);
}

async function studentCourses(ctx: StudentAiContext) {
  const [overview, semesters, lessons] = await Promise.all([ctx.overview(), ctx.semesters(), ctx.overview().then((item) => item.scheduleAccess.approved ? ctx.lessons() : [])]);
  const current = semesters.find((item) => item.termNumber === overview.currentTermNumber) ?? semesters[semesters.length - 1];
  if (!current || !current.subjects.length) return blockReply([{ type: "text", text: `${overview.termLabel} üçün fənn siyahısı hələ hazır deyil.` }], ["Profilim"]);
  return blockReply([
    { type: "text", text: `${current.label} ${plural(current.subjects.length, "fənniniz")} var:` },
    {
      type: "card",
      title: current.label,
      items: current.subjects.map((subject) => {
        const subjectLessons = lessons.filter((lesson) => lesson.courseId === subject.courseId);
        const days = Array.from(new Set(subjectLessons.flatMap((lesson) => lesson.lessonDays)));
        const time = subjectLessons.find((lesson) => lesson.lessonTime)?.lessonTime;
        return {
          title: subject.title,
          detail: subject.instructor ? `Müəllim: ${subject.instructor}` : "Müəllim hələ təyin olunmayıb",
          meta: [days.length ? `${lessonDaysLabel(days)}${time ? `, saat ${time}` : ""}` : null, subject.credits ? `${subject.credits} kredit` : null].filter((part): part is string => Boolean(part)),
          badge: subject.isMandatory ? undefined : { text: "seçmə", tone: "muted" as const },
        };
      }),
    },
  ], ["Dərs cədvəlim", "Qiymətlərim"]);
}

async function studentProfile(ctx: StudentAiContext) {
  const [overview, semesters] = await Promise.all([ctx.overview(), ctx.semesters()]);
  const current = semesters.find((item) => item.termNumber === overview.currentTermNumber);
  return blockReply([
    {
      type: "card",
      title: `${overview.firstName} ${overview.lastName}`,
      subtitle: `Tələbə nömrəsi: ${studentCode(overview.studentNumber)}`,
      rows: [
        { label: "Semestr", value: overview.termLabel },
        overview.program ? { label: "Proqram", value: overview.program } : null,
        { label: "Dərs cədvəli", value: overview.scheduleAccess.approved ? "açıqdır" : overview.scheduleAccess.onboardingRequired ? "qəbul testindən sonra açılacaq" : "müəllim təsdiqini gözləyir" },
        current ? { label: "Orta bal", value: formatGrade(current.gpa) } : null,
        current ? { label: "Fənlər", value: String(current.subjects.length) } : null,
      ].filter((row): row is AiRow => Boolean(row)),
      note: "Məlumatlarınızı dəyişmək üçün kabinetdə «Məlumatlarımı düzəlt» bölməsini açın.",
    },
  ], ["Fənlərim", "Qiymətlərim"]);
}

async function studentNotices(ctx: StudentAiContext) {
  const { announcements, notifications } = await ctx.notices();
  if (!announcements.length && !notifications.length) return blockReply([{ type: "text", text: "Hazırda yeni elan və ya bildiriş yoxdur." }], STUDENT_SUGGESTIONS);
  const item = (notice: { title: string; body: string; date: string | null }): AiItem => ({ title: notice.title, detail: snippet(notice.body, 200) || undefined, meta: notice.date ? [formatDate(notice.date)] : undefined });
  return blockReply([
    notifications.length ? { type: "card", title: "Sizə aid bildirişlər", items: notifications.slice(0, 20).map(item) } : null,
    announcements.length ? { type: "card", title: "Son elanlar", items: announcements.slice(0, 20).map(item) } : null,
  ], ["Dərs cədvəlim", "Tapşırıqlarım"]);
}

async function studentCourseFocus(ctx: StudentAiContext, courseIds: Set<number>) {
  const [overview, semesters] = await Promise.all([ctx.overview(), ctx.semesters()]);
  const lessons = overview.scheduleAccess.approved ? await ctx.lessons() : [];
  const blocks: AiBlock[] = [];
  for (const courseId of courseIds) {
    const subject = [...semesters].reverse().flatMap((item) => item.subjects).find((item) => item.courseId === courseId);
    const courseLessons = lessons.filter((lesson) => lesson.courseId === courseId);
    const title = subject?.title ?? courseLessons[0]?.courseTitle;
    if (!title) continue;
    const rows: AiRow[] = [];
    if (subject) {
      rows.push({ label: "Müəllim", value: subject.instructor || "hələ təyin olunmayıb" });
      rows.push({ label: "Qiymət", value: formatGrade(subject.grade) });
      rows.push({ label: "Qayıb", value: subject.absenceCount ? String(subject.absenceCount) : "yoxdur" });
    }
    let action: AiItem["action"];
    if (courseLessons.length) {
      const days = Array.from(new Set(courseLessons.flatMap((lesson) => lesson.lessonDays)));
      const time = courseLessons.find((lesson) => lesson.lessonTime)?.lessonTime;
      rows.push({ label: "Dərs günləri", value: `${lessonDaysLabel(days)}${time ? `, saat ${time}` : ""}` });
      const link = courseLessons.find((lesson) => lesson.url)?.url;
      if (link) action = { label: "Dərs linkini aç", href: link };
    }
    blocks.push({ type: "card", title, rows, items: action ? [{ title: "Dərs linki", action }] : undefined });
  }
  if (!blocks.length) return null;
  return blockReply(blocks, ["Tapşırıqlarım", "Qiymətlərim"]);
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
      "Bağışlayın, başqa tələbələrin məlumatları məxfidir. Mən yalnız sizin öz dərsləriniz və nəticələriniz barədə danışa bilərəm.",
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
  return blockReply([
    { type: "text", text: "Bağışlayın, sualınızı tam başa düşmədim. Bir az başqa cür yaza bilərsiniz?" },
    {
      type: "card",
      title: "Bunlarda kömək edə bilərəm",
      items: [
        { title: "Dərslər", detail: "dərs cədvəli, fənlər, materiallar" },
        { title: "Nəticələr", detail: "qiymətlər, testlər, davamiyyət" },
        { title: "Tapşırıqlar", detail: "açıq tapşırıqlar və son tarixlər" },
        { title: "Saytdan istifadə", detail: guideTopicList("student").slice(0, 5).join(", ") },
      ],
      note: "Dini və ya elmi suallarınızı kabinetdəki «Sual-cavab» bölməsində müəllimlərə yaza bilərsiniz.",
    },
  ], STUDENT_SUGGESTIONS);
}

function mergeReplies(replies: AiReply[]): AiReply {
  if (replies.length === 1) return replies[0];
  return {
    reply: replies.map((item) => item.reply).join("\n\n— — —\n\n"),
    suggestions: Array.from(new Set(replies.flatMap((item) => item.suggestions))).slice(0, 4),
    blocks: replies.flatMap((item) => ensureBlocks(item).blocks),
  };
}

// ---------------------------------------------------------------------------
// Provayder
// ---------------------------------------------------------------------------

export const internalAiProvider: AiProvider = {
  name: "internal",
  async answer(input: { message: string; history: AiChatTurn[] }, context: AiContext): Promise<AiReply> {
    const parsed = parse(input.message, context.mode === "admin");
    // Hər daxili cavab kart blokları ilə qaytarılır (əl ilə qurulmayıbsa, mətndən çevrilir).
    return ensureBlocks(context.mode === "student" ? await answerStudent(parsed, context) : await answerAdmin(parsed, context));
  },
};
