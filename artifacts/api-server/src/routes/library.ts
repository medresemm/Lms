// Mədrəsə Kitabxanası.
// - GET /api/library/books — yalnız təsdiqlənmiş tələbə və heyət. Kataloq + fəsillər + şəkillər üçün qısa ömürlü açar.
// - GET /api/library/books/:slug/pages/:page?t=… — səhifə şəkli (WebP). Açarsız / etibarsız açarla 401.
// - POST /api/library/search — kitab(lar)da axtarış («daha çox» və oxuyucudakı axtarış üçün). Sorğu POST gövdəsindədir
//   (URL-də deyil — giriş jurnallarına düşməsin), log edilmir, saxlanmır.
// Şəkillər ictimai qovluqda deyil: API paketinə daxil edilib (vercel.json → includeFiles: src/assets/**).
import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { findAssetPath } from "../lib/assets.js";
import { LIBRARY_BOOKS, findLibraryBook, libraryPageAssetPath } from "../lib/library/catalog.js";
import { createLibraryToken, verifyLibraryToken } from "../lib/library/token.js";
import { LIBRARY_PAGE_SIZE, runLibraryQuery } from "../lib/library/search.js";
import { requireApprovedStudentOrTeacher } from "./lms.js";

const router: IRouter = Router();

const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};

router.get("/library/books", noStore, requireApprovedStudentOrTeacher, (req, res) => {
  const userId = getAuth(req).userId as string;
  const { token, expiresAt } = createLibraryToken(userId);
  res.json({
    books: LIBRARY_BOOKS,
    pageToken: token,
    pageTokenExpiresAt: new Date(expiresAt * 1000).toISOString(),
  });
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

router.post("/library/search", noStore, requireApprovedStudentOrTeacher, (req, res) => {
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
  let book: string | null = null;
  if (body.book !== undefined && body.book !== null) {
    if (typeof body.book !== "string" || !findLibraryBook(body.book)) {
      res.status(400).json({ error: "Kitab tapılmadı." });
      return;
    }
    book = body.book;
  }
  res.json({ query, ...runLibraryQuery(query, { offset, limit, book }) });
});

export default router;
