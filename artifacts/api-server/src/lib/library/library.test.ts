import { test } from "node:test";
import assert from "node:assert/strict";
import { findAssetPath } from "../assets.js";
import { LIBRARY_BOOKS, chapterForPage, findLibraryBook, libraryPageAssetPath } from "./catalog.js";
import { answerLibrary, detectLibraryIntent, normalizeArabic, searchLibrary } from "./search.js";
import { createLibraryToken, verifyLibraryToken } from "./token.js";

test("ərəb normallaşdırması: hərəkə, həmzə, tə-mərbuta, əlif-məqsura", () => {
  assert.equal(normalizeArabic("الصَّلَاةُ"), "الصلاه");
  assert.equal(normalizeArabic("إِنَّمَا الأَعْمَالُ"), "انما الاعمال");
  assert.equal(normalizeArabic("مُصْطَفَى"), "مصطفي");
  assert.equal(normalizeArabic("سُئِلَ، مُؤْمِن"), "سيل مومن");
});

test("kataloq: iki kitab, fəsillər artan sırada və səhifə hüdudlarında", () => {
  assert.deepEqual(LIBRARY_BOOKS.map((book) => book.slug), ["manhaj-as-salikin", "at-tuhfa-as-saniyya"]);
  for (const book of LIBRARY_BOOKS) {
    assert.ok(book.chapters.length > 50, `${book.slug}: fəsil siyahısı`);
    let previous = 0;
    for (const chapter of book.chapters) {
      assert.ok(chapter.page >= previous, `${book.slug}: ${chapter.title}`);
      assert.equal(chapter.page, chapter.printedPage + book.pageOffset);
      assert.ok(chapter.page >= 1 && chapter.page <= book.pageCount);
      previous = chapter.page;
    }
  }
  const tuhfa = findLibraryBook("at-tuhfa-as-saniyya")!;
  assert.equal(chapterForPage(tuhfa, 77)?.title, "باب الفاعل: تعريفه");
  assert.equal(findLibraryBook("yoxdur"), null);
});

test("hər səhifənin şəkli və OCR mətni paketdədir", () => {
  for (const book of LIBRARY_BOOKS) {
    for (let page = 1; page <= book.pageCount; page += 1) {
      assert.ok(findAssetPath(libraryPageAssetPath(book.slug, page)), `${book.slug} s.${page}`);
    }
    assert.ok(findAssetPath(`library/${book.slug}/text.json`));
  }
});

test("söhbət əmri tanınır", () => {
  assert.deepEqual(detectLibraryIntent("Kitabxanada axtar: الطهارة"), { query: "الطهارة" });
  assert.deepEqual(detectLibraryIntent("kitabda axtar نواقض الوضوء"), { query: "نواقض الوضوء" });
  assert.deepEqual(detectLibraryIntent("ابحث في المكتبة عن الفاعل"), { query: "عن الفاعل" });
  assert.deepEqual(detectLibraryIntent("Kitabxanada axtarış: «المبتدأ»"), { query: "المبتدأ" });
  assert.deepEqual(detectLibraryIntent("kitabxanada axtar"), { query: "" });
  assert.equal(detectLibraryIntent("Dərs cədvəlim"), null);
  assert.equal(detectLibraryIntent("Şamilədə axtar: الطهارة"), null);
});

test("axtarış skan mətnində tapır: kitab, fəsil, səhifə, parça", () => {
  const hits = searchLibrary("نواقض الوضوء");
  assert.ok(hits.length > 0);
  const top = hits[0];
  assert.equal(top.slug, "manhaj-as-salikin");
  assert.ok(top.page >= 1 && top.page <= 471);
  assert.ok(top.snippet.length > 10);
  const tuhfa = searchLibrary("المفعول معه", { books: [findLibraryBook("at-tuhfa-as-saniyya")!] });
  assert.ok(tuhfa.some((hit) => hit.chapterTitle?.startsWith("باب المفعول معه")));
  assert.deepEqual(searchLibrary("ا"), []);
});

test("axtarış hərəkəli və həmzəli sorğunu da tapır (saxta mətnlə)", () => {
  const book = { ...findLibraryBook("at-tuhfa-as-saniyya")!, slug: "test" };
  const loader = () => ["", "قال المصنف: الكلام هو اللفظ المركب المفيد بالوضع", "باب الإعراب"];
  const hits = searchLibrary("الكَلَامُ هُوَ اللَّفْظُ", { books: [book], loader });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].page, 2);
  assert.equal(hits[0].printedPage, 1);
  assert.equal(searchLibrary("الإِعْرَاب", { books: [book], loader })[0].page, 3);
});

test("cavab formatı: mənbə «library», boş sorğuya izah", () => {
  const empty = answerLibrary("");
  assert.equal(empty.sources.kind, "library");
  assert.equal(empty.sources.items.length, 0);
  const found = answerLibrary("الطهارة");
  assert.ok(found.sources.items.length > 0);
  assert.ok(!("score" in found.sources.items[0]));
});

test("şəkil açarı: imza, istifadəçi, vaxt", () => {
  const key = Buffer.alloc(32, 7);
  const now = 1_800_000_000;
  const { token, expiresAt } = createLibraryToken("user_1", now, key);
  assert.ok(expiresAt > now);
  assert.equal(verifyLibraryToken(token, now, key), true);
  assert.equal(verifyLibraryToken(token, expiresAt, key), false);
  assert.equal(verifyLibraryToken(token, now, Buffer.alloc(32, 8)), false);
  assert.equal(verifyLibraryToken(`${token}x`, now, key), false);
  assert.equal(verifyLibraryToken(undefined, now, key), false);
  assert.equal(verifyLibraryToken("", now, key), false);
  const [subject, , signature] = token.split(".");
  assert.equal(verifyLibraryToken(`${subject}.${expiresAt + 99999}.${signature}`, now, key), false);
  assert.equal(createLibraryToken("user_1", now + 60, key).token, token, "eyni saatda eyni URL (keş üçün)");
});
