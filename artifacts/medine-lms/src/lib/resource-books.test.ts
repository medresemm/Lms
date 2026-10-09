// Resursdan kitab tanıma (brauzer nüsxəsi): dərs pəncərəsindəki «Oxu» düyməsi. Server nüsxəsi ilə eyni nümunələr.
// Bu fayl tətbiqin typecheck-inə daxil deyil (*.test.ts); api-server-in `test:library` skripti tsx ilə işlədir.
import assert from "node:assert/strict";
import test from "node:test";
import { LIBRARY_BOOKS } from "../../../api-server/src/lib/library/catalog";
import { matchResourceBook, parseResourcePages, resourceBookHref } from "./resource-books";

const implementations = [["browser", { matchResourceBook, parseResourcePages }]] as const;

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
