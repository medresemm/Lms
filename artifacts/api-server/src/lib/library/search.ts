// Kitabxana daxilində axtarış — archive.org OCR mətni (skan mətnidir, qüsurlu ola bilər).
// Sorğu mətni log edilmir və heç yerdə saxlanmır.
//
// Necə işləyir:
// - Ərəb mətni normallaşdırılır (hərəkə/təthil, əlif-həmzə formaları, ة→ه, ى→ي, ؤ→و, ئ→ي) və hər söz üçün
//   yüngül kök (ال/وال/بال/كال/فال/لل, و/ف ön şəkilçiləri; ات، ون، ين، ان، ه، ها، هم … son şəkilçiləri) çıxarılır.
// - Hər kitab üçün yaddaşda indeks qurulur (ilk axtarışda, bir dəfə): söz → səhifə → mövqelər; kök üçün də eyni.
// - OCR və hərf səhvləri: lüğətdəki sözlər üzrə trigram indeksi + məhdud redaktə məsafəsi ilə oxşar sözlər tapılır.
// - Sıralama: söz çəkisi (idf) × uyğunluq növü, sözlərin bir-birinə yaxınlığı, dəqiq ifadə, fəsil başlığı.
//   Bütün sözlər tapılmayanda nəticə «qismən uyğun» kimi işarələnir.
// - Fəsil başlıqları (fihris) ayrıca axtarılır: başlıq uyğunluğu ən yuxarıda göstərilir və fəslin əvvəlini açır.
// - Azərbaycan/Türk dilində mövzu sözləri (dəstəmaz, oruc, fail …) ərəb fəsil açar sözlərinə çevrilir (synonyms.ts).
import { readAsset } from "../assets.js";
import { editDistance, phoneticKey } from "../ai/fuzzy.js";
import { normalizeText, tokenize } from "../ai/text.js";
import { detectResearchIntent } from "../ai/research.js";
import { LIBRARY_BOOKS, type LibraryBook, type LibraryChapter } from "./catalog.js";
import { TOPIC_SYNONYMS } from "./synonyms.js";

const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const ARABIC_LETTER = /[\u0621-\u064A\u0671-\u06D3]/;

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

const ARTICLE_PREFIXES = ["وبال", "وكال", "فبال", "وال", "فال", "بال", "كال", "لل", "ال"];
const SUFFIXES = ["هما", "ات", "ون", "ين", "ان", "ها", "هم", "هن", "يه", "ه"];

/** Yüngül kök: ön bağlayıcı/artikl və sadə son şəkilçilər atılır (normallaşdırılmış söz üçün). */
export function lightStem(word: string) {
  let stem = word;
  let strippedArticle = false;
  for (const prefix of ARTICLE_PREFIXES) {
    if (stem.startsWith(prefix) && stem.length - prefix.length >= 2) {
      stem = stem.slice(prefix.length);
      strippedArticle = true;
      break;
    }
  }
  if (!strippedArticle && (stem.startsWith("و") || stem.startsWith("ف")) && stem.length >= 5) stem = stem.slice(1);
  for (const suffix of SUFFIXES) {
    if (stem.endsWith(suffix) && stem.length - suffix.length >= 3) {
      stem = stem.slice(0, -suffix.length);
      break;
    }
  }
  return stem;
}

const STOPWORDS = new Set(["في", "من", "علي", "الي", "عن", "او", "ثم", "هو", "هي", "ما", "ان", "قد", "مع", "عند", "هذا", "هذه", "ذلك", "التي", "الذي", "كل", "و", "ف", "ب", "ل"]);

// ---------------------------------------------------------------------------
// İndeks

interface WordRef {
  /** Orijinal (göstərilən) sözün indeksi. */
  word: number;
}

interface PageData {
  original: string[];
  /** Normallaşdırılmış söz → orijinal söz indeksi. */
  tokens: string[];
  tokenWord: number[];
}

interface BookIndex {
  book: LibraryBook;
  pages: PageData[];
  surface: Map<string, Map<number, number[]>>;
  stems: Map<string, Map<number, number[]>>;
  vocab: string[];
  trigrams: Map<string, number[]>;
  chapterTokens: Array<{ chapter: LibraryChapter; tokens: string[]; stems: string[]; path: string[] }>;
}

export type TextLoader = (slug: string) => string[] | null;

/** Yüklənmiş kitabların mətni (yaddaşdan oxunur, burada saxlanılır). version dəyişəndə indeks yenidən qurulur. */
const registeredTexts = new Map<string, { version: string; pages: string[] }>();

export function registerLibraryTexts(slug: string, version: string, pages: string[] | null) {
  if (!pages) registeredTexts.delete(slug);
  else registeredTexts.set(slug, { version, pages });
  for (const key of indexCache.keys()) if (key.startsWith(`${slug}@`)) indexCache.delete(key);
}

export function registeredLibraryTextVersion(slug: string) {
  return registeredTexts.get(slug)?.version ?? null;
}

const assetLoader: TextLoader = (slug) => {
  const registered = registeredTexts.get(slug);
  if (registered) return registered.pages;
  const raw = readAsset(`library/${slug}/text.json`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as { pages?: unknown };
    return Array.isArray(parsed.pages) ? parsed.pages.map((page) => (typeof page === "string" ? page : "")) : null;
  } catch {
    return null;
  }
};

function trigramsOf(word: string) {
  const padded = `^${word}$`;
  const grams: string[] = [];
  for (let i = 0; i + 3 <= padded.length; i += 1) grams.push(padded.slice(i, i + 3));
  return grams;
}

function addPosting(map: Map<string, Map<number, number[]>>, key: string, page: number, position: number) {
  let pages = map.get(key);
  if (!pages) map.set(key, (pages = new Map()));
  let positions = pages.get(page);
  if (!positions) pages.set(page, (positions = []));
  positions.push(position);
}

/** Fəsil yolu: alt bölmə üçün üst «كتاب/باب» + öz başlığı. */
export function chapterPath(book: LibraryBook, chapter: LibraryChapter | null) {
  if (!chapter) return [];
  if (chapter.level === 1) return [chapter.title];
  const index = book.chapters.indexOf(chapter);
  for (let i = index - 1; i >= 0; i -= 1) {
    if (book.chapters[i].level === 1) return [book.chapters[i].title, chapter.title];
  }
  return [chapter.title];
}

/** Bu səhifənin aid olduğu ən dəqiq fəsil (eyni səhifədə bir neçə başlıq varsa sonuncusu). */
function chapterAt(book: LibraryBook, page: number) {
  let found: LibraryChapter | null = null;
  for (const chapter of book.chapters) {
    if (chapter.page <= page) found = chapter;
    else break;
  }
  return found;
}

function buildIndex(book: LibraryBook, texts: string[]): BookIndex {
  const surface = new Map<string, Map<number, number[]>>();
  const stems = new Map<string, Map<number, number[]>>();
  const pages: PageData[] = texts.map((text, pageIndex) => {
    const original = text.split(/\s+/).filter(Boolean);
    const tokens: string[] = [];
    const tokenWord: number[] = [];
    original.forEach((word, wordIndex) => {
      for (const token of normalizeArabic(word).split(" ")) {
        if (!token) continue;
        tokens.push(token);
        tokenWord.push(wordIndex);
      }
    });
    tokens.forEach((token, position) => {
      addPosting(surface, token, pageIndex, position);
      addPosting(stems, lightStem(token), pageIndex, position);
    });
    return { original, tokens, tokenWord };
  });
  const vocab = Array.from(surface.keys()).filter((word) => word.length >= 3 && ARABIC_LETTER.test(word));
  const trigrams = new Map<string, number[]>();
  vocab.forEach((word, id) => {
    for (const gram of new Set(trigramsOf(word))) {
      let list = trigrams.get(gram);
      if (!list) trigrams.set(gram, (list = []));
      list.push(id);
    }
  });
  const chapterTokens = book.chapters
    .filter((chapter) => normalizeArabic(chapter.title) !== "الفهرس")
    .map((chapter) => {
      const tokens = normalizeArabic(chapter.title).split(" ").filter(Boolean);
      return { chapter, tokens, stems: tokens.map(lightStem), path: chapterPath(book, chapter) };
    });
  return { book, pages, surface, stems, vocab, trigrams, chapterTokens };
}

const indexCache = new Map<string, BookIndex | null>();

function loadIndex(book: LibraryBook, loader: TextLoader): BookIndex | null {
  // Yüklənmiş kitabda fəsillər redaktə oluna bilər — açar kitab obyektinin versiyasını da daxil edir.
  const key = `${book.slug}@${registeredTexts.get(book.slug)?.version ?? ""}`;
  const cached = loader === assetLoader ? indexCache.get(key) : undefined;
  if (cached !== undefined && (cached === null || cached.book === book || sameChapters(cached.book, book))) return cached;
  const texts = loader(book.slug);
  const index = texts ? buildIndex(book, texts) : null;
  if (loader === assetLoader) indexCache.set(key, index);
  return index;
}

function sameChapters(a: LibraryBook, b: LibraryBook) {
  return a.title === b.title && a.shortTitle === b.shortTitle && a.pageOffset === b.pageOffset &&
    JSON.stringify(a.chapters) === JSON.stringify(b.chapters);
}

/** İndeksləri əvvəlcədən qurur (məs. serverin ilk sorğusunda); qurulma müddəti ms ilə qaytarılır. */
export function warmLibraryIndex(books: readonly LibraryBook[] = LIBRARY_BOOKS) {
  const started = Date.now();
  for (const book of books) loadIndex(book, assetLoader);
  return Date.now() - started;
}

// ---------------------------------------------------------------------------
// Sorğu terminləri

interface Variant {
  kind: "surface" | "stem";
  key: string;
  weight: number;
}

interface Term {
  text: string;
  variants: Variant[];
}

function allowedArabicTypos(length: number) {
  if (length <= 3) return 0;
  if (length <= 6) return 1;
  return 2;
}

/** Sözə OCR/hərf səhvi ilə oxşar lüğət sözləri (trigram namizədləri + redaktə məsafəsi). */
function fuzzyVariants(index: BookIndex, word: string): Variant[] {
  const allowed = allowedArabicTypos(word.length);
  if (!allowed) return [];
  const grams = new Set(trigramsOf(word));
  const counts = new Map<number, number>();
  for (const gram of grams) for (const id of index.trigrams.get(gram) ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  const scored: Array<{ word: string; distance: number }> = [];
  for (const [id, shared] of counts) {
    const candidate = index.vocab[id];
    if (candidate === word || Math.abs(candidate.length - word.length) > allowed) continue;
    const dice = (2 * shared) / (grams.size + new Set(trigramsOf(candidate)).size);
    if (dice < 0.3) continue;
    const distance = editDistance(word, candidate, allowed);
    if (distance <= allowed) scored.push({ word: candidate, distance });
  }
  return scored
    .sort((a, b) => a.distance - b.distance || (index.surface.get(b.word)?.size ?? 0) - (index.surface.get(a.word)?.size ?? 0))
    .slice(0, 8)
    .map(({ word: key, distance }) => ({ kind: "surface" as const, key, weight: distance === 1 ? 0.7 : 0.5 }));
}

/** Söz axtarılan kitabların heç birində (demək olar ki) yoxdursa — OCR/hərf səhvi ehtimalı: yalnız onda oxşar sözlər axtarılır. */
function needsFuzzy(indexes: BookIndex[], word: string) {
  const stem = lightStem(word);
  let pages = 0;
  for (const index of indexes) pages += Math.max(index.surface.get(word)?.size ?? 0, index.stems.get(stem)?.size ?? 0);
  return pages <= 1;
}

function termsFor(index: BookIndex, words: string[], fuzzyWords: ReadonlySet<string>): Term[] {
  return words.map((word) => {
    const stem = lightStem(word);
    const variants: Variant[] = [{ kind: "surface", key: word, weight: 1 }, { kind: "stem", key: stem, weight: 0.85 }];
    if (fuzzyWords.has(word)) variants.push(...fuzzyVariants(index, word));
    return { text: word, variants };
  });
}

function postingsFor(index: BookIndex, variant: Variant) {
  return (variant.kind === "surface" ? index.surface : index.stems).get(variant.key);
}

// ---------------------------------------------------------------------------
// Axtarış

export interface SnippetPart {
  text: string;
  hit?: boolean;
}

export interface LibraryHit {
  slug: string;
  bookTitle: string;
  bookShortTitle: string;
  chapterTitle: string | null;
  chapterPath: string[];
  page: number;
  printedPage: number;
  snippet: string;
  parts: SnippetPart[];
  /** chapter — fəsil başlığı uyğunluğu; text — səhifə mətni. */
  match: "chapter" | "text";
  partial: boolean;
  score: number;
}

export interface LibrarySearchOptions {
  books?: readonly LibraryBook[];
  loader?: TextLoader;
  limit?: number;
  offset?: number;
}

export interface LibrarySearchResult {
  hits: LibraryHit[];
  total: number;
}

const MAX_QUERY_LENGTH = 200;
const MAX_RESULTS = 200;
const SNIPPET_BEFORE = 10;
const SNIPPET_AFTER = 16;

function snippetParts(page: PageData, from: number, to: number, hitPositions: Set<number>) {
  if (!page.tokens.length) return { snippet: "", parts: [] as SnippetPart[] };
  const firstWord = page.tokenWord[Math.min(from, page.tokens.length - 1)] ?? 0;
  const lastWord = page.tokenWord[Math.min(to, page.tokens.length - 1)] ?? firstWord;
  const start = Math.max(0, firstWord - SNIPPET_BEFORE);
  const end = Math.min(page.original.length, Math.max(lastWord + 1, firstWord + 1) + SNIPPET_AFTER);
  const hitWords = new Set(Array.from(hitPositions).map((position) => page.tokenWord[position]));
  const parts: SnippetPart[] = [];
  if (start > 0) parts.push({ text: "… " });
  for (let word = start; word < end; word += 1) {
    const hit = hitWords.has(word);
    const text = page.original[word] + (word < end - 1 ? " " : "");
    const last = parts[parts.length - 1];
    if (last && Boolean(last.hit) === hit && last.text !== "… ") last.text += text;
    else parts.push(hit ? { text, hit: true } : { text });
  }
  if (end < page.original.length) parts.push({ text: " …" });
  // Vurğulanmış hissənin sonundakı boşluğu adi mətnə keçir.
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part.hit && part.text.endsWith(" ")) {
      part.text = part.text.slice(0, -1);
      if (parts[i + 1] && !parts[i + 1].hit) parts[i + 1].text = ` ${parts[i + 1].text}`;
      else parts.splice(i + 1, 0, { text: " " });
    }
  }
  return { snippet: parts.map((part) => part.text).join(""), parts };
}

/** Uyğun sözləri ən kiçik pəncərədə toplayan aralıq (fərqli terminlər üzrə). */
function bestWindow(lists: Array<number[]>) {
  const events: Array<{ position: number; term: number }> = [];
  lists.forEach((positions, term) => positions.forEach((position) => events.push({ position, term })));
  events.sort((a, b) => a.position - b.position);
  const need = lists.filter((positions) => positions.length).length;
  const counts = new Map<number, number>();
  let have = 0;
  let left = 0;
  let best: [number, number] = [events[0]?.position ?? 0, events[0]?.position ?? 0];
  let bestSpan = Infinity;
  for (let right = 0; right < events.length; right += 1) {
    const term = events[right].term;
    counts.set(term, (counts.get(term) ?? 0) + 1);
    if (counts.get(term) === 1) have += 1;
    while (have === need && left <= right) {
      const span = events[right].position - events[left].position;
      if (span < bestSpan) {
        bestSpan = span;
        best = [events[left].position, events[right].position];
      }
      const leftTerm = events[left].term;
      counts.set(leftTerm, (counts.get(leftTerm) ?? 0) - 1);
      if (counts.get(leftTerm) === 0) have -= 1;
      left += 1;
    }
  }
  return { from: best[0], to: best[1], span: bestSpan === Infinity ? 0 : bestSpan };
}

function bookHits(index: BookIndex, words: string[], fuzzyWords: ReadonlySet<string>): LibraryHit[] {
  const { book } = index;
  const pageCount = index.pages.length;
  const terms = termsFor(index, words, fuzzyWords);
  const content = terms.filter((term) => !STOPWORDS.has(term.text));
  const scoringTerms = content.length ? content : terms;

  // Hər termin üçün: səhifə → {çəki, mövqelər}
  const termPages = scoringTerms.map((term) => {
    const pages = new Map<number, { weight: number; positions: number[] }>();
    for (const variant of term.variants) {
      const postings = postingsFor(index, variant);
      if (!postings) continue;
      for (const [page, positions] of postings) {
        const current = pages.get(page);
        if (!current || current.weight < variant.weight) pages.set(page, { weight: variant.weight, positions: current && current.weight === variant.weight ? current.positions.concat(positions) : positions });
        else if (current.weight === variant.weight) current.positions = current.positions.concat(positions);
      }
    }
    const idf = Math.log(1 + pageCount / Math.max(1, pages.size));
    return { term, pages, idf };
  });
  // Kitabda heç rast gəlinməyən sözlər (OCR-da pozulmuş və ya başqa yazılış) nəticəni tamamilə sıfırlamasın:
  // uyğunluq kitabda mövcud sözlər üzrə hesablanır, belə nəticələr isə «qismən uyğun» işarələnir.
  const present = termPages.filter((item) => item.pages.size > 0);
  if (!present.length) return [];
  const totalIdf = present.reduce((sum, item) => sum + item.idf, 0) || 1;
  const minimumMatched = present.length <= 2 ? 1 : Math.ceil(present.length * 0.5);

  const candidatePages = new Set<number>();
  termPages.forEach((item) => item.pages.forEach((_, page) => candidatePages.add(page)));

  const hits: LibraryHit[] = [];
  const normalizedQuery = words.join(" ");
  for (const pageIndex of candidatePages) {
    const page = index.pages[pageIndex];
    let matched = 0;
    let strong = 0;
    let matchedIdf = 0;
    let textScore = 0;
    const lists: number[][] = [];
    const hitPositions = new Set<number>();
    for (const item of termPages) {
      const entry = item.pages.get(pageIndex);
      if (!entry) {
        lists.push([]);
        continue;
      }
      matched += 1;
      if (entry.weight >= 0.85) strong += 1;
      matchedIdf += item.idf;
      textScore += item.idf * entry.weight * (1 + Math.log(1 + entry.positions.length) / 3);
      lists.push(entry.positions);
      entry.positions.forEach((position) => hitPositions.add(position));
    }
    if (matched < minimumMatched) continue;
    // Qismən uyğunluq yalnız ən azı bir söz dəqiq (və ya kökü ilə) tapılanda: tək oxşar söz kifayət deyil.
    if (matched < scoringTerms.length && strong === 0) continue;
    const coverage = matchedIdf / totalIdf;
    if (present.length >= 2 && coverage < 0.45) continue;
    const window = bestWindow(lists);
    let score = textScore * coverage * coverage * 10;
    if (matched >= 2) score += 25 * Math.min(1, (matched - 1) / Math.max(1, window.span));
    if (words.length >= 2 && page.tokens.join(" ").includes(normalizedQuery)) score += 40;
    const pageNumber = pageIndex + 1;
    const chapter = chapterAt(book, pageNumber);
    // Fihris səhifələri mətn nəticəsi kimi göstərilmir (fəsil başlıqları ayrıca axtarılır).
    if (chapter && normalizeArabic(chapter.title) === "الفهرس") continue;
    if (chapter) {
      const titleTokens = new Set(normalizeArabic(chapter.title).split(" ").map(lightStem));
      const inTitle = scoringTerms.filter((term) => titleTokens.has(lightStem(term.text))).length;
      if (inTitle) score += 12 * (inTitle / scoringTerms.length) + (chapter.page === pageNumber ? 8 : 0);
    }
    const { snippet, parts } = snippetParts(page, window.from, window.to, hitPositions);
    hits.push({
      slug: book.slug,
      bookTitle: book.title,
      bookShortTitle: book.shortTitle,
      chapterTitle: chapter?.title ?? null,
      chapterPath: chapterPath(book, chapter),
      page: pageNumber,
      printedPage: pageNumber - book.pageOffset,
      snippet,
      parts,
      match: "text",
      partial: matched < scoringTerms.length,
      score,
    });
  }
  return hits;
}

/** Başlıq sözü uyğunluğu: 1 dəqiq, 0.9 kök, 0.6 bir hərf səhvi (yalnız ≥5 hərfli sözlərdə). */
function tokenMatchesTitle(word: string, title: { tokens: string[]; stems: string[] }) {
  const stem = lightStem(word);
  if (title.tokens.includes(word)) return 1;
  if (title.stems.includes(stem)) return 0.9;
  if (word.length < 5) return 0;
  for (const token of title.tokens) if (Math.abs(token.length - word.length) <= 1 && editDistance(word, token, 1) <= 1) return 0.6;
  return 0;
}

const GENERIC_TITLE_WORDS = new Set(["باب", "كتاب", "فصل"]);

function chapterHits(index: BookIndex, words: string[]): LibraryHit[] {
  const content = words.filter((word) => !STOPWORDS.has(word) && !GENERIC_TITLE_WORDS.has(word));
  if (!content.length) return [];
  const hits: LibraryHit[] = [];
  for (const title of index.chapterTokens) {
    let sum = 0;
    let matched = 0;
    let fuzzy = false;
    for (const word of content) {
      const value = tokenMatchesTitle(word, title);
      if (value) {
        matched += 1;
        sum += value;
        if (value < 0.9) fuzzy = true;
      }
    }
    if (matched < content.length) continue;
    const specific = title.tokens.filter((token) => !STOPWORDS.has(token) && !GENERIC_TITLE_WORDS.has(token)).length;
    // Qısa və tam uyğun başlıqlar öndə: «باب التيمم» > «… التيمم وغيره …».
    // Hərf səhvi ilə tapılan başlıq dəqiq başlıqlardan aşağı, adi mətn nəticələrindən yuxarı durur.
    const score = (fuzzy ? 200 : 1000) + (sum / content.length) * 100 - Math.max(0, specific - content.length) * 4 + (title.chapter.level === 1 ? 3 : 0);
    const page = index.pages[title.chapter.page - 1];
    let parts: SnippetPart[] = [];
    if (page) {
      // Parça başlığın səhifədəki yerindən (sorğu sözləri ən sıx olan hissə) götürülür.
      const lists = content.map((word) => {
        const positions = index.surface.get(word)?.get(title.chapter.page - 1) ?? index.stems.get(lightStem(word))?.get(title.chapter.page - 1) ?? [];
        return positions;
      });
      const hitPositions = new Set(lists.flat());
      const window = hitPositions.size ? bestWindow(lists) : { from: 0, to: 0 };
      parts = snippetParts(page, window.from, window.to, hitPositions).parts;
    }
    hits.push({
      slug: index.book.slug,
      bookTitle: index.book.title,
      bookShortTitle: index.book.shortTitle,
      chapterTitle: title.chapter.title,
      chapterPath: title.path,
      page: title.chapter.page,
      printedPage: title.chapter.printedPage,
      snippet: parts.map((part) => part.text).join(""),
      parts,
      match: "chapter",
      partial: false,
      score,
    });
  }
  return hits;
}

function queryWords(arabic: string) {
  return normalizeArabic(arabic.slice(0, MAX_QUERY_LENGTH)).split(" ").filter((word) => word.length >= 2 || /\d/.test(word)).slice(0, 12);
}

/** Ərəbcə sorğu ilə axtarış (fəsil başlıqları + səhifə mətni). */
const PAGE_TEXT_MAX_WORDS = 1500;

/**
 * «Davamı»: axtarış nəticəsinin bütün səhifə mətni (OCR qatı), sorğu sözləri vurğulanmış halda.
 * Yalnız düymə ilə istənilir; heç nə saxlanmır.
 */
export function libraryPageText(slug: string, page: number, query: string, options: { books?: readonly LibraryBook[]; loader?: TextLoader } = {}) {
  const book = (options.books ?? LIBRARY_BOOKS).find((item) => item.slug === slug);
  if (!book || !Number.isSafeInteger(page) || page < 1) return null;
  const index = loadIndex(book, options.loader ?? assetLoader);
  const data = index?.pages[page - 1];
  if (!index || !data) return null;
  const wanted = queryWords(query);
  const stems = new Set(wanted.map(lightStem));
  const exact = new Set(wanted);
  const hitWords = new Set<number>();
  data.tokens.forEach((token, position) => {
    if (STOPWORDS.has(token)) return;
    if (exact.has(token) || stems.has(lightStem(token))) hitWords.add(data.tokenWord[position]);
  });
  const end = Math.min(data.original.length, PAGE_TEXT_MAX_WORDS);
  const parts: SnippetPart[] = [];
  const push = (text: string, hit: boolean) => {
    const last = parts[parts.length - 1];
    if (last && Boolean(last.hit) === hit) last.text += text;
    else parts.push(hit ? { text, hit: true } : { text });
  };
  for (let word = 0; word < end; word += 1) {
    if (word > 0) push(" ", false);
    push(data.original[word], hitWords.has(word));
  }
  if (end < data.original.length) parts.push({ text: " …" });
  return { slug, page, printedPage: page - book.pageOffset, text: parts.map((part) => part.text).join(""), parts, truncated: end < data.original.length };
}

export function searchLibraryPaged(query: string, options: LibrarySearchOptions = {}): LibrarySearchResult {
  const books = options.books ?? LIBRARY_BOOKS;
  const loader = options.loader ?? assetLoader;
  const limit = Math.max(1, Math.min(options.limit ?? 10, 50));
  const offset = Math.max(0, Math.min(options.offset ?? 0, MAX_RESULTS));
  const words = queryWords(query);
  if (!words.length || words.join("").length < 2) return { hits: [], total: 0 };
  const all: LibraryHit[] = [];
  const indexes = books.map((book) => loadIndex(book, loader)).filter((index): index is BookIndex => Boolean(index));
  const fuzzyWords = new Set(words.filter((word) => !STOPWORDS.has(word) && needsFuzzy(indexes, word)));
  for (const index of indexes) {
    // Eyni səhifədə bir neçə başlıq uyğun gəlirsə, yalnız ən yaxşısı.
    const byPage = new Map<number, LibraryHit>();
    for (const hit of chapterHits(index, words)) {
      const current = byPage.get(hit.page);
      if (!current || current.score < hit.score) byPage.set(hit.page, hit);
    }
    const chapters = Array.from(byPage.values());
    const chapterPages = new Set(chapters.map((hit) => hit.page));
    all.push(...chapters, ...bookHits(index, words, fuzzyWords).filter((hit) => !chapterPages.has(hit.page)));
  }
  all.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug) || a.page - b.page);
  const ranked = all.slice(0, MAX_RESULTS);
  return { hits: ranked.slice(offset, offset + limit), total: ranked.length };
}

export function searchLibrary(query: string, options: LibrarySearchOptions = {}): LibraryHit[] {
  return searchLibraryPaged(query, { ...options, offset: 0, limit: options.limit ?? 8 }).hits;
}

function trigramSimilarity(a: string, b: string) {
  const left = new Set(trigramsOf(a));
  const right = new Set(trigramsOf(b));
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return (2 * shared) / ((left.size + right.size) || 1);
}

export interface ChapterSuggestion {
  slug: string;
  bookShortTitle: string;
  title: string;
  page: number;
  printedPage: number;
}

/** «Bunu nəzərdə tuturdunuz?» — sorğuya ən yaxın fəsil başlıqları. */
export function suggestChapters(query: string, books: readonly LibraryBook[] = LIBRARY_BOOKS, limit = 3): ChapterSuggestion[] {
  const words = queryWords(query).filter((word) => !STOPWORDS.has(word) && !GENERIC_TITLE_WORDS.has(word));
  if (!words.length) return [];
  const scored: Array<ChapterSuggestion & { score: number }> = [];
  for (const book of books) {
    for (const chapter of book.chapters) {
      const titleWords = normalizeArabic(chapter.title).split(" ").filter((word) => word && !GENERIC_TITLE_WORDS.has(word));
      if (!titleWords.length || normalizeArabic(chapter.title) === "الفهرس" || normalizeArabic(chapter.title) === "فصل") continue;
      let total = 0;
      for (const word of words) {
        let best = 0;
        for (const titleWord of titleWords) best = Math.max(best, trigramSimilarity(lightStem(word), lightStem(titleWord)));
        total += best;
      }
      const score = total / words.length;
      if (score >= 0.34) scored.push({ slug: book.slug, bookShortTitle: book.shortTitle, title: chapter.title, page: chapter.page, printedPage: chapter.printedPage, score });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(({ score: _score, ...item }) => item);
}

// ---------------------------------------------------------------------------
// Sorğunun təhlili: kitab filtri, doldurucu sözlər, mövzu sinonimləri

const BOOK_FILTERS: Array<{ slug: string; latin: RegExp; arabic: RegExp }> = [
  { slug: "at-tuhfa-as-saniyya", latin: /^(?:et|at)?tuhf[a-z]*$/, arabic: /(?:^|\s)(?:في\s+)?(?:ال)?تحف[ةه](?:\s+(?:ال)?سني[ةه])?(?=\s|$)/ },
  { slug: "manhaj-as-salikin", latin: /^(?:men|man|min)(?:hec|hac|haj|hej)[a-z]*$/, arabic: /(?:^|\s)(?:في\s+)?(?:شرح\s+)?(?:ال)?منهج(?:\s+(?:ال)?سالكين)?(?=\s|$)/ },
];

const FILLER_WORDS = new Set([
  "haqqinda", "hakkinda", "barede", "movzu", "movzusu", "konu", "konusu", "nedir", "ne", "nedi", "bab", "babi", "babda", "fesil", "fesli", "fesilde",
  "bolum", "bolumu", "bolumde", "bolme", "bolmesi", "kitab", "kitabda", "kitap", "kitapta", "kitabxana", "kitabxanada", "harada", "harda", "hansi",
  "hangi", "sehifede", "sehife", "sehifesi", "sayfa", "sayfada", "sayfasi", "yazilib", "yazilir", "yaziliyor", "yaziyor", "geciyor", "kecir", "nerede",
  "neresinde", "ile", "ve", "veya", "hokmu", "hukmu", "hokumleri", "hukumleri", "qaydasi", "qaydalari", "kaidesi", "seyler", "seyleri", "seylar",
  "sey", "nelerdir", "neler", "nece", "nasil", "qilinir", "kilinir", "verilir", "kimlere", "kime", "ceza", "cezasi", "cezalari", "edilir", "olur", "hakda", "axtar", "axtaris", "ara", "tap", "bul", "goster", "ac", "zehmet", "olmasa", "lutfen", "mene", "bana",
]);

export interface ParsedLibraryQuery {
  /** Axtarılacaq ərəb mətni (sinonimlər açılmış). */
  arabic: string;
  /** Kitab filtri (məs. «Tuhfədə …»). */
  book: string | null;
  /** Latın mövzu sözlərindən çevrilmiş ərəb ifadələri. */
  expanded: string[];
  /** Tanınmayan latın sözləri. */
  unknown: string[];
  /** Bütün latın sözləri mövzu kimi tanındı və heç biri «auto: false» deyil. */
  autoTopic: boolean;
}

// Azərbaycan/Türk hal və cəm şəkilçiləri (normalizeText formasında) — avtomatik tanımada yalnız bunlara icazə var.
const CASE_SUFFIXES = new Set(["i", "u", "in", "un", "nin", "nun", "a", "e", "ya", "ye", "da", "de", "ta", "te", "dan", "den", "tan", "ten",
  "si", "su", "sin", "sun", "ni", "nu", "na", "ne", "ler", "lar", "leri", "lari", "lerin", "larin", "dir", "dur", "y", "yi", "yu",
  "lerde", "larda", "lere", "lara", "lerden", "lardan", "lerle", "larla", "nin", "nun", "sinin", "sunun", "miz", "imiz", "niz", "iniz"]);

/** Latın sözünün sinonim açarı ilə uyğunluğu (0 — yox, 1 — dəqiq). strict: yalnız dəqiq və ya açar + hal şəkilçisi. */
function keyTokenScore(token: string, key: string, strict = false) {
  if (token === key) return 1;
  const suffixed = key.length >= 3 && token.startsWith(key) && CASE_SUFFIXES.has(token.slice(key.length));
  if (suffixed) return 0.95;
  if (strict || key.length <= 3) return 0;
  // Uzun şəkilçi zənciri: «dəstəmazının», «namazlarda».
  if (key.length >= 4 && token.startsWith(key) && token.length - key.length <= 6) return 0.9;
  const tokenKey = phoneticKey(token);
  const keyKey = phoneticKey(key);
  if (tokenKey === keyKey) return 0.88;
  const allowed = key.length >= 8 ? 2 : key.length >= 5 ? 1 : 0;
  if (allowed && editDistance(token, key, allowed) <= allowed) return 0.8;
  if (keyKey.length >= 5 && editDistance(tokenKey, keyKey, 1) <= 1) return 0.75;
  // Hərf səhvi + hal şəkilçisi: «dəstəmzı» → «dəstəmaz» + «ı».
  if (allowed) {
    for (let cut = 1; cut <= 4 && cut < token.length; cut += 1) {
      if (CASE_SUFFIXES.has(token.slice(-cut)) && editDistance(token.slice(0, -cut), key, allowed) <= allowed) return 0.7;
    }
  }
  return 0;
}

const SYNONYM_KEYS = TOPIC_SYNONYMS.flatMap((entry, id) => entry.keys.map((key) => ({ id, tokens: tokenize(normalizeText(key)).filter((token) => !FILLER_WORDS.has(token)) })))
  .filter((key) => key.tokens.length > 0)
  .sort((a, b) => b.tokens.length - a.tokens.length);

/** Latın sözlərini ərəb ifadələrinə çevirir: hər mövqedə ən uzun, sonra ən dəqiq uyğun açar seçilir. */
function expandLatin(tokens: string[], strict = false) {
  const used = new Array<boolean>(tokens.length).fill(false);
  const found: Array<{ at: number; id: number }> = [];
  for (let start = 0; start < tokens.length; start += 1) {
    if (used[start]) continue;
    let best: { id: number; length: number; score: number } | null = null;
    for (const key of SYNONYM_KEYS) {
      const length = key.tokens.length;
      if (start + length > tokens.length || (best && length < best.length)) continue;
      let score = 1;
      for (let i = 0; i < length && score > 0; i += 1) {
        score = used[start + i] ? 0 : Math.min(score, keyTokenScore(tokens[start + i], key.tokens[i], strict));
      }
      if (score > 0 && (!best || length > best.length || score > best.score)) best = { id: key.id, length, score };
    }
    if (!best) continue;
    for (let i = 0; i < best.length; i += 1) used[start + i] = true;
    found.push({ at: start, id: best.id });
  }
  const ids = Array.from(new Set(found.map((item) => item.id)));
  return { entries: ids.map((id) => TOPIC_SYNONYMS[id]), unknown: tokens.filter((_, index) => !used[index]) };
}

export function parseLibraryQuery(raw: string): ParsedLibraryQuery {
  let text = raw.slice(0, MAX_QUERY_LENGTH);
  let book: string | null = null;
  for (const filter of BOOK_FILTERS) {
    if (filter.arabic.test(text)) {
      // Kitab adı sorğunun özüdürsə (məs. yalnız «التحفة»), filtr kimi götürülür.
      text = text.replace(filter.arabic, " ");
      book = filter.slug;
      break;
    }
  }
  const arabicWords: string[] = [];
  const latinChunks: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (ARABIC_LETTER.test(word)) arabicWords.push(word);
    else latinChunks.push(word);
  }
  let latinTokens = tokenize(normalizeText(latinChunks.join(" "))).filter((token) => /[a-z]/.test(token));
  if (!book) {
    const filtered = latinTokens.filter((token) => {
      const match = BOOK_FILTERS.find((filter) => filter.latin.test(token));
      if (match && !book) book = match.slug;
      return !match;
    });
    latinTokens = filtered;
  }
  latinTokens = latinTokens.filter((token) => !FILLER_WORDS.has(token));
  const { entries, unknown } = expandLatin(latinTokens);
  const expanded = entries.map((entry) => entry.arabic);
  // Avtomatik tanıma (açar söz yazılmadan) yalnız dəqiq açar + hal şəkilçisi ilə: «Fitrət» adı «fitrə» sayılmasın.
  const strictMatch = latinTokens.length ? expandLatin(latinTokens, true) : null;
  return {
    arabic: [...arabicWords, ...expanded].join(" ").trim(),
    book,
    expanded,
    unknown,
    autoTopic: Boolean(strictMatch && strictMatch.entries.length > 0 && strictMatch.unknown.length === 0 && strictMatch.entries.every((entry) => entry.auto !== false) && strictMatch.entries.some((entry) => entry.auto !== "modifier")),
  };
}

// ---------------------------------------------------------------------------
// Söhbət əmri: «kitabxanada axtar: …», «kitabda axtar …», «ابحث في المكتبة …», Türkcə «kütüphanede ara …»

const LIBRARY_HEADS = [
  /^kitabxanada\s+(?:axtar|axtarış|tap)(?=[\s:：]|$)/i,
  /^kitabxanadan\s+(?:axtar|tap)(?=[\s:：]|$)/i,
  /^kitab(?:lar)?da\s+(?:axtar|axtarış|tap)(?=[\s:：]|$)/i,
  /^kitabxana\s*(?:axtarışı)?\s*[:：]/i,
  /^k[uü]t[uü]phane(?:de|den)\s+(?:ara|bul)(?=[\s:：]|$)/i,
  /^kitap(?:lar)?(?:da|ta)\s+(?:ara|bul)(?=[\s:：]|$)/i,
  /^ابحث\s+في\s+(?:المكتبة|الكتب|الكتاب)/,
  /^البحث\s+في\s+(?:المكتبة|الكتب)/,
  /^search\s+(?:the\s+)?library(?=[\s:：]|$)/i,
];

function cleanQuery(value: string) {
  return value.replace(/^[\s:：\-–—،,]+/, "").replace(/[?？!.。]+$/g, "").replace(/^[«"“]+|[»"”]+$/g, "").trim();
}

export function detectLibraryIntent(message: string): { query: string } | null {
  const text = message.trim().replace(/^[«"'“]+/, "");
  for (const head of LIBRARY_HEADS) {
    const match = head.exec(text);
    if (!match) continue;
    const query = cleanQuery(text.slice(match[0].length));
    return query.length >= 2 ? { query: query.slice(0, MAX_QUERY_LENGTH) } : { query: "" };
  }
  return null;
}

// «hansı səhifədə …», «… harada yazılıb», «… haqqında bab», «Tuhfədə …», Türkcə «hangi sayfada», «nerede yazıyor».
const IMPLICIT_PHRASES = [
  /(?:^|\s)hans[ıi]\s+s[əe]hif[əe](?:d[əe]|si)(?=[\s?!.,:]|$)/i,
  /(?:^|\s)hans[ıi]\s+(?:bab|f[əe]sil)d[əe](?=[\s?!.,:]|$)/i,
  /(?:^|\s)har(?:a)?da\s+yaz[ıi]l(?:ıb|ib|ır|ir)(?=[\s?!.,:]|$)/i,
  /(?:^|\s)harada\s+(?:ke[çc]ir|var)(?=[\s?!.,:]|$)/i,
  /(?:^|\s)haqq[ıi]nda\s+(?:bab|f[əe]sil)(?=[\s?!.,:]|$)/i,
  /(?:^|\s)hakk[ıi]nda\s+(?:bab|b[öo]l[üu]m)(?=[\s?!.,:]|$)/i,
  /(?:^|\s)hangi\s+sayfa(?:da|s[ıi])(?=[\s?!.,:]|$)/i,
  /(?:^|\s)nerede\s+(?:yaz[ıi]yor|ge[çc]iyor|yaz[ıi]l[ıi])(?=[\s?!.,:]|$)/i,
];

export type ImplicitLibraryReason = "phrase" | "book" | "arabic" | "topic";

/**
 * «Kitabxanada axtar» yazılmadan kitabxana sorğusu: ərəbcə mətn, kitab adı, «hansı səhifədə» kimi ifadələr
 * və ya tamamilə tanınan mövzu sözləri (dəstəmaz, oruc, fail …). Daxili rejimdə istifadə olunur.
 */
export function detectImplicitLibraryQuery(message: string): { query: string; reason: ImplicitLibraryReason } | null {
  const text = cleanQuery(message.trim());
  if (!text || text.length > MAX_QUERY_LENGTH) return null;
  const letters = text.replace(/[^\p{L}]/gu, "");
  const arabicLetters = letters.replace(/[^\u0600-\u06FF]/g, "").length;
  if (IMPLICIT_PHRASES.some((pattern) => pattern.test(text))) {
    const parsed = parseLibraryQuery(text);
    return parsed.arabic ? { query: text, reason: "phrase" } : null;
  }
  const parsed = parseLibraryQuery(text);
  if (parsed.book && parsed.arabic) return { query: text, reason: "book" };
  if (arabicLetters >= 3 && arabicLetters / Math.max(1, letters.length) >= 0.7) return { query: text, reason: "arabic" };
  const latinTokens = tokenize(normalizeText(text));
  if (parsed.autoTopic && latinTokens.length <= 6) return { query: text, reason: "topic" };
  return null;
}

/**
 * Daxili rejimdə mesaj kitabxanaya aiddirmi: açıq əmr və ya (Şamilə/Dorar əmri deyilsə) gizli kitabxana sorğusu.
 * null — adi Akademiya köməkçisinə ötürülür.
 */
export function resolveLibraryMessage(message: string): { query: string } | null {
  const explicit = detectLibraryIntent(message);
  if (explicit) return explicit;
  if (detectResearchIntent(message)) return null;
  const implicit = detectImplicitLibraryQuery(message);
  return implicit ? { query: implicit.query } : null;
}

// ---------------------------------------------------------------------------
// Cavab

export type LibraryItem = Omit<LibraryHit, "score">;

export interface LibraryReply {
  reply: string;
  suggestions: string[];
  sources: {
    kind: "library";
    query: string;
    items: LibraryItem[];
    total: number;
    offset: number;
    limit: number;
    book: string | null;
    expanded: string[];
    didYouMean: ChapterSuggestion[];
  };
}

export const LIBRARY_SUGGESTIONS = ["Kitabxanada axtar: الطهارة", "Dəstəmazı pozan şeylər", "Tuhfədə fail"];
export const LIBRARY_PAGE_SIZE = 10;

export interface LibraryQueryResult {
  items: LibraryItem[];
  total: number;
  offset: number;
  limit: number;
  book: string | null;
  expanded: string[];
  didYouMean: ChapterSuggestion[];
}

/** Sorğunu (Azərbaycan/Türk mövzu sözləri, kitab filtri, ərəbcə) təhlil edib nəticə səhifəsini qaytarır. */
export function runLibraryQuery(query: string, options: LibrarySearchOptions & { book?: string | null } = {}): LibraryQueryResult {
  const parsed = parseLibraryQuery(query);
  const bookSlug = options.book ?? parsed.book;
  const allBooks = options.books ?? LIBRARY_BOOKS;
  const books = bookSlug ? allBooks.filter((book) => book.slug === bookSlug) : allBooks;
  const limit = Math.max(1, Math.min(options.limit ?? LIBRARY_PAGE_SIZE, 50));
  const offset = Math.max(0, options.offset ?? 0);
  const result = parsed.arabic ? searchLibraryPaged(parsed.arabic, { ...options, books, limit, offset }) : { hits: [], total: 0 };
  const didYouMean = result.total === 0 ? suggestFor(query, parsed, books) : [];
  return {
    items: result.hits.map(({ score: _score, ...item }) => item),
    total: result.total,
    offset,
    limit,
    book: bookSlug ?? null,
    expanded: parsed.expanded,
    didYouMean,
  };
}

function suggestFor(query: string, parsed: ParsedLibraryQuery, books: readonly LibraryBook[]) {
  if (parsed.arabic) return suggestChapters(parsed.arabic, books);
  // Latın sözü tanınmadısa: sinonim açarlarına yaxınlıq (məs. «dəstəmz»).
  const tokens = tokenize(normalizeText(query)).filter((token) => !FILLER_WORDS.has(token) && token.length >= 3);
  const near = TOPIC_SYNONYMS.map((entry) => {
    let best = 0;
    for (const key of entry.keys) {
      for (const token of tokens) best = Math.max(best, trigramSimilarity(phoneticKey(token), phoneticKey(key.replace(/\s+/g, ""))));
    }
    return { entry, best };
  }).filter((item) => item.best >= 0.4).sort((a, b) => b.best - a.best).slice(0, 2);
  return near.flatMap((item) => suggestChapters(item.entry.arabic, books, 2)).slice(0, 3);
}

export function answerLibrary(query: string, options: LibrarySearchOptions = {}): LibraryReply {
  if (!query) {
    return {
      reply: "Nəyi axtarmaq istədiyinizi yazın, məsələn: «Kitabxanada axtar: الطهارة», «Dəstəmazı pozan şeylər» və ya «Tuhfədə fail».",
      suggestions: LIBRARY_SUGGESTIONS,
      sources: { kind: "library", query: "", items: [], total: 0, offset: 0, limit: LIBRARY_PAGE_SIZE, book: null, expanded: [], didYouMean: [] },
    };
  }
  const result = runLibraryQuery(query, options);
  const bookName = result.book ? (options.books ?? LIBRARY_BOOKS).find((book) => book.slug === result.book)?.shortTitle : null;
  const scope = bookName ? `«${bookName}» kitabında` : "Mədrəsə Kitabxanasında";
  const expandedNote = result.expanded.length ? ` (axtarılan: ${result.expanded.join("، ")})` : "";
  const reply = result.total
    ? `${scope} «${query}»${expandedNote} üzrə ${result.total} nəticə tapdım. «Kitabda aç» ilə həmin səhifəni oxuya, «Davamı» ilə səhifənin tam mətnini burada görə bilərsiniz.`
    : result.didYouMean.length
      ? `${scope} «${query}»${expandedNote} üzrə nəticə tapılmadı. Bunu nəzərdə tuturdunuz?`
      : `${scope} «${query}»${expandedNote} üzrə nəticə tapılmadı. Ərəbcə başqa söz və ya qısa ifadə ilə yoxlayın.`;
  return {
    reply,
    suggestions: LIBRARY_SUGGESTIONS,
    sources: { kind: "library", query, ...result },
  };
}

/** Kitabın səhifə mətnləri (OCR / yüklənmiş mətn qatı); mətn yoxdursa null. Test hazırlayıcısı üçün. */
export function libraryBookTexts(slug: string, loader: TextLoader = assetLoader): string[] | null {
  return loader(slug);
}
