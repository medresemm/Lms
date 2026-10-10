import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LIBRARY_BOOKS } from "./catalog.js";
import { cleanOcrText, generateBookTest, chapterRange, NO_TEXT_MESSAGE, type GeneratedKind } from "./testGenerator.js";
import { parseGenerateRequest, resolveRange, testBuilderAllowed, testBuilderSeesAllGroups } from "./testBuilder.js";
import { normalizeExamQuestionInputs } from "../examContent.js";

const ALL: GeneratedKind[] = ["cloze", "truefalse", "chapter", "open"];
const manhaj = LIBRARY_BOOKS.find((book) => book.slug === "manhaj-as-salikin")!;
const tuhfa = LIBRARY_BOOKS.find((book) => book.slug === "at-tuhfa-as-saniyya")!;
const pagesOf = (slug: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../assets/library/${slug}/text.json`, import.meta.url)), "utf8")).pages as string[];
const manhajPages = pagesOf(manhaj.slug);
const tuhfaPages = pagesOf(tuhfa.slug);
const nawaqid = manhaj.chapters.findIndex((chapter) => chapter.title === "باب نواقض الوضوء");
const ARABIC = /[\u0621-\u064A]/;

function run(overrides: Partial<Parameters<typeof generateBookTest>[0]> = {}) {
  const range = chapterRange(manhaj, nawaqid)!;
  const result = generateBookTest({ book: manhaj, pages: manhajPages, fromPage: range.from, toPage: range.to, count: 10, kinds: ALL, ...overrides });
  assert.ok(result.ok, result.ok ? "" : result.error);
  return result;
}

test("catalog: corrected chapter pages match the scanned text (نواقض, الغسل, التيمم, الحيض, الصلاة)", () => {
  const page = (title: string) => manhaj.chapters.find((chapter) => chapter.title === title)!.page;
  assert.equal(page("باب نواقض الوضوء"), 56);
  assert.equal(page("باب ما يوجب الغسل وصفته"), 60);
  assert.equal(page("باب التيمم"), 64);
  assert.equal(page("باب الحيض"), 71);
  assert.equal(page("كتاب الصلاة"), 74);
  assert.match(manhajPages[60 - 1], /يوجب الغسل|وجب السل/);
  assert.match(manhajPages[64 - 1], /النوع الثاني من الطهارة/);
  assert.match(manhajPages[71 - 1], /الحيض/);
  // fəsillər artan sıra ilə
  for (let i = 1; i < manhaj.chapters.length; i += 1) assert.ok(manhaj.chapters[i].page >= manhaj.chapters[i - 1].page, manhaj.chapters[i].title);
  assert.deepEqual(chapterRange(manhaj, nawaqid), { from: 56, to: 59 });
});

test("cleanOcrText: OCR commas, reference numbers, latin noise", () => {
  assert.equal(cleanOcrText("منهاء وقد ذكر"), "منها، وقد ذكر");
  assert.equal(cleanOcrText("قتلهم الله» ألا سألوا"), "قتلهم الله، ألا سألوا");
  assert.equal(cleanOcrText("«حديث» أخرجه مسلم (۲۲۵)."), "«حديث» أخرجه مسلم.");
  assert.equal(cleanOcrText("ODOOUOVOUDUDLASROOOODOE الطهارة"), "الطهارة");
});

test("generator: deterministic for the same input; salt changes the selection", () => {
  const a = run();
  const b = run();
  assert.deepEqual(a, b);
  const c = run({ salt: 7 });
  assert.notDeepEqual(a.questions.map((q) => q.key + q.options.join()), c.questions.map((q) => q.key + q.options.join()));
});

test("generator: باب نواقض الوضوء — basic question quality", () => {
  const { questions } = run({ count: 10 });
  assert.equal(questions.length, 10);
  const keys = new Set(questions.map((q) => q.key));
  assert.equal(keys.size, questions.length, "no duplicate questions");
  for (const q of questions) {
    assert.ok(q.page >= 56 && q.page <= 59, `source page in range: ${q.page}`);
    assert.equal(q.printedPage, q.page - 1);
    assert.ok(ARABIC.test(q.prompt));
    assert.ok(!/LMS/i.test(q.prompt));
    if (q.type === "choice") {
      assert.ok(q.options.length >= 2 && q.options.length <= 8);
      assert.equal(new Set(q.options).size, q.options.length, `unique options: ${q.options}`);
      assert.ok(q.options.every((option) => option.trim().length > 0));
      assert.ok(q.correctOptionIndex >= 0 && q.correctOptionIndex < q.options.length);
      assert.equal(q.modelAnswer, null);
      if (q.kind === "cloze") {
        assert.match(q.prompt, /ــــ/);
        // düzgün cavab boşluğun yerinə qoyulanda başqa variantlar cümlədə yoxdur
        for (const [index, option] of q.options.entries()) if (index !== q.correctOptionIndex) assert.ok(!q.prompt.includes(` ${option} `), `distractor ${option} not in sentence`);
      }
      if (q.kind === "chapter") assert.equal(q.options[q.correctOptionIndex], "باب نواقض الوضوء");
    } else {
      assert.equal(q.options.length, 0);
      assert.equal(q.maxPoints, 5);
      assert.ok(q.modelAnswer && /ص [٠-٩]+/.test(q.modelAnswer), "model answer carries a page reference");
    }
  }
  // mövcud «İmtahan və testlər» validasiyasından keçir
  assert.doesNotThrow(() => normalizeExamQuestionInputs(questions.map((q) => ({ prompt: q.prompt, options: q.options, correctOptionIndex: q.correctOptionIndex, type: q.type, maxPoints: q.type === "open" ? q.maxPoints : null, modelAnswer: q.modelAnswer })), "ar"));
  // babın siyahısı: müəllifin saydığı nəvaqiz
  const list = questions.find((q) => q.type === "open" && q.prompt.startsWith("اذكر"));
  assert.ok(list, "list question exists");
  assert.match(list!.modelAnswer!, /السبيلين/);
  assert.match(list!.modelAnswer!, /المرأة بشهوة/);
  assert.match(list!.modelAnswer!, /والردة/);
});

test("generator: type mix is respected", () => {
  const openOnly = run({ kinds: ["open"], count: 5 });
  assert.ok(openOnly.questions.length > 0 && openOnly.questions.every((q) => q.type === "open"));
  const choiceOnly = run({ kinds: ["cloze", "truefalse", "chapter"], count: 8 });
  assert.ok(choiceOnly.questions.every((q) => q.type === "choice"));
  const mixed = run({ count: 10 });
  assert.ok(mixed.questions.some((q) => q.type === "open") && mixed.questions.some((q) => q.type === "choice"));
  const tf = run({ kinds: ["truefalse"], count: 3 });
  assert.ok(tf.questions.every((q) => q.kind === "truefalse" && q.options.join() === "صحيحة,خاطئة"));
});

test("generator: regenerating one question excludes the current ones", () => {
  const base = run({ count: 6 });
  const replacement = run({ count: 1, excludeKeys: base.questions.map((q) => q.key), salt: 1 });
  assert.equal(replacement.questions.length, 1);
  assert.ok(!base.questions.some((q) => q.key === replacement.questions[0].key));
});

test("generator: nahw book uses i'rab families; fiqh book never blanks i'rab words", () => {
  const result = generateBookTest({ book: tuhfa, pages: tuhfaPages, fromPage: 22, toPage: 30, count: 10, kinds: ["cloze"] });
  assert.ok(result.ok);
  assert.ok(result.questions.some((q) => q.options.some((option) => /الضمة|ضمة|مرفوع|رفع/.test(option))));
  const fiqh = generateBookTest({ book: manhaj, pages: manhajPages, fromPage: 86, toPage: 100, count: 15, kinds: ["cloze", "truefalse"] });
  assert.ok(fiqh.ok);
  for (const q of fiqh.questions) assert.ok(!q.options.includes("جزم") && !q.options.includes("خفض"), q.prompt);
});

test("generator: no text layer / empty range → clear Azerbaijani message", () => {
  const empty = generateBookTest({ book: manhaj, pages: manhajPages.map(() => ""), fromPage: 56, toPage: 59, count: 5, kinds: ALL });
  assert.deepEqual(empty, { ok: false, error: NO_TEXT_MESSAGE });
  const tooWide = generateBookTest({ book: manhaj, pages: manhajPages, fromPage: 10, toPage: 200, count: 5, kinds: ALL });
  assert.equal(tooWide.ok, false);
  const noKinds = generateBookTest({ book: manhaj, pages: manhajPages, fromPage: 56, toPage: 59, count: 5, kinds: [] });
  assert.equal(noKinds.ok, false);
});

test("generator: stays fast (well inside the 30 s serverless limit)", () => {
  const started = Date.now();
  generateBookTest({ book: manhaj, pages: manhajPages, fromPage: 166, toPage: 205, count: 20, kinds: ALL });
  assert.ok(Date.now() - started < 3000);
});

test("permissions: students never; teacher/admin/board only with the tests permission; owner always", () => {
  const perms = (...keys: string[]) => new Set(keys);
  assert.equal(testBuilderAllowed({ isOwner: true, role: null, permissions: perms() }), true);
  assert.equal(testBuilderAllowed({ isOwner: false, role: null, permissions: perms("assignments") }), false);
  assert.equal(testBuilderAllowed({ isOwner: false, role: "student", permissions: perms("assignments") }), false);
  assert.equal(testBuilderAllowed({ isOwner: false, role: "supervisor", permissions: perms("assignments") }), false);
  assert.equal(testBuilderAllowed({ isOwner: false, role: "teacher", permissions: perms() }), false);
  assert.equal(testBuilderAllowed({ isOwner: false, role: "teacher", permissions: perms("assignments") }), true);
  assert.equal(testBuilderAllowed({ isOwner: false, role: "admin", permissions: perms("assignments") }), true);
  assert.equal(testBuilderAllowed({ isOwner: false, role: "owner_assistant", permissions: perms("assignments") }), true);
  assert.equal(testBuilderSeesAllGroups({ isOwner: false, role: "teacher" }), false);
  assert.equal(testBuilderSeesAllGroups({ isOwner: false, role: "owner_assistant" }), true);
  assert.equal(testBuilderSeesAllGroups({ isOwner: true, role: null }), true);
});

test("request: printed pages map to scan pages; topic-only finds the bab; validation", () => {
  const parse = (body: unknown) => { const parsed = parseGenerateRequest(body); assert.ok(parsed.ok); return parsed.value; };
  assert.deepEqual(resolveRange(manhaj, parse({ slug: manhaj.slug, fromPage: 55, toPage: 56 })), { ok: true, from: 56, to: 57, topicWords: [], chapterTitle: "باب نواقض الوضوء" });
  const topic = resolveRange(manhaj, parse({ slug: manhaj.slug, topic: "dəstəmazı pozan şeylər" }));
  assert.ok(topic.ok && topic.from === 56 && topic.to === 59);
  assert.equal(resolveRange(manhaj, parse({ slug: manhaj.slug })).ok, false);
  assert.equal(resolveRange(manhaj, parse({ slug: manhaj.slug, fromPage: 1, toPage: 300 })).ok, false);
  assert.equal(parseGenerateRequest({ slug: "", count: 5 }).ok, false);
  assert.equal(parseGenerateRequest({ slug: "x", count: 99 }).ok, false);
  assert.equal(parseGenerateRequest({ slug: "x", kinds: ["nope"] }).ok, false);
});
