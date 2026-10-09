// Resursdan kitab tanıma: server (AI) və brauzer (dərs pəncərəsindəki «Oxu») eyni nəticəni verməlidir.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { LIBRARY_BOOKS } from "./catalog.js";
import { matchResourceBook, parseResourcePages, resourceBookHref } from "./resourceBooks.js";

// Brauzer nüsxəsi (medine-lms/src/lib/resource-books.ts) eyni nümunələrlə ../medine-lms/src/lib/resource-books.test.ts-də yoxlanılır.
const implementations = [["server", { matchResourceBook, parseResourcePages }]] as const;

for (const [name, impl] of implementations) {
  test(`${name}: lesson resource 'TEST kitab — شرح منهج السالكين' → chapter + pages + reader page`, () => {
    const match = impl.matchResourceBook({ title: "TEST kitab — شرح منهج السالكين", body: "باب نواقض الوضوء, səh. 55-56" }, LIBRARY_BOOKS);
    assert.ok(match);
    assert.equal(match.slug, "manhaj-as-salikin");
    assert.equal(match.chapterTitle, "باب نواقض الوضوء");
    assert.equal(match.printedFrom, 55);
    assert.equal(match.printedTo, 56);
    assert.equal(match.openPage, 56); // skan = çap + 1
    assert.equal(resourceBookHref(match), "/kitabxana/manhaj-as-salikin?page=56");
  });

  test(`${name}: chapter only (no pages) opens at the chapter; diacritics/hamza variants tolerated`, () => {
    const match = impl.matchResourceBook({ title: "مَنْهَجُ السَّالِكِين", body: "Bu həftə: باب نواقض الوضوء" }, LIBRARY_BOOKS);
    assert.ok(match);
    assert.equal(match.slug, "manhaj-as-salikin");
    assert.equal(match.chapterTitle, "باب نواقض الوضوء");
    assert.equal(match.printedFrom, 55);
    assert.equal(match.openPage, 56);
  });

  test(`${name}: Latin short title + page only → containing chapter`, () => {
    const match = impl.matchResourceBook({ title: "Şərhu Mənhəcis-Salikin", body: "s. 56" }, LIBRARY_BOOKS);
    assert.ok(match);
    assert.equal(match.slug, "manhaj-as-salikin");
    assert.equal(match.chapterTitle, "باب نواقض الوضوء");
    assert.equal(match.openPage, 57);
  });

  test(`${name}: Tuhfa by Arabic title, Arabic-Indic page digits`, () => {
    const match = impl.matchResourceBook({ title: "التحفة السنية", body: "ص ١٠" }, LIBRARY_BOOKS);
    assert.ok(match);
    assert.equal(match.slug, "at-tuhfa-as-saniyya");
    assert.equal(match.printedFrom, 10);
  });

  test(`${name}: unrelated resources do not match a book`, () => {
    assert.equal(impl.matchResourceBook({ title: "Zoom dərsi", body: "https://meet.google.com/abc səh. 3" }, LIBRARY_BOOKS), null);
    assert.equal(impl.matchResourceBook({ title: "في الدين", body: "" }, LIBRARY_BOOKS), null);
    assert.equal(impl.parseResourcePages("TEST 55"), null);
    assert.deepEqual(impl.parseResourcePages("səhifə 12–14"), { from: 12, to: 14 });
  });
}

test("server and browser copies of the matcher are identical (apart from the header note)", () => {
  const strip = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((line) => !line.startsWith("// DİQQƏT:")).join("\n");
  assert.equal(strip("./resourceBooks.ts"), strip("../../../../medine-lms/src/lib/resource-books.ts"));
});
