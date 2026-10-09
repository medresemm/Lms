// PDF mətn qatından oxunaqlı səhifə mətni (DOM-suz, sırf funksiya).
// Ərəbcə PDF-lərdə pdf.js elementləri çox vaxt tək-tək hərf («glyph») və vizual (soldan sağa) sırada qaytarır,
// təqdimat formaları (ﺤ ﻟ ا) və xəritəsiz glyph-lər (\u0000) olur. Burada:
//  1) NFKC → əsas hərflər, \u0000 və nəzarət simvolları atılır;
//  2) elementlər koordinata görə sətirlərə yığılır, ərəbcə sətir sağdan sola düzülür;
//  3) boşluq yalnız elementlər arasında real məsafə olanda qoyulur (hərflər yenidən sözə birləşir).

export type PdfTextItem = { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean };

const ARABIC = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/g;
const LATIN = /[A-Za-z\u00c0-\u024f]/g;

export function cleanPdfString(value: string) {
  return value.normalize('NFKC').replace(/[\u0000-\u0008\u000b-\u001f\u007f\ufffd]/g, '');
}

type Positioned = { text: string; x: number; y: number; w: number; h: number };

export function pdfItemsToText(items: PdfTextItem[]): string {
  const positioned: Positioned[] = [];
  for (const item of items) {
    const text = cleanPdfString(item.str ?? '');
    if (!text || !Array.isArray(item.transform)) continue;
    const h = Math.abs(item.height) || Math.abs(item.transform[3]) || 10;
    positioned.push({ text, x: item.transform[4], y: item.transform[5], w: Math.abs(item.width) || 0, h });
  }
  if (!positioned.length) return '';
  // Sətirlər: yuxarıdan aşağı.
  positioned.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Positioned[][] = [];
  for (const item of positioned) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line[0].y - item.y) <= Math.max(line[0].h, item.h) * 0.5) line.push(item);
    else lines.push([item]);
  }
  return lines.map((line) => {
    const joined = line.map((item) => item.text).join('');
    const rtl = (joined.match(ARABIC)?.length ?? 0) >= (joined.match(LATIN)?.length ?? 0);
    line.sort((a, b) => (rtl ? b.x - a.x : a.x - b.x));
    let out = '';
    let previous: Positioned | null = null;
    for (const item of line) {
      if (!item.text.trim()) {
        if (!out.endsWith(' ')) out += ' ';
        previous = item;
        continue;
      }
      if (previous && previous.text.trim() && !out.endsWith(' ')) {
        const gap = rtl ? previous.x - (item.x + item.w) : item.x - (previous.x + previous.w);
        if (gap > Math.min(previous.h, item.h) * 0.18) out += ' ';
      }
      out += item.text;
      previous = item;
    }
    return out.replace(/\s+/g, ' ').trim();
  }).filter(Boolean).join('\n');
}
