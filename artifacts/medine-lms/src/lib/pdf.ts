// pdf.js (Apache-2.0) — yalnız lazım olanda yüklənir (ayrı chunk): yüklənmiş kitabların səhifələrini çəkmək,
// yükləmə zamanı mətn qatını və üz qabığını çıxarmaq. Köhnə brauzerlər üçün «legacy» qurulması istifadə olunur.
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pdfItemsToText, type PdfTextItem } from '@/lib/pdf-text';

export type PdfDocument = PDFDocumentProxy;

let pdfjsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;

export function loadPdfjs() {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
    return pdfjs;
  }).catch((error) => {
    pdfjsPromise = null;
    throw error;
  });
  return pdfjsPromise;
}

export async function openPdf(source: { data: ArrayBuffer } | { url: string }): Promise<PdfDocument> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    ...('data' in source ? { data: new Uint8Array(source.data) } : { url: source.url, withCredentials: false }),
    isEvalSupported: false,
    enableXfa: false,
    // Səhifələr tələb olunduqca hissə-hissə (HTTP Range) yüklənsin.
    disableAutoFetch: true,
    rangeChunkSize: 1 << 20,
  });
  return task.promise;
}

/** Səhifəni JPEG-ə çəkir; targetHeight — piksel hündürlüyü. */
export async function renderPdfPage(doc: PdfDocument, pageNumber: number, targetHeight: number, quality = 0.85): Promise<{ blob: Blob; aspect: number }> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.max(0.2, Math.min(4, targetHeight / base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas dəstəklənmir.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  page.cleanup();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('Şəkil yaradılmadı.'))), 'image/jpeg', quality));
  canvas.width = 0;
  canvas.height = 0;
  return { blob, aspect: base.width / base.height };
}

/** Mətn qatı: hər səhifə üçün bir sətir. Skan PDF-lərdə boş olur. */
export async function extractPdfText(doc: PdfDocument, onProgress?: (done: number, total: number) => void, signal?: AbortSignal) {
  const pages: string[] = [];
  for (let number = 1; number <= doc.numPages; number += 1) {
    if (signal?.aborted) throw new DOMException('Ləğv edildi', 'AbortError');
    const page = await doc.getPage(number);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = [];
    for (const item of content.items) {
      if ('str' in item) items.push({ str: item.str, transform: item.transform as number[], width: item.width, height: item.height, hasEOL: item.hasEOL });
    }
    pages.push(pdfItemsToText(items).slice(0, 30_000));
    page.cleanup();
    onProgress?.(number, doc.numPages);
  }
  return pages;
}

/** Brauzer tərəfində təxmini yoxlama (server də yoxlayır). */
export function textLayerLooksUseful(pages: string[]) {
  const letters = pages.reduce((sum, page) => sum + (page.match(/\p{L}/gu)?.length ?? 0), 0);
  return letters >= Math.max(200, pages.length * 20);
}
