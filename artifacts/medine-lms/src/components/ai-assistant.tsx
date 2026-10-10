import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowLeft, BookOpen, BookText, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardCheck, ClipboardList, Compass, Copy, ExternalLink, GraduationCap, HelpCircle, LibraryBig, Loader2, ScrollText, Search, SendHorizontal, Trash2, UsersRound } from 'lucide-react';
import { Link } from 'wouter';
import { useAuth, useUser } from '@clerk/react';
import { DidYouMean, LibraryHitList } from '@/components/library-search-results';
import { LIBRARY_SLUG, libraryPageTextApi, libraryReaderHref, searchLibraryApi, type LibraryChapterSuggestion, type LibrarySearchItem } from '@/lib/library';
import { AiAnswerCard, keepAnchor, MoreButton, PagedList } from '@/components/ai-blocks';
import { frameOf, inferFrame, readBlocks, readFrame, type AiBlock, type AiFrame } from '@/lib/ai-blocks';
import { answerScrollTop, initialShown, pagerState, revealMore } from '@/lib/paginate';
import { courseBookRange, type CourseBookView } from '@/lib/course-books';
import { courseTermLabel } from '@/components/course-books';
import { AiTestBuilder, loadTestBuilderConfig, type TestBuilderConfig } from '@/components/ai-test-builder';
import { LanguageSwitch, useI18n, type MessageKey } from '@/lib/i18n';

// Mədinə AI — saytın daxili köməkçisi.
// Söhbət tarixçəsi YALNIZ bu brauzerin localStorage-ində saxlanılır (açar: medine-ai-chat:<clerkUserId>).
// Server heç nə saxlamır; hər sorğuda yalnız cari mesaj və qısa son tarixçə göndərilir.

export type AiAssistantMode = 'student' | 'admin';

type ShamelaItem = {
  bookId: number;
  pageId: number;
  title: string;
  author: string;
  label: string;
  text: string;
  url: string;
  prevPageId: number | null;
  nextPageId: number | null;
  truncated?: boolean;
};


type DorarItem = { text: string; narrator: string; muhaddith: string; source: string; page: string; grading: string; abridged?: boolean };

/** «Davamı» cavabı: full — Dorar tam verir; origin — əsl kitabdakı mətn; shamela — Şamilədə tapılan; fragment — yalnız parça. */
type HadithFull = { status: 'full' | 'origin' | 'shamela' | 'fragment'; text: string; sourceTitle: string | null; takhrij: string | null; url: string | null };

// Şamilə / Dorar nəticələri: serverdə düz mətnə çevrilib gəlir, burada yalnız mətn kimi göstərilir (xam HTML yoxdur).
type ResearchSources =
  | { kind: 'shamela'; query: string; sourceUrl: string; items: ShamelaItem[]; error?: string; hasMore?: boolean; cursor?: string | null }
  | { kind: 'dorar'; query: string; sourceUrl: string; items: DorarItem[]; error?: string }
  | {
    kind: 'library';
    query: string;
    items: LibrarySearchItem[];
    total?: number;
    book?: string | null;
    expanded?: string[];
    didYouMean?: LibraryChapterSuggestion[];
  }
  | { kind: 'course-books'; query: string; items: CourseBooksAnswerItem[] };

type CourseBooksAnswerItem = { courseId: number; courseTitle: string; termNumber: number; books: CourseBookView[] };

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestions?: string[];
  /** Köhnə mesajlarda tək obyekt, yenilərində qrup massivi. */
  sources?: ResearchSources | ResearchSources[];
  /** Strukturlu kartlar (yeni cavablar). Yoxdursa `text` göstərilir. */
  blocks?: AiBlock[];
  /** Vahid cavab kartının başlığı (daxili cavablar). */
  frame?: AiFrame;
  /** Sorğu hansı rejimdə verilib: daxili cavablar kartda, xarici (Şamilə/Dorar) öz kartlarında göstərilir. */
  mode?: SourceMode;
  error?: boolean;
  at: number;
};

type Tile = { label: string; labelKey: MessageKey; hintKey: MessageKey; prompt: string; Icon: typeof BookOpen; fill?: boolean; action?: 'test-builder' };

const STORAGE_PREFIX = 'medine-ai-chat:';
const MAX_STORED_MESSAGES = 100;
const HISTORY_TURNS_SENT = 6;
const MAX_MESSAGE_LENGTH = 1000;

const studentTiles: Tile[] = [
  { label: 'Dərs cədvəlim', labelKey: 'aiMySchedule', hintKey: 'aiMyScheduleHint', prompt: 'Dərs cədvəlim', Icon: CalendarDays },
  { label: 'Tapşırıqlarım', labelKey: 'aiMyTasks', hintKey: 'aiMyTasksHint', prompt: 'Tapşırıqlarım', Icon: ClipboardList },
  { label: 'Qiymətlərim', labelKey: 'aiMyGrades', hintKey: 'aiMyGradesHint', prompt: 'Qiymətlərim', Icon: GraduationCap },
  { label: 'Resurslar', labelKey: 'aiResources', hintKey: 'aiResourcesHint', prompt: 'Resurslar', Icon: LibraryBig },
  { label: 'Saytdan istifadə', labelKey: 'aiHow', hintKey: 'aiHowHint', prompt: 'Saytdan necə istifadə edim?', Icon: Compass },
  { label: 'Kitabxana', labelKey: 'aiLibrary', hintKey: 'aiLibraryHint', prompt: 'Kitabxanada axtar: ', Icon: BookText, fill: true },
];

const adminTiles: Tile[] = [
  { label: 'Tələbə axtar', labelKey: 'aiFindStudent', hintKey: 'aiFindStudentHint', prompt: 'Tələbə axtar', Icon: Search },
  { label: 'Qayıbı çox olanlar', labelKey: 'aiAbsences', hintKey: 'aiAbsencesHint', prompt: 'Qayıbı çox olanlar', Icon: CalendarDays },
  { label: 'Müraciətlər', labelKey: 'aiApps', hintKey: 'aiAppsHint', prompt: 'Neçə müraciət gözləyir?', Icon: ClipboardList },
  { label: 'Ümumi statistika', labelKey: 'aiStats', hintKey: 'aiStatsHint', prompt: 'Ümumi statistika', Icon: UsersRound },
  { label: 'Paneldən istifadə', labelKey: 'aiPanel', hintKey: 'aiPanelHint', prompt: 'Admin paneldən necə istifadə edim?', Icon: Compass },
  { label: 'Kitabxana', labelKey: 'aiLibrary', hintKey: 'aiLibraryHint', prompt: 'Kitabxanada axtar: ', Icon: BookText, fill: true },
];

// «Xarici» rejimdə nümunə sorğular (seçilmiş mənbədə axtarılır).
const externalTiles: Tile[] = [
  { label: 'Niyyət hədisi', labelKey: 'aiIntent', hintKey: 'aiOwnHint', prompt: 'إنما الأعمال بالنيات', Icon: ScrollText },
  { label: 'Elm tələbi', labelKey: 'aiSeek', hintKey: 'aiOwnHint', prompt: 'طلب العلم فريضة', Icon: BookText },
  { label: 'Səbr', labelKey: 'aiPatience', hintKey: 'aiOwnHint', prompt: 'فضل الصبر', Icon: BookOpen },
  { label: 'Valideynə hörmət', labelKey: 'aiParents', hintKey: 'aiOwnHint', prompt: 'بر الوالدين', Icon: LibraryBig },
  { label: 'Öz sorğum', labelKey: 'aiOwn', hintKey: 'aiOwnHint', prompt: '', Icon: Search, fill: true },
];

const gold = '#e3c27a';
const arabicFont = '"Amiri", "Noto Naskh Arabic", "Scheherazade New", "Traditional Arabic", "Geeza Pro", serif';
const SAFE_SOURCE_URL = /^https:\/\/(?:www\.)?(?:shamela\.ws|dorar\.net)(?:\/|$)/;

function safeSourceUrl(url: unknown, fallback: string) {
  return typeof url === 'string' && SAFE_SOURCE_URL.test(url) ? url : fallback;
}

function isResearchSources(value: unknown): value is ResearchSources {
  if (!value || typeof value !== 'object') return false;
  const sources = value as { kind?: unknown; items?: unknown; query?: unknown };
  return (sources.kind === 'shamela' || sources.kind === 'dorar' || sources.kind === 'library' || sources.kind === 'course-books') && Array.isArray(sources.items) && typeof sources.query === 'string';
}

function sourceGroups(value: unknown): ResearchSources[] {
  if (Array.isArray(value)) return value.filter(isResearchSources).slice(0, 3);
  return isResearchSources(value) ? [value] : [];
}

// Heyət üçün mənbə rejimi: «Daxili» (yalnız LMS) və ya «Xarici» (yalnız Şamilə/Dorar). Server də tətbiq edir.
type SourceMode = 'internal' | 'external';
type ExternalTarget = 'shamela' | 'dorar' | 'all';
type SourcePreference = { mode: SourceMode; target: ExternalTarget };
const SOURCE_PREFIX = 'medine-ai-source:';

function loadSourcePreference(userId: string | null | undefined, fallback: SourceMode): SourcePreference {
  const defaults: SourcePreference = { mode: fallback, target: 'shamela' };
  if (!userId || typeof window === 'undefined') return defaults;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`${SOURCE_PREFIX}${userId}`) || 'null') as Partial<SourcePreference> | null;
    return {
      mode: parsed?.mode === 'internal' || parsed?.mode === 'external' ? parsed.mode : fallback,
      target: parsed?.target === 'dorar' || parsed?.target === 'all' || parsed?.target === 'shamela' ? parsed.target : 'shamela',
    };
  } catch {
    return defaults;
  }
}

function saveSourcePreference(userId: string | null | undefined, preference: SourcePreference) {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${SOURCE_PREFIX}${userId}`, JSON.stringify(preference));
  } catch {
    // localStorage bağlıdırsa seçim yalnız bu səhifədə qalır.
  }
}

function storageKey(userId: string | null | undefined) {
  return userId ? `${STORAGE_PREFIX}${userId}` : null;
}

function loadMessages(key: string | null): ChatMessage[] {
  if (!key || typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ChatMessage => Boolean(item) && typeof item === 'object'
      && ((item as ChatMessage).role === 'user' || (item as ChatMessage).role === 'assistant')
      && typeof (item as ChatMessage).text === 'string')
      .map((item) => (item.sources && !sourceGroups(item.sources).length ? { ...item, sources: undefined } : item))
      .map((item) => (item.blocks !== undefined ? { ...item, blocks: readBlocks(item.blocks) } : item))
      .map((item) => (item.frame !== undefined ? { ...item, frame: readFrame(item.frame) } : item))
      .map((item) => (item.mode !== undefined && item.mode !== 'internal' && item.mode !== 'external' ? { ...item, mode: undefined } : item))
      .slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
}

function saveMessages(key: string | null, messages: ChatMessage[]) {
  if (!key || typeof window === 'undefined') return;
  try {
    if (messages.length) window.localStorage.setItem(key, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
    else window.localStorage.removeItem(key);
  } catch {
    // localStorage dolu və ya bağlıdırsa, söhbət yalnız bu səhifədə qalır.
  }
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const siteBase = import.meta.env.BASE_URL.replace(/\/$/, '');

function LinkifiedText({ text }: { text: string }) {
  // Dərsə qoşulma linkləri (/api/.../join) saytın öz ünvanıdır: qoşulma qeyd olunur, sonra Zoom/Meet açılır.
  const parts = text.split(/(https?:\/\/[^\s)]+|\/api\/(?:lessons|courses)\/\d+\/join[^\s)]*)/g);
  return <>{parts.map((part, index) => /^https?:\/\/|^\/api\//.test(part)
    ? <a key={index} href={part.startsWith('/api/') ? `${siteBase}${part}` : part} target="_blank" rel="noreferrer noopener" className="break-all underline decoration-[#e3c27a]/60 underline-offset-2 hover:text-[#f3dca6]">{part}</a>
    : <span key={index}>{part}</span>)}</>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 rounded-full border border-[#e3c27a]/30 px-2.5 py-1 text-[11px] font-semibold text-[#f4ead5]/80 transition hover:border-[#e3c27a]/70 hover:text-[#f3dca6]" data-testid="button-ai-source-copy">
      {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Kopyalandı' : 'Kopyala'}
    </button>
  );
}

function SourceText({ text, tall = false }: { text: string; tall?: boolean }) {
  return (
    <div
      dir="auto"
      lang="ar"
      className={`${tall ? 'max-h-[28rem]' : 'max-h-64'} overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-black/25 px-4 py-3 text-start text-[17px] leading-9 text-[#f8f0dc] [unicode-bidi:plaintext]`}
      style={{ fontFamily: arabicFont }}
      tabIndex={0}
    >
      {text}
    </div>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[11px] text-[#f4ead5]/50 underline decoration-[#e3c27a]/40 underline-offset-2 hover:text-[#f3dca6]">
      {label} <ExternalLink size={11} />
    </a>
  );
}

type GetToken = () => Promise<string | null>;

function ShamelaCard({ item, getToken, pageEndpoint }: { item: ShamelaItem; getToken: GetToken; pageEndpoint: string }) {
  const [page, setPage] = useState<ShamelaItem>(item);
  const [full, setFull] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const card = useRef<HTMLElement>(null);

  async function open(pageId: number) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken().catch(() => null);
      const response = await fetch(pageEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ bookId: item.bookId, pageId }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null) as { page?: ShamelaItem; error?: string } | null;
      if (!response.ok || !data?.page || typeof data.page.text !== 'string') throw new Error(data?.error || 'Şamilə hal-hazırda cavab vermir. Bir az sonra yenidən cəhd edin.');
      const next = { ...data.page, title: data.page.title || item.title, author: data.page.author || item.author };
      keepAnchor(card.current, () => {
        setPage(next);
        setFull(true);
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Səhifəni açmaq mümkün olmadı.');
    } finally {
      setLoading(false);
    }
  }

  const url = safeSourceUrl(page.url, 'https://shamela.ws/search');
  const citation = [page.title, page.author].filter(Boolean).join(' — ') + (page.label ? ` (${page.label})` : '');
  return (
    <article ref={card} className="rounded-2xl border border-[#e3c27a]/25 bg-white/[.035] p-4" data-testid="ai-source-shamela">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p dir="auto" className="text-base font-semibold leading-7 text-[#f3dca6]" style={{ fontFamily: arabicFont }}>{page.title}</p>
          <p dir="auto" className="text-xs text-[#f4ead5]/60">
            {page.author && <span style={{ fontFamily: arabicFont }}>{page.author}</span>}
            {page.author && page.label ? ' · ' : ''}
            {page.label && <span><bdi>{page.label}</bdi></span>}
          </p>
        </div>
        <CopyButton text={`${page.text}\n\n— ${citation}\n${url}`} />
      </header>
      <SourceText text={page.text} tall={full} />
      {full && <p className="mt-1.5 text-[11px] text-[#f4ead5]/50">{page.truncated ? 'Səhifənin ilk hissəsi göstərilir — davamı mənbədədir.' : 'Səhifənin tam mətni.'}</p>}
      {error && <p className="mt-2 text-xs text-red-200">{error}</p>}
      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={loading || !page.prevPageId} onClick={() => page.prevPageId && void open(page.prevPageId)} className="inline-flex items-center gap-1 rounded-full border border-[#e3c27a]/30 px-2.5 py-1 text-[11px] font-semibold text-[#f4ead5]/80 transition hover:border-[#e3c27a]/70 disabled:opacity-35" data-testid="button-shamela-prev">
            <ChevronLeft size={12} /> Əvvəlki səhifə
          </button>
          <button type="button" disabled={loading} onClick={() => (full && page.pageId === item.pageId ? keepAnchor(card.current, () => { setPage(item); setFull(false); }) : void open(item.pageId))} className="inline-flex items-center gap-1 rounded-full border border-[#e3c27a]/50 bg-[#e3c27a]/10 px-3 py-1 text-[11px] font-bold text-[#f3dca6] transition hover:bg-[#e3c27a]/20 disabled:opacity-50" data-testid="button-shamela-full">
            {loading ? <Loader2 size={12} className="animate-spin" /> : full && page.pageId === item.pageId ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {full && page.pageId === item.pageId ? 'Qısalt' : full ? 'Tapılan səhifəyə qayıt' : 'Davamı'}
          </button>
          <button type="button" disabled={loading || !page.nextPageId} onClick={() => page.nextPageId && void open(page.nextPageId)} className="inline-flex items-center gap-1 rounded-full border border-[#e3c27a]/30 px-2.5 py-1 text-[11px] font-semibold text-[#f4ead5]/80 transition hover:border-[#e3c27a]/70 disabled:opacity-35" data-testid="button-shamela-next">
            Növbəti səhifə <ChevronRight size={12} />
          </button>
        </div>
        <SourceLink href={url} label="Mənbə: Şamilə" />
      </footer>
    </article>
  );
}

const DORAR_FIELDS: Array<[keyof Omit<DorarItem, 'text'>, string, string]> = [
  ['narrator', 'Ravi', 'الراوي'],
  ['muhaddith', 'Mühəddis', 'المحدث'],
  ['source', 'Mənbə', 'المصدر'],
  ['page', 'Səhifə / nömrə', 'الصفحة أو الرقم'],
  ['grading', 'Hökm', 'خلاصة حكم المحدث'],
];

const HADITH_STATUS: Record<HadithFull['status'], { title: string; note: string }> = {
  full: { title: 'Hədisin tam mətni', note: 'Dorar bu hədisi bu mənbədə tam şəkildə verir.' },
  origin: { title: 'Əsl mənbədəki tam mətn', note: 'Mətn Dorar-ın «أصول الحديث» bölməsindən, sənədi (isnadı) ilə birlikdə götürülüb.' },
  shamela: { title: 'Şamilədə tapılan mətn', note: 'Dorar tam mətni vermədi; uyğun mətn Şamilə kitabxanasından tapıldı. Zəhmət olmasa mənbədə yoxlayın.' },
  fragment: { title: 'Tam mətn tapılmadı', note: 'Təəssüf ki, tam mətni tapa bilmədim — yalnız bu parça mövcuddur. Mənbəyə keçib yoxlaya bilərsiniz.' },
};

function DorarCard({ item, sourceUrl, query, getToken, fullEndpoint }: { item: DorarItem; sourceUrl: string; query: string; getToken: GetToken; fullEndpoint: string }) {
  const [full, setFull] = useState<HadithFull | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const card = useRef<HTMLElement>(null);
  const copyText = [item.text, '', ...DORAR_FIELDS.filter(([key]) => item[key]).map(([key, , arabic]) => `${arabic}: ${item[key]}`), '', `— الدرر السنية: ${sourceUrl}`].join('\n');

  async function toggle() {
    if (expanded) {
      keepAnchor(card.current, () => setExpanded(false));
      return;
    }
    if (full) {
      keepAnchor(card.current, () => setExpanded(true));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken().catch(() => null);
      const response = await fetch(fullEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ query, text: item.text, narrator: item.narrator, muhaddith: item.muhaddith, source: item.source, page: item.page }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null) as { full?: HadithFull; error?: string } | null;
      const result = data?.full;
      if (!response.ok || !result || typeof result.text !== 'string' || !(result.status in HADITH_STATUS)) throw new Error(data?.error || 'Tam mətni yükləmək olmadı. Bir az sonra yenidən cəhd edin.');
      keepAnchor(card.current, () => {
        setFull(result);
        setExpanded(true);
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tam mətni yükləmək olmadı.');
    } finally {
      setLoading(false);
    }
  }

  const status = full ? HADITH_STATUS[full.status] : null;
  const fullUrl = full?.url ? safeSourceUrl(full.url, sourceUrl) : sourceUrl;
  return (
    <article ref={card} className="rounded-2xl border border-[#e3c27a]/25 bg-white/[.035] p-4" data-testid="ai-source-dorar">
      <div className="mb-3 flex items-center justify-between gap-2">
        {item.abridged ? <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold text-amber-100">Mənbədə qısaldılıb</span> : <span />}
        <CopyButton text={full && expanded && full.status !== 'fragment' ? `${full.text}\n\n— ${full.sourceTitle ?? ''}\n${fullUrl}` : copyText} />
      </div>
      <SourceText text={item.text} />
      {expanded && full && status && (
        <section className={`mt-3 rounded-xl border px-3 py-3 ${full.status === 'fragment' ? 'border-amber-300/35 bg-amber-300/[.06]' : 'border-[#e3c27a]/30 bg-[#e3c27a]/[.06]'}`} data-testid={`ai-dorar-full-${full.status}`}>
          <p className="text-[12px] font-bold text-[#f3dca6]">{status.title}{full.sourceTitle && full.status !== 'fragment' ? <> · <bdi style={{ fontFamily: arabicFont }}>{full.sourceTitle}</bdi></> : null}</p>
          {full.status !== 'fragment' && <div className="mt-2"><SourceText text={full.text} tall /></div>}
          {full.takhrij && (
            <p className="mt-2 text-[12px] leading-6 text-[#f4ead5]/75">Təxric · <span dir="rtl" style={{ fontFamily: arabicFont }}>التخريج</span>: <bdi dir="rtl" className="text-[14px]" style={{ fontFamily: arabicFont }}>{full.takhrij}</bdi></p>
          )}
          <p className="mt-2 text-[11px] leading-5 text-[#f4ead5]/60">{status.note}</p>
          <div className="mt-1.5"><SourceLink href={fullUrl} label={full.status === 'shamela' ? 'Mənbə: Şamilə' : 'Mənbə: الدرر السنية'} /></div>
        </section>
      )}
      {error && <p className="mt-2 text-xs text-red-200">{error}</p>}
      <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        {DORAR_FIELDS.map(([key, label, arabic]) => item[key] ? (
          <div key={key} className={key === 'grading' ? 'sm:col-span-2 rounded-xl border border-[#e3c27a]/30 bg-[#e3c27a]/[.07] px-3 py-2' : ''}>
            <dt className="text-[11px] text-[#f4ead5]/50">{label} · <span dir="rtl" style={{ fontFamily: arabicFont }}>{arabic}</span></dt>
            <dd dir="auto" className={`${key === 'grading' ? 'font-semibold text-[#f3dca6]' : 'text-[#f4ead5]'} text-[15px] leading-7`} style={{ fontFamily: arabicFont }}>{item[key]}</dd>
          </div>
        ) : null)}
      </dl>
      <footer className="mt-3">
        <button type="button" onClick={() => void toggle()} disabled={loading} className="inline-flex items-center gap-1 rounded-full border border-[#e3c27a]/50 bg-[#e3c27a]/10 px-3 py-1 text-[11px] font-bold text-[#f3dca6] transition hover:bg-[#e3c27a]/20 disabled:opacity-50" data-testid="button-dorar-full">
          {loading ? <Loader2 size={12} className="animate-spin" /> : expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {loading ? 'Axtarılır…' : expanded ? 'Qısalt' : 'Davamı'}
        </button>
      </footer>
    </article>
  );
}

function LibraryResults({ sources, getToken }: { sources: Extract<ResearchSources, { kind: 'library' }>; getToken: GetToken }) {
  const [items, setItems] = useState<LibrarySearchItem[]>(sources.items);
  const [shown, setShown] = useState(() => initialShown(sources.items.length));
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const total = typeof sources.total === 'number' ? sources.total : sources.items.length;
  const didYouMean = Array.isArray(sources.didYouMean) ? sources.didYouMean : [];
  if (!items.length && !didYouMean.length) return null;
  const pager = pagerState({ shown, loaded: items.length, total });

  async function showMore() {
    if (!pager.needsServer) {
      keepAnchor(wrapper.current, () => setShown((current) => revealMore(current, items.length)));
      return;
    }
    setLoadingMore(true);
    setMoreError(null);
    try {
      const data = await searchLibraryApi(getToken, { query: sources.query, offset: items.length, book: sources.book ?? null });
      const seen = new Set(items.map((item) => `${item.slug}-${item.page}-${item.match ?? 'text'}`));
      const merged = [...items, ...data.items.filter((item) => !seen.has(`${item.slug}-${item.page}-${item.match ?? 'text'}`))];
      keepAnchor(wrapper.current, () => {
        setItems(merged);
        setShown(revealMore(pager.shown, merged.length));
      });
    } catch (error) {
      setMoreError(error instanceof Error ? error.message : 'Axtarış alınmadı.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div ref={wrapper} className="mt-3 space-y-3" data-testid="ai-library-results">
      {items.length > 0 && (
        <LibraryHitList
          items={items.slice(0, pager.shown)}
          tone="dark"
          keep={keepAnchor}
          loadPage={(item) => libraryPageTextApi(getToken, { slug: item.slug, page: item.page, query: sources.query })}
        />
      )}
      <DidYouMean suggestions={didYouMean} tone="dark" />
      {items.length > 0 && pager.canShowMore && <MoreButton label={pager.label} onClick={() => void showMore()} loading={loadingMore} testId="button-ai-library-more" />}
      {moreError && <p className="text-xs text-red-200">{moreError}</p>}
      <p className="text-[11px] text-[#f4ead5]/45">Axtarış skan mətninə (OCR) əsaslanır — kiçik xətalar ola bilər; dəqiq mətni kitabın özündə yoxlayın.</p>
    </div>
  );
}

function ShamelaResults({ sources, getToken, pageEndpoint, moreEndpoint }: { sources: Extract<ResearchSources, { kind: 'shamela' }>; getToken: GetToken; pageEndpoint: string; moreEndpoint: string }) {
  const [items, setItems] = useState<ShamelaItem[]>(sources.items);
  const [shown, setShown] = useState(() => initialShown(sources.items.length));
  const [server, setServer] = useState<{ hasMore: boolean; cursor: string | null }>({ hasMore: sources.hasMore === true, cursor: typeof sources.cursor === 'string' ? sources.cursor : null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const pager = pagerState({ shown, loaded: items.length, serverHasMore: server.hasMore });

  async function showMore() {
    if (!pager.needsServer) {
      keepAnchor(wrapper.current, () => setShown((current) => revealMore(current, items.length)));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken().catch(() => null);
      const response = await fetch(moreEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ query: sources.query, seenBookIds: items.map((item) => item.bookId), cursor: server.cursor }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null) as { items?: ShamelaItem[]; hasMore?: boolean; cursor?: string | null; error?: string } | null;
      if (!response.ok || !data || !Array.isArray(data.items)) throw new Error(data?.error || 'Şamilə hal-hazırda cavab vermir. Bir az sonra yenidən cəhd edin.');
      const fresh = data.items.filter((item) => item && typeof item.text === 'string' && !items.some((existing) => existing.bookId === item.bookId));
      keepAnchor(wrapper.current, () => {
        setItems((current) => [...current, ...fresh]);
        setShown((current) => current + fresh.length);
        setServer({ hasMore: data.hasMore === true && fresh.length > 0, cursor: typeof data.cursor === 'string' ? data.cursor : null });
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Daha çox nəticə yükləmək olmadı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={wrapper} className="mt-3 space-y-3">
      {items.slice(0, pager.shown).map((item) => <ShamelaCard key={`${item.bookId}-${item.pageId}`} item={item} getToken={getToken} pageEndpoint={pageEndpoint} />)}
      {pager.canShowMore && <MoreButton label={pager.label} onClick={() => void showMore()} loading={loading} testId="button-ai-shamela-more" />}
      {error && <p className="text-xs text-red-200">{error}</p>}
      <p className="text-[11px] text-[#f4ead5]/45">Mətnlər canlı olaraq <SourceLink href="https://shamela.ws" label="المكتبة الشاملة (shamela.ws)" /> saytından götürülür; saytımızda saxlanmır.</p>
    </div>
  );
}

// Dərs kitabları: hər fənn üçün kitab(lar) və oxuyucunu seçilmiş fəsil/səhifədə açan «Oxu».
function CourseBooksResults({ items }: { items: CourseBooksAnswerItem[] }) {
  return (
    <div className="mt-3 space-y-3" data-testid="ai-course-books">
      {items.map((item) => (
        <div key={`${item.courseId}-${item.termNumber}`} className="rounded-2xl border border-[#e3c27a]/20 bg-white/[.03] p-3">
          <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#e3c27a]">{item.courseTitle} · {courseTermLabel(item.termNumber)}</p>
          <ul className="mt-2 space-y-2">
            {item.books.filter((book) => book.available && LIBRARY_SLUG.test(book.slug)).map((book, index) => {
              const range = courseBookRange(book);
              return (
                <li key={`${book.slug}-${index}`} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#f4ead5]">{book.bookShortTitle}</p>
                    {(book.chapterTitle || range || book.note) && <p className="text-xs text-[#f4ead5]/60">{book.chapterTitle && <span dir="rtl" style={{ fontFamily: arabicFont }}>{book.chapterTitle}</span>}{book.chapterTitle && range && ' · '}{range}{book.note && <>{(book.chapterTitle || range) && ' · '}{book.note}</>}</p>}
                  </div>
                  <Link href={libraryReaderHref(book.slug, book.openPage)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#e3c27a] px-3 py-1.5 text-xs font-bold text-[#17130c] hover:bg-[#f3dca6]" data-testid={`button-ai-course-book-read-${book.slug}`}><BookOpen size={13} /> Oxu</Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

type Endpoints = { page: string; shamelaMore: string; dorarFull: string };

function ResearchResults({ sources, getToken, heading, endpoints }: { sources: ResearchSources; getToken: GetToken; heading?: boolean; endpoints: Endpoints }) {
  if (sources.kind === 'course-books') return <CourseBooksResults items={sources.items} />;
  if (sources.kind === 'library' && !heading) return <LibraryResults sources={sources} getToken={getToken} />;
  if (!sources.items.length) return null;
  if (heading) {
    return (
      <section className="mt-4">
        <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#e3c27a]">
          {sources.kind === 'shamela' ? <BookText size={13} /> : sources.kind === 'library' ? <LibraryBig size={13} /> : <ScrollText size={13} />}
          {sources.kind === 'shamela' ? 'Şamilə' : sources.kind === 'library' ? 'Kitabxana' : 'Hədis (Dorar)'} · {sources.items.length}
        </h3>
        <ResearchResults sources={sources} getToken={getToken} endpoints={endpoints} />
      </section>
    );
  }
  if (sources.kind === 'shamela') return <ShamelaResults sources={sources} getToken={getToken} pageEndpoint={endpoints.page} moreEndpoint={endpoints.shamelaMore} />;
  if (sources.kind === 'library') return <LibraryResults sources={sources} getToken={getToken} />;
  const sourceUrl = safeSourceUrl(sources.sourceUrl, 'https://dorar.net');
  return (
    <div className="mt-3 space-y-3">
      <PagedList items={sources.items} render={(item, index) => <DorarCard key={index} item={item} sourceUrl={sourceUrl} query={sources.query} getToken={getToken} fullEndpoint={endpoints.dorarFull} />} testId="ai-dorar-list" />
      <p className="text-[11px] text-[#f4ead5]/45"><SourceLink href={sourceUrl} label="Mənbə: الدرر السنية (dorar.net)" /> — canlı axtarış, saytımızda saxlanmır.</p>
    </div>
  );
}

/** Daxili cavabın kart başlığı: serverin frame-i; köhnə tarixçədə — mövzudan təxmin. */
function answerFrame(message: ChatMessage, groups: ResearchSources[]): AiFrame {
  if (message.error) return frameOf('warn', { title: 'Cavab alınmadı', tone: 'warn' });
  if (message.frame) return message.frame;
  const library = groups.find((group) => group.kind === 'library');
  if (library && library.kind === 'library') {
    const total = typeof library.total === 'number' ? library.total : library.items.length;
    return frameOf('library', { title: 'Kitabxanada axtarış', subtitle: library.query ? `«${library.query}»` : undefined, badge: library.query ? { text: total ? `${total} nəticə` : 'nəticə yoxdur', tone: total ? 'default' : 'muted' } : undefined });
  }
  if (groups.some((group) => group.kind === 'course-books')) return frameOf('book');
  return inferFrame(message.blocks, message.text);
}

function BrandTile({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const classes = size === 'lg' ? 'h-14 w-14 rounded-[18px] text-3xl sm:h-20 sm:w-20 sm:rounded-[22px] sm:text-4xl' : 'h-9 w-9 rounded-xl text-base';
  return (
    <div className={`${classes} flex items-center justify-center bg-gradient-to-br from-[#f3dca6] via-[#e3c27a] to-[#b98d3e] font-serif font-bold text-[#17130c] shadow-[0_0_40px_rgba(227,194,122,.35)]`} aria-hidden="true">
      M.
    </div>
  );
}

export function AiAssistant({ mode, backHref, backLabel, canReadLms = true }: { mode: AiAssistantMode; backHref?: string; backLabel?: string; canReadLms?: boolean }) {
  const { t } = useI18n();
  const { user } = useUser();
  const { getToken } = useAuth();
  const key = storageKey(user?.id);
  const defaultSource: SourceMode = canReadLms ? 'internal' : 'external';
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(key));
  const [source, setSource] = useState<SourcePreference>(() => loadSourcePreference(user?.id, defaultSource));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isStaff = mode === 'admin';
  // Tələbələr: «Xarici» rejim yalnız sistem sahibi açdıqda görünür (server də yoxlayır).
  const [studentExternal, setStudentExternal] = useState<{ shamela: boolean; dorar: boolean } | null>(null);
  const allowedTargets: ExternalTarget[] = isStaff
    ? ['shamela', 'dorar', 'all']
    : studentExternal?.shamela && studentExternal.dorar ? ['shamela', 'dorar', 'all'] : studentExternal?.shamela ? ['shamela'] : studentExternal?.dorar ? ['dorar'] : [];
  const showSwitch = isStaff || allowedTargets.length > 0;
  const external = showSwitch && source.mode === 'external';
  const target: ExternalTarget = allowedTargets.includes(source.target) ? source.target : allowedTargets[0] ?? 'shamela';
  const tiles = external ? externalTiles : isStaff ? adminTiles : studentTiles;
  const endpoint = isStaff ? '/api/ai/admin/chat' : '/api/ai/student/chat';
  const endpoints = useMemo<Endpoints>(() => {
    const scope = isStaff ? 'admin' : 'student';
    return { page: `/api/ai/${scope}/shamela/page`, shamelaMore: `/api/ai/${scope}/shamela/more`, dorarFull: `/api/ai/${scope}/dorar/full` };
  }, [isStaff]);

  // «Test hazırla»: yalnız server icazə verəndə (müəllim/admin + test icazəsi) düymə görünür.
  const [testBuilder, setTestBuilder] = useState<TestBuilderConfig | null>(null);
  const [testBuilderOpen, setTestBuilderOpen] = useState(false);
  useEffect(() => {
    if (!isStaff) { setTestBuilder(null); return; }
    let cancelled = false;
    void loadTestBuilderConfig(() => getToken()).then((config) => { if (!cancelled) setTestBuilder(config); });
    return () => { cancelled = true; };
  }, [isStaff, user?.id]);
  const visibleTiles: Tile[] = !external && testBuilder
    ? [{ label: 'Test hazırla', labelKey: 'aiTest' as const, hintKey: 'aiTestHint' as const, prompt: '', Icon: ClipboardCheck, action: 'test-builder' as const }, ...tiles]
    : tiles;

  async function loadStudentConfig() {
    if (isStaff) return;
    try {
      const token = await getToken().catch(() => null);
      const response = await fetch('/api/ai/student/config', { headers: token ? { authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
      const data = await response.json().catch(() => null) as { external?: { shamela?: unknown; dorar?: unknown } } | null;
      setStudentExternal(response.ok && data?.external ? { shamela: data.external.shamela === true, dorar: data.external.dorar === true } : null);
    } catch {
      setStudentExternal(null);
    }
  }

  // İstifadəçi dəyişəndə (və ya Clerk gec yüklənəndə) həmin istifadəçinin tarixçəsini və rejimini yüklə.
  useEffect(() => { setMessages(loadMessages(key)); }, [key]);
  useEffect(() => { saveMessages(key, messages); }, [key, messages]);
  useEffect(() => { setSource(loadSourcePreference(user?.id, defaultSource)); }, [user?.id, defaultSource]);
  useEffect(() => { void loadStudentConfig(); }, [isStaff, user?.id]);
  // Sürüşmə: istifadəçinin mesajı görünsün; yeni cavab gələndə isə cavabın YUXARI kənarı söhbət sahəsinin
  // yuxarısına gətirilir (aşağıya atılmır). Kartların açılması bu effekti işə salmır — orada keepAnchor işləyir.
  const lastMessage = messages[messages.length - 1];
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !lastMessage) return;
    const firstRun = scrolledFor.current === null;
    if (lastMessage.role === 'assistant') {
      if (scrolledFor.current === lastMessage.id) return;
      scrolledFor.current = lastMessage.id;
      window.requestAnimationFrame(() => {
        const element = container.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(lastMessage.id)}"]`);
        if (!element) return;
        const top = answerScrollTop({
          containerTop: container.getBoundingClientRect().top,
          elementTop: element.getBoundingClientRect().top,
          scrollTop: container.scrollTop,
          maxScrollTop: container.scrollHeight - container.clientHeight,
        });
        container.scrollTo({ top, behavior: firstRun ? 'auto' : 'smooth' });
      });
      return;
    }
    scrolledFor.current = lastMessage.id;
    window.requestAnimationFrame(() => container.scrollTo({ top: container.scrollHeight, behavior: firstRun ? 'auto' : 'smooth' }));
  }, [lastMessage?.id, lastMessage?.role, sending]);

  const lastSuggestions = useMemo(() => {
    const last = messages[messages.length - 1];
    return last?.role === 'assistant' ? last.suggestions ?? [] : [];
  }, [messages]);

  function changeSource(next: Partial<SourcePreference>) {
    setSource((current) => {
      const updated = { ...current, ...next };
      saveSourcePreference(user?.id, updated);
      return updated;
    });
  }

  async function send(text: string) {
    const message = text.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!message || sending) return;
    if (testBuilder && !external && /^test\s*haz[ıi]rla\.?$/i.test(message)) { setInput(''); setTestBuilderOpen(true); return; }
    const history = messages.slice(-HISTORY_TURNS_SENT).map((item) => ({ role: item.role, text: item.text }));
    const userMessage: ChatMessage = { id: newId(), role: 'user', text: message, at: Date.now() };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setSending(true);
    const requestMode: SourceMode = external ? 'external' : 'internal';
    try {
      const token = await getToken().catch(() => null);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(showSwitch ? { message, history, source: external ? 'external' : 'internal', target } : { message, history }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null) as { reply?: string; suggestions?: string[]; sources?: unknown; blocks?: unknown; frame?: unknown; error?: string } | null;
      if (!response.ok || !data?.reply) {
        if (response.status === 403 && external && !isStaff) void loadStudentConfig();
        throw new Error(data?.error || t('aiNoReply'));
      }
      const groups = sourceGroups(data.sources);
      const blocks = readBlocks(data.blocks);
      const frame = readFrame(data.frame);
      setMessages((current) => [...current, { id: newId(), role: 'assistant', text: data.reply as string, suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 4) : [], sources: groups.length ? groups : undefined, blocks, frame, mode: requestMode, at: Date.now() }]);
    } catch (error) {
      setMessages((current) => [...current, { id: newId(), role: 'assistant', text: error instanceof Error ? error.message : t('aiError'), error: true, mode: requestMode, at: Date.now() }]);
    } finally {
      setSending(false);
      // Telefonda klaviaturanı yenidən açmamaq üçün fokus yalnız geniş ekranda qaytarılır.
      if (typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches) inputRef.current?.focus();
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  }

  function prefill(prompt: string) {
    setInput(prompt);
    window.requestAnimationFrame(() => {
      const element = inputRef.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(prompt.length, prompt.length);
    });
  }

  function clearHistory() {
    if (!messages.length) return;
    if (typeof window !== 'undefined' && !window.confirm(t('aiClearAsk'))) return;
    setMessages([]);
    saveMessages(key, []);
  }

  const hasChat = messages.length > 0;
  const placeholder = external
    ? target === 'dorar' ? t('aiPhDorar') : target === 'all' ? t('aiPhAll') : t('aiPhShamela')
    : isStaff ? t('aiPhStaff') : t('aiPhStudent');
  const intro = external
    ? (allowedTargets.includes('all') ? t('aiIntroBoth') : target === 'dorar' ? t('aiIntroDorar') : t('aiIntroShamela'))
    : !isStaff
      ? t('aiIntroStudent')
      : t('aiIntroStaff');
  // Telefon və planşetdə (≤1024px) kartlar bir sətirlik, üfüqi sürüşən kiçik düymələrdir; yalnız böyük ekranda iri kartlar.
  const chipRow = 'flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

  return (
    <section className="relative mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden text-[#f4ead5]" data-testid={`section-ai-assistant-${mode}`} aria-label="Mədinə AI">
      <header className="relative z-20 shrink-0 px-3 pt-[max(.75rem,env(safe-area-inset-top))] sm:px-5 sm:pt-5 md:px-7">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <BrandTile size="sm" />
            <div className="min-w-0">
              <p className="font-serif text-lg leading-none text-[#f4ead5]">Mədinə <span style={{ color: gold }}>AI</span></p>
              <p className="mt-1 truncate text-[10px] uppercase tracking-[.14em] text-[#f4ead5]/55 sm:tracking-[.18em]">{isStaff ? t('aiAdmin') : t('aiStudent')} · {external ? t('aiExternal') : t('aiInternal')}</p>
            </div>
          </div>
          <div className="relative flex shrink-0 items-center gap-2">
            <LanguageSwitch tone="onDark" />
            <button type="button" onClick={() => setHelpOpen((open) => !open)} aria-expanded={helpOpen} aria-label={t('aiHelp')} className="inline-flex shrink-0 items-center justify-center rounded-full border border-[#e3c27a]/30 p-2 text-[#f4ead5]/80 transition hover:border-[#e3c27a]/70 hover:text-[#f3dca6]" data-testid="button-ai-help">
              <HelpCircle size={14} />
            </button>
            {helpOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2.5rem))] rounded-2xl border border-[#e3c27a]/35 bg-[#1c1812] p-3 text-left text-xs leading-5 text-[#f4ead5]/80 shadow-lg" data-testid="panel-ai-help">
                {intro}
              </div>
            )}
            <button type="button" onClick={clearHistory} disabled={!hasChat || sending} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e3c27a]/30 px-2.5 py-2 text-[11px] font-semibold text-[#f4ead5]/80 transition hover:border-[#e3c27a]/70 hover:text-[#f3dca6] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3" aria-label={t('aiClear')} data-testid="button-ai-clear-history">
              <Trash2 size={13} /> <span className="hidden sm:inline">{t('aiClear')}</span>
            </button>
            {backHref && (
              <Link href={backHref} className="inline-flex shrink-0 items-center justify-center rounded-full border border-[#e3c27a]/30 p-2 text-[#f4ead5]/80 transition hover:border-[#e3c27a]/70 hover:text-[#f3dca6]" aria-label={backLabel ?? t('aiBack')} data-testid="link-ai-back">
                <ArrowLeft size={14} />
              </Link>
            )}
          </div>
        </div>
        {showSwitch && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:mt-3">
            <div role="radiogroup" aria-label={t('aiSourceMode')} className="inline-flex rounded-full border border-[#e3c27a]/40 bg-black/30 p-0.5" data-testid="ai-source-switch">
              {([['internal', t('aiInternalBtn'), isStaff ? t('aiInternalTitle') : t('aiStudentData')], ['external', t('aiExternalBtn'), t('aiExternalTitle')]] as const).map(([value, label, title]) => (
                <button key={value} type="button" role="radio" aria-checked={source.mode === value} title={title} onClick={() => changeSource({ mode: value })} disabled={sending}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition sm:px-4 ${source.mode === value ? 'bg-gradient-to-br from-[#f3dca6] to-[#c49a4c] text-[#17130c] shadow-[0_0_14px_rgba(227,194,122,.3)]' : 'text-[#f4ead5]/70 hover:text-[#f3dca6]'}`}
                  data-testid={`button-ai-source-${value}`}>
                  {label}
                </button>
              ))}
            </div>
            {external && allowedTargets.length > 1 && (
              <div role="radiogroup" aria-label={t('aiExternalSource')} className="inline-flex flex-wrap gap-1" data-testid="ai-external-target">
                {allowedTargets.map((value) => (
                  <button key={value} type="button" role="radio" aria-checked={target === value} onClick={() => changeSource({ target: value })} disabled={sending}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${target === value ? 'border-[#e3c27a] bg-[#e3c27a]/15 text-[#f3dca6]' : 'border-[#e3c27a]/25 text-[#f4ead5]/65 hover:border-[#e3c27a]/60'}`}
                    data-testid={`button-ai-target-${value}`}>
                    {value === 'dorar' ? t('targetDorar') : value === 'all' ? t('targetAll') : t('targetShamela')}
                  </button>
                ))}
              </div>
            )}
            {external && allowedTargets.length === 1 && <span className="text-[11px] font-semibold text-[#f3dca6]">{allowedTargets[0] === 'dorar' ? t('targetDorar') : t('targetShamela')}</span>}
            {isStaff && !external && !canReadLms && <span className="text-[10px] text-[#f4ead5]/50">{t('aiNeedStudents')}</span>}
          </div>
        )}
      </header>

      <div ref={scrollRef} className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-3 [overflow-anchor:none] sm:px-5 sm:pb-4 sm:pt-4 md:px-7" data-testid="ai-chat-scroll" data-ai-scroll="">
        {!hasChat ? (
          <div className="relative mx-auto mt-1 flex max-w-md flex-col items-center rounded-t-[999px] border border-b-0 border-[#e3c27a]/45 bg-[linear-gradient(180deg,rgba(227,194,122,.08),rgba(0,0,0,0)_70%)] px-5 pb-5 pt-8 text-center shadow-[inset_0_0_60px_rgba(227,194,122,.06)] sm:mt-2 sm:px-6 sm:pb-8 sm:pt-14">
            {isStaff && <p className="absolute right-4 top-6 hidden max-w-[9rem] text-right font-serif text-xs italic text-[#f4ead5]/70 sm:block">“{t('aiVerse')}”<span className="mt-1 block text-[10px] not-italic text-[#f4ead5]/45">— {t('aiVerseRef')}</span></p>}
            <BrandTile />
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-[#f4ead5] sm:mt-6 sm:text-4xl">Mədinə <span style={{ color: gold }}>AI</span></h2>
            {!isStaff && <p dir="rtl" className="mt-3 max-w-xs text-[15px] font-semibold leading-8 sm:text-base" style={{ color: gold, fontFamily: arabicFont }} data-testid="text-student-hadith">مَنْ يُرِدِ اللَّهُ بِهِ خَيْرًا يُفَقِّهْهُ فِي الدِّينِ</p>}
            <img src={`${import.meta.env.BASE_URL}student-ai-books.png`} alt="" className="mt-3 h-32 w-auto sm:h-40" data-testid="img-ai-books" />
            <div className="mt-4 hidden w-full items-center gap-3 text-xs text-[#f4ead5]/80 sm:mt-5 sm:flex">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#e3c27a]/50" />
              <span>{t('aiAsk')}</span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#e3c27a]/50" />
            </div>
          </div>
        ) : (
          <ol className="space-y-4" aria-live="polite">
            {messages.map((message) => {
              const groups = message.role === 'assistant' ? sourceGroups(message.sources) : [];
              const external = message.mode === 'external' || groups.some((group) => group.kind === 'shamela' || group.kind === 'dorar');
              // Daxili cavab (tələbə və heyət): hamısı bir vahid kartın içində — başlıq, bölmələr, nəticələr.
              if (message.role === 'assistant' && !external) {
                return (
                  <li key={message.id} data-message-id={message.id} className="flex scroll-mt-2 flex-col items-start">
                    <AiAnswerCard frame={answerFrame(message, groups)} blocks={message.error ? undefined : message.blocks}>
                      {(message.error || !message.blocks) && (
                        <p dir="auto" className={`whitespace-pre-wrap break-words text-sm leading-6 ${message.error ? 'text-amber-50/90' : 'text-[#f4ead5]'}`} data-testid="ai-message-assistant">
                          <LinkifiedText text={message.text} />
                        </p>
                      )}
                      {groups.map((group, index) => <ResearchResults key={`${group.kind}-${index}`} sources={group} getToken={getToken} endpoints={endpoints} />)}
                    </AiAnswerCard>
                  </li>
                );
              }
              return (
                <li key={message.id} data-message-id={message.id} className={`flex scroll-mt-2 flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[88%] ${message.role === 'user'
                    ? 'rounded-br-md bg-gradient-to-br from-[#e3c27a] to-[#c49a4c] text-[#17130c]'
                    : message.error
                      ? 'rounded-bl-md border border-red-400/40 bg-red-950/40 text-red-100'
                      : 'rounded-bl-md border border-[#e3c27a]/20 bg-white/[.04] text-[#f4ead5]'}`} data-testid={`ai-message-${message.role}`}>
                    {message.role === 'assistant' ? <LinkifiedText text={message.text} /> : <span dir="auto">{message.text}</span>}
                  </div>
                  {groups.length > 0 && (
                    <div className="w-full">
                      {groups.map((group, index) => <ResearchResults key={`${group.kind}-${index}`} sources={group} getToken={getToken} heading={groups.length > 1} endpoints={endpoints} />)}
                    </div>
                  )}
                </li>
              );
            })}
            {sending && (
              <li className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#e3c27a]/20 bg-white/[.04] px-4 py-3 text-sm text-[#f4ead5]/70">
                  <Loader2 size={14} className="animate-spin" /> {external ? t('aiSearching') : t('aiPreparing')}
                </div>
              </li>
            )}
          </ol>
        )}
      </div>

      <div className="relative z-10 shrink-0 space-y-1.5 px-3 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1 sm:space-y-2 sm:px-5 sm:pb-3 md:px-7">
        {hasChat && lastSuggestions.length > 0 && !sending && (
          <div className={`${chipRow} min-[1025px]:flex-wrap min-[1025px]:overflow-visible`}>
            {lastSuggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => void send(suggestion)} dir="auto" className="shrink-0 whitespace-nowrap rounded-full border border-[#e3c27a]/35 bg-white/[.03] px-3 py-1.5 text-xs font-semibold text-[#f3dca6] transition hover:border-[#e3c27a]/80 hover:bg-[#e3c27a]/10">
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={onSubmit} className="flex items-end gap-2 rounded-2xl border border-[#e3c27a]/60 bg-black/40 p-2 shadow-[0_0_30px_rgba(227,194,122,.08)] focus-within:border-[#e3c27a]">
          <label htmlFor={`ai-input-${mode}`} className="sr-only">{t('aiQuestion')}</label>
          <textarea
            id={`ai-input-${mode}`}
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={placeholder}
            dir="auto"
            enterKeyHint="send"
            className="max-h-28 min-h-[3.25rem] w-full flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-[#f4ead5] outline-none placeholder:text-[#f4ead5]/45"
            data-testid="input-ai-message"
          />
          <button type="submit" disabled={!input.trim() || sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f3dca6] to-[#c49a4c] text-[#17130c] shadow-[0_0_20px_rgba(227,194,122,.35)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40" aria-label={t('aiSend')} data-testid="button-ai-send">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />}
          </button>
        </form>
        <div className={`${chipRow} min-[1025px]:grid min-[1025px]:gap-1 min-[1025px]:overflow-visible min-[1025px]:pb-0`} style={{ gridTemplateColumns: `repeat(${visibleTiles.length}, minmax(0, 1fr))` }} data-testid="ai-tiles">
          {visibleTiles.map(({ label, labelKey, hintKey, prompt, Icon, fill, action }) => (
            <button key={label} type="button" onClick={() => (action === 'test-builder' ? setTestBuilderOpen(true) : fill ? prefill(prompt) : void send(prompt))} disabled={sending} title={t(hintKey)}
              className="group flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#e3c27a]/25 bg-white/[.03] px-2 py-0.5 text-center transition hover:border-[#e3c27a]/60 hover:bg-[#e3c27a]/[.06] disabled:opacity-50 min-[1025px]:justify-center min-[1025px]:whitespace-normal min-[1025px]:rounded-lg min-[1025px]:px-1.5 min-[1025px]:py-1"
              data-testid={`button-ai-tile-${label}`}>
              <Icon size={12} style={{ color: gold }} />
              <span className="text-[10px] font-bold leading-4 text-[#f4ead5]">{t(labelKey)}</span>
            </button>
          ))}
        </div>
      </div>
      {testBuilderOpen && testBuilder && <AiTestBuilder config={testBuilder} getToken={() => getToken()} onClose={() => setTestBuilderOpen(false)} />}
    </section>
  );
}

export function AiAssistantLauncher({ href = '/ai' }: { href?: string }) {
  return (
    <Link href={href} className="fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2.5 rounded-full border border-[#e3c27a]/60 bg-[#121010] py-2 pl-2 pr-4 text-sm font-semibold text-[#f4ead5] shadow-[0_12px_40px_rgba(0,0,0,.35)] transition hover:-translate-y-0.5 hover:border-[#e3c27a]" data-testid="link-open-ai-assistant">
      <BrandTile size="sm" />
      <span>Mədinə <span style={{ color: gold }}>AI</span></span>
    </Link>
  );
}

// Telefonda klaviatura açılanda görünən sahənin hündürlüyünü izləyir (iOS Safari dvh-ni klaviaturaya görə
// kiçiltmir). Səhifə həmişə görünən sahəyə sığır: yazı sahəsi aşağıda sabit qalır, söhbət isə öz içində sürüşür.
function useVisualViewportHeight() {
  const [box, setBox] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const viewport = window.visualViewport;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const previous = meta?.getAttribute('content') ?? null;
    // Yalnız bu səhifədə: «safe-area» üçün viewport-fit=cover, Android klaviaturası üçün interactive-widget.
    if (meta && previous && !previous.includes('viewport-fit')) meta.setAttribute('content', `${previous}, viewport-fit=cover, interactive-widget=resizes-content`);
    const update = () => setBox(viewport ? { height: Math.round(viewport.height), top: Math.max(0, Math.round(viewport.offsetTop)) } : null);
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      if (meta && previous !== null) meta.setAttribute('content', previous);
    };
  }, []);
  return box;
}

// Tam ekran Mədinə AI səhifəsi (/ai). Rol yoxlaması App.tsx-dəki marşrutda aparılır.
export function AiAssistantPage({ mode, backHref, backLabel, canReadLms }: { mode: AiAssistantMode; backHref: string; backLabel?: string; canReadLms?: boolean }) {
  const viewport = useVisualViewportHeight();
  return (
    <main className="fixed inset-x-0 top-0 h-[100dvh] overflow-hidden bg-[radial-gradient(ellipse_at_top,#2a2214_0%,#121010_45%,#0a0a0b_100%)]" style={viewport ? { height: viewport.height, top: viewport.top } : undefined} data-testid={`page-ai-assistant-${mode}`}>
      <AiAssistant mode={mode} backHref={backHref} backLabel={backLabel} canReadLms={canReadLms} />
    </main>
  );
}
