// Dərs resursundan Kitabxana kitabını tanımaq (lms_course_books cədvəli olmadıqda və ya boş olduqda ehtiyat yol).
// Müəllim dərsə kitabı adi resurs kimi əlavə edə bilər, məs.:
//   başlıq: «TEST kitab — شرح منهج السالكين», mətn: «باب نواقض الوضوء, səh. 55-56».
// Kitab adı (ərəbcə tam/qısa ad və ya latın qısa adı), fəsil adı və çap səhifələri mətndən tapılır.
//
// DİQQƏT: bu fayl artifacts/medine-lms/src/lib/resource-books.ts ilə EYNİDİR (brauzer də eyni qaydanı işlədir).
// Birini dəyişəndə o birini də dəyişin — `test:library` hər ikisini eyni nümunələrlə yoxlayır.

export interface ResourceBookChapterLike {
  title: string;
  level: number;
  printedPage: number;
  page: number;
}

export interface ResourceBookCatalogLike {
  slug: string;
  title: string;
  shortTitle: string;
  pageCount: number;
  pageOffset: number;
  chapters: readonly ResourceBookChapterLike[];
}

export interface ResourceBookMatch {
  slug: string;
  bookTitle: string;
  bookShortTitle: string;
  chapterTitle: string | null;
  /** Kitabdakı çap nömrələri (göstərmək üçün). */
  printedFrom: number | null;
  printedTo: number | null;
  /** Oxucunun açılacağı skan səhifəsi (/kitabxana/<slug>?page=<openPage>). */
  openPage: number;
}

const ARABIC_DIGITS = /[\u0660-\u0669\u06f0-\u06f9]/g;

function latinDigits(value: string) {
  return value.replace(ARABIC_DIGITS, (digit) => String(digit.charCodeAt(0) & 0xf));
}

/** Ərəbcə hərəkələri, tətvili və hərf variantlarını sadələşdirir; hərf/rəqəm olmayanları boşluğa çevirir. */
export function normalizeBookText(value: string) {
  return ` ${latinDigits(value)
    .toLocaleLowerCase("az")
    .replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;
}

function compactLatin(value: string) {
  return value.toLocaleLowerCase("az").replace(/[^\p{L}]/gu, "");
}

/** Mətnin kitab adına uyğunluq dərəcəsi (0 — uyğun deyil). */
function titleScore(text: string, compactText: string, book: ResourceBookCatalogLike) {
  const words = normalizeBookText(book.title).trim().split(" ").filter(Boolean);
  let best = 0;
  if (words.length === 1 && words[0].length >= 5 && text.includes(` ${words[0]} `)) best = 1;
  // Tam ad və ya adın əvvəlindən (ilk söz — məs. «شرح» — buraxıla bilər) ən azı 2 sözlük hissə.
  for (const start of [0, 1]) {
    for (let length = words.length - start; length >= 2; length -= 1) {
      const phrase = words.slice(start, start + length).join(" ");
      if (text.includes(` ${phrase} `)) {
        best = Math.max(best, length);
        break;
      }
    }
  }
  const shortTitle = compactLatin(book.shortTitle);
  if (shortTitle.length >= 6 && compactText.includes(shortTitle)) best = Math.max(best, 2);
  return best;
}

const PAGE_PATTERN = /(?:^|[^\p{L}])(?:s[əe]h(?:if[əe])?|sah(?:ife)?|sayfa|s|ص(?:فحه|فحة)?|pages?|pp?)\s*\.?\s*:?\s*(\d{1,4})(?:\s*(?:-|–|—|ilə|ile|to)\s*(\d{1,4}))?/iu;

/** «səh. 55-56», «s. 55», «ص ٥٥» … → çap səhifələri. */
export function parseResourcePages(value: string): { from: number; to: number | null } | null {
  const match = PAGE_PATTERN.exec(latinDigits(value));
  if (!match) return null;
  const from = Number(match[1]);
  const to = match[2] ? Number(match[2]) : null;
  if (!from) return null;
  return { from, to: to !== null && to >= from ? to : null };
}

/**
 * Resursun başlığı + mətnindən Kitabxana kitabını tapır. Tapılmasa — null.
 * Fəsil: mətndə adı çəkilən fəsil (ən uzun ad; eyni adlılardan səhifəyə uyğun olanı), yoxdursa səhifənin aid olduğu fəsil.
 */
export function matchResourceBook(resource: { title: string; body?: string | null }, catalog: readonly ResourceBookCatalogLike[]): ResourceBookMatch | null {
  const raw = `${resource.title ?? ""}\n${resource.body ?? ""}`;
  const text = normalizeBookText(raw);
  const compactText = compactLatin(raw);
  let book: ResourceBookCatalogLike | null = null;
  let bookScore = 0;
  for (const candidate of catalog) {
    const score = titleScore(text, compactText, candidate);
    if (score > bookScore) {
      book = candidate;
      bookScore = score;
    }
  }
  if (!book) return null;

  const maxPrinted = Math.max(1, book.pageCount - book.pageOffset);
  const pages = parseResourcePages(raw);
  const printedFrom = pages && pages.from <= maxPrinted ? pages.from : null;
  const printedTo = printedFrom !== null && pages?.to && pages.to <= maxPrinted ? pages.to : null;

  const named = book.chapters
    .map((chapter) => ({ chapter, normalized: normalizeBookText(chapter.title).trim() }))
    .filter(({ normalized }) => normalized.split(" ").length >= 2 && text.includes(` ${normalized} `))
    .sort((a, b) => {
      const near = (item: { chapter: ResourceBookChapterLike }) => (printedFrom === null ? 0 : -Math.abs(item.chapter.printedPage - printedFrom));
      return b.normalized.length - a.normalized.length || near(b) - near(a);
    });
  let chapter: ResourceBookChapterLike | null = named[0]?.chapter ?? null;
  if (!chapter && printedFrom !== null) {
    const scan = printedFrom + book.pageOffset;
    for (const candidate of book.chapters) {
      if (candidate.page <= scan) chapter = candidate;
      else break;
    }
  }
  const from = printedFrom ?? (named[0] ? chapter?.printedPage ?? null : null);
  const openPage = from !== null ? Math.min(book.pageCount, Math.max(1, from + book.pageOffset)) : 1;
  return {
    slug: book.slug,
    bookTitle: book.title,
    bookShortTitle: book.shortTitle,
    chapterTitle: chapter?.title ?? null,
    printedFrom: from,
    printedTo: printedFrom !== null ? printedTo : null,
    openPage,
  };
}

export function resourceBookHref(match: Pick<ResourceBookMatch, "slug" | "openPage">) {
  return `/kitabxana/${encodeURIComponent(match.slug)}?page=${match.openPage}`;
}
