// Mədinə AI cavabları üçün ümumi formatlayıcılar.
import type { AiReply } from "./aiProvider.js";
import { hasKeyword, normalizeText, tokenize, type ParsedMessage } from "./text.js";

export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export type Weekday = typeof WEEKDAYS[number];
export const WEEKDAY_ORDER: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export const WEEKDAY_LABELS: Record<string, string> = {
  monday: "Bazar ertəsi",
  tuesday: "Çərşənbə axşamı",
  wednesday: "Çərşənbə",
  thursday: "Cümə axşamı",
  friday: "Cümə",
  saturday: "Şənbə",
  sunday: "Bazar",
};
// Uzun ifadələr əvvəl yoxlanılır ("cersenbe axsami" "cersenbe"-dən əvvəl).
export const WEEKDAY_KEYWORDS: Array<[string, Weekday]> = [
  ["bazar ertesi", "monday"], ["cersenbe axsami", "tuesday"], ["cume axsami", "thursday"], ["cumartesi", "saturday"],
  ["pazartesi", "monday"], ["persembe", "thursday"], ["carsamba", "wednesday"], ["cersenbe", "wednesday"],
  ["senbe", "saturday"], ["cume", "friday"], ["cuma", "friday"], ["sali", "tuesday"], ["bazar", "sunday"], ["pazar", "sunday"],
];

export const ATTENDANCE_STATUS: Record<string, string> = {
  present: "iştirak edib",
  absent: "qayıb",
  late: "gecikmə",
  excused: "üzrlü",
};

export const IGNORED_TITLE_WORDS = new Set(["dili", "elmi", "elmleri", "tarixi", "esaslari", "giris", "ve", "ile", "dersi", "fenni"]);

// ---------------------------------------------------------------------------
// Köməkçi formatlayıcılar
// ---------------------------------------------------------------------------

export function bakuParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  }).formatToParts(date);
  const value = (name: string) => parts.find((part) => part.type === name)?.value ?? "";
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), weekday: value("weekday") };
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const p = bakuParts(date);
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

export function formatDate(value: Date | string | null | undefined) {
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

export function bakuWeekday(offsetDays = 0): Weekday {
  const p = bakuParts(new Date(Date.now() + offsetDays * 86_400_000));
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return WEEKDAYS[index >= 0 ? index : 0];
}

export function studentCode(studentNumber: number) {
  return `T${String(studentNumber).padStart(4, "0")}`;
}

export function formatGrade(grade: number | null | undefined) {
  if (grade === null || grade === undefined) return "daxil edilməyib";
  return String(Math.round(grade * 100) / 100);
}

export function snippet(value: string | null | undefined, max = 140) {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function lessonDaysLabel(days: string[]) {
  const labels = WEEKDAY_ORDER.filter((day) => days.includes(day)).map((day) => WEEKDAY_LABELS[day]);
  return labels.length ? labels.join(", ") : "gün təyin olunmayıb";
}

/** lessonTime ya «HH:MM», ya da gün → saat JSON-u ({"monday":"18:00"}) ola bilər. */
function parseLessonTimes(lessonTime: string | null | undefined): { single: string | null; perDay: Record<string, string> | null } {
  const raw = (lessonTime ?? "").trim();
  if (!raw) return { single: null, perDay: null };
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const perDay = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string" && /^\d{1,2}:\d{2}$/.test(entry[1].trim())).map(([day, time]) => [day, time.trim()]));
      return { single: null, perDay };
    } catch {
      return { single: null, perDay: {} };
    }
  }
  return { single: /^\d{1,2}:\d{2}$/.test(raw) ? raw : null, perDay: null };
}

/** Konkret gün üçün dərs saatı (yoxdursa null). */
export function lessonTimeOn(lessonTime: string | null | undefined, day?: string | null): string | null {
  const { single, perDay } = parseLessonTimes(lessonTime);
  if (perDay) {
    if (day) return perDay[day] ?? null;
    const times = Array.from(new Set(Object.values(perDay)));
    return times.length === 1 ? times[0]! : null;
  }
  return single;
}

/**
 * Günlər + saat, oxunaqlı: «Bazar ertəsi 22:13, Şənbə 21:13» (hər günün öz saatı)
 * və ya «Bazar ertəsi, Çərşənbə 18:00» (eyni saat). Xam JSON heç vaxt göstərilmir.
 */
export function lessonScheduleLabel(days: string[], lessonTime: string | null | undefined, options: { timeSeparator?: string } = {}) {
  const ordered = WEEKDAY_ORDER.filter((day) => days.includes(day));
  if (!ordered.length) return lessonDaysLabel(days);
  const { single, perDay } = parseLessonTimes(lessonTime);
  if (perDay) {
    const distinct = Array.from(new Set(ordered.map((day) => perDay[day]).filter(Boolean)));
    if (distinct.length > 1 || ordered.some((day) => !perDay[day])) {
      return ordered.map((day) => `${WEEKDAY_LABELS[day]}${perDay[day] ? ` ${perDay[day]}` : ""}`).join(", ");
    }
    return `${lessonDaysLabel(ordered)}${distinct[0] ? `${options.timeSeparator ?? " "}${distinct[0]}` : ""}`;
  }
  return `${lessonDaysLabel(ordered)}${single ? `${options.timeSeparator ?? " "}${single}` : ""}`;
}

/** Müəllim adı(ları); boşdursa «Müəllim təyin olunmayıb». */
export function teacherDisplay(...names: Array<string | null | undefined>) {
  for (const name of names) if (name && name.trim()) return name.trim();
  return "Müəllim təyin olunmayıb";
}

export function reply(lines: Array<string | null | undefined | false>, suggestions: string[] = []): AiReply {
  return {
    reply: lines.filter((line): line is string => typeof line === "string").join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    suggestions: suggestions.slice(0, 4),
  };
}

export function detectWeekday(parsed: ParsedMessage): { day: Weekday; label: string } | null {
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

export function detectTermNumber(parsed: ParsedMessage): number | null {
  const match = parsed.text.match(/\b([1-8])\s*(?:-?\s*(?:ci|cu|ci|cı|nci|inci|uncu|ncu)?)\s*(?:semestr|donem|yariyil)/);
  return match ? Number(match[1]) : null;
}

export function titleMatches(parsed: ParsedMessage, title: string) {
  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) return false;
  if (normalizedTitle.length >= 3 && ` ${parsed.text} `.includes(` ${normalizedTitle}`)) return true;
  const words = tokenize(normalizedTitle).filter((word) => word.length >= 4 && !IGNORED_TITLE_WORDS.has(word));
  return words.some((word) => parsed.tokens.some((token) => token === word || token.startsWith(word)));
}
