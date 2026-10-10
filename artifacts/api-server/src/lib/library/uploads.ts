// Kitabxanaya admin tərəfindən yüklənən kitablar: giriş yoxlaması, fayl yolları, mətn qatı, yükləmə adı.
// Bu fayl bazadan və yaddaşdan asılı deyil (testlərdə birbaşa yoxlanılır).
import type { LibraryBook, LibraryChapter } from "./catalog.js";

export const LIBRARY_MAX_PDF_BYTES = 100 * 1024 * 1024;
export const LIBRARY_MAX_TEXT_BYTES = 25 * 1024 * 1024;
export const LIBRARY_MAX_COVER_BYTES = 2 * 1024 * 1024;
export const LIBRARY_MAX_PAGES = 3000;
export const LIBRARY_MAX_CHAPTERS = 600;
export const LIBRARY_MAX_PAGE_TEXT = 30_000;
export const LIBRARY_SUBJECTS = ["Fiqh", "Nəhv", "Sərf", "Əqidə", "Hədis", "Təfsir", "Üsul", "Siyər", "Ərəb dili", "Digər"] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isStorageId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function uploadedSlug(storageId: string) {
  return `u-${storageId}`;
}

export function isUploadedSlug(slug: string) {
  return slug.startsWith("u-") && isStorageId(slug.slice(2));
}

export function uploadKeys(storageId: string) {
  const base = `library/uploads/${storageId}`;
  return { pdf: `${base}/book.pdf`, text: `${base}/text.json`, cover: `${base}/cover.jpg` };
}

export function builtinPdfKey(slug: string) {
  return `library/builtin/${slug}.pdf`;
}

export interface UploadedBookFields {
  title: string;
  shortTitle: string;
  author: string;
  commentator: string | null;
  publisher: string;
  year: string;
  subject: string;
  pageOffset: number;
  chapters: LibraryChapter[];
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function cleanText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  // Nəzarət simvollarını və bidi-ləğvetmə simvollarını at; boşluqları sıxışdır.
  const cleaned = value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > max ? null : cleaned;
}

/** Metadata + fəsil siyahısının yoxlanması. pageCount — PDF-in səhifə sayı (fəsil səhifələrini yoxlamaq üçün). */
export function validateBookFields(raw: unknown, pageCount: number): Result<UploadedBookFields> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Kitab məlumatları göndərilməyib." };
  const body = raw as Record<string, unknown>;
  const title = cleanText(body.title, 300);
  if (!title || title.length < 2) return { ok: false, error: "Kitabın adı 2–300 simvol olmalıdır." };
  const author = cleanText(body.author, 200);
  if (!author || author.length < 2) return { ok: false, error: "Müəllifin adı 2–200 simvol olmalıdır." };
  const shortTitle = cleanText(body.shortTitle, 120) || (title.length > 80 ? `${title.slice(0, 79)}…` : title);
  const commentatorRaw = cleanText(body.commentator, 200);
  if (body.commentator && commentatorRaw === null) return { ok: false, error: "Şarihin adı ən çox 200 simvol ola bilər." };
  const publisher = cleanText(body.publisher, 200);
  if (body.publisher && publisher === null) return { ok: false, error: "Nəşriyyat ən çox 200 simvol ola bilər." };
  const year = cleanText(body.year, 40);
  if (body.year && year === null) return { ok: false, error: "İl ən çox 40 simvol ola bilər." };
  const subject = typeof body.subject === "string" ? body.subject : "";
  if (!(LIBRARY_SUBJECTS as readonly string[]).includes(subject)) return { ok: false, error: "Bölməni siyahıdan seçin." };
  const pageOffset = body.pageOffset === undefined || body.pageOffset === "" ? 0 : Number(body.pageOffset);
  if (!Number.isSafeInteger(pageOffset) || pageOffset < -50 || pageOffset > 500) {
    return { ok: false, error: "Səhifə sürüşməsi −50 ilə 500 arasında tam ədəd olmalıdır." };
  }
  const rawChapters = body.chapters ?? [];
  if (!Array.isArray(rawChapters)) return { ok: false, error: "Fəsil siyahısı düzgün deyil." };
  if (rawChapters.length > LIBRARY_MAX_CHAPTERS) return { ok: false, error: `Ən çox ${LIBRARY_MAX_CHAPTERS} fəsil əlavə etmək olar.` };
  const chapters: LibraryChapter[] = [];
  for (const [index, item] of rawChapters.entries()) {
    const row = (item ?? {}) as Record<string, unknown>;
    const chapterTitle = cleanText(row.title, 200);
    if (!chapterTitle) return { ok: false, error: `${index + 1}-ci fəslin başlığı boşdur və ya çox uzundur.` };
    const printedPage = Number(row.printedPage);
    const page = printedPage + pageOffset;
    if (!Number.isSafeInteger(printedPage) || page < 1 || page > pageCount) {
      return { ok: false, error: `«${chapterTitle}» fəslinin səhifəsi kitabın hüdudlarından kənardadır (PDF: 1–${pageCount}, sürüşmə: ${pageOffset}).` };
    }
    chapters.push({ title: chapterTitle, level: row.level === 2 ? 2 : 1, printedPage, page });
  }
  chapters.sort((a, b) => a.page - b.page);
  return {
    ok: true,
    value: { title, shortTitle, author, commentator: commentatorRaw || null, publisher: publisher ?? "", year: year ?? "", subject, pageOffset, chapters },
  };
}

/** PDF başlığı: spesifikasiyaya görə «%PDF-» ilk 1024 baytın içində olmalıdır. */
export function looksLikePdf(head: Buffer) {
  return head.subarray(0, 1024).includes(Buffer.from("%PDF-"));
}

/** Brauzerdə pdf.js ilə çıxarılmış mətn qatı: {"pages": ["...", ...]} — səhifə sayı PDF-ə bərabər olmalıdır. */
export function parseUploadedText(raw: Buffer, pageCount: number): Result<{ pages: string[]; hasText: boolean }> {
  if (raw.length > LIBRARY_MAX_TEXT_BYTES) return { ok: false, error: "Mətn faylı çox böyükdür." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    return { ok: false, error: "Mətn faylı oxunmadı." };
  }
  const pages = (parsed as { pages?: unknown })?.pages;
  if (!Array.isArray(pages) || pages.length !== pageCount) return { ok: false, error: "Mətn faylının səhifə sayı PDF-ə uyğun deyil." };
  let letters = 0;
  const clean = pages.map((page) => {
    // NFKC: ərəb təqdimat formaları (ﺤ ﻟ ا) → əsas hərflər; xəritəsiz glyph-lər (\u0000) atılır.
    const text = typeof page === "string"
      ? page.slice(0, LIBRARY_MAX_PAGE_TEXT).normalize("NFKC").replace(/[\u0000\ufffd]/g, "").replace(/[\u0001-\u0008\u000b-\u001f\u007f]/g, " ")
      : "";
    letters += (text.match(/[\p{L}]/gu) ?? []).length;
    return text;
  });
  // Skan PDF-lərdə mətn qatı ya yoxdur, ya da bir-iki təsadüfi simvoldan ibarətdir.
  const hasText = letters >= Math.max(200, pageCount * 20);
  return { ok: true, value: { pages: clean, hasText } };
}

const LATIN_MAP: Record<string, string> = { ə: "e", Ə: "E", ı: "i", İ: "I", ş: "s", Ş: "S", ç: "c", Ç: "C", ğ: "g", Ğ: "G", ö: "o", Ö: "O", ü: "u", Ü: "U", x: "x" };

/** Content-Disposition: ASCII ehtiyat adı + UTF-8 (RFC 5987) əsl adı. */
export function pdfContentDisposition(displayName: string, fallbackSlug: string) {
  const base = displayName.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || fallbackSlug;
  const ascii = base
    .replace(/[əƏıİşŞçÇğĞöÖüÜ]/g, (ch) => LATIN_MAP[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[^A-Za-z0-9._ -]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  const asciiName = `${ascii.length >= 3 ? ascii : fallbackSlug}.pdf`;
  const encoded = encodeURIComponent(`${base}.pdf`).replace(/['()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`;
}

export interface UploadedBookRow {
  slug: string;
  storageId: string;
  title: string;
  shortTitle: string;
  author: string;
  commentator: string | null;
  publisher: string;
  year: string;
  subject: string;
  pageCount: number;
  pageOffset: number;
  chapters: LibraryChapter[];
  hasText: boolean;
  hasCover: boolean;
  fileSize: number;
  updatedAt: Date | string;
}

export type CatalogBook = LibraryBook & {
  source: "builtin" | "upload";
  hasText: boolean;
  hasCover: boolean;
  hasPdf: boolean;
  fileSize: number | null;
  version: string;
};

export function uploadedRowToBook(row: UploadedBookRow): CatalogBook {
  return {
    slug: row.slug,
    title: row.title,
    shortTitle: row.shortTitle,
    author: row.author,
    commentator: row.commentator,
    foreword: null,
    publisher: row.publisher,
    edition: null,
    year: row.year,
    subject: row.subject,
    pageCount: row.pageCount,
    pageOffset: row.pageOffset,
    chapters: Array.isArray(row.chapters) ? row.chapters : [],
    source: "upload",
    hasText: row.hasText,
    hasCover: row.hasCover,
    hasPdf: true,
    fileSize: row.fileSize,
    version: new Date(row.updatedAt).toISOString(),
  };
}

/**
 * Postgres «relation does not exist» (42P01) — yalnız göstərilən cədvəl üçün.
 * Başqa cədvəlin yoxluğu, «column ... does not exist» (42703), icazə (42501), bağlantı və s. xətalar
 * «cədvəl yaradılmayıb» kimi yozulmur — onlar ayrıca «error» kimi qaytarılır və serverdə log edilir.
 */
export function isMissingTableError(error: unknown, table = "lms_library_books"): boolean {
  const relationPattern = /relation "(?:[\w$]+\.)?([\w$]+)" does not exist/i;
  let current: unknown = error;
  for (let depth = 0; current && depth < 6; depth += 1) {
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
    const message = typeof candidate.message === "string" ? candidate.message : "";
    const relation = relationPattern.exec(message)?.[1];
    if (candidate.code === "42P01") {
      // Mesajda cədvəl adı varsa, məhz bizim cədvəl olmalıdır; ad yoxdursa kod kifayətdir.
      if (!relation || relation === table) return true;
      return false;
    }
    if (relation === table && candidate.code === undefined) return true;
    current = candidate.cause;
  }
  return false;
}

/** Server log-u üçün xətanın qısa təsviri (kod + mesaj, zəncir boyu). Parol və s. olmur — yalnız Postgres mesajı. */
export function describeDbError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 6; depth += 1) {
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
    const code = typeof candidate.code === "string" ? candidate.code : "";
    const message = typeof candidate.message === "string" ? candidate.message.slice(0, 300) : String(current).slice(0, 300);
    parts.push(code ? `[${code}] ${message}` : message);
    current = candidate.cause;
  }
  return parts.join(" <- ");
}
