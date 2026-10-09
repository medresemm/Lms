// Mədinə AI üçün mətn normallaşdırması və açar söz yoxlaması (Azərbaycan + Türk dili).

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", қ: "q", л: "l",
  м: "m", н: "n", о: "o", ө: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ү: "u", ф: "f", х: "x", һ: "h", ц: "ts", ч: "c",
  ш: "s", щ: "s", ъ: "", ы: "i", ь: "", э: "e", ә: "e", ю: "yu", я: "ya", ј: "y", і: "i",
};

export function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("az-AZ")
    .replace(/[\u0400-\u04ff]/g, (letter) => CYRILLIC[letter] ?? "")
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9@.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(normalized: string) {
  return normalized.split(/[\s.\-]+/).filter(Boolean);
}

export interface ParsedMessage {
  raw: string;
  text: string;
  tokens: string[];
  /** Açar sözlər səhvlərə dözümlü yoxlanılsın (admin rejimi). */
  fuzzy?: boolean;
}

export function parse(message: string, fuzzy = false): ParsedMessage {
  const text = normalizeText(message);
  return { raw: message, text, tokens: tokenize(text), fuzzy };
}

/** Saitləri atılmış «skelet»: «qiymtlr» ~ «qiymetler». */
function skeleton(value: string) {
  return value.replace(/[aeiou]/g, "");
}

/**
 * Açar sözün səhvlərə dözümlü yoxlanışı (yalnız ≥5 hərfli açar sözlər üçün):
 * sözün başlanğıcı 1–2 hərf fərqi ilə və ya saitsiz skeletinə görə uyğun gəlirsə.
 */
export function fuzzyKeywordMatch(token: string, keyword: string) {
  if (keyword.length < 5 || token.length < 4 || /\d/.test(token)) return false;
  const allowed = keyword.length <= 7 ? 1 : 2;
  for (const length of [keyword.length - 1, keyword.length, keyword.length + 1]) {
    if (length < 4 || length > token.length) continue;
    if (osa(keyword, token.slice(0, length)) <= allowed) return true;
  }
  const keywordSkeleton = skeleton(keyword);
  const tokenSkeleton = skeleton(token);
  return keywordSkeleton.length >= 4 && token[0] === keyword[0] && tokenSkeleton.length <= keywordSkeleton.length + 4 && tokenSkeleton.startsWith(keywordSkeleton);
}

function osa(a: string, b: string) {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Açar söz: boşluq varsa ifadə kimi, yoxdursa söz başlanğıcı (şəkilçilərə dözümlü) kimi yoxlanır. */
export function hasKeyword(parsed: ParsedMessage, keyword: string, fuzzy = parsed.fuzzy ?? false) {
  if (keyword.includes(" ")) {
    const spaced = ` ${parsed.tokens.join(" ")} `;
    if (spaced.includes(` ${keyword}`)) return true;
    if (!fuzzy) return false;
    const parts = keyword.split(" ");
    return parsed.tokens.some((_, index) => parts.every((part, offset) => {
      const token = parsed.tokens[index + offset];
      return Boolean(token) && (token === part || token.startsWith(part) || fuzzyKeywordMatch(token, part));
    }));
  }
  return parsed.tokens.some((token) => token === keyword || (keyword.length >= 3 && token.startsWith(keyword)) || (fuzzy && fuzzyKeywordMatch(token, keyword)));
}

export function countKeywords(parsed: ParsedMessage, keywords: readonly string[]) {
  return keywords.reduce((total, keyword) => total + (hasKeyword(parsed, keyword) ? 1 : 0), 0);
}
