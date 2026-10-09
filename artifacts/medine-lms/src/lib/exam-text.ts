// İmtahan və testlər: ərəbcə mətn istiqaməti, sual qaralamaları və nəticə mətni (UI-dan asılı olmayan köməkçilər).
import type { CSSProperties } from 'react';

export type ExamLanguage = 'az' | 'ar';
export type ExamQuestionKind = 'choice' | 'open';

export const arabicExamFont = '"Amiri", "Noto Naskh Arabic", "Scheherazade New", "Traditional Arabic", "Geeza Pro", serif';
/** Latın hərfləri əsas şriftlə, ərəb hərfləri isə ərəb şrifti ilə göstərilsin (qarışıq mətn üçün). */
export const mixedExamFont = `"DM Sans", ${arabicExamFont}`;

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function hasArabic(value: string | null | undefined) {
  return Boolean(value && ARABIC.test(value));
}

export interface ExamTextProps {
  dir: 'rtl' | 'auto';
  lang?: string;
  style: CSSProperties;
}

/**
 * Sual/variant/cavab sahəsi üçün istiqamət: ərəbcə testdə hər şey sağdan sola,
 * digər testlərdə isə hər sahə öz mətninə görə (dir="auto", hər abzas ayrıca — unicode-bidi: plaintext).
 */
export function examTextProps(language: ExamLanguage | undefined, text?: string | null): ExamTextProps {
  if (language === 'ar') return { dir: 'rtl', lang: 'ar', style: { fontFamily: arabicExamFont, unicodeBidi: 'plaintext', fontSize: '1.06em', lineHeight: 1.9 } };
  return { dir: 'auto', ...(hasArabic(text) ? { lang: 'ar' } : {}), style: { fontFamily: mixedExamFont, unicodeBidi: 'plaintext' } };
}

export type QuestionDraft = {
  type: ExamQuestionKind;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  maxPoints: string;
  modelAnswer: string;
};

export const OPEN_DEFAULT_POINTS = 5;

export const blankQuestion = (type: ExamQuestionKind = 'choice'): QuestionDraft => ({
  type,
  prompt: '',
  options: type === 'choice' ? ['', ''] : [],
  correctOptionIndex: 0,
  maxPoints: String(OPEN_DEFAULT_POINTS),
  modelAnswer: '',
});

/** Sualın növünü dəyişəndə variantlar itməsin deyə saxlanılır, lakin göndərilmir. */
export function switchQuestionType(question: QuestionDraft, type: ExamQuestionKind): QuestionDraft {
  if (question.type === type) return question;
  return { ...question, type, options: type === 'choice' && question.options.length < 2 ? [...question.options, '', ''].slice(0, Math.max(2, question.options.length)) : question.options };
}

export type ExamQuestionPayload =
  | { type: 'choice'; prompt: string; options: string[]; correctOptionIndex: number }
  | { type: 'open'; prompt: string; options: string[]; maxPoints: number; modelAnswer: string | null };

/** Qaralamaları yoxlayır; xəta varsa Azərbaycanca mətn, yoxdursa göndəriləcək suallar qaytarır. Ərəb mətni (hərəkələr) dəyişdirilmir — yalnız kənar boşluqlar silinir. */
export function prepareExamQuestions(questions: QuestionDraft[]): { ok: true; questions: ExamQuestionPayload[] } | { ok: false; error: string } {
  if (!questions.length) return { ok: false, error: 'Ən azı bir sual əlavə edin.' };
  const result: ExamQuestionPayload[] = [];
  for (const [index, question] of questions.entries()) {
    const number = index + 1;
    const prompt = question.prompt.trim();
    if (!prompt) return { ok: false, error: `${number}-ci sualın mətni boşdur.` };
    if (question.type === 'open') {
      const points = Number(question.maxPoints || OPEN_DEFAULT_POINTS);
      if (!Number.isInteger(points) || points < 1 || points > 100) return { ok: false, error: `${number}-ci açıq sualın maksimum balı 1–100 arasında tam ədəd olmalıdır.` };
      const modelAnswer = question.modelAnswer.trim();
      if (modelAnswer.length > 4000) return { ok: false, error: `${number}-ci sualın nümunə cavabı 4000 simvoldan uzundur.` };
      result.push({ type: 'open', prompt, options: [], maxPoints: points, modelAnswer: modelAnswer || null });
      continue;
    }
    const options = question.options.map((option) => option.trim());
    if (options.length < 2 || options.some((option) => !option)) return { ok: false, error: `${number}-ci sualda ən azı 2 dolu cavab variantı olmalıdır.` };
    if (new Set(options.map((option) => option.toLocaleLowerCase('az'))).size !== options.length) return { ok: false, error: 'Eyni sualın cavab variantları təkrarlana bilməz.' };
    if (question.correctOptionIndex < 0 || question.correctOptionIndex >= options.length) return { ok: false, error: `${number}-ci sualın düzgün cavabını seçin.` };
    result.push({ type: 'choice', prompt, options, correctOptionIndex: question.correctOptionIndex });
  }
  return { ok: true, questions: result };
}

export interface ExamResultLike {
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  score: number;
  maxScore: number;
  openQuestionCount: number;
  status: 'graded' | 'pending_review';
}

export function examResultHeadline(result: ExamResultLike) {
  if (result.status === 'pending_review') return 'Yoxlanılır';
  if (result.openQuestionCount > 0) return `${formatPoints(result.score)} / ${formatPoints(result.maxScore)} bal`;
  return `${result.correctCount} / ${result.totalQuestions} düzgün cavab`;
}

export function formatPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

export function examQuestionCountLabel(questions: Array<{ type?: ExamQuestionKind }>) {
  const open = questions.filter((question) => question.type === 'open').length;
  const choice = questions.length - open;
  if (!open) return `${choice} seçimli sual`;
  if (!choice) return `${open} açıq sual`;
  return `${choice} seçimli · ${open} açıq sual`;
}
