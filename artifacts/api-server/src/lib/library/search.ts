// Kitabxana daxilində axtarış — archive.org OCR mətni (skan mətnidir, qüsurlu ola bilər).
// Sorğu mətni log edilmir və heç yerdə saxlanmır.
import { readAsset } from "../assets.js";
import { LIBRARY_BOOKS, chapterForPage, type LibraryBook } from "./catalog.js";

const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

/** Ərəb mətnini müqayisə üçün sadələşdirir: hərəkələr, təthil, həmzə formaları, tə-mərbuta, əlif-məqsura. */
export function normalizeArabic(value: string) {
  return value
    .replace(TASHKEEL, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[یې]/g, "ي")
    .replace(/ک/g, "ك")
    .replace(/[ھہۀ]/g, "ه")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

interface BookText {
  /** Göstərmək üçün təmizlənmiş mətn (indeks 0 = 1-ci skan səhifəsi). */
  pages: string[];
  normalized: string[];
}

const textCache = new Map<string, BookText | null>();

export type TextLoader = (slug: string) => string[] | null;

const assetLoader: TextLoader = (slug) => {
  const raw = readAsset(`library/${slug}/text.json`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as { pages?: unknown };
    return Array.isArray(parsed.pages) ? parsed.pages.map((page) => (typeof page === "string" ? page : "")) : null;
  } catch {
    return null;
  }
};

function loadBookText(slug: string, loader: TextLoader): BookText | null {
  if (loader === assetLoader && textCache.has(slug)) return textCache.get(slug) ?? null;
  const pages = loader(slug);
  const value = pages ? { pages, normalized: pages.map(normalizeArabic) } : null;
  if (loader === assetLoader) textCache.set(slug, value);
  return value;
}

export interface LibraryHit {
  slug: string;
  bookTitle: string;
  chapterTitle: string | null;
  page: number;
  printedPage: number;
  snippet: string;
  score: number;
}

export interface LibrarySearchOptions {
  books?: readonly LibraryBook[];
  loader?: TextLoader;
  limit?: number;
}

const MAX_QUERY_LENGTH = 200;
const SNIPPET_RADIUS = 90;

/** Normallaşdırılmış mətndəki mövqeyə uyğun orijinal mətn parçasını tapır (təxmini, söz sayına görə). */
function snippetFor(original: string, normalizedPage: string, index: number, length: number) {
  const wordsBefore = normalizedPage.slice(0, index).split(" ").filter(Boolean).length;
  const matchWords = Math.max(1, normalizedPage.slice(index, index + length).split(" ").filter(Boolean).length);
  const words = original.split(/\s+/).filter(Boolean);
  const start = Math.max(0, wordsBefore - 12);
  const end = Math.min(words.length, wordsBefore + matchWords + 14);
  let text = words.slice(start, end).join(" ");
  if (text.length > SNIPPET_RADIUS * 3) text = text.slice(0, SNIPPET_RADIUS * 3);
  return `${start > 0 ? "… " : ""}${text}${end < words.length ? " …" : ""}`;
}

export function searchLibrary(query: string, options: LibrarySearchOptions = {}): LibraryHit[] {
  const books = options.books ?? LIBRARY_BOOKS;
  const loader = options.loader ?? assetLoader;
  const limit = Math.max(1, Math.min(options.limit ?? 8, 20));
  const needle = normalizeArabic(query.slice(0, MAX_QUERY_LENGTH));
  if (needle.length < 2) return [];
  const terms = needle.split(" ").filter((term) => term.length >= 2);
  if (!terms.length) return [];

  const hits: LibraryHit[] = [];
  for (const book of books) {
    const text = loadBookText(book.slug, loader);
    if (!text) continue;
    text.normalized.forEach((page, index) => {
      if (!page) return;
      const phraseAt = page.indexOf(needle);
      let score = 0;
      let at = phraseAt;
      let length = needle.length;
      if (phraseAt >= 0) {
        score = 100 + terms.length * 10 + Math.min(5, page.split(needle).length - 1) * 5;
      } else {
        const present = terms.filter((term) => page.includes(term));
        if (present.length < Math.max(1, Math.ceil(terms.length * 0.75))) return;
        score = present.length * 10;
        at = page.indexOf(present[0]);
        length = present[0].length;
      }
      const pageNumber = index + 1;
      const chapter = chapterForPage(book, pageNumber);
      // Fəslin öz başlığı sorğunu daşıyırsa (məs. «باب نواقض الوضوء»), həmin fəslin səhifələri öndə olsun.
      if (chapter && normalizeArabic(chapter.title).includes(needle)) score += chapter.page === pageNumber ? 60 : 30;
      hits.push({
        slug: book.slug,
        bookTitle: book.title,
        chapterTitle: chapter?.title ?? null,
        page: pageNumber,
        printedPage: pageNumber - book.pageOffset,
        snippet: snippetFor(text.pages[index], page, at, length),
        score,
      });
    });
  }
  return hits.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug) || a.page - b.page).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Söhbət əmri: «kitabxanada axtar: …», «kitabda axtar …», «ابحث في المكتبة …»

const LIBRARY_HEADS = [
  /^kitabxanada\s+(?:axtar|axtarış|tap)(?=[\s:：]|$)/i,
  /^kitabxanadan\s+(?:axtar|tap)(?=[\s:：]|$)/i,
  /^kitab(?:lar)?da\s+(?:axtar|axtarış|tap)(?=[\s:：]|$)/i,
  /^kitabxana\s*(?:axtarışı)?\s*[:：]/i,
  /^ابحث\s+في\s+(?:المكتبة|الكتب|الكتاب)/,
  /^البحث\s+في\s+(?:المكتبة|الكتب)/,
  /^search\s+(?:the\s+)?library(?=[\s:：]|$)/i,
];

export function detectLibraryIntent(message: string): { query: string } | null {
  const text = message.trim().replace(/^[«"'“]+/, "");
  for (const head of LIBRARY_HEADS) {
    const match = head.exec(text);
    if (!match) continue;
    const query = text.slice(match[0].length).replace(/^[\s:：\-–—،,]+/, "").replace(/^[«"“]+|[»"”]+$/g, "").trim();
    return query.length >= 2 ? { query: query.slice(0, MAX_QUERY_LENGTH) } : { query: "" };
  }
  return null;
}

export interface LibraryReply {
  reply: string;
  suggestions: string[];
  sources: { kind: "library"; query: string; items: Array<Omit<LibraryHit, "score">> };
}

export const LIBRARY_SUGGESTIONS = ["Kitabxanada axtar: الطهارة", "Kitabxanada axtar: الفاعل"];

export function answerLibrary(query: string, options: LibrarySearchOptions = {}): LibraryReply {
  if (!query) {
    return {
      reply: "Nəyi axtarmaq istədiyinizi yazın, məsələn: «Kitabxanada axtar: الطهارة».",
      suggestions: LIBRARY_SUGGESTIONS,
      sources: { kind: "library", query: "", items: [] },
    };
  }
  const items = searchLibrary(query, options).map(({ score: _score, ...item }) => item);
  return {
    reply: items.length
      ? `Mədrəsə Kitabxanasında «${query}» üzrə ${items.length} nəticə tapıldı. «Kitabda aç» ilə həmin səhifəni oxuya bilərsiniz.`
      : `Mədrəsə Kitabxanasında «${query}» üzrə nəticə tapılmadı. Ərəbcə başqa söz və ya qısa ifadə ilə yoxlayın.`,
    suggestions: LIBRARY_SUGGESTIONS,
    sources: { kind: "library", query, items },
  };
}
