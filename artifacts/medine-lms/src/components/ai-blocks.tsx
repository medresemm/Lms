import { useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { safeBlockHref, type AiBadge, type AiBlock, type AiItem, type AiTone } from '@/lib/ai-blocks';
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

function ItemRow({ item }: { item: AiItem }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-xl border border-[#e3c27a]/10 bg-black/15 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p dir="auto" className="min-w-0 text-sm font-semibold leading-6 text-[#f4ead5]">{item.title}</p>
          {item.badge && <Badge badge={item.badge} />}
        </div>
        {item.detail && <p dir="auto" className="text-[13px] leading-6 text-[#f4ead5]/75">{item.detail}</p>}
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

function CardBlock({ block }: { block: Extract<AiBlock, { type: 'card' }> }) {
  return (
    <article className={CARD} data-testid="ai-block-card">
      {(block.title || block.badge) && (
        <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {block.title && <p dir="auto" className="text-[15px] font-semibold leading-6 text-[#f3dca6]">{block.title}</p>}
            {block.subtitle && <p dir="auto" className="text-xs text-[#f4ead5]/60">{block.subtitle}</p>}
          </div>
          {block.badge && <Badge badge={block.badge} />}
        </header>
      )}
      {block.rows && (
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          {block.rows.map((row, index) => (
            <div key={index} className="rounded-xl bg-black/15 px-3 py-2">
              <dt className="text-[11px] text-[#f4ead5]/55">{row.label}</dt>
              <dd dir="auto" className="text-[14px] font-semibold leading-6 text-[#f4ead5]">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {block.items && (
        <PagedList items={block.items} className={`space-y-2 ${block.rows ? 'mt-3' : ''}`} render={(item, index) => <ItemRow key={index} item={item} />} testId="ai-block-items" />
      )}
      {block.note && <p dir="auto" className="mt-3 text-xs leading-5 text-[#f4ead5]/55">{block.note}</p>}
    </article>
  );
}

function StepsBlock({ block }: { block: Extract<AiBlock, { type: 'steps' }> }) {
  return (
    <article className={CARD} data-testid="ai-block-steps">
      {block.title && <p dir="auto" className="mb-2 text-[15px] font-semibold leading-6 text-[#f3dca6]">{block.title}</p>}
      <ol className="space-y-2">
        {block.steps.map((step, index) => (
          <li key={index} className="flex gap-3 text-sm leading-6 text-[#f4ead5]">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e3c27a]/20 text-[11px] font-bold text-[#f3dca6]">{index + 1}</span>
            <span dir="auto">{step}</span>
          </li>
        ))}
      </ol>
      {block.tips && (
        <ul className="mt-3 space-y-1 rounded-xl border border-[#e3c27a]/15 bg-[#e3c27a]/[.05] px-3 py-2 text-xs leading-5 text-[#f4ead5]/75">
          {block.tips.map((tip, index) => <li key={index} dir="auto">💡 {tip}</li>)}
        </ul>
      )}
    </article>
  );
}

function TableBlock({ block }: { block: Extract<AiBlock, { type: 'table' }> }) {
  return (
    <article className={CARD} data-testid="ai-block-table">
      {block.title && <p dir="auto" className="mb-2 text-[15px] font-semibold leading-6 text-[#f3dca6]">{block.title}</p>}
      <PagedList
        items={block.rows}
        className="space-y-2"
        render={(row, index) => (
          <div key={index} className="rounded-xl bg-black/15 px-3 py-2">
            <p dir="auto" className="text-sm font-semibold text-[#f4ead5]">{row[0]}</p>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-[#f4ead5]/65">
              {row.slice(1).map((cell, cellIndex) => cell ? <span key={cellIndex}>{block.columns[cellIndex + 1]}: <span className="font-semibold text-[#f4ead5]/90">{cell}</span></span> : null)}
            </p>
          </div>
        )}
      />
      {block.note && <p dir="auto" className="mt-3 text-xs leading-5 text-[#f4ead5]/55">{block.note}</p>}
    </article>
  );
}

function TextBlock({ block }: { block: Extract<AiBlock, { type: 'text' }> }) {
  const tone = block.tone === 'warn' ? 'text-amber-100' : block.tone === 'muted' ? 'text-[#f4ead5]/60 text-xs' : block.tone === 'good' ? 'text-emerald-100' : 'text-[#f4ead5]';
  return <p dir="auto" className={`whitespace-pre-wrap break-words text-sm leading-6 ${tone}`}>{block.text}</p>;
}

export function AiBlocksView({ blocks }: { blocks: AiBlock[] }) {
  return (
    <div className="w-full space-y-3" data-testid="ai-blocks">
      {blocks.map((block, index) => {
        if (block.type === 'card') return <CardBlock key={index} block={block} />;
        if (block.type === 'steps') return <StepsBlock key={index} block={block} />;
        if (block.type === 'table') return <TableBlock key={index} block={block} />;
        return <TextBlock key={index} block={block} />;
      })}
    </div>
  );
}
