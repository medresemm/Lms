// İmtahan və testlər: sual növü (seçimli / açıq sual), testin dili (Azərbaycanca / Ərəbcə),
// açıq cavablar və müəllim yoxlaması.
//
// Baza sxemi DƏYİŞMİR (miqrasiya tələb olunmur):
//  • Sualın əlavə məlumatı (növ, maks. bal, nümunə cavab, testin dili) həmin sualın `lms_exam_options`
//    cədvəlindəki xüsusi, gizli sətrində saxlanılır: position = -1, is_correct = false, label = JSON.
//    Bu sətir heç vaxt variant kimi göstərilmir və hesablamaya qatılmır. Köhnə testlərdə belə sətir yoxdur —
//    onlar avtomatik "seçimli, 1 bal, Azərbaycanca" sayılır.
//  • Açıq cavabların mətni `lms_exam_submissions.answers` (jsonb) içində sual id-si ilə mətn kimi,
//    müəllim yoxlaması isə eyni JSON-da `_review` açarı altında saxlanılır. Seçimli cavablar əvvəlki kimi
//    rəqəm (variant id) olaraq qalır.
// Ərəb mətni (hərəkələr daxil) olduğu kimi saxlanılır — yalnız kənar boşluqlar silinir.

export const EXAM_META_POSITION = -1;
const META_MARKER = "__examQuestionMeta";
export const REVIEW_KEY = "_review";

export type ExamQuestionKind = "choice" | "open";
export type ExamLanguage = "az" | "ar";

export const OPEN_QUESTION_DEFAULT_POINTS = 5;
export const OPEN_QUESTION_MAX_POINTS = 100;
export const OPEN_ANSWER_MAX_LENGTH = 10000;
export const MODEL_ANSWER_MAX_LENGTH = 4000;
export const REVIEW_COMMENT_MAX_LENGTH = 2000;

export interface ExamQuestionMeta {
  kind: ExamQuestionKind;
  maxPoints: number;
  modelAnswer: string | null;
  language: ExamLanguage;
}

export const DEFAULT_QUESTION_META: ExamQuestionMeta = { kind: "choice", maxPoints: 1, modelAnswer: null, language: "az" };

export function encodeQuestionMeta(meta: ExamQuestionMeta) {
  return JSON.stringify({
    [META_MARKER]: 1,
    kind: meta.kind,
    maxPoints: meta.maxPoints,
    modelAnswer: meta.modelAnswer,
    language: meta.language,
  });
}

export function decodeQuestionMeta(label: string | null | undefined): ExamQuestionMeta | null {
  if (!label || !label.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(label) as Record<string, unknown>;
    if (!parsed || parsed[META_MARKER] !== 1) return null;
    const kind: ExamQuestionKind = parsed.kind === "open" ? "open" : "choice";
    const rawPoints = Number(parsed.maxPoints);
    const maxPoints = kind === "choice"
      ? 1
      : Number.isInteger(rawPoints) && rawPoints >= 1 && rawPoints <= OPEN_QUESTION_MAX_POINTS ? rawPoints : OPEN_QUESTION_DEFAULT_POINTS;
    const modelAnswer = typeof parsed.modelAnswer === "string" && parsed.modelAnswer.trim() ? parsed.modelAnswer : null;
    const language: ExamLanguage = parsed.language === "ar" ? "ar" : "az";
    return { kind, maxPoints, modelAnswer, language };
  } catch {
    return null;
  }
}

export function isMetaOption(option: { position: number; label: string }) {
  return option.position === EXAM_META_POSITION && decodeQuestionMeta(option.label) !== null;
}

/** Sualın variantlarını əsl variantlara və gizli meta sətrinə ayırır. */
export function splitQuestionOptions<T extends { position: number; label: string }>(options: T[]) {
  let meta: ExamQuestionMeta | null = null;
  const choices: T[] = [];
  for (const option of options) {
    if (option.position === EXAM_META_POSITION) {
      const decoded = decodeQuestionMeta(option.label);
      if (decoded) { meta = decoded; continue; }
    }
    choices.push(option);
  }
  return { meta: meta ?? DEFAULT_QUESTION_META, choices };
}

/** Testin dili: suallardan hər hansı biri ərəbcə işarələnibsə, bütün test ərəbcədir. */
export function examLanguageFromMetas(metas: ExamQuestionMeta[]): ExamLanguage {
  return metas.some((meta) => meta.language === "ar") ? "ar" : "az";
}

/** Meta sətri lazımdırmı? Köhnə formatla tam uyğun qalmaq üçün adi Azərbaycanca seçimli suala sətir yazılmır. */
export function needsMetaRow(meta: ExamQuestionMeta) {
  return meta.kind === "open" || meta.language === "ar";
}

// ---------------------------------------------------------------------------
// Sual daxil etmə (validasiya + normallaşdırma)
// ---------------------------------------------------------------------------

export class ExamValidationError extends Error {}

export interface ExamQuestionInputLike {
  prompt: string;
  options?: string[];
  correctOptionIndex?: number;
  type?: ExamQuestionKind;
  maxPoints?: number | null;
  modelAnswer?: string | null;
}

export interface NormalizedExamQuestion {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  meta: ExamQuestionMeta;
}

export function normalizeExamQuestionInputs(questions: ExamQuestionInputLike[], language: ExamLanguage): NormalizedExamQuestion[] {
  return questions.map((question) => {
    const prompt = question.prompt.trim();
    if (!prompt) throw new ExamValidationError("Sual mətni boş qala bilməz.");
    if (question.type === "open") {
      const rawPoints = question.maxPoints ?? OPEN_QUESTION_DEFAULT_POINTS;
      if (!Number.isInteger(rawPoints) || rawPoints < 1 || rawPoints > OPEN_QUESTION_MAX_POINTS) {
        throw new ExamValidationError(`Açıq sualın maksimum balı 1–${OPEN_QUESTION_MAX_POINTS} aralığında tam ədəd olmalıdır.`);
      }
      const modelAnswer = question.modelAnswer?.trim() || null;
      if (modelAnswer && modelAnswer.length > MODEL_ANSWER_MAX_LENGTH) {
        throw new ExamValidationError(`Nümunə cavab ${MODEL_ANSWER_MAX_LENGTH} simvoldan uzun ola bilməz.`);
      }
      return { prompt, options: [], correctOptionIndex: -1, meta: { kind: "open", maxPoints: rawPoints, modelAnswer, language } };
    }
    const options = (question.options ?? []).map((option) => option.trim());
    if (options.length < 2 || options.length > 8) throw new ExamValidationError("Seçimli sualda 2–8 cavab variantı olmalıdır.");
    if (options.some((option) => !option)) throw new ExamValidationError("Sual və cavab variantları boş qala bilməz.");
    const duplicateOptions = new Set(options.map((option) => option.toLocaleLowerCase("az")));
    if (duplicateOptions.size !== options.length) throw new ExamValidationError("Bir sualın cavab variantları təkrarlana bilməz.");
    const correctOptionIndex = question.correctOptionIndex ?? -1;
    if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= options.length) {
      throw new ExamValidationError("Hər sual üçün düzgün cavab variantı seçilməlidir.");
    }
    return { prompt, options, correctOptionIndex, meta: { kind: "choice", maxPoints: 1, modelAnswer: null, language } };
  });
}

// ---------------------------------------------------------------------------
// Cavablar və yoxlama
// ---------------------------------------------------------------------------

export interface ExamOpenGrade {
  points: number;
  comment: string | null;
}

export interface ExamReview {
  grades: Record<string, ExamOpenGrade>;
  reviewedAt: string;
  reviewedBy: string;
}

export interface ParsedExamAnswers {
  choices: Record<string, number>;
  open: Record<string, string>;
  review: ExamReview | null;
}

export function parseStoredAnswers(raw: unknown): ParsedExamAnswers {
  const choices: Record<string, number> = {};
  const open: Record<string, string> = {};
  let review: ExamReview | null = null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { choices, open, review };
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key === REVIEW_KEY) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const candidate = value as Record<string, unknown>;
        const grades: Record<string, ExamOpenGrade> = {};
        if (candidate.grades && typeof candidate.grades === "object") {
          for (const [questionId, grade] of Object.entries(candidate.grades as Record<string, unknown>)) {
            if (!/^\d+$/.test(questionId) || !grade || typeof grade !== "object") continue;
            const points = Number((grade as Record<string, unknown>).points);
            const comment = (grade as Record<string, unknown>).comment;
            if (!Number.isFinite(points) || points < 0) continue;
            grades[questionId] = { points, comment: typeof comment === "string" && comment.trim() ? comment : null };
          }
        }
        review = {
          grades,
          reviewedAt: typeof candidate.reviewedAt === "string" ? candidate.reviewedAt : new Date(0).toISOString(),
          reviewedBy: typeof candidate.reviewedBy === "string" ? candidate.reviewedBy : "",
        };
      }
      continue;
    }
    if (!/^\d+$/.test(key)) continue;
    if (typeof value === "number" && Number.isInteger(value)) choices[key] = value;
    else if (typeof value === "string") open[key] = value;
  }
  return { choices, open, review };
}

export function buildStoredAnswers(parsed: ParsedExamAnswers): Record<string, unknown> {
  return {
    ...parsed.choices,
    ...parsed.open,
    ...(parsed.review ? { [REVIEW_KEY]: parsed.review } : {}),
  };
}

export interface ScoringQuestion {
  id: number;
  kind: ExamQuestionKind;
  maxPoints: number;
  correctOptionId: number | null;
}

export type ExamGradingStatus = "graded" | "pending_review";

export interface ExamScore {
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  score: number;
  maxScore: number;
  autoScore: number;
  manualScore: number;
  openQuestionCount: number;
  status: ExamGradingStatus;
}

const roundPoints = (value: number) => Math.round(value * 100) / 100;

/**
 * Yekun nəticə: seçimli suallar avtomatik (hər biri 1 bal), açıq suallar müəllimin verdiyi bal.
 * Açıq sualların hamısı qiymətləndirilməyibsə status "pending_review" olur.
 */
export function computeExamScore(questions: ScoringQuestion[], answers: ParsedExamAnswers): ExamScore {
  let correctCount = 0;
  let autoScore = 0;
  let manualScore = 0;
  let maxScore = 0;
  let openQuestionCount = 0;
  let ungraded = 0;
  for (const question of questions) {
    const key = String(question.id);
    if (question.kind === "open") {
      openQuestionCount += 1;
      maxScore += question.maxPoints;
      const grade = answers.review?.grades[key];
      if (grade) manualScore += Math.min(question.maxPoints, Math.max(0, grade.points));
      else ungraded += 1;
      continue;
    }
    maxScore += 1;
    if (question.correctOptionId !== null && answers.choices[key] === question.correctOptionId) {
      correctCount += 1;
      autoScore += 1;
    }
  }
  const score = roundPoints(autoScore + manualScore);
  return {
    correctCount,
    totalQuestions: questions.length,
    percentage: maxScore ? Math.round((score / maxScore) * 100) : 0,
    score,
    maxScore,
    autoScore,
    manualScore: roundPoints(manualScore),
    openQuestionCount,
    status: ungraded > 0 ? "pending_review" : "graded",
  };
}

/** Tələbəyə yoxlama bitənə qədər nəticə göstərilmir. */
export function maskPendingScore(score: ExamScore): ExamScore {
  if (score.status !== "pending_review") return score;
  return { ...score, correctCount: 0, percentage: 0, score: 0, autoScore: 0, manualScore: 0 };
}

export interface GradeInput {
  points: number;
  comment?: string | null;
}

/** Müəllimin açıq cavablara verdiyi balları yoxlayır və mövcud yoxlama ilə birləşdirir. */
export function applyOpenGrades(
  questions: ScoringQuestion[],
  answers: ParsedExamAnswers,
  grades: Record<string, GradeInput>,
  reviewerId: string,
  now = new Date(),
): ParsedExamAnswers {
  const openQuestions = new Map(questions.filter((question) => question.kind === "open").map((question) => [String(question.id), question]));
  if (!openQuestions.size) throw new ExamValidationError("Bu testdə açıq sual yoxdur.");
  const merged: Record<string, ExamOpenGrade> = { ...(answers.review?.grades ?? {}) };
  const entries = Object.entries(grades);
  if (!entries.length) throw new ExamValidationError("Ən azı bir açıq suala bal verin.");
  for (const [questionId, grade] of entries) {
    const question = openQuestions.get(questionId);
    if (!question) throw new ExamValidationError("Bal yalnız bu testin açıq suallarına verilə bilər.");
    const points = Number(grade.points);
    if (!Number.isFinite(points) || points < 0 || points > question.maxPoints) {
      throw new ExamValidationError(`Bal 0 ilə ${question.maxPoints} arasında olmalıdır.`);
    }
    if (Math.round(points * 100) !== points * 100) throw new ExamValidationError("Bal ən çox iki onluq rəqəmlə yazıla bilər.");
    const comment = grade.comment?.trim() || null;
    if (comment && comment.length > REVIEW_COMMENT_MAX_LENGTH) throw new ExamValidationError(`Şərh ${REVIEW_COMMENT_MAX_LENGTH} simvoldan uzun ola bilməz.`);
    merged[questionId] = { points, comment };
  }
  // Silinmiş/dəyişdirilmiş suallara aid köhnə ballar saxlanılmır.
  for (const key of Object.keys(merged)) if (!openQuestions.has(key)) delete merged[key];
  return { ...answers, review: { grades: merged, reviewedAt: now.toISOString(), reviewedBy: reviewerId } };
}

/** Tələbənin göndərdiyi cavabları yoxlayır. Vaxt bitibsə, cavabsız suallar boş qala bilər. */
export function validateSubmissionAnswers(
  questions: Array<{ id: number; kind: ExamQuestionKind; optionIds: Set<number> }>,
  choices: Record<string, number>,
  open: Record<string, string>,
  expired: boolean,
): { ok: true; choices: Record<string, number>; open: Record<string, string> } | { ok: false; error: string } {
  const byId = new Map(questions.map((question) => [String(question.id), question]));
  const cleanChoices: Record<string, number> = {};
  const cleanOpen: Record<string, string> = {};
  for (const [questionId, optionId] of Object.entries(choices)) {
    const question = byId.get(questionId);
    if (!question) return { ok: false, error: "Bütün sualları cavablandırın və yalnız bu testin suallarını göndərin." };
    if (question.kind !== "choice" || !question.optionIds.has(optionId)) return { ok: false, error: "Cavab variantlarından biri bu testə aid deyil." };
    cleanChoices[questionId] = optionId;
  }
  for (const [questionId, text] of Object.entries(open)) {
    const question = byId.get(questionId);
    if (!question) return { ok: false, error: "Bütün sualları cavablandırın və yalnız bu testin suallarını göndərin." };
    if (question.kind !== "open") return { ok: false, error: "Seçimli suala mətn cavabı göndərilə bilməz." };
    if (typeof text !== "string") return { ok: false, error: "Açıq sualın cavabı mətn olmalıdır." };
    const trimmed = text.trim();
    if (trimmed.length > OPEN_ANSWER_MAX_LENGTH) return { ok: false, error: `Açıq cavab ${OPEN_ANSWER_MAX_LENGTH} simvoldan uzun ola bilməz.` };
    if (trimmed) cleanOpen[questionId] = trimmed;
  }
  if (!expired) {
    const missing = questions.some((question) => question.kind === "open" ? !cleanOpen[String(question.id)] : cleanChoices[String(question.id)] === undefined);
    if (missing) return { ok: false, error: "Bütün sualları cavablandırın və yalnız bu testin suallarını göndərin." };
  }
  return { ok: true, choices: cleanChoices, open: cleanOpen };
}

/** Axtarış üçün ərəb mətnini sadələşdirir (hərəkələr, təthil, əlif formaları). Saxlanılan mətnə toxunmur. */
export function arabicSearchKey(value: string) {
  return value
    .normalize("NFC")
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

export const ARABIC_LETTERS = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
