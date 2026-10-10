import { useRef, useState, type ReactNode } from 'react';
import {
  Award, BarChart3, BookMarked, BookOpen, CalendarCheck, CalendarDays, ChevronDown, ClipboardCheck, ClipboardList, Compass, ExternalLink,
  FileCheck, FileText, Info, LibraryBig, Loader2, Megaphone, MessageCircleQuestion, Paperclip, Search, ShieldCheck, Sparkles, TriangleAlert,
  UserCheck, UserRound, UsersRound, type LucideIcon,
} from 'lucide-react';
import { Link } from 'wouter';
import { safeBlockHref, type AiBadge, type AiBlock, type AiFrame, type AiFrameIcon, type AiItem, type AiTone } from '@/lib/ai-blocks';
import { anchorCorrection, initialShown, PAGE_STEP, pagerState, revealMore } from '@/lib/paginate';

// Mədinə AI — daxili cavabların kartları (Şamilə/Dorar kartları ilə eyni üslub) və ümumi «Daha çox göstər».

const siteBase = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * Genişlənmə zamanı görünən sahə yerində qalsın: lövbər elementinin ekran mövqeyi dəyişikliyə qədər ölçülür,
 * React yeniləməsindən sonra söhbət sahəsinin scrollTop-u fərq qədər düzəldilir (Safari-də «scroll anchoring» yoxdur).
 */
export function keepAnchor(anchor: Element | null | undefined, change: () => void) {
  const container = anchor?.closest<HTMLElement>('[data-ai-scroll]');
  if (!anchor || !container) {
    change();
    return;
  }
  const before = anchor.getBoundingClientRect().top;
  change();
  window.requestAnimationFrame(() => {
    const delta = anchorCorrection(before, anchor.getBoundingClientRect().top);
    if (delta) container.scrollTop += delta;
  });
}

const BUTTON = 'inline-flex items-center gap-1.5 rounded-full border border-[#e3c27a]/35 px-4 py-1.5 text-xs font-semibold text-[#f3dca6] transition hover:bg-[#e3c27a]/10 disabled:opacity-50';

export function MoreButton({ label, onClick, loading = false, testId = 'button-ai-show-more' }: { label: string; onClick: () => void; loading?: boolean; testId?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className={BUTTON} data-testid={testId}>
      {loading ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />} {label}
    </button>
  );
}

/** Yerli siyahı: əvvəlcə 5, sonra hər basışda daha 5. */
export function PagedList<T>({ items, render, className = 'space-y-3', testId }: { items: readonly T[]; render: (item: T, index: number) => ReactNode; className?: string; testId?: string }) {
  const [shown, setShown] = useState(() => initialShown(items.length));
  const wrapper = useRef<HTMLDivElement>(null);
  const state = pagerState({ shown: Math.max(shown, initialShown(items.length)), loaded: items.length });
  return (
    <div ref={wrapper} className={className} data-testid={testId}>
      {items.slice(0, state.shown).map(render)}
      {state.canShowMore && (
        <div><MoreButton label={state.label} onClick={() => keepAnchor(wrapper.current, () => setShown((current) => revealMore(Math.max(current, PAGE_STEP), items.length)))} /></div>
      )}
    </div>
  );
}

const TONE_BADGE: Record<AiTone, string> = {
  default: 'border-[#e3c27a]/40 bg-[#e3c27a]/10 text-[#f3dca6]',
  good: 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100',
  warn: 'border-amber-300/45 bg-amber-300/10 text-amber-100',
  muted: 'border-white/15 bg-white/[.04] text-[#f4ead5]/60',
};

function Badge({ badge }: { badge: AiBadge }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONE_BADGE[badge.tone ?? 'default']}`}>{badge.text}</span>;
}

function ActionLink({ label, href }: { label: string; href: string }) {
  const safe = safeBlockHref(href);
  if (!safe) return null;
  const className = 'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#e3c27a] px-3 py-1.5 text-xs font-bold text-[#17130c] hover:bg-[#f3dca6]';
  // /api/... — qoşulma linkləri: sayt ünvanı ilə yeni pəncərədə; digər «/…» — tətbiqdaxili keçid.
  if (safe.internal && !safe.href.startsWith('/api/')) return <Link href={safe.href} className={className} data-testid="link-ai-block-action">{label}</Link>;
  return (
    <a href={safe.internal ? `${siteBase}${safe.href}` : safe.href} target="_blank" rel="noreferrer noopener" className={className} data-testid="link-ai-block-action">
      {label} <ExternalLink size={12} />
    </a>
  );
}

const ARABIC = /[\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]/;
const arabicFont = '"Amiri", "Noto Naskh Arabic", "Scheherazade New", "Traditional Arabic", "Geeza Pro", serif';

/** Ərəbcə hərf varsa: dir=auto + ərəb şrifti (bir az iri), yoxdursa adi mətn. */
function Txt({ text, className = '', as: Tag = 'p' }: { text: string; className?: string; as?: 'p' | 'span' | 'dd' }) {
  const arabic = ARABIC.test(text);
  return <Tag dir="auto" className={`${className} break-words [unicode-bidi:plaintext] ${arabic ? 'text-[1.08em] leading-8' : ''}`} style={arabic ? { fontFamily: arabicFont } : undefined}>{text}</Tag>;
}

function ItemRow({ item }: { item: AiItem }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 rounded-xl border border-[#e3c27a]/10 bg-black/15 px-3 py-2.5" data-testid="ai-block-item">
      <div className="min-w-0 flex-1 basis-[12rem]">
        <div className="flex flex-wrap items-center gap-2">
          <Txt text={item.title} className="min-w-0 text-sm font-semibold leading-6 text-[#f4ead5]" />
          {item.badge && <Badge badge={item.badge} />}
        </div>
        {item.detail && <Txt text={item.detail} className="text-[13px] leading-6 text-[#f4ead5]/75" />}
        {item.meta && (
          <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-[#f4ead5]/55">
            {item.meta.map((entry, index) => <span key={index} dir="auto">{index > 0 && <span className="mr-2 opacity-50">·</span>}{entry}</span>)}
          </p>
        )}
      </div>
      {item.action && <ActionLink label={item.action.label} href={item.action.href} />}
    </li>
  );
}

const CARD = 'rounded-2xl border border-[#e3c27a]/25 bg-white/[.035] p-4';
// Vahid kartın içində: bölmələr çərçivəsiz, aralarında incə xətt.
const SECTION = 'border-t border-[#e3c27a]/12 pt-3 first:border-t-0 first:pt-0';

function CardBlock({ block, flat = false }: { block: Extract<AiBlock, { type: 'card' }>; flat?: boolean }) {
  return (
    <section className={flat ? SECTION : CARD} data-testid="ai-block-card">
      {(block.title || block.badge) && (
        <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {block.title && <Txt text={block.title} className={`${flat ? 'text-[13.5px] tracking-[.01em]' : 'text-[15px]'} font-semibold leading-6 text-[#f3dca6]`} />}
            {block.subtitle && <Txt text={block.subtitle} className="text-xs text-[#f4ead5]/60" />}
          </div>
          {block.badge && <Badge badge={block.badge} />}
        </header>
      )}
      {block.rows && flat && (
        <dl className="divide-y divide-[#e3c27a]/10 rounded-xl border border-[#e3c27a]/10 bg-black/15 px-3 text-sm" data-testid="ai-block-rows">
          {block.rows.map((row, index) => (
            <div key={index} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
              <dt className="text-[12px] text-[#f4ead5]/60">{row.label}</dt>
              <Txt as="dd" text={row.value} className="min-w-0 text-end text-[14px] font-semibold leading-6 text-[#f4ead5]" />
            </div>
          ))}
        </dl>
      )}
      {block.rows && !flat && (
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          {block.rows.map((row, index) => (
            <div key={index} className="rounded-xl bg-black/15 px-3 py-2">
              <dt className="text-[11px] text-[#f4ead5]/55">{row.label}</dt>
              <Txt as="dd" text={row.value} className="text-[14px] font-semibold leading-6 text-[#f4ead5]" />
            </div>
          ))}
        </dl>
      )}
      {block.items && (
        <PagedList items={block.items} className={`space-y-2 ${block.rows ? 'mt-3' : ''}`} render={(item, index) => <ItemRow key={index} item={item} />} testId="ai-block-items" />
      )}
      {block.note && <Txt text={block.note} className="mt-3 text-xs leading-5 text-[#f4ead5]/55" />}
    </section>
  );
}

function StepsBlock({ block, flat = false }: { block: Extract<AiBlock, { type: 'steps' }>; flat?: boolean }) {
  return (
    <section className={flat ? SECTION : CARD} data-testid="ai-block-steps">
      {block.title && <Txt text={block.title} className="mb-2 text-[15px] font-semibold leading-6 text-[#f3dca6]" />}
      <ol className="space-y-2">
        {block.steps.map((step, index) => (
          <li key={index} className="flex gap-3 text-sm leading-6 text-[#f4ead5]">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e3c27a]/20 text-[11px] font-bold text-[#f3dca6]">{index + 1}</span>
            <Txt as="span" text={step} className="min-w-0" />
          </li>
        ))}
      </ol>
      {block.tips && (
        <ul className="mt-3 space-y-1 rounded-xl border border-[#e3c27a]/15 bg-[#e3c27a]/[.05] px-3 py-2 text-xs leading-5 text-[#f4ead5]/75">
          {block.tips.map((tip, index) => <li key={index} dir="auto">💡 {tip}</li>)}
        </ul>
      )}
    </section>
  );
}

function TableBlock({ block, flat = false }: { block: Extract<AiBlock, { type: 'table' }>; flat?: boolean }) {
  return (
    <section className={flat ? SECTION : CARD} data-testid="ai-block-table">
      {block.title && <Txt text={block.title} className="mb-2 text-[15px] font-semibold leading-6 text-[#f3dca6]" />}
      <PagedList
        items={block.rows}
        className="space-y-2"
        render={(row, index) => (
          <div key={index} className="rounded-xl bg-black/15 px-3 py-2">
            <Txt text={row[0]} className="text-sm font-semibold text-[#f4ead5]" />
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-[#f4ead5]/65">
              {row.slice(1).map((cell, cellIndex) => cell ? <span key={cellIndex}>{block.columns[cellIndex + 1]}: <span className="font-semibold text-[#f4ead5]/90">{cell}</span></span> : null)}
            </p>
          </div>
        )}
      />
      {block.note && <Txt text={block.note} className="mt-3 text-xs leading-5 text-[#f4ead5]/55" />}
    </section>
  );
}

function TextBlock({ block, flat = false }: { block: Extract<AiBlock, { type: 'text' }>; flat?: boolean }) {
  const tone = block.tone === 'warn' ? 'text-amber-100' : block.tone === 'muted' ? 'text-[#f4ead5]/60 text-xs' : block.tone === 'good' ? 'text-emerald-100' : 'text-[#f4ead5]';
  return <Txt text={block.text} className={`whitespace-pre-wrap text-sm leading-6 ${tone} ${flat && block.tone !== 'muted' ? SECTION : ''}`} />;
}

function renderBlock(block: AiBlock, index: number, flat: boolean) {
  if (block.type === 'card') return <CardBlock key={index} block={block} flat={flat} />;
  if (block.type === 'steps') return <StepsBlock key={index} block={block} flat={flat} />;
  if (block.type === 'table') return <TableBlock key={index} block={block} flat={flat} />;
  return <TextBlock key={index} block={block} flat={flat} />;
}

export function AiBlocksView({ blocks }: { blocks: AiBlock[] }) {
  return (
    <div className="w-full space-y-3" data-testid="ai-blocks">
      {blocks.map((block, index) => renderBlock(block, index, false))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vahid cavab kartı: bütün daxili cavablar (tələbə və heyət) bu kartın içində göstərilir.

export const FRAME_ICON: Record<AiFrameIcon, LucideIcon> = {
  student: UserRound, students: UsersRound, teacher: UserCheck, staff: ShieldCheck, stats: BarChart3, course: BookMarked,
  schedule: CalendarDays, grades: Award, attendance: CalendarCheck, assignment: ClipboardList, exam: ClipboardCheck,
  application: FileText, notice: Megaphone, resource: Paperclip, library: LibraryBig, book: BookOpen, guide: Compass,
  question: MessageCircleQuestion, excuse: FileCheck, search: Search, help: Sparkles, info: Info, warn: TriangleAlert,
};

export function AiAnswerCard({ frame, blocks, children, footer, testId = 'ai-answer-card' }: { frame: AiFrame; blocks?: AiBlock[]; children?: ReactNode; footer?: ReactNode; testId?: string }) {
  const Icon = FRAME_ICON[frame.icon] ?? Info;
  const warn = frame.tone === 'warn';
  // Kartın öz başlığı ilə eyni olan ilk bölmə başlığı təkrarlanmasın.
  const firstSame = (blocks ?? []).findIndex((block) => block.type !== 'text' && Boolean(block.title) && (block.title === frame.title || (Boolean(frame.subtitle) && block.title!.startsWith(frame.subtitle!))));
  const list = (blocks ?? []).map((block, index) => (index === firstSame && block.type !== 'text' ? { ...block, title: undefined } : block));
  return (
    <article
      className={`w-full max-w-full overflow-hidden rounded-2xl border shadow-[0_8px_30px_rgba(0,0,0,.18)] sm:max-w-[94%] ${warn ? 'border-amber-300/35 bg-amber-300/[.04]' : 'border-[#e3c27a]/30 bg-[linear-gradient(180deg,rgba(227,194,122,.07),rgba(255,255,255,.025)_55%)]'}`}
      data-testid={testId}
      data-frame-icon={frame.icon}
    >
      <header className={`flex items-start gap-3 border-b px-4 py-3 ${warn ? 'border-amber-300/20' : 'border-[#e3c27a]/15'}`}>
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${warn ? 'bg-amber-300/15 text-amber-100' : 'bg-[#e3c27a]/15 text-[#f3dca6]'}`} aria-hidden="true">
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <Txt text={frame.title} className={`text-[15px] font-semibold leading-6 ${warn ? 'text-amber-50' : 'text-[#f3dca6]'}`} />
          {frame.subtitle && <Txt text={frame.subtitle} className="text-xs leading-5 text-[#f4ead5]/60" />}
        </div>
        {frame.badge && <Badge badge={frame.badge} />}
      </header>
      <div className="space-y-3 px-4 py-3">
        {list.map((block, index) => renderBlock(block, index, true))}
        {children}
      </div>
      {footer && <footer className="flex flex-wrap items-center gap-2 border-t border-[#e3c27a]/12 px-4 py-2.5">{footer}</footer>}
    </article>
  );
}
