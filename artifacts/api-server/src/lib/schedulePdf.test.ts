import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import {
  A5_HEIGHT_PT,
  A5_WIDTH_PT,
  SCHEDULE_ACADEMY_NAME,
  baseDirectionIsRtl,
  buildSchedulePdf,
  buildWeeklySchedule,
  formatScheduleBook,
  formatScheduleGeneratedAt,
  isolate,
  lessonTimeForDay,
  meetingPlatformName,
  scheduleFileName,
  scheduleFonts,
  type ScheduleLessonInput,
} from "./schedulePdf.js";

const lessons: ScheduleLessonInput[] = [
  { courseId: 1, subject: "Fiqh", lessonDays: ["monday", "thursday"], lessonTime: JSON.stringify({ monday: "18:00", thursday: "19:30" }), teacher: "Ustad Əli Şükürov", books: [formatScheduleBook({ bookShortTitle: "Şərhu Mənhəcis-Salikin", chapterTitle: "باب نواقض الوضوء", printedFrom: 55, printedTo: 56 })] },
  { courseId: 2, subject: "Ərəb dili (النحو)", lessonDays: ["monday"], lessonTime: "08:30", teacher: "Ustad Ömər", books: [] },
  { courseId: 3, subject: "العقيدة الطحاوية (شرح)", lessonDays: ["saturday"], lessonTime: "10:00", teacher: null, books: [] },
];

function mediaBoxes(pdf: Buffer) {
  return Array.from(pdf.toString("latin1").matchAll(/\/MediaBox \[([^\]]+)\]/g)).map((match) => match[1].trim().split(/\s+/).map(Number));
}

function inflatedStreams(pdf: Buffer) {
  const text = pdf.toString("latin1");
  const out: string[] = [];
  for (const match of text.matchAll(/stream\r?\n/g)) {
    const start = match.index! + match[0].length;
    const end = text.indexOf("endstream", start);
    try {
      out.push(zlib.inflateSync(pdf.subarray(start, end)).toString("latin1"));
    } catch {
      // sıxılmamış və ya şrift axını
    }
  }
  return out.join("\n");
}

async function samplePdf(extra: Partial<Parameters<typeof buildSchedulePdf>[0]> = {}) {
  return buildSchedulePdf({
    title: "Həftəlik dərs cədvəli",
    personLabel: "Tələbə",
    personName: "Gözəl Çiçək Ağayeva Şükürlü",
    personNumber: "T0012",
    semesterLabel: "1-ci Semestr",
    generatedAt: new Date("2026-10-09T22:40:00Z"),
    days: buildWeeklySchedule(lessons),
    ...extra,
  });
}

test("A5 ölçüsü: 148 × 210 mm punktla", () => {
  assert.ok(Math.abs(A5_WIDTH_PT - 419.5276) < 0.001);
  assert.ok(Math.abs(A5_HEIGHT_PT - 595.2756) < 0.001);
});

test("PDF bir səhifəli və səhifə ölçüsü dəqiq A5-dir (portret)", async () => {
  const pdf = await samplePdf();
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  const boxes = mediaBoxes(pdf);
  assert.equal(boxes.length, 1);
  const [x0, y0, width, height] = boxes[0];
  assert.equal(x0, 0);
  assert.equal(y0, 0);
  assert.ok(Math.abs(width - A5_WIDTH_PT) < 0.01, `en ${width}`);
  assert.ok(Math.abs(height - A5_HEIGHT_PT) < 0.01, `hündürlük ${height}`);
});

test("çox dərs olanda bütün səhifələr yenə A5 olur", async () => {
  const many: ScheduleLessonInput[] = Array.from({ length: 40 }, (_, index) => ({
    courseId: index,
    subject: `Fənn ${index + 1} — ərəb dili النحو والصرف`,
    lessonDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].slice(0, 1 + (index % 7)),
    lessonTime: `${String(8 + (index % 12)).padStart(2, "0")}:00`,
    teacher: `Müəllim ${index}`,
    books: [formatScheduleBook({ bookShortTitle: "شرح منهج السالكين", chapterTitle: "باب الطهارة (فصل)", printedFrom: 1, printedTo: 9 })],
  }));
  const pdf = await samplePdf({ days: buildWeeklySchedule(many) });
  const boxes = mediaBoxes(pdf);
  assert.ok(boxes.length > 1, "bir neçə səhifə gözlənilir");
  for (const [, , width, height] of boxes) {
    assert.ok(Math.abs(width - A5_WIDTH_PT) < 0.01 && Math.abs(height - A5_HEIGHT_PT) < 0.01);
  }
});

test("şriftlər repo-dan götürülür və PDF-ə daxil edilir (ə, ğ, ı, ş, ç, ö, ü və ərəb)", async () => {
  assert.ok(scheduleFonts.regular && fs.existsSync(scheduleFonts.regular), "DejaVuSans tapılmadı");
  assert.ok(scheduleFonts.bold && fs.existsSync(scheduleFonts.bold), "DejaVuSans-Bold tapılmadı");
  assert.match(scheduleFonts.regular!, /artifacts\/api-server\/src\/assets\/fonts\/DejaVuSans\.ttf$|src\/assets\/fonts\/DejaVuSans\.ttf$/);
  assert.match(scheduleFonts.bold!, /src\/assets\/fonts\/DejaVuSans-Bold\.ttf$/);
  const pdf = await samplePdf();
  const text = pdf.toString("latin1");
  assert.match(text, /\/BaseFont \/[A-Z]{6}\+DejaVuSans\b/);
  assert.match(text, /\/BaseFont \/[A-Z]{6}\+DejaVuSans-Bold\b/);
  assert.match(text, /\/FontFile2/, "şrift faylı PDF-ə daxil edilməlidir");
  // Standart (daxil edilməyən) Helvetica istifadə olunmur.
  assert.doesNotMatch(text, /\/BaseFont \/Helvetica/);
  // Azərbaycan hərfləri və ərəb hərfləri ToUnicode xəritəsində var (mətn düzgün kopyalanır/axtarılır).
  const cmaps = inflatedStreams(pdf);
  for (const ch of ["ə", "ğ", "ı", "ş", "ç", "ö", "ü", "Ə", "İ", "ب", "و"]) {
    const hex = ch.codePointAt(0)!.toString(16).padStart(4, "0");
    assert.ok(new RegExp(`<${hex}>`, "i").test(cmaps), `${ch} (U+${hex.toUpperCase()}) ToUnicode-da tapılmadı`);
  }
});

test("PDF məlumatında Akademiya adı var, 'LMS' yoxdur", async () => {
  const pdf = await samplePdf();
  const text = pdf.toString("latin1");
  assert.doesNotMatch(text, /LMS/);
  assert.equal(SCHEDULE_ACADEMY_NAME, "Mədinə Tədris Akademiyası");
});

test("həftə Bazar ertəsindən başlayır, dərslər saata görə, boş günlər boş qalır", () => {
  const days = buildWeeklySchedule(lessons);
  assert.deepEqual(days.map((day) => day.day), ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
  assert.equal(days[0].label, "Bazar ertəsi");
  assert.deepEqual(days[0].lessons.map((lesson) => [lesson.time, lesson.subject]), [["08:30", "Ərəb dili (النحو)"], ["18:00", "Fiqh"]]);
  assert.equal(days[3].lessons[0].time, "19:30");
  assert.equal(days[1].lessons.length, 0);
  assert.equal(days[6].lessons.length, 0);
  assert.equal(days[5].lessons[0].teacher, null);
  for (const day of days) {
    for (const lesson of day.lessons) {
      assert.equal("mode" in lesson, false);
    }
  }
});

test("dərs saatı: tək saat və gün → saat xəritəsi", () => {
  assert.equal(lessonTimeForDay("18:00", "monday"), "18:00");
  assert.equal(lessonTimeForDay('{"monday":"18:00"}', "monday"), "18:00");
  assert.equal(lessonTimeForDay('{"monday":"18:00"}', "friday"), null);
  assert.equal(lessonTimeForDay("{bad", "monday"), null);
  assert.equal(lessonTimeForDay(null, "monday"), null);
});

test("hazırlanma tarixi Bakı vaxtı ilə", () => {
  assert.equal(formatScheduleGeneratedAt(new Date("2026-10-09T22:40:00Z")), "10.10.2026, 02:40");
});

test("platforma adları (PDF-də göstərilmir; yalnız link tanıma)", () => {
  assert.equal(meetingPlatformName("https://us02web.zoom.us/j/123"), "Zoom");
  assert.equal(meetingPlatformName("https://meet.google.com/abc-defg-hij"), "Google Meet");
  assert.equal(meetingPlatformName("https://example.com/room"), null);
  assert.equal(meetingPlatformName(null), null);
});

test("PDF-də Əyani / Qiyabi / Onlayn format etiketi yoxdur", async () => {
  const pdf = await samplePdf();
  const text = pdf.toString("utf8");
  for (const banned of ["Əyani", "Qiyabi", "Onlayn ·", "onlayn link yoxdur", "Əyani (onlayn"]) {
    assert.equal(text.includes(banned), false, `PDF-də qadağan olunmuş söz: ${banned}`);
  }
  const days = buildWeeklySchedule(lessons);
  const dumped = JSON.stringify(days);
  for (const banned of ["Əyani", "Qiyabi", "Onlayn ·", "onlayn link yoxdur"]) {
    assert.equal(dumped.includes(banned), false, `cədvəl məlumatında qadağan olunmuş söz: ${banned}`);
  }
});

test("kitab sətri: ərəb hissələri izolə olunur, mötərizə qarışmır", () => {
  const line = formatScheduleBook({ bookShortTitle: "Şərhu Mənhəcis-Salikin", chapterTitle: "باب نواقض الوضوء", printedFrom: 55, printedTo: 56, note: null });
  assert.equal(line, `«${isolate("Şərhu Mənhəcis-Salikin")}» — ${isolate("باب نواقض الوضوء")} (s. 55–56)`);
  assert.equal(formatScheduleBook({ bookShortTitle: "X", printedFrom: 7, printedTo: 7 }), `«${isolate("X")}» (s. 7)`);
  // Əsas istiqamət izolyatdan kənardakı mətnlə müəyyən olunur.
  assert.equal(baseDirectionIsRtl(`Kitab: ${isolate("شرح العقيدة")}`), false);
  assert.equal(baseDirectionIsRtl("العقيدة الطحاوية (شرح)"), true);
});

test("fayl adı ASCII-dir", () => {
  assert.equal(scheduleFileName("Muellim-cedveli", "Ustad Əli Şükürov"), "Muellim-cedveli-Ustad-Eli-Sukurov.pdf");
  assert.equal(scheduleFileName("Ders-cedveli", "T0012"), "Ders-cedveli-T0012.pdf");
});
