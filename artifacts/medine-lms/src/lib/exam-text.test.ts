import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blankQuestion, examQuestionCountLabel, examResultHeadline, examTextProps, formatPoints, hasArabic, prepareExamQuestions, switchQuestionType } from './exam-text';

test('ərəb mətni tanınır, ərəbcə test sağdan sola göstərilir', () => {
  assert.equal(hasArabic('بِسْمِ اللَّهِ'), true);
  assert.equal(hasArabic('Fiqh'), false);
  assert.equal(examTextProps('ar').dir, 'rtl');
  assert.equal(examTextProps('ar').lang, 'ar');
  assert.equal(examTextProps('az', 'Fiqh').dir, 'auto');
  assert.equal(examTextProps('az', 'ما حكم الوضوء؟').lang, 'ar');
  assert.equal(examTextProps('az').style.unicodeBidi, 'plaintext');
});

test('ərəb mətni hərəkələri ilə dəyişmədən göndərilir', () => {
  const prompt = '  مَا فَرَائِضُ الْوُضُوءِ (عند الشافعية)؟  ';
  const prepared = prepareExamQuestions([{ ...blankQuestion(), prompt, options: ['أَرْبَعَةٌ', 'سِتَّةٌ'], correctOptionIndex: 1 }]);
  assert.ok(prepared.ok);
  assert.equal(prepared.questions[0].prompt, prompt.trim());
  assert.deepEqual(prepared.questions[0].type === 'choice' && prepared.questions[0].options, ['أَرْبَعَةٌ', 'سِتَّةٌ']);
});

test('seçimli və açıq suallar qarışıq hazırlanır', () => {
  const prepared = prepareExamQuestions([
    { ...blankQuestion(), prompt: 'Sual 1', options: ['A', 'B'], correctOptionIndex: 0 },
    { ...blankQuestion('open'), prompt: 'اشرح معنى النية', maxPoints: '10', modelAnswer: 'القصد' },
  ]);
  assert.ok(prepared.ok);
  assert.deepEqual(prepared.questions[1], { type: 'open', prompt: 'اشرح معنى النية', options: [], maxPoints: 10, modelAnswer: 'القصد' });
});

test('səhv qaralamalar aydın xəta verir', () => {
  assert.equal(prepareExamQuestions([{ ...blankQuestion('open'), prompt: 'x', maxPoints: '0' }]).ok, false);
  assert.equal(prepareExamQuestions([{ ...blankQuestion(), prompt: 'x', options: ['a', 'A'] }]).ok, false);
  assert.equal(prepareExamQuestions([{ ...blankQuestion(), prompt: ' ' }]).ok, false);
  assert.equal(prepareExamQuestions([]).ok, false);
});

test('növ dəyişəndə seçimli suala ən azı iki variant qalır', () => {
  const open = blankQuestion('open');
  assert.equal(switchQuestionType(open, 'choice').options.length, 2);
  assert.equal(switchQuestionType(blankQuestion(), 'open').type, 'open');
});

test('nəticə mətni', () => {
  const base = { correctCount: 3, totalQuestions: 4, percentage: 75, score: 3, maxScore: 4, openQuestionCount: 0, status: 'graded' as const };
  assert.equal(examResultHeadline(base), '3 / 4 düzgün cavab');
  assert.equal(examResultHeadline({ ...base, openQuestionCount: 1, score: 7.5, maxScore: 9 }), '7,5 / 9 bal');
  assert.equal(examResultHeadline({ ...base, status: 'pending_review' }), 'Yoxlanılır');
  assert.equal(formatPoints(2.25), '2,25');
  assert.equal(examQuestionCountLabel([{ type: 'choice' }, { type: 'open' }]), '1 seçimli · 1 açıq sual');
  assert.equal(examQuestionCountLabel([{ type: 'choice' }]), '1 seçimli sual');
});
