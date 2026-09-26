import fs from "node:fs";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

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

const sansFont = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
].find((path) => fs.existsSync(path));
const serifFont = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
].find((path) => fs.existsSync(path)) ?? sansFont;
const logoCandidates = [
  new URL("./assets/medine-logo-email.png", import.meta.url),
  new URL("../assets/medine-logo-email.png", import.meta.url),
];
const logoUrl = logoCandidates.find((candidate) => fs.existsSync(candidate));
const academyLogo = logoUrl ? fs.readFileSync(logoUrl) : null;

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

function drawCenteredBlock(
  document: PDFKit.PDFDocument,
  text: string,
  y: number,
  fontSize: number,
  font: string | undefined,
  width = contentWidth,
  lineGap = 4,
) {
  setFont(document, font);
  document.fontSize(fontSize).text(text, contentX, y, {
    width,
    align: "center",
    lineGap,
  });
  return document.heightOfString(text, { width, lineGap });
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
  const valueHeights = details.map(({ value }) => {
    setFont(document, sansFont);
    document.fontSize(valueSize);
    return document.heightOfString(value, { width: columnWidth, align: "center", lineGap: valueLineGap });
  });
  const height = topPadding + 8 + 6 + Math.max(...valueHeights) + bottomPadding;

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
    document.fontSize(valueSize).text(value, x, y + topPadding + 14, {
      width: columnWidth,
      align: "center",
      lineGap: valueLineGap,
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
    document.fontSize(8.6).text(certificateTitle, contentX, bodyY, {
      width: contentWidth,
      align: "center",
      lineBreak: false,
      characterSpacing: 0.9,
    });
    bodyY += 30;

    document.fillColor(navy);
    const nameSize = studentName.length > 30 ? 28 : 39;
    const nameHeight = drawCenteredBlock(document, studentName, bodyY, nameSize, serifFont, contentWidth, 1);
    bodyY += nameHeight + 16.5;

    const resolvedBodyText = bodyText.replace(/\{term\}/g, `${graduationTerm}`);
    document.fillColor(navy);
    const bodyHeight = drawCenteredBlock(document, resolvedBodyText, bodyY, 11.25, serifFont, contentWidth, 3);
    bodyY += bodyHeight + 10.5;

    document.fillColor(muted);
    const honorHeight = drawCenteredBlock(document, honorText, bodyY, 9, serifFont, contentWidth, 2.25);
    bodyY += honorHeight;

    const details = [
      { label: "Tələbə №", value: `T${String(studentNumber).padStart(4, "0")}` },
      { label: "Verilmə tarixi", value: formatDate(issuedAt) },
      { label: "Şəhadətnamə №", value: certificateNumber },
      ...(showGpa ? [{ label: "GPA / 5.00", value: gpa.toFixed(2) }] : []),
      ...(showGraduationCategory ? [{ label: "Nəticə", value: graduationCategory }] : []),
    ];
    const detailsY = bodyY + 64;
    const detailsHeight = drawDetails(document, detailsY, details);

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
      setFont(document, serifFont);
      document.fontSize(9.75).text(directorTitle, footerColumns[0], footerY + 67.5, {
        width: sideColumnWidth,
        align: "center",
        lineBreak: false,
      });
      setFont(document, sansFont);
      document.fontSize(9).text(directorName, footerColumns[0], footerY + 84, {
        width: sideColumnWidth,
        align: "center",
        lineBreak: false,
      });
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