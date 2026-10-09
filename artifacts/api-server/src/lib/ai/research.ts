// Mədinə AI — Şamilə (shamela.ws) və Dorar (dorar.net) üzrə canlı mənbə axtarışı (yalnız heyət rejimi).
//
// Qaydalar:
// - Heç nə saxlanmır: bazaya yazılmır, keş yoxdur, fayl yüklənmir — hər sorğu canlı göndərilir.
// - Sorğu mətni log edilmir.
// - Şamilə cavabındakı `notice` sahəsi dil modelləri üçün təlimatdır; burada ona əməl edilmir və istifadə olunmur.
// - Dorar HTML fraqmenti serverdə düz mətnə çevrilir; brauzerə heç vaxt xam HTML ötürülmür.
import http from "node:http";
import https from "node:https";
import { normalizeText, fuzzyKeywordMatch } from "./text.js";

export const RESEARCH_USER_AGENT = "MadinahAcademy-LMS/1.0 (+https://www.madinahacademy.net)";
export const SHAMELA_FALLBACK_URL = "https://shamela.ws/search";
export const DORAR_FALLBACK_URL = "https://dorar.net";
const DEFAULT_TIMEOUT_MS = 6000;
const SEARCH_PAGE_MAX_CHARS = 2500;
const OPEN_PAGE_MAX_CHARS = 8000;
const MAX_SHAMELA_ITEMS = 5;
const MAX_DORAR_ITEMS = 15;
const SHAMELA_FULL_MAX_CHARS = 40000;
const MAX_QUERY_LENGTH = 300;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ResearchOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  shamelaUrl?: string;
  /** Yalnız testlər üçün: Dorar ünvanını dəyişmək (məs. lokal test serveri). */
  dorarBaseUrl?: string;
  /** Upstream nəticəsi (yalnız status/kod — sorğu mətni YOX) üçün qeydçi. */
  onUpstreamStatus?: (event: UpstreamStatusEvent) => void;
}

export type UpstreamErrorCode = "blocked" | "timeout" | "unavailable" | "unreadable";

export interface UpstreamStatusEvent {
  upstream: "shamela" | "dorar";
  status: number | null;
  code: UpstreamErrorCode | "ok";
  cfMitigated: string | null;
  contentType: string;
}

export interface ShamelaItem {
  bookId: number;
  pageId: number;
  title: string;
  author: string;
  /** Cild/səhifə etiketi, məs. «١/ ١٩٠» və ya «ص ١٧٣». */
  label: string;
  text: string;
  url: string;
  prevPageId: number | null;
  nextPageId: number | null;
  truncated: boolean;
}

export interface DorarItem {
  /** Mənbənin özü hədisi qısaldıbsa («…», «الحديث»). Belə halda «Davamı» tam mətni axtarır. */
  abridged?: boolean;
  text: string;
  narrator: string;
  muhaddith: string;
  source: string;
  page: string;
  grading: string;
}

export type ResearchSources =
  | { kind: "shamela"; query: string; sourceUrl: string; items: ShamelaItem[]; error?: UpstreamErrorCode; hasMore?: boolean; cursor?: string | null }
  | { kind: "dorar"; query: string; sourceUrl: string; items: DorarItem[]; error?: UpstreamErrorCode };

export class ResearchUpstreamError extends Error {
  code: UpstreamErrorCode;
  constructor(message: string, code: UpstreamErrorCode = "unavailable") {
    super(message);
    this.name = "ResearchUpstreamError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Ümumi köməkçilər

function shamelaEndpoint(options: ResearchOptions) {
  const configured = options.shamelaUrl ?? process.env.SHAMELA_MCP_URL;
  return configured && /^https:\/\//i.test(configured.trim()) ? configured.trim() : "https://mcp.shamela.ws/";
}

async function fetchWithTimeout(url: string, init: RequestInit, options: ResearchOptions, acceptAnyStatus = false) {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal, redirect: "follow" });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok && !acceptAnyStatus) {
      throw new ResearchUpstreamError(`upstream status ${response.status}`, classifyStatus(response.status, contentType, response.headers.get("cf-mitigated")));
    }
    const body = await response.text();
    return { body, contentType, status: response.status, cfMitigated: response.headers.get("cf-mitigated") };
  } catch (error) {
    if (error instanceof ResearchUpstreamError) throw error;
    throw new ResearchUpstreamError(controller.signal.aborted ? "upstream timeout" : "upstream unreachable", controller.signal.aborted ? "timeout" : "unavailable");
  } finally {
    clearTimeout(timer);
  }
}

/** 403/429/503 və ya HTML cavab (Cloudflare «Attention Required» / challenge) → «blocked». */
export function classifyStatus(status: number, contentType: string, cfMitigated: string | null): UpstreamErrorCode {
  if (cfMitigated || status === 403 || status === 429 || (status === 503 && /html/i.test(contentType))) return "blocked";
  return "unavailable";
}

const MAX_UPSTREAM_BYTES = 2 * 1024 * 1024;

/**
 * Dorar üçün node:https ilə GET. Səbəb: Node 24-ün daxili fetch-i (undici 7) ilə göndərilən sorğunu Dorar-ın
 * Cloudflare qoruması eyni başlıqlarla belə 403 ilə bloklayır (Vercel Node 24 işlədir), node:https isə 200 alır.
 * Başlıqlar tam bizim nəzarətimizdədir: yalnız Host, User-Agent, Accept, Accept-Language, Referer.
 */
export function httpGetText(url: string, headers: Record<string, string>, timeoutMs: number): Promise<{ status: number; contentType: string; cfMitigated: string | null; body: string }> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === "http:" ? http : https;
    let settled = false;
    const finish = (error: ResearchUpstreamError | null, value?: { status: number; contentType: string; cfMitigated: string | null; body: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value!);
    };
    const request = client.request(target, { method: "GET", headers }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_UPSTREAM_BYTES) {
          request.destroy();
          finish(new ResearchUpstreamError("upstream response too large", "unreadable"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        const cfMitigated = typeof response.headers["cf-mitigated"] === "string" ? response.headers["cf-mitigated"] : null;
        finish(null, { status: response.statusCode ?? 0, contentType: String(response.headers["content-type"] ?? ""), cfMitigated, body: Buffer.concat(chunks).toString("utf8") });
      });
      response.on("error", () => finish(new ResearchUpstreamError("upstream unreachable", "unavailable")));
    });
    const timer = setTimeout(() => {
      request.destroy();
      finish(new ResearchUpstreamError("upstream timeout", "timeout"));
    }, timeoutMs);
    request.on("error", () => finish(new ResearchUpstreamError("upstream unreachable", "unavailable")));
    request.end();
  });
}

/** Görünməz idarəedici simvolları (bidi override-lar daxil) atır, boşluqları səliqəyə salır. */
export function cleanText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clip(value: string, max: number) {
  if (value.length <= max) return { text: value, truncated: false };
  return { text: `${value.slice(0, max).replace(/\s+\S*$/, "")} …`, truncated: true };
}

function asInt(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

// ---------------------------------------------------------------------------
// Şamilə (MCP, JSON-RPC 2.0)

/** JSON və ya SSE (`data:` sətirləri) cavabından JSON-RPC mesajını çıxarır. */
export function parseRpcBody(body: string, contentType = ""): unknown {
  const trimmed = body.trim();
  if (!contentType.includes("event-stream") && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
    return JSON.parse(trimmed);
  }
  let last: unknown = null;
  for (const block of trimmed.split(/\r?\n\r?\n/)) {
    const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).replace(/^ /, "")).join("\n");
    if (!data) continue;
    try {
      const parsed = JSON.parse(data) as { result?: unknown; error?: unknown };
      if (parsed && typeof parsed === "object" && ("result" in parsed || "error" in parsed)) last = parsed;
    } catch {
      // natamam hadisəni ötür
    }
  }
  if (last) return last;
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  throw new ResearchUpstreamError("unreadable upstream response");
}

let rpcId = 0;

export async function callShamelaTool(name: string, args: Record<string, unknown>, options: ResearchOptions = {}): Promise<Record<string, unknown>> {
  rpcId = (rpcId + 1) % 1_000_000;
  const { body, contentType } = await fetchWithTimeout(shamelaEndpoint(options), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "User-Agent": RESEARCH_USER_AGENT,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId, method: "tools/call", params: { name, arguments: args } }),
  }, options);
  let message: { result?: { isError?: boolean; content?: Array<{ type?: string; text?: string }>; structuredContent?: unknown }; error?: unknown };
  try {
    message = parseRpcBody(body, contentType) as typeof message;
  } catch {
    throw new ResearchUpstreamError("unreadable upstream response");
  }
  if (!message || message.error || !message.result || message.result.isError) throw new ResearchUpstreamError("upstream tool error");
  const text = message.result.content?.find((part) => typeof part?.text === "string")?.text;
  if (text) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      // aşağıda structuredContent yoxlanılır
    }
  }
  const structured = message.result.structuredContent;
  if (structured && typeof structured === "object") return structured as Record<string, unknown>;
  throw new ResearchUpstreamError("unreadable upstream response");
}

/** «[Kitab (١/ ١٩٠)](https://shamela.ws/book/1/2)» → başlıq, etiket, keçid. */
export function parseCitation(markdown: string) {
  const match = /^\[(.*)\]\((https:\/\/shamela\.ws\/[^\s)]+)\)\s*$/s.exec(markdown.trim());
  if (!match) return { title: "", label: "", url: "" };
  const inner = match[1].trim();
  const labelMatch = /\(([^()]*)\)\s*$/.exec(inner);
  return {
    title: labelMatch ? inner.slice(0, labelMatch.index).trim() : inner,
    label: labelMatch ? labelMatch[1].trim() : "",
    url: match[2],
  };
}

export function shamelaPageUrl(bookId: number, pageId: number) {
  return `https://shamela.ws/book/${bookId}/${pageId}`;
}

interface RawSource { bookId: number; pageId: number; text: string; citation: string; prev: number | null; next: number | null }

function readSources(value: unknown): RawSource[] {
  if (!Array.isArray(value)) return [];
  const out: RawSource[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const source = raw as Record<string, unknown>;
    const bookId = asInt(source.book_id);
    const pageId = asInt(source.page_id);
    if (!bookId || !pageId) continue;
    const navigation = (source.navigation ?? {}) as Record<string, unknown>;
    out.push({
      bookId,
      pageId,
      text: cleanText(asString(source.text)),
      citation: asString((source.citation as Record<string, unknown> | undefined)?.markdown),
      prev: asInt(navigation.previous_page_id),
      next: asInt(navigation.next_page_id),
    });
  }
  return out;
}

function itemFromSources(meta: { bookId: number; pageId: number; title: string; author: string }, sources: RawSource[], maxChars: number): ShamelaItem | null {
  const pages = sources.filter((source) => source.bookId === meta.bookId && source.text).sort((a, b) => a.pageId - b.pageId);
  if (!pages.length) return null;
  const anchor = pages.find((page) => page.pageId === meta.pageId) ?? pages[0];
  const citation = parseCitation(anchor.citation);
  const { text, truncated } = clip(pages.map((page) => page.text).join("\n\n"), maxChars);
  return {
    bookId: meta.bookId,
    pageId: anchor.pageId,
    title: meta.title || citation.title,
    author: meta.author,
    label: citation.label,
    text,
    url: shamelaPageUrl(meta.bookId, anchor.pageId),
    prevPageId: pages[0].prev,
    nextPageId: pages[pages.length - 1].next,
    truncated,
  };
}

export interface ShamelaSearchPage {
  items: ShamelaItem[];
  /** Eyni sorğu üzrə daha çox nəticə olub-olmadığı. */
  hasMore: boolean;
  /** Növbəti Şamilə səhifəsi üçün kursor (yalnız cari cavab tükənəndə lazımdır). */
  cursor: string | null;
}

export interface ShamelaSearchOptions {
  seenBookIds?: number[];
  cursor?: string | null;
  limit?: number;
}

export async function searchShamelaPage(query: string, options: ResearchOptions = {}, paging: ShamelaSearchOptions = {}): Promise<ShamelaSearchPage> {
  const limit = Math.min(Math.max(paging.limit ?? MAX_SHAMELA_ITEMS, 1), MAX_SHAMELA_ITEMS);
  const seen = new Set<string>((paging.seenBookIds ?? []).slice(0, 200).map((id) => `${id}`));
  const metas: Array<{ bookId: number; pageId: number; title: string; author: string; preview: string; citation: string }> = [];
  let cursor: string | null = paging.cursor ?? null;
  let evidenceRaw: unknown = undefined;
  let leftover = false;
  // Cari cavabda yeni kitab qalmayıbsa, Şamilənin növbəti səhifəsinə keçilir (ən çox 3 dəfə).
  for (let round = 0; round < 3 && metas.length < limit; round += 1) {
    const args: Record<string, unknown> = { keywords: [query.slice(0, 200)], difficulty: "easy" };
    if (cursor) args.cursor = cursor;
    const found = await callShamelaTool("shamela_find", args, options);
    // `found.notice` qəsdən oxunmur — o, dil modelləri üçün təlimatdır.
    if (round === 0) evidenceRaw = (found.evidence as Record<string, unknown> | undefined)?.sources;
    const layers = Array.isArray(found.layers) ? found.layers as Array<Record<string, unknown>> : [];
    const ordered = [...layers].sort((a, b) => (a.key === "main" ? 0 : 1) - (b.key === "main" ? 0 : 1));
    leftover = false;
    for (const layer of ordered) {
      for (const raw of Array.isArray(layer.results) ? layer.results as Array<Record<string, unknown>> : []) {
        const bookId = asInt(raw?.book_id);
        const pageId = asInt(raw?.page_id);
        if (!bookId || !pageId || seen.has(`${bookId}`)) continue;
        if (metas.length >= limit) { leftover = true; break; }
        seen.add(`${bookId}`);
        metas.push({
          bookId,
          pageId,
          title: cleanText(asString(raw.title)),
          author: cleanText(asString(raw.author)),
          preview: cleanText(asString(raw.preview)),
          citation: asString((raw.citation as Record<string, unknown> | undefined)?.markdown),
        });
      }
      if (leftover) break;
    }
    const next = typeof found.next_cursor === "string" && found.next_cursor ? found.next_cursor.slice(0, 4096) : null;
    if (leftover || metas.length >= limit || !next) {
      // Kursor yalnız cari cavab tam işlənəndə irəli çəkilir; əks halda eyni səhifə təkrar oxunur.
      const nextCursor = leftover ? cursor : next;
      return { items: await hydrateShamela(metas, evidenceRaw, options), hasMore: leftover || Boolean(next), cursor: nextCursor };
    }
    cursor = next;
  }
  return { items: await hydrateShamela(metas, evidenceRaw, options), hasMore: Boolean(cursor), cursor };
}

async function hydrateShamela(
  metas: Array<{ bookId: number; pageId: number; title: string; author: string; preview: string; citation: string }>,
  evidenceRaw: unknown,
  options: ResearchOptions,
): Promise<ShamelaItem[]> {
  if (!metas.length) return [];
  const evidence = readSources(evidenceRaw);
  const missing = metas.filter((meta) => !evidence.some((source) => source.bookId === meta.bookId && source.text));
  let opened: RawSource[] = [];
  if (missing.length) {
    try {
      const result = await callShamelaTool("shamela_open_many", {
        pages: missing.map((meta) => ({ book_id: meta.bookId, page_id: meta.pageId, max_chars: SEARCH_PAGE_MAX_CHARS })),
        context: 0,
        max_total_chars: SEARCH_PAGE_MAX_CHARS * missing.length,
      }, options);
      opened = readSources(result.sources);
    } catch {
      // səhifələr açılmasa, önizləmə göstərilir
    }
  }
  const all = [...evidence, ...opened];
  return metas.map((meta) => {
    const item = itemFromSources(meta, all, SEARCH_PAGE_MAX_CHARS);
    if (item) return item;
    const citation = parseCitation(meta.citation);
    return {
      bookId: meta.bookId,
      pageId: meta.pageId,
      title: meta.title || citation.title,
      author: meta.author,
      label: citation.label,
      text: meta.preview,
      url: shamelaPageUrl(meta.bookId, meta.pageId),
      prevPageId: meta.pageId > 1 ? meta.pageId - 1 : null,
      nextPageId: meta.pageId + 1,
      truncated: true,
    };
  }).filter((item) => item.text);
}

export async function searchShamela(query: string, options: ResearchOptions = {}): Promise<ShamelaItem[]> {
  return (await searchShamelaPage(query, options)).items;
}

/** Bir Şamilə səhifəsini tam açır: mətn uzundursa `next_cursor` ilə davam edir (ən çox ~40 000 simvol). */
export async function openShamelaPage(bookId: number, pageId: number, options: ResearchOptions = {}): Promise<ShamelaItem> {
  let result = await callShamelaTool("shamela_open", { book_id: bookId, page_id: pageId, max_chars: OPEN_PAGE_MAX_CHARS }, options);
  const [source] = readSources([result]);
  if (!source || source.bookId !== bookId) throw new ResearchUpstreamError("page not found");
  let fullText = source.text;
  let more = typeof result.next_cursor === "string" && result.next_cursor ? result.next_cursor : null;
  for (let round = 0; more && fullText.length < SHAMELA_FULL_MAX_CHARS && round < 6; round += 1) {
    try {
      result = await callShamelaTool("shamela_open", { book_id: bookId, page_id: source.pageId, max_chars: OPEN_PAGE_MAX_CHARS, cursor: more }, options);
    } catch {
      break;
    }
    const piece = cleanText(asString(result.text));
    if (!piece) break;
    fullText += piece.startsWith("\n") || fullText.endsWith("\n") ? piece : ` ${piece}`;
    more = typeof result.next_cursor === "string" && result.next_cursor ? result.next_cursor : null;
  }
  const citation = parseCitation(source.citation);
  const { text, truncated } = clip(fullText, SHAMELA_FULL_MAX_CHARS);
  return {
    bookId,
    pageId: source.pageId,
    title: citation.title,
    author: "",
    label: citation.label,
    text,
    url: shamelaPageUrl(bookId, source.pageId),
    prevPageId: source.prev,
    nextPageId: source.next,
    truncated: truncated || Boolean(more),
  };
}

// ---------------------------------------------------------------------------
// Dorar (dorar_api.json)

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", laquo: "«", raquo: "»" };

export function decodeEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

/** HTML-i düz mətnə çevirir: skript/stil blokları və bütün teqlər atılır. */
export function htmlToText(html: string) {
  const withoutBlocks = html
    .replace(/<(script|style|head)[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ");
  return cleanText(decodeEntities(withoutBlocks).replace(/<[^>]*>/g, " ").replace(/[<>]/g, " "));
}

const DORAR_LABELS: Array<[keyof Omit<DorarItem, "text" | "abridged">, string]> = [
  ["narrator", "الراوي"],
  ["muhaddith", "المحدث"],
  ["source", "المصدر"],
  ["page", "الصفحة أو الرقم"],
  ["grading", "خلاصة حكم المحدث"],
];

/**
 * Dorar mətninin sonu. API hər hədisin sonuna əlavə « ." qoyur (məs. «فريضةٌ . .» = «فريضةٌ.»). Mənbə hədisi
 * özü qısaldıbsa sonda «...» / «. . .» və ya «الحديث» olur — bu, həqiqi qısaltmadır.
 */
export function normalizeDorarText(raw: string, fromApi: boolean) {
  let text = raw.replace(/\s+/g, " ").trim();
  if (fromApi) text = text.replace(/\s*\.\s*$/, "").trim();
  const ellipsisAtEnd = /(?:\.\s*){3,}$|…$/.test(text);
  const hadithTail = /(?:\.\s*){3,}\s*(?:الحديث|الحَديث|الحديثَ)[\s.]*$|(?:\.\.\.|…)\s*(?:الحديث|الحَديث)/.test(text);
  // «… ، الحديث» — mənbə hədisin qalanını «الحديث» sözü ilə qısaldıb.
  const lastWord = /[،,.…]\s*(\S+?)[\s.]*$/.exec(text)?.[1] ?? "";
  const hadithWordTail = lastWord.replace(/[\u064b-\u065f\u0670]/g, "") === "الحديث";
  const abridged = ellipsisAtEnd || hadithTail || hadithWordTail;
  text = text.replace(/(?:\s*\.){3,}\s*$/, " …").replace(/\s+\.$/, ".").trim();
  return { text, abridged };
}

export function parseDorarHtml(html: string): DorarItem[] {
  const items: DorarItem[] = [];
  const pattern = /<div[^>]*class=["']hadith["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]*class=["']hadith-info["'][^>]*>([\s\S]*?)<\/div>)?/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) && items.length < MAX_DORAR_ITEMS) {
    const { text, abridged } = normalizeDorarText(htmlToText(match[1]).replace(/^\d+\s*-\s*/, ""), true);
    if (!text) continue;
    const item: DorarItem = { abridged, text, narrator: "", muhaddith: "", source: "", page: "", grading: "" };
    const info = match[2] ?? "";
    const parts = info.split(/<span[^>]*class=["']info-subtitle["'][^>]*>/i).slice(1);
    for (const part of parts) {
      const closeIndex = part.search(/<\/span>/i);
      if (closeIndex < 0) continue;
      const label = htmlToText(part.slice(0, closeIndex)).replace(/[:：]\s*$/, "").trim();
      const value = htmlToText(part.slice(closeIndex + 7)).replace(/^[:：]\s*/, "").trim();
      const key = DORAR_LABELS.find(([, arabic]) => label === arabic)?.[0];
      if (key && value) item[key] = value.slice(0, 500);
    }
    items.push(item);
  }
  return items;
}

export function dorarSearchUrl(query: string) {
  return `https://dorar.net/hadith/search?q=${encodeURIComponent(query)}`;
}

export const DORAR_HEADERS: Readonly<Record<string, string>> = {
  "User-Agent": RESEARCH_USER_AGENT,
  Accept: "application/json, text/javascript, */*;q=0.1",
  "Accept-Language": "ar,az;q=0.8,en;q=0.6",
  Referer: "https://www.madinahacademy.net/",
};

export function dorarApiUrl(query: string, base = "https://dorar.net") {
  return `${base.replace(/\/$/, "")}/dorar_api.json?skey=${encodeURIComponent(query.slice(0, 200))}`;
}

/** Dorar API JSON-unu oxuyur; HTML (Cloudflare səhifəsi) və ya pozuq JSON → aydın xəta. */
export function parseDorarApiBody(body: string, contentType: string): DorarItem[] {
  const trimmed = body.trim();
  if (/text\/html/i.test(contentType) && !trimmed.startsWith("{")) {
    throw new ResearchUpstreamError("upstream returned html", /cloudflare|attention required|cf-ray|challenge/i.test(trimmed.slice(0, 4000)) ? "blocked" : "unreadable");
  }
  let parsed: { ahadith?: { result?: unknown } };
  try {
    parsed = JSON.parse(trimmed) as typeof parsed;
  } catch {
    throw new ResearchUpstreamError("unreadable upstream response", /cloudflare|attention required/i.test(trimmed.slice(0, 4000)) ? "blocked" : "unreadable");
  }
  const html = parsed?.ahadith?.result;
  if (typeof html !== "string") return [];
  return parseDorarHtml(html);
}

export async function searchDorar(query: string, options: ResearchOptions = {}): Promise<DorarItem[]> {
  const url = dorarApiUrl(query, options.dorarBaseUrl);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const report = (event: Omit<UpstreamStatusEvent, "upstream">) => options.onUpstreamStatus?.({ upstream: "dorar", ...event });
  let response: { status: number; contentType: string; cfMitigated: string | null; body: string };
  try {
    if (options.fetchImpl) {
      const result = await fetchWithTimeout(url, { method: "GET", headers: { ...DORAR_HEADERS } }, options, true);
      response = { status: result.status, contentType: result.contentType, cfMitigated: result.cfMitigated, body: result.body };
    } else {
      response = await httpGetText(url, { ...DORAR_HEADERS }, timeoutMs);
    }
  } catch (error) {
    const code = error instanceof ResearchUpstreamError ? error.code : "unavailable";
    report({ status: null, code, cfMitigated: null, contentType: "" });
    throw error instanceof ResearchUpstreamError ? error : new ResearchUpstreamError("upstream unreachable", "unavailable");
  }
  if (response.status < 200 || response.status >= 300) {
    const code = classifyStatus(response.status, response.contentType, response.cfMitigated);
    report({ status: response.status, code, cfMitigated: response.cfMitigated, contentType: response.contentType });
    throw new ResearchUpstreamError(`upstream status ${response.status}`, code);
  }
  try {
    const items = parseDorarApiBody(response.body, response.contentType);
    report({ status: response.status, code: "ok", cfMitigated: response.cfMitigated, contentType: response.contentType });
    return items;
  } catch (error) {
    const code = error instanceof ResearchUpstreamError ? error.code : "unreadable";
    report({ status: response.status, code, cfMitigated: response.cfMitigated, contentType: response.contentType });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// «Davamı»: hədisin tam mətni (yalnız düymə basılanda, heç nə saxlanmır)
//
// 1) Dorar-ın öz axtarış səhifəsi (dorar.net/hadith/search?q=…) — API-dən fərqli olaraq hər hədisin daimi
//    keçidi (/h/<kod>) və «التخريج» sahəsi var. Hədis mühəddis + mənbə + səhifə ilə tapılır.
// 2) Mənbə hədisi özü qısaldıbsa, Dorar-ın «أصول الحديث» səhifəsi (/h/<kod>?osoul=1) əsl kitablardakı tam
//    mətni verir.
// 3) Bunlar alınmasa — Şamilədə hədisin parçası ilə axtarış; tapılan mətn mənbəsi ilə göstərilir.
// 4) Heç biri alınmasa — dürüst şəkildə yalnız parçanın mövcud olduğu bildirilir.

export interface DorarHadithRef {
  query: string;
  text: string;
  narrator?: string;
  muhaddith?: string;
  source?: string;
  page?: string;
}

export interface DorarPageHadith {
  id: string | null;
  text: string;
  abridged: boolean;
  grading: string;
  narrator: string;
  muhaddith: string;
  source: string;
  page: string;
  takhrij: string;
}

export type HadithFullStatus = "full" | "origin" | "shamela" | "fragment";

export interface HadithFullResult {
  status: HadithFullStatus;
  text: string;
  /** Tam mətnin götürüldüyü kitab (əsl mənbə və ya Şamilə kitabı). */
  sourceTitle: string | null;
  takhrij: string | null;
  url: string | null;
}

const DORAR_HTML_HEADERS: Readonly<Record<string, string>> = {
  ...DORAR_HEADERS,
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
};
const FULL_TEXT_MAX_CHARS = 6000;

async function dorarGet(url: string, options: ResearchOptions) {
  const timeoutMs = options.timeoutMs ?? 8000;
  const response = options.fetchImpl
    ? await fetchWithTimeout(url, { method: "GET", headers: { ...DORAR_HTML_HEADERS } }, { ...options, timeoutMs }, true)
    : await httpGetText(url, { ...DORAR_HTML_HEADERS }, timeoutMs);
  if (response.status < 200 || response.status >= 300) {
    throw new ResearchUpstreamError(`upstream status ${response.status}`, classifyStatus(response.status, response.contentType, response.cfMitigated));
  }
  return response.body;
}

/** Ərəb mətnini müqayisə üçün sadələşdirir: hərəkələr, təhvil, həmzə formaları və durğu işarələri atılır. */
export function arabicKey(value: string) {
  return value
    .replace(/[\u064b-\u065f\u0670\u0640\u06d6-\u06ed]/g, "")
    .replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function fieldValue(block: string, label: string) {
  let from = 0;
  for (;;) {
    const index = block.indexOf(label, from);
    if (index < 0) return "";
    from = index + label.length;
    // «المحدث» həm də «خلاصة حكم المحدث» içində keçir — onu ötürürük.
    if (label === "المحدث" && /حكم\s*$/.test(block.slice(Math.max(0, index - 8), index))) continue;
    const span = /^\s*:?\s*(?:<a\b[^>]*>\s*)?<span\b[^>]*>([\s\S]*?)<\/span>/i.exec(block.slice(from));
    if (span) return htmlToText(span[1]).slice(0, 1500);
  }
}

/** dorar.net/hadith/search və /h/<kod> səhifələrindəki hədis bloklarını oxuyur (yalnız düz mətn). */
export function parseDorarSearchPage(html: string): DorarPageHadith[] {
  const out: DorarPageHadith[] = [];
  const pattern = /<article\b[^>]*>\s*<h5\b[^>]*>([\s\S]*?)<\/h5>\s*<\/article>([\s\S]*?)(?=<article\b|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) && out.length < 120) {
    const info = match[2].slice(0, 12000);
    const { text, abridged } = normalizeDorarText(htmlToText(match[1]).replace(/^\s*\d*\s*-\s*/, ""), false);
    if (!text) continue;
    const id = /href="(?:https:\/\/dorar\.net)?\/h\/([A-Za-z0-9]{4,32})(?:"|\?)/.exec(info)?.[1] ?? null;
    out.push({
      id,
      text,
      abridged,
      grading: fieldValue(info, "خلاصة حكم المحدث"),
      narrator: fieldValue(info, "الراوي"),
      muhaddith: fieldValue(info, "المحدث"),
      source: fieldValue(info, "المصدر"),
      page: fieldValue(info, "الصفحة أو الرقم"),
      takhrij: fieldValue(info, "التخريج"),
    });
  }
  return out;
}

/** «أصول الحديث» səhifəsi: birinci blok hədisin özüdür, qalanları əsl kitablardakı mətnlərdir. */
export function parseDorarOrigins(html: string): Array<{ book: string; text: string }> {
  const out: Array<{ book: string; text: string }> = [];
  const pattern = /<article\b[^>]*>\s*<h5\b[^>]*>([\s\S]*?)<\/h5>/gi;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(html)) && out.length < 10) {
    index += 1;
    if (index === 1) continue;
    const text = htmlToText(match[1]).replace(/^\s*-\s*/, "").replace(/[ \t]*\n[\s]*/g, "\n").trim();
    const book = (/^\[\s*\[?\s*([^\]]{2,120})\]/.exec(text)?.[1] ?? /^([^\[\]():]{2,120}?)\s*\(\s*\d/.exec(text)?.[1] ?? "").trim();
    if (text.length > 20) out.push({ book, text: text.slice(0, FULL_TEXT_MAX_CHARS) });
  }
  return out;
}

function sameField(left: string | undefined, right: string) {
  if (!left || !right) return false;
  const a = arabicKey(left.replace(/[[\]]/g, ""));
  const b = arabicKey(right.replace(/[[\]]/g, ""));
  return a.length > 0 && a === b;
}

function samePage(left: string | undefined, right: string) {
  if (!left || !right) return false;
  return left.replace(/\s+/g, "") === right.replace(/\s+/g, "");
}

export function findDorarMatch(ref: DorarHadithRef, candidates: DorarPageHadith[]): DorarPageHadith | null {
  const exact = candidates.find((item) => sameField(ref.muhaddith, item.muhaddith) && sameField(ref.source, item.source) && samePage(ref.page, item.page));
  if (exact) return exact;
  const fragment = arabicKey(ref.text.replace(/…/g, " "));
  const head = fragment.split(" ").slice(0, 6).join(" ");
  return candidates.find((item) => sameField(ref.source, item.source) && head.length > 4 && arabicKey(item.text).includes(head)) ?? null;
}

/** Hədisdən axtarış üçün qısa parça (ilk ~8 söz, «…» və mötərizəsiz). */
export function hadithFragment(text: string, words = 8) {
  return text.replace(/\[[^\]]*\]/g, " ").replace(/…|\.{3,}/g, " ").replace(/[«»"]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, words).join(" ");
}

function excerptAround(text: string, fragmentKey: string, max = FULL_TEXT_MAX_CHARS) {
  if (text.length <= max) return text;
  // Uyğun yerin ətrafından kəsilir (təxmini — açar mətnin mövqeyinə görə).
  const ratio = Math.max(0, arabicKey(text).indexOf(fragmentKey)) / Math.max(1, arabicKey(text).length);
  const start = Math.max(0, Math.floor(ratio * text.length) - Math.floor(max / 3));
  return `${start > 0 ? "… " : ""}${text.slice(start, start + max).trim()} …`;
}

export async function fetchHadithFull(ref: DorarHadithRef, options: ResearchOptions = {}, fallback: { shamela?: boolean } = {}): Promise<HadithFullResult> {
  const base = (options.dorarBaseUrl ?? "https://dorar.net").replace(/\/$/, "");
  const fragment = hadithFragment(ref.text);
  let match: DorarPageHadith | null = null;
  for (const query of Array.from(new Set([ref.query, fragment].filter((value) => value && value.length >= 2)))) {
    try {
      const html = await dorarGet(`${base}/hadith/search?q=${encodeURIComponent(query.slice(0, 200))}`, options);
      match = findDorarMatch(ref, parseDorarSearchPage(html));
    } catch {
      match = null;
    }
    if (match) break;
  }
  const permalink = match?.id ? `https://dorar.net/h/${match.id}` : null;
  if (match && !match.abridged) {
    return { status: "full", text: match.text.slice(0, FULL_TEXT_MAX_CHARS), sourceTitle: match.source || null, takhrij: match.takhrij || null, url: permalink };
  }
  if (match?.id) {
    try {
      const origins = parseDorarOrigins(await dorarGet(`${base}/h/${match.id}?osoul=1`, options));
      if (origins.length) {
        return { status: "origin", text: origins[0].text, sourceTitle: origins[0].book || null, takhrij: match.takhrij || null, url: `${permalink}?osoul=1` };
      }
    } catch {
      // Şamiləyə keçilir
    }
  }
  const fragmentKey = arabicKey(fragment);
  if (fallback.shamela !== false && fragmentKey.split(" ").length >= 2) {
    try {
      const items = await searchShamela(fragment, options);
      const hit = items.find((item) => arabicKey(item.text).includes(fragmentKey));
      if (hit) {
        let pageText = hit.text;
        if (hit.truncated) {
          try {
            pageText = (await openShamelaPage(hit.bookId, hit.pageId, options)).text;
          } catch {
            // axtarış parçası kifayət edir
          }
        }
        return { status: "shamela", text: excerptAround(pageText, fragmentKey), sourceTitle: [hit.title, hit.author].filter(Boolean).join(" — ") || null, takhrij: match?.takhrij || null, url: hit.url };
      }
    } catch {
      // parça qaytarılır
    }
  }
  return { status: "fragment", text: match?.text ?? ref.text, sourceTitle: match?.source || ref.source || null, takhrij: match?.takhrij || null, url: permalink ?? dorarSearchUrl(fragment || ref.query) };
}

// ---------------------------------------------------------------------------
// Niyyət (intent) aşkarlanması — Azərbaycan, Türk və Ərəb dillərində, səhvlərə dözümlü.

export type ResearchKind = "shamela" | "dorar";

const SHAMELA_WORDS = ["shamela", "shamila", "shamele", "samile", "samila", "samela"];
const BOOK_WORDS = ["kitablarda", "kitaplarda", "kitablar", "kitaplar", "kitab", "kitap", "kutub", "kutuplarda"];
const DORAR_WORDS = ["dorar", "durar", "dorer", "dorrar", "eddurer", "dorarda", "durarda"];
const HADITH_WORDS = ["hadis", "hedis", "hadith", "hadits", "hadeeth", "hadislerde", "hedislerde"];
const VERB_WORDS = ["axtar", "axtaris", "axtarin", "ara", "arat", "arama", "yoxla", "yoxlat", "yoxlama", "kontrol", "sorgula", "tap", "bul", "check", "search", "find", "tehqiq", "tahkik", "tehlil"];
const FILLER_WORDS = ["da", "de", "in", "icinde", "daxilinde", "et", "edin", "ele", "uzre", "gore", "mi", "bir", "zehmet", "olmasa", "lutfen"];

const ARABIC_SHAMELA = ["الشاملة", "شاملة", "الشامله", "شامله", "المكتبة", "المكتبه"];
const ARABIC_DORAR = ["الدرر", "درر", "السنية", "السنيه", "تخريج", "خرج", "خرّج"];
const ARABIC_HADITH = ["حديث", "الحديث"];
const ARABIC_FILLER = ["ابحث", "بحث", "في", "فى", "عن", "اخرج", "تحقق", "من"];

function wordIs(token: string, words: readonly string[]) {
  return words.some((word) => token === word || (word.length >= 5 && token.startsWith(word)) || fuzzyKeywordMatch(token, word));
}

function stripArabicMarks(value: string) {
  return value.replace(/[\u064b-\u065f\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا");
}

function classifyHead(head: string, hasColon: boolean): ResearchKind | null {
  const rawWords = head.split(/\s+/).filter(Boolean);
  if (!rawWords.length || rawWords.length > 4) return null;
  const lastWord = rawWords[rawWords.length - 1];
  if (ARABIC_FILLER.includes(stripArabicMarks(lastWord)) || FILLER_WORDS.includes(normalizeText(lastWord))) return null;
  const arabicWords = rawWords.filter((word) => /[\u0600-\u06ff]/.test(word)).map(stripArabicMarks);
  const latin = normalizeText(rawWords.filter((word) => !/[\u0600-\u06ff]/.test(word)).join(" "));
  const tokens = latin ? latin.split(/[\s-]+/).filter(Boolean) : [];
  let shamela = false;
  let dorar = false;
  let books = false;
  let hadith = false;
  let verb = false;
  for (const word of arabicWords) {
    if (ARABIC_SHAMELA.includes(word)) shamela = true;
    else if (ARABIC_DORAR.includes(word)) dorar = true;
    else if (ARABIC_HADITH.includes(word)) hadith = true;
    else if (ARABIC_FILLER.includes(word)) verb = verb || word.includes("بحث") || word.includes("تحقق");
    else return null;
  }
  for (const token of tokens) {
    if (VERB_WORDS.includes(token) || (token.length >= 4 && wordIs(token, VERB_WORDS.filter((word) => word.length >= 5)))) verb = true;
    else if (wordIs(token, SHAMELA_WORDS)) shamela = true;
    else if (wordIs(token, DORAR_WORDS)) dorar = true;
    else if (wordIs(token, HADITH_WORDS)) hadith = true;
    else if (wordIs(token, BOOK_WORDS)) books = true;
    else if (FILLER_WORDS.includes(token)) continue;
    else return null;
  }
  if (shamela) return "shamela";
  if (dorar) return "dorar";
  if (books && (verb || hasColon)) return "shamela";
  if (hadith && (verb || hasColon)) return "dorar";
  return null;
}

export interface ResearchIntent {
  kind: ResearchKind;
  query: string;
}

/** «Şamilədə axtar: …», «hədis yoxla …», «dorar …», «الشاملة …» kimi əmrləri tanıyır. */
export function detectResearchIntent(message: string): ResearchIntent | null {
  const text = message.trim().replace(/^[«"'“]+/, "");
  if (!text) return null;
  const colon = /[:：]/.exec(text);
  if (colon && colon.index <= 60) {
    const kind = classifyHead(text.slice(0, colon.index).trim(), true);
    const query = cleanQuery(text.slice(colon.index + 1));
    if (kind && query) return { kind, query };
  }
  const words = text.split(/\s+/);
  for (let count = Math.min(4, words.length - 1); count >= 1; count -= 1) {
    const kind = classifyHead(words.slice(0, count).join(" ").replace(/[-–—،,]+$/, ""), false);
    if (!kind) continue;
    const query = cleanQuery(words.slice(count).join(" "));
    if (query) return { kind, query };
  }
  return null;
}

export function cleanQuery(value: string) {
  const query = value.replace(/^[\s:：\-–—،,]+/, "").replace(/^[«"“]+|[»"”]+$/g, "").trim();
  return query.length >= 2 ? query.slice(0, MAX_QUERY_LENGTH) : "";
}

// ---------------------------------------------------------------------------
// Söhbət cavabı

export interface ResearchReply {
  reply: string;
  suggestions: string[];
  sources: ResearchSources;
}

const RESEARCH_SUGGESTIONS = ["Şamilədə axtar: إنما الأعمال بالنيات", "Hədis yoxla: إنما الأعمال بالنيات"];

export async function answerResearch(intent: ResearchIntent, options: ResearchOptions = {}): Promise<ResearchReply> {
  if (intent.kind === "shamela") {
    try {
      const { items, hasMore, cursor } = await searchShamelaPage(intent.query, options);
      return {
        reply: items.length
          ? `Şamilə kitabxanasında «${intent.query}» üzrə ${items.length} nəticə tapdım. Mətnlər aşağıdadır; «Davamı» ilə səhifənin tam mətnini burada oxuya bilərsiniz.`
          : `Şamilədə «${intent.query}» üzrə nəticə tapılmadı. Ərəbcə açar sözlərlə (məs. «إنما الأعمال بالنيات») yenidən yoxlayın.`,
        suggestions: RESEARCH_SUGGESTIONS,
        sources: { kind: "shamela", query: intent.query, sourceUrl: SHAMELA_FALLBACK_URL, items, hasMore, cursor },
      };
    } catch {
      return {
        reply: `Şamilə hal-hazırda cavab vermir. Bir az sonra yenidən cəhd edin və ya birbaşa ${SHAMELA_FALLBACK_URL} ünvanında axtarın.`,
        suggestions: RESEARCH_SUGGESTIONS,
        sources: { kind: "shamela", query: intent.query, sourceUrl: SHAMELA_FALLBACK_URL, items: [], error: "unavailable" as UpstreamErrorCode },
      };
    }
  }
  const sourceUrl = dorarSearchUrl(intent.query);
  try {
    const items = await searchDorar(intent.query, options);
    return {
      reply: items.length
        ? `Dorar (الدرر السنية) bazasında «${intent.query}» üzrə ${items.length} hədis tapdım: mətn, ravi, mühəddis, mənbə və hökm aşağıdadır. «Davamı» hədisin tam mətnini gətirir.`
        : `Dorar-da «${intent.query}» üzrə hədis tapılmadı. Hədisin ərəbcə mətnindən bir hissə yazaraq yenidən yoxlayın.`,
      suggestions: RESEARCH_SUGGESTIONS,
      sources: { kind: "dorar", query: intent.query, sourceUrl, items },
    };
  } catch (error) {
    const code: UpstreamErrorCode = error instanceof ResearchUpstreamError ? error.code : "unavailable";
    return {
      reply: code === "blocked"
        ? `Dorar hal-hazırda cavab vermir (sayt sorğunu qəbul etmədi). Bir az sonra yenidən cəhd edin və ya birbaşa ${sourceUrl} ünvanında axtarın.`
        : code === "timeout"
          ? `Dorar hal-hazırda cavab vermir (vaxt bitdi). Bir az sonra yenidən cəhd edin və ya birbaşa ${sourceUrl} ünvanında axtarın.`
          : `Dorar hal-hazırda cavab vermir. Bir az sonra yenidən cəhd edin və ya birbaşa ${sourceUrl} ünvanında axtarın.`,
      suggestions: RESEARCH_SUGGESTIONS,
      sources: { kind: "dorar", query: intent.query, sourceUrl: sourceUrl, items: [], error: code },
    };
  }
}
