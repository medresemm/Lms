// Mədinə AI — tələbələr üçün «Xarici» axtarış (Şamilə / Dorar) ayarı.
//
// Ayar sistem sahibinin (SYSTEM_OWNER_EMAIL) Clerk publicMetadata-sında saxlanılır — rol icazələri
// (`rolePermissions`) ilə eyni üsul; verilənlər bazasında dəyişiklik tələb olunmur.
//   publicMetadata.medineAiStudentExternal = { shamela: boolean, dorar: boolean }
// Standart: hər ikisi söndürülüb. Yalnız sistem sahibi dəyişə bilər. Tələbə sorğusu serverdə yoxlanılır.
import type { ResearchIntent, ResearchKind, ResearchReply, ResearchSources } from "./research.js";
import { externalKinds, type ExternalTarget } from "./adminRouting.js";

export const STUDENT_EXTERNAL_METADATA_KEY = "medineAiStudentExternal";

export interface StudentExternalSetting {
  shamela: boolean;
  dorar: boolean;
}

export const STUDENT_EXTERNAL_DEFAULT: StudentExternalSetting = { shamela: false, dorar: false };

export function readStudentExternalSetting(metadata: unknown): StudentExternalSetting {
  const raw = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>)[STUDENT_EXTERNAL_METADATA_KEY] : null;
  if (!raw || typeof raw !== "object") return { ...STUDENT_EXTERNAL_DEFAULT };
  const value = raw as Record<string, unknown>;
  return { shamela: value.shamela === true, dorar: value.dorar === true };
}

export function studentExternalEnabled(setting: StudentExternalSetting) {
  return setting.shamela || setting.dorar;
}

export function allowedKinds(setting: StudentExternalSetting): ResearchKind[] {
  return [...(setting.shamela ? ["shamela" as const] : []), ...(setting.dorar ? ["dorar" as const] : [])];
}

/** PUT gövdəsi: { shamela: boolean, dorar: boolean } — başqa bir şey qəbul edilmir. */
export function parseStudentExternalInput(body: unknown): StudentExternalSetting | null {
  if (!body || typeof body !== "object") return null;
  const { shamela, dorar } = body as { shamela?: unknown; dorar?: unknown };
  if (typeof shamela !== "boolean" || typeof dorar !== "boolean") return null;
  return { shamela, dorar };
}

export function mergeStudentExternalMetadata(metadata: unknown, setting: StudentExternalSetting): Record<string, unknown> {
  const base = metadata && typeof metadata === "object" ? { ...(metadata as Record<string, unknown>) } : {};
  base[STUDENT_EXTERNAL_METADATA_KEY] = { shamela: setting.shamela, dorar: setting.dorar };
  return base;
}

export interface HandlerResult<T> {
  status: number;
  body: T | { error: string };
}

/** Ayarın dəyişdirilməsi: yalnız sistem sahibi. `save` yalnız icazə və düzgün giriş olduqda çağırılır. */
export async function updateStudentExternalSetting(
  input: { actorIsOwner: boolean; body: unknown; ownerMetadata: unknown },
  save: (metadata: Record<string, unknown>) => Promise<void>,
): Promise<HandlerResult<StudentExternalSetting>> {
  if (!input.actorIsOwner) return { status: 403, body: { error: "Bu ayarı yalnız sistem sahibi dəyişə bilər." } };
  const setting = parseStudentExternalInput(input.body);
  if (!setting) return { status: 400, body: { error: "Ayar düzgün göndərilməyib." } };
  await save(mergeStudentExternalMetadata(input.ownerMetadata, setting));
  return { status: 200, body: setting };
}

export interface StudentExternalReply {
  mode: "external";
  reply: string;
  suggestions: string[];
  sources: ResearchSources[];
}

const STUDENT_EXAMPLES = ["إنما الأعمال بالنيات", "طلب العلم فريضة", "فضل الصبر"];

/**
 * Tələbənin «Xarici» sorğusu. Ayar söndürülübsə və ya seçilmiş mənbə bağlıdırsa — 403, xarici sayta
 * müraciət edilmir. Akademiya məlumatlarına bu yolda heç vaxt baxılmır.
 */
export async function routeStudentExternal(
  input: { message: string; target: ExternalTarget },
  setting: StudentExternalSetting,
  research: (intent: ResearchIntent) => Promise<ResearchReply>,
): Promise<HandlerResult<StudentExternalReply>> {
  const allowed = allowedKinds(setting);
  if (!allowed.length) return { status: 403, body: { error: "Xarici axtarış tələbələr üçün hazırda söndürülüb." } };
  if (input.target !== "all" && !allowed.includes(input.target)) {
    return { status: 403, body: { error: "Seçilmiş xarici mənbə tələbələr üçün açıq deyil." } };
  }
  const { kinds, query } = externalKinds(input.message, input.target === "all" ? "all" : input.target);
  const permitted = kinds.filter((kind) => allowed.includes(kind));
  if (!query) {
    return { status: 200, body: { mode: "external", reply: "Axtarış üçün ən azı 2 simvol yazın (ərəbcə açar sözlər ən yaxşı nəticə verir).", suggestions: STUDENT_EXAMPLES, sources: [] } };
  }
  if (!permitted.length) {
    const open = allowed.map((kind) => (kind === "shamela" ? "Şamilə" : "Hədis (Dorar)")).join(", ");
    return { status: 200, body: { mode: "external", reply: `Bu mənbə tələbələr üçün açıq deyil. Açıq olan: ${open}.`, suggestions: STUDENT_EXAMPLES, sources: [] } };
  }
  const results = await Promise.all(permitted.map((kind) => research({ kind, query })));
  return {
    status: 200,
    body: {
      mode: "external",
      reply: results.map((result) => result.reply).join("\n\n"),
      suggestions: STUDENT_EXAMPLES.filter((example) => example !== query),
      sources: results.map((result) => result.sources),
    },
  };
}
