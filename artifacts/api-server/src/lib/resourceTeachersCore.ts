// Bir müəllim qrupunda bir neçə müəllim (birgə tədris) — bazadan asılı olmayan saf köməkçilər (test edilə bilir).

export type ResourceTeacherRef = { id: number; teacherClerkUserId: string | null };
export type CoTeacherMap = ReadonlyMap<number, readonly string[]>;

/** Qrupun bütün müəllimləri: əvvəlcə əsas müəllim, sonra əlavə müəllimlər (təkrarsız). */
export function resourceTeacherIds(resource: ResourceTeacherRef, coTeachers: CoTeacherMap): string[] {
  const ids: string[] = [];
  if (resource.teacherClerkUserId) ids.push(resource.teacherClerkUserId);
  // Əsas müəllimi olmayan cədvəl dərsinin (hələ qrup deyil) əlavə müəllimi olmur.
  if (!resource.teacherClerkUserId) return ids;
  for (const id of coTeachers.get(resource.id) ?? []) {
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function userTeachesResourceWith(userId: string | null | undefined, resource: ResourceTeacherRef, coTeachers: CoTeacherMap) {
  if (!userId) return false;
  return resourceTeacherIds(resource, coTeachers).includes(userId);
}

/** Müəllimlərin adları vergüllə: «Əli Məmmədov, Vəli Həsənov». Adı tapılmayanlar buraxılır. */
export function joinTeacherNames(ids: readonly string[], names: ReadonlyMap<string, string | null>): string | null {
  const list = teacherNameList(ids, names);
  return list.length ? list.join(", ") : null;
}

export function teacherNameList(ids: readonly string[], names: ReadonlyMap<string, string | null>): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const name = names.get(id)?.trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

export type TeacherSetChange =
  | { ok: true; mainTeacherId: string; coTeacherIds: string[]; added: string[]; removed: string[]; mainChanged: boolean }
  | { ok: false; error: string };

/**
 * İstənilən yeni müəllim siyahısını (sıra: birinci əsas müəllimdir) mövcud vəziyyətlə müqayisə edir.
 * Ən azı bir müəllim qalmalıdır. Əsas müəllim siyahıdan çıxarılırsa, birinci qalan müəllim əsas olur.
 */
export function planTeacherSet(currentMainId: string, currentCoIds: readonly string[], requested: readonly string[]): TeacherSetChange {
  const wanted: string[] = [];
  for (const raw of requested) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (id && !wanted.includes(id)) wanted.push(id);
  }
  if (!wanted.length) return { ok: false, error: "Qrupda ən azı bir müəllim qalmalıdır." };
  if (wanted.length > 10) return { ok: false, error: "Bir qrupa ən çox 10 müəllim təyin etmək olar." };
  const before = [currentMainId, ...currentCoIds.filter((id) => id !== currentMainId)];
  const mainTeacherId = wanted.includes(currentMainId) ? currentMainId : wanted[0]!;
  const coTeacherIds = wanted.filter((id) => id !== mainTeacherId);
  return {
    ok: true,
    mainTeacherId,
    coTeacherIds,
    added: wanted.filter((id) => !before.includes(id)),
    removed: before.filter((id) => !wanted.includes(id)),
    mainChanged: mainTeacherId !== currentMainId,
  };
}
