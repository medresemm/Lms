// «Daha çox göstər» — siyahılar 5-5 açılır. Saf funksiyalar (testlər api-server-dən çağırır).

export const PAGE_STEP = 5;

/** Əvvəlcə göstərilən say: ən çox 5. */
export function initialShown(total: number, step = PAGE_STEP) {
  return Math.max(0, Math.min(total, step));
}

/** Düymə basılanda: daha 5 (və ya qalanların hamısı). */
export function revealMore(shown: number, total: number, step = PAGE_STEP) {
  return Math.max(0, Math.min(total, shown + step));
}

/** Hələ gizli qalan nəticələrin sayı. */
export function hiddenCount(shown: number, total: number) {
  return Math.max(0, total - Math.min(shown, total));
}

/** Düymənin yazısı: «Daha çox göstər (N)»; N məlum deyilsə (server kursoru) — «Daha çox göstər». */
export function moreLabel(hidden: number | null, labels?: { more: string; moreCount: (n: number) => string }) {
  if (hidden && hidden > 0) return labels ? labels.moreCount(hidden) : `Daha çox göstər (${hidden})`;
  return labels?.more ?? 'Daha çox göstər';
}

export function pageSlice<T>(items: readonly T[], shown: number): T[] {
  return items.slice(0, Math.max(0, shown));
}

/**
 * Siyahı vəziyyəti: yerli nəticələr (`loaded`) və serverdə ümumi say (`total`, məlum deyilsə null).
 * `needsServer` — növbəti 5-i göstərmək üçün serverdən yükləmək lazımdırmı.
 */
export function pagerState(input: { shown: number; loaded: number; total?: number | null; serverHasMore?: boolean }, step = PAGE_STEP, labels?: { more: string; moreCount: (n: number) => string }) {
  const shown = Math.min(input.shown, input.loaded);
  const knownTotal = typeof input.total === 'number' ? Math.max(input.total, input.loaded) : null;
  const hidden = knownTotal !== null ? hiddenCount(shown, knownTotal) : hiddenCount(shown, input.loaded);
  const serverMore = knownTotal !== null ? knownTotal > input.loaded : Boolean(input.serverHasMore);
  const canShowMore = shown < input.loaded || serverMore;
  return {
    shown,
    hidden: knownTotal === null && serverMore ? null : hidden,
    canShowMore,
    needsServer: shown + step > input.loaded && serverMore,
    label: moreLabel(knownTotal === null && serverMore ? null : hidden, labels),
  };
}

// ---------------------------------------------------------------------------
// Söhbət sürüşməsi

/** Yeni cavabın yuxarı kənarını söhbət sahəsinin yuxarısına gətirən scrollTop. */
export function answerScrollTop(input: { containerTop: number; elementTop: number; scrollTop: number; gap?: number; maxScrollTop?: number }) {
  const target = input.scrollTop + (input.elementTop - input.containerTop) - (input.gap ?? 8);
  const clamped = Math.max(0, target);
  return typeof input.maxScrollTop === 'number' ? Math.min(clamped, Math.max(0, input.maxScrollTop)) : clamped;
}

/** Açılma/genişlənmədən sonra lövbər elementi yerində qalsın deyə scrollTop-a əlavə ediləcək fərq. */
export function anchorCorrection(beforeTop: number, afterTop: number) {
  return Math.round(afterTop - beforeTop);
}
