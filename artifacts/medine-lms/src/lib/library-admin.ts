// Kitabxana idarəsi (sahib / sahib köməkçisi / admin): PDF yükləmə, metadata, silmə.
// PDF API-dən keçmir: server qısa ömürlü imzalı PUT URL verir, fayl birbaşa yaddaşa (Supabase) gedir.
import type { LibraryChapter } from '@/lib/library';

const siteBase = import.meta.env.BASE_URL.replace(/\/$/, '');

export type ChapterDraft = { title: string; printedPage: string; level: 1 | 2 };
export type BookFieldsInput = {
  title: string;
  author: string;
  commentator: string;
  publisher: string;
  year: string;
  subject: string;
  pageOffset: number;
  chapters: Array<{ title: string; printedPage: number; level: 1 | 2 }>;
};

type GetToken = () => Promise<string | null>;

async function api<T>(getToken: GetToken, path: string, init: { method: string; body?: unknown }, failed = 'Əməliyyat alınmadı. Bir az sonra yenidən cəhd edin.'): Promise<T> {
  const token = await getToken().catch(() => null);
  const response = await fetch(`${siteBase}/api${path}`, {
    method: init.method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !data) throw new Error(data?.error || failed);
  return data;
}

export type UploadSlot = { storageId: string; ticket: string; pdfUploadURL: string; textUploadURL: string; coverUploadURL: string };

export function requestUploadSlot(getToken: GetToken, file: File, failed?: string) {
  return api<UploadSlot>(getToken, '/library/admin/uploads', { method: 'POST', body: { fileSize: file.size, contentType: 'application/pdf', fileName: file.name } }, failed);
}

/** İmzalı URL-ə PUT (irəliləyiş ilə). */
export function putToSignedUrl(url: string, body: Blob, contentType: string, onProgress?: (fraction: number) => void, signal?: AbortSignal, labels?: { storageStatus?: string; storageNetwork?: string }) {
  const storageStatus = labels?.storageStatus ?? 'Fayl yaddaşa yüklənmədi ({status}).';
  const storageNetwork = labels?.storageNetwork ?? 'Fayl yaddaşa yüklənmədi: şəbəkə xətası.';
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(event.loaded / event.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(storageStatus.replace('{status}', String(xhr.status)))));
    xhr.onerror = () => reject(new Error(storageNetwork));
    xhr.onabort = () => reject(new DOMException('Ləğv edildi', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

export function createUploadedBook(getToken: GetToken, input: BookFieldsInput & { storageId: string; ticket: string; pageCount: number; fileName: string }, failed?: string) {
  return api<{ slug: string; hasText: boolean; hasCover: boolean; pageCount: number; fileSize: number }>(getToken, '/library/admin/books', { method: 'POST', body: input }, failed);
}

export function updateUploadedBook(getToken: GetToken, slug: string, input: BookFieldsInput, failed?: string) {
  return api<{ ok: true }>(getToken, `/library/admin/books/${encodeURIComponent(slug)}`, { method: 'PATCH', body: input }, failed);
}

export function deleteUploadedBook(getToken: GetToken, slug: string, failed?: string) {
  return api<{ ok: true }>(getToken, `/library/admin/books/${encodeURIComponent(slug)}`, { method: 'DELETE' }, failed);
}

export function chaptersToDrafts(chapters: LibraryChapter[]): ChapterDraft[] {
  return chapters.map((chapter) => ({ title: chapter.title, printedPage: String(chapter.printedPage), level: chapter.level }));
}

/** Boş sətirləri atır; səhifə nömrəsi rəqəm olmalıdır. */
export function draftsToChapters(drafts: ChapterDraft[], labels?: { missingTitle?: string; missingPage?: string }): { ok: true; chapters: BookFieldsInput['chapters'] } | { ok: false; error: string } {
  const missingTitle = labels?.missingTitle ?? '{n}-ci fəslin başlığını yazın.';
  const missingPage = labels?.missingPage ?? '«{title}» üçün səhifə nömrəsini yazın.';
  const chapters: BookFieldsInput['chapters'] = [];
  for (const [index, draft] of drafts.entries()) {
    const title = draft.title.trim();
    const pageText = draft.printedPage.trim();
    if (!title && !pageText) continue;
    const printedPage = Number(pageText);
    if (!title) return { ok: false, error: missingTitle.replace('{n}', String(index + 1)) };
    if (!pageText || !Number.isSafeInteger(printedPage)) return { ok: false, error: missingPage.replace('{title}', title) };
    chapters.push({ title, printedPage, level: draft.level });
  }
  return { ok: true, chapters };
}

/** «Başlıq | səhifə» və ya «Başlıq<TAB>səhifə» sətirlərini fəsil siyahısına çevirir (mündəricatı yapışdırmaq üçün). */
export function parseChapterLines(text: string): ChapterDraft[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const level: 1 | 2 = /^[-–•*]\s*/.test(line) ? 2 : 1;
    const clean = line.replace(/^[-–•*]\s*/, '');
    const match = clean.match(/^(.*?)[\s|\t.…·:-]*([0-9٠-٩]{1,4})$/);
    if (!match) return { title: clean, printedPage: '', level };
    const digits = match[2].replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
    return { title: match[1].replace(/[\s|.…·:-]+$/, '').trim(), printedPage: digits, level };
  });
}
