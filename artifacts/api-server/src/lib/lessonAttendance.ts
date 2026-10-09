// Onlayn dərs linkinə sayt üzərindən qoşulmaya əsaslanan avtomatik davamiyyət üçün təmiz (DB-siz) məntiq.
// Qeyd: bu, tələbənin saytdakı "Dərsə qoşul" linkinə klik etməsini qeyd edir; Zoom/Meet-də faktiki
// qalma müddətini ölçmür.

export const ACADEMY_UTC_OFFSET_HOURS = 4; // Asia/Baku (UTC+04:00), mövcud cədvəl konvensiyası.
export const JOIN_WINDOW_EARLY_MINUTES = 15;
export const JOIN_WINDOW_LATE_MINUTES = 180;
export const ON_TIME_GRACE_MINUTES = 20;
export const SESSION_LOOKBACK_DAYS = 14;

export const weekdayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export type AttendanceStatus = "present" | "late" | "absent" | "excused";
export type Punctuality = "on_time" | "late";

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isLessonTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Akademiya (Bakı) vaxtı ilə bugünkü tarix və həftə günü. */
export function academyToday(now = new Date()) {
  const shifted = new Date(now.getTime() + ACADEMY_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const date = shifted.toISOString().slice(0, 10);
  return { date, weekday: weekdayKeys[shifted.getUTCDay()] };
}

export function weekdayOf(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return weekdayKeys[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

export function lessonStartUtc(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return Date.UTC(year, month - 1, day, hour - ACADEMY_UTC_OFFSET_HOURS, minute);
}

export type LessonSchedule = { lessonDays: string[]; lessonTime: string | null };

/**
 * Qoşulmanın hansı dərs məşğələsinə (tarixə) aid olduğunu müəyyən edir. Qoşulma yalnız dərs günü,
 * başlamadan 15 dəqiqə əvvəldən 3 saat sonrasına qədər qeyd olunur.
 */
export function joinableSession(schedule: LessonSchedule, now = new Date()) {
  if (!isLessonTime(schedule.lessonTime) || !schedule.lessonDays.length) return { ok: false as const, reason: "no_schedule" as const };
  const today = academyToday(now);
  if (!schedule.lessonDays.includes(today.weekday)) return { ok: false as const, reason: "not_today" as const };
  const start = lessonStartUtc(today.date, schedule.lessonTime);
  const time = now.getTime();
  if (time < start - JOIN_WINDOW_EARLY_MINUTES * 60_000) return { ok: false as const, reason: "too_early" as const, start };
  if (time > start + JOIN_WINDOW_LATE_MINUTES * 60_000) return { ok: false as const, reason: "too_late" as const, start };
  const punctuality: Punctuality = time <= start + ON_TIME_GRACE_MINUTES * 60_000 ? "on_time" : "late";
  return { ok: true as const, sessionDate: today.date, start, punctuality };
}

/** Son N gün ərzində (bu gün daxil, başlamış) planlaşdırılmış dərs tarixləri, yenidən köhnəyə. */
export function recentSessionDates(schedule: LessonSchedule, now = new Date(), lookbackDays = SESSION_LOOKBACK_DAYS) {
  if (!isLessonTime(schedule.lessonTime) || !schedule.lessonDays.length) return [];
  const today = academyToday(now).date;
  const [year, month, day] = today.split("-").map(Number);
  const dates: string[] = [];
  for (let offset = 0; offset <= lookbackDays; offset += 1) {
    const date = new Date(Date.UTC(year, month - 1, day - offset)).toISOString().slice(0, 10);
    if (!schedule.lessonDays.includes(weekdayOf(date))) continue;
    if (lessonStartUtc(date, schedule.lessonTime) - JOIN_WINDOW_EARLY_MINUTES * 60_000 > now.getTime()) continue;
    dates.push(date);
  }
  return dates;
}

export type RosterResource = { id: number; courseId: number; termNumber: number };
export type RosterStudent = {
  profileId: number;
  currentTermNumber: number;
  removedCourseIds: ReadonlySet<number>;
  approvedResourceIds: ReadonlySet<number>;
};

/**
 * Dərs qrupunun (resource) siyahısı — tələbə panelindəki görünmə qaydası ilə eynidir:
 * tələbə həmin fənn/semestr üzrə bu qrupa təsdiqlənmiş seçimlə bağlıdırsa, ya da fənnin
 * yeganə qrupudursa və başqa qrupa bağlanmayıbsa.
 */
export function rosterForResource(resource: RosterResource, courseTermResources: RosterResource[], students: RosterStudent[]) {
  const groupIds = courseTermResources
    .filter((item) => item.courseId === resource.courseId && item.termNumber === resource.termNumber)
    .map((item) => item.id);
  if (!groupIds.includes(resource.id)) groupIds.push(resource.id);
  return students.filter((student) => {
    if (student.currentTermNumber !== resource.termNumber) return false;
    if (student.removedCourseIds.has(resource.courseId)) return false;
    const assigned = groupIds.filter((id) => student.approvedResourceIds.has(id));
    if (assigned.length) return assigned.includes(resource.id);
    return groupIds.length === 1;
  }).map((student) => student.profileId);
}

export type SessionJoin = { profileId: number; joinedAt: string; punctuality: string };
export type SessionRecord = { id: number; profileId: number; status: string; teacherName: string; recordedAt: string };
export type SessionStudent = { profileId: number; studentName: string; studentNumber: number };

export type SessionRow = SessionStudent & {
  joined: boolean;
  joinedAt: string | null;
  punctuality: Punctuality | null;
  autoStatus: "present" | "absent";
  finalStatus: AttendanceStatus | null;
  recordId: number | null;
  suggestedStatus: AttendanceStatus;
};

/** Avtomatik təklif: qoşulub → "present", qoşulmayıb → "absent". Mövcud yekun qeyd varsa o saxlanılır. */
export function buildSessionRows(students: SessionStudent[], joins: SessionJoin[], records: SessionRecord[]): SessionRow[] {
  const joinMap = new Map(joins.map((join) => [join.profileId, join]));
  const recordMap = new Map(records.map((record) => [record.profileId, record]));
  return students.map((student): SessionRow => {
    const join = joinMap.get(student.profileId);
    const record = recordMap.get(student.profileId);
    const autoStatus = join ? "present" as const : "absent" as const;
    const finalStatus = record && ["present", "late", "absent", "excused"].includes(record.status) ? record.status as AttendanceStatus : null;
    return {
      ...student,
      joined: Boolean(join),
      joinedAt: join?.joinedAt ?? null,
      punctuality: join ? (join.punctuality === "late" ? "late" as const : "on_time" as const) : null,
      autoStatus,
      finalStatus,
      recordId: record?.id ?? null,
      suggestedStatus: finalStatus ?? autoStatus,
    };
  }).sort((a, b) => Number(b.joined) - Number(a.joined) || a.studentName.localeCompare(b.studentName, "az"));
}

export function sessionSummary(rows: SessionRow[]) {
  const joined = rows.filter((row) => row.joined).length;
  const confirmed = rows.filter((row) => row.finalStatus !== null).length;
  return {
    total: rows.length,
    joined,
    notJoined: rows.length - joined,
    confirmed,
    state: rows.length && confirmed === rows.length ? "confirmed" as const : confirmed > 0 ? "partial" as const : "pending" as const,
  };
}

/**
 * Təsdiq zamanı yazılacaq yekun statuslar. Müəllim ayrıca dəyişmədiyi sətirlər üçün avtomatik təklif
 * (və ya mövcud yekun qeyd) istifadə olunur. "excused" (üzrlü) qeydlərinə toxunulmur.
 */
export function resolveConfirmation(rows: SessionRow[], overrides: Record<number, string | undefined>) {
  const writes: Array<{ profileId: number; status: "present" | "late" | "absent" }> = [];
  for (const row of rows) {
    const override = overrides[row.profileId];
    const status = override === "present" || override === "late" || override === "absent" ? override : row.suggestedStatus;
    if (status === "excused") continue;
    writes.push({ profileId: row.profileId, status });
  }
  return writes;
}

export type MeetingPlatform = "zoom" | "meet" | "lesson";

export function isMeetingUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Qoşulma üçün hədəf link: müəllimin qrupa yerləşdirdiyi aktiv link, sonra fənnin Zoom/Meet/dərs linki. */
export function resolveMeetingUrl(
  resourceUrl: string | null | undefined,
  course: { zoomUrl: string | null; googleMeetUrl: string | null; lessonUrl: string | null } | null | undefined,
  platform?: MeetingPlatform | null,
) {
  const byPlatform: Record<MeetingPlatform, string | null | undefined> = {
    zoom: course?.zoomUrl,
    meet: course?.googleMeetUrl,
    lesson: course?.lessonUrl,
  };
  if (platform && isMeetingUrl(byPlatform[platform])) return byPlatform[platform] as string;
  if (isMeetingUrl(resourceUrl)) return resourceUrl;
  return [course?.zoomUrl, course?.googleMeetUrl, course?.lessonUrl].find(isMeetingUrl) ?? null;
}

export function parsePlatform(value: unknown): MeetingPlatform | null {
  return value === "zoom" || value === "meet" || value === "lesson" ? value : null;
}
