// Mədrəsə Kitabxanası — kataloq və səhifə şəkilləri üçün ümumi köməkçilər.
// Kataloq və qısa ömürlü şəkil açarı /api/library/books-dan gəlir (yalnız təsdiqlənmiş tələbə və heyət).
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';

export type LibraryChapter = { title: string; level: 1 | 2; printedPage: number; page: number };
export type LibraryBook = {
  slug: string;
  title: string;
  shortTitle: string;
  author: string;
  commentator: string | null;
  foreword: string | null;
  publisher: string;
  edition: string | null;
  year: string;
  subject: string;
  pageCount: number;
  pageOffset: number;
  chapters: LibraryChapter[];
  /** builtin — skan şəkilləri serverdə; upload — admin yükləyib, səhifələr brauzerdə pdf.js ilə çəkilir. */
  source?: 'builtin' | 'upload';
  hasText?: boolean;
  hasCover?: boolean;
  hasPdf?: boolean;
  fileSize?: number | null;
  version?: string;
};

export type LibraryUploadsInfo =
  | { available: true; maxPdfBytes: number; maxPages: number; subjects: string[] }
  | { available: false; reason: 'table' | 'storage' | 'error'; message: string; maxPdfBytes: number; maxPages: number; subjects: string[] };

type CatalogState = { books: LibraryBook[]; token: string; expiresAt: number; canManage: boolean; uploads: LibraryUploadsInfo | null };

const siteBase = import.meta.env.BASE_URL.replace(/\/$/, '');
export const arabicBookFont = '"Amiri", "Noto Naskh Arabic", "Scheherazade New", "Traditional Arabic", "Geeza Pro", serif';

export function libraryPageUrl(slug: string, page: number, token: string) {
  return `${siteBase}/api/library/books/${encodeURIComponent(slug)}/pages/${page}?t=${encodeURIComponent(token)}`;
}

export function isUploadedBook(book: Pick<LibraryBook, 'source'>) {
  return book.source === 'upload';
}

/** Orijinal PDF: download — yükləmə (attachment); json — oxuyucu üçün qısa ömürlü URL. */
export function libraryFileUrl(slug: string, token: string, mode: 'download' | 'json' = 'download') {
  return `${siteBase}/api/library/books/${encodeURIComponent(slug)}/file?mode=${mode}&t=${encodeURIComponent(token)}`;
}

export function libraryCoverUrl(book: LibraryBook, token: string) {
  if (!isUploadedBook(book)) return libraryPageUrl(book.slug, 1, token);
  return book.hasCover ? `${siteBase}/api/library/books/${encodeURIComponent(book.slug)}/cover?t=${encodeURIComponent(token)}` : null;
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function libraryReaderHref(slug: string, page?: number) {
  return `/kitabxana/${encodeURIComponent(slug)}${page ? `?page=${page}` : ''}`;
}

export function chapterForPage(book: LibraryBook, page: number) {
  let found: LibraryChapter | null = null;
  for (const chapter of book.chapters) {
    if (chapter.page <= page) found = chapter;
    else break;
  }
  return found;
}

function progressKey(userId: string | null | undefined, slug: string) {
  return userId ? `medine-library:${userId}:${slug}` : null;
}

export function loadReadingPage(userId: string | null | undefined, slug: string) {
  const key = progressKey(userId, slug);
  if (!key || typeof window === 'undefined') return null;
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function saveReadingPage(userId: string | null | undefined, slug: string, page: number) {
  const key = progressKey(userId, slug);
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(page));
  } catch {
    // localStorage bağlıdırsa yalnız bu səhifədə qalır.
  }
}

/** Kataloqu yükləyir və şəkil açarını vaxtı bitməzdən əvvəl yeniləyir. */
export function useLibraryCatalog() {
  const { getToken } = useAuth();
  const [state, setState] = useState<CatalogState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken().catch(() => null);
      const response = await fetch(`${siteBase}/api/library/books`, { headers: token ? { authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
      const data = await response.json().catch(() => null) as { books?: LibraryBook[]; pageToken?: string; pageTokenExpiresAt?: string; canManage?: boolean; uploads?: LibraryUploadsInfo | null; error?: string } | null;
      if (!response.ok || !data || !Array.isArray(data.books) || typeof data.pageToken !== 'string') {
        throw new Error(data?.error || 'Kitabxananı yükləmək mümkün olmadı.');
      }
      setState({
        books: data.books,
        token: data.pageToken,
        expiresAt: Date.parse(data.pageTokenExpiresAt ?? '') || Date.now() + 30 * 60_000,
        canManage: data.canManage === true,
        uploads: data.uploads ?? null,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kitabxananı yükləmək mümkün olmadı.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!state) return;
    const wait = Math.max(30_000, state.expiresAt - Date.now() - 5 * 60_000);
    const timer = window.setTimeout(() => { void load(); }, wait);
    return () => window.clearTimeout(timer);
  }, [state, load]);

  return { books: state?.books ?? null, token: state?.token ?? null, canManage: state?.canManage ?? false, uploads: state?.uploads ?? null, error, loading, reload: load };
}

// ---------------------------------------------------------------------------
// Axtarış (Mədinə AI nəticələri, «daha çox» və oxuyucudakı axtarış)

export type LibrarySnippetPart = { text: string; hit?: boolean };
export type LibrarySearchItem = {
  slug: string;
  bookTitle: string;
  bookShortTitle?: string;
  chapterTitle: string | null;
  chapterPath?: string[];
  page: number;
  printedPage: number | null;
  snippet: string;
  parts?: LibrarySnippetPart[];
  match?: 'chapter' | 'text';
  partial?: boolean;
};
export type LibraryChapterSuggestion = { slug: string; bookShortTitle: string; title: string; page: number; printedPage: number };
export type LibrarySearchResponse = {
  query: string;
  items: LibrarySearchItem[];
  total: number;
  offset: number;
  limit: number;
  book: string | null;
  expanded: string[];
  didYouMean: LibraryChapterSuggestion[];
};

export const LIBRARY_SLUG = /^[a-z0-9-]{1,80}$/;

export async function searchLibraryApi(getToken: () => Promise<string | null>, input: { query: string; offset?: number; book?: string | null }) {
  const token = await getToken().catch(() => null);
  const response = await fetch(`${siteBase}/api/library/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query: input.query, offset: input.offset ?? 0, book: input.book ?? null }),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null) as (LibrarySearchResponse & { error?: string }) | null;
  if (!response.ok || !data || !Array.isArray(data.items)) throw new Error(data?.error || 'Axtarış alınmadı. Bir az sonra yenidən cəhd edin.');
  return data;
}

/** Nəticələri kitablara görə qruplaşdırır (sıra saxlanılır). */
export function groupLibraryItems<T extends { slug: string }>(items: T[]) {
  const groups: Array<{ slug: string; items: T[] }> = [];
  for (const item of items) {
    const group = groups.find((entry) => entry.slug === item.slug);
    if (group) group.items.push(item);
    else groups.push({ slug: item.slug, items: [item] });
  }
  return groups;
}
