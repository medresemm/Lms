// Kitabxana idarəsi: yeni PDF kitab yükləmə və yüklənmiş kitabın məlumatlarını redaktə.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@clerk/react';
import { CheckCircle2, FileUp, ListPlus, Loader2, Plus, Trash2, X } from 'lucide-react';
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
      setPickError('Yalnız PDF faylı seçin.');
      return;
    }
    if (file.size > uploads.maxPdfBytes) {
      setPickError(`Fayl çox böyükdür (${formatBytes(file.size)}). Ən çox ${formatBytes(uploads.maxPdfBytes)} ola bilər.`);
      return;
    }
    setOpening(true);
    try {
      const data = await file.arrayBuffer();
      const header = new TextDecoder('latin1').decode(new Uint8Array(data.slice(0, 1024)));
      if (!header.includes('%PDF-')) throw new Error('Bu fayl PDF deyil.');
      const { openPdf } = await import('@/lib/pdf');
      const doc = await openPdf({ data: data.slice(0) });
      const count = doc.numPages;
      await doc.destroy();
      if (count < 1 || count > uploads.maxPages) throw new Error(`PDF-in səhifə sayı 1–${uploads.maxPages} olmalıdır (bu faylda ${count}).`);
      setPicked({ file, data, pageCount: count });
      if (!title) setTitle(titleFromFileName(file.name));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setPickError(/PDF|səhifə/.test(message) ? message : 'PDF açılmadı: fayl zədələnmiş və ya şifrəlidir.');
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
    const parsedChapters = draftsToChapters(chapters);
    if (!parsedChapters.ok) { setError(parsedChapters.error); return; }
    const offset = Number(pageOffset || 0);
    if (!Number.isSafeInteger(offset)) { setError('Səhifə sürüşməsi tam ədəd olmalıdır.'); return; }
    if (title.trim().length < 2) { setError('Kitabın adını yazın.'); return; }
    if (author.trim().length < 2) { setError('Müəllifin adını yazın.'); return; }
    if (pageCount) {
      const outside = parsedChapters.chapters.find((chapter) => chapter.printedPage + offset < 1 || chapter.printedPage + offset > pageCount);
      if (outside) { setError(`«${outside.title}» fəslinin səhifəsi kitabdan kənardadır (PDF: 1–${pageCount}).`); return; }
    }
    const fields = { title: title.trim(), author: author.trim(), commentator: commentator.trim(), publisher: publisher.trim(), year: year.trim(), subject, pageOffset: offset, chapters: parsedChapters.chapters };
    if (mode === 'edit' && book) {
      setStage({ label: 'Yadda saxlanılır…', fraction: null });
      try {
        await updateUploadedBook(getToken, book.slug, fields);
        onSaved();
        onClose();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Yadda saxlanmadı.');
      } finally {
        setStage(null);
      }
      return;
    }
    if (!picked) { setError('PDF faylını seçin.'); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setStage({ label: 'Yükləmə hazırlanır…', fraction: null });
      const slot = await requestUploadSlot(getToken, picked.file);
      const { extractPdfText, openPdf, renderPdfPage, textLayerLooksUseful } = await import('@/lib/pdf');
      const doc = await openPdf({ data: picked.data.slice(0) });
      setStage({ label: 'Mətn qatı oxunur (axtarış üçün)…', fraction: 0 });
      const pages = await extractPdfText(doc, (doneCount, total) => setStage({ label: `Mətn qatı oxunur (axtarış üçün)… ${doneCount}/${total}`, fraction: doneCount / total }), controller.signal);
      const useful = textLayerLooksUseful(pages);
      setStage({ label: 'Üz qabığı hazırlanır…', fraction: null });
      const cover = await renderPdfPage(doc, 1, 640, 0.8).catch(() => null);
      await doc.destroy();
      setStage({ label: 'PDF yüklənir…', fraction: 0 });
      await putToSignedUrl(slot.pdfUploadURL, picked.file, 'application/pdf', (fraction) => setStage({ label: `PDF yüklənir… ${Math.round(fraction * 100)}%`, fraction }), controller.signal);
      if (useful) {
        setStage({ label: 'Mətn qatı yüklənir…', fraction: null });
        await putToSignedUrl(slot.textUploadURL, new Blob([JSON.stringify({ pages })], { type: 'application/json' }), 'application/json', undefined, controller.signal);
      }
      if (cover) await putToSignedUrl(slot.coverUploadURL, cover.blob, 'image/jpeg', undefined, controller.signal).catch(() => undefined);
      setStage({ label: 'Yoxlanılır və kataloqa əlavə edilir…', fraction: null });
      const created = await createUploadedBook(getToken, { ...fields, storageId: slot.storageId, ticket: slot.ticket, pageCount: picked.pageCount, fileName: picked.file.name });
      setDone({ hasText: created.hasText });
      onSaved();
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') setError('Yükləmə ləğv edildi.');
      else setError(caught instanceof Error ? caught.message : 'Kitab yüklənmədi.');
    } finally {
      abortRef.current = null;
      setStage(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={mode === 'create' ? 'Kitab əlavə et' : 'Kitabı redaktə et'} data-testid="library-book-form">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={() => { if (!busy) onClose(); }} aria-label="Bağla" />
      <div className="relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-[hsl(var(--card))] shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Kitabxana idarəsi</p>
            <h4 className="font-serif text-xl text-[hsl(var(--primary))]">{mode === 'create' ? 'Yeni kitab (PDF)' : 'Kitabın məlumatları'}</h4>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="focus-ring rounded-full p-2 hover:bg-[hsl(var(--muted))] disabled:opacity-40" aria-label="Bağla"><X size={18} /></button>
        </div>

        {done ? (
          <div className="space-y-3 px-5 py-8 text-center">
            <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
            <p className="text-base font-semibold">Kitab kitabxanaya əlavə edildi.</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {done.hasText
                ? 'PDF-in mətn qatı var: kitab Mədinə AI-də və oxuyucudakı axtarışda axtarılacaq.'
                : 'Bu PDF skandır (mətn qatı yoxdur): kitabı oxumaq və endirmək olar, amma bu kitabda axtarış mümkün deyil.'}
            </p>
            <button type="button" onClick={onClose} className="focus-ring rounded-full bg-[hsl(var(--primary))] px-5 py-2 text-sm font-bold text-[hsl(var(--primary-foreground))]">Bağla</button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {mode === 'create' && (
                <div>
                  <label className={labelClass} htmlFor="library-pdf-file">PDF faylı *</label>
                  <label htmlFor="library-pdf-file" className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-[hsl(var(--border))] px-4 py-4 text-sm hover:border-[hsl(var(--primary)/.5)]">
                    {opening ? <Loader2 size={20} className="animate-spin" /> : <FileUp size={20} className="text-[hsl(var(--primary))]" />}
                    <span className="min-w-0 flex-1">
                      {picked
                        ? <><span className="block truncate font-semibold">{picked.file.name}</span><span className="text-xs text-[hsl(var(--muted-foreground))]">{formatBytes(picked.file.size)} · {picked.pageCount} səhifə</span></>
                        : <><span className="block font-semibold">PDF seçin</span><span className="text-xs text-[hsl(var(--muted-foreground))]">Ən çox {formatBytes(uploads.maxPdfBytes)}, {uploads.maxPages} səhifə</span></>}
                    </span>
                  </label>
                  <input id="library-pdf-file" type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy} onChange={(event) => void pickFile(event.target.files?.[0] ?? null)} data-testid="input-library-pdf" />
                  {pickError && <p className="mt-1.5 text-xs text-red-700">{pickError}</p>}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="library-title">Kitabın adı *</label>
                  <input id="library-title" dir="auto" className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} required data-testid="input-library-title" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="library-author">Müəllif *</label>
                  <input id="library-author" dir="auto" className={inputClass} value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={200} required />
                </div>
                <div>
                  <label className={labelClass} htmlFor="library-commentator">Şarih (istəyə bağlı)</label>
                  <input id="library-commentator" dir="auto" className={inputClass} value={commentator} onChange={(event) => setCommentator(event.target.value)} maxLength={200} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="library-publisher">Nəşriyyat</label>
                  <input id="library-publisher" dir="auto" className={inputClass} value={publisher} onChange={(event) => setPublisher(event.target.value)} maxLength={200} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="library-year">İl</label>
                    <input id="library-year" dir="auto" className={inputClass} value={year} onChange={(event) => setYear(event.target.value)} maxLength={40} placeholder="1431هـ / 2010" />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="library-subject">Bölmə</label>
                    <select id="library-subject" className={inputClass} value={subject} onChange={(event) => setSubject(event.target.value)}>
                      {uploads.subjects.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <fieldset className="rounded-xl border border-[hsl(var(--border))] p-3">
                <legend className="px-1 text-xs font-bold text-[hsl(var(--foreground)/.8)]">Mündəricat (istəyə bağlı)</legend>
                <div className="mb-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label className={labelClass} htmlFor="library-offset">Səhifə sürüşməsi</label>
                    <input id="library-offset" inputMode="numeric" className={`${fieldClass} w-24`} value={pageOffset} onChange={(event) => setPageOffset(event.target.value.replace(/[^\d-]/g, '').slice(0, 4))} />
                  </div>
                  <p className="min-w-0 flex-1 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">PDF səhifəsi = kitabdakı (çap) səhifə + sürüşmə. Məs. çap s. 1 PDF-in 5-ci səhifəsidirsə, sürüşmə 4-dür.{pageCount ? ` Bu PDF: ${pageCount} səhifə.` : ''}</p>
                </div>
                {chapters.length > 0 && (
                  <ol className="space-y-2">
                    {chapters.map((row, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <input dir="auto" aria-label="Fəslin başlığı" placeholder="Fəslin başlığı" className={`${fieldClass} min-w-0 flex-1`} value={row.title} onChange={(event) => setChapter(index, { title: event.target.value })} maxLength={200} />
                        <input inputMode="numeric" aria-label="Çap səhifəsi" placeholder="s." className={`${fieldClass} w-16 shrink-0 text-center`} value={row.printedPage} onChange={(event) => setChapter(index, { printedPage: event.target.value.replace(/[^\d-]/g, '').slice(0, 5) })} />
                        <label className="flex shrink-0 items-center gap-1 text-[11px] text-[hsl(var(--muted-foreground))]" title="Alt bölmə">
                          <input type="checkbox" checked={row.level === 2} onChange={(event) => setChapter(index, { level: event.target.checked ? 2 : 1 })} /> alt
                        </label>
                        <button type="button" onClick={() => setChapters((rows) => rows.filter((_, i) => i !== index))} className="focus-ring shrink-0 rounded-full p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-red-50 hover:text-red-700" aria-label="Fəsli sil"><Trash2 size={14} /></button>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setChapters((rows) => [...rows, { title: '', printedPage: '', level: 1 }])} className="focus-ring inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold hover:bg-[hsl(var(--muted))]"><Plus size={13} /> Fəsil əlavə et</button>
                  <button type="button" onClick={() => setPasteOpen((open) => !open)} className="focus-ring inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold hover:bg-[hsl(var(--muted))]"><ListPlus size={13} /> Siyahını yapışdır</button>
                </div>
                {pasteOpen && (
                  <div className="mt-2 space-y-2">
                    <textarea dir="auto" rows={5} className={inputClass} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={'Hər sətirdə: başlıq və səhifə, məs.\nكتاب الطهارة 27\n- باب المياه 29'} />
                    <button type="button" onClick={() => { setChapters((rows) => [...rows.filter((row) => row.title.trim() || row.printedPage.trim()), ...parseChapterLines(pasteText)]); setPasteText(''); setPasteOpen(false); }} className="focus-ring rounded-full bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary-foreground))]">Əlavə et</button>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">«-» ilə başlayan sətir alt bölmə sayılır.</p>
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
                  ? <button type="button" onClick={() => abortRef.current?.abort()} className="focus-ring rounded-full border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold">Ləğv et</button>
                  : <button type="button" onClick={onClose} className="focus-ring rounded-full border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold">Bağla</button>}
                <button type="submit" disabled={busy || opening || (mode === 'create' && !picked)} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-2 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" data-testid="button-library-save">
                  {busy && <Loader2 size={14} className="animate-spin" />} {mode === 'create' ? 'Yüklə və əlavə et' : 'Yadda saxla'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
