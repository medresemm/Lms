// Birgə tədris: lms_resource_teachers cədvəli. Cədvəl hələ yaradılmayıbsa (manual SQL işə salınmayıb),
// oxuma boş xəritə qaytarır (sayt əvvəlki kimi tək müəllimlə işləyir), yazma isə aydın mesajla 503 verir.
import { db, resourceTeachersTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { describeDbError, isMissingTableError } from "./library/uploads.js";
import { resourceTeacherIds, userTeachesResourceWith, type CoTeacherMap, type ResourceTeacherRef } from "./resourceTeachersCore.js";

export * from "./resourceTeachersCore.js";

export const RESOURCE_TEACHERS_TABLE = "lms_resource_teachers";
export const RESOURCE_TEACHERS_TABLE_MISSING_MESSAGE =
  "Bir qrupa bir neçə müəllim əlavə etmək hələ aktiv deyil: verilənlər bazasında «lms_resource_teachers» cədvəli yaradılmayıb. Sahib lib/db/manual-sql/2026-10-10-resource-teachers.sql faylını Supabase SQL Editor-da işə salmalıdır.";

export function isMissingResourceTeachersTable(error: unknown) {
  return isMissingTableError(error, RESOURCE_TEACHERS_TABLE);
}

const CACHE_MS = 4_000;
const MISSING_CACHE_MS = 5_000;
let cache: { at: number; available: boolean; map: Map<number, string[]> } | null = null;
let inFlight: Promise<{ available: boolean; map: Map<number, string[]> }> | null = null;

export function invalidateCoTeacherCache() {
  cache = null;
}

async function loadAll() {
  try {
    const rows = await db.select({ resourceId: resourceTeachersTable.resourceId, teacherClerkUserId: resourceTeachersTable.teacherClerkUserId })
      .from(resourceTeachersTable)
      .orderBy(resourceTeachersTable.id);
    const map = new Map<number, string[]>();
    for (const row of rows) {
      const list = map.get(row.resourceId) ?? [];
      if (!list.includes(row.teacherClerkUserId)) list.push(row.teacherClerkUserId);
      map.set(row.resourceId, list);
    }
    return { available: true, map };
  } catch (error) {
    if (isMissingResourceTeachersTable(error)) return { available: false, map: new Map<number, string[]>() };
    console.error("[co-teachers] lms_resource_teachers oxunarkən xəta:", describeDbError(error));
    // Əlavə müəllim məlumatı oxunmasa da sayt işləməlidir: yalnız əsas müəllimlər qalır.
    return { available: false, map: new Map<number, string[]>() };
  }
}

/** Bütün qrupların əlavə müəllimləri (resourceId → clerk id-lər). Kiçik cədvəldir, qısa müddət yaddaşda saxlanılır. */
export async function loadCoTeachers(): Promise<{ available: boolean; map: CoTeacherMap }> {
  const now = Date.now();
  if (cache && now - cache.at < (cache.available ? CACHE_MS : MISSING_CACHE_MS)) return cache;
  if (!inFlight) {
    inFlight = loadAll().then((value) => {
      cache = { at: Date.now(), ...value };
      return value;
    }).finally(() => { inFlight = null; });
  }
  return inFlight;
}

export async function coTeacherMap(): Promise<CoTeacherMap> {
  return (await loadCoTeachers()).map;
}

export async function teacherIdsForResource(resource: ResourceTeacherRef) {
  return resourceTeacherIds(resource, await coTeacherMap());
}

/** İstifadəçi bu qrupun (əsas və ya əlavə) müəllimidirmi. */
export async function userTeachesResource(userId: string | null | undefined, resource: ResourceTeacherRef) {
  if (!userId) return false;
  if (resource.teacherClerkUserId === userId) return true;
  return userTeachesResourceWith(userId, resource, await coTeacherMap());
}

/** İstifadəçinin əlavə müəllim olduğu qrupların id-ləri. */
export async function coTaughtResourceIds(userId: string): Promise<number[]> {
  const map = await coTeacherMap();
  const ids: number[] = [];
  for (const [resourceId, teachers] of map) if (teachers.includes(userId)) ids.push(resourceId);
  return ids;
}

/** Qrupun əlavə müəllimlərini verilən siyahı ilə əvəz edir. Cədvəl yoxdursa xəta atır (isMissingResourceTeachersTable). */
export async function replaceCoTeachers(resourceId: number, coTeacherIds: readonly string[], actorId: string) {
  try {
    await db.transaction(async (tx) => {
      const existing = await tx.select().from(resourceTeachersTable).where(eq(resourceTeachersTable.resourceId, resourceId));
      const remove = existing.filter((row) => !coTeacherIds.includes(row.teacherClerkUserId)).map((row) => row.id);
      if (remove.length) await tx.delete(resourceTeachersTable).where(inArray(resourceTeachersTable.id, remove));
      const keep = new Set(existing.map((row) => row.teacherClerkUserId));
      const add = coTeacherIds.filter((id) => !keep.has(id));
      if (add.length) {
        await tx.insert(resourceTeachersTable)
          .values(add.map((teacherClerkUserId) => ({ resourceId, teacherClerkUserId, addedByClerkUserId: actorId })))
          .onConflictDoNothing({ target: [resourceTeachersTable.resourceId, resourceTeachersTable.teacherClerkUserId] });
      }
    });
  } finally {
    invalidateCoTeacherCache();
  }
}

/** Qrup silinəndə onun əlavə müəllimlərini təmizləyir (cədvəl yoxdursa səssizcə keçir). */
export async function deleteCoTeachersForResource(resourceId: number) {
  try {
    await db.delete(resourceTeachersTable).where(eq(resourceTeachersTable.resourceId, resourceId));
  } catch (error) {
    if (!isMissingResourceTeachersTable(error)) throw error;
  } finally {
    invalidateCoTeacherCache();
  }
}

export async function removeCoTeacher(resourceId: number, teacherClerkUserId: string) {
  try {
    await db.delete(resourceTeachersTable).where(and(eq(resourceTeachersTable.resourceId, resourceId), eq(resourceTeachersTable.teacherClerkUserId, teacherClerkUserId)));
  } finally {
    invalidateCoTeacherCache();
  }
}
