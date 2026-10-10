// Mədinə AI — «Test hazırla»: Kitabxana kitabının mətn qatından (OCR) qaydalara əsaslanan test hazırlayıcısı.
//
// Xarici dil modeli YOXDUR: suallar deterministik qaydalarla seçilmiş səhifələrin mətnindən qurulur.
// Eyni giriş (kitab, səhifələr, mövzu, say, növlər, «salt») həmişə eyni testi verir.
//
// Sual növləri (hamısı ərəbcə, sağdan sola):
//  • cloze — «Boşluğu doldurun»: cümlədən açar termin (hökm sözü, say, iʻrab termini, hədis mənbəyi və ya bölmənin
//    açar sözü) götürülür; yanlış variantlar eyni ailədən / eyni bölmənin digər açar sözlərindən seçilir.
//  • truefalse — «Doğru / yanlış»: cümlə olduğu kimi (doğru) və ya ailədən başqa terminlə dəyişdirilmiş (yanlış) verilir.
//  • chapter — «Hansı babda?»: sitat hansı babda keçir; yanlış variantlar qonşu bablardır.
//  • open — «Açıq sual»: müəllifin mətnindən (قوله: "…") izah sualı, babın siyahısı, tərif sualı; nümunə cavab
//    (yalnız müəllim görür) orijinal parça və səhifə istinadıdır.
// Ərəb mətni müqayisə üçün normallaşdırılır (hərəkə, əlif/ya/tə-mərbuta formaları), göstərilən mətn isə orijinaldır
// (yalnız OCR-un aşkar səhvləri — «»» vergül əvəzinə və s. — düzəldilir).
import type { LibraryBook, LibraryChapter } from "./catalog.js";
import { lightStem, normalizeArabic } from "./search.js";

export type GeneratedKind = "cloze" | "truefalse" | "chapter" | "open";
export const GENERATED_KINDS: readonly GeneratedKind[] = ["cloze", "truefalse", "chapter", "open"];
export const TEST_COUNTS = [5, 10, 15, 20] as const;
export const MAX_TEST_QUESTIONS = 30;
export const MAX_RANGE_PAGES = 40;
export const OPEN_POINTS = 5;

export interface GeneratedQuestion {
  /** Sabit açar (yenidən hazırlama və təkrarın qarşısını almaq üçün). */
  key: string;
  kind: GeneratedKind;
  type: "choice" | "open";
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  maxPoints: number;
  modelAnswer: string | null;
  /** Skan (PDF) səhifəsi və kitabdakı çap nömrəsi. */
  page: number;
  printedPage: number;
  chapterTitle: string | null;
}

export interface GenerateInput {
  book: LibraryBook;
  pages: readonly string[];
  /** Skan səhifələri (daxil). */
  fromPage: number;
  toPage: number;
  /** Normallaşdırılmış ərəb mövzu sözləri (boşdursa — bütün aralıq). */
  topicWords?: readonly string[];
  count: number;
  kinds: readonly GeneratedKind[];
  excludeKeys?: readonly string[];
  salt?: number;
}

export type GenerateResult =
  | { ok: true; questions: GeneratedQuestion[]; warnings: string[] }
  | { ok: false; error: string };

export const QURAN_MARK = "﴿…﴾";

export const NO_TEXT_MESSAGE =
  "Bu kitabın mətn qatı yoxdur (skan edilmiş PDF-dir), ona görə ondan avtomatik test hazırlamaq mümkün deyil. Mətnli PDF yükləyin və ya başqa kitab seçin.";
export const EMPTY_RANGE_MESSAGE = "Seçilmiş səhifələrdə oxuna bilən mətn tapılmadı. Başqa səhifə aralığı və ya bab seçin.";

// ---------------------------------------------------------------------------
// Təsadüfi ədədlər — toxumla (deterministik)

export function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function rng(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---------------------------------------------------------------------------
// OCR mətninin təmizlənməsi (göstəriləcək mətn)

const ARABIC = /[\u0621-\u064A\u0671-\u06D3]/;
const DIGIT = /[0-9\u0660-\u0669\u06F0-\u06F9]/;
const DIGITS = "0-9\u0660-\u0669\u06F0-\u06F9";

function fixWord(word: string) {
  if (/[A-Za-z]/.test(word) && !ARABIC.test(word)) return "";
  // OCR: vergül «ء» kimi oxunub («منهاء», «فيهء», «الرفعء»).
  if (word.length > 3 && word.endsWith("ء")) {
    const before = word[word.length - 2];
    if (word.endsWith("هاء") && !/^(?:[وفب]?ال)/.test(word)) return `${word.slice(0, -1)}،`;
    if (!"اويى".includes(before)) return `${word.slice(0, -1)}،`;
  }
  return word;
}

/** Bir səhifənin OCR mətnini göstərmək üçün təmizləyir: istinad nömrələri, səhv «»», «ء», latın zibili. */
export function cleanOcrText(text: string) {
  let value = text
    .replace(/[\u200c-\u200f\u202a-\u202e]/g, "")
    .replace(/[“”″„]/g, "\"")
    .replace(/''/g, "\"")
    // Hədis/səhifə nömrələri: (١٢٣) )١٢٣( (۱/۲۰۹) və s.
    .replace(new RegExp(`[()]\\s*[${DIGITS}/\\\\]+\\s*[()]`, "g"), " ")
    .replace(new RegExp(`(?:^|\\s)[${DIGITS}]+/[${DIGITS}]+(?=\\s|$)`, "g"), " ");
  let depth = 0;
  let out = "";
  for (const char of value) {
    if (char === "«") { depth += 1; out += char; }
    else if (char === "»") {
      if (depth > 0) { depth -= 1; out += char; } else out += "،";
    } else out += char;
  }
  value = out.split(/\s+/).map(fixWord).filter(Boolean).join(" ");
  // Ayələr skanda xüsusi şriftlə yazılıb və OCR-da demək olar ki, həmişə pozulur: ayə mətni «﴿…﴾» işarəsi ilə əvəzlənir.
  value = value.replace(/(تعال[يى]\s*:?)\s*[«(]?\s*([^«»().]{0,160}?)(?:\s*(?:4|\)|»|\.|﴾)|(?=\s(?:و?ل?حديث|و?قوله|وقال|أخرجه|رواه)\s))/g, "$1 ﴿…﴾ ");
  return value.replace(/\s+([،.:؛؟!])/g, "$1").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Ailələr: eyni növdən olan terminlər (yanlış variantlar və «doğru/yanlış» üçün)

interface Family {
  id: string;
  words: string[];
  /** İsimlər: «ال» ilə yazılır; bare: true — «ال»-sız forması da tanınsın. */
  article?: boolean;
  bare?: boolean;
  /** «Doğru/yanlış» üçün yararsızdır (məs. mənbə adları, ibadət adları). */
  noTrueFalse?: boolean;
  /** Yalnız bu fənlərin kitablarında (məs. «رفع» fiqh kitabında fel ola bilər). */
  domain?: "nahw" | "fiqh";
  /** Əvvəlki söz (normallaşdırılmış) bunlardan biri olmalıdır. */
  after?: string[];
  weight: number;
}

const FAMILIES: Family[] = [
  { id: "hukm", words: ["واجب", "مستحب", "مكروه", "حرام", "مباح", "جائز", "سنة"], article: false, weight: 3 },
  { id: "hukmF", words: ["واجبة", "مستحبة", "مكروهة", "محرمة", "مباحة", "جائزة", "مسنونة"], weight: 3 },
  { id: "hukmVerb", words: ["يجب", "يستحب", "يكره", "يحرم", "يباح", "يجوز", "يسن"], weight: 3 },
  { id: "countF", words: ["اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة"], weight: 2.6 },
  { id: "countM", words: ["ثلاث", "أربع", "خمس", "ست", "سبع", "ثمان", "تسع", "عشر"], weight: 2.4 },
  { id: "irab", domain: "nahw", words: ["الرفع", "النصب", "الخفض", "الجزم"], article: true, bare: true, weight: 2.6 },
  { id: "marks", domain: "nahw", words: ["الضمة", "الفتحة", "الكسرة"], article: true, bare: true, weight: 2.6 },
  { id: "states", domain: "nahw", words: ["مرفوع", "منصوب", "مخفوض", "مجزوم"], weight: 2.6 },
  { id: "nahwRoles", domain: "nahw", words: ["الفاعل", "المفعول", "المبتدأ", "الخبر", "النعت", "الحال", "التمييز", "البدل", "المنادى"], article: true, weight: 2.2 },
  { id: "wordKinds", domain: "nahw", words: ["الاسم", "الفعل", "الحرف"], article: true, bare: true, weight: 1.6 },
  { id: "verbKinds", domain: "nahw", words: ["الماضي", "المضارع", "الأمر"], article: true, weight: 1.8 },
  { id: "rituals", domain: "fiqh", words: ["الوضوء", "الغسل", "التيمم"], article: true, noTrueFalse: true, weight: 1 },
  { id: "collectors", words: ["البخاري", "مسلم", "أبو داود", "الترمذي", "النسائي", "ابن ماجه", "أحمد", "مالك"], after: ["اخرجه", "رواه", "واخرجه", "ورواه", "اخرجه", "اخرجهما", "رواها"], noTrueFalse: true, weight: 0.5 },
  { id: "grading", words: ["صحيح", "حسن", "ضعيف"], after: ["حديث", "اسناده", "اسناد", "وهو"], weight: 0.9 },
];

interface FamilyEntry { family: Family; display: string }

const FAMILY_LOOKUP = (() => {
  const map = new Map<string, FamilyEntry>();
  for (const family of FAMILIES) {
    for (const word of family.words) {
      const forms = [word];
      if (family.article && family.bare) forms.push(word.slice(2));
      for (const form of forms) {
        const key = normalizeArabic(form);
        if (!map.has(key)) map.set(key, { family, display: form });
      }
    }
  }
  return map;
})();

function familyDisplay(family: Family, word: string, withArticle: boolean) {
  if (!family.article) return word;
  if (withArticle) return word.startsWith("ال") ? word : `ال${word}`;
  return word.startsWith("ال") ? word.slice(2) : word;
}

// ---------------------------------------------------------------------------
// Mətn vahidləri

interface Unit {
  page: number;
  /** Təmizlənmiş, göstəriləcək sözlər. */
  words: string[];
  /** Hər sözün normallaşdırılmış forması. */
  norms: string[];
  hash: string;
  quality: number;
  /** Cümlənin əvvəlindən başlayır (əvvəlki parça nöqtə/sual işarəsi ilə bitib). */
  sentenceStart: boolean;
  /** Kitabın öz sualı / tapşırığı («أسئلة», «مثل لـ…», «…؟»). */
  isQuestion: boolean;
}

interface MatnQuote { page: number; text: string; commentary: string; pos: number }

const STOP = new Set(["في", "من", "علي", "الي", "عن", "او", "ثم", "هو", "هي", "ما", "ان", "قد", "مع", "عند", "غيره", "غيرها", "نحوه", "ونحوه", "كلها", "كله", "مطلقا", "وهي", "وهو", "الا", "اذا", "لا"]);

const BORING = new Set(["الله", "النبي", "رسول", "صلي", "عليه", "وسلم", "عنه", "عنها", "تعالي", "قوله", "قال", "اخرجه", "رواه", "الحديث", "حديث",
  "البخاري", "مسلم", "داود", "الترمذي", "النسائي", "ماجه", "احمد", "رضي", "الصلاه", "والسلام", "المولف", "المصنف", "الشيخ", "الباب", "الكتاب",
  "التلخيص", "المغني", "الذي", "التي", "الذين", "اللذين", "انه", "انها", "كان", "كانت", "يكون", "تكون", "ذلك", "هذا", "هذه", "فيه", "فيها", "منه", "منها"]);

function wordNorm(word: string) {
  return normalizeArabic(word).replace(/\s+/g, "");
}

function bareNorm(norm: string) {
  // ön bağlayıcılar: و، ف (və «وال» → «ال»)
  if ((norm.startsWith("و") || norm.startsWith("ف")) && norm.length >= 4) return norm.slice(1);
  return norm;
}

interface BookStats { freq: Map<string, number> }
const statsCache = new Map<string, { pages: readonly string[]; stats: BookStats }>();

function bookStats(book: LibraryBook, pages: readonly string[]): BookStats {
  const cached = statsCache.get(book.slug);
  if (cached && cached.pages === pages) return cached.stats;
  const freq = new Map<string, number>();
  for (const text of pages) {
    for (const token of normalizeArabic(text).split(" ")) {
      if (token) freq.set(token, (freq.get(token) ?? 0) + 1);
    }
  }
  const stats = { freq };
  statsCache.set(book.slug, { pages, stats });
  return stats;
}

/** Cümlənin «oxunaqlılığı»: sözlərin nə qədəri kitabda dəfələrlə rast gəlinir (OCR zibili adətən tək olur). */
function unitQuality(words: string[], stats: BookStats) {
  let arabic = 0;
  let known = 0;
  let digits = 0;
  for (const word of words) {
    if (DIGIT.test(word)) { digits += 1; continue; }
    if (!ARABIC.test(word)) continue;
    arabic += 1;
    const norm = wordNorm(word);
    if (!norm) continue;
    if ((stats.freq.get(norm) ?? 0) >= 3 || norm.length <= 2) known += 1;
  }
  if (!arabic || arabic < words.length * 0.85 || digits > 1) return 0;
  return known / arabic;
}

function splitUnits(page: number, text: string, stats: BookStats): Unit[] {
  const pieces = text.split(/(?<=[.؟!])\s+|\s+(?=قوله\s*:)|\s+(?=وأقول\s*:)|\s+(?=-?\s*[\u0660-\u0669\u06F0-\u06F9]\s*-)/);
  const units: Unit[] = [];
  pieces.forEach((raw, pieceIndex) => {
    const previous = pieceIndex > 0 ? pieces[pieceIndex - 1].trim() : "";
    const sentenceStart = /^(?:قوله|وأقول)/.test(raw.trim()) || /[.؟!]$/.test(previous);
    const piece = raw.replace(new RegExp(`^[-–\\s${DIGITS}.]+`), "").replace(/^[«(]+/, "").trim();
    const words = piece.split(" ").filter(Boolean);
    if (words.length < 5 || piece.includes(QURAN_MARK)) return;
    // Bab başlığını sitat gətirən cümlələr («قوله: "باب …"») sual üçün yararsızdır.
    if (words.slice(0, 5).some((word) => /^["'«(]?(?:باب|كتاب)$/.test(word))) return;
    const quality = unitQuality(words, stats);
    if (quality < 0.86) return;
    const norms = words.map(wordNorm);
    const isQuestion = /؟\s*$/.test(piece) || /^(?:اسيله|تمرينات|تمرين|مثل|اذكر|عرف|بين|اجمع|استعمل|ضع|اعرب|ميز|هات)$/.test(norms[0]) || norms.slice(0, 3).includes("اسيله");
    units.push({ page, words, norms, hash: hashString(norms.join(" ")).toString(36), quality, sentenceStart, isQuestion });
  });
  return units;
}

const QUOTE = "[\"']";
/** Müəllif mətnindən sitatın sonundakı «… الخ» qısaltmasını və durğu işarələrini silir. */
function tidyQuote(text: string) {
  return text.replace(/«/g, "").replace(/»/g, "،").replace(/\s*\.{2,}\s*(?:ال?خ)?\s*$/, "").replace(/\s+(?:ال?خ)\s*$/, "").replace(/[،,.:\s]+$/, "").replace(/\s+/g, " ").trim();
}

function extractMatn(page: number, text: string): MatnQuote[] {
  const quotes: MatnQuote[] = [];
  const pattern = new RegExp(`(?<![\u0621-\u064A])قوله\\s*:?\\s*${QUOTE}([^"']{3,160}?)${QUOTE}`, "g");
  const matches = Array.from(text.matchAll(pattern));
  matches.forEach((match, index) => {
    const quote = tidyQuote(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? text.length : text.length;
    const commentary = text.slice(start, Math.min(end, start + 700)).trim();
    const words = quote.split(" ").filter(Boolean);
    if (words.length < 1 || words.length > 16 || !ARABIC.test(quote)) return;
    quotes.push({ page, text: quote, commentary: end > start + 700 ? `${commentary} …` : commentary, pos: match.index ?? 0 });
  });
  // «قال: <mətn> وأقول: <şərh>» üslubu (məs. ət-Tuhfətus-Səniyyə)
  const said = Array.from(text.matchAll(/(?<![\u0621-\u064A])قال\s*:\s*([^:]{8,320}?)\s*وأقول\s*:/g));
  said.forEach((match, index) => {
    const quote = tidyQuote(match[1]);
    if (!ARABIC.test(quote) || quote.split(" ").length < 3) return;
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < said.length ? said[index + 1].index ?? text.length : text.length;
    const commentary = text.slice(start, Math.min(end, start + 700)).trim();
    quotes.push({ page, text: quote, commentary: end > start + 700 ? `${commentary} …` : commentary, pos: match.index ?? 0 });
  });
  return quotes;
}

/** Müəllif mətnindəki nömrələnmiş bəndlər: «-١ الخارج من السبيلين»، «۲- والدم الكثير ونحوه». */
function extractNumbered(page: number, text: string): MatnQuote[] {
  const items: MatnQuote[] = [];
  const pattern = /(?:^|\s)(?:-\s*[\u0660-\u0669\u06F0-\u06F9]|[\u0660-\u0669\u06F0-\u06F9]\s*-)\s*(و?[\u0621-\u064A][^.\-"'()؛:«»0-9\u0660-\u0669\u06F0-\u06F9]{2,70}?)\s*(?=["'.؛]|\s[-\u0660-\u0669\u06F0-\u06F9]|$)/g;
  for (const match of text.matchAll(pattern)) {
    const item = match[1].replace(/[،,\s]+$/, "").trim();
    const words = item.split(" ");
    if (words.length < 1 || words.length > 10) continue;
    items.push({ page, text: item, commentary: "", pos: match.index ?? 0 });
  }
  return items;
}

function itemWords(text: string) {
  return normalizeArabic(text).split(" ").filter(Boolean).map(bareNorm);
}

/** Eyni bənd iki dəfə (nömrəli bənd + «قوله» sitatı): ilk söz eyni, ikinci söz eyni və ya yoxdur. */
function sameItem(a: string, b: string) {
  const left = itemWords(a);
  const right = itemWords(b);
  if (!left.length || !right.length || left[0] !== right[0]) return false;
  if (left.length === 1 || right.length === 1) return true;
  return left[1] === right[1];
}

// ---------------------------------------------------------------------------
// Fəsillər

const NON_CONTENT = /^(?:فصل|الفهرس|فهرس|تقديم|مقدمة|مقدمه|ترجمة|ترجمه)/;

function isRealChapter(chapter: LibraryChapter) {
  return !NON_CONTENT.test(normalizeArabic(chapter.title).replace(/^ال(?=فهرس)/, ""))
    && !NON_CONTENT.test(chapter.title.trim());
}

/** Səhifənin aid olduğu «əsl» bab (Fəsil başlıqları və müqəddimələr keçilir). */
export function realChapterAt(book: LibraryBook, page: number): LibraryChapter | null {
  let found: LibraryChapter | null = null;
  for (const chapter of book.chapters) {
    if (chapter.page > page) break;
    if (isRealChapter(chapter)) found = chapter;
  }
  return found;
}

/** Babın skan səhifə aralığı: «كتاب» — növbəti «كتاب»a qədər; bab — növbəti əsl baba qədər (içindəki «فصل»lər daxil). */
export function chapterRange(book: LibraryBook, index: number) {
  const chapter = book.chapters[index];
  if (!chapter) return null;
  const real = isRealChapter(chapter);
  let to = book.pageCount;
  for (let i = index + 1; i < book.chapters.length; i += 1) {
    const next = book.chapters[i];
    const boundary = chapter.level === 1 ? next.level === 1 : real ? next.level === 1 || isRealChapter(next) : true;
    if (!boundary) continue;
    to = next.page - 1;
    break;
  }
  // Növbəti başlıq eyni səhifədədirsə — həmin səhifə.
  return { from: chapter.page, to: Math.min(book.pageCount, Math.max(chapter.page, to)) };
}

// ---------------------------------------------------------------------------
// Sual qurucuları

interface Candidate {
  kind: GeneratedKind;
  key: string;
  sourceHash: string;
  answerKey: string;
  score: number;
  build: () => Omit<GeneratedQuestion, "key" | "kind" | "page" | "printedPage" | "chapterTitle">;
  page: number;
}

const BLANK = "ــــــــ";

function windowText(words: string[], index: number, span: number, radius = 11) {
  const start = Math.max(0, index - radius);
  const end = Math.min(words.length, index + span + radius);
  const head = start > 0 ? "… " : "";
  const tail = end < words.length ? " …" : "";
  return { start, end, head, tail };
}

interface TermHit { index: number; span: number; family: Family | null; display: string; prefix: string; withArticle: boolean; norm: string }

function familyHits(unit: Unit, domain: "nahw" | "fiqh" | "other"): TermHit[] {
  const hits: TermHit[] = [];
  for (let i = 0; i < unit.words.length; i += 1) {
    const original = unit.words[i].replace(/[،,.:؛؟!"'«»()]+$/g, "").replace(/^["'«(]+/, "");
    const norm = wordNorm(original);
    if (!norm) continue;
    const next = unit.norms[i + 1] ?? "";
    const candidates: Array<{ key: string; prefix: string; span: number }> = [
      { key: `${norm} ${next}`, prefix: "", span: 2 },
      { key: norm, prefix: "", span: 1 },
    ];
    if ((norm.startsWith("و") || norm.startsWith("ف")) && norm.length >= 3) {
      candidates.push({ key: `${norm.slice(1)} ${next}`, prefix: original[0], span: 2 }, { key: norm.slice(1), prefix: original[0], span: 1 });
    }
    for (const candidate of candidates) {
      const entry = FAMILY_LOOKUP.get(candidate.key);
      if (!entry) continue;
      if (entry.family.domain && domain !== "other" && entry.family.domain !== domain) continue;
      const before = bareNorm(unit.norms[i - 1] ?? "");
      if (entry.family.after && !entry.family.after.includes(before) && !entry.family.after.includes(unit.norms[i - 1] ?? "")) continue;
      // «حرام» kimi sözlər «المسجد الحرام» birləşməsində hökm deyil.
      if (entry.family.id === "hukm" && /^(?:المسجد|البيت|الشهر|البلد)$/.test(bareNorm(unit.norms[i - 1] ?? ""))) continue;
      const withArticle = Boolean(entry.family.article) && entry.display.startsWith("ال");
      hits.push({ index: i, span: candidate.span, family: entry.family, display: entry.display, prefix: candidate.prefix, withArticle, norm: candidate.key });
      break;
    }
  }
  return hits;
}

function familyDistractors(hit: TermHit, unit: Unit, random: () => number, need: number) {
  const family = hit.family!;
  const sentence = new Set(unit.norms.map(bareNorm));
  const sentenceText = ` ${unit.norms.join(" ")} `;
  const answerNorm = normalizeArabic(hit.display);
  const pool = family.words
    .map((word) => familyDisplay(family, word, hit.withArticle))
    .filter((word) => {
      const norm = normalizeArabic(word);
      return norm !== answerNorm && !sentence.has(norm) && !sentenceText.includes(` ${norm} `);
    });
  return shuffle(pool, random).slice(0, need);
}

interface Keyword { norm: string; display: string; salience: number }

function sectionKeywords(units: Unit[], stats: BookStats, pageCount: number): Keyword[] {
  const counts = new Map<string, { count: number; display: string }>();
  for (const unit of units) {
    unit.words.forEach((word, index) => {
      const bare = bareNorm(unit.norms[index]);
      if (!bare.startsWith("ال") || bare.length < 5 || BORING.has(bare) || BORING.has(bare.slice(2))) return;
      if (FAMILY_LOOKUP.has(bare)) return;
      const book = stats.freq.get(bare) ?? 0;
      if (book < 3) return;
      const clean = word.replace(/[،,.:؛؟!"'«»()]+$/g, "").replace(/^["'«(]+/, "");
      const display = clean.length > bare.length && /^[وف]/.test(clean) ? clean.slice(1) : clean;
      const current = counts.get(bare);
      if (current) current.count += 1;
      else counts.set(bare, { count: 1, display });
    });
  }
  const keywords: Keyword[] = [];
  for (const [norm, { count, display }] of counts) {
    if (count < 2) continue;
    const book = stats.freq.get(norm) ?? 1;
    if (book > pageCount * 1.2) continue; // çox ümumi söz
    keywords.push({ norm, display, salience: count / Math.log2(2 + book) });
  }
  // Eyni kökdən olan sözlərdən yalnız biri.
  const seen = new Set<string>();
  return keywords.sort((a, b) => b.salience - a.salience || a.norm.localeCompare(b.norm)).filter((keyword) => {
    const stem = lightStem(keyword.norm);
    if (seen.has(stem)) return false;
    seen.add(stem);
    return true;
  }).slice(0, 40);
}

function clozeFromHit(unit: Unit, hit: TermHit, options: string[], answer: string) {
  const { start, end, head, tail } = windowText(unit.words, hit.index, hit.span);
  const before = unit.words.slice(start, hit.index).join(" ");
  const after = unit.words.slice(hit.index + hit.span, end).join(" ");
  const trailing = (unit.words[hit.index + hit.span - 1].match(/[،,.:؛؟!"'»)]+$/) ?? [""])[0];
  const sentence = `${head}${before ? `${before} ` : ""}${hit.prefix}${BLANK}${trailing}${after ? ` ${after}` : ""}${tail}`;
  return { sentence, options, answer };
}

function replacedSentence(unit: Unit, hit: TermHit, replacement: string) {
  const { start, end, head, tail } = windowText(unit.words, hit.index, hit.span, 13);
  const trailing = (unit.words[hit.index + hit.span - 1].match(/[،,.:؛؟!"'»)]+$/) ?? [""])[0];
  const words = [...unit.words.slice(start, hit.index), `${hit.prefix}${replacement}${trailing}`, ...unit.words.slice(hit.index + hit.span, end)];
  return `${head}${words.join(" ")}${tail}`;
}

function excerpt(unit: Unit, max = 22) {
  // «وأقول:», «قوله:», «قال:» kimi giriş sözləri sitata daxil edilmir.
  let words = unit.words;
  if (/^(?:واقول|قوله|قال)$/.test(unit.norms[0]) && words.length > 4) words = words.slice(1);
  if (words.length <= max) return words.join(" ").replace(/[،:]$/, "");
  return `${words.slice(0, max).join(" ")} …`;
}

function shortQuote(text: string, max = 26) {
  const words = text.split(" ");
  return words.length <= max ? text : `${words.slice(0, max).join(" ")} …`;
}

function printed(book: LibraryBook, page: number) {
  return page - book.pageOffset;
}

function arabicNumber(value: number) {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

function sourceLine(book: LibraryBook, page: number) {
  return `المصدر: ${book.title}، ص ${arabicNumber(printed(book, page))}`;
}

// ---------------------------------------------------------------------------
// Əsas funksiya

export function generateBookTest(input: GenerateInput): GenerateResult {
  const { book, pages } = input;
  const from = Math.max(1, Math.min(input.fromPage, input.toPage));
  const to = Math.min(book.pageCount, pages.length, Math.max(input.fromPage, input.toPage));
  if (!pages.length || pages.every((text) => !text.trim())) return { ok: false, error: NO_TEXT_MESSAGE };
  if (to < from) return { ok: false, error: EMPTY_RANGE_MESSAGE };
  if (to - from + 1 > MAX_RANGE_PAGES) return { ok: false, error: `Bir dəfəyə ən çox ${MAX_RANGE_PAGES} səhifədən test hazırlamaq olar. Aralığı kiçildin və ya bab seçin.` };
  const kinds = GENERATED_KINDS.filter((kind) => input.kinds.includes(kind));
  if (!kinds.length) return { ok: false, error: "Ən azı bir sual növü seçin." };
  const count = Math.max(1, Math.min(MAX_TEST_QUESTIONS, Math.floor(input.count)));
  const stats = bookStats(book, pages);
  const salt = Number.isInteger(input.salt) ? input.salt! : 0;
  const topic = (input.topicWords ?? []).filter((word) => word.length >= 2);
  const random = rng(hashString(`${book.slug}|${from}-${to}|${topic.join(",")}|${count}|${kinds.join(",")}|${salt}|${(input.excludeKeys ?? []).join(",")}`));

  const cleanPages: Array<{ page: number; text: string }> = [];
  for (let page = from; page <= to; page += 1) {
    const text = cleanOcrText(pages[page - 1] ?? "");
    if (text) cleanPages.push({ page, text });
  }
  let units = cleanPages.flatMap(({ page, text }) => splitUnits(page, text, stats));
  const matn = cleanPages.flatMap(({ page, text }) => extractMatn(page, text));
  const numbered = cleanPages.flatMap(({ page, text }) => extractNumbered(page, text));
  if (!units.length && !matn.length) return { ok: false, error: EMPTY_RANGE_MESSAGE };

  const warnings: string[] = [];
  const topicStems = new Set(topic.map(lightStem));
  const matchesTopic = (norms: string[]) => !topicStems.size || norms.some((norm) => topicStems.has(lightStem(bareNorm(norm))) || topic.includes(bareNorm(norm)));
  let topicMatn = matn;
  let topicNumbered = numbered;
  if (topicStems.size) {
    const focused = units.filter((unit) => matchesTopic(unit.norms));
    const focusedPages = new Set(focused.map((unit) => unit.page));
    // Mövzu sözü keçən cümlələr və onların qonşuları (eyni səhifədə).
    const near = units.filter((unit) => focusedPages.has(unit.page));
    if (near.length >= Math.min(6, units.length)) units = near;
    else warnings.push("Mövzu sözü seçilmiş səhifələrdə az keçir — suallar bütün aralıqdan hazırlandı.");
    const focusedMatn = matn.filter((quote) => focusedPages.has(quote.page) || matchesTopic(normalizeArabic(quote.text).split(" ")));
    if (focusedMatn.length) topicMatn = focusedMatn;
    const focusedNumbered = numbered.filter((item) => focusedPages.has(item.page));
    if (focusedNumbered.length) topicNumbered = focusedNumbered;
  }

  const exclude = new Set(input.excludeKeys ?? []);
  const excludedSources = new Set(Array.from(exclude).map((key) => key.split(":")[2]).filter(Boolean));
  const candidates: Candidate[] = [];
  const add = (candidate: Candidate) => {
    if (exclude.has(candidate.key) || excludedSources.has(candidate.sourceHash)) return;
    candidates.push(candidate);
  };

  const keywords = sectionKeywords(units, stats, pages.length);
  const keywordByNorm = new Map(keywords.map((keyword) => [keyword.norm, keyword]));

  const realChapters = book.chapters.filter(isRealChapter);
  const domain: "nahw" | "fiqh" | "other" = /^(?:Nəhv|Sərf|Ərəb dili)$/.test(book.subject) ? "nahw" : /^(?:Fiqh|Üsul)$/.test(book.subject) ? "fiqh" : "other";
  // Babların müəllif mətni siyahısı: nömrələnmiş bəndlər + «قوله» sitatları (təkrarsız, mətn sırası ilə).
  const chapterLists = new Map<LibraryChapter, MatnQuote[]>();
  {
    const grouped = new Map<LibraryChapter, MatnQuote[]>();
    for (const quote of [...topicNumbered, ...topicMatn]) {
      const chapter = realChapterAt(book, quote.page);
      if (!chapter || /^(?:باب|كتاب)/.test(normalizeArabic(quote.text))) continue;
      const list = grouped.get(chapter) ?? [];
      list.push(quote);
      grouped.set(chapter, list);
    }
    for (const [chapter, quotes] of grouped) {
      const unique: MatnQuote[] = [];
      for (const quote of [...quotes].sort((a, b) => a.page - b.page || a.pos - b.pos)) {
        const existing = unique.findIndex((item) => sameItem(item.text, quote.text));
        if (existing < 0) unique.push(quote);
        else if (quote.text.length > unique[existing].text.length) unique[existing] = { ...quote, page: unique[existing].page, pos: unique[existing].pos };
      }
      chapterLists.set(chapter, unique);
    }
  }

  // (a2) Müəllif mətnindən boşluq doldurma: bəndin ən «xüsusi» sözü, yanlış variantlar — eyni babın digər bəndlərindən.
  if (kinds.includes("cloze")) {
    for (const [chapter, items] of chapterLists) {
      const picks = items.map((item) => {
        const words = item.text.split(" ").map((word) => word.replace(/[،,.:؛]+$/, "")).filter(Boolean);
        let best = -1;
        let bestFreq = Infinity;
        words.forEach((word, index) => {
          const norm = bareNorm(wordNorm(word));
          if (norm.length < 3 || BORING.has(norm) || STOP.has(norm)) return;
          const freq = stats.freq.get(wordNorm(word)) ?? 0;
          if (freq < 3) return; // OCR səhvi ehtimalı
          if (freq <= bestFreq) { bestFreq = freq; best = index; }
        });
        return { item, words, index: best };
      }).filter((pick) => pick.index >= 0);
      // Variantlar bağlayıcısız («و»/«ف») göstərilir; bağlayıcı boşluğun önündə qalır.
      const strip = (word: string) => {
        const clean = word.replace(/[،,.]+$/, "");
        const norm = wordNorm(clean);
        const conj = /^[وف]/.test(norm) && norm.length >= 3 && (bareNorm(norm) !== norm || (stats.freq.get(norm.slice(1)) ?? 0) >= 3);
        return conj ? { prefix: clean[0], core: clean.slice(1) } : { prefix: "", core: clean };
      };
      // Söz «forması»: artikl, fel prefiksi (ي/ت), ön söz (ب/ل) — yanlış variantlar eyni formada olmalıdır.
      const hasArticle = (word: string) => { const norm = wordNorm(word); return norm.startsWith("ال") ? "a" : norm.startsWith("لل") || norm.startsWith("بال") ? "p" : /^[يت]/.test(norm) ? "v" : "n"; };
      for (const pick of picks) {
        if (pick.words.length < 3) continue;
        const { prefix, core: answer } = strip(pick.words[pick.index]);
        const answerNorm = normalizeArabic(answer);
        const pool = Array.from(new Set(picks.filter((other) => other !== pick).map((other) => strip(other.words[other.index]).core)))
          .filter((word) => normalizeArabic(word) !== answerNorm && hasArticle(word) === hasArticle(answer)
            && !pick.words.some((own) => wordNorm(strip(own).core) === wordNorm(word)));
        if (pool.length < 3) continue;
        const hash = hashString(`mc:${normalizeArabic(pick.item.text)}`).toString(36);
        const title = chapter.title.trim();
        add({
          kind: "cloze", page: pick.item.page, sourceHash: hash, answerKey: `mc:${answerNorm}`,
          key: `cloze:${pick.item.page}:${hash}:m`,
          score: 3.6,
          build: () => {
            const options = shuffle([answer, ...shuffle(pool, random).slice(0, 3)], random);
            const shown = pick.words.map((word, index) => (index === pick.index ? `${prefix}${BLANK}` : word)).join(" ");
            return { type: "choice", prompt: `أكمل من كلام المصنف في «${title}»:\n«${shown}»`, options, correctOptionIndex: options.indexOf(answer), maxPoints: 1, modelAnswer: null };
          },
        });
      }
    }
  }
  function addChapterQuestion(page: number, quoteText: string, sourceHash: string, score: number) {
    const chapter = realChapterAt(book, page);
    const position = chapter ? realChapters.indexOf(chapter) : -1;
    if (!chapter || position < 0 || realChapters.length < 4) return;
    const answer = chapter.title.trim();
    const seen = new Set([normalizeArabic(answer)]);
    const neighbours: string[] = [];
    for (let distance = 1; neighbours.length < 6 && distance < realChapters.length; distance += 1) {
      for (const index of [position - distance, position + distance]) {
        const title = realChapters[index]?.title.trim();
        if (!title || seen.has(normalizeArabic(title))) continue;
        seen.add(normalizeArabic(title));
        neighbours.push(title);
      }
    }
    if (neighbours.length < 3) return;
    add({
      kind: "chapter", page, sourceHash: `c${sourceHash}`, answerKey: `ch:${answer}`,
      key: `chapter:${page}:c${sourceHash}:c`,
      score,
      build: () => {
        const options = shuffle([answer, ...shuffle(neighbours.slice(0, 5), random).slice(0, 3)], random);
        return { type: "choice", prompt: `في أيّ بابٍ من الكتاب ورد قوله:\n«${quoteText}»؟`, options, correctOptionIndex: options.indexOf(answer), maxPoints: 1, modelAnswer: null };
      },
    });
  }

  for (const unit of units) {
    if (unit.isQuestion) continue;
    const hits = familyHits(unit, domain);
    // (a) Boşluq doldurma
    if (kinds.includes("cloze")) {
      for (const hit of hits) {
        const distractors = familyDistractors(hit, unit, random, 3);
        if (distractors.length < 2) continue;
        const answer = hit.display;
        add({
          kind: "cloze", page: unit.page, sourceHash: unit.hash, answerKey: hit.family!.id === "collectors" || hit.family!.id === "grading" ? hit.family!.id : `${hit.family!.id}:${normalizeArabic(answer)}`,
          key: `cloze:${unit.page}:${unit.hash}:${hit.index}`,
          score: hit.family!.weight + unit.quality + (unit.words.length <= 28 ? 0.4 : 0),
          build: () => {
            const options = shuffle([answer, ...distractors], random);
            const cloze = clozeFromHit(unit, hit, options, answer);
            return { type: "choice", prompt: `أكمل الفراغ بما يناسب:\n«${cloze.sentence}»`, options, correctOptionIndex: options.indexOf(answer), maxPoints: 1, modelAnswer: null };
          },
        });
      }
      // Bölmənin açar sözü
      let best: { index: number; keyword: Keyword } | null = null;
      unit.norms.forEach((norm, index) => {
        const keyword = keywordByNorm.get(bareNorm(norm));
        if (keyword && (!best || keyword.salience > best.keyword.salience)) best = { index, keyword };
      });
      if (best) {
        const { index, keyword } = best as { index: number; keyword: Keyword };
        const sentenceNorms = new Set(unit.norms.map(bareNorm));
        const pool = keywords.filter((other) => other.norm !== keyword.norm && !sentenceNorms.has(other.norm) && lightStem(other.norm) !== lightStem(keyword.norm))
          .sort((a, b) => Math.abs(a.norm.length - keyword.norm.length) - Math.abs(b.norm.length - keyword.norm.length) || b.salience - a.salience)
          .slice(0, 7);
        if (pool.length >= 3) {
          const word = unit.words[index];
          const prefix = /^[وف]/.test(word) && bareNorm(unit.norms[index]) !== unit.norms[index] ? word[0] : "";
          const hit: TermHit = { index, span: 1, family: null, display: keyword.display, prefix, withArticle: true, norm: keyword.norm };
          add({
            kind: "cloze", page: unit.page, sourceHash: unit.hash, answerKey: `kw:${keyword.norm}`,
            key: `cloze:${unit.page}:${unit.hash}:k${index}`,
            score: 1.2 + unit.quality + Math.min(1, keyword.salience / 3) + (unit.words.length <= 28 ? 0.3 : 0),
            build: () => {
              const answer = keyword.display;
              const options = shuffle([answer, ...shuffle(pool, random).slice(0, 3).map((item) => item.display)], random);
              const cloze = clozeFromHit(unit, hit, options, answer);
              return { type: "choice", prompt: `أكمل الفراغ بما يناسب:\n«${cloze.sentence}»`, options, correctOptionIndex: options.indexOf(answer), maxPoints: 1, modelAnswer: null };
            },
          });
        }
      }
    }
    // (b) Doğru / yanlış
    if (kinds.includes("truefalse")) {
      for (const hit of hits) {
        if (hit.family!.noTrueFalse) continue;
        const [swap] = familyDistractors(hit, unit, random, 1);
        if (!swap) continue;
        const truth = random() < 0.5;
        add({
          kind: "truefalse", page: unit.page, sourceHash: unit.hash, answerKey: `tf:${unit.hash}`,
          key: `truefalse:${unit.page}:${unit.hash}:${hit.index}`,
          score: hit.family!.weight * 0.8 + unit.quality,
          build: () => {
            const statement = replacedSentence(unit, hit, truth ? hit.display : swap);
            const options = ["صحيحة", "خاطئة"];
            return { type: "choice", prompt: `هل العبارة الآتية صحيحة أم خاطئة؟\n«${statement}»`, options, correctOptionIndex: truth ? 0 : 1, maxPoints: 1, modelAnswer: null };
          },
        });
        break;
      }
    }
    // (c) Hansı babda? — cümlələrdən (yalnız bölmənin açar sözü olan, təxric olmayan)
    if (kinds.includes("chapter") && unit.words.length >= 7 && !/^(?:اخرجه|رواه|وقال|قال|واخرجه|انظر)$/.test(unit.norms[0])
      && unit.norms.some((norm) => keywordByNorm.has(bareNorm(norm)))) {
      addChapterQuestion(unit.page, excerpt(unit, 18), unit.hash, 1.4 + unit.quality);
    }
  }

  // (c) Hansı babda? — müəllifin mətnindən (ən aydın sitatlar)
  if (kinds.includes("chapter")) {
    for (const quote of [...topicNumbered, ...topicMatn]) {
      if (itemWords(quote.text).length < 2 || /^(?:باب|كتاب|فصل)/.test(normalizeArabic(quote.text))) continue;
      addChapterQuestion(quote.page, shortQuote(quote.text, 18), hashString(`matn:${normalizeArabic(quote.text)}`).toString(36), 3.2);
    }
  }

  // (d) Açıq suallar
  if (kinds.includes("open")) {
    // Babın siyahısı: babdakı müəllif mətnləri
    for (const [chapter, unique] of chapterLists) {
      if (unique.length < 3) continue;
      const hash = hashString(`list:${chapter.title}:${unique.map((quote) => quote.text).join("|")}`).toString(36);
      const title = chapter.title.trim();
      add({
        kind: "open", page: unique[0].page, sourceHash: hash, answerKey: `list:${title}`,
        key: `open:${unique[0].page}:${hash}:list`,
        score: 6,
        build: () => ({
          type: "open",
          prompt: `اذكر ما أورده المصنف في «${title}» (ص ${arabicNumber(printed(book, unique[0].page))}–${arabicNumber(printed(book, unique[unique.length - 1].page))})، مع بيان الدليل باختصار.`,
          options: [],
          correctOptionIndex: -1,
          maxPoints: OPEN_POINTS,
          modelAnswer: `${unique.map((quote, index) => `${arabicNumber(index + 1)}- ${quote.text} (ص ${arabicNumber(printed(book, quote.page))})`).join("\n")}\n\n${sourceLine(book, unique[0].page)}`,
        }),
      });
    }
    // Müəllif mətnini izah et
    for (const quote of topicMatn) {
      const norm = normalizeArabic(quote.text);
      if (/^(?:باب|كتاب|فصل)\b/.test(norm) || norm.split(" ").length < 2 || quote.commentary.split(" ").length < 8) continue;
      const hash = hashString(`matn:${norm}`).toString(36);
      add({
        kind: "open", page: quote.page, sourceHash: hash, answerKey: `matn:${norm}`,
        key: `open:${quote.page}:${hash}:matn`,
        score: 3 + Math.min(1, quote.commentary.length / 500),
        build: () => ({
          type: "open",
          prompt: `اشرح قول المصنف: «${shortQuote(quote.text)}»${book.subject === "Fiqh" ? "، واذكر دليله" : "، ومثّل له"}.`,
          options: [],
          correctOptionIndex: -1,
          maxPoints: OPEN_POINTS,
          modelAnswer: `${quote.commentary}\n\n${sourceLine(book, quote.page)}`,
        }),
      });
    }
    // Tərif: «X: هو …», «أما X فهو في اللغة …»
    for (const unit of units) {
      const text = unit.words.join(" ");
      const definition = text.match(/^(?:و)?([\u0621-\u064A]{3,}(?:\s[\u0621-\u064A]{3,})?)\s*:\s*(?:هو|هي|هما)\s+(.{12,})$/)
        ?? text.match(/أما\s+([\u0621-\u064A]{3,})\s+فهو\s+في\s+اللغة/);
      if (!definition) continue;
      const term = definition[1];
      if (BORING.has(wordNorm(term))) continue;
      const hash = unit.hash;
      add({
        kind: "open", page: unit.page, sourceHash: hash, answerKey: `def:${normalizeArabic(term)}`,
        key: `open:${unit.page}:${hash}:def`,
        score: 3.4,
        build: () => ({
          type: "open",
          prompt: /اللغة/.test(text) ? `عرّف «${term}» لغةً واصطلاحًا.` : `عرّف «${term}» كما ورد في الكتاب.`,
          options: [],
          correctOptionIndex: -1,
          maxPoints: OPEN_POINTS,
          modelAnswer: `${text}\n\n${sourceLine(book, unit.page)}`,
        }),
      });
    }
    // Kitabın öz sualları (məs. «أسئلة» / «تمرينات» bölmələri olan səhifələrdə)
    const exercisePages = new Set(cleanPages.filter(({ text }) => /أسئلة|اسئلة|تمرينات|تمرين/.test(text)).map(({ page }) => page));
    for (const unit of units) {
      if (!exercisePages.has(unit.page)) continue;
      if (!unit.isQuestion || !unit.sentenceStart || unit.words.length < 4 || /^(?:لو|فان|فاذا|وان|واذا|وما|ولماذا|فما)$/.test(unit.norms[0]) || !/؟\s*$/.test(unit.words.join(" ")) && !/^(?:مثل|اذكر|عرف|بين)$/.test(unit.norms[0])) continue;
      const text = unit.words.join(" ").replace(/^(?:أسئلة|اسئلة|تمرينات|تمرين)\s*:?\s*/, "");
      if (text.split(" ").length < 4) continue;
      add({
        kind: "open", page: unit.page, sourceHash: unit.hash, answerKey: `q:${unit.hash}`,
        key: `open:${unit.page}:${unit.hash}:q`,
        score: 3.1,
        build: () => ({
          type: "open",
          prompt: text,
          options: [],
          correctOptionIndex: -1,
          maxPoints: OPEN_POINTS,
          modelAnswer: `هذا السؤال من أسئلة الكتاب نفسه؛ الجواب في شرح المؤلف قبله.\n\n${sourceLine(book, unit.page)}`,
        }),
      });
    }
    // Ehtiyat: mətndən bir parça izah etmək
    for (const unit of units) {
      if (unit.isQuestion || !unit.sentenceStart || unit.words.length < 10 || unit.quality < 0.93 || /^(?:و?ل?حديث|اخرجه|رواه|وقال|قال|انظر)$/.test(unit.norms[0])) continue;
      add({
        kind: "open", page: unit.page, sourceHash: unit.hash, answerKey: `explain:${unit.hash}`,
        key: `open:${unit.page}:${unit.hash}:explain`,
        score: 1 + unit.quality,
        build: () => ({
          type: "open",
          prompt: `اشرح العبارة الآتية بأسلوبك:\n«${excerpt(unit, 30)}»`,
          options: [],
          correctOptionIndex: -1,
          maxPoints: OPEN_POINTS,
          modelAnswer: `${unit.words.join(" ")}\n\n${sourceLine(book, unit.page)}`,
        }),
      });
    }
  }

  // Bölgü
  const choiceKinds = kinds.filter((kind) => kind !== "open");
  const openWanted = kinds.includes("open") ? (choiceKinds.length ? Math.max(1, Math.round(count * 0.3)) : count) : 0;
  const choiceWanted = count - openWanted;
  const weights: Record<GeneratedKind, number> = { cloze: 0.55, truefalse: 0.25, chapter: 0.2, open: 0 };
  const totalWeight = choiceKinds.reduce((sum, kind) => sum + weights[kind], 0) || 1;
  const targets = new Map<GeneratedKind, number>();
  let assigned = 0;
  choiceKinds.forEach((kind, index) => {
    const value = index === choiceKinds.length - 1 ? choiceWanted - assigned : Math.round((choiceWanted * weights[kind]) / totalWeight);
    targets.set(kind, Math.max(0, value));
    assigned += Math.max(0, value);
  });
  targets.set("open", openWanted);

  const jitter = new Map(candidates.map((candidate) => [candidate.key, random() * 0.6]));
  const ranked = [...candidates].sort((a, b) => (b.score + jitter.get(b.key)!) - (a.score + jitter.get(a.key)!) || a.key.localeCompare(b.key));
  const chosen: Candidate[] = [];
  const usedSources = new Set<string>();
  const usedAnswers = new Map<string, number>();
  const pageUse = new Map<number, number>();
  const take = (kind: GeneratedKind | null, limit: number) => {
    let taken = 0;
    while (taken < limit) {
      let best: Candidate | null = null;
      let bestValue = -Infinity;
      for (const candidate of ranked) {
        if (kind && candidate.kind !== kind) continue;
        if (!kind && !kinds.includes(candidate.kind)) continue;
        if (usedSources.has(candidate.sourceHash) || chosen.includes(candidate)) continue;
        const answerLimit = candidate.answerKey.startsWith("collectors") ? 1 : 1;
        if ((usedAnswers.get(candidate.answerKey) ?? 0) >= answerLimit) continue;
        // Səhifələr arasında bərabər paylanma
        const value = candidate.score + jitter.get(candidate.key)! - (pageUse.get(candidate.page) ?? 0) * 0.9;
        if (value > bestValue) { bestValue = value; best = candidate; }
      }
      if (!best) break;
      chosen.push(best);
      usedSources.add(best.sourceHash);
      usedAnswers.set(best.answerKey, (usedAnswers.get(best.answerKey) ?? 0) + 1);
      pageUse.set(best.page, (pageUse.get(best.page) ?? 0) + 1);
      taken += 1;
    }
    return taken;
  };
  let missingChoice = 0;
  // Az rast gələn növlər əvvəl seçilir ki, eyni cümlə «boşluq doldurma»ya getməsin.
  const takeOrder = (["chapter", "truefalse", "cloze"] as GeneratedKind[]).filter((kind) => (choiceKinds as GeneratedKind[]).includes(kind));
  for (const kind of takeOrder) missingChoice += (targets.get(kind) ?? 0) - take(kind, targets.get(kind) ?? 0);
  let missingOpen = openWanted - take("open", openWanted);
  // Çatışmayanları digər seçimli növlərdən, sonra istənilən seçilmiş növdən tamamla.
  for (const kind of ["cloze", "truefalse", "chapter"] as GeneratedKind[]) if (missingChoice > 0 && (choiceKinds as GeneratedKind[]).includes(kind)) missingChoice -= take(kind, missingChoice);
  if (missingOpen > 0 && choiceKinds.length) missingOpen -= take(null, missingOpen);
  if (missingChoice > 0 && kinds.includes("open")) missingChoice -= take("open", missingChoice);

  if (!chosen.length) {
    return { ok: false, error: topicStems.size
      ? "Bu mövzu və səhifələr üzrə sual hazırlamaq üçün kifayət qədər aydın mətn tapılmadı. Mövzu sözünü dəyişin və ya aralığı genişləndirin."
      : "Seçilmiş səhifələrdə sual hazırlamaq üçün kifayət qədər aydın mətn tapılmadı (OCR mətni zəif ola bilər). Başqa aralıq seçin." };
  }
  if (chosen.length < count) warnings.push(`İstənilən ${count} sual əvəzinə ${chosen.length} sual hazırlandı — bu səhifələrdə uyğun mətn azdır.`);

  const order: Record<GeneratedKind, number> = { cloze: 0, truefalse: 1, chapter: 2, open: 3 };
  const questions = chosen
    .sort((a, b) => (a.kind === "open" ? 1 : 0) - (b.kind === "open" ? 1 : 0) || a.page - b.page || order[a.kind] - order[b.kind] || a.key.localeCompare(b.key))
    .map((candidate) => {
      const chapter = realChapterAt(book, candidate.page);
      return { key: candidate.key, kind: candidate.kind, page: candidate.page, printedPage: printed(book, candidate.page), chapterTitle: chapter?.title ?? null, ...candidate.build() };
    });
  return { ok: true, questions, warnings };
}
