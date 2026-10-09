// Mədrəsə Kitabxanası.
// - GET /api/library/books — yalnız təsdiqlənmiş tələbə və heyət. Kataloq + fəsillər + şəkillər üçün qısa ömürlü açar.
// - GET /api/library/books/:slug/pages/:page?t=… — səhifə şəkli (WebP). Açarsız / etibarsız açarla 401.
// - POST /api/library/search — kitab(lar)da axtarış («daha çox» və oxuyucudakı axtarış üçün). Sorğu POST gövdəsindədir
//   (URL-də deyil — giriş jurnallarına düşməsin), log edilmir, saxlanmır.
// - GET /api/library/books/:slug/file?t=…[&mode=download|view|json] — orijinal PDF (eyni açar). Yaddaş qoşuludursa
//   qısa ömürlü (10 dəq.) imzalı Supabase URL-ə yönləndirir (Content-Disposition: attachment, gözəl fayl adı),
//   yoxdursa (lokal) faylı birbaşa axınla verir. Cache-Control: no-store.
// - GET /api/library/course-books — dərslərə bağlanmış kitablar (təsdiqlənmiş tələbə və heyət);
//   PUT /api/library/course-books/:courseId/:termNumber — sahib / köməkçi / admin və ya həmin dərsin müəllimi.
// - /api/library/admin/* — yalnız sahib / sahib köməkçisi / admin: PDF yükləmə (birbaşa imzalı PUT), metadata, silmə.
// Şəkillər ictimai qovluqda deyil: API paketinə daxil edilib (vercel.json → includeFiles: src/assets/**).
import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { randomUUID } from "node:crypto";
import { coursesTable, db, libraryBooksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { findAssetPath, readAsset } from "../lib/assets.js";
import { recordAuditEvent } from "../lib/audit.js";
import { findLibraryBook, libraryPageAssetPath } from "../lib/library/catalog.js";
import { createLibraryToken, createUploadTicket, verifyLibraryToken, verifyUploadTicket } from "../lib/library/token.js";
import { LIBRARY_PAGE_SIZE, libraryPageText, runLibraryQuery } from "../lib/library/search.js";
import {
  LIBRARY_MAX_COVER_BYTES,
  LIBRARY_MAX_PAGES,
  LIBRARY_MAX_PDF_BYTES,
  LIBRARY_SUBJECTS,
  builtinPdfKey,
  isMissingTableError,
  isStorageId,
  isUploadedSlug,
  looksLikePdf,
  parseUploadedText,
  pdfContentDisposition,
  uploadKeys,
  uploadedSlug,
  validateBookFields,
} from "../lib/library/uploads.js";
import {
  UPLOADS_TABLE_MISSING_MESSAGE,
  builtinCatalog,
  builtinPdfAssetPath,
  findUploadedRow,
  invalidateUploadedBooks,
  libraryStore,
  loadUploadedBooks,
  searchableLibraryBooks,
} from "../lib/library/uploadedBooks.js";
import { resolveCourseBooks, validateCourseBooks } from "../lib/library/courseBooks.js";
import {
  COURSE_BOOKS_TABLE_MISSING_MESSAGE,
  fullLibraryCatalog,
  isMissingCourseBooksTable,
  loadCourseBooksRows,
  saveCourseBooks,
} from "../lib/library/courseBooksRepo.js";
import { logger } from "../lib/logger.js";
import { requireApprovedStudentOrTeacher, requireLibraryManager, userCanEditCourseBooks, userCanManageLibrary } from "./lms.js";

const router: IRouter = Router();

const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};

router.get("/library/books", noStore, requireApprovedStudentOrTeacher, async (req, res, next) => {
  try {
    const userId = getAuth(req).userId as string;
    const { token, expiresAt } = createLibraryToken(userId);
    const [uploaded, canManage] = await Promise.all([loadUploadedBooks(), userCanManageLibrary(userId).catch(() => false)]);
    res.json({
      books: [...builtinCatalog(), ...uploaded.books],
      pageToken: token,
      pageTokenExpiresAt: new Date(expiresAt * 1000).toISOString(),
      canManage,
      uploads: canManage
        ? { ...uploaded.status, maxPdfBytes: LIBRARY_MAX_PDF_BYTES, maxPages: LIBRARY_MAX_PAGES, subjects: LIBRARY_SUBJECTS }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

function unauthorizedFile(res: Parameters<RequestHandler>[1]) {
  res.setHeader("Cache-Control", "no-store");
  res.status(401).json({ error: "Kitabxanaya baxmaq üçün hesabınıza giriş edin." });
}

/** Orijinal PDF: yükləmə (attachment) və ya oxuyucu üçün (view/json). */
router.get("/library/books/:slug/file", async (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!verifyLibraryToken(req.query.t)) {
    unauthorizedFile(res);
    return;
  }
  const mode = req.query.mode === "json" ? "json" : req.query.mode === "view" ? "view" : "download";
  const slug = String(req.params.slug);
  try {
    const store = libraryStore();
    let key: string;
    let displayName: string;
    const builtin = findLibraryBook(slug);
    if (builtin) {
      const assetPath = builtinPdfAssetPath(builtin.slug);
      displayName = builtin.shortTitle;
      if (!store) {
        // Lokal mühit (yaddaş yoxdur): faylı birbaşa axınla ver.
        const file = findAssetPath(assetPath);
        if (!file || mode === "json") {
          res.status(404).json({ error: "PDF tapılmadı." });
          return;
        }
        res.setHeader("Content-Disposition", pdfContentDisposition(displayName, builtin.slug).replace(/^attachment/, mode === "view" ? "inline" : "attachment"));
        res.type("application/pdf");
        res.sendFile(file);
        return;
      }
      key = builtinPdfKey(builtin.slug);
      // Vercel funksiyasının cavab limiti (4.5 MB) səbəbindən PDF yaddaşa bir dəfə köçürülür və imzalı URL ilə verilir.
      if (!(await store.head(key))) {
        const bytes = readAsset(assetPath);
        if (!bytes) {
          res.status(404).json({ error: "PDF tapılmadı." });
          return;
        }
        await store.putFile(key, bytes, "application/pdf");
      }
    } else if (isUploadedSlug(slug)) {
      if (!store) {
        res.status(404).json({ error: "PDF tapılmadı." });
        return;
      }
      const row = await findUploadedRow(slug).catch((error) => {
        if (isMissingTableError(error)) return null;
        throw error;
      });
      if (!row) {
        res.status(404).json({ error: "Kitab tapılmadı." });
        return;
      }
      key = uploadKeys(row.storageId).pdf;
      displayName = row.shortTitle;
    } else {
      res.status(404).json({ error: "Kitab tapılmadı." });
      return;
    }
    const disposition = pdfContentDisposition(displayName, slug);
    const url = await store.signedGet(key, {
      contentType: "application/pdf",
      disposition: mode === "download" ? disposition : disposition.replace(/^attachment/, "inline"),
      expiresIn: 10 * 60,
    });
    if (mode === "json") {
      res.json({ url, expiresInSeconds: 600 });
      return;
    }
    res.redirect(302, url);
  } catch (error) {
    next(error);
  }
});

/** Yüklənmiş kitabın üz qabığı (yükləmə zamanı brauzerdə 1-ci səhifədən hazırlanır). */
router.get("/library/books/:slug/cover", async (req, res, next) => {
  if (!verifyLibraryToken(req.query.t)) {
    unauthorizedFile(res);
    return;
  }
  try {
    const slug = String(req.params.slug);
    const store = libraryStore();
    const row = store && isUploadedSlug(slug) ? await findUploadedRow(slug).catch(() => null) : null;
    if (!store || !row || !row.hasCover) {
      res.setHeader("Cache-Control", "no-store");
      res.status(404).json({ error: "Üz qabığı tapılmadı." });
      return;
    }
    const url = await store.signedGet(uploadKeys(row.storageId).cover, { contentType: "image/jpeg", expiresIn: 60 * 60 });
    res.setHeader("Cache-Control", "private, max-age=600");
    res.redirect(302, url);
  } catch (error) {
    next(error);
  }
});

router.get("/library/books/:slug/pages/:page", (req, res) => {
  if (!verifyLibraryToken(req.query.t)) {
    res.setHeader("Cache-Control", "no-store");
    res.status(401).json({ error: "Kitabxanaya baxmaq üçün hesabınıza giriş edin." });
    return;
  }
  const book = findLibraryBook(String(req.params.slug));
  const page = Number(String(req.params.page).replace(/\.webp$/i, ""));
  if (!book || !Number.isSafeInteger(page) || page < 1 || page > book.pageCount) {
    res.setHeader("Cache-Control", "no-store");
    res.status(404).json({ error: "Səhifə tapılmadı." });
    return;
  }
  const file = findAssetPath(libraryPageAssetPath(book.slug, page));
  if (!file) {
    res.setHeader("Cache-Control", "no-store");
    res.status(404).json({ error: "Səhifə tapılmadı." });
    return;
  }
  // Şəkillər dəyişmir; yalnız brauzer keşində saxlanılsın (paylaşılan keşlərdə yox).
  res.setHeader("Cache-Control", "private, max-age=86400, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.type("image/webp");
  res.sendFile(file);
});

const searchBuckets = new Map<string, { count: number; resetAt: number }>();
const SEARCH_LIMIT_PER_MINUTE = 60;

function allowSearch(userId: string) {
  const now = Date.now();
  if (searchBuckets.size > 5000) for (const [key, bucket] of searchBuckets) if (bucket.resetAt <= now) searchBuckets.delete(key);
  const bucket = searchBuckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    searchBuckets.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= SEARCH_LIMIT_PER_MINUTE;
}

router.post("/library/search", noStore, requireApprovedStudentOrTeacher, async (req, res) => {
  const userId = getAuth(req).userId as string;
  if (!allowSearch(userId)) {
    res.status(429).json({ error: "Çox sürətli sorğu göndərilir. Bir dəqiqə sonra yenidən cəhd edin." });
    return;
  }
  const body = (req.body ?? {}) as { query?: unknown; offset?: unknown; book?: unknown; limit?: unknown };
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 2 || query.length > 200) {
    res.status(400).json({ error: "Axtarış sözü 2–200 simvol olmalıdır." });
    return;
  }
  const offset = Number(body.offset ?? 0);
  const limit = Number(body.limit ?? LIBRARY_PAGE_SIZE);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 200 || !Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
    res.status(400).json({ error: "Səhifələmə parametrləri düzgün deyil." });
    return;
  }
  const books = await searchableLibraryBooks();
  let book: string | null = null;
  if (body.book !== undefined && body.book !== null) {
    if (typeof body.book !== "string" || !books.some((item) => item.slug === body.book)) {
      res.status(400).json({ error: "Bu kitabda axtarış mümkün deyil (kitab tapılmadı və ya mətn qatı yoxdur)." });
      return;
    }
    book = body.book;
  }
  res.json({ query, ...runLibraryQuery(query, { offset, limit, book, books }) });
});

// «Davamı»: nəticənin bütün səhifə mətni (yalnız düymə ilə; sorğu jurnala yazılmır).
router.post("/library/page-text", noStore, requireApprovedStudentOrTeacher, async (req, res, next) => {
  try {
    const userId = getAuth(req).userId as string;
    if (!allowSearch(userId)) {
      res.status(429).json({ error: "Çox sürətli sorğu göndərilir. Bir dəqiqə sonra yenidən cəhd edin." });
      return;
    }
    const body = (req.body ?? {}) as { slug?: unknown; page?: unknown; query?: unknown };
    const page = Number(body.page);
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 200) : "";
    if (typeof body.slug !== "string" || !Number.isSafeInteger(page) || page < 1 || page > 5000) {
      res.status(400).json({ error: "Kitab və ya səhifə düzgün deyil." });
      return;
    }
    const result = libraryPageText(body.slug, page, query, { books: await searchableLibraryBooks() });
    if (!result) {
      res.status(404).json({ error: "Bu səhifənin mətni tapılmadı." });
      return;
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Dərs kitabları

router.get("/library/course-books", noStore, requireApprovedStudentOrTeacher, async (req, res, next) => {
  try {
    const courseId = req.query.courseId === undefined ? null : Number(req.query.courseId);
    if (courseId !== null && (!Number.isSafeInteger(courseId) || courseId < 1)) {
      res.status(400).json({ error: "Fənn düzgün seçilməyib." });
      return;
    }
    const [{ available, rows }, catalog] = await Promise.all([
      loadCourseBooksRows(courseId === null ? undefined : [courseId]),
      fullLibraryCatalog(),
    ]);
    const userId = getAuth(req).userId as string;
    res.json({
      available,
      message: available ? null : COURSE_BOOKS_TABLE_MISSING_MESSAGE,
      canManageAll: await userCanManageLibrary(userId).catch(() => false),
      items: rows.map((row) => ({ courseId: row.courseId, termNumber: row.termNumber, books: resolveCourseBooks(row.books, catalog) })),
    });
  } catch (error) {
    next(error);
  }
});

router.put("/library/course-books/:courseId/:termNumber", noStore, async (req, res, next) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Bu səhifəyə daxil olmaq üçün hesabınıza giriş edin." });
      return;
    }
    const courseId = Number(req.params.courseId);
    const termNumber = Number(req.params.termNumber);
    if (!Number.isSafeInteger(courseId) || courseId < 1 || !Number.isInteger(termNumber) || termNumber < 1 || termNumber > 8) {
      res.status(400).json({ error: "Fənn və semestr düzgün seçilməyib." });
      return;
    }
    if (!(await userCanEditCourseBooks(userId, courseId, termNumber))) {
      res.status(403).json({ error: "Bu dərsin kitablarını yalnız sahib, sahib köməkçisi, admin və ya dərsin müəllimi dəyişə bilər." });
      return;
    }
    const [course] = await db.select({ id: coursesTable.id, title: coursesTable.title }).from(coursesTable).where(eq(coursesTable.id, courseId)).limit(1);
    if (!course) {
      res.status(404).json({ error: "Fənn tapılmadı." });
      return;
    }
    const catalog = await fullLibraryCatalog();
    const parsed = validateCourseBooks((req.body as { books?: unknown } | undefined)?.books, catalog);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    await saveCourseBooks(courseId, termNumber, parsed.value, userId);
    await recordAuditEvent({
      eventType: "course.books.updated",
      actorClerkUserId: userId,
      targetType: "course",
      targetId: courseId,
      details: { termNumber, books: parsed.value.map((book) => book.slug) },
      deduplicationKey: `course.books.updated:${courseId}:${termNumber}:${randomUUID()}`,
    });
    res.json({ courseId, termNumber, books: resolveCourseBooks(parsed.value, catalog) });
  } catch (error) {
    if (isMissingCourseBooksTable(error)) {
      res.status(503).json({ error: COURSE_BOOKS_TABLE_MISSING_MESSAGE, code: "COURSE_BOOKS_UNAVAILABLE" });
      return;
    }
    next(error);
  }
});

// ---------------------------------------------------------------------------
// İdarəetmə (sahib / sahib köməkçisi / admin)

function uploadsUnavailable(res: Parameters<RequestHandler>[1], message: string) {
  res.status(503).json({ error: message, code: "LIBRARY_UPLOADS_UNAVAILABLE" });
}

async function requireUploadsAvailable(res: Parameters<RequestHandler>[1]) {
  const { status } = await loadUploadedBooks(true);
  if (!status.available) {
    uploadsUnavailable(res, status.message);
    return false;
  }
  return true;
}

/** 1-ci addım: imzalı PUT URL-ləri (PDF, mətn qatı, üz qabığı). Fayl API-dən keçmir (Vercel 4.5 MB limiti). */
router.post("/library/admin/uploads", noStore, requireLibraryManager, async (req, res, next) => {
  try {
    if (!(await requireUploadsAvailable(res))) return;
    const store = libraryStore()!;
    const body = (req.body ?? {}) as { fileSize?: unknown; contentType?: unknown; fileName?: unknown };
    const fileSize = Number(body.fileSize);
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    if (body.contentType !== "application/pdf" || !/\.pdf$/i.test(fileName)) {
      res.status(400).json({ error: "Yalnız PDF faylı yükləmək olar." });
      return;
    }
    if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > LIBRARY_MAX_PDF_BYTES) {
      res.status(400).json({ error: `PDF faylı ən çox ${Math.round(LIBRARY_MAX_PDF_BYTES / 1024 / 1024)} MB ola bilər.` });
      return;
    }
    const userId = getAuth(req).userId as string;
    const storageId = randomUUID();
    const keys = uploadKeys(storageId);
    const [pdfUploadURL, textUploadURL, coverUploadURL] = await Promise.all([
      store.signedPut(keys.pdf, "application/pdf"),
      store.signedPut(keys.text, "application/json"),
      store.signedPut(keys.cover, "image/jpeg"),
    ]);
    res.json({ storageId, ticket: createUploadTicket(userId, storageId), pdfUploadURL, textUploadURL, coverUploadURL });
  } catch (error) {
    next(error);
  }
});

async function deleteStoredObjects(storageId: string) {
  const store = libraryStore();
  if (!store) return;
  const keys = uploadKeys(storageId);
  await Promise.all([store.delete(keys.pdf), store.delete(keys.text), store.delete(keys.cover)]);
}

/** 2-ci addım: fayllar yaddaşa yükləndikdən sonra yoxlanılır və kitab qeyd olunur. */
router.post("/library/admin/books", noStore, requireLibraryManager, async (req, res, next) => {
  try {
    if (!(await requireUploadsAvailable(res))) return;
    const store = libraryStore()!;
    const userId = getAuth(req).userId as string;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const storageId = body.storageId;
    if (!isStorageId(storageId) || !verifyUploadTicket(body.ticket, userId, storageId)) {
      res.status(400).json({ error: "Yükləmə bileti etibarsızdır və ya vaxtı keçib. Faylı yenidən seçin." });
      return;
    }
    const pageCount = Number(body.pageCount);
    if (!Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > LIBRARY_MAX_PAGES) {
      res.status(400).json({ error: `PDF-in səhifə sayı 1–${LIBRARY_MAX_PAGES} olmalıdır.` });
      return;
    }
    const fields = validateBookFields(body, pageCount);
    if (!fields.ok) {
      res.status(400).json({ error: fields.error });
      return;
    }
    const keys = uploadKeys(storageId);
    const pdf = await store.head(keys.pdf);
    if (!pdf || pdf.size < 1 || pdf.size > LIBRARY_MAX_PDF_BYTES) {
      await deleteStoredObjects(storageId);
      res.status(400).json({ error: pdf ? "PDF faylının ölçüsü icazə veriləndən böyükdür." : "PDF faylı yaddaşda tapılmadı. Yenidən yükləyin." });
      return;
    }
    const head = await store.read(keys.pdf, { start: 0, end: 1023 });
    if (!looksLikePdf(head)) {
      await deleteStoredObjects(storageId);
      res.status(400).json({ error: "Fayl PDF deyil." });
      return;
    }
    let hasText = false;
    const text = await store.head(keys.text);
    if (text) {
      const parsed = parseUploadedText(await store.read(keys.text), pageCount);
      hasText = parsed.ok && parsed.value.hasText;
      if (!hasText) await store.delete(keys.text);
    }
    const cover = await store.head(keys.cover);
    const hasCover = Boolean(cover && cover.size > 0 && cover.size <= LIBRARY_MAX_COVER_BYTES);
    if (cover && !hasCover) await store.delete(keys.cover);
    const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : null;
    const slug = uploadedSlug(storageId);
    const [row] = await db.insert(libraryBooksTable).values({
      slug,
      storageId,
      ...fields.value,
      pageCount,
      hasText,
      hasCover,
      fileSize: pdf.size,
      originalFileName: fileName,
      uploadedByClerkUserId: userId,
    }).onConflictDoNothing().returning({ slug: libraryBooksTable.slug });
    if (!row) {
      res.status(409).json({ error: "Bu fayl artıq kitab kimi qeyd olunub." });
      return;
    }
    invalidateUploadedBooks();
    await recordAuditEvent({
      eventType: "library.book.uploaded",
      actorClerkUserId: userId,
      targetType: "library_book",
      targetId: slug,
      details: { title: fields.value.title, pageCount, fileSize: pdf.size, hasText },
      deduplicationKey: `library.book.uploaded:${slug}`,
    });
    res.status(201).json({ slug, hasText, hasCover, pageCount, fileSize: pdf.size });
  } catch (error) {
    if (isMissingTableError(error)) {
      uploadsUnavailable(res, UPLOADS_TABLE_MISSING_MESSAGE);
      return;
    }
    next(error);
  }
});

router.patch("/library/admin/books/:slug", noStore, requireLibraryManager, async (req, res, next) => {
  try {
    const slug = String(req.params.slug);
    if (findLibraryBook(slug)) {
      res.status(400).json({ error: "Daxili (skan) kitablar buradan redaktə edilmir." });
      return;
    }
    if (!isUploadedSlug(slug)) {
      res.status(404).json({ error: "Kitab tapılmadı." });
      return;
    }
    const row = await findUploadedRow(slug);
    if (!row) {
      res.status(404).json({ error: "Kitab tapılmadı." });
      return;
    }
    const fields = validateBookFields(req.body, row.pageCount);
    if (!fields.ok) {
      res.status(400).json({ error: fields.error });
      return;
    }
    await db.update(libraryBooksTable).set({ ...fields.value, updatedAt: new Date() }).where(eq(libraryBooksTable.slug, slug));
    invalidateUploadedBooks();
    const userId = getAuth(req).userId as string;
    await recordAuditEvent({
      eventType: "library.book.updated",
      actorClerkUserId: userId,
      targetType: "library_book",
      targetId: slug,
      details: { title: fields.value.title, chapters: fields.value.chapters.length },
      deduplicationKey: `library.book.updated:${slug}:${randomUUID()}`,
    });
    res.json({ ok: true });
  } catch (error) {
    if (isMissingTableError(error)) {
      uploadsUnavailable(res, UPLOADS_TABLE_MISSING_MESSAGE);
      return;
    }
    next(error);
  }
});

router.delete("/library/admin/books/:slug", noStore, requireLibraryManager, async (req, res, next) => {
  try {
    const slug = String(req.params.slug);
    if (findLibraryBook(slug)) {
      res.status(400).json({ error: "Daxili (skan) kitablar silinmir." });
      return;
    }
    if (!isUploadedSlug(slug)) {
      res.status(404).json({ error: "Kitab tapılmadı." });
      return;
    }
    const [row] = await db.delete(libraryBooksTable).where(eq(libraryBooksTable.slug, slug)).returning();
    if (!row) {
      res.status(404).json({ error: "Kitab tapılmadı." });
      return;
    }
    invalidateUploadedBooks();
    await deleteStoredObjects(row.storageId).catch((error) => logger.warn({ err: error, slug }, "library object cleanup failed"));
    const userId = getAuth(req).userId as string;
    await recordAuditEvent({
      eventType: "library.book.deleted",
      actorClerkUserId: userId,
      targetType: "library_book",
      targetId: slug,
      details: { title: row.title },
      deduplicationKey: `library.book.deleted:${slug}`,
    });
    res.json({ ok: true });
  } catch (error) {
    if (isMissingTableError(error)) {
      uploadsUnavailable(res, UPLOADS_TABLE_MISSING_MESSAGE);
      return;
    }
    next(error);
  }
});

export default router;
