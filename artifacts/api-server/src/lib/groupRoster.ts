/**
 * «Qruplar» bölməsi: müəllim qrupuna tələbə əlavə etmək / çıxarmaq üçün saf qaydalar.
 *
 * Qaydalar «Tədris proqramı»ndakı tam siyahı yazılışı (PUT /admin/resources/:id/students) ilə eynidir:
 * - eyni fənn + semestr üzrə tələbə iki müəllim qrupunda ola bilməz (gözləyən seçim də sayılır);
 * - qrup tutumu (0 = limitsiz) görünən üzvlər + qrupdan kənar gözləyən seçimlərlə yoxlanılır;
 * - işçi rolundakı (gizli) hesablar yeni əlavə edilmir, artıq qrupda olanlar isə toxunulmaz qalır.
 */

/** Mətn «Tədris proqramı»ndakı xəta ilə hərfi eynidir. */
export const OTHER_GROUP_ERROR = "Seçilən tələbələrdən biri həmin fənn üzrə başqa müəllim qrupundadır.";
export const OTHER_GROUP_REASON = "Həmin fənn üzrə başqa müəllim qrupundadır";
export const INACTIVE_STUDENT_ERROR = "Seçilən tələbələrdən biri artıq aktiv deyil.";
export const DUPLICATE_SELECTION_ERROR = "Tələbə seçimi təkrarlana bilməz.";
export const capacityError = (capacity: number) => `Bu qrup üçün ən çox ${capacity} tələbə seçə bilərsiniz.`;
export const fullGroupError = (pending: number) => `Bu müəllim qrupu artıq doludur. ${pending} gözləmədə olan seçim əvvəlcə qərarlandırılmalıdır.`;

export type RosterAddInput = {
  /** Əlavə edilməsi istənən profil id-ləri. */
  requested: ReadonlyArray<number>;
  /** Aktiv (təsdiqlənmiş, silinməmiş) və işçi olmayan tələbə profilləri. */
  eligibleIds: ReadonlySet<number>;
  /** Qrupun hazırkı təsdiqlənmiş görünən üzvləri. */
  visibleMemberIds: ReadonlyArray<number>;
  /** Eyni fənn + semestrin başqa qruplarında (gözləyən və ya təsdiqlənmiş) olan profillər. */
  otherGroupProfileIds: ReadonlySet<number>;
  /** Bu qrupa gözləyən seçimlər. */
  pendingProfileIds: ReadonlyArray<number>;
  capacity: number;
};

export type RosterPlan =
  | { ok: true; toAdd: number[] }
  | { ok: false; status: 400 | 409; error: string };

export function planRosterAdd(input: RosterAddInput): RosterPlan {
  const requested = input.requested.filter((id) => Number.isInteger(id) && id > 0);
  if (!requested.length) return { ok: false, status: 400, error: "Əlavə etmək üçün tələbə seçin." };
  if (new Set(requested).size !== requested.length) return { ok: false, status: 400, error: DUPLICATE_SELECTION_ERROR };
  if (requested.some((id) => !input.eligibleIds.has(id))) return { ok: false, status: 400, error: INACTIVE_STUDENT_ERROR };
  const members = new Set(input.visibleMemberIds);
  const toAdd = requested.filter((id) => !members.has(id));
  if (toAdd.some((id) => input.otherGroupProfileIds.has(id))) return { ok: false, status: 409, error: OTHER_GROUP_ERROR };
  const nextVisible = new Set([...members, ...toAdd]);
  if (input.capacity > 0 && nextVisible.size > input.capacity) return { ok: false, status: 400, error: capacityError(input.capacity) };
  const pendingOutside = input.pendingProfileIds.filter((id) => !nextVisible.has(id));
  if (input.capacity > 0 && new Set([...nextVisible, ...pendingOutside]).size > input.capacity) {
    return { ok: false, status: 409, error: fullGroupError(pendingOutside.length) };
  }
  return { ok: true, toAdd };
}

export type GroupCandidate = { profileId: number; unavailableReason: string | null; inGroup: boolean };

/** Seçici üçün: tələbə bu qrupdadırmı, yoxsa başqa qrupda olduğu üçün seçilə bilmir. */
export function candidateStatus(profileId: number, memberIds: ReadonlySet<number>, otherGroupProfileIds: ReadonlySet<number>): GroupCandidate {
  const inGroup = memberIds.has(profileId);
  return { profileId, inGroup, unavailableReason: !inGroup && otherGroupProfileIds.has(profileId) ? OTHER_GROUP_REASON : null };
}

/** Bütün qrupları idarə edən rollar: sahib, idarə heyəti, admin. Müəllim yalnız öz qruplarını görür. */
export function managesAllGroups(role: string, isSystemOwner = false) {
  return isSystemOwner || role === "owner" || role === "owner_assistant" || role === "admin";
}
