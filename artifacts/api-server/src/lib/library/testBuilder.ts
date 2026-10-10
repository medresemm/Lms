// «Test hazırla» — icazə, sorğunun yoxlanması və səhifə aralığının təyini (DB-dən asılı olmayan hissə).
import type { LibraryBook } from "./catalog.js";
import { chapterRange, GENERATED_KINDS, MAX_RANGE_PAGES, MAX_TEST_QUESTIONS, realChapterAt, type GeneratedKind } from "./testGenerator.js";
import { normalizeArabic, parseLibraryQuery, runLibraryQuery, type TextLoader } from "./search.js";

/** Kim istifadə edə bilər: sistem sahibi; müəllim / admin / idarə heyəti — «Tapşırıqlar» (test) icazəsi varsa. Tələbə — heç vaxt. */
export function testBuilderAllowed(input: { isOwner: boolean; role: string | null | undefined; permissions: ReadonlySet<string> }) {
  if (input.isOwner) return true;
  if (input.role !== "teacher" && input.role !== "admin" && input.role !== "owner_assistant") return false;
  return input.permissions.has("assignments");
}

/** Bütün qrupları görə bilənlər (sahib, idarə heyəti); digərləri yalnız özlərinə təyin olunmuş qrupları. */
export function testBuilderSeesAllGroups(input: { isOwner: boolean; role: string | null | undefined }) {
  return input.isOwner || input.role === "owner_assistant";
}

export interface GenerateRequest {
  slug: string;
  chapterIndex: number | null;
  /** Kitabdakı (çap) səhifə nömrələri. */
  fromPage: number | null;
  toPage: number | null;
  topic: string;
  count: number;
  kinds: GeneratedKind[];
  excludeKeys: string[];
  salt: number;
}

const intOrNull = (value: unknown) => (typeof value === "number" && Number.isSafeInteger(value) ? value : typeof value === "string" && /^\d{1,5}$/.test(value.trim()) ? Number(value) : null);

export function parseGenerateRequest(body: unknown): { ok: true; value: GenerateRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Sorğu düzgün göndərilməyib." };
  const raw = body as Record<string, unknown>;
  const slug = typeof raw.slug === "string" ? raw.slug.trim() : "";
  if (!slug || slug.length > 120) return { ok: false, error: "Kitab seçin." };
  const count = intOrNull(raw.count) ?? 10;
  if (count < 1 || count > MAX_TEST_QUESTIONS) return { ok: false, error: `Sual sayı 1–${MAX_TEST_QUESTIONS} arasında olmalıdır.` };
  const kinds = Array.isArray(raw.kinds) ? GENERATED_KINDS.filter((kind) => (raw.kinds as unknown[]).includes(kind)) : [...GENERATED_KINDS];
  if (!kinds.length) return { ok: false, error: "Ən azı bir sual növü seçin." };
  const topic = typeof raw.topic === "string" ? raw.topic.trim().slice(0, 100) : "";
  const excludeKeys = Array.isArray(raw.excludeKeys)
    ? raw.excludeKeys.filter((key): key is string => typeof key === "string" && key.length <= 120).slice(0, 80)
    : [];
  const salt = intOrNull(raw.salt) ?? 0;
  const chapterIndex = intOrNull(raw.chapterIndex);
  const fromPage = intOrNull(raw.fromPage);
  const toPage = intOrNull(raw.toPage) ?? fromPage;
  return { ok: true, value: { slug, chapterIndex, fromPage, toPage, topic, count, kinds, excludeKeys, salt } };
}

export type ResolvedRange =
  | { ok: true; from: number; to: number; topicWords: string[]; chapterTitle: string | null }
  | { ok: false; error: string };

/** Mövzu sözünü ərəb sözlərinə çevirir (Azərbaycan / Türk mövzu sözləri sinonimlərlə). */
export function topicArabicWords(topic: string) {
  if (!topic) return [];
  const parsed = parseLibraryQuery(topic);
  return normalizeArabic(parsed.arabic).split(" ").filter((word) => word.length >= 2 && !/^(?:في|من|علي|الي|عن|او|ثم|ما|ان)$/.test(word)).slice(0, 8);
}

/** Bab, çap səhifələri və ya mövzuya görə skan səhifə aralığı. */
export function resolveRange(book: LibraryBook, request: GenerateRequest, loader?: TextLoader): ResolvedRange {
  const topicWords = topicArabicWords(request.topic);
  if (request.topic && !topicWords.length) {
    return { ok: false, error: "Mövzu sözü tanınmadı. Ərəbcə yazın (məs. الوضوء) və ya Azərbaycanca mövzu adı verin (məs. dəstəmaz)." };
  }
  if (request.fromPage !== null) {
    const fromPrinted = Math.min(request.fromPage, request.toPage ?? request.fromPage);
    const toPrinted = Math.max(request.fromPage, request.toPage ?? request.fromPage);
    const from = fromPrinted + book.pageOffset;
    const to = toPrinted + book.pageOffset;
    if (from < 1 || to > book.pageCount) return { ok: false, error: `Səhifə nömrələri bu kitabda ${1 - book.pageOffset}–${book.pageCount - book.pageOffset} arasında olmalıdır.` };
    if (to - from + 1 > MAX_RANGE_PAGES) return { ok: false, error: `Bir dəfəyə ən çox ${MAX_RANGE_PAGES} səhifə seçmək olar.` };
    return { ok: true, from, to, topicWords, chapterTitle: realChapterAt(book, from)?.title ?? null };
  }
  if (request.chapterIndex !== null) {
    const range = chapterRange(book, request.chapterIndex);
    if (!range) return { ok: false, error: "Seçilmiş bab tapılmadı." };
    const to = Math.min(range.to, range.from + MAX_RANGE_PAGES - 1);
    return { ok: true, from: range.from, to, topicWords, chapterTitle: book.chapters[request.chapterIndex].title };
  }
  if (request.topic) {
    const result = runLibraryQuery(request.topic, { books: [book], book: book.slug, limit: 10, ...(loader ? { loader } : {}) });
    const top = result.items[0];
    if (!top) return { ok: false, error: "Bu mövzu seçilmiş kitabda tapılmadı. Başqa söz yazın və ya bab / səhifə seçin." };
    const chapter = realChapterAt(book, top.page);
    const index = chapter ? book.chapters.indexOf(chapter) : -1;
    const range = index >= 0 ? chapterRange(book, index) : null;
    const from = range ? range.from : Math.max(1, top.page - 1);
    const to = range ? Math.min(range.to, range.from + MAX_RANGE_PAGES - 1) : Math.min(book.pageCount, top.page + 1);
    return { ok: true, from, to, topicWords, chapterTitle: chapter?.title ?? null };
  }
  return { ok: false, error: "Bab, səhifə aralığı və ya mövzu seçin." };
}
