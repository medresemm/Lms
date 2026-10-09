// Mədinə AI üçün mətn normallaşdırması və açar söz yoxlaması (Azərbaycan + Türk dili).

export function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("az-AZ")
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
}

export function parse(message: string): ParsedMessage {
  const text = normalizeText(message);
  return { raw: message, text, tokens: tokenize(text) };
}

/** Açar söz: boşluq varsa ifadə kimi, yoxdursa söz başlanğıcı (şəkilçilərə dözümlü) kimi yoxlanır. */
export function hasKeyword(parsed: ParsedMessage, keyword: string) {
  if (keyword.includes(" ")) {
    const spaced = ` ${parsed.tokens.join(" ")} `;
    return spaced.includes(` ${keyword}`);
  }
  return parsed.tokens.some((token) => token === keyword || (keyword.length >= 3 && token.startsWith(keyword)));
}

export function countKeywords(parsed: ParsedMessage, keywords: readonly string[]) {
  return keywords.reduce((total, keyword) => total + (hasKeyword(parsed, keyword) ? 1 : 0), 0);
}
