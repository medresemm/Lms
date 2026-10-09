// Yüklənmiş kitablar: baza (lms_library_books) + Supabase yaddaşı. Cədvəl yoxdursa (miqrasiya hələ edilməyib)
// kitabxana yalnız daxili kitablarla işləyir, yükləmə isə aydın mesajla bağlı qalır.
import { db, libraryBooksTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { libraryStorageConfigured, s3LibraryStore, type LibraryObjectStore } from "../applicationStorage.js";
import { findAssetPath } from "../assets.js";
import { LIBRARY_BOOKS, type LibraryBook } from "./catalog.js";
import { registerLibraryTexts, registeredLibraryTextVersion } from "./search.js";
import {
  isMissingTableError,
  parseUploadedText,
  uploadKeys,
  uploadedRowToBook,
  type CatalogBook,
  type UploadedBookRow,
} from "./uploads.js";

export type UploadsStatus =
  | { available: true }
  | { available: false; reason: "table" | "storage" | "error"; message: string };

export const UPLOADS_TABLE_MISSING_MESSAGE =
  "Kitab yükləmə hələ aktiv deyil: verilənlər bazasında «lms_library_books» cədvəli yaradılmayıb. Sahib bazanın ehtiyat nüsxəsini aldıqdan sonra cədvəli yaratmalıdır.";
export const UPLOADS_STORAGE_MISSING_MESSAGE = "Kitab yükləmə hələ aktiv deyil: fayl yaddaşı (Supabase) serverdə qoşulmayıb.";

export function builtinPdfAssetPath(slug: string) {
  return `library/${slug}/book.pdf`;
}

export function builtinCatalog(): CatalogBook[] {
  return LIBRARY_BOOKS.map((book) => {
    const pdf = findAssetPath(builtinPdfAssetPath(book.slug));
    return { ...book, source: "builtin" as const, hasText: true, hasCover: true, hasPdf: Boolean(pdf), fileSize: null, version: "builtin" };
  });
}

let cache: { at: number; books: CatalogBook[]; status: UploadsStatus } | null = null;
const CACHE_MS = 30_000;

export function invalidateUploadedBooks() {
  cache = null;
}

export function libraryStore(): LibraryObjectStore | null {
  return libraryStorageConfigured() ? s3LibraryStore : null;
}

/** Yüklənmiş kitablar (30 san. keş). Xəta olsa daxili kataloqa təsir etmir. */
export async function loadUploadedBooks(force = false): Promise<{ books: CatalogBook[]; status: UploadsStatus }> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache;
  let result: { books: CatalogBook[]; status: UploadsStatus };
  try {
    const rows = await db.select().from(libraryBooksTable).orderBy(desc(libraryBooksTable.createdAt));
    const books = rows.map((row) => uploadedRowToBook(row as UploadedBookRow));
    result = libraryStorageConfigured()
      ? { books, status: { available: true } }
      : { books: [], status: { available: false, reason: "storage", message: UPLOADS_STORAGE_MISSING_MESSAGE } };
  } catch (error) {
    result = isMissingTableError(error)
      ? { books: [], status: { available: false, reason: "table", message: UPLOADS_TABLE_MISSING_MESSAGE } }
      : { books: [], status: { available: false, reason: "error", message: "Yüklənmiş kitablar hazırda oxunmadı. Bir az sonra yenidən cəhd edin." } };
    // Müvəqqəti xətanı uzun müddət keşləməyək.
    if (result.status.available === false && result.status.reason === "error") {
      cache = { ...result, at: Date.now() - CACHE_MS + 5_000 };
      return result;
    }
  }
  cache = { ...result, at: Date.now() };
  return result;
}

export async function findUploadedRow(slug: string) {
  const [row] = await db.select().from(libraryBooksTable).where(eq(libraryBooksTable.slug, slug)).limit(1);
  return row ?? null;
}

const textLoads = new Map<string, Promise<void>>();

/** Mətn qatı olan yüklənmiş kitabların mətnini yaddaşdan oxuyub axtarış indeksinə qeyd edir. */
async function ensureTexts(books: CatalogBook[], store: LibraryObjectStore) {
  await Promise.all(books.filter((book) => book.hasText).map((book) => {
    if (registeredLibraryTextVersion(book.slug) === book.version) return Promise.resolve();
    const key = `${book.slug}@${book.version}`;
    let pending = textLoads.get(key);
    if (!pending) {
      pending = (async () => {
        try {
          const raw = await store.read(uploadKeys(book.slug.slice(2)).text);
          const parsed = parseUploadedText(raw, book.pageCount);
          registerLibraryTexts(book.slug, book.version, parsed.ok ? parsed.value.pages : null);
        } catch {
          // oxunmadı — bu sorğuda həmin kitab axtarılmır
        } finally {
          textLoads.delete(key);
        }
      })();
      textLoads.set(key, pending);
    }
    return pending;
  }));
}

/** Axtarış üçün kitablar: daxili + mətn qatı olan yüklənmiş kitablar. Hər hansı xətada yalnız daxili. */
export async function searchableLibraryBooks(): Promise<LibraryBook[]> {
  try {
    const { books, status } = await loadUploadedBooks();
    const store = libraryStore();
    if (!status.available || !store || !books.length) return [...LIBRARY_BOOKS];
    await ensureTexts(books, store);
    return [...LIBRARY_BOOKS, ...books.filter((book) => book.hasText && registeredLibraryTextVersion(book.slug) === book.version)];
  } catch {
    return [...LIBRARY_BOOKS];
  }
}
