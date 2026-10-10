import { useState } from 'react';
import { BookOpen, Download, FileText, Library, Loader2, Pencil, Plus, RotateCcw, SearchX, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import { useAuth, useUser } from '@clerk/react';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { LibraryBookForm } from '@/components/library-book-form';
import {
  arabicBookFont,
  formatBytes,
  isUploadedBook,
  libraryCoverUrl,
  libraryFileUrl,
  libraryReaderHref,
  loadReadingPage,
  useLibraryCatalog,
  type LibraryBook,
  type LibraryUploadsInfo,
} from '@/lib/library';
import { deleteUploadedBook } from '@/lib/library-admin';

const ux = (t: (key: MessageKey) => string, key: string) => t(key as MessageKey);

/** PDF endirmə: server qısa ömürlü imzalı ünvana yönləndirir (Content-Disposition: attachment). */
export function PdfDownloadLink({ book, token, tone = 'card' }: { book: LibraryBook; token: string; tone?: 'card' | 'reader' }) {
  const { t } = useI18n();
  if (book.hasPdf === false) return null;
  const className = tone === 'reader'
    ? 'focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/10'
    : 'focus-ring inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-3 py-2 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]';
  return (
    <a href={libraryFileUrl(book.slug, token, 'download')} className={className} rel="noopener" data-testid={`button-pdf-download-${book.slug}`} aria-label={ux(t, 'uxPdfDownloadAria').replace('{title}', book.shortTitle)}>
      <Download size={tone === 'reader' ? 15 : 14} /> <span className={tone === 'reader' ? 'hidden sm:inline' : undefined}>{ux(t, 'uxPdfDownload')}</span>
      {tone === 'card' && book.fileSize ? <span className="font-normal text-[hsl(var(--muted-foreground))]">· {formatBytes(book.fileSize)}</span> : null}
    </a>
  );
}

function CoverPlaceholder({ book }: { book: LibraryBook }) {
  return (
    <div className="flex aspect-[0.72] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#6b4a2b] to-[#3a2716] p-2 text-center text-[#f3e7cf]">
      <FileText size={22} className="opacity-70" />
      <span dir="auto" className="line-clamp-4 text-[11px] leading-4" style={{ fontFamily: arabicBookFont }}>{book.shortTitle}</span>
    </div>
  );
}

function BookCard({ book, token, userId, manage, onEdit, onDeleted }: {
  book: LibraryBook;
  token: string;
  userId: string | null;
  manage: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const { getToken } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const lastPage = loadReadingPage(userId, book.slug);
  const continuePage = lastPage && lastPage > 1 && lastPage <= book.pageCount ? lastPage : null;
  const uploaded = isUploadedBook(book);
  const cover = libraryCoverUrl(book, token);

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteUploadedBook(getToken, book.slug, ux(t, 'uxActionFailed'));
      onDeleted();
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : t('notDeleted'));
      setDeleting(false);
    }
  }

  return (
    <article className="group flex gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[var(--shadow-xs)] transition hover:shadow-[var(--shadow-md)] sm:p-5" data-testid={`library-book-${book.slug}`}>
      <Link href={libraryReaderHref(book.slug, continuePage ?? undefined)} className="focus-ring relative block w-24 shrink-0 self-start overflow-hidden rounded-r-lg rounded-l-sm shadow-[0_8px_18px_-8px_rgba(60,40,10,.55)] sm:w-28" aria-label={book.title}>
        {cover && !coverFailed
          ? <img src={cover} alt="" className="aspect-[0.72] w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" onError={() => setCoverFailed(true)} />
          : <CoverPlaceholder book={book} />}
        <span className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/30 to-transparent" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--accent))]">
          {book.subject}
          {uploaded && book.hasText === false && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[9px] tracking-normal normal-case text-[hsl(var(--muted-foreground))]" title={t('noSearch')}><SearchX size={10} /> {t('noSearch')}</span>
          )}
        </p>
        <h4 dir="auto" lang="ar" className="mt-1 text-start text-xl leading-9 text-[hsl(var(--primary))]" style={{ fontFamily: arabicBookFont }}>{book.title}</h4>
        <dl dir="auto" lang="ar" className="mt-1 space-y-0.5 text-start text-[15px] leading-7 text-[hsl(var(--foreground)/.8)]" style={{ fontFamily: arabicBookFont }}>
          <div><dt className="sr-only">{t('artAuthor')}</dt><dd>{book.author}</dd></div>
          {book.commentator && <div><dt className="sr-only">{ux(t, 'uxCommentator')}</dt><dd>شرح: {book.commentator}</dd></div>}
          {(book.publisher || book.year) && <div className="text-[hsl(var(--muted-foreground))]"><dt className="sr-only">{ux(t, 'uxPublisher')}</dt><dd>{[book.publisher, book.year].filter(Boolean).join(' · ')}</dd></div>}
        </dl>
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{book.pageCount} {t('pageWord')} · {book.chapters.length} {t('chapterWord')}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          <Link href={libraryReaderHref(book.slug, continuePage ?? undefined)} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] transition hover:opacity-90" data-testid={`button-open-book-${book.slug}`}>
            <BookOpen size={14} /> {continuePage ? `${t('continueAt')} · ${continuePage - book.pageOffset > 0 ? continuePage - book.pageOffset : continuePage}` : t('readBook')}
          </Link>
          {continuePage && (
            <Link href={libraryReaderHref(book.slug, 1)} className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-3 py-2 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]">
              {t('fromStart')}
            </Link>
          )}
          <PdfDownloadLink book={book} token={token} />
          {manage && uploaded && !confirming && (
            <>
              <button type="button" onClick={onEdit} className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-3 py-2 text-xs font-semibold hover:bg-[hsl(var(--muted))]" data-testid={`button-edit-book-${book.slug}`}><Pencil size={13} /> {t('edit')}</button>
              <button type="button" onClick={() => setConfirming(true)} className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50" data-testid={`button-delete-book-${book.slug}`}><Trash2 size={13} /> {t('delete')}</button>
            </>
          )}
        </div>
        {confirming && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900" role="alertdialog" aria-label={t('delete')}>
            <p className="font-semibold">{t('deleteBookAsk')}</p>
            {deleteError && <p className="mt-1">{deleteError}</p>}
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={deleting} onClick={() => void remove()} className="focus-ring inline-flex items-center gap-1 rounded-full bg-red-700 px-3 py-1.5 font-bold text-white disabled:opacity-60" data-testid={`button-confirm-delete-${book.slug}`}>{deleting && <Loader2 size={12} className="animate-spin" />} {t('yesDelete')}</button>
              <button type="button" disabled={deleting} onClick={() => { setConfirming(false); setDeleteError(null); }} className="focus-ring rounded-full border border-red-200 bg-white px-3 py-1.5 font-semibold">{t('noWord')}</button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function UploadsNotice({ uploads }: { uploads: LibraryUploadsInfo }) {
  const { t } = useI18n();
  if (uploads.available) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900" data-testid="library-uploads-unavailable">
      {uploads.message}
      {uploads.detail && <span className="mt-1 block opacity-80" data-testid="library-uploads-unavailable-detail">{ux(t, 'uxCheckDetail').replace('{detail}', uploads.detail)}</span>}
    </div>
  );
}

export function MedreseLibrary({ canManage = false }: { canManage?: boolean }) {
  const { t } = useI18n();
  const { user } = useUser();
  const { books, token, error, loading, reload, canManage: serverCanManage, uploads } = useLibraryCatalog(true, ux(t, 'uxLibraryLoadFail'));
  const manage = canManage && serverCanManage && uploads !== null;
  const [form, setForm] = useState<{ mode: 'create' } | { mode: 'edit'; book: LibraryBook } | null>(null);
  return (
    <section className="@container rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] px-4 py-6 sm:px-6" data-testid="section-medrese-library">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-[var(--shadow-xs)]"><Library size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{canManage ? t('libraryManage') : t('library')}</p>
          <h3 className="font-serif text-2xl text-[hsl(var(--primary))]">{t('libraryTitle')}</h3>
        </div>
        {manage && (
          <button
            type="button"
            onClick={() => setForm({ mode: 'create' })}
            disabled={!uploads?.available}
            title={uploads && !uploads.available ? uploads.message : undefined}
            className="focus-ring inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            data-testid="button-library-add-book"
          >
            <Plus size={14} /> {t('addBook')}
          </button>
        )}
      </header>
      {manage && uploads && <UploadsNotice uploads={uploads} />}
      {!books && loading && (
        <p className="flex items-center gap-2 py-8 text-sm text-[hsl(var(--muted-foreground))]"><Loader2 size={16} className="animate-spin" /> {t('booksLoading')}</p>
      )}
      {!books && !loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          <button type="button" onClick={() => void reload()} className="ms-2 inline-flex items-center gap-1 font-semibold underline"><RotateCcw size={13} /> {t('retry')}</button>
        </div>
      )}
      {books && token && (
        books.length
          ? (
            <div className="grid gap-4 @4xl:grid-cols-2">
              {books.map((book) => (
                <BookCard
                  key={`${book.slug}:${book.version ?? ''}`}
                  book={book}
                  token={token}
                  userId={user?.id ?? null}
                  manage={manage}
                  onEdit={() => setForm({ mode: 'edit', book })}
                  onDeleted={() => void reload()}
                />
              ))}
            </div>
          )
          : <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('noBooks')}</p>
      )}
      {books && books.length > 0 && (
        <p className="mt-4 text-[11px] text-[hsl(var(--muted-foreground))]">{t('librarySearchHint')}</p>
      )}
      {form && uploads && (
        <LibraryBookForm
          mode={form.mode}
          book={form.mode === 'edit' ? form.book : undefined}
          uploads={uploads}
          onClose={() => setForm(null)}
          onSaved={() => void reload()}
        />
      )}
    </section>
  );
}
