import { useEffect, useMemo, useState } from 'react';
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

const academyName = 'Mədinə Tədris Akademiyası';

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

function graduationCategoryStyle(category: string) {
  const key = category as keyof typeof certificateCategoryColors;
  return {
    className: certificateCategoryColors[key] ?? certificateCategoryColors.Zəif,
    dotClassName: certificateCategoryDots[key] ?? certificateCategoryDots.Zəif,
    frameClassName: certificateCategoryFrames[key] ?? certificateCategoryFrames.Zəif,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('az-AZ', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
}

function formatSealDate(value: string) {
  return new Intl.DateTimeFormat('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function certificateUrl(token: string) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${window.location.origin}${basePath}/verify/certificate/${encodeURIComponent(token)}`;
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
  const name = certificate.studentName || (student ? formatFullName(student.firstName, student.lastName) : 'Məzun tələbə');
  const studentNumber = student ? `T${String(student.studentNumber).padStart(4, '0')}` : '—';
  const bodyText = certificate.bodyText.replace(/\{term\}/g, `${certificate.graduationTerm}`);
  const categoryStyle = graduationCategoryStyle(certificate.graduationCategory);
  const visibleDetailsCount = 3 + Number(certificate.showGpa) + Number(certificate.showGraduationCategory);
  return (
    <div className="certificate-preview-shell">
      <article className={`certificate-print-area ${graduationCategoryStyle(certificate.graduationCategory).frameClassName}`} data-testid="certificate-preview">
        <div className="certificate-inner-border">
          <header className="certificate-header">
            <img className="certificate-brand-logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt={academyName} />
            <div className="certificate-header-copy">
              <p className="certificate-kicker">RƏSMİ AKADEMİK SƏNƏD</p>
              <p className="certificate-subtitle">İslami elmlər və davamlı təhsil</p>
            </div>
          </header>
          <div className="certificate-rule" aria-hidden="true" />
          <main className="certificate-body">
            <p className="certificate-eyebrow">{certificate.certificateTitle}</p>
            <h1>{name}</h1>
            <p className="certificate-copy">
              {bodyText}
            </p>
            <p className="certificate-honor">{certificate.honorText}</p>
          </main>
          <div className={`certificate-details certificate-details-${visibleDetailsCount}`}>
            <div><span>Tələbə №</span><strong>{studentNumber}</strong></div>
            <div><span>Verilmə tarixi</span><strong>{formatDate(certificate.issuedAt)}</strong></div>
            <div><span>Şəhadətnamə №</span><strong>{certificate.certificateNumber}</strong></div>
            {certificate.showGpa && <div><span>GPA / 5.00</span><strong>{certificate.gpa.toFixed(2)}</strong></div>}
            {certificate.showGraduationCategory && <div><span>Nəticə</span><strong>{certificate.graduationCategory}</strong></div>}
          </div>
          <footer className="certificate-footer">
            {certificate.showDirector ? <div className="certificate-signature">
              <div className="certificate-signature-line" />
              <strong>{certificate.directorTitle}</strong>
              <span>{certificate.directorName}</span>
            </div> : <div className="certificate-signature certificate-signature-hidden" aria-hidden="true" />}
            {certificate.showSeal ? <div className="certificate-seal-wrap">
              <div className="certificate-seal" aria-label="Akademiyanın möhürü">
                <svg viewBox="0 0 120 120" role="img" aria-hidden="true">
                  <defs>
                    <path id="certificate-seal-top-arc" d="M 14,60 A 46,46 0 0,1 106,60" />
                    <path id="certificate-seal-bottom-arc" d="M 14,60 A 46,46 0 0,0 106,60" />
                  </defs>
                  <circle className="certificate-seal-outer-ring" cx="60" cy="60" r="56" />
                  <circle className="certificate-seal-middle-ring" cx="60" cy="60" r="49" />
                  <circle className="certificate-seal-inner-ring" cx="60" cy="60" r="39" />
                  <text className="certificate-seal-ring-text certificate-seal-top-text"><textPath href="#certificate-seal-top-arc" startOffset="50%">MƏDİNƏ TƏDRİS AKADEMİYASI</textPath></text>
                  <text className="certificate-seal-ring-text certificate-seal-bottom-text"><textPath href="#certificate-seal-bottom-arc" startOffset="50%">{formatSealDate(certificate.issuedAt)}</textPath></text>
                  <circle className="certificate-seal-dot" cx="16" cy="60" r="2" />
                  <circle className="certificate-seal-dot" cx="104" cy="60" r="2" />
                  <rect className="certificate-seal-monogram-box" x="43" y="43" width="34" height="34" rx="5" />
                  <text className="certificate-seal-monogram" x="60" y="68">M</text>
                </svg>
              </div>
            </div> : <div className="certificate-seal-wrap certificate-seal-hidden" aria-hidden="true" />}
            <div className="certificate-qr-block">
              {qrDataUrl ? <img src={qrDataUrl} alt="Şəhadətnaməni yoxlamaq üçün QR kod" /> : <div className="certificate-qr-placeholder"><LoaderCircle size={18} className="animate-spin" /></div>}
              <span>Onlayn yoxlama</span>
            </div>
          </footer>
        </div>
      </article>
      <div className="certificate-preview-caption">
        <ShieldCheck size={15} />
        <span>QR kod sənədin ictimai doğrulama səhifəsinə aparır.</span>
      </div>
    </div>
  );
}

type CertificateDraft = Pick<GraduationCertificate, 'verificationLocked' | 'directorTitle' | 'directorName' | 'showDirector' | 'showSeal' | 'showGpa' | 'showGraduationCategory' | 'certificateTitle' | 'bodyText' | 'honorText'>;

export function GraduateCertificateSection({ canRevoke }: { canRevoke: boolean }) {
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
          setNotice('Şəhadətnamə hazırdır. Önizləməni çap edə və PDF kimi saxlaya bilərsiniz.');
          void queryClient.invalidateQueries({ queryKey: getGetAdminGraduationCertificatesQueryKey() });
        },
        onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : 'Şəhadətnamə yaradıla bilmədi.'),
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
          setNotice('Şəhadətnamə ayarları yadda saxlanıldı.');
          void queryClient.invalidateQueries({ queryKey: getGetAdminGraduationCertificatesQueryKey() });
        },
        onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : 'Şəhadətnamə ayarları yadda saxlanılmadı.'),
      },
    );
  };

  const print = () => {
    document.body.classList.add('printing-certificate');
    window.setTimeout(() => document.body.classList.remove('printing-certificate'), 1200);
    window.print();
  };

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
          setNotice('PDF yeni səhifədə açıldı. Telefonda brauzerin yükləmə və ya paylaşma düyməsindən istifadə edin.');
        } else {
          window.location.assign(downloadUrl);
        }
        return;
      }

      const response = await fetch(downloadUrl, { credentials: 'include' });
      if (!response.ok) {
        let message = 'PDF faylı yüklənə bilmədi.';
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
      setNotice('Şəhadətnamə PDF formatında endirildi.');
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'PDF faylı yüklənə bilmədi.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const changeCertificateStatus = (certificate: GraduationCertificate) => {
    const revoked = !certificate.revokedAt;
    const action = revoked ? 'geri alınmasını' : 'bərpa edilməsini';
    if (!window.confirm(`Bu şəhadətnamənin ${action} təsdiqləyirsiniz?`)) return;
    setNotice('');
    setError('');
    updateCertificateStatus.mutate(
      { profileId: certificate.profileId, data: { revoked } },
      {
        onSuccess: (updatedCertificate) => {
          setSelectedCertificate(updatedCertificate);
           setDraft((current) => current ? { ...current, verificationLocked: updatedCertificate.verificationLocked } : current);
          setNotice(revoked ? 'Şəhadətnamə geri alındı.' : 'Şəhadətnamə bərpa edildi.');
          void queryClient.invalidateQueries({ queryKey: getGetAdminGraduationCertificatesQueryKey() });
          void query.refetch();
        },
        onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : 'Şəhadətnamənin statusu dəyişdirilə bilmədi.'),
      },
    );
  };

  const restoreStudent = (student: AdminGraduationCertificate) => {
    const name = formatFullName(student.firstName, student.lastName);
    if (!window.confirm(`${name} tələbəsinin məzuniyyət statusunu geri almaq istəyirsiniz?`)) return;
    setNotice('');
    setError('');
    setSelectedStudent(student);
    restoreGraduatedStudent.mutate(
      { profileId: student.profileId },
      {
        onSuccess: () => {
          setSelectedStudent(null);
          setSelectedCertificate(null);
          setNotice(`${name} yenidən aktiv tələbə statusuna qaytarıldı.`);
          void queryClient.invalidateQueries({ queryKey: getGetAdminGraduationCertificatesQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetAdminApplicationsQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetAdminStudentsQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetAdminAcademicProfilesQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetGraduationCandidatesQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetSystemStatisticsQueryKey() });
          void query.refetch();
        },
        onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : 'Məzuniyyət statusu geri alına bilmədi.'),
      },
    );
  };

  return (
    <section className="space-y-5" data-testid="section-graduate-certificates">
      <div className="rounded-2xl border border-[hsl(var(--accent)/.55)] bg-[linear-gradient(120deg,hsl(var(--primary))_0%,hsl(194_35%_26%)_100%)] p-6 text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--accent))]">Rəsmi sənədlər</p>
            <h3 className="mt-2 font-serif text-3xl">Şəhadətnamə idarəsi</h3>
            <p className="mt-2 text-sm leading-6 text-[hsl(var(--primary-foreground)/.72)]">Məzun tələbələrin rəsmi sənədlərini GPA, rəhbər, möhür, mətn və ictimai doğrulama ayarları ilə bir yerdən idarə edin.</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[hsl(var(--accent)/.45)] bg-[hsl(var(--accent)/.14)] font-serif text-3xl font-bold text-[hsl(var(--accent))]">M</div>
        </div>
      </div>
      {(notice || error) && <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${error ? 'border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.06)] text-[hsl(var(--destructive))]' : 'border-[hsl(var(--secondary-foreground)/.2)] bg-[hsl(var(--secondary)/.55)] text-[hsl(var(--secondary-foreground))]'}`} role="status">{error ? <FileBadge size={16} /> : <CheckCircle2 size={16} />}{error || notice}</div>}
      {query.isLoading ? <div className="flex items-center gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-sm text-[hsl(var(--muted-foreground))]"><LoaderCircle size={18} className="animate-spin" /> Məzun siyahısı yüklənir...</div>
        : query.isError ? <div className="flex items-center justify-between gap-4 rounded-2xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.06)] p-5 text-sm font-semibold text-[hsl(var(--destructive))]"><span>Şəhadətnamə siyahısı yüklənə bilmədi.</span><button type="button" onClick={() => void query.refetch()} className="inline-flex items-center gap-2 rounded-lg border border-current px-3 py-2 text-xs"><RefreshCw size={14} /> Yenilə</button></div>
          : !query.data?.length ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center"><FileBadge className="mx-auto text-[hsl(var(--accent))]" size={30} /><p className="mt-3 font-bold text-[hsl(var(--primary))]">Hələ məzun tələbə yoxdur</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Tələbə məzun elan edildikdən sonra şəhadətnamə burada görünəcək.</p></div>
            : <div className="grid gap-3 md:grid-cols-2">{query.data.map((student) => {
              const name = formatFullName(student.firstName, student.lastName);
              return <article key={student.profileId} className="flex items-center justify-between gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]" data-testid={`graduate-certificate-student-${student.profileId}`}>
                <div className="min-w-0"><p className="font-bold text-[hsl(var(--primary))]">{name}</p><p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">Tələbə № T{String(student.studentNumber).padStart(4, '0')} · {student.graduationTerm}-ci semestr</p><div className="mt-1 flex flex-wrap items-center gap-2"><p className="text-xs text-[hsl(var(--muted-foreground))]">{student.certificate ? student.certificate.certificateNumber : 'Şəhadətnamə hazırlanmayıb'}</p>{student.certificate && <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${graduationCategoryStyle(student.certificate.graduationCategory).className}`} data-testid={`certificate-category-${student.profileId}`}><span className={`h-1.5 w-1.5 rounded-full ${graduationCategoryStyle(student.certificate.graduationCategory).dotClassName}`} aria-hidden="true" />{student.certificate.graduationCategory}</span>}</div></div>
                 <div className="flex shrink-0 flex-wrap justify-end gap-2">
                   <button type="button" onClick={() => student.certificate ? openCertificate(student) : create(student)} disabled={createCertificate.isPending && selectedStudent?.profileId === student.profileId} className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-[hsl(var(--primary))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] transition hover:opacity-90 disabled:opacity-60" data-testid={`button-certificate-${student.profileId}`}>{createCertificate.isPending && selectedStudent?.profileId === student.profileId ? <LoaderCircle size={14} className="animate-spin" /> : student.certificate ? <ExternalLink size={14} /> : <FileBadge size={14} />}{student.certificate ? 'Bax' : 'Yarat'}</button>
                   {canRevoke && !student.certificate && <button type="button" onClick={() => restoreStudent(student)} disabled={restoreGraduatedStudent.isPending && selectedStudent?.profileId === student.profileId} className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-[hsl(var(--destructive)/.3)] px-3 py-2.5 text-xs font-bold text-[hsl(var(--destructive))] transition hover:bg-[hsl(var(--destructive)/.06)] disabled:opacity-60" data-testid={`button-restore-graduation-${student.profileId}`}>{restoreGraduatedStudent.isPending && selectedStudent?.profileId === student.profileId ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />} Geri al</button>}
                 </div>
              </article>;
            })}</div>}
       {selectedCertificate && selectedListItem && draft && <div className="certificate-workspace" data-testid="certificate-workspace">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Canlı önizləmə</p><div className="mt-1 flex flex-wrap items-center gap-2"><p className="font-bold text-[hsl(var(--primary))]">{selectedCertificate.certificateNumber} · {selectedCertificate.studentName}</p><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[.1em] ${selectedCertificate.revokedAt ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-emerald-100 text-emerald-800'}`}>{selectedCertificate.revokedAt ? 'Geri alınıb' : 'Aktiv'}</span></div></div>
          <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void downloadPdf()} disabled={isDownloadingPdf} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-download-certificate-pdf">{isDownloadingPdf ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />} {isDownloadingPdf ? 'PDF hazırlanır...' : 'PDF yüklə'}</button>
            <button type="button" onClick={print} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))]" data-testid="button-print-certificate"><Printer size={15} /> Çap et</button>
            <a href={certificateUrl(selectedCertificate.verificationToken)} target="_blank" rel="noreferrer" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))]" data-testid="link-verify-certificate"><ExternalLink size={15} /> Yoxla</a>
             {canRevoke && <><button type="button" onClick={saveSettings} disabled={updateCertificateStatus.isPending} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--accent)/.7)] bg-[hsl(var(--accent)/.15)] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] disabled:opacity-60" data-testid="button-save-certificate-settings">{updateCertificateStatus.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} Yadda saxla</button><button type="button" onClick={() => changeCertificateStatus(selectedCertificate)} disabled={updateCertificateStatus.isPending} className={`focus-ring inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${selectedCertificate.revokedAt ? 'border-emerald-300 text-emerald-800 hover:bg-emerald-50' : 'border-[hsl(var(--destructive)/.3)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.06)]'}`} data-testid={selectedCertificate.revokedAt ? 'button-restore-certificate' : 'button-revoke-certificate'}>{updateCertificateStatus.isPending ? <LoaderCircle size={15} className="animate-spin" /> : selectedCertificate.revokedAt ? <RefreshCw size={15} /> : <FileBadge size={15} />}{updateCertificateStatus.isPending ? 'Yadda saxlanılır...' : selectedCertificate.revokedAt ? 'Bərpa et' : 'Geri al'}</button></>}
          </div>
        </div>
         {canRevoke && <div className="mb-5 grid gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 md:grid-cols-2" data-testid="certificate-settings-form">
           <div className="md:col-span-2"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Sənəd ayarları</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">GPA və şəhadətnamə nömrəsi dəyişməz rəsmi snapshot kimi qorunur.</p></div>
           <label className="text-xs font-bold text-[hsl(var(--primary))]">Rəhbər vəzifəsi<input value={draft.directorTitle} onChange={(event) => setDraft({ ...draft, directorTitle: event.target.value })} maxLength={120} className="mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-transparent px-3 py-2.5 text-sm font-normal" data-testid="input-certificate-director-title" /></label>
           <label className="text-xs font-bold text-[hsl(var(--primary))]">Rəhbər adı<input value={draft.directorName} onChange={(event) => setDraft({ ...draft, directorName: event.target.value })} maxLength={120} className="mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-transparent px-3 py-2.5 text-sm font-normal" data-testid="input-certificate-director-name" /></label>
           <label className="text-xs font-bold text-[hsl(var(--primary))]">Sənəd başlığı<input value={draft.certificateTitle} onChange={(event) => setDraft({ ...draft, certificateTitle: event.target.value })} maxLength={120} className="mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-transparent px-3 py-2.5 text-sm font-normal" data-testid="input-certificate-title" /></label>
           <div className="flex flex-wrap items-end gap-4 text-xs font-bold text-[hsl(var(--primary))]"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.showDirector} onChange={(event) => setDraft({ ...draft, showDirector: event.target.checked })} data-testid="checkbox-certificate-director" /> Rəhbəri göstər</label><label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.showSeal} onChange={(event) => setDraft({ ...draft, showSeal: event.target.checked })} data-testid="checkbox-certificate-seal" /> Möhürü göstər</label><label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.showGpa} onChange={(event) => setDraft({ ...draft, showGpa: event.target.checked })} data-testid="checkbox-certificate-gpa" /> GPA-nı göstər</label><label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.showGraduationCategory} onChange={(event) => setDraft({ ...draft, showGraduationCategory: event.target.checked })} data-testid="checkbox-certificate-category" /> Nəticəni göstər</label></div>
           <label className="md:col-span-2 text-xs font-bold text-[hsl(var(--primary))]">Əsas mətn<textarea rows={3} value={draft.bodyText} onChange={(event) => setDraft({ ...draft, bodyText: event.target.value })} maxLength={1000} className="mt-2 w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-transparent px-3 py-2.5 text-sm font-normal" data-testid="textarea-certificate-body" /><span className="mt-1 block font-normal text-[11px] text-[hsl(var(--muted-foreground))]">{'{term}'} yazısı semestr nömrəsi ilə əvəz olunur.</span></label>
           <label className="md:col-span-2 text-xs font-bold text-[hsl(var(--primary))]">Nəticə mətni<textarea rows={2} value={draft.honorText} onChange={(event) => setDraft({ ...draft, honorText: event.target.value })} maxLength={1000} className="mt-2 w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-transparent px-3 py-2.5 text-sm font-normal" data-testid="textarea-certificate-honor" /></label>
           <button type="button" onClick={() => setDraft({ ...draft, verificationLocked: !draft.verificationLocked })} className={`inline-flex w-fit items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold ${draft.verificationLocked ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`} data-testid="button-toggle-certificate-verification">{draft.verificationLocked ? <Unlock size={15} /> : <Lock size={15} />} {draft.verificationLocked ? 'Verification kilidini aç' : 'Verification-a bağla'}</button>
         </div>}
         <CertificatePreview student={selectedListItem} certificate={{ ...selectedCertificate, ...draft }} qrDataUrl={qrDataUrl} />
      </div>}
    </section>
  );
}

export function CertificateVerificationPage({ token }: { token: string }) {
  const query = useVerifyGraduationCertificate(token, { query: { queryKey: getVerifyGraduationCertificateQueryKey(token), staleTime: 60_000 } });
  const result = query.data;
  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5 py-10">
      <section className="w-full max-w-xl rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 shadow-[var(--shadow-sm)] md:p-10" data-testid="certificate-verification-page">
        <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--accent))] font-serif text-2xl font-bold text-[hsl(var(--primary))]">M</div><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Sənəd doğrulama</p><h1 className="font-serif text-xl text-[hsl(var(--primary))]">{academyName}</h1></div></div>
        {query.isLoading ? <div className="mt-10 flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]"><LoaderCircle size={18} className="animate-spin" /> Sənəd yoxlanılır...</div>
          : query.isError || !result?.valid ? <div className="mt-10 rounded-2xl border border-[hsl(var(--destructive)/.22)] bg-[hsl(var(--destructive)/.06)] p-5"><p className="font-bold text-[hsl(var(--destructive))]">Sənəd təsdiqlənmədi</p><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Bu doğrulama kodu ilə aktiv və etibarlı şəhadətnamə tapılmadı.</p></div>
             : <div className="mt-10 rounded-2xl border border-[hsl(var(--secondary-foreground)/.2)] bg-[hsl(var(--secondary)/.45)] p-5"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.13em] text-[hsl(var(--secondary-foreground))]"><CheckCircle2 size={16} /> Etibarlı sənəd</p><h2 className="mt-4 font-serif text-3xl text-[hsl(var(--primary))]">{result.studentName}</h2><dl className="mt-6 space-y-3 text-sm"><div className="flex justify-between gap-4 border-b border-[hsl(var(--border)/.7)] pb-3"><dt className="text-[hsl(var(--muted-foreground))]">Şəhadətnamə №</dt><dd className="font-bold text-[hsl(var(--primary))]">{result.certificateNumber}</dd></div>{result.gpa !== null && <div className="flex justify-between gap-4 border-b border-[hsl(var(--border)/.7)] pb-3"><dt className="text-[hsl(var(--muted-foreground))]">GPA / 5.00</dt><dd className="font-bold text-[hsl(var(--primary))]">{result.gpa.toFixed(2)}</dd></div>}{result.graduationCategory && <div className="flex justify-between gap-4 border-b border-[hsl(var(--border)/.7)] pb-3"><dt className="text-[hsl(var(--muted-foreground))]">Bitirmə kateqoriyası</dt><dd className="text-right font-bold text-[hsl(var(--primary))]">{result.graduationCategory}</dd></div>}<div className="flex justify-between gap-4"><dt className="text-[hsl(var(--muted-foreground))]">Məzuniyyət tarixi</dt><dd className="font-bold text-[hsl(var(--primary))]">{result.graduationDate ? formatDate(result.graduationDate) : '—'}</dd></div>{result.directorName && <div className="flex justify-between gap-4"><dt className="text-[hsl(var(--muted-foreground))]">{result.directorTitle}</dt><dd className="font-bold text-[hsl(var(--primary))]">{result.directorName}</dd></div>}</dl></div>}
        <p className="mt-8 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Bu səhifə yalnız şəhadətnamənin etibarlılığını və minimum sənəd məlumatlarını göstərir.</p>
      </section>
    </main>
  );
}