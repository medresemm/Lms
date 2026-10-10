// Mədinə AI — serverin strukturlu cavab blokları (kart / siyahı / addımlar / cədvəl / mətn).
// Serverdən gələn hər şey yoxlanılır; HTML yoxdur, keçidlər yalnız https və ya saytdaxili «/…».

export type AiTone = 'default' | 'good' | 'warn' | 'muted';
export type AiRow = { label: string; value: string };
export type AiBadge = { text: string; tone?: AiTone };
export type AiItem = { title: string; detail?: string; meta?: string[]; badge?: AiBadge; action?: { label: string; href: string } };
export type AiBlock =
  | { type: 'text'; text: string; tone?: AiTone }
  | { type: 'card'; title?: string; subtitle?: string; badge?: AiBadge; rows?: AiRow[]; items?: AiItem[]; note?: string }
  | { type: 'steps'; title?: string; steps: string[]; tips?: string[] }
  | { type: 'table'; title?: string; columns: string[]; rows: string[][]; note?: string };

const MAX_BLOCKS = 24;
const MAX_LIST = 200;
const TONES: readonly AiTone[] = ['default', 'good', 'warn', 'muted'];

function str(value: unknown, max = 2000): string | undefined {
  return typeof value === 'string' && value.trim() ? value.slice(0, max) : undefined;
}

function tone(value: unknown): AiTone | undefined {
  return TONES.includes(value as AiTone) ? value as AiTone : undefined;
}

function badge(value: unknown): AiBadge | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const text = str((value as { text?: unknown }).text, 80);
  return text ? { text, tone: tone((value as { tone?: unknown }).tone) } : undefined;
}

/** Təhlükəsiz keçid: https://… və ya saytdaxili «/…» (protokolsuz «//» yox). */
export function safeBlockHref(href: unknown): { href: string; internal: boolean } | null {
  if (typeof href !== 'string' || href.length > 2000) return null;
  if (/^\/(?!\/)[^\s\\]*$/.test(href)) return { href, internal: true };
  if (/^https:\/\/[^\s\\]+$/i.test(href)) return { href, internal: false };
  return null;
}

function item(value: unknown): AiItem | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const title = str(raw.title, 300);
  if (!title) return null;
  const meta = Array.isArray(raw.meta) ? raw.meta.map((entry) => str(entry, 200)).filter((entry): entry is string => Boolean(entry)).slice(0, 6) : undefined;
  const actionRaw = raw.action as { label?: unknown; href?: unknown } | undefined;
  const actionLabel = str(actionRaw?.label, 60);
  const action = actionLabel && safeBlockHref(actionRaw?.href) ? { label: actionLabel, href: actionRaw?.href as string } : undefined;
  return { title, detail: str(raw.detail, 600), meta: meta?.length ? meta : undefined, badge: badge(raw.badge), action };
}

function block(value: unknown): AiBlock | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.type === 'text') {
    const text = str(raw.text, 4000);
    return text ? { type: 'text', text, tone: tone(raw.tone) } : null;
  }
  if (raw.type === 'card') {
    const rows = Array.isArray(raw.rows)
      ? raw.rows.map((row) => {
        const label = str((row as AiRow | null)?.label, 120);
        const rowValue = str((row as AiRow | null)?.value, 600);
        return label && rowValue ? { label, value: rowValue } : null;
      }).filter((row): row is AiRow => Boolean(row)).slice(0, 40)
      : [];
    const items = Array.isArray(raw.items) ? raw.items.map(item).filter((entry): entry is AiItem => Boolean(entry)).slice(0, MAX_LIST) : [];
    const result: AiBlock = { type: 'card', title: str(raw.title, 300), subtitle: str(raw.subtitle, 300), badge: badge(raw.badge), note: str(raw.note, 600) };
    if (rows.length) result.rows = rows;
    if (items.length) result.items = items;
    return result.title || result.rows || result.items || result.note ? result : null;
  }
  if (raw.type === 'steps') {
    const steps = Array.isArray(raw.steps) ? raw.steps.map((entry) => str(entry, 600)).filter((entry): entry is string => Boolean(entry)).slice(0, 30) : [];
    const tips = Array.isArray(raw.tips) ? raw.tips.map((entry) => str(entry, 600)).filter((entry): entry is string => Boolean(entry)).slice(0, 10) : [];
    return steps.length ? { type: 'steps', title: str(raw.title, 300), steps, tips: tips.length ? tips : undefined } : null;
  }
  if (raw.type === 'table') {
    const columns = Array.isArray(raw.columns) ? raw.columns.map((entry) => str(entry, 80) ?? '').slice(0, 8) : [];
    const rows = Array.isArray(raw.rows)
      ? raw.rows.filter(Array.isArray).map((row) => (row as unknown[]).slice(0, columns.length).map((cell) => str(cell, 300) ?? '')).slice(0, MAX_LIST)
      : [];
    return columns.length && rows.length ? { type: 'table', title: str(raw.title, 300), columns, rows, note: str(raw.note, 600) } : null;
  }
  return null;
}

/** Serverdən (və ya localStorage-dən) gələn blokları yoxlayır; yararsızdırsa undefined — onda düz mətn göstərilir. */
export function readBlocks(value: unknown): AiBlock[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const blocks = value.slice(0, MAX_BLOCKS).map(block).filter((entry): entry is AiBlock => Boolean(entry));
  return blocks.length ? blocks : undefined;
}
