// Dərs kitabları: tələbə/heyət üçün siyahı («Oxu» düyməsi ilə) və müəllim/admin üçün redaktor.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useAuth } from '@clerk/react';
import { BookMarked, BookOpen, Loader2, Plus, Trash2 } from 'lucide-react';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { libraryReaderHref, useLibraryCatalog, type LibraryBook } from '@/lib/library';
import { matchResourceBook, type ResourceBookMatch } from '@/lib/resource-books';
import {
  courseBookRange,
  MAX_BOOKS_PER_LESSON,
  saveCourseBooksApi,
  useCourseBooks,
  type CourseBookEntry,
  type CourseBookView,
} from '@/lib/course-books';

const ux = (t: (key: MessageKey) => string, key: string) => t(key as MessageKey);

const termSuffixes: Record<number, string> = { 1: 'ci', 2: 'ci', 3: 'cü', 4: 'cü', 5: 'ci', 6: 'cı', 7: 'ci', 8: 'ci' };
export const courseTermLabel = (term: number, locale: 'az' | 'ar' = 'az') => (locale === 'ar' ? `الفصل ${term}` : `${term}-${termSuffixes[term] ?? 'ci'} semestr`);

const fieldClass = 'rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.15)]';

/** Kitab siyahısı — hər kitab üçün «Oxu» seçilmiş fəsil/səhifədə açır. */
export function CourseBooksList({ books, compact = false, testId }: { books: CourseBookView[]; compact?: boolean; testId?: string }) {
  const { t } = useI18n();
  const visible = books.filter((book) => book.available);
  if (!visible.length) return null;
  const pagePrefix = ux(t, 'uxPageAbbrev');
  return (
    <ul className={compact ? 'space-y-1.5' : 'space-y-2'} data-testid={testId}>
      {visible.map((book, index) => {
        const range = courseBookRange(book, pagePrefix);
        return (
          <li key={`${book.slug}-${index}`} className={`flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] ${compact ? 'px-3 py-2' : 'px-3.5 py-2.5'}`}>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-bold text-[hsl(var(--primary))]"><BookMarked size={14} className="shrink-0 text-[hsl(var(--secondary-foreground))]" /><span className="truncate">{book.bookShortTitle}</span></p>
              {(book.chapterTitle || range || book.note) && (
                <p className="mt-0.5 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                  {book.chapterTitle && <span dir="rtl" className="font-[Amiri,serif] text-[13px]">{book.chapterTitle}</span>}
                  {book.chapterTitle && range && ' · '}
                  {range}
                  {book.note && <>{(book.chapterTitle || range) && ' · '}{book.note}</>}
                </p>
              )}
            </div>
            <Link href={libraryReaderHref(book.slug, book.openPage)} className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary-foreground))] hover:opacity-90" data-testid={`button-course-book-read-${book.slug}`}>
              <BookOpen size={13} /> {t('read')}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Dərs resursunda adı çəkilən Kitabxana kitabı (məs. «TEST kitab — شرح منهج السالكين», «باب نواقض الوضوء, səh. 55-56»).
 * Kataloq yalnız resurs olduqda yüklənir. Qaytarır: resurs → kitab (fəsil/səhifə ilə) və ya null.
 */
export function useResourceBookMatcher(enabled: boolean) {
  const catalog = useLibraryCatalog(enabled);
  const books = enabled ? catalog.books ?? [] : [];
  return useMemo(() => (resource: { title: string; body?: string | null }) => (books.length ? matchResourceBook(resource, books) : null), [books]);
}

/** Resurs kartındakı kitab sətri + «Oxu» (/kitabxana/<slug>?page=<n>, fəsildə açılır). */
export function ResourceBookRead({ match }: { match: ResourceBookMatch }) {
  const { t } = useI18n();
  const pagePrefix = ux(t, 'uxPageAbbrev');
  const range = match.printedFrom !== null
    ? match.printedTo !== null && match.printedTo !== match.printedFrom ? `${pagePrefix} ${match.printedFrom}–${match.printedTo}` : `${pagePrefix} ${match.printedFrom}`
    : null;
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2" data-testid={`resource-book-${match.slug}`}>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--primary))]"><BookMarked size={13} className="shrink-0 text-[hsl(var(--secondary-foreground))]" /><span className="truncate">{match.bookShortTitle}</span></p>
        {(match.chapterTitle || range) && <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{match.chapterTitle && <span dir="rtl" className="font-[Amiri,serif] text-[13px]">{match.chapterTitle}</span>}{match.chapterTitle && range && ' · '}{range}</p>}
      </div>
      <Link href={libraryReaderHref(match.slug, match.openPage)} className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary-foreground))] hover:opacity-90" data-testid={`button-resource-book-read-${match.slug}`}>
        <BookOpen size={13} /> {t('read')}
      </Link>
    </div>
  );
}

/** Tələbənin fənn pəncərəsi üçün: fənnin bütün semestrləri üzrə kitablar. */
export function CourseBooksSection({ courseId }: { courseId: number }) {
  const { t, locale } = useI18n();
  const { items, loading } = useCourseBooks(courseId);
  const rows = items.filter((item) => item.courseId === courseId && item.books.some((book) => book.available));
  if (loading || !rows.length) return null;
  return (
    <section className="space-y-2" data-testid="section-course-books">
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{ux(t, 'uxCourseBooks')}</p>
      {rows.map((row) => (
        <div key={row.termNumber} className="space-y-1.5">
          {rows.length > 1 && <p className="text-xs font-bold text-[hsl(var(--secondary-foreground))]">{courseTermLabel(row.termNumber, locale)}</p>}
          <CourseBooksList books={row.books} />
        </div>
      ))}
    </section>
  );
}

export type CourseBookDraft = { slug: string; chapter: string; from: string; to: string; note: string };
type Draft = CourseBookDraft;

export function courseBookDraftFromView(view: CourseBookView, book: LibraryBook | undefined): Draft {
  const chapterIndex = book && view.chapterTitle ? book.chapters.findIndex((chapter) => chapter.title === view.chapterTitle && chapter.page === view.pageFrom) : -1;
  return { slug: view.slug, chapter: chapterIndex >= 0 ? String(chapterIndex) : '', from: view.printedFrom?.toString() ?? '', to: view.printedTo?.toString() ?? '', note: view.note ?? '' };
}

export function courseBookDraftToEntry(draft: Draft, book: LibraryBook | undefined): CourseBookEntry {
  const offset = book?.pageOffset ?? 0;
  const scan = (value: string) => (value.trim() ? Number(value) + offset : null);
  const chapter = book && draft.chapter !== '' ? book.chapters[Number(draft.chapter)] : undefined;
  return { slug: draft.slug, pageFrom: scan(draft.from), pageTo: scan(draft.to), chapterTitle: chapter?.title ?? null, note: draft.note.trim() || null };
}

/** Qaralamaları serverə göndəriləcək siyahıya çevirir (silinmiş kitablar atılır). Səhv səhifədə xəta atır. */
export function courseBookEntriesFromDrafts(drafts: readonly Draft[], bookBySlug: ReadonlyMap<string, LibraryBook>, invalidPage = 'Səhifə nömrəsi yalnız rəqəm ola bilər.') {
  for (const draft of drafts) {
    if ((draft.from && !/^\d+$/.test(draft.from)) || (draft.to && !/^\d+$/.test(draft.to))) throw new Error(invalidPage);
  }
  const kept = drafts.filter((draft) => bookBySlug.has(draft.slug));
  return { entries: kept.map((draft) => courseBookDraftToEntry(draft, bookBySlug.get(draft.slug))), dropped: drafts.length - kept.length };
}

function normalize(value: string) {
  return value.toLocaleLowerCase('az').replace(/[^\p{L}]/gu, '');
}

/** Fənnin adına uyğun mövzulu kitablar əvvəl. */
export function orderedLibraryBooks(books: readonly LibraryBook[], courseTitle?: string) {
  const title = normalize(courseTitle ?? '');
  return [...books].sort((a, b) => Number(title.includes(normalize(b.subject))) - Number(title.includes(normalize(a.subject))) || a.shortTitle.localeCompare(b.shortTitle, 'az'));
}

/**
 * Kitab seçimi sahələri (kitab + mündəricatdan bab və ya səhifə aralığı + qeyd), bir neçə kitab.
 * Həm «Kitablar» redaktorunda, həm də «Cədvəl hazırlama» dərs formasında istifadə olunur.
 */
export function CourseBookDraftsFields({ drafts, onChange, books, courseTitle, testIdPrefix = 'course-book' }: {
  drafts: Draft[];
  onChange: (next: Draft[]) => void;
  books: readonly LibraryBook[];
  courseTitle?: string;
  testIdPrefix?: string;
}) {
  const { t } = useI18n();
  const bookBySlug = useMemo(() => new Map(books.map((book) => [book.slug, book])), [books]);
  const ordered = useMemo(() => orderedLibraryBooks(books, courseTitle), [books, courseTitle]);
  const update = (index: number, patch: Partial<Draft>) => onChange(drafts.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  const add = () => {
    const first = ordered[0];
    if (!first) return;
    onChange([...drafts, { slug: first.slug, chapter: '', from: '', to: '', note: '' }]);
  };
  return (
    <div className="space-y-2">
      {drafts.map((draft, index) => {
        const book = bookBySlug.get(draft.slug);
        return (
          <div key={index} className="space-y-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3" data-testid={`row-${testIdPrefix}-${index}`}>
            <div className="flex gap-2">
              <select aria-label={t('bookLabel')} className={`${fieldClass} min-w-0 flex-1`} value={draft.slug} onChange={(event) => update(index, { slug: event.target.value, chapter: '', from: '', to: '' })} data-testid={`select-${testIdPrefix}-${index}`}>
                {!book && <option value={draft.slug}>{ux(t, 'uxBookGone')}</option>}
                {ordered.map((option) => <option key={option.slug} value={option.slug}>{option.shortTitle} · {option.subject}</option>)}
              </select>
              <button type="button" onClick={() => onChange(drafts.filter((_, position) => position !== index))} className="focus-ring shrink-0 rounded-lg px-2.5 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]" aria-label={ux(t, 'uxRemoveBook')} data-testid={`button-remove-${testIdPrefix}-${index}`}><Trash2 size={15} /></button>
            </div>
            {!book && <p className="text-xs font-semibold text-amber-800">{ux(t, 'uxBookRemovedOnSave')}</p>}
            {book && book.chapters.length > 0 && (
              <select aria-label={ux(t, 'uxChapterBab')} className={`${fieldClass} w-full`} dir="auto" value={draft.chapter} onChange={(event) => {
                const value = event.target.value;
                const chapter = value === '' ? null : book.chapters[Number(value)];
                const next = chapter ? book.chapters.slice(Number(value) + 1).find((item) => item.level <= chapter.level) : undefined;
                update(index, { chapter: value, from: chapter ? String(chapter.printedPage) : draft.from, to: chapter ? (next && next.printedPage > chapter.printedPage ? String(next.printedPage - 1) : '') : draft.to });
              }} data-testid={`select-${testIdPrefix}-chapter-${index}`}>
                <option value="">{ux(t, 'uxNoChapter')}</option>
                {book.chapters.map((chapter, chapterIndex) => <option key={chapterIndex} value={chapterIndex}>{chapter.level === 2 ? '  — ' : ''}{chapter.title} ({ux(t, 'uxPageAbbrev')} {chapter.printedPage})</option>)}
              </select>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <span>{ux(t, 'uxPage')}</span>
              <input inputMode="numeric" aria-label={ux(t, 'uxPageFrom')} placeholder={ux(t, 'uxFromPh')} className={`${fieldClass} w-20 text-center`} value={draft.from} onChange={(event) => update(index, { from: event.target.value.replace(/\D/g, '').slice(0, 5) })} data-testid={`input-${testIdPrefix}-from-${index}`} />
              <span>–</span>
              <input inputMode="numeric" aria-label={ux(t, 'uxPageTo')} placeholder={ux(t, 'uxToPh')} className={`${fieldClass} w-20 text-center`} value={draft.to} onChange={(event) => update(index, { to: event.target.value.replace(/\D/g, '').slice(0, 5) })} data-testid={`input-${testIdPrefix}-to-${index}`} />
              <span className="text-[11px]">{ux(t, 'uxPrintedHint')}</span>
            </div>
            <input aria-label={ux(t, 'uxNote')} placeholder={ux(t, 'uxNotePh')} maxLength={200} className={`${fieldClass} w-full`} value={draft.note} onChange={(event) => update(index, { note: event.target.value })} data-testid={`input-${testIdPrefix}-note-${index}`} />
          </div>
        );
      })}
      <button type="button" onClick={add} disabled={drafts.length >= MAX_BOOKS_PER_LESSON || !books.length} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))] disabled:opacity-50" data-testid={`button-add-${testIdPrefix}`}><Plus size={14} /> {ux(t, 'uxAddBook')}</button>
    </div>
  );
}

/** Müəllim / admin: dərsə Kitabxanadan kitab(lar) bağlamaq. Server icazəni yoxlayır. */
export function CourseBooksEditor({ courseId, termNumber, courseTitle }: { courseId: number; termNumber: number; courseTitle?: string }) {
  const { t } = useI18n();
  const { getToken } = useAuth();
  const catalog = useLibraryCatalog(true, ux(t, 'uxLibraryLoadFail'));
  const current = useCourseBooks(courseId, ux(t, 'uxCourseBooksLoadFail'));
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const books = catalog.books ?? [];
  const bookBySlug = useMemo(() => new Map(books.map((book) => [book.slug, book])), [books]);
  const saved = current.items.find((item) => item.termNumber === termNumber)?.books ?? [];

  useEffect(() => {
    if (current.loading || catalog.loading) return;
    setDrafts(saved.map((view) => courseBookDraftFromView(view, bookBySlug.get(view.slug))));
    // Yalnız yükləmə bitəndə doldurulur.
  }, [current.loading, catalog.loading, termNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current.available) {
    return <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900" data-testid="text-course-books-unavailable">{current.message ?? t('booksUnavailable')}{current.detail && <span className="mt-1 block font-normal opacity-80" data-testid="text-course-books-unavailable-detail">{ux(t, 'uxCheckDetail').replace('{detail}', current.detail)}</span>}</p>;
  }
  if (current.loading || catalog.loading || drafts === null) {
    return <p className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><Loader2 size={13} className="animate-spin" /> {t('booksLoading')}</p>;
  }
  if (current.error || catalog.error) {
    return <p className="text-xs font-semibold text-[hsl(var(--destructive))]">{current.error || catalog.error}</p>;
  }

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      // Kitabxanadan silinmiş kitablar avtomatik çıxarılır.
      const { entries, dropped } = courseBookEntriesFromDrafts(drafts, bookBySlug, ux(t, 'uxInvalidPage'));
      const result = await saveCourseBooksApi(getToken, courseId, termNumber, entries, ux(t, 'uxCourseBooksSaveFail'));
      setDrafts(result.map((view) => courseBookDraftFromView(view, bookBySlug.get(view.slug))));
      await current.reload();
      const base = result.length ? ux(t, 'uxCourseBooksSaved') : ux(t, 'uxCourseBooksCleared');
      setNotice({ text: dropped ? `${base} ${ux(t, 'uxCourseBooksDropped').replace('{n}', String(dropped))}` : base, error: false });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : ux(t, 'uxCourseBooksSaveFail'), error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3" data-testid={`editor-course-books-${courseId}-${termNumber}`}>
      {drafts.length === 0 && <p className="text-xs text-[hsl(var(--muted-foreground))]">{ux(t, 'uxNoCourseBook')}</p>}
      <CourseBookDraftsFields drafts={drafts} onChange={setDrafts} books={books} courseTitle={courseTitle} />
      {notice && <p className={`rounded-lg px-3 py-2 text-xs font-semibold ${notice.error ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`} data-testid="text-course-books-notice">{notice.text}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void save()} disabled={saving} className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50" data-testid="button-save-course-books">{saving && <Loader2 size={13} className="animate-spin" />} {ux(t, 'uxSaveCourseBooks')}</button>
      </div>
    </div>
  );
}
