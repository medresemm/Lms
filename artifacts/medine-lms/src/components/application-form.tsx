import { type FormEvent, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, FileText, LoaderCircle, Send, ShieldCheck, Upload } from 'lucide-react';
import { useClerk } from '@clerk/react';
import { useSignUp } from '@clerk/react/legacy';
import { HomeLink } from '@/components/home-link';
import { LanguageSwitch, useI18n, type MessageKey } from '@/lib/i18n';
import { Link } from 'wouter';

type FormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string;
  arabicLevel: string;
  password: string;
  acceptedTerms: boolean;
};

type PendingApplicationFiles = {
  paths: string[];
  names: string[];
};
type ApplicationWindow = {
  opensAt: string | null;
  closesAt: string | null;
  isOpen: boolean;
  nextOpenAt: string | null;
  status: 'open' | 'not_started' | 'ended' | 'unscheduled';
};

const inputClass = 'focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm text-[hsl(var(--foreground))] outline-none transition placeholder:text-[hsl(var(--muted-foreground)/.65)]';
const maxApplicationFileSize = 3 * 1024 * 1024;
const azerbaijanTimeZone = 'Asia/Baku';

const initialForm: FormValues = {
  firstName: '',
  lastName: '',
  phone: '+994',
  email: '',
  birthDate: '',
  arabicLevel: '',
  password: '',
  acceptedTerms: false,
};

function apiUrl(path: string) {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api${path}`;
}

const applicationRouteUrl = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/sign-up`;
const ux = (t: (key: MessageKey) => string, key: string) => t(key as MessageKey);

function generateApplicationPassword() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyz23456789';
  const values = new Uint32Array(10);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

function clerkErrorMessage(error: unknown, t: (key: MessageKey) => string) {
  const firstError = (error as {
    errors?: Array<{ code?: string; longMessage?: string; message?: string }>;
  })?.errors?.[0];
  if (!firstError && error instanceof Error) return error.message;
  const code = firstError?.code ?? '';
  const englishMessage = `${firstError?.longMessage ?? ''} ${firstError?.message ?? ''}`.toLowerCase();
  console.error('Qeydiyyat xətası:', { code, status: (error as { status?: number })?.status });

  if (code === 'form_identifier_exists' || englishMessage.includes('already exists') || englishMessage.includes('already registered')) {
    return ux(t, 'uxEmailExists');
  }
  if (code === 'form_password_pwned' || code === 'form_password_compromised') {
    return ux(t, 'uxPasswordUnsafe');
  }
  if (code === 'form_password_length_too_short') {
    const minimumLength = `${firstError?.longMessage ?? ''} ${firstError?.message ?? ''}`.match(/(?:at least|minimum(?: of)?|ən azı)\s*(\d+)/i)?.[1];
    return minimumLength
      ? ux(t, 'uxPasswordMin').replace('{n}', minimumLength)
      : ux(t, 'uxClerkMinPassword');
  }
  if (englishMessage.includes('password') || code.includes('password')) {
    return ux(t, 'uxPasswordRejected');
  }
  if (code === 'form_param_unknown') {
    return ux(t, 'uxClerkEmailPasswordOff');
  }
  if (code === 'form_param_nil') {
    return ux(t, 'uxFillRequired');
  }
  if (code === 'form_param_format_invalid' || englishMessage.includes('invalid email') || englishMessage.includes('valid email')) {
    return ux(t, 'uxEmailFormat');
  }
  if (code === 'too_many_requests' || code === 'rate_limit_exceeded') {
    return ux(t, 'uxTooManyAttempts');
  }
  if (code === 'captcha_invalid' || code === 'captcha_missing') {
    return ux(t, 'uxCaptchaFail');
  }
  if (code) return ux(t, 'uxAccountCreateFailCode').replace('{code}', code);
  return ux(t, 'uxAccountCreateFail');
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">{label}</span>{children}</label>;
}

function ApplicationFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-8 border-t border-[hsl(var(--border))] py-4 text-center">
      <p className="text-sm font-semibold text-[hsl(var(--primary))]">{t('academy')}</p>
      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t('rights')}</p>
      <p className="mt-2"><Link href="/istifade-sertleri" className="text-xs font-semibold text-[hsl(var(--primary))] underline-offset-2 hover:underline">{t('terms')}</Link></p>
    </footer>
  );
}

export function ApplicationForm({ brand }: { brand: React.ReactNode }) {
  const { t, locale, dir } = useI18n();
  const pageClass = (extra: string) => `${extra}${locale === 'ar' ? ' font-ar' : ''}`;
  const { signUp, isLoaded, setActive } = useSignUp();
  const { signOut } = useClerk();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormValues>(initialForm);
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationNeeded, setVerificationNeeded] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(() => typeof window !== 'undefined' && window.sessionStorage.getItem('medine-application-submitted') === 'true');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingApplicationFiles | null>(null);
  const [applicationWindow, setApplicationWindow] = useState<ApplicationWindow | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    void fetch(apiUrl('/application-window'))
      .then(async (response) => {
        if (!response.ok) throw new Error('window');
        return response.json() as Promise<ApplicationWindow>;
      })
      .then(setApplicationWindow)
      .catch(() => setApplicationWindow({ opensAt: null, closesAt: null, isOpen: true, nextOpenAt: null, status: 'unscheduled' }));
  }, []);

  const formatWindowDate = (value: string | null) => value
    ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'az-AZ', { dateStyle: 'full', timeStyle: 'short', timeZone: azerbaijanTimeZone }).format(new Date(value))
    : '';

  const uploadLetter = async (file: File) => {
    const request = await fetch(apiUrl('/applications/upload-url'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || 'application/pdf' }),
    });
    const upload = await request.json() as { uploadURL?: string; objectPath?: string; error?: string };
    if (!request.ok || !upload.uploadURL || !upload.objectPath) {
      const providerError = (upload.error || '').toLowerCase();
      if (request.status === 429 || providerError.includes('limit') || providerError.includes('quota') || providerError.includes('too many')) {
        throw new Error(ux(t, 'uxUploadQuota'));
      }
      throw new Error(ux(t, 'uxUploadPrepFail'));
    }
    const uploaded = await fetch(upload.uploadURL, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/pdf' },
      body: file,
    });
    if (!uploaded.ok) throw new Error(ux(t, 'uxFileUploadFail'));
    return upload.objectPath;
  };

  const submitAuthenticatedApplication = async (pending: PendingApplicationFiles) => {
    const application = await fetch(apiUrl('/applications'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email,
        birthDate: form.birthDate,
        arabicLevel: form.arabicLevel,
        recommendationPaths: pending.paths,
        recommendationNames: pending.names,
      }),
    });
    const result = await application.json() as { error?: string };
    if (!application.ok) throw new Error(result.error || ux(t, 'uxApplicationRejected'));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    setIsError(false);
    if (applicationWindow && !applicationWindow.isOpen) {
      setIsError(true);
      setNotice(applicationWindow.status === 'not_started' ? t('applicationsNotOpen') : t('applicationsClosed'));
      return;
    }
    if (files.length !== 2) {
      setIsError(true);
      setNotice(t('needTwoLetters'));
      return;
    }
    if (!isLoaded || !signUp) {
      setIsError(true);
      setNotice(t('signupNotReady'));
      return;
    }

    setIsSubmitting(true);
    try {
      const paths = await Promise.all(files.map(uploadLetter));
      const createdSignUp = await signUp.create({
        emailAddress: form.email,
        password: form.password,
      });
      const pending = { paths, names: files.map((file) => file.name) };

      if (createdSignUp.status === 'complete' && createdSignUp.createdSessionId && setActive) {
        await setActive({ session: createdSignUp.createdSessionId });
        await submitAuthenticatedApplication(pending);
        window.sessionStorage.setItem('medine-application-submitted', 'true');
        setApplicationSubmitted(true);
        await signOut({ redirectUrl: applicationRouteUrl });
        return;
      }

      await createdSignUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingFiles(pending);
      setVerificationNeeded(true);
      setNotice(t('needVerifyCode'));
    } catch (error) {
      setIsError(true);
      setNotice(clerkErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!signUp) return;
    setIsSubmitting(true);
    setNotice('');
    setIsError(false);
    try {
      const completed = await signUp.attemptEmailAddressVerification({ code: verificationCode });
      if (completed.status !== 'complete' || !completed.createdSessionId || !setActive || !pendingFiles) throw new Error();
      await setActive({ session: completed.createdSessionId });
      await submitAuthenticatedApplication(pendingFiles);
      window.sessionStorage.setItem('medine-application-submitted', 'true');
      setVerificationNeeded(false);
      setApplicationSubmitted(true);
      await signOut({ redirectUrl: applicationRouteUrl });
    } catch {
      setIsError(true);
      setNotice(t('badVerifyCode'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (applicationSubmitted) {
    return (
      <main dir={dir} className={pageClass('grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5 py-7 md:px-10')}>
        <div className="w-full max-w-lg"><div className="flex items-center justify-between gap-4">{brand}<div className="flex items-center gap-2"><LanguageSwitch /><HomeLink /></div></div>
          <section className="mt-10 rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 shadow-[var(--shadow-sm)] md:p-9">
            <CheckCircle2 className="text-[hsl(var(--secondary-foreground))]" size={32} />
            <h1 className="mt-5 font-serif text-4xl leading-none text-[hsl(var(--primary))]">{t('applicationSent')}</h1>
            <p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('applicationSentBody')}</p>
            <div className="mt-6 rounded-xl bg-[hsl(var(--secondary)/.4)] p-4 text-sm font-semibold text-[hsl(var(--secondary-foreground))]">{t('applicationSentNote')}</div>
          </section>
        </div>
      </main>
    );
  }

  if (verificationNeeded) {
    return (
      <main dir={dir} className={pageClass('grain min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-7 md:px-10')}>
        <div className="mx-auto max-w-lg"><div className="flex items-center justify-between gap-4">{brand}<div className="flex items-center gap-2"><LanguageSwitch /><HomeLink /></div></div>
          <section className="mt-10 rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)] md:p-8">
            <CheckCircle2 className="text-[hsl(var(--secondary-foreground))]" size={30} />
            <h1 className="mt-5 font-serif text-4xl leading-none text-[hsl(var(--primary))]">{t('verifyEmail')}</h1>
            <p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('verifyEmailBody')}</p>
            <form className="mt-7 space-y-5" onSubmit={verify}>
              <Field label={t('verifyCode')}><input required autoComplete="one-time-code" className={inputClass} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} inputMode="numeric" /></Field>
              <button type="submit" disabled={isSubmitting} className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50">{isSubmitting ? <LoaderCircle className="animate-spin" size={17} /> : <ShieldCheck size={17} />}{isSubmitting ? t('verifying') : t('verify')}</button>
            </form>
            {notice && <p className={`mt-4 text-sm font-semibold ${isError ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--secondary-foreground))]'}`}>{notice}</p>}
          </section>
        </div>
      </main>
    );
  }

  if (applicationWindow && !applicationWindow.isOpen) {
    return (
      <main dir={dir} className={pageClass('grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5 py-7 md:px-10')}>
        <div className="w-full max-w-lg"><div className="flex items-center justify-between gap-4">{brand}<div className="flex items-center gap-2"><LanguageSwitch /><HomeLink /></div></div>
          <section className="mt-10 rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 shadow-[var(--shadow-sm)] md:p-9">
            <FileText className="text-[hsl(var(--secondary-foreground))]" size={32} />
            <h1 className="mt-5 font-serif text-4xl leading-none text-[hsl(var(--primary))]">{t('applicationsClosedTitle')}</h1>
            <p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              {applicationWindow.status === 'not_started'
                ? t('applicationsNotStartedBody')
                : t('applicationsClosedBody')}
            </p>
            {applicationWindow.status === 'not_started' && applicationWindow.nextOpenAt && (
              <div className="mt-6 rounded-xl bg-[hsl(var(--secondary)/.4)] p-4 text-sm font-semibold leading-6 text-[hsl(var(--secondary-foreground))]">
                {t('opensAt')}: {formatWindowDate(applicationWindow.nextOpenAt)}
              </div>
            )}
          </section>
          <ApplicationFooter />
        </div>
      </main>
    );
  }

  return (
    <main dir={dir} className={pageClass('grain min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-7 md:px-10')}>
      <div className="mx-auto max-w-5xl"><div className="flex items-center justify-between gap-4">{brand}<div className="flex items-center gap-2"><LanguageSwitch /><Link href="/sign-in" className="focus-ring rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))]" data-testid="link-application-sign-in">{t('signIn')}</Link><HomeLink /></div></div>
        <div className="mt-9 grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <aside className="rounded-[28px] bg-[hsl(var(--primary))] p-7 text-[hsl(var(--primary-foreground))] shadow-[0_24px_60px_hsl(203_55%_18%/.16)] md:p-9">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--accent))]">{t('academy')}</p>
            <h1 className="mt-6 font-serif text-5xl leading-[.94] tracking-[-.05em]">{t('applyTitle')}</h1>
            <p className="mt-6 text-sm leading-6 text-[hsl(var(--primary-foreground)/.7)]">{t('applyLead')}</p>
          </aside>
          <section className="rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] md:p-8">
            <div className="mb-7"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">{t('newApplication')}</p><h2 className="mt-2 font-serif text-3xl text-[hsl(var(--primary))]">{t('enterDetails')}</h2></div>
            <form className="space-y-5" onSubmit={submit} data-testid="form-application">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('firstName')}><input required autoComplete="given-name" className={inputClass} value={form.firstName} onChange={(event) => update('firstName', event.target.value)} data-testid="input-application-first-name" /></Field>
                <Field label={t('lastName')}><input required autoComplete="family-name" className={inputClass} value={form.lastName} onChange={(event) => update('lastName', event.target.value)} data-testid="input-application-last-name" /></Field>
              </div>
              <Field label={t('phone')}><input required type="tel" autoComplete="tel" pattern="^\+994\d{9}$" className={inputClass} value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+994XXXXXXXXX" data-testid="input-application-phone" /></Field>
              <Field label={t('email')}><input required type="email" autoComplete="email" className={inputClass} value={form.email} onChange={(event) => update('email', event.target.value)} data-testid="input-application-email" /></Field>
              <Field label={t('birthDate')}><div className="relative"><input required type="date" lang={locale === 'ar' ? 'ar' : 'az'} className={`${inputClass} ${form.birthDate ? '' : 'text-transparent'}`} value={form.birthDate} onChange={(event) => update('birthDate', event.target.value)} data-testid="input-application-birth-date" />{!form.birthDate && <span className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-sm text-[hsl(var(--muted-foreground)/.7)]">{t('birthPlaceholder')}</span>}</div></Field>
              <Field label={t('arabicLevel')}><select required className={inputClass} value={form.arabicLevel} onChange={(event) => update('arabicLevel', event.target.value)} data-testid="select-application-arabic-level"><option value="" disabled>{t('chooseLevel')}</option><option value="Zəif">{t('levelWeak')}</option><option value="Orta">{t('levelMid')}</option><option value="Yaxşı">{t('levelGood')}</option><option value="Əla">{t('levelExcellent')}</option></select></Field>
              <div>
                <span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">{t('recommendation')}</span>
                 <input ref={fileInput} required type="file" multiple accept=".pdf,.doc,.docx,image/jpeg,image/png" className="sr-only" onChange={(event) => { const selected = Array.from(event.target.files ?? []).slice(0, 2); if (selected.some((file) => file.size > maxApplicationFileSize)) { setFiles([]); setIsError(true); setNotice(t('fileTooBig')); if (fileInput.current) fileInput.current.value = ''; return; } setIsError(false); setNotice(''); setFiles(selected); }} data-testid="input-application-recommendations" />
                <button type="button" onClick={() => fileInput.current?.click()} className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)] px-4 py-4 text-sm font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]"><Upload size={16} /> {t('chooseFiles')}</button>
                 <p className="mt-2 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">{t('recommendationHint')}</p>
                {files.length > 0 && <div className="mt-3 space-y-1.5">{files.map((file) => <p key={file.name} className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--secondary-foreground))]"><FileText size={14} /> {file.name}</p>)}</div>}
              </div>
               <Field label={t('password')}><div className="relative"><input required type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} className={`${inputClass} pe-11`} value={form.password} onChange={(event) => update('password', event.target.value)} data-testid="input-application-password" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="focus-ring absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label={showPassword ? t('hidePassword') : t('showPassword')} data-testid="button-toggle-application-password">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><div className="mt-1.5 flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('passwordHint')}</span><button type="button" onClick={() => { update('password', generateApplicationPassword()); setShowPassword(true); }} className="focus-ring text-[11px] font-bold text-[hsl(var(--secondary-foreground))] hover:underline" data-testid="button-generate-application-password">{t('generatePassword')}</button></div></Field>
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold text-[hsl(var(--primary))]">{t('termsTitle')}</p>
                  <Link href="/istifade-sertleri" className="shrink-0 text-[11px] font-bold text-[hsl(var(--secondary-foreground))] underline-offset-2 hover:underline">{t('read')}</Link>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">{t('termsShort')}</p>
                <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-[hsl(var(--foreground))]"><input required type="checkbox" checked={form.acceptedTerms} onChange={(event) => update('acceptedTerms', event.target.checked)} className="h-3.5 w-3.5 accent-[hsl(var(--secondary-foreground))]" data-testid="checkbox-application-terms" />{t('agree')}</label>
              </div>
              <button type="submit" disabled={isSubmitting} className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-submit-application">{isSubmitting ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />}{isSubmitting ? t('sending') : t('submit')}</button>
              {notice && <p className={`rounded-xl px-3.5 py-3 text-sm font-semibold ${isError ? 'bg-[hsl(var(--destructive)/.08)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--secondary)/.45)] text-[hsl(var(--secondary-foreground))]'}`}>{notice}</p>}
            </form>
          </section>
        </div>
        <ApplicationFooter />
      </div>
    </main>
  );
}