import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const siteBase = import.meta.env.BASE_URL.replace(/\/$/, '');

function isTouchDevice() {
  return Boolean(window.matchMedia?.('(pointer: coarse)').matches) || /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
}

/**
 * Həftəlik dərs cədvəlini A5 PDF kimi yükləyir (server: /api/student/schedule.pdf və ya /api/admin/teacher-schedule.pdf).
 * Telefon/planşetdə PDF yeni vərəqdə açılır (brauzerin yükləmə/paylaşma düyməsi ilə saxlanılır) — şəhadətnamə ilə eyni yol.
 * Yalnız yükləmə ikonu: başlıq sağında kiçik kvadrat düymə.
 */
export function SchedulePdfButton({ apiPath, fileName, testId, className = '' }: { apiPath: string; fileName: string; testId: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const url = `${siteBase}/api${apiPath}`;
  const label = 'Cədvəli PDF yüklə (A5)';

  const download = async () => {
    if (busy) return;
    if (isTouchDevice()) {
      const opened = window.open(url, '_blank');
      if (opened) {
        opened.opener = null;
        toast({ title: 'PDF açıldı', description: 'PDF yeni vərəqdə açıldı. Saxlamaq üçün brauzerin yükləmə və ya paylaşma düyməsinə basın.' });
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
      toast({ title: 'Cədvəl yükləndi', description: 'Cədvəl A5 PDF kimi yükləndi.' });
    } catch (downloadError) {
      toast({
        variant: 'destructive',
        title: 'Yükləmə alınmadı',
        description: downloadError instanceof Error ? downloadError.message : 'Cədvəl PDF-i yüklənə bilmədi.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void download()}
      disabled={busy}
      className={`focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-[var(--shadow-xs)] transition hover:bg-[hsl(var(--muted))] disabled:opacity-60 ${className}`}
      aria-label={label}
      title={label}
      data-testid={testId}
    >
      {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
    </button>
  );
}
