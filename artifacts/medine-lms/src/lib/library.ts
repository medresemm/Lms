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
};

type CatalogState = { books: LibraryBook[]; token: string; expiresAt: number };

const siteBase = import.meta.env.BASE_URL.replace(/\/$/, '');
export const arabicBookFont = '"Amiri", "Noto Naskh Arabic", "Scheherazade New", "Traditional Arabic", "Geeza Pro", serif';

export function libraryPageUrl(slug: string, page: number, token: string) {
  return `${siteBase}/api/library/books/${encodeURIComponent(slug)}/pages/${page}?t=${encodeURIComponent(token)}`;
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
      const data = await response.json().catch(() => null) as { books?: LibraryBook[]; pageToken?: string; pageTokenExpiresAt?: string; error?: string } | null;
      if (!response.ok || !data || !Array.isArray(data.books) || typeof data.pageToken !== 'string') {
        throw new Error(data?.error || 'Kitabxananı yükləmək mümkün olmadı.');
      }
      setState({ books: data.books, token: data.pageToken, expiresAt: Date.parse(data.pageTokenExpiresAt ?? '') || Date.now() + 30 * 60_000 });
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

  return { books: state?.books ?? null, token: state?.token ?? null, error, loading, reload: load };
}
