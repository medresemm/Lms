import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

const siteBase = import.meta.env.BASE_URL.replace(/\/$/, '');

function isTouchDevice() {
  return Boolean(window.matchMedia?.('(pointer: coarse)').matches) || /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
}

/**
 * Həftəlik dərs cədvəlini A5 PDF kimi yükləyir (server: /api/student/schedule.pdf və ya /api/admin/teacher-schedule.pdf).
 * Telefon/planşetdə PDF yeni vərəqdə açılır (brauzerin yükləmə/paylaşma düyməsi ilə saxlanılır) — şəhadətnamə ilə eyni yol.
 */
export function SchedulePdfButton({ apiPath, fileName, testId, className = '' }: { apiPath: string; fileName: string; testId: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const url = `${siteBase}/api${apiPath}`;

  const download = async () => {
    if (busy) return;
    setNotice('');
    setError('');
    if (isTouchDevice()) {
      const opened = window.open(url, '_blank');
      if (opened) {
        opened.opener = null;
        setNotice('PDF yeni vərəqdə açıldı. Saxlamaq üçün brauzerin yükləmə və ya paylaşma düyməsinə basın.');
      } else {
        window.location.assign(url);
      }
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || 'Cədvəl PDF-i yüklənə bilmədi.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setNotice('Cədvəl A5 PDF kimi yükləndi.');
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Cədvəl PDF-i yüklənə bilmədi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-col items-stretch gap-1 sm:items-end ${className}`}>
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        className="focus-ring inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--card))] px-3.5 py-2 text-xs font-bold text-[hsl(var(--primary))] shadow-[var(--shadow-xs)] transition hover:bg-[hsl(var(--muted))] disabled:opacity-60 sm:w-auto"
        title="Həftəlik cədvəli A5 vərəqində PDF kimi yüklə"
        data-testid={testId}
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {busy ? 'Hazırlanır…' : 'PDF yüklə (A5)'}
      </button>
      {notice && <p className="text-[11px] font-semibold text-emerald-700 sm:max-w-[260px] sm:text-right" role="status">{notice}</p>}
      {error && <p className="text-[11px] font-semibold text-[hsl(var(--destructive))] sm:max-w-[260px] sm:text-right" role="alert">{error}</p>}
    </div>
  );
}
