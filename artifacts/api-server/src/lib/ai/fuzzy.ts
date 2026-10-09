// Mədinə AI üçün səhvlərə dözümlü (fuzzy) axtarış köməkçiləri.
//
// - Mətn normallaşdırılır (ə→e, ı→i, ş→s, ç→c, ğ→g, ö→o, ü→u, kiril → latın), böyük/kiçik hərf fərqi yoxdur.
// - Sözlərin sırası vacib deyil («Aliyev Mahir» = «Mahir Aliyev»), natamam yazılış (prefiks) qəbul olunur.
// - Hərf səhvləri Damerau-Levenshtein (OSA) məsafəsi ilə, rus/latın yazılış variantları («Mamedov» ~ «Məmmədov»,
//   «Kuliyev» ~ «Quliyev») isə fonetik açarla tutulur.
import { normalizeText, tokenize } from "./text.js";

/** Optimal String Alignment (məhdud Damerau-Levenshtein) məsafəsi. */
export function editDistance(a: string, b: string, max = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prevPrev = new Array<number>(cols).fill(0);
  let prev = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i += 1) {
    const current = new Array<number>(cols).fill(0);
    current[0] = i;
    let rowMin = current[0];
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j] + 1, current[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, prevPrev[j - 2] + 1);
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    prevPrev = prev;
    prev = current;
  }
  return prev[cols - 1];
}

/** Rus/latın yazılış variantlarını eyniləşdirən fonetik açar. */
export function phoneticKey(token: string) {
  return token
    .replace(/kh/g, "h").replace(/x/g, "h")
    .replace(/sh/g, "s").replace(/ch/g, "c").replace(/zh/g, "j").replace(/gh/g, "g")
    .replace(/q/g, "k").replace(/w/g, "v").replace(/y/g, "i")
    .replace(/e/g, "a")
    .replace(/(.)\1+/g, "$1");
}

/** Söz uzunluğuna görə icazə verilən hərf səhvi sayı. */
export function allowedTypos(length: number) {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 8) return 2;
  return 3;
}

function compareTokens(query: string, candidate: string) {
  if (candidate === query) return 1;
  if (query.length >= 2 && candidate.startsWith(query)) return query.length >= 3 ? 0.92 : 0.75;
  // Şəkilçili yazılış: «Əlinin» → «Əli», «Məmmədovun» → «Məmmədov».
  if (candidate.length >= 3 && query.startsWith(candidate) && query.length - candidate.length <= 4) return 0.85;
  const allowed = allowedTypos(query.length);
  if (!allowed) return 0;
  let best = editDistance(query, candidate, allowed);
  // Natamam yazılmış söz: sorğunu namizədin eyni uzunluqlu başlanğıcı ilə müqayisə et.
  if (candidate.length > query.length) {
    for (const length of [query.length - 1, query.length, query.length + 1]) {
      if (length < 3 || length > candidate.length) continue;
      best = Math.min(best, editDistance(query, candidate.slice(0, length), allowed) + 0.25);
    }
  }
  if (best > allowed) return 0;
  return Math.max(0.5, 0.88 - 0.12 * best);
}

/** Bir sorğu sözünün namizəd sözlə oxşarlığı (0..1). */
export function tokenSimilarity(query: string, candidate: string) {
  const direct = compareTokens(query, candidate);
  if (direct >= 0.92) return direct;
  const phonetic = compareTokens(phoneticKey(query), phoneticKey(candidate)) * 0.95;
  return Math.max(direct, phonetic);
}

export interface FuzzyScore {
  /** Orta oxşarlıq (0..1). */
  score: number;
  /** Bütün sorğu sözləri namizəddə tapılıbmı. */
  full: boolean;
}

/** Sorğu sözlərinin (sırasından asılı olmayaraq) namizəd mətnlərlə uyğunluğu. */
export function fuzzyScore(queryTokens: string[], candidates: Array<string | null | undefined>): FuzzyScore {
  if (!queryTokens.length) return { score: 0, full: false };
  const candidateTokens = Array.from(new Set(candidates.flatMap((value) => (value ? tokenize(normalizeText(value)) : []))));
  if (!candidateTokens.length) return { score: 0, full: false };
  let total = 0;
  let matched = 0;
  for (const query of queryTokens) {
    let best = 0;
    for (const candidate of candidateTokens) {
      const value = tokenSimilarity(query, candidate);
      if (value > best) best = value;
      if (best === 1) break;
    }
    if (best > 0) matched += 1;
    total += best;
  }
  return { score: total / queryTokens.length, full: matched === queryTokens.length };
}

/** Telefon: yalnız rəqəmlər, +994 / 994 / 0 prefiksi atılır. */
export function normalizePhone(value: string | null | undefined) {
  let digits = (value ?? "").replace(/\D/g, "");
  if (digits.startsWith("994")) digits = digits.slice(3);
  digits = digits.replace(/^0+/, "");
  return digits;
}

export function phoneMatches(query: string, phone: string | null | undefined) {
  const q = normalizePhone(query);
  const p = normalizePhone(phone);
  if (q.length < 5 || !p) return false;
  return p.includes(q) || q.includes(p);
}

export interface Ranked<T> {
  item: T;
  score: number;
  full: boolean;
}

/** Elementləri sorğuya görə sıralayır. `full` uyğunluqlar əvvəl, sonra bal üzrə. */
export function rankItems<T>(items: readonly T[], queryTokens: string[], fields: (item: T) => Array<string | null | undefined>): Ranked<T>[] {
  if (!queryTokens.length) return [];
  return items
    .map((item) => ({ item, ...fuzzyScore(queryTokens, fields(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => Number(b.full) - Number(a.full) || b.score - a.score);
}

/** Yalnız tam uyğunluqlar; ən yaxşı nəticədən xeyli zəif olanlar atılır. */
export function bestMatches<T>(ranked: Ranked<T>[], minScore = 0.6): Ranked<T>[] {
  const full = ranked.filter((entry) => entry.full && entry.score >= minScore);
  if (!full.length) return [];
  const top = full[0].score;
  return full.filter((entry) => entry.score >= top - 0.2);
}

/** «Bunu nəzərdə tuturdunuz?» üçün zəif oxşarlıq: hər sorğu sözünün ən yaxın namizəd sözünə nisbi məsafəsi. */
export function looseSimilarity(queryTokens: string[], candidates: Array<string | null | undefined>) {
  const candidateTokens = Array.from(new Set(candidates.flatMap((value) => (value ? tokenize(normalizeText(value)) : []))));
  if (!queryTokens.length || !candidateTokens.length) return 0;
  let total = 0;
  for (const query of queryTokens) {
    let best = 0;
    for (const candidate of candidateTokens) {
      const length = Math.max(query.length, candidate.length);
      const direct = 1 - editDistance(query, candidate) / length;
      const phonetic = 1 - editDistance(phoneticKey(query), phoneticKey(candidate)) / Math.max(phoneticKey(query).length, phoneticKey(candidate).length, 1);
      best = Math.max(best, direct, phonetic * 0.95);
    }
    total += best;
  }
  return total / queryTokens.length;
}
