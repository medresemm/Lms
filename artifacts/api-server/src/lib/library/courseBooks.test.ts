import assert from "node:assert/strict";
import test from "node:test";
import { LIBRARY_BOOKS } from "./catalog.js";
import { answerCourseBooks, courseBooksFromResources, detectCourseBooksQuestion, MAX_BOOKS_PER_LESSON, resolveCourseBooks, suggestedLibraryBooks, validateCourseBooks } from "./courseBooks.js";
import { uploadedRowToBook, uploadedSlug } from "./uploads.js";

const manhaj = LIBRARY_BOOKS.find((book) => book.slug === "manhaj-as-salikin")!;
const tuhfa = LIBRARY_BOOKS.find((book) => book.slug === "at-tuhfa-as-saniyya")!;
const storageId = "3f2c8a8e-1b2c-4d5e-8f90-123456789abc";
const uploaded = uploadedRowToBook({
  slug: uploadedSlug(storageId), storageId, title: "كتاب تجريبي", shortTitle: "Sınaq kitabı", author: "مؤلف", commentator: null,
  publisher: "", year: "", subject: "Fiqh", pageCount: 40, pageOffset: 2,
  chapters: [{ title: "باب الطهارة", level: 1 as const, printedPage: 3, page: 5 }],
  hasText: false, hasCover: false, fileSize: 1234, updatedAt: new Date("2026-10-09T10:00:00Z"),
});
const catalog = [...LIBRARY_BOOKS, uploaded];

test("validateCourseBooks accepts built-in and uploaded books, chapter or page range", () => {
  const chapter = manhaj.chapters[3];
  const result = validateCourseBooks([
    { slug: manhaj.slug, chapterTitle: chapter.title, pageFrom: chapter.page, pageTo: chapter.page + 10, note: "  1-ci həftə\u202e " },
    { slug: uploaded.slug, pageFrom: 5 },
    { slug: tuhfa.slug },
  ], catalog);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.value.length, 3);
  assert.equal(result.value[0].chapterTitle, chapter.title);
  assert.equal(result.value[0].note, "1-ci həftə");
  // Fəsil adı səhifədən avtomatik tapılır.
  assert.equal(result.value[1].chapterTitle, "باب الطهارة");
  assert.deepEqual(result.value[2], { slug: tuhfa.slug, pageFrom: null, pageTo: null, chapterTitle: null, note: null });
  // Fəsil seçilib, səhifə yoxdur → fəslin səhifəsi götürülür.
  const byChapter = validateCourseBooks([{ slug: manhaj.slug, chapterTitle: chapter.title }], catalog);
  assert.ok(byChapter.ok && byChapter.value[0].pageFrom === chapter.page);
});

test("validateCourseBooks rejects bad input", () => {
  assert.ok(!validateCourseBooks("x", catalog).ok);
  assert.ok(!validateCourseBooks([{ slug: "yoxdur" }], catalog).ok, "unknown slug");
  assert.ok(!validateCourseBooks([{ slug: manhaj.slug, pageFrom: 0 }], catalog).ok, "page < 1");
  assert.ok(!validateCourseBooks([{ slug: manhaj.slug, pageFrom: manhaj.pageCount + 1 }], catalog).ok, "page > count");
  assert.ok(!validateCourseBooks([{ slug: manhaj.slug, pageTo: 10 }], catalog).ok, "pageTo without pageFrom");
  assert.ok(!validateCourseBooks([{ slug: manhaj.slug, pageFrom: 20, pageTo: 10 }], catalog).ok, "reversed range");
  assert.ok(!validateCourseBooks([{ slug: manhaj.slug, pageFrom: "abc" }], catalog).ok);
  assert.ok(!validateCourseBooks(Array.from({ length: MAX_BOOKS_PER_LESSON + 1 }, () => ({ slug: manhaj.slug })), catalog).ok);
  // Saxta fəsil adı saxlanmır.
  const fake = validateCourseBooks([{ slug: manhaj.slug, chapterTitle: "<script>alert(1)</script>" }], catalog);
  assert.ok(fake.ok && fake.value[0].chapterTitle === null);
  // Dublikatlar birləşir.
  const dup = validateCourseBooks([{ slug: tuhfa.slug }, { slug: tuhfa.slug }], catalog);
  assert.ok(dup.ok && dup.value.length === 1);
});

test("resolveCourseBooks maps scan pages to printed pages and marks deleted books", () => {
  const [view, gone] = resolveCourseBooks([
    { slug: uploaded.slug, pageFrom: 5, pageTo: 9, chapterTitle: null, note: null },
    { slug: "u-deleted", pageFrom: null, pageTo: null, chapterTitle: null, note: null },
  ], catalog);
  assert.equal(view.printedFrom, 3);
  assert.equal(view.printedTo, 7);
  assert.equal(view.openPage, 5);
  assert.equal(gone.available, false);
  assert.equal(gone.openPage, 1);
});

test("detectCourseBooksQuestion", () => {
  for (const question of [
    "Fiqh dərsində hansı kitabı keçəcəyik?",
    "fiqh dersinde hangi kitabi kececeyik",
    "Nəhv dərsinin kitabı hansıdır?",
    "Bu semestr hansı kitabları oxuyacağıq?",
    "Fıkıh dersinde hangi kitap okuyacağız",
    "dərslik hansıdır sərf fənni üçün",
  ]) assert.ok(detectCourseBooksQuestion(question), question);
  for (const question of [
    "Kitabxanada axtar: fiqh dərsi",
    "kitabxanada axtar dəstəmaz",
    "Kitabxana",
    "Dərs cədvəlim",
    "Fiqh dərsində qiymətim neçədir?",
    "المسح على الخفين",
  ]) assert.ok(!detectCourseBooksQuestion(question), question);
});

test("answerCourseBooks answers only for the student's courses", () => {
  const courses = [
    { courseId: 1, title: "Fiqh", termNumber: 2 },
    { courseId: 2, title: "Nəhv", termNumber: 2 },
  ];
  const rows = [
    { courseId: 1, termNumber: 1, books: [{ slug: tuhfa.slug, pageFrom: null, pageTo: null, chapterTitle: null, note: null }] },
    { courseId: 1, termNumber: 2, books: [{ slug: manhaj.slug, pageFrom: 11, pageTo: 30, chapterTitle: null, note: "Taharət" }] },
    { courseId: 9, termNumber: 2, books: [{ slug: tuhfa.slug, pageFrom: null, pageTo: null, chapterTitle: null, note: null }] },
  ];
  const fiqh = answerCourseBooks({ courses, matchedCourseIds: new Set([1]), currentTerm: 2, rows, catalog });
  assert.equal(fiqh.items.length, 1);
  assert.equal(fiqh.items[0].books[0].slug, manhaj.slug);
  assert.match(fiqh.reply, /Fiqh \(2-ci semestr\)/);
  assert.match(fiqh.reply, /s\. 10–29/);
  const nahw = answerCourseBooks({ courses, matchedCourseIds: new Set([2]), currentTerm: 2, rows, catalog });
  assert.equal(nahw.items.length, 0);
  assert.match(nahw.reply, /«Nəhv» dərsi üçün hələ/);
  const all = answerCourseBooks({ courses, matchedCourseIds: null, currentTerm: 2, rows, catalog });
  assert.deepEqual(all.items.map((item) => item.courseId), [1], "course 9 is not the student's");
});

test("courseBooksFromResources: book attached as a lesson resource is found with chapter + pages (lms_course_books missing)", () => {
  const courses = [{ courseId: 7, title: "TEST Fiqh dərsi", termNumber: 1 }, { courseId: 8, title: "Nəhv", termNumber: 1 }];
  const items = courseBooksFromResources({
    courses,
    matchedCourseIds: new Set([7]),
    currentTerm: 1,
    resources: [
      { courseId: 7, termNumber: 1, title: "Zoom", body: "https://meet.google.com/test-abc-def" },
      { courseId: 7, termNumber: 1, title: "TEST kitab — شرح منهج السالكين", body: "باب نواقض الوضوء, səh. 55-56" },
      { courseId: 7, termNumber: 2, title: "التحفة السنية", body: "" }, // gələcək semestr — göstərilmir
    ],
    catalog,
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].courseTitle, "TEST Fiqh dərsi");
  assert.equal(items[0].books.length, 1);
  const [book] = items[0].books;
  assert.equal(book.slug, "manhaj-as-salikin");
  assert.equal(book.chapterTitle, "باب نواقض الوضوء");
  assert.equal(book.printedFrom, 55);
  assert.equal(book.printedTo, 56);
  assert.equal(book.openPage, 56);
});

test("suggestedLibraryBooks: course title subject → built-in library book", () => {
  const suggestions = suggestedLibraryBooks({ courses: [{ courseId: 7, title: "TEST Fiqh dərsi", termNumber: 1 }, { courseId: 9, title: "Təfsir", termNumber: 1 }], matchedCourseIds: null, catalog: LIBRARY_BOOKS });
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].books[0].slug, "manhaj-as-salikin");
});
