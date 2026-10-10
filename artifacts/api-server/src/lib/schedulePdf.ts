// Həftəlik dərs cədvəli — A5 (148 × 210 mm, portret) PDF.
// Sertifikat PDF-i ilə eyni yanaşma: pdfkit + repo-dakı DejaVu şriftləri (Azərbaycan hərfləri) +
// certificateBidi.ts (ərəb mətni üçün sətir/vizual sıralama, mötərizələrin güzgülənməsi).
// Bu modul bazadan asılı deyil — məlumatı route hazırlayır, testlər birbaşa yoxlayır.
import fs from "node:fs";
import PDFDocument from "pdfkit";
import { findAssetPath, readAsset } from "./assets.js";
import { paragraphIsRtl, visualRuns } from "./certificateBidi.js";

/** A5 ölçüsü PDF punktlarında (1 mm = 72 / 25.4 pt). */
export const A5_WIDTH_PT = (148 / 25.4) * 72; // 419.53
export const A5_HEIGHT_PT = (210 / 25.4) * 72; // 595.28

export const SCHEDULE_ACADEMY_NAME = "Mədinə Tədris Akademiyası";
export const SCHEDULE_TIME_ZONE = "Asia/Baku";

export const SCHEDULE_DAYS = [
  ["monday", "Bazar ertəsi"],
  ["tuesday", "Çərşənbə axşamı"],
  ["wednesday", "Çərşənbə"],
  ["thursday", "Cümə axşamı"],
  ["friday", "Cümə"],
  ["saturday", "Şənbə"],
  ["sunday", "Bazar"],
] as const;

export type ScheduleDayKey = (typeof SCHEDULE_DAYS)[number][0];

const navy = "#173b51";
const muted = "#64747b";
const gold = "#d6b467";
const goldText = "#9e782a";
const softGold = "#fbf4e2";
const line = "#e3ddcc";
const paper = "#ffffff";

function systemFont(candidates: string[]) {
  return candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
}

export const scheduleFonts = {
  regular:
    findAssetPath("fonts/DejaVuSans.ttf") ??
    systemFont(["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"]),
  bold:
    findAssetPath("fonts/DejaVuSans-Bold.ttf") ??
    systemFont(["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]),
  serif:
    findAssetPath("fonts/DejaVuSerif.ttf") ??
    systemFont(["/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"]),
};

// ---------------------------------------------------------------------------
// Məlumat modeli
// ---------------------------------------------------------------------------

export interface ScheduleLessonInput {
  courseId: number;
  subject: string;
  lessonDays: readonly string[];
  /** "HH:MM" və ya gün → saat JSON xəritəsi ({"monday":"18:00"}), Bakı vaxtı ilə. */
  lessonTime: string | null;
  teacher: string | null;
  /** «Kitab — fəsil (s. 12–20)» kimi hazır sətirlər. */
  books: readonly string[];
  /** Müəllim cədvəlində fərqli semestrlər qarışıq ola bilər. */
  termLabel?: string | null;
}

export interface ScheduleLessonRow {
  subject: string;
  time: string | null;
  teacher: string | null;
  books: string[];
  termLabel: string | null;
}

export interface ScheduleDay {
  day: ScheduleDayKey;
  label: string;
  lessons: ScheduleLessonRow[];
}

/** Gün üzrə dərs saatı (Bakı vaxtı) — saytdakı timeForLessonDay ilə eyni qayda. */
export function lessonTimeForDay(lessonTime: string | null | undefined, day: string) {
  if (!lessonTime) return null;
  const value = lessonTime.trim();
  if (value.startsWith("{")) {
    try {
      const map = JSON.parse(value) as Record<string, unknown>;
      const time = map[day];
      return typeof time === "string" && /^\d{2}:\d{2}$/.test(time) ? time : null;
    } catch {
      return null;
    }
  }
  return /^\d{2}:\d{2}$/.test(value) ? value : null;
}

export function meetingPlatformName(url: string | null | undefined) {
  if (!url) return null;
  if (/zoom/i.test(url)) return "Zoom";
  if (/meet\.google/i.test(url)) return "Google Meet";
  if (/teams\.microsoft|teams\.live/i.test(url)) return "Microsoft Teams";
  return null;
}

/** Dərs kitabı sətri: «Qısa ad» — fəsil (s. 55–56) · qeyd. Hər sahə öz istiqaməti ilə izolə olunur (ərəb mötərizələri qarışmır). */
export function formatScheduleBook(book: { bookShortTitle: string; chapterTitle?: string | null; printedFrom?: number | null; printedTo?: number | null; note?: string | null }) {
  const from = book.printedFrom ?? null;
  const to = book.printedTo ?? null;
  const range = from !== null ? (to !== null && to !== from ? `s. ${from}–${to}` : `s. ${from}`) : null;
  return [
    `«${isolate(book.bookShortTitle.trim() || "Kitab")}»`,
    book.chapterTitle?.trim() ? `— ${isolate(book.chapterTitle.trim())}` : null,
    range ? `(${range})` : null,
    book.note?.trim() ? `· ${isolate(book.note.trim())}` : null,
  ].filter(Boolean).join(" ");
}

/** Bazar ertəsindən Bazara qədər 7 gün; hər günün dərsləri saata görə sıralanır. */
export function buildWeeklySchedule(lessons: readonly ScheduleLessonInput[]): ScheduleDay[] {
  return SCHEDULE_DAYS.map(([day, label]) => ({
    day,
    label,
    lessons: lessons
      .filter((lesson) => lesson.lessonDays.includes(day))
      .map((lesson) => ({
        subject: lesson.subject.trim() || "Dərs",
        time: lessonTimeForDay(lesson.lessonTime, day),
        teacher: lesson.teacher?.trim() || null,
        books: lesson.books.map((book) => book.trim()).filter(Boolean),
        termLabel: lesson.termLabel ?? null,
      }))
      .sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || a.subject.localeCompare(b.subject, "az")),
  }));
}

export function formatScheduleGeneratedAt(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHEDULE_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")}, ${get("hour")}:${get("minute")}`;
}

/** Fayl adı üçün ASCII (Content-Disposition). */
export function scheduleFileName(prefix: string, name: string) {
  const map: Record<string, string> = { ə: "e", Ə: "E", ğ: "g", Ğ: "G", ı: "i", İ: "I", ş: "s", Ş: "S", ç: "c", Ç: "C", ö: "o", Ö: "O", ü: "u", Ü: "U" };
  const ascii = Array.from(name).map((ch) => map[ch] ?? ch).join("")
    .normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${prefix}${ascii ? `-${ascii}` : ""}.pdf`;
}

// ---------------------------------------------------------------------------
// Mətn (bidi) çəkmə köməkçiləri
// ---------------------------------------------------------------------------

type Doc = PDFKit.PDFDocument;
/** pdfkit-in openImage() nəticəsi (tiplərdə elan edilməyib); document.image() onu Buffer kimi qəbul edir. */
type LogoImage = { readonly __pdfkitImage: unique symbol };
type Run = { draw: string; font?: string; width: number };
type Line = { text: string; baseRtl: boolean; runs: Run[]; width: number };

function setFont(document: Doc, font?: string) {
  if (font) document.font(font);
}

const FSI = "\u2068";
const PDI = "\u2069";

/** Sahəni öz istiqaməti ilə ayrıca yerləşdirmək üçün (Unicode First Strong Isolate). */
export function isolate(value: string) {
  return `${FSI}${value.replace(/[\u2068\u2069]/g, "")}${PDI}`;
}

function stripMarks(value: string) {
  return value.replace(/[\u2068\u2069]/g, "");
}

/** Birinci güclü istiqamətli hərfə görə (FSI…PDI izolyatları nəzərə alınmadan) sətrin əsas istiqaməti. */
export function baseDirectionIsRtl(text: string) {
  const outside = text.replace(/\u2068[^\u2068\u2069]*(?:\u2069|$)/g, " ");
  return /\p{L}/u.test(outside) ? paragraphIsRtl(outside) : paragraphIsRtl(stripMarks(text));
}

function segmentsOf(text: string) {
  return text.split(/(\u2068[^\u2068\u2069]*(?:\u2069|$))/).filter(Boolean).map((part) => ({
    text: stripMarks(part),
    isolated: part.startsWith(FSI),
  })).filter((part) => part.text.length > 0);
}

function layoutLine(document: Doc, text: string, baseRtl: boolean, size: number, font?: string): Line {
  const segments = segmentsOf(text);
  const ordered = baseRtl ? [...segments].reverse() : segments;
  const runs = ordered.flatMap((segment) => visualRuns(segment.text, segment.isolated ? paragraphIsRtl(segment.text) : baseRtl)).map((run) => {
    // Ərəb hərfləri yalnız DejaVu Sans (adi) ilə çəkilir — Bold/Serif-də ərəb qlifləri tam deyil.
    const runFont = run.rtlScript && scheduleFonts.regular ? scheduleFonts.regular : font;
    setFont(document, runFont);
    document.fontSize(size);
    return { draw: run.draw, font: runFont, width: document.widthOfString(run.draw) };
  });
  return { text, baseRtl, runs, width: runs.reduce((sum, run) => sum + run.width, 0) };
}

function openIsolate(value: string) {
  let open = false;
  for (const ch of value) {
    if (ch === FSI) open = true;
    else if (ch === PDI) open = false;
  }
  return open;
}

function wrapText(document: Doc, text: string, size: number, font: string | undefined, width: number) {
  const lines: Line[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const baseRtl = baseDirectionIsRtl(paragraph);
    const words = paragraph.split(/[ \t]+/).filter(Boolean);
    let current = "";
    const push = (value: string) => lines.push(layoutLine(document, value, baseRtl, size, font));
    // İzolyat sətir sonunda bağlanmayıbsa, növbəti sətir də izolyat kimi davam edir.
    const carry = (value: string) => (openIsolate(value) ? FSI : "");
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (layoutLine(document, candidate, baseRtl, size, font).width <= width) {
        current = candidate;
        continue;
      }
      if (current && stripMarks(current).trim()) {
        push(current);
        current = `${carry(current)}${word}`;
      } else {
        current = `${current}${current ? " " : ""}${word}`;
      }
      while (layoutLine(document, current, baseRtl, size, font).width > width && Array.from(stripMarks(current)).length > 1) {
        const chars = Array.from(current);
        let cut = chars.length - 1;
        while (cut > 1 && layoutLine(document, chars.slice(0, cut).join(""), baseRtl, size, font).width > width) cut--;
        const head = chars.slice(0, cut).join("");
        push(head);
        current = `${carry(head)}${chars.slice(cut).join("")}`;
      }
    }
    if (stripMarks(current).trim()) push(current);
  }
  return lines;
}

function lineHeight(document: Doc, size: number, font?: string) {
  setFont(document, font);
  return document.fontSize(size).currentLineHeight(true);
}

type TextOptions = { size: number; font?: string; width: number; color?: string; lineGap?: number; maxLines?: number; align?: "start" | "left" | "center" | "right" };

function fitLines(document: Doc, text: string, options: TextOptions) {
  const { size, font, width, maxLines } = options;
  let lines = wrapText(document, text, size, font, width);
  if (maxLines && lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[kept.length - 1];
    let words = last.text.split(" ").filter(Boolean);
    const ellipsis = (value: string[]) => `${value.join(" ")}${openIsolate(value.join(" ")) ? PDI : ""} …`;
    let candidate = layoutLine(document, ellipsis(words), last.baseRtl, size, font);
    while (words.length > 1 && candidate.width > width) {
      words = words.slice(0, -1);
      candidate = layoutLine(document, ellipsis(words), last.baseRtl, size, font);
    }
    kept[kept.length - 1] = candidate;
    lines = kept;
  }
  return lines;
}

function measureText(document: Doc, text: string, options: TextOptions) {
  if (!text.trim()) return 0;
  const lines = fitLines(document, text, options);
  return lines.length * (lineHeight(document, options.size, options.font) + (options.lineGap ?? 1));
}

/** Mətni (ərəb daxil) blokda çəkir: LTR sətirlər sola, RTL sətirlər sağa düzlənir. Hündürlüyü qaytarır. */
function drawText(document: Doc, text: string, x: number, y: number, options: TextOptions) {
  if (!text.trim()) return 0;
  const { size, width, color = navy, lineGap = 1, align = "start" } = options;
  const lines = fitLines(document, text, options);
  const height = lineHeight(document, size, options.font);
  document.fillColor(color);
  lines.forEach((entry, index) => {
    const free = Math.max(0, width - entry.width);
    let cursor = align === "center" ? x + free / 2 : align === "right" || (align === "start" && entry.baseRtl) ? x + free : x;
    const lineY = y + index * (height + lineGap);
    for (const run of entry.runs) {
      setFont(document, run.font);
      document.fontSize(size).text(run.draw, cursor, lineY, { lineBreak: false });
      cursor += run.width;
    }
  });
  return lines.length * (height + lineGap);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export interface SchedulePdfInput {
  /** Başlıq, məs. «Həftəlik dərs cədvəli». */
  title: string;
  /** «Tələbə» və ya «Müəllim». */
  personLabel: string;
  personName: string;
  /** Tələbə nömrəsi (T0012); müəllim üçün null. */
  personNumber: string | null;
  semesterLabel: string;
  generatedAt: Date;
  days: ScheduleDay[];
  /** Hər dərsin yanında semestri göstər (müəllim cədvəli bir neçə semestri birləşdirir). */
  showTermOnLessons?: boolean;
}

const margin = 26;
const contentWidth = A5_WIDTH_PT - margin * 2;
const footerReserve = 30;
const timeColumn = 52;

export function buildSchedulePdf(input: SchedulePdfInput): Promise<Buffer> {
  const document = new PDFDocument({
    // Dəqiq A5: 148 × 210 mm (portret — 7 günlük siyahı hündürlüyə daha yaxşı sığır).
    size: [A5_WIDTH_PT, A5_HEIGHT_PT],
    margin: 0,
    autoFirstPage: true,
    bufferPages: true,
    info: {
      Title: `${input.title} — ${input.personName}`,
      Author: SCHEDULE_ACADEMY_NAME,
      Subject: `${input.semesterLabel} · ${input.title}`,
      Creator: SCHEDULE_ACADEMY_NAME,
    },
  });
  const logoBytes = readAsset("medine-logo-email.png");
  // Loqo bir dəfə açılır və hər səhifədə eyni obyekt istifadə olunur (fayl ölçüsü kiçik qalır).
  const logo = logoBytes ? (document as unknown as { openImage(src: Buffer): LogoImage }).openImage(logoBytes) : null;
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    try {
      render(document, input, logo);
      document.end();
    } catch (error) {
      reject(error);
    }
  });
}

function drawPageFrame(document: Doc) {
  document.rect(0, 0, A5_WIDTH_PT, A5_HEIGHT_PT).fill(paper);
  document.rect(0, 0, A5_WIDTH_PT, 5).fill(gold);
}

function drawHeader(document: Doc, input: SchedulePdfInput, logo: LogoImage | null, compact: boolean) {
  const top = 18;
  const logoWidth = compact ? 92 : 118;
  const logoHeight = logoWidth * (245 / 960);
  if (logo) document.image(logo as unknown as Buffer, margin, top, { width: logoWidth, height: logoHeight });
  else drawText(document, SCHEDULE_ACADEMY_NAME, margin, top + 6, { size: 11, font: scheduleFonts.serif, width: 170 });
  const rightWidth = contentWidth - logoWidth - 10;
  const rightX = margin + logoWidth + 10;
  drawText(document, input.title.toLocaleUpperCase("az"), rightX, top + (compact ? 2 : 5), { size: compact ? 8.5 : 10.5, font: scheduleFonts.bold, width: rightWidth, align: "right", maxLines: 1 });
  drawText(document, SCHEDULE_ACADEMY_NAME, rightX, top + (compact ? 13 : 19), { size: 7.2, font: scheduleFonts.regular, width: rightWidth, color: muted, align: "right", maxLines: 1 });
  const bottom = top + logoHeight + 8;
  document.lineWidth(1).strokeColor(gold).moveTo(margin, bottom).lineTo(margin + contentWidth, bottom).stroke();
  return bottom + 8;
}

function drawInfoBox(document: Doc, input: SchedulePdfInput, y: number) {
  const items = [
    { label: input.personLabel, value: input.personName },
    ...(input.personNumber ? [{ label: "Nömrə", value: input.personNumber }] : []),
    { label: "Semestr", value: input.semesterLabel },
    { label: "Hazırlanma tarixi", value: formatScheduleGeneratedAt(input.generatedAt) },
  ];
  const padding = 8;
  const columns = 2;
  const columnGap = 10;
  const columnWidth = (contentWidth - padding * 2 - columnGap) / columns;
  const rows: Array<typeof items> = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  const rowHeights = rows.map((row) => Math.max(...row.map((item) => 9 + measureText(document, item.value, { size: 8.6, font: scheduleFonts.bold, width: columnWidth, maxLines: 2 }))));
  const height = padding * 2 + rowHeights.reduce((sum, value) => sum + value, 0) + (rows.length - 1) * 5;
  document.roundedRect(margin, y, contentWidth, height, 6).fill(softGold);
  let rowY = y + padding;
  rows.forEach((row, rowIndex) => {
    row.forEach((item, index) => {
      const x = margin + padding + index * (columnWidth + columnGap);
      drawText(document, item.label.toLocaleUpperCase("az"), x, rowY, { size: 5.8, font: scheduleFonts.bold, width: columnWidth, color: goldText, maxLines: 1 });
      drawText(document, item.value, x, rowY + 8.5, { size: 8.6, font: scheduleFonts.bold, width: columnWidth, maxLines: 2 });
    });
    rowY += rowHeights[rowIndex] + 5;
  });
  return y + height + 10;
}

function lessonParts(lesson: ScheduleLessonRow, showTerm: boolean) {
  const textWidth = contentWidth - timeColumn - 10;
  const meta = [lesson.teacher ? `${lesson.teacher.includes(", ") ? "Müəllimlər" : "Müəllim"}: ${isolate(lesson.teacher)}` : "Müəllim təyin edilməyib", showTerm && lesson.termLabel ? lesson.termLabel : null]
    .filter(Boolean).join(" · ");
  return { textWidth, meta };
}

function measureLesson(document: Doc, lesson: ScheduleLessonRow, showTerm: boolean) {
  const { textWidth, meta } = lessonParts(lesson, showTerm);
  let height = measureText(document, lesson.subject, { size: 8.8, font: scheduleFonts.bold, width: textWidth, maxLines: 2 });
  height += 1 + measureText(document, meta, { size: 6.8, font: scheduleFonts.regular, width: textWidth, maxLines: 2 });
  for (const book of lesson.books) height += 1.5 + measureText(document, `Kitab: ${book}`, { size: 6.8, font: scheduleFonts.regular, width: textWidth, maxLines: 3 });
  return Math.max(height, 14) + 9;
}

function drawLesson(document: Doc, lesson: ScheduleLessonRow, y: number, showTerm: boolean, last: boolean) {
  const { textWidth, meta } = lessonParts(lesson, showTerm);
  const height = measureLesson(document, lesson, showTerm);
  const timeX = margin + 6;
  document.roundedRect(timeX, y + 4, timeColumn - 8, 14, 3).fill(lesson.time ? navy : "#eef0f1");
  drawText(document, lesson.time ?? "—", timeX, y + 6.6, { size: 8, font: scheduleFonts.bold, width: timeColumn - 8, color: lesson.time ? "#ffffff" : muted, align: "center", maxLines: 1 });
  const textX = margin + timeColumn + 4;
  let cursor = y + 4.5;
  cursor += drawText(document, lesson.subject, textX, cursor, { size: 8.8, font: scheduleFonts.bold, width: textWidth, maxLines: 2, align: "left" });
  cursor += 1;
  cursor += drawText(document, meta, textX, cursor, { size: 6.8, font: scheduleFonts.regular, width: textWidth, color: muted, maxLines: 2, align: "left" });
  for (const book of lesson.books) {
    cursor += 1.5;
    cursor += drawText(document, `Kitab: ${book}`, textX, cursor, { size: 6.8, font: scheduleFonts.regular, width: textWidth, color: goldText, maxLines: 3, align: "left" });
  }
  if (!last) {
    document.lineWidth(0.5).strokeColor(line).moveTo(textX, y + height).lineTo(margin + contentWidth - 6, y + height).stroke();
  }
  return height;
}

function dayBlockHeight(document: Doc, day: ScheduleDay, showTerm: boolean) {
  const header = 17;
  if (!day.lessons.length) return header + 3;
  return header + day.lessons.reduce((sum, lesson) => sum + measureLesson(document, lesson, showTerm), 0) + 2;
}

function drawFooter(document: Doc, page: number, total: number) {
  const y = A5_HEIGHT_PT - 20;
  document.lineWidth(0.5).strokeColor(line).moveTo(margin, y - 5).lineTo(margin + contentWidth, y - 5).stroke();
  drawText(document, `Saatlar Bakı vaxtı ilə (UTC+4) göstərilib · ${SCHEDULE_ACADEMY_NAME} · madinahacademy.net`, margin, y, { size: 5.6, font: scheduleFonts.regular, width: contentWidth - 40, color: muted, maxLines: 1 });
  drawText(document, `${page}/${total}`, margin + contentWidth - 40, y, { size: 5.6, font: scheduleFonts.regular, width: 40, color: muted, align: "right", maxLines: 1 });
}

function render(document: Doc, input: SchedulePdfInput, logo: LogoImage | null) {
  const showTerm = Boolean(input.showTermOnLessons);
  const pageBottom = A5_HEIGHT_PT - footerReserve;
  drawPageFrame(document);
  let y = drawHeader(document, input, logo, false);
  y = drawInfoBox(document, input, y);
  let pages = 1;

  const newPage = () => {
    document.addPage({ size: [A5_WIDTH_PT, A5_HEIGHT_PT], margin: 0 });
    pages += 1;
    drawPageFrame(document);
    y = drawHeader(document, input, logo, true);
  };

  for (const day of input.days) {
    const blockHeight = dayBlockHeight(document, day, showTerm);
    // Gün bloku bütöv şəkildə sığmırsa (və boş səhifə deyilsə) yeni A5 səhifəsinə keçir.
    if (y + Math.min(blockHeight, 17 + 40) > pageBottom) newPage();
    const count = day.lessons.length;
    document.roundedRect(margin, y, contentWidth, 15, 4).fill(count ? navy : "#eef0f1");
    drawText(document, day.label, margin + 8, y + 3.6, { size: 8, font: scheduleFonts.bold, width: contentWidth / 2, color: count ? "#ffffff" : navy, maxLines: 1 });
    drawText(document, count ? `${count} dərs` : "Dərs yoxdur", margin + contentWidth / 2, y + 3.9, { size: 6.8, font: scheduleFonts.regular, width: contentWidth / 2 - 8, color: count ? gold : muted, align: "right", maxLines: 1 });
    y += 17;
    if (!count) {
      y += 3;
      continue;
    }
    day.lessons.forEach((lesson, index) => {
      const height = measureLesson(document, lesson, showTerm);
      if (y + height > pageBottom) {
        newPage();
        document.roundedRect(margin, y, contentWidth, 15, 4).fill(navy);
        drawText(document, `${day.label} (davamı)`, margin + 8, y + 3.6, { size: 8, font: scheduleFonts.bold, width: contentWidth - 16, color: "#ffffff", maxLines: 1 });
        y += 17;
      }
      drawLesson(document, lesson, y, showTerm, index === count - 1);
      y += height;
    });
    y += 4;
  }

  // Altlıq hər səhifəyə səhifə sayı məlum olduqdan sonra yazılır.
  const range = document.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    drawFooter(document, index - range.start + 1, pages);
  }
}

