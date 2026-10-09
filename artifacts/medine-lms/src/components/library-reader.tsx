import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ListTree, Loader2, RotateCcw, Search, X } from 'lucide-react';
import { Link, useSearch } from 'wouter';
import { useAuth, useUser } from '@clerk/react';
import { DidYouMean, LibraryHitList } from '@/components/library-search-results';
import {
  arabicBookFont,
  chapterForPage,
  libraryPageUrl,
  loadReadingPage,
  saveReadingPage,
  searchLibraryApi,
  useLibraryCatalog,
  type LibraryBook,
  type LibrarySearchResponse,
} from '@/lib/library';

/** Açıq kitab daxilində axtarış paneli (nəticəyə klik → həmin səhifə). */
function ReaderSearchPanel({ book, onClose, onOpenPage }: { book: LibraryBook; onClose: () => void; onOpenPage: (page: number) => void }) {
  const { getToken } = useAuth();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<LibrarySearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function run(offset: number) {
    const text = query.trim();
    if (text.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchLibraryApi(getToken, { query: text, offset, book: book.slug });
      setResult((current) => (offset && current ? { ...data, items: [...current.items, ...data.items] } : data));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Axtarış alınmadı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Kitabda axtarış">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Bağla" />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-[#f7eedb] text-[#3a2a17] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#3a2a17]/15 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#3a2a17]/60">Kitabda axtarış</p>
            <p className="text-sm font-semibold">{book.shortTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="focus-ring rounded-full p-2 hover:bg-black/5" aria-label="Bağla"><X size={18} /></button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void run(0); }} className="flex gap-2 border-b border-[#3a2a17]/10 px-4 py-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value.slice(0, 200))}
            dir="auto"
            placeholder="Ərəbcə söz və ya mövzu (məs. الوضوء, fail)"
            className="min-w-0 flex-1 rounded-lg border border-[#3a2a17]/20 bg-white/70 px-3 py-2 text-sm outline-none focus:border-[#b98d3e]"
            data-testid="input-reader-search"
          />
          <button type="submit" disabled={loading || query.trim().length < 2} className="inline-flex items-center gap-1.5 rounded-lg bg-[#3a2a17] px-3 py-2 text-xs font-bold text-[#f7eedb] disabled:opacity-40" data-testid="button-reader-search">
            {loading && !result ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Axtar
          </button>
        </form>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {error && <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p>}
          {result && (
            <>
              <p className="text-xs text-[#3a2a17]/70">
                {result.total ? `${result.total} nəticə` : 'Nəticə tapılmadı.'}
                {result.expanded.length > 0 && <> · axtarılan: <span dir="rtl" lang="ar" style={{ fontFamily: arabicBookFont }}>{result.expanded.join('، ')}</span></>}
              </p>
              <LibraryHitList items={result.items} tone="paper" groupHeadings={false} onOpen={(item) => onOpenPage(item.page)} />
              <DidYouMean suggestions={result.didYouMean} tone="paper" onOpen={(item) => onOpenPage(item.page)} />
              {result.items.length < result.total && (
                <button type="button" onClick={() => void run(result.items.length)} disabled={loading} className="w-full rounded-lg border border-[#3a2a17]/20 py-2 text-xs font-semibold hover:bg-black/5 disabled:opacity-50" data-testid="button-reader-search-more">
                  {loading ? 'Yüklənir…' : `Daha çox (${result.items.length}/${result.total})`}
                </button>
              )}
            </>
          )}
          {!result && !error && <p className="text-xs leading-5 text-[#3a2a17]/60">Ərəbcə söz/ifadə yazın (hərəkəsiz də olar) və ya mövzunu Azərbaycan/Türk dilində yazın: «dəstəmaz», «fail», «kana və bacıları».</p>}
          <p className="text-[11px] text-[#3a2a17]/55">Axtarış skan mətninə (OCR) əsaslanır — kiçik xətalar ola bilər.</p>
        </div>
      </aside>
    </div>
  );
}

// Kitab sağdan sola oxunur: növbəti səhifə solda açılır.
// Telefonda tək səhifə, planşet/kompüterdə iki səhifəlik açılış: [1], [2|3], [4|5] …
// (cüt səhifə sağda, tək səhifə solda — ərəb kitabında olduğu kimi).

type Flip = { dir: 'next' | 'prev'; from: number; to: number };
type SpreadPages = { right: number | null; left: number | null };

const FLIP_MS = 700;
const paperColor = '#f4e9cf';

function spreadStart(page: number) {
  if (page <= 1) return 1;
  return page % 2 === 0 ? page : page - 1;
}

function spreadPages(start: number, total: number): SpreadPages {
  if (start === 1) return { right: null, left: 1 };
  return { right: start, left: start + 1 <= total ? start + 1 : null };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

function printedLabel(book: LibraryBook, page: number) {
  const printed = page - book.pageOffset;
  return printed >= 1 ? String(printed) : page === 1 ? 'üz qabığı' : '—';
}

/** Kağız fonu + skan şəkli. `spine` cildin hansı tərəfdə olduğunu göstərir (kölgə üçün). */
function PaperPage({ book, page, token, spine, onImageError, onAspect }: {
  book: LibraryBook;
  page: number | null;
  token: string;
  spine: 'left' | 'right' | 'none';
  onImageError?: () => void;
  onAspect?: (aspect: number) => void;
}) {
  const shade = spine === 'left'
    ? 'linear-gradient(to right, rgba(70,45,15,.28), rgba(70,45,15,.08) 5%, transparent 12%)'
    : spine === 'right'
      ? 'linear-gradient(to left, rgba(70,45,15,.28), rgba(70,45,15,.08) 5%, transparent 12%)'
      : 'none';
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        backgroundColor: page ? paperColor : 'transparent',
        backgroundImage: page ? 'radial-gradient(ellipse at 30% 20%, rgba(255,250,235,.7), transparent 60%), radial-gradient(ellipse at 80% 90%, rgba(190,150,90,.18), transparent 55%)' : undefined,
      }}
    >
      {page && (
        <>
          <img
            src={libraryPageUrl(book.slug, page, token)}
            alt={`${book.shortTitle}, səhifə ${printedLabel(book, page)}`}
            className="absolute inset-0 h-full w-full select-none object-contain"
            style={{ mixBlendMode: 'multiply' }}
            draggable={false}
            onError={onImageError}
            onLoad={(event) => {
              const image = event.currentTarget;
              if (image.naturalWidth && image.naturalHeight) onAspect?.(image.naturalWidth / image.naturalHeight);
            }}
          />
          <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: shade, boxShadow: 'inset 0 0 40px rgba(150,110,50,.12)' }} />
        </>
      )}
    </div>
  );
}

export function LibraryReader({ slug, backHref }: { slug: string; backHref: string }) {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const search = useSearch();
  const { books, token, error, loading, reload } = useLibraryCatalog();
  const book = useMemo(() => books?.find((item) => item.slug === slug) ?? null, [books, slug]);
  const reducedMotion = usePrefersReducedMotion();
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const [aspect, setAspect] = useState(0.72);
  const [page, setPage] = useState<number | null>(null);
  const [flip, setFlip] = useState<Flip | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState('');
  const leafRef = useRef<HTMLDivElement | null>(null);
  const leafShadeRef = useRef<HTMLDivElement | null>(null);
  const retriedImage = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const spreadMode = stage.width >= 720;
  const total = book?.pageCount ?? 0;

  // İlk səhifə: ?page=N (AI nəticəsi) → yadda saxlanmış səhifə → 1.
  useEffect(() => {
    if (!book || page !== null) return;
    const requested = Number(new URLSearchParams(search).get('page'));
    const initial = Number.isSafeInteger(requested) && requested >= 1 ? requested : loadReadingPage(userId, book.slug) ?? 1;
    setPage(Math.min(Math.max(1, initial), book.pageCount));
  }, [book, page, search, userId]);

  const current = page === null ? null : spreadMode ? spreadStart(page) : page;

  useEffect(() => {
    if (!book || current === null) return;
    saveReadingPage(userId, book.slug, current);
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(current));
    window.history.replaceState(window.history.state, '', url.toString());
  }, [book, current, userId]);

  const nextOf = useCallback((value: number) => (spreadMode ? (value === 1 ? 2 : value + 2) : value + 1), [spreadMode]);
  const prevOf = useCallback((value: number) => (spreadMode ? (value <= 2 ? 1 : value - 2) : value - 1), [spreadMode]);
  const canNext = current !== null && nextOf(current) <= total;
  const canPrev = current !== null && current > 1;

  const go = useCallback((dir: 'next' | 'prev') => {
    if (current === null || flip) return;
    const target = dir === 'next' ? nextOf(current) : prevOf(current);
    if (target < 1 || target > total) return;
    if (reducedMotion) {
      setPage(target);
      return;
    }
    setFlip({ dir, from: current, to: target });
  }, [current, flip, nextOf, prevOf, total, reducedMotion]);

  const jumpTo = useCallback((target: number) => {
    if (!book) return;
    setFlip(null);
    setPage(Math.min(Math.max(1, Math.round(target)), book.pageCount));
  }, [book]);

  // 3D vərəq çevrilməsi (Web Animations API).
  useLayoutEffect(() => {
    if (!flip) return;
    const leaf = leafRef.current;
    if (!leaf || typeof leaf.animate !== 'function') {
      setPage(flip.to);
      setFlip(null);
      return;
    }
    const sign = spreadMode && flip.dir === 'prev' ? -1 : 1;
    const frames = !spreadMode && flip.dir === 'prev'
      ? [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }]
      : [{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${sign * 180}deg)` }];
    const animation = leaf.animate(frames, { duration: FLIP_MS, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' });
    leafShadeRef.current?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { duration: FLIP_MS, fill: 'forwards' });
    let cancelled = false;
    animation.finished.then(() => {
      if (cancelled) return;
      setPage(flip.to);
      setFlip(null);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [flip, spreadMode]);

  // Klaviatura: ← növbəti, → əvvəlki (sağdan sola kitab).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.key === 'Escape') { setDrawerOpen(false); setSearchOpen(false); return; }
      if (drawerOpen || searchOpen) return;
      if (event.key === 'ArrowLeft' || event.key === 'PageDown' || event.key === ' ') { event.preventDefault(); go('next'); }
      else if (event.key === 'ArrowRight' || event.key === 'PageUp') { event.preventDefault(); go('prev'); }
      else if (event.key === 'Home') jumpTo(1);
      else if (event.key === 'End') jumpTo(total);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, jumpTo, total, drawerOpen, searchOpen]);

  // Qonşu səhifələri əvvəlcədən yüklə.
  useEffect(() => {
    if (!book || !token || current === null) return;
    const wanted = new Set<number>();
    const span = spreadMode ? 2 : 1;
    for (let offset = -span * 2; offset <= span * 3; offset += 1) {
      const candidate = current + offset;
      if (candidate >= 1 && candidate <= book.pageCount) wanted.add(candidate);
    }
    wanted.forEach((candidate) => { const image = new Image(); image.src = libraryPageUrl(book.slug, candidate, token); });
  }, [book, token, current, spreadMode]);

  useEffect(() => {
    if (current === null || !book) return;
    setJumpValue(printedLabel(book, current).replace(/\D/g, ''));
  }, [current, book]);

  useEffect(() => { retriedImage.current = false; }, [token]);

  const onImageError = useCallback(() => {
    if (retriedImage.current) return;
    retriedImage.current = true;
    void reload();
  }, [reload]);

  const onPointerDown = (event: ReactPointerEvent) => { pointerStart.current = { x: event.clientX, y: event.clientY }; };
  const onPointerUp = (event: ReactPointerEvent) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      suppressClick.current = true;
      go(dx > 0 ? 'next' : 'prev'); // sol vərəqi sağa çəkmək = növbəti
    }
  };
  const onBookClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    if (ratio < 0.4) go('next');
    else if (ratio > 0.6) go('prev');
  };

  const onJump = (event: FormEvent) => {
    event.preventDefault();
    if (!book) return;
    const printed = Number(jumpValue);
    if (!Number.isFinite(printed)) return;
    jumpTo(printed + book.pageOffset);
  };

  const currentChapter = book && current !== null ? chapterForPage(book, spreadMode ? Math.min(current + 1, book.pageCount) : current) : null;

  // Ölçü: səhifə(lər) səhnəyə sığsın.
  const columns = spreadMode ? 2 : 1;
  const pageHeight = Math.max(0, Math.min(stage.height, stage.width / (columns * aspect)));
  const pageWidth = pageHeight * aspect;

  const renderBook = () => {
    if (!book || !token || current === null) return null;
    const pageProps = { book, token, onImageError, onAspect: setAspect };
    if (spreadMode) {
      const from = spreadPages(flip ? flip.from : current, total);
      const to = flip ? spreadPages(flip.to, total) : from;
      const underRight = flip?.dir === 'prev' ? to.right : from.right;
      const underLeft = flip?.dir === 'next' ? to.left : from.left;
      const hasRight = underRight !== null || (flip?.dir === 'prev' && from.right !== null);
      const hasLeft = underLeft !== null || (flip?.dir === 'next' && from.left !== null);
      return (
        <div className="relative flex" style={{ width: pageWidth * 2, height: pageHeight, perspective: pageWidth * 4 }}>
          {/* sol yarı (növbəti səhifə) */}
          <div className="relative h-full" style={{ width: pageWidth, boxShadow: hasLeft ? '-6px 10px 30px -10px rgba(0,0,0,.6)' : undefined }}>
            <PaperPage {...pageProps} page={underLeft} spine="right" />
          </div>
          {/* sağ yarı */}
          <div className="relative h-full" style={{ width: pageWidth, boxShadow: hasRight ? '6px 10px 30px -10px rgba(0,0,0,.6)' : undefined }}>
            <PaperPage {...pageProps} page={underRight} spine="left" />
          </div>
          {flip && (
            <div
              ref={leafRef}
              className="absolute top-0 h-full"
              style={{
                width: pageWidth,
                left: flip.dir === 'next' ? 0 : pageWidth,
                transformOrigin: flip.dir === 'next' ? 'right center' : 'left center',
                transformStyle: 'preserve-3d',
                zIndex: 5,
              }}
            >
              <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                <PaperPage {...pageProps} page={flip.dir === 'next' ? from.left : from.right} spine={flip.dir === 'next' ? 'right' : 'left'} />
              </div>
              <div className="absolute inset-0" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                <PaperPage {...pageProps} page={flip.dir === 'next' ? to.right : to.left} spine={flip.dir === 'next' ? 'left' : 'right'} />
              </div>
              <div ref={leafShadeRef} className="pointer-events-none absolute inset-0 opacity-0" style={{ background: flip.dir === 'next' ? 'linear-gradient(to left, rgba(0,0,0,.25), transparent 60%)' : 'linear-gradient(to right, rgba(0,0,0,.25), transparent 60%)' }} />
            </div>
          )}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[rgba(80,55,20,.35)]" style={{ zIndex: 6 }} />
        </div>
      );
    }
    const under = flip ? (flip.dir === 'next' ? flip.to : flip.from) : current;
    const leafPage = flip ? (flip.dir === 'next' ? flip.from : flip.to) : null;
    return (
      <div className="relative" style={{ width: pageWidth, height: pageHeight, perspective: pageWidth * 3, boxShadow: '0 12px 30px -12px rgba(0,0,0,.65)' }}>
        <PaperPage {...pageProps} page={under} spine="right" />
        {flip && leafPage !== null && (
          <div ref={leafRef} className="absolute inset-0" style={{ transformOrigin: 'right center', transformStyle: 'preserve-3d', zIndex: 5 }}>
            <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', boxShadow: '-8px 0 24px -10px rgba(0,0,0,.5)' }}>
              <PaperPage {...pageProps} page={leafPage} spine="right" />
            </div>
            <div className="absolute inset-0" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', backgroundColor: paperColor, backgroundImage: 'linear-gradient(to left, rgba(70,45,15,.18), transparent 30%)' }} />
            <div ref={leafShadeRef} className="pointer-events-none absolute inset-0 opacity-0" style={{ background: 'linear-gradient(to left, rgba(0,0,0,.25), transparent 70%)' }} />
          </div>
        )}
      </div>
    );
  };

  const pageInfo = book && current !== null
    ? spreadMode && current > 1 && current + 1 <= total
      ? `${printedLabel(book, current)}–${printedLabel(book, current + 1)}`
      : printedLabel(book, current)
    : '';

  return (
    <div
      className="fixed inset-0 flex flex-col text-[#f3e7cf]"
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #4a3523 0%, #2b1f15 55%, #1a130d 100%)' }}
      data-testid="library-reader"
    >
      <header className="relative z-20 flex items-center gap-2 border-b border-white/10 bg-[#22190f]/95 px-3 py-2 backdrop-blur sm:px-5">
        <Link href={backHref} className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-[#f3e7cf]/85 hover:bg-white/10" data-testid="link-library-back">
          <ChevronLeft size={16} /> <span className="hidden sm:inline">Kitabxana</span>
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p dir="rtl" lang="ar" className="truncate text-base leading-7 sm:text-lg" style={{ fontFamily: arabicBookFont }}>{book?.title ?? ''}</p>
          {currentChapter && (
            <p dir="rtl" lang="ar" className="truncate text-xs leading-5 text-[#f3e7cf]/65" style={{ fontFamily: arabicBookFont }}>{currentChapter.title}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          disabled={!book}
          className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-40"
          data-testid="button-library-search"
          aria-label="Kitabda axtar"
        >
          <Search size={15} /> <span className="hidden sm:inline">Axtar</span>
        </button>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          disabled={!book}
          className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/10 disabled:opacity-40"
          data-testid="button-library-contents"
        >
          <ListTree size={15} /> <span className="hidden sm:inline">Mündəricat</span>
        </button>
      </header>

      <div ref={stageRef} className="relative min-h-0 flex-1 px-2 py-3 sm:px-6 sm:py-5">
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ touchAction: 'pan-y' }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { pointerStart.current = null; }}
        >
          {!book && (loading
            ? <p className="flex items-center gap-2 text-sm text-[#f3e7cf]/75"><Loader2 size={16} className="animate-spin" /> Kitab yüklənir…</p>
            : (
              <div className="max-w-sm rounded-xl bg-black/30 px-5 py-4 text-center text-sm">
                <p>{error ?? 'Kitab tapılmadı.'}</p>
                {error && <button type="button" onClick={() => void reload()} className="mt-2 inline-flex items-center gap-1 font-semibold underline"><RotateCcw size={13} /> Yenidən</button>}
              </div>
            ))}
          {book && token && current !== null && pageHeight > 0 && (
            <div onClick={onBookClick} className="cursor-pointer" data-testid="library-book-stage">{renderBook()}</div>
          )}
        </div>
      </div>

      <footer className="relative z-20 border-t border-white/10 bg-[#1f1710]/95 px-3 pb-[max(.6rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:px-5">
        {book && current !== null && (
          <input
            type="range"
            dir="rtl"
            min={1}
            max={book.pageCount}
            value={current}
            onChange={(event) => jumpTo(Number(event.target.value))}
            className="mb-2 h-1.5 w-full cursor-pointer accent-[#d9b26a]"
            aria-label="Səhifə sürüşdürücüsü"
          />
        )}
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => go('next')} disabled={!canNext || !!flip} className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-[#d9b26a] px-3.5 py-2 text-xs font-bold text-[#2b1f15] transition hover:brightness-105 disabled:opacity-35" data-testid="button-library-next" aria-label="Növbəti səhifə">
            <ArrowLeft size={15} /> <span className="hidden sm:inline">Növbəti</span>
          </button>
          <form onSubmit={onJump} className="flex items-center gap-1.5 text-xs text-[#f3e7cf]/80">
            <label htmlFor="library-page-jump" className="hidden sm:inline">Səhifə</label>
            <input
              id="library-page-jump"
              inputMode="numeric"
              value={jumpValue}
              onChange={(event) => setJumpValue(event.target.value.replace(/[^\d]/g, '').slice(0, 4))}
              className="w-14 rounded-md border border-white/20 bg-black/30 px-2 py-1 text-center text-sm text-[#f3e7cf] outline-none focus:border-[#d9b26a]"
              aria-label="Səhifəyə keç (kitabdakı nömrə)"
              data-testid="input-library-page"
            />
            <button type="submit" className="rounded-md border border-white/20 px-2 py-1 font-semibold hover:bg-white/10">Keç</button>
            <span className="ml-1 whitespace-nowrap text-[#f3e7cf]/60">s. {pageInfo} · {current ?? '–'}/{total || '–'}</span>
          </form>
          <button type="button" onClick={() => go('prev')} disabled={!canPrev || !!flip} className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-xs font-bold transition hover:bg-white/10 disabled:opacity-35" data-testid="button-library-prev" aria-label="Əvvəlki səhifə">
            <span className="hidden sm:inline">Əvvəlki</span> <ArrowRight size={15} />
          </button>
        </div>
      </footer>

      {searchOpen && book && <ReaderSearchPanel book={book} onClose={() => setSearchOpen(false)} onOpenPage={(target) => { jumpTo(target); setSearchOpen(false); }} />}

      {drawerOpen && book && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Mündəricat">
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} aria-label="Bağla" />
          <aside className="relative flex h-full w-full max-w-md flex-col bg-[#f7eedb] text-[#3a2a17] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#3a2a17]/15 px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#3a2a17]/60">Mündəricat</p>
                <p className="text-sm font-semibold">{book.shortTitle} · {book.chapters.length} bölmə</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="focus-ring rounded-full p-2 hover:bg-black/5" aria-label="Bağla"><X size={18} /></button>
            </div>
            <ol className="min-h-0 flex-1 overflow-y-auto px-2 py-2" dir="rtl" lang="ar">
              {book.chapters.map((chapter, index) => {
                const active = currentChapter === chapter;
                return (
                  <li key={`${chapter.page}-${index}`}>
                    <button
                      type="button"
                      ref={active ? (element) => element?.scrollIntoView({ block: 'center' }) : undefined}
                      onClick={() => { jumpTo(chapter.page); setDrawerOpen(false); }}
                      className={`flex w-full items-baseline gap-3 rounded-lg px-3 py-1.5 text-right transition hover:bg-[#3a2a17]/8 ${active ? 'bg-[#d9b26a]/35' : ''} ${chapter.level === 2 ? 'pr-8 text-[15px] text-[#3a2a17]/80' : 'text-[17px] font-bold'}`}
                      style={{ fontFamily: arabicBookFont }}
                    >
                      <span className="flex-1 leading-7">{chapter.title}</span>
                      <span className="shrink-0 font-sans text-xs tabular-nums text-[#3a2a17]/55" dir="ltr">{chapter.printedPage}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>
        </div>
      )}
    </div>
  );
}
