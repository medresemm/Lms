// Mədinə AI — strukturlu cavab blokları.
//
// Daxili cavablar (Akademiya məlumatları, bələdçi, dərs kitabları) brauzerə həm düz mətn (`reply` — köhnə
// müştərilər və tarixçə üçün), həm də kart blokları (`blocks`) kimi göndərilir. Brauzer blokları
// Şamilə/Dorar kartları ilə eyni üslubda göstərir. Bloklarda yalnız insan dilində mətn olur: sahə adı,
// identifikator və ya texniki söz yoxdur.
import type { AiReply } from "./aiProvider.js";

export type AiTone = "default" | "good" | "warn" | "muted";

export interface AiRow { label: string; value: string }
export interface AiItem {
  title: string;
  /** Başlığın altındakı qısa izah. */
  detail?: string;
  /** Kiçik xırda məlumatlar (saat, müəllim, tarix…). */
  meta?: string[];
  badge?: { text: string; tone?: AiTone };
  /** Saytdaxili və ya xarici keçid (məs. «Oxu», «Dərsə qoşul»). */
  action?: { label: string; href: string };
}

export type AiBlock =
  | { type: "text"; text: string; tone?: AiTone }
  | { type: "card"; title?: string; subtitle?: string; badge?: { text: string; tone?: AiTone }; rows?: AiRow[]; items?: AiItem[]; note?: string }
  | { type: "steps"; title?: string; steps: string[]; tips?: string[] }
  | { type: "table"; title?: string; columns: string[]; rows: string[][]; note?: string };

export interface AiStructuredReply extends AiReply {
  blocks?: AiBlock[];
}

const MAX_BLOCKS = 24;
const MAX_ITEMS = 60;

// ---------------------------------------------------------------------------
// Bloklar → düz mətn (köhnə müştərilər, kopyalama, tarixçə)

function itemLine(item: AiItem) {
  const tail = [item.detail, ...(item.meta ?? []), item.badge?.text].filter(Boolean).join(" · ");
  const link = item.action ? ` ${item.action.href}` : "";
  return `• ${item.title}${tail ? ` — ${tail}` : ""}${link}`;
}

export function blocksToText(blocks: AiBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    const lines: string[] = [];
    if (block.type === "text") lines.push(block.text);
    if (block.type === "card") {
      if (block.title) lines.push(`${block.title}${block.badge ? ` (${block.badge.text})` : ""}${block.subtitle ? ` — ${block.subtitle}` : ""}`);
      for (const row of block.rows ?? []) lines.push(`• ${row.label}: ${row.value}`);
      for (const item of block.items ?? []) lines.push(itemLine(item));
      if (block.note) lines.push(block.note);
    }
    if (block.type === "steps") {
      if (block.title) lines.push(`${block.title}:`);
      block.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
      for (const tip of block.tips ?? []) lines.push(`• ${tip}`);
    }
    if (block.type === "table") {
      if (block.title) lines.push(`${block.title}:`);
      for (const row of block.rows) lines.push(`• ${row.map((cell, index) => (index === 0 ? cell : `${block.columns[index]}: ${cell}`)).join(" · ")}`);
      if (block.note) lines.push(block.note);
    }
    if (lines.length) parts.push(lines.join("\n"));
  }
  return parts.join("\n\n").trim();
}

/** Bloklardan cavab: `reply` avtomatik düz mətn kimi qurulur. */
export function blockReply(blocks: Array<AiBlock | null | undefined | false>, suggestions: string[] = []): AiStructuredReply {
  const clean = blocks.filter((block): block is AiBlock => Boolean(block)).slice(0, MAX_BLOCKS);
  return { reply: blocksToText(clean), suggestions: suggestions.slice(0, 4), blocks: clean };
}

// ---------------------------------------------------------------------------
// Köhnə düz mətn cavabları → bloklar (əl ilə yazılmamış bütün daxili cavablar üçün)

const BULLET = /^\s*[•\-–]\s+/;
const MORE = /^…\s*və daha (\d+)/;

function parseItem(raw: string): AiItem | AiRow {
  const text = raw.replace(BULLET, "").trim();
  const dash = text.indexOf(" — ");
  if (dash > 0) {
    const [first, ...rest] = text.slice(dash + 3).split(" · ").map((part) => part.trim()).filter(Boolean);
    const title = text.slice(0, dash).trim();
    // «T0013 — Əli Məmmədov · …»: başlıq adam adı olsun, tələbə nömrəsi kiçik məlumat kimi.
    if (/^T\d{3,}$/.test(title) && first) return { title: first, meta: [title, ...rest] };
    return { title, detail: first, meta: rest.length ? rest : undefined };
  }
  // «Etiket: dəyər» — qısa etiket varsa sətir kimi.
  const colon = /^([^:]{2,32}):\s+(.+)$/.exec(text);
  if (colon && !/https?$/i.test(colon[1])) return { label: colon[1].trim(), value: colon[2].trim() };
  const [title, ...meta] = text.split(" · ").map((part) => part.trim()).filter(Boolean);
  return { title, meta: meta.length ? meta : undefined };
}

function isRow(value: AiItem | AiRow): value is AiRow {
  return "label" in value;
}

export function textToBlocks(text: string): AiBlock[] {
  const sections = text.replace(/\r/g, "").split(/\n\s*(?:— — —\s*)?\n/).map((section) => section.trim()).filter(Boolean);
  const blocks: AiBlock[] = [];
  for (const section of sections) {
    const lines = section.split("\n").map((line) => line.replace(/\s+$/, "")).filter((line) => line.trim());
    const firstBullet = lines.findIndex((line) => BULLET.test(line) || /^\d+\.\s/.test(line));
    if (firstBullet < 0) {
      blocks.push({ type: "text", text: lines.join("\n") });
      continue;
    }
    const lead = lines.slice(0, firstBullet);
    const body = lines.slice(firstBullet);
    // Nömrələnmiş addımlar.
    if (/^\d+\.\s/.test(body[0])) {
      const steps = body.filter((line) => /^\d+\.\s/.test(line)).map((line) => line.replace(/^\d+\.\s+/, ""));
      const tips = body.filter((line) => BULLET.test(line)).map((line) => line.replace(BULLET, ""));
      if (lead.length > 1) blocks.push({ type: "text", text: lead.slice(0, -1).join("\n") });
      blocks.push({ type: "steps", title: lead.length ? lead[lead.length - 1].replace(/:\s*$/, "") : undefined, steps, tips: tips.length ? tips : undefined });
      continue;
    }
    const rows: AiRow[] = [];
    const items: AiItem[] = [];
    const notes: string[] = [];
    for (const line of body) {
      if (BULLET.test(line)) {
        const parsed = parseItem(line);
        if (isRow(parsed)) rows.push(parsed);
        else items.push(parsed);
      } else if (MORE.test(line.trim())) {
        notes.push(line.trim());
      } else if (/^\s{2,}/.test(line) && (items.length || rows.length)) {
        // Əvvəlki elementin davamı (məs. izah və ya link).
        const extra = line.trim();
        const target = items[items.length - 1];
        if (target) {
          const link = /^Link:\s*(\S+)$/i.exec(extra);
          if (link) target.action = { label: "Linki aç", href: link[1] };
          else target.detail = target.detail ? `${target.detail} · ${extra}` : extra;
        } else rows[rows.length - 1].value += ` ${extra}`;
      } else {
        notes.push(line.trim());
      }
    }
    const heading = lead.length ? lead[lead.length - 1] : undefined;
    if (lead.length > 1) blocks.push({ type: "text", text: lead.slice(0, -1).join("\n") });
    blocks.push({
      type: "card",
      title: heading?.replace(/:\s*$/, ""),
      rows: rows.length ? rows : undefined,
      items: items.length ? items.slice(0, MAX_ITEMS) : undefined,
      note: notes.length ? notes.join(" ") : undefined,
    });
  }
  return blocks.slice(0, MAX_BLOCKS);
}

/** Daxili cavabda blok yoxdursa, düz mətndən qurulur. */
export function ensureBlocks<T extends AiReply & { blocks?: AiBlock[] }>(result: T): T & { blocks: AiBlock[] } {
  if (Array.isArray(result.blocks) && result.blocks.length) return result as T & { blocks: AiBlock[] };
  return { ...result, blocks: textToBlocks(result.reply) };
}

// ---------------------------------------------------------------------------
// Dil yoxlaması (testlər üçün): texniki söz, sahə adı, ingiliscə söz olmamalıdır.

export const FORBIDDEN_COPY = [
  /\bLMS\b/i, /\bnull\b/, /\bundefined\b/, /\bNaN\b/, /\[object /, /\btrue\b/, /\bfalse\b/,
  /\b(?:courseId|termNumber|profileId|studentNumber|userId|clerk\w*|status|submission\w*|resourceId)\b/,
  /\b(?:graded|pending|approved|rejected|resubmission_requested|open|closed|present|absent|late|excused)\b/,
  /\bID\b/, /\bN\/A\b/, /\bResult\b/i, /\bNəticə:\s*\d+\s*qeyd/,
];

export function copyProblems(value: unknown): string[] {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  // JSON açarları (type, title, rows…) yoxlanmır — yalnız dəyərlər.
  const values = typeof value === "string" ? [text] : collectStrings(value);
  const problems: string[] = [];
  for (const item of values) {
    for (const pattern of FORBIDDEN_COPY) if (pattern.test(item)) problems.push(`${pattern} → «${item.slice(0, 80)}»`);
  }
  return problems;
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      // Keçidlər və ton dəyərləri istifadəçiyə mətn kimi göstərilmir.
      if (key === "href" || key === "tone" || key === "type") continue;
      collectStrings(item, out);
    }
  }
  return out;
}
