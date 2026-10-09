import fs from "node:fs";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { findAssetPath, readAsset } from "./assets.js";
import { hasRtl, paragraphIsRtl, visualRuns, type VisualRun } from "./certificateBidi.js";

const a4Width = 595.28;
const a4Height = 841.89;
const outerPadding = 14;
const innerX = outerPadding;
const innerY = outerPadding;
const innerWidth = a4Width - (innerX * 2);
const innerHeight = a4Height - (innerY * 2);
const contentX = innerX + 51;
const contentWidth = innerWidth - 102;
const navy = "#173b51";
const muted = "#64747b";
const gold = "#d6b467";
const paper = "#fbfaf5";
const sealBlue = "#1e5bb7";

// Şriftlər repo-da (src/assets/fonts) saxlanılır ki, Vercel-də də Azərbaycan hərfləri (ə, ğ, ı, ö, ş, ü, ç) düzgün çıxsın.
// Sistem şriftləri yalnız lokal/Replit üçün ehtiyat variantdır.
const sansFont =
  findAssetPath("fonts/DejaVuSans.ttf") ??
  [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  ].find((candidate) => fs.existsSync(candidate));
const serifFont =
  findAssetPath("fonts/DejaVuSerif.ttf") ??
  [
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
  ].find((candidate) => fs.existsSync(candidate)) ??
  sansFont;
const academyLogo = readAsset("medine-logo-email.png");

function formatDate(value: string) {
  return new Intl.DateTimeFormat("az-AZ", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatSealDate(value: string) {
  return new Intl.DateTimeFormat("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function setFont(document: PDFKit.PDFDocument, font?: string) {
  if (font) document.font(font);
}

// Ərəb/ivrit mətni: PDFKit bidi dəstəkləmir, ona görə belə mətnlər üçün sətir bölgüsü və vizual
// sıralama certificateBidi.ts ilə burada edilir. Ərəb hərfləri DejaVu Sans ilə çəkilir (Serif-də ərəb
// qlifləri yoxdur); fontkit ərəb hərflərini birləşdirir (shaping). Latın mətni blokun öz şriftində qalır.
type BidiLine = { text: string; baseRtl: boolean; runs: Array<VisualRun & { font?: string; width: number }>; width: number };

function runFont(run: VisualRun, font?: string) {
  return run.rtlScript && sansFont ? sansFont : font;
}

function layoutBidiLine(document: PDFKit.PDFDocument, line: string, baseRtl: boolean, fontSize: number, font?: string): BidiLine {
  const runs = visualRuns(line, baseRtl).map((run) => {
    const runFontPath = runFont(run, font);
    setFont(document, runFontPath);
    document.fontSize(fontSize);
    return { ...run, font: runFontPath, width: document.widthOfString(run.draw) };
  });
  return { text: line, baseRtl, runs, width: runs.reduce((sum, run) => sum + run.width, 0) };
}

// Latın (LTR) paraqrafın içindəki qısa ərəb ifadəsi, məs. "(العلوم الشرعية)", iki sətrə bölünmür.
function groupRtlPhrases(words: string[], baseRtl: boolean) {
  if (baseRtl) return words;
  const grouped: string[] = [];
  for (const word of words) {
    const previous = grouped[grouped.length - 1];
    if (previous && hasRtl(previous) && hasRtl(word) && Array.from(`${previous} ${word}`).length <= 32) {
      grouped[grouped.length - 1] = `${previous} ${word}`;
    } else {
      grouped.push(word);
    }
  }
  return grouped;
}

function wrapBidiText(document: PDFKit.PDFDocument, text: string, fontSize: number, font: string | undefined, width: number) {
  const lines: BidiLine[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const baseRtl = paragraphIsRtl(paragraph);
    const words = groupRtlPhrases(paragraph.split(/[ \t]+/).filter(Boolean), baseRtl);
    let current = "";
    const push = (value: string) => lines.push(layoutBidiLine(document, value, baseRtl, fontSize, font));
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (layoutBidiLine(document, candidate, baseRtl, fontSize, font).width <= width) {
        current = candidate;
        continue;
      }
      if (current) push(current);
      current = word;
      // Sətrə sığmayan tək söz hərf-hərf bölünür.
      while (layoutBidiLine(document, current, baseRtl, fontSize, font).width > width && Array.from(current).length > 1) {
        const chars = Array.from(current);
        let cut = chars.length - 1;
        while (cut > 1 && layoutBidiLine(document, chars.slice(0, cut).join(""), baseRtl, fontSize, font).width > width) cut--;
        push(chars.slice(0, cut).join(""));
        current = chars.slice(cut).join("");
      }
    }
    if (current || !words.length) push(current);
  }
  return lines;
}

function bidiLineHeight(document: PDFKit.PDFDocument, fontSize: number, font?: string) {
  setFont(document, font);
  return document.fontSize(fontSize).currentLineHeight(true);
}

function measureBidiBlock(document: PDFKit.PDFDocument, text: string, fontSize: number, font: string | undefined, width: number, lineGap: number) {
  const lines = wrapBidiText(document, text, fontSize, font, width);
  return lines.length * (bidiLineHeight(document, fontSize, font) + lineGap);
}

function drawBidiBlock(
  document: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  options: { fontSize: number; font?: string; width: number; lineGap: number; maxHeight?: number },
) {
  const { fontSize, font, width, lineGap, maxHeight } = options;
  const lineHeight = bidiLineHeight(document, fontSize, font);
  let lines = wrapBidiText(document, text, fontSize, font, width);
  const maxLines = maxHeight === undefined ? lines.length : Math.max(1, Math.floor((maxHeight - lineHeight) / (lineHeight + lineGap) + 1 + 1e-6));
  if (lines.length > maxLines) {
    // Ayrılmış sahəyə sığmayan mətn son sətirdə "…" ilə kəsilir.
    const kept = lines.slice(0, maxLines);
    const last = kept[kept.length - 1];
    let words = last.text.split(" ").filter(Boolean);
    let candidate = layoutBidiLine(document, `${words.join(" ")} …`, last.baseRtl, fontSize, font);
    while (words.length > 1 && candidate.width > width) {
      words = words.slice(0, -1);
      candidate = layoutBidiLine(document, `${words.join(" ")} …`, last.baseRtl, fontSize, font);
    }
    kept[kept.length - 1] = candidate;
    lines = kept;
  }
  lines.forEach((line, index) => {
    let cursor = x + Math.max(0, (width - line.width) / 2);
    const lineY = y + index * (lineHeight + lineGap);
    for (const run of line.runs) {
      setFont(document, run.font);
      document.fontSize(fontSize).text(run.draw, cursor, lineY, { lineBreak: false });
      cursor += run.width;
    }
  });
  return lines.length * (lineHeight + lineGap);
}

function drawSingleLine(document: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, fontSize: number, font?: string) {
  if (hasRtl(text)) {
    drawBidiBlock(document, text, x, y, { fontSize, font, width, lineGap: 0, maxHeight: bidiLineHeight(document, fontSize, font) });
    return;
  }
  setFont(document, font);
  document.fontSize(fontSize).text(text, x, y, { width, align: "center", lineBreak: false });
}

function drawCenteredText(
  document: PDFKit.PDFDocument,
  text: string,
  y: number,
  fontSize: number,
  font: string | undefined,
  width = contentWidth,
) {
  setFont(document, font);
  document.fontSize(fontSize).text(text, contentX, y, {
    width,
    align: "center",
    lineBreak: false,
  });
}

function measureBlock(document: PDFKit.PDFDocument, text: string, fontSize: number, font: string | undefined, width = contentWidth, lineGap = 4) {
  if (hasRtl(text)) return measureBidiBlock(document, text, fontSize, font, width, lineGap);
  setFont(document, font);
  document.fontSize(fontSize);
  return document.heightOfString(text, { width, lineGap, align: "center" });
}

function drawCenteredBlock(
  document: PDFKit.PDFDocument,
  text: string,
  y: number,
  fontSize: number,
  font: string | undefined,
  width = contentWidth,
  lineGap = 4,
  maxHeight?: number,
) {
  const height = measureBlock(document, text, fontSize, font, width, lineGap);
  const clipped = maxHeight !== undefined ? Math.min(height, maxHeight) : height;
  if (hasRtl(text)) {
    drawBidiBlock(document, text, contentX, y, { fontSize, font, width, lineGap, maxHeight: clipped + 0.5 });
    return clipped;
  }
  // `height` + `ellipsis`: mətn heç vaxt ayrılmış sahədən çıxmır və PDFKit yeni səhifə açmır.
  document.fontSize(fontSize).text(text, contentX, y, {
    width,
    align: "center",
    lineGap,
    height: clipped + 0.5,
    ellipsis: true,
  });
  return clipped;
}

function drawArcText(
  document: PDFKit.PDFDocument,
  text: string,
  centerX: number,
  centerY: number,
  radius: number,
  fontSize: number,
  startAngle: number,
  endAngle: number,
  rotationOffset: number,
) {
  setFont(document, sansFont);
  const characters = Array.from(text);
  const step = characters.length > 1 ? (endAngle - startAngle) / (characters.length - 1) : 0;
  for (const [index, character] of characters.entries()) {
    const angle = startAngle + step * index;
    const radians = (angle * Math.PI) / 180;
    const x = centerX + radius * Math.cos(radians);
    const y = centerY + radius * Math.sin(radians);
    document.fontSize(fontSize);
    const width = document.widthOfString(character);
    document.save();
    document.translate(x, y);
    document.rotate(angle + rotationOffset);
    document.fontSize(fontSize).text(character, -width / 2, -fontSize / 2, { lineBreak: false });
    document.restore();
  }
}

function drawSeal(document: PDFKit.PDFDocument, centerX: number, centerY: number, issuedAt: string) {
  const outerRadius = 52;
  const middleRadius = 45.5;
  const innerRadius = 36.5;
  document.save();
  document.rotate(-8, { origin: [centerX, centerY] });
  document.lineWidth(2.1).strokeColor(sealBlue).circle(centerX, centerY, outerRadius).stroke();
  document.lineWidth(1.3).strokeColor(sealBlue).circle(centerX, centerY, middleRadius).stroke();
  document.lineWidth(0.9).strokeColor(sealBlue).circle(centerX, centerY, innerRadius).stroke();
  document.fillColor(sealBlue);
  drawArcText(document, "MƏDİNƏ TƏDRİS AKADEMİYASI", centerX, centerY, 43, 7, 200, 340, 90);
  setFont(document, sansFont);
  document.fontSize(7.2).text(formatSealDate(issuedAt), centerX - 27, centerY + 25, {
    width: 54,
    align: "center",
    characterSpacing: 0.3,
    lineBreak: false,
  });
  document.circle(centerX - 41, centerY, 1.8).fill(sealBlue);
  document.circle(centerX + 41, centerY, 1.8).fill(sealBlue);
  document.roundedRect(centerX - 15.5, centerY - 15.5, 31, 31, 4.5).fill(sealBlue);
  document.fillColor(paper);
  setFont(document, serifFont);
  document.fontSize(22).text("M", centerX - 15.5, centerY - 10, { width: 31, align: "center", lineBreak: false });
  document.restore();
}

function detailsLayout(document: PDFKit.PDFDocument, details: Array<{ label: string; value: string }>) {
  const gap = details.length === 3 ? 0 : details.length === 4 ? 9 : 13;
  const columnWidth = (contentWidth - gap * (details.length - 1)) / details.length;
  const valueSize = details.length === 5 ? 8.2 : 9;
  setFont(document, sansFont);
  document.fontSize(valueSize);
  const valueHeight = Math.min(32, Math.max(...details.map(({ value }) => (hasRtl(value) ? measureBidiBlock(document, value, valueSize, sansFont, columnWidth, 2) : document.heightOfString(value, { width: columnWidth, align: "center", lineGap: 2 })))));
  return { height: 13 + 8 + 6 + valueHeight + 14, valueHeight };
}

function drawDetails(
  document: PDFKit.PDFDocument,
  y: number,
  details: Array<{ label: string; value: string }>,
) {
  const gap = details.length === 3 ? 0 : details.length === 4 ? 9 : 13;
  const columnWidth = (contentWidth - gap * (details.length - 1)) / details.length;
  const topPadding = 13;
  const bottomPadding = 14;
  const labelSize = 6.4;
  const valueSize = details.length === 5 ? 8.2 : 9;
  const valueLineGap = 2;
  const { valueHeight } = detailsLayout(document, details);
  const height = topPadding + 8 + 6 + valueHeight + bottomPadding;

  document.lineWidth(0.8).strokeColor("rgba(23, 59, 81, 0.2)");
  document.moveTo(contentX, y).lineTo(contentX + contentWidth, y).stroke();
  document.moveTo(contentX, y + height).lineTo(contentX + contentWidth, y + height).stroke();

  details.forEach(({ label, value }, index) => {
    const x = contentX + index * (columnWidth + gap);
    document.fillColor(muted);
    setFont(document, sansFont);
    document.fontSize(labelSize).text(label.toUpperCase(), x, y + topPadding, {
      width: columnWidth,
      align: "center",
      lineBreak: false,
      characterSpacing: 0.65,
    });
    document.fillColor(navy);
    if (hasRtl(value)) {
      drawBidiBlock(document, value, x, y + topPadding + 14, { fontSize: valueSize, font: sansFont, width: columnWidth, lineGap: valueLineGap, maxHeight: valueHeight + 0.5 });
      return;
    }
    setFont(document, sansFont);
    document.fontSize(valueSize).text(value, x, y + topPadding + 14, {
      width: columnWidth,
      align: "center",
      lineGap: valueLineGap,
      height: valueHeight + 0.5,
      ellipsis: true,
    });
  });
  return height;
}

export async function buildGraduationCertificatePdf({
  studentName,
  studentNumber,
  graduationTerm,
  certificateNumber,
  issuedAt,
  verificationUrl,
  gpa,
  graduationCategory,
  directorTitle,
  directorName,
  showDirector,
  showSeal,
  showGpa,
  showGraduationCategory,
  certificateTitle,
  bodyText,
  honorText,
}: {
  studentName: string;
  studentNumber: number;
  graduationTerm: number;
  certificateNumber: string;
  issuedAt: string;
  verificationUrl: string;
  gpa: number;
  graduationCategory: string;
  directorTitle: string;
  directorName: string;
  showDirector: boolean;
  showSeal: boolean;
  showGpa: boolean;
  showGraduationCategory: boolean;
  certificateTitle: string;
  bodyText: string;
  honorText: string;
}) {
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
    color: { dark: navy, light: "#ffffff" },
  });
  const qrImage = Buffer.from(qrDataUrl.split(",")[1], "base64");
  const chunks: Buffer[] = [];
  const document = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });

  return new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.rect(0, 0, a4Width, a4Height).fill(gold);
    document.lineWidth(0.8).strokeColor("rgba(23, 59, 81, 0.7)")
      .rect(innerX, innerY, innerWidth, innerHeight).stroke();
    document.lineWidth(0.8).strokeColor("rgba(255, 255, 255, 0.78)")
      .rect(innerX + 8, innerY + 8, innerWidth - 16, innerHeight - 16).stroke();
    document.rect(innerX + 0.8, innerY + 0.8, innerWidth - 1.6, innerHeight - 1.6).fill(paper);

    document.save();
    document.lineWidth(1).strokeColor("rgba(214, 180, 103, 0.7)");
    document.rotate(45, { origin: [innerX, innerY] });
    document.rect(innerX - 48, innerY - 48, 96, 96).stroke();
    document.restore();
    document.save();
    document.lineWidth(1).strokeColor("rgba(214, 180, 103, 0.7)");
    document.rotate(45, { origin: [innerX + innerWidth, innerY + innerHeight] });
    document.rect(innerX + innerWidth - 48, innerY + innerHeight - 48, 96, 96).stroke();
    document.restore();

    const headerY = innerY + 51;
    const logoWidth = 120;
    const logoHeight = 42;
    const copyWidth = 120;
    const headerGap = 12;
    const groupWidth = logoWidth + headerGap + copyWidth;
    const groupX = innerX + (innerWidth - groupWidth) / 2;
    if (academyLogo) {
      document.image(academyLogo, groupX, headerY + 9, { width: logoWidth, height: logoHeight });
    }
    const copyX = groupX + logoWidth + headerGap;
    document.fillColor(navy);
    setFont(document, sansFont);
    document.fontSize(7.2).text("RƏSMİ AKADEMİK SƏNƏD", copyX, headerY + 12, {
      width: copyWidth,
      lineBreak: false,
      characterSpacing: 1.1,
    });
    document.fillColor(muted);
    document.fontSize(7.2).text("İslami elmlər və davamlı təhsil", copyX, headerY + 29, {
      width: copyWidth,
      lineBreak: false,
    });

    let bodyY = headerY + 42 + 25.5;
    document.lineWidth(0.8).strokeColor(gold);
    document.moveTo(contentX, bodyY).lineTo(contentX + contentWidth, bodyY).stroke();
    bodyY += 31.5;

    document.fillColor("#9e782a");
    setFont(document, sansFont);
    if (hasRtl(certificateTitle)) drawSingleLine(document, certificateTitle, contentX, bodyY, contentWidth, 8.6, sansFont);
    else document.fontSize(8.6).text(certificateTitle, contentX, bodyY, {
      width: contentWidth,
      align: "center",
      lineBreak: false,
      characterSpacing: 0.9,
    });
    bodyY += 30;

    const details = [
      { label: "Tələbə №", value: `T${String(studentNumber).padStart(4, "0")}` },
      { label: "Verilmə tarixi", value: formatDate(issuedAt) },
      { label: "Şəhadətnamə №", value: certificateNumber },
      ...(showGpa ? [{ label: "GPA / 5.00", value: gpa.toFixed(2) }] : []),
      ...(showGraduationCategory ? [{ label: "Nəticə", value: graduationCategory }] : []),
    ];
    const resolvedBodyText = bodyText.replace(/\{term\}/g, `${graduationTerm}`);
    const footerTop = innerY + innerHeight - 90 - 40;
    const detailsHeightEstimate = detailsLayout(document, details).height;
    // Bütün məzmun A4 vərəqinə sığana qədər şrift ölçüləri mərhələli kiçildilir (heç vaxt ikinci səhifə yaranmır).
    const baseNameSize = studentName.length > 42 ? 24 : studentName.length > 30 ? 28 : 39;
    let layout = { scale: 1, nameSize: baseNameSize, bodySize: 11.25, honorSize: 9, nameHeight: 0, bodyHeight: 0, honorHeight: 0, detailsGap: 64 };
    for (const scale of [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64, 0.58, 0.52]) {
      const nameSize = Math.max(18, baseNameSize * scale);
      const bodySize = Math.max(7, 11.25 * scale);
      const honorSize = Math.max(6.5, 9 * scale);
      const nameHeight = measureBlock(document, studentName, nameSize, serifFont, contentWidth, 1);
      const bodyHeight = measureBlock(document, resolvedBodyText, bodySize, serifFont, contentWidth, 3 * scale);
      const honorHeight = measureBlock(document, honorText, honorSize, serifFont, contentWidth, 2.25 * scale);
      const detailsGap = Math.max(22, 64 * scale);
      layout = { scale, nameSize, bodySize, honorSize, nameHeight, bodyHeight, honorHeight, detailsGap };
      const total = bodyY + nameHeight + 16.5 + bodyHeight + 10.5 + honorHeight + detailsGap + detailsHeightEstimate;
      if (total <= footerTop - 8) break;
    }
    // Ən kiçik ölçüdə də sığmırsa, əsas və nəticə mətni ayrılmış sahədə kəsilir (…).
    const available = footerTop - 8 - layout.detailsGap - detailsHeightEstimate - bodyY - layout.nameHeight - 16.5 - 10.5;
    const bodyMax = Math.max(20, Math.min(layout.bodyHeight, available - Math.min(layout.honorHeight, available * 0.3)));
    const honorMax = Math.max(0, Math.min(layout.honorHeight, available - bodyMax));

    document.fillColor(navy);
    const nameHeight = drawCenteredBlock(document, studentName, bodyY, layout.nameSize, serifFont, contentWidth, 1, layout.nameHeight);
    bodyY += nameHeight + 16.5;

    document.fillColor(navy);
    const bodyHeight = drawCenteredBlock(document, resolvedBodyText, bodyY, layout.bodySize, serifFont, contentWidth, 3 * layout.scale, bodyMax);
    bodyY += bodyHeight + 10.5;

    document.fillColor(muted);
    const honorHeight = honorMax > 4 ? drawCenteredBlock(document, honorText, bodyY, layout.honorSize, serifFont, contentWidth, 2.25 * layout.scale, honorMax) : 0;
    bodyY += honorHeight;

    const detailsY = Math.min(bodyY + layout.detailsGap, footerTop - 8 - detailsHeightEstimate);
    drawDetails(document, detailsY, details);

    const footerHeight = 90;
    const footerBottomPadding = 40;
    const footerY = innerY + innerHeight - footerHeight - footerBottomPadding;
    const footerGap = 13.5;
    const centerColumnWidth = 110;
    const sideColumnWidth = (contentWidth - centerColumnWidth - footerGap * 2) / 2;
    const footerColumns = [
      contentX,
      contentX + sideColumnWidth + footerGap,
      contentX + sideColumnWidth + footerGap + centerColumnWidth + footerGap,
    ];
    if (showDirector) {
      document.fillColor(navy);
      document.lineWidth(0.8).strokeColor(navy)
        .moveTo(footerColumns[0] + (sideColumnWidth - 112.5) / 2, footerY + 58.5)
        .lineTo(footerColumns[0] + (sideColumnWidth + 112.5) / 2, footerY + 58.5).stroke();
      drawSingleLine(document, directorTitle, footerColumns[0], footerY + 67.5, sideColumnWidth, 9.75, serifFont);
      drawSingleLine(document, directorName, footerColumns[0], footerY + 84, sideColumnWidth, 9, sansFont);
    }

    if (showSeal) drawSeal(document, footerColumns[1] + centerColumnWidth / 2, footerY + 45, issuedAt);

    document.image(qrImage, footerColumns[2] + (centerColumnWidth - 63) / 2, footerY + 18, { width: 63, height: 63 });
    document.fillColor(muted);
    setFont(document, sansFont);
    document.fontSize(5.25).text("Onlayn yoxlama", footerColumns[2], footerY + 84.75, {
      width: centerColumnWidth,
      align: "center",
      lineBreak: false,
    });

    document.end();
  });
}