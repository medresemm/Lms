// Kitabxana səhifə şəkilləri üçün qısa ömürlü imzalı açar.
// Giriş yoxlaması (tələbə / heyət) /api/library/books-da edilir; şəkil sorğusu yalnız bu açarı yoxlayır,
// beləliklə <img> teqləri işləyir, Clerk-ə hər şəkil üçün müraciət edilmir. Açar istifadəçiyə bağlıdır.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_SECONDS = 2 * 60 * 60;
/** Brauzer keşi işləsin deyə açar saatlıq «kova» ilə yaradılır: eyni saatda eyni URL. */
const BUCKET_SECONDS = 60 * 60;

let fallbackKey: Buffer | null = null;

function signingKey(): Buffer {
  const secret = process.env.LIBRARY_SIGNING_SECRET || process.env.CLERK_SECRET_KEY;
  if (secret) return createHmac("sha256", secret).update("medine-library-pages-v1").digest();
  fallbackKey ??= randomBytes(32);
  return fallbackKey;
}

function sign(payload: string, key: Buffer) {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createLibraryToken(userId: string, nowSeconds = Math.floor(Date.now() / 1000), key = signingKey()) {
  const expiresAt = (Math.floor(nowSeconds / BUCKET_SECONDS) * BUCKET_SECONDS) + TOKEN_TTL_SECONDS;
  const subject = Buffer.from(userId, "utf8").toString("base64url");
  const payload = `${subject}.${expiresAt}`;
  return { token: `${payload}.${sign(payload, key)}`, expiresAt };
}

export function verifyLibraryToken(token: unknown, nowSeconds = Math.floor(Date.now() / 1000), key = signingKey()): boolean {
  if (typeof token !== "string" || token.length > 512) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [subject, expires, signature] = parts;
  const expiresAt = Number(expires);
  if (!subject || !Number.isSafeInteger(expiresAt) || expiresAt <= nowSeconds) return false;
  const expected = Buffer.from(sign(`${subject}.${expires}`, key));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
