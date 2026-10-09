import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_QUESTION_META,
  EXAM_META_POSITION,
  ExamValidationError,
  applyOpenGrades,
  arabicSearchKey,
  buildStoredAnswers,
  computeExamScore,
  decodeQuestionMeta,
  encodeQuestionMeta,
  examLanguageFromMetas,
  maskPendingScore,
  needsMetaRow,
  normalizeExamQuestionInputs,
  parseStoredAnswers,
  splitQuestionOptions,
  validateSubmissionAnswers,
  type ScoringQuestion,
} from "./examContent.js";

test("meta sətri kodlaşdırılır və variantlardan ayrılır", () => {
  const meta = { kind: "open" as const, maxPoints: 10, modelAnswer: "النِّيَّةُ: القَصْدُ", language: "ar" as const };
  const options = [
    { id: 1, position: 0, label: "A" },
    { id: 9, position: EXAM_META_POSITION, label: encodeQuestionMeta(meta) },
    { id: 2, position: 1, label: "B" },
  ];
  const split = splitQuestionOptions(options);
  assert.deepEqual(split.meta, meta);
  assert.deepEqual(split.choices.map((option) => option.id), [1, 2]);
  // Köhnə testlər (meta sətri olmayan) seçimli, 1 bal, Azərbaycanca sayılır.
  assert.deepEqual(splitQuestionOptions([{ id: 1, position: 0, label: "{x" }]).meta, DEFAULT_QUESTION_META);
  // Adi variant mətni JSON-a bənzəsə belə meta sayılmır.
  assert.equal(decodeQuestionMeta('{"kind":"open"}'), null);
  assert.equal(examLanguageFromMetas([DEFAULT_QUESTION_META, meta]), "ar");
  assert.equal(needsMetaRow(DEFAULT_QUESTION_META), false);
});

test("ərəb mətni hərəkələri ilə saxlanılır, açıq sual normallaşdırılır", () => {
  const [choice, open] = normalizeExamQuestionInputs([
    { prompt: "  مَا حُكْمُ الْوُضُوءِ؟ ", options: ["وَاجِبٌ", "سُنَّةٌ"], correctOptionIndex: 0 },
    { prompt: "اشرح", type: "open", maxPoints: 8, modelAnswer: "  " },
  ], "ar");
  assert.equal(choice.prompt, "مَا حُكْمُ الْوُضُوءِ؟");
  assert.deepEqual(choice.options, ["وَاجِبٌ", "سُنَّةٌ"]);
  assert.equal(choice.meta.language, "ar");
  assert.deepEqual(open.meta, { kind: "open", maxPoints: 8, modelAnswer: null, language: "ar" });
  assert.deepEqual(open.options, []);
  assert.throws(() => normalizeExamQuestionInputs([{ prompt: "x", type: "open", maxPoints: 0 }], "az"), ExamValidationError);
  assert.throws(() => normalizeExamQuestionInputs([{ prompt: "x", options: ["a"], correctOptionIndex: 0 }], "az"), ExamValidationError);
});

const questions: ScoringQuestion[] = [
  { id: 1, kind: "choice", maxPoints: 1, correctOptionId: 11 },
  { id: 2, kind: "choice", maxPoints: 1, correctOptionId: 21 },
  { id: 3, kind: "open", maxPoints: 5, correctOptionId: null },
];

test("cavablar saxlanılır, açıq sual yoxlanana qədər nəticə gizlidir", () => {
  const stored = buildStoredAnswers({ choices: { 1: 11, 2: 22 }, open: { 3: "النية شرط" }, review: null });
  const parsed = parseStoredAnswers(stored);
  assert.deepEqual(parsed.choices, { 1: 11, 2: 22 });
  assert.deepEqual(parsed.open, { 3: "النية شرط" });
  const pending = computeExamScore(questions, parsed);
  assert.equal(pending.status, "pending_review");
  assert.equal(pending.autoScore, 1);
  assert.equal(pending.maxScore, 7);
  const masked = maskPendingScore(pending);
  assert.equal(masked.score, 0);
  assert.equal(masked.percentage, 0);

  const graded = applyOpenGrades(questions, parsed, { 3: { points: 4.5, comment: "Yaxşı" } }, "teacher_1", new Date("2026-10-09T10:00:00Z"));
  const reparsed = parseStoredAnswers(buildStoredAnswers(graded));
  const final = computeExamScore(questions, reparsed);
  assert.equal(final.status, "graded");
  assert.equal(final.score, 5.5);
  assert.equal(final.percentage, Math.round((5.5 / 7) * 100));
  assert.deepEqual(reparsed.review?.grades["3"], { points: 4.5, comment: "Yaxşı" });
  assert.equal(maskPendingScore(final), final);
});

test("köhnə (yalnız seçimli) test əvvəlki kimi hesablanır", () => {
  const legacy = computeExamScore(questions.slice(0, 2), parseStoredAnswers({ 1: 11, 2: 21 }));
  assert.deepEqual(
    { correctCount: legacy.correctCount, totalQuestions: legacy.totalQuestions, percentage: legacy.percentage, status: legacy.status },
    { correctCount: 2, totalQuestions: 2, percentage: 100, status: "graded" },
  );
});

test("müəllim balı məhdudiyyətləri", () => {
  const parsed = parseStoredAnswers({ 3: "cavab" });
  assert.throws(() => applyOpenGrades(questions, parsed, { 3: { points: 6 } }, "t"), ExamValidationError);
  assert.throws(() => applyOpenGrades(questions, parsed, { 1: { points: 1 } }, "t"), ExamValidationError);
  assert.throws(() => applyOpenGrades(questions, parsed, {}, "t"), ExamValidationError);
  assert.throws(() => applyOpenGrades(questions.slice(0, 2), parsed, { 3: { points: 1 } }, "t"), ExamValidationError);
});

test("tələbə cavablarının yoxlanması", () => {
  const shape = [
    { id: 1, kind: "choice" as const, optionIds: new Set([11, 12]) },
    { id: 3, kind: "open" as const, optionIds: new Set<number>() },
  ];
  assert.deepEqual(validateSubmissionAnswers(shape, { 1: 11 }, { 3: "  جواب  " }, false), { ok: true, choices: { 1: 11 }, open: { 3: "جواب" } });
  assert.equal(validateSubmissionAnswers(shape, { 1: 11 }, { 3: "   " }, false).ok, false);
  assert.equal(validateSubmissionAnswers(shape, { 1: 99 }, { 3: "x" }, false).ok, false);
  assert.equal(validateSubmissionAnswers(shape, { 3: 11 }, {}, true).ok, false);
  assert.equal(validateSubmissionAnswers(shape, {}, {}, true).ok, true);
});

test("ərəbcə axtarış açarı hərəkələri nəzərə almır", () => {
  assert.equal(arabicSearchKey("الطَّهَارَةُ"), arabicSearchKey("الطهارة"));
  assert.equal(arabicSearchKey("إِسْلَام"), "اسلام");
});
