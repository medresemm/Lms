import { BookOpen } from 'lucide-react';
import { Link } from 'wouter';
import { arabicBookFont, groupLibraryItems, LIBRARY_SLUG, type LibraryChapterSuggestion, type LibrarySearchItem } from '@/lib/library';

// Kitabxana axtarış nəticələri: Mədinə AI-də (tünd fon) və oxuyucunun axtarış panelində (kağız fon).
// Mətn yalnız mətn kimi göstərilir (xam HTML yoxdur); vurğulama serverin qaytardığı hissələrlə edilir.

type Tone = 'dark' | 'paper';

const toneClasses: Record<Tone, { card: string; book: string; path: string; snippet: string; mark: string; badge: string; badgeChapter: string; badgePartial: string; button: string }> = {
  dark: {
    card: 'rounded-2xl border border-[#e3c27a]/20 bg-white/[.03] p-4',
    book: 'text-[#e3c27a]',
    path: 'text-[#f4ead5]/70',
    snippet: 'text-[#f4ead5]/90',
    mark: 'rounded bg-[#e3c27a]/30 px-0.5 text-[#fff4da]',
    badge: 'border-[#e3c27a]/30 text-[#f4ead5]/75',
    badgeChapter: 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100',
    badgePartial: 'border-amber-300/40 bg-amber-300/10 text-amber-100',
    button: 'bg-gradient-to-br from-[#f3dca6] to-[#c49a4c] text-[#17130c]',
  },
  paper: {
    card: 'rounded-xl border border-[#3a2a17]/15 bg-white/50 p-3',
    book: 'text-[#7a5a2a]',
    path: 'text-[#3a2a17]/70',
    snippet: 'text-[#3a2a17]',
    mark: 'rounded bg-[#d9b26a]/45 px-0.5',
    badge: 'border-[#3a2a17]/20 text-[#3a2a17]/70',
    badgeChapter: 'border-emerald-700/30 bg-emerald-700/10 text-emerald-900',
    badgePartial: 'border-amber-700/30 bg-amber-600/10 text-amber-900',
    button: 'bg-[#3a2a17] text-[#f7eedb]',
  },
};

export function HighlightedSnippet({ item, markClass }: { item: LibrarySearchItem; markClass: string }) {
  const parts = Array.isArray(item.parts) && item.parts.length ? item.parts : [{ text: item.snippet }];
  return (
    <>
      {parts.map((part, index) => (part.hit
        ? <mark key={index} className={markClass} style={{ color: 'inherit' }}>{part.text}</mark>
        : <span key={index}>{part.text}</span>))}
    </>
  );
}

function ResultCard({ item, tone, onOpen }: { item: LibrarySearchItem; tone: Tone; onOpen?: (item: LibrarySearchItem) => void }) {
  const classes = toneClasses[tone];
  const page = Number.isSafeInteger(item.page) && item.page > 0 ? item.page : 1;
  const slug = LIBRARY_SLUG.test(item.slug) ? item.slug : '';
  const path = Array.isArray(item.chapterPath) && item.chapterPath.length ? item.chapterPath : item.chapterTitle ? [item.chapterTitle] : [];
  const action = (
    <>
      <BookOpen size={13} /> {tone === 'paper' ? 'Səhifəyə keç' : 'Kitabda aç'}
    </>
  );
  return (
    <article className={classes.card} data-testid="library-search-result">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes.badge}`}>s. {item.printedPage ?? page}</span>
          {item.match === 'chapter' && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes.badgeChapter}`}>Fəsil başlığı</span>}
          {item.partial && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes.badgePartial}`} title="Sorğudakı bütün sözlər bu səhifədə tapılmadı">qismən uyğun</span>}
        </div>
        {path.length > 0 && (
          <p dir="rtl" lang="ar" className={`min-w-0 flex-1 text-right text-sm leading-6 ${classes.path}`} style={{ fontFamily: arabicBookFont }}>
            {path.map((segment, index) => (
              <span key={index}>{index > 0 && <span className="mx-1 opacity-60">‹</span>}{segment}</span>
            ))}
          </p>
        )}
      </header>
      {item.snippet && (
        <p dir="rtl" lang="ar" className={`mt-2 text-right text-[16px] leading-8 ${classes.snippet}`} style={{ fontFamily: arabicBookFont }}>
          <HighlightedSnippet item={item} markClass={classes.mark} />
        </p>
      )}
      {onOpen ? (
        <button type="button" onClick={() => onOpen(item)} className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition hover:brightness-105 ${classes.button}`} data-testid="button-library-result-open">{action}</button>
      ) : slug ? (
        <Link href={`/kitabxana/${slug}?page=${page}`} className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition hover:brightness-105 ${classes.button}`} data-testid="link-ai-library-open">{action}</Link>
      ) : null}
    </article>
  );
}

export function LibraryHitList({ items, tone, onOpen, groupHeadings = true }: { items: LibrarySearchItem[]; tone: Tone; onOpen?: (item: LibrarySearchItem) => void; groupHeadings?: boolean }) {
  const classes = toneClasses[tone];
  const groups = groupLibraryItems(items);
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.slug} className="space-y-2.5">
          {groupHeadings && (
            <h4 dir="rtl" lang="ar" className={`text-right text-[15px] leading-7 ${classes.book}`} style={{ fontFamily: arabicBookFont }}>
              {group.items[0].bookTitle} <span className="font-sans text-[11px] opacity-70" dir="ltr">· {group.items.length}</span>
            </h4>
          )}
          {group.items.map((item) => <ResultCard key={`${item.slug}-${item.page}-${item.match ?? 'text'}`} item={item} tone={tone} onOpen={onOpen} />)}
        </section>
      ))}
    </div>
  );
}

export function DidYouMean({ suggestions, tone, onOpen }: { suggestions: LibraryChapterSuggestion[]; tone: Tone; onOpen?: (suggestion: LibraryChapterSuggestion) => void }) {
  if (!suggestions.length) return null;
  const classes = toneClasses[tone];
  return (
    <div className={classes.card} data-testid="library-did-you-mean">
      <p className={`text-xs font-semibold ${tone === 'dark' ? 'text-[#f4ead5]/80' : 'text-[#3a2a17]/80'}`}>Bunu nəzərdə tuturdunuz?</p>
      <ul className="mt-2 space-y-1.5">
        {suggestions.filter((item) => LIBRARY_SLUG.test(item.slug)).map((item) => {
          const label = (
            <>
              <span dir="rtl" lang="ar" className="text-[15px] leading-7" style={{ fontFamily: arabicBookFont }}>{item.title}</span>
              <span className="text-[11px] opacity-70">{item.bookShortTitle} · s. {item.printedPage}</span>
            </>
          );
          return (
            <li key={`${item.slug}-${item.page}-${item.title}`}>
              {onOpen
                ? <button type="button" onClick={() => onOpen(item)} className={`flex w-full flex-wrap items-baseline justify-between gap-2 rounded-lg px-2 py-1 text-right hover:bg-black/5 ${classes.path}`}>{label}</button>
                : <Link href={`/kitabxana/${item.slug}?page=${item.page}`} className={`flex flex-wrap items-baseline justify-between gap-2 rounded-lg px-2 py-1 hover:bg-white/5 ${classes.path}`}>{label}</Link>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
