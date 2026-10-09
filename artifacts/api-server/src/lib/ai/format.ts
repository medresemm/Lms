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
