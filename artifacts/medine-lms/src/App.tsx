import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  getGetAnnouncementsQueryKey,
  getGetArticlesQueryKey,
  getGetDailyBenefitQueryKey,
  getGetCoursesQueryKey,
  getGetDashboardQueryKey,
  getGetStudentAcademicProfileQueryKey,
  getGetStudentScheduleAccessQueryKey,
  getGetStudentDeletionNoticeQueryKey,
  getGetOwnUserProfileQueryKey,
  useGetAnnouncements,
  useGetArticles,
  useGetCourses,
  useGetDailyBenefit,
  useGetDashboard,
  useGetStudentAcademicProfile,
  useGetStudentScheduleAccess,
  useGetStudentDeletionNotice,
  useGetOwnUserProfile,
} from '@workspace/api-client-react';
import { ClerkProvider, Show, useAuth, useClerk, useSignIn as useModernSignIn, useUser } from '@clerk/react';
import { useSignIn as useLegacySignIn } from '@clerk/react/legacy';
import { BookOpenText, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, KeyRound, LoaderCircle, LogIn, Megaphone, Quote, RefreshCw, UserRound } from 'lucide-react';
import type { Announcement, Article, DailyBenefit } from '@workspace/api-client-react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { ErrorBoundary } from '@/components/error-boundary';
import { ApplicationForm } from '@/components/application-form';
import { StudentDashboard } from '@/components/student-dashboard';
import { StudentExamsSection } from '@/components/exam-module';
import { AdminPanel } from '@/components/admin-panel';
import { CertificateVerificationPage } from '@/components/graduate-certificate';
import { Toaster } from '@/components/ui/toaster';
import { HomeLink } from '@/components/home-link';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Route, Redirect, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { formatPersonName } from '@/lib/utils';

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
  const accountProfileQuery = useGetOwnUserProfile({ query: { enabled: isLoaded && Boolean(user), queryKey: getGetOwnUserProfileQueryKey() } });
  const isStaff = isStaffRole(accountProfileQuery.data?.role) || (!accountProfileQuery.data && isTeacherAccount(user));
  const scheduleAccessQuery = useGetStudentScheduleAccess({
    query: {
      enabled: isLoaded && Boolean(user) && !accountProfileQuery.isLoading && !isStaff,
      queryKey: getGetStudentScheduleAccessQueryKey(),
      staleTime: 0,
      refetchOnMount: 'always',
    },
  });
  if (!isLoaded || accountProfileQuery.isLoading || accountProfileQuery.isFetching || (!isStaff && (scheduleAccessQuery.isLoading || scheduleAccessQuery.isFetching))) return <AccountGateLoading />;
  if (accountProfileQuery.isError && !isStaff) return <AccountGateError onRetry={() => void accountProfileQuery.refetch()} />;
  if (isStaff) return <Redirect to="/admin" />;
  if (scheduleAccessQuery.data?.onboardingRequired && !scheduleAccessQuery.data.approved) return <Redirect to="/admission-exam" />;
  return <StudentPortal />;
}

function AdmissionExamPortal() {
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
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--destructive))]">Qəbul mərhələsi</p>
          <h1 className="mt-3 font-serif text-3xl text-[hsl(var(--primary))]">İmtahan məlumatı yüklənmədi</h1>
          <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Qəbul testinə keçmək üçün məlumatları yenidən yoxlayın.</p>
          <button type="button" onClick={() => { void scheduleAccessQuery.refetch(); void academicProfileQuery.refetch(); }} className="focus-ring mt-6 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]"><RefreshCw size={15} /> Yenidən yoxla</button>
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
            <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Mədinə Tədris Akademiyası</p><p className="font-serif text-lg text-[hsl(var(--primary))]">Qəbul mərhələsi</p></div>
          </div>
          <button type="button" onClick={() => void signOut({ redirectUrl: basePath || '/' })} className="focus-ring rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))]">Çıxış et</button>
        </header>
        <section className="mt-8 rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)] md:p-9" data-testid="admission-exam-gate">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/.35)] text-[hsl(var(--secondary-foreground))]"><ClipboardList size={22} /></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">Son qəbul addımı</p><h1 className="mt-2 font-serif text-3xl leading-tight text-[hsl(var(--primary))]">Qəbul imtahanınızı tamamlayın</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Müraciətiniz qəbul edilib. Tələbə ana səhifəsi və dərslər yalnız qəbul testini verdikdən və müəllim təsdiqindən sonra açılacaq.</p></div>
          </div>
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-[hsl(var(--secondary)/.4)] px-4 py-3 text-xs font-semibold text-[hsl(var(--secondary-foreground))]"><CheckCircle2 size={16} /> İmtahan cavablarından sonra müəllim yoxlaması gözlənilir.</div>
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
              <h2 className="mt-3 font-serif text-2xl text-[hsl(var(--primary))]">Qəbul testi hazırlanır</h2>
              <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Test hazır olduqda bu səhifədə görünəcək. Bu müddətdə tələbə ana səhifəsinə giriş açılmır.</p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function StudentPortal() {
  const dashboardQuery = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const coursesQuery = useGetCourses({ query: { queryKey: getGetCoursesQueryKey() } });
  const announcementsQuery = useGetAnnouncements({ query: { queryKey: getGetAnnouncementsQueryKey() } });
  const academicProfileQuery = useGetStudentAcademicProfile({ query: { queryKey: getGetStudentAcademicProfileQueryKey() } });
  const deletionNoticeQuery = useGetStudentDeletionNotice({ query: { queryKey: getGetStudentDeletionNoticeQueryKey() } });
  const { user } = useUser();
  const { signOut } = useClerk();
  const displayName = dashboardQuery.data?.studentName || user?.firstName || user?.primaryEmailAddress?.emailAddress;
  const accountError = dashboardQuery.error as { status?: number; data?: { error?: string } } | null;
  const isPendingAccount = accountError?.status === 403;
  const accountMessage = accountError?.data?.error ?? 'Müraciətiniz müəllim heyəti tərəfindən hələ təsdiqlənməyib. Təsdiq olunana qədər dərslərə və tələbə panelinə giriş mümkün deyil.';
  const isRejectedAccount = accountMessage.includes('imtina');

  if (deletionNoticeQuery.data) {
    const notice = deletionNoticeQuery.data;
    return (
      <main className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5 py-7">
        <section className="w-full max-w-lg rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 shadow-[var(--shadow-sm)] md:p-9" data-testid="student-deletion-notice">
          <HomeLink />
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--destructive))]">Hesab barədə bildiriş</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight text-[hsl(var(--primary))]">Hesabınız deaktiv edilib.</h1>
          <p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Akademiyanın qərarına əsasən hesabınıza və akademik məlumatlarınıza giriş bağlanıb.</p>
          <div className="mt-6 rounded-2xl bg-[hsl(var(--muted)/.45)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Silinmə səbəbi</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[hsl(var(--primary))]">{notice.reason}</p>
            <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Əməliyyatı edən: {notice.deletedByName} · {new Intl.DateTimeFormat('az-AZ', { dateStyle: 'medium' }).format(new Date(notice.deletedAt))}</p>
          </div>
          <button type="button" onClick={() => void signOut({ redirectUrl: basePath || '/' })} className="focus-ring mt-7 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">Çıxış et</button>
        </section>
      </main>
    );
  }

  if (isPendingAccount) {
    return (
      <main className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5 py-7">
        <section className="w-full max-w-lg rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 shadow-[var(--shadow-sm)] md:p-9">
          <HomeLink />
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">Mədinə Tədris Akademiyası</p>
           <h1 className="mt-4 font-serif text-4xl leading-none text-[hsl(var(--primary))]">{isRejectedAccount ? 'Müraciətinizə imtina verilib.' : 'Hesabınız gözləmədədir.'}</h1>
           <p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{accountMessage}</p>
          <button type="button" onClick={() => void signOut({ redirectUrl: basePath || '/' })} className="focus-ring mt-7 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">Çıxış et</button>
        </section>
      </main>
    );
  }

  return <StudentDashboard
    dashboard={displayName && dashboardQuery.data ? { ...dashboardQuery.data, studentName: displayName, greeting: `Xoş gəldin, ${displayName}` } : dashboardQuery.data}
    courses={coursesQuery.data}
    announcements={announcementsQuery.data}
    academicProfile={academicProfileQuery.data}
    isLoading={dashboardQuery.isLoading || coursesQuery.isLoading || announcementsQuery.isLoading || academicProfileQuery.isLoading}
    hasError={dashboardQuery.isError || coursesQuery.isError || announcementsQuery.isError || academicProfileQuery.isError}
    onRetry={() => { void dashboardQuery.refetch(); void coursesQuery.refetch(); void announcementsQuery.refetch(); void academicProfileQuery.refetch(); }}
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
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--primary)/.12)] bg-white px-2.5 py-2 shadow-[0_5px_18px_hsl(var(--primary)/.08)]" data-testid="brand-academy">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-[13px] bg-[hsl(var(--accent))] text-[hsl(var(--primary))] shadow-[0_5px_0_hsl(37_83%_52%)]">
        <span className="font-serif text-xl font-bold leading-none">M</span>
        <span className="absolute bottom-[7px] right-[7px] h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
      </div>
      <div>
        <p className="text-[12px] font-black uppercase tracking-[0.16em] text-black">Mədinə</p>
        <p className="font-serif text-[19px] font-black leading-none text-black">Tədris Akademiyası</p>
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
  const items = [
    { label: 'Müəllim', value: statistics.teachers, className: 'bg-sky-100 text-sky-900' },
    { label: 'Hazırkı tələbə', value: statistics.currentStudents, className: 'bg-emerald-100 text-emerald-900' },
    { label: 'Bitirmiş tələbə', value: statistics.graduatedStudents, className: 'bg-amber-100 text-amber-950' },
  ];
  return <section className="mt-10 rounded-[30px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-8 shadow-[var(--shadow-sm)] md:px-10" data-testid="section-public-statistics">
    <p className="text-center text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">Akademiyamız rəqəmlərlə</p>
    <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-6">
      {items.map((item) => <div key={item.label} className="flex flex-col items-center gap-2 text-center">
        <div className={`flex h-20 w-20 items-center justify-center rounded-full text-2xl font-black sm:h-28 sm:w-28 sm:text-4xl ${item.className}`}>{item.value}</div>
        <span className="text-xs font-bold text-[hsl(var(--primary))]">{item.label}</span>
      </div>)}
    </div>
  </section>;
}

function HomePage() {
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
    <main className="grain min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-7 md:px-10">
      <div className="mx-auto max-w-5xl">
         <div className="flex items-center justify-between gap-4"><BrandMark /><div className="flex items-center gap-2"><HomeLink /><Link href="/articles" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))]" data-testid="link-home-articles"><BookOpenText size={15} /> Məqalələr</Link><Link href="/sign-in" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))]" data-testid="link-home-sign-in"><LogIn size={15} /> Giriş</Link><Link href="/sign-up" className="focus-ring hidden rounded-xl bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] sm:inline-flex">Müraciət et</Link></div></div>
        <section className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-stretch">
           <div className="rounded-[30px] bg-[hsl(var(--primary))] p-7 text-[hsl(var(--primary-foreground))] shadow-[0_24px_60px_hsl(203_55%_18%/.16)] sm:p-8 md:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--accent))]">Mədinə Tədris Akademiyası</p>
            <h1 className="mt-6 max-w-lg font-serif text-4xl leading-[1.02] tracking-[-.04em] sm:text-5xl md:text-6xl">Bu elm sizin dininizdir; dininizi kimdən öyrəndiyinizə diqqət edin.</h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-[hsl(var(--primary-foreground)/.72)]">— İbn Sirin</p>
             <div className="mt-9 flex flex-wrap items-center gap-3">
               <Link href="/sign-in" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--primary-foreground)/.28)] bg-[hsl(var(--primary-foreground)/.08)] px-5 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 hover:bg-[hsl(var(--primary-foreground)/.14)]" data-testid="link-home-app-entry">
                 <LogIn size={16} /> Tətbiqə giriş
               </Link>
               <Link href="/sign-up" className="focus-ring inline-flex items-center rounded-xl bg-[hsl(var(--accent))] px-5 py-3.5 text-sm font-bold text-[hsl(var(--primary))] transition hover:-translate-y-0.5" data-testid="link-home-application">Müraciət et</Link>
             </div>
          </div>
          <div className="rounded-[30px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-[var(--shadow-sm)] md:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">Tədris istiqamətləri</p>
            <div className="mt-7 grid gap-3">{['Quran', 'Hədis', 'Əqidə', 'Fiqh', 'Ərəb dili'].map((course) => <div key={course} className="rounded-xl bg-[hsl(var(--muted)/.55)] px-4 py-3 text-sm font-semibold text-[hsl(var(--primary))]">{course}</div>)}</div>
            <p className="mt-8 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Müraciətinizi göndərin, müəllim heyətimiz məlumatlarınızı nəzərdən keçirsin.</p>
          </div>
        </section>
         <section className="mt-8 max-w-3xl">
           <DailyBenefitCard benefit={dailyBenefitQuery.data} isLoading={dailyBenefitQuery.isLoading} hasError={dailyBenefitQuery.isError} />
         </section>
         <section className="mt-10 max-w-3xl" data-testid="section-articles">
           <div className="flex items-end justify-between gap-4">
             <div>
               <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]"><BookOpenText size={15} /> Akademiyadan</p>
               <h2 className="mt-2 font-serif text-4xl leading-none tracking-[-.04em] text-[hsl(var(--primary))]">Məqalələr</h2>
             </div>
             <Link href="/articles" className="focus-ring shrink-0 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))]" data-testid="link-home-articles-more">Hamısına bax</Link>
           </div>
           {articlesQuery.isLoading && <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">Məqalələr yüklənir...</p>}
           {articlesQuery.isError && <p className="mt-6 rounded-xl bg-[hsl(var(--destructive)/.06)] p-4 text-sm font-semibold text-[hsl(var(--destructive))]">Məqalələr hazırda yüklənmədi.</p>}
           {!articlesQuery.isLoading && !articlesQuery.isError && !articlesQuery.data?.length && <p className="mt-6 rounded-2xl border border-dashed border-[hsl(var(--border))] p-7 text-center text-sm text-[hsl(var(--muted-foreground))]">Hələ məqalə yayımlanmayıb.</p>}
           {!articlesQuery.isLoading && !articlesQuery.isError && Boolean(articlesQuery.data?.length) && <div className="mt-6 space-y-3">{articlesQuery.data?.slice(0, 3).map((article) => <ArticleCard key={article.id} article={article} />)}</div>}
         </section>
          <section className="mt-10 max-w-3xl" data-testid="section-home-announcements">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]"><Megaphone size={15} /> Akademiyadan</p>
                <h2 className="mt-2 font-serif text-4xl leading-none tracking-[-.04em] text-[hsl(var(--primary))]">Yeniliklər</h2>
              </div>
            </div>
            {announcementsQuery.isLoading && <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">Yeniliklər yüklənir...</p>}
            {announcementsQuery.isError && <p className="mt-6 rounded-xl bg-[hsl(var(--destructive)/.06)] p-4 text-sm font-semibold text-[hsl(var(--destructive))]">Yeniliklər hazırda yüklənmədi.</p>}
            {!announcementsQuery.isLoading && !announcementsQuery.isError && !announcementsQuery.data?.length && <p className="mt-6 rounded-2xl border border-dashed border-[hsl(var(--border))] p-7 text-center text-sm text-[hsl(var(--muted-foreground))]">Hələ yenilik yayımlanmayıb.</p>}
            {!announcementsQuery.isLoading && !announcementsQuery.isError && Boolean(announcementsQuery.data?.length) && <div className="mt-6 space-y-3">{announcementsQuery.data?.slice(0, 3).map((announcement) => <AnnouncementCard key={announcement.id} announcement={announcement} />)}</div>}
          </section>
        {statistics && <PublicStatistics statistics={statistics} />}
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
  const articlesQuery = useGetArticles({ query: { queryKey: getGetArticlesQueryKey() } });
  const { user, isLoaded } = useUser();
  const articles = articlesQuery.data ?? [];

  return (
    <main className="grain min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-7 md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <BrandMark />
          <div className="flex items-center gap-2">
            <HomeLink />
            {isLoaded && (user ? (
              <Link href={isTeacherAccount(user) ? '/admin' : '/user-portal'} className="focus-ring inline-flex items-center rounded-xl bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="link-articles-portal">Panelə qayıt</Link>
            ) : (
              <>
                <Link href="/sign-in" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))]" data-testid="link-articles-sign-in"><LogIn size={15} /> Giriş</Link>
                <Link href="/sign-up" className="focus-ring hidden rounded-xl bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] sm:inline-flex">Müraciət et</Link>
              </>
            ))}
          </div>
        </div>
        <section className="mt-12 max-w-3xl" data-testid="page-articles">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]"><BookOpenText size={15} /> Mədinə Tədris Akademiyası</p>
          <h1 className="mt-3 font-serif text-5xl leading-none tracking-[-.04em] text-[hsl(var(--primary))] md:text-6xl">Məqalələr</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">Elm, tərbiyə və davamlı öyrənmə haqqında müəllimlərimizin paylaşdığı yazıları oxuyun.</p>
          {articlesQuery.isLoading && <p className="mt-10 text-sm text-[hsl(var(--muted-foreground))]">Məqalələr yüklənir...</p>}
          {articlesQuery.isError && <p className="mt-10 rounded-xl bg-[hsl(var(--destructive)/.06)] p-4 text-sm font-semibold text-[hsl(var(--destructive))]">Məqalələr yüklənə bilmədi.</p>}
          {!articlesQuery.isLoading && !articlesQuery.isError && !articles.length && <p className="mt-10 rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Hələ məqalə yayımlanmayıb.</p>}
          {!articlesQuery.isLoading && !articlesQuery.isError && articles.length > 0 && <div className="mt-9 space-y-4">{articles.map((article) => <ArticleCard key={article.id} article={article} />)}</div>}
        </section>
      </div>
    </main>
  );
}

function PublicArticlesPage() {
  const articlesQuery = useGetArticles({ query: { queryKey: getGetArticlesQueryKey() } });
  const articles = articlesQuery.data ?? [];

  return (
    <main className="grain min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-7 md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <BrandMark />
          <div className="flex items-center gap-2">
            <HomeLink />
            <Link href="/sign-in" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))]">
              <LogIn size={15} /> Giriş
            </Link>
            <Link href="/sign-up" className="focus-ring hidden rounded-xl bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] sm:inline-flex">
              Müraciət et
            </Link>
          </div>
        </div>
        <section className="mt-12 max-w-3xl" data-testid="page-articles">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]"><BookOpenText size={15} /> Mədinə Tədris Akademiyası</p>
          <h1 className="mt-3 font-serif text-5xl leading-none tracking-[-.04em] text-[hsl(var(--primary))] md:text-6xl">Məqalələr</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">Elm, tərbiyə və davamlı öyrənmə haqqında müəllimlərimizin paylaşdığı yazıları oxuyun.</p>
          {articlesQuery.isLoading && <p className="mt-10 text-sm text-[hsl(var(--muted-foreground))]">Məqalələr yüklənir...</p>}
          {articlesQuery.isError && <p className="mt-10 rounded-xl bg-[hsl(var(--destructive)/.06)] p-4 text-sm font-semibold text-[hsl(var(--destructive))]">Məqalələr hazırda yüklənmədi.</p>}
          {!articlesQuery.isLoading && !articlesQuery.isError && !articles.length && <p className="mt-10 rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Hələ məqalə yayımlanmayıb.</p>}
          {!articlesQuery.isLoading && !articlesQuery.isError && articles.length > 0 && <div className="mt-9 space-y-4">{articles.map((article) => <ArticleCard key={article.id} article={article} />)}</div>}
        </section>
      </div>
    </main>
  );
}

function DailyBenefitCard({ benefit, isLoading, hasError }: { benefit?: DailyBenefit; isLoading: boolean; hasError: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-[30px] bg-[hsl(var(--accent))] p-8 text-[hsl(var(--primary))] shadow-[var(--shadow-sm)] md:p-10]" data-testid="section-daily-benefit">
      <Quote className="absolute -right-2 -top-3 h-28 w-28 rotate-12 text-[hsl(var(--primary)/.08)]" strokeWidth={1} />
      <div className="relative">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em]"><Quote size={15} /> Günün faydası</div>
        {isLoading && <p className="mt-8 text-sm font-semibold text-[hsl(var(--primary)/.65)]">Yüklənir...</p>}
        {hasError && <p className="mt-8 text-sm font-semibold text-[hsl(var(--primary)/.65)]">Günün faydası hazırda yüklənmədi.</p>}
        {!isLoading && !hasError && benefit && (
          <>
            <blockquote className="mt-8 font-serif text-2xl leading-tight tracking-[-.025em] md:text-3xl">“{benefit.body}”</blockquote>
            <p className="mt-7 text-xs font-bold text-[hsl(var(--primary)/.68)]">— {benefit.source}</p>
          </>
        )}
        {!isLoading && !hasError && !benefit && <p className="mt-8 text-sm font-semibold text-[hsl(var(--primary)/.65)]">Günün faydası hələ əlavə edilməyib.</p>}
      </div>
    </section>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <details className="group rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.32)] p-4 open:bg-[hsl(var(--muted)/.55)]" data-testid={`article-${article.id}`}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-base font-bold text-[hsl(var(--primary))]">{article.title}</span>
          <span className="mt-1 block text-sm leading-5 text-[hsl(var(--muted-foreground))]">{article.excerpt}</span>
          <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--secondary-foreground))]"><UserRound size={12} /> {formatPersonName(article.author)} <CalendarDays size={12} /> {new Date(article.createdAt).toLocaleDateString('az-AZ')}</span>
        </span>
        <ChevronDown className="mt-1 shrink-0 text-[hsl(var(--secondary-foreground))] transition group-open:rotate-180" size={19} />
      </summary>
      <div className="mt-4 border-t border-[hsl(var(--border))] pt-4 text-sm leading-7 text-[hsl(var(--foreground)/.82)] whitespace-pre-wrap">{article.body}</div>
    </details>
  );
}

function SignInForm() {
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
          setNotice('Hesabınız üçün əlavə təsdiq tamamlanmalıdır.');
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
          body: JSON.stringify({ identifier: emailAddress }),
        });
        if (!resolveResponse.ok) {
          setIsNoticeError(true);
          setNotice('Tələbə nömrəsi tapılmadı.');
          return;
        }
        const resolved = await resolveResponse.json() as { email?: string };
        if (!resolved.email) {
          setIsNoticeError(true);
          setNotice('Tələbə nömrəsi ilə əlaqəli email tapılmadı.');
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
        setNotice('Email və ya şifrə düzgün deyil.');
        return;
      }
      if (signIn.status === 'needs_client_trust') {
        const emailCodeFactor = signIn.supportedSecondFactors.find((factor) => factor.strategy === 'email_code');
        if (!emailCodeFactor) {
          setIsNoticeError(true);
          setNotice('Bu hesab üçün cihaz təsdiq üsulu əlçatan deyil.');
          return;
        }
        await signIn.mfa.sendEmailCode();
        setStage('device-trust');
        setNotice('Təhlükəsizlik kodu email ünvanınıza göndərildi.');
        return;
      }
      if (signIn.status !== 'complete') {
        setIsNoticeError(true);
        setNotice('Giriş hazırda tamamlana bilmədi. Yenidən cəhd edin.');
        return;
      }
      await finalizeSignIn();
    } catch {
      setIsNoticeError(true);
      setNotice('Email və ya şifrə düzgün deyil.');
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
        setNotice('Kod düzgün deyil və ya müddəti bitib. Yenidən yoxlayın.');
        return;
      }
      await finalizeSignIn();
    } catch {
      setIsNoticeError(true);
      setNotice('Kod düzgün deyil və ya müddəti bitib. Yenidən yoxlayın.');
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
      setNotice('Yeni təhlükəsizlik kodu email ünvanınıza göndərildi.');
    } catch {
      setIsNoticeError(true);
      setNotice('Kod yenidən göndərilə bilmədi. Bir qədər sonra cəhd edin.');
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
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5 py-7 md:px-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between gap-4"><BrandMark /><HomeLink /></div>
        <section className="mt-10 rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)] md:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/.35)] text-[hsl(var(--primary))]"><KeyRound size={21} /></div>
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">{stage === 'device-trust' ? 'Cihaz təsdiqi' : 'Tələbə kabineti'}</p>
          <h1 className="mt-2 font-serif text-4xl leading-none text-[hsl(var(--primary))]">{stage === 'device-trust' ? 'Email kodunu yazın.' : 'Xoş gəlmisiniz.'}</h1>
          <p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{stage === 'device-trust' ? 'Yeni cihazdan giriş etdiyiniz üçün email ünvanınıza göndərilən birdəfəlik təhlükəsizlik kodunu daxil edin.' : 'Kabinetinizə daxil olmaq üçün email ünvanınızı yazın.'}</p>
          {stage === 'credentials' ? (
            <form className="mt-7 space-y-5" onSubmit={submit} data-testid="form-sign-in">
              <label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Email və ya tələbə nömrəsi</span><input required type="text" inputMode="email" autoComplete="username" placeholder="email@example.com və ya T0001" value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm text-[hsl(var(--foreground))] outline-none transition" data-testid="input-sign-in-identifier" /></label>
              <label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Şifrə</span><input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm text-[hsl(var(--foreground))] outline-none transition" data-testid="input-sign-in-password" /></label>
              <div className="-mt-2 text-right"><Link href="/forgot-password" className="focus-ring text-xs font-bold text-[hsl(var(--secondary-foreground))] hover:underline" data-testid="link-forgot-password">Şifrəni unutmusunuz?</Link></div>
              <button type="submit" disabled={isSubmitting} className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-sign-in">{isSubmitting ? <LoaderCircle className="animate-spin" size={17} /> : <LogIn size={17} />}{isSubmitting ? 'Daxil olunur...' : 'Giriş et'}</button>
            </form>
          ) : (
            <form className="mt-7 space-y-5" onSubmit={verifyDeviceTrust} data-testid="form-device-trust">
              <label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Təhlükəsizlik kodu</span><input required autoComplete="one-time-code" inputMode="numeric" value={trustCode} onChange={(event) => setTrustCode(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm text-[hsl(var(--foreground))] outline-none transition" data-testid="input-device-trust-code" /></label>
              <button type="submit" disabled={isSubmitting} className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-verify-device-trust">{isSubmitting ? <LoaderCircle className="animate-spin" size={17} /> : <KeyRound size={17} />}{isSubmitting ? 'Yoxlanılır...' : 'Kodu təsdiqlə'}</button>
              <div className="flex items-center justify-between gap-3 text-xs"><button type="button" onClick={() => void startOver()} className="focus-ring font-bold text-[hsl(var(--secondary-foreground))] hover:underline">Geri qayıt</button><button type="button" onClick={() => void resendDeviceTrustCode()} disabled={isSubmitting} className="focus-ring font-bold text-[hsl(var(--secondary-foreground))] hover:underline disabled:opacity-50" data-testid="button-resend-device-trust">Kodu yenidən göndər</button></div>
            </form>
          )}
          {notice && <p className={`mt-4 rounded-xl px-3.5 py-3 text-sm font-semibold ${isNoticeError ? 'bg-[hsl(var(--destructive)/.08)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--secondary)/.45)] text-[hsl(var(--secondary-foreground))]'}`} role={isNoticeError ? 'alert' : 'status'} data-testid="text-sign-in-notice">{notice}</p>}
          {stage === 'credentials' && <p className="mt-6 border-t border-[hsl(var(--border))] pt-5 text-center text-xs text-[hsl(var(--muted-foreground))]">Hesabınız yoxdur? <Link href="/sign-up" className="font-bold text-[hsl(var(--secondary-foreground))]">Müraciət edin</Link></p>}
        </section>
      </div>
    </main>
  );
}

function PasswordResetForm() {
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
      setNotice('Əgər bu email ilə hesab varsa, Clerk həmin ünvana birdəfəlik bərpa kodu göndərdi.');
    } catch {
      setNotice('Əgər bu email ilə hesab varsa, Clerk həmin ünvana birdəfəlik bərpa kodu göndərdi.');
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
      setNotice('Kod düzgün deyil və ya müddəti bitib. Yenidən yoxlayın.');
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
      setNotice('Şifrəniz yeniləndi. Hesab statusunuz yoxlanıldıqdan sonra kabinetə keçə bilərsiniz.');
    } catch {
      setIsError(true);
      setNotice('Şifrə yenilənmədi. Ən azı 8 simvol seçin və yenidən yoxlayın.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-5 py-7 md:px-10">
      <div className="w-full max-w-md"><div className="flex items-center justify-between gap-4"><BrandMark /><HomeLink /></div>
        <section className="mt-10 rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)] md:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/.35)] text-[hsl(var(--primary))]"><KeyRound size={21} /></div>
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">Hesab bərpası</p>
          <h1 className="mt-2 font-serif text-4xl leading-none text-[hsl(var(--primary))]">{stage === 'password' ? 'Yeni şifrə seçin.' : stage === 'success' ? 'Şifrə yeniləndi.' : 'Şifrənizi bərpa edin.'}</h1>
          {stage === 'email' && <><p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Qeydiyyat email ünvanınızı yazın. Clerk təhlükəsiz, birdəfəlik bərpa kodunu həmin ünvana göndərəcək.</p><form className="mt-7 space-y-5" onSubmit={sendReset}><label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Email ünvanı</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm outline-none" data-testid="input-reset-email" /></label><button type="submit" disabled={!isLoaded || isSubmitting} className="focus-ring w-full rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" data-testid="button-send-reset">{isSubmitting ? 'Göndərilir...' : 'Bərpa kodunu göndər'}</button></form></>}
          {stage === 'code' && <><p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Email ünvanınıza göndərilən birdəfəlik kodu daxil edin.</p><form className="mt-7 space-y-5" onSubmit={verifyCode}><label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Bərpa kodu</span><input required autoComplete="one-time-code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm outline-none" data-testid="input-reset-code" /></label><button type="submit" disabled={isSubmitting} className="focus-ring w-full rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" data-testid="button-verify-reset-code">{isSubmitting ? 'Yoxlanılır...' : 'Kodu təsdiqlə'}</button></form></>}
          {stage === 'password' && <><p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Yeni, güclü şifrə təyin edin.</p><form className="mt-7 space-y-5" onSubmit={resetPassword}><label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Yeni şifrə</span><input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm outline-none" data-testid="input-reset-password" /></label><button type="submit" disabled={isSubmitting} className="focus-ring w-full rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" data-testid="button-complete-reset">{isSubmitting ? 'Yenilənir...' : 'Şifrəni yenilə'}</button></form></>}
          {stage === 'success' && <button type="button" onClick={() => setLocation('/user-portal')} className="focus-ring mt-7 w-full rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))]" data-testid="button-reset-continue">Kabinetə keç</button>}
          {notice && <p className={`mt-4 rounded-xl px-3.5 py-3 text-sm font-semibold ${isError ? 'bg-[hsl(var(--destructive)/.08)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--secondary)/.45)] text-[hsl(var(--secondary-foreground))]'}`} role="status">{notice}</p>}
          {stage !== 'success' && <p className="mt-6 border-t border-[hsl(var(--border))] pt-5 text-center text-xs text-[hsl(var(--muted-foreground))]">Şifrənizi xatırladınız? <Link href="/sign-in" className="font-bold text-[hsl(var(--secondary-foreground))]">Giriş edin</Link></p>}
        </section>
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
  const accountProfileQuery = useGetOwnUserProfile({ query: { enabled: isLoaded && Boolean(user) && !likelyStaff, queryKey: getGetOwnUserProfileQueryKey() } });
  if (!isLoaded || accountProfileQuery.isLoading) return <AccountGateLoading />;
  if (likelyStaff) return <Redirect to="/admin" />;
  if (accountProfileQuery.isError) return <AccountGateError onRetry={() => void accountProfileQuery.refetch()} />;
  const isStaff = accountProfileQuery.data ? isStaffRole(accountProfileQuery.data.role) : isTeacherAccount(user);
  return <Redirect to={isStaff ? '/admin' : '/user-portal'} />;
}

function AdminRoute() {
  const { user, isLoaded } = useUser();
  const likelyStaff = isTeacherAccount(user);
  const accountProfileQuery = useGetOwnUserProfile({ query: { enabled: isLoaded && Boolean(user) && !likelyStaff, queryKey: getGetOwnUserProfileQueryKey() } });
  if (!isLoaded || accountProfileQuery.isLoading) return <AccountGateLoading />;
  if (likelyStaff) return <AdminPanel />;
  if (accountProfileQuery.isError) return <AccountGateError onRetry={() => void accountProfileQuery.refetch()} />;
  const isStaff = accountProfileQuery.data ? isStaffRole(accountProfileQuery.data.role) : isTeacherAccount(user);
  return isStaff ? <AdminPanel /> : <Redirect to="/user-portal" />;
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

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/articles" component={ArticlesPage} />
        <Route path="/forgot-password"><Show when="signed-in"><SignedInLanding /></Show><Show when="signed-out"><PasswordResetForm /></Show></Route>
        <Route path="/sign-in/*?"><Show when="signed-in"><SignedInLanding /></Show><Show when="signed-out"><SignInForm /></Show></Route>
        <Route path="/sign-up/*?" component={ApplicationRoute} />
        <Route path="/verify/certificate/:token">{(params) => <CertificateVerificationPage token={params.token} />}</Route>
        <Route path="/admission-exam"><Show when="signed-in"><AdmissionExamPortal /></Show><Show when="signed-out"><Redirect to="/" /></Show></Route>
        <Route path="/user-portal"><Show when="signed-in"><UserPortal /></Show><Show when="signed-out"><Redirect to="/" /></Show></Route>
        <Route path="/admin"><Show when="signed-in"><AdminRoute /></Show><Show when="signed-out"><Redirect to="/" /></Show></Route>
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