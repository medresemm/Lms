// Qrup bayrağı (lms_resources.is_group) üçün bazadan asılı olmayan saf qaydalar (test edilə bilir).
//
// Bir lms_resources sətri:
// - müəllimi varsa — həmişə qrupdur (köhnə məlumat, bayraq olmadan da);
// - müəllimi yoxdur, amma is_group = true — müəllimsiz qrupdur (tələbələr görmür, müəllim təyin olunmalıdır);
// - müəllimi yoxdur və is_group = false — «Cədvəl hazırlama»dakı dərs sətridir (hələ qrup deyil).

export type GroupFlagRow = { id: number; teacherClerkUserId: string | null };

export function isGroupRow(row: GroupFlagRow, flaggedIds: ReadonlySet<number>) {
  return Boolean(row.teacherClerkUserId) || flaggedIds.has(row.id);
}

export function isScheduleRow(row: GroupFlagRow, flaggedIds: ReadonlySet<number>) {
  return !isGroupRow(row, flaggedIds);
}

export function isTeacherlessGroup(row: GroupFlagRow, flaggedIds: ReadonlySet<number>) {
  return !row.teacherClerkUserId && flaggedIds.has(row.id);
}

export type StudentVisibilityRow = GroupFlagRow & { courseId: number };

/**
 * Tələbənin görəcəyi qruplar (Dərs Cədvəlim). Qaydalar:
 * - tələbə fənni cədvəlindən çıxarıbsa, o fənn görünmür;
 * - tələbə fənnin hansısa qrupuna (müəllimsiz də olsa) təyin olunubsa, yalnız müəllimi olan təyinatları görür;
 *   müəllimsiz qrupdakı tələbə müəllim təyin olunana qədər həmin dərsi görmür (başqa qrupun dərsi ona göstərilmir);
 * - heç bir qrupa təyin olunmayıbsa və fənnin yeganə qrupu (müəllimli) varsa, onu görür (köhnə qayda).
 */
export function studentVisibleRows<T extends StudentVisibilityRow>(
  rows: readonly T[],
  approvedResourceIds: ReadonlySet<number>,
  removedCourseIds: ReadonlySet<number>,
  flaggedIds: ReadonlySet<number>,
): T[] {
  const byCourse = new Map<number, T[]>();
  for (const row of rows) {
    if (removedCourseIds.has(row.courseId) || !isGroupRow(row, flaggedIds)) continue;
    const list = byCourse.get(row.courseId) ?? [];
    list.push(row);
    byCourse.set(row.courseId, list);
  }
  return Array.from(byCourse.values()).flatMap((groups) => {
    const assigned = groups.filter((row) => approvedResourceIds.has(row.id));
    if (assigned.length) return assigned.filter((row) => Boolean(row.teacherClerkUserId));
    const withTeacher = groups.filter((row) => Boolean(row.teacherClerkUserId));
    return groups.length === 1 && withTeacher.length === 1 ? withTeacher : [];
  });
}
