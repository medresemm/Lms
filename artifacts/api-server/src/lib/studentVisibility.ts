/**
 * Tələbə siyahılarında kimin görünəcəyini müəyyən edən saf qaydalar.
 *
 * Rolun yeganə mənbəyi Clerk-dir (publicMetadata.role, sistem sahibi e-poçtu və ADMIN_USER_IDS).
 * Hazırkı rolu "none"-dan fərqli olan hesab (sahib, admin, müəllim, nəzarətçi, idarə heyəti)
 * işçi sayılır: onun tələbə profili silinmir, sadəcə tələbə siyahılarından və saylardan gizlədilir.
 * Rol yenidən "Adi istifadəçi" edilsə, həmin profil avtomatik geri qayıdır.
 */
export type AccountRole = "owner" | "admin" | "teacher" | "supervisor" | "owner_assistant" | "none";

export function isStaffRole(role: AccountRole | null | undefined) {
  return Boolean(role) && role !== "none";
}

export function staffIdsFrom(users: ReadonlyArray<{ id: string; role: AccountRole }>, extraIds: ReadonlyArray<string> = []) {
  const ids = new Set<string>();
  for (const user of users) if (isStaffRole(user.role)) ids.add(user.id);
  for (const id of extraIds) if (id) ids.add(id);
  return ids;
}

export function isVisibleStudent(clerkUserId: string | null | undefined, staffIds: ReadonlySet<string>) {
  return !clerkUserId || !staffIds.has(clerkUserId);
}

export function withoutStaff<T>(rows: ReadonlyArray<T>, clerkIdOf: (row: T) => string | null | undefined, staffIds: ReadonlySet<string>) {
  if (!staffIds.size) return [...rows];
  return rows.filter((row) => isVisibleStudent(clerkIdOf(row), staffIds));
}

/**
 * Qrup siyahısı yenidən yazılanda (PUT) gizli işçi hesablarının üzvlüyü itməməlidir:
 * müəllim onları görmür, deməli göndərdiyi siyahıda da olmur. Saxlanılacaq id-lər =
 * göndərilən görünən tələbələr + qrupda artıq olan gizli işçi profilləri.
 */
export function rosterIdsToKeep(requestedVisibleIds: ReadonlyArray<number>, currentMemberIds: ReadonlyArray<number>, staffProfileIds: ReadonlySet<number>) {
  const keep = new Set(requestedVisibleIds);
  for (const id of currentMemberIds) if (staffProfileIds.has(id)) keep.add(id);
  return Array.from(keep);
}
