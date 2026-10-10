// Kitabxana idarəsi: yeni PDF kitab yükləmə və yüklənmiş kitabın məlumatlarını redaktə.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@clerk/react';
import { CheckCircle2, FileUp, ListPlus, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useI18n, type MessageKey } from '@/lib/i18n';
import { formatBytes, type LibraryBook, type LibraryUploadsInfo } from '@/lib/library';
import {
  chaptersToDrafts,
  createUploadedBook,
  draftsToChapters,
  parseChapterLines,
  putToSignedUrl,
  requestUploadSlot,
  updateUploadedBook,
  type ChapterDraft,
} from '@/lib/library-admin';

const ux = (t: (key: MessageKey) => string, key: string) => t(key as MessageKey);

type Props = {
  mode: 'create' | 'edit';
  book?: LibraryBook;
  uploads: LibraryUploadsInfo;
  onClose: () => void;
  onSaved: () => void;
};

type Picked = { file: File; data: ArrayBuffer; pageCount: number };
type Stage = { label: string; fraction: number | null } | null;

const fieldClass = 'rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.15)]';
const inputClass = `w-full ${fieldClass}`;
const labelClass = 'mb-1 block text-xs font-semibold text-[hsl(var(--foreground)/.8)]';

function titleFromFileName(name: string) {
  return name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim();
}

export function LibraryBookForm({ mode, book, uploads, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const { getToken } = useAuth();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [title, setTitle] = useState(book?.title ?? '');
  const [author, setAuthor] = useState(book?.author ?? '');
  const [commentator, setCommentator] = useState(book?.commentator ?? '');
  const [publisher, setPublisher] = useState(book?.publisher ?? '');
  const [year, setYear] = useState(book?.year ?? '');
  const [subject, setSubject] = useState(book?.subject ?? uploads.subjects[0] ?? 'Fiqh');
  const [pageOffset, setPageOffset] = useState(String(book?.pageOffset ?? 0));
  const [chapters, setChapters] = useState<ChapterDraft[]>(book ? chaptersToDrafts(book.chapters) : []);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [stage, setStage] = useState<Stage>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ hasText: boolean } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = stage !== null;
  const pageCount = book?.pageCount ?? picked?.pageCount ?? null;

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function pickFile(file: File | null) {
    setPickError(null);
    setPicked(null);
    if (!file) return;
    if (!(file.type === 'application/pdf' || (!file.type && /\.pdf$/i.test(file.name))) || !/\.pdf$/i.test(file.name)) {
      setPickError(ux(t, 'uxPdfOnly'));
      return;
    }
    if (file.size > uploads.maxPdfBytes) {
      setPickError(ux(t, 'uxFileTooBig').replace('{size}', formatBytes(file.size)).replace('{max}', formatBytes(uploads.maxPdfBytes)));
      return;
    }
    setOpening(true);
    try {
      const data = await file.arrayBuffer();
      const header = new TextDecoder('latin1').decode(new Uint8Array(data.slice(0, 1024)));
      if (!header.includes('%PDF-')) throw new Error(ux(t, 'uxNotPdf'));
      const { openPdf } = await import('@/lib/pdf');
      const doc = await openPdf({ data: data.slice(0) });
      const count = doc.numPages;
      await doc.destroy();
      if (count < 1 || count > uploads.maxPages) throw new Error(ux(t, 'uxPdfPageRange').replace('{max}', String(uploads.maxPages)).replace('{count}', String(count)));
      setPicked({ file, data, pageCount: count });
      if (!title) setTitle(titleFromFileName(file.name));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setPickError(/PDF|səhifə|صفحات/.test(message) ? message : ux(t, 'uxPdfCorrupt'));
    } finally {
      setOpening(false);
    }
  }

  function setChapter(index: number, patch: Partial<ChapterDraft>) {
    setChapters((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsedChapters = draftsToChapters(chapters, { missingTitle: ux(t, 'uxChapterMissingTitle'), missingPage: ux(t, 'uxChapterMissingPage') });
    if (!parsedChapters.ok) { setError(parsedChapters.error); return; }
    const offset = Number(pageOffset || 0);
    if (!Number.isSafeInteger(offset)) { setError(ux(t, 'uxOffsetInteger')); return; }
    if (title.trim().length < 2) { setError(ux(t, 'uxEnterBookTitle')); return; }
    if (author.trim().length < 2) { setError(ux(t, 'uxEnterAuthor')); return; }
    if (pageCount) {
      const outside = parsedChapters.chapters.find((chapter) => chapter.printedPage + offset < 1 || chapter.printedPage + offset > pageCount);
      if (outside) { setError(ux(t, 'uxChapterOutOfRange').replace('{title}', outside.title).replace('{max}', String(pageCount))); return; }
    }
    const fields = { title: title.trim(), author: author.trim(), commentator: commentator.trim(), publisher: publisher.trim(), year: year.trim(), subject, pageOffset: offset, chapters: parsedChapters.chapters };
    if (mode === 'edit' && book) {
      setStage({ label: ux(t, 'uxSavingEllipsis'), fraction: null });
      try {
        await updateUploadedBook(getToken, book.slug, fields, ux(t, 'uxActionFailed'));
        onSaved();
        onClose();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : ux(t, 'uxNotSaved'));
      } finally {
        setStage(null);
      }
      return;
    }
    if (!picked) { setError(ux(t, 'uxPickPdf')); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    const storageLabels = { storageStatus: ux(t, 'uxStorageFailStatus'), storageNetwork: ux(t, 'uxStorageFailNetwork') };
    const pdfLabels = { canvas: ux(t, 'uxCanvasUnsupported'), image: ux(t, 'uxImageFailed') };
    try {
      setStage({ label: ux(t, 'uxUploadPrep'), fraction: null });
      const slot = await requestUploadSlot(getToken, picked.file, ux(t, 'uxActionFailed'));
      const { extractPdfText, openPdf, renderPdfPage, textLayerLooksUseful } = await import('@/lib/pdf');
      const doc = await openPdf({ data: picked.data.slice(0) });
      setStage({ label: ux(t, 'uxReadingText'), fraction: 0 });
      const pages = await extractPdfText(doc, (doneCount, total) => setStage({ label: ux(t, 'uxReadingTextProgress').replace('{done}', String(doneCount)).replace('{total}', String(total)), fraction: doneCount / total }), controller.signal);
      const useful = textLayerLooksUseful(pages);
      setStage({ label: ux(t, 'uxCoverPrep'), fraction: null });
      const cover = await renderPdfPage(doc, 1, 640, 0.8, pdfLabels).catch(() => null);
      await doc.destroy();
      setStage({ label: ux(t, 'uxPdfUploading'), fraction: 0 });
      await putToSignedUrl(slot.pdfUploadURL, picked.file, 'application/pdf', (fraction) => setStage({ label: ux(t, 'uxPdfUploadingPct').replace('{n}', String(Math.round(fraction * 100))), fraction }), controller.signal, storageLabels);
      if (useful) {
        setStage({ label: ux(t, 'uxTextUploading'), fraction: null });
        await putToSignedUrl(slot.textUploadURL, new Blob([JSON.stringify({ pages })], { type: 'application/json' }), 'application/json', undefined, controller.signal, storageLabels);
      }
      if (cover) await putToSignedUrl(slot.coverUploadURL, cover.blob, 'image/jpeg', undefined, controller.signal, storageLabels).catch(() => undefined);
      setStage({ label: ux(t, 'uxCatalogCheck'), fraction: null });
      const created = await createUploadedBook(getToken, { ...fields, storageId: slot.storageId, ticket: slot.ticket, pageCount: picked.pageCount, fileName: picked.file.name }, ux(t, 'uxActionFailed'));
      setDone({ hasText: created.hasText });
      onSaved();
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') setError(ux(t, 'uxUploadCancelled'));
      else setError(caught instanceof Error ? caught.message : ux(t, 'uxBookUploadFail'));
    } finally {
      abortRef.current = null;
      setStage(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={mode === 'create' ? ux(t, 'uxAddBookAria') : ux(t, 'uxEditBookAria')} data-testid="library-book-form">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={() => { if (!busy) onClose(); }} aria-label={t('close')} />
      <div className="relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-[hsl(var(--card))] shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{t('libraryManage')}</p>
            <h4 className="font-serif text-xl text-[hsl(var(--primary))]">{mode === 'create' ? ux(t, 'uxNewBookPdf') : ux(t, 'uxBookDetails')}</h4>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="focus-ring rounded-full p-2 hover:bg-[hsl(var(--muted))] disabled:opacity-40" aria-label={t('close')}><X size={18} /></button>
        </div>

        {done ? (
          <div className="space-y-3 px-5 py-8 text-center">
            <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
            <p className="text-base font-semibold">{ux(t, 'uxBookAdded')}</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {done.hasText ? ux(t, 'uxBookHasText') : ux(t, 'uxBookScanNoSearch')}
            </p>
            <button type="button" onClick={onClose} className="focus-ring rounded-full bg-[hsl(var(--primary))] px-5 py-2 text-sm font-bold text-[hsl(var(--primary-foreground))]">{t('close')}</button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {mode === 'create' && (
                <div>
                  <label className={labelClass} htmlFor="library-pdf-file">{ux(t, 'uxPdfFile')}</label>
                  <label htmlFor="library-pdf-file" className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-[hsl(var(--border))] px-4 py-4 text-sm hover:border-[hsl(var(--primary)/.5)]">
                    {opening ? <Loader2 size={20} className="animate-spin" /> : <FileUp size={20} className="text-[hsl(var(--primary))]" />}
                    <span className="min-w-0 flex-1">
                      {picked
                        ? <><span className="block truncate font-semibold">{picked.file.name}</span><span className="text-xs text-[hsl(var(--muted-foreground))]">{formatBytes(picked.file.size)} · {ux(t, 'uxPageCount').replace('{n}', String(picked.pageCount))}</span></>
                        : <><span className="block font-semibold">{ux(t, 'uxChoosePdf')}</span><span className="text-xs text-[hsl(var(--muted-foreground))]">{ux(t, 'uxPdfLimits').replace('{size}', formatBytes(uploads.maxPdfBytes)).replace('{pages}', String(uploads.maxPages))}</span></>}
                    </span>
                  </label>
                  <input id="library-pdf-file" type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy} onChange={(event) => void pickFile(event.target.files?.[0] ?? null)} data-testid="input-library-pdf" />
                  {pickError && <p className="mt-1.5 text-xs text-red-700">{pickError}</p>}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="library-title">{ux(t, 'uxBookTitle')}</label>
                  <input id="library-title" dir="auto" className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} required data-testid="input-library-title" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="library-author">{ux(t, 'uxAuthorReq')}</label>
                  <input id="library-author" dir="auto" className={inputClass} value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={200} required />
                </div>
                <div>
                  <label className={labelClass} htmlFor="library-commentator">{ux(t, 'uxCommentatorOpt')}</label>
                  <input id="library-commentator" dir="auto" className={inputClass} value={commentator} onChange={(event) => setCommentator(event.target.value)} maxLength={200} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="library-publisher">{ux(t, 'uxPublisher')}</label>
                  <input id="library-publisher" dir="auto" className={inputClass} value={publisher} onChange={(event) => setPublisher(event.target.value)} maxLength={200} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="library-year">{ux(t, 'uxYear')}</label>
                    <input id="library-year" dir="auto" className={inputClass} value={year} onChange={(event) => setYear(event.target.value)} maxLength={40} placeholder="1431هـ / 2010" />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="library-subject">{ux(t, 'uxSection')}</label>
                    <select id="library-subject" className={inputClass} value={subject} onChange={(event) => setSubject(event.target.value)}>
                      {uploads.subjects.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <fieldset className="rounded-xl border border-[hsl(var(--border))] p-3">
                <legend className="px-1 text-xs font-bold text-[hsl(var(--foreground)/.8)]">{ux(t, 'uxContentsOptional')}</legend>
                <div className="mb-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label className={labelClass} htmlFor="library-offset">{ux(t, 'uxPageOffset')}</label>
                    <input id="library-offset" inputMode="numeric" className={`${fieldClass} w-24`} value={pageOffset} onChange={(event) => setPageOffset(event.target.value.replace(/[^\d-]/g, '').slice(0, 4))} />
                  </div>
                  <p className="min-w-0 flex-1 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">{ux(t, 'uxPageOffsetHelp')}{pageCount ? ux(t, 'uxThisPdfPages').replace('{n}', String(pageCount)) : ''}</p>
                </div>
                {chapters.length > 0 && (
                  <ol className="space-y-2">
                    {chapters.map((row, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <input dir="auto" aria-label={ux(t, 'uxChapterTitle')} placeholder={ux(t, 'uxChapterTitle')} className={`${fieldClass} min-w-0 flex-1`} value={row.title} onChange={(event) => setChapter(index, { title: event.target.value })} maxLength={200} />
                        <input inputMode="numeric" aria-label={ux(t, 'uxPrintedPage')} placeholder={ux(t, 'uxPageAbbrev')} className={`${fieldClass} w-16 shrink-0 text-center`} value={row.printedPage} onChange={(event) => setChapter(index, { printedPage: event.target.value.replace(/[^\d-]/g, '').slice(0, 5) })} />
                        <label className="flex shrink-0 items-center gap-1 text-[11px] text-[hsl(var(--muted-foreground))]" title={ux(t, 'uxSubchapter')}>
                          <input type="checkbox" checked={row.level === 2} onChange={(event) => setChapter(index, { level: event.target.checked ? 2 : 1 })} /> {ux(t, 'uxSub')}
                        </label>
                        <button type="button" onClick={() => setChapters((rows) => rows.filter((_, i) => i !== index))} className="focus-ring shrink-0 rounded-full p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-red-50 hover:text-red-700" aria-label={ux(t, 'uxDeleteChapter')}><Trash2 size={14} /></button>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setChapters((rows) => [...rows, { title: '', printedPage: '', level: 1 }])} className="focus-ring inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold hover:bg-[hsl(var(--muted))]"><Plus size={13} /> {ux(t, 'uxAddChapter')}</button>
                  <button type="button" onClick={() => setPasteOpen((open) => !open)} className="focus-ring inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold hover:bg-[hsl(var(--muted))]"><ListPlus size={13} /> {ux(t, 'uxPasteList')}</button>
                </div>
                {pasteOpen && (
                  <div className="mt-2 space-y-2">
                    <textarea dir="auto" rows={5} className={inputClass} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={ux(t, 'uxPastePh')} />
                    <button type="button" onClick={() => { setChapters((rows) => [...rows.filter((row) => row.title.trim() || row.printedPage.trim()), ...parseChapterLines(pasteText)]); setPasteText(''); setPasteOpen(false); }} className="focus-ring rounded-full bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary-foreground))]">{t('add')}</button>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{ux(t, 'uxDashSubchapter')}</p>
                  </div>
                )}
              </fieldset>
              {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
            </div>
            <div className="border-t border-[hsl(var(--border))] px-5 py-3">
              {stage && (
                <div className="mb-2" aria-live="polite">
                  <p className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><Loader2 size={13} className="animate-spin" /> {stage.label}</p>
                  {stage.fraction !== null && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full bg-[hsl(var(--primary))] transition-[width]" style={{ width: `${Math.round(stage.fraction * 100)}%` }} /></div>}
                </div>
              )}
              <div className="flex justify-end gap-2">
                {busy && mode === 'create'
                  ? <button type="button" onClick={() => abortRef.current?.abort()} className="focus-ring rounded-full border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold">{t('cancel')}</button>
                  : <button type="button" onClick={onClose} className="focus-ring rounded-full border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold">{t('close')}</button>}
                <button type="submit" disabled={busy || opening || (mode === 'create' && !picked)} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-2 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" data-testid="button-library-save">
                  {busy && <Loader2 size={14} className="animate-spin" />} {mode === 'create' ? ux(t, 'uxUploadAndAdd') : t('save')}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
