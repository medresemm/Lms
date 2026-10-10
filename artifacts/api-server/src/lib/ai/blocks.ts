// Mədinə AI — strukturlu cavab blokları.
//
// Daxili cavablar (Akademiya məlumatları, bələdçi, dərs kitabları) brauzerə həm düz mətn (`reply` — köhnə
// müştərilər və tarixçə üçün), həm də kart blokları (`blocks`) kimi göndərilir. Brauzer blokları
// Şamilə/Dorar kartları ilə eyni üslubda göstərir. Bloklarda yalnız insan dilində mətn olur: sahə adı,
// identifikator və ya texniki söz yoxdur.
import type { AiReply } from "./aiProvider.js";

export type AiTone = "default" | "good" | "warn" | "muted";

export interface AiRow { label: string; value: string }
export interface AiItem {
  title: string;
  /** Başlığın altındakı qısa izah. */
  detail?: string;
  /** Kiçik xırda məlumatlar (saat, müəllim, tarix…). */
  meta?: string[];
  badge?: { text: string; tone?: AiTone };
  /** Saytdaxili və ya xarici keçid (məs. «Oxu», «Dərsə qoşul»). */
  action?: { label: string; href: string };
}

export type AiBlock =
  | { type: "text"; text: string; tone?: AiTone }
  | { type: "card"; title?: string; subtitle?: string; badge?: { text: string; tone?: AiTone }; rows?: AiRow[]; items?: AiItem[]; note?: string }
  | { type: "steps"; title?: string; steps: string[]; tips?: string[] }
  | { type: "table"; title?: string; columns: string[]; rows: string[][]; note?: string };

/** Cavab kartının başlığı üçün ikon növləri (brauzer bunları ikonlara çevirir). */
export const FRAME_ICONS = [
  "student", "students", "teacher", "staff", "stats", "course", "schedule", "grades", "attendance", "assignment", "exam",
  "application", "notice", "resource", "library", "book", "guide", "question", "excuse", "search", "help", "info", "warn",
] as const;
export type AiFrameIcon = typeof FRAME_ICONS[number];

/**
 * Daxili cavabın vahid kartı: başlıq sətri (ikon + ad), istəyə görə alt başlıq və nişan (semestr, say).
 * Bütün bloklar bu kartın içində göstərilir.
 */
export interface AiFrame {
  icon: AiFrameIcon;
  title: string;
  subtitle?: string;
  badge?: { text: string; tone?: AiTone };
  tone?: AiTone;
}

export interface AiStructuredReply extends AiReply {
  blocks?: AiBlock[];
  frame?: AiFrame;
}

const MAX_BLOCKS = 24;
const MAX_ITEMS = 60;

// ---------------------------------------------------------------------------
// Bloklar → düz mətn (köhnə müştərilər, kopyalama, tarixçə)

function itemLine(item: AiItem) {
  const tail = [item.detail, ...(item.meta ?? []), item.badge?.text].filter(Boolean).join(" · ");
  const link = item.action ? ` ${item.action.href}` : "";
  return `• ${item.title}${tail ? ` — ${tail}` : ""}${link}`;
}

export function blocksToText(blocks: AiBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    const lines: string[] = [];
    if (block.type === "text") lines.push(block.text);
    if (block.type === "card") {
      if (block.title) lines.push(`${block.title}${block.badge ? ` (${block.badge.text})` : ""}${block.subtitle ? ` — ${block.subtitle}` : ""}`);
      for (const row of block.rows ?? []) lines.push(`• ${row.label}: ${row.value}`);
      for (const item of block.items ?? []) lines.push(itemLine(item));
      if (block.note) lines.push(block.note);
    }
    if (block.type === "steps") {
      if (block.title) lines.push(`${block.title}:`);
      block.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
      for (const tip of block.tips ?? []) lines.push(`• ${tip}`);
    }
    if (block.type === "table") {
      if (block.title) lines.push(`${block.title}:`);
      for (const row of block.rows) lines.push(`• ${row.map((cell, index) => (index === 0 ? cell : `${block.columns[index]}: ${cell}`)).join(" · ")}`);
      if (block.note) lines.push(block.note);
    }
    if (lines.length) parts.push(lines.join("\n"));
  }
  return parts.join("\n\n").trim();
}

/** Bloklardan cavab: `reply` avtomatik düz mətn kimi qurulur. */
export function blockReply(blocks: Array<AiBlock | null | undefined | false>, suggestions: string[] = []): AiStructuredReply {
  const clean = blocks.filter((block): block is AiBlock => Boolean(block)).slice(0, MAX_BLOCKS);
  return { reply: blocksToText(clean), suggestions: suggestions.slice(0, 4), blocks: clean };
}

// ---------------------------------------------------------------------------
// Köhnə düz mətn cavabları → bloklar (əl ilə yazılmamış bütün daxili cavablar üçün)

const BULLET = /^\s*[•\-–]\s+/;
const MORE = /^…\s*və daha (\d+)/;

function parseItem(raw: string): AiItem | AiRow {
  const text = raw.replace(BULLET, "").trim();
  const dash = text.indexOf(" — ");
  if (dash > 0) {
    const [first, ...rest] = text.slice(dash + 3).split(" · ").map((part) => part.trim()).filter(Boolean);
    const title = text.slice(0, dash).trim();
    // «T0013 — Əli Məmmədov · …»: başlıq adam adı olsun, tələbə nömrəsi kiçik məlumat kimi.
    if (/^T\d{3,}$/.test(title) && first) return { title: first, meta: [title, ...rest] };
    return { title, detail: first, meta: rest.length ? rest : undefined };
  }
  // «Etiket: dəyər» — qısa etiket varsa sətir kimi.
  const colon = /^([^:]{2,32}):\s+(.+)$/.exec(text);
  if (colon && !/https?$/i.test(colon[1])) return { label: colon[1].trim(), value: colon[2].trim() };
  const [title, ...meta] = text.split(" · ").map((part) => part.trim()).filter(Boolean);
  return { title, meta: meta.length ? meta : undefined };
}

function isRow(value: AiItem | AiRow): value is AiRow {
  return "label" in value;
}

// «Etiket: dəyər» sətri (qısa etiket) — kartda açar–dəyər sətri kimi göstərilir.
const KEY_VALUE = /^([^:•?!]{2,44}):\s+(\S.{0,240})$/;

function keyValue(line: string): AiRow | null {
  const match = KEY_VALUE.exec(line.trim());
  if (!match || /https?$/i.test(match[1]) || /\.\s/.test(match[1])) return null;
  return { label: match[1].trim(), value: match[2].trim() };
}

export function textToBlocks(text: string): AiBlock[] {
  const sections = text.replace(/\r/g, "").split(/\n\s*(?:— — —\s*)?\n/).map((section) => section.trim()).filter(Boolean);
  const blocks: AiBlock[] = [];
  for (const section of sections) {
    const lines = section.split("\n").map((line) => line.replace(/\s+$/, "")).filter((line) => line.trim());
    const firstBullet = lines.findIndex((line) => BULLET.test(line) || /^\d+\.\s/.test(line));
    if (firstBullet < 0) {
      // Bütün sətirlər (başlıqdan sonra) «Etiket: dəyər»dirsə — açar–dəyər kartı.
      const head = lines.length > 1 && !keyValue(lines[0]) ? lines[0] : undefined;
      const rest = head ? lines.slice(1) : lines;
      const rows = rest.map(keyValue);
      if (rest.length && rows.every(Boolean) && (rows.length > 1 || head)) {
        blocks.push({ type: "card", title: head?.replace(/:\s*$/, ""), rows: rows as AiRow[] });
      } else {
        blocks.push({ type: "text", text: lines.join("\n") });
      }
      continue;
    }
    const lead = lines.slice(0, firstBullet);
    const body = lines.slice(firstBullet);
    // Nömrələnmiş addımlar.
    if (/^\d+\.\s/.test(body[0])) {
      const steps = body.filter((line) => /^\d+\.\s/.test(line)).map((line) => line.replace(/^\d+\.\s+/, ""));
      const tips = body.filter((line) => BULLET.test(line)).map((line) => line.replace(BULLET, ""));
      if (lead.length > 1) blocks.push({ type: "text", text: lead.slice(0, -1).join("\n") });
      blocks.push({ type: "steps", title: lead.length ? lead[lead.length - 1].replace(/:\s*$/, "") : undefined, steps, tips: tips.length ? tips : undefined });
      continue;
    }
    const rows: AiRow[] = [];
    const items: AiItem[] = [];
    const notes: string[] = [];
    // Giriş sətirləri: «…:» ilə bitən və ya adi cümlə başlıqdır; «Etiket: dəyər» sətirləri kartın açar–dəyər sətirləridir.
    const leadText: string[] = [];
    const leadRows: AiRow[] = [];
    const plainIndexes = lead.map((line, index) => (/:\s*$/.test(line.trim()) || !keyValue(line) ? index : -1)).filter((index) => index >= 0);
    const headingIndex = plainIndexes.length ? plainIndexes[plainIndexes.length - 1] : -1;
    let heading: string | undefined = headingIndex >= 0 ? lead[headingIndex].trim() : undefined;
    lead.forEach((line, index) => {
      if (index === headingIndex) return;
      const pair = keyValue(line);
      if (pair && !/:\s*$/.test(line.trim())) leadRows.push(pair);
      else leadText.push(line.trim());
    });
    // Başlıq yoxdursa və tək «Etiket: dəyər» varsa (məs. «Müəllim sayı: 4»), o başlıq olur.
    if (!heading && leadRows.length === 1) {
      heading = `${leadRows[0].label}: ${leadRows[0].value}`;
      leadRows.length = 0;
    }
    rows.push(...leadRows);
    for (const line of body) {
      if (BULLET.test(line)) {
        const parsed = parseItem(line);
        if (isRow(parsed)) rows.push(parsed);
        else items.push(parsed);
      } else if (MORE.test(line.trim())) {
        notes.push(line.trim());
      } else if (/^\s{2,}/.test(line) && (items.length || rows.length)) {
        // Əvvəlki elementin davamı (məs. izah və ya link).
        const extra = line.trim();
        const target = items[items.length - 1];
        if (target) {
          const link = /^Link:\s*(\S+)$/i.exec(extra);
          if (link) target.action = { label: "Linki aç", href: link[1] };
          else target.detail = target.detail ? `${target.detail} · ${extra}` : extra;
        } else rows[rows.length - 1].value += ` ${extra}`;
      } else {
        notes.push(line.trim());
      }
    }
    if (leadText.length) blocks.push({ type: "text", text: leadText.join("\n") });
    blocks.push({
      type: "card",
      title: heading?.replace(/:\s*$/, ""),
      rows: rows.length ? rows : undefined,
      items: items.length ? items.slice(0, MAX_ITEMS) : undefined,
      note: notes.length ? notes.join(" ") : undefined,
    });
  }
  return blocks.slice(0, MAX_BLOCKS);
}

/** Daxili cavabda blok yoxdursa, düz mətndən qurulur. */
export function ensureBlocks<T extends AiReply & { blocks?: AiBlock[] }>(result: T): T & { blocks: AiBlock[] } {
  if (Array.isArray(result.blocks) && result.blocks.length) return result as T & { blocks: AiBlock[] };
  return { ...result, blocks: textToBlocks(result.reply) };
}

// ---------------------------------------------------------------------------
// Vahid cavab kartı (frame): başlıq ikonu + adı

const FRAME_TITLES: Record<AiFrameIcon, string> = {
  student: "Tələbə məlumatı",
  students: "Tələbələr",
  teacher: "Müəllimlər",
  staff: "Heyət",
  stats: "Statistika",
  course: "Dərslər",
  schedule: "Dərs cədvəli",
  grades: "Qiymətlər",
  attendance: "Davamiyyət",
  assignment: "Tapşırıqlar",
  exam: "İmtahan və testlər",
  application: "Müraciətlər",
  notice: "Elan və bildirişlər",
  resource: "Dərs materialları",
  library: "Kitabxana",
  book: "Dərs kitabları",
  guide: "Saytdan istifadə",
  question: "Sual-cavab",
  excuse: "Üzrlər",
  search: "Axtarış nəticələri",
  help: "Mədinə AI",
  info: "Məlumat",
  warn: "Diqqət",
};

/** Başlıqsız frame: yalnız ikon növü verilir, ad standart olur. */
export function frameOf(icon: AiFrameIcon, extra: Partial<Omit<AiFrame, "icon">> = {}): AiFrame {
  return { icon, title: FRAME_TITLES[icon], ...extra };
}

function fold(value: string) {
  return value
    .toLocaleLowerCase("az-AZ")
    .replace(/ə/g, "e").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g");
}

// Sıra vacibdir: daha dəqiq mövzular əvvəl yoxlanılır.
const FRAME_RULES: Array<[AiFrameIcon, RegExp]> = [
  ["warn", /icaze(si)? (teleb|lazim)|aciq deyil|mexfidir|baglidir|sondurulub/],
  ["book", /kecceyiniz kitab|ders kitab|kitab teyin|kitabi:/],
  ["library", /kitabxana|kitabinda|kitabda/],
  ["schedule", /ders cedvel|cedvel|ders gunleri|bu gun dersin|dersiniz (yox|var)|dersiniz/],
  ["attendance", /qayib|davamiyyet|buraxmisiniz|istirak/],
  ["grades", /qiymet|orta bal|ortalama/],
  ["exam", /imtahan|test|yoxlanilir/],
  ["assignment", /tapsiriq/],
  ["application", /muraciet/],
  ["excuse", /uzr/],
  ["notice", /elan|bildiris/],
  ["question", /sual-cavab|cavabsiz sual/],
  ["resource", /material|resurs/],
  ["staff", /heyet/],
  ["teacher", /muellim/],
  ["stats", /statistika|umumi gosterici/],
  ["students", /telebe/],
  ["course", /ders|fenn|kurs/],
];

/** Bloklardan cavabın mövzusunu təxmin edir (frame verilməyən cavablar üçün). */
export function inferFrame(blocks: AiBlock[], reply = ""): AiFrame {
  const firstCard = blocks.find((block) => block.type !== "text");
  if (blocks.length && blocks.every((block) => block.type === "steps")) {
    const first = blocks[0] as Extract<AiBlock, { type: "steps" }>;
    return frameOf("guide", first.title ? { subtitle: first.title } : {});
  }
  const lead = blocks.filter((block) => block.type === "text").map((block) => (block as { text: string }).text).join(" ");
  const titles = blocks.map((block) => (block.type === "text" ? "" : block.title ?? "")).join(" ");
  const haystack = fold(`${lead} ${titles}`.trim() || reply.slice(0, 400));
  const hasData = blocks.some((block) => (block.type === "card" && Boolean(block.rows?.length)) || block.type === "table");
  if (/basa dusmedim|tapa bilmedim|tapilmadi|tapmadim/.test(haystack) && !hasData && !/nezerde tuturdunuz|kitabxana|kitabinda/.test(haystack)) {
    return frameOf("info", { title: "Nəticə tapılmadı" });
  }
  if (/nezerde tuturdunuz/.test(haystack)) return frameOf("search", { title: "Bunu nəzərdə tuturdunuz?" });
  if (/uygun netice tapdim/.test(haystack)) return frameOf("search");
  if (/salam|men medine ai|meden sorusa|numuneler/.test(haystack)) return frameOf("help");
  if (/deymez/.test(haystack)) return frameOf("help");
  for (const [icon, pattern] of FRAME_RULES) if (pattern.test(haystack)) return frameOf(icon, icon === "warn" ? { title: "İcazə yoxdur", tone: "warn" } : {});
  return frameOf("info");
}

/** Bir neçə mövzu birləşəndə: hamısı eynidirsə həmin, deyilsə ümumi «Sizin məlumatlarınız». */
export function mergeFrames(frames: Array<AiFrame | undefined>): AiFrame | undefined {
  const clean = frames.filter((frame): frame is AiFrame => Boolean(frame));
  if (!clean.length) return undefined;
  if (clean.every((frame) => frame.icon === clean[0].icon)) return clean[0];
  return { icon: "info", title: clean.map((frame) => frame.title).slice(0, 3).join(" · ") };
}

/** Daxili cavab: bloklar + vahid kart başlığı (verilməyibsə təxmin edilir). */
export function finalizeInternal<T extends AiReply & { blocks?: AiBlock[]; frame?: AiFrame }>(result: T, frame?: AiFrame): T & { blocks: AiBlock[]; frame: AiFrame } {
  const withBlocks = ensureBlocks(result);
  return { ...withBlocks, frame: frame ?? withBlocks.frame ?? inferFrame(withBlocks.blocks, withBlocks.reply) };
}

/** Cavaba frame əlavə edir (əgər artıq yoxdursa). */
export function framed<T extends AiReply & { frame?: AiFrame }>(frame: AiFrame, result: T): T & { frame: AiFrame } {
  return { ...result, frame: result.frame ?? frame };
}

// ---------------------------------------------------------------------------
// Dil yoxlaması (testlər üçün): texniki söz, sahə adı, ingiliscə söz olmamalıdır.

export const FORBIDDEN_COPY = [
  /\bLMS\b/i, /\bnull\b/, /\bundefined\b/, /\bNaN\b/, /\[object /, /\btrue\b/, /\bfalse\b/,
  /\b(?:courseId|termNumber|profileId|studentNumber|userId|clerk\w*|status|submission\w*|resourceId)\b/,
  /\b(?:graded|pending|approved|rejected|resubmission_requested|open|closed|present|absent|late|excused)\b/,
  /\bID\b/, /\bN\/A\b/, /\bResult\b/i, /\bNəticə:\s*\d+\s*qeyd/,
];

export function copyProblems(value: unknown): string[] {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  // JSON açarları (type, title, rows…) yoxlanmır — yalnız dəyərlər.
  const values = typeof value === "string" ? [text] : collectStrings(value);
  const problems: string[] = [];
  for (const item of values) {
    for (const pattern of FORBIDDEN_COPY) if (pattern.test(item)) problems.push(`${pattern} → «${item.slice(0, 80)}»`);
  }
  return problems;
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      // Keçidlər və ton dəyərləri istifadəçiyə mətn kimi göstərilmir.
      if (key === "href" || key === "tone" || key === "type") continue;
      collectStrings(item, out);
    }
  }
  return out;
}
