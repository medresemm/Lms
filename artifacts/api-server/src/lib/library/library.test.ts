import { test } from "node:test";
import assert from "node:assert/strict";
import { findAssetPath } from "../assets.js";
import { LIBRARY_BOOKS, chapterForPage, findLibraryBook, libraryPageAssetPath } from "./catalog.js";
import {
  answerLibrary,
  detectImplicitLibraryQuery,
  detectLibraryIntent,
  lightStem,
  normalizeArabic,
  parseLibraryQuery,
  resolveLibraryMessage,
  runLibraryQuery,
  searchLibrary,
  suggestChapters,
  warmLibraryIndex,
} from "./search.js";
import { HELD_OUT_SET, RECALL_SET, type RecallCase } from "./recall-set.js";
import { TOPIC_SYNONYMS } from "./synonyms.js";
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
  const book = { ...findLibraryBook("at-tuhfa-as-saniyya")!, slug: "test", chapters: [] };
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
  assert.ok(found.sources.total >= found.sources.items.length);
});

test("yüngül kök: artikl, bağlayıcı, sadə şəkilçilər", () => {
  assert.equal(lightStem(normalizeArabic("الصلاة")), "صلا");
  assert.equal(lightStem(normalizeArabic("والصلاة")), "صلا");
  assert.equal(lightStem(normalizeArabic("بالوضوء")), "وضو");
  assert.equal(lightStem(normalizeArabic("للجزم")), "جزم");
  assert.equal(lightStem(normalizeArabic("المسلمون")), "مسلم");
  assert.equal(lightStem(normalizeArabic("علامات")), "علام");
  assert.equal(lightStem("باب"), "باب");
});

function inRange(c: RecallCase) {
  return (hit: { slug: string; page: number }) => hit.slug === c.slug && c.ranges.some(([from, to]) => hit.page >= from && hit.page <= to);
}

test("recall: əsas dəst (≥95%) və əlavə dəst (≥90%) — ilk 10 nəticədə, söhbət yolu ilə", () => {
  for (const [set, minimum] of [[RECALL_SET, 0.95], [HELD_OUT_SET, 0.9]] as const) {
    let found = 0;
    const missed: string[] = [];
    for (const item of set) {
      const intent = resolveLibraryMessage(item.message);
      const hits = intent ? runLibraryQuery(intent.query).items : [];
      if (hits.some(inRange(item))) found += 1;
      else missed.push(item.message);
    }
    assert.ok(found / set.length >= minimum, `recall ${found}/${set.length}; tapılmadı: ${missed.join(" | ")}`);
  }
  assert.ok(RECALL_SET.length >= 30);
});

test("sinonimlər yalnız kitablarda həqiqətən olan ərəb ifadələrinə gedir", () => {
  for (const entry of TOPIC_SYNONYMS) {
    const words = normalizeArabic(entry.arabic).split(" ").map(lightStem);
    const inChapter = LIBRARY_BOOKS.some((book) => book.chapters.some((chapter) => {
      const title = normalizeArabic(chapter.title).split(" ").map(lightStem);
      return words.every((word) => title.includes(word));
    }));
    const inText = runLibraryQuery(entry.arabic).items.some((hit) => !hit.partial);
    assert.ok(inChapter || inText, entry.arabic);
  }
});

test("açar söz yazmadan: ərəbcə mətn, mövzu sözü, kitab filtri, «hansı səhifədə»", () => {
  assert.equal(detectImplicitLibraryQuery("نواقض الوضوء")?.reason, "arabic");
  assert.equal(detectImplicitLibraryQuery("dəstəmazı pozan şeylər")?.reason, "topic");
  assert.equal(detectImplicitLibraryQuery("Oruc")?.reason, "topic");
  assert.equal(detectImplicitLibraryQuery("Tuhfədə fail")?.reason, "book");
  assert.equal(detectImplicitLibraryQuery("hansı səhifədə cənazə namazı")?.reason, "phrase");
  assert.equal(detectImplicitLibraryQuery("cuma namazı hangi sayfada")?.reason, "phrase");
  assert.deepEqual(parseLibraryQuery("Tuhfədə fail").book, "at-tuhfa-as-saniyya");
  assert.deepEqual(parseLibraryQuery("التحفة النعت").book, "at-tuhfa-as-saniyya");
  assert.deepEqual(parseLibraryQuery("Mənhəcdə nikah").expanded, ["النكاح"]);
  // Akademiya sorğuları və adlar kitabxanaya getmir.
  for (const message of ["Dərs cədvəlim", "Tapşırıqlarım", "Qiymətlərim", "Qayıbı çox olanlar", "Neçə müraciət gözləyir?", "Əli Məmmədov",
    "cümə dərsi", "cümə", "hal", "namaz vaxtı", "Fitrət", "Fitrət Həsənova", "Səlim", "Talıb", "Həcər", "Zəkiyyə", "fiqh dərsi", "Nəhv kursu",
    "tuhfə dərsinin cədvəli", "salam", "T0012", "Admin paneldən necə istifadə edim?"]) {
    assert.equal(resolveLibraryMessage(message), null, message);
  }
  // Şamilə/Dorar əmrləri kitabxanaya düşmür (daxili rejimdə «Xarici»yə keçin izahı qalır).
  for (const message of ["الشاملة الصبر", "dorar الصبر", "Şamilədə axtar: الطهارة"]) assert.equal(resolveLibraryMessage(message), null, message);
  assert.deepEqual(resolveLibraryMessage("kütüphanede ara: الطلاق"), { query: "الطلاق" });
});

test("nəticə: fəsil başlığı öndə, fəsil yolu, vurğulanmış sözlər, qismən uyğunluq, səhifələmə", () => {
  const chapter = runLibraryQuery("نواقض الوضوء").items[0];
  assert.equal(chapter.match, "chapter");
  assert.equal(chapter.page, 56);
  assert.deepEqual(chapter.chapterPath, ["كتاب الطهارة", "باب نواقض الوضوء"]);
  const text = runLibraryQuery("صاعا من تمر").items.find((hit) => hit.match === "text")!;
  assert.ok(text.parts.some((part) => part.hit && normalizeArabic(part.text).includes("صاعا")));
  assert.equal(text.parts.map((part) => part.text).join(""), text.snippet);
  const partial = runLibraryQuery("زكاة الفطر قخصثق").items;
  assert.ok(partial.length > 0 && partial.some((hit) => hit.partial));
  const first = runLibraryQuery("الصلاة", { limit: 10 });
  const second = runLibraryQuery("الصلاة", { limit: 10, offset: 10 });
  assert.equal(first.items.length, 10);
  assert.ok(first.total > 20);
  assert.ok(second.items.every((hit) => !first.items.some((other) => other.slug === hit.slug && other.page === hit.page)));
  const filtered = runLibraryQuery("Tuhfədə fail");
  assert.ok(filtered.items.every((hit) => hit.slug === "at-tuhfa-as-saniyya"));
  assert.equal(runLibraryQuery("الطهارة", { book: "at-tuhfa-as-saniyya" }).book, "at-tuhfa-as-saniyya");
});

test("tapılmayanda: «Bunu nəzərdə tuturdunuz?» fəsil təklifləri", () => {
  assert.equal(suggestChapters("الطهاره")[0]?.title, "كتاب الطهارة");
  const none = answerLibrary("qwrtzx");
  assert.equal(none.sources.total, 0);
  const near = runLibraryQuery("zekatt verilmesi qaydasi xx");
  assert.ok(near.total > 0 || near.didYouMean.length > 0);
});

test("indeks bir dəfə qurulur və axtarış sürətlidir", () => {
  warmLibraryIndex();
  const started = Date.now();
  for (const item of RECALL_SET) runLibraryQuery(item.message);
  const perQuery = (Date.now() - started) / RECALL_SET.length;
  assert.ok(perQuery < 150, `${perQuery.toFixed(1)} ms/sorğu`);
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
