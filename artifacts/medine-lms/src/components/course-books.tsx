// Dərs kitabları: tələbə/heyət üçün siyahı («Oxu» düyməsi ilə) və müəllim/admin üçün redaktor.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useAuth } from '@clerk/react';
import { BookMarked, BookOpen, Loader2, Plus, Trash2 } from 'lucide-react';
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

const termSuffixes: Record<number, string> = { 1: 'ci', 2: 'ci', 3: 'cü', 4: 'cü', 5: 'ci', 6: 'cı', 7: 'ci', 8: 'ci' };
export const courseTermLabel = (term: number) => `${term}-${termSuffixes[term] ?? 'ci'} semestr`;

const fieldClass = 'rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.15)]';

/** Kitab siyahısı — hər kitab üçün «Oxu» seçilmiş fəsil/səhifədə açır. */
export function CourseBooksList({ books, compact = false, testId }: { books: CourseBookView[]; compact?: boolean; testId?: string }) {
  const visible = books.filter((book) => book.available);
  if (!visible.length) return null;
  return (
    <ul className={compact ? 'space-y-1.5' : 'space-y-2'} data-testid={testId}>
      {visible.map((book, index) => {
        const range = courseBookRange(book);
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
              <BookOpen size={13} /> Oxu
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
  const range = match.printedFrom !== null
    ? match.printedTo !== null && match.printedTo !== match.printedFrom ? `s. ${match.printedFrom}–${match.printedTo}` : `s. ${match.printedFrom}`
    : null;
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2" data-testid={`resource-book-${match.slug}`}>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--primary))]"><BookMarked size={13} className="shrink-0 text-[hsl(var(--secondary-foreground))]" /><span className="truncate">{match.bookShortTitle}</span></p>
        {(match.chapterTitle || range) && <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{match.chapterTitle && <span dir="rtl" className="font-[Amiri,serif] text-[13px]">{match.chapterTitle}</span>}{match.chapterTitle && range && ' · '}{range}</p>}
      </div>
      <Link href={libraryReaderHref(match.slug, match.openPage)} className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary-foreground))] hover:opacity-90" data-testid={`button-resource-book-read-${match.slug}`}>
        <BookOpen size={13} /> Oxu
      </Link>
    </div>
  );
}

/** Tələbənin fənn pəncərəsi üçün: fənnin bütün semestrləri üzrə kitablar. */
export function CourseBooksSection({ courseId }: { courseId: number }) {
  const { items, loading } = useCourseBooks(courseId);
  const rows = items.filter((item) => item.courseId === courseId && item.books.some((book) => book.available));
  if (loading || !rows.length) return null;
  return (
    <section className="space-y-2" data-testid="section-course-books">
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Dərs kitabları</p>
      {rows.map((row) => (
        <div key={row.termNumber} className="space-y-1.5">
          {rows.length > 1 && <p className="text-xs font-bold text-[hsl(var(--secondary-foreground))]">{courseTermLabel(row.termNumber)}</p>}
          <CourseBooksList books={row.books} />
        </div>
      ))}
    </section>
  );
}

type Draft = { slug: string; chapter: string; from: string; to: string; note: string };

function draftFromView(view: CourseBookView, book: LibraryBook | undefined): Draft {
  const chapterIndex = book && view.chapterTitle ? book.chapters.findIndex((chapter) => chapter.title === view.chapterTitle && chapter.page === view.pageFrom) : -1;
  return { slug: view.slug, chapter: chapterIndex >= 0 ? String(chapterIndex) : '', from: view.printedFrom?.toString() ?? '', to: view.printedTo?.toString() ?? '', note: view.note ?? '' };
}

function draftToEntry(draft: Draft, book: LibraryBook | undefined): CourseBookEntry {
  const offset = book?.pageOffset ?? 0;
  const scan = (value: string) => (value.trim() ? Number(value) + offset : null);
  const chapter = book && draft.chapter !== '' ? book.chapters[Number(draft.chapter)] : undefined;
  return { slug: draft.slug, pageFrom: scan(draft.from), pageTo: scan(draft.to), chapterTitle: chapter?.title ?? null, note: draft.note.trim() || null };
}

function normalize(value: string) {
  return value.toLocaleLowerCase('az').replace(/[^\p{L}]/gu, '');
}

/** Müəllim / admin: dərsə Kitabxanadan kitab(lar) bağlamaq. Server icazəni yoxlayır. */
export function CourseBooksEditor({ courseId, termNumber, courseTitle }: { courseId: number; termNumber: number; courseTitle?: string }) {
  const { getToken } = useAuth();
  const catalog = useLibraryCatalog();
  const current = useCourseBooks(courseId);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const books = catalog.books ?? [];
  const bookBySlug = useMemo(() => new Map(books.map((book) => [book.slug, book])), [books]);
  const saved = current.items.find((item) => item.termNumber === termNumber)?.books ?? [];

  useEffect(() => {
    if (current.loading || catalog.loading) return;
    setDrafts(saved.map((view) => draftFromView(view, bookBySlug.get(view.slug))));
    // Yalnız yükləmə bitəndə doldurulur.
  }, [current.loading, catalog.loading, termNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fənnin adına uyğun mövzulu kitablar əvvəl.
  const ordered = useMemo(() => {
    const title = normalize(courseTitle ?? '');
    return [...books].sort((a, b) => Number(title.includes(normalize(b.subject))) - Number(title.includes(normalize(a.subject))) || a.shortTitle.localeCompare(b.shortTitle, 'az'));
  }, [books, courseTitle]);

  if (!current.available) {
    return <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900" data-testid="text-course-books-unavailable">{current.message ?? 'Dərs kitabları hələ aktiv deyil.'}</p>;
  }
  if (current.loading || catalog.loading || drafts === null) {
    return <p className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><Loader2 size={13} className="animate-spin" /> Kitablar yüklənir…</p>;
  }
  if (current.error || catalog.error) {
    return <p className="text-xs font-semibold text-[hsl(var(--destructive))]">{current.error || catalog.error}</p>;
  }

  const update = (index: number, patch: Partial<Draft>) => setDrafts((rows) => (rows ?? []).map((row, position) => (position === index ? { ...row, ...patch } : row)));
  const add = () => {
    const first = ordered[0];
    if (!first) return;
    setDrafts((rows) => [...(rows ?? []), { slug: first.slug, chapter: '', from: '', to: '', note: '' }]);
  };
  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      for (const draft of drafts) {
        if ((draft.from && !/^\d+$/.test(draft.from)) || (draft.to && !/^\d+$/.test(draft.to))) throw new Error('Səhifə nömrəsi yalnız rəqəm ola bilər.');
      }
      // Kitabxanadan silinmiş kitablar avtomatik çıxarılır.
      const kept = drafts.filter((draft) => bookBySlug.has(draft.slug));
      const dropped = drafts.length - kept.length;
      const result = await saveCourseBooksApi(getToken, courseId, termNumber, kept.map((draft) => draftToEntry(draft, bookBySlug.get(draft.slug))));
      setDrafts(result.map((view) => draftFromView(view, bookBySlug.get(view.slug))));
      await current.reload();
      const base = result.length ? 'Dərs kitabları yadda saxlanıldı. Tələbələr «Oxu» düyməsi ilə açacaq.' : 'Dərsdən kitablar çıxarıldı.';
      setNotice({ text: dropped ? `${base} Kitabxanadan silinmiş ${dropped} kitab siyahıdan çıxarıldı.` : base, error: false });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Dərs kitabları yadda saxlanılmadı.', error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3" data-testid={`editor-course-books-${courseId}-${termNumber}`}>
      {drafts.length === 0 && <p className="text-xs text-[hsl(var(--muted-foreground))]">Bu dərsə hələ kitab bağlanmayıb.</p>}
      {drafts.map((draft, index) => {
        const book = bookBySlug.get(draft.slug);
        return (
          <div key={index} className="space-y-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3" data-testid={`row-course-book-${index}`}>
            <div className="flex gap-2">
              <select aria-label="Kitab" className={`${fieldClass} min-w-0 flex-1`} value={draft.slug} onChange={(event) => update(index, { slug: event.target.value, chapter: '', from: '', to: '' })} data-testid={`select-course-book-${index}`}>
                {!book && <option value={draft.slug}>Kitab artıq Kitabxanada yoxdur</option>}
                {ordered.map((option) => <option key={option.slug} value={option.slug}>{option.shortTitle} · {option.subject}</option>)}
              </select>
              <button type="button" onClick={() => setDrafts((rows) => (rows ?? []).filter((_, position) => position !== index))} className="focus-ring shrink-0 rounded-lg px-2.5 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]" aria-label="Kitabı çıxar" data-testid={`button-remove-course-book-${index}`}><Trash2 size={15} /></button>
            </div>
            {!book && <p className="text-xs font-semibold text-amber-800">Bu kitab Kitabxanadan silinib — yadda saxlayanda siyahıdan çıxarılacaq.</p>}
            {book && book.chapters.length > 0 && (
              <select aria-label="Fəsil" className={`${fieldClass} w-full`} dir="auto" value={draft.chapter} onChange={(event) => {
                const value = event.target.value;
                const chapter = value === '' ? null : book.chapters[Number(value)];
                const next = chapter ? book.chapters.slice(Number(value) + 1).find((item) => item.level <= chapter.level) : undefined;
                update(index, { chapter: value, from: chapter ? String(chapter.printedPage) : draft.from, to: chapter ? (next && next.printedPage > chapter.printedPage ? String(next.printedPage - 1) : '') : draft.to });
              }} data-testid={`select-course-book-chapter-${index}`}>
                <option value="">Fəsil seçilməyib (bütün kitab və ya səhifə aralığı)</option>
                {book.chapters.map((chapter, chapterIndex) => <option key={chapterIndex} value={chapterIndex}>{chapter.level === 2 ? '  — ' : ''}{chapter.title} (s. {chapter.printedPage})</option>)}
              </select>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <span>Səhifə</span>
              <input inputMode="numeric" aria-label="Başlanğıc səhifə" placeholder="dən" className={`${fieldClass} w-20 text-center`} value={draft.from} onChange={(event) => update(index, { from: event.target.value.replace(/\D/g, '').slice(0, 5) })} data-testid={`input-course-book-from-${index}`} />
              <span>–</span>
              <input inputMode="numeric" aria-label="Son səhifə" placeholder="dək" className={`${fieldClass} w-20 text-center`} value={draft.to} onChange={(event) => update(index, { to: event.target.value.replace(/\D/g, '').slice(0, 5) })} data-testid={`input-course-book-to-${index}`} />
              <span className="text-[11px]">(kitabdakı çap nömrəsi; boş qalsa — bütün kitab)</span>
            </div>
            <input aria-label="Qeyd" placeholder="Qeyd (məs.: 1–4-cü həftələr)" maxLength={200} className={`${fieldClass} w-full`} value={draft.note} onChange={(event) => update(index, { note: event.target.value })} data-testid={`input-course-book-note-${index}`} />
          </div>
        );
      })}
      {notice && <p className={`rounded-lg px-3 py-2 text-xs font-semibold ${notice.error ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`} data-testid="text-course-books-notice">{notice.text}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={add} disabled={drafts.length >= MAX_BOOKS_PER_LESSON || !books.length} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))] disabled:opacity-50" data-testid="button-add-course-book"><Plus size={14} /> Kitab əlavə et</button>
        <button type="button" onClick={() => void save()} disabled={saving} className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50" data-testid="button-save-course-books">{saving && <Loader2 size={13} className="animate-spin" />} Kitabları yadda saxla</button>
      </div>
    </div>
  );
}
