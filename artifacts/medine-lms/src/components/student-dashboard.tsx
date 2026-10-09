import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  Award,
  ArrowUpRight,
  Bell,
  ClipboardList,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coffee,
  FileText,
  Download,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  Library,
  LogOut,
  Send,
  Menu,
  Play,
  RefreshCw,
  Sparkles,
  Settings2,
  Video,
  X,
  Trash2,
  UserRound,
  UsersRound,
  Paperclip,
  FileUp,
  BookMarked,
} from 'lucide-react';
import { useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { formatFullName } from '@/lib/utils';
import { MedreseLibrary } from '@/components/medrese-library';
import { CourseBooksList, CourseBooksSection, ResourceBookRead, useResourceBookMatcher } from '@/components/course-books';
import { useCourseBooks, type CourseBooksItem } from '@/lib/course-books';
import { createPortal } from 'react-dom';
import type { AcademicProfile, Announcement, AssignmentAttachment, AssignmentUploadInput, Course, Dashboard, LearningResource } from '@workspace/api-client-react';
import { getGetCourseQueryKey, getGetResourcesQueryKey, getGetStudentAssignmentQueryKey, getGetStudentAssignmentsQueryKey, useGetCourse, useGetResources, useGetStudentAssignment, useGetStudentAssignments, useRequestStudentAssignmentUploadUrl, useSubmitAssignment } from '@workspace/api-client-react';
import { ArticlesLink, HomeLink } from '@/components/home-link';
import { MessageCenter } from '@/components/message-center';
import { loadUnansweredQuestionCount, QaCenter } from '@/components/qa-center';
import { StudentExamsLauncher, StudentExamsSection } from '@/components/exam-module';
import { AiAssistantLauncher } from '@/components/ai-assistant';
import { SchedulePdfButton } from '@/components/schedule-pdf-button';

type ScheduleAccessSnapshot = {
  approved?: boolean;
  onboardingRequired?: boolean;
  onboardingExamId?: number | null;
};

type DashboardProps = {
  dashboard?: Dashboard;
  courses?: Course[];
  announcements?: Announcement[];
  academicProfile?: AcademicProfile;
  initialScheduleAccess?: ScheduleAccessSnapshot;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
  onLogout?: () => void;
};

type StudentNotification = {
  id: number;
  title: string;
  body: string;
  targetTerms: number[];
  createdAt: string;
};

const navItems = [
  { label: 'İcmal', href: '#icmal', icon: LayoutDashboard },
  { label: 'Profilim', href: '#profil', icon: GraduationCap },
  { label: 'Dərs Cədvəlim', href: '#ders-cedvelim', icon: BookOpen },
  { label: 'Yeniliklər', href: '#yenilikler', icon: Bell },
  { label: 'İmtahan və testlər', href: '#imtahanlar', icon: ClipboardList },
  { label: 'Məsləhətləşmə / Əlaqə', href: '#mesajlar', icon: Send },
  { label: 'Sual-cavab', href: '#sual-cavab', icon: HelpCircle },
];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('az-AZ', { day: 'numeric', month: 'long' }).format(new Date(value));

const lessonDayLabels: Record<string, string> = {
  monday: 'Bazar ertəsi',
  tuesday: 'Çərşənbə axşamı',
  wednesday: 'Çərşənbə',
  thursday: 'Cümə axşamı',
  friday: 'Cümə',
  saturday: 'Şənbə',
  sunday: 'Bazar',
};

const assignmentInputClass = 'focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm text-[hsl(var(--foreground))] outline-none transition placeholder:text-[hsl(var(--muted-foreground)/.65)]';
const assignmentButtonClass = 'focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50';

const lessonDayIndexes: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const ACADEMY_TIME_ZONE = 'Asia/Baku';
const academyWeekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function academyDateParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ACADEMY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const weekdays: Record<string, (typeof academyWeekdays)[number]> = { Sun: 'sunday', Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday', Thu: 'thursday', Fri: 'friday', Sat: 'saturday' };
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')), weekday: weekdays[get('weekday')] ?? 'sunday' };
}

function academyDateKey(value = new Date()) {
  const parts = academyDateParts(value);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function academyStartUtc(date: { year: number; month: number; day: number }, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(Date.UTC(date.year, date.month - 1, date.day, hours - 4, minutes));
}

function formatAcademyDateTime(value: Date) {
  return new Intl.DateTimeFormat('az-AZ', { timeZone: ACADEMY_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(value);
}

function formatLocalTime(value: Date) {
  return new Intl.DateTimeFormat('az-AZ', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(value);
}

function platformForUrl(url: string | null) {
  if (!url) return 'Platforma təyin edilməyib';
  if (/zoom/i.test(url)) return 'Zoom';
  if (/meet\.google|meet\.com/i.test(url)) return 'Google Meet';
  return 'Onlayn dərs';
}

function timeForLessonDay(lessonTime: string | null | undefined, day: string) {
  if (!lessonTime) return null;
  if (lessonTime.startsWith('{')) {
    try {
      const map = JSON.parse(lessonTime) as Record<string, string>;
      return map[day] && /^\d{2}:\d{2}$/.test(map[day]) ? map[day] : null;
    } catch {
      return null;
    }
  }
  return /^\d{2}:\d{2}$/.test(lessonTime) ? lessonTime : null;
}

function upcomingLessonDate(resource: LearningResource, now = new Date()) {
  if (!resource.lessonDays.length) return null;
  const current = academyDateParts(now);
  const base = Date.UTC(current.year, current.month - 1, current.day);
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = new Date(base + offset * 24 * 60 * 60 * 1000);
    const weekday = academyWeekdays[date.getUTCDay()];
    const lessonTime = timeForLessonDay(resource.lessonTime, weekday);
    if (!resource.lessonDays.includes(weekday) || !lessonTime) continue;
    const start = academyStartUtc({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }, lessonTime);
    if (start >= now) return start;
  }
  return null;
}

function lessonIsLive(resource: LearningResource, now = new Date()) {
  const current = academyDateParts(now);
  const lessonTime = timeForLessonDay(resource.lessonTime, current.weekday);
  if (!lessonTime || !resource.lessonDays.includes(current.weekday)) return false;
  const start = academyStartUtc(current, lessonTime);
  return start.getTime() <= now.getTime() && now.getTime() < start.getTime() + 60 * 60 * 1000;
}

function BrandMark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3" data-testid="brand-academy">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-[13px] bg-[hsl(var(--accent))] text-[hsl(var(--primary))] shadow-[0_7px_0_hsl(37_83%_52%)]">
        <span className="font-serif text-xl font-bold leading-none">M</span>
        <span className="absolute bottom-[7px] right-[7px] h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
      </div>
      <div>
        <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${dark ? 'text-[hsl(var(--sidebar-foreground)/.58)]' : 'text-black'}`}>Mədinə</p>
        <p className={`font-serif text-[17px] font-bold leading-none ${dark ? 'text-[hsl(var(--sidebar-foreground))]' : 'text-black'}`}>Tədris Akademiyası</p>
      </div>
    </div>
  );
}

function Sidebar({ onClose, currentSemester, unansweredQuestionCount = 0, onOpenPasswordChange, onOpenMessages, onOpenQuestions, onOpenExams, onOpenProfileEdit, onOpenTranscript, onOpenLibrary }: { onClose?: () => void; currentSemester?: string; unansweredQuestionCount?: number; onOpenPasswordChange: () => void; onOpenMessages: () => void; onOpenQuestions: () => void; onOpenExams: () => void; onOpenProfileEdit: () => void; onOpenTranscript: () => void; onOpenLibrary: () => void }) {
  const [activeNavHref, setActiveNavHref] = useState('#icmal');
  return (
    <aside className="flex h-full w-screen max-w-none shrink-0 flex-col overflow-y-auto bg-[hsl(var(--sidebar))] px-6 py-7 text-[hsl(var(--sidebar-foreground))] lg:w-[264px]">
      <div className="mb-14 flex items-center justify-between">
        <BrandMark dark />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Menyunu bağla"
            className="focus-ring rounded-lg p-2 text-[hsl(var(--sidebar-foreground)/.7)] hover:bg-[hsl(var(--sidebar-accent))] lg:hidden"
            data-testid="button-close-menu"
          >
            <X size={19} />
          </button>
        )}
      </div>
       <div className="flex items-center gap-1">
        <HomeLink dark />
        <ArticlesLink dark />
      </div>

      {currentSemester && (
        <div className="mt-5 rounded-xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.48)] px-3 py-3" data-testid="sidebar-current-semester">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--sidebar-foreground)/.45)]">Cari semestr</p>
          <p className="mt-1 text-sm font-bold text-[hsl(var(--accent))]">{currentSemester}</p>
        </div>
      )}

      <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.19em] text-[hsl(var(--sidebar-foreground)/.42)]">Menyu</div>
      <nav className="space-y-1" aria-label="Əsas menyu">
        {navItems.map(({ label, href, icon: Icon }, index) => (
          <a
            key={label}
            href={href}
            onClick={(event) => {
              event.preventDefault();
              setActiveNavHref(href);
              if (label === 'İmtahan və testlər') {
                onOpenExams();
              } else if (label === 'Məsləhətləşmə / Əlaqə') {
                onOpenMessages();
                window.setTimeout(() => document.getElementById('mesajlar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
              } else if (label === 'Sual-cavab') {
                onOpenQuestions();
                window.setTimeout(() => document.getElementById('sual-cavab')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
              } else {
                document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
              onClose?.();
            }}
            className={`focus-ring group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition-all duration-200 ${
              activeNavHref === href
                ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))] shadow-[inset_3px_0_0_hsl(var(--accent))]'
                : 'text-[hsl(var(--sidebar-foreground)/.68)] hover:bg-[hsl(var(--sidebar-accent)/.7)] hover:text-[hsl(var(--sidebar-foreground))]'
            }`}
            data-testid={`link-nav-${label.toLowerCase().replace('ı', 'i').replace('ə', 'e')}`}
          >
            <Icon size={18} strokeWidth={activeNavHref === href ? 2.4 : 1.8} />
            <span>{label}</span>
            {label === 'Sual-cavab' && unansweredQuestionCount > 0 && <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">{unansweredQuestionCount}</span>}
            {activeNavHref === href && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />}
          </a>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => { setActiveNavHref('#netice-karti'); onOpenTranscript(); onClose?.(); }}
        className={`focus-ring group mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold transition-all duration-200 ${
          activeNavHref === '#netice-karti'
            ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))] shadow-[inset_3px_0_0_hsl(var(--accent))]'
            : 'text-[hsl(var(--sidebar-foreground)/.68)] hover:bg-[hsl(var(--sidebar-accent)/.7)] hover:text-[hsl(var(--sidebar-foreground))]'
        }`}
        data-testid="button-open-transcript-sidebar"
      >
        <Award size={18} strokeWidth={activeNavHref === '#netice-karti' ? 2.4 : 1.8} />
        <span>Nəticə kartı</span>
        {activeNavHref === '#netice-karti' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />}
      </button>
      <button
        type="button"
        onClick={() => { setActiveNavHref('#kitabxana'); onOpenLibrary(); onClose?.(); }}
        className={`focus-ring group mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold transition-all duration-200 ${
          activeNavHref === '#kitabxana'
            ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))] shadow-[inset_3px_0_0_hsl(var(--accent))]'
            : 'text-[hsl(var(--sidebar-foreground)/.68)] hover:bg-[hsl(var(--sidebar-accent)/.7)] hover:text-[hsl(var(--sidebar-foreground))]'
        }`}
        data-testid="button-open-library-sidebar"
      >
        <Library size={18} strokeWidth={activeNavHref === '#kitabxana' ? 2.4 : 1.8} />
        <span>Mədrəsə Kitabxanası</span>
        {activeNavHref === '#kitabxana' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />}
      </button>
      <button
        type="button"
        onClick={() => { onOpenProfileEdit(); onClose?.(); }}
        className="focus-ring mt-3 flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold text-[hsl(var(--sidebar-foreground)/.68)] transition hover:bg-[hsl(var(--sidebar-accent)/.7)] hover:text-[hsl(var(--sidebar-foreground))]"
        data-testid="button-open-profile-edit"
      >
        <Settings2 size={18} />
        <span>Məlumatlarımı düzəlt</span>
      </button>
      <button
        type="button"
        onClick={() => { onOpenPasswordChange(); onClose?.(); }}
        className="focus-ring mt-3 flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold text-[hsl(var(--sidebar-foreground)/.68)] transition hover:bg-[hsl(var(--sidebar-accent)/.7)] hover:text-[hsl(var(--sidebar-foreground))]"
        data-testid="button-open-password-change"
      >
        <Settings2 size={18} />
        <span>Şifrəni dəyiş</span>
      </button>

      <div className="mt-auto rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.48)] p-4">
        <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--accent)/.16)] text-[hsl(var(--accent))]">
          <Sparkles size={16} />
        </div>
        <p className="mb-1 text-sm font-semibold">Kiçik addımlar.</p>
        <p className="text-[12px] leading-5 text-[hsl(var(--sidebar-foreground)/.58)]">Hər gün bir dərs — böyük nəticələrə doğru.</p>
      </div>
      <div className="mt-6 border-t border-[hsl(var(--sidebar-border))] pt-5 text-[11px] text-[hsl(var(--sidebar-foreground)/.42)]">
        © 2024 Mədinə Akademiyası
      </div>
    </aside>
  );
}

function HeaderActions({ studentName, onNotifications, onLogout, hasNewNotification }: { studentName: string; onNotifications: () => void; onLogout?: () => void; hasNewNotification?: boolean }) {
  const initials = studentName
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-center gap-2 md:gap-3">
      <button
        type="button"
        onClick={onNotifications}
        aria-label="Bildirişləri göstər"
        className="focus-ring relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-3 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--primary))]"
        data-testid="button-notifications"
      >
        <Bell size={19} strokeWidth={1.8} />
        {hasNewNotification && <span className="absolute right-2 top-2 h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--destructive))]" />}
      </button>
      <div className="hidden h-7 w-px bg-[hsl(var(--border))] md:block" />
      <button type="button" className="focus-ring flex items-center gap-2 rounded-xl p-1.5 text-left transition hover:bg-[hsl(var(--muted))]" data-testid="button-profile">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-xs font-bold text-[hsl(var(--secondary-foreground))]" data-testid="text-student-initials">
          {initials || 'MA'}
        </span>
        <span className="hidden pr-1 text-sm font-semibold text-[hsl(var(--primary))] sm:block" data-testid="text-student-name">{studentName}</span>
      </button>
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="focus-ring hidden items-center gap-1.5 rounded-xl border border-[hsl(var(--destructive)/.35)] bg-[hsl(var(--destructive)/.08)] px-3.5 py-2.5 text-sm font-bold text-[hsl(var(--destructive))] transition hover:bg-[hsl(var(--destructive)/.16)] sm:inline-flex"
          data-testid="button-logout"
        >
          <LogOut size={16} strokeWidth={2.2} /> Çıxış
        </button>
      )}
    </div>
  );
}

function MobileHeader({ studentName, onOpen, onNotifications, onLogout, hasNewNotification }: { studentName: string; onOpen: () => void; onNotifications: () => void; onLogout?: () => void; hasNewNotification?: boolean }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card)/.88)] px-5 py-4 backdrop-blur md:px-8 lg:hidden">
      <BrandMark />
      <div className="flex min-w-0 items-center gap-1 md:gap-2">
        <div className="hidden sm:flex items-center gap-1"><HomeLink /><ArticlesLink /></div>
        <HeaderActions studentName={studentName} onNotifications={onNotifications} onLogout={onLogout} hasNewNotification={hasNewNotification} />
        <button
          type="button"
          onClick={onOpen}
          aria-label="Menyunu aç"
          className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--border))] p-3 text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))]"
          data-testid="button-open-menu"
        >
          <Menu size={20} />
        </button>
      </div>
    </header>
  );
}

function Header({ studentName, onNotifications, onLogout, hasNewNotification }: { studentName: string; onNotifications: () => void; onLogout?: () => void; hasNewNotification?: boolean }) {
  return (
    <header className="flex items-center justify-end border-b border-[hsl(var(--border))] px-5 py-3 md:px-10">
      <HeaderActions studentName={studentName} onNotifications={onNotifications} onLogout={onLogout} hasNewNotification={hasNewNotification} />
    </header>
  );
}

function TranscriptSection({ profile }: { profile: AcademicProfile }) {
  const visibleSemesters = profile.semesters.filter((item) => item.termNumber <= profile.currentTermNumber);
  const [selectedTerm, setSelectedTerm] = useState(profile.currentTermNumber);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [printDate, setPrintDate] = useState('');
  const semester = visibleSemesters.find((item) => item.termNumber === selectedTerm) ?? visibleSemesters[visibleSemesters.length - 1] ?? profile.semesters[0];
  const gradedSubjects = semester.subjects.filter((subject) => subject.grade !== null);
  const attendanceSubjects = semester.subjects.filter((subject) => subject.attendancePercent !== null);
  const overallGradedSubjects = visibleSemesters.flatMap((item) => item.subjects).filter((subject) => subject.grade !== null);
  const overallAttendanceSubjects = visibleSemesters.flatMap((item) => item.subjects).filter((subject) => subject.attendancePercent !== null);
  const overallGrade = overallGradedSubjects.length
    ? overallGradedSubjects.reduce((sum, subject) => sum + (subject.grade ?? 0), 0) / overallGradedSubjects.length
    : null;
  const overallAttendance = overallAttendanceSubjects.length
    ? Math.round(overallAttendanceSubjects.reduce((sum, subject) => sum + (subject.attendancePercent ?? 0), 0) / overallAttendanceSubjects.length)
    : null;
  const semesterAttendance = (subjects: typeof semester.subjects) => {
    const recorded = subjects.filter((subject) => subject.attendancePercent !== null);
    return recorded.length
      ? Math.round(recorded.reduce((sum, subject) => sum + (subject.attendancePercent ?? 0), 0) / recorded.length)
      : null;
  };
  const semesterCredits = semester.subjects.reduce((sum, subject) => sum + (subject.credits ?? 0), 0);
  const semesterHours = semester.subjects.reduce((sum, subject) => sum + (subject.hours ?? 0), 0);

  useEffect(() => {
    if (!isPrintMode) return;
    const previousTitle = document.title;
    document.title = `Mədinə Akademiyası · ${formatFullName(profile.firstName, profile.lastName)} · Transkript`;
    document.body.classList.add('printing-transcript');
    const print = window.setTimeout(() => window.print(), 100);
    const afterPrint = () => setIsPrintMode(false);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      window.clearTimeout(print);
      window.removeEventListener('afterprint', afterPrint);
      document.body.classList.remove('printing-transcript');
      document.title = previousTitle;
    };
  }, [isPrintMode, profile.firstName, profile.lastName]);

  return (
    <>
    <section className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-xs)] md:p-6" data-testid="section-student-transcript">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Akademik nəticələr</p>
          <h2 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Nəticə kartı və transkript</h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">Qiymət və davamiyyət məlumatlarınız semestr üzrə burada göstərilir.</p>
         <p className="print-only-transcript mt-2 text-sm font-semibold">{formatFullName(profile.firstName, profile.lastName)} · Tələbə № T{String(profile.studentNumber).padStart(4, '0')} · {profile.program}</p>
        </div>
         <button type="button" onClick={() => { setPrintDate(new Intl.DateTimeFormat('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())); setIsPrintMode(true); }} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="button-download-transcript"><Download size={15} /> PDF kimi saxla</button>
      </div>

       <div className="mt-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.28)] p-4" data-testid="transcript-student-details">
         <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Tələbə məlumatları</p>
         <dl className="mt-3 grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
           <div><dt className="text-[hsl(var(--muted-foreground))]">Ad və soyad</dt><dd className="mt-1 font-bold text-[hsl(var(--primary))]">{formatFullName(profile.firstName, profile.lastName)}</dd></div>
           <div><dt className="text-[hsl(var(--muted-foreground))]">Tələbə nömrəsi</dt><dd className="mt-1 font-bold text-[hsl(var(--primary))]">T{String(profile.studentNumber).padStart(4, '0')}</dd></div>
           <div><dt className="text-[hsl(var(--muted-foreground))]">İxtisas / proqram</dt><dd className="mt-1 font-bold text-[hsl(var(--primary))]">{profile.program ?? '—'}</dd></div>
           <div><dt className="text-[hsl(var(--muted-foreground))]">Tədris ili</dt><dd className="mt-1 font-bold text-[hsl(var(--primary))]">{profile.courseYear}-cü il · {profile.semester}-ci semestr</dd></div>
         </dl>
       </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-[hsl(var(--muted)/.45)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Ümumi orta bal</p>
          <p className="mt-2 font-serif text-2xl font-bold text-[hsl(var(--primary))]" data-testid="text-overall-gpa">{overallGrade === null ? '—' : overallGrade.toFixed(2)}</p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">5 üzərindən · bütün qiymətlər</p>
        </div>
        <div className="rounded-xl bg-[hsl(var(--muted)/.45)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Ümumi davamiyyət</p>
          <p className="mt-2 font-serif text-2xl font-bold text-[hsl(var(--primary))]" data-testid="text-overall-attendance">{overallAttendance === null ? '—' : `${overallAttendance}%`}</p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Qeyd edilmiş fənlər üzrə</p>
        </div>
        <div className="rounded-xl bg-[hsl(var(--muted)/.45)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Akademik status</p>
          <p className="mt-2 text-lg font-bold text-[hsl(var(--primary))]">{profile.statusLabel}</p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Cari semestr: {profile.currentTermNumber}-ci</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-bold text-[hsl(var(--primary))]">
          Semestr
          <select value={selectedTerm} onChange={(event) => setSelectedTerm(Number(event.target.value))} className="focus-ring rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs font-bold" data-testid="select-transcript-semester">
            {visibleSemesters.map((item) => <option key={item.termNumber} value={item.termNumber}>{item.label}</option>)}
          </select>
        </label>
        <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{semester.subjects.length} fənn · {semester.gpa === null ? 'GPA daxil edilməyib' : `GPA: ${semester.gpa.toFixed(2)}`}</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="section-semester-summaries">
        {visibleSemesters.map((item) => {
          const isSelected = item.termNumber === selectedTerm;
          const attendance = semesterAttendance(item.subjects);
          return (
            <button key={item.termNumber} type="button" onClick={() => setSelectedTerm(item.termNumber)} className={`focus-ring rounded-xl border p-3 text-left transition ${isSelected ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.16)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] hover:bg-[hsl(var(--muted)/.5)]'}`} aria-pressed={isSelected} data-testid={`button-semester-summary-${item.termNumber}`}>
              <span className="text-xs font-bold text-[hsl(var(--primary))]">{item.label}</span>
              <span className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[hsl(var(--muted-foreground))]"><span>GPA</span><strong className="text-[hsl(var(--primary))]">{item.gpa === null ? '—' : item.gpa.toFixed(2)}</strong></span>
              <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[hsl(var(--muted-foreground))]"><span>Davamiyyət</span><strong className="text-[hsl(var(--primary))]">{attendance === null ? '—' : `${attendance}%`}</strong></span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 overflow-x-auto" data-testid="transcript-document">
         <div className="min-w-[800px]">
           <div className="grid grid-cols-[minmax(220px,1fr)_140px_80px_80px_130px_100px] gap-3 border-b border-[hsl(var(--border))] px-3 py-3 text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">
             <span>Fənn</span><span>Müəllim</span><span>Kredit</span><span>Saat</span><span>Davamiyyət</span><span>Qiymət</span>
          </div>
          {semester.subjects.length ? semester.subjects.map((subject) => (
             <div key={`${semester.termNumber}-${subject.courseId}`} className="grid grid-cols-[minmax(220px,1fr)_140px_80px_80px_130px_100px] gap-3 border-b border-[hsl(var(--border))] px-3 py-3 text-sm last:border-0">
              <div>
                <p className="font-bold text-[hsl(var(--primary))]">{subject.title}</p>
                {subject.gradingComponents?.length ? <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{subject.gradingComponents.map((component) => `${component.name}: ${component.score === null ? '—' : `${component.score}/100`}`).join(' · ')}</p> : null}
              </div>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{subject.instructor || 'Təyin edilməyib'}</span>
               <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{subject.credits ?? '—'}</span>
               <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{subject.hours ?? '—'}</span>
              <span className="text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{subject.attendancePercent === null ? 'Daxil edilməyib' : `${subject.attendancePercent}% · ${subject.absenceCount} qayıb`}</span>
              <span className="font-bold text-[hsl(var(--primary))]">{subject.grade === null ? 'Daxil edilməyib' : `${subject.grade.toFixed(2)} / 5`}</span>
            </div>
          )) : <p className="px-3 py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">Bu semestr üzrə fənn məlumatı yoxdur.</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-[hsl(var(--muted-foreground))]" data-testid="transcript-summary-footer">
        <span>Rəsmi proqram: {profile.program}</span>
        <span>Semestr krediti: {semesterCredits}</span>
        <span>Semestr saatı: {semesterHours}</span>
        <span>Qiymət daxil edilən fənn: {gradedSubjects.length}</span>
        <span>Davamiyyəti qeyd olunan fənn: {attendanceSubjects.length}</span>
        <span>Çap zamanı bu nəticə kartını PDF kimi saxlaya bilərsiniz.</span>
      </div>
    </section>
    {createPortal(
      <>
        <div className="print-only-transcript-logo" aria-label="Mədinə Tədris Akademiyası">
          <div className="transcript-print-logo-mark">M</div>
          <div><strong>Mədinə Tədris Akademiyası</strong><span>Akademik sənəd</span></div>
        </div>
        <div className="print-only-transcript-stamp" data-testid="transcript-print-stamp" aria-label="Mədinə Tədris Akademiyasının möhürü">
          <div className="transcript-print-seal">
            <span className="transcript-seal-top">MƏDİNƏ TƏDRİS</span>
            <span className="transcript-seal-name">AKADEMİYASI</span>
            <span className="transcript-seal-emblem">✦</span>
            <strong className="transcript-seal-label">RƏSMİ SƏNƏD</strong>
            <span className="transcript-seal-date">{printDate}</span>
            <span className="transcript-seal-bottom">TRANSKRİPT</span>
          </div>
          <p>Akademik sənədin təsdiq möhürü</p>
        </div>
      </>,
      document.body,
    )}
    </>
  );
}

function lessonBookNames(rows: CourseBooksItem[]) {
  const names = rows.flatMap((row) => row.books.filter((book) => book.available).map((book) => book.bookShortTitle));
  return names.length ? `Kitab: ${Array.from(new Set(names)).join(', ')}` : '';
}

function UpcomingLessons({ resources, courseNames, onJoin }: { resources: LearningResource[]; courseNames: Map<number, string>; onJoin: (url: string) => void }) {
  const { booksFor } = useCourseBooks();
  const upcoming = resources.map((resource) => ({ resource, date: upcomingLessonDate(resource) })).filter((item): item is { resource: LearningResource; date: Date } => Boolean(item.date)).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 4);
  return <section className="mt-4 rounded-xl border border-[hsl(var(--accent)/.45)] bg-[hsl(var(--accent)/.12)] p-4" data-testid="section-upcoming-lessons">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--secondary-foreground))]">Yaxınlaşan tədbirlər / dərslər</p><h4 className="mt-1 font-serif text-xl text-[hsl(var(--primary))]">Növbəti dərslər</h4></div><Clock3 size={19} className="text-[hsl(var(--secondary-foreground))]" /></div>
    {upcoming.length ? <div className="mt-3 space-y-2">{upcoming.map(({ resource, date }) => <div key={`${resource.id}-${date.toISOString()}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[hsl(var(--card))] px-3 py-3"><div><p className="text-sm font-bold text-[hsl(var(--primary))]">{academyDateKey(date) === academyDateKey() ? 'Bu gün' : formatAcademyDateTime(date)} — {courseNames.get(resource.courseId) ?? resource.title}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Akademiya vaxtı: {formatAcademyDateTime(date)} · Sizin vaxtınız: {formatLocalTime(date)} · {platformForUrl(resource.url)}</p>{lessonBookNames(booksFor(resource.courseId, resource.termNumber)) && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[hsl(var(--secondary-foreground))]" data-testid={`text-upcoming-lesson-books-${resource.id}`}><BookMarked size={12} /> {lessonBookNames(booksFor(resource.courseId, resource.termNumber))}</p>}</div>{resource.url ? <button type="button" onClick={() => onJoin(resource.url!)} className="focus-ring rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-[10px] font-black text-[hsl(var(--primary-foreground))]" data-testid={`button-join-lesson-${resource.id}`}>Dərsə qoşul</button> : <span className="rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">Link yoxdur</span>}</div>)}</div> : <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Yaxınlaşan dərs cədvələ əlavə edilməyib.</p>}
  </section>;
}

function AcademicProfileSection({ profile, scheduleAccessApproved, onboardingRequired, onboardingExamId, onOpenOnboardingExam, onOpenCourse }: { profile?: AcademicProfile; scheduleAccessApproved: boolean; onboardingRequired?: boolean; onboardingExamId?: number | null; onOpenOnboardingExam?: (examId?: number) => void; onOpenCourse?: (courseId: number, teacherName?: string | null) => void }) {
  const [showAttendance, setShowAttendance] = useState(false);
  const [showExcuses, setShowExcuses] = useState(false);
  const [excuses, setExcuses] = useState<Array<{ id: number; courseTitle: string; attendanceDate: string; teacherName: string; reason: string; status: string }>>([]);
  const [excusesLoaded, setExcusesLoaded] = useState(false);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<string | null>(null);
  const activeTerm = profile?.currentTermNumber ?? 1;
  const resourcesQuery = useGetResources({ termNumber: activeTerm }, { query: { enabled: Boolean(profile) && scheduleAccessApproved, queryKey: getGetResourcesQueryKey({ termNumber: activeTerm }) } });
  const courseBooks = useCourseBooks();
  const matchLessonBook = useResourceBookMatcher(Boolean(profile) && scheduleAccessApproved);
  useEffect(() => { setSelectedScheduleDay(null); }, [activeTerm]);
  if (!profile) return <section className="h-28 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" data-testid="section-academic-profile" />;
  const currentSemesterLabel = profile.semesters.find((item) => item.termNumber === profile.currentTermNumber)?.label ?? `${profile.currentTermNumber}-ci Semestr`;
  const semester = profile.semesters.find((item) => item.termNumber === activeTerm) ?? profile.semesters[0];
  const courseNames = new Map(semester.subjects.map((subject) => [subject.courseId, subject.title]));
  const termResources = resourcesQuery.data ?? [];
  const todayKey = academyDateParts().weekday;
  const scheduleByDay = Object.entries(lessonDayLabels).map(([day, label]) => ({
    day, label,
    lessons: termResources
      .filter((resource) => resource.lessonDays.some((lessonDay) => lessonDay === day))
      .sort((a, b) => (timeForLessonDay(a.lessonTime, day) ?? '99:99').localeCompare(timeForLessonDay(b.lessonTime, day) ?? '99:99')),
  }));
  const loadExcuses = async () => {
    if (excusesLoaded) { setShowExcuses((current) => !current); return; }
    const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/attendance-excuses`);
    if (response.ok) setExcuses(await response.json());
    setExcusesLoaded(true);
    setShowExcuses(true);
  };
  return (
    <>
    <section id="profil" className="mt-0 animate-rise-in" data-testid="section-academic-profile">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Şəxsi kabinet</p>
        </div>
        <span className="rounded-full bg-[hsl(var(--secondary)/.6)] px-2.5 py-1 text-xs font-bold text-[hsl(var(--secondary-foreground))]" data-testid="text-academic-status">{profile.statusLabel}</span>
      </div>
       <aside className="rounded-2xl bg-[hsl(var(--primary))] px-4 py-3 text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-xs)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--primary-foreground)/.75)]"><GraduationCap className="text-[hsl(var(--accent))]" size={14} /> Tələbə məlumatı</p>
              <p className="mt-1 break-words font-serif text-xl leading-tight">{formatFullName(profile.firstName, profile.lastName)}</p>
              <p className="mt-1 text-xs font-bold text-[hsl(var(--accent))]" data-testid="text-student-number">Tələbə № T{String(profile.studentNumber).padStart(4, '0')}</p>
            </div>
            <div className="shrink-0 text-right" aria-label="Aktiv semestr">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--accent))]">Aktiv semestr</p>
              <p className="mt-0.5 font-serif text-base leading-tight text-[hsl(var(--primary-foreground))]" data-testid="text-current-semester">{currentSemesterLabel}</p>
              <p className="mt-1.5 inline-flex rounded-full bg-[hsl(var(--primary-foreground)/.12)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--accent))]" data-testid="text-account-status">Status: Tələbə</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 border-t border-[hsl(var(--primary-foreground)/.22)] pt-2.5 sm:grid-cols-2">
            <div className="rounded-lg bg-[hsl(var(--primary-foreground)/.1)] px-2.5 py-2"><p className="text-[10px] font-bold uppercase tracking-[.12em]">Semestr ortalaması</p><p className="mt-0.5 text-base font-bold text-[hsl(var(--accent))]" data-testid="text-semester-gpa">{semester.gpa === null ? '—' : semester.gpa.toFixed(2)}</p></div>
            <div className="rounded-lg bg-[hsl(var(--sidebar-accent)/.55)] px-2.5 py-2"><button type="button" onClick={() => setShowAttendance((current) => !current)} className="focus-ring w-full rounded-lg text-left" aria-expanded={showAttendance} data-testid="button-open-attendance"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--primary-foreground)/.82)]">Davamiyyət</p><p className="mt-0.5 text-base font-bold text-[hsl(var(--accent))]" data-testid="text-attendance-absence-count">{semester.subjects.reduce((count, subject) => count + subject.absenceCount, 0)} qayıb</p></button></div>
          </div>
          {showAttendance && <AttendanceDetails semester={semester} />}
          <button type="button" onClick={() => void loadExcuses()} className="focus-ring mt-2 inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--destructive)/.28)] bg-[hsl(var(--card))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))] shadow-[var(--shadow-xs)] hover:bg-[hsl(var(--muted))]" aria-expanded={showExcuses} data-testid="button-open-excuses">Davamiyyətə görə üzr {excuses.length > 0 && <span className="rounded-full bg-[hsl(var(--destructive))] px-2 py-0.5 text-[10px] text-white">{excuses.length}</span>}</button>
          {showExcuses && <StudentExcuses excuses={excuses} />}
       </aside>
        <div className="mt-5" id="ders-cedvelim">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-xs)] md:p-6">
            {!scheduleAccessApproved && (
              <div className="rounded-xl border border-dashed border-[hsl(var(--accent)/.65)] bg-[hsl(var(--accent)/.12)] px-5 py-8 text-center" data-testid="state-schedule-access-pending">
                <CalendarDays className="mx-auto text-[hsl(var(--secondary-foreground))]" size={24} />
                 <p className="mt-3 text-sm font-bold text-[hsl(var(--primary))]">{onboardingRequired ? (onboardingExamId ? 'Dərs cədvəlini açmaq üçün qəbul testini tamamlayın' : 'Qəbul imtahanı hələ təyin edilməyib') : 'Dərs cədvəlinə giriş gözləmədədir'}</p>
                 <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[hsl(var(--muted-foreground))]">{onboardingRequired ? (onboardingExamId ? 'Yeni tələbələr üçün olan testi verin. Test tamamlandıqdan və sahib nəticəni təsdiqlədikdən sonra dərs cədvəliniz açılacaq.' : 'Sahib qəbul imtahanını açdıqdan sonra test burada görünəcək. İmtahanı verib nəticənin təsdiqlənməsini gözləyin.') : 'Dərs cədvəlini görmək üçün akademiya əməkdaşının girişinizi təsdiqləməsi gözlənilir.'}</p>
                 {onboardingRequired && onOpenOnboardingExam && <button type="button" onClick={() => onOpenOnboardingExam(onboardingExamId ?? undefined)} className="focus-ring mt-4 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="button-open-onboarding-exam"><ClipboardList size={15} /> Qəbul testinə keç</button>}
              </div>
            )}
            {scheduleAccessApproved && (
              <div className="mb-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] p-4" data-testid="section-daily-schedule">
             <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="break-words text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{currentSemesterLabel}</p><h3 className="mt-1 font-serif text-xl text-[hsl(var(--primary))]">Dərs Cədvəlim</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Yalnız sizə təyin olunmuş müəllim qrupunun gün və saatı</p></div><div className="flex items-start gap-2"><SchedulePdfButton className="flex-1 sm:flex-none" apiPath="/student/schedule.pdf" fileName={`Ders-cedveli-T${String(profile.studentNumber).padStart(4, '0')}.pdf`} testId="button-download-schedule-pdf" /><CalendarDays className="mt-2 hidden shrink-0 text-[hsl(var(--secondary-foreground))] sm:block" size={19} /></div></div>
              {resourcesQuery.isLoading ? <div className="mt-4 h-20 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /> : <div className="mt-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
                  {scheduleByDay.map(({ day, label, lessons }) => { const live = lessons.some((lesson) => lessonIsLive(lesson)); return <button key={day} type="button" onClick={() => setSelectedScheduleDay(day)} className={`focus-ring relative rounded-xl border px-2 py-3 text-center transition hover:-translate-y-0.5 ${day === (selectedScheduleDay ?? todayKey) ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-[hsl(var(--primary))] shadow-[0_4px_0_hsl(37_83%_52%)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))]'}`} aria-expanded={day === (selectedScheduleDay ?? todayKey)} data-testid={`button-schedule-day-${day}`}><span className="block text-xs font-black">{label}</span><span className="mt-1 block text-[10px] font-semibold opacity-70">{lessons.length ? `${lessons.length} dərs` : 'Dərs yoxdur'}</span>{live && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--destructive))] px-1.5 py-0.5 text-[9px] font-black text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> CANLI</span>}</button>; })}
                </div>
                  {(() => { const selected = scheduleByDay.find(({ day }) => day === (selectedScheduleDay ?? todayKey)) ?? scheduleByDay[0]; return <div className="mt-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4" data-testid="section-selected-daily-schedule"><p className="text-xs font-black uppercase tracking-[.12em] text-[hsl(var(--primary))]">{selected.label} günü</p>{selected.lessons.length ? <div className="mt-3 space-y-2">{selected.lessons.map((lesson) => <div key={lesson.id} className="space-y-1.5"><button type="button" onClick={() => onOpenCourse?.(lesson.courseId, lesson.teacherName)} className="focus-ring flex w-full items-start justify-between gap-3 rounded-lg bg-[hsl(var(--muted)/.45)] px-3 py-3 text-left transition hover:-translate-y-0.5 hover:bg-[hsl(var(--accent)/.2)]" data-testid={`button-open-scheduled-lesson-${lesson.id}`}><div><p className="text-sm font-bold text-[hsl(var(--primary))]">{courseNames.get(lesson.courseId) ?? lesson.title}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Müəllim: {lesson.teacherName || 'Müəllim təyin edilməyib'}</p><p className="mt-2 text-[10px] font-bold text-[hsl(var(--secondary-foreground))]">PDF və bütün linklərə bax</p></div><span className="shrink-0 rounded-lg bg-[hsl(var(--secondary)/.6)] px-2.5 py-1 text-sm font-black text-[hsl(var(--secondary-foreground))]">{timeForLessonDay(lesson.lessonTime, selected.day) ?? '—'}</span></button><CourseBooksList compact books={courseBooks.booksFor(lesson.courseId, lesson.termNumber)[0]?.books ?? []} testId={`list-lesson-books-${lesson.id}`} />{!(courseBooks.booksFor(lesson.courseId, lesson.termNumber)[0]?.books.length) && (() => { const match = matchLessonBook(lesson); return match ? <ResourceBookRead match={match} /> : null; })()}{selected.day === todayKey && timeForLessonDay(lesson.lessonTime, selected.day) && <a href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/lessons/${lesson.id}/join`} target="_blank" rel="noreferrer" className={`focus-ring flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black ${lessonIsLive(lesson) ? 'bg-[hsl(var(--destructive))] text-white' : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'}`} title="Qoşulma avtomatik davamiyyət üçün qeyd olunur" data-testid={`link-join-lesson-${lesson.id}`}><Video size={14} /> {lessonIsLive(lesson) ? 'Canlı dərsə qoşul' : 'Dərsə qoşul'}</a>}</div>)}</div> : <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] px-4 py-5 text-center"><div className="grid h-10 w-10 place-items-center rounded-full bg-[hsl(var(--accent)/.28)] text-[hsl(var(--secondary-foreground))]"><Coffee size={19} strokeWidth={1.8} /></div><p className="mt-3 text-sm font-semibold text-[hsl(var(--primary))]">Bu gün üçün dərs planlaşdırılmayıb.</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">İstirahət edə bilərsiniz!</p></div>}</div>; })()}
              </div>}
            </div>
            )}
          </div>
       </div>
     </section>
    </>
  );
}

function StudentExcuses({ excuses }: { excuses: Array<{ id: number; courseTitle: string; attendanceDate: string; teacherName: string; reason: string; status: string }> }) {
  const statusLabel: Record<string, string> = { pending: 'Gözləmədə', approved: 'Təsdiqlənib', rejected: 'Qəbul edilməyib' };
  return <div className="mt-5 rounded-xl border border-[hsl(var(--border))] p-4" data-testid="student-excuses"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Göndərdiyim üzrlər</p>{excuses.length ? <div className="mt-3 space-y-2">{excuses.map((excuse) => <div key={excuse.id} className="rounded-lg bg-[hsl(var(--muted)/.45)] p-3 text-xs"><div className="flex flex-wrap justify-between gap-2 font-bold text-[hsl(var(--primary))]"><span>{excuse.courseTitle}</span><span>{statusLabel[excuse.status] ?? excuse.status}</span></div><p className="mt-1 text-[hsl(var(--muted-foreground))]">{excuse.attendanceDate} · {excuse.teacherName}</p><p className="mt-2 leading-5">{excuse.reason}</p></div>)}</div> : <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Hələ üzr müraciəti göndərilməyib.</p>}</div>;
}

function AttendanceDetails({ semester }: { semester: AcademicProfile['semesters'][number] }) {
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [isSending, setIsSending] = useState(false);
  return (
    <div className="mt-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-[hsl(var(--foreground))] shadow-sm" data-testid="attendance-details">
      <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--primary))]">Davamiyyət üzrə fənn detalları</p><p className="mt-1 text-sm text-[hsl(var(--foreground)/.75)]">Hər fənn üzrə iştirak, qayıb sayı və hesablanmış faiz</p></div>
      <div className="space-y-2">
        {semester.subjects.map((subject) => {
          const isExpanded = expandedCourseId === subject.courseId;
          // Bütün təsdiqlənmiş qeydlər: iştirak (müsbət), gecikmə, üzrlü və qayıb — ən yenisi əvvəl.
          const attendanceRecords = semester.attendanceRecords
            .filter((record) => record.courseId === subject.courseId && ['present', 'absent', 'late', 'excused'].includes(record.status))
            .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate));
          const lateCount = attendanceRecords.filter((record) => record.status === 'late').length;
          const presentCount = attendanceRecords.filter((record) => record.status === 'present').length;
          return <div key={subject.courseId} className={`overflow-hidden rounded-xl border transition ${isExpanded ? 'border-[hsl(var(--accent))] shadow-sm' : 'border-[hsl(var(--border))]'}`}>
            <button type="button" onClick={() => setExpandedCourseId((current) => current === subject.courseId ? null : subject.courseId)} className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm ${isExpanded ? 'bg-[hsl(var(--accent)/.12)]' : 'bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted)/.45)]'}`} aria-expanded={isExpanded} data-testid={`button-attendance-subject-${subject.courseId}`}>
              <span className="min-w-0"><span className="block truncate font-semibold text-[hsl(var(--primary))]">{subject.title}</span><span className="mt-1 block text-[11px] text-[hsl(var(--foreground)/.75)]">{presentCount ? `${presentCount} iştirak · ` : ''}{subject.absenceCount} qayıb{lateCount ? ` · ${lateCount} gecikmə` : ''} · Qayıb faizi: {subject.attendancePercent === null ? '—%' : `${subject.attendancePercent}%`}</span></span>
              <span className="shrink-0 rounded-lg bg-[hsl(var(--muted))] px-2 py-1 text-[10px] font-bold text-[hsl(var(--primary))]">{isExpanded ? 'Bağla' : 'Qeydlərə bax'}</span>
            </button>
            {isExpanded && <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-3">
              {attendanceRecords.length ? <div className="space-y-2">{attendanceRecords.map((record) => <div key={record.id} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-xs"><div className="flex items-center justify-between gap-2"><p className="font-bold text-[hsl(var(--primary))]">{new Intl.DateTimeFormat('az-AZ', { dateStyle: 'medium' }).format(new Date(`${record.attendanceDate}T00:00:00`))}</p><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${record.status === 'present' ? 'bg-emerald-100 text-emerald-800' : record.status === 'late' || record.status === 'excused' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`} data-testid={`attendance-status-${record.id}`}>{record.status === 'present' ? '✓ İştirak' : record.status === 'late' ? 'Gecikib' : record.status === 'excused' ? 'Üzrlü' : 'Qayıb'}</span></div><p className="mt-1 text-[hsl(var(--foreground)/.8)]">{record.status === 'present' ? 'Təsdiq edən müəllim:' : 'Qeyd edən müəllim:'} <span className="font-semibold">{record.teacherName}</span></p>{record.status === 'absent' && (selectedRecordId === record.id ? <div className="mt-3 flex flex-col gap-2"><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Üzrünüzü yazın..." rows={2} className="focus-ring w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs text-[hsl(var(--foreground))]" /><div className="flex gap-2"><button type="button" disabled={isSending || reason.trim().length < 3} onClick={async () => { setIsSending(true); setNotice(''); const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/attendance-excuses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attendanceRecordId: record.id, reason: reason.trim() }) }); const data = await response.json().catch(() => ({})); setIsSending(false); if (!response.ok) { setNotice(data.error ?? 'Üzr göndərilə bilmədi.'); return; } setNotice('Üzrünüz müəllimə göndərildi.'); setSelectedRecordId(null); setReason(''); }} className="rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50">{isSending ? 'Göndərilir...' : 'Üzrü göndər'}</button><button type="button" onClick={() => { setSelectedRecordId(null); setReason(''); }} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]">Bağla</button></div></div> : <button type="button" onClick={() => { setSelectedRecordId(record.id); setNotice(''); }} className="mt-3 rounded-lg border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--card))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]">Üzr bildir</button>)}</div>)}</div> : <p className="text-xs font-medium text-[hsl(var(--foreground)/.75)]">Bu fənn üzrə hələ davamiyyət qeydi yoxdur.</p>}
              {notice && <p className="mt-2 text-xs font-semibold text-[hsl(var(--primary))]">{notice}</p>}
            </div>}
          </div>;
        })}
      </div>
    </div>
  );
}

function AttendanceHistory({ records }: { records: AcademicProfile['semesters'][number]['attendanceRecords'] }) {
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [isSending, setIsSending] = useState(false);
  const statusLabels: Record<string, string> = {
    present: 'İştirak edib',
    absent: 'İştirak etməyib',
    late: 'Gecikib',
    excused: 'Üzrlü',
  };
  return (
    <div className="mt-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]" data-testid="attendance-history">
      <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--primary))]">Davamiyyət tarixçəsi</p>
        <p className="mt-1 text-xs text-[hsl(var(--foreground)/.75)]">Fənn, dərs tarixi və qeydi daxil edən müəllim</p>
      </div>
      {!records.length ? (
        <p className="px-4 py-5 text-sm text-[hsl(var(--foreground)/.75)]">Bu semestr üzrə hələ davamiyyət qeydi yoxdur.</p>
      ) : (
        <div className="divide-y divide-[hsl(var(--border))]">
          {records.map((record) => (
            <div key={record.id} className="grid gap-2 px-4 py-3.5 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div>
                <p className="font-semibold text-[hsl(var(--primary))]">{record.courseTitle}</p>
                <p className="mt-1 text-xs text-[hsl(var(--foreground)/.75)]">{record.teacherName}</p>
              </div>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--foreground)/.85)]"><CalendarDays size={14} />{new Intl.DateTimeFormat('az-AZ', { dateStyle: 'medium' }).format(new Date(`${record.attendanceDate}T00:00:00`))}</p>
              <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${record.status === 'present' ? 'bg-emerald-100 text-emerald-800' : record.status === 'excused' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>{statusLabels[record.status] ?? record.status}</span>
              {record.status === 'absent' && <div className="sm:col-span-3">
                {selectedRecordId === record.id ? <div className="mt-1 flex flex-col gap-2 sm:flex-row"><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Üzrünüzü yazın..." rows={2} className="focus-ring min-w-0 flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs" /><button type="button" disabled={isSending || reason.trim().length < 3} onClick={async () => { setIsSending(true); setNotice(''); const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/attendance-excuses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attendanceRecordId: record.id, reason: reason.trim() }) }); const data = await response.json().catch(() => ({})); setIsSending(false); if (!response.ok) { setNotice(data.error ?? 'Üzr göndərilə bilmədi.'); return; } setNotice('Üzrünüz müəllimə göndərildi.'); setSelectedRecordId(null); setReason(''); }} className="focus-ring rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50">{isSending ? 'Göndərilir...' : 'Üzrü göndər'}</button></div> : <button type="button" onClick={() => { setSelectedRecordId(record.id); setNotice(''); }} className="focus-ring mt-1 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]">Üzr bildir</button>}
              </div>}
            </div>
          ))}
        </div>
      )}
      {notice && <p className="border-t border-[hsl(var(--border))] px-4 py-3 text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{notice}</p>}
    </div>
  );
}

function SemesterResources({ resources, isLoading, courseNames }: { resources: LearningResource[]; isLoading: boolean; courseNames: Map<number, string> }) {
  const kindLabel: Record<string, string> = { pdf: 'PDF', telegram: 'Telegram', material: 'Material', text: 'Mətn' };
  const resourceHref = (resource: LearningResource) => resource.url?.startsWith('/objects/courses/')
    ? `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/resources/${resource.id}/file${resource.url ? '?download=1' : ''}`
    : resource.url?.startsWith('/api/') ? `${import.meta.env.BASE_URL.replace(/\/$/, '')}${resource.url}` : resource.url;
  return (
    <div className="mt-6 border-t border-[hsl(var(--border))] pt-5" data-testid="section-semester-resources">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Seçilən semestr</p><h3 className="mt-1 font-serif text-xl text-[hsl(var(--primary))]">Materiallar</h3></div><FileText className="text-[hsl(var(--secondary-foreground))]" size={19} /></div>
      {isLoading ? <div className="mt-4 h-20 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /> : resources.length ? <div className="mt-4 space-y-3">{resources.map((resource) => <article key={resource.id} className="rounded-xl bg-[hsl(var(--muted)/.5)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--secondary-foreground))]">{kindLabel[resource.kind] ?? resource.kind} · {courseNames.get(resource.courseId) ?? 'Fənn materialı'}</p><p className="mt-1 text-sm font-bold text-[hsl(var(--primary))]">{resource.title}</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{resource.body}</p></div>{resource.url && <a href={resourceHref(resource) ?? undefined} target="_blank" rel="noreferrer" className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[hsl(var(--card))] px-2.5 py-2 text-xs font-bold text-[hsl(var(--secondary-foreground))] hover:underline" data-testid={`link-semester-resource-${resource.id}`}><ArrowUpRight size={14} /> {resource.url.startsWith('/objects/courses/') ? 'PDF-i aç' : 'Aç'}</a>}</div></article>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">Bu semestr üçün hələ material əlavə edilməyib.</p>}
    </div>
  );
}

function PasswordChangeCard() {
  const { user, isLoaded } = useUser();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !isLoaded) return;
    setIsSubmitting(true);
    setNotice('');
    setIsError(false);
    try {
      await user.updatePassword({ currentPassword, newPassword, signOutOfOtherSessions: false });
      setCurrentPassword('');
      setNewPassword('');
      setNotice('Şifrəniz uğurla yeniləndi. Cari sessiyanız açıq qalır.');
    } catch {
      setIsError(true);
      setNotice('Şifrə yenilənmədi. Mövcud şifrəni və yeni şifrə qaydalarını yoxlayın.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <section className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-xs)]" data-testid="section-password-change">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-[hsl(var(--accent)/.3)] p-2.5 text-[hsl(var(--primary))]"><Settings2 size={18} /></div><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Hesab təhlükəsizliyi</p><h3 className="mt-1 font-serif text-xl text-[hsl(var(--primary))]">Şifrəni dəyiş</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Yeni şifrəniz yalnız Clerk tərəfindən təhlükəsiz şəkildə emal olunur.</p></div></div>
      <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Mövcud şifrə</span><input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm outline-none" data-testid="input-current-password" /></label>
        <label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Yeni şifrə</span><input required minLength={8} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm outline-none" data-testid="input-new-password" /></label>
        <button type="submit" disabled={!isLoaded || isSubmitting} className="focus-ring rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" data-testid="button-change-password">{isSubmitting ? 'Yenilənir...' : 'Yenilə'}</button>
      </form>
      {notice && <p className={`mt-4 rounded-xl px-3.5 py-3 text-xs font-semibold ${isError ? 'bg-[hsl(var(--destructive)/.08)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--secondary)/.45)] text-[hsl(var(--secondary-foreground))]'}`} role="status">{notice}</p>}
    </section>
  );
}

type OwnProfile = {
  firstName: string; lastName: string; username: string | null; email: string;
  phone: string; birthDate: string; arabicLevel: 'Zəif' | 'Orta' | 'Yaxşı' | 'Əla';
};

function OwnProfileCard({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [form, setForm] = useState<OwnProfile>({ firstName: '', lastName: '', username: null, email: '', phone: '', birthDate: '', arabicLevel: 'Orta' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [isError, setIsError] = useState(false);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  useEffect(() => {
    void fetch(`${base}/api/account/profile`).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Profil məlumatları yüklənmədi.');
      setProfile(data as OwnProfile);
      setForm(data as OwnProfile);
    }).catch((error) => { setIsError(true); setNotice(error instanceof Error ? error.message : 'Profil məlumatları yüklənmədi.'); }).finally(() => setIsLoading(false));
  }, [base]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true); setNotice(''); setIsError(false);
    try {
      const response = await fetch(`${base}/api/account/profile`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Məlumatlar yadda saxlanılmadı.');
      setProfile(data as OwnProfile); setForm(data as OwnProfile); setNotice('Məlumatlarınız uğurla yeniləndi.');
    } catch (error) { setIsError(true); setNotice(error instanceof Error ? error.message : 'Məlumatlar yadda saxlanılmadı.'); }
    finally { setIsSaving(false); }
  };
  return <section className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-xs)]" data-testid="section-own-profile-edit">
    <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="rounded-xl bg-[hsl(var(--accent)/.3)] p-2.5 text-[hsl(var(--primary))]"><Settings2 size={18} /></div><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Mənim hesabım</p><h3 className="mt-1 font-serif text-xl text-[hsl(var(--primary))]">Məlumatlarımı düzəlt</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Ad, əlaqə və müraciət məlumatlarınızı yeniləyə bilərsiniz.</p></div></div><button type="button" onClick={onClose} className="focus-ring rounded-lg px-3 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" data-testid="button-close-profile-edit">Bağla</button></div>
    {isLoading ? <div className="mt-5 h-24 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /> : profile && <form onSubmit={(event) => void submit(event)} className="mt-5 grid gap-4 sm:grid-cols-2">
      <label><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Ad</span><input required className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm outline-none" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
      <label><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Soyad</span><input required className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm outline-none" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
      <label><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">E-poçt</span><input required type="email" readOnly title="E-poçt ünvanı buradan dəyişdirilə bilməz." className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)] px-3.5 py-3 text-sm outline-none" value={form.email} /></label>
      <label><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Telefon</span><input required placeholder="+994501234567" className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm outline-none" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
      <label><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Doğum tarixi</span><input required type="date" className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm outline-none" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></label>
      <label><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Ərəb dili səviyyəsi</span><select required className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm outline-none" value={form.arabicLevel} onChange={(event) => setForm({ ...form, arabicLevel: event.target.value as OwnProfile['arabicLevel'] })}><option>Zəif</option><option>Orta</option><option>Yaxşı</option><option>Əla</option></select></label>
      <div className="flex items-end"><button type="submit" disabled={isSaving} className="focus-ring rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50">{isSaving ? 'Yadda saxlanılır...' : 'Dəyişiklikləri yadda saxla'}</button></div>
    </form>}
    {notice && <p className={`mt-4 rounded-xl px-3.5 py-3 text-xs font-semibold ${isError ? 'bg-[hsl(var(--destructive)/.08)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--secondary)/.45)] text-[hsl(var(--secondary-foreground))]'}`} role="status">{notice}</p>}
  </section>;
}

function ResourceLink({ href, label, icon: Icon, external = false, courseId, download = false, onJoin, prominent = false }: { href: string | null | undefined; label: string; icon: typeof FileText; external?: boolean; courseId?: number; download?: boolean; onJoin?: () => void; prominent?: boolean }) {
   const prominentClass = /telegram/i.test(label)
     ? 'bg-sky-500 text-white hover:bg-sky-600'
     : /zoom/i.test(label)
       ? 'bg-blue-600 text-white hover:bg-blue-700'
       : /google meet/i.test(label)
         ? 'bg-emerald-600 text-white hover:bg-emerald-700'
         : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90';
  if (!href) {
     return <span className={prominent ? `inline-flex min-h-12 cursor-not-allowed items-center gap-3 rounded-xl bg-[hsl(var(--muted))] px-4 py-3 text-sm font-bold text-[hsl(var(--muted-foreground)/.58)]` : 'inline-flex cursor-not-allowed items-center gap-1.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground)/.48)]'} title={`${label} linki hələ əlavə edilməyib`}><Icon size={prominent ? 19 : 13} /> {label}</span>;
  }
  const resolvedHref = href.startsWith('/objects/courses/') && courseId
    ? `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/courses/${courseId}/pdf${download ? '?download=1' : ''}`
    : href.startsWith('/api/')
      // Zoom/Meet linkləri sayt üzərindən açılır ki, dərsə qoşulma avtomatik davamiyyət üçün qeyd olunsun.
      ? `${import.meta.env.BASE_URL.replace(/\/$/, '')}${href}`
      : href;
   return <a href={resolvedHref} download={download || undefined} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} onClick={(event) => { event.stopPropagation(); onJoin?.(); }} className={`focus-ring inline-flex items-center gap-3 transition ${prominent ? `min-h-12 rounded-xl px-4 py-3 text-sm font-black shadow-[0_4px_0_rgba(0,0,0,.18)] hover:-translate-y-0.5 ${prominentClass}` : 'gap-1.5 text-[10px] font-bold text-[hsl(var(--primary))] hover:text-[hsl(var(--destructive))]'}`} data-testid={`link-${label.toLowerCase().replace(' ', '-')}`}><Icon size={prominent ? 19 : 13} /> {label}</a>;
}

/** Fənn pəncərəsindəki «Dərs resursları»; Kitabxana kitabını adı çəkən resursda «Oxu» düyməsi göstərilir. */
function CourseResourcesSection({ resources, courseId }: { resources: LearningResource[]; courseId: number }) {
  const matchBook = useResourceBookMatcher(resources.length > 0);
  return (
              <div className="mt-8 border-t border-[hsl(var(--border))] pt-6" data-testid="section-course-resources">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">Dərs resursları</p>
                <div className="mt-4 space-y-3">
                  {resources.map((resource) => (
                    <article key={resource.id} className="rounded-2xl bg-[hsl(var(--muted)/.55)] p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]">
                          {resource.kind === 'material' ? <FileText size={15} /> : <BookOpen size={15} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[hsl(var(--primary))]">{resource.title}</p>
                          <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{resource.body}</p>
                            {resource.url && <ResourceLink href={resource.url} label="Resursu aç" icon={ArrowUpRight} external courseId={courseId} prominent />}
                            {(() => { const match = matchBook(resource); return match ? <ResourceBookRead match={match} /> : null; })()}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
  );
}

function CourseDetailModal({ courseId, teacherName, teacherChoiceStatus, onClose }: { courseId: number; teacherName?: string | null; teacherChoiceStatus?: string | null; onClose: () => void }) {
  const { data, isLoading, isError } = useGetCourse(courseId, {
    query: { queryKey: getGetCourseQueryKey(courseId) },
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[hsl(var(--primary)/.5)] p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="course-detail-title" data-testid="modal-course-detail">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Pəncərəni bağla" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-xl)] sm:rounded-[28px] sm:p-8">
        <button type="button" onClick={onClose} className="focus-ring absolute right-5 top-5 rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Ətraflı məlumatı bağla" data-testid="button-close-course-detail"><X size={18} /></button>
        {isLoading && <div className="space-y-4 py-10"><div className="h-4 w-28 animate-pulse rounded bg-[hsl(var(--muted))]" /><div className="h-10 w-2/3 animate-pulse rounded bg-[hsl(var(--muted))]" /><div className="h-24 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" /></div>}
        {isError && <div className="py-10 text-center"><AlertCircle className="mx-auto text-[hsl(var(--destructive))]" /><p className="mt-3 font-bold text-[hsl(var(--primary))]">Fənn məlumatlarını yükləmək alınmadı.</p></div>}
        {data && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">{data.category}</p>
            <h2 id="course-detail-title" className="mt-2 max-w-[85%] font-serif text-4xl leading-none tracking-[-0.04em] text-[hsl(var(--primary))]">{data.title}</h2>
            <p className="mt-5 text-sm leading-7 text-[hsl(var(--muted-foreground))]">{data.description}</p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-[hsl(var(--accent)/.28)] p-4" data-testid={`section-course-teacher-${courseId}`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">Seçilmiş müəllim</p>
                {teacherName ? <p className="mt-2 text-xl font-bold text-[hsl(var(--primary))]">{teacherName}</p> : <div className="mt-2 flex items-center gap-2 text-[hsl(var(--muted-foreground))]"><span className="grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--muted))]"><UserRound size={16} strokeWidth={1.8} /></span><p className="text-sm font-semibold">Müəllim tezliklə təyin olunacaq</p></div>}
                {teacherChoiceStatus === 'approved' && <p className="mt-1 text-xs font-semibold text-[hsl(var(--secondary-foreground))]">Müəllim seçimi təsdiqlənib.</p>}
                {teacherChoiceStatus === 'pending' && <p className="mt-1 text-xs font-semibold text-[hsl(var(--secondary-foreground))]">Müəllim seçimi təsdiq gözləyir.</p>}
              </div>
              <div className="rounded-2xl bg-[hsl(var(--secondary)/.55)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">İrəliləyiş</p>
                <p className="mt-2 text-xl font-bold text-[hsl(var(--primary))]">{data.progress}%</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--secondary-foreground))]" style={{ width: `${data.progress}%` }} /></div>
              </div>
              <div className="rounded-2xl bg-[hsl(var(--muted)/.55)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">Növbəti dərs</p>
                <p className="mt-2 text-sm font-bold text-[hsl(var(--primary))]">{data.nextLesson || 'Növbəti dərs müəyyən edilməyib'}</p>
              </div>
            </div>
             {(data.telegramUrl || data.zoomUrl || data.googleMeetUrl) && (
               <div className="mt-5 flex flex-wrap gap-4 rounded-2xl bg-[hsl(var(--muted)/.55)] p-4">
                 <p className="basis-full text-[10px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">Dərs bağlantıları</p>
                  <ResourceLink href={data.telegramUrl} label="Telegram" icon={Send} external prominent />
                  <ResourceLink href={data.zoomUrl} label="Zoom" icon={Video} external prominent />
                  <ResourceLink href={data.googleMeetUrl} label="Google Meet" icon={Video} external prominent />
                  {(data.zoomUrl || data.googleMeetUrl) && <p className="basis-full text-[11px] leading-5 text-[hsl(var(--muted-foreground))]" data-testid="text-join-tracking-note">Zoom / Google Meet düyməsi ilə dərs vaxtı qoşulduqda girişiniz avtomatik qeyd olunur və müəllim davamiyyəti bu əsasda təsdiqləyir. Sistem yalnız sayt üzərindən linkə keçidi qeyd edir, Zoom/Meet-də qaldığınız müddəti ölçmür.</p>}
               </div>
             )}
            <div className="mt-8">
              <h3 className="font-serif text-2xl text-[hsl(var(--primary))]">Tədris proqramı</h3>
              <ol className="mt-4 space-y-3">{data.curriculum.map((item, index) => <li key={item} className="flex items-start gap-3 text-sm text-[hsl(var(--foreground))]"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--accent)/.35)] text-xs font-bold text-[hsl(var(--primary))]">{index + 1}</span><span className="pt-1">{item}</span></li>)}</ol>
            </div>
             <div className="mt-6 empty:hidden"><CourseBooksSection courseId={data.id} /></div>
             {data.pdfUrl && <div className="mt-6 rounded-2xl bg-[hsl(var(--secondary)/.55)] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">Əsas kitab PDF-i</p><div className="mt-2 flex flex-wrap gap-3"><ResourceLink href={data.pdfUrl} label="PDF-i aç" icon={FileText} courseId={data.id} prominent /><ResourceLink href={data.pdfUrl} label="PDF-i yüklə" icon={Download} courseId={data.id} download prominent /></div></div>}
            {data.resources.length > 0 && <CourseResourcesSection resources={data.resources} courseId={data.id} />}
            <div className="mt-8 border-t border-[hsl(var(--border))] pt-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">Dərsin təsviri</p>
              <p className="mt-2 text-sm leading-7 text-[hsl(var(--foreground))]">{data.lessonDescription}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AnnouncementItem({ announcement }: { announcement: Announcement }) {
  const isImportant = announcement.type === 'important';
  const isLesson = announcement.type === 'lesson' || announcement.type === 'event';
  const isBook = announcement.type === 'book';
  const markerColor = isImportant ? 'hsl(var(--destructive))' : isLesson || isBook ? 'hsl(var(--accent-foreground))' : 'hsl(var(--secondary-foreground))';
  return (
    <article className="group flex gap-3 border-b border-[hsl(var(--border))] py-4 last:border-0 last:pb-0 first:pt-0" data-testid={`item-announcement-${announcement.id}`}>
      <div className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${markerColor}18`, color: markerColor }}>
        {isImportant ? <AlertCircle size={15} /> : isLesson || isBook ? <BookOpen size={15} /> : <Bell size={15} />}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: markerColor }}>
            {isImportant ? 'Vacib elan' : isLesson ? 'Yeni dərs' : isBook ? 'Yeni Kitab' : announcement.type === 'announcement' ? 'Elan' : announcement.type === 'news' ? 'Xəbər' : announcement.type === 'admission' ? 'Tələbə qəbulu' : 'Məlumat'}
          </span>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]" data-testid={`text-announcement-date-${announcement.id}`}>{formatDate(announcement.date)}</span>
        </div>
        <h3 className="mt-1 text-sm font-bold leading-5 text-[hsl(var(--primary))]" data-testid={`text-announcement-title-${announcement.id}`}>{announcement.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]" data-testid={`text-announcement-body-${announcement.id}`}>{announcement.body}</p>
      </div>
    </article>
  );
}

function AnnouncementsSection({ announcements }: { announcements: Announcement[] }) {
  return (
    <section id="yenilikler" className="animate-rise-in delay-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-xs)] md:p-6" data-testid="section-announcements">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">Akademiyadan</p>
          <h2 className="font-serif text-[25px] leading-none tracking-[-0.035em] text-[hsl(var(--primary))]">Yeniliklər</h2>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]">
          <Bell size={15} />
        </div>
      </div>
      {announcements.length ? (
        <div>{announcements.slice(0, 4).map((announcement) => <AnnouncementItem key={announcement.id} announcement={announcement} />)}</div>
      ) : (
        <EmptyState icon={<Bell size={19} />} title="Yenilik yoxdur" body="Akademiyadan gələn xəbərlər burada görünəcək." />
      )}
    </section>
  );
}

const assignmentStatusLabels: Record<string, string> = {
  open: 'Açıq',
  closed: 'Bağlanıb',
  submitted: 'Təhvil verilib',
  graded: 'Qiymətləndirilib',
  resubmission_requested: 'Yenidən təhvil tələb olunur',
};

function assignmentDueLabel(dueAt: string, status: string) {
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return 'Son tarix qeyd edilməyib';
  if (status === 'closed' || date.getTime() < Date.now()) return `Son tarix: ${date.toLocaleString('az-AZ', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`;
  return `Son tarix: ${date.toLocaleString('az-AZ', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`;
}

function AssignmentAttachmentList({ attachments, prefix }: { attachments: AssignmentAttachment[]; prefix: string }) {
  if (!attachments.length) return null;
  return (
    <div className="mt-4 space-y-2" data-testid={`${prefix}-attachments`}>
      {attachments.map((attachment) => (
        <a key={attachment.id} href={attachment.downloadUrl} target="_blank" rel="noreferrer" className="focus-ring flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.32)] px-3 py-2.5 text-left transition hover:bg-[hsl(var(--accent)/.16)]" data-testid={`link-${prefix}-attachment-${attachment.id}`}>
          <Paperclip size={15} className="shrink-0 text-[hsl(var(--secondary-foreground))]" />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[hsl(var(--primary))]">{attachment.originalName}</span>
          <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">{Math.max(1, Math.round(attachment.size / 1024))} KB</span>
        </a>
      ))}
    </div>
  );
}

function StudentAssignmentDetail({ assignmentId, onClose }: { assignmentId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const assignmentQuery = useGetStudentAssignment(assignmentId, { query: { queryKey: getGetStudentAssignmentQueryKey(assignmentId) } });
  const uploadMutation = useRequestStudentAssignmentUploadUrl();
  const submitMutation = useSubmitAssignment();
  const [answerText, setAnswerText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [initializedId, setInitializedId] = useState<number | null>(null);
  const assignment = assignmentQuery.data;
  const submission = assignment?.submission;

  useEffect(() => {
    if (assignment && initializedId !== assignment.id) {
      setInitializedId(assignment.id);
      setAnswerText(submission?.answerText ?? '');
    }
  }, [assignment, initializedId, submission]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assignment || (!answerText.trim() && !selectedFiles.length)) {
      setError('Mətn cavabı və ya fayl əlavə edin.');
      return;
    }
    if (selectedFiles.length > 5) {
      setError('Bir təhvilə ən çox 5 fayl əlavə edə bilərsiniz.');
      return;
    }
    setError('');
    setNotice('');
    try {
      const attachmentIntentIds: number[] = [];
      const allowedTypes = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'text/plain']);
      if (selectedFiles.some((file) => !allowedTypes.has(file.type) || file.size > 10 * 1024 * 1024)) {
        throw new Error('Hər fayl PDF, DOC, DOCX, PNG, JPG və ya TXT olmalı və 10 MB-dan böyük olmamalıdır.');
      }
      for (const selectedFile of selectedFiles) {
        const contentType = selectedFile.type as AssignmentUploadInput['contentType'];
        const uploaded = await uploadMutation.mutateAsync({ assignmentId, data: { name: selectedFile.name, size: selectedFile.size, contentType } });
        const uploadResponse = uploaded as typeof uploaded & { id?: number; intentId?: number };
        const putResponse = await fetch(uploaded.uploadURL, { method: 'PUT', headers: { 'Content-Type': selectedFile.type }, body: selectedFile });
        if (!putResponse.ok) throw new Error('Faylı yükləmək mümkün olmadı.');
        const intentId = uploadResponse.id ?? uploadResponse.intentId;
        if (intentId) attachmentIntentIds.push(intentId);
        else if (!uploaded.objectPath) throw new Error('Fayl yükləmə sessiyası tanınmadı.');
      }
      await submitMutation.mutateAsync({ assignmentId, data: { answerText: answerText.trim(), ...(attachmentIntentIds.length ? { attachmentIntentIds } : {}) } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetStudentAssignmentQueryKey(assignmentId) }),
        queryClient.invalidateQueries({ queryKey: getGetStudentAssignmentsQueryKey({ termNumber: assignment.termNumber }) }),
      ]);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setNotice('Təhviliniz yadda saxlanıldı.');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Təhvili göndərmək mümkün olmadı.');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[hsl(var(--primary)/.52)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" data-testid="modal-student-assignment">
      <div className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-xl)] md:p-7">
        <button type="button" onClick={onClose} className="focus-ring absolute right-4 top-4 rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Tapşırığı bağla" data-testid="button-close-student-assignment"><X size={18} /></button>
        {assignmentQuery.isLoading ? <div className="space-y-3"><div className="skeleton h-8 w-2/3 rounded-lg" /><div className="skeleton h-24 rounded-xl" /><div className="skeleton h-10 rounded-xl" /></div> : assignmentQuery.isError || !assignment ? (
          <div className="py-10 text-center"><AlertCircle className="mx-auto text-[hsl(var(--destructive))]" /><p className="mt-3 text-sm font-bold text-[hsl(var(--primary))]">Tapşırıq yüklənmədi.</p><button type="button" onClick={() => void assignmentQuery.refetch()} className={`${assignmentButtonClass} mt-5`} data-testid="button-reload-student-assignment"><RefreshCw size={15} /> Yenidən yoxla</button></div>
        ) : (
          <>
            <div className="pr-10">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{assignment.courseTitle} · {assignment.teacherName}</p>
              <h2 className="mt-2 font-serif text-3xl leading-tight text-[hsl(var(--primary))]" data-testid="text-student-assignment-title">{assignment.title}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className={`rounded-full px-2.5 py-1 ${assignment.submission?.status === 'graded' ? 'bg-emerald-100 text-emerald-800' : assignment.submission?.status === 'resubmission_requested' ? 'bg-amber-100 text-amber-900' : 'bg-[hsl(var(--secondary)/.55)] text-[hsl(var(--secondary-foreground))]'}`}>{assignment.submission ? assignmentStatusLabels[assignment.submission.status] : 'Təhvil gözlənilir'}</span>
                <span className={new Date(assignment.dueAt).getTime() < Date.now() ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--muted-foreground))]'}>{assignmentDueLabel(assignment.dueAt, assignment.status)}</span>
                <span className="text-[hsl(var(--muted-foreground))]">Maksimum {assignment.maxScore} bal</span>
              </div>
            </div>
            <p className="mt-6 whitespace-pre-wrap text-sm leading-6 text-[hsl(var(--foreground))]" data-testid="text-student-assignment-description">{assignment.description}</p>
            <AssignmentAttachmentList attachments={assignment.attachments} prefix="student-assignment" />
            {submission && (
              <div className="mt-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.28)] p-4" data-testid="section-own-submission">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--primary))]">Sizin son təhviliniz</p><span className="text-xs text-[hsl(var(--muted-foreground))]">{new Date(submission.submittedAt).toLocaleString('az-AZ')}</span></div>
                {submission.answerText && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{submission.answerText}</p>}
                <AssignmentAttachmentList attachments={submission.attachments} prefix="own-submission" />
                {submission.score !== null && <p className="mt-3 text-sm font-bold text-[hsl(var(--secondary-foreground))]">Qiymət: {submission.score} / {assignment.maxScore}</p>}
                {submission.feedback && <p className="mt-2 rounded-lg bg-[hsl(var(--card))] p-3 text-sm leading-5 text-[hsl(var(--muted-foreground))]"><strong className="text-[hsl(var(--primary))]">Müəllim rəyi:</strong> {submission.feedback}</p>}
              </div>
            )}
            {assignment.status === 'closed' || (new Date(assignment.dueAt).getTime() < Date.now() && !submission?.status?.includes('resubmission')) ? (
              <p className="mt-5 rounded-xl bg-[hsl(var(--destructive)/.08)] p-3 text-sm font-semibold text-[hsl(var(--destructive))]" data-testid="status-assignment-closed">Bu tapşırığa artıq təhvil göndərmək mümkün deyil.</p>
            ) : (
              <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4 border-t border-[hsl(var(--border))] pt-5">
                <div><label htmlFor={`answer-${assignment.id}`} className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">{submission ? 'Cavabı yenilə' : 'Cavabınız'} <span className="font-normal text-[hsl(var(--muted-foreground))]">(mətn və ya fayl)</span></label><textarea id={`answer-${assignment.id}`} rows={5} maxLength={12000} value={answerText} onChange={(event) => setAnswerText(event.target.value)} className={`${assignmentInputClass} resize-y`} placeholder="Cavabınızı burada yazın..." data-testid="input-assignment-answer" /></div>
                 <div className="space-y-2">
                   <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] px-3 py-3 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent)/.12)]"><FileUp size={17} /><span className="min-w-0 flex-1 truncate">{selectedFiles.length ? `${selectedFiles.length} fayl seçilib` : 'Fayllar əlavə et (ən çox 5, hər biri 10 MB)'}</span><input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt" className="sr-only" onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))} data-testid="input-assignment-files" /></label>
                   {selectedFiles.length > 0 && <div className="space-y-1.5 rounded-xl bg-[hsl(var(--muted)/.28)] p-2.5">{selectedFiles.map((file, index) => <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-2 rounded-lg bg-[hsl(var(--card))] px-2.5 py-2 text-xs"><Paperclip size={14} className="shrink-0 text-[hsl(var(--secondary-foreground))]" /><span className="min-w-0 flex-1 truncate font-semibold">{file.name}</span><span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">{Math.max(1, Math.round(file.size / 1024))} KB</span><button type="button" onClick={() => { setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index)); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="focus-ring rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label={`${file.name} faylını sil`} data-testid={`button-remove-assignment-file-${index}`}><X size={14} /></button></div>)}</div>}
                 </div>
                {error && <p className="text-xs font-semibold text-[hsl(var(--destructive))]" data-testid="status-assignment-submit-error">{error}</p>}
                {notice && <p className="text-xs font-semibold text-emerald-700" data-testid="status-assignment-submit-success">{notice}</p>}
                <button type="submit" disabled={submitMutation.isPending || uploadMutation.isPending} className={assignmentButtonClass} data-testid="button-submit-assignment"><Send size={15} /> {submitMutation.isPending || uploadMutation.isPending ? 'Göndərilir...' : submission ? 'Yenidən təhvil ver' : 'Təhvili göndər'}</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StudentAssignmentsSection({ termNumber }: { termNumber: number }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const assignmentsQuery = useGetStudentAssignments({ termNumber }, { query: { queryKey: getGetStudentAssignmentsQueryKey({ termNumber }) } });
  const assignments = assignmentsQuery.data ?? [];
  return (
    <section id="tapşırıqlar" className={isOpen ? 'h-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[var(--shadow-xs)]' : 'h-full'} data-testid="section-student-assignments">
       {!isOpen ? (
         <button
           type="button"
           onClick={() => setIsOpen(true)}
           className="focus-ring group flex h-full w-full items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--accent)/.8)] bg-gradient-to-r from-[hsl(var(--accent))] via-[hsl(var(--accent)/.86)] to-[hsl(var(--secondary))] px-3 py-2.5 text-left shadow-[0_8px_18px_hsl(var(--accent)/.18)] transition hover:-translate-y-0.5"
           aria-expanded="false"
           data-testid="button-open-student-assignments"
         >
           <span className="flex min-w-0 items-center gap-2.5">
             <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/80 text-[hsl(var(--primary))]"><FileText size={18} /></span>
             <span className="min-w-0">
               <span className="block truncate text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--primary)/.7)]">{termNumber}-ci semestr</span>
               <span className="mt-0.5 block truncate font-serif text-lg leading-tight text-[hsl(var(--primary))]">Ev tapşırıqları</span>
             </span>
           </span>
           <span className="flex shrink-0 items-center gap-1 rounded-lg bg-[hsl(var(--primary))] px-2.5 py-1.5 text-[11px] font-black text-[hsl(var(--primary-foreground))]"><span>{assignmentsQuery.isLoading ? '...' : assignments.length}</span><ChevronRight size={15} /></span>
         </button>
       ) : (
         <>
           <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">Cari semestr · {termNumber}-ci semestr</p><h2 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Ev tapşırıqları</h2><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Tapşırığı açın, cavabınızı göndərin və müəllim rəyini izləyin.</p></div><div className="flex gap-2"><button type="button" onClick={() => void assignmentsQuery.refetch()} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="button-reload-student-assignments"><RefreshCw size={14} /> Yenilə</button><button type="button" onClick={() => setIsOpen(false)} className="focus-ring rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" aria-expanded="true" data-testid="button-close-student-assignments">Bağla</button></div></div>
           {assignmentsQuery.isLoading ? <div className="mt-5 grid gap-3 md:grid-cols-2"><div className="skeleton h-32 rounded-xl" /><div className="skeleton h-32 rounded-xl" /></div> : assignmentsQuery.isError ? <div className="mt-5 rounded-xl border border-[hsl(var(--destructive)/.22)] bg-[hsl(var(--destructive)/.06)] p-4 text-sm text-[hsl(var(--destructive))]" data-testid="state-student-assignments-error">Tapşırıqları yükləmək mümkün olmadı. <button type="button" onClick={() => void assignmentsQuery.refetch()} className="ml-1 font-bold underline" data-testid="button-retry-student-assignments">Yenidən cəhd et</button></div> : !assignments.length ? <div className="mt-5"><EmptyState icon={<FileText size={19} />} title="Tapşırıq yoxdur" body="Cari semestr üçün hələ tapşırıq paylaşılmayıb." /></div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{assignments.map((assignment) => <button key={assignment.id} type="button" onClick={() => setSelectedId(assignment.id)} className="focus-ring min-w-0 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/.1)]" data-testid={`card-student-assignment-${assignment.id}`}><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0 max-w-full"><p className="max-w-full break-words text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{assignment.courseTitle}</p><p className="mt-1 max-w-full break-words text-base font-bold text-[hsl(var(--primary))]">{assignment.title}</p></div><ChevronRight size={18} className="shrink-0 text-[hsl(var(--muted-foreground))]" /></div><div className="mt-4 flex flex-wrap gap-2 text-[11px]"><span className="rounded-full bg-[hsl(var(--secondary)/.55)] px-2 py-1 font-bold text-[hsl(var(--secondary-foreground))]">{assignment.submission ? assignmentStatusLabels[assignment.submission.status] : 'Təhvil gözlənilir'}</span><span className={new Date(assignment.dueAt).getTime() < Date.now() ? 'font-semibold text-[hsl(var(--destructive))]' : 'text-[hsl(var(--muted-foreground))]'}>{assignmentDueLabel(assignment.dueAt, assignment.status)}</span></div></button>)}</div>}
         </>
       )}
      {selectedId !== null && <StudentAssignmentDetail assignmentId={selectedId} onClose={() => setSelectedId(null)} />}
    </section>
  );
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)] px-5 py-8 text-center" data-testid="state-empty">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]">{icon}</div>
      <p className="text-sm font-bold text-[hsl(var(--primary))]">{title}</p>
      <p className="mx-auto mt-1 max-w-[230px] text-xs leading-5 text-[hsl(var(--muted-foreground))]">{body}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 py-7 md:px-10 md:py-10" data-testid="state-loading">
      <div className="skeleton h-8 w-48 rounded-lg" />
      <div className="skeleton mt-7 h-[286px] rounded-[25px]" />
      <div className="mt-10 flex items-end justify-between"><div className="skeleton h-10 w-36 rounded-lg" /><div className="skeleton h-4 w-20 rounded" /></div>
      <div className="mt-5 grid gap-4 md:grid-cols-3"><div className="skeleton h-56 rounded-2xl" /><div className="skeleton h-56 rounded-2xl" /><div className="skeleton h-56 rounded-2xl" /></div>
    </main>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-[70dvh] items-center justify-center px-6 py-12" data-testid="state-error">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--destructive)/.12)] text-[hsl(var(--destructive))]"><AlertCircle size={25} /></div>
        <h1 className="font-serif text-3xl tracking-[-0.03em] text-[hsl(var(--primary))]">Məlumatları yükləmək alınmadı</h1>
        <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Əlaqəni yoxla və yenidən cəhd et. Sənin öyrənmə məkanını geri qaytaracağıq.</p>
        <button type="button" onClick={onRetry} className="focus-ring mt-6 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5" data-testid="button-retry">
          <RefreshCw size={16} /> Yenidən cəhd et
        </button>
      </div>
    </main>
  );
}

export function StudentDashboard({ dashboard, courses, announcements, academicProfile, initialScheduleAccess, isLoading, hasError, onRetry, onLogout }: DashboardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showExams, setShowExams] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(initialScheduleAccess?.onboardingRequired === true);
  const [onboardingExamId, setOnboardingExamId] = useState<number | null>(initialScheduleAccess?.onboardingExamId ?? null);
  const [scheduleAccessRefreshKey, setScheduleAccessRefreshKey] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unansweredQuestionCount, setUnansweredQuestionCount] = useState(0);
  const [showQuestions, setShowQuestions] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [activeNotification, setActiveNotification] = useState<StudentNotification | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<{ id: number; teacherName?: string } | null>(null);
  useEffect(() => {
    void loadUnansweredQuestionCount().then(setUnansweredQuestionCount);
  }, []);
  const resolvedCourses = courses ?? dashboard?.courses ?? [];
  const resolvedAnnouncements = announcements ?? dashboard?.announcements ?? [];
  const studentName = dashboard?.studentName || 'Tələbə';
  const currentSemester = academicProfile?.semesters.find((item) => item.termNumber === academicProfile.currentTermNumber)?.label;
  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, '');
  const hasNewNotification = Boolean(activeNotification) && !showNotifications;
  const dismissedNotificationIds = useRef(new Set<number>());
  useEffect(() => {
    let active = true;
    const loadNotifications = () => {
      void fetch(`${apiBase}/api/student/notifications`, { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) throw new Error('Bildirişlər yüklənmədi.');
          return await response.json() as StudentNotification[];
        })
        .then((notifications) => {
          if (!active) return;
          const next = notifications.find((notification) => !dismissedNotificationIds.current.has(notification.id));
          if (next) setActiveNotification((current) => current?.id === next.id ? current : next);
        })
        .catch(() => undefined);
    };
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 20000);
    return () => { active = false; window.clearInterval(interval); };
  }, [apiBase]);
  const dismissNotification = async () => {
    if (!activeNotification) return;
    const notification = activeNotification;
    dismissedNotificationIds.current.add(notification.id);
    setActiveNotification(null);
    await fetch(`${apiBase}/api/student/notifications/${notification.id}/dismiss`, { method: 'POST' }).catch(() => undefined);
  };
  const [scheduleAccessApproved, setScheduleAccessApproved] = useState(initialScheduleAccess?.approved === true);
  const [scheduleAccessLoaded, setScheduleAccessLoaded] = useState(Boolean(initialScheduleAccess));
  const onboardingRequiredRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetch(`${apiBase}/api/student/schedule-access`, { cache: 'no-store' })
        .then((response) => response.ok ? response.json() as Promise<{ approved?: boolean; onboardingRequired?: boolean; onboardingExamId?: number | null }> : Promise.reject(new Error('load')))
        .then((result) => {
          if (cancelled) return;
          const required = result.onboardingRequired === true;
          const examId = typeof result.onboardingExamId === 'number' ? result.onboardingExamId : null;
          setScheduleAccessApproved(result.approved === true);
          setOnboardingRequired(required);
          setOnboardingExamId(examId);
          if (required && examId) setShowExams(true);
          if (onboardingRequiredRef.current && !required) {
            setShowExams(false);
            setOnboardingExamId(null);
          }
          onboardingRequiredRef.current = required;
        })
        .catch(() => { if (!cancelled) setScheduleAccessApproved(false); })
        .finally(() => { if (!cancelled) setScheduleAccessLoaded(true); });
    };
    load();
    const interval = window.setInterval(load, 15000);
    return () => { cancelled = true; window.clearInterval(interval); };
   }, [apiBase, academicProfile?.id, scheduleAccessRefreshKey]);
  const notificationResourcesQuery = useGetResources({ termNumber: academicProfile?.currentTermNumber ?? 1 }, { query: { enabled: Boolean(academicProfile) && scheduleAccessLoaded && scheduleAccessApproved, queryKey: getGetResourcesQueryKey({ termNumber: academicProfile?.currentTermNumber ?? 1 }) } });
  const currentSemesterSubjects = academicProfile?.semesters.find((item) => item.termNumber === academicProfile.currentTermNumber)?.subjects ?? [];
  const notificationCourseNames = new Map((currentSemesterSubjects.length ? currentSemesterSubjects : resolvedCourses.map((course) => ({ courseId: course.id, title: course.title }))).map((item) => [item.courseId, item.title]));

  useEffect(() => {
    let cancelled = false;
    const loadUnreadCount = async () => {
      try {
        const response = await fetch(`${apiBase}/api/messages/unread-count`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { count?: number };
        if (!cancelled && typeof data.count === 'number') setUnreadMessageCount(data.count);
      } catch {
        // The message center displays its own error state when opened.
      }
    };
    void loadUnreadCount();
    const interval = window.setInterval(() => { void loadUnreadCount(); }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [apiBase]);

  if (isLoading && !dashboard && !courses && !announcements) {
    return (
      <div className="grain min-h-[100dvh] bg-[hsl(var(--background))]">
         <div className="hidden min-h-[100dvh] lg:flex"><Sidebar currentSemester={currentSemester} unansweredQuestionCount={unansweredQuestionCount} onOpenPasswordChange={() => setShowPasswordChange(true)} onOpenMessages={() => setShowMessages((current) => !current)} onOpenQuestions={() => setShowQuestions((current) => !current)} onOpenExams={() => setShowExams((current) => !current)} onOpenProfileEdit={() => setShowProfileEdit((current) => !current)} onOpenTranscript={() => setShowTranscript(true)} onOpenLibrary={() => setShowLibrary(true)} /></div>
        <div className="lg:hidden"><MobileHeader studentName={studentName} onOpen={() => setMenuOpen(true)} onNotifications={() => setShowNotifications((value) => !value)} onLogout={onLogout} hasNewNotification={hasNewNotification} /></div>
        <LoadingState />
      </div>
    );
  }

  if (hasError && !dashboard && !courses && !announcements) {
    return (
      <div className="grain min-h-[100dvh] bg-[hsl(var(--background))]">
         <div className="hidden min-h-[100dvh] lg:flex"><Sidebar currentSemester={currentSemester} unansweredQuestionCount={unansweredQuestionCount} onOpenPasswordChange={() => setShowPasswordChange(true)} onOpenMessages={() => setShowMessages((current) => !current)} onOpenQuestions={() => setShowQuestions((current) => !current)} onOpenExams={() => setShowExams((current) => !current)} onOpenProfileEdit={() => setShowProfileEdit((current) => !current)} onOpenTranscript={() => setShowTranscript(true)} onOpenLibrary={() => setShowLibrary(true)} /></div>
        <div className="lg:hidden"><MobileHeader studentName={studentName} onOpen={() => setMenuOpen(true)} onNotifications={() => setShowNotifications((value) => !value)} onLogout={onLogout} hasNewNotification={hasNewNotification} /></div>
        <ErrorState onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="grain min-h-[100dvh] bg-[hsl(var(--background))]">
        <div className="fixed inset-y-0 left-0 z-40 hidden lg:block"><Sidebar unansweredQuestionCount={unansweredQuestionCount} onOpenPasswordChange={() => setShowPasswordChange(true)} onOpenMessages={() => setShowMessages((current) => !current)} onOpenQuestions={() => setShowQuestions((current) => !current)} onOpenExams={() => setShowExams((current) => !current)} onOpenProfileEdit={() => setShowProfileEdit((current) => !current)} onOpenTranscript={() => setShowTranscript(true)} onOpenLibrary={() => setShowLibrary(true)} /></div>
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-[hsl(var(--primary)/.42)] backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
            <div className="relative h-full shadow-[var(--shadow-xl)]"><Sidebar onClose={() => setMenuOpen(false)} currentSemester={currentSemester} unansweredQuestionCount={unansweredQuestionCount} onOpenPasswordChange={() => setShowPasswordChange(true)} onOpenMessages={() => setShowMessages((current) => !current)} onOpenQuestions={() => setShowQuestions((current) => !current)} onOpenExams={() => setShowExams((current) => !current)} onOpenProfileEdit={() => setShowProfileEdit((current) => !current)} onOpenTranscript={() => setShowTranscript(true)} onOpenLibrary={() => setShowLibrary(true)} /></div>
        </div>
      )}
      <div className="lg:pl-[264px]">
         <MobileHeader studentName={studentName} onOpen={() => setMenuOpen(true)} onNotifications={() => setShowNotifications((value) => !value)} onLogout={onLogout} hasNewNotification={hasNewNotification} />
        <div className="hidden lg:block">
           <Header studentName={studentName} onNotifications={() => setShowNotifications((value) => !value)} onLogout={onLogout} hasNewNotification={hasNewNotification} />
        </div>
        {showNotifications && (
          <div className="fixed right-5 top-[74px] z-30 w-[min(340px,calc(100vw-40px))] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[var(--shadow-lg)] md:right-10 md:top-[92px]" data-testid="panel-notifications">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[hsl(var(--primary))]">Bildirişlər</p>
              <Check size={16} className="text-[hsl(var(--secondary-foreground))]" />
            </div>
            <div className="mt-3 space-y-2">
              {notificationResourcesQuery.data?.map((resource) => ({ resource, date: upcomingLessonDate(resource) })).filter((item): item is { resource: LearningResource; date: Date } => Boolean(item.date)).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 2).map(({ resource, date }) => <div key={`notice-lesson-${resource.id}`} className="rounded-xl bg-[hsl(var(--accent)/.2)] px-3 py-2.5"><p className="text-xs font-bold text-[hsl(var(--primary))]">Yaxınlaşan dərs</p><p className="mt-1 text-xs text-[hsl(var(--primary))]">{date.toLocaleDateString('az-AZ', { weekday: 'short', day: 'numeric', month: 'short' })}, {date.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })} · {notificationCourseNames.get(resource.courseId) ?? resource.title}</p></div>)}
              <div className="rounded-xl bg-[hsl(var(--muted)/.55)] px-3 py-2.5"><p className="text-xs font-bold text-[hsl(var(--primary))]">Tapşırıq son tarixləri</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Hazırda son tarixli tapşırıq yoxdur.</p></div>
              {resolvedAnnouncements.slice(0, 3).map((announcement) => <div key={`notice-announcement-${announcement.id}`} className="rounded-xl bg-[hsl(var(--muted)/.55)] px-3 py-2.5"><p className="text-xs font-bold text-[hsl(var(--primary))]">Akademiya elanı</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{announcement.title}</p></div>)}
              {!notificationResourcesQuery.data?.length && !resolvedAnnouncements.length && <p className="text-xs leading-5 text-[hsl(var(--muted-foreground))]">Hazırda yeni bildiriş yoxdur.</p>}
            </div>
          </div>
        )}
         {activeNotification && (
           <div className="fixed inset-0 z-[65] flex items-center justify-center bg-[hsl(var(--primary)/.48)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="student-notification-title" data-testid="modal-student-notification">
             <article className="relative w-full max-w-lg rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-xl)]">
               <button type="button" onClick={() => void dismissNotification()} className="focus-ring absolute right-4 top-4 rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Bildirişi bağla" data-testid="button-dismiss-student-notification"><X size={19} /></button>
               <div className="pr-10"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">Akademiyadan bildiriş</p><h2 id="student-notification-title" className="mt-2 font-serif text-3xl leading-tight text-[hsl(var(--primary))]">{activeNotification.title}</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[hsl(var(--muted-foreground))]">{activeNotification.body}</p><p className="mt-5 text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{new Date(activeNotification.createdAt).toLocaleDateString('az-AZ')}</p></div>
             </article>
           </div>
         )}
           {showExams && academicProfile && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[hsl(var(--primary)/.5)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="exams-title" data-testid="modal-student-exams">
              <div className="relative max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-[28px] bg-[hsl(var(--background))] shadow-[var(--shadow-xl)]">
                <div id="exams-title" className="sr-only">İmtahan və testlər</div>
                 <StudentExamsSection termNumber={academicProfile.currentTermNumber} initialExamId={onboardingExamId ?? undefined} onSubmitted={() => setScheduleAccessRefreshKey((value) => value + 1)} onClose={scheduleAccessLoaded && !onboardingRequired && !onboardingExamId ? () => setShowExams(false) : undefined} />
              </div>
            </div>
          )}
        <main id="icmal" className="mx-auto w-full max-w-[1400px] px-5 py-7 md:px-10 md:py-10">
          {hasError && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[hsl(var(--destructive)/.2)] bg-[hsl(var(--destructive)/.06)] px-4 py-3 text-xs text-[hsl(var(--destructive))]" data-testid="status-partial-error">
              <span className="flex items-center gap-2"><AlertCircle size={15} /> Bəzi məlumatlar yenilənmədi.</span>
              <button type="button" onClick={onRetry} className="focus-ring font-bold underline underline-offset-2" data-testid="button-retry-partial">Yenilə</button>
            </div>
          )}
            <AcademicProfileSection profile={academicProfile} scheduleAccessApproved={scheduleAccessLoaded && scheduleAccessApproved} onboardingRequired={scheduleAccessLoaded && onboardingRequired} onboardingExamId={onboardingExamId} onOpenOnboardingExam={(examId) => { setShowExams(true); if (examId) setOnboardingExamId(examId); }} onOpenCourse={(courseId, teacherName) => setSelectedCourse({ id: courseId, teacherName: teacherName ?? undefined })} />
           {academicProfile && <div className="mt-5 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2" data-testid="section-student-work-actions"><StudentAssignmentsSection termNumber={academicProfile.currentTermNumber} /><StudentExamsLauncher termNumber={academicProfile.currentTermNumber} onOpen={() => setShowExams(true)} /></div>}
          <div className="mt-11">
            <AnnouncementsSection announcements={resolvedAnnouncements} />
          </div>
        </main>
         {showLibrary && (
           <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[hsl(var(--primary)/.5)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="library-title" data-testid="modal-student-library">
             <div className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5 shadow-[var(--shadow-xl)] md:p-8">
               <button type="button" onClick={() => setShowLibrary(false)} className="focus-ring absolute right-5 top-5 z-10 rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Kitabxananı bağla" data-testid="button-close-student-library"><X size={18} /></button>
               <div id="library-title" className="sr-only">Mədrəsə Kitabxanası</div>
               <MedreseLibrary />
             </div>
           </div>
         )}
         {showTranscript && academicProfile && (
           <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[hsl(var(--primary)/.5)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="transcript-title" data-testid="modal-student-transcript">
             <div className="relative max-h-[92dvh] w-full max-w-6xl overflow-y-auto rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 shadow-[var(--shadow-xl)] md:p-5">
               <button type="button" onClick={() => setShowTranscript(false)} className="focus-ring absolute right-5 top-5 z-10 rounded-full bg-[hsl(var(--card)/.9)] p-2 text-[hsl(var(--muted-foreground))] shadow-[var(--shadow-xs)] hover:bg-[hsl(var(--muted))]" aria-label="Nəticə kartını bağla" data-testid="button-close-student-transcript"><X size={18} /></button>
               <div id="transcript-title" className="sr-only">Nəticə kartı və transkript</div>
               <TranscriptSection profile={academicProfile} />
             </div>
           </div>
         )}
        {showPasswordChange && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[hsl(var(--primary)/.5)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="password-change-title" data-testid="modal-password-change">
            <div className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-xl)] md:p-8">
              <button type="button" onClick={() => setShowPasswordChange(false)} className="focus-ring absolute right-4 top-4 rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Şifrə dəyişmə pəncərəsini bağla" data-testid="button-close-password-change"><X size={18} /></button>
              <div id="password-change-title" className="mb-1 pr-10 font-serif text-2xl text-[hsl(var(--primary))]">Şifrəni dəyiş</div>
              <PasswordChangeCard />
            </div>
          </div>
        )}
        {showProfileEdit && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[hsl(var(--primary)/.5)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title" data-testid="modal-profile-edit">
            <div id="profil-redaktəsi" className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-xl)] md:p-8">
              <button type="button" onClick={() => setShowProfileEdit(false)} className="focus-ring absolute right-4 top-4 rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Məlumatların redaktəsi pəncərəsini bağla" data-testid="button-close-profile-edit"><X size={18} /></button>
              <div id="profile-edit-title" className="mb-4 pr-10 font-serif text-2xl text-[hsl(var(--primary))]">Məlumatlarımı düzəlt</div>
              <OwnProfileCard onClose={() => setShowProfileEdit(false)} />
            </div>
          </div>
        )}
        {showMessages && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[hsl(var(--primary)/.5)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="messages-title" data-testid="modal-messages">
            <div id="mesajlar" className="relative max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-xl)] md:p-8">
              <button type="button" onClick={() => setShowMessages(false)} className="focus-ring absolute right-4 top-4 rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Məsləhətləşmə pəncərəsini bağla" data-testid="button-close-messages"><X size={18} /></button>
              <div id="messages-title" className="mb-4 pr-10 font-serif text-2xl text-[hsl(var(--primary))]">Müəllimlərlə əlaqə</div>
              <MessageCenter onUnreadCountChange={setUnreadMessageCount} />
            </div>
          </div>
        )}
        {showQuestions && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[hsl(var(--primary)/.5)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="questions-title" data-testid="modal-questions">
            <div id="sual-cavab" className="relative max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-xl)] md:p-8">
              <button type="button" onClick={() => setShowQuestions(false)} className="focus-ring absolute right-4 top-4 rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Sual-cavab pəncərəsini bağla" data-testid="button-close-questions"><X size={18} /></button>
              <div id="questions-title" className="mb-4 pr-10 font-serif text-2xl text-[hsl(var(--primary))]">Açıq suallar və cavablar</div>
              <QaCenter canAsk onUnansweredCountChange={setUnansweredQuestionCount} />
            </div>
          </div>
        )}
        <AiAssistantLauncher href="/ai" />
      </div>
      {selectedCourse !== null && <CourseDetailModal courseId={selectedCourse.id} teacherName={selectedCourse.teacherName} onClose={() => setSelectedCourse(null)} />}
    </div>
  );
}
