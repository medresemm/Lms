import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowLeft, BookOpen, BookText, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, Compass, Copy, ExternalLink, GraduationCap, LibraryBig, Loader2, ScrollText, Search, SendHorizontal, Trash2, UsersRound } from 'lucide-react';
import { Link } from 'wouter';
import { useAuth, useUser } from '@clerk/react';
import { DidYouMean, LibraryHitList } from '@/components/library-search-results';
import { searchLibraryApi, type LibraryChapterSuggestion, type LibrarySearchItem } from '@/lib/library';

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


type DorarItem = { text: string; narrator: string; muhaddith: string; source: string; page: string; grading: string };

// Şamilə / Dorar nəticələri: serverdə düz mətnə çevrilib gəlir, burada yalnız mətn kimi göstərilir (xam HTML yoxdur).
type ResearchSources =
  | { kind: 'shamela'; query: string; sourceUrl: string; items: ShamelaItem[]; error?: string }
  | { kind: 'dorar'; query: string; sourceUrl: string; items: DorarItem[]; error?: string }
  | {
    kind: 'library';
    query: string;
    items: LibrarySearchItem[];
    total?: number;
    book?: string | null;
    expanded?: string[];
    didYouMean?: LibraryChapterSuggestion[];
  };

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestions?: string[];
  /** Köhnə mesajlarda tək obyekt, yenilərində qrup massivi. */
  sources?: ResearchSources | ResearchSources[];
  error?: boolean;
  at: number;
};

type Tile = { label: string; hint: string; prompt: string; Icon: typeof BookOpen; fill?: boolean };

const STORAGE_PREFIX = 'medine-ai-chat:';
const MAX_STORED_MESSAGES = 100;
const HISTORY_TURNS_SENT = 6;
const MAX_MESSAGE_LENGTH = 1000;

const studentTiles: Tile[] = [
  { label: 'Dərs cədvəlim', hint: 'Həftəlik dərs günləri və saatlar', prompt: 'Dərs cədvəlim', Icon: CalendarDays },
  { label: 'Tapşırıqlarım', hint: 'Açıq ev tapşırıqları və son tarixlər', prompt: 'Tapşırıqlarım', Icon: ClipboardList },
  { label: 'Qiymətlərim', hint: 'Fənn qiymətləri və orta bal', prompt: 'Qiymətlərim', Icon: GraduationCap },
  { label: 'Resurslar', hint: 'Dərs materialları və linklər', prompt: 'Resurslar', Icon: LibraryBig },
  { label: 'Saytdan istifadə', hint: 'Hansı düymə harada, addım-addım', prompt: 'Saytdan necə istifadə edim?', Icon: Compass },
  { label: 'Kitabxana', hint: 'Ərəbcə və ya mövzu: dəstəmaz, fail…', prompt: 'Kitabxanada axtar: ', Icon: BookText, fill: true },
];

const adminTiles: Tile[] = [
  { label: 'Tələbə axtar', hint: 'Ad, e-poçt, telefon, T-nömrə — səhvlə yazsanız da', prompt: 'Tələbə axtar', Icon: Search },
  { label: 'Qayıbı çox olanlar', hint: 'Davamiyyət və zəif qiymət filtrləri', prompt: 'Qayıbı çox olanlar', Icon: CalendarDays },
  { label: 'Müraciətlər', hint: 'Gözləyən müraciətlər və statuslar', prompt: 'Neçə müraciət gözləyir?', Icon: ClipboardList },
  { label: 'Ümumi statistika', hint: 'Tələbə, müəllim, tapşırıq, test sayları', prompt: 'Ümumi statistika', Icon: UsersRound },
  { label: 'Paneldən istifadə', hint: 'Bölmələr və düymələr üzrə bələdçi', prompt: 'Admin paneldən necə istifadə edim?', Icon: Compass },
  { label: 'Kitabxana', hint: 'Ərəbcə və ya mövzu: dəstəmaz, fail…', prompt: 'Kitabxanada axtar: ', Icon: BookText, fill: true },
];

// «Xarici» rejimdə nümunə sorğular (seçilmiş mənbədə axtarılır).
const externalTiles: Tile[] = [
  { label: 'Niyyət hədisi', hint: 'إنما الأعمال بالنيات', prompt: 'إنما الأعمال بالنيات', Icon: ScrollText },
  { label: 'Elm tələbi', hint: 'طلب العلم فريضة', prompt: 'طلب العلم فريضة', Icon: BookText },
  { label: 'Səbr', hint: 'فضل الصبر', prompt: 'فضل الصبر', Icon: BookOpen },
  { label: 'Valideynə hörmət', hint: 'بر الوالدين', prompt: 'بر الوالدين', Icon: LibraryBig },
  { label: 'Öz sorğum', hint: 'Ərəbcə açar söz yazın', prompt: '', Icon: Search, fill: true },
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
  return (sources.kind === 'shamela' || sources.kind === 'dorar' || sources.kind === 'library') && Array.isArray(sources.items) && typeof sources.query === 'string';
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

const TARGET_LABELS: Record<ExternalTarget, string> = { shamela: 'Şamilə', dorar: 'Hədis (Dorar)', all: 'Hamısı' };

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
      setPage({ ...data.page, title: data.page.title || item.title, author: data.page.author || item.author });
      setFull(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Səhifəni açmaq mümkün olmadı.');
    } finally {
      setLoading(false);
    }
  }

  const url = safeSourceUrl(page.url, 'https://shamela.ws/search');
  const citation = [page.title, page.author].filter(Boolean).join(' — ') + (page.label ? ` (${page.label})` : '');
  return (
    <article className="rounded-2xl border border-[#e3c27a]/25 bg-white/[.035] p-4" data-testid="ai-source-shamela">
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
      {error && <p className="mt-2 text-xs text-red-200">{error}</p>}
      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={loading || !page.prevPageId} onClick={() => page.prevPageId && void open(page.prevPageId)} className="inline-flex items-center gap-1 rounded-full border border-[#e3c27a]/30 px-2.5 py-1 text-[11px] font-semibold text-[#f4ead5]/80 transition hover:border-[#e3c27a]/70 disabled:opacity-35" data-testid="button-shamela-prev">
            <ChevronLeft size={12} /> Əvvəlki səhifə
          </button>
          <button type="button" disabled={loading} onClick={() => void open(page.pageId)} className="inline-flex items-center gap-1 rounded-full border border-[#e3c27a]/50 bg-[#e3c27a]/10 px-3 py-1 text-[11px] font-bold text-[#f3dca6] transition hover:bg-[#e3c27a]/20 disabled:opacity-50" data-testid="button-shamela-full">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />} {full ? 'Yenilə' : 'Tam səhifə'}
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

function DorarCard({ item, sourceUrl }: { item: DorarItem; sourceUrl: string }) {
  const copyText = [item.text, '', ...DORAR_FIELDS.filter(([key]) => item[key]).map(([key, , arabic]) => `${arabic}: ${item[key]}`), '', `— الدرر السنية: ${sourceUrl}`].join('\n');
  return (
    <article className="rounded-2xl border border-[#e3c27a]/25 bg-white/[.035] p-4" data-testid="ai-source-dorar">
      <div className="mb-3 flex justify-end"><CopyButton text={copyText} /></div>
      <SourceText text={item.text} />
      <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        {DORAR_FIELDS.map(([key, label, arabic]) => item[key] ? (
          <div key={key} className={key === 'grading' ? 'sm:col-span-2 rounded-xl border border-[#e3c27a]/30 bg-[#e3c27a]/[.07] px-3 py-2' : ''}>
            <dt className="text-[11px] text-[#f4ead5]/50">{label} · <span dir="rtl" style={{ fontFamily: arabicFont }}>{arabic}</span></dt>
            <dd dir="auto" className={`${key === 'grading' ? 'font-semibold text-[#f3dca6]' : 'text-[#f4ead5]'} text-[15px] leading-7`} style={{ fontFamily: arabicFont }}>{item[key]}</dd>
          </div>
        ) : null)}
      </dl>
    </article>
  );
}

function LibraryResults({ sources, getToken }: { sources: Extract<ResearchSources, { kind: 'library' }>; getToken: GetToken }) {
  const [items, setItems] = useState<LibrarySearchItem[]>(sources.items);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const total = typeof sources.total === 'number' ? sources.total : sources.items.length;
  const didYouMean = Array.isArray(sources.didYouMean) ? sources.didYouMean : [];
  if (!items.length && !didYouMean.length) return null;

  async function loadMore() {
    setLoadingMore(true);
    setMoreError(null);
    try {
      const data = await searchLibraryApi(getToken, { query: sources.query, offset: items.length, book: sources.book ?? null });
      setItems((current) => {
        const seen = new Set(current.map((item) => `${item.slug}-${item.page}-${item.match ?? 'text'}`));
        return [...current, ...data.items.filter((item) => !seen.has(`${item.slug}-${item.page}-${item.match ?? 'text'}`))];
      });
    } catch (error) {
      setMoreError(error instanceof Error ? error.message : 'Axtarış alınmadı.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="mt-3 space-y-3" data-testid="ai-library-results">
      {items.length > 0 && <LibraryHitList items={items} tone="dark" />}
      <DidYouMean suggestions={didYouMean} tone="dark" />
      {items.length > 0 && items.length < total && (
        <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="inline-flex items-center gap-2 rounded-full border border-[#e3c27a]/35 px-4 py-1.5 text-xs font-semibold text-[#f3dca6] transition hover:bg-[#e3c27a]/10 disabled:opacity-50" data-testid="button-ai-library-more">
          {loadingMore ? <Loader2 size={13} className="animate-spin" /> : <ChevronRight size={13} className="rotate-90" />} Daha çox ({items.length}/{total})
        </button>
      )}
      {moreError && <p className="text-xs text-red-200">{moreError}</p>}
      <p className="text-[11px] text-[#f4ead5]/45">Axtarış skan mətninə (OCR) əsaslanır — kiçik xətalar ola bilər; dəqiq mətni kitabın özündə yoxlayın.</p>
    </div>
  );
}

function ResearchResults({ sources, getToken, heading, pageEndpoint }: { sources: ResearchSources; getToken: GetToken; heading?: boolean; pageEndpoint: string }) {
  if (sources.kind === 'library' && !heading) return <LibraryResults sources={sources} getToken={getToken} />;
  if (!sources.items.length) return null;
  if (heading) {
    return (
      <section className="mt-4">
        <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#e3c27a]">
          {sources.kind === 'shamela' ? <BookText size={13} /> : sources.kind === 'library' ? <LibraryBig size={13} /> : <ScrollText size={13} />}
          {sources.kind === 'shamela' ? 'Şamilə' : sources.kind === 'library' ? 'Kitabxana' : 'Hədis (Dorar)'} · {sources.items.length}
        </h3>
        <ResearchResults sources={sources} getToken={getToken} pageEndpoint={pageEndpoint} />
      </section>
    );
  }
  if (sources.kind === 'shamela') {
    return (
      <div className="mt-3 space-y-3">
        {sources.items.map((item) => <ShamelaCard key={`${item.bookId}-${item.pageId}`} item={item} getToken={getToken} pageEndpoint={pageEndpoint} />)}
        <p className="text-[11px] text-[#f4ead5]/45">Mətnlər canlı olaraq <SourceLink href="https://shamela.ws" label="المكتبة الشاملة (shamela.ws)" /> saytından götürülür; saytımızda saxlanmır.</p>
      </div>
    );
  }
  if (sources.kind === 'library') return <LibraryResults sources={sources} getToken={getToken} />;
  const sourceUrl = safeSourceUrl(sources.sourceUrl, 'https://dorar.net');
  return (
    <div className="mt-3 space-y-3">
      {sources.items.map((item, index) => <DorarCard key={index} item={item} sourceUrl={sourceUrl} />)}
      <p className="text-[11px] text-[#f4ead5]/45"><SourceLink href={sourceUrl} label="Mənbə: الدرر السنية (dorar.net)" /> — canlı axtarış, saytımızda saxlanmır.</p>
    </div>
  );
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
  const { user } = useUser();
  const { getToken } = useAuth();
  const key = storageKey(user?.id);
  const defaultSource: SourceMode = canReadLms ? 'internal' : 'external';
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(key));
  const [source, setSource] = useState<SourcePreference>(() => loadSourcePreference(user?.id, defaultSource));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
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
  const pageEndpoint = isStaff ? '/api/ai/admin/shamela/page' : '/api/ai/student/shamela/page';

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
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

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
    const history = messages.slice(-HISTORY_TURNS_SENT).map((item) => ({ role: item.role, text: item.text }));
    const userMessage: ChatMessage = { id: newId(), role: 'user', text: message, at: Date.now() };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setSending(true);
    try {
      const token = await getToken().catch(() => null);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(showSwitch ? { message, history, source: external ? 'external' : 'internal', target } : { message, history }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null) as { reply?: string; suggestions?: string[]; sources?: unknown; error?: string } | null;
      if (!response.ok || !data?.reply) {
        if (response.status === 403 && external && !isStaff) void loadStudentConfig();
        throw new Error(data?.error || 'Cavab almaq mümkün olmadı. Bir az sonra yenidən cəhd edin.');
      }
      const groups = sourceGroups(data.sources);
      setMessages((current) => [...current, { id: newId(), role: 'assistant', text: data.reply as string, suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 4) : [], sources: groups.length ? groups : undefined, at: Date.now() }]);
    } catch (error) {
      setMessages((current) => [...current, { id: newId(), role: 'assistant', text: error instanceof Error ? error.message : 'Xəta baş verdi.', error: true, at: Date.now() }]);
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
    if (typeof window !== 'undefined' && !window.confirm('Söhbət tarixçəsi bu brauzerdən silinsin?')) return;
    setMessages([]);
    saveMessages(key, []);
  }

  const hasChat = messages.length > 0;
  const placeholder = external
    ? target === 'dorar' ? 'Hədis mətnindən bir hissə yazın (ərəbcə)…' : target === 'all' ? 'Şamilə və Dorar-da axtarış (ərəbcə)…' : 'Şamilədə axtarış (ərəbcə açar söz)…'
    : isStaff ? 'Akademiya üzrə sual verin…' : 'Nə ilə kömək edim?';
  const intro = external
    ? `Xarici rejim: yazdığınızı yalnız ${allowedTargets.includes('all') ? 'Şamilə kitabxanasında və/və ya Dorar hədis bazasında' : target === 'dorar' ? 'Dorar hədis bazasında' : 'Şamilə kitabxanasında'} axtarıram. Akademiya ${isStaff ? 'məlumatlarına' : 'məlumatlarınıza'} baxılmır. Mətnlər burada göstərilir, saytda saxlanmır.`
    : !isStaff
      ? 'Yalnız sizin dərsləriniz, cədvəliniz, tapşırıqlarınız və nəticələriniz əsasında cavab verirəm. Kitabxanadakı kitablarda axtarmaq üçün ərəbcə yazın və ya mövzunu deyin: «dəstəmazı pozan şeylər», «Tuhfədə fail».'
      : 'Daxili rejim: tələbələr, müəllimlər, dərslər, müraciətlər, tapşırıqlar, testlər və elanlar üzrə yalnız Akademiya bazasından cavab verirəm — hərf səhvlərini də başa düşürəm. Kitabxanada axtarmaq üçün ərəbcə yazın və ya mövzunu deyin: «dəstəmazı pozan şeylər», «Tuhfədə fail».';
  // Telefon və planşetdə (≤1024px) kartlar bir sətirlik, üfüqi sürüşən kiçik düymələrdir; yalnız böyük ekranda iri kartlar.
  const chipRow = 'flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

  return (
    <section className="relative mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden text-[#f4ead5]" data-testid={`section-ai-assistant-${mode}`} aria-label="Mədinə AI">
      <header className="relative z-10 shrink-0 px-3 pt-[max(.75rem,env(safe-area-inset-top))] sm:px-5 sm:pt-5 md:px-7">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {backHref && (
              <Link href={backHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e3c27a]/30 px-2.5 py-2 text-[11px] font-semibold text-[#f4ead5]/80 transition hover:border-[#e3c27a]/70 hover:text-[#f3dca6] sm:px-3" data-testid="link-ai-back">
                <ArrowLeft size={14} /> <span className="hidden sm:inline">{backLabel ?? 'Panelə qayıt'}</span><span className="sr-only sm:hidden">{backLabel ?? 'Panelə qayıt'}</span>
              </Link>
            )}
            <BrandTile size="sm" />
            <div className="min-w-0">
              <p className="font-serif text-lg leading-none text-[#f4ead5]">Mədinə <span style={{ color: gold }}>AI</span></p>
              <p className="mt-1 truncate text-[10px] uppercase tracking-[.14em] text-[#f4ead5]/55 sm:tracking-[.18em]">{isStaff ? 'Admin köməkçisi' : 'Tələbə köməkçisi'} · {external ? 'xarici' : 'daxili'}</p>
            </div>
          </div>
          <button type="button" onClick={clearHistory} disabled={!hasChat || sending} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e3c27a]/30 px-2.5 py-2 text-[11px] font-semibold text-[#f4ead5]/80 transition hover:border-[#e3c27a]/70 hover:text-[#f3dca6] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3" aria-label="Tarixçəni təmizlə" data-testid="button-ai-clear-history">
            <Trash2 size={13} /> <span className="hidden sm:inline">Tarixçəni təmizlə</span>
          </button>
        </div>
        {showSwitch && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:mt-3">
            <div role="radiogroup" aria-label="Mənbə rejimi" className="inline-flex rounded-full border border-[#e3c27a]/40 bg-black/30 p-0.5" data-testid="ai-source-switch">
              {([['internal', 'Daxili', isStaff ? 'Yalnız Akademiya məlumatları' : 'Yalnız sizin Akademiya məlumatlarınız'], ['external', 'Xarici', 'Yalnız xarici mənbələr: Şamilə, Dorar']] as const).map(([value, label, title]) => (
                <button key={value} type="button" role="radio" aria-checked={source.mode === value} title={title} onClick={() => changeSource({ mode: value })} disabled={sending}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition sm:px-4 ${source.mode === value ? 'bg-gradient-to-br from-[#f3dca6] to-[#c49a4c] text-[#17130c] shadow-[0_0_14px_rgba(227,194,122,.3)]' : 'text-[#f4ead5]/70 hover:text-[#f3dca6]'}`}
                  data-testid={`button-ai-source-${value}`}>
                  {label}
                </button>
              ))}
            </div>
            {external && allowedTargets.length > 1 && (
              <div role="radiogroup" aria-label="Xarici mənbə" className="inline-flex flex-wrap gap-1" data-testid="ai-external-target">
                {allowedTargets.map((value) => (
                  <button key={value} type="button" role="radio" aria-checked={target === value} onClick={() => changeSource({ target: value })} disabled={sending}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${target === value ? 'border-[#e3c27a] bg-[#e3c27a]/15 text-[#f3dca6]' : 'border-[#e3c27a]/25 text-[#f4ead5]/65 hover:border-[#e3c27a]/60'}`}
                    data-testid={`button-ai-target-${value}`}>
                    {TARGET_LABELS[value]}
                  </button>
                ))}
              </div>
            )}
            {external && allowedTargets.length === 1 && <span className="text-[11px] font-semibold text-[#f3dca6]">{TARGET_LABELS[allowedTargets[0]]}</span>}
            {isStaff && !external && !canReadLms && <span className="text-[10px] text-[#f4ead5]/50">Akademiya məlumatları üçün «Tələbələr» icazəsi lazımdır.</span>}
          </div>
        )}
      </header>

      <div ref={scrollRef} className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4 md:px-7" data-testid="ai-chat-scroll">
        {!hasChat ? (
          <div className="relative mx-auto mt-1 flex max-w-md flex-col items-center rounded-t-[999px] border border-b-0 border-[#e3c27a]/45 bg-[linear-gradient(180deg,rgba(227,194,122,.08),rgba(0,0,0,0)_70%)] px-5 pb-5 pt-8 text-center shadow-[inset_0_0_60px_rgba(227,194,122,.06)] sm:mt-2 sm:px-6 sm:pb-8 sm:pt-14">
            <p className="absolute right-4 top-6 hidden max-w-[9rem] text-right font-serif text-xs italic text-[#f4ead5]/70 sm:block">“Rəbbim, elmimi artır.”<span className="mt-1 block text-[10px] not-italic text-[#f4ead5]/45">— Taha, 114</span></p>
            <BrandTile />
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-[#f4ead5] sm:mt-6 sm:text-4xl">Mədinə <span style={{ color: gold }}>AI</span></h2>
            <p className="mt-2 text-[10px] uppercase tracking-[.28em] text-[#f4ead5]/70 sm:mt-3 sm:text-[11px] sm:tracking-[.32em]">Sizin dini elm köməkçiniz</p>
            <div className="mt-4 hidden w-full items-center gap-3 text-xs text-[#f4ead5]/80 sm:mt-5 sm:flex">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#e3c27a]/50" />
              <span>Sual edin · Öyrənin · Dərinləşin</span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#e3c27a]/50" />
            </div>
            <p className="mt-3 text-xs leading-5 text-[#f4ead5]/55 sm:mt-5">{intro}</p>
          </div>
        ) : (
          <ol className="space-y-4" aria-live="polite">
            {messages.map((message) => {
              const groups = message.role === 'assistant' ? sourceGroups(message.sources) : [];
              return (
                <li key={message.id} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[88%] ${message.role === 'user'
                    ? 'rounded-br-md bg-gradient-to-br from-[#e3c27a] to-[#c49a4c] text-[#17130c]'
                    : message.error
                      ? 'rounded-bl-md border border-red-400/40 bg-red-950/40 text-red-100'
                      : 'rounded-bl-md border border-[#e3c27a]/20 bg-white/[.04] text-[#f4ead5]'}`} data-testid={`ai-message-${message.role}`}>
                    {message.role === 'assistant' ? <LinkifiedText text={message.text} /> : <span dir="auto">{message.text}</span>}
                  </div>
                  {groups.length > 0 && (
                    <div className="w-full">
                      {groups.map((group, index) => <ResearchResults key={`${group.kind}-${index}`} sources={group} getToken={getToken} heading={groups.length > 1} pageEndpoint={pageEndpoint} />)}
                    </div>
                  )}
                </li>
              );
            })}
            {sending && (
              <li className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#e3c27a]/20 bg-white/[.04] px-4 py-3 text-sm text-[#f4ead5]/70">
                  <Loader2 size={14} className="animate-spin" /> {external ? 'Xarici mənbələrdə axtarılır…' : 'Hazırlanır…'}
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
          <label htmlFor={`ai-input-${mode}`} className="sr-only">Mədinə AI-a sual</label>
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
          <button type="submit" disabled={!input.trim() || sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f3dca6] to-[#c49a4c] text-[#17130c] shadow-[0_0_20px_rgba(227,194,122,.35)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Göndər" data-testid="button-ai-send">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />}
          </button>
        </form>
        <div className={`${chipRow} min-[1025px]:grid min-[1025px]:gap-1 min-[1025px]:overflow-visible min-[1025px]:pb-0`} style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }} data-testid="ai-tiles">
          {tiles.map(({ label, hint, prompt, Icon, fill }) => (
            <button key={label} type="button" onClick={() => (fill ? prefill(prompt) : void send(prompt))} disabled={sending} title={hint}
              className="group flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#e3c27a]/25 bg-white/[.03] px-2 py-0.5 text-center transition hover:border-[#e3c27a]/60 hover:bg-[#e3c27a]/[.06] disabled:opacity-50 min-[1025px]:justify-center min-[1025px]:whitespace-normal min-[1025px]:rounded-lg min-[1025px]:px-1.5 min-[1025px]:py-1"
              data-testid={`button-ai-tile-${label}`}>
              <Icon size={12} style={{ color: gold }} />
              <span className="text-[10px] font-bold leading-4 text-[#f4ead5]">{label}</span>
            </button>
          ))}
        </div>
      </div>
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
