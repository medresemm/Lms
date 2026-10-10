// Birgə tədris: bir qrupun bir neçə müəllimi (əsas + əlavə). Interfeys üçün köməkçilər.

export type CoTaughtResource = {
  teacherClerkUserId?: string | null;
  coTeacherClerkUserIds?: readonly string[] | null;
  teacherName?: string | null;
  teacherNames?: readonly string[] | null;
};

/** Qrupun bütün müəllimlərinin id-ləri (əvvəlcə əsas müəllim). */
export function resourceTeacherIds(resource: CoTaughtResource): string[] {
  if (!resource.teacherClerkUserId) return [];
  const ids = [resource.teacherClerkUserId];
  for (const id of resource.coTeacherClerkUserIds ?? []) if (id && !ids.includes(id)) ids.push(id);
  return ids;
}

/** İstifadəçi bu qrupun əsas və ya əlavə müəllimidirmi. */
export function teachesResource(resource: CoTaughtResource, userId: string | null | undefined): boolean {
  return Boolean(userId) && resourceTeacherIds(resource).includes(userId as string);
}

export function isCoTaught(resource: CoTaughtResource): boolean {
  return resourceTeacherIds(resource).length > 1;
}

/** Göstəriləcək müəllim adı(ları): «Ad1, Ad2». */
export function resourceTeacherLabel(resource: CoTaughtResource, fallback = 'Müəllim təyin edilməyib'): string {
  if (resource.teacherNames?.length) return resource.teacherNames.join(', ');
  return resource.teacherName?.trim() || fallback;
}

/**
 * Seçilmiş müəllimləri serverə göndəriləcək sıraya düzür: əsas müəllim seçilibsə birinci gedir,
 * qalanları seçim sırası ilə. Boş siyahı «ən azı bir müəllim» qaydasına görə qəbul edilmir.
 */
export function orderedTeacherSelection(mainTeacherId: string | null | undefined, selected: readonly string[]): string[] {
  const unique = selected.filter((id, index) => id && selected.indexOf(id) === index);
  if (mainTeacherId && unique.includes(mainTeacherId)) return [mainTeacherId, ...unique.filter((id) => id !== mainTeacherId)];
  return unique;
}

export function sameTeacherSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a[0] === b[0] && a.every((id) => b.includes(id));
}
