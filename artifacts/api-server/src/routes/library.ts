// Mədrəsə Kitabxanası.
// - GET /api/library/books — yalnız təsdiqlənmiş tələbə və heyət. Kataloq + fəsillər + şəkillər üçün qısa ömürlü açar.
// - GET /api/library/books/:slug/pages/:page?t=… — səhifə şəkli (WebP). Açarsız / etibarsız açarla 401.
// Şəkillər ictimai qovluqda deyil: API paketinə daxil edilib (vercel.json → includeFiles: src/assets/**).
import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { findAssetPath } from "../lib/assets.js";
import { LIBRARY_BOOKS, findLibraryBook, libraryPageAssetPath } from "../lib/library/catalog.js";
import { createLibraryToken, verifyLibraryToken } from "../lib/library/token.js";
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

export default router;
