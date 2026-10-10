// Dərs kitabları: dərsə (fənn + semestr) bağlanmış Kitabxana kitabları.
// GET — təsdiqlənmiş tələbə və heyət; PUT — sahib / köməkçi / admin və ya dərsin müəllimi (server yoxlayır).
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';

export type CourseBookEntry = { slug: string; pageFrom: number | null; pageTo: number | null; chapterTitle: string | null; note: string | null };
export type CourseBookView = CourseBookEntry & {
  available: boolean;
  bookTitle: string;
  bookShortTitle: string;
  author: string;
  printedFrom: number | null;
  printedTo: number | null;
  openPage: number;
};
export type CourseBooksItem = { courseId: number; termNumber: number; books: CourseBookView[] };

const siteBase = import.meta.env.BASE_URL.replace(/\/$/, '');
export const MAX_BOOKS_PER_LESSON = 8;

type State = { available: boolean; message: string | null; detail?: string | null; items: CourseBooksItem[] };

export function useCourseBooks(courseId?: number | null, loadFailed = 'Dərs kitablarını yükləmək mümkün olmadı.') {
  const { getToken } = useAuth();
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken().catch(() => null);
      const query = courseId ? `?courseId=${courseId}` : '';
      const response = await fetch(`${siteBase}/api/library/course-books${query}`, { headers: token ? { authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
      const data = await response.json().catch(() => null) as (Partial<State> & { error?: string }) | null;
      if (!response.ok || !data || !Array.isArray(data.items)) throw new Error(data?.error || loadFailed);
      setState({ available: data.available !== false, message: data.message ?? null, detail: data.detail ?? null, items: data.items });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : loadFailed);
    } finally {
      setLoading(false);
    }
  }, [getToken, courseId, loadFailed]);

  useEffect(() => { void load(); }, [load]);

  const booksFor = useCallback((id: number, termNumber?: number) => {
    const rows = (state?.items ?? []).filter((item) => item.courseId === id && (termNumber === undefined || item.termNumber === termNumber));
    return rows.sort((a, b) => a.termNumber - b.termNumber);
  }, [state]);

  return { available: state?.available ?? true, message: state?.message ?? null, detail: state?.detail ?? null, items: state?.items ?? [], booksFor, error, loading, reload: load };
}

export async function saveCourseBooksApi(getToken: () => Promise<string | null>, courseId: number, termNumber: number, books: CourseBookEntry[], failed = 'Dərs kitabları yadda saxlanılmadı.') {
  const token = await getToken().catch(() => null);
  const response = await fetch(`${siteBase}/api/library/course-books/${courseId}/${termNumber}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ books }),
  });
  const data = await response.json().catch(() => null) as { books?: CourseBookView[]; error?: string } | null;
  if (!response.ok || !data || !Array.isArray(data.books)) throw new Error(data?.error || failed);
  return data.books;
}

export function courseBookRange(view: Pick<CourseBookView, 'printedFrom' | 'printedTo'>, pagePrefix = 's.') {
  if (view.printedFrom === null) return null;
  if (view.printedTo !== null && view.printedTo !== view.printedFrom) return `${pagePrefix} ${view.printedFrom}–${view.printedTo}`;
  return `${pagePrefix} ${view.printedFrom}`;
}
