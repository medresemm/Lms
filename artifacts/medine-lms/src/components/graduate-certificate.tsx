import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileBadge,
  LoaderCircle,
  Lock,
  Printer,
  RefreshCw,
  Save,
  ShieldCheck,
  Unlock,
} from 'lucide-react';
import {
  getGetAdminApplicationsQueryKey,
  getGetAdminAcademicProfilesQueryKey,
  getGetAdminStudentsQueryKey,
  getGetAdminGraduationCertificatesQueryKey,
  getGetGraduationCandidatesQueryKey,
  getGetSystemStatisticsQueryKey,
  getVerifyGraduationCertificateQueryKey,
  type AdminGraduationCertificate,
  type GraduationCertificate,
  useCreateAdminGraduationCertificate,
  useGetAdminGraduationCertificates,
  useRestoreGraduatedStudent,
  useUpdateAdminGraduationCertificateStatus,
  useVerifyGraduationCertificate,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatFullName } from '@/lib/utils';
import { LanguageSwitch, useI18n } from '@/lib/i18n';
import { CertificateSheet, ScaledCertificate } from '@/components/certificate-sheet';

function apiUrl(path: string) {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api${path}`;
}

const certificateCategoryColors = {
  Zəif: 'border-rose-200 bg-rose-50 text-rose-800',
  Orta: 'border-amber-200 bg-amber-50 text-amber-800',
  Əla: 'border-sky-200 bg-sky-50 text-sky-800',
  'Fərqlənmə ilə bitirən': 'border-emerald-200 bg-emerald-50 text-emerald-800',
} as const;

const certificateCategoryDots = {
  Zəif: 'bg-rose-500',
  Orta: 'bg-amber-500',
  Əla: 'bg-sky-500',
  'Fərqlənmə ilə bitirən': 'bg-emerald-500',
} as const;

const certificateCategoryFrames = {
  Zəif: 'certificate-frame-weak',
  Orta: 'certificate-frame-average',
  Əla: 'certificate-frame-excellent',
  'Fərqlənmə ilə bitirən': 'certificate-frame-honors',
} as const;

function categoryLabel(category: string, t: (key: 'levelWeak' | 'levelMid' | 'levelGood' | 'levelExcellent' | 'levelHonors') => string) {
  if (category === 'Zəif') return t('levelWeak');
  if (category === 'Orta') return t('levelMid');
  if (category === 'Yaxşı') return t('levelGood');
  if (category === 'Əla') return t('levelExcellent');
  if (category === 'Fərqlənmə ilə bitirən') return t('levelHonors');
  return category;
}

function graduationCategoryStyle(category: string) {
  const key = category as keyof typeof certificateCategoryColors;
  return {
    className: certificateCategoryColors[key] ?? certificateCategoryColors.Zəif,
    dotClassName: certificateCategoryDots[key] ?? certificateCategoryDots.Zəif,
    frameClassName: certificateCategoryFrames[key] ?? certificateCategoryFrames.Zəif,
  };
}

function formatDate(value: string, locale: 'az' | 'ar' = 'az') {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'az-AZ', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
}

function certificateUrl(token: string) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${window.location.origin}${basePath}/verify/certificate/${encodeURIComponent(token)}`;
}

function certificateSheetProps(certificate: GraduationCertificate, student: AdminGraduationCertificate | undefined, fallbackName: string) {
  return {
    certificate,
    studentName: certificate.studentName || (student ? formatFullName(student.firstName, student.lastName) : fallbackName),
    studentNumber: student ? `T${String(student.studentNumber).padStart(4, '0')}` : '—',
    logoUrl: `${import.meta.env.BASE_URL}logo.svg`,
  };
}

function CertificatePreview({
  student,
  certificate,
  qrDataUrl,
}: {
  student?: AdminGraduationCertificate;
  certificate: GraduationCertificate;
  qrDataUrl: string;
}) {
  const { t } = useI18n();
  return (
    <div className="certificate-preview-shell">
      <ScaledCertificate>
        <CertificateSheet {...certificateSheetProps(certificate, student, t('gcGradStudent'))} qrDataUrl={qrDataUrl} />
      </ScaledCertificate>
      <div className="certificate-preview-caption">
        <ShieldCheck size={15} />
        <span>{t('gcA4')}</span>
      </div>
    </div>
  );
}

// Çap üçün: şəhadətnamə body-nin birbaşa övladı kimi, miqyaslanmadan dəqiq A4 ölçüsündə render olunur.
// Çap zamanı səhifənin qalan hissəsi gizlədilir və @page { size: A4 portrait; margin: 0 } tətbiq edilir.
const PRINT_PAGE_STYLE_ID = 'certificate-print-page-style';

function CertificatePrintPortal({ student, certificate, qrDataUrl, onDone }: { student?: AdminGraduationCertificate; certificate: GraduationCertificate; qrDataUrl: string; onDone: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    const style = document.createElement('style');
    style.id = PRINT_PAGE_STYLE_ID;
    style.textContent = '@page { size: 210mm 297mm; margin: 0; } @media print { html, body { width: 210mm !important; height: 297mm !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; } }';
    document.head.appendChild(style);
    document.body.classList.add('printing-certificate');
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      document.body.classList.remove('printing-certificate');
      style.remove();
      onDone();
    };
    window.addEventListener('afterprint', finish);
    const images = Array.from(document.querySelectorAll<HTMLImageElement>('.certificate-print-root img'));
    const ready = Promise.all(images.map((image) => (image.complete ? Promise.resolve() : new Promise<void>((resolve) => { image.onload = () => resolve(); image.onerror = () => resolve(); }))));
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    void Promise.all([ready, fontsReady]).then(() => {
      window.requestAnimationFrame(() => {
        window.print();
        // Bəzi brauzerlər afterprint göndərmir; print() bloklayıcıdırsa burada təmizləyirik.
        window.setTimeout(finish, 500);
      });
    });
    return () => {
      window.removeEventListener('afterprint', finish);
      document.body.classList.remove('printing-certificate');
      style.remove();
    };
  }, [onDone]);
  return createPortal(
    <div className="certificate-print-root" aria-hidden="true">
      <CertificateSheet {...certificateSheetProps(certificate, student, t('gcGradStudent'))} qrDataUrl={qrDataUrl} testId="certificate-print-sheet" />
    </div>,
    document.body,
  );
}

type CertificateDraft = Pick<GraduationCertificate, 'verificationLocked' | 'directorTitle' | 'directorName' | 'showDirector' | 'showSeal' | 'showGpa' | 'showGraduationCategory' | 'certificateTitle' | 'bodyText' | 'honorText'>;

export function GraduateCertificateSection({ canRevoke }: { canRevoke: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const query = useGetAdminGraduationCertificates({ query: { queryKey: getGetAdminGraduationCertificatesQueryKey(), staleTime: 30_000 } });
  const createCertificate = useCreateAdminGraduationCertificate();
  const restoreGraduatedStudent = useRestoreGraduatedStudent();
  const updateCertificateStatus = useUpdateAdminGraduationCertificateStatus();
  const [selectedStudent, setSelectedStudent] = useState<AdminGraduationCertificate | null>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<GraduationCertificate | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<CertificateDraft | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    let active = true;
    if (!selectedCertificate) {
      setQrDataUrl('');
      return () => { active = false; };
    }
    void QRCode.toDataURL(certificateUrl(selectedCertificate.verificationToken), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 170,
      color: { dark: '#173b51', light: '#ffffff' },
    }).then((url) => { if (active) setQrDataUrl(url); }).catch(() => { if (active) setQrDataUrl(''); });
    return () => { active = false; };
  }, [selectedCertificate]);

  const selectedListItem = useMemo(
    () => query.data?.find((item) => item.profileId === selectedStudent?.profileId) ?? selectedStudent,
    [query.data, selectedStudent],
  );

  const openCertificate = (student: AdminGraduationCertificate) => {
    setSelectedStudent(student);
    setSelectedCertificate(student.certificate);
    setDraft(student.certificate ? {
      verificationLocked: student.certificate.verificationLocked,
      directorTitle: student.certificate.directorTitle,
      directorName: student.certificate.directorName,
      showDirector: student.certificate.showDirector,
      showSeal: student.certificate.showSeal,
      showGpa: student.certificate.showGpa,
      showGraduationCategory: student.certificate.showGraduationCategory,
      certificateTitle: student.certificate.certificateTitle,
      bodyText: student.certificate.bodyText,
      honorText: student.certificate.honorText,
    } : null);
    setNotice('');
    setError('');
  };

  const create = (student: AdminGraduationCertificate) => {
    setNotice('');
    setError('');
    setSelectedStudent(student);
    createCertificate.mutate(
      { profileId: student.profileId },
      {
        onSuccess: (certificate) => {
          setSelectedCertificate(certificate);
           setDraft({
             verificationLocked: certificate.verificationLocked,
             directorTitle: certificate.directorTitle,
             directorName: certificate.directorName,
             showDirector: certificate.showDirector,
             showSeal: certificate.showSeal,
             showGpa: certificate.showGpa,
             showGraduationCategory: certificate.showGraduationCategory,
             certificateTitle: certificate.certificateTitle,
             bodyText: certificate.bodyText,
             honorText: certificate.honorText,
           });
          setNotice(t('certReady'));
          void queryClient.invalidateQueries({ queryKey: getGetAdminGraduationCertificatesQueryKey() });
        },
        onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : t('certFail')),
      },
    );
  };

  const saveSettings = () => {
    if (!selectedCertificate || !draft) return;
    setNotice('');
    setError('');
    updateCertificateStatus.mutate(
      { profileId: selectedCertificate.profileId, data: draft },
      {
        onSuccess: (updatedCertificate) => {
          setSelectedCertificate(updatedCertificate);
          setDraft({
            verificationLocked: updatedCertificate.verificationLocked,
            directorTitle: updatedCertificate.directorTitle,
            directorName: updatedCertificate.directorName,
            showDirector: updatedCertificate.showDirector,
            showSeal: updatedCertificate.showSeal,
            showGpa: updatedCertificate.showGpa,
            showGraduationCategory: updatedCertificate.showGraduationCategory,
            certificateTitle: updatedCertificate.certificateTitle,
            bodyText: updatedCertificate.bodyText,
            honorText: updatedCertificate.honorText,
          });
          setNotice(t('gcSettingsSaved'));
          void queryClient.invalidateQueries({ queryKey: getGetAdminGraduationCertificatesQueryKey() });
        },
        onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : t('gcSettingsFail')),
      },
    );
  };

  const [isPrinting, setIsPrinting] = useState(false);
  const finishPrinting = useCallback(() => setIsPrinting(false), []);
  const print = () => setIsPrinting(true);

  const downloadPdf = async () => {
    if (!selectedListItem || !selectedCertificate) return;
    setIsDownloadingPdf(true);
    setNotice('');
    setError('');
    try {
      const downloadUrl = apiUrl(`/admin/students/${selectedListItem.profileId}/certificate/pdf`);
      const isTouchDevice =
        window.matchMedia?.('(pointer: coarse)').matches ||
        /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
      if (isTouchDevice) {
        const openedWindow = window.open(downloadUrl, '_blank');
        if (openedWindow) {
          openedWindow.opener = null;
          setNotice(t('gcPdfMobile'));
        } else {
          window.location.assign(downloadUrl);
        }
        return;
      }

      const response = await fetch(downloadUrl, { credentials: 'include' });
      if (!response.ok) {
        let message = t('gcPdfFail');
        try {
          const payload = await response.json() as { error?: string };
          message = payload.error || message;
        } catch {
          // Keep the default message when the server response is not JSON.
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `Medine-Shehadetname-${selectedCertificate.certificateNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setNotice(t('gcPdfDone'));
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : t('gcPdfFail'));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const changeCertificateStatus = (certificate: GraduationCertificate) => {
    const revoked = !certificate.revokedAt;
    if (!window.confirm(revoked ? t('gcConfirmRevoke') : t('gcConfirmRestore'))) return;
    setNotice('');
    setError('');
    updateCertificateStatus.mutate(
      { profileId: certificate.profileId, data: { revoked } },
      {
        onSuccess: (updatedCertificate) => {
          setSelectedCertificate(updatedCertificate);
           setDraft((current) => current ? { ...current, verificationLocked: updatedCertificate.verificationLocked } : current);
          setNotice(revoked ? t('gcRevoked') : t('gcRestored'));
          void queryClient.invalidateQueries({ queryKey: getGetAdminGraduationCertificatesQueryKey() });
          void query.refetch();
        },
        onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : t('gcStatusFail')),
      },
    );
  };

  const restoreStudent = (student: AdminGraduationCertificate) => {
    const name = formatFullName(student.firstName, student.lastName);
    if (!window.confirm(t('gcConfirmUndo').replace('{name}', name))) return;
    setNotice('');
    setError('');
    setSelectedStudent(student);
    restoreGraduatedStudent.mutate(
      { profileId: student.profileId },
      {
        onSuccess: () => {
          setSelectedStudent(null);
          setSelectedCertificate(null);
          setNotice(t('gcUndoDone').replace('{name}', name));
          void queryClient.invalidateQueries({ queryKey: getGetAdminGraduationCertificatesQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetAdminApplicationsQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetAdminStudentsQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetAdminAcademicProfilesQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetGraduationCandidatesQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetSystemStatisticsQueryKey() });
          void query.refetch();
        },
        onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : t('gcUndoFail')),
      },
    );
  };

  return (
    <section className="space-y-5" data-testid="section-graduate-certificates">
      <div className="rounded-2xl border border-[hsl(var(--accent)/.55)] bg-[linear-gradient(120deg,hsl(var(--primary))_0%,hsl(194_35%_26%)_100%)] p-6 text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--accent))]">{t('certDocs')}</p>
            <h3 className="mt-2 font-serif text-3xl">{t('certAdmin')}</h3>
            <p className="mt-2 text-sm leading-6 text-[hsl(var(--primary-foreground)/.72)]">{t('gcAdminHint')}</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[hsl(var(--accent)/.45)] bg-[hsl(var(--accent)/.14)] font-serif text-3xl font-bold text-[hsl(var(--accent))]">M</div>
        </div>
      </div>
      {(notice || error) && <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${error ? 'border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.06)] text-[hsl(var(--destructive))]' : 'border-[hsl(var(--secondary-foreground)/.2)] bg-[hsl(var(--secondary)/.55)] text-[hsl(var(--secondary-foreground))]'}`} role="status">{error ? <FileBadge size={16} /> : <CheckCircle2 size={16} />}{error || notice}</div>}
      {query.isLoading ? <div className="flex items-center gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-sm text-[hsl(var(--muted-foreground))]"><LoaderCircle size={18} className="animate-spin" /> {t('gradsLoading')}</div>
        : query.isError ? <div className="flex items-center justify-between gap-4 rounded-2xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.06)] p-5 text-sm font-semibold text-[hsl(var(--destructive))]"><span>{t('certListFail')}</span><button type="button" onClick={() => void query.refetch()} className="inline-flex items-center gap-2 rounded-lg border border-current px-3 py-2 text-xs"><RefreshCw size={14} /> {t('refreshList')}</button></div>
          : !query.data?.length ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center"><FileBadge className="mx-auto text-[hsl(var(--accent))]" size={30} /><p className="mt-3 font-bold text-[hsl(var(--primary))]">{t('noGradsYet')}</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('certAfterGrad')}</p></div>
            : <div className="grid gap-3 md:grid-cols-2">{query.data.map((student) => {
              const name = formatFullName(student.firstName, student.lastName);
              return <article key={student.profileId} className="flex items-center justify-between gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]" data-testid={`graduate-certificate-student-${student.profileId}`}>
                <div className="min-w-0"><p className="font-bold text-[hsl(var(--primary))]">{name}</p><p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{t('studentNo')} T{String(student.studentNumber).padStart(4, '0')} · {t('gcTerm').replace('{n}', String(student.graduationTerm))}</p><div className="mt-1 flex flex-wrap items-center gap-2"><p className="text-xs text-[hsl(var(--muted-foreground))]">{student.certificate ? student.certificate.certificateNumber : t('certNotReady')}</p>{student.certificate && <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${graduationCategoryStyle(student.certificate.graduationCategory).className}`} data-testid={`certificate-category-${student.profileId}`}><span className={`h-1.5 w-1.5 rounded-full ${graduationCategoryStyle(student.certificate.graduationCategory).dotClassName}`} aria-hidden="true" />{categoryLabel(student.certificate.graduationCategory, t)}</span>}</div></div>
                 <div className="flex shrink-0 flex-wrap justify-end gap-2">
                   <button type="button" onClick={() => student.certificate ? openCertificate(student) : create(student)} disabled={createCertificate.isPending && selectedStudent?.profileId === student.profileId} className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-[hsl(var(--primary))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] transition hover:opacity-90 disabled:opacity-60" data-testid={`button-certificate-${student.profileId}`}>{createCertificate.isPending && selectedStudent?.profileId === student.profileId ? <LoaderCircle size={14} className="animate-spin" /> : student.certificate ? <ExternalLink size={14} /> : <FileBadge size={14} />}{student.certificate ? t('viewCert') : t('makeCert')}</button>
                   {canRevoke && !student.certificate && <button type="button" onClick={() => restoreStudent(student)} disabled={restoreGraduatedStudent.isPending && selectedStudent?.profileId === student.profileId} className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-[hsl(var(--destructive)/.3)] px-3 py-2.5 text-xs font-bold text-[hsl(var(--destructive))] transition hover:bg-[hsl(var(--destructive)/.06)] disabled:opacity-60" data-testid={`button-restore-graduation-${student.profileId}`}>{restoreGraduatedStudent.isPending && selectedStudent?.profileId === student.profileId ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t('undoGrad')}</button>}
                 </div>
              </article>;
            })}</div>}
       {selectedCertificate && selectedListItem && draft && <div className="certificate-workspace" data-testid="certificate-workspace">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">{t('livePreview')}</p><div className="mt-1 flex flex-wrap items-center gap-2"><p className="font-bold text-[hsl(var(--primary))]">{selectedCertificate.certificateNumber} · {selectedCertificate.studentName}</p><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[.1em] ${selectedCertificate.revokedAt ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-emerald-100 text-emerald-800'}`}>{selectedCertificate.revokedAt ? t('revoked') : t('activeCert')}</span></div></div>
          <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void downloadPdf()} disabled={isDownloadingPdf} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-download-certificate-pdf">{isDownloadingPdf ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />} {isDownloadingPdf ? t('gcPdfBusy') : t('gcPdfDownload')}</button>
            <button type="button" onClick={print} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))]" data-testid="button-print-certificate"><Printer size={15} /> {t('gcPrint')}</button>
            <a href={certificateUrl(selectedCertificate.verificationToken)} target="_blank" rel="noreferrer" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))]" data-testid="link-verify-certificate"><ExternalLink size={15} /> {t('gcVerify')}</a>
             {canRevoke && <><button type="button" onClick={saveSettings} disabled={updateCertificateStatus.isPending} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--accent)/.7)] bg-[hsl(var(--accent)/.15)] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] disabled:opacity-60" data-testid="button-save-certificate-settings">{updateCertificateStatus.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} {t('save')}</button><button type="button" onClick={() => changeCertificateStatus(selectedCertificate)} disabled={updateCertificateStatus.isPending} className={`focus-ring inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${selectedCertificate.revokedAt ? 'border-emerald-300 text-emerald-800 hover:bg-emerald-50' : 'border-[hsl(var(--destructive)/.3)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.06)]'}`} data-testid={selectedCertificate.revokedAt ? 'button-restore-certificate' : 'button-revoke-certificate'}>{updateCertificateStatus.isPending ? <LoaderCircle size={15} className="animate-spin" /> : selectedCertificate.revokedAt ? <RefreshCw size={15} /> : <FileBadge size={15} />}{updateCertificateStatus.isPending ? t('saving') : selectedCertificate.revokedAt ? t('gcRestoreBtn') : t('undoGrad')}</button></>}
          </div>
        </div>
         {canRevoke && <div className="mb-5 grid gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 md:grid-cols-2" data-testid="certificate-settings-form">
           <div className="md:col-span-2"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">{t('gcDocSettings')}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t('gcDocSettingsHint')}</p></div>
           <label className="text-xs font-bold text-[hsl(var(--primary))]">{t('gcDirectorRole')}<input value={draft.directorTitle} onChange={(event) => setDraft({ ...draft, directorTitle: event.target.value })} maxLength={120} className="mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-transparent px-3 py-2.5 text-sm font-normal" data-testid="input-certificate-director-title" /></label>
           <label className="text-xs font-bold text-[hsl(var(--primary))]">{t('gcDirectorName')}<input value={draft.directorName} onChange={(event) => setDraft({ ...draft, directorName: event.target.value })} maxLength={120} className="mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-transparent px-3 py-2.5 text-sm font-normal" data-testid="input-certificate-director-name" /></label>
           <label className="text-xs font-bold text-[hsl(var(--primary))]">{t('gcDocTitle')}<input value={draft.certificateTitle} onChange={(event) => setDraft({ ...draft, certificateTitle: event.target.value })} maxLength={120} className="mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-transparent px-3 py-2.5 text-sm font-normal" data-testid="input-certificate-title" /></label>
           <div className="flex flex-wrap items-end gap-4 text-xs font-bold text-[hsl(var(--primary))]"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.showDirector} onChange={(event) => setDraft({ ...draft, showDirector: event.target.checked })} data-testid="checkbox-certificate-director" /> {t('gcShowDirector')}</label><label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.showSeal} onChange={(event) => setDraft({ ...draft, showSeal: event.target.checked })} data-testid="checkbox-certificate-seal" /> {t('gcShowSeal')}</label><label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.showGpa} onChange={(event) => setDraft({ ...draft, showGpa: event.target.checked })} data-testid="checkbox-certificate-gpa" /> {t('gcShowGpa')}</label><label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.showGraduationCategory} onChange={(event) => setDraft({ ...draft, showGraduationCategory: event.target.checked })} data-testid="checkbox-certificate-category" /> {t('gcShowResult')}</label></div>
           <label className="md:col-span-2 text-xs font-bold text-[hsl(var(--primary))]">{t('gcBody')}<textarea rows={3} value={draft.bodyText} onChange={(event) => setDraft({ ...draft, bodyText: event.target.value })} maxLength={1000} className="mt-2 w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-transparent px-3 py-2.5 text-sm font-normal" data-testid="textarea-certificate-body" /><span className="mt-1 block font-normal text-[11px] text-[hsl(var(--muted-foreground))]">{t('gcTermToken')}</span></label>
           <label className="md:col-span-2 text-xs font-bold text-[hsl(var(--primary))]">{t('gcHonor')}<textarea rows={2} value={draft.honorText} onChange={(event) => setDraft({ ...draft, honorText: event.target.value })} maxLength={1000} className="mt-2 w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-transparent px-3 py-2.5 text-sm font-normal" data-testid="textarea-certificate-honor" /></label>
           <button type="button" onClick={() => setDraft({ ...draft, verificationLocked: !draft.verificationLocked })} className={`inline-flex w-fit items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold ${draft.verificationLocked ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`} data-testid="button-toggle-certificate-verification">{draft.verificationLocked ? <Unlock size={15} /> : <Lock size={15} />} {draft.verificationLocked ? t('gcUnlock') : t('gcLock')}</button>
         </div>}
         <CertificatePreview student={selectedListItem} certificate={{ ...selectedCertificate, ...draft }} qrDataUrl={qrDataUrl} />
         {isPrinting && <CertificatePrintPortal student={selectedListItem} certificate={{ ...selectedCertificate, ...draft }} qrDataUrl={qrDataUrl} onDone={finishPrinting} />}
      </div>}
    </section>
  );
}

export function CertificateVerificationPage({ token }: { token: string }) {
  const { t, locale } = useI18n();
  const query = useVerifyGraduationCertificate(token, { query: { queryKey: getVerifyGraduationCertificateQueryKey(token), staleTime: 60_000 } });
  const result = query.data;
  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5 py-10">
      <section className="w-full max-w-xl rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 shadow-[var(--shadow-sm)] md:p-10" data-testid="certificate-verification-page">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--accent))] font-serif text-2xl font-bold text-[hsl(var(--primary))]">M</div><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{t('gcVerifyKicker')}</p><h1 className="font-serif text-xl text-[hsl(var(--primary))]">{t('academy')}</h1></div></div><LanguageSwitch /></div>
        {query.isLoading ? <div className="mt-10 flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]"><LoaderCircle size={18} className="animate-spin" /> {t('gcChecking')}</div>
          : query.isError || !result?.valid ? <div className="mt-10 rounded-2xl border border-[hsl(var(--destructive)/.22)] bg-[hsl(var(--destructive)/.06)] p-5"><p className="font-bold text-[hsl(var(--destructive))]">{t('gcInvalid')}</p><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('gcInvalidBody')}</p></div>
             : <div className="mt-10 rounded-2xl border border-[hsl(var(--secondary-foreground)/.2)] bg-[hsl(var(--secondary)/.45)] p-5"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.13em] text-[hsl(var(--secondary-foreground))]"><CheckCircle2 size={16} /> {t('gcValid')}</p><h2 className="mt-4 font-serif text-3xl text-[hsl(var(--primary))]">{result.studentName}</h2><dl className="mt-6 space-y-3 text-sm"><div className="flex justify-between gap-4 border-b border-[hsl(var(--border)/.7)] pb-3"><dt className="text-[hsl(var(--muted-foreground))]">{t('certNumber')}</dt><dd className="font-bold text-[hsl(var(--primary))]">{result.certificateNumber}</dd></div>{result.gpa !== null && <div className="flex justify-between gap-4 border-b border-[hsl(var(--border)/.7)] pb-3"><dt className="text-[hsl(var(--muted-foreground))]">GPA / 5.00</dt><dd className="font-bold text-[hsl(var(--primary))]">{result.gpa.toFixed(2)}</dd></div>}{result.graduationCategory && <div className="flex justify-between gap-4 border-b border-[hsl(var(--border)/.7)] pb-3"><dt className="text-[hsl(var(--muted-foreground))]">{t('gcCategory')}</dt><dd className="text-right font-bold text-[hsl(var(--primary))]">{categoryLabel(result.graduationCategory, t)}</dd></div>}<div className="flex justify-between gap-4"><dt className="text-[hsl(var(--muted-foreground))]">{t('gcGradDate')}</dt><dd className="font-bold text-[hsl(var(--primary))]">{result.graduationDate ? formatDate(result.graduationDate, locale) : '—'}</dd></div>{result.directorName && <div className="flex justify-between gap-4"><dt className="text-[hsl(var(--muted-foreground))]">{result.directorTitle}</dt><dd className="font-bold text-[hsl(var(--primary))]">{result.directorName}</dd></div>}</dl></div>}
        <p className="mt-8 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('gcVerifyFoot')}</p>
      </section>
    </main>
  );
}