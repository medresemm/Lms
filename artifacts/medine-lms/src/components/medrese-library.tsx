import { BookOpen, Library, Loader2, RotateCcw } from 'lucide-react';
import { Link } from 'wouter';
import { useUser } from '@clerk/react';
import { arabicBookFont, libraryPageUrl, libraryReaderHref, loadReadingPage, useLibraryCatalog, type LibraryBook } from '@/lib/library';

function BookCard({ book, token, userId }: { book: LibraryBook; token: string; userId: string | null }) {
  const lastPage = loadReadingPage(userId, book.slug);
  const continuePage = lastPage && lastPage > 1 && lastPage <= book.pageCount ? lastPage : null;
  return (
    <article className="group flex gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[var(--shadow-xs)] transition hover:shadow-[var(--shadow-md)] sm:p-5" data-testid={`library-book-${book.slug}`}>
      <Link href={libraryReaderHref(book.slug, continuePage ?? undefined)} className="focus-ring relative block w-24 shrink-0 self-start overflow-hidden rounded-r-lg rounded-l-sm shadow-[0_8px_18px_-8px_rgba(60,40,10,.55)] sm:w-28" aria-label={`${book.title} — oxu`}>
        <img src={libraryPageUrl(book.slug, 1, token)} alt="" className="aspect-[0.72] w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
        <span className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/30 to-transparent" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--accent))]">{book.subject}</p>
        <h4 dir="rtl" lang="ar" className="mt-1 text-right text-xl leading-9 text-[hsl(var(--primary))]" style={{ fontFamily: arabicBookFont }}>{book.title}</h4>
        <dl dir="rtl" lang="ar" className="mt-1 space-y-0.5 text-right text-[15px] leading-7 text-[hsl(var(--foreground)/.8)]" style={{ fontFamily: arabicBookFont }}>
          <div><dt className="sr-only">Müəllif</dt><dd>{book.author}</dd></div>
          {book.commentator && <div><dt className="sr-only">Şərh edən</dt><dd>شرح: {book.commentator}</dd></div>}
          <div className="text-[hsl(var(--muted-foreground))]"><dt className="sr-only">Nəşriyyat</dt><dd>{book.publisher} · {book.year}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{book.pageCount} səhifə · {book.chapters.length} bölmə</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          <Link href={libraryReaderHref(book.slug, continuePage ?? undefined)} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] transition hover:opacity-90" data-testid={`button-open-book-${book.slug}`}>
            <BookOpen size={14} /> {continuePage ? `Davam et · s. ${continuePage - book.pageOffset > 0 ? continuePage - book.pageOffset : continuePage}` : 'Oxu'}
          </Link>
          {continuePage && (
            <Link href={libraryReaderHref(book.slug, 1)} className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-3 py-2 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]">
              Əvvəldən
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function MedreseLibrary({ canManage = false }: { canManage?: boolean }) {
  const { user } = useUser();
  const { books, token, error, loading, reload } = useLibraryCatalog();
  return (
    <section className="@container rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] px-4 py-6 sm:px-6" data-testid="section-medrese-library">
      <header className="mb-5 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-[var(--shadow-xs)]"><Library size={20} /></span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{canManage ? 'Kitabxana idarəsi' : 'Kitabxana'}</p>
          <h3 className="font-serif text-2xl text-[hsl(var(--primary))]">Mədrəsə Kitabxanası</h3>
        </div>
      </header>
      {!books && loading && (
        <p className="flex items-center gap-2 py-8 text-sm text-[hsl(var(--muted-foreground))]"><Loader2 size={16} className="animate-spin" /> Kitablar yüklənir…</p>
      )}
      {!books && !loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          <button type="button" onClick={() => void reload()} className="ml-2 inline-flex items-center gap-1 font-semibold underline"><RotateCcw size={13} /> Yenidən</button>
        </div>
      )}
      {books && token && (
        books.length
          ? <div className="grid gap-4 @4xl:grid-cols-2">{books.map((book) => <BookCard key={book.slug} book={book} token={token} userId={user?.id ?? null} />)}</div>
          : <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Hələ kitab əlavə edilməyib.</p>
      )}
      {books && books.length > 0 && (
        <p className="mt-4 text-[11px] text-[hsl(var(--muted-foreground))]">Kitablar skan nüsxələrdir. Mədinə AI-də «Kitabxanada axtar: …» yazaraq kitabların mətnində axtarış edə bilərsiniz.</p>
      )}
    </section>
  );
}
