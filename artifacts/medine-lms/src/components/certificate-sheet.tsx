import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GraduationCertificate } from '@workspace/api-client-react';
import { useI18n } from '@/lib/i18n';

// Şəhadətnamə vərəqi: həmişə dəqiq A4 portret (210 × 297 mm) ölçüsündə render olunur.
// Ekranda önizləmə yalnız CSS transform ilə kiçildilir; çapda/PDF-də heç bir miqyaslama tətbiq olunmur.

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
const PX_PER_MM = 96 / 25.4;
export const A4_WIDTH_PX = A4_WIDTH_MM * PX_PER_MM;
export const A4_HEIGHT_PX = A4_HEIGHT_MM * PX_PER_MM;

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
}

function formatSealDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

const certificateCategoryFrames: Record<string, string> = {
  Zəif: 'certificate-frame-weak',
  Orta: 'certificate-frame-average',
  Əla: 'certificate-frame-excellent',
  'Fərqlənmə ilə bitirən': 'certificate-frame-honors',
};

export type CertificateSheetData = Pick<GraduationCertificate,
  'studentName' | 'graduationTerm' | 'bodyText' | 'honorText' | 'certificateTitle' | 'graduationCategory' | 'issuedAt' |
  'certificateNumber' | 'gpa' | 'showGpa' | 'showGraduationCategory' | 'showDirector' | 'showSeal' | 'directorTitle' | 'directorName'>;

export function CertificateSheet({
  certificate,
  studentName,
  studentNumber,
  qrDataUrl,
  logoUrl,
  testId = 'certificate-preview',
}: {
  certificate: CertificateSheetData;
  studentName: string;
  studentNumber: string;
  qrDataUrl: string;
  logoUrl: string;
  testId?: string;
}) {
  const { t, locale } = useI18n();
  const dateLocale = locale === 'ar' ? 'ar' : 'az-AZ';
  const bodyText = certificate.bodyText.replace(/\{term\}/g, `${certificate.graduationTerm}`);
  const frameClassName = certificateCategoryFrames[certificate.graduationCategory] ?? 'certificate-frame-weak';
  const visibleDetailsCount = 3 + Number(certificate.showGpa) + Number(certificate.showGraduationCategory);
  const nameSizeClass = studentName.length > 42 ? 'certificate-name-xlong' : studentName.length > 28 ? 'certificate-name-long' : '';
  const bodySizeClass = bodyText.length > 520 ? 'certificate-copy-xlong' : bodyText.length > 300 ? 'certificate-copy-long' : '';
  return (
    <article className={`certificate-print-area ${frameClassName}`} data-testid={testId}>
      <div className="certificate-inner-border">
        <header className="certificate-header">
          <img className="certificate-brand-logo" src={logoUrl} alt={t('academyName')} />
          <div className="certificate-header-copy">
            <p className="certificate-kicker">{t('officialKicker')}</p>
            <p className="certificate-subtitle">{t('islamicLine')}</p>
          </div>
        </header>
        <div className="certificate-rule" aria-hidden="true" />
        <main className="certificate-body">
          <p className="certificate-eyebrow" dir="auto">{certificate.certificateTitle}</p>
          <h1 className={nameSizeClass} dir="auto">{studentName}</h1>
          <p className={`certificate-copy ${bodySizeClass}`} dir="auto">{bodyText}</p>
          <p className="certificate-honor" dir="auto">{certificate.honorText}</p>
        </main>
        <div className={`certificate-details certificate-details-${visibleDetailsCount}`}>
          <div><span>{t('studentNo')}</span><strong>{studentNumber}</strong></div>
          <div><span>{t('issuedDate')}</span><strong>{formatDate(certificate.issuedAt, dateLocale)}</strong></div>
          <div><span>{t('certNumber')}</span><strong>{certificate.certificateNumber}</strong></div>
          {certificate.showGpa && <div><span>GPA / 5.00</span><strong>{certificate.gpa.toFixed(2)}</strong></div>}
          {certificate.showGraduationCategory && <div><span>{t('resultLabel')}</span><strong dir="auto">{certificate.graduationCategory}</strong></div>}
        </div>
        <footer className="certificate-footer">
          {certificate.showDirector ? <div className="certificate-signature">
            <div className="certificate-signature-line" />
            <strong dir="auto">{certificate.directorTitle}</strong>
            <span dir="auto">{certificate.directorName}</span>
          </div> : <div className="certificate-signature certificate-signature-hidden" aria-hidden="true" />}
          {certificate.showSeal ? <div className="certificate-seal-wrap">
            <div className="certificate-seal" aria-label={t('sealAria')}>
              <svg viewBox="0 0 120 120" role="img" aria-hidden="true">
                <defs>
                  <path id={`${testId}-seal-top-arc`} d="M 14,60 A 46,46 0 0,1 106,60" />
                  <path id={`${testId}-seal-bottom-arc`} d="M 14,60 A 46,46 0 0,0 106,60" />
                </defs>
                <circle className="certificate-seal-outer-ring" cx="60" cy="60" r="56" />
                <circle className="certificate-seal-middle-ring" cx="60" cy="60" r="49" />
                <circle className="certificate-seal-inner-ring" cx="60" cy="60" r="39" />
                <text className="certificate-seal-ring-text certificate-seal-top-text"><textPath href={`#${testId}-seal-top-arc`} startOffset="50%">{t('sealRing')}</textPath></text>
                <text className="certificate-seal-ring-text certificate-seal-bottom-text"><textPath href={`#${testId}-seal-bottom-arc`} startOffset="50%">{formatSealDate(certificate.issuedAt, dateLocale)}</textPath></text>
                <circle className="certificate-seal-dot" cx="16" cy="60" r="2" />
                <circle className="certificate-seal-dot" cx="104" cy="60" r="2" />
                <rect className="certificate-seal-monogram-box" x="43" y="43" width="34" height="34" rx="5" />
                <text className="certificate-seal-monogram" x="60" y="68">M</text>
              </svg>
            </div>
          </div> : <div className="certificate-seal-wrap certificate-seal-hidden" aria-hidden="true" />}
          <div className="certificate-qr-block">
            {qrDataUrl ? <img src={qrDataUrl} alt={t('qrAlt')} /> : <div className="certificate-qr-placeholder" />}
            <span>{t('checkOnline')}</span>
          </div>
        </footer>
      </div>
    </article>
  );
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Ekran önizləməsi: A4 vərəqini konteynerin enindən asılı olaraq yalnız vizual kiçildir. */
export function ScaledCertificate({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useIsomorphicLayoutEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const update = () => setScale(Math.min(1, element.clientWidth / A4_WIDTH_PX));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={frameRef} className="certificate-scale-frame" style={{ height: A4_HEIGHT_PX * scale }}>
      <div className="certificate-scale-inner" style={{ width: A4_WIDTH_PX, height: A4_HEIGHT_PX, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
