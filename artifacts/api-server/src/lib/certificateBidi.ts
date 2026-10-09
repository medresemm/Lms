// Sertifikat PDF-i üçün kiçik bidi (iki istiqamətli mətn) köməkçisi.
// PDFKit Unicode Bidi alqoritmini dəstəkləmir: sətirləri sözlərə bölüb soldan-sağa düzür,
// fontkit isə ərəb yazısı olan hər parçanı tam tərsinə çevirir. Bu modul UAX #9-un sadələşdirilmiş
// variantını (W1–W7, N1–N2, I1–I2, L2, L4) tətbiq edir: səviyyələri təyin edir, sətri vizual
// "run"-lara bölür və RTL run-larda mötərizələri güzgüləyir.

type BidiClass = "L" | "R" | "AL" | "EN" | "AN" | "ES" | "CS" | "ET" | "NSM" | "WS" | "ON";

const MIRRORS: Record<string, string> = {
  "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "<": ">", ">": "<",
  "«": "»", "»": "«", "‹": "›", "›": "‹", "⟨": "⟩", "⟩": "⟨", "﴾": "﴿", "﴿": "﴾",
};

const ARABIC_LETTER = /[\u0600-\u0605\u0608\u060B\u060D\u061B-\u064A\u066D-\u066F\u0671-\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FF\u0750-\u077F\u08A0-\u08C9\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ARABIC_MARK = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u08CA-\u08FF\u0300-\u036F\u200C\u200D]/;
const HEBREW = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
const ARABIC_DIGIT = /[\u0660-\u0669\u066B\u066C\u06F0-\u06F9]/;
const RTL_SCRIPT = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LETTER = /\p{L}/u;

function classify(ch: string): BidiClass {
  if (ARABIC_MARK.test(ch)) return "NSM";
  if (ARABIC_DIGIT.test(ch)) return ch >= "\u06F0" && ch <= "\u06F9" ? "EN" : "AN";
  if (ARABIC_LETTER.test(ch)) return "AL";
  if (HEBREW.test(ch)) return "R";
  if (/[0-9]/.test(ch)) return "EN";
  if (ch === "+" || ch === "-") return "ES";
  if (ch === "," || ch === "." || ch === ":" || ch === "/" || ch === "\u00A0") return ch === "\u00A0" ? "CS" : "CS";
  if (/[#$%°¢£¥₼€]/.test(ch)) return "ET";
  if (/\s/.test(ch)) return "WS";
  if (LETTER.test(ch)) return "L";
  return "ON";
}

export function hasRtl(text: string) {
  return RTL_SCRIPT.test(text);
}

/** P2–P3: ilk güclü hərf paraqrafın əsas istiqamətini təyin edir. */
export function paragraphIsRtl(text: string) {
  for (const ch of text) {
    const c = classify(ch);
    if (c === "L") return false;
    if (c === "R" || c === "AL") return true;
  }
  return false;
}

function resolveLevels(chars: string[], baseRtl: boolean): number[] {
  const base = baseRtl ? 1 : 0;
  const sos: BidiClass = baseRtl ? "R" : "L";
  const types = chars.map(classify);

  // W1: NSM əvvəlki simvolun tipini alır.
  for (let i = 0; i < types.length; i++) {
    if (types[i] === "NSM") types[i] = i === 0 ? sos : types[i - 1] === "WS" ? "ON" : types[i - 1];
  }
  // W2: AL-dan sonra gələn EN -> AN. W3: AL -> R.
  let lastStrong: BidiClass = sos;
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    if (t === "L" || t === "R" || t === "AL") lastStrong = t;
    else if (t === "EN" && lastStrong === "AL") types[i] = "AN";
  }
  for (let i = 0; i < types.length; i++) if (types[i] === "AL") types[i] = "R";
  // W4: rəqəmlər arasındakı tək ayırıcı.
  for (let i = 1; i < types.length - 1; i++) {
    const prev = types[i - 1];
    const next = types[i + 1];
    if (types[i] === "ES" && prev === "EN" && next === "EN") types[i] = "EN";
    else if (types[i] === "CS" && prev === next && (prev === "EN" || prev === "AN")) types[i] = prev;
  }
  // W5: EN-ə bitişik ET ardıcıllığı -> EN.
  for (let i = 0; i < types.length; i++) {
    if (types[i] !== "ET") continue;
    let j = i;
    while (j < types.length && types[j] === "ET") j++;
    if ((i > 0 && types[i - 1] === "EN") || (j < types.length && types[j] === "EN")) for (let k = i; k < j; k++) types[k] = "EN";
    i = j - 1;
  }
  // W6: qalan ayırıcılar -> ON.
  for (let i = 0; i < types.length; i++) if (types[i] === "ES" || types[i] === "CS" || types[i] === "ET") types[i] = "ON";
  // W7: əvvəlki güclü L olduqda EN -> L.
  lastStrong = sos;
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    if (t === "L" || t === "R") lastStrong = t;
    else if (t === "EN" && lastStrong === "L") types[i] = "L";
  }
  // N1–N2: neytral ardıcıllıqlar.
  const strongOf = (t: BidiClass): "L" | "R" | null => (t === "L" ? "L" : t === "R" || t === "EN" || t === "AN" ? "R" : null);
  for (let i = 0; i < types.length; i++) {
    if (strongOf(types[i])) continue;
    let j = i;
    while (j < types.length && !strongOf(types[j])) j++;
    const before = i === 0 ? sos : strongOf(types[i - 1])!;
    const after = j === types.length ? sos : strongOf(types[j])!;
    const resolved: BidiClass = before === after ? before : sos;
    for (let k = i; k < j; k++) types[k] = resolved;
    i = j - 1;
  }
  // I1–I2.
  return types.map((t) => {
    if (base === 0) return t === "R" ? 1 : t === "AN" || t === "EN" ? 2 : 0;
    return t === "L" || t === "EN" || t === "AN" ? 2 : 1;
  });
}

export type VisualRun = {
  /** Vizual sırada (soldan sağa) və güzgülənmiş simvollarla mətn. */
  visual: string;
  /** fontkit-ə veriləcək mətn: RTL yazılı run-lar fontkit tərəfindən tərsinə çevrildiyi üçün məntiqi sırada verilir. */
  draw: string;
  rtl: boolean;
  rtlScript: boolean;
};

/** Bir sətri (sətir sonu boşluqları olmadan) vizual run-lara çevirir. */
export function visualRuns(line: string, baseRtl: boolean): VisualRun[] {
  const chars = Array.from(line);
  if (!chars.length) return [];
  const levels = resolveLevels(chars, baseRtl);
  // L4: tək səviyyəli simvollarda güzgüləmə.
  const glyphs = chars.map((ch, i) => (levels[i] % 2 === 1 && MIRRORS[ch] ? MIRRORS[ch] : ch));
  // L2: ən yüksək səviyyədən ən aşağı tək səviyyəyə qədər tərsinə çevirmə.
  const order = chars.map((_, i) => i);
  const maxLevel = Math.max(...levels);
  const minOdd = Math.min(...levels.filter((l) => l % 2 === 1), maxLevel + 1);
  for (let level = maxLevel; level >= minOdd && level > 0; level--) {
    let i = 0;
    while (i < order.length) {
      if (levels[order[i]] < level) { i++; continue; }
      let j = i;
      while (j < order.length && levels[order[j]] >= level) j++;
      const reversed = order.slice(i, j).reverse();
      order.splice(i, j - i, ...reversed);
      i = j;
    }
  }
  const runs: VisualRun[] = [];
  let current: { indices: number[]; level: number } | null = null;
  for (const index of order) {
    if (!current || current.level !== levels[index]) {
      current = { indices: [], level: levels[index] };
      runs.push(current as unknown as VisualRun);
    }
    current.indices.push(index);
  }
  return (runs as unknown as Array<{ indices: number[]; level: number }>).map(({ indices, level }) => {
    const visual = indices.map((i) => glyphs[i]).join("");
    const rtl = level % 2 === 1;
    const rtlScript = hasRtl(visual);
    // fontkit RTL yazısını özü tərsinə çevirir (və hərfləri birləşdirir), ona görə məntiqi sıra verilir.
    // PDFKit mətni boşluqlara görə sözlərə bölüb hər sözü ayrıca çəkdiyi üçün RTL run daxilində
    // boşluqlar bölünməz boşluqla (U+00A0) əvəz olunur ki, bütün run bir vahid kimi tərsinə çevrilsin.
    const draw = rtl && rtlScript ? Array.from(visual).reverse().join("").replace(/ /g, "\u00A0") : visual;
    return { visual, draw, rtl, rtlScript };
  });
}
