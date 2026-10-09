// Mədinə AI (heyət rejimi) — «Daxili» / «Xarici» mənbə rejimlərinin server tərəfində tətbiqi.
//
// - Daxili (internal): yalnız LMS məlumatları. Xarici mənbələrə (Şamilə, Dorar) HEÇ VAXT müraciət edilmir —
//   mətn Şamilə/Dorar əmrinə oxşasa belə, yalnız «Xarici rejimə keçin» ipucu qaytarılır.
// - Xarici (external): yalnız qoşulmuş xarici mənbələr. LMS məlumatlarına HEÇ VAXT müraciət edilmir.
//   Yazılan mətn axtarılır: standart Şamilə; «hədis yoxla …», «dorar …» kimi əmrlər və ya «Hədis (Dorar)»
//   seçimi Dorar-a, «Hamısı» isə hər iki mənbəyə göndərilir (nəticələr qruplaşdırılır).
import type { AiReply } from "./aiProvider.js";
import { cleanQuery, detectResearchIntent, type ResearchIntent, type ResearchKind, type ResearchReply, type ResearchSources } from "./research.js";
import { findGuideTopic, guideReply } from "./siteGuide.js";
import { parse } from "./text.js";

export type AiSourceMode = "internal" | "external";
export type ExternalTarget = "shamela" | "dorar" | "all";

export const SOURCE_MODES: readonly AiSourceMode[] = ["internal", "external"];
export const EXTERNAL_TARGETS: readonly ExternalTarget[] = ["shamela", "dorar", "all"];

export interface AdminReply extends AiReply {
  mode: AiSourceMode;
  sources?: ResearchSources[];
}

/** Sorğu gövdəsindən rejimi oxuyur. Göndərilməyibsə: daxili / Şamilə. Yanlış dəyər → null (400). */
export function parseSourceSelection(body: unknown): { mode: AiSourceMode; target: ExternalTarget } | null {
  const { source, target } = (body && typeof body === "object" ? body : {}) as { source?: unknown; target?: unknown };
  const mode = source === undefined || source === null ? "internal" : source;
  const sub = target === undefined || target === null ? "shamela" : target;
  if (!SOURCE_MODES.includes(mode as AiSourceMode) || !EXTERNAL_TARGETS.includes(sub as ExternalTarget)) return null;
  return { mode: mode as AiSourceMode, target: sub as ExternalTarget };
}

export interface AdminRoutingInput {
  message: string;
  mode: AiSourceMode;
  target: ExternalTarget;
  /** Sahib və ya «students» icazəsi olan heyət üzvü. */
  canReadLms: boolean;
}

export interface AdminRoutingDeps {
  /** LMS məlumatları ilə daxili cavab (yalnız daxili rejimdə çağırılır). */
  internal: () => Promise<AiReply>;
  /** Xarici mənbə axtarışı (yalnız xarici rejimdə çağırılır). */
  research: (intent: ResearchIntent) => Promise<ResearchReply>;
}

const EXTERNAL_EXAMPLES = ["إنما الأعمال بالنيات", "طلب العلم فريضة", "فضل الصبر"];

export function externalKinds(message: string, target: ExternalTarget): { kinds: ResearchKind[]; query: string } {
  const intent = detectResearchIntent(message);
  const query = intent?.query ?? cleanQuery(message);
  if (target === "all") return { kinds: ["shamela", "dorar"], query };
  if (intent) return { kinds: [intent.kind], query };
  return { kinds: [target], query };
}

export async function routeAdminMessage(input: AdminRoutingInput, deps: AdminRoutingDeps): Promise<AdminReply> {
  if (input.mode === "external") {
    const { kinds, query } = externalKinds(input.message, input.target);
    if (!query) {
      return { mode: "external", reply: "Axtarış üçün ən azı 2 simvol yazın (ərəbcə açar sözlər ən yaxşı nəticə verir).", suggestions: EXTERNAL_EXAMPLES };
    }
    const results = await Promise.all(kinds.map((kind) => deps.research({ kind, query })));
    return {
      mode: "external",
      reply: results.map((result) => result.reply).join("\n\n"),
      suggestions: EXTERNAL_EXAMPLES.filter((example) => example !== query),
      sources: results.map((result) => result.sources),
    };
  }

  if (detectResearchIntent(input.message)) {
    return {
      mode: "internal",
      reply: "Bu, xarici mənbə (Şamilə / Dorar) sorğusuna oxşayır. «Daxili» rejimdə yalnız LMS məlumatlarında axtarıram və xarici saytlara müraciət etmirəm.\n\nŞamilə və ya Dorar-da axtarmaq üçün yuxarıdakı «Xarici» rejimə keçin.",
      suggestions: [],
    };
  }
  if (!input.canReadLms) {
    const topic = findGuideTopic(parse(input.message, true), "admin");
    if (topic && (topic.id === "admin-research" || topic.id === "ai")) return { mode: "internal", ...guideReply(topic) };
    return {
      mode: "internal",
      reply: "Bağışlayın, LMS məlumatlarına (tələbələr, dərslər, qiymətlər və s.) baxmaq üçün «Tələbələr» icazəsi lazımdır. Bunun üçün idarəçiyə müraciət edin.\n\nŞamilə kitabxanasında və Dorar hədis bazasında axtarmaq üçün yuxarıdakı «Xarici» rejimə keçin.",
      suggestions: [],
    };
  }
  return { mode: "internal", ...(await deps.internal()) };
}
