// «Qruplar» bölməsi üçün saf köməkçilər (süzgəc, cədvəl mətni, tutum).
import { resourceTeacherIds } from './co-teachers';

export type GroupView = {
  id: number;
  courseId: number;
  courseTitle: string;
  termNumber: number;
  teacherClerkUserId?: string | null;
  coTeacherClerkUserIds?: string[] | null;
  teacherName?: string | null;
  teacherNames?: string[] | null;
  lessonDays: string[];
  lessonTime?: string | null;
  studentCapacity: number;
  studentCount: number;
  pendingCount: number;
  canManageStudents: boolean;
  canDelete: boolean;
};

export type GroupFilter = { termNumber: number | null; courseId: number | null; teacherId: string; search: string };

export const DAY_LABELS: Record<string, string> = {
  monday: 'Bazar ertəsi', tuesday: 'Çərşənbə axşamı', wednesday: 'Çərşənbə', thursday: 'Cümə axşamı', friday: 'Cümə', saturday: 'Şənbə', sunday: 'Bazar',
};
const DAY_ORDER = Object.keys(DAY_LABELS);

const fold = (value: string) => value.toLocaleLowerCase('az').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ə/g, 'e').replace(/ı/g, 'i').trim();

/** Gün → saat (lessonTime ya «HH:MM», ya da {"monday":"18:00"} JSON-u ola bilər). */
export function dayTimes(lessonTime: string | null | undefined, days: readonly string[]): Record<string, string> {
  let parsed: Record<string, unknown> | null = null;
  if (lessonTime?.trim().startsWith('{')) {
    try { parsed = JSON.parse(lessonTime) as Record<string, unknown>; } catch { parsed = null; }
  }
  const single = lessonTime && /^\d{2}:\d{2}$/.test(lessonTime.trim()) ? lessonTime.trim() : '';
  return Object.fromEntries(days.map((day) => [day, typeof parsed?.[day] === 'string' ? parsed[day] as string : single]));
}

/** «Bazar ertəsi 18:00, Çərşənbə 19:00» */
export function groupScheduleLabel(group: Pick<GroupView, 'lessonDays' | 'lessonTime'>): string {
  if (!group.lessonDays.length) return 'Gün təyin edilməyib';
  const times = dayTimes(group.lessonTime, group.lessonDays);
  return [...group.lessonDays]
    .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
    .map((day) => `${DAY_LABELS[day] ?? day}${times[day] ? ` ${times[day]}` : ''}`)
    .join(', ');
}

/** «12 / 20 tələbə» və ya «12 tələbə · limitsiz» */
export function groupCapacityLabel(group: Pick<GroupView, 'studentCount' | 'studentCapacity'>): string {
  return group.studentCapacity > 0 ? `${group.studentCount} / ${group.studentCapacity} tələbə` : `${group.studentCount} tələbə · limitsiz`;
}

export function groupIsFull(group: Pick<GroupView, 'studentCount' | 'studentCapacity'>): boolean {
  return group.studentCapacity > 0 && group.studentCount >= group.studentCapacity;
}

export function filterGroups<T extends GroupView>(groups: readonly T[], filter: GroupFilter): T[] {
  const query = fold(filter.search);
  return groups.filter((group) => {
    if (filter.termNumber !== null && group.termNumber !== filter.termNumber) return false;
    if (filter.courseId !== null && group.courseId !== filter.courseId) return false;
    if (filter.teacherId && !resourceTeacherIds(group).includes(filter.teacherId)) return false;
    if (!query) return true;
    const haystack = fold([group.courseTitle, ...(group.teacherNames ?? []), group.teacherName ?? '', `${group.termNumber}`, groupScheduleLabel(group)].join(' '));
    return query.split(/\s+/).every((part) => haystack.includes(part));
  });
}

/** Tələbə seçicisində axtarış: ad, soyad və ya T-nömrə. */
export function matchesStudentSearch(student: { firstName: string; lastName: string; studentNumber: number }, search: string): boolean {
  const query = fold(search);
  if (!query) return true;
  const code = `t${String(student.studentNumber).padStart(4, '0')}`;
  const haystack = fold(`${student.firstName} ${student.lastName} ${code} ${student.studentNumber}`);
  return query.split(/\s+/).every((part) => haystack.includes(part));
}
