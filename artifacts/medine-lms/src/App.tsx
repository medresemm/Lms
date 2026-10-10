import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  getGetAnnouncementsQueryKey,
  getGetArticlesQueryKey,
  getGetDailyBenefitQueryKey,
  getGetDashboardQueryKey,
  getGetStudentAcademicProfileQueryKey,
  getGetStudentScheduleAccessQueryKey,
  getGetStudentDeletionNoticeQueryKey,
  getGetOwnUserProfileQueryKey,
  useGetAnnouncements,
  useGetArticles,
  useGetDailyBenefit,
  useGetDashboard,
  useGetStudentAcademicProfile,
  useGetStudentScheduleAccess,
  useGetStudentDeletionNotice,
  useGetOwnUserProfile,
  setAuthTokenGetter,
} from '@workspace/api-client-react';
import { ClerkProvider, Show, useAuth, useClerk, useSignIn as useModernSignIn, useUser } from '@clerk/react';
import { getFreshClerkToken, registerClerkTokenSource } from '@/lib/clerk-token';
import { useSignIn as useLegacySignIn } from '@clerk/react/legacy';
import { BookOpenText, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, KeyRound, LoaderCircle, LogIn, Megaphone, Quote, RefreshCw, UserRound } from 'lucide-react';
import type { Announcement, Article, DailyBenefit } from '@workspace/api-client-react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { ErrorBoundary } from '@/components/error-boundary';
import { ApplicationForm } from '@/components/application-form';
import { StudentDashboard } from '@/components/student-dashboard';
import { StudentExamsSection } from '@/components/exam-module';
import { AdminPanel } from '@/components/admin-panel';
import { AiAssistantPage } from '@/components/ai-assistant';
import { CertificateVerificationPage } from '@/components/graduate-certificate';
import { Toaster } from '@/components/ui/toaster';
import { HomeLink } from '@/components/home-link';
import { LanguageSwitch, useI18n } from '@/lib/i18n';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { LibraryReader } from '@/components/library-reader';
import { Link, Route, Redirect, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { formatPersonName } from '@/lib/utils';
import { accountProfileQueryRetry } from '@/lib/account-profile-retry';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status;
        if (status === 401) return failureCount < 1;
        if (typeof status === 'number' && status < 500) return false;
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => Math.min(1_000 * 2 ** attemptIndex, 3_000),
    },
  },
});
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const apiUrl = (path: string) => `${basePath}/api${path}`;
const configuredClerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkPubKey = configuredClerkPubKey ? publishableKeyFromHost(window.location.hostname, configuredClerkPubKey) : '';
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

function UserPortal() {
  const { user, isLoaded } = useUser();
  const signedIn = isLoaded && Boolean(user);
  const accountProfileQuery = useGetOwnUserProfile({ query: { enabled: signedIn, queryKey: getGetOwnUserProfileQueryKey(), ...accountProfileQueryRetry, staleTime: 60_000 } });
  const isStaff = isStaffRole(accountProfileQuery.data?.role) || (!accountProfileQuery.data && isTeacherAccount(user));
  const scheduleAccessQuery = useGetStudentScheduleAccess({
    query: {
      enabled: signedIn && !isStaff,
      queryKey: getGetStudentScheduleAccessQueryKey(),
      staleTime: 30_000,
    },
  });
  const profilePending = !accountProfileQuery.data && (accountProfileQuery.isLoading || accountProfileQuery.isFetching);
  const accessPending = !isStaff && !scheduleAccessQuery.data && (scheduleAccessQuery.isLoading || scheduleAccessQuery.isFetching);
  if (!isLoaded || profilePending || accessPending) return <AccountGateLoading />;
  if (accountProfileQuery.isError && !isStaff) return <AccountGateError onRetry={() => void accountProfileQuery.refetch()} />;
  if (isStaff) return <Redirect to="/admin" />;
  if (scheduleAccessQuery.data?.onboardingRequired && !scheduleAccessQuery.data.approved) return <Redirect to="/admission-exam" />;
  return <StudentPortal initialScheduleAccess={scheduleAccessQuery.data} />;
}

function AdmissionExamPortal() {
  const { t } = useI18n();
  const { user } = useUser();
  const { signOut } = useClerk();
  const scheduleAccessQuery = useGetStudentScheduleAccess({
    query: {
      queryKey: getGetStudentScheduleAccessQueryKey(),
      staleTime: 0,
      refetchInterval: 15_000,
    },
  });
  const academicProfileQuery = useGetStudentAcademicProfile({
    query: {
      enabled: scheduleAccessQuery.data?.onboardingRequired === true && !scheduleAccessQuery.isError,
      queryKey: getGetStudentAcademicProfileQueryKey(),
    },
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const accountError = scheduleAccessQuery.error as { status?: number; data?: { error?: string } } | null;

  if (accountError?.status === 403) return <Redirect to="/user-portal" />;
  if (scheduleAccessQuery.isLoading || academicProfileQuery.isLoading) {
    return <main className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))]"><LoaderCircle className="animate-spin text-[hsl(var(--accent))]" /></main>;
  }
  if (scheduleAccessQuery.data?.approved || !scheduleAccessQuery.data?.onboardingRequired) return <Redirect to="/user-portal" />;
  if (scheduleAccessQuery.isError || academicProfileQuery.isError) {
    return (
      <main className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5 py-8">
        <section className="w-full max-w-lg rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 text-center shadow-[var(--shadow-sm)]">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--destructive))]">{t('admissionStage')}</p>
          <h1 className="mt-3 font-serif text-3xl text-[hsl(var(--primary))]">{t('examLoadFail')}</h1>
          <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('examRecheck')}</p>
          <button type="button" onClick={() => { void scheduleAccessQuery.refetch(); void academicProfileQuery.refetch(); }} className="focus-ring mt-6 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]"><RefreshCw size={15} /> {t('retryCheck')}</button>
        </section>
      </main>
    );
  }

  const scheduleAccess = scheduleAccessQuery.data;
  const academicProfile = academicProfileQuery.data;
  const examId = scheduleAccess?.onboardingExamId ?? undefined;
  return (
    <main className="grain min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-7 md:px-10 md:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[hsl(var(--accent))] font-serif text-xl font-bold text-[hsl(var(--primary))] shadow-[0_5px_0_hsl(37_83%_52%)]">M</div>
            <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{t('academyName')}</p><p className="font-serif text-lg text-[hsl(var(--primary))]">{t('admissionStage')}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <button type="button" onClick={() => void signOut({ redirectUrl: basePath || '/' })} className="focus-ring rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))]">{t('logout')}</button>
          </div>
        </header>
        <section className="mt-8 rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)] md:p-9" data-testid="admission-exam-gate">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/.35)] text-[hsl(var(--secondary-foreground))]"><ClipboardList size={22} /></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">{t('lastAdmissionStep')}</p><h1 className="mt-2 font-serif text-3xl leading-tight text-[hsl(var(--primary))]">{t('finishAdmissionExam')}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('admissionExamHint')}</p></div>
          </div>
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-[hsl(var(--secondary)/.4)] px-4 py-3 text-xs font-semibold text-[hsl(var(--secondary-foreground))]"><CheckCircle2 size={16} /> {t('examReviewWait')}</div>
        </section>
        <div className="mt-6">
          {academicProfile && examId ? (
            <StudentExamsSection
              key={`${examId}-${refreshKey}`}
              termNumber={academicProfile.currentTermNumber}
              initialExamId={examId}
              onSubmitted={() => { setRefreshKey((value) => value + 1); void scheduleAccessQuery.refetch(); }}
            />
          ) : (
            <section className="rounded-[26px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 text-center shadow-[var(--shadow-xs)]" data-testid="admission-exam-waiting">
              <ClipboardList className="mx-auto text-[hsl(var(--accent))]" size={30} />
              <h2 className="mt-3 font-serif text-2xl text-[hsl(var(--primary))]">{t('examPreparing')}</h2>
              <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('examPreparingHint')}</p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function StudentPortal({ initialScheduleAccess }: { initialScheduleAccess?: { approved?: boolean; onboardingRequired?: boolean; onboardingExamId?: number | null } }) {
  const { t, locale } = useI18n();
  const dashboardQuery = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey(), staleTime: 60_000 } });
  const academicProfileQuery = useGetStudentAcademicProfile({ query: { queryKey: getGetStudentAcademicProfileQueryKey(), staleTime: 60_000 } });
  const deletionNoticeQuery = useGetStudentDeletionNotice({ query: { queryKey: getGetStudentDeletionNoticeQueryKey() } });
  const { user } = useUser();
  const { signOut } = useClerk();
  const displayName = dashboardQuery.data?.studentName || user?.firstName || user?.primaryEmailAddress?.emailAddress;
  const accountError = dashboardQuery.error as { status?: number; data?: { error?: string } } | null;
  const isPendingAccount = accountError?.status === 403;
  const accountMessage = accountError?.data?.error ?? t('accountWaitingHint');
  const isRejectedAccount = accountMessage.includes('imtina');

  if (deletionNoticeQuery.data) {
    const notice = deletionNoticeQuery.data;
    return (
      <main className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5 py-7">
        <section className="w-full max-w-lg rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 shadow-[var(--shadow-sm)] md:p-9" data-testid="student-deletion-notice">
          <HomeLink />
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--destructive))]">{t('accountNotice')}</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight text-[hsl(var(--primary))]">{t('accountDisabled')}</h1>
          <p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('accountDisabledHint')}</p>
          <div className="mt-6 rounded-2xl bg-[hsl(var(--muted)/.45)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{t('deletionReason')}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[hsl(var(--primary))]">{notice.reason}</p>
            <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">{t('actedBy')}: {notice.deletedByName} · {new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'az-AZ', { dateStyle: 'medium' }).format(new Date(notice.deletedAt))}</p>
          </div>
          <button type="button" onClick={() => void signOut({ redirectUrl: basePath || '/' })} className="focus-ring mt-7 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">{t('logout')}</button>
        </section>
      </main>
    );
  }

  if (isPendingAccount) {
    return (
      <main className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5 py-7">
        <section className="w-full max-w-lg rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 shadow-[var(--shadow-sm)] md:p-9">
          <HomeLink />
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">{t('academyName')}</p>
           <h1 className="mt-4 font-serif text-4xl leading-none text-[hsl(var(--primary))]">{isRejectedAccount ? t('accountRejected') : t('accountWaiting')}</h1>
           <p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{accountMessage}</p>
          <button type="button" onClick={() => void signOut({ redirectUrl: basePath || '/' })} className="focus-ring mt-7 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">{t('logout')}</button>
        </section>
      </main>
    );
  }

  return <StudentDashboard
    dashboard={displayName && dashboardQuery.data ? { ...dashboardQuery.data, studentName: displayName, greeting: `${t('welcome')}, ${displayName}` } : dashboardQuery.data}
    courses={dashboardQuery.data?.courses}
    announcements={dashboardQuery.data?.announcements}
    academicProfile={academicProfileQuery.data}
    initialScheduleAccess={initialScheduleAccess}
    isLoading={dashboardQuery.isLoading && !dashboardQuery.data}
    hasError={dashboardQuery.isError && !dashboardQuery.data}
    onRetry={() => { void dashboardQuery.refetch(); void academicProfileQuery.refetch(); }}
    onLogout={() => void signOut({ redirectUrl: basePath || '/' })}
  />;
}

function isTeacherAccount(user: { publicMetadata?: unknown } | null | undefined) {
  const metadata = user?.publicMetadata;
  const metadataRole = typeof metadata === 'object' && metadata !== null &&
    'role' in metadata &&
    (metadata as { role?: unknown }).role;
  const ownerEmail = import.meta.env.VITE_SYSTEM_OWNER_EMAIL?.trim().toLowerCase();
  const userEmail = (user as { primaryEmailAddress?: { emailAddress?: string } | null } | null)?.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
  return metadataRole === 'teacher' || metadataRole === 'admin' || metadataRole === 'supervisor' || metadataRole === 'owner_assistant' || metadataRole === 'owner' ||
    Boolean(ownerEmail && userEmail === ownerEmail);
}

function isStaffRole(role: unknown) {
  return role === 'owner' || role === 'owner_assistant' || role === 'teacher' || role === 'admin' || role === 'supervisor';
}

function BrandMark() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--primary)/.12)] bg-white px-2.5 py-2 shadow-[0_5px_18px_hsl(var(--primary)/.08)]" data-testid="brand-academy">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-[13px] bg-[hsl(var(--accent))] text-[hsl(var(--primary))] shadow-[0_5px_0_hsl(37_83%_52%)]">
        <span className="font-serif text-xl font-bold leading-none">M</span>
        <span className="absolute bottom-[7px] right-[7px] h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
      </div>
      <div>
        <p className="text-[12px] font-black uppercase tracking-[0.16em] text-black">{t('academyShort')}</p>
        <p className="font-serif text-[19px] font-black leading-none text-black">{t('academyLine')}</p>
      </div>
    </div>
  );
}

type PublicSystemStatistics = {
  teachers: number;
  currentStudents: number;
  graduatedStudents: number;
  visible: boolean;
};

function PublicStatistics({ statistics }: { statistics: PublicSystemStatistics }) {
  const { t } = useI18n();
  const items = [
    { label: t('teachers'), value: statistics.teachers, className: 'bg-sky-100 text-sky-900' },
    { label: t('currentStudents'), value: statistics.currentStudents, className: 'bg-emerald-100 text-emerald-900' },
    { label: t('graduates'), value: statistics.graduatedStudents, className: 'bg-amber-100 text-amber-950' },
  ];
  return <section className="mt-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-5 shadow-[var(--shadow-sm)] md:px-6" data-testid="section-public-statistics">
    <p className="text-center text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">{t('statsTitle')}</p>
    <div className="mt-4 grid grid-cols-3 gap-3">
      {items.map((item) => <div key={item.label} className="flex flex-col items-center gap-1.5 text-center">
        <div className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-black sm:h-16 sm:w-16 sm:text-xl ${item.className}`}>{item.value}</div>
        <span className="text-xs font-bold text-[hsl(var(--primary))]">{item.label}</span>
      </div>)}
    </div>
  </section>;
}

function SiteFooter({ className = 'mt-12' }: { className?: string }) {
  const { t } = useI18n();
  return (
    <footer className={`${className} border-t border-[hsl(var(--border))] py-5 text-center`} data-testid="site-footer">
      <p className="text-sm font-semibold text-[hsl(var(--primary))]">{t('academy')}</p>
      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t('rights')}</p>
      <p className="mt-2"><Link href="/istifade-sertleri" className="text-xs font-semibold text-[hsl(var(--primary))] underline-offset-2 hover:underline">{t('terms')}</Link></p>
    </footer>
  );
}

function HomePage() {
  const { t, locale, dir } = useI18n();
  const dailyBenefitQuery = useGetDailyBenefit({ query: { queryKey: getGetDailyBenefitQueryKey() } });
  const articlesQuery = useGetArticles({ query: { queryKey: getGetArticlesQueryKey() } });
  const announcementsQuery = useGetAnnouncements({ query: { queryKey: getGetAnnouncementsQueryKey() } });
  const [statistics, setStatistics] = useState<PublicSystemStatistics | null>(null);

  useEffect(() => {
    void fetch(`${basePath}/api/system-statistics`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<PublicSystemStatistics> : Promise.reject())
      .then((result) => setStatistics(result.visible ? result : null))
      .catch(() => setStatistics(null));
  }, []);

  return (
    <main dir={dir} className={`grain flex min-h-[100dvh] flex-col bg-[hsl(var(--background))] px-5 py-5 md:px-8 md:py-6${locale === 'ar' ? ' font-ar' : ''}`}>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
         <div className="flex items-center justify-between gap-4"><BrandMark /><div className="flex items-center gap-2"><LanguageSwitch /><HomeLink /><Link href="/articles" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))]" data-testid="link-home-articles"><BookOpenText size={15} /> {t('articles')}</Link><Link href="/sign-in" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))]" data-testid="link-home-sign-in"><LogIn size={15} /> {t('signIn')}</Link><Link href="/sign-up" className="focus-ring hidden rounded-xl bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] sm:inline-flex">{t('apply')}</Link></div></div>
        <section className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_.85fr] lg:items-start">
           <div className="rounded-2xl bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))] shadow-[0_12px_32px_hsl(203_55%_18%/.12)] sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--accent))]">{t('academy')}</p>
            <h1 className="mt-3 max-w-xl font-serif text-2xl leading-snug tracking-[-.03em] sm:text-3xl">{t('heroQuote')}</h1>
            <p className="mt-2 text-xs leading-5 text-[hsl(var(--primary-foreground)/.72)]">{t('heroSource')}</p>
             <div className="mt-5 flex flex-wrap items-center gap-2">
               <Link href="/sign-in" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--primary-foreground)/.28)] bg-[hsl(var(--primary-foreground)/.08)] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:bg-[hsl(var(--primary-foreground)/.14)]" data-testid="link-home-app-entry">
                 <LogIn size={16} /> {t('appEntry')}
               </Link>
               <Link href="/sign-up" className="focus-ring inline-flex items-center rounded-xl bg-[hsl(var(--accent))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary))]" data-testid="link-home-application">{t('apply')}</Link>
             </div>
          </div>
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)]">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">{t('tracks')}</p>
            <div className="mt-3 flex flex-wrap gap-2">{[t('trackQuran'), t('trackHadith'), t('trackAqeedah'), t('trackFiqh'), t('trackArabic')].map((course) => <div key={course} className="rounded-lg bg-[hsl(var(--muted)/.55)] px-3 py-1.5 text-sm font-semibold text-[hsl(var(--primary))]">{course}</div>)}</div>
            <p className="mt-4 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{t('applyHint')}</p>
          </div>
        </section>
         <section className="mt-6 max-w-3xl">
           <DailyBenefitCard benefit={dailyBenefitQuery.data} isLoading={dailyBenefitQuery.isLoading} hasError={dailyBenefitQuery.isError} />
         </section>
         <section className="mt-10 max-w-3xl" data-testid="section-articles">
           <div className="flex items-end justify-between gap-4">
             <div>
               <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]"><BookOpenText size={15} /> {t('fromAcademy')}</p>
               <h2 className="mt-1 font-serif text-3xl leading-none tracking-[-.03em] text-[hsl(var(--primary))]">{t('articles')}</h2>
             </div>
             <Link href="/articles" className="focus-ring shrink-0 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))]" data-testid="link-home-articles-more">{t('seeAll')}</Link>
           </div>
           {articlesQuery.isLoading && <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">{t('articlesLoading')}</p>}
           {articlesQuery.isError && <p className="mt-6 rounded-xl bg-[hsl(var(--destructive)/.06)] p-4 text-sm font-semibold text-[hsl(var(--destructive))]">{t('articlesError')}</p>}
           {!articlesQuery.isLoading && !articlesQuery.isError && !articlesQuery.data?.length && <p className="mt-6 rounded-2xl border border-dashed border-[hsl(var(--border))] p-7 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('articlesEmpty')}</p>}
           {!articlesQuery.isLoading && !articlesQuery.isError && Boolean(articlesQuery.data?.length) && <div className="mt-6 space-y-3">{articlesQuery.data?.slice(0, 3).map((article) => <ArticleCard key={article.id} article={article} />)}</div>}
         </section>
          <section className="mt-10 max-w-3xl" data-testid="section-home-announcements">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]"><Megaphone size={15} /> {t('fromAcademy')}</p>
                <h2 className="mt-1 font-serif text-3xl leading-none tracking-[-.03em] text-[hsl(var(--primary))]">{t('news')}</h2>
              </div>
            </div>
            {announcementsQuery.isLoading && <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">{t('newsLoading')}</p>}
            {announcementsQuery.isError && <p className="mt-6 rounded-xl bg-[hsl(var(--destructive)/.06)] p-4 text-sm font-semibold text-[hsl(var(--destructive))]">{t('newsError')}</p>}
            {!announcementsQuery.isLoading && !announcementsQuery.isError && !announcementsQuery.data?.length && <p className="mt-6 rounded-2xl border border-dashed border-[hsl(var(--border))] p-7 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('newsEmpty')}</p>}
            {!announcementsQuery.isLoading && !announcementsQuery.isError && Boolean(announcementsQuery.data?.length) && <div className="mt-6 space-y-3">{announcementsQuery.data?.slice(0, 3).map((announcement) => <AnnouncementCard key={announcement.id} announcement={announcement} />)}</div>}
          </section>
        {statistics && <PublicStatistics statistics={statistics} />}
        <SiteFooter className="mt-auto pt-8" />
      </div>
    </main>
  );
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  return (
    <article className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-xs)]" data-testid={`home-announcement-${announcement.id}`}>
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-serif text-2xl leading-tight text-[hsl(var(--primary))]">{announcement.title}</h3>
        <span className="shrink-0 rounded-full bg-[hsl(var(--muted))] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">{announcement.date}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[hsl(var(--muted-foreground))]">{announcement.body}</p>
    </article>
  );
}

function ArticlesPage() {
  const { t, locale, dir } = useI18n();
  const articlesQuery = useGetArticles({ query: { queryKey: getGetArticlesQueryKey() } });
  const { user, isLoaded } = useUser();
  const articles = articlesQuery.data ?? [];

  return (
    <main dir={dir} className={`grain min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-7 md:px-10${locale === 'ar' ? ' font-ar' : ''}`}>
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <BrandMark />
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <HomeLink />
            {isLoaded && (user ? (
              <Link href={isTeacherAccount(user) ? '/admin' : '/user-portal'} className="focus-ring inline-flex items-center rounded-xl bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="link-articles-portal">{t('panelBack')}</Link>
            ) : (
              <>
                <Link href="/sign-in" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))]" data-testid="link-articles-sign-in"><LogIn size={15} /> {t('signIn')}</Link>
                <Link href="/sign-up" className="focus-ring hidden rounded-xl bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] sm:inline-flex">{t('apply')}</Link>
              </>
            ))}
          </div>
        </div>
        <section className="mt-12 max-w-3xl" data-testid="page-articles">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]"><BookOpenText size={15} /> {t('academy')}</p>
          <h1 className="mt-3 font-serif text-5xl leading-none tracking-[-.04em] text-[hsl(var(--primary))] md:text-6xl">{t('articles')}</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">{t('articlesIntro')}</p>
          {articlesQuery.isLoading && <p className="mt-10 text-sm text-[hsl(var(--muted-foreground))]">{t('articlesLoading')}</p>}
          {articlesQuery.isError && <p className="mt-10 rounded-xl bg-[hsl(var(--destructive)/.06)] p-4 text-sm font-semibold text-[hsl(var(--destructive))]">{t('articlesError')}</p>}
          {!articlesQuery.isLoading && !articlesQuery.isError && !articles.length && <p className="mt-10 rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('articlesEmpty')}</p>}
          {!articlesQuery.isLoading && !articlesQuery.isError && articles.length > 0 && <div className="mt-9 space-y-4">{articles.map((article) => <ArticleCard key={article.id} article={article} />)}</div>}
        </section>
        <SiteFooter />
      </div>
    </main>
  );
}

function PublicArticlesPage() {
  const { t, locale, dir } = useI18n();
  const articlesQuery = useGetArticles({ query: { queryKey: getGetArticlesQueryKey() } });
  const articles = articlesQuery.data ?? [];

  return (
    <main dir={dir} className={`grain min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-7 md:px-10${locale === 'ar' ? ' font-ar' : ''}`}>
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <BrandMark />
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <HomeLink />
            <Link href="/sign-in" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))]">
              <LogIn size={15} /> {t('signIn')}
            </Link>
            <Link href="/sign-up" className="focus-ring hidden rounded-xl bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] sm:inline-flex">
              {t('apply')}
            </Link>
          </div>
        </div>
        <section className="mt-12 max-w-3xl" data-testid="page-articles">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]"><BookOpenText size={15} /> {t('academy')}</p>
          <h1 className="mt-3 font-serif text-5xl leading-none tracking-[-.04em] text-[hsl(var(--primary))] md:text-6xl">{t('articles')}</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">{t('articlesIntro')}</p>
          {articlesQuery.isLoading && <p className="mt-10 text-sm text-[hsl(var(--muted-foreground))]">{t('articlesLoading')}</p>}
          {articlesQuery.isError && <p className="mt-10 rounded-xl bg-[hsl(var(--destructive)/.06)] p-4 text-sm font-semibold text-[hsl(var(--destructive))]">{t('articlesError')}</p>}
          {!articlesQuery.isLoading && !articlesQuery.isError && !articles.length && <p className="mt-10 rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('articlesEmpty')}</p>}
          {!articlesQuery.isLoading && !articlesQuery.isError && articles.length > 0 && <div className="mt-9 space-y-4">{articles.map((article) => <ArticleCard key={article.id} article={article} />)}</div>}
        </section>
        <SiteFooter />
      </div>
    </main>
  );
}

function DailyBenefitCard({ benefit, isLoading, hasError }: { benefit?: DailyBenefit; isLoading: boolean; hasError: boolean }) {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[hsl(37_70%_42%/.18)] bg-[hsl(var(--accent))] px-5 py-4 text-[hsl(var(--primary))] shadow-[var(--shadow-xs)] sm:px-6" data-testid="section-daily-benefit">
      <Quote className="pointer-events-none absolute -right-1 -top-2 h-16 w-16 rotate-12 text-[hsl(var(--primary)/.08)]" strokeWidth={1.25} />
      <div className="relative">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--primary)/.72)]"><Quote size={13} /> {t('dailyBenefit')}</div>
        {isLoading && <p className="mt-3 text-sm font-semibold text-[hsl(var(--primary)/.65)]">{t('loading')}</p>}
        {hasError && <p className="mt-3 text-sm font-semibold text-[hsl(var(--primary)/.65)]">{t('dailyBenefitError')}</p>}
        {!isLoading && !hasError && benefit && (
          <>
            <blockquote className="mt-2.5 font-serif text-lg leading-snug tracking-[-.02em] sm:text-xl">“{benefit.body}”</blockquote>
            <p className="mt-3 text-xs font-bold text-[hsl(var(--primary)/.7)]">— {benefit.source}</p>
          </>
        )}
        {!isLoading && !hasError && !benefit && <p className="mt-3 text-sm font-semibold text-[hsl(var(--primary)/.65)]">{t('dailyBenefitEmpty')}</p>}
      </div>
    </section>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const { locale } = useI18n();
  return (
    <details className="group rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.32)] p-4 open:bg-[hsl(var(--muted)/.55)]" data-testid={`article-${article.id}`}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-base font-bold text-[hsl(var(--primary))]">{article.title}</span>
          <span className="mt-1 block text-sm leading-5 text-[hsl(var(--muted-foreground))]">{article.excerpt}</span>
          <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--secondary-foreground))]"><UserRound size={12} /> {formatPersonName(article.author)} <CalendarDays size={12} /> {new Date(article.createdAt).toLocaleDateString(locale === 'ar' ? 'ar' : 'az-AZ')}</span>
        </span>
        <ChevronDown className="mt-1 shrink-0 text-[hsl(var(--secondary-foreground))] transition group-open:rotate-180" size={19} />
      </summary>
      <div className="mt-4 border-t border-[hsl(var(--border))] pt-4 text-sm leading-7 text-[hsl(var(--foreground)/.82)] whitespace-pre-wrap">{article.body}</div>
    </details>
  );
}

function SignInForm() {
  const { t, locale, dir } = useI18n();
  const { signIn } = useModernSignIn();
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState<'credentials' | 'device-trust'>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [trustCode, setTrustCode] = useState('');
  const [notice, setNotice] = useState('');
  const [isNoticeError, setIsNoticeError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const finalizeSignIn = async () => {
    await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          setIsNoticeError(false);
          setNotice(t('extraConfirm'));
          return;
        }
        const destination = decorateUrl('/user-portal');
        if (destination.startsWith('http')) {
          window.location.assign(destination);
          return;
        }
        setLocation(stripBase(destination));
      },
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice('');
    setIsNoticeError(false);
    try {
      let emailAddress = identifier.trim();
      if (/^T?\d+$/i.test(emailAddress)) {
        const resolveResponse = await fetch(apiUrl('/auth/resolve-student-number'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: emailAddress, password }),
        });
        const resolved = await resolveResponse.json().catch(() => ({})) as { email?: string; error?: string };
        if (!resolveResponse.ok || !resolved.email) {
          setIsNoticeError(true);
          setNotice(resolveResponse.status === 429 && resolved.error ? resolved.error : t('badCredentials'));
          return;
        }
        emailAddress = resolved.email;
      }
      const { error } = await signIn.password({
        emailAddress,
        password,
      });
      if (error) {
        setIsNoticeError(true);
        setNotice(t('badCredentials'));
        return;
      }
      if (signIn.status === 'needs_client_trust') {
        const emailCodeFactor = signIn.supportedSecondFactors.find((factor) => factor.strategy === 'email_code');
        if (!emailCodeFactor) {
          setIsNoticeError(true);
          setNotice(t('deviceMethodMissing'));
          return;
        }
        await signIn.mfa.sendEmailCode();
        setStage('device-trust');
        setNotice(t('codeSent'));
        return;
      }
      if (signIn.status !== 'complete') {
        setIsNoticeError(true);
        setNotice(t('signInFailed'));
        return;
      }
      await finalizeSignIn();
    } catch {
      setIsNoticeError(true);
      setNotice(t('badCredentials'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyDeviceTrust = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice('');
    setIsNoticeError(false);
    try {
      const { error } = await signIn.mfa.verifyEmailCode({ code: trustCode.trim() });
      if (error || signIn.status !== 'complete') {
        setIsNoticeError(true);
        setNotice(t('badCode'));
        return;
      }
      await finalizeSignIn();
    } catch {
      setIsNoticeError(true);
      setNotice(t('badCode'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendDeviceTrustCode = async () => {
    setIsSubmitting(true);
    setNotice('');
    setIsNoticeError(false);
    try {
      await signIn.mfa.sendEmailCode();
      setNotice(t('codeResent'));
    } catch {
      setIsNoticeError(true);
      setNotice(t('resendFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const startOver = async () => {
    await signIn.reset();
    setStage('credentials');
    setTrustCode('');
    setNotice('');
    setIsNoticeError(false);
  };

  return (
    <main dir={dir} className={`grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5 py-7 md:px-10${locale === 'ar' ? ' font-ar' : ''}`}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between gap-4"><BrandMark /><div className="flex items-center gap-2"><LanguageSwitch /><HomeLink /></div></div>
        <section className="mt-10 rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)] md:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/.35)] text-[hsl(var(--primary))]"><KeyRound size={21} /></div>
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">{stage === 'device-trust' ? t('deviceTrust') : t('studentCabinet')}</p>
          {stage === 'device-trust' && (
            <>
              <h1 className="mt-2 font-serif text-4xl leading-none text-[hsl(var(--primary))]">{t('emailCodeTitle')}</h1>
              <p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('emailCodeHint')}</p>
            </>
          )}
          {stage === 'credentials' ? (
            <form className="mt-7 space-y-5" onSubmit={submit} data-testid="form-sign-in">
              <label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">{t('emailOrNumber')}</span><input required type="text" inputMode="email" autoComplete="username" placeholder={t('emailPlaceholder')} value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm text-[hsl(var(--foreground))] outline-none transition" data-testid="input-sign-in-identifier" /></label>
              <label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">{t('password')}</span><input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm text-[hsl(var(--foreground))] outline-none transition" data-testid="input-sign-in-password" /></label>
              <div className="-mt-2 text-end"><Link href="/forgot-password" className="focus-ring text-xs font-bold text-[hsl(var(--secondary-foreground))] hover:underline" data-testid="link-forgot-password">{t('forgotPassword')}</Link></div>
              <button type="submit" disabled={isSubmitting} className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-sign-in">{isSubmitting ? <LoaderCircle className="animate-spin" size={17} /> : <LogIn size={17} />}{isSubmitting ? t('signingIn') : t('signInAction')}</button>
            </form>
          ) : (
            <form className="mt-7 space-y-5" onSubmit={verifyDeviceTrust} data-testid="form-device-trust">
              <label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">{t('securityCode')}</span><input required autoComplete="one-time-code" inputMode="numeric" value={trustCode} onChange={(event) => setTrustCode(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm text-[hsl(var(--foreground))] outline-none transition" data-testid="input-device-trust-code" /></label>
              <button type="submit" disabled={isSubmitting} className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-verify-device-trust">{isSubmitting ? <LoaderCircle className="animate-spin" size={17} /> : <KeyRound size={17} />}{isSubmitting ? t('checking') : t('confirmCode')}</button>
              <div className="flex items-center justify-between gap-3 text-xs"><button type="button" onClick={() => void startOver()} className="focus-ring font-bold text-[hsl(var(--secondary-foreground))] hover:underline">{t('back')}</button><button type="button" onClick={() => void resendDeviceTrustCode()} disabled={isSubmitting} className="focus-ring font-bold text-[hsl(var(--secondary-foreground))] hover:underline disabled:opacity-50" data-testid="button-resend-device-trust">{t('resendCode')}</button></div>
            </form>
          )}
          {notice && <p className={`mt-4 rounded-xl px-3.5 py-3 text-sm font-semibold ${isNoticeError ? 'bg-[hsl(var(--destructive)/.08)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--secondary)/.45)] text-[hsl(var(--secondary-foreground))]'}`} role={isNoticeError ? 'alert' : 'status'} data-testid="text-sign-in-notice">{notice}</p>}
          {stage === 'credentials' && <p className="mt-6 border-t border-[hsl(var(--border))] pt-5 text-center text-xs text-[hsl(var(--muted-foreground))]">{t('noAccount')} <Link href="/sign-up" className="font-bold text-[hsl(var(--secondary-foreground))]">{t('applyLink')}</Link></p>}
        </section>
        <SiteFooter />
      </div>
    </main>
  );
}

function PasswordResetForm() {
  const { t, locale, dir } = useI18n();
  const { signIn, isLoaded, setActive } = useLegacySignIn();
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState<'email' | 'code' | 'password' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sendReset = async (event: FormEvent) => {
    event.preventDefault();
    if (!isLoaded || !signIn) return;
    setIsSubmitting(true);
    setNotice('');
    setIsError(false);
    try {
      const started = await signIn.create({ identifier: email });
      const resetFactor = started.supportedFirstFactors?.find((factor) => factor.strategy === 'reset_password_email_code');
      if (!resetFactor || !('emailAddressId' in resetFactor)) throw new Error();
      await signIn.prepareFirstFactor({ strategy: 'reset_password_email_code', emailAddressId: resetFactor.emailAddressId });
      setStage('code');
      setNotice(t('resetSent'));
    } catch {
      setNotice(t('resetSent'));
      setStage('code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!signIn) return;
    setIsSubmitting(true);
    setNotice('');
    setIsError(false);
    try {
      const result = await signIn.attemptFirstFactor({ strategy: 'reset_password_email_code', code });
      if (result.status !== 'needs_new_password') throw new Error();
      setStage('password');
    } catch {
      setIsError(true);
      setNotice(t('badCode'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!signIn) return;
    setIsSubmitting(true);
    setNotice('');
    setIsError(false);
    try {
      const result = await signIn.resetPassword({ password });
      if (result.status !== 'complete') throw new Error();
      if (result.createdSessionId && setActive) await setActive({ session: result.createdSessionId });
      setStage('success');
      setNotice(t('passwordUpdatedNotice'));
    } catch {
      setIsError(true);
      setNotice(t('passwordUpdateFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main dir={dir} className={`grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5 py-7 md:px-10${locale === 'ar' ? ' font-ar' : ''}`}>
      <div className="w-full max-w-md"><div className="flex items-center justify-between gap-4"><BrandMark /><div className="flex items-center gap-2"><LanguageSwitch /><HomeLink /></div></div>
        <section className="mt-10 rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)] md:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/.35)] text-[hsl(var(--primary))]"><KeyRound size={21} /></div>
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">{t('accountRecovery')}</p>
          <h1 className="mt-2 font-serif text-4xl leading-none text-[hsl(var(--primary))]">{stage === 'password' ? t('chooseNewPassword') : stage === 'success' ? t('passwordUpdatedTitle') : t('recoverTitle')}</h1>
          {stage === 'email' && <><p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('resetHint')}</p><form className="mt-7 space-y-5" onSubmit={sendReset}><label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">{t('email')}</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm outline-none" data-testid="input-reset-email" /></label><button type="submit" disabled={!isLoaded || isSubmitting} className="focus-ring w-full rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" data-testid="button-send-reset">{isSubmitting ? t('sending') : t('sendResetCode')}</button></form></>}
          {stage === 'code' && <><p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('codeHint')}</p><form className="mt-7 space-y-5" onSubmit={verifyCode}><label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">{t('resetCode')}</span><input required autoComplete="one-time-code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm outline-none" data-testid="input-reset-code" /></label><button type="submit" disabled={isSubmitting} className="focus-ring w-full rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" data-testid="button-verify-reset-code">{isSubmitting ? t('checking') : t('confirmCode')}</button></form></>}
          {stage === 'password' && <><p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{t('newPasswordHint')}</p><form className="mt-7 space-y-5" onSubmit={resetPassword}><label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">{t('newPassword')}</span><input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm outline-none" data-testid="input-reset-password" /></label><button type="submit" disabled={isSubmitting} className="focus-ring w-full rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" data-testid="button-complete-reset">{isSubmitting ? t('updating') : t('updatePassword')}</button></form></>}
          {stage === 'success' && <button type="button" onClick={() => setLocation('/user-portal')} className="focus-ring mt-7 w-full rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))]" data-testid="button-reset-continue">{t('goToCabinet')}</button>}
          {notice && <p className={`mt-4 rounded-xl px-3.5 py-3 text-sm font-semibold ${isError ? 'bg-[hsl(var(--destructive)/.08)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--secondary)/.45)] text-[hsl(var(--secondary-foreground))]'}`} role="status">{notice}</p>}
          {stage !== 'success' && <p className="mt-6 border-t border-[hsl(var(--border))] pt-5 text-center text-xs text-[hsl(var(--muted-foreground))]">{t('remembered')} <Link href="/sign-in" className="font-bold text-[hsl(var(--secondary-foreground))]">{t('signInLink')}</Link></p>}
        </section>
        <SiteFooter />
      </div>
    </main>
  );
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <HomePage />;
  return isSignedIn ? <SignedInLanding /> : <HomePage />;
}

function ApplicationRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <ApplicationForm brand={<BrandMark />} />;
  return isSignedIn ? <SignedInLanding /> : <ApplicationForm brand={<BrandMark />} />;
}

function SignedInLanding() {
  const { user, isLoaded } = useUser();
  const likelyStaff = isTeacherAccount(user);
  const accountProfileQuery = useGetOwnUserProfile({ query: { enabled: isLoaded && Boolean(user) && !likelyStaff, queryKey: getGetOwnUserProfileQueryKey(), ...accountProfileQueryRetry } });
  if (!isLoaded || accountProfileQuery.isLoading) return <AccountGateLoading />;
  if (likelyStaff) return <Redirect to="/admin" />;
  if (accountProfileQuery.isError) return <AccountGateError onRetry={() => void accountProfileQuery.refetch()} />;
  const isStaff = accountProfileQuery.data ? isStaffRole(accountProfileQuery.data.role) : isTeacherAccount(user);
  return <Redirect to={isStaff ? '/admin' : '/user-portal'} />;
}

function AdminRoute() {
  const { user, isLoaded } = useUser();
  const likelyStaff = isTeacherAccount(user);
  const accountProfileQuery = useGetOwnUserProfile({ query: { enabled: isLoaded && Boolean(user) && !likelyStaff, queryKey: getGetOwnUserProfileQueryKey(), ...accountProfileQueryRetry } });
  if (!isLoaded || accountProfileQuery.isLoading) return <AccountGateLoading />;
  if (likelyStaff) return <AdminPanel />;
  if (accountProfileQuery.isError) return <AccountGateError onRetry={() => void accountProfileQuery.refetch()} />;
  const isStaff = accountProfileQuery.data ? isStaffRole(accountProfileQuery.data.role) : isTeacherAccount(user);
  return isStaff ? <AdminPanel /> : <Redirect to="/user-portal" />;
}

// Mədinə AI ayrıca səhifədir (/ai). Rejim rola görə seçilir:
// - heyət (owner və ya «students» icazəsi olan) → admin rejimi, geri düyməsi /admin-ə;
// - təsdiqlənmiş tələbə → tələbə rejimi, geri düyməsi /user-portal-a.
// Server tərəfində eyni yoxlamalar yenidən aparılır (requireAiStaff / requireApprovedStudent).
function MedineAiRoute() {
  const { t } = useI18n();
  const { user, isLoaded } = useUser();
  const signedIn = isLoaded && Boolean(user);
  const accountProfileQuery = useGetOwnUserProfile({ query: { enabled: signedIn, queryKey: getGetOwnUserProfileQueryKey(), ...accountProfileQueryRetry, staleTime: 60_000 } });
  const profile = accountProfileQuery.data;
  const isStaff = isStaffRole(profile?.role) || (!profile && isTeacherAccount(user));
  const scheduleAccessQuery = useGetStudentScheduleAccess({
    query: { enabled: signedIn && !isStaff && Boolean(profile), queryKey: getGetStudentScheduleAccessQueryKey(), staleTime: 30_000, retry: false },
  });
  const profilePending = !profile && (accountProfileQuery.isLoading || accountProfileQuery.isFetching);
  if (!isLoaded || profilePending) return <AccountGateLoading />;
  if (accountProfileQuery.isError && !isStaff) return <AccountGateError onRetry={() => void accountProfileQuery.refetch()} />;

  if (isStaff) {
    if (!profile) return <AccountGateLoading />;
    // Bütün heyət üzvləri admin rejiminə girə bilər: «Xarici» (Şamilə/Dorar) hamıya açıqdır,
    // «Daxili» (LMS məlumatları) üçün isə «students» icazəsini server ayrıca yoxlayır.
    const ownerEmail = import.meta.env.VITE_SYSTEM_OWNER_EMAIL?.trim().toLowerCase();
    const userEmail = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
    const canReadLms = profile.role === 'owner' || isOwnerMetadata(user) || Boolean(ownerEmail && userEmail === ownerEmail)
      || (profile.rolePermissions ?? []).includes('students');
    return <AiAssistantPage mode="admin" backHref="/admin" backLabel={t('backAdmin')} canReadLms={canReadLms} />;
  }

  const accessPending = !scheduleAccessQuery.data && (scheduleAccessQuery.isLoading || scheduleAccessQuery.isFetching);
  if (accessPending) return <AccountGateLoading />;
  if (scheduleAccessQuery.data?.onboardingRequired && !scheduleAccessQuery.data.approved) return <Redirect to="/admission-exam" />;
  if (scheduleAccessQuery.isError || !scheduleAccessQuery.data) return <Redirect to="/user-portal" />;
  return <AiAssistantPage mode="student" backHref="/user-portal" backLabel={t('backHome')} />;
}

// Kitab oxuyucusu (/kitabxana/:slug). Giriş icazəsini server yoxlayır (təsdiqlənmiş tələbə və ya heyət);
// burada yalnız «geri» düyməsinin hara aparacağı rola görə seçilir.
function LibraryReaderRoute({ slug }: { slug: string }) {
  const { user, isLoaded } = useUser();
  const signedIn = isLoaded && Boolean(user);
  const accountProfileQuery = useGetOwnUserProfile({ query: { enabled: signedIn, queryKey: getGetOwnUserProfileQueryKey(), ...accountProfileQueryRetry, staleTime: 60_000 } });
  const isStaff = isStaffRole(accountProfileQuery.data?.role) || (!accountProfileQuery.data && isTeacherAccount(user));
  if (!isLoaded) return <AccountGateLoading />;
  return <LibraryReader slug={slug} backHref={isStaff ? '/admin' : '/user-portal'} />;
}

function isOwnerMetadata(user: { publicMetadata?: unknown } | null | undefined) {
  const metadata = user?.publicMetadata;
  return typeof metadata === 'object' && metadata !== null && 'role' in metadata && (metadata as { role?: unknown }).role === 'owner';
}

function AccountGateLoading() {
  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5">
      <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-4 text-sm font-semibold text-[hsl(var(--primary))] shadow-[var(--shadow-xs)]">
        <LoaderCircle size={18} className="animate-spin text-[hsl(var(--accent))]" />
        Hesab məlumatları yüklənir...
      </div>
    </main>
  );
}

function AccountGateError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5">
      <section className="w-full max-w-md rounded-2xl border border-[hsl(var(--destructive)/.22)] bg-[hsl(var(--card))] p-6 text-center shadow-[var(--shadow-xs)]">
        <h1 className="font-serif text-2xl text-[hsl(var(--primary))]">Hesab məlumatı yüklənmədi</h1>
        <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">İdarə panelini açmaq üçün sessiya məlumatını yenidən yoxlamaq lazımdır.</p>
        <button type="button" onClick={onRetry} className="mt-5 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))]">Yenidən yoxla</button>
      </section>
    </main>
  );
}

/**
 * Attach a fresh Clerk session token to every generated API request (and to
 * hand-written ones that use authFetch). See lib/clerk-token.ts for why the
 * first token of a page load is force-refreshed.
 */
function ClerkApiAuthBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  // Register synchronously during render so queries enabled in this same
  // render pass already see the signed-in state when their effects fire.
  registerClerkTokenSource(isLoaded && isSignedIn ? (options) => getToken(options) : null, Boolean(isLoaded && isSignedIn));
  useState(() => {
    setAuthTokenGetter((options) => getFreshClerkToken(options));
    return null;
  });
  useEffect(() => () => { setAuthTokenGetter(null); registerClerkTokenSource(null, false); }, []);
  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const { user } = useUser();
  const currentQueryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) currentQueryClient.clear();
    previousUserId.current = userId;
  }), [addListener, currentQueryClient]);
  useEffect(() => {
    if (!user) return;
    const refreshUser = () => { void user.reload(); };
    window.addEventListener('focus', refreshUser);
    document.addEventListener('visibilitychange', refreshUser);
    return () => {
      window.removeEventListener('focus', refreshUser);
      document.removeEventListener('visibilitychange', refreshUser);
    };
  }, [user]);
  return null;
}

function TermsPage() {
  const { t, locale, dir } = useI18n();
  return (
    <main dir={dir} className={`grain min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-7 md:px-10${locale === 'ar' ? ' font-ar' : ''}`}>
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4"><BrandMark /><div className="flex items-center gap-2"><LanguageSwitch /><HomeLink /></div></div>
        <article className="mt-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-xs)] md:p-6" data-testid="page-terms">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">{t('academy')}</p>
          <h1 className="mt-2 font-serif text-3xl leading-tight text-[hsl(var(--primary))]">{t('termsTitle')}</h1>
          <div className="mt-5 space-y-4 text-sm leading-6 text-[hsl(var(--foreground)/.86)]">
            <p>{t('termsIntro')}</p>
            <section>
              <h2 className="text-sm font-bold text-[hsl(var(--primary))]">{t('termsSerious')}</h2>
              <p className="mt-1 text-[hsl(var(--muted-foreground))]">{t('termsSeriousBody')}</p>
            </section>
            <section>
              <h2 className="text-sm font-bold text-[hsl(var(--primary))]">{t('termsData')}</h2>
              <p className="mt-1 text-[hsl(var(--muted-foreground))]">{t('termsDataBody')}</p>
            </section>
            <section>
              <h2 className="text-sm font-bold text-[hsl(var(--primary))]">{t('termsPrivacy')}</h2>
              <p className="mt-1 text-[hsl(var(--muted-foreground))]">{t('termsPrivacyBody')}</p>
            </section>
          </div>
        </article>
        <SiteFooter />
      </div>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/articles" component={ArticlesPage} />
        <Route path="/istifade-sertleri" component={TermsPage} />
        <Route path="/forgot-password"><Show when="signed-in"><SignedInLanding /></Show><Show when="signed-out"><PasswordResetForm /></Show></Route>
        <Route path="/sign-in/*?"><Show when="signed-in"><SignedInLanding /></Show><Show when="signed-out"><SignInForm /></Show></Route>
        <Route path="/sign-up/*?" component={ApplicationRoute} />
        <Route path="/verify/certificate/:token">{(params) => <CertificateVerificationPage token={params.token} />}</Route>
        <Route path="/admission-exam"><Show when="signed-in"><AdmissionExamPortal /></Show><Show when="signed-out"><Redirect to="/" /></Show></Route>
        <Route path="/user-portal"><Show when="signed-in"><UserPortal /></Show><Show when="signed-out"><Redirect to="/" /></Show></Route>
        <Route path="/admin"><Show when="signed-in"><AdminRoute /></Show><Show when="signed-out"><Redirect to="/" /></Show></Route>
        <Route path="/ai"><Show when="signed-in"><MedineAiRoute /></Show><Show when="signed-out"><Redirect to="/" /></Show></Route>
        <Route path="/admin/ai"><Redirect to="/ai" /></Route>
        <Route path="/kitabxana/:slug">{(params) => <><Show when="signed-in"><LibraryReaderRoute slug={params.slug} /></Show><Show when="signed-out"><Redirect to="/" /></Show></>}</Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkApiAuthBridge />
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider><Router /><Toaster /></TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function MissingClerkConfiguration() {
  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5">
      <section className="w-full max-w-lg rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 text-center shadow-[var(--shadow-sm)]">
        <BrandMark />
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--destructive))]">Deployment ayarı çatışmır</p>
        <h1 className="mt-3 font-serif text-3xl text-[hsl(var(--primary))]">Giriş xidməti sazlanmayıb</h1>
        <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
          Vercel layihəsinin Environment Variables bölməsinə <strong>VITE_CLERK_PUBLISHABLE_KEY</strong> əlavə edin və yenidən deploy edin.
        </p>
      </section>
    </main>
  );
}

function PublicFallbackRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={basePath}>
        <RoutedErrorBoundary>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/articles" component={PublicArticlesPage} />
            <Route path="/istifade-sertleri" component={TermsPage} />
            <Route component={MissingClerkConfiguration} />
          </Switch>
        </RoutedErrorBoundary>
      </WouterRouter>
    </QueryClientProvider>
  );
}

function App() {
  if (!clerkPubKey) return <PublicFallbackRoutes />;
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;