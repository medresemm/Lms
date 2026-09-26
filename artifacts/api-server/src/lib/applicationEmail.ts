import { Resend } from "resend";
import { existsSync, readFileSync } from "node:fs";
import { buildGraduationCertificatePdf } from "./graduationCertificatePdf.js";

function resend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY təyin edilməyib.");
  return new Resend(apiKey);
}

function fromAddress() {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("RESEND_FROM_EMAIL təyin edilməyib.");
  return from;
}

const emailLogoUrl = new URL("./assets/medine-logo-email.png", import.meta.url);
const emailLogo = readFileSync(
  existsSync(emailLogoUrl) ? emailLogoUrl : new URL("../assets/medine-logo-email.png", import.meta.url),
);
const emailLogoDataUri = `data:image/png;base64,${emailLogo.toString("base64")}`;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function emailHtml(text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
  return `<!doctype html>
<html lang="az">
  <body style="margin:0;background:#f5f2ec;color:#173b51;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f2ec;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e4dfd6;border-radius:18px;overflow:hidden;">
          <tr><td style="padding:24px 28px 18px;border-bottom:1px solid #eee9e1;">
            <img src="${emailLogoDataUri}" alt="Mədinə Tədris Akademiyası" width="240" style="display:block;width:240px;max-width:100%;height:auto;">
          </td></tr>
          <tr><td style="padding:28px;font-size:15px;line-height:1.7;">
            ${paragraphs}
            <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #eee9e1;color:#496575;font-size:13px;">Mədinə Tədris Akademiyası</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function assertEmail(to: string, message: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error(message);
}

async function sendBrandedEmail({
  to,
  subject,
  text,
  attachments,
}: {
  to: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: Buffer }[];
}) {
  const { error } = await resend().emails.send({
    from: fromAddress(),
    to,
    subject,
    html: emailHtml(text),
    text,
    attachments: attachments?.map((a) => ({ filename: a.filename, content: a.content })),
  });
  if (error) throw new Error(`Email göndərilə bilmədi: ${error.message}`);
}

const criticalEventLabels: Record<string, string> = {
  "application.submitted": "Yeni tələbə müraciəti göndərildi",
  "course.created": "Yeni dərs əlavə edildi",
  "course.updated": "Dərs məlumatları yeniləndi",
  "course.deleted": "Dərs silindi",
  "grades.updated": "Tələbənin qiymətləri yeniləndi",
  "message.created": "Yeni mesaj göndərildi",
  "message.reply.created": "Mesaja cavab göndərildi",
  "question.created": "Yeni sual göndərildi",
  "resource.created": "Yeni dərs materialı əlavə edildi",
  "resource.updated": "Dərs materialı yeniləndi",
  "resource.deleted": "Dərs materialı silindi",
  "student.deleted": "Tələbə hesabı deaktiv edildi",
  "student.graduated": "Tələbə məzun edildi",
  "teacher.assignment": "Müəllim təyinatı dəyişdirildi",
  "user.profile.updated": "İstifadəçi məlumatları yeniləndi",
  "user.role.updated": "İstifadəçi rolu dəyişdirildi",
};

function readableTarget(target: string) {
  const targetType = target.split(":")[0];
  const labels: Record<string, string> = {
    application: "Tələbə müraciəti",
    academic_profile: "Tələbə profili",
    course: "Dərs",
    message: "Mesaj",
    question: "Sual",
    resource: "Dərs materialı",
    user: "İstifadəçi",
  };
  return labels[targetType] ?? "Akademiya məlumatı";
}

function readableDetails(details?: string) {
  if (!details) return "";
  try {
    const values = JSON.parse(details) as Record<string, unknown>;
    const labels: Record<string, string> = {
      title: "Başlıq",
      status: "Status",
      rejectionReason: "İmtina səbəbi",
      recommendationCount: "Əlavə sənəd sayı",
    };
    return Object.entries(values)
      .filter(([key, value]) => key in labels && typeof value !== "object" && value !== null)
      .map(([key, value]) => `${labels[key]}: ${String(value)}`)
      .join("\n");
  } catch {
    return "";
  }
}

export async function sendApplicationDecisionEmail({
  to,
  studentName,
  approved,
  admissionExamRequired = false,
  rejectionReason,
}: {
  to: string;
  studentName: string;
  approved: boolean;
  admissionExamRequired?: boolean;
  rejectionReason?: string;
}) {
  assertEmail(to, "Tələbənin email ünvanı düzgün deyil.");
  const subject = approved && admissionExamRequired
    ? "Mədinə Tədris Akademiyası – Qəbul imtahanı"
    : approved
    ? "Mədinə Tədris Akademiyası – Qeydiyyatınızın təsdiqlənməsi"
    : "Mədinə Tədris Akademiyası – Müraciətiniz haqqında";
  const text = approved && admissionExamRequired
    ? `Hörmətli ${studentName},\n\nMədinə Tədris Akademiyasına göstərdiyiniz maraq üçün təşəkkür edirik!\n\nMüraciətiniz müvəffəqiyyətlə qeydə alınmışdır. Akademiyaya qəbul prosesini tamamlamaq üçün sizə qəbul imtahanı təyin olunacaq. İmtahanı verdikdən və nəticəniz təsdiqləndikdən sonra dərslərə giriş əldə edəcəksiniz.`
    : approved
    ? `Hörmətli ${studentName},\n\nMədinə Tədris Akademiyasına göstərdiyiniz maraq üçün təşəkkür edirik!\n\nMüraciətiniz müvəffəqiyyətlə qeydə alınmışdır və siz akademiyamıza qəbul olunmusunuz.`
    : `Hörmətli ${studentName},\n\nMədinə Tədris Akademiyasına müraciət etdiyiniz və göstərdiyiniz diqqət üçün təşəkkür edirik.\n\nTəəssüflə bildirmək istəyirik ki, müraciətinizi bu mərhələdə təsdiqləyə bilmirik.${rejectionReason?.trim() ? `\n\nƏlavə məlumat:\n${rejectionReason.trim()}` : ""}`;
  await sendBrandedEmail({ to, subject, text });
}

export async function sendSubjectRemovalDecisionEmail({
  to,
  studentName,
  courseTitle,
  termNumber,
  approved,
  rejectionReason,
}: {
  to: string;
  studentName: string;
  courseTitle: string;
  termNumber: number;
  approved: boolean;
  rejectionReason?: string;
}) {
  assertEmail(to, "Tələbənin email ünvanı düzgün deyil.");
  const subject = approved
    ? "Mədinə Tədris Akademiyası – Fənn müraciətiniz təsdiqləndi"
    : "Mədinə Tədris Akademiyası – Fənn müraciətiniz rədd edildi";
  const text = [
    `Hörmətli ${studentName},`,
    "",
    `${termNumber}-ci semestr üzrə "${courseTitle}" fənninin silinməsi ilə bağlı müraciətiniz ${approved ? "təsdiqləndi" : "rədd edildi"}.`,
    "",
    approved
      ? "Bu dəyişiklik tələbə panelinizdə tətbiq olunacaq."
      : `Fənn cədvəlinizdə saxlanılıb.${rejectionReason?.trim() ? `\n\nMüəllimin izahı:\n${rejectionReason.trim()}` : ""}`,
  ].join("\n");
  await sendBrandedEmail({ to, subject, text });
}

export async function sendCriticalEventEmail({
  to,
  eventType,
  actor,
  target,
  details,
}: {
  to: string;
  eventType: string;
  actor: string;
  target: string;
  details?: string;
}) {
  assertEmail(to, "Bildiriş email ünvanı düzgün deyil.");
  const eventLabel = criticalEventLabels[eventType] ?? "LMS-də mühüm dəyişiklik edildi";
  const detailText = readableDetails(details);
  const subject = `Mədinə Akademiyası – ${eventLabel}`;
  const text = [
    eventLabel,
    "",
    "Əməliyyatı edən: Akademiya əməkdaşı",
    `Əlaqəli bölmə: ${readableTarget(target)}`,
    detailText ? `\n${detailText}` : "",
  ].filter(Boolean).join("\n");
  await sendBrandedEmail({ to, subject, text });
}

export async function sendStudentNotificationEmail({ to, studentName, title, body }: { to: string; studentName: string; title: string; body: string }) {
  assertEmail(to, "Tələbənin email ünvanı düzgün deyil.");
  const subject = `Mədinə Akademiyası – ${title}`;
  const text = `Hörmətli ${studentName},\n\n${body}`;
  await sendBrandedEmail({ to, subject, text });
}

export async function sendGraduationCertificateEmail({
  to,
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
  to: string;
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
  assertEmail(to, "Tələbənin email ünvanı düzgün deyil.");
  const pdf = await buildGraduationCertificatePdf({
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
  });
  const subject = `Mədinə Tədris Akademiyası – Məzun şəhadətnaməniz`;
  const text = [
    `Hörmətli ${studentName},`,
    "",
    "Mədinə Tədris Akademiyasını uğurla tamamladığınız üçün sizi təbrik edirik.",
    "Məzun şəhadətnaməniz bu məktuba PDF formatında əlavə edilmişdir.",
    "",
    `Şəhadətnamə №: ${certificateNumber}`,
    `Doğrulama səhifəsi: ${verificationUrl}`,
    "",
    "Mədinə Tədris Akademiyası",
  ].join("\n");
  await sendBrandedEmail({
    to,
    subject,
    text,
    attachments: [{ filename: `Medine-Shehadetname-${certificateNumber}.pdf`, content: pdf }],
  });
}
