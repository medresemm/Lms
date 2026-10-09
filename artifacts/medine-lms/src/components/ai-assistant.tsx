import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowLeft, BookOpen, BookText, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, Compass, Copy, ExternalLink, GraduationCap, LibraryBig, Loader2, ScrollText, Search, SendHorizontal, Trash2, UsersRound } from 'lucide-react';
import { Link } from 'wouter';
import { useAuth, useUser } from '@clerk/react';

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
  | { kind: 'dorar'; query: string; sourceUrl: string; items: DorarItem[]; error?: string };

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestions?: string[];
  sources?: ResearchSources;
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
];

const adminTiles: Tile[] = [
  { label: 'Tələbə axtar', hint: 'Ad, e-poçt, telefon, T-nömrə — səhvlə yazsanız da', prompt: 'Tələbə axtar', Icon: Search },
  { label: 'Qayıbı çox olanlar', hint: 'Davamiyyət və zəif qiymət filtrləri', prompt: 'Qayıbı çox olanlar', Icon: CalendarDays },
  { label: 'Müraciətlər', hint: 'Gözləyən müraciətlər və statuslar', prompt: 'Neçə müraciət gözləyir?', Icon: ClipboardList },
  { label: 'Ümumi statistika', hint: 'Tələbə, müəllim, tapşırıq, test sayları', prompt: 'Ümumi statistika', Icon: UsersRound },
  { label: 'Paneldən istifadə', hint: 'Bölmələr və düymələr üzrə bələdçi', prompt: 'Admin paneldən necə istifadə edim?', Icon: Compass },
  { label: 'Şamilədə axtar', hint: 'Kitab mətnləri, müəllif və cild/səhifə', prompt: 'Şamilədə axtar: ', Icon: BookText, fill: true },
  { label: 'Hədis yoxla', hint: 'Dorar: ravi, mühəddis, mənbə, hökm', prompt: 'Hədis yoxla: ', Icon: ScrollText, fill: true },
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
  return (sources.kind === 'shamela' || sources.kind === 'dorar') && Array.isArray(sources.items) && typeof sources.query === 'string';
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
      .map((item) => (item.sources && !isResearchSources(item.sources) ? { ...item, sources: undefined } : item))
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

function ShamelaCard({ item, getToken }: { item: ShamelaItem; getToken: GetToken }) {
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
      const response = await fetch('/api/ai/admin/shamela/page', {
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

function ResearchResults({ sources, getToken }: { sources: ResearchSources; getToken: GetToken }) {
  if (!sources.items.length) return null;
  if (sources.kind === 'shamela') {
    return (
      <div className="mt-3 space-y-3">
        {sources.items.map((item) => <ShamelaCard key={`${item.bookId}-${item.pageId}`} item={item} getToken={getToken} />)}
        <p className="text-[11px] text-[#f4ead5]/45">Mətnlər canlı olaraq <SourceLink href="https://shamela.ws" label="المكتبة الشاملة (shamela.ws)" /> saytından götürülür; saytımızda saxlanmır.</p>
      </div>
    );
  }
  const sourceUrl = safeSourceUrl(sources.sourceUrl, 'https://dorar.net');
  return (
    <div className="mt-3 space-y-3">
      {sources.items.map((item, index) => <DorarCard key={index} item={item} sourceUrl={sourceUrl} />)}
      <p className="text-[11px] text-[#f4ead5]/45"><SourceLink href={sourceUrl} label="Mənbə: الدرر السنية (dorar.net)" /> — canlı axtarış, saytımızda saxlanmır.</p>
    </div>
  );
}

function BrandTile({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const classes = size === 'lg' ? 'h-20 w-20 rounded-[22px] text-4xl' : 'h-9 w-9 rounded-xl text-base';
  return (
    <div className={`${classes} flex items-center justify-center bg-gradient-to-br from-[#f3dca6] via-[#e3c27a] to-[#b98d3e] font-serif font-bold text-[#17130c] shadow-[0_0_40px_rgba(227,194,122,.35)]`} aria-hidden="true">
      M.
    </div>
  );
}

export function AiAssistant({ mode, backHref, backLabel }: { mode: AiAssistantMode; backHref?: string; backLabel?: string }) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const key = storageKey(user?.id);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(key));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tiles = mode === 'admin' ? adminTiles : studentTiles;
  const endpoint = mode === 'admin' ? '/api/ai/admin/chat' : '/api/ai/student/chat';

  // İstifadəçi dəyişəndə (və ya Clerk gec yüklənəndə) həmin istifadəçinin tarixçəsini yüklə.
  useEffect(() => { setMessages(loadMessages(key)); }, [key]);
  useEffect(() => { saveMessages(key, messages); }, [key, messages]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const lastSuggestions = useMemo(() => {
    const last = messages[messages.length - 1];
    return last?.role === 'assistant' ? last.suggestions ?? [] : [];
  }, [messages]);

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
        body: JSON.stringify({ message, history }),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null) as { reply?: string; suggestions?: string[]; sources?: unknown; error?: string } | null;
      if (!response.ok || !data?.reply) {
        throw new Error(data?.error || 'Cavab almaq mümkün olmadı. Bir az sonra yenidən cəhd edin.');
      }
      setMessages((current) => [...current, { id: newId(), role: 'assistant', text: data.reply as string, suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 4) : [], sources: isResearchSources(data.sources) ? data.sources : undefined, at: Date.now() }]);
    } catch (error) {
      setMessages((current) => [...current, { id: newId(), role: 'assistant', text: error instanceof Error ? error.message : 'Xəta baş verdi.', error: true, at: Date.now() }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
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

  return (
    <section className="relative mx-auto flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden text-[#f4ead5]" data-testid={`section-ai-assistant-${mode}`} aria-label="Mədinə AI">
      <header className="relative z-10 flex items-center justify-between gap-3 px-5 pt-5 md:px-7">
        <div className="flex min-w-0 items-center gap-3">
          {backHref && (
            <Link href={backHref} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e3c27a]/30 px-3 py-2 text-[11px] font-semibold text-[#f4ead5]/80 transition hover:border-[#e3c27a]/70 hover:text-[#f3dca6]" data-testid="link-ai-back">
              <ArrowLeft size={14} /> <span className="hidden sm:inline">{backLabel ?? 'Panelə qayıt'}</span><span className="sr-only sm:hidden">{backLabel ?? 'Panelə qayıt'}</span>
            </Link>
          )}
          <BrandTile size="sm" />
          <div>
            <p className="font-serif text-lg leading-none text-[#f4ead5]">Mədinə <span style={{ color: gold }}>AI</span></p>
            <p className="mt-1 text-[10px] uppercase tracking-[.18em] text-[#f4ead5]/55">{mode === 'admin' ? 'Admin köməkçisi' : 'Tələbə köməkçisi'} · daxili</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={clearHistory} disabled={!hasChat || sending} className="inline-flex items-center gap-1.5 rounded-full border border-[#e3c27a]/30 px-3 py-2 text-[11px] font-semibold text-[#f4ead5]/80 transition hover:border-[#e3c27a]/70 hover:text-[#f3dca6] disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-ai-clear-history">
            <Trash2 size={13} /> Tarixçəni təmizlə
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-5 pb-4 pt-4 md:px-7">
        {!hasChat ? (
          <div className="relative mx-auto mt-2 flex max-w-md flex-col items-center rounded-t-[999px] border border-b-0 border-[#e3c27a]/45 bg-[linear-gradient(180deg,rgba(227,194,122,.08),rgba(0,0,0,0)_70%)] px-6 pb-8 pt-14 text-center shadow-[inset_0_0_60px_rgba(227,194,122,.06)]">
            <p className="absolute right-4 top-6 hidden max-w-[9rem] text-right font-serif text-xs italic text-[#f4ead5]/70 sm:block">“Rəbbim, elmimi artır.”<span className="mt-1 block text-[10px] not-italic text-[#f4ead5]/45">— Taha, 114</span></p>
            <BrandTile />
            <h2 className="mt-6 font-serif text-4xl font-semibold tracking-tight text-[#f4ead5]">Mədinə <span style={{ color: gold }}>AI</span></h2>
            <p className="mt-3 text-[11px] uppercase tracking-[.32em] text-[#f4ead5]/70">Sizin dini elm köməkçiniz</p>
            <div className="mt-5 flex w-full items-center gap-3 text-xs text-[#f4ead5]/80">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#e3c27a]/50" />
              <span>Sual edin · Öyrənin · Dərinləşin</span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#e3c27a]/50" />
            </div>
            <p className="mt-5 text-xs leading-5 text-[#f4ead5]/55">
              {mode === 'admin'
                ? 'Tələbələr, müəllimlər, dərslər, müraciətlər, tapşırıqlar, testlər və elanlar üzrə LMS bazasından cavab verirəm — hərf səhvlərini də başa düşürəm. Şamilə kitabxanasında və Dorar hədis bazasında da axtarıram: «Şamilədə axtar: …», «Hədis yoxla: …».'
                : 'Yalnız sizin dərsləriniz, cədvəliniz, tapşırıqlarınız və nəticələriniz əsasında cavab verirəm.'}
            </p>
          </div>
        ) : (
          <ol className="space-y-4" aria-live="polite">
            {messages.map((message) => (
              <li key={message.id} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user'
                  ? 'rounded-br-md bg-gradient-to-br from-[#e3c27a] to-[#c49a4c] text-[#17130c]'
                  : message.error
                    ? 'rounded-bl-md border border-red-400/40 bg-red-950/40 text-red-100'
                    : 'rounded-bl-md border border-[#e3c27a]/20 bg-white/[.04] text-[#f4ead5]'}`} data-testid={`ai-message-${message.role}`}>
                  {message.role === 'assistant' ? <LinkifiedText text={message.text} /> : <span dir="auto">{message.text}</span>}
                </div>
                {message.role === 'assistant' && message.sources && mode === 'admin' && (
                  <div className="w-full">
                    <ResearchResults sources={message.sources} getToken={getToken} />
                  </div>
                )}
              </li>
            ))}
            {sending && (
              <li className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#e3c27a]/20 bg-white/[.04] px-4 py-3 text-sm text-[#f4ead5]/70">
                  <Loader2 size={14} className="animate-spin" /> Hazırlanır…
                </div>
              </li>
            )}
          </ol>
        )}
      </div>

      <div className="relative z-10 space-y-3 px-5 pb-5 md:px-7">
        {hasChat && lastSuggestions.length > 0 && !sending && (
          <div className="flex flex-wrap gap-2">
            {lastSuggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => void send(suggestion)} className="rounded-full border border-[#e3c27a]/35 bg-white/[.03] px-3 py-1.5 text-xs font-semibold text-[#f3dca6] transition hover:border-[#e3c27a]/80 hover:bg-[#e3c27a]/10">
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={onSubmit} className="rounded-[22px] border border-[#e3c27a]/60 bg-black/40 p-3 shadow-[0_0_30px_rgba(227,194,122,.08)] focus-within:border-[#e3c27a]">
          <label htmlFor={`ai-input-${mode}`} className="sr-only">Mədinə AI-a sual</label>
          <textarea
            id={`ai-input-${mode}`}
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={mode === 'admin' ? 'Nə ilə kömək edim? (məs. «Hədis yoxla: إنما الأعمال بالنيات»)' : 'Nə ilə kömək edim?'}
            dir="auto"
            className="w-full resize-none bg-transparent px-2 py-1 text-sm text-[#f4ead5] outline-none placeholder:text-[#f4ead5]/45"
            data-testid="input-ai-message"
          />
          <div className="mt-1 flex items-center justify-between gap-3 px-1">
            <span className="text-[10px] text-[#f4ead5]/45">Söhbət yalnız bu brauzerdə saxlanılır.</span>
            <button type="submit" disabled={!input.trim() || sending} className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#f3dca6] to-[#c49a4c] text-[#17130c] shadow-[0_0_20px_rgba(227,194,122,.35)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Göndər" data-testid="button-ai-send">
              {sending ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={18} />}
            </button>
          </div>
        </form>
        <div className={`grid grid-cols-2 gap-2.5 ${tiles.length > 5 ? 'sm:grid-cols-4 lg:grid-cols-7' : 'sm:grid-cols-5'}`}>
          {tiles.map(({ label, hint, prompt, Icon, fill }) => (
            <button key={label} type="button" onClick={() => (fill ? prefill(prompt) : void send(prompt))} disabled={sending} className="group flex flex-col items-center rounded-2xl border border-[#e3c27a]/20 bg-white/[.03] px-3 py-3 text-center transition hover:border-[#e3c27a]/60 hover:bg-[#e3c27a]/[.06] disabled:opacity-50" data-testid={`button-ai-tile-${label}`}>
              <Icon size={20} style={{ color: gold }} />
              <span className="mt-2 text-xs font-bold text-[#f4ead5]">{label}</span>
              <span className="mt-0.5 text-[10px] leading-4 text-[#f4ead5]/55">{hint}</span>
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

// Tam ekran Mədinə AI səhifəsi (/ai). Rol yoxlaması App.tsx-dəki marşrutda aparılır.
export function AiAssistantPage({ mode, backHref, backLabel }: { mode: AiAssistantMode; backHref: string; backLabel?: string }) {
  return (
    <main className="min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,#2a2214_0%,#121010_45%,#0a0a0b_100%)]" data-testid={`page-ai-assistant-${mode}`}>
      <AiAssistant mode={mode} backHref={backHref} backLabel={backLabel} />
    </main>
  );
}
