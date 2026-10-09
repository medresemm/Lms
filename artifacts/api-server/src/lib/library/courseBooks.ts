// Dərs kitabları: dərsə (fənn + semestr) Kitabxanadan kitab(lar) bağlamaq — istəyə görə fəsil və ya səhifə aralığı.
// Bazadan asılı deyil (testlərdə birbaşa yoxlanılır).
import type { LibraryBook } from "./catalog.js";
import { matchResourceBook } from "./resourceBooks.js";

export const MAX_BOOKS_PER_LESSON = 8;

export interface CourseBookEntry {
  slug: string;
  pageFrom: number | null;
  pageTo: number | null;
  chapterTitle: string | null;
  note: string | null;
}

export interface CourseBookView extends CourseBookEntry {
  available: boolean;
  bookTitle: string;
  bookShortTitle: string;
  author: string;
  printedFrom: number | null;
  printedTo: number | null;
  /** Oxucunun açılacağı skan səhifəsi. */
  openPage: number;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function optionalPage(value: unknown): number | null | "invalid" {
  if (value === undefined || value === null || value === "") return null;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : "invalid";
}

function cleanNote(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, 200) : null;
}

export function validateCourseBooks(raw: unknown, catalog: readonly LibraryBook[]): Result<CourseBookEntry[]> {
  if (!Array.isArray(raw)) return { ok: false, error: "Kitab siyahısı düzgün deyil." };
  if (raw.length > MAX_BOOKS_PER_LESSON) return { ok: false, error: `Bir dərsə ən çox ${MAX_BOOKS_PER_LESSON} kitab bağlamaq olar.` };
  const entries: CourseBookEntry[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const row = (item ?? {}) as Record<string, unknown>;
    const slug = typeof row.slug === "string" ? row.slug : "";
    const book = catalog.find((candidate) => candidate.slug === slug);
    if (!book) return { ok: false, error: "Seçilən kitab Kitabxanada tapılmadı." };
    const pageFrom = optionalPage(row.pageFrom);
    const pageTo = optionalPage(row.pageTo);
    if (pageFrom === "invalid" || pageTo === "invalid") return { ok: false, error: `«${book.shortTitle}»: səhifə nömrəsi düzgün deyil.` };
    if (pageTo !== null && pageFrom === null) return { ok: false, error: `«${book.shortTitle}»: başlanğıc səhifəni də seçin.` };
    for (const page of [pageFrom, pageTo]) {
      if (page !== null && (page < 1 || page > book.pageCount)) return { ok: false, error: `«${book.shortTitle}»: səhifə kitabın hüdudlarından kənardadır (1–${book.pageCount}).` };
    }
    if (pageFrom !== null && pageTo !== null && pageTo < pageFrom) return { ok: false, error: `«${book.shortTitle}»: son səhifə başlanğıcdan əvvəl ola bilməz.` };
    // Fəsil adı yalnız kitabın öz mündəricatından götürülür.
    const requested = typeof row.chapterTitle === "string" ? row.chapterTitle : null;
    const chapter = requested
      ? book.chapters.find((candidate) => candidate.title === requested && (pageFrom === null || candidate.page === pageFrom))
      : pageFrom !== null ? book.chapters.find((candidate) => candidate.page === pageFrom) : undefined;
    const key = `${slug}:${pageFrom ?? ""}:${pageTo ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ slug, pageFrom: pageFrom ?? (chapter ? chapter.page : null), pageTo, chapterTitle: chapter?.title ?? null, note: cleanNote(row.note) });
  }
  return { ok: true, value: entries };
}

export function resolveCourseBooks(entries: readonly CourseBookEntry[], catalog: readonly LibraryBook[]): CourseBookView[] {
  return entries.map((entry) => {
    const book = catalog.find((candidate) => candidate.slug === entry.slug);
    const printed = (page: number | null) => (book && page !== null && page - book.pageOffset >= 1 ? page - book.pageOffset : page);
    return {
      ...entry,
      available: Boolean(book),
      bookTitle: book?.title ?? "",
      bookShortTitle: book?.shortTitle ?? "Kitab artıq Kitabxanada yoxdur",
      author: book?.author ?? "",
      printedFrom: printed(entry.pageFrom),
      printedTo: printed(entry.pageTo),
      openPage: entry.pageFrom ?? 1,
    };
  });
}

/** «Fiqh dərsində hansı kitabı keçəcəyik?», «Nəhv dərsinin kitabı», «Fıkıh dersinde hangi kitap» … */
export function detectCourseBooksQuestion(message: string) {
  const text = message.toLocaleLowerCase("az");
  if (/kitabxana|kütüphane|kutuphane/.test(text) && !/d[əe]rs|fənn|fenn/.test(text)) return false;
  if (/(kitabxanada|kütüphanede)\s+(axtar|ara|bul)/.test(text)) return false;
  const book = /(^|[^\p{L}])(kitab(?!xana)\p{L}*|kitap\p{L}*|dərslik\p{L}*|ders kitab\p{L}*)/u.test(text);
  const lesson = /(d[əe]rs\p{L}*|fənn\p{L}*|fenn\p{L}*|keç[əe]c[əe]y\p{L}*|keçirik|keçəcək\p{L}*|oxuyaca[ğq]\p{L}*|oxuyuruq|okuyaca[ğk]\p{L}*|okuyoruz|göreceğ\p{L}*|işləyəcəy\p{L}*)/u.test(text);
  return book && lesson;
}

export interface StudentCourseRef {
  courseId: number;
  title: string;
  termNumber: number;
}

export interface CourseBooksRow {
  courseId: number;
  termNumber: number;
  books: CourseBookEntry[];
}

const TERM_SUFFIX: Record<number, string> = { 1: "ci", 2: "ci", 3: "cü", 4: "cü", 5: "ci", 6: "cı", 7: "ci", 8: "ci" };
export function termLabel(termNumber: number) {
  return `${termNumber}-${TERM_SUFFIX[termNumber] ?? "ci"} semestr`;
}

function describe(view: CourseBookView) {
  const range = view.printedFrom !== null
    ? view.printedTo !== null && view.printedTo !== view.printedFrom ? `s. ${view.printedFrom}–${view.printedTo}` : `s. ${view.printedFrom}-dən`
    : null;
  return [`«${view.bookShortTitle}»`, view.chapterTitle ? `— ${view.chapterTitle}` : null, range ? `(${range})` : null, view.note ? `· ${view.note}` : null]
    .filter(Boolean).join(" ");
}

/**
 * Tələbənin öz fənləri üzrə dərs kitabları. matched — sualda adı çəkilən fənlər (boşdursa hamısı).
 * Hər fənn üçün cari semestrə ən yaxın (≤ cari) semestrin siyahısı götürülür.
 */
export function answerCourseBooks(input: {
  courses: StudentCourseRef[];
  matchedCourseIds: Set<number> | null;
  currentTerm: number;
  rows: CourseBooksRow[];
  catalog: readonly LibraryBook[];
}) {
  const relevant = input.courses.filter((course) => !input.matchedCourseIds || input.matchedCourseIds.has(course.courseId));
  const lines: string[] = [];
  const items: Array<{ courseId: number; courseTitle: string; termNumber: number; books: CourseBookView[] }> = [];
  const seenCourses = new Set<number>();
  for (const course of relevant) {
    if (seenCourses.has(course.courseId)) continue;
    const candidates = input.rows
      .filter((row) => row.courseId === course.courseId && row.termNumber <= Math.max(input.currentTerm, course.termNumber) && row.books.length)
      .sort((a, b) => b.termNumber - a.termNumber);
    const row = candidates.find((item) => item.termNumber === course.termNumber) ?? candidates[0];
    if (!row) continue;
    const books = resolveCourseBooks(row.books, input.catalog).filter((view) => view.available);
    if (!books.length) continue;
    seenCourses.add(course.courseId);
    items.push({ courseId: course.courseId, courseTitle: course.title, termNumber: row.termNumber, books });
    lines.push(`${course.title} (${termLabel(row.termNumber)}): ${books.map(describe).join("; ")}`);
  }
  if (!items.length) {
    const name = input.matchedCourseIds && relevant.length ? `«${relevant[0].title}» dərsi üçün` : "Dərsləriniz üçün";
    return {
      reply: `${name} hələ Kitabxanadan kitab təyin edilməyib. Müəllim və ya admin kitab seçəndən sonra burada və dərs cədvəlinizdə görünəcək.`,
      items,
    };
  }
  return {
    reply: [items.length === 1 ? "Bu dərsdə keçəcəyiniz kitab:" : "Dərslərinizdə keçəcəyiniz kitablar:", ...lines.map((line) => `• ${line}`), "«Oxu» düyməsi kitabı seçilmiş fəsil/səhifədə açır."].join("\n"),
    items,
  };
}

// ---------------------------------------------------------------------------
// Ehtiyat yol: lms_course_books cədvəli yoxdursa və ya fənn üçün boşdursa, kitab dərs resurslarından tanınır
// (bax resourceBooks.ts), o da yoxdursa Kitabxanadakı fənnə aid daxili kitablar təklif olunur.

export interface CourseResourceRef {
  courseId: number;
  termNumber: number;
  title: string;
  body: string | null;
}

export type CourseBooksItem = { courseId: number; courseTitle: string; termNumber: number; books: CourseBookView[] };

function relevantCourses(courses: StudentCourseRef[], matched: Set<number> | null) {
  const seen = new Set<number>();
  return courses.filter((course) => {
    if (matched && !matched.has(course.courseId)) return false;
    if (seen.has(course.courseId)) return false;
    seen.add(course.courseId);
    return true;
  });
}

/** Dərs resurslarında adı çəkilən Kitabxana kitabları (fəsil/səhifə ilə). */
export function courseBooksFromResources(input: {
  courses: StudentCourseRef[];
  matchedCourseIds: Set<number> | null;
  currentTerm: number;
  resources: CourseResourceRef[];
  catalog: readonly LibraryBook[];
}): CourseBooksItem[] {
  const items: CourseBooksItem[] = [];
  for (const course of relevantCourses(input.courses, input.matchedCourseIds)) {
    const limit = Math.max(input.currentTerm, course.termNumber);
    const byTerm = new Map<number, CourseBookView[]>();
    for (const resource of input.resources) {
      if (resource.courseId !== course.courseId || resource.termNumber > limit) continue;
      const match = matchResourceBook(resource, input.catalog);
      if (!match) continue;
      const book = input.catalog.find((candidate) => candidate.slug === match.slug);
      const views = byTerm.get(resource.termNumber) ?? [];
      if (views.some((view) => view.slug === match.slug && view.openPage === match.openPage)) continue;
      views.push({
        slug: match.slug,
        pageFrom: match.printedFrom !== null ? match.openPage : null,
        pageTo: match.printedTo !== null && book ? match.printedTo + book.pageOffset : null,
        chapterTitle: match.chapterTitle,
        note: null,
        available: true,
        bookTitle: match.bookTitle,
        bookShortTitle: match.bookShortTitle,
        author: book?.author ?? "",
        printedFrom: match.printedFrom,
        printedTo: match.printedTo,
        openPage: match.openPage,
      });
      byTerm.set(resource.termNumber, views);
    }
    const terms = Array.from(byTerm.keys()).sort((a, b) => b - a);
    const term = terms.includes(course.termNumber) ? course.termNumber : terms[0];
    if (term === undefined) continue;
    items.push({ courseId: course.courseId, courseTitle: course.title, termNumber: term, books: byTerm.get(term)!.slice(0, MAX_BOOKS_PER_LESSON) });
  }
  return items;
}

function plain(value: string) {
  return value.toLocaleLowerCase("az").replace(/[^\p{L}]/gu, "");
}

/** Fənnin adına uyğun mövzulu Kitabxana kitabları (məs. «Fiqh» → Şərhu Mənhəcis-Salikin). Təyin edilmiş kitab deyil, təklifdir. */
export function suggestedLibraryBooks(input: { courses: StudentCourseRef[]; matchedCourseIds: Set<number> | null; catalog: readonly LibraryBook[] }) {
  const result: Array<{ courseId: number; courseTitle: string; termNumber: number; books: LibraryBook[] }> = [];
  for (const course of relevantCourses(input.courses, input.matchedCourseIds)) {
    const title = plain(course.title);
    const books = input.catalog.filter((book) => {
      const subject = plain(book.subject);
      return subject.length >= 3 && title.includes(subject);
    });
    if (books.length) result.push({ courseId: course.courseId, courseTitle: course.title, termNumber: course.termNumber, books });
  }
  return result;
}
