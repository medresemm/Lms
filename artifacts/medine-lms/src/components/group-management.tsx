// «Qruplar» — tədris quruluşunun 2-ci və 3-cü addımı:
//   «2 Tələbələr»: dərsə qrup yarat (tələbələr + tutum), qrupun tələbələri (Çıxar / Tələbə əlavə et), «Linklər», «Qrupu sil».
//   «3 Müəllimlər»: semestrin bütün qrupları, müəllimsizlər əvvəldə; əsas və əlavə müəllim təyini.
// İcazələri server yoxlayır: sahib, idarə heyəti və admin bütün qrupları, müəllim yalnız öz qruplarını idarə edir
// və aktiv semestrin dərsi üçün özünə qrup yarada bilər (avtomatik əsas müəllim olur).
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarRange, ChevronDown, Link2, Search, Trash2, UserCog, UserMinus, UserPlus, UsersRound, X } from 'lucide-react';
import {
  getGetAdminAssignmentsQueryKey,
  getGetAdminExamsQueryKey,
  getGetAdminResourcesQueryKey,
  getGetCoursesQueryKey,
  useGetAdminTeachers,
} from '@workspace/api-client-react';
import { authFetch } from '@/lib/clerk-token';
import { resourceTeacherIds, resourceTeacherLabel, isCoTaught } from '@/lib/co-teachers';
import {
  filterGroups, groupCapacityLabel, groupHasTeacher, groupIsFull, groupScheduleLabel, matchesStudentSearch,
  NO_TEACHER_FILTER, NO_TEACHER_LABEL, sortForTeacherAssignment, teacherAssignmentSummary, type GroupView,
} from '@/lib/groups';

export type GroupsView = 'students' | 'teachers';

const apiUrl = (path: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api${path}`;
const termSuffixes: Record<number, string> = { 1: 'ci', 2: 'ci', 3: 'cü', 4: 'cü', 5: 'ci', 6: 'cı', 7: 'ci', 8: 'ci' };
const termLabel = (term: number) => `${term}-${termSuffixes[term] ?? 'ci'} semestr`;
const selectClass = 'focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] outline-none';
const smallButton = 'focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-1.5 text-[11px] font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))] disabled:opacity-50';
const studentCode = (number: number) => `T${String(number).padStart(4, '0')}`;

type GroupsResponse = {
  canManageAll: boolean;
  canManageTeachers: boolean;
  canCreateGroups?: boolean;
  canCreateTeacherlessGroups?: boolean;
  groupFlagAvailable?: boolean;
  groupFlagMessage?: string | null;
  lessons?: LessonView[];
  groups: GroupView[];
};
type Teacher = { clerkUserId: string; displayName: string };
type Student = { profileId: number; studentNumber: number; firstName: string; lastName: string };
type Candidate = Student & { inGroup: boolean; unavailableReason: string | null };
type RosterResponse = { resourceId: number; termNumber: number; studentCapacity: number; members: Student[]; pendingCount: number; candidates: Candidate[] };
type Notice = { text: string; error: boolean } | null;

async function readJson<T>(response: Response): Promise<T & { error?: string }> {
  return await response.json().catch(() => ({})) as T & { error?: string };
}

function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <p role="status" className={`rounded-lg px-3 py-2 text-xs font-semibold ${notice.error ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`} data-testid="text-groups-notice">{notice.text}</p>;
}

type LessonView = { courseId: number; termNumber: number; courseTitle: string; lessonDays: string[]; lessonTime: string | null; groupCount: number; scheduleResourceId: number };

/** Tədris quruluşunun 3 addımı: 1 Cədvəl → 2 Tələbələr → 3 Müəllim. Hər addım öz yerini açır və ayrıca vurğulanır. */
export function SetupSteps({ active, onOpenSchedule, onOpenStudents, onOpenTeachers, teachersHint }: {
  active: 1 | 2 | 3;
  onOpenSchedule?: () => void;
  onOpenStudents?: () => void;
  onOpenTeachers?: () => void;
  /** 3-cü addım əlçatan deyilsə (məs. müəllim hesabı) izah. */
  teachersHint?: string;
}) {
  const steps: Array<{ n: 1 | 2 | 3; label: string; hint: string; onClick?: () => void }> = [
    { n: 1, label: 'Cədvəl', hint: 'Cədvəl hazırlama: dərs, gün, saat, kitab', onClick: onOpenSchedule },
    { n: 2, label: 'Tələbələr', hint: 'Qruplar → Tələbələr: qrup yarat, tələbə əlavə et / çıxar', onClick: onOpenStudents },
    { n: 3, label: 'Müəllim', hint: teachersHint ?? 'Qruplar → Müəllimlər: qruplara əsas və əlavə müəllim təyin et', onClick: onOpenTeachers },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold" aria-label="Tədris quruluşu addımları" data-testid="setup-steps">
      {steps.map((step, index) => {
        const current = step.n === active;
        const content = <><span className={`grid size-5 place-items-center rounded-full text-[10px] ${current ? 'bg-[hsl(var(--primary-foreground))] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--primary))]'}`}>{step.n}</span>{step.label}</>;
        const cls = `inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1 ${current ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border border-[hsl(var(--border))] text-[hsl(var(--primary))]'}`;
        return (
          <li key={step.n} className="flex items-center gap-1.5">
            {step.onClick && !current
              ? <button type="button" className={`focus-ring ${cls} hover:bg-[hsl(var(--muted))]`} title={step.hint} onClick={step.onClick} data-testid={`button-setup-step-${step.n}`}>{content}</button>
              : <span className={`${cls} ${!current && !step.onClick ? 'opacity-60' : ''}`} title={step.hint} aria-current={current ? 'step' : undefined} data-testid={`setup-step-${step.n}`}>{content}</span>}
            {index < steps.length - 1 && <span aria-hidden className="text-[hsl(var(--muted-foreground))]">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Badge({ tone, children }: { tone: 'warn' | 'ok' | 'muted'; children: ReactNode }) {
  const cls = tone === 'warn' ? 'bg-amber-100 text-amber-900' : tone === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]';
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{children}</span>;
}

function groupTeacherText(group: GroupView) {
  return groupHasTeacher(group) ? `${isCoTaught(group) ? 'Müəllimlər' : 'Müəllim'}: ${resourceTeacherLabel(group)}` : NO_TEACHER_LABEL;
}

export function GroupManagementSection({ view: controlledView, onViewChange, onOpenSchedule }: { view?: GroupsView; onViewChange?: (view: GroupsView) => void; onOpenSchedule?: () => void }) {
  const queryClient = useQueryClient();
  const teachersQuery = useGetAdminTeachers();
  const [data, setData] = useState<GroupsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [localView, setLocalView] = useState<GroupsView>(controlledView ?? 'students');
  const [termNumber, setTermNumber] = useState<number | null>(null);
  const [termInitialised, setTermInitialised] = useState(false);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [teacherId, setTeacherId] = useState('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  useEffect(() => { if (controlledView) setLocalView(controlledView); }, [controlledView]);
  const canManageTeachers = Boolean(data?.canManageTeachers);
  const view: GroupsView = localView === 'teachers' && data && !canManageTeachers ? 'students' : localView;
  const setView = (next: GroupsView) => { setLocalView(next); onViewChange?.(next); };

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const response = await authFetch(apiUrl('/admin/groups'), { cache: 'no-store' });
      const result = await readJson<GroupsResponse>(response);
      if (!response.ok || !Array.isArray(result.groups)) throw new Error(result.error || 'Qruplar yüklənmədi.');
      setData(result);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Qruplar yüklənmədi.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      load(),
      queryClient.invalidateQueries({ queryKey: getGetAdminResourcesQueryKey() }),
    ]);
  }, [load, queryClient]);

  const groups = data?.groups ?? [];
  const lessons = data?.lessons ?? [];
  const canManageAll = Boolean(data?.canManageAll);
  const canCreate = Boolean(data?.canCreateGroups);
  const terms = useMemo(() => Array.from(new Set([...lessons.map((lesson) => lesson.termNumber), ...groups.map((group) => group.termNumber)])).sort((a, b) => a - b), [lessons, groups]);
  // Semestr seçicisi: ilk açılışda ən kiçik semestr seçilir (sonra «Bütün semestrlər» də seçilə bilər).
  useEffect(() => {
    if (termInitialised || !terms.length) return;
    setTermNumber(terms[0]!);
    setTermInitialised(true);
  }, [terms, termInitialised]);
  const termLessons = lessons.filter((lesson) => termNumber === null || lesson.termNumber === termNumber);
  const termGroups = groups.filter((group) => termNumber === null || group.termNumber === termNumber);
  const courses = useMemo(() => Array.from(new Map(termLessons.map((lesson) => [lesson.courseId, lesson.courseTitle])).entries()).sort((a, b) => a[1].localeCompare(b[1], 'az')), [termLessons]);
  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      const ids = resourceTeacherIds(group);
      ids.forEach((id, index) => map.set(id, group.teacherNames?.[index] ?? teachersQuery.data?.find((teacher) => teacher.clerkUserId === id)?.displayName ?? 'Müəllim'));
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'az'));
  }, [groups, teachersQuery.data]);
  const visibleGroups = filterGroups(groups, { termNumber, courseId, teacherId, search });
  const groupFilterActive = Boolean(teacherId) || Boolean(search.trim());
  const searchFold = search.trim().toLocaleLowerCase('az');
  const visibleLessons = termLessons.filter((lesson) => {
    if (courseId !== null && lesson.courseId !== courseId) return false;
    if (!groupFilterActive) return true;
    const hasGroup = visibleGroups.some((group) => group.courseId === lesson.courseId && group.termNumber === lesson.termNumber);
    return hasGroup || (!teacherId && Boolean(searchFold) && lesson.courseTitle.toLocaleLowerCase('az').includes(searchFold));
  });
  const filtersActive = courseId !== null || groupFilterActive;
  // Nə çatışmır: qrupsuz dərslər, tələbəsiz qruplar, müəllimsiz qruplar, günü olmayan dərslər.
  const lessonsWithoutGroup = termLessons.filter((lesson) => lesson.groupCount === 0).length;
  const groupsWithoutStudents = termGroups.filter((group) => group.studentCount === 0).length;
  const lessonsWithoutDays = termLessons.filter((lesson) => !lesson.lessonDays.length).length;
  const teacherSummary = teacherAssignmentSummary(termGroups);
  const onDeleted = async () => {
    setOpenId(null);
    await Promise.all([
      refreshAll(),
      queryClient.invalidateQueries({ queryKey: getGetCoursesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetAdminAssignmentsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetAdminExamsQueryKey() }),
    ]);
  };

  return (
    <section className="space-y-4" data-testid="section-groups">
      <div className="space-y-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Tədris quruluşu · {view === 'teachers' ? '3-cü addım' : '2-ci addım'}</p>
          <h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Qruplar · {view === 'teachers' ? 'Müəllimlər' : 'Tələbələr'}</h3>
        </div>
        <SetupSteps
          active={view === 'teachers' ? 3 : 2}
          onOpenSchedule={onOpenSchedule}
          onOpenStudents={() => setView('students')}
          onOpenTeachers={canManageTeachers ? () => setView('teachers') : undefined}
          teachersHint={data && !canManageTeachers ? 'Müəllimləri sahib, idarə heyəti və admin təyin edir.' : undefined}
        />
        <p className="text-xs leading-5 text-[hsl(var(--muted-foreground))]" data-testid="text-groups-intro">
          {view === 'teachers'
            ? 'Semestrin bütün qrupları: müəllimi olmayanlar əvvəldə göstərilir. Hər qrup üçün əsas müəllimi və istəsəniz birgə dərs keçəcək əlavə müəllimləri seçin. Müəllimi olmayan qrup tələbələrə görünmür.'
            : canManageAll
              ? 'Semestri seçin: həmin semestrin cədvəldəki dərsləri görünür. Hər dərs üçün qrup yaradın və qrupa həmin semestrin tələbələrini əlavə edin. Müəllim növbəti addımda — «3 Müəllim» — təyin olunur.'
              : 'Sizin qruplarınız və aktiv semestrin dərsləri. Dərs üçün «Qrup yarat» basın — siz avtomatik əsas müəllim olursunuz; sonra tələbələri əlavə edin.'}
        </p>
        {canManageAll && data && !data.groupFlagAvailable && data.groupFlagMessage && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900" data-testid="text-group-flag-missing">{data.groupFlagMessage}</p>}
      </div>
      <div className="grid gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] p-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="filters-groups">
        <select aria-label="Semestr" className={selectClass} value={termNumber ?? ''} onChange={(event) => { setTermNumber(event.target.value ? Number(event.target.value) : null); setCourseId(null); setCreatingFor(null); }} data-testid="select-groups-term">
          <option value="">Bütün semestrlər</option>
          {terms.map((term) => <option key={term} value={term}>{termLabel(term)}</option>)}
        </select>
        <select aria-label="Fənn" className={selectClass} value={courseId ?? ''} onChange={(event) => setCourseId(event.target.value ? Number(event.target.value) : null)} data-testid="select-groups-course">
          <option value="">Bütün fənlər</option>
          {courses.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
        <select aria-label="Müəllim" className={selectClass} value={teacherId} onChange={(event) => setTeacherId(event.target.value)} data-testid="select-groups-teacher">
          <option value="">Bütün müəllimlər</option>
          {canManageAll && <option value={NO_TEACHER_FILTER}>{NO_TEACHER_LABEL}</option>}
          {teacherOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <label className="relative">
          <span className="sr-only">Axtar</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Fənn, müəllim, gün..." className={`${selectClass} pl-9`} data-testid="input-groups-search" />
        </label>
      </div>
      {!loading && !loadError && canManageAll && termLessons.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="groups-status-summary">
          <span className="text-[11px] font-bold text-[hsl(var(--muted-foreground))]">{termNumber === null ? 'Bütün semestrlər' : termLabel(termNumber)}:</span>
          <Badge tone="muted">{termLessons.length} dərs · {termGroups.length} qrup</Badge>
          {lessonsWithoutGroup > 0 ? <Badge tone="warn">{lessonsWithoutGroup} dərsin qrupu yoxdur</Badge> : <Badge tone="ok">Hər dərsin qrupu var</Badge>}
          {groupsWithoutStudents > 0 && <Badge tone="warn">{groupsWithoutStudents} qrupda tələbə yoxdur</Badge>}
          {termGroups.length > 0 && <Badge tone={teacherSummary.complete ? 'ok' : 'warn'}>{teacherSummary.text}</Badge>}
          {lessonsWithoutDays > 0 && <Badge tone="warn">{lessonsWithoutDays} dərsin günü/saatı yoxdur</Badge>}
        </div>
      )}
      <div aria-live="polite"><NoticeLine notice={notice} /></div>
      {loading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Qruplar yüklənir...</p>
        : loadError ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{loadError} <button type="button" className="ml-2 underline" onClick={() => { setLoading(true); void load(); }}>Yenidən cəhd et</button></p>
        : view === 'teachers'
          ? <TeacherAssignmentView
              groups={sortForTeacherAssignment(visibleGroups)}
              termGroups={termGroups}
              teachers={teachersQuery.data ?? []}
              onSaved={async (text) => { setNotice({ text, error: false }); await refreshAll(); }}
            />
        : !lessons.length ? (
            <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-5 text-center text-sm text-[hsl(var(--muted-foreground))]">
              {canManageAll ? <>Cədvəldə hələ dərs yoxdur. Əvvəlcə 1-ci addım: «Cədvəl hazırlama» bölməsində semestrin dərslərini yaradın.{onOpenSchedule && <button type="button" className="ml-2 font-bold text-[hsl(var(--primary))] underline" onClick={onOpenSchedule}>Cədvəl hazırlamanı aç</button>}</> : 'Aktiv semestrin cədvəlində hələ dərs yoxdur və sizə qrup təyin olunmayıb.'}
            </div>
          )
        : <>
            <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]" data-testid="text-groups-count">{visibleLessons.length} dərs{filtersActive && <button type="button" className="ml-2 font-bold text-[hsl(var(--primary))] underline" onClick={() => { setCourseId(null); setTeacherId(''); setSearch(''); }}>Süzgəcləri təmizlə</button>}</p>
            {visibleLessons.length === 0
              ? <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-5 text-center text-sm text-[hsl(var(--muted-foreground))]">{termLessons.length ? 'Süzgəcə uyğun dərs tapılmadı.' : 'Bu semestrin cədvəlində dərs yoxdur.'}</p>
              : <div className="space-y-3" data-testid="list-group-lessons">
                  {visibleLessons.map((lesson) => {
                    const key = `${lesson.courseId}:${lesson.termNumber}`;
                    const lessonGroups = (groupFilterActive ? visibleGroups : groups).filter((group) => group.courseId === lesson.courseId && group.termNumber === lesson.termNumber);
                    const empty = lessonGroups.filter((group) => group.studentCount === 0).length;
                    const noTeacher = lessonGroups.filter((group) => !groupHasTeacher(group)).length;
                    return (
                      <div key={key} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.15)] p-3" data-testid={`lesson-groups-${lesson.courseId}-${lesson.termNumber}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-[hsl(var(--primary))]">{lesson.courseTitle} <span className="font-semibold text-[hsl(var(--muted-foreground))]">· {termLabel(lesson.termNumber)}</span></p>
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[hsl(var(--muted-foreground))]"><CalendarRange size={12} className="shrink-0" /> {groupScheduleLabel(lesson)}</p>
                            {canManageAll && <div className="mt-1 flex flex-wrap gap-1">
                              {lesson.groupCount === 0 ? <Badge tone="warn">Qrup yoxdur</Badge> : <Badge tone="ok">{lesson.groupCount} qrup</Badge>}
                              {empty > 0 && <Badge tone="warn">{empty} qrupda tələbə yoxdur</Badge>}
                              {noTeacher > 0 && <Badge tone="warn">{noTeacher} qrupda müəllim yoxdur</Badge>}
                              {!lesson.lessonDays.length && <Badge tone="warn">Gün/saat yoxdur</Badge>}
                            </div>}
                          </div>
                          {canCreate && <button type="button" className={smallButton} aria-expanded={creatingFor === key} onClick={() => setCreatingFor((current) => current === key ? null : key)} data-testid={`button-create-group-${lesson.courseId}-${lesson.termNumber}`}><UserPlus size={13} /> Qrup yarat</button>}
                        </div>
                        {creatingFor === key && data && (
                          <CreateGroupForm
                            lesson={lesson}
                            mode={!canManageAll ? 'self' : data.canCreateTeacherlessGroups ? 'teacherless' : 'withTeacher'}
                            teachers={teachersQuery.data ?? []}
                            onCancel={() => setCreatingFor(null)}
                            onCreated={async (text) => { setCreatingFor(null); setNotice({ text, error: false }); await refreshAll(); }}
                          />
                        )}
                        {lessonGroups.length === 0
                          ? creatingFor !== key && <p className="mt-2 rounded-lg border border-dashed border-[hsl(var(--border))] p-3 text-center text-xs text-[hsl(var(--muted-foreground))]">Qrup yoxdur{canCreate && <> — <button type="button" className="font-bold text-[hsl(var(--primary))] underline" onClick={() => setCreatingFor(key)}>Qrup yarat</button></>}</p>
                          : <div className="mt-2 grid gap-2 md:grid-cols-2">
                              {lessonGroups.map((group) => (
                                <GroupCard
                                  key={group.id}
                                  group={group}
                                  open={openId === group.id}
                                  onToggle={() => setOpenId((current) => current === group.id ? null : group.id)}
                                  onAssignTeacher={canManageTeachers ? () => { setTermNumber(group.termNumber); setView('teachers'); } : undefined}
                                  onChanged={refreshAll}
                                  onNotice={setNotice}
                                  onDeleted={onDeleted}
                                />
                              ))}
                            </div>}
                      </div>
                    );
                  })}
                </div>}
          </>}
    </section>
  );
}

/**
 * «Qrup yarat» (2-ci addım): həmin semestrin tələbələri + tutum.
 * - teacherless: sahib / idarə heyəti / admin; müəllim «3 Müəllimlər»də təyin olunur;
 * - withTeacher: verilənlər bazası hələ müəllimsiz qrupu dəstəkləmir — müəllim burada seçilir;
 * - self: müəllim özü üçün yaradır, avtomatik əsas müəllim olur.
 */
function CreateGroupForm({ lesson, mode, teachers, onCancel, onCreated }: {
  lesson: LessonView;
  mode: 'teacherless' | 'withTeacher' | 'self';
  teachers: Teacher[];
  onCancel: () => void;
  onCreated: (text: string) => Promise<void>;
}) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [capacity, setCapacity] = useState(0);
  const [mainTeacher, setMainTeacher] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void authFetch(apiUrl(`/admin/groups/candidates?courseId=${lesson.courseId}&termNumber=${lesson.termNumber}`), { cache: 'no-store' })
      .then(async (response) => {
        const result = await readJson<{ candidates?: Candidate[] }>(response);
        if (!response.ok || !Array.isArray(result.candidates)) throw new Error(result.error || 'Tələbələr yüklənmədi.');
        if (!cancelled) setCandidates(result.candidates);
      })
      .catch((caught: unknown) => { if (!cancelled) setLoadError(caught instanceof Error ? caught.message : 'Tələbələr yüklənmədi.'); });
    return () => { cancelled = true; };
  }, [lesson.courseId, lesson.termNumber]);

  const rows = (candidates ?? []).filter((candidate) => matchesStudentSearch(candidate, search));
  const create = async () => {
    if (mode === 'withTeacher' && !mainTeacher) { setError('Müəllimi seçin.'); return; }
    setBusy(true);
    setError('');
    try {
      const response = await authFetch(apiUrl('/admin/groups'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: lesson.courseId, termNumber: lesson.termNumber, teacherClerkUserIds: mode === 'withTeacher' ? [mainTeacher] : [], profileIds: picked, studentCapacity: capacity }),
      });
      const result = await readJson<{ added?: number[] }>(response);
      if (!response.ok) throw new Error(result.error || 'Qrup yaradılmadı.');
      const base = `${lesson.courseTitle} (${termLabel(lesson.termNumber)}) üçün qrup yaradıldı: ${result.added?.length ?? 0} tələbə.`;
      await onCreated(mode === 'teacherless' ? `${base} Növbəti addım: «3 Müəllim» — qrupa müəllim təyin edin (o vaxta qədər qrup tələbələrə görünmür).` : mode === 'self' ? `${base} Siz qrupun əsas müəllimisiniz.` : base);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Qrup yaradılmadı.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-[hsl(var(--accent)/.7)] bg-[hsl(var(--card))] p-3" data-testid={`form-create-group-${lesson.courseId}-${lesson.termNumber}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black text-[hsl(var(--primary))]">Yeni qrup · tələbələr və tutum</p>
        <button type="button" className="focus-ring rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Bağla" onClick={onCancel}><X size={15} /></button>
      </div>
      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
        Yalnız {termLabel(lesson.termNumber)} tələbələri göstərilir. Eyni fənn üzrə başqa qrupda olan tələbə seçilə bilmir. Tələbəsiz qrup da yaratmaq olar — sonra əlavə edərsiniz.
        {mode === 'teacherless' && ' Müəllimi növbəti addımda — «3 Müəllim» — təyin edəcəksiniz.'}
        {mode === 'self' && ' Siz bu qrupun əsas müəllimi olacaqsınız.'}
      </p>
      {mode === 'withTeacher' && (
        <label className="block text-[11px] font-bold text-[hsl(var(--primary))]">Müəllim <span className="font-semibold text-amber-800">(müəllimsiz qrup hələ aktiv deyil — verilənlər bazası yenilənməyib)</span>
          <select className={`${selectClass} mt-1`} value={mainTeacher} onChange={(event) => setMainTeacher(event.target.value)} data-testid="select-create-group-teacher">
            <option value="">Müəllim seçin</option>
            {teachers.map((teacher) => <option key={teacher.clerkUserId} value={teacher.clerkUserId}>{teacher.displayName}</option>)}
          </select>
        </label>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="relative block">
          <span className="sr-only">Tələbə axtar</span>
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ad, soyad və ya T-nömrə" className={`${selectClass} pl-8`} data-testid="input-create-group-student-search" />
        </label>
        <label className="flex items-center gap-2 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
          Tutum
          <input type="number" min={0} step={1} value={capacity} onChange={(event) => setCapacity(Math.max(0, Math.trunc(Number(event.target.value) || 0)))} className={`${selectClass} w-24`} aria-label="Qrupun tələbə tutumu (0 = limitsiz)" data-testid="input-create-group-capacity" />
          <span className="whitespace-nowrap">(0 = limitsiz)</span>
        </label>
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[hsl(var(--border))] p-1.5">
        {loadError ? <p className="p-2 text-xs font-semibold text-red-800">{loadError}</p>
          : candidates === null ? <p className="p-2 text-xs text-[hsl(var(--muted-foreground))]">Tələbələr yüklənir...</p>
          : rows.length === 0 ? <p className="p-2 text-xs text-[hsl(var(--muted-foreground))]">{candidates.length ? 'Axtarışa uyğun tələbə tapılmadı.' : 'Bu semestrdə aktiv tələbə yoxdur.'}</p>
          : rows.map((candidate) => {
            const checked = picked.includes(candidate.profileId);
            const overCapacity = capacity > 0 && !checked && picked.length >= capacity;
            const disabled = Boolean(candidate.unavailableReason) || overCapacity;
            return (
              <label key={candidate.profileId} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${checked ? 'bg-[hsl(var(--secondary)/.45)] text-[hsl(var(--primary))]' : 'hover:bg-[hsl(var(--muted))]'} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                <input type="checkbox" checked={checked} disabled={disabled} onChange={() => setPicked((current) => checked ? current.filter((id) => id !== candidate.profileId) : [...current, candidate.profileId])} data-testid={`checkbox-create-group-student-${candidate.profileId}`} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{candidate.firstName} {candidate.lastName}</span>
                  <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{studentCode(candidate.studentNumber)}{candidate.unavailableReason ? ` · ${candidate.unavailableReason}` : ''}</span>
                </span>
              </label>
            );
          })}
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-[hsl(var(--secondary-foreground))]">{picked.length} tələbə seçilib</span>
        <button type="button" className="focus-ring rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" disabled={busy || (mode === 'withTeacher' && !mainTeacher)} onClick={() => void create()} data-testid="button-create-group-submit">{busy ? 'Yaradılır...' : 'Qrupu yarat'}</button>
      </div>
    </div>
  );
}

/** «3 Müəllimlər»: semestrin qrupları (müəllimsizlər əvvəldə), hər birinə əsas + əlavə müəllim. */
function TeacherAssignmentView({ groups, termGroups, teachers, onSaved }: {
  groups: GroupView[];
  termGroups: GroupView[];
  teachers: Teacher[];
  onSaved: (text: string) => Promise<void>;
}) {
  const summary = teacherAssignmentSummary(termGroups);
  return (
    <div className="space-y-3" data-testid="section-group-teachers">
      <p className={`rounded-xl px-3 py-2 text-sm font-bold ${summary.complete ? 'bg-emerald-50 text-emerald-800' : summary.missing ? 'bg-amber-50 text-amber-900' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`} data-testid="text-teacher-assignment-summary">{summary.text}</p>
      {groups.length === 0
        ? <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-5 text-center text-sm text-[hsl(var(--muted-foreground))]">{termGroups.length ? 'Süzgəcə uyğun qrup tapılmadı.' : 'Əvvəlcə «2 Tələbələr» addımında qrup yaradın.'}</p>
        : <ul className="space-y-2" data-testid="list-group-teachers">
            {groups.map((group) => <TeacherAssignmentRow key={group.id} group={group} teachers={teachers} onSaved={onSaved} />)}
          </ul>}
    </div>
  );
}

function TeacherAssignmentRow({ group, teachers, onSaved }: { group: GroupView; teachers: Teacher[]; onSaved: (text: string) => Promise<void> }) {
  const hasTeacher = groupHasTeacher(group);
  const [open, setOpen] = useState(!hasTeacher);
  const currentIds = resourceTeacherIds(group);
  const [mainTeacher, setMainTeacher] = useState(currentIds[0] ?? '');
  const [coTeachers, setCoTeachers] = useState<string[]>(currentIds.slice(1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const ids = resourceTeacherIds(group);
    setMainTeacher(ids[0] ?? '');
    setCoTeachers(ids.slice(1));
  }, [group]);

  const save = async () => {
    if (!mainTeacher) { setError('Əsas müəllimi seçin.'); return; }
    const ordered = [mainTeacher, ...coTeachers.filter((id) => id && id !== mainTeacher)];
    setBusy(true);
    setError('');
    try {
      const response = await authFetch(apiUrl(`/admin/resources/${group.id}/teachers`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherClerkUserIds: ordered }),
      });
      const result = await readJson<object>(response);
      if (!response.ok) throw new Error(result.error || 'Qrupun müəllimləri yadda saxlanıla bilmədi.');
      setOpen(false);
      await onSaved(`${group.courseTitle} (${termLabel(group.termNumber)}): ${ordered.length > 1 ? `${ordered.length} müəllim eyni tələbələrlə birgə dərs keçəcək` : 'müəllim təyin olundu'}.${hasTeacher ? '' : ' Qrup indi tələbələrə görünür.'}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Qrupun müəllimləri yadda saxlanıla bilmədi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`rounded-xl border bg-[hsl(var(--card))] p-3 ${hasTeacher ? 'border-[hsl(var(--border))]' : 'border-amber-300'}`} data-testid={`row-group-teachers-${group.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-black text-[hsl(var(--primary))]">{group.courseTitle} <span className="font-semibold text-[hsl(var(--muted-foreground))]">· {termLabel(group.termNumber)} · {groupCapacityLabel(group)}</span></p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[hsl(var(--muted-foreground))]"><CalendarRange size={12} className="shrink-0" /> {groupScheduleLabel(group)}</p>
          <p className="mt-1">{hasTeacher ? <span className="text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{groupTeacherText(group)}</span> : <Badge tone="warn">{NO_TEACHER_LABEL}</Badge>}</p>
        </div>
        <button type="button" className={smallButton} aria-expanded={open} onClick={() => setOpen((value) => !value)} data-testid={`button-group-teachers-toggle-${group.id}`}><UserCog size={13} /> {hasTeacher ? 'Müəllim əlavə et / çıxar' : 'Müəllim təyin et'}</button>
      </div>
      {open && (
        <div className="mt-3 grid gap-3 border-t border-[hsl(var(--border))] pt-3 md:grid-cols-2" data-testid={`panel-group-teacher-editor-${group.id}`}>
          <label className="block text-[11px] font-bold text-[hsl(var(--primary))]">Əsas müəllim
            <select className={`${selectClass} mt-1`} value={mainTeacher} onChange={(event) => { setMainTeacher(event.target.value); setCoTeachers((current) => current.filter((id) => id !== event.target.value)); }} data-testid={`select-group-main-teacher-${group.id}`}>
              <option value="">Müəllim seçin</option>
              {teachers.map((teacher) => <option key={teacher.clerkUserId} value={teacher.clerkUserId}>{teacher.displayName}</option>)}
            </select>
          </label>
          <div>
            <p className="text-[11px] font-bold text-[hsl(var(--primary))]">Əlavə müəllimlər (birgə tədris)</p>
            <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[hsl(var(--border))] p-1.5">
              {teachers.filter((teacher) => teacher.clerkUserId !== mainTeacher).length === 0
                ? <p className="p-1.5 text-xs text-[hsl(var(--muted-foreground))]">Başqa aktiv müəllim yoxdur.</p>
                : teachers.filter((teacher) => teacher.clerkUserId !== mainTeacher).map((teacher) => {
                  const checked = coTeachers.includes(teacher.clerkUserId);
                  return (
                    <label key={teacher.clerkUserId} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 text-sm ${checked ? 'bg-[hsl(var(--secondary)/.45)] text-[hsl(var(--primary))]' : 'hover:bg-[hsl(var(--muted))]'}`}>
                      <input type="checkbox" checked={checked} onChange={() => setCoTeachers((current) => checked ? current.filter((id) => id !== teacher.clerkUserId) : [...current, teacher.clerkUserId])} data-testid={`checkbox-group-co-teacher-${group.id}-${teacher.clerkUserId}`} />
                      <span className="font-semibold">{teacher.displayName}</span>
                    </label>
                  );
                })}
            </div>
          </div>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] md:col-span-2">Seçilən bütün müəllimlər bu qrupun eyni tələbələri ilə dərs keçir: cədvəldə görür, dərs linki yerləşdirir, davamiyyət yazır, tapşırıq və test verir. Müəllim təyin olunanda qrup tələbələrə görünür.</p>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 md:col-span-2" role="alert">{error}</p>}
          <div className="flex justify-end gap-2 md:col-span-2">
            {hasTeacher && <button type="button" className="focus-ring rounded-lg px-3 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))]" onClick={() => setOpen(false)}>Ləğv et</button>}
            <button type="button" className="focus-ring rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" disabled={busy || !mainTeacher} onClick={() => void save()} data-testid={`button-group-save-teachers-${group.id}`}>{busy ? 'Saxlanılır...' : 'Yadda saxla'}</button>
          </div>
        </div>
      )}
    </li>
  );
}

/** «Linklər»: dərsin Telegram / Zoom / Google Meet / dərs linki (dərsin bütün qrupları üçün ortaqdır). */
function CourseLinksEditor({ courseId, courseTitle, onClose, onSaved }: { courseId: number; courseTitle: string; onClose: () => void; onSaved: (text: string) => void }) {
  const [links, setLinks] = useState<Record<LinkKey, string> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void authFetch(apiUrl(`/admin/courses/${courseId}`), { cache: 'no-store' })
      .then(async (response) => {
        const result = await readJson<Partial<Record<LinkKey, string | null>>>(response);
        if (!response.ok) throw new Error(result.error || 'Linklər yüklənmədi.');
        if (!cancelled) setLinks(Object.fromEntries(LINK_FIELDS.map(([key]) => [key, result[key] ?? ''])) as Record<LinkKey, string>);
      })
      .catch((caught: unknown) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Linklər yüklənmədi.'); });
    return () => { cancelled = true; };
  }, [courseId]);
  const save = async () => {
    if (!links) return;
    const bad = LINK_FIELDS.find(([key]) => links[key].trim() && !/^https:\/\/\S+$/i.test(links[key].trim()));
    if (bad) { setError(`${bad[1]} https:// ilə başlamalıdır.`); return; }
    setBusy(true);
    setError('');
    try {
      const response = await authFetch(apiUrl(`/admin/courses/${courseId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(LINK_FIELDS.map(([key]) => [key, links[key].trim() || null]))),
      });
      const result = await readJson<object>(response);
      if (!response.ok) throw new Error(result.error || 'Linklər yadda saxlanılmadı.');
      onSaved(`${courseTitle}: dərs linkləri yadda saxlanıldı.`);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Linklər yadda saxlanılmadı.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-[hsl(var(--accent)/.7)] bg-[hsl(var(--background))] p-3" data-testid={`panel-course-links-${courseId}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black text-[hsl(var(--primary))]">Dərs linkləri</p>
        <button type="button" className="focus-ring rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Bağla" onClick={onClose}><X size={15} /></button>
      </div>
      <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Linklər bu dərsin bütün qrupları üçün ortaqdır. Yeni link əlavə olunanda tələbələrə bildiriş gedir.</p>
      {!links ? <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{error || 'Yüklənir...'}</p> : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {LINK_FIELDS.map(([key, label]) => (
            <label key={key} className="block text-[11px] font-bold text-[hsl(var(--primary))]">{label}
              <input type="url" inputMode="url" placeholder="https://" className={`${selectClass} mt-1`} value={links[key]} onChange={(event) => setLinks((current) => current ? { ...current, [key]: event.target.value } : current)} data-testid={`input-course-link-${key}-${courseId}`} />
            </label>
          ))}
        </div>
      )}
      {links && error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800" role="alert">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className="focus-ring rounded-lg px-3 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))]" onClick={onClose}>Ləğv et</button>
        <button type="button" className="focus-ring rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" disabled={busy || !links} onClick={() => void save()} data-testid={`button-save-course-links-${courseId}`}>{busy ? 'Saxlanılır...' : 'Yadda saxla'}</button>
      </div>
    </div>
  );
}

type LinkKey = 'telegramUrl' | 'zoomUrl' | 'googleMeetUrl' | 'lessonUrl';
const LINK_FIELDS: ReadonlyArray<readonly [LinkKey, string]> = [
  ['telegramUrl', 'Telegram linki'],
  ['zoomUrl', 'Zoom linki'],
  ['googleMeetUrl', 'Google Meet linki'],
  ['lessonUrl', 'Dərs linki'],
];

function GroupCard({ group, open, onToggle, onAssignTeacher, onChanged, onNotice, onDeleted }: {
  group: GroupView;
  open: boolean;
  onToggle: () => void;
  onAssignTeacher?: () => void;
  onChanged: () => Promise<void>;
  onNotice: (notice: Notice) => void;
  onDeleted: () => Promise<void>;
}) {
  const full = groupIsFull(group);
  const hasTeacher = groupHasTeacher(group);
  return (
    <article className={`min-w-0 rounded-xl border bg-[hsl(var(--card))] p-3 shadow-[var(--shadow-xs)] ${open ? 'border-[hsl(var(--primary))] md:col-span-2' : hasTeacher ? 'border-[hsl(var(--border))]' : 'border-amber-300'}`} data-testid={`card-group-${group.id}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`panel-group-${group.id}`} className="focus-ring flex w-full items-start justify-between gap-3 rounded-lg text-left" data-testid={`button-open-group-${group.id}`}>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[hsl(var(--primary))]">{group.courseTitle} <span className="font-semibold text-[hsl(var(--muted-foreground))]">· {termLabel(group.termNumber)}</span></p>
          {hasTeacher
            ? <p className="mt-0.5 truncate text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{groupTeacherText(group)}</p>
            : <p className="mt-1"><Badge tone="warn">{NO_TEACHER_LABEL}</Badge></p>}
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[hsl(var(--muted-foreground))]"><CalendarRange size={12} className="shrink-0" /> <span className="truncate">{groupScheduleLabel(group)}</span></p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${full ? 'bg-amber-100 text-amber-900' : 'bg-[hsl(var(--secondary)/.45)] text-[hsl(var(--secondary-foreground))]'}`} data-testid={`text-group-capacity-${group.id}`}><UsersRound size={11} className="mr-1 inline" />{groupCapacityLabel(group)}</span>
          {group.pendingCount > 0 && <span className="text-[10px] font-bold text-amber-800">{group.pendingCount} gözləyən seçim</span>}
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[hsl(var(--primary))]">{open ? 'Bağla' : 'Aç'} <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} /></span>
        </div>
      </button>
      {open && <GroupDetail group={group} onAssignTeacher={onAssignTeacher} onChanged={onChanged} onNotice={onNotice} onDeleted={onDeleted} />}
    </article>
  );
}

function GroupDetail({ group, onAssignTeacher, onChanged, onNotice, onDeleted }: {
  group: GroupView;
  onAssignTeacher?: () => void;
  onChanged: () => Promise<void>;
  onNotice: (notice: Notice) => void;
  onDeleted: () => Promise<void>;
}) {
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [rosterError, setRosterError] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [linksOpen, setLinksOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(false);

  const loadRoster = useCallback(async () => {
    setRosterError('');
    try {
      const response = await authFetch(apiUrl(`/admin/groups/${group.id}/students`), { cache: 'no-store' });
      const result = await readJson<RosterResponse>(response);
      if (!response.ok || !Array.isArray(result.members)) throw new Error(result.error || 'Qrupun tələbələri yüklənmədi.');
      setRoster(result);
    } catch (error) {
      setRosterError(error instanceof Error ? error.message : 'Qrupun tələbələri yüklənmədi.');
    }
  }, [group.id]);
  useEffect(() => { void loadRoster(); }, [loadRoster]);

  const removeStudent = async (student: Student) => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await authFetch(apiUrl(`/admin/groups/${group.id}/students/${student.profileId}`), { method: 'DELETE' });
      const result = await readJson<{ removed?: number }>(response);
      if (!response.ok) throw new Error(result.error || 'Tələbə qrupdan çıxarılmadı.');
      setConfirmRemoveId(null);
      setNotice({ text: `${student.firstName} ${student.lastName} qrupdan çıxarıldı.`, error: false });
      await Promise.all([loadRoster(), onChanged()]);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Tələbə qrupdan çıxarılmadı.', error: true });
    } finally {
      setBusy(false);
    }
  };

  const addStudents = async () => {
    if (!picked.length) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await authFetch(apiUrl(`/admin/groups/${group.id}/students`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds: picked }),
      });
      const result = await readJson<{ added?: number[] }>(response);
      if (!response.ok) throw new Error(result.error || 'Tələbələr qrupa əlavə edilmədi.');
      const count = result.added?.length ?? 0;
      setPicked([]);
      setPickerOpen(false);
      setPickerSearch('');
      setNotice({ text: count ? `${count} tələbə qrupa əlavə edildi.` : 'Seçilən tələbələr artıq bu qrupdadır.', error: false });
      await Promise.all([loadRoster(), onChanged()]);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Tələbələr qrupa əlavə edilmədi.', error: true });
    } finally {
      setBusy(false);
    }
  };

  // Silmə axını: 1) təsdiq, 2) qrupda məlumat varsa server siyahısı ilə ikinci təsdiq.
  const deleteGroup = async () => {
    setBusy(true);
    setNotice(null);
    try {
      let response = await authFetch(apiUrl(`/admin/resources/${group.id}`), { method: 'DELETE' });
      if (response.status === 409) {
        const conflict = await readJson<{ summary?: string[]; requiresConfirmation?: boolean }>(response);
        if (!conflict.requiresConfirmation) throw new Error(conflict.error || 'Qrup silinə bilmədi.');
        const details = conflict.summary?.length ? conflict.summary.join(', ') : 'tələbə və qiymət məlumatları';
        const ok = window.confirm(`Diqqət! Bu qrupda məlumat var: ${details}.\n\nQrup silinsə, tələbələrin bu qrupa təyinatı, qrupun tapşırıqları, testləri, cavablar, qiymətlər və dərsə qoşulma qeydləri birdəfəlik silinəcək. Bu əməliyyat geri qaytarılmır.\n\nYenə də silmək istəyirsiniz?`);
        if (!ok) { setDeleteStep(false); return; }
        response = await authFetch(apiUrl(`/admin/resources/${group.id}?confirm=1`), { method: 'DELETE' });
      }
      if (!response.ok) {
        const result = await readJson<object>(response);
        throw new Error(result.error || 'Qrup silinə bilmədi.');
      }
      onNotice({ error: false, text: `${group.courseTitle} · ${groupHasTeacher(group) ? resourceTeacherLabel(group) : NO_TEACHER_LABEL} (${termLabel(group.termNumber)}) qrupu silindi. Dərs qrupsuz qalıbsa, onu «Cədvəl hazırlama» bölməsindən silmək olar.` });
      await onDeleted();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : 'Qrup silinə bilmədi.', error: true });
      setDeleteStep(false);
    } finally {
      setBusy(false);
    }
  };

  const capacityLeft = group.studentCapacity > 0 && roster ? Math.max(0, group.studentCapacity - roster.members.length) : null;
  const pickerRows = (roster?.candidates ?? []).filter((candidate) => !candidate.inGroup && matchesStudentSearch(candidate, pickerSearch));

  return (
    <div id={`panel-group-${group.id}`} className="mt-3 space-y-3 border-t border-[hsl(var(--border))] pt-3" data-testid={`panel-group-${group.id}`}>
      <NoticeLine notice={notice} />
      <div className="flex flex-wrap gap-2">
        {group.canManageStudents && <button type="button" className={smallButton} aria-expanded={pickerOpen} onClick={() => { setPickerOpen((value) => !value); setPicked([]); }} disabled={!roster} data-testid={`button-group-add-students-${group.id}`}><UserPlus size={13} /> Tələbə əlavə et</button>}
        {group.canEditLinks && <button type="button" className={smallButton} aria-expanded={linksOpen} onClick={() => setLinksOpen((value) => !value)} data-testid={`button-group-links-${group.id}`}><Link2 size={13} /> Linklər</button>}
        {onAssignTeacher && <button type="button" className={smallButton} onClick={onAssignTeacher} data-testid={`button-group-edit-teachers-${group.id}`}><UserCog size={13} /> {groupHasTeacher(group) ? 'Müəllim əlavə et / çıxar' : 'Müəllim təyin et'} →</button>}
        {group.canDelete && !deleteStep && <button type="button" className={`${smallButton} text-[hsl(var(--destructive))]`} onClick={() => setDeleteStep(true)} data-testid={`button-group-delete-${group.id}`}><Trash2 size={13} /> Qrupu sil</button>}
      </div>
      {deleteStep && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-900" data-testid={`confirm-group-delete-${group.id}`}>
          <span className="min-w-0 flex-1">{group.courseTitle} · {groupHasTeacher(group) ? resourceTeacherLabel(group) : NO_TEACHER_LABEL} ({termLabel(group.termNumber)}) qrupunu silmək istədiyinizə əminsiniz?</span>
          <button type="button" className="focus-ring rounded-lg px-3 py-1.5 font-bold text-[hsl(var(--muted-foreground))]" onClick={() => setDeleteStep(false)} disabled={busy}>Ləğv et</button>
          <button type="button" className="focus-ring rounded-lg bg-red-700 px-3 py-1.5 font-bold text-white disabled:opacity-50" onClick={() => void deleteGroup()} disabled={busy} data-testid={`button-group-delete-confirm-${group.id}`}>Bəli, sil</button>
        </div>
      )}
      {linksOpen && <CourseLinksEditor courseId={group.courseId} courseTitle={group.courseTitle} onClose={() => setLinksOpen(false)} onSaved={(text) => onNotice({ text, error: false })} />}
      {pickerOpen && roster && (
        <div className="rounded-xl border border-[hsl(var(--accent)/.7)] bg-[hsl(var(--background))] p-3" data-testid={`panel-group-student-picker-${group.id}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-[hsl(var(--primary))]">{termLabel(group.termNumber)} tələbələri</p>
            <button type="button" className="focus-ring rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Bağla" onClick={() => setPickerOpen(false)}><X size={15} /></button>
          </div>
          <label className="relative mt-2 block">
            <span className="sr-only">Tələbə axtar</span>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input value={pickerSearch} onChange={(event) => setPickerSearch(event.target.value)} placeholder="Ad, soyad və ya T-nömrə" className={`${selectClass} pl-8`} data-testid={`input-group-student-search-${group.id}`} />
          </label>
          {capacityLeft !== null && <p className="mt-2 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">Qrupda {capacityLeft} boş yer var.</p>}
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {pickerRows.length === 0
              ? <p className="p-2 text-xs text-[hsl(var(--muted-foreground))]">{roster.candidates.some((candidate) => !candidate.inGroup) ? 'Axtarışa uyğun tələbə tapılmadı.' : 'Bu semestrdə qrupa əlavə ediləcək başqa tələbə yoxdur.'}</p>
              : pickerRows.map((candidate) => {
                const checked = picked.includes(candidate.profileId);
                const overCapacity = capacityLeft !== null && !checked && picked.length >= capacityLeft;
                const disabled = Boolean(candidate.unavailableReason) || overCapacity;
                return (
                  <label key={candidate.profileId} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${checked ? 'bg-[hsl(var(--secondary)/.45)] text-[hsl(var(--primary))]' : 'hover:bg-[hsl(var(--muted))]'} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => setPicked((current) => checked ? current.filter((id) => id !== candidate.profileId) : [...current, candidate.profileId])} data-testid={`checkbox-group-candidate-${group.id}-${candidate.profileId}`} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{candidate.firstName} {candidate.lastName}</span>
                      <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{studentCode(candidate.studentNumber)}{candidate.unavailableReason ? ` · ${candidate.unavailableReason}` : ''}</span>
                    </span>
                  </label>
                );
              })}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[hsl(var(--secondary-foreground))]">{picked.length} tələbə seçilib</span>
            <button type="button" className="focus-ring rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" disabled={busy || !picked.length} onClick={() => void addStudents()} data-testid={`button-group-add-selected-${group.id}`}>Seçilənləri əlavə et</button>
          </div>
        </div>
      )}
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Qrupun tələbələri{roster ? ` · ${roster.members.length}` : ''}</p>
        {rosterError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{rosterError}</p>
          : !roster ? <p className="text-xs text-[hsl(var(--muted-foreground))]">Tələbələr yüklənir...</p>
          : roster.members.length === 0 ? <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-3 text-center text-xs text-[hsl(var(--muted-foreground))]">Bu qrupda hələ tələbə yoxdur.</p>
          : <ul className="divide-y divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))]" data-testid={`list-group-members-${group.id}`}>
              {roster.members.map((student) => (
                <li key={student.profileId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" data-testid={`row-group-member-${group.id}-${student.profileId}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[hsl(var(--primary))]">{student.firstName} {student.lastName}</span>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{studentCode(student.studentNumber)}</span>
                  </span>
                  {group.canManageStudents && (confirmRemoveId === student.profileId
                    ? <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                        <span className="text-red-800">Qrupdan çıxarılsın?</span>
                        <button type="button" className="focus-ring rounded-lg px-2 py-1 font-bold text-[hsl(var(--muted-foreground))]" onClick={() => setConfirmRemoveId(null)} disabled={busy}>Xeyr</button>
                        <button type="button" className="focus-ring rounded-lg bg-red-700 px-2.5 py-1 font-bold text-white disabled:opacity-50" onClick={() => void removeStudent(student)} disabled={busy} data-testid={`button-group-remove-confirm-${group.id}-${student.profileId}`}>Bəli, çıxar</button>
                      </span>
                    : <button type="button" className={`${smallButton} text-[hsl(var(--destructive))]`} onClick={() => setConfirmRemoveId(student.profileId)} data-testid={`button-group-remove-${group.id}-${student.profileId}`}><UserMinus size={13} /> Çıxar</button>)}
                </li>
              ))}
            </ul>}
        {roster && roster.pendingCount > 0 && <p className="mt-1.5 text-[11px] font-semibold text-amber-800">{roster.pendingCount} tələbənin bu qrupa seçimi təsdiq gözləyir («Tələbələri idarə et» → «Müəllim seçimləri»).</p>}
      </div>
    </div>
  );
}

/** «Mənim cədvəlim» → dərsin tələbə siyahısı (yalnız baxış); dəyişiklik «Qruplar» bölməsində edilir. */
export function GroupRosterReadOnly({ resourceId, onOpenGroups }: { resourceId: number; onOpenGroups?: () => void }) {
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setRoster(null);
    setError('');
    void authFetch(apiUrl(`/admin/groups/${resourceId}/students`), { cache: 'no-store' })
      .then(async (response) => {
        const result = await readJson<RosterResponse>(response);
        if (!response.ok || !Array.isArray(result.members)) throw new Error(result.error || 'Tələbələr yüklənmədi.');
        if (!cancelled) setRoster(result);
      })
      .catch((caught: unknown) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Tələbələr yüklənmədi.'); });
    return () => { cancelled = true; };
  }, [resourceId]);
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] p-3" data-testid={`section-teacher-lesson-roster-${resourceId}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]"><UsersRound size={13} /> Qrupun tələbələri{roster ? ` · ${roster.members.length}${roster.studentCapacity > 0 ? ` / ${roster.studentCapacity}` : ''}` : ''}</p>
        {onOpenGroups && <button type="button" className={smallButton} onClick={onOpenGroups} data-testid={`button-roster-open-groups-${resourceId}`}><UserPlus size={13} /> Qruplarda idarə et</button>}
      </div>
      {error ? <p className="text-xs font-semibold text-red-800">{error}</p>
        : !roster ? <p className="text-xs text-[hsl(var(--muted-foreground))]">Tələbələr yüklənir...</p>
        : roster.members.length === 0 ? <p className="text-xs text-[hsl(var(--muted-foreground))]">Bu qrupda hələ tələbə yoxdur.</p>
        : <ul className="grid gap-1 sm:grid-cols-2">
            {roster.members.map((student) => (
              <li key={student.profileId} className="rounded-lg bg-[hsl(var(--card))] px-3 py-1.5 text-sm"><span className="font-semibold text-[hsl(var(--primary))]">{student.firstName} {student.lastName}</span> <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{studentCode(student.studentNumber)}</span></li>
            ))}
          </ul>}
      {roster && roster.pendingCount > 0 && <p className="mt-1.5 text-[11px] font-semibold text-amber-800">{roster.pendingCount} tələbənin seçimi təsdiq gözləyir.</p>}
    </div>
  );
}
