import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  BookOpenText,
  CheckCircle2,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Download,
  Eye,
  FilePlus2,
  FileBadge,
  FileText,
  HelpCircle,
  GraduationCap,
  LogOut,
  Link2,
  Library,
  Mail,
  Megaphone,
  Plus,
  Pencil,
  Quote,
  Send,
  ShieldCheck,
  UserCog,
  UsersRound,
  Users,
  RefreshCw,
  Search,
  X,
  Trash2,
  ClipboardCheck,
  ClipboardList,
  Paperclip,
  BookMarked,
} from 'lucide-react';
import {
  Application,
  type AcademicProfile,
  type AdminUser,
  type UserProfileHistoryEntry,
  type AttendanceUpdate,
  type AcademicGradesUpdate,
  type Article,
  type ArticleInput,
  type Announcement,
  type AdminAssignment,
  type AdminAssignmentSubmission,
  type AssignmentAttachment,
  type AssignmentUploadInput,
  type AssignmentInput,
  type AssignmentUpdate,
  AnnouncementInputType,
  CourseInput,
  type DailyBenefit,
  type DailyBenefitInput,
  LearningResource,
  type AnnouncementInput,
  getGetAdminResourcesQueryKey,
  getGetAdminTeachersQueryKey,
  getGetAdminArticlesQueryKey,
  getGetAdminDailyBenefitsQueryKey,
  getGetArticlesQueryKey,
  getGetDailyBenefitQueryKey,
  getGetAnnouncementsQueryKey,
  getGetAdminAnnouncementsQueryKey,
  getGetCoursesQueryKey,
  getGetDashboardQueryKey,
  getGetAdminAcademicProfileQueryKey,
  getGetAdminAcademicProfilesQueryKey,
  getGetAdminApplicationsQueryKey,
  getGetAdminStudentsQueryKey,
  getGetGraduationCandidatesQueryKey,
  getGetSystemStatisticsQueryKey,
  getGetAdminUsersQueryKey,
  getGetAdminUserProfileQueryKey,
  getGetAdminUserProfileHistoryQueryKey,
  getGetAdminAttendanceExcusesQueryKey,
  getGetAdminStudentDeletionAuditQueryKey,
  getGetAdminSubjectRemovalRequestsQueryKey,
  getGetAdminAssignmentsQueryKey,
  getGetAssignmentSubmissionsQueryKey,
  getGetOwnUserProfileQueryKey,
  useCreateAnnouncement,
  useGetAdminAnnouncements,
  useUpdateAnnouncementById,
  useDeleteAnnouncement,
  useCreateArticle,
  useCreateDailyBenefit,
  useGetAdminResources,
  useGetAdminTeacherSchedule,
  useGetAdminArticles,
  useGetAdminDailyBenefits,
  useGetAdminApplications,
  useGetAdminApplicationWindow,
  useUpdateAdminApplicationWindow,
  useGetAdminAcademicProfile,
  useGetAdminAcademicProfiles,
  useGetAdminUsers,
  useGetOwnUserProfile,
  useGetAdminAttendanceExcuses,
  useGetAdminStudentDeletionAudit,
  useGetAdminSubjectRemovalRequests,
  useGetAdminStudents,
  useGetAdminAssignments,
  useGetAssignmentSubmissions,
  useRequestAdminAssignmentUploadUrl,
  useCreateAssignment,
  useUpdateAssignment,
  useGradeAssignmentSubmission,
  useRequestAssignmentResubmission,
  useGetGraduationCandidates,
  useGraduateStudent,
  useDeleteAdminStudent,
  useDeleteAdminUser,
  useGetCourses,
  useUpdateAdminUserRole,
  useGetAdminUserProfile,
  useGetAdminUserProfileHistory,
  useUpdateAdminUserProfile,
  type AdminUserProfileInput,
  useUpdateAcademicProfile,
  useUpdateAcademicProfileAttendance,
  useUpdateAcademicProfileGrades,
  UserRoleUpdateInputRole,
  useGetAdminExams,
  getGetAdminExamsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth, useClerk, useUser } from '@clerk/react';
import { authFetch } from '@/lib/clerk-token';
import { SchedulePdfButton } from '@/components/schedule-pdf-button';
import { Link, useLocation } from 'wouter';
import { AiAssistantLauncher } from '@/components/ai-assistant';
import { ArticlesLink, HomeLink } from '@/components/home-link';
import { LanguageSwitch, useI18n } from '@/lib/i18n';
import { MessageCenter } from '@/components/message-center';
import { loadUnansweredQuestionCount, QaCenter } from '@/components/qa-center';
import { AdminExamsSection } from '@/components/exam-module';
import { GraduateCertificateSection } from '@/components/graduate-certificate';
import { MedreseLibrary } from '@/components/medrese-library';
import { GroupManagementSection, GroupRosterReadOnly, SetupSteps, type GroupsView } from '@/components/group-management';
import { CourseBookDraftsFields, CourseBooksEditor, courseBookDraftFromView, courseBookEntriesFromDrafts, type CourseBookDraft } from '@/components/course-books';
import { useCourseBooks } from '@/lib/course-books';
import { useLibraryCatalog } from '@/lib/library';
import { formatFullName, formatPersonName } from '@/lib/utils';
import { accountProfileQueryRetry } from '@/lib/account-profile-retry';
import { isCoTaught, resourceTeacherLabel, teachesResource } from '@/lib/co-teachers';
import { staffStudentNote, type StudentRecordInfo } from '@/lib/staff-student-note';

type Tab = 'groups' | 'course-activation' | 'schedule-prep' | 'announcement' | 'student-notifications' | 'article' | 'benefit' | 'schedule' | 'teachers-schedule' | 'messages' | 'questions' | 'student-management' | 'application' | 'exams' | 'users' | 'statistics' | 'audit-history' | 'graduation-certificates' | 'library';


function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">{hint}</span>}
    </label>
  );
}

const assignmentFileTypes = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'text/plain']);

function AdminAssignmentFileList({ attachments }: { attachments: AssignmentAttachment[] }) {
  if (!attachments.length) return null;
  return <div className="mt-3 space-y-2">{attachments.map((attachment) => <a key={attachment.id} href={attachment.downloadUrl} target="_blank" rel="noreferrer" className="focus-ring flex items-center gap-2 rounded-lg bg-[hsl(var(--muted)/.45)] px-3 py-2 text-xs font-semibold text-[hsl(var(--primary))]" data-testid={`link-admin-assignment-attachment-${attachment.id}`}><Paperclip size={14} /> <span className="truncate">{attachment.originalName}</span><span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">{Math.ceil(attachment.size / 1024)} KB</span></a>)}</div>;
}

type AssignmentDraft = {
  courseId: string;
  resourceId: string;
  termNumber: string;
  teacherClerkUserId: string;
  title: string;
  description: string;
  dueAt: string;
  maxScore: string;
};

const emptyAssignmentDraft: AssignmentDraft = { courseId: '', resourceId: '', termNumber: '1', teacherClerkUserId: '', title: '', description: '', dueAt: '', maxScore: '100' };

function assignmentDraftFromItem(item: AdminAssignment): AssignmentDraft {
  return { courseId: String(item.courseId), resourceId: String(item.resourceId), termNumber: String(item.termNumber), teacherClerkUserId: item.teacherClerkUserId, title: item.title, description: item.description, dueAt: item.dueAt.slice(0, 16), maxScore: String(item.maxScore) };
}

function AdminSubmissionRow({ assignment, submission, onRefresh }: { assignment: AdminAssignment; submission: AdminAssignmentSubmission; onRefresh: () => void }) {
  const queryClient = useQueryClient();
  const gradeMutation = useGradeAssignmentSubmission();
  const resubmissionMutation = useRequestAssignmentResubmission();
  const [score, setScore] = useState(submission.score === null ? '' : String(submission.score));
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const saveGrade = async () => {
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 1000) { setError('Bal 0 ilə 1000 arasında olmalıdır.'); return; }
    setError('');
    try {
      await gradeMutation.mutateAsync({ assignmentId: assignment.id, submissionId: submission.id, data: { score: numericScore, feedback: feedback.trim() } });
      await queryClient.invalidateQueries({ queryKey: getGetAssignmentSubmissionsQueryKey(assignment.id) });
      await queryClient.invalidateQueries({ queryKey: getGetAdminAssignmentsQueryKey() });
      setNotice('Qiymət yadda saxlanıldı.');
      onRefresh();
    } catch (mutationError) { setError(mutationError instanceof Error ? mutationError.message : 'Qiyməti saxlamaq mümkün olmadı.'); }
  };
  const requestResubmission = async () => {
    if (!feedback.trim()) { setError('Yenidən təhvil tələbi üçün rəy yazın.'); return; }
    setError('');
    try {
      await resubmissionMutation.mutateAsync({ assignmentId: assignment.id, submissionId: submission.id, data: { feedback: feedback.trim() } });
      await queryClient.invalidateQueries({ queryKey: getGetAssignmentSubmissionsQueryKey(assignment.id) });
      await queryClient.invalidateQueries({ queryKey: getGetAdminAssignmentsQueryKey() });
      setNotice('Yenidən təhvil tələbi göndərildi.');
      onRefresh();
    } catch (mutationError) { setError(mutationError instanceof Error ? mutationError.message : 'Tələb göndərilmədi.'); }
  };
  return <article className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4" data-testid={`card-assignment-submission-${submission.id}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-[hsl(var(--primary))]">{submission.studentName}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Tələbə № {submission.studentNumber} · {submission.email}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${submission.status === 'graded' ? 'bg-emerald-100 text-emerald-800' : submission.status === 'resubmission_requested' ? 'bg-amber-100 text-amber-900' : 'bg-[hsl(var(--secondary)/.55)] text-[hsl(var(--secondary-foreground))]'}`}>{submission.status === 'graded' ? 'Qiymətləndirilib' : submission.status === 'resubmission_requested' ? 'Yenidən təhvil gözlənilir' : 'Yoxlanılmayıb'}</span></div>
    {submission.answerText && <p className="mt-4 whitespace-pre-wrap rounded-lg bg-[hsl(var(--muted)/.32)] p-3 text-sm leading-6" data-testid={`text-submission-answer-${submission.id}`}>{submission.answerText}</p>}
    <AdminAssignmentFileList attachments={submission.attachments} />
    <div className="mt-4 grid gap-3 sm:grid-cols-[120px_1fr]"><label className="text-xs font-bold text-[hsl(var(--primary))]">Bal<input type="number" min="0" max="1000" value={score} onChange={(event) => setScore(event.target.value)} className={`${inputClass} mt-2`} data-testid={`input-submission-score-${submission.id}`} /></label><label className="text-xs font-bold text-[hsl(var(--primary))]">Rəy<textarea rows={2} maxLength={5000} value={feedback} onChange={(event) => setFeedback(event.target.value)} className={`${inputClass} mt-2 resize-y`} placeholder="Tələbəyə qısa rəy..." data-testid={`input-submission-feedback-${submission.id}`} /></label></div>
    {error && <p className="mt-3 text-xs font-semibold text-[hsl(var(--destructive))]" data-testid={`status-submission-error-${submission.id}`}>{error}</p>}
    {notice && <p className="mt-3 text-xs font-semibold text-emerald-700" data-testid={`status-submission-success-${submission.id}`}>{notice}</p>}
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={gradeMutation.isPending} onClick={() => void saveGrade()} className={buttonClass} data-testid={`button-grade-submission-${submission.id}`}><ClipboardCheck size={15} /> {gradeMutation.isPending ? 'Saxlanır...' : 'Balı və rəyi saxla'}</button><button type="button" disabled={resubmissionMutation.isPending} onClick={() => void requestResubmission()} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--accent)/.7)] bg-[hsl(var(--accent)/.14)] px-4 py-3 text-sm font-bold text-[hsl(var(--primary))] disabled:opacity-50" data-testid={`button-request-resubmission-${submission.id}`}>Yenidən təhvil tələb et</button></div>
  </article>;
}

function AdminAssignmentSubmissions({ assignment, onClose }: { assignment: AdminAssignment; onClose: () => void }) {
  const submissionsQuery = useGetAssignmentSubmissions(assignment.id, { query: { queryKey: getGetAssignmentSubmissionsQueryKey(assignment.id) } });
  return <div className="mt-5 rounded-2xl border border-[hsl(var(--accent)/.55)] bg-[hsl(var(--accent)/.08)] p-5" data-testid={`section-assignment-submissions-${assignment.id}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Təhvil paneli</p><h4 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{assignment.title}</h4></div><button type="button" onClick={onClose} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Təhvil panelini bağla" data-testid="button-close-assignment-submissions"><X size={17} /></button></div>
    <div className="mt-3 flex items-center gap-3 text-xs font-semibold text-[hsl(var(--muted-foreground))]"><span>{assignment.submissionCount} təhvil</span><span>{assignment.gradedCount} qiymətləndirilib</span><button type="button" onClick={() => void submissionsQuery.refetch()} className="focus-ring ml-auto inline-flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 text-[hsl(var(--primary))]" data-testid="button-reload-assignment-submissions"><RefreshCw size={13} /> Yenilə</button></div>
    {submissionsQuery.isLoading ? <div className="mt-4 space-y-3"><div className="skeleton h-28 rounded-xl" /><div className="skeleton h-28 rounded-xl" /></div> : submissionsQuery.isError ? <div className="mt-4 rounded-xl bg-[hsl(var(--destructive)/.08)] p-4 text-sm text-[hsl(var(--destructive))]">Təhvilləri yükləmək mümkün olmadı. <button type="button" onClick={() => void submissionsQuery.refetch()} className="font-bold underline" data-testid="button-retry-assignment-submissions">Yenidən yoxla</button></div> : !submissionsQuery.data?.length ? <p className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">Bu tapşırığa hələ təhvil göndərilməyib.</p> : <div className="mt-4 space-y-3">{submissionsQuery.data.map((submission) => <AdminSubmissionRow key={submission.id} assignment={assignment} submission={submission} onRefresh={() => void submissionsQuery.refetch()} />)}</div>}
  </div>;
}

function AdminAssignmentForm({ editing, resources, onCancel, onSaved }: { editing: AdminAssignment | null; resources: LearningResource[]; onCancel: () => void; onSaved: () => void }) {
  const createMutation = useCreateAssignment();
  const updateMutation = useUpdateAssignment();
  const uploadMutation = useRequestAdminAssignmentUploadUrl();
  const [draft, setDraft] = useState<AssignmentDraft>(() => editing ? assignmentDraftFromItem(editing) : emptyAssignmentDraft);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const resourceOptions = resources.filter((resource) => resource.teacherClerkUserId).sort((a, b) => a.termNumber - b.termNumber || a.title.localeCompare(b.title));
  const selectedResource = resourceOptions.find((resource) => resource.id === Number(draft.resourceId));
  const isPending = createMutation.isPending || updateMutation.isPending || uploadMutation.isPending;
  const selectResource = (resourceId: string) => {
    const resource = resourceOptions.find((item) => item.id === Number(resourceId));
    setDraft((current) => ({ ...current, resourceId, courseId: resource ? String(resource.courseId) : '', termNumber: resource ? String(resource.termNumber) : current.termNumber, teacherClerkUserId: resource?.teacherClerkUserId ?? '' }));
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.resourceId || !draft.title.trim() || !draft.description.trim() || !draft.dueAt) { setError('Fənn qrupu, başlıq, izah və son tarix mütləqdir.'); return; }
    if (new Date(draft.dueAt).getTime() <= Date.now() && !editing) { setError('Son tarix gələcək vaxt olmalıdır.'); return; }
    if (files.length > 5) { setError('Bir tapşırığa ən çox 5 fayl əlavə edə bilərsiniz.'); return; }
    setError('');
    try {
      const attachmentIntentIds: number[] = [];
      if (files.some((file) => !assignmentFileTypes.has(file.type) || file.size > 10 * 1024 * 1024)) {
        throw new Error('Hər fayl PDF, DOC, DOCX, PNG, JPG və ya TXT olmalı və 10 MB-dan böyük olmamalıdır.');
      }
      for (const file of files) {
        const contentType = file.type as AssignmentUploadInput['contentType'];
        const uploaded = await uploadMutation.mutateAsync({ data: { name: file.name, size: file.size, contentType } });
        const response = uploaded as typeof uploaded & { id?: number; intentId?: number };
        const putResponse = await fetch(uploaded.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!putResponse.ok) throw new Error('Faylı yükləmək mümkün olmadı.');
        const intentId = response.id ?? response.intentId;
        if (!intentId) throw new Error('Fayl sessiyası üçün intent ID qaytarılmadı. Mətnlə davam edin və ya API müqaviləsini yeniləyin.');
        attachmentIntentIds.push(intentId);
      }
      const common = { title: draft.title.trim(), description: draft.description.trim(), dueAt: new Date(draft.dueAt).toISOString(), maxScore: Number(draft.maxScore), ...(attachmentIntentIds.length ? { attachmentIntentIds } : {}) };
      if (editing) await updateMutation.mutateAsync({ assignmentId: editing.id, data: common as AssignmentUpdate });
      else await createMutation.mutateAsync({ data: { courseId: Number(draft.courseId), resourceId: Number(draft.resourceId), termNumber: Number(draft.termNumber), teacherClerkUserId: draft.teacherClerkUserId || undefined, ...common } as AssignmentInput });
      onSaved();
    } catch (mutationError) { setError(mutationError instanceof Error ? mutationError.message : 'Tapşırığı saxlamaq mümkün olmadı.'); }
  };
  return <form onSubmit={(event) => void save(event)} className="rounded-2xl border border-[hsl(var(--accent)/.6)] bg-[hsl(var(--accent)/.1)] p-5" data-testid="form-admin-assignment"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{editing ? 'Tapşırığı yenilə' : 'Yeni tapşırıq'}</p><h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{editing ? editing.title : 'Qrup üçün ev tapşırığı yarat'}</h3></div><button type="button" onClick={onCancel} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Formu bağla" data-testid="button-cancel-assignment-form"><X size={17} /></button></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Müəllim qrupu"><select required disabled={Boolean(editing)} value={draft.resourceId} onChange={(event) => selectResource(event.target.value)} className={inputClass} data-testid="select-assignment-resource"><option value="">Qrup seçin</option>{resourceOptions.map((resource) => <option key={resource.id} value={resource.id}>{resource.title} · {resource.teacherName ?? 'Müəllim'} · {resource.termNumber}-ci semestr</option>)}</select></Field><Field label="Maksimum bal"><input required type="number" min="1" max="1000" value={draft.maxScore} onChange={(event) => setDraft({ ...draft, maxScore: event.target.value })} className={inputClass} data-testid="input-assignment-max-score" /></Field></div>
     {selectedResource && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Fənn: <strong className="text-[hsl(var(--primary))]">{selectedResource.title}</strong> · tələbələr yalnız bu müəllim qrupundan əlavə olunacaq.</p>}
     {editing?.attachments.length ? <div className="mt-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] p-3"><p className="text-xs font-bold text-[hsl(var(--primary))]">Mövcud tapşırıq faylları</p><AdminAssignmentFileList attachments={editing.attachments} /></div> : null}
    <div className="mt-4 space-y-4"><Field label="Başlıq"><input required maxLength={200} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={inputClass} placeholder="Məsələn: 4-cü mövzu üzrə yazı" data-testid="input-assignment-title" /></Field><Field label="Tapşırığın izahı"><textarea required maxLength={12000} rows={5} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className={`${inputClass} resize-y`} placeholder="Tələbənin etməli olduğu işi aydın izah edin." data-testid="input-assignment-description" /></Field></div>
     <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Son tarix"><input required type="datetime-local" value={draft.dueAt} onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })} className={inputClass} data-testid="input-assignment-due-at" /></Field><Field label="Tapşırıq faylları" hint="PDF, DOC, DOCX, PNG, JPG və TXT · ən çox 5 fayl, hər biri 10 MB-a qədər"><input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} className={`${inputClass} file:mr-2 file:rounded-lg file:border-0 file:bg-[hsl(var(--secondary))] file:px-2 file:py-1 file:text-xs`} data-testid="input-assignment-attachments" />{files.length > 0 && <div className="mt-2 space-y-1.5 rounded-xl bg-[hsl(var(--muted)/.28)] p-2.5">{files.map((file, index) => <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-2 rounded-lg bg-[hsl(var(--card))] px-2.5 py-2 text-xs"><Paperclip size={14} className="shrink-0 text-[hsl(var(--secondary-foreground))]" /><span className="min-w-0 flex-1 truncate font-semibold">{file.name}</span><span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">{Math.max(1, Math.round(file.size / 1024))} KB</span><button type="button" onClick={() => { setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index)); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="focus-ring rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label={`${file.name} faylını sil`} data-testid={`button-remove-assignment-attachment-${index}`}><X size={14} /></button></div>)}</div>}</Field></div>
    {error && <p className="mt-4 rounded-xl bg-[hsl(var(--destructive)/.08)] p-3 text-xs font-semibold text-[hsl(var(--destructive))]" data-testid="status-assignment-form-error">{error}</p>}
    <div className="mt-5 flex flex-wrap gap-2"><button type="submit" disabled={isPending || !resourceOptions.length} className={buttonClass} data-testid="button-save-assignment"><FilePlus2 size={15} /> {isPending ? 'Yadda saxlanır...' : editing ? 'Dəyişiklikləri saxla' : 'Tapşırıq yarat'}</button><button type="button" onClick={onCancel} className="focus-ring rounded-xl border border-[hsl(var(--border))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary))]" data-testid="button-dismiss-assignment-form">Ləğv et</button></div>
  </form>;
}

function AdminAssignmentsSection({ resources, teacherClerkUserId }: { resources: LearningResource[]; teacherClerkUserId?: string }) {
  const queryClient = useQueryClient();
  const assignmentsQuery = useGetAdminAssignments(undefined, { query: { queryKey: getGetAdminAssignmentsQueryKey() } });
  const updateMutation = useUpdateAssignment();
  const [editing, setEditing] = useState<AdminAssignment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const assignments = assignmentsQuery.data ?? [];
  const assignmentResources = teacherClerkUserId
    ? resources.filter((resource) => teachesResource(resource, teacherClerkUserId))
    : resources;
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: getGetAdminAssignmentsQueryKey() }); };
  const closeAssignment = async (assignment: AdminAssignment) => {
    if (!window.confirm('Bu tapşırığı bağlamaq istəyirsiniz? Tələbələr yeni təhvil göndərə bilməyəcək.')) return;
    try { await updateMutation.mutateAsync({ assignmentId: assignment.id, data: { status: 'closed' } }); await refresh(); setNotice('Tapşırıq bağlandı.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Tapşırıq bağlanmadı.'); }
  };
  return <section className="space-y-5" data-testid="section-admin-assignments"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">Müəllim qrupları üzrə iş</p><h3 className="mt-1 font-serif text-3xl text-[hsl(var(--primary))]">Ev tapşırıqları</h3><p className="mt-2 max-w-xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">Yalnız idarə etdiyiniz müəllim qruplarına tapşırıq verin, təhvil gələndə bal və rəy əlavə edin.</p></div><div className="flex gap-2"><button type="button" onClick={() => void assignmentsQuery.refetch()} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--primary))]" data-testid="button-reload-admin-assignments"><RefreshCw size={14} /> Yenilə</button><button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className={buttonClass} data-testid="button-create-assignment"><Plus size={15} /> Yeni tapşırıq</button></div></div>
    {notice && <p className="rounded-xl bg-[hsl(var(--secondary)/.35)] p-3 text-xs font-semibold text-[hsl(var(--secondary-foreground))]" data-testid="status-admin-assignment-notice">{notice}</p>}
    {showForm && <AdminAssignmentForm editing={editing} resources={assignmentResources} onCancel={() => { setShowForm(false); setEditing(null); }} onSaved={() => { setShowForm(false); setEditing(null); void refresh(); setNotice(editing ? 'Tapşırıq yeniləndi.' : 'Tapşırıq yaradıldı.'); }} />}
    {assignmentsQuery.isLoading ? <div className="space-y-3"><div className="skeleton h-32 rounded-xl" /><div className="skeleton h-32 rounded-xl" /></div> : assignmentsQuery.isError ? <div className="rounded-xl border border-[hsl(var(--destructive)/.22)] bg-[hsl(var(--destructive)/.06)] p-4 text-sm text-[hsl(var(--destructive))]" data-testid="state-admin-assignments-error">Tapşırıqları yükləmək mümkün olmadı. <button type="button" onClick={() => void assignmentsQuery.refetch()} className="font-bold underline" data-testid="button-retry-admin-assignments">Yenidən cəhd et</button></div> : !assignments.length ? <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] px-5 py-10 text-center"><ClipboardCheck className="mx-auto text-[hsl(var(--secondary-foreground))]" /><p className="mt-3 text-sm font-bold text-[hsl(var(--primary))]">Hələ tapşırıq yoxdur</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">İlk tapşırığı yaradaraq qrupunuzun iş planını başladın.</p></div> : <div className="space-y-3">{assignments.map((assignment) => <div key={assignment.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.17)] p-4" data-testid={`card-admin-assignment-${assignment.id}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{assignment.courseTitle} · {assignment.teacherName} · {assignment.termNumber}-ci semestr</p><h4 className="mt-1 text-base font-bold text-[hsl(var(--primary))]">{assignment.title}</h4><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{assignmentDueLabel(assignment.dueAt, assignment.status)} · maksimum {assignment.maxScore} bal</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${assignment.status === 'closed' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>{assignment.status === 'closed' ? 'Bağlanıb' : 'Açıq'}</span></div><div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-lg bg-[hsl(var(--card))] px-2.5 py-2 font-semibold text-[hsl(var(--primary))]">{assignment.submissionCount} təhvil</span><span className="rounded-lg bg-[hsl(var(--card))] px-2.5 py-2 font-semibold text-[hsl(var(--primary))]">{assignment.gradedCount} qiymət</span><button type="button" onClick={() => setSelected(selected === assignment.id ? null : assignment.id)} className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-2 font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--card))]" data-testid={`button-open-submissions-${assignment.id}`}><ClipboardCheck size={14} /> Təhvillərə bax</button><button type="button" onClick={() => { setEditing(assignment); setShowForm(true); }} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-2 font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--card))]" data-testid={`button-edit-assignment-${assignment.id}`}><Pencil size={14} /> Redaktə</button>{assignment.status !== 'closed' && <button type="button" onClick={() => void closeAssignment(assignment)} disabled={updateMutation.isPending} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--destructive)/.25)] px-3 py-2 font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.06)]" data-testid={`button-close-assignment-${assignment.id}`}>Bağla</button>}</div>{selected === assignment.id && <AdminAssignmentSubmissions assignment={assignment} onClose={() => setSelected(null)} />}</div>)}</div>}
  </section>;
}

const inputClass = 'focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm text-[hsl(var(--foreground))] outline-none transition placeholder:text-[hsl(var(--muted-foreground)/.65)]';
const buttonClass = 'focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50';

const graduationCategoryLegend = [
  { label: 'Zəif', range: '< 2.50', className: 'border-rose-200 bg-rose-50 text-rose-800', dotClassName: 'bg-rose-500' },
  { label: 'Orta', range: '2.50–3.49', className: 'border-amber-200 bg-amber-50 text-amber-800', dotClassName: 'bg-amber-500' },
  { label: 'Əla', range: '3.50–4.49', className: 'border-sky-200 bg-sky-50 text-sky-800', dotClassName: 'bg-sky-500' },
  { label: 'Fərqlənmə ilə bitirən', range: '4.50–5.00', className: 'border-emerald-200 bg-emerald-50 text-emerald-800', dotClassName: 'bg-emerald-500' },
] as const;

const azerbaijanTimeZone = 'Asia/Baku';

function parseAzerbaijanDateTime(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return new Date(NaN);
  const [, year, month, day, hour, minute] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 4, Number(minute)));
}

function assignmentDueLabel(dueAt: string, status: string) {
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return 'Son tarix qeyd edilməyib';
  const label = date.toLocaleString('az-AZ', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return `${status === 'closed' || date.getTime() < Date.now() ? 'Son tarix' : 'Son tarix'}: ${label}`;
}
const lessonDayOptions = [
  ['monday', 'Bazar ertəsi'], ['tuesday', 'Çərşənbə axşamı'], ['wednesday', 'Çərşənbə'],
  ['thursday', 'Cümə axşamı'], ['friday', 'Cümə'], ['saturday', 'Şənbə'], ['sunday', 'Bazar'],
] as const;
const termSuffixes: Record<number, string> = { 1: 'ci', 2: 'ci', 3: 'cü', 4: 'cü', 5: 'ci', 6: 'cı', 7: 'ci', 8: 'ci' };

function apiUrl(path: string) {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api${path}`;
}

function AttendanceExcuses({ onRead }: { onRead?: () => void }) {
  const { t } = useI18n();
  const [items, setItems] = useState<Array<{ id: number; attendanceRecordId: number; studentName: string; courseTitle: string; attendanceDate: string; teacherName: string; reason: string; status: string; createdAt: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [readExcuseIds, setReadExcuseIds] = useState<number[]>(() => {
    try { return JSON.parse(window.localStorage.getItem('medine-read-attendance-excuses') || '[]') as number[]; } catch { return []; }
  });
  useEffect(() => {
    void fetch(apiUrl('/admin/attendance-excuses')).then((response) => response.ok ? response.json() : Promise.reject(new Error('load'))).then((data) => setItems(data)).catch(() => setItems([])).finally(() => setIsLoading(false));
  }, []);
  const unreadIds = items.filter((item) => item.status === 'pending' && !readExcuseIds.includes(item.id)).map((item) => item.id);
  const markExcusesRead = () => {
    const next = Array.from(new Set([...readExcuseIds, ...items.map((item) => item.id)]));
    setReadExcuseIds(next);
    window.localStorage.setItem('medine-read-attendance-excuses', JSON.stringify(next));
    onRead?.();
    setIsOpen(true);
  };
  useEffect(() => {
    if (!isLoading && items.length > 0 && !isOpen) markExcusesRead();
  }, [isLoading, items.length]);
  const removeExcuse = async (id: number) => {
    if (!window.confirm(t('confirmDeleteExcuse'))) return;
    const response = await fetch(apiUrl(`/admin/attendance-excuses/${id}`), { method: 'DELETE' });
    if (!response.ok) return;
    setItems((current) => current.filter((item) => item.id !== id));
  };
  const removeAttendanceRecord = async (recordId: number, excuseId: number) => {
    if (!window.confirm(t('confirmDeleteAbsence'))) return;
    const response = await fetch(apiUrl(`/admin/attendance-records/${recordId}`), { method: 'DELETE' });
    if (!response.ok) return;
    setItems((current) => current.filter((item) => item.id !== excuseId));
  };
  return <div className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.22)] p-4">
    <button type="button" onClick={() => { if (!isOpen) markExcusesRead(); else setIsOpen(false); }} className="focus-ring flex w-full items-center justify-between gap-3 text-left" aria-expanded={isOpen} data-testid="button-teacher-excuses">
      <span><span className="block text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">{t('excusesTitle')}</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{t('excusesHint')}</span></span>
      {unreadIds.length > 0 && <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white">{unreadIds.length}</span>}
    </button>
    {isOpen && <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">{isLoading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('excusesLoading')}</p> : !items.length ? <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('noExcuses')}</p> : <div className="space-y-3">{items.map((item) => <div key={item.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-[hsl(var(--primary))]">{item.studentName} · {item.courseTitle}</p><div className="flex items-center gap-2"><span className="text-xs text-[hsl(var(--muted-foreground))]">{item.attendanceDate}</span><button type="button" onClick={() => void removeExcuse(item.id)} className="focus-ring rounded-lg border border-[hsl(var(--border))] px-2 py-1 text-[10px] font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid={`button-delete-excuse-${item.id}`}>{t('deleteExcuse')}</button><button type="button" onClick={() => void removeAttendanceRecord(item.attendanceRecordId, item.id)} className="focus-ring rounded-lg bg-[hsl(var(--destructive))] px-2 py-1 text-[10px] font-bold text-white hover:opacity-90" data-testid={`button-delete-attendance-${item.attendanceRecordId}`}>{t('deleteAbsence')}</button></div></div><p className="mt-2 text-sm leading-6 text-[hsl(var(--foreground))]">{item.reason}</p><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{t('recordedBy')}: {item.teacherName} · {item.status === 'pending' ? t('statusPending') : item.status}</p></div>)}</div>}</div>}
  </div>;
}

type LessonSessionStatus = 'present' | 'late' | 'absent' | 'excused';
type LessonSessionSummary = { total: number; joined: number; notJoined: number; confirmed: number; state: 'confirmed' | 'partial' | 'pending' };
type LessonSessionItem = { resourceId: number; courseId: number; courseTitle: string; teacherName: string | null; termNumber: number; lessonTime: string | null; sessionDate: string; summary: LessonSessionSummary };
type LessonSessionRow = { profileId: number; studentName: string; studentNumber: number; joined: boolean; joinedAt: string | null; punctuality: 'on_time' | 'late' | null; autoStatus: 'present' | 'absent'; finalStatus: LessonSessionStatus | null; suggestedStatus: LessonSessionStatus };
type LessonSessionDetail = LessonSessionItem & { rows: LessonSessionRow[] };

const lessonStatusLabels: Record<LessonSessionStatus, string> = { present: 'İştirak', late: 'Gecikib', absent: 'Qayıb', excused: 'Üzrlü' };

function formatBakuTime(value: string) {
  return new Intl.DateTimeFormat('az-AZ', { timeZone: 'Asia/Baku', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatSessionDate(value: string) {
  return new Intl.DateTimeFormat('az-AZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

type RollCallSession = { sessionDate: string; summary: LessonSessionSummary };
type RollCallLesson = { resourceId: number; courseId: number; courseTitle: string; title: string; teacherName: string | null; termNumber: number; lessonDays: string[]; lessonTime: string | null; studentCount: number; recentSessions: RollCallSession[] };
type RollCallRow = LessonSessionRow & { defaultStatus: LessonSessionStatus; absenceCount: number; history: Array<{ attendanceDate: string; status: string }> };
type RollCallDetail = LessonSessionItem & { scheduled: boolean; lessonDays: string[]; rows: RollCallRow[]; written?: number };

const rollCallStatusOptions: Array<{ value: LessonSessionStatus; label: string; short: string; active: string }> = [
  { value: 'present', label: 'İştirak edib', short: 'İştirak', active: 'border-emerald-600 bg-emerald-600 text-white' },
  { value: 'absent', label: 'İştirak etməyib', short: 'Qayıb', active: 'border-red-600 bg-red-600 text-white' },
  { value: 'late', label: 'Gecikib', short: 'Gecikib', active: 'border-amber-500 bg-amber-500 text-white' },
  { value: 'excused', label: 'Üzrlü', short: 'Üzrlü', active: 'border-sky-600 bg-sky-600 text-white' },
];
const rollCallHistoryLabels: Record<string, string> = { present: 'İştirak edib', absent: 'İştirak etməyib', late: 'Gecikib', excused: 'Üzrlü' };

function academyTodayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baku', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function lessonScheduleLabel(lesson: Pick<RollCallLesson, 'lessonDays' | 'lessonTime'>) {
  const days = lessonDayOptions.filter(([key]) => lesson.lessonDays.includes(key)).map(([key, label]) => {
    let time: string | null = null;
    if (lesson.lessonTime?.startsWith('{')) {
      try { const map = JSON.parse(lesson.lessonTime) as Record<string, string>; time = map[key] ?? null; } catch { time = null; }
    } else time = lesson.lessonTime;
    return time ? `${label} ${time}` : label;
  });
  return days.join(', ');
}

function RollCallAttendance() {
  const { t, locale } = useI18n();
  const statusLabel = (status: string) => status === 'present' ? t('statusPresent') : status === 'absent' ? t('statusAbsent') : status === 'late' ? t('statusLate') : status === 'excused' ? t('statusExcused') : status;
  const statusShort = (status: string) => status === 'present' ? t('shortPresent') : status === 'absent' ? t('shortAbsent') : status === 'late' ? t('shortLate') : t('shortExcused');
  const dayName = (day: string) => {
    const key = { monday: 'dayMon', tuesday: 'dayTue', wednesday: 'dayWed', thursday: 'dayThu', friday: 'dayFri', saturday: 'daySat', sunday: 'daySun' }[day];
    return key ? t(key as 'dayMon') : day;
  };
  const scheduleLabel = (lesson: Pick<RollCallLesson, 'lessonDays' | 'lessonTime'>) => lesson.lessonDays.map((day) => {
    let time: string | null = null;
    if (lesson.lessonTime?.startsWith('{')) {
      try { const map = JSON.parse(lesson.lessonTime) as Record<string, string>; time = map[day] ?? null; } catch { time = null; }
    } else time = lesson.lessonTime;
    return time ? `${dayName(day)} ${time}` : dayName(day);
  }).join(', ');
  const sessionDate = (value: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'az-AZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  const [lessons, setLessons] = useState<RollCallLesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [lessonsError, setLessonsError] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [date, setDate] = useState(academyTodayIso);
  const [detail, setDetail] = useState<RollCallDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [marks, setMarks] = useState<Record<number, LessonSessionStatus>>({});
  const [historyOpen, setHistoryOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const today = academyTodayIso();

  const loadLessons = (keepSelection = true) => {
    setLessonsLoading(true); setLessonsError('');
    void fetch(apiUrl('/admin/attendance/roll-call/lessons'), { cache: 'no-store' })
      .then(async (response) => { const data = await response.json().catch(() => null); if (!response.ok) throw new Error((data as { error?: string } | null)?.error ?? 'Dərslər yüklənmədi.'); return data as RollCallLesson[]; })
      .then((items) => {
        setLessons(items);
        if (keepSelection && resourceId && items.some((item) => String(item.resourceId) === resourceId)) return;
        const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(`${today}T00:00:00Z`).getUTCDay()];
        const todayLesson = items.find((item) => item.lessonDays.includes(weekday));
        const first = todayLesson ?? (items.length === 1 ? items[0] : undefined);
        if (first) setResourceId(String(first.resourceId));
      })
      .catch((error: Error) => { setLessons([]); setLessonsError(error.message); })
      .finally(() => setLessonsLoading(false));
  };
  useEffect(() => loadLessons(false), []);

  useEffect(() => {
    if (!resourceId || !date) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true); setNotice(null); setHistoryOpen(null);
    void fetch(apiUrl(`/admin/attendance/roll-call/${resourceId}/${date}`), { cache: 'no-store' })
      .then(async (response) => { const data = await response.json().catch(() => ({})) as RollCallDetail & { error?: string }; if (!response.ok) throw new Error(data.error ?? 'Tələbə siyahısı yüklənmədi.'); return data; })
      .then((data) => { if (cancelled) return; setDetail(data); setMarks(Object.fromEntries(data.rows.map((row) => [row.profileId, row.defaultStatus]))); })
      .catch((error: Error) => { if (cancelled) return; setDetail(null); setMarks({}); setNotice({ text: error.message, error: true }); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [resourceId, date]);

  const selectedLesson = lessons.find((item) => String(item.resourceId) === resourceId);
  const pending = lessons.flatMap((lesson) => lesson.recentSessions.filter((session) => session.summary.total > 0 && session.summary.state !== 'confirmed').map((session) => ({ lesson, session }))).sort((a, b) => b.session.sessionDate.localeCompare(a.session.sessionDate)).slice(0, 8);
  const rows = detail?.rows ?? [];
  const counts = rollCallStatusOptions.map((option) => ({ ...option, count: rows.filter((row) => (marks[row.profileId] ?? row.defaultStatus) === option.value).length }));
  const changed = rows.filter((row) => (marks[row.profileId] ?? row.defaultStatus) !== (row.finalStatus ?? null)).length;
  const allSaved = rows.length > 0 && rows.every((row) => row.finalStatus !== null) && changed === 0;

  const setAll = (status: LessonSessionStatus) => setMarks(Object.fromEntries(rows.map((row) => [row.profileId, status])));
  const resetToJoins = () => setMarks(Object.fromEntries(rows.map((row) => [row.profileId, row.finalStatus ?? (row.joined ? (row.punctuality === 'late' ? 'late' : 'present') : 'absent')])));

  const save = async () => {
    if (!detail || !rows.length) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(apiUrl(`/admin/attendance/roll-call/${detail.resourceId}/${detail.sessionDate}`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marks: Object.fromEntries(rows.map((row) => [row.profileId, marks[row.profileId] ?? row.defaultStatus])) }),
      });
      const data = await response.json().catch(() => ({})) as RollCallDetail & { error?: string };
      if (!response.ok) { setNotice({ text: data.error ?? t('attendanceSaveFail'), error: true }); return; }
      setDetail(data);
      setMarks(Object.fromEntries(data.rows.map((row) => [row.profileId, row.defaultStatus])));
      setNotice({ text: t('attendanceSaved'), error: false });
      loadLessons(true);
    } catch {
      setNotice({ text: t('attendanceSaveFail'), error: true });
    } finally { setBusy(false); }
  };

  return <section className="space-y-4" data-testid="section-roll-call">
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 sm:p-4">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">{t('rollTitle')}</p>
      <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('rollHint')}</p>
      {pending.length > 0 && <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-bold text-[hsl(var(--secondary-foreground))]">{t('pendingOnline')}</p>
        <div className="flex gap-2 overflow-x-auto pb-1">{pending.map(({ lesson, session }) => {
          const active = String(lesson.resourceId) === resourceId && session.sessionDate === date;
          return <button key={`${lesson.resourceId}:${session.sessionDate}`} type="button" onClick={() => { setResourceId(String(lesson.resourceId)); setDate(session.sessionDate); }} className={`focus-ring shrink-0 rounded-xl border px-3 py-2 text-left text-[11px] transition ${active ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.14)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)] hover:bg-[hsl(var(--muted))]'}`} data-testid={`button-roll-call-pending-${lesson.resourceId}-${session.sessionDate}`}>
            <span className="block max-w-[180px] truncate font-bold text-[hsl(var(--primary))]">{lesson.courseTitle}</span>
            <span className="block text-[hsl(var(--muted-foreground))]">{sessionDate(session.sessionDate)} · <span className="font-semibold text-emerald-700">{t('joined')} {session.summary.joined}/{session.summary.total}</span></span>
          </button>;
        })}</div>
      </div>}
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <Field label={t('attLesson')}>
          <select className={inputClass} value={resourceId} onChange={(event) => setResourceId(event.target.value)} disabled={lessonsLoading} data-testid="select-roll-call-lesson">
            <option value="">{lessonsLoading ? t('lessonsLoading') : lessons.length ? t('chooseLesson') : t('noLessonFound')}</option>
            {lessons.map((lesson) => <option key={lesson.resourceId} value={lesson.resourceId}>{lesson.courseTitle}{lesson.teacherName ? ` · ${lesson.teacherName}` : ''} · {lesson.termNumber}. {t('termLabel')}{scheduleLabel(lesson) ? ` · ${scheduleLabel(lesson)}` : ''} ({lesson.studentCount})</option>)}
          </select>
        </Field>
        <Field label={t('attDate')}>
          <input type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} className={inputClass} data-testid="input-roll-call-date" />
        </Field>
      </div>
      {lessonsError && <p className="mt-2 text-xs font-semibold text-[hsl(var(--destructive))]">{lessonsError}</p>}
      {!lessonsLoading && !lessonsError && !lessons.length && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{t('noAssignedLesson')}</p>}
      {selectedLesson && detail && !detail.scheduled && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{t('notScheduledDay')}</p>}
    </div>

    {resourceId && <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]" data-testid="roll-call-list">
      {detailLoading ? <p className="p-4 text-sm text-[hsl(var(--muted-foreground))]">{t('rosterLoading')}</p> : !detail ? null : !rows.length ? <p className="p-4 text-sm text-[hsl(var(--muted-foreground))]">{t('noStudentsOnLesson')}</p> : <>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--border))] p-3">
          <p className="text-xs font-bold text-[hsl(var(--primary))]">{detail.courseTitle} · {sessionDate(detail.sessionDate)} · {rows.length} · <span className="text-emerald-700">{t('joined')}: {detail.summary.joined}</span></p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setAll('present')} className="focus-ring rounded-lg border border-emerald-600/40 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50" data-testid="button-roll-call-all-present">{t('allPresent')}</button>
            <button type="button" onClick={resetToJoins} className="focus-ring rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 text-[11px] font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="button-roll-call-reset">{t('fillFromJoins')}</button>
          </div>
        </div>
        <ul className="divide-y divide-[hsl(var(--border))]">{rows.map((row) => {
          const chosen = marks[row.profileId] ?? row.defaultStatus;
          return <li key={row.profileId} className="px-3 py-2.5" data-testid={`row-roll-call-${row.profileId}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[hsl(var(--primary))]">{row.studentName} <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">T{String(row.studentNumber).padStart(4, '0')}</span></p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
                  {row.joined && row.joinedAt ? <span className="font-semibold text-emerald-700">{t('joined')} {formatBakuTime(row.joinedAt)}{row.punctuality === 'late' ? ` (${t('lateMark')})` : ''}</span> : <span className="font-semibold text-red-700">{t('notJoined')}</span>}
                  {row.finalStatus && <span className="text-[hsl(var(--muted-foreground))]">· {t('savedAs')}: {statusLabel(row.finalStatus)}</span>}
                  <button type="button" onClick={() => setHistoryOpen((current) => current === row.profileId ? null : row.profileId)} className="font-semibold text-[hsl(var(--secondary-foreground))] underline-offset-2 hover:underline" aria-expanded={historyOpen === row.profileId} data-testid={`button-roll-call-history-${row.profileId}`}>{t('history')}{row.absenceCount ? ` · ${t('absence')} ${row.absenceCount}` : ''}</button>
                </p>
              </div>
              <div className="grid shrink-0 grid-cols-4 gap-1 sm:flex" role="radiogroup" aria-label={`${row.studentName} davamiyyəti`}>
                {rollCallStatusOptions.map((option) => <button key={option.value} type="button" role="radio" aria-checked={chosen === option.value} title={statusLabel(option.value)} onClick={() => setMarks((current) => ({ ...current, [row.profileId]: option.value }))} className={`focus-ring rounded-lg border px-2 py-1.5 text-[11px] font-bold leading-tight transition ${chosen === option.value ? option.active : 'border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`} data-testid={`button-roll-call-${option.value}-${row.profileId}`}>{chosen === option.value ? '✓ ' : ''}{statusShort(option.value)}</button>)}
              </div>
            </div>
            {historyOpen === row.profileId && <div className="mt-2 rounded-lg bg-[hsl(var(--muted)/.4)] p-2 text-[11px]">{row.history.length ? <ul className="space-y-0.5">{row.history.map((item) => <li key={item.attendanceDate} className="flex justify-between gap-2"><span>{sessionDate(item.attendanceDate)}</span><span className={`font-semibold ${item.status === 'absent' ? 'text-red-700' : item.status === 'late' ? 'text-amber-700' : item.status === 'excused' ? 'text-sky-700' : 'text-emerald-700'}`}>{statusLabel(item.status)}</span></li>)}</ul> : <p className="text-[hsl(var(--muted-foreground))]">{t('noPriorMark')}</p>}</div>}
          </li>;
        })}</ul>
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t border-[hsl(var(--border))] bg-[hsl(var(--card)/.97)] p-3 backdrop-blur">
          <p className="flex flex-wrap gap-x-3 text-[11px] font-semibold">{counts.map((item) => <span key={item.value} className="text-[hsl(var(--muted-foreground))]">{statusLabel(item.value)}: <b className="text-[hsl(var(--primary))]">{item.count}</b></span>)}</p>
          <button type="button" disabled={busy} onClick={() => void save()} className="focus-ring w-full rounded-xl bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-black text-[hsl(var(--primary-foreground))] disabled:opacity-50 sm:w-auto" data-testid="button-roll-call-save">{busy ? t('writing') : allSaved ? t('confirmedAgain') : `${t('confirmStudents')} (${rows.length})`}</button>
        </div>
      </>}
      {notice && <p className={`px-3 pb-3 text-xs font-semibold ${notice.error ? 'text-[hsl(var(--destructive))]' : 'text-emerald-700'}`} role="status">{notice.text}</p>}
    </div>}
    {!resourceId && notice && <p className="text-xs font-semibold text-[hsl(var(--destructive))]">{notice.text}</p>}
  </section>;
}

function TeacherChoiceRequests() {
  const { t } = useI18n();
  const [items, setItems] = useState<Array<{ id: number; studentName: string; teacherName?: string; courseId: number; termNumber: number; status: string; studentCapacity: number; activeChoiceCount: number; isFull: boolean }>>([]);
  const [notice, setNotice] = useState('');
  const load = async () => { try { const response = await fetch(apiUrl('/admin/teacher-choices'), { cache: 'no-store' }); if (!response.ok) throw new Error('load'); setItems(await response.json()); } catch { setItems([]); } };
  useEffect(() => { void load(); }, []);
  const decide = async (id: number, decision: 'approved' | 'rejected') => {
    const response = await fetch(apiUrl(`/admin/teacher-choices/${id}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }) });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { setNotice(data.error ?? t('choiceFail')); await load(); return; }
    await load();
    setNotice(decision === 'approved' ? t('choiceApproved') : t('choiceRejected'));
  };
  return <section className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.22)] p-4" data-testid="section-teacher-choice-requests"><p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">{t('choiceTitle')}</p>{notice && <p className="mt-2 text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{notice}</p>}{!items.length ? <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">{t('noRequests')}</p> : <div className="mt-4 space-y-2">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[hsl(var(--card))] p-3"><div><p className="text-sm font-bold text-[hsl(var(--primary))]">{item.studentName}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{item.teacherName ?? t('roleTeacher')} · {t('subjectNo')} {item.courseId} · {item.termNumber}. {t('semester')} · {t('groupWord')}: {item.studentCapacity > 0 ? `${item.activeChoiceCount}/${item.studentCapacity}` : `${item.activeChoiceCount} · ${t('unlimitedGroup')}`} · {item.status === 'pending' ? t('statusPending') : item.status === 'approved' ? t('statusApproved') : t('statusRejected')}</p></div>{item.status === 'pending' && <div className="flex gap-2"><button type="button" onClick={() => void decide(item.id, 'approved')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">{t('approve')}</button><button type="button" onClick={() => void decide(item.id, 'rejected')} className="rounded-lg bg-[hsl(var(--destructive))] px-3 py-2 text-xs font-bold text-white">{t('reject')}</button></div>}</div>)}</div>}</section>;
}

type SystemStatistics = {
  teachers: number;
  currentStudents: number;
  graduatedStudents: number;
  visible: boolean;
};

function StatisticCircles({ statistics, compact = false }: { statistics: SystemStatistics; compact?: boolean }) {
  const items = [
    { label: 'Müəllim', value: statistics.teachers, className: 'bg-sky-100 text-sky-900' },
    { label: 'Hazırkı tələbə', value: statistics.currentStudents, className: 'bg-emerald-100 text-emerald-900' },
    { label: 'Bitirmiş tələbə', value: statistics.graduatedStudents, className: 'bg-amber-100 text-amber-950' },
  ];
  return <div className={`grid ${compact ? 'grid-cols-3 gap-2' : 'gap-4 sm:grid-cols-3'}`} data-testid="system-statistics-circles">
    {items.map((item) => <div key={item.label} className="flex flex-col items-center gap-2 text-center">
      <div className={`${compact ? 'h-16 w-16 text-xl' : 'h-24 w-24 text-3xl'} flex items-center justify-center rounded-full font-black ${item.className}`}>{item.value}</div>
      <span className="text-xs font-bold text-[hsl(var(--primary))]">{item.label}</span>
    </div>)}
  </div>;
}

function AnalyticsDashboard({ applications, profiles, resources, onRefresh }: { applications: Application[]; profiles: Array<Partial<AcademicProfile>>; resources: LearningResource[]; onRefresh: () => void }) {
  const [detailedProfiles, setDetailedProfiles] = useState<AcademicProfile[]>([]);
  useEffect(() => {
    let active = true;
    if (!profiles.length) {
      setDetailedProfiles([]);
      return () => { active = false; };
    }
    void Promise.all(profiles.map((profile) =>
      fetch(apiUrl(`/admin/academic-profiles/${profile.id}`), { cache: 'no-store' })
        .then((response) => response.ok ? response.json() as Promise<AcademicProfile> : Promise.reject())
        .catch(() => null),
    )).then((result) => {
      if (active) setDetailedProfiles(result.filter((profile): profile is AcademicProfile => profile !== null));
    });
    return () => { active = false; };
  }, [profiles]);
  const analyticsProfiles: Array<Partial<AcademicProfile>> = detailedProfiles.length ? detailedProfiles : profiles;
  const [term, setTerm] = useState<number | 'current'>('current');
  const currentTerm = analyticsProfiles[0]?.currentTermNumber ?? 1;
  const selectedTerm = term === 'current' ? currentTerm : term;
  const subjects = analyticsProfiles.flatMap((profile) => profile.semesters?.find((semester) => semester.termNumber === selectedTerm)?.subjects ?? []);
  const activeProfiles = analyticsProfiles.filter((profile) => (profile.semesters?.find((semester) => semester.termNumber === selectedTerm)?.subjects.length ?? 0) > 0);
  const attendance = subjects.filter((subject) => subject.attendancePercent !== null);
  const attendanceAverage = attendance.length ? Math.round(attendance.reduce((sum, subject) => sum + (subject.attendancePercent ?? 0), 0) / attendance.length) : 0;
  const graded = subjects.filter((subject) => subject.grade !== null);
  const gradeAverage = graded.length ? (graded.reduce((sum, subject) => sum + (subject.grade ?? 0), 0) / graded.length).toFixed(2) : '—';
  const statusCounts = ['pending', 'approved', 'rejected', 'graduated'].map((status) => ({ status, label: status === 'pending' ? 'Gözləyən' : status === 'approved' ? 'Qəbul edilən' : status === 'rejected' ? 'Rədd edilən' : 'Məzun', value: applications.filter((application) => application.status === status).length }));
  const courseLoads = Array.from(new Map(subjects.map((subject) => [subject.courseId, { title: subject.title, count: 0 }])).values());
  subjects.forEach((subject) => { const course = courseLoads.find((item) => item.title === subject.title); if (course) course.count += 1; });
  const maxLoad = Math.max(1, ...courseLoads.map((course) => course.count));
  const downloadCsv = () => {
    const rows = [
      ['Göstərici', 'Dəyər'],
      ['Cari semestr', String(selectedTerm)],
      ['Aktiv tələbə', String(activeProfiles.length)],
      ['Davamiyyət ortalaması (%)', String(attendanceAverage)],
      ['Qiymət ortalaması (5)', String(gradeAverage)],
      ...statusCounts.map((item) => [`Müraciət: ${item.label}`, String(item.value)]),
      ...courseLoads.map((course) => [`Dərs yükü: ${course.title}`, String(course.count)]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(';')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `medine-analitika-semestr-${selectedTerm}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  return <section className="mb-6 space-y-5" data-testid="section-analytics-dashboard">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">Analitik icmal</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Cari semestr üzrə akademik və qəbul göstəriciləri.</p></div>
      <div className="flex flex-wrap gap-2">
        <select value={term} onChange={(event) => setTerm(event.target.value === 'current' ? 'current' : Number(event.target.value))} className="focus-ring rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]" aria-label="Analitika semestri">
          <option value="current">Cari semestr ({currentTerm})</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].filter((item) => item !== currentTerm).map((item) => <option key={item} value={item}>{item}-ci semestr</option>)}
        </select>
        <button type="button" onClick={onRefresh} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]"><RefreshCw size={14} /> Yenilə</button>
        <button type="button" onClick={downloadCsv} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))]" data-testid="button-export-analytics"><Download size={14} /> CSV endir</button>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[['Aktiv tələbə', activeProfiles.length, 'Cari semestrə daxil olan'], ['Davamiyyət', `${attendanceAverage}%`, 'Qeyd edilmiş fənlər üzrə'], ['Qiymət ortalaması', gradeAverage, '5 üzərindən'], ['Dərs qrupları', resources.filter((resource) => resource.termNumber === selectedTerm).length, 'Cari semestr']].map(([label, value, hint]) => <div key={String(label)} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[var(--shadow-xs)]"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-2 font-serif text-3xl font-bold text-[hsl(var(--primary))]">{value}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{hint}</p></div>)}
    </div>
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><h3 className="font-serif text-2xl text-[hsl(var(--primary))]">Müraciət statusları</h3><div className="mt-4 space-y-3">{statusCounts.map((item) => { const total = Math.max(1, applications.length); return <div key={item.status}><div className="mb-1 flex justify-between text-xs font-bold"><span>{item.label}</span><span>{item.value}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--accent))]" style={{ width: `${Math.round(item.value / total * 100)}%` }} /></div></div>; })}</div></div>
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><h3 className="font-serif text-2xl text-[hsl(var(--primary))]">Dərslər üzrə tələbə yükü</h3>{courseLoads.length ? <div className="mt-4 space-y-3">{courseLoads.slice(0, 8).map((course) => <div key={course.title}><div className="mb-1 flex justify-between gap-3 text-xs font-bold"><span className="truncate">{course.title}</span><span>{course.count}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${Math.round(course.count / maxLoad * 100)}%` }} /></div></div>)}</div> : <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Bu semestr üçün dərs məlumatı yoxdur.</p>}</div>
    </div>
  </section>;
}

function SystemStatisticsSettings() {
  const [statistics, setStatistics] = useState<SystemStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/admin/system-statistics'), { cache: 'no-store' });
      const result = await response.json() as SystemStatistics & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Statistika yüklənə bilmədi.');
      setStatistics(result);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Statistika yüklənə bilmədi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const updateVisibility = async (visible: boolean) => {
    setSaving(true);
    setNotice('');
    try {
      const response = await fetch(apiUrl('/admin/system-statistics'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible }),
      });
      const result = await response.json() as SystemStatistics & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Görünürlük dəyişdirilə bilmədi.');
      setStatistics(result);
      setNotice(visible ? 'Statistika ana səhifədə göstərilir.' : 'Statistika ana səhifədən gizlədildi.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Görünürlük dəyişdirilə bilmədi.');
    } finally {
      setSaving(false);
    }
  };

  return <section className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.22)] p-5" data-testid="section-system-statistics">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">Statistika görünürlüğü</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Akademiyanın ümumi saylarını ana səhifədə göstər.</p></div>
      {statistics && <button type="button" disabled={saving} onClick={() => void updateVisibility(!statistics.visible)} className={`focus-ring rounded-xl px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50 ${statistics.visible ? 'bg-emerald-700' : 'bg-slate-600'}`} data-testid="button-toggle-system-statistics">{saving ? 'Yadda saxlanır...' : statistics.visible ? 'Ana səhifədə açıqdır' : 'Ana səhifədə bağlıdır'}</button>}
    </div>
    {loading ? <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">Statistika yüklənir...</p> : statistics && <div className="mt-6"><StatisticCircles statistics={statistics} /></div>}
    {notice && <p className="mt-4 text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{notice}</p>}
  </section>;
}

type StudentAiExternalSetting = { shamela: boolean; dorar: boolean };

// Sistem sahibi: tələbələr üçün Mədinə AI «Xarici» axtarışı (Şamilə / Hədis). Standart: söndürülüb.
function StudentAiExternalSettings() {
  const [setting, setSetting] = useState<StudentAiExternalSetting | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(apiUrl('/ai/admin/student-external'), { cache: 'no-store' });
        const result = await response.json() as StudentAiExternalSetting & { error?: string };
        if (!response.ok) throw new Error(result.error || 'Ayar yüklənə bilmədi.');
        setSetting({ shamela: result.shamela === true, dorar: result.dorar === true });
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Ayar yüklənə bilmədi.');
      }
    })();
  }, []);

  const save = async (next: StudentAiExternalSetting) => {
    setSaving(true);
    setNotice('');
    try {
      const response = await fetch(apiUrl('/ai/admin/student-external'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const result = await response.json() as StudentAiExternalSetting & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Ayar dəyişdirilə bilmədi.');
      setSetting({ shamela: result.shamela === true, dorar: result.dorar === true });
      setNotice(result.shamela || result.dorar ? 'Tələbələr Mədinə AI-da «Xarici» axtarışdan istifadə edə bilər.' : 'Tələbələr üçün «Xarici» axtarış söndürüldü.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Ayar dəyişdirilə bilmədi.');
    } finally {
      setSaving(false);
    }
  };

  const enabled = Boolean(setting && (setting.shamela || setting.dorar));
  const toggleClass = (on: boolean) => `focus-ring rounded-xl px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50 ${on ? 'bg-emerald-700' : 'bg-slate-600'}`;
  return <section className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.22)] p-5" data-testid="section-student-ai-external">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-xl">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">Tələbələr üçün Mədinə AI — Xarici axtarış (Şamilə / Hədis)</p>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Açıq olduqda tələbələr Mədinə AI-da «Daxili / Xarici» keçidini görür və Şamilə kitabxanasında və ya Dorar hədis bazasında axtarış edə bilir; mətnlər AI-ın içində göstərilir. «Daxili» rejim yenə yalnız tələbənin öz məlumatları ilə işləyir. Axtarışlar saxlanmır.</p>
      </div>
      {setting && <button type="button" disabled={saving} onClick={() => void save(enabled ? { shamela: false, dorar: false } : { shamela: true, dorar: true })} className={toggleClass(enabled)} data-testid="button-toggle-student-ai-external">{saving ? 'Yadda saxlanır...' : enabled ? 'Tələbələr üçün açıqdır' : 'Tələbələr üçün bağlıdır'}</button>}
    </div>
    {setting && enabled && <div className="mt-4 flex flex-wrap gap-2">
      {([['shamela', 'Şamilə'], ['dorar', 'Hədis (Dorar)']] as const).map(([key, label]) => (
        <label key={key} className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-semibold text-[hsl(var(--primary))]">
          <input type="checkbox" checked={setting[key]} disabled={saving} onChange={(event) => void save({ ...setting, [key]: event.target.checked })} data-testid={`checkbox-student-ai-external-${key}`} />
          {label}
        </label>
      ))}
    </div>}
    {!setting && !notice && <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Ayar yüklənir...</p>}
    {notice && <p className="mt-4 text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{notice}</p>}
  </section>;
}

type AuditHistoryEvent = {
  id: number;
  eventType: string;
  actorClerkUserId: string;
  actorName?: string | null;
  targetType: string;
  targetId: string | null;
  targetName?: string | null;
  details: unknown;
  createdAt: string;
};

const unsafeAuditDetailKey = /(secret|password|token|credential|authorization|cookie|private|key)/i;

const auditEventLabels: Record<string, string> = {
  'application.submitted': 'Yeni tələbə müraciəti göndərildi',
  'application.approved': 'Tələbə müraciəti təsdiqləndi',
  'application.rejected': 'Tələbə müraciəti rədd edildi',
  'course.created': 'Yeni dərs yaradıldı',
  'course.updated': 'Dərs məlumatları yeniləndi',
  'course.deleted': 'Dərs silindi',
  'resource.created': 'Yeni dərs yaradıldı',
  'resource.updated': 'Dərs məlumatları yeniləndi',
  'resource.deleted': 'Dərs silindi',
  'resource.student_added': 'Tələbə qrupa əlavə edildi',
  'resource.student_removed': 'Tələbə qrupdan çıxarıldı',
  'resource.teacher_added': 'Qrupa müəllim əlavə edildi',
  'resource.teacher_removed': 'Qrupdan müəllim çıxarıldı',
  'resource.main_teacher_changed': 'Qrupun əsas müəllimi dəyişdi',
  'course.books.updated': 'Dərs kitabları yeniləndi',
  'teacher.choice.created': 'Müəllim seçimi göndərildi',
  'teacher.choice.approved': 'Müəllim seçimi təsdiqləndi',
  'teacher.choice.rejected': 'Müəllim seçimi rədd edildi',
  'student.graduated': 'Tələbə məzun edildi',
  'user.role.updated': 'İstifadəçi rolu dəyişdirildi',
  'user.profile.updated': 'İstifadəçi profili yeniləndi',
  'message.created': 'Yeni mesaj göndərildi',
  'message.reply.created': 'Mesaja cavab göndərildi',
  'question.created': 'Yeni sual göndərildi',
  'attendance.updated': 'Davamiyyət yeniləndi',
  'attendance.roll_call.saved': 'Davamiyyət yoxlaması təsdiqləndi',
  'attendance.lesson_session.confirmed': 'Onlayn dərs davamiyyəti təsdiqləndi',
  'grades.updated': 'Tələbə qiymətləri yeniləndi',
  'grade.updated': 'Qiymət yeniləndi',
  'student.deleted': 'Tələbə hesabı silindi',
  'teacher.assignment': 'Müəllim təyin edildi',
};

const auditTargetLabels: Record<string, string> = {
  application: 'Tələbə müraciəti',
  course: 'Dərs',
  resource: 'Dərs',
  teacher_choice: 'Müəllim seçimi',
  student: 'Tələbə',
  user: 'İstifadəçi',
  message: 'Mesaj',
  question: 'Sual',
  attendance: 'Davamiyyət',
  grade: 'Qiymət',
};

const auditDetailLabels: Record<string, string> = {
  status: 'Status',
  title: 'Başlıq',
  name: 'Ad',
  email: 'E-poçt',
  courseId: 'Dərs nömrəsi',
  resourceId: 'Dərs nömrəsi',
  profileId: 'Tələbə nömrəsi',
  studentId: 'Tələbə nömrəsi',
  teacherClerkUserId: 'Müəllim hesabı',
  termNumber: 'Semestr',
  decision: 'Qərar',
  reason: 'Səbəb',
  recommendationCount: 'Tövsiyə olunan seçim sayı',
  changedFields: 'Dəyişdirilən məlumatlar',
  previousRole: 'Əvvəlki rol',
  newRole: 'Yeni rol',
  graduationTerm: 'Məzuniyyət semestri',
  rejectionReason: 'İmtina səbəbi',
  attendanceDate: 'Davamiyyət tarixi',
  courseCount: 'Dərs sayı',
  kind: 'Məlumat növü',
  assignedUserId: 'Təyin olunan istifadəçi',
  recipientClerkUserId: 'Alıcı hesabı',
  parentMessageId: 'Əsas mesaj',
};

const auditValueLabels: Record<string, string> = {
  pending: 'Gözləmədə',
  approved: 'Təsdiqləndi',
  rejected: 'Rədd edildi',
  graduated: 'Məzun oldu',
  teacher: 'Müəllim',
  supervisor: 'Nəzarətçi',
  owner: 'Sahib',
  owner_assistant: 'İdarə heyəti',
  admin: 'İdarəçi',
  pdf: 'PDF',
  telegram: 'Telegram',
  material: 'Material',
  text: 'Mətn',
  present: 'İştirak edib',
  absent: 'İştirak etməyib',
  late: 'Gecikib',
};

const auditWordLabels: Record<string, string> = {
  application: 'Müraciət',
  applications: 'Müraciətlər',
  course: 'Dərs',
  courses: 'Dərslər',
  resource: 'Dərs resursu',
  resources: 'Dərs resursları',
  student: 'Tələbə',
  students: 'Tələbələr',
  user: 'İstifadəçi',
  profile: 'Profil',
  teacher: 'Müəllim',
  choice: 'seçimi',
  assignment: 'təyinatı',
  message: 'Mesaj',
  reply: 'cavabı',
  question: 'Sual',
  attendance: 'Davamiyyət',
  grade: 'Qiymət',
  grades: 'Qiymətlər',
  role: 'rolu',
  notification: 'Bildiriş',
  notifications: 'Bildirişlər',
  article: 'Məqalə',
  benefit: 'Günün faydası',
  created: 'yaradıldı',
  updated: 'yeniləndi',
  deleted: 'silindi',
  submitted: 'göndərildi',
  approved: 'təsdiqləndi',
  rejected: 'rədd edildi',
  graduated: 'məzun edildi',
  published: 'yayımlandı',
  sent: 'göndərildi',
  changed: 'dəyişdirildi',
  decision: 'qərarı',
};

function auditHumanizeKey(value: string) {
  const words = value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').split(/\s+/).filter(Boolean);
  return words.map((word) => auditWordLabels[word.toLocaleLowerCase('en-US')] ?? word).join(' ').trim() || 'Əlavə məlumat';
}

const auditFieldLabels: Record<string, string> = {
  title: 'Başlıq',
  description: 'Təsvir',
  instructor: 'Müəllim',
  totalLessons: 'Dərs sayı',
  pdfUrl: 'PDF linki',
  telegramUrl: 'Telegram linki',
  zoomUrl: 'Zoom linki',
  googleMeetUrl: 'Google Meet linki',
  lessonUrl: 'Dərs linki',
  curriculum: 'Mövzular',
};

function auditEventLabel(eventType: string) {
  if (auditEventLabels[eventType]) return auditEventLabels[eventType];
  if (eventType.startsWith('teacher.choice.')) {
    const status = eventType.split('.').at(-1) ?? '';
    return `Müəllim seçimi ${auditValueLabels[status] ? auditValueLabels[status].toLocaleLowerCase('az-AZ') : 'yeniləndi'}`;
  }
  const parts = eventType.split('.').filter(Boolean);
  const action = parts.at(-1) ?? '';
  const subject = parts.slice(0, -1).map((part) => auditWordLabels[part] ?? auditFieldLabels[part] ?? '').filter(Boolean).join(' ');
  const translatedAction = auditWordLabels[action];
  return subject && translatedAction ? `${subject} ${translatedAction}` : 'Sistem əməliyyatı';
}

function auditTargetLabel(targetType: string) {
  return auditTargetLabels[targetType] ?? auditWordLabels[targetType] ?? 'Sistem obyekti';
}

function safeAuditDetails(details: unknown) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return '';
  return Object.entries(details as Record<string, unknown>)
    .filter(([key]) => !unsafeAuditDetailKey.test(key))
    .slice(0, 6)
    .map(([key, value]) => {
      const label = auditDetailLabels[key] ?? auditFieldLabels[key] ?? auditHumanizeKey(key);
      if (Array.isArray(value)) {
        const readable = value.map((item) => auditFieldLabels[String(item)] ?? String(item)).join(', ');
        return `${label}: ${readable || 'yoxdur'}`;
      }
      if (!['string', 'number', 'boolean'].includes(typeof value)) return '';
      const displayValue = typeof value === 'boolean'
        ? (value ? 'Bəli' : 'Xeyr')
        : auditValueLabels[String(value)] ?? String(value);
      return `${label}: ${displayValue.slice(0, 120)}`;
    })
    .filter(Boolean)
    .join(' · ');
}

function AuditHistory() {
  const [events, setEvents] = useState<AuditHistoryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventType, setEventType] = useState('all');
  const [targetType, setTargetType] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [targetTypes, setTargetTypes] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ limit: '500' });
    if (eventType !== 'all') params.set('eventType', eventType);
    if (targetType !== 'all') params.set('targetType', targetType);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    setIsLoading(true);
    setError('');
    void fetch(`${apiUrl('/admin/audit-events')}?${params.toString()}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as unknown;
        if (!response.ok) throw new Error('Audit tarixçəsini yükləmək mümkün olmadı.');
        if (!Array.isArray(data)) throw new Error('Audit tarixçəsi düzgün formatda deyil.');
        return data as AuditHistoryEvent[];
      })
      .then((data) => {
        if (!active) return;
        setEvents(data);
        setEventTypes((current) => Array.from(new Set([...current, ...data.map((event) => event.eventType)])).sort());
        setTargetTypes((current) => Array.from(new Set([...current, ...data.map((event) => event.targetType)])).sort());
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Audit tarixçəsini yükləmək mümkün olmadı.');
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [eventType, targetType, fromDate, toDate]);

  const filteredEvents = events;
  const downloadCsv = () => {
    const rows = [['Tarix', 'Əməliyyat', 'Hədəf tipi', 'Hədəf ID', 'Təhlükəsiz detallar'], ...filteredEvents.map((event) => [
      new Date(event.createdAt).toLocaleString('az-AZ'),
      auditEventLabel(event.eventType),
      auditTargetLabel(event.targetType),
      event.targetId ?? '',
      safeAuditDetails(event.details),
    ])];
    const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'medine-audit-tarixcesi.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  const deleteEvent = async (id: number) => {
    if (!window.confirm('Bu audit qeydini silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarılmır.')) return;
    setDeletingId(id);
    setError('');
    try {
      const response = await fetch(apiUrl(`/admin/audit-events/${id}`), { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Audit qeydi silinə bilmədi.');
      setEvents((current) => current.filter((event) => event.id !== id));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Audit qeydi silinə bilmədi.');
    } finally {
      setDeletingId(null);
    }
  };
  const deleteAllEvents = async () => {
    if (!filteredEvents.length || !window.confirm('Bütün audit qeydlərini silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarılmır.')) return;
    setIsDeletingAll(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/admin/audit-events'), { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as { deletedCount?: number; error?: string };
      if (!response.ok) throw new Error(result.error || 'Audit qeydləri silinə bilmədi.');
      setEvents([]);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Audit qeydləri silinə bilmədi.');
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.22)] p-5" data-testid="section-audit-history">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 text-[hsl(var(--secondary-foreground))]" size={20} />
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">Audit tarixçəsi</p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Sistem əməliyyatlarının qorunan, yalnız oxunan qeydləri.</p>
        </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={downloadCsv} disabled={!filteredEvents.length || isDeletingAll} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-export-audit-csv"><Download size={14} /> CSV endir</button>
          <button type="button" onClick={() => void deleteAllEvents()} disabled={!filteredEvents.length || isDeletingAll || deletingId !== null} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--destructive))] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-delete-all-audit"><Trash2 size={14} /> {isDeletingAll ? 'Silinir...' : 'Hamısını sil'}</button>
        </div>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="audit-filters">
        <select value={eventType} onChange={(event) => setEventType(event.target.value)} className="focus-ring rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-semibold" aria-label="Əməliyyat növü">
          <option value="all">Bütün əməliyyatlar</option>
          {eventTypes.map((value) => <option key={value} value={value}>{auditEventLabel(value)}</option>)}
        </select>
        <select value={targetType} onChange={(event) => setTargetType(event.target.value)} className="focus-ring rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-semibold" aria-label="Hədəf tipi">
          <option value="all">Bütün hədəflər</option>
          {targetTypes.map((value) => <option key={value} value={value}>{auditTargetLabel(value)}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="focus-ring rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-semibold" aria-label="Başlanğıc tarixi" />
        <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="focus-ring rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-semibold" aria-label="Son tarix" />
      </div>
      {isLoading ? <p className="mt-5 text-sm text-[hsl(var(--muted-foreground))]">Audit tarixçəsi yüklənir...</p>
        : error ? <p className="mt-5 rounded-xl bg-[hsl(var(--destructive)/.1)] p-3 text-sm text-[hsl(var(--destructive))]" role="alert">{error}</p>
        : !filteredEvents.length ? <p className="mt-5 text-sm text-[hsl(var(--muted-foreground))]">{events.length ? 'Seçilmiş filterlərə uyğun audit qeydi yoxdur.' : 'Audit qeydi yoxdur.'}</p>
        : <div className="mt-5 space-y-2">{filteredEvents.map((event) => {
          const details = safeAuditDetails(event.details);
           return <div key={event.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
               <p className="text-sm font-bold text-[hsl(var(--primary))]">{auditEventLabel(event.eventType)}</p>
               <div className="flex items-center gap-2">
                 <time className="text-xs text-[hsl(var(--muted-foreground))]" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString('az-AZ')}</time>
                 <button type="button" onClick={() => void deleteEvent(event.id)} disabled={deletingId === event.id} className="focus-ring rounded-lg p-1.5 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.1)] disabled:cursor-not-allowed disabled:opacity-50" aria-label="Audit qeydini sil" title="Audit qeydini sil" data-testid={`button-delete-audit-${event.id}`}><Trash2 size={15} /></button>
               </div>
            </div>
             <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
               <span><strong className="text-[hsl(var(--foreground))]">Hədəf:</strong> {auditTargetLabel(event.targetType)}{event.targetName ? `: ${event.targetName}` : ''}{event.targetId ? ` · №${event.targetId}` : ''}</span>
                <span><strong className="text-[hsl(var(--foreground))]">İcra edən:</strong> {event.actorName ?? 'Sistem istifadəçisi'}</span>
             </div>
             {details && <p className="mt-3 break-words rounded-lg bg-[hsl(var(--muted)/.4)] px-3 py-2 text-xs leading-5 text-[hsl(var(--foreground))]"><strong>Əlavə məlumat:</strong> {details}</p>}
          </div>;
        })}</div>}
    </section>
  );
}

function SubjectRemovalRequests() {
  const { t } = useI18n();
  const query = useGetAdminSubjectRemovalRequests();
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<number, string>>({});
  const [decisionError, setDecisionError] = useState<Record<number, string>>({});
  const decide = async (id: number, profileId: number, decision: 'approved' | 'rejected', reason?: string) => {
    const rejectionReason = reason?.trim();
    if (decision === 'rejected' && (!rejectionReason || rejectionReason.length < 3)) {
      setDecisionError((current) => ({ ...current, [id]: t('reasonMin') }));
      return;
    }
    setDecisionError((current) => ({ ...current, [id]: '' }));
    const response = await fetch(apiUrl(`/admin/semester-subject-removal-requests/${id}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, ...(decision === 'rejected' ? { rejectionReason } : {}) }) });
    if (response.ok) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetAdminSubjectRemovalRequestsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminAcademicProfileQueryKey(profileId) }),
      ]);
      setRejectingId(null);
      setRejectionReasons((current) => ({ ...current, [id]: '' }));
    } else {
      const data = await response.json().catch(() => ({}));
      setDecisionError((current) => ({ ...current, [id]: data.error ?? t('decisionNotSaved') }));
    }
  };
  return <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.22)] p-4" data-testid="section-subject-removal-requests">
    <p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">{t('removalTitle')}</p>
    {query.isLoading ? <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">{t('requestsLoading')}</p> : !query.data?.length ? <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">{t('noRequests')}</p> : <div className="mt-4 space-y-3">{query.data.map((item) => <div key={item.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-[hsl(var(--primary))]">{item.studentName} · {item.courseTitle}</p><span className="text-xs font-bold">{item.termNumber}. {t('semester')} · {item.status === 'pending' ? t('statusPending') : item.status === 'approved' ? t('statusApproved') : t('statusRejected')}</span></div><p className="mt-2 text-sm"><strong>{t('studentReason')}:</strong> {item.reason}</p>{item.status === 'rejected' && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-900"><strong>{t('sentRejection')}:</strong> {item.rejectionReason || t('noReason')}</p>}{item.status === 'pending' && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void decide(item.id, item.profileId, 'approved')} className="focus-ring rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">{t('approve')}</button>{rejectingId !== item.id && <button type="button" onClick={() => { setRejectingId(item.id); setDecisionError((current) => ({ ...current, [item.id]: '' })); }} className="focus-ring rounded-lg bg-[hsl(var(--destructive))] px-3 py-2 text-xs font-bold text-white">{t('reject')}</button>}{rejectingId === item.id && <div className="basis-full rounded-lg border border-red-200 bg-red-50 p-3"><label className="block text-xs font-bold text-red-900" htmlFor={`input-subject-removal-rejection-${item.id}`}>{t('rejectionNote')}</label><textarea id={`input-subject-removal-rejection-${item.id}`} value={rejectionReasons[item.id] ?? ''} onChange={(event) => setRejectionReasons((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={1000} rows={3} placeholder={t('rejectionPh')} className="focus-ring mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs" data-testid={`input-subject-removal-rejection-${item.id}`} />{decisionError[item.id] && <p className="mt-2 text-xs font-semibold text-red-800" role="alert">{decisionError[item.id]}</p>}<div className="mt-2 flex gap-2"><button type="button" onClick={() => void decide(item.id, item.profileId, 'rejected', rejectionReasons[item.id])} className="focus-ring rounded-lg bg-[hsl(var(--destructive))] px-3 py-2 text-xs font-bold text-white">{t('sendRejection')}</button><button type="button" onClick={() => setRejectingId(null)} className="focus-ring rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-900">{t('cancel')}</button></div></div>}</div>}</div>)}</div>}
  </div>;
}

type StudentManagementTab = 'subject-requests' | 'grading' | 'attendance' | 'excuses' | 'teacher-choices' | 'promotion' | 'schedule-access' | 'assignments' | 'graduation' | 'deleted-students';

function StudentManagementSection({
  pendingSubjectRequestCount,
  pendingExcuseCount,
  onReadExcuses,
  canViewDeletedStudents,
  canGraduate,
  resources,
  canManageAssignments,
  assignmentTeacherClerkUserId,
  focusStudentId,
}: {
  pendingSubjectRequestCount: number;
  pendingExcuseCount: number;
  onReadExcuses: () => void;
  canViewDeletedStudents: boolean;
  canGraduate: boolean;
  resources: LearningResource[];
  canManageAssignments: boolean;
  assignmentTeacherClerkUserId?: string;
  focusStudentId?: number | null;
}) {
  const { t } = useI18n();
  const [activeSection, setActiveSection] = useState<StudentManagementTab | null>('subject-requests');
  const [isPromotionDirectoryOpen, setIsPromotionDirectoryOpen] = useState(false);
  const scrollSectionRef = useRef<StudentManagementTab | null>(null);
  const toggleSection = (value: StudentManagementTab) => {
    const next = activeSection === value ? null : value;
    scrollSectionRef.current = next;
    setActiveSection(next);
  };
  useEffect(() => {
    if (!activeSection || scrollSectionRef.current !== activeSection) return;
    scrollSectionRef.current = null;
    revealTileAndPanel(`tab-student-management-${activeSection}`, `panel-student-management-${activeSection}`);
  }, [activeSection]);
  useEffect(() => {
    if (focusStudentId) {
      scrollSectionRef.current = 'promotion';
      setActiveSection('promotion');
      setIsPromotionDirectoryOpen(true);
    }
  }, [focusStudentId]);
  const sections: Array<{ value: StudentManagementTab; label: string; description: string; Icon: typeof Send }> = [
    { value: 'subject-requests', label: t('tabDrop'), description: t('tabDropHint'), Icon: Send },
    { value: 'grading', label: t('tabGrades'), description: t('tabGradesHint'), Icon: GraduationCap },
    { value: 'attendance', label: t('tabAttendance'), description: t('tabAttendanceHint'), Icon: CalendarDays },
    { value: 'excuses', label: t('tabExcuses'), description: t('tabExcusesHint'), Icon: FileText },
    { value: 'teacher-choices', label: t('tabChoices'), description: t('tabChoicesHint'), Icon: UsersRound },
    { value: 'promotion', label: t('tabPromotion'), description: t('tabPromotionHint'), Icon: GraduationCap },
    { value: 'schedule-access', label: t('tabAccess'), description: t('tabAccessHint'), Icon: CalendarDays },
    ...(canManageAssignments ? [{ value: 'assignments' as const, label: t('tabHomework'), description: t('tabHomeworkHint'), Icon: ClipboardCheck }] : []),
    ...(canGraduate ? [{ value: 'graduation' as const, label: t('tabGraduate'), description: t('tabGraduateHint'), Icon: GraduationCap }] : []),
    ...(canViewDeletedStudents ? [{ value: 'deleted-students' as const, label: t('tabDeleted'), description: t('tabDeletedHint'), Icon: Trash2 }] : []),
  ];

  const renderSection = (tab: StudentManagementTab): ReactNode => [
    tab === 'subject-requests' && <SubjectRemovalRequests />,
    tab === 'grading' && <AcademicManagement mode="grades" />,
    tab === 'attendance' && <RollCallAttendance />,
    tab === 'excuses' && <AttendanceExcuses onRead={onReadExcuses} />,
    tab === 'teacher-choices' && <TeacherChoiceRequests />,
    tab === 'promotion' && <div className="rounded-2xl border border-[hsl(var(--accent)/.55)] bg-[hsl(var(--accent)/.12)] p-5" data-testid="section-semester-promotion-entry"><p className="text-sm font-bold text-[hsl(var(--primary))]">{t('promotionLead')}</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('promotionBody')}</p><button type="button" onClick={() => setIsPromotionDirectoryOpen(true)} className={`${buttonClass} mt-4`} data-testid="button-open-semester-promotion"><GraduationCap size={16} /> {t('pickAndPromote')}</button>{isPromotionDirectoryOpen && <StudentDirectory filter="all" onClose={() => setIsPromotionDirectoryOpen(false)} canEdit={canGraduate} focusStudentId={focusStudentId} />}</div>,
    tab === 'schedule-access' && <div className="space-y-4" data-testid="section-schedule-access-entry"><div className="rounded-2xl border border-[hsl(var(--accent)/.55)] bg-[hsl(var(--accent)/.12)] p-5"><p className="text-sm font-bold text-[hsl(var(--primary))]">{t('accessLead')}</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('accessBody')}</p></div><StudentDirectory filter="all" onClose={() => undefined} canEdit={false} embedded /></div>,
    tab === 'assignments' && canManageAssignments && <AdminAssignmentsSection resources={resources} teacherClerkUserId={assignmentTeacherClerkUserId} />,
    tab === 'graduation' && <GraduationSection />,
    tab === 'deleted-students' && canViewDeletedStudents && <StudentDeletionAudit />,
  ].find(Boolean) || null;
  const sectionPanel = (value: StudentManagementTab) => {
    if (activeSection !== value) return null;
    const content = renderSection(value);
    return content ? <InlineSectionPanel id={`panel-student-management-${value}`} live>{content}</InlineSectionPanel> : null;
  };

  return (
    <section className="space-y-5" data-testid="section-student-management">
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.22)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--secondary-foreground))]">{t('studentOps')}</p>
            <h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{t('tileStudents')}</h3>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t('studentOpsHint')}</p>
          </div>
          <span className="rounded-full bg-[hsl(var(--card))] px-3 py-1.5 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">{sections.length} {t('sectionCount')}</span>
        </div>
        <div className="mt-5 grid grid-flow-row-dense gap-2 sm:grid-cols-2" aria-label={t('studentTabs')}>
          {sections.map(({ value, label, description, Icon }) => <Fragment key={value}>
            <button
              aria-controls={activeSection === value ? `panel-student-management-${value}` : undefined}
              type="button"
              aria-expanded={activeSection === value}
              onClick={() => toggleSection(value)}
              className={`focus-ring relative flex items-start gap-3 rounded-xl border p-3 text-left transition ${activeSection === value ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-xs)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))] hover:border-[hsl(var(--secondary-foreground)/.45)] hover:bg-[hsl(var(--secondary)/.2)]'}`}
              data-testid={`tab-student-management-${value}`}
            >
              <Icon size={17} className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-xs font-bold">
                  {label}
                  {value === 'subject-requests' && pendingSubjectRequestCount > 0 && <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">{pendingSubjectRequestCount}</span>}
                  {value === 'excuses' && pendingExcuseCount > 0 && <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">{pendingExcuseCount}</span>}
                </span>
                <span className={`mt-1 block text-[11px] leading-4 ${activeSection === value ? 'text-[hsl(var(--primary-foreground)/.7)]' : 'text-[hsl(var(--muted-foreground))]'}`}>{description}</span>
              </span>
              {activeSection === value && <TilePointer />}
            </button>
            {sectionPanel(value)}
          </Fragment>)}
        </div>
      </div>
     </section>
  );
}

type TeacherCourseLinks = { telegramUrl: string; zoomUrl: string; googleMeetUrl: string; lessonUrl: string };

function TeacherCourseLinksPortal({ links, onChange }: { links: TeacherCourseLinks; onChange: (key: keyof TeacherCourseLinks, value: string) => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const form = document.querySelector('[data-testid="section-teacher-lesson-details"] form');
    if (!form) return;
    const nextHost = document.createElement('div');
    nextHost.setAttribute('data-testid', 'teacher-course-links-form-slot');
    form.prepend(nextHost);
    setHost(nextHost);
    return () => {
      nextHost.remove();
      setHost(null);
    };
  }, []);

  return host ? createPortal(<TeacherCourseLinksEditor links={links} onChange={onChange} />, host) : null;
}

function TeacherCourseLinksEditor({ links, onChange }: { links: TeacherCourseLinks; onChange: (key: keyof TeacherCourseLinks, value: string) => void }) {
  const linkItems: Array<{ key: keyof TeacherCourseLinks; label: string }> = [
    { key: 'telegramUrl', label: 'Telegram' },
    { key: 'zoomUrl', label: 'Zoom' },
    { key: 'googleMeetUrl', label: 'Google Meet' },
    { key: 'lessonUrl', label: 'Dərs linki' },
  ];
  return (
    <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)] p-4" data-testid="section-teacher-course-links">
      <p className="text-xs font-black uppercase tracking-[.12em] text-[hsl(var(--secondary-foreground))]">Dərs keçid linkləri</p>
      <div className="mt-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card)/.7)] p-3" data-testid="section-existing-teacher-course-links">
        <p className="text-[11px] font-black uppercase tracking-[.1em] text-[hsl(var(--primary))]">Mövcud linklər</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {linkItems.map(({ key, label }) => links[key]
            ? <a key={key} href={links[key]} target="_blank" rel="noreferrer" className="focus-ring inline-flex max-w-full items-center gap-1.5 rounded-lg bg-[hsl(var(--secondary)/.65)] px-2.5 py-1.5 text-xs font-bold text-[hsl(var(--secondary-foreground))] hover:underline" data-testid={`link-existing-${key}`}>{label}<span className="max-w-[180px] truncate opacity-70">{links[key]}</span></a>
            : <span key={key} className="rounded-lg border border-dashed border-[hsl(var(--border))] px-2.5 py-1.5 text-xs text-[hsl(var(--muted-foreground))]">{label}: əlavə edilməyib</span>)}
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Telegram linki"><input type="url" className={inputClass} value={links.telegramUrl} onChange={(event) => onChange('telegramUrl', event.target.value)} placeholder="https://" /></Field>
        <Field label="Zoom linki"><input type="url" className={inputClass} value={links.zoomUrl} onChange={(event) => onChange('zoomUrl', event.target.value)} placeholder="https://" /></Field>
        <Field label="Google Meet linki"><input type="url" className={inputClass} value={links.googleMeetUrl} onChange={(event) => onChange('googleMeetUrl', event.target.value)} placeholder="https://" /></Field>
        <Field label="Dərs linki"><input type="url" className={inputClass} value={links.lessonUrl} onChange={(event) => onChange('lessonUrl', event.target.value)} placeholder="https://" /></Field>
      </div>
      <p className="mt-3 text-[11px] text-[hsl(var(--muted-foreground))]">Linkləri dəyişdikdən sonra yuxarıdakı “Yadda saxla” düyməsinə basın.</p>
    </section>
  );
}

function TeachersScheduleLinksAction({ onClick }: { onClick: () => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const editButton = document.querySelector('[data-testid="button-edit-teachers-lesson"]');
    const parent = editButton?.parentElement;
    if (!parent || !editButton) return;
    const nextHost = document.createElement('span');
    parent.insertBefore(nextHost, editButton);
    setHost(nextHost);
    return () => {
      nextHost.remove();
      setHost(null);
    };
  }, []);
  return host ? createPortal(
    <button type="button" onClick={onClick} className={`${buttonClass} bg-[hsl(var(--secondary-foreground))]`} data-testid="button-open-teachers-schedule-links"><Link2 size={15} /> Yalnız linklər</button>,
    host,
  ) : null;
}

function GraduationSection() {
  const query = useGetGraduationCandidates();
  const graduateStudent = useGraduateStudent();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState('');

  const graduate = (profileId: number, name: string) => {
    if (!window.confirm(`${name} tələbəsini məzun kimi qeyd etmək istəyirsiniz?`)) return;
    setNotice('');
    graduateStudent.mutate({ profileId }, {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetGraduationCandidatesQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetAdminApplicationsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetAdminStudentsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetAdminAcademicProfilesQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetSystemStatisticsQueryKey() }),
        ]);
        setNotice(`${name} məzun kimi qeyd edildi.`);
      },
      onError: (error) => setNotice(error instanceof Error ? error.message : 'Tələbə məzun kimi qeyd edilə bilmədi.'),
    });
  };

  return (
    <section className="rounded-2xl border border-[hsl(var(--accent)/.55)] bg-[hsl(var(--accent)/.12)] p-5" data-testid="section-graduation">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">Məzuniyyət</p>
          <h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Təxərrüc et</h3>
          <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Aktiv semestr cütlüyünə uyğun son semestrdə olan tələbələr burada göstərilir.</p>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Məzuniyyət səviyyələri">
            {graduationCategoryLegend.map((item) => <span key={item.label} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${item.className}`} title={`GPA ${item.range}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${item.dotClassName}`} aria-hidden="true" />
              {item.label} <span className="font-medium opacity-75">({item.range})</span>
            </span>)}
          </div>
        </div>
        {query.data && <span className="rounded-full bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]">{query.data.graduationTerm}-ci semestr</span>}
      </div>
      {notice && <p className="mt-4 rounded-xl bg-[hsl(var(--secondary)/.45)] p-3 text-xs font-semibold text-[hsl(var(--secondary-foreground))]" aria-live="polite">{notice}</p>}
      {query.isLoading ? <p className="mt-5 text-sm text-[hsl(var(--muted-foreground))]">Məzun namizədləri yüklənir...</p>
        : query.isError ? <p className="mt-5 rounded-xl border border-[hsl(var(--destructive)/.2)] bg-[hsl(var(--destructive)/.06)] p-4 text-sm font-semibold text-[hsl(var(--destructive))]">Məzun namizədləri yüklənə bilmədi.</p>
          : query.data?.students.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{query.data.students.map((student) => {
            const name = formatFullName(student.firstName, student.lastName);
            return <article key={student.profileId} className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4" data-testid={`graduation-candidate-${student.profileId}`}>
              <div><h4 className="font-bold text-[hsl(var(--primary))]">{name}</h4><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Tələbə № T{String(student.studentNumber).padStart(4, '0')} · {student.email}</p></div>
              <button type="button" onClick={() => graduate(student.profileId, name)} disabled={graduateStudent.isPending} className={`${buttonClass} shrink-0 px-3 py-2 text-xs`} data-testid={`button-graduate-${student.profileId}`}><GraduationCap size={15} /> Təxərrüc et</button>
            </article>;
          })}</div>
          : <p className="mt-5 rounded-xl border border-dashed border-[hsl(var(--border))] p-5 text-center text-sm text-[hsl(var(--muted-foreground))]">{query.data?.graduationTerm}-ci semestrdə təxərrüc ediləcək tələbə yoxdur.</p>}
    </section>
  );
}

function FormNotice({ text, error = false }: { text?: string; error?: boolean }) {
  if (!text) return null;
  return (
    <div className={`mt-4 flex items-center gap-2 rounded-xl border px-3.5 py-3 text-xs font-semibold ${error ? 'border-[hsl(var(--destructive)/.2)] bg-[hsl(var(--destructive)/.06)] text-[hsl(var(--destructive))]' : 'border-[hsl(var(--secondary-foreground)/.2)] bg-[hsl(var(--secondary)/.55)] text-[hsl(var(--secondary-foreground))]'}`}>
      {error ? <FileText size={15} /> : <CheckCircle2 size={15} />}
      {text}
    </div>
  );
}

 function isSystemOwner(user: {
  publicMetadata?: unknown;
  primaryEmailAddress?: { emailAddress?: string } | null;
} | null | undefined) {
  const metadata = user?.publicMetadata;
  const metadataRole = typeof metadata === 'object' && metadata !== null && 'role' in metadata
    ? (metadata as { role?: unknown }).role
    : null;
  const ownerEmail = import.meta.env.VITE_SYSTEM_OWNER_EMAIL?.trim().toLowerCase();
  const userEmail = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
  return metadataRole === 'owner' || Boolean(ownerEmail && userEmail === ownerEmail);
}

function isOwnerAssistant(user: {
  publicMetadata?: unknown;
} | null | undefined) {
  const metadata = user?.publicMetadata;
  return typeof metadata === 'object' && metadata !== null && 'role' in metadata &&
    (metadata as { role?: unknown }).role === 'owner_assistant';
}

function AnnouncementForm({ onSaved }: { onSaved: () => void }) {
  const { t: tr } = useI18n();
  const [form, setForm] = useState<AnnouncementInput>({ title: '', body: '', date: new Date().toISOString().slice(0, 10), type: AnnouncementInputType.info });
  const [notice, setNotice] = useState('');
  const mutation = useCreateAnnouncement();
  const queryClient = useQueryClient();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    mutation.mutate({ data: form }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetAnnouncementsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetAdminAnnouncementsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setForm({ title: '', body: '', date: new Date().toISOString().slice(0, 10), type: AnnouncementInputType.info });
        setNotice('Elan uğurla yayımlandı.');
        onSaved();
      },
      onError: () => setNotice('Elan yayımlanmadı. Məlumatları yoxlayın.'),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5" data-testid="form-create-announcement">
      <Field label={tr('announcementTitle')}><input required className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={tr('announcementTitlePh')} data-testid="input-announcement-title" /></Field>
      <Field label={tr('announcementBody')}><textarea required rows={6} className={`${inputClass} resize-y`} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={tr('announcementBodyPh')} data-testid="textarea-announcement-body" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tr('announcementDate')}><input required type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="input-announcement-date" /></Field>
        <Field label={tr('announcementKind')}>
          <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })} data-testid="select-announcement-type">
            <option value={AnnouncementInputType.info}>{tr('kindInfo')}</option>
            <option value={AnnouncementInputType.lesson}>{tr('kindLesson')}</option>
            <option value={AnnouncementInputType.book}>{tr('kindBook')}</option>
            <option value={AnnouncementInputType.announcement}>{tr('kindAnnouncement')}</option>
            <option value={AnnouncementInputType.important}>{tr('kindImportant')}</option>
            <option value={AnnouncementInputType.news}>{tr('kindNews')}</option>
            <option value={AnnouncementInputType.admission}>{tr('kindAdmission')}</option>
          </select>
        </Field>
      </div>
      <div className="flex justify-end"><button type="submit" className={buttonClass} disabled={mutation.isPending} data-testid="button-create-announcement"><Megaphone size={16} /> {mutation.isPending ? tr('publishing') : tr('publishAnnouncement')}</button></div>
      <FormNotice text={notice} error={notice.includes('yayımlanmadı')} />
    </form>
  );
}

function StudentNotificationForm() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetTerms, setTargetTerms] = useState<number[]>([1]);
  const [activeTerms, setActiveTerms] = useState<number[]>([1, 2, 3, 4]);
  const [destination, setDestination] = useState<'home' | 'gmail' | 'both'>('home');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void fetch(apiUrl('/admin/course-activation'))
      .then((response) => response.ok ? response.json() as Promise<{ activeTermNumbers?: number[] }> : Promise.reject())
      .then((result) => {
        const terms = result.activeTermNumbers?.filter((term) => Number.isInteger(term) && term >= 1 && term <= 8) ?? [];
        setActiveTerms(terms);
        setTargetTerms((current) => current.filter((term) => terms.includes(term)));
      })
      .catch(() => undefined);
  }, []);
  const toggleTerm = (term: number) => setTargetTerms((current) => current.includes(term) ? current.filter((item) => item !== term) : [...current, term].sort((a, b) => a - b));
  const send = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    if (!targetTerms.length) { setNotice('Ən azı bir semestr seçin.'); return; }
    setSaving(true);
    try {
      const response = await fetch(apiUrl('/admin/student-notifications'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, targetTerms, destination }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Bildiriş göndərilmədi.');
      setTitle('');
      setBody('');
      setNotice('Bildiriş seçilmiş semestr tələbələrinə göndərildi.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Bildiriş göndərilmədi.');
    } finally { setSaving(false); }
  };
  return <form onSubmit={send} className="space-y-5" data-testid="form-create-student-notification">
    <div><p className="font-serif text-3xl font-bold leading-tight tracking-[-.03em] text-[hsl(var(--primary))] sm:text-4xl">Tələbələrə bildiriş</p><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Bildiriş tələbə səhifəsinə daxil olduqda əsas mesaj kimi açılacaq.</p></div>
    <Field label="Başlıq"><input required maxLength={160} className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Məsələn: Vacib cədvəl dəyişikliyi" data-testid="input-student-notification-title" /></Field>
    <Field label="Mesaj"><textarea required maxLength={5000} rows={6} className={`${inputClass} resize-y`} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Tələbələrə göndəriləcək mesajı yazın." data-testid="textarea-student-notification-body" /></Field>
    <div><p className="mb-2 text-xs font-bold text-[hsl(var(--primary))]">Hədəf semestrlər</p>{activeTerms.length ? <><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{activeTerms.map((term) => <label key={term} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold ${targetTerms.includes(term) ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.22)]' : 'border-[hsl(var(--border))]'}`}><input type="checkbox" checked={targetTerms.includes(term)} onChange={() => toggleTerm(term)} />{term}-ci semestr</label>)}</div><button type="button" onClick={() => setTargetTerms(targetTerms.length === activeTerms.length ? [] : activeTerms)} className={`focus-ring mt-3 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black shadow-[0_3px_0_hsl(37_83%_52%)] transition hover:-translate-y-0.5 ${targetTerms.length === activeTerms.length ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-[hsl(var(--primary))]' : 'border-[hsl(var(--accent)/.7)] bg-[hsl(var(--accent)/.16)] text-[hsl(var(--primary))]'}`}><CheckCircle2 size={15} />{targetTerms.length === activeTerms.length ? 'Bütün aktiv semestrlər seçildi · Seçimi təmizlə' : 'Bütün aktiv semestrləri seç'}</button></> : <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-3 text-xs text-[hsl(var(--muted-foreground))]">Hazırda aktiv semestr yoxdur.</p>}</div>
    <Field label="Bildiriş hara getsin?"><select className={inputClass} value={destination} onChange={(event) => setDestination(event.target.value as typeof destination)} data-testid="select-student-notification-destination"><option value="home">Tələbənin ana səhifəsinə</option><option value="gmail">Tələbənin Gmail ünvanına</option><option value="both">Həm ana səhifəsinə, həm Gmail-ə</option></select></Field>
    <div className="flex justify-end"><button type="submit" disabled={saving} className={buttonClass} data-testid="button-send-student-notification"><Send size={16} /> {saving ? 'Göndərilir...' : 'Bildirişi göndər'}</button></div>
    <FormNotice text={notice} error={notice.includes('göndərilmədi') || notice.includes('seçin')} />
  </form>;
}

function AnnouncementList() {
  const announcementsQuery = useGetAdminAnnouncements();
  const updateMutation = useUpdateAnnouncementById();
  const deleteMutation = useDeleteAnnouncement();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAddingAssignment, setIsAddingAssignment] = useState(false);
  const [form, setForm] = useState<Announcement | null>(null);
  const [notice, setNotice] = useState('');

  const startEdit = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setForm(announcement);
    setNotice('');
  };
  const saveEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editingId || !form) return;
    setNotice('');
    updateMutation.mutate({ announcementId: editingId, data: {
      title: form.title,
      body: form.body,
      date: form.date,
      type: form.type,
    } }, {
      onSuccess: async () => {
        setEditingId(null);
        setForm(null);
        setNotice('Yenilik yeniləndi.');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetAdminAnnouncementsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetAnnouncementsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
        ]);
      },
      onError: () => setNotice('Yenilik yenilənmədi.'),
    });
  };
  const remove = (id: number) => {
    if (!window.confirm('Bu yeniliyi silmək istədiyinizə əminsiniz?')) return;
    deleteMutation.mutate({ announcementId: id }, {
      onSuccess: async () => {
        setNotice('Yenilik silindi.');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetAdminAnnouncementsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetAnnouncementsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
        ]);
      },
      onError: () => setNotice('Yenilik silinmədi.'),
    });
  };

  return (
    <div className="mt-8 border-t border-[hsl(var(--border))] pt-6">
      <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Əvvəl yayımlananlar</p><h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Yeniliklər</h3></div><Megaphone className="text-[hsl(var(--secondary-foreground))]" size={20} /></div>
      {announcementsQuery.isLoading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Yeniliklər yüklənir...</p> : announcementsQuery.data?.length ? <div className="space-y-2">{announcementsQuery.data.map((announcement) => editingId === announcement.id && form ? (
        <form key={announcement.id} onSubmit={saveEdit} className="space-y-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.55)] p-3">
          <input required className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Başlıq" />
          <textarea required rows={4} className={`${inputClass} resize-y`} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Mətn" />
          <div className="grid gap-3 sm:grid-cols-2"><input required type="date" className={inputClass} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /><select className={inputClass} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Announcement['type'] })}><option value={AnnouncementInputType.info}>Məlumat</option><option value={AnnouncementInputType.lesson}>Yeni dərs</option><option value={AnnouncementInputType.book}>Yeni Kitab</option><option value={AnnouncementInputType.announcement}>Elan</option><option value={AnnouncementInputType.important}>Vacib elan</option><option value={AnnouncementInputType.news}>Xəbər</option><option value={AnnouncementInputType.admission}>Tələbə qəbulu</option></select></div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => { setEditingId(null); setForm(null); }} className="focus-ring rounded-lg px-3 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))]">Ləğv et</button><button type="submit" className={buttonClass} disabled={updateMutation.isPending}>Yadda saxla</button></div>
        </form>
      ) : <div key={announcement.id} className="rounded-xl bg-[hsl(var(--muted)/.55)] p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-bold text-[hsl(var(--primary))]">{announcement.title}</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{announcement.body}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--secondary-foreground))]">{announcement.date}</p></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => startEdit(announcement)} className="focus-ring rounded-lg px-2 py-1 text-[11px] font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--card))]">Redaktə et</button><button type="button" onClick={() => remove(announcement.id)} className="focus-ring rounded-lg px-2 py-1 text-[11px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--card))]" disabled={deleteMutation.isPending}>Sil</button></div></div></div>)}</div> : <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-5 text-center text-xs text-[hsl(var(--muted-foreground))]">Hələ yenilik əlavə edilməyib.</p>}
      {notice && <FormNotice text={notice} error={notice.includes('yenilənmədi') || notice.includes('silinmədi')} />}
    </div>
  );
}

function ArticleForm() {
  const { t } = useI18n();
  const [form, setForm] = useState<ArticleInput>({ title: '', excerpt: '', body: '', author: '' });
  const [notice, setNotice] = useState('');
  const mutation = useCreateArticle();
  const queryClient = useQueryClient();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    mutation.mutate({ data: form }, {
      onSuccess: () => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetAdminArticlesQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetArticlesQueryKey() }),
        ]);
        setForm({ title: '', excerpt: '', body: '', author: '' });
        setNotice(t('articlePublished'));
      },
      onError: () => setNotice(t('articleNotPublished')),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5" data-testid="form-create-article">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('artTitle')}><input required minLength={3} maxLength={160} className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('artTitlePh')} data-testid="input-article-title" /></Field>
        <Field label={t('artAuthor')}><input required maxLength={120} className={inputClass} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder={t('authorPh')} data-testid="input-article-author" /></Field>
      </div>
      <Field label={t('artIntro')} hint={t('artIntroHint')}>
        <textarea required maxLength={320} rows={3} className={`${inputClass} resize-y`} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder={t('artIntroPh')} data-testid="textarea-article-excerpt" />
      </Field>
      <Field label={t('artBody')} hint={t('artBodyHint')}>
        <textarea required maxLength={12000} rows={10} className={`${inputClass} resize-y`} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={t('artBodyPh')} data-testid="textarea-article-body" />
      </Field>
      <div className="flex justify-end"><button type="submit" className={buttonClass} disabled={mutation.isPending} data-testid="button-create-article"><BookOpenText size={16} /> {mutation.isPending ? t('publishing') : t('publishArticle')}</button></div>
      <FormNotice text={notice} error={notice.includes(t('articleNotPublished')) || notice.includes('yayımlanmadı')} />
    </form>
  );
}

function DailyBenefitForm() {
  const { t } = useI18n();
  const days = [
    ['monday', `1. ${t('benefitDay')}`], ['tuesday', `2. ${t('benefitDay')}`], ['wednesday', `3. ${t('benefitDay')}`],
    ['thursday', `4. ${t('benefitDay')}`], ['friday', `5. ${t('benefitDay')}`], ['saturday', `6. ${t('benefitDay')}`], ['sunday', `7. ${t('benefitDay')}`],
  ] as const;
  type Day = typeof days[number][0];
  type DayForm = Record<Day, { body: string; source: string }>;
  const emptyForm = (): DayForm => Object.fromEntries(days.map(([day]) => [day, { body: '', source: '' }])) as DayForm;
  const [form, setForm] = useState<DayForm>(emptyForm);
  const [openDay, setOpenDay] = useState<Day | null>(null);
  const [savingDay, setSavingDay] = useState<Day | null>(null);
  const [recentlyUpdatedDays, setRecentlyUpdatedDays] = useState<Partial<Record<Day, string>>>({});
  const [notice, setNotice] = useState('');
  const benefitsQuery = useGetAdminDailyBenefits();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!benefitsQuery.data) return;
    const next = emptyForm();
    benefitsQuery.data.forEach((benefit) => {
      if (benefit.dayOfWeek in next) next[benefit.dayOfWeek] = { body: benefit.body, source: benefit.source };
    });
    setForm(next);
  }, [benefitsQuery.data]);

  const dayOrder: Day[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const isPastBenefitStale = (day: Day) => {
    const benefit = benefitsQuery.data?.find((item) => item.dayOfWeek === day);
    if (!benefit) return false;
    const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Riyadh' }).format(new Date()).toLowerCase() as Day;
    const todayIndex = dayOrder.indexOf(today);
    const dayIndex = dayOrder.indexOf(day);
    if (todayIndex < 0 || dayIndex < 0 || dayIndex >= todayIndex) return false;
    const occurrence = new Date();
    occurrence.setDate(occurrence.getDate() - (todayIndex - dayIndex));
    const locallyUpdatedAt = recentlyUpdatedDays[day];
    if (locallyUpdatedAt && new Date(locallyUpdatedAt) >= occurrence) return false;
    return new Date(benefit.createdAt) < occurrence;
  };

  const saveDay = async (day: Day, label: string) => {
    const entry = form[day];
    if (!entry.body.trim() || !entry.source.trim()) {
      setNotice(`${label}: ${t('fillBenefit')}`);
      return;
    }
    setSavingDay(day);
    setNotice('');
    try {
      const response = await fetch(apiUrl('/admin/daily-benefits'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: entry.body, source: entry.source, dayOfWeek: day }),
      });
      if (!response.ok) throw new Error('save');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetAdminDailyBenefitsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetDailyBenefitQueryKey() }),
      ]);
      setRecentlyUpdatedDays((current) => ({ ...current, [day]: new Date().toISOString() }));
      setNotice(`${label}: ${t('benefitAdded')}`);
    } catch {
      setNotice(`${label}: ${t('benefitNotSaved')}`);
    } finally {
      setSavingDay(null);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    try {
      await Promise.all(days.map(async ([day]) => {
        const entry = form[day];
        if (entry.body.trim() && entry.source.trim()) {
          const response = await fetch(apiUrl('/admin/daily-benefits'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: entry.body, source: entry.source, dayOfWeek: day }),
          });
          if (!response.ok) throw new Error('save');
        } else {
          const response = await fetch(apiUrl(`/admin/daily-benefits/${day}`), { method: 'DELETE' });
          if (!response.ok && response.status !== 404) throw new Error('delete');
        }
      }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetAdminDailyBenefitsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetDailyBenefitQueryKey() }),
      ]);
      setNotice(t('weekSaved'));
    } catch {
      setNotice(t('benefitsNotSaved'));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" data-testid="form-create-daily-benefit">
      <div><p className="text-sm font-bold text-[hsl(var(--primary))]">{t('weekBenefits')}</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('weekBenefitsHint')}</p></div>
      <div className="space-y-4">{days.map(([day, label]) => <div key={day} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.22)] p-4">
        <button type="button" onClick={() => setOpenDay((current) => current === day ? null : day)} aria-expanded={openDay === day} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))]" data-testid={`button-daily-benefit-day-${day}`}>{isPastBenefitStale(day) && <span className="h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_0_3px_hsl(0_84%_60%/.2)]" title={t('staleBenefit')} aria-label={t('staleBenefit')} />}{label}</button>
        {openDay === day && <div className="mt-3 space-y-3"><textarea maxLength={2000} rows={3} className={`${inputClass} resize-y`} value={form[day].body} onChange={(e) => setForm((current) => ({ ...current, [day]: { ...current[day], body: e.target.value } }))} placeholder={t('benefitPh')} data-testid={`textarea-daily-benefit-body-${day}`} /><input maxLength={200} className={inputClass} value={form[day].source} onChange={(e) => setForm((current) => ({ ...current, [day]: { ...current[day], source: e.target.value } }))} placeholder={t('source')} data-testid={`input-daily-benefit-source-${day}`} /><div className="flex justify-end"><button type="button" onClick={() => void saveDay(day, label)} disabled={savingDay !== null} className={buttonClass} data-testid={`button-add-daily-benefit-${day}`}><Plus size={16} /> {savingDay === day ? t('adding') : t('add')}</button></div></div>}
      </div>)}</div>
      <div className="flex justify-end"><button type="submit" className={buttonClass} disabled={benefitsQuery.isLoading || benefitsQuery.isFetching} data-testid="button-create-daily-benefit"><Quote size={16} /> {t('save')}</button></div>
      <FormNotice text={notice} error={notice.includes(t('benefitNotSaved')) || notice.includes(t('benefitsNotSaved')) || notice.includes('saxlanılmadı')} />
    </form>
  );
}

function ArticleList({ articles }: { articles: Article[] }) {
  const { t } = useI18n();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ArticleInput>({ title: '', excerpt: '', body: '', author: '' });
  const [notice, setNotice] = useState('');
  const queryClient = useQueryClient();
  const startEdit = (article: Article) => { setEditingId(article.id); setForm({ title: article.title, excerpt: article.excerpt, body: article.body, author: article.author }); setNotice(''); };
  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch(apiUrl(`/admin/articles/${editingId}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (!response.ok) { setNotice(t('articleNotUpdated')); return; }
    setEditingId(null); setNotice(t('articleUpdated'));
    await Promise.all([queryClient.invalidateQueries({ queryKey: getGetAdminArticlesQueryKey() }), queryClient.invalidateQueries({ queryKey: getGetArticlesQueryKey() })]);
  };
  const deleteArticle = async (articleId: number) => {
    if (!window.confirm(t('confirmDeleteArticle'))) return;
    const response = await fetch(apiUrl(`/admin/articles/${articleId}`), { method: 'DELETE' });
    if (!response.ok) { setNotice(t('articleNotDeleted')); return; }
    setNotice(t('articleDeleted'));
    await Promise.all([queryClient.invalidateQueries({ queryKey: getGetAdminArticlesQueryKey() }), queryClient.invalidateQueries({ queryKey: getGetArticlesQueryKey() })]);
  };
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{t('recentPublished')}</p><h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{t('articles')}</h3></div><BookOpenText className="text-[hsl(var(--secondary-foreground))]" size={20} /></div>
      {articles.length ? <div className="space-y-2">{articles.slice(0, 5).map((article) => editingId === article.id ? <form key={article.id} onSubmit={saveEdit} className="space-y-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.55)] p-3"><input required className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={t('artTitlePh')} /><input required className={inputClass} value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} placeholder={t('artAuthor')} /><textarea required rows={2} className={`${inputClass} resize-y`} value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} placeholder={t('artIntro')} /><textarea required rows={5} className={`${inputClass} resize-y`} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder={t('artBody')} /><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingId(null)} className="focus-ring rounded-lg px-3 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))]">{t('cancel')}</button><button type="submit" className={buttonClass}>{t('save')}</button></div></form> : <div key={article.id} className="rounded-xl bg-[hsl(var(--muted)/.55)] p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-bold text-[hsl(var(--primary))]">{article.title}</p><div className="flex shrink-0 gap-1"><button type="button" onClick={() => startEdit(article)} className="focus-ring rounded-lg px-2 py-1 text-[11px] font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--card))]">{t('edit')}</button><button type="button" onClick={() => void deleteArticle(article.id)} className="focus-ring rounded-lg px-2 py-1 text-[11px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--card))]">{t('delete')}</button></div></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{article.excerpt}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--secondary-foreground))]">{formatPersonName(article.author)}</p></div>)}</div> : <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] px-5 py-10 text-center"><FileText className="mx-auto text-[hsl(var(--muted-foreground))]" size={22} /><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">{t('noArticles')}</p></div>}
      {notice && <FormNotice text={notice} error={notice.includes(t('articleNotUpdated')) || notice.includes(t('articleNotDeleted')) || (notice.includes('məqalə') && !notice.includes('yeniləndi') && !notice.includes('silindi'))} />}
    </div>
  );
}

function DailyBenefitList({ benefits }: { benefits: DailyBenefit[] }) {
  const benefit = benefits[0];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[hsl(37_55%_72%/.45)] bg-[hsl(var(--accent)/.45)] px-5 py-4">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]"><Quote size={14} /> Günün faydası</p>
      {benefit ? <div className="relative mt-2"><p className="font-serif text-lg leading-7 text-[hsl(var(--primary))]">“{benefit.body}”</p><p className="mt-2 text-xs font-bold text-[hsl(var(--secondary-foreground))]">— {benefit.source}</p></div> : <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Hələ günün faydası əlavə edilməyib.</p>}
    </div>
  );
}

function SchedulePrepSection({ onOpenStudents, onOpenTeachers }: { onOpenStudents?: () => void; onOpenTeachers?: () => void }) {
  const { t: tr } = useI18n();
  const dayName = (day: string) => {
    const key = { monday: 'dayMon', tuesday: 'dayTue', wednesday: 'dayWed', thursday: 'dayThu', friday: 'dayFri', saturday: 'daySat', sunday: 'daySun' }[day];
    return key ? tr(key as 'dayMon') : day;
  };
  const coursesQuery = useGetCourses();
  const resourcesQuery = useGetAdminResources();
  const queryClient = useQueryClient();
  const [termNumber, setTermNumber] = useState(1);
  const [title, setTitle] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [booksCourseId, setBooksCourseId] = useState<number | null>(null);
  // Dərs formasında Kitabxanadan seçilən kitablar (dərslə birlikdə lms_course_books-a yazılır).
  const catalog = useLibraryCatalog();
  const courseBooks = useCourseBooks();
  const libraryBooks = catalog.books ?? [];
  const bookBySlug = new Map(libraryBooks.map((book) => [book.slug, book]));
  // Dərs günləri və saatları (1-ci addım). Redaktədə yalnız dəyişəndə göndərilir və dərsin bütün qruplarına tətbiq olunur.
  const [lessonDays, setLessonDays] = useState<string[]>([]);
  const [dayTimes, setDayTimes] = useState<Record<string, string>>({});
  const [initialSchedule, setInitialSchedule] = useState('');
  const scheduleKey = (days: string[], times: Record<string, string>) => JSON.stringify(lessonDayOptions.filter(([day]) => days.includes(day)).map(([day]) => [day, times[day] ?? '']));
  // Köhnə kurs formundan köçürülən sahələr: dərs sayı, icbari / ixtiyari, PDF linki, mövzular.
  const [totalLessons, setTotalLessons] = useState(0);
  const [isMandatory, setIsMandatory] = useState(true);
  const [pdfUrl, setPdfUrl] = useState('');
  const [topics, setTopics] = useState('');
  // Redaktədə mövcud dəyərlər yüklənməmiş boş dəyərlər göndərilməsin deyə.
  const [detailsReady, setDetailsReady] = useState(true);
  const [bookDrafts, setBookDrafts] = useState<CourseBookDraft[]>([]);
  // Redaktədə mövcud kitablar yüklənməmiş boş siyahı göndərilib onları silməsin deyə.
  const [bookDraftsReady, setBookDraftsReady] = useState(true);
  const booksAvailable = courseBooks.available && !catalog.error;
  const booksLoading = catalog.loading || courseBooks.loading;
  // Synchronous guard: a double click / Enter+click can submit twice before the
  // disabled state re-renders, which created two identical lessons.
  const savingRef = useRef(false);
  const lessons = Array.from(new Map((resourcesQuery.data ?? []).filter((resource) => resource.termNumber === termNumber).map((resource) => [resource.courseId, resource])).values());

  const reset = () => {
    setEditingId(null);
    setEditingCourseId(null);
    setTitle('');
    setLessonDays([]);
    setDayTimes({});
    setInitialSchedule('');
    setTotalLessons(0);
    setIsMandatory(true);
    setPdfUrl('');
    setTopics('');
    setDetailsReady(true);
    setBookDrafts([]);
    setBookDraftsReady(true);
  };

  const fillDraftsFor = (courseId: number) => {
    const saved = courseBooks.items.find((item) => item.courseId === courseId && item.termNumber === termNumber)?.books ?? [];
    setBookDrafts(saved.map((view) => courseBookDraftFromView(view, bookBySlug.get(view.slug))));
  };

  const startEdit = (lesson: { id: number; courseId: number }, courseTitle: string) => {
    setEditingId(lesson.id);
    setEditingCourseId(lesson.courseId);
    setTitle(courseTitle);
    // Cədvəl: qrupsuz cədvəl sətri varsa ondan, yoxsa ilk qrupdan götürülür.
    const rows = (resourcesQuery.data ?? []).filter((resource) => resource.courseId === lesson.courseId && resource.termNumber === termNumber);
    const source = rows.find((resource) => !resource.teacherClerkUserId) ?? rows[0];
    const days = lessonDayOptions.map(([day]) => day as string).filter((day) => (source?.lessonDays as string[] | undefined)?.includes(day));
    const times = parseDayTimes(source?.lessonTime, days);
    setLessonDays(days);
    setDayTimes(times);
    setInitialSchedule(scheduleKey(days, times));
    setIsMandatory(source?.isMandatory ?? true);
    const listed = coursesQuery.data?.find((course) => course.id === lesson.courseId);
    setTotalLessons(listed?.totalLessons ?? 0);
    setPdfUrl(listed?.pdfUrl ?? '');
    setTopics('');
    setDetailsReady(false);
    void fetch(apiUrl(`/admin/courses/${lesson.courseId}`))
      .then((response) => response.ok ? response.json() as Promise<{ totalLessons?: number; pdfUrl?: string | null; curriculum?: string[] }> : Promise.reject(new Error('course')))
      .then((course) => {
        setTotalLessons(course.totalLessons ?? 0);
        setPdfUrl(course.pdfUrl ?? '');
        setTopics((course.curriculum ?? []).join('\n'));
        setDetailsReady(true);
      })
      .catch(() => setNotice('Dərsin mövzuları yüklənmədi; mövzular dəyişdirilməyəcək.'));
    setNotice('');
    // Kitablar «Kitablar» panelində dəyişmiş ola bilər — həmişə təzə siyahı yüklənir.
    setBookDrafts([]);
    setBookDraftsReady(false);
    void courseBooks.reload();
    window.setTimeout(() => document.querySelector('[data-testid="form-schedule-prep"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
  };

  useEffect(() => {
    if (editingCourseId === null || bookDraftsReady || booksLoading) return;
    fillDraftsFor(editingCourseId);
    setBookDraftsReady(true);
  }, [editingCourseId, bookDraftsReady, booksLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setNotice('');
    setIsSaving(true);
    try {
      if (!title.trim()) throw new Error('Dərs adı mütləqdir.');
      const orderedDays = lessonDayOptions.map(([day]) => day as string).filter((day) => lessonDays.includes(day));
      if (orderedDays.some((day) => !/^\d{2}:\d{2}$/.test(dayTimes[day] ?? ''))) throw new Error('Hər seçilmiş gün üçün dərs saatı yazın.');
      const scheduleChanged = editingId === null ? orderedDays.length > 0 : scheduleKey(orderedDays, dayTimes) !== initialSchedule;
      const schedulePayload = scheduleChanged ? { lessonDays: orderedDays, lessonDayTimes: Object.fromEntries(orderedDays.map((day) => [day, dayTimes[day]])) } : {};
      const trimmedPdf = pdfUrl.trim();
      if (trimmedPdf && !/^https:\/\/\S+$/i.test(trimmedPdf) && !trimmedPdf.startsWith('/objects/')) throw new Error('PDF linki https:// ilə başlamalıdır.');
      const topicList = topics.split('\n').map((item) => item.trim()).filter(Boolean);
      // Redaktədə mövzular və PDF yalnız mövcud dəyərlər yükləndikdən sonra göndərilir.
      const detailsPayload = { totalLessons, isMandatory, ...(detailsReady ? { pdfUrl: trimmedPdf || null, curriculum: topicList } : {}) };
      const { entries, dropped } = courseBookEntriesFromDrafts(bookDrafts, bookBySlug);
      // Yeni dərsdə yalnız seçilən kitablar göndərilir; redaktədə siyahı tam yazılır (boş = kitablar çıxarılır).
      const sendBooks = booksAvailable && !booksLoading && bookDraftsReady && (editingId !== null || entries.length > 0);
      const response = await fetch(apiUrl(editingId === null ? '/admin/schedule-lessons' : `/admin/schedule-lessons/${editingId}`), {
        method: editingId === null ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termNumber, title: title.trim(), ...schedulePayload, ...detailsPayload, ...(sendBooks ? { books: entries } : {}) }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; booksSaved?: boolean; booksError?: string | null };
      if (!response.ok) throw new Error(result.error || 'Dərs yadda saxlanılmadı.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetAdminResourcesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetCoursesQueryKey() }),
        sendBooks ? courseBooks.reload() : Promise.resolve(),
      ]);
      const base = editingId === null ? 'Dərs əlavə edildi. Növbəti addım: «2 Tələbələr» — «Qruplar» bölməsində qrup yaradın.' : scheduleChanged ? 'Dərs yeniləndi; gün, saat və dərsin növü bütün qruplarına tətbiq olundu.' : 'Dərs yeniləndi.';
      const booksText = result.booksError
        ? ` ${result.booksError}`
        : result.booksSaved
          ? entries.length ? ` ${entries.length} kitab dərsə bağlandı.` : ' Dərsdən kitablar çıxarıldı.'
          : '';
      setNotice(`${base}${booksText}${dropped && !result.booksError ? ` Kitabxanadan silinmiş ${dropped} kitab siyahıdan çıxarıldı.` : ''}`);
      reset();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Dərs yadda saxlanılmadı.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const remove = async (resourceId: number) => {
    if (!window.confirm('Bu dərsi silmək istəyirsiniz?')) return;
    const response = await fetch(apiUrl(`/admin/schedule-lessons/${resourceId}`), { method: 'DELETE' });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setNotice(result.error || 'Dərs silinmədi.');
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetAdminResourcesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetCoursesQueryKey() }),
    ]);
    if (editingId === resourceId) reset();
    setNotice('Dərs silindi.');
  };

  const bookCountFor = (courseId: number) => courseBooks.items.find((item) => item.courseId === courseId && item.termNumber === termNumber)?.books.filter((book) => book.available).length ?? 0;

  return (
    <section className="space-y-5" data-testid="section-schedule-prep">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{tr('scheduleStep')}</p>
        <h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{tr('tileSchedulePrep')}</h3>
        <div className="mt-2"><SetupSteps active={1} onOpenStudents={onOpenStudents} onOpenTeachers={onOpenTeachers} /></div>
        <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{tr('schedulePrepHint')}</p>
      </div>
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] p-4" data-testid="form-schedule-prep">
        {editingId !== null && <p className="text-xs font-black text-[hsl(var(--secondary-foreground))]" data-testid="text-schedule-prep-editing">{tr('editingLesson')}</p>}
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <Field label={tr('semester')}>
            <select className={inputClass} value={termNumber} onChange={(event) => { setTermNumber(Number(event.target.value)); reset(); }} disabled={editingId !== null} data-testid="select-schedule-prep-term">
              {Array.from({ length: 8 }, (_, index) => index + 1).map((term) => <option key={term} value={term}>{term}. {tr('termLabel')}</option>)}
            </select>
          </Field>
          <Field label={tr('lessonName')}>
            <input required className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={tr('lessonNamePh')} data-testid="input-schedule-prep-title" />
          </Field>
        </div>
        <Field label={tr('weekDaysTimes')} hint={editingId !== null ? tr('weekDaysEditHint') : tr('weekDaysHint')}>
          <div className="grid gap-1.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 sm:grid-cols-2" data-testid="schedule-prep-days">
            {lessonDayOptions.map(([value]) => {
              const selected = lessonDays.includes(value);
              const label = dayName(value);
              return (
                <div key={value} className="flex min-h-10 flex-wrap items-center gap-2">
                  <label className="flex min-w-36 items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))]">
                    <input type="checkbox" checked={selected} onChange={(event) => setLessonDays((current) => event.target.checked ? [...current, value] : current.filter((day) => day !== value))} data-testid={`checkbox-schedule-prep-day-${value}`} />
                    {label}
                  </label>
                  {selected && <input required type="time" className={`${inputClass} max-w-36 py-2`} value={dayTimes[value] ?? ''} onChange={(event) => setDayTimes((current) => ({ ...current, [value]: event.target.value }))} aria-label={label} data-testid={`input-schedule-prep-time-${value}`} />}
                </div>
              );
            })}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={tr('lessonTotal')} hint={tr('lessonCountHint')}>
            <input type="number" min={0} step={1} className={inputClass} value={totalLessons} onChange={(event) => setTotalLessons(Math.max(0, Math.trunc(Number(event.target.value) || 0)))} data-testid="input-schedule-prep-total-lessons" />
          </Field>
          <Field label={tr('lessonKind')} hint={tr('lessonKindHint')}>
            <select className={inputClass} value={isMandatory ? 'mandatory' : 'optional'} onChange={(event) => setIsMandatory(event.target.value === 'mandatory')} data-testid="select-schedule-prep-requirement">
              <option value="mandatory">{tr('mandatoryLesson')}</option>
              <option value="optional">{tr('optionalLesson')}</option>
            </select>
          </Field>
          <Field label={tr('pdfLink')} hint={tr('optionalField')}>
            <input type="url" inputMode="url" className={inputClass} value={pdfUrl} onChange={(event) => setPdfUrl(event.target.value)} placeholder="https://" disabled={!detailsReady} data-testid="input-schedule-prep-pdf-url" />
          </Field>
        </div>
        <Field label={tr('topics')} hint={tr('topicsHint')}>
          <textarea rows={4} className={`${inputClass} resize-y`} value={topics} onChange={(event) => setTopics(event.target.value)} disabled={!detailsReady} data-testid="textarea-schedule-prep-topics" />
        </Field>
        <Field label={tr('courseBooksLabel')} hint={tr('courseBooksHint')}>
          <div className="space-y-2" data-testid="schedule-prep-books">
            {!booksAvailable
              ? <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900" data-testid="text-schedule-prep-books-unavailable">{catalog.error || courseBooks.message || tr('booksUnavailable')}</p>
              : booksLoading || !bookDraftsReady
                ? <p className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><RefreshCw size={13} className="animate-spin" /> {tr('libraryLoading')}</p>
                : <>
                    {bookDrafts.length === 0 && <p className="text-xs text-[hsl(var(--muted-foreground))]">{tr('noBookSelected')}</p>}
                    <CourseBookDraftsFields drafts={bookDrafts} onChange={setBookDrafts} books={libraryBooks} courseTitle={title} testIdPrefix="schedule-prep-book" />
                  </>}
          </div>
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          {editingId !== null && <button type="button" onClick={reset} className="focus-ring rounded-xl px-4 py-2.5 text-xs font-bold text-[hsl(var(--muted-foreground))]">{tr('cancel')}</button>}
          <button type="submit" className={buttonClass} disabled={isSaving} data-testid="button-save-schedule-prep">{isSaving ? tr('saving') : editingId === null ? tr('addLesson') : tr('saveChanges')}</button>
        </div>
      </form>
      {notice && <FormNotice text={notice} error={notice.includes('bil') || notice.includes('mütləq') || notice.includes('silinmə') || notice.includes('artıq var') || notice.includes('bağlıdır') || notice.includes('saxlanılmadı') || notice.includes('aktiv deyil') || notice.includes('tapılmadı') || notice.includes('düzgün deyil')} />}
      <div className="space-y-2" data-testid="list-schedule-prep">
        {resourcesQuery.isLoading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">{tr('listLoading')}</p> : lessons.length ? lessons.map((lesson) => {
          const courseTitle = coursesQuery.data?.find((course) => course.id === lesson.courseId)?.title ?? lesson.title;
          const bookCount = bookCountFor(lesson.courseId);
          return (
            <div key={lesson.courseId} className={`rounded-xl border bg-[hsl(var(--card))] px-4 py-3 ${editingId === lesson.id ? 'border-[hsl(var(--primary))]' : 'border-[hsl(var(--border))]'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-bold text-[hsl(var(--primary))]">{courseTitle}<span className="ml-2 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">{(() => { const rows = (resourcesQuery.data ?? []).filter((resource) => resource.courseId === lesson.courseId && resource.termNumber === termNumber); const source = rows.find((resource) => !resource.teacherClerkUserId) ?? rows[0]; return source?.lessonDays.length ? source.lessonDays.map((day) => `${dayName(day)} ${parseDayTimes(source.lessonTime, [day])[day] || ''}`.trim()).join(', ') : tr('noDayTime'); })()}</span>{bookCount > 0 && <span className="ms-2 rounded-full bg-[hsl(var(--secondary)/.45)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--secondary-foreground))]">{bookCount} {tr('bookWord')}</span>}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={`focus-ring inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--muted))] ${booksCourseId === lesson.courseId ? 'bg-[hsl(var(--muted))]' : ''}`} onClick={() => { if (booksCourseId === lesson.courseId) void courseBooks.reload(); setBooksCourseId((current) => current === lesson.courseId ? null : lesson.courseId); }} aria-expanded={booksCourseId === lesson.courseId} data-testid={`button-schedule-prep-books-${lesson.courseId}`}><BookMarked size={14} /> {tr('books')}</button>
                  <button type="button" className="focus-ring rounded-lg px-2.5 py-1.5 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" onClick={() => startEdit(lesson, courseTitle)} data-testid={`button-schedule-prep-edit-${lesson.courseId}`}>{tr('edit')}</button>
                  <button type="button" className="focus-ring rounded-lg px-2.5 py-1.5 text-xs font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]" onClick={() => void remove(lesson.id)}>{tr('delete')}</button>
                </div>
              </div>
              {booksCourseId === lesson.courseId && (
                <div className="mt-3 border-t border-[hsl(var(--border))] pt-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Kitabxanadan dərs kitabları · {termNumber}-{termSuffixes[termNumber] ?? 'ci'} semestr</p>
                  <CourseBooksEditor courseId={lesson.courseId} termNumber={termNumber} courseTitle={courseTitle} />
                </div>
              )}
            </div>
          );
        }) : <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-5 text-center text-sm text-[hsl(var(--muted-foreground))]">Bu semestr üçün dərs yoxdur.</p>}
      </div>
    </section>
  );
}

function parseDayTimes(lessonTime: string | null | undefined, days: string[]) {
  if (lessonTime?.startsWith('{')) {
    try {
      const parsed = JSON.parse(lessonTime) as Record<string, string>;
      return Object.fromEntries(days.map((day) => [day, parsed[day] ?? '']));
    } catch { /* köhnə format */ }
  }
  return Object.fromEntries(days.map((day) => [day, lessonTime && /^\d{2}:\d{2}$/.test(lessonTime) ? lessonTime : '']));
}

function lessonTimesForSave(stored: string | null | undefined, days: string[], activeDay: string, activeTime: string) {
  const existing = parseDayTimes(stored, days);
  return Object.fromEntries(days.map((day) => [day, day === activeDay ? activeTime : (existing[day] || activeTime)]));
}

function CourseActivationSettings() {
  const { t } = useI18n();
  const [activeTerms, setActiveTerms] = useState<number[]>([1, 2, 3, 4]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingTerm, setSavingTerm] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const labels = { 5: t('year3'), 7: t('year4') } as const;
  const courseTerms = { 5: [5, 6], 7: [7, 8] } as const;

  useEffect(() => {
    void fetch(apiUrl('/admin/course-activation'))
      .then(async (response) => {
        if (!response.ok) throw new Error('load');
        return response.json() as Promise<{ activeTermNumbers: number[] }>;
      })
      .then((result) => setActiveTerms(result.activeTermNumbers))
      .catch(() => setNotice(t('stagesLoadFail')))
      .finally(() => setIsLoading(false));
  }, []);

  const toggleTerm = async (courseStartTerm: 5 | 7) => {
    const terms = courseTerms[courseStartTerm];
    const shouldActivate = !terms.every((term) => activeTerms.includes(term));
    const nextActiveTerms = shouldActivate
      ? [...new Set([...activeTerms, ...terms])].sort((left, right) => left - right)
      : activeTerms.filter((term) => !terms.some((courseTerm) => courseTerm === term));
    setSavingTerm(courseStartTerm);
    setNotice('');
    try {
      const response = await fetch(apiUrl('/admin/course-activation'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeTermNumbers: nextActiveTerms }),
      });
      const result = await response.json().catch(() => ({})) as { activeTermNumbers?: number[]; error?: string };
      if (!response.ok || !result.activeTermNumbers) throw new Error(result.error || t('stageToggleFail'));
      setActiveTerms(result.activeTermNumbers);
      setNotice(`${labels[courseStartTerm]} ${shouldActivate ? t('activated') : t('deactivated')}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t('stageToggleFail'));
    } finally {
      setSavingTerm(null);
    }
  };

  return (
    <section className="space-y-5" data-testid="section-course-activation">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">{t('stageEyebrow')}</p>
        <h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{t('stageTitle')}</h3>
        <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('stageHint')}</p>
      </div>
      {isLoading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('stagesLoading')}</p> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {([5, 7] as const).map((courseStartTerm) => {
            const terms = courseTerms[courseStartTerm];
            const active = terms.every((term) => activeTerms.includes(term));
            return <article key={courseStartTerm} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-serif text-xl text-[hsl(var(--primary))]">{labels[courseStartTerm]}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{terms[0]}–{terms[1]}. {t('stageTerms')}</p></div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{active ? t('activeState') : t('closedState')}</span>
              </div>
              <button type="button" onClick={() => void toggleTerm(courseStartTerm)} disabled={savingTerm !== null} className={`${active ? 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))]' : buttonClass} mt-4 w-full`} data-testid={`button-toggle-course-${courseStartTerm}`}>
                {savingTerm === courseStartTerm ? t('saving') : active ? `${labels[courseStartTerm]} ${t('deactivate')}` : `${labels[courseStartTerm]} ${t('activate')}`}
              </button>
            </article>;
          })}
        </div>
      )}
      {notice && <FormNotice text={notice} error={notice.includes(t('stagesLoadFail')) || notice.includes(t('stageToggleFail')) || notice.includes('yüklənmədi') || notice.includes('dəyişdirilə bilmədi')} />}
    </section>
  );
}

function TeacherSchedule({ ownerName, onOpenGroups }: { ownerName: string; onOpenGroups?: () => void }) {
  const { t } = useI18n();
  const dayLabel = (day: string) => {
    const key = { monday: 'dayMon', tuesday: 'dayTue', wednesday: 'dayWed', thursday: 'dayThu', friday: 'dayFri', saturday: 'daySat', sunday: 'daySun' }[day];
    return key ? t(key as 'dayMon') : day;
  };
  const { user } = useUser();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<LearningResource | null>(null);
  const [editing, setEditing] = useState(false);
  const [linkOnlyOpen, setLinkOnlyOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', body: '', url: '', lessonTime: '', lessonDays: [] as string[] });
  const [courseLinks, setCourseLinks] = useState({ telegramUrl: '', zoomUrl: '', googleMeetUrl: '', lessonUrl: '' });
  const [notice, setNotice] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const semesterQueries = [
    useGetAdminTeacherSchedule({ termNumber: 1 }),
    useGetAdminTeacherSchedule({ termNumber: 2 }),
    useGetAdminTeacherSchedule({ termNumber: 3 }),
    useGetAdminTeacherSchedule({ termNumber: 4 }),
  ];
  const todayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
  const isLoading = semesterQueries.some((query) => query.isLoading);
  const lessons = semesterQueries.flatMap((query) => query.data ?? []);
  const schedule = lessonDayOptions.map(([day]) => ({
    day,
    label: dayLabel(day),
    lessons: lessons.filter((resource) => resource.lessonDays.includes(day)).sort((a, b) => (parseDayTimes(a.lessonTime, [day])[day] || '99:99').localeCompare(parseDayTimes(b.lessonTime, [day])[day] || '99:99') || a.termNumber - b.termNumber),
  }));
  const activeDay = selectedDay ?? todayKey;
  const selected = schedule.find((item) => item.day === activeDay) ?? schedule[0];
  const currentUserName = ownerName || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.fullName || user?.username || 'İstifadəçi';
  // Birgə tədris olunan dərsdə bütün müəllimlərin adı göstərilir.
  const displayMyTeacherName = (lesson: LearningResource) => isCoTaught(lesson) ? resourceTeacherLabel(lesson) : lesson.teacherClerkUserId === user?.id || lesson.teacherName?.trim().toLowerCase() === 'sistem sahibi' ? currentUserName : (lesson.teacherName ?? 'Müəllim təyin edilməyib');
  const openLesson = (lesson: LearningResource) => {
    setSelectedLesson(lesson);
    setEditing(false);
    setLinkOnlyOpen(false);
    setNotice('');
    setPdfFile(null);
    setEditForm({ title: lesson.title, body: lesson.body, url: lesson.url ?? '', lessonTime: parseDayTimes(lesson.lessonTime, [activeDay])[activeDay] || parseDayTimes(lesson.lessonTime, lesson.lessonDays)[lesson.lessonDays[0]] || '', lessonDays: lesson.lessonDays });
    void fetch(apiUrl(`/admin/courses/${lesson.courseId}`))
      .then((response) => response.ok ? response.json() as Promise<{ telegramUrl?: string | null; zoomUrl?: string | null; googleMeetUrl?: string | null; lessonUrl?: string | null }> : Promise.reject())
      .then((course) => setCourseLinks({
        telegramUrl: course.telegramUrl ?? '',
        zoomUrl: course.zoomUrl ?? '',
        googleMeetUrl: course.googleMeetUrl ?? '',
        lessonUrl: course.lessonUrl ?? '',
      }))
      .catch(() => setCourseLinks({ telegramUrl: '', zoomUrl: '', googleMeetUrl: '', lessonUrl: '' }));
  };
  const openLessonLinks = () => {
    setLinkOnlyOpen(true);
    window.setTimeout(() => {
      document.querySelector('[data-testid="section-teacher-course-links-standalone"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  };
  const saveCourseLinks = async () => {
    if (!selectedLesson) return;
    setNotice('');
    try {
      const response = await fetch(apiUrl(`/admin/courses/${selectedLesson.courseId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUrl: courseLinks.telegramUrl.trim() || null,
          zoomUrl: courseLinks.zoomUrl.trim() || null,
          googleMeetUrl: courseLinks.googleMeetUrl.trim() || null,
          lessonUrl: courseLinks.lessonUrl.trim() || null,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Linklər yenilənə bilmədi.');
      setNotice('Dərs linkləri yadda saxlanıldı.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Linklər yenilənə bilmədi.');
    }
  };
  const saveLesson = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedLesson || !editForm.lessonDays.length || !editForm.lessonTime) {
      setNotice('Ən azı bir gün və dərs saatı seçin.');
      return;
    }
    setNotice('');
    try {
      let materialUrl = editForm.url.trim() || null;
      if (pdfFile) {
        const uploadRequest = await fetch(apiUrl('/admin/courses/upload-url'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: pdfFile.name, size: pdfFile.size, contentType: 'application/pdf' }) });
        const upload = await uploadRequest.json() as { uploadURL?: string; objectPath?: string; error?: string };
        if (!uploadRequest.ok || !upload.uploadURL || !upload.objectPath) throw new Error(upload.error || 'PDF yükləməyə hazırlıq alınmadı.');
        const uploaded = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: pdfFile });
        if (!uploaded.ok) throw new Error('PDF faylı yüklənə bilmədi.');
        materialUrl = upload.objectPath;
      }
      const lessonDayTimes = lessonTimesForSave(selectedLesson.lessonTime, editForm.lessonDays, activeDay, editForm.lessonTime);
      const response = await fetch(apiUrl(`/admin/resources/${selectedLesson.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedLesson.courseId,
          termNumber: selectedLesson.termNumber,
          kind: selectedLesson.kind,
          title: editForm.title.trim(),
          body: editForm.body.trim(),
          url: materialUrl,
          lessonDays: editForm.lessonDays,
          lessonTime: editForm.lessonTime,
          lessonDayTimes,
          isMandatory: selectedLesson.isMandatory,
          teacherClerkUserId: selectedLesson.teacherClerkUserId,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Dərs yenilənə bilmədi.');
      const courseResponse = await fetch(apiUrl(`/admin/courses/${selectedLesson.courseId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUrl: courseLinks.telegramUrl.trim() || null,
          zoomUrl: courseLinks.zoomUrl.trim() || null,
          googleMeetUrl: courseLinks.googleMeetUrl.trim() || null,
          lessonUrl: courseLinks.lessonUrl.trim() || null,
        }),
      });
      const courseResult = await courseResponse.json() as { error?: string };
      if (!courseResponse.ok) throw new Error(courseResult.error || 'Dərs keçid linkləri yenilənə bilmədi.');
      await Promise.all(Array.from({ length: 8 }, (_, index) => index + 1).map((termNumber) => queryClient.invalidateQueries({ queryKey: ['get', 'admin', 'teacher-schedule', { termNumber }] })));
      setSelectedLesson({ ...selectedLesson, title: editForm.title.trim(), body: editForm.body.trim(), url: materialUrl, lessonDays: editForm.lessonDays as LearningResource['lessonDays'], lessonTime: Object.values(lessonDayTimes).every((time) => time === editForm.lessonTime) ? editForm.lessonTime : JSON.stringify(lessonDayTimes) });
      setEditing(false);
      setPdfFile(null);
      if (pdfInput.current) pdfInput.current.value = '';
      setNotice('Dərs məlumatları yadda saxlanıldı.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Dərs yenilənə bilmədi.');
    }
  };
  return (
    <section className="space-y-5" data-testid="section-teacher-schedule">
       {selectedLesson && editing && <TeacherCourseLinksPortal links={courseLinks} onChange={(key, value) => setCourseLinks((current) => ({ ...current, [key]: value }))} />}
       {selectedLesson && linkOnlyOpen && !editing && <section className="rounded-xl border border-[hsl(var(--accent)/.7)] bg-[hsl(var(--accent)/.12)] p-4" data-testid="section-teacher-course-links-standalone"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[.12em] text-[hsl(var(--secondary-foreground))]">Yalnız linkləri redaktə et</p><button type="button" onClick={() => setLinkOnlyOpen(false)} className="focus-ring rounded-lg px-2 py-1 text-xs font-bold text-[hsl(var(--muted-foreground))]">Bağla</button></div><div className="mt-3"><TeacherCourseLinksEditor links={courseLinks} onChange={(key, value) => setCourseLinks((current) => ({ ...current, [key]: value }))} /></div><button type="button" onClick={() => void saveCourseLinks()} className={`${buttonClass} mt-3`} data-testid="button-save-standalone-course-links"><Link2 size={15} /> Yalnız linkləri yadda saxla</button></section>}
       {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800" data-testid="text-lesson-save-notice">{notice}</p>}
       <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{t('myLessons')}</p><h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{t('weeklySchedule')}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Sizə təyin edilmiş qruplar: dərsi seçib linkləri, materialı, mətnini, gün və saatını dəyişin, tələbə siyahısına baxın.</p></div><div className="flex shrink-0 flex-wrap items-center gap-2 pt-1"><SchedulePdfButton apiPath="/admin/teacher-schedule.pdf" fileName="Muellim-cedveli.pdf" testId="button-download-teacher-schedule-pdf" /><button type="button" disabled={!selectedLesson} onClick={openLessonLinks} className={`${buttonClass} ${selectedLesson ? 'bg-[hsl(var(--secondary-foreground))]' : 'bg-[hsl(var(--muted-foreground))]'}`} data-testid="button-my-schedule-links"><Link2 size={16} /> Yalnız linklər</button></div></div>
       {isLoading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('scheduleLoading')}</p> : <><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3" data-testid="section-my-lessons"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Dərslərim · {lessons.length} qrup</p>{lessons.length ? <div className="mt-2 grid gap-2 sm:grid-cols-2">{[...lessons].sort((a, b) => a.termNumber - b.termNumber || a.title.localeCompare(b.title, 'az')).map((lesson) => <button key={lesson.id} type="button" onClick={() => { if (lesson.lessonDays[0] && !lesson.lessonDays.includes(activeDay as LearningResource['lessonDays'][number])) setSelectedDay(lesson.lessonDays[0]); openLesson(lesson); }} className={`focus-ring flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left ${selectedLesson?.id === lesson.id ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary)/.25)]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'}`} data-testid={`button-my-lesson-${lesson.id}`}><span className="min-w-0"><span className="block truncate text-sm font-bold text-[hsl(var(--primary))]">{lesson.title}</span><span className="block truncate text-[11px] text-[hsl(var(--muted-foreground))]">{lesson.termNumber}-ci semestr · {lesson.lessonDays.length ? lesson.lessonDays.map((day) => `${lessonDayOptions.find(([value]) => value === day)?.[1] ?? day} ${parseDayTimes(lesson.lessonTime, [day])[day] || ''}`.trim()).join(', ') : 'gün/saat yoxdur'}</span></span><ChevronDown size={14} className="-rotate-90 shrink-0 text-[hsl(var(--muted-foreground))]" /></button>)}</div> : <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Sizə hələ qrup təyin olunmayıb. «Qruplar» bölməsində aktiv semestrin dərsi üçün özünüzə qrup yarada bilərsiniz.</p>}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{schedule.map(({ day, label, lessons }) => <button key={day} type="button" onClick={() => setSelectedDay(day)} className={`focus-ring rounded-2xl border px-2 py-3 text-center ${day === activeDay ? 'border-transparent bg-[hsl(var(--accent))] text-[hsl(var(--primary))] shadow-[var(--shadow-xs)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))]'}`} data-testid={`button-teacher-schedule-day-${day}`}><span className="block text-xs font-black">{label}</span><span className="mt-1 block text-[10px] font-semibold opacity-70">{lessons.length ? `${lessons.length} ${t('lessonWord')}` : t('noLesson')}</span></button>)}</div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] p-4" data-testid="section-teacher-selected-schedule"><p className="flex items-center gap-2 text-xs font-black text-[hsl(var(--primary))]"><CalendarDays size={14} /> {selected?.label}</p>{selected?.lessons.length ? <div className="mt-3 space-y-2">{selected.lessons.map((lesson) => <button key={lesson.id} type="button" onClick={() => openLesson(lesson)} className="focus-ring flex w-full items-center justify-between gap-3 rounded-lg bg-[hsl(var(--card))] px-3 py-3 text-left hover:bg-[hsl(var(--secondary)/.25)]"><div><p className="text-sm font-bold text-[hsl(var(--primary))]">{lesson.title}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{lesson.termNumber}-ci semestr · {displayMyTeacherName(lesson)}</p></div><span className="rounded-lg bg-[hsl(var(--secondary)/.6)] px-2.5 py-1 text-sm font-black text-[hsl(var(--secondary-foreground))]">{parseDayTimes(lesson.lessonTime, [activeDay])[activeDay] || '—'}</span></button>)}</div> : <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">{t('noLessonToday')}</p>}</div>{selectedLesson && <section className="rounded-xl border border-[hsl(var(--accent)/.7)] bg-[hsl(var(--accent)/.12)] p-4" data-testid="section-teacher-lesson-details"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.12em] text-[hsl(var(--secondary-foreground))]">{selectedLesson.termNumber}-ci semestr · {parseDayTimes(selectedLesson.lessonTime, [activeDay])[activeDay] || 'Saat təyin edilməyib'}</p><h4 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{selectedLesson.title}</h4></div><div className="flex gap-2"><button type="button" onClick={openLessonLinks} className={`${buttonClass} bg-[hsl(var(--secondary-foreground))]`} data-testid="button-open-scheduled-lesson-links"><Link2 size={15} /> Yalnız linklər</button><button type="button" onClick={() => { setEditing((value) => !value); setLinkOnlyOpen(false); }} className={buttonClass} data-testid="button-edit-scheduled-lesson"><Pencil size={15} /> {editing ? 'Baxışa qayıt' : 'Redaktə et'}</button></div></div>{editing ? <form onSubmit={saveLesson} className="mt-4 space-y-4"><Field label="Dərsin adı"><input required className={inputClass} value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} /></Field><Field label="Dərs haqqında geniş məlumat"><textarea required rows={5} className={`${inputClass} resize-y`} value={editForm.body} onChange={(event) => setEditForm({ ...editForm, body: event.target.value })} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Həftənin günləri"><div className="grid grid-cols-2 gap-2 rounded-xl border border-[hsl(var(--border))] p-3">{lessonDayOptions.map(([day, label]) => <label key={day} className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={editForm.lessonDays.includes(day)} onChange={(event) => setEditForm({ ...editForm, lessonDays: event.target.checked ? [...editForm.lessonDays, day] : editForm.lessonDays.filter((item) => item !== day) })} />{label}</label>)}</div></Field><Field label="Saat"><input required type="time" className={inputClass} value={editForm.lessonTime} onChange={(event) => setEditForm({ ...editForm, lessonTime: event.target.value })} /></Field></div><Field label="PDF və ya material linki"><input type="text" className={inputClass} value={editForm.url} onChange={(event) => setEditForm({ ...editForm, url: event.target.value })} placeholder="Mövcud link" /><input ref={pdfInput} type="file" accept="application/pdf,.pdf" className="mt-2 block w-full text-xs" onChange={(event) => { const file = event.target.files?.[0] ?? null; setPdfFile(file); }} data-testid="input-schedule-pdf-file" />{pdfFile && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{pdfFile.name} — yadda saxlanarkən dəyişdiriləcək</p>}</Field><button type="submit" className={buttonClass}>Yadda saxla</button>{notice && <p className="text-xs font-semibold">{notice}</p>}</form> : <div className="mt-4 space-y-3"><p className="whitespace-pre-wrap text-sm leading-6 text-[hsl(var(--muted-foreground))]">{selectedLesson.body || 'Bu dərs üçün əlavə məlumat yazılmayıb.'}</p>{selectedLesson.url && <a href={selectedLesson.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-[hsl(var(--secondary-foreground))]">Materialı aç</a>}<div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] p-3" data-testid="section-teacher-lesson-books"><p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]"><BookMarked size={13} /> Dərs kitabları (Kitabxanadan)</p><CourseBooksEditor key={`${selectedLesson.courseId}-${selectedLesson.termNumber}`} courseId={selectedLesson.courseId} termNumber={selectedLesson.termNumber} courseTitle={selectedLesson.title} /></div><GroupRosterReadOnly resourceId={selectedLesson.id} onOpenGroups={onOpenGroups} />{notice && <p className="text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{notice}</p>}</div>}</section>}</>}
    </section>
  );
}

function TeachersSchedule({ ownerName }: { ownerName: string }) {
  const { t } = useI18n();
  const dayLabel = (day: string) => {
    const key = { monday: 'dayMon', tuesday: 'dayTue', wednesday: 'dayWed', thursday: 'dayThu', friday: 'dayFri', saturday: 'daySat', sunday: 'daySun' }[day];
    return key ? t(key as 'dayMon') : day;
  };
  const resourcesQuery = useGetAdminResources();
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<LearningResource | null>(null);
  const [editing, setEditing] = useState(false);
  const [linkOnlyOpen, setLinkOnlyOpen] = useState(false);
  const [courseLinks, setCourseLinks] = useState<TeacherCourseLinks>({ telegramUrl: '', zoomUrl: '', googleMeetUrl: '', lessonUrl: '' });
  const [editForm, setEditForm] = useState({ title: '', body: '', url: '', lessonTime: '', lessonDays: [] as string[] });
  const [notice, setNotice] = useState('');
  const todayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
  const activeDay = selectedDay ?? todayKey;
  const schedule = lessonDayOptions.map(([day]) => ({
    day,
    label: dayLabel(day),
    lessons: (resourcesQuery.data ?? [])
      .filter((resource) => resource.lessonDays.includes(day))
      .sort((a, b) => (parseDayTimes(a.lessonTime, [day])[day] || '99:99').localeCompare(parseDayTimes(b.lessonTime, [day])[day] || '99:99') || a.termNumber - b.termNumber)
      .map((lesson) => ({ ...lesson, teacherName: lesson.teacherName?.trim().toLowerCase() === 'sistem sahibi' ? ownerName : lesson.teacherName })),
  }));
  const selected = schedule.find((item) => item.day === activeDay) ?? schedule[0];
  const displayTeacherName = (lesson: LearningResource) => lesson.teacherName?.trim().toLowerCase() === 'sistem sahibi' ? ownerName : (lesson.teacherName ?? 'Müəllim təyin edilməyib');
  const openLesson = (lesson: LearningResource) => {
    setSelectedLesson(lesson);
    setEditing(false);
    setLinkOnlyOpen(false);
    setNotice('');
    setEditForm({ title: lesson.title, body: lesson.body, url: lesson.url ?? '', lessonTime: parseDayTimes(lesson.lessonTime, [activeDay])[activeDay] || parseDayTimes(lesson.lessonTime, lesson.lessonDays)[lesson.lessonDays[0]] || '', lessonDays: lesson.lessonDays });
    void fetch(apiUrl(`/admin/courses/${lesson.courseId}`))
      .then((response) => response.ok ? response.json() as Promise<Partial<TeacherCourseLinks>> : Promise.reject())
      .then((course) => setCourseLinks({
        telegramUrl: course.telegramUrl ?? '',
        zoomUrl: course.zoomUrl ?? '',
        googleMeetUrl: course.googleMeetUrl ?? '',
        lessonUrl: course.lessonUrl ?? '',
      }))
      .catch(() => setCourseLinks({ telegramUrl: '', zoomUrl: '', googleMeetUrl: '', lessonUrl: '' }));
  };
  const saveCourseLinks = async () => {
    if (!selectedLesson) return;
    try {
      const response = await fetch(apiUrl(`/admin/courses/${selectedLesson.courseId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUrl: courseLinks.telegramUrl.trim() || null,
          zoomUrl: courseLinks.zoomUrl.trim() || null,
          googleMeetUrl: courseLinks.googleMeetUrl.trim() || null,
          lessonUrl: courseLinks.lessonUrl.trim() || null,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Linklər yenilənə bilmədi.');
      setNotice('Dərs linkləri yadda saxlanıldı.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Linklər yenilənə bilmədi.');
    }
  };
  const saveLesson = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedLesson || !editForm.title.trim() || !editForm.body.trim() || !editForm.lessonDays.length || !editForm.lessonTime) {
      setNotice('Dərsin adı, məlumatı, ən azı bir günü və saatı daxil edilməlidir.');
      return;
    }
    try {
      const lessonDayTimes = lessonTimesForSave(selectedLesson.lessonTime, editForm.lessonDays, activeDay, editForm.lessonTime);
      const response = await fetch(apiUrl(`/admin/resources/${selectedLesson.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: selectedLesson.courseId, termNumber: selectedLesson.termNumber, kind: selectedLesson.kind, title: editForm.title.trim(), body: editForm.body.trim(), url: editForm.url.trim() || null, lessonDays: editForm.lessonDays, lessonTime: editForm.lessonTime, lessonDayTimes, isMandatory: selectedLesson.isMandatory, teacherClerkUserId: selectedLesson.teacherClerkUserId }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Dərs yenilənə bilmədi.');
      await queryClient.invalidateQueries({ queryKey: getGetAdminResourcesQueryKey() });
      setSelectedLesson({ ...selectedLesson, title: editForm.title.trim(), body: editForm.body.trim(), url: editForm.url.trim() || null, lessonDays: editForm.lessonDays as LearningResource['lessonDays'], lessonTime: Object.values(lessonDayTimes).every((time) => time === editForm.lessonTime) ? editForm.lessonTime : JSON.stringify(lessonDayTimes) });
      setEditing(false);
      setNotice('Dərs məlumatları yadda saxlanıldı.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Dərs yenilənə bilmədi.');
    }
  };
  return (
    <section className="space-y-5" data-testid="section-teachers-schedule">
      {selectedLesson && <TeachersScheduleLinksAction onClick={() => setLinkOnlyOpen((value) => !value)} />}
      <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{t('academySchedule')}</p><h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{t('teachersSchedule')}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Bütün müəllimlərə təyin edilmiş dərslər və dərs saatları.</p></div>
      {selectedLesson && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setLinkOnlyOpen((value) => !value)} className={`${buttonClass} bg-[hsl(var(--secondary-foreground))]`} data-testid="button-open-teachers-schedule-links"><Link2 size={15} /> Yalnız linklər</button></div>}
       {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800" data-testid="text-teachers-lesson-save-notice">{notice}</p>}
      {selectedLesson && linkOnlyOpen && <section className="rounded-xl border border-[hsl(var(--accent)/.7)] bg-[hsl(var(--accent)/.12)] p-4" data-testid="section-teachers-schedule-links"><TeacherCourseLinksEditor links={courseLinks} onChange={(key, value) => setCourseLinks((current) => ({ ...current, [key]: value }))} /><button type="button" onClick={() => void saveCourseLinks()} className={`${buttonClass} mt-3`} data-testid="button-save-teachers-schedule-links"><Link2 size={15} /> Yalnız linkləri yadda saxla</button></section>}
       {resourcesQuery.isLoading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('scheduleLoading')}</p> : <><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">{schedule.map(({ day, label, lessons }) => <button key={day} type="button" onClick={() => setSelectedDay(day)} className={`focus-ring rounded-xl border px-2 py-3 text-center ${day === activeDay ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))]'}`}><span className="block text-xs font-black">{label}</span><span className="mt-1 block text-[10px]">{lessons.length ? `${lessons.length} ${t('lessonWord')}` : t('noLesson')}</span></button>)}</div><div className="rounded-xl border border-[hsl(var(--border))] p-4" data-testid="section-teachers-selected-schedule"><p className="text-xs font-black text-[hsl(var(--primary))]">{selected?.label}</p>{selected?.lessons.length ? <div className="mt-3 space-y-2">{selected.lessons.map((lesson) => <button key={lesson.id} type="button" onClick={() => openLesson(lesson)} className="focus-ring flex w-full flex-wrap items-center justify-between gap-3 rounded-lg bg-[hsl(var(--muted)/.45)] px-3 py-3 text-left hover:bg-[hsl(var(--secondary)/.25)]"><div><p className="text-sm font-bold text-[hsl(var(--primary))]">{lesson.title}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{lesson.teacherName ?? 'Müəllim təyin edilməyib'} · {lesson.termNumber}-ci semestr</p><p className="mt-1 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">{lesson.body}</p></div><span className="rounded-lg bg-[hsl(var(--secondary)/.6)] px-2.5 py-1 text-sm font-black text-[hsl(var(--secondary-foreground))]">{parseDayTimes(lesson.lessonTime, [activeDay])[activeDay] || '—'}</span></button>)}</div> : <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{t('noLessonToday')}</p>}</div>{selectedLesson && <section className="rounded-xl border border-[hsl(var(--accent)/.7)] bg-[hsl(var(--accent)/.12)] p-4" data-testid="section-teachers-lesson-details"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.12em] text-[hsl(var(--secondary-foreground))]">{selectedLesson.teacherName ?? 'Müəllim'} · {selectedLesson.termNumber}-ci semestr · {parseDayTimes(selectedLesson.lessonTime, [activeDay])[activeDay] || '—'}</p><h4 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{selectedLesson.title}</h4></div><button type="button" onClick={() => setEditing((value) => !value)} className={buttonClass} data-testid="button-edit-teachers-lesson"><Pencil size={15} /> {editing ? 'Baxışa qayıt' : 'Redaktə et'}</button></div>{editing ? <form onSubmit={saveLesson} className="mt-4 space-y-4"><Field label="Dərsin adı"><input required className={inputClass} value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} /></Field><Field label="Dərs haqqında məlumat"><textarea required rows={5} className={`${inputClass} resize-y`} value={editForm.body} onChange={(event) => setEditForm({ ...editForm, body: event.target.value })} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Həftənin günləri"><div className="grid grid-cols-2 gap-2 rounded-xl border border-[hsl(var(--border))] p-3">{lessonDayOptions.map(([day, label]) => <label key={day} className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={editForm.lessonDays.includes(day)} onChange={(event) => setEditForm({ ...editForm, lessonDays: event.target.checked ? [...editForm.lessonDays, day] : editForm.lessonDays.filter((item) => item !== day) })} />{label}</label>)}</div></Field><Field label="Saat"><input required type="time" className={inputClass} value={editForm.lessonTime} onChange={(event) => setEditForm({ ...editForm, lessonTime: event.target.value })} /></Field></div><Field label="PDF və ya material linki"><input type="text" className={inputClass} value={editForm.url} onChange={(event) => setEditForm({ ...editForm, url: event.target.value })} placeholder="https:// və ya yüklənmiş PDF" /></Field><button type="submit" className={buttonClass}>Yadda saxla</button>{notice && <p className="text-xs font-semibold">{notice}</p>}</form> : <div className="mt-4 space-y-3"><p className="whitespace-pre-wrap text-sm leading-6 text-[hsl(var(--muted-foreground))]">{selectedLesson.body || 'Bu dərs üçün əlavə məlumat yazılmayıb.'}</p>{selectedLesson.url && <a href={selectedLesson.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-[hsl(var(--secondary-foreground))]">Materialı aç</a>}{notice && <p className="text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{notice}</p>}</div>}</section>}</>}
    </section>
  );
}

function ApplicationList({ applications, isLoading, onDecision, busyId, canDecide, canAssignTeacher, onAssignTeacher, teacherBusyId }: {
  applications: Application[];
  isLoading: boolean;
  busyId: number | null;
  onDecision: (application: Application, status: 'approved' | 'rejected', reason?: string) => void;
  canDecide: boolean;
  canAssignTeacher: boolean;
  onAssignTeacher: (application: Application) => void;
  teacherBusyId: number | null;
}) {
  const { t: tr } = useI18n();
  const [activeStatus, setActiveStatus] = useState<Application['status'] | null>('pending');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (isRejecting && !reason) setReason('\u200B');
  }, [isRejecting, reason]);
  const downloadPath = (applicationId: number, fileIndex: number) =>
    `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/admin/applications/${applicationId}/recommendations/${fileIndex}`;

  if (isLoading) return <p className="text-sm text-[hsl(var(--muted-foreground))]">{tr('applicationsLoading')}</p>;
  if (!applications.length) return <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-7 text-center text-sm text-[hsl(var(--muted-foreground))]">{tr('noApplications')}</p>;
  const statusItems = [
    { value: 'pending' as const, label: tr('statusPending'), count: applications.filter((application) => application.status === 'pending').length, className: 'border-amber-200 bg-amber-50 text-amber-900' },
    { value: 'approved' as const, label: tr('statusApprovedList'), count: applications.filter((application) => application.status === 'approved').length, className: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    { value: 'rejected' as const, label: tr('statusRejectedList'), count: applications.filter((application) => application.status === 'rejected').length, className: 'border-rose-200 bg-rose-50 text-rose-900' },
  ];
  const visibleApplications = activeStatus ? applications.filter((application) => application.status === activeStatus) : [];
  return (
    <div className="space-y-4" data-testid="list-admin-applications">
      <div className="grid items-start gap-3 sm:grid-cols-3" data-testid="application-status-summary">{statusItems.map((item) => <div key={item.value} className="space-y-0">
        <button type="button" onClick={() => setActiveStatus((current) => current === item.value ? null : item.value)} aria-expanded={activeStatus === item.value} className={`focus-ring w-full rounded-2xl border p-4 text-left transition hover:shadow-sm ${item.className} ${activeStatus === item.value ? 'ring-2 ring-[hsl(var(--primary)/.35)]' : 'opacity-80'}`} data-testid={`button-application-status-${item.value}`}><p className="text-[10px] font-bold uppercase tracking-[.14em]">{item.label}</p><p className="mt-2 font-serif text-3xl">{item.count}</p><p className="mt-1 text-xs font-semibold">{activeStatus === item.value ? tr('hideNames') : tr('showNames')}</p></button>
        {activeStatus === item.value && <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] p-4" data-testid={`application-names-${activeStatus}`}><p className="text-xs font-bold text-[hsl(var(--muted-foreground))]">{item.label} {tr('applicants')}</p>{visibleApplications.length ? <div className="mt-3 flex flex-wrap gap-2">{visibleApplications.map((application) => <button type="button" key={application.id} onClick={() => { setReason(''); setIsRejecting(false); setSelectedApplication(application); }} className="focus-ring rounded-xl bg-[hsl(var(--card))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary)/.25)]" data-testid={`button-application-name-${application.id}`}>{application.firstName} {application.lastName}</button>)}</div> : <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">{tr('noStatusApplications')}</p>}</div>}
      </div>)}</div>
      {selectedApplication && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--primary)/.5)] px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="application-details-title"><div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)]"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--secondary-foreground))]">{tr('applicationDetails')}</p><h4 id="application-details-title" className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{selectedApplication.firstName} {selectedApplication.lastName}</h4><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{selectedApplication.status === 'pending' ? tr('statusPending') : selectedApplication.status === 'approved' ? tr('approvedShort') : tr('rejectedShort')}</p></div><button type="button" onClick={() => setSelectedApplication(null)} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Bağla"><X size={18} /></button></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">E-poçt</dt><dd className="mt-1 font-semibold">{selectedApplication.email}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Telefon</dt><dd className="mt-1 font-semibold">{selectedApplication.phone}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Doğum tarixi</dt><dd className="mt-1 font-semibold">{selectedApplication.birthDate}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Ərəb dili səviyyəsi</dt><dd className="mt-1 font-semibold">{selectedApplication.arabicLevel}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Müraciət tarixi</dt><dd className="mt-1 font-semibold">{new Intl.DateTimeFormat('az-AZ', { dateStyle: 'medium' }).format(new Date(selectedApplication.createdAt))}</dd></div></dl>{selectedApplication.status !== 'rejected' && <div className="mt-5 border-t border-[hsl(var(--border))] pt-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{tr('uploadedPdfs')}</p><div className="mt-2 flex flex-wrap gap-2">{selectedApplication.recommendationNames.map((name, index) => <a key={name} href={downloadPath(selectedApplication.id, index)} className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--muted))] px-2.5 py-2 text-xs font-bold text-[hsl(var(--secondary-foreground))] hover:underline"><FileText size={14} /> {name}</a>)}</div></div>}{selectedApplication.status === 'rejected' && selectedApplication.rejectionReason && <p className="mt-5 rounded-lg bg-[hsl(var(--destructive)/.08)] p-3 text-xs leading-5 text-[hsl(var(--destructive))]"><strong>{tr('rejectionReason')}:</strong> {selectedApplication.rejectionReason}</p>}{canDecide && selectedApplication.status === 'pending' && <div className="mt-5 border-t border-[hsl(var(--border))] pt-4"><div className="flex flex-wrap gap-2"><button type="button" disabled={busyId === selectedApplication.id || teacherBusyId === selectedApplication.id} onClick={() => { onDecision(selectedApplication, 'approved'); setSelectedApplication(null); }} className="focus-ring rounded-lg bg-[hsl(var(--secondary))] px-3 py-2 text-xs font-bold text-[hsl(var(--secondary-foreground))] disabled:opacity-50" data-testid={`button-approve-application-${selectedApplication.id}`}>{tr('verify')}</button><button type="button" disabled={busyId === selectedApplication.id || teacherBusyId === selectedApplication.id} onClick={() => { setIsRejecting(true); setReason(''); }} className="focus-ring rounded-lg border border-[hsl(var(--destructive)/.3)] px-3 py-2 text-xs font-bold text-[hsl(var(--destructive))] disabled:opacity-50">{tr('reject')}</button></div>{isRejecting && <><textarea required value={reason} onChange={(event) => setReason(event.target.value)} placeholder={tr('rejectionPlaceholder')} className={`${inputClass} mt-3 min-h-20`} /><button type="button" disabled={!reason.trim() || busyId === selectedApplication.id} onClick={() => { onDecision(selectedApplication, 'rejected', reason); setSelectedApplication(null); }} className="mt-2 focus-ring rounded-lg bg-[hsl(var(--destructive))] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{tr('sendRejection')}</button></>}</div>}{canAssignTeacher && selectedApplication.status !== 'rejected' && <div className="mt-5 border-t border-[hsl(var(--border))] pt-4"><button type="button" disabled={teacherBusyId === selectedApplication.id || busyId === selectedApplication.id} onClick={() => onAssignTeacher(selectedApplication)} className="focus-ring rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" data-testid={`button-assign-teacher-${selectedApplication.id}`}>{teacherBusyId === selectedApplication.id ? tr('assigning') : tr('assignTeacher')}</button></div>}<div className="mt-6 flex justify-end"><button type="button" onClick={() => setSelectedApplication(null)} className="focus-ring rounded-xl px-4 py-2.5 text-xs font-bold text-[hsl(var(--muted-foreground))]">{tr('close')}</button></div></div></div>}
    </div>
  );
}

function AcademicManagement({ mode }: { mode: 'grades' | 'attendance' }) {
  const { t } = useI18n();
  const gradeCriteria = [
    { id: 'Dərsdə iştirak', label: t('critAttend') },
    { id: 'Dərslərdə fəallıq', label: t('critActivity') },
    { id: 'Birinci imtahan nəticələri', label: t('critFirstExam') },
    { id: 'Sonuncu imtahan nəticələri', label: t('critFinalExam') },
  ];
  const profilesQuery = useGetAdminAcademicProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const profileQuery = useGetAdminAcademicProfile(selectedProfileId ?? 0, { query: { enabled: selectedProfileId !== null, queryKey: getGetAdminAcademicProfileQueryKey(selectedProfileId ?? 0) } });
  const updateProfile = useUpdateAcademicProfile();
  const updateGrades = useUpdateAcademicProfileGrades();
  const updateAttendance = useUpdateAcademicProfileAttendance();
  const queryClient = useQueryClient();
  const [courseYear, setCourseYear] = useState(1);
  const [semester, setSemester] = useState(1);
  const [program, setProgram] = useState('');
  const [termNumber, setTermNumber] = useState(1);
  const [grades, setGrades] = useState<Record<number, string>>({});
  const [openGradeCourseId, setOpenGradeCourseId] = useState<number | null>(null);
  const [gradingComponents, setGradingComponents] = useState<Record<number, string[]>>({});
  const [componentScores, setComponentScores] = useState<Record<number, Record<string, string>>>({});
  const [customComponentInputs, setCustomComponentInputs] = useState<Record<number, string>>({});
  const [showCustomComponentInput, setShowCustomComponentInput] = useState<Record<number, boolean>>({});
  const [savingCourseId, setSavingCourseId] = useState<number | null>(null);
  const [attendanceCourseId, setAttendanceCourseId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'absent' | 'late' | 'excused'>('present');
  const [studentSearch, setStudentSearch] = useState('');
  const [notice, setNotice] = useState('');
  const profile = profileQuery.data;
  const selectedSemester = profile?.semesters.find((item) => item.termNumber === termNumber);
  const normalizedStudentSearch = studentSearch.trim().toLocaleLowerCase('az-AZ');
  const filteredProfiles = (profilesQuery.data ?? []).filter((item) => !normalizedStudentSearch || [item.firstName, item.lastName, item.email, String(item.studentNumber)].join(' ').toLocaleLowerCase('az-AZ').includes(normalizedStudentSearch));

  useEffect(() => {
    const first = profilesQuery.data?.[0];
    if (first && selectedProfileId === null) setSelectedProfileId(first.id);
  }, [profilesQuery.data, selectedProfileId]);

  useEffect(() => {
    if (!profile) return;
    setCourseYear(profile.courseYear);
    setSemester(profile.semester);
    setProgram(profile.program);
    setTermNumber(profile.currentTermNumber);
  }, [profile?.id]);

  useEffect(() => {
    if (!selectedSemester) return;
    setGrades(Object.fromEntries(selectedSemester.subjects.map((subject) => [subject.courseId, subject.grade === null ? '' : String(Math.round(subject.grade * 20))])));
    setGradingComponents(Object.fromEntries(selectedSemester.subjects.map((subject) => [subject.courseId, (subject.gradingComponents ?? []).map((component) => component.name)])));
    setComponentScores(Object.fromEntries(selectedSemester.subjects.map((subject) => [subject.courseId, Object.fromEntries((subject.gradingComponents ?? []).map((component) => [component.name, component.score === null ? '' : String(component.score)]))])));
    setAttendanceCourseId(selectedSemester.subjects[0] ? String(selectedSemester.subjects[0].courseId) : '');
  }, [selectedSemester?.termNumber, profile?.id]);

  const save = async (event?: FormEvent, statusOverride?: typeof attendanceStatus) => {
    event?.preventDefault();
    if (!profile) return;
    setNotice('');
    const invalidGrade = mode === 'grades' && Object.values(grades).some((value) => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100));
    if (invalidGrade || (mode === 'attendance' && (!attendanceCourseId || !attendanceDate))) {
      setNotice(invalidGrade ? 'Qiymətlər 0 ilə 100 arasında olmalıdır.' : 'Davamiyyət 0 ilə 100 arasında olmalıdır.');
      if (!invalidGrade) setNotice('Davamiyyət qeydi üçün dərs və tarix seçilməlidir.');
      return;
    }
    try {
      if (mode === 'grades') {
        await updateProfile.mutateAsync({ profileId: profile.id, data: { courseYear, semester, program: program.trim() } });
        const data: AcademicGradesUpdate = {
          termNumber,
          grades: (selectedSemester?.subjects ?? []).map((subject) => ({
            courseId: subject.courseId,
            grade: grades[subject.courseId] === '' ? null : Number(grades[subject.courseId]),
            componentNames: gradingComponents[subject.courseId] ?? [],
            componentGrades: Object.fromEntries(Object.entries(componentScores[subject.courseId] ?? {}).map(([name, score]) => [name, score === '' ? null : Number(score)])),
          })),
        };
        await updateGrades.mutateAsync({ profileId: profile.id, data });
      } else {
        const attendanceData: AttendanceUpdate = {
          termNumber,
          courseId: Number(attendanceCourseId),
          attendanceDate,
          status: statusOverride ?? attendanceStatus,
        };
        await updateAttendance.mutateAsync({ profileId: profile.id, data: attendanceData });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetAdminAcademicProfilesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminAcademicProfileQueryKey(profile.id) }),
      ]);
       setNotice(mode === 'grades' ? 'Akademik status və qiymətlər yadda saxlanıldı.' : 'Davamiyyət qeydi yadda saxlanıldı.');
    } catch {
      setNotice('Məlumatlar yadda saxlanıla bilmədi. Yenidən cəhd edin.');
    }
  };

  const saveSingleGrade = async (subject: NonNullable<typeof selectedSemester>['subjects'][number]) => {
    if (!profile) return;
    const names = gradingComponents[subject.courseId] ?? [];
    const scores = componentScores[subject.courseId] ?? {};
    const componentGrades = Object.fromEntries(Object.entries(scores).map(([name, score]) => [name, score === '' ? null : Number(score)]));
    const finalGrade = grades[subject.courseId] === '' ? null : Number(grades[subject.courseId]);
    const invalid = Object.values(componentGrades).some((score) => score !== null && (!Number.isFinite(score) || score < 0 || score > 100))
      || (finalGrade !== null && (!Number.isFinite(finalGrade) || finalGrade < 0 || finalGrade > 100));
    if (invalid) {
      setNotice(t('gradeRange'));
      return;
    }
    setSavingCourseId(subject.courseId);
    setNotice('');
    try {
      await updateGrades.mutateAsync({
        profileId: profile.id,
        data: {
          termNumber,
          grades: [{ courseId: subject.courseId, grade: finalGrade, componentNames: names, componentGrades }],
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetAdminAcademicProfileQueryKey(profile.id) });
      setNotice(`${subject.title}: ${t('gradeSaved')}`);
    } catch {
      setNotice(`${subject.title}: ${t('gradeNotSaved')}`);
    } finally {
      setSavingCourseId(null);
    }
  };

  if (profilesQuery.isLoading) return <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('profilesLoading')}</p>;
  if (!(profilesQuery.data ?? []).length) return <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-7 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('noApprovedProfile')}</p>;
  return (
    <form onSubmit={save} className="space-y-5" data-testid="form-academic-grading">
      <Field label={t('gradeStudent')}>
        <input type="search" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder={t('gradeSearch')} className={`${inputClass} mb-2`} data-testid="input-academic-student-search" />
        <select className={inputClass} value={selectedProfileId ?? ''} onChange={(event) => setSelectedProfileId(Number(event.target.value))} data-testid="select-academic-student">
          {filteredProfiles.length ? filteredProfiles.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} · N{item.studentNumber} — {item.statusLabel}</option>) : <option value="">{t('noStudentFound')}</option>}
        </select>
      </Field>
      {profileQuery.isLoading && <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('profileLoading')}</p>}
      {profile && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('officialProgram')} hint={t('programHint')}>
              <input required minLength={1} maxLength={160} className={inputClass} value={program} onChange={(event) => setProgram(event.target.value)} data-testid="input-academic-program" />
            </Field>
            <Field label={t('currentStage')}>
              <div className={`${inputClass} bg-[hsl(var(--muted)/.45)]`}>{profile ? t((['year1', 'year2', 'year3', 'year4'] as const)[profile.courseYear - 1] ?? 'year1') : t('chooseStudent')}</div>
            </Field>
            <Field label={t('currentSemester')} hint={t('semesterAuto')}>
              <div className={`${inputClass} bg-[hsl(var(--muted)/.45)]`}>{profile ? `${profile.currentTermNumber}. ${t('termLabel')}` : t('chooseStudent')}</div>
            </Field>
          </div>
          <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{t('gradesWriteTo')}: {selectedSemester?.label ?? '—'}</p>
           {mode === 'grades' && <div className="rounded-2xl border border-[hsl(var(--border))] p-4">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">{t('lessonGrades')}</p><p className="mt-1 text-sm font-bold text-[hsl(var(--primary))]">{selectedSemester?.label}</p></div><span className="text-xs font-bold text-[hsl(var(--secondary-foreground))]">0 – 100</span></div>
            <div className="space-y-3">{(selectedSemester?.subjects ?? []).map((subject) => {
              const names = gradingComponents[subject.courseId] ?? [];
              const scores = componentScores[subject.courseId] ?? {};
              const toggleComponent = (name: string) => setGradingComponents((current) => ({ ...current, [subject.courseId]: names.includes(name) ? names.filter((item) => item !== name) : [...names, name] }));
              return <div key={subject.courseId} className={`overflow-hidden rounded-2xl border transition ${openGradeCourseId === subject.courseId ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.08)] shadow-sm' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/.35)]'}`}>
                <button type="button" onClick={() => setOpenGradeCourseId((current) => current === subject.courseId ? null : subject.courseId)} className={`flex w-full items-center gap-3 p-4 text-left transition ${openGradeCourseId === subject.courseId ? 'bg-[hsl(var(--accent)/.16)]' : 'hover:bg-[hsl(var(--muted)/.35)]'}`} aria-expanded={openGradeCourseId === subject.courseId} data-testid={`button-open-grade-${subject.courseId}`}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--primary))] text-xs font-black text-[hsl(var(--primary-foreground))]">F</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[hsl(var(--primary))]">{subject.title}</span><span className="mt-1 block text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{names.length ? `${names.length} ${t('criteriaActive')}` : t('directGrade')}</span></span><span className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${openGradeCourseId === subject.courseId ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--primary))]'}`}>{openGradeCourseId === subject.courseId ? t('close') : t('open')}</span></button>
                {!names.length && <div className="flex items-center gap-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] p-3"><input type="number" min="0" max="100" step="1" value={grades[subject.courseId] ?? ''} onChange={(event) => setGrades((current) => ({ ...current, [subject.courseId]: event.target.value }))} placeholder={t('finalGradePh')} className={`${inputClass} min-w-0 flex-1`} data-testid={`input-quick-grade-${subject.courseId}`} /><button type="button" onClick={() => void saveSingleGrade(subject)} disabled={savingCourseId === subject.courseId} className="shrink-0 rounded-xl bg-[hsl(var(--primary))] px-3 py-2.5 text-[10px] font-bold text-[hsl(var(--primary-foreground))] transition hover:opacity-90 disabled:opacity-60" data-testid={`button-quick-save-grade-${subject.courseId}`}>{savingCourseId === subject.courseId ? '...' : t('save')}</button></div>}
                {openGradeCourseId === subject.courseId && <div className="mt-3 space-y-3 border-t border-[hsl(var(--border))] pt-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {gradeCriteria.map(({ id, label }) => <label key={id} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${names.includes(id) ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.16)] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/.45)]'}`}><input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" checked={names.includes(id)} onChange={() => toggleComponent(id)} />{label}</label>)}
                  </div>
                  <button type="button" className="inline-flex items-center rounded-xl border border-dashed border-[hsl(var(--primary)/.45)] bg-[hsl(var(--card))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))]" onClick={() => setShowCustomComponentInput((current) => ({ ...current, [subject.courseId]: !current[subject.courseId] }))}>+ {t('criteriaNew')}</button>
                  {showCustomComponentInput[subject.courseId] && <div className="rounded-xl border border-[hsl(var(--accent)/.55)] bg-[hsl(var(--card))] p-3 shadow-sm"><label className="mb-2 block text-[11px] font-bold text-[hsl(var(--primary))]">{t('criteriaName')}</label><div className="flex flex-col gap-2 sm:flex-row"><input autoFocus type="text" value={customComponentInputs[subject.courseId] ?? ''} onChange={(event) => setCustomComponentInputs((current) => ({ ...current, [subject.courseId]: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); const name = (customComponentInputs[subject.courseId] ?? '').trim(); if (name && !names.includes(name)) { toggleComponent(name); setCustomComponentInputs((current) => ({ ...current, [subject.courseId]: '' })); setShowCustomComponentInput((current) => ({ ...current, [subject.courseId]: false })); } } }} placeholder={t('criteriaExample')} className={`${inputClass} flex-1`} data-testid={`input-custom-grade-name-${subject.courseId}`} /><button type="button" className="rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] hover:opacity-90" onClick={() => { const name = (customComponentInputs[subject.courseId] ?? '').trim(); if (name && !names.includes(name)) { toggleComponent(name); setCustomComponentInputs((current) => ({ ...current, [subject.courseId]: '' })); setShowCustomComponentInput((current) => ({ ...current, [subject.courseId]: false })); } }}>{t('add')}</button></div></div>}
                  {names.length ? <div className="space-y-2">{names.map((name) => <div key={name} className="grid grid-cols-[1fr_110px] items-center gap-3"><label className="text-xs">{gradeCriteria.find((item) => item.id === name)?.label ?? name}</label><input type="number" min="0" max="100" step="1" value={scores[name] ?? ''} onChange={(event) => setComponentScores((current) => ({ ...current, [subject.courseId]: { ...(current[subject.courseId] ?? {}), [name]: event.target.value } }))} placeholder="0–100" className={inputClass} /></div>)}</div> : <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('noCriteria')}</p>}
                </div>}
                {openGradeCourseId === subject.courseId && <button type="button" onClick={() => void saveSingleGrade(subject)} disabled={savingCourseId === subject.courseId} className="mt-3 w-full rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60" data-testid={`button-save-grade-${subject.courseId}`}>{savingCourseId === subject.courseId ? t('saving') : t('saveThisGrade')}</button>}
              </div>;
            })}</div>
           </div>}
             {mode === 'attendance' && <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.28)] p-4">
              <p className="mb-3 text-xs font-bold text-[hsl(var(--primary))]">{t('attendanceNote')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('attLesson')}>
                  <select className={inputClass} value={attendanceCourseId} onChange={(event) => setAttendanceCourseId(event.target.value)} required data-testid="select-attendance-course">
                    <option value="">{t('chooseLesson')}</option>
                    {(selectedSemester?.subjects ?? []).map((subject) => <option key={subject.courseId} value={subject.courseId}>{subject.title}</option>)}
                  </select>
                </Field>
                 <Field label={t('attendanceDate')} hint={t('attendanceDateHint')}>
                   <input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} className={inputClass} required data-testid="input-attendance-date" />
                 </Field>
                <Field label={t('attendanceStatus')}>
                  <select className={inputClass} value={attendanceStatus} onChange={(event) => setAttendanceStatus(event.target.value as typeof attendanceStatus)} data-testid="select-attendance-status">
                    <option value="present">{t('statusPresent')}</option>
                    <option value="absent">{t('statusAbsent')}</option>
                    <option value="late">{t('statusLate')}</option>
                    <option value="excused">{t('statusExcused')}</option>
                  </select>
                </Field>
              </div>
              <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">{t('teacherFromAccount')}</p>
            </div>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{mode === 'grades' ? t('emptyGrades') : t('recordAdded')}</p>
              <div className="flex flex-wrap gap-2">
                {mode === 'attendance' && <button type="button" disabled={updateAttendance.isPending} onClick={() => void save(undefined, 'absent')} className="focus-ring rounded-xl border border-[hsl(var(--destructive)/.35)] px-4 py-2.5 text-sm font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)] disabled:opacity-50" data-testid="button-mark-absent">
                  {t('recordAttendance')}
                </button>}
                <button type="submit" disabled={updateProfile.isPending || updateGrades.isPending || updateAttendance.isPending} className={buttonClass} data-testid={mode === 'grades' ? 'button-save-grades' : 'button-save-attendance'}>{updateProfile.isPending || updateGrades.isPending || updateAttendance.isPending ? t('saving') : mode === 'grades' ? t('saveGrades') : t('saveAttendance')}</button>
              </div>
            </div>
          <FormNotice text={notice} error={notice.includes(t('gradeNotSaved')) || notice.includes(t('gradeRange')) || notice.includes('bilmədi') || notice.includes('arasında')} />
        </>
      )}
    </form>
  );
}

type StudentDirectoryFilter = 'all' | 1 | 2 | 3 | 4;

function studentTermLabel(termNumber: number) {
  const suffixes = ['-ci', '-ci', '-cü', '-cü', '-ci', '-cı', '-ci', '-ci'];
  return `${termNumber}${suffixes[termNumber - 1] ?? '-ci'} Semestr`;
}

function StudentDirectory({ filter, onClose, canEdit, embedded = false, focusStudentId }: { filter: StudentDirectoryFilter; onClose: () => void; canEdit: boolean; embedded?: boolean; focusStudentId?: number | null }) {
  const { t, locale } = useI18n();
  const studentsQuery = useGetAdminStudents();
  const deleteStudent = useDeleteAdminStudent();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [editingStudentUserId, setEditingStudentUserId] = useState<string | null>(null);
  const [selectedProfileIds, setSelectedProfileIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState<'promotion' | 'notification' | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationForm, setNotificationForm] = useState({ title: '', body: '', destination: 'home' });
  const [scheduleAccess, setScheduleAccess] = useState<Record<number, boolean>>({});
  const [scheduleAccessLoading, setScheduleAccessLoading] = useState(true);
  const [approvingScheduleProfileId, setApprovingScheduleProfileId] = useState<number | null>(null);
  const students = studentsQuery.data ?? [];
  const terms = filter === 1 ? [1, 2] : filter === 2 ? [3, 4] : filter === 3 ? [5, 6] : filter === 4 ? [7, 8] : [1, 2, 3, 4, 5, 6, 7, 8];
  const title = filter === 'all' ? t('allStudents') : `${t((['year1', 'year2', 'year3', 'year4'] as const)[filter - 1] ?? 'year1')} · ${t('yearStudents')}`;
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'az-AZ', { dateStyle: 'medium' }).format(new Date(value));
  const normalizedSearch = search.trim().toLocaleLowerCase('az-AZ');
  const filteredStudents = students.filter((student) => {
    if (filter !== 'all' && student.courseYear !== filter) return false;
    if (!normalizedSearch) return true;
    const studentNumber = String(student.studentNumber);
    const formattedStudentNumber = `t${studentNumber.padStart(4, '0')}`;
    return [student.firstName, student.lastName, student.email, student.phone, studentNumber, formattedStudentNumber]
      .join(' ')
      .toLocaleLowerCase('az-AZ')
      .includes(normalizedSearch);
  });
  const visibleProfileIds = filteredStudents.map((student) => student.profileId);
  const allVisibleSelected = visibleProfileIds.length > 0 && visibleProfileIds.every((id) => selectedProfileIds.includes(id));
  const toggleStudentSelection = (profileId: number) => {
    setSelectedProfileIds((current) => current.includes(profileId) ? current.filter((id) => id !== profileId) : [...current, profileId]);
  };
  const toggleVisibleSelection = () => {
    setSelectedProfileIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleProfileIds.includes(id))
      : Array.from(new Set([...current, ...visibleProfileIds])));
  };
  const bulkPromote = async () => {
    if (!selectedProfileIds.length || !window.confirm(`${selectedProfileIds.length} tələbənin növbəti semestrə keçirilməsini təsdiqləyirsiniz?`)) return;
    setBulkBusy('promotion');
    setNotice('');
    try {
      const expectedCurrentTerms = selectedProfileIds.map((profileId) => {
        const student = students.find((item) => item.profileId === profileId);
        return student ? { profileId, expectedTermNumber: student.currentTermNumber } : null;
      });
      if (expectedCurrentTerms.some((item) => item === null)) {
        setNotice('Seçilmiş tələbələrdən birinin cari semestr məlumatı yenilənib. Siyahını yeniləyin.');
        return;
      }
      const response = await fetch(apiUrl('/admin/academic-profiles/bulk-promote'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileIds: selectedProfileIds, expectedCurrentTerms }) });
      const result = await response.json().catch(() => ({})) as { promotedProfileIds?: number[]; failures?: Array<{ error: string }>; error?: string };
      if (!response.ok) throw new Error(result.error || 'Toplu semestr keçidi baş tutmadı.');
      setSelectedProfileIds((current) => current.filter((id) => !(result.promotedProfileIds ?? []).includes(id)));
      await Promise.all([studentsQuery.refetch(), queryClient.invalidateQueries({ queryKey: getGetAdminAcademicProfilesQueryKey() })]);
      const promoted = result.promotedProfileIds?.length ?? 0;
      const failures = result.failures?.length ?? 0;
      setNotice(`${promoted} tələbə növbəti semestrə keçirildi${failures ? `, ${failures} tələbə üçün əməliyyat baş tutmadı.` : '.'}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Toplu semestr keçidi baş tutmadı.');
    } finally {
      setBulkBusy(null);
    }
  };
  const sendBulkNotification = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProfileIds.length) return;
    setBulkBusy('notification');
    setNotice('');
    try {
      const response = await fetch(apiUrl('/admin/student-notifications'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...notificationForm, targetProfileIds: selectedProfileIds }) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Bildiriş göndərilmədi.');
      setNotificationForm({ title: '', body: '', destination: 'home' });
      setNotificationOpen(false);
      setNotice(`${selectedProfileIds.length} tələbəyə bildiriş göndərildi.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Bildiriş göndərilmədi.');
    } finally {
      setBulkBusy(null);
    }
  };
  useEffect(() => {
    if (focusStudentId && students.some((student) => student.profileId === focusStudentId)) setSelectedStudentId(focusStudentId);
  }, [focusStudentId, students]);
  useEffect(() => {
    let cancelled = false;
    setScheduleAccessLoading(true);
    void Promise.all(students.map(async (student) => {
      const response = await fetch(apiUrl(`/admin/academic-profiles/${student.profileId}/schedule-access`));
      if (!response.ok) throw new Error('load');
      const result = await response.json() as { approved?: boolean };
      return [student.profileId, result.approved === true] as const;
    })).then((entries) => {
      if (!cancelled) setScheduleAccess(Object.fromEntries(entries));
    }).catch(() => {
      if (!cancelled) setScheduleAccess({});
    }).finally(() => {
      if (!cancelled) setScheduleAccessLoading(false);
    });
    return () => { cancelled = true; };
  }, [studentsQuery.data]);
  const updateScheduleAccess = async (profileId: number, studentName: string, approved: boolean) => {
    setApprovingScheduleProfileId(profileId);
    setNotice('');
    try {
      const response = await fetch(apiUrl(`/admin/academic-profiles/${profileId}/schedule-access`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved }) });
      const result = await response.json().catch(() => ({})) as { approved?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || 'Cədvəl giriş statusu dəyişdirilmədi.');
      setScheduleAccess((current) => ({ ...current, [profileId]: result.approved === true }));
      setNotice(approved ? `${studentName} üçün cədvələ giriş təsdiqləndi.` : `${studentName} üçün cədvəl girişi geri alındı.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Cədvəl giriş statusu dəyişdirilmədi.');
    } finally {
      setApprovingScheduleProfileId(null);
    }
  };
  const deleteStudentAccount = (student: (typeof students)[number]) => {
    const fullName = `${student.firstName} ${student.lastName}`;
    const reason = window.prompt(`${fullName}: ${t('deleteReason')}`, '');
    if (reason === null || !reason.trim()) {
      setNotice(t('deleteReasonRequired'));
      return;
    }
    if (!window.confirm(`${fullName}: ${t('confirmDeactivate')}`)) return;
    setNotice('');
    deleteStudent.mutate({ profileId: student.profileId, data: { reason: reason.trim() } }, {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetAdminStudentsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetAdminAcademicProfilesQueryKey() }),
        ]);
        setNotice(`${fullName}: ${t('accountDeleted')}`);
      },
      onError: () => setNotice(t('accountNotDeleted')),
    });
  };
  return (
    <div className={embedded ? 'w-full' : 'fixed inset-0 z-50 overflow-y-auto bg-[hsl(var(--primary)/.48)] px-4 py-8 backdrop-blur-sm'} role={embedded ? 'region' : 'dialog'} aria-modal={embedded ? undefined : true} aria-labelledby="student-directory-title" data-testid="student-directory">
      <div className={`mx-auto max-w-4xl rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-lg)] md:p-8 ${embedded ? 'shadow-[var(--shadow-xs)]' : ''}`}>
        <div className="flex items-start justify-between gap-4 border-b border-[hsl(var(--border))] pb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--secondary-foreground))]">{t('catalog')}</p>
            <h2 id="student-directory-title" className="mt-1 font-serif text-3xl text-[hsl(var(--primary))]">{title}</h2>
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{t('approvedOnly')}</p>
          </div>
          <button type="button" onClick={onClose} className="focus-ring rounded-xl p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label={t('closeWindow')}><X size={20} /></button>
        </div>
        <div className="mt-5">
          <label htmlFor="student-directory-search" className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">{t('searchStudents')}</label>
          <input id="student-directory-search" className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchStudentsPh')} data-testid="input-student-search" />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.28)] p-3" data-testid="student-bulk-actions">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--primary))]">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection} disabled={!visibleProfileIds.length} data-testid="checkbox-select-all-students" />
            {t('selectAll')}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{selectedProfileIds.length} {t('studentsPicked')}</span>
            <button type="button" onClick={() => void bulkPromote()} disabled={!canEdit || !selectedProfileIds.length || bulkBusy !== null} className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-bulk-promote"><GraduationCap size={14} /> {bulkBusy === 'promotion' ? t('promoting') : t('promoteSemester')}</button>
            <button type="button" onClick={() => setNotificationOpen((current) => !current)} disabled={!selectedProfileIds.length || bulkBusy !== null} className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--secondary-foreground))] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-open-bulk-notification"><Send size={14} /> {t('sendNotice')}</button>
          </div>
        </div>
        {notificationOpen && <form onSubmit={sendBulkNotification} className="mt-3 space-y-3 rounded-xl border border-[hsl(var(--secondary-foreground)/.25)] bg-[hsl(var(--secondary)/.25)] p-4" data-testid="form-bulk-notification">
          <p className="text-xs font-bold text-[hsl(var(--primary))]">{selectedProfileIds.length} {t('noticeToSelected')}</p>
          <input required maxLength={160} className={inputClass} value={notificationForm.title} onChange={(event) => setNotificationForm((current) => ({ ...current, title: event.target.value }))} placeholder={t('noticeTitle')} data-testid="input-bulk-notification-title" />
          <textarea required maxLength={5000} rows={3} className={`${inputClass} resize-y`} value={notificationForm.body} onChange={(event) => setNotificationForm((current) => ({ ...current, body: event.target.value }))} placeholder={t('noticeBody')} data-testid="textarea-bulk-notification-body" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select className={`${inputClass} max-w-xs`} value={notificationForm.destination} onChange={(event) => setNotificationForm((current) => ({ ...current, destination: event.target.value }))} data-testid="select-bulk-notification-destination">
              <option value="home">{t('destPanel')}</option><option value="gmail">{t('destGmail')}</option><option value="both">{t('destBoth')}</option>
            </select>
            <button type="submit" disabled={bulkBusy !== null} className={buttonClass} data-testid="button-send-bulk-notification">{bulkBusy === 'notification' ? t('sending') : t('send')}</button>
          </div>
        </form>}
        {notice && <p className={`mt-3 rounded-xl p-3 text-xs font-semibold ${notice.includes(t('accountNotDeleted')) || notice.includes('bilmədi') ? 'bg-[hsl(var(--destructive)/.08)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--secondary)/.45)] text-[hsl(var(--secondary-foreground))]'}`}>{notice}</p>}
        {studentsQuery.isLoading ? (
          <div className="mt-6 space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" />)}</div>
        ) : studentsQuery.isError ? (
          <p className="mt-6 rounded-2xl border border-[hsl(var(--destructive)/.2)] bg-[hsl(var(--destructive)/.05)] p-5 text-sm font-semibold text-[hsl(var(--destructive))]">{t('listFailed')}</p>
        ) : (
          <div className="mt-6 space-y-5">
            {terms.map((termNumber) => {
              const termStudents = filteredStudents.filter((student) => student.currentTermNumber === termNumber);
              return (
                <section key={termNumber} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.22)] p-4" aria-labelledby={`student-term-${termNumber}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 id={`student-term-${termNumber}`} className="font-bold text-[hsl(var(--primary))]">{termNumber}. {t('termLabel')}</h3>
                    <span className="rounded-full bg-[hsl(var(--secondary)/.6)] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--secondary-foreground))]">{termStudents.length} {t('studentWord')}</span>
                  </div>
                  {termStudents.length ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {termStudents.map((student) => (
                        <article key={student.profileId} onClick={() => setSelectedStudentId(student.profileId)} className="cursor-pointer rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition hover:-translate-y-0.5 hover:border-[hsl(var(--secondary-foreground)/.45)] hover:shadow-[var(--shadow-sm)]" data-testid={`student-directory-item-${student.profileId}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2"><input type="checkbox" checked={selectedProfileIds.includes(student.profileId)} onChange={() => toggleStudentSelection(student.profileId)} onClick={(event) => event.stopPropagation()} aria-label={formatFullName(student.firstName, student.lastName)} data-testid={`checkbox-select-student-${student.profileId}`} /><div><h4 className="font-bold text-[hsl(var(--primary))]">{formatFullName(student.firstName, student.lastName)}</h4><span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">{t('studentNo')} T{String(student.studentNumber).padStart(4, '0')}</span></div></div>
                              <div className="flex items-center gap-1"><button type="button" onClick={(event) => { event.stopPropagation(); setEditingStudentUserId(student.clerkUserId); }} disabled={!canEdit} className="focus-ring rounded-lg px-2 py-1 text-[10px] font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))] disabled:hidden" data-testid={`button-edit-student-${student.profileId}`}>{t('editShort')}</button><button type="button" onClick={(event) => { event.stopPropagation(); deleteStudentAccount(student); }} disabled={deleteStudent.isPending} className="focus-ring rounded-lg px-2 py-1 text-[10px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)] disabled:opacity-50" data-testid={`button-delete-student-${student.profileId}`}>{t('deleteAccount')}</button></div>
                          </div>
                          <dl className="mt-3 space-y-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                            <div className="flex justify-between gap-3"><dt>{t('email')}</dt><dd className="text-right font-semibold text-[hsl(var(--primary))]">{student.email}</dd></div>
                            <div className="flex justify-between gap-3"><dt>{t('phone')}</dt><dd className="font-semibold text-[hsl(var(--primary))]">{student.phone}</dd></div>
                            <div className="flex justify-between gap-3"><dt>{t('registeredAt')}</dt><dd className="font-semibold text-[hsl(var(--primary))]">{formatDate(student.registeredAt)}</dd></div>
                          </dl>
                           <div className="mt-4 border-t border-[hsl(var(--border))] pt-3">
                             <p className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{t('scheduleEntry')}</p>
                              {scheduleAccessLoading ? <span className="text-xs text-[hsl(var(--muted-foreground))]">{t('statusChecking')}</span> : <button type="button" onClick={(event) => { event.stopPropagation(); void updateScheduleAccess(student.profileId, formatFullName(student.firstName, student.lastName), !scheduleAccess[student.profileId]); }} disabled={approvingScheduleProfileId === student.profileId} className={`focus-ring inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${scheduleAccess[student.profileId] ? 'border border-emerald-300 bg-emerald-100 text-emerald-800' : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'}`} data-testid={`${scheduleAccess[student.profileId] ? 'button-revoke-schedule-access' : 'button-approve-schedule-access'}-${student.profileId}`}><CheckCircle2 size={14} /> {approvingScheduleProfileId === student.profileId ? t('saving') : scheduleAccess[student.profileId] ? t('accessApproved') : t('approveAccess')}</button>}
                           </div>
                          {editingStudentUserId === student.clerkUserId && <UserProfileEditor inline user={{ id: student.clerkUserId, firstName: student.firstName, lastName: student.lastName, username: student.username, email: student.email, role: 'none' }} onClose={() => setEditingStudentUserId(null)} onSaved={async () => { setEditingStudentUserId(null); await studentsQuery.refetch(); }} />}
                        </article>
                      ))}
                    </div>
                  ) : <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">{t('noStudentThisTerm')}</p>}
                </section>
              );
            })}
            {!students.length && <p className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-7 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('noApprovedStudent')}</p>}
          </div>
        )}
        {selectedStudentId !== null && <StudentDetail profileId={selectedStudentId} onClose={() => setSelectedStudentId(null)} />}
      </div>
    </div>
  );
}

function StudentDetail({ profileId, onClose }: { profileId: number; onClose: () => void }) {
  const { t } = useI18n();
  const profileQuery = useGetAdminAcademicProfile(profileId, { query: { enabled: true, queryKey: getGetAdminAcademicProfileQueryKey(profileId) } });
  const queryClient = useQueryClient();
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotionNotice, setPromotionNotice] = useState('');
  const [scheduleAccessApproved, setScheduleAccessApproved] = useState(false);
  const [isScheduleAccessLoading, setIsScheduleAccessLoading] = useState(true);
  const [isApprovingScheduleAccess, setIsApprovingScheduleAccess] = useState(false);
  const profile = profileQuery.data;
  useEffect(() => {
    let cancelled = false;
    setIsScheduleAccessLoading(true);
    void fetch(apiUrl(`/admin/academic-profiles/${profileId}/schedule-access`))
      .then((response) => response.ok ? response.json() as Promise<{ approved?: boolean }> : Promise.reject(new Error('load')))
      .then((result) => { if (!cancelled) setScheduleAccessApproved(result.approved === true); })
      .catch(() => { if (!cancelled) setScheduleAccessApproved(false); })
      .finally(() => { if (!cancelled) setIsScheduleAccessLoading(false); });
    return () => { cancelled = true; };
  }, [profileId]);
  const promoteStudent = async () => {
    if (!profile || profile.currentTermNumber >= 8) return;
    if (!window.confirm(`${profile.firstName} ${profile.lastName}: ${t('askNext')}`)) return;
    setIsPromoting(true);
    setPromotionNotice('');
    try {
      const response = await fetch(apiUrl(`/admin/academic-profiles/${profileId}/promote`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedTermNumber: profile.currentTermNumber }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || t('notMoved'));
      await Promise.all([
        profileQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: getGetAdminAcademicProfilesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminStudentsQueryKey() }),
      ]);
      setPromotionNotice(t('movedNext'));
    } catch (error) {
      setPromotionNotice(error instanceof Error ? error.message : t('notMoved'));
    } finally {
      setIsPromoting(false);
    }
  };
  const demoteStudent = async () => {
    if (!profile || profile.currentTermNumber <= 1) return;
    if (!window.confirm(`${profile.firstName} ${profile.lastName}: ${t('askBack')}`)) return;
    setIsPromoting(true);
    setPromotionNotice('');
    try {
      const response = await fetch(apiUrl(`/admin/academic-profiles/${profileId}/demote`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedTermNumber: profile.currentTermNumber }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || t('notMovedBack'));
      await Promise.all([
        profileQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: getGetAdminAcademicProfilesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminStudentsQueryKey() }),
      ]);
      setPromotionNotice(t('movedBack'));
    } catch (error) {
      setPromotionNotice(error instanceof Error ? error.message : t('notMovedBack'));
    } finally {
      setIsPromoting(false);
    }
  };
  const updateScheduleAccess = async () => {
    const approved = !scheduleAccessApproved;
    setIsApprovingScheduleAccess(true);
    setPromotionNotice('');
    try {
      const response = await fetch(apiUrl(`/admin/academic-profiles/${profileId}/schedule-access`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved }) });
      const result = await response.json().catch(() => ({})) as { approved?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || t('accessFail'));
      setScheduleAccessApproved(result.approved === true);
      setPromotionNotice(approved ? t('accessOk') : t('accessBack'));
    } catch (error) {
      setPromotionNotice(error instanceof Error ? error.message : t('accessFail'));
    } finally {
      setIsApprovingScheduleAccess(false);
    }
  };
  return <div className="fixed inset-0 z-[60] overflow-y-auto bg-[hsl(var(--primary)/.52)] px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="student-detail-title">
    <div className="mx-auto max-w-5xl rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-lg)] md:p-8">
      <div className="flex items-start justify-between gap-4 border-b border-[hsl(var(--border))] pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--secondary-foreground))]">{t('studentInfo')}</p><h2 id="student-detail-title" className="mt-1 font-serif text-3xl text-[hsl(var(--primary))]">{profile ? `${profile.firstName} ${profile.lastName}` : t('studentProfile')}</h2></div><button type="button" onClick={onClose} className="focus-ring rounded-xl p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label={t('closeDetails')}><X size={20} /></button></div>
      {profileQuery.isLoading ? <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">{t('infoLoading')}</p> : !profile ? <p className="mt-6 text-sm text-[hsl(var(--destructive))]">{t('infoFailed')}</p> : <div className="mt-6 space-y-6">
        <dl className="grid gap-3 rounded-2xl bg-[hsl(var(--muted)/.35)] p-4 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">{t('studentNo')}</dt><dd className="mt-1 font-bold">T{String(profile.studentNumber).padStart(4, '0')}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">{t('email')}</dt><dd className="mt-1 font-bold">{profile.email}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">{t('phone')}</dt><dd className="mt-1 font-bold">{profile.phone}</dd></div></dl>
        <section className="rounded-2xl border border-[hsl(var(--accent)/.55)] bg-[hsl(var(--accent)/.12)] p-4" data-testid="section-semester-promotion">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">{t('termMove')}</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{t('currentSemester')}: <strong>{profile.currentTermNumber}. {t('termLabel')}</strong></p></div>
             <div className="flex flex-wrap gap-2">
               {profile.currentTermNumber > 1 && <button type="button" onClick={() => void demoteStudent()} disabled={isPromoting} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="button-demote-semester"><GraduationCap size={16} /> {isPromoting ? t('confirming') : t('backTerm')}</button>}
               {profile.currentTermNumber < 8 ? <button type="button" onClick={() => void promoteStudent()} disabled={isPromoting} className={buttonClass} data-testid="button-confirm-semester-promotion"><GraduationCap size={16} /> {isPromoting ? t('confirming') : t('nextTerm')}</button> : <span className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">{t('finalTerm')}</span>}
             </div>
          </div>
          {promotionNotice && <p className="mt-3 text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{promotionNotice}</p>}
        </section>
         <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] p-4" data-testid="section-schedule-access">
           <div className="flex flex-wrap items-center justify-between gap-3">
             <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">{t('scheduleEntry')}</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{scheduleAccessApproved ? t('canSeeSchedule') : t('cannotSeeSchedule')}</p></div>
              {isScheduleAccessLoading ? <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{t('checkingShort')}</span> : <button type="button" onClick={() => void updateScheduleAccess()} disabled={isApprovingScheduleAccess} className={scheduleAccessApproved ? 'focus-ring inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-200 disabled:opacity-50' : buttonClass} data-testid={scheduleAccessApproved ? 'button-revoke-schedule-access' : 'button-approve-schedule-access'}><CheckCircle2 size={16} /> {isApprovingScheduleAccess ? t('saving') : scheduleAccessApproved ? t('accessApproved') : t('approveAccess')}</button>}
           </div>
         </section>
        {profile.semesters.filter((semester) => semester.termNumber <= profile.currentTermNumber).map((semester) => <section key={semester.termNumber} className="rounded-2xl border border-[hsl(var(--border))] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-serif text-xl text-[hsl(var(--primary))]">{semester.label}</h3><span className="text-xs font-bold text-[hsl(var(--secondary-foreground))]">GPA: {semester.gpa === null ? '—' : semester.gpa.toFixed(2)} · {t('totalAbsences')}: {semester.subjects.reduce((sum, subject) => sum + subject.absenceCount, 0)}</span></div><div className="mt-3 divide-y divide-[hsl(var(--border))]">{semester.subjects.map((subject) => <div key={subject.courseId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span className="font-semibold">{subject.title}</span><span className="text-xs font-bold text-[hsl(var(--secondary-foreground))]">{t('gradeWord')}: {subject.grade === null ? '—' : `${subject.grade.toFixed(2)} / 5`} · {t('absence')}: {subject.absenceCount} · {t('absenceRate')}: {subject.attendancePercent === null ? '—%' : `${subject.attendancePercent}%`}</span></div>)}</div>{semester.attendanceRecords.length ? <div className="mt-4 overflow-x-auto"><p className="mb-2 text-xs font-bold text-[hsl(var(--primary))]">{t('attHistory')}</p><div className="space-y-2">{semester.attendanceRecords.map((record) => <div key={record.id} className="grid gap-1 rounded-lg bg-[hsl(var(--muted)/.4)] p-3 text-xs sm:grid-cols-[1fr_auto_auto]"><span className="font-semibold">{record.courseTitle}</span><span>{record.attendanceDate}</span><span>{record.teacherName} · {record.status === 'absent' ? t('statusAbsent') : record.status === 'present' ? t('statusPresent') : record.status === 'late' ? t('statusLate') : record.status === 'excused' ? t('statusExcused') : record.status}</span></div>)}</div></div> : <p className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">{t('noAttThisTerm')}</p>}</section>)}
      </div>}
    </div>
  </div>;
}

function TeacherStats({ canEdit, canReadProfiles }: { canEdit: boolean; canReadProfiles: boolean }) {
  const { t: tr } = useI18n();
  const profilesQuery = useGetAdminAcademicProfiles({ query: { enabled: canReadProfiles, queryKey: getGetAdminAcademicProfilesQueryKey() } });
  const profiles = profilesQuery.data ?? [];
  const [activeTerms, setActiveTerms] = useState<number[]>([1, 2, 3, 4]);
  const firstYearCount = profiles.filter((profile) => profile.courseYear === 1).length;
   const secondYearCount = profiles.filter((profile) => profile.courseYear === 2).length;
   const thirdYearCount = profiles.filter((profile) => profile.courseYear === 3).length;
   const fourthYearCount = profiles.filter((profile) => profile.courseYear === 4).length;
  const [directoryFilter, setDirectoryFilter] = useState<StudentDirectoryFilter | null>(null);

  useEffect(() => {
    void fetch(apiUrl('/admin/course-activation'))
      .then(async (response) => response.ok ? response.json() as Promise<{ activeTermNumbers: number[] }> : Promise.reject(new Error('load')))
      .then((result) => setActiveTerms(result.activeTermNumbers))
      .catch(() => undefined);
  }, []);

  return (
    <section className="mt-5" data-testid="teacher-stats">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--secondary-foreground))]">{tr('academicSummary')}</p>
        </div>
        <p className="hidden text-xs text-[hsl(var(--muted-foreground))] sm:block">{tr('approvedStudents')}</p>
      </div>
      {profilesQuery.isLoading ? (
         <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-[hsl(var(--muted))]" />)}
        </div>
      ) : profilesQuery.isError ? (
        <p className="rounded-2xl border border-[hsl(var(--destructive)/.2)] bg-[hsl(var(--destructive)/.05)] p-4 text-sm font-semibold text-[hsl(var(--destructive))]">Tələbə statistikası yüklənə bilmədi.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
           <button type="button" onClick={() => setDirectoryFilter('all')} className="focus-ring flex items-center justify-between gap-2 rounded-xl bg-[hsl(var(--primary))] px-3 py-2.5 text-left text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5">
            <span>
              <span className="grid size-7 place-items-center rounded-lg bg-white/10 text-[hsl(var(--accent))]"><UsersRound size={14} /></span>
              <span className="mt-2 block text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--primary-foreground)/.62)]">{tr('totalStudents')}</span>
              <span className="mt-0.5 block font-serif text-2xl leading-none">{profiles.length}</span>
            </span>
            <span className="flex items-end gap-1" aria-hidden>{[8, 14, 11, 18, 15].map((height) => <span key={height} className="w-1 rounded-full bg-white/25" style={{ height }} />)}</span>
           </button>
           <button type="button" onClick={() => setDirectoryFilter(1)} className="focus-ring flex items-center justify-between gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-left shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5">
            <span>
              <span className="grid size-7 place-items-center rounded-lg bg-[#eef8f1] text-[#2f7d4f]"><GraduationCap size={14} /></span>
              <span className="mt-2 block text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{tr('year1')}</span>
              <span className="mt-0.5 block font-serif text-2xl leading-none text-[hsl(var(--primary))]">{firstYearCount}</span>
              <span className="block text-[11px] text-[hsl(var(--muted-foreground))]">{tr('studentWord')}</span>
            </span>
            <span className="flex items-end gap-1" aria-hidden>{[7, 11, 15, 18].map((height) => <span key={height} className="w-1 rounded-full bg-[#8dcea8]" style={{ height }} />)}</span>
           </button>
           <button type="button" onClick={() => setDirectoryFilter(2)} className="focus-ring flex items-center justify-between gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-left shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5">
            <span>
              <span className="grid size-7 place-items-center rounded-lg bg-[#eef4ff] text-[#3d63b8]"><GraduationCap size={14} /></span>
              <span className="mt-2 block text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{tr('year2')}</span>
              <span className="mt-0.5 block font-serif text-2xl leading-none text-[hsl(var(--primary))]">{secondYearCount}</span>
              <span className="block text-[11px] text-[hsl(var(--muted-foreground))]">{tr('studentWord')}</span>
            </span>
            <span className="flex items-end gap-1" aria-hidden>{[12, 8, 11, 7].map((height) => <span key={height} className="w-1 rounded-full bg-[#d7e2f2]" style={{ height }} />)}</span>
           </button>
            {activeTerms.includes(5) && activeTerms.includes(6) && <button type="button" onClick={() => setDirectoryFilter(3)} className="focus-ring rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-left shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5">
             <GraduationCap size={16} className="text-[hsl(var(--secondary-foreground))]" />
             <p className="mt-2 text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{tr('year3')}</p>
             <p className="mt-0.5 font-serif text-2xl leading-none text-[hsl(var(--primary))]">{thirdYearCount}</p>
             <p className="text-[11px] text-[hsl(var(--muted-foreground))]">tələbə</p>
            </button>}
            {activeTerms.includes(7) && activeTerms.includes(8) && <button type="button" onClick={() => setDirectoryFilter(4)} className="focus-ring rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-left shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5">
             <GraduationCap size={16} className="text-[hsl(var(--secondary-foreground))]" />
             <p className="mt-2 text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{tr('year4')}</p>
             <p className="mt-0.5 font-serif text-2xl leading-none text-[hsl(var(--primary))]">{fourthYearCount}</p>
             <p className="text-[11px] text-[hsl(var(--muted-foreground))]">tələbə</p>
            </button>}
        </div>
      )}
       {directoryFilter !== null && <StudentDirectory filter={directoryFilter} canEdit={canEdit} onClose={() => setDirectoryFilter(null)} />}
    </section>
  );
}

const roleLabels: Record<AdminUser['role'], string> = {
  none: 'Adi istifadəçi',
  owner: 'Sistem sahibi',
  owner_assistant: 'İdarə heyəti',
  teacher: 'Müəllim',
  supervisor: 'Nəzarətçi',
  admin: 'Köhnə admin rolu',
};

const formatTeacherNumber = (index: number) => `M${String(index + 1).padStart(2, '0')}`;
const formatSupervisorNumber = (index: number) => `B${String(index + 1).padStart(3, '0')}`;
const formatOwnerAssistantNumber = (index: number) => `NK${index + 1}`;
// Adı olmayan hesab (məs. Clerk panelindən yaradılmış müəllim) «İstifadəçi» əvəzinə e-poçtla göstərilir.
const adminUserName = (user: Pick<AdminUser, 'firstName' | 'lastName' | 'username'> & { email?: string | null }) =>
  [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || user.email || 'İstifadəçi';
const roleBadgeClass = (role: AdminUser['role']) => {
  if (role === 'owner') return 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]';
  if (role === 'teacher' || role === 'admin') return 'bg-[hsl(var(--primary)/.86)] text-[hsl(var(--primary-foreground))]';
  if (role === 'owner_assistant') return 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]';
  if (role === 'supervisor') return 'bg-[hsl(var(--accent)/.55)] text-[hsl(var(--primary))]';
  return 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]';
};
const rolePermissionLabels = {
  applications: 'Müraciətlər və dərs müraciətləri',
  students: 'Tələbələr və akademik məlumatlar',
  grading: 'Qiymətləndirmə',
  attendance: 'Davamiyyət',
  excuses: 'Üzr müraciətləri',
  announcements: 'Elanlar',
  articles: 'Məqalələr',
  dailyBenefits: 'Günün faydası',
  schedule: 'Qruplar və dərs cədvəli',
  assignments: 'Ev tapşırıqları',
  teacherAssignment: 'Müəllim olsun (müəllim təyinatı)',
  userRoleManagement: 'Başqalarına müəllimlik verə bilsin',
} as const;
type RolePermissionKey = keyof typeof rolePermissionLabels;
type IndividualPermissionRole = 'teacher' | 'supervisor' | 'owner_assistant';
const individualPermissionRole = (user: AdminUser): IndividualPermissionRole | null =>
  user.role === 'teacher' || user.role === 'supervisor' || user.role === 'owner_assistant' ? user.role : null;

/** Small arrow under the active tile pointing at the panel that opened right below it. */
function TilePointer() {
  return <span aria-hidden="true" className="pointer-events-none absolute -bottom-[7px] left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[7px] border-x-transparent border-t-[hsl(var(--primary))]" />;
}

/** Full-width panel placed in the tile grid directly after the clicked tile.
 *  The grid uses `grid-flow-row-dense`, so the remaining tiles of that row fill
 *  in before it and the panel always starts on the row right below the tile,
 *  whatever the column count (phone / tablet / desktop). */
function InlineSectionPanel({ id, live = false, children }: { id: string; live?: boolean; children: ReactNode }) {
  return <div id={id} role="region" aria-live={live ? 'polite' : undefined} className="col-span-full mb-2 mt-1 min-w-0 scroll-mt-3 rounded-2xl border-2 border-[hsl(var(--primary)/.35)] bg-[hsl(var(--card))] p-3 text-left shadow-[var(--shadow-xs)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200 sm:p-4" data-testid={id}>{children}</div>;
}

/** After a tile opens its panel, bring the tile and the top of the panel into view
 *  (only scrolls when they are not already comfortably visible). */
function revealTileAndPanel(tileTestId: string, panelId: string) {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    const tile = document.querySelector<HTMLElement>(`[data-testid="${tileTestId}"]`);
    if (!tile) return;
    const panel = document.getElementById(panelId);
    const tileTop = tile.getBoundingClientRect().top;
    const panelTop = panel ? panel.getBoundingClientRect().top : tile.getBoundingClientRect().bottom;
    const viewport = window.innerHeight || document.documentElement.clientHeight;
    if (tileTop >= 8 && panelTop <= viewport - 160) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, tileTop + window.scrollY - 12), behavior: reduceMotion ? 'auto' : 'smooth' });
  });
}

const adminTabButtonClass = (value: string, active: boolean) =>
  `focus-ring inline-flex max-w-full items-center gap-2 whitespace-normal rounded-full border px-3.5 py-2 text-left text-xs font-bold transition ${active ? 'border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]'}`;

const adminTileClass = (_value: string, active: boolean) =>
  `focus-ring relative flex min-h-[64px] flex-col items-start justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-[11px] font-bold leading-4 text-[hsl(var(--primary))] transition hover:-translate-y-0.5 ${active ? 'border-[hsl(var(--primary))] bg-[hsl(var(--accent)/.55)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)] hover:bg-[hsl(var(--muted))]'}`;

function RoleManagement({ canConfigurePermissions }: { canConfigurePermissions: boolean }) {
  const { t } = useI18n();
  const roleName = (role: AdminUser['role']) => role === 'owner' ? t('systemOwner') : role === 'owner_assistant' ? t('roleBoard') : role === 'teacher' || role === 'admin' ? t('roleTeacher') : role === 'supervisor' ? t('roleSupervisor') : role === 'none' ? t('plainUser') : roleLabels[role];
  const permLabel = (key: RolePermissionKey) => {
    const map = {
      applications: 'permApplications', students: 'permStudents', grading: 'permGrading', attendance: 'permAttendance', excuses: 'permExcuses', announcements: 'permAnnouncements', articles: 'permArticles', dailyBenefits: 'permBenefits', schedule: 'permSchedule', assignments: 'permAssignments', teacherAssignment: 'permTeacherAssign', userRoleManagement: 'permUserRoles',
    } as const;
    return t(map[key]);
  };
  const usersQuery = useGetAdminUsers({ query: { queryKey: getGetAdminUsersQueryKey() } });
  const updateRole = useUpdateAdminUserRole();
  const deleteUser = useDeleteAdminUser();
  const queryClient = useQueryClient();
  const [draftRoles, setDraftRoles] = useState<Record<string, typeof UserRoleUpdateInputRole[keyof typeof UserRoleUpdateInputRole]>>({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [permissionRole, setPermissionRole] = useState<'teacher' | 'supervisor' | 'owner_assistant' | null>(null);
  const [rolePermissions, setRolePermissions] = useState<Record<'teacher' | 'supervisor' | 'owner_assistant', RolePermissionKey[]>>({
    teacher: Object.keys(rolePermissionLabels) as RolePermissionKey[],
    supervisor: Object.keys(rolePermissionLabels) as RolePermissionKey[],
    owner_assistant: ['applications', 'teacherAssignment'],
  });
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
   const [viewingUser, setViewingUser] = useState<AdminUser | null>(null);
   const [permissionUser, setPermissionUser] = useState<AdminUser | null>(null);
   const [individualPermissions, setIndividualPermissions] = useState<RolePermissionKey[]>([]);
   const [isSavingIndividualPermissions, setIsSavingIndividualPermissions] = useState(false);
   const [expandedSummaryRole, setExpandedSummaryRole] = useState<'teacher' | 'assistant' | 'supervisor' | null>(null);
   const [studentRecords, setStudentRecords] = useState<Record<string, StudentRecordInfo>>({});
  const individualProfileQuery = useGetAdminUserProfile(permissionUser?.id ?? '', {
    query: {
      enabled: Boolean(permissionUser),
      queryKey: getGetAdminUserProfileQueryKey(permissionUser?.id ?? ''),
    },
  });

  useEffect(() => {
    // GET /admin/role-permissions is owner-only on the server (requireSystemOwner);
    // the shared permission sets are only used by the owner's permission dialogs,
    // so the board (İdarə heyəti) must not request them at all (avoids a 403).
    if (!canConfigurePermissions) return;
    void fetch(apiUrl('/admin/role-permissions')).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { teacher?: RolePermissionKey[]; supervisor?: RolePermissionKey[]; owner_assistant?: RolePermissionKey[] };
      setRolePermissions((current) => ({
        teacher: data.teacher ?? current.teacher,
        supervisor: data.supervisor ?? current.supervisor,
        owner_assistant: data.owner_assistant ?? current.owner_assistant,
      }));
    }).catch(() => undefined);
  }, [canConfigurePermissions]);

  useEffect(() => {
    // Tələbə profili olan hesablara işçi rolu veriləndə qısa qeyd göstərmək üçün.
    void fetch(apiUrl('/admin/users/student-records'), { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() as Promise<StudentRecordInfo[]> : [])
      .then((records) => setStudentRecords(Object.fromEntries(records.map((record) => [record.clerkUserId, record]))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!individualProfileQuery.data || !permissionUser) return;
    setIndividualPermissions(individualProfileQuery.data.rolePermissions.filter(
      (key): key is RolePermissionKey => key in rolePermissionLabels,
    ));
  }, [individualProfileQuery.data, permissionUser]);

  const selectedRole = (user: AdminUser) => draftRoles[user.id] ??
    (user.role === 'admin' ? UserRoleUpdateInputRole.teacher : user.role === 'owner' ? UserRoleUpdateInputRole.none : user.role);

  const saveRole = async (user: AdminUser) => {
    const role = selectedRole(user);
    setBusyUserId(user.id);
    setNotice('');
    try {
       const updatedUser = await updateRole.mutateAsync({ userId: user.id, data: { role } });
      setDraftRoles((current) => {
        const next = { ...current };
        delete next[user.id];
        return next;
      });
       queryClient.setQueryData<AdminUser[]>(getGetAdminUsersQueryKey(), (current) =>
         current?.map((item) => item.id === updatedUser.id ? updatedUser : item),
       );
       await queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey(), refetchType: 'none' });
       setNotice(`${user.firstName || user.username || user.email}: ${t('roleUpdated')}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t('roleNotUpdated'));
    } finally {
      setBusyUserId(null);
    }
  };
  const removeUser = async (user: AdminUser) => {
    if (user.role !== 'none') return;
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || user.email;
    if (!window.confirm(`${name} hesabını tamamilə silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.`)) return;
    setDeletingUserId(user.id);
    setNotice('');
    try {
      await deleteUser.mutateAsync({ userId: user.id });
      await queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
      setNotice(`${name} hesabı silindi.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'İstifadəçi hesabı silinə bilmədi.');
    } finally {
      setDeletingUserId(null);
    }
  };

  if (usersQuery.isLoading) return <p className="text-sm text-[hsl(var(--muted-foreground))]">Qeydiyyatdan keçən istifadəçilər yüklənir...</p>;
  if (usersQuery.isError) return <p className="rounded-xl bg-[hsl(var(--destructive)/.06)] p-4 text-sm font-semibold text-[hsl(var(--destructive))]">İstifadəçi siyahısı yüklənə bilmədi.</p>;
  const users = usersQuery.data ?? [];
  const teachers = users.filter((user) => user.role === 'teacher' || user.role === 'admin' || user.role === 'owner');
  const supervisors = users.filter((user) => user.role === 'supervisor');
  const ownerAssistants = users.filter((user) => user.role === 'owner_assistant');
  const sortedUsers = [...users].sort((first, second) => {
    const rank = (user: AdminUser) => user.role === 'owner_assistant' ? 0 : user.role === 'owner' ? 1 : user.role === 'teacher' || user.role === 'admin' ? 2 : user.role === 'supervisor' ? 3 : 4;
    return rank(first) - rank(second);
  });

  return (
    <div className="space-y-4" data-testid="owner-role-management">
      <div className="rounded-2xl bg-[hsl(var(--accent)/.35)] p-4 text-sm leading-6 text-[hsl(var(--primary))]">
        {t('roleIntro')}
      </div>
         <div className="grid gap-4 md:grid-cols-3" data-testid="staff-role-summary">
         <section className="order-2 rounded-2xl border border-[hsl(var(--primary))] bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))]" data-testid="teacher-summary">
           <button type="button" onClick={() => setExpandedSummaryRole((current) => current === 'teacher' ? null : 'teacher')} aria-expanded={expandedSummaryRole === 'teacher'} className="focus-ring flex w-full items-start justify-between gap-4 rounded-xl text-left"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--accent))]">{t('teacherStaff')}</p><h3 className="mt-2 font-serif text-3xl">{teachers.length}</h3><p className="mt-1 text-xs text-[hsl(var(--primary-foreground)/.65)]">{expandedSummaryRole === 'teacher' ? t('hideNames') : t('showNames')}</p></div><UsersRound className="text-[hsl(var(--accent))]" size={24} /></button>
            {expandedSummaryRole === 'teacher' && (teachers.length ? <div className="mt-5 flex flex-wrap gap-2">{teachers.map((teacher, index) => <button type="button" key={teacher.id} onClick={() => setViewingUser(teacher)} className="focus-ring rounded-full bg-[hsl(var(--primary-foreground)/.12)] px-3 py-1.5 text-xs font-semibold hover:bg-[hsl(var(--primary-foreground)/.22)]">{teacher.role === 'owner' ? t('systemOwner') : formatTeacherNumber(index)} · {adminUserName(teacher)}</button>)}</div> : <p className="mt-5 text-xs text-[hsl(var(--primary-foreground)/.65)]">{t('noTeachersYet')}</p>)}
         </section>
          <section className="order-1 rounded-2xl border border-[hsl(var(--secondary)/.75)] bg-[hsl(var(--secondary)/.48)] p-5 shadow-[var(--shadow-xs)]" data-testid="owner-assistant-summary">
           <button type="button" onClick={() => setExpandedSummaryRole((current) => current === 'assistant' ? null : 'assistant')} aria-expanded={expandedSummaryRole === 'assistant'} className="focus-ring flex w-full items-start justify-between gap-4 rounded-xl text-left"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">{t('roleBoard')}</p><h3 className="mt-2 font-serif text-3xl text-[hsl(var(--primary))]">{ownerAssistants.length}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{expandedSummaryRole === 'assistant' ? t('hideNames') : t('showNames')}</p></div><UserCog className="text-[hsl(var(--secondary-foreground))]" size={24} /></button>
            {expandedSummaryRole === 'assistant' && (ownerAssistants.length ? <div className="mt-5 flex flex-wrap gap-2">{ownerAssistants.map((assistant, index) => <button type="button" key={assistant.id} onClick={() => setViewingUser(assistant)} className="focus-ring rounded-full bg-[hsl(var(--muted))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--border))]">{formatOwnerAssistantNumber(index)} · {adminUserName(assistant)}</button>)}</div> : <p className="mt-5 text-xs text-[hsl(var(--muted-foreground))]">{t('noBoardYet')}</p>)}
         </section>
          <section className="order-3 rounded-2xl border border-[hsl(var(--accent)/.8)] bg-[hsl(var(--accent)/.22)] p-5 shadow-[var(--shadow-xs)]" data-testid="supervisor-summary">
           <button type="button" onClick={() => setExpandedSummaryRole((current) => current === 'supervisor' ? null : 'supervisor')} aria-expanded={expandedSummaryRole === 'supervisor'} className="focus-ring flex w-full items-start justify-between gap-4 rounded-xl text-left"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">{t('roleSupervisor')}</p><h3 className="mt-2 font-serif text-3xl text-[hsl(var(--primary))]">{supervisors.length}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{expandedSummaryRole === 'supervisor' ? t('hideNames') : t('showNames')}</p></div><ShieldCheck className="text-[hsl(var(--secondary-foreground))]" size={24} /></button>
            {expandedSummaryRole === 'supervisor' && (supervisors.length ? <div className="mt-5 flex flex-wrap gap-2">{supervisors.map((supervisor, index) => <button type="button" key={supervisor.id} onClick={() => setViewingUser(supervisor)} className="focus-ring rounded-full bg-[hsl(var(--muted))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--border))]">{formatSupervisorNumber(index)} · {adminUserName(supervisor)}</button>)}</div> : <p className="mt-5 text-xs text-[hsl(var(--muted-foreground))]">{t('noSupervisorsYet')}</p>)}
         </section>
       </div>
      <h3 id="user-role-management-list" className="pt-2 font-serif text-2xl text-[hsl(var(--primary))]">{t('manageRoles')}</h3>
       {canConfigurePermissions && <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPermissionRole('teacher')} className="focus-ring rounded-xl border border-[hsl(var(--border))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="button-configure-teacher-permissions">{t('setTeacherRoles')}</button>
        <button type="button" onClick={() => setPermissionRole('supervisor')} className="focus-ring rounded-xl border border-[hsl(var(--border))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="button-configure-supervisor-permissions">{t('setSupervisorRoles')}</button>
       </div>}
      <button type="button" disabled={!canConfigurePermissions} onClick={() => setPermissionRole('owner_assistant')} className="focus-ring rounded-xl border border-[hsl(var(--border))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-manage-owner-assistant-roles">{t('boardPerms')}</button>
      {users.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-7 text-center text-sm text-[hsl(var(--muted-foreground))]">{t('noUsersYet')}</p>
      ) : (
        <div className="space-y-3">
          {sortedUsers.map((user) => {
            const role = selectedRole(user);
            const isOwner = user.role === 'owner';
            const hasChange = !isOwner && role !== (user.role === 'admin' ? UserRoleUpdateInputRole.teacher : user.role);
            const studentNote = isOwner ? null : staffStudentNote(studentRecords[user.id], user.role, role);
            return (
              <article key={user.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[hsl(var(--primary))]">{adminUserName(user)}</p>
                    <p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{user.email}{user.username ? ` · @${user.username}` : ''}</p>
                  </div>
                 <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${roleBadgeClass(user.role)}`}>{isOwner ? `N1 · ${t('systemOwner')}` : user.role === 'owner_assistant' ? `${formatOwnerAssistantNumber(ownerAssistants.findIndex((assistant) => assistant.id === user.id))} · ${roleName(user.role)}` : user.role === 'teacher' || user.role === 'admin' ? `${formatTeacherNumber(teachers.findIndex((teacher) => teacher.id === user.id))} · ${roleName(user.role)}` : user.role === 'supervisor' ? `${formatSupervisorNumber(supervisors.findIndex((supervisor) => supervisor.id === user.id))} · ${roleName(user.role)}` : roleName(user.role)}</span>
                </div>
                {isOwner ? (
                  <p className="mt-4 text-xs font-semibold text-[hsl(var(--muted-foreground))]">{t('ownerLocked')}</p>
                ) : (
                  <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[hsl(var(--border))] pt-4">
                    <label className="min-w-48 flex-1">
                      <span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">{t('authority')}</span>
                      <select value={role} onChange={(event) => setDraftRoles((current) => ({ ...current, [user.id]: event.target.value as typeof role }))} className={inputClass} data-testid={`select-user-role-${user.id}`}>
                        <option value={UserRoleUpdateInputRole.owner_assistant} data-testid="option-role-owner-assistant">{t('roleBoard')}</option>
                        <option value={UserRoleUpdateInputRole.teacher}>{t('roleTeacher')}</option>
                        <option value={UserRoleUpdateInputRole.supervisor}>{t('roleSupervisor')}</option>
                        <option value={UserRoleUpdateInputRole.none}>{t('plainUser')}</option>
                      </select>
                    </label>
                     <div className="flex flex-wrap gap-2">
                       <button type="button" className={buttonClass} disabled={!hasChange || busyUserId === user.id} onClick={() => void saveRole(user)} data-testid={`button-save-user-role-${user.id}`}>
                         {busyUserId === user.id ? t('saving') : t('saveRole')}
                       </button>
                        {canConfigurePermissions && individualPermissionRole(user) && <button type="button" className="focus-ring rounded-xl border border-[hsl(var(--secondary)/.65)] px-3 py-2 text-xs font-bold text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary)/.2)]" onClick={() => { setPermissionUser(user); setIndividualPermissions([]); }} data-testid={`button-edit-individual-permissions-${user.id}`}>{t('individualPerms')}</button>}
                        <button type="button" className="focus-ring rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--card))]" onClick={() => setEditingUser(user)} data-testid={`button-edit-user-${user.id}`}>{t('editDetails')}</button>
                         {canConfigurePermissions && user.role === 'none' && <button type="button" className="focus-ring rounded-xl border border-[hsl(var(--destructive)/.28)] px-3 py-2 text-xs font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)] disabled:opacity-50" disabled={deletingUserId === user.id} onClick={() => void removeUser(user)} data-testid={`button-delete-user-${user.id}`}>{deletingUserId === user.id ? 'Silinir...' : 'Hesabı sil'}</button>}
                     </div>
                    {studentNote && <p className={`w-full rounded-lg px-3 py-2 text-[11px] leading-5 ${hasChange && user.role === 'none' ? 'bg-amber-50 text-amber-900' : 'bg-[hsl(var(--muted)/.6)] text-[hsl(var(--muted-foreground))]'}`} data-testid={`note-user-student-record-${user.id}`}>{studentNote}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      <FormNotice text={notice} error={notice.includes('bilmədi') || notice.includes('tapılmadı') || notice.includes('dəyişdirilə') || notice.includes(t('roleNotUpdated')) || notice.includes(t('permsNotSaved')) || notice.includes(t('individualNotSaved'))} />
      {permissionRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--primary)/.5)] px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="role-permissions-title">
          <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--secondary-foreground))]">{t('ownerPerms')}</p>
                <h4 id="role-permissions-title" className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{permissionRole === 'teacher' ? t('setTeacherRoles') : permissionRole === 'supervisor' ? t('setSupervisorRoles') : t('boardRoles')}</h4>
                 <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('permHint')}</p>
              </div>
              <button type="button" onClick={() => setPermissionRole(null)} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label={t('close')}><X size={18} /></button>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {(Object.entries(rolePermissionLabels) as Array<[RolePermissionKey, string]>)
                .filter(([key]) => permissionRole === 'owner_assistant' || (key !== 'teacherAssignment' && key !== 'userRoleManagement'))
                .map(([key]) => {
                const checked = rolePermissions[permissionRole].includes(key);
                return <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[hsl(var(--border))] px-3.5 py-3 text-sm font-semibold hover:bg-[hsl(var(--muted)/.5)]"><input type="checkbox" checked={checked} onChange={() => setRolePermissions((current) => ({ ...current, [permissionRole]: checked ? current[permissionRole].filter((item) => item !== key) : [...current[permissionRole], key] }))} className="h-4 w-4 accent-[hsl(var(--primary))]" />{permLabel(key)}</label>;
              })}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPermissionRole(null)} className="focus-ring rounded-xl px-4 py-2.5 text-xs font-bold text-[hsl(var(--muted-foreground))]">{t('cancel')}</button>
              <button type="button" disabled={isSavingPermissions} onClick={async () => {
                setIsSavingPermissions(true);
                try {
                  const response = await fetch(apiUrl('/admin/role-permissions'), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rolePermissions) });
                  const data = await response.json() as { error?: string };
                  if (!response.ok) throw new Error(data.error || t('permsNotSaved'));
                  setPermissionRole(null);
                  setNotice(t('permsSaved'));
                } catch (error) {
                  setNotice(error instanceof Error ? error.message : t('permsNotSaved'));
                } finally { setIsSavingPermissions(false); }
              }} className={buttonClass}>{isSavingPermissions ? t('saving') : t('savePerms')}</button>
            </div>
          </div>
        </div>
      )}
      {permissionUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--primary)/.5)] px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="individual-permissions-title">
          <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--secondary-foreground))]">{t('individualTitle')}</p>
                <h4 id="individual-permissions-title" className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{adminUserName(permissionUser)} · {permissionUser.role === 'teacher' ? t('roleTeacher') : permissionUser.role === 'supervisor' ? t('roleSupervisor') : t('roleBoard')}</h4>
                <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('individualHint')}</p>
              </div>
              <button type="button" onClick={() => setPermissionUser(null)} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label={t('close')}><X size={18} /></button>
            </div>
            {individualProfileQuery.isLoading ? <p className="mt-5 text-sm text-[hsl(var(--muted-foreground))]">{t('permsLoading')}</p> :
              individualProfileQuery.isError ? <p className="mt-5 rounded-xl bg-[hsl(var(--destructive)/.08)] p-3 text-sm font-semibold text-[hsl(var(--destructive))]">{t('permsLoadFail')}</p> :
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {(Object.entries(rolePermissionLabels) as Array<[RolePermissionKey, string]>).map(([key]) => {
                    const checked = individualPermissions.includes(key);
                    return <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[hsl(var(--border))] px-3.5 py-3 text-sm font-semibold hover:bg-[hsl(var(--muted)/.5)]"><input type="checkbox" checked={checked} onChange={() => setIndividualPermissions((current) => checked ? current.filter((item) => item !== key) : [...current, key])} className="h-4 w-4 accent-[hsl(var(--primary))]" />{permLabel(key)}</label>;
                  })}
                </div>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPermissionUser(null)} className="focus-ring rounded-xl px-4 py-2.5 text-xs font-bold text-[hsl(var(--muted-foreground))]">{t('cancel')}</button>
              <button type="button" disabled={isSavingIndividualPermissions || individualProfileQuery.isLoading || individualProfileQuery.isError} onClick={async () => {
                if (!permissionUser) return;
                setIsSavingIndividualPermissions(true);
                try {
                  const role = individualPermissionRole(permissionUser);
                  if (!role) return;
                  await updateRole.mutateAsync({ userId: permissionUser.id, data: { role, permissions: individualPermissions } });
                  await queryClient.invalidateQueries({ queryKey: getGetAdminUserProfileQueryKey(permissionUser.id) });
                  setPermissionUser(null);
                  setNotice(`${adminUserName(permissionUser)}: ${t('individualSaved')}`);
                } catch (error) {
                  setNotice(error instanceof Error ? error.message : t('individualNotSaved'));
                } finally { setIsSavingIndividualPermissions(false); }
              }} className={buttonClass}>{isSavingIndividualPermissions ? t('saving') : t('saveIndividual')}</button>
            </div>
          </div>
        </div>
      )}
      {editingUser && <UserProfileEditor user={editingUser} canViewHistory={canConfigurePermissions} onClose={() => setEditingUser(null)} onSaved={async () => { setEditingUser(null); await queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() }); }} />}
      {viewingUser && <UserProfileEditor user={viewingUser} canViewHistory={canConfigurePermissions} readOnly onClose={() => setViewingUser(null)} />}
    </div>
  );
}

function UserProfileManagement() {
  const usersQuery = useGetAdminUsers();
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  return <section className="space-y-4" data-testid="owner-user-profile-management">
    <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">İdarəetmə bölməsi</p><h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">İstifadəçi məlumatlarını düzəlt</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">İstifadəçilərin ad, əlaqə və müraciət məlumatlarını yeniləyin. Sistem sahibinin məlumatları qorunur.</p></div>
    {usersQuery.isLoading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">İstifadəçilər yüklənir...</p> : usersQuery.isError ? <p className="rounded-xl bg-[hsl(var(--destructive)/.08)] p-4 text-sm font-semibold text-[hsl(var(--destructive))]">İstifadəçilər yüklənə bilmədi.</p> : (usersQuery.data ?? []).length === 0 ? <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-7 text-center text-sm text-[hsl(var(--muted-foreground))]">Qeydiyyatdan keçmiş istifadəçi yoxdur.</p> : <div className="space-y-3">{(usersQuery.data ?? []).map((user) => <article key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)] p-4"><div className="min-w-0"><p className="truncate font-bold text-[hsl(var(--primary))]">{adminUserName(user)}</p><p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{user.email}</p></div><button type="button" disabled={user.role === 'owner'} onClick={() => setEditingUser(user)} className="focus-ring rounded-xl border border-[hsl(var(--border))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--card))] disabled:cursor-not-allowed disabled:opacity-50" data-testid={`button-edit-profile-${user.id}`}>{user.role === 'owner' ? 'Sahib hesabı qorunur' : 'Məlumatları düzəlt'}</button></article>)}</div>}
    {editingUser && <UserProfileEditor user={editingUser} onClose={() => setEditingUser(null)} onSaved={async () => { setEditingUser(null); await usersQuery.refetch(); }} />}
  </section>;
}

const userProfileHistoryFieldLabels: Record<string, string> = {
  firstName: 'Ad',
  lastName: 'Soyad',
  username: 'İstifadəçi adı',
  email: 'E-poçt',
  phone: 'Telefon',
  birthDate: 'Doğum tarixi',
  arabicLevel: 'Ərəb dili səviyyəsi',
};

function userProfileHistoryValue(value: string | null | undefined) {
  return value === null || value === undefined || value === '' ? '—' : value;
}

function UserProfileHistory({ userId }: { userId: string }) {
  const historyQuery = useGetAdminUserProfileHistory(userId, {
    query: { queryKey: getGetAdminUserProfileHistoryQueryKey(userId) },
  });
  const formatDate = (value: string) => new Intl.DateTimeFormat('az-AZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const entries = historyQuery.data ?? [];
  return (
    <section className="mt-5 rounded-xl border border-[hsl(var(--secondary)/.5)] bg-[hsl(var(--secondary)/.12)] p-4" data-testid="section-user-profile-history">
      <div className="flex items-start gap-2">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[hsl(var(--secondary-foreground))]" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--secondary-foreground))]">Profil dəyişikliklərinin tarixçəsi</p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Bu məlumatları yalnız sistem sahibi görə bilər.</p>
        </div>
      </div>
      {historyQuery.isLoading ? <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Tarixçə yüklənir...</p> :
        historyQuery.isError ? <p className="mt-4 rounded-lg bg-[hsl(var(--destructive)/.08)] p-3 text-xs font-semibold text-[hsl(var(--destructive))]">Profil tarixçəsi yüklənə bilmədi.</p> :
          entries.length === 0 ? <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Hələ profil dəyişikliyi qeydə alınmayıb.</p> :
            <div className="mt-4 space-y-3">{entries.map((entry: UserProfileHistoryEntry) => (
              <article key={entry.id} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3" data-testid={`user-profile-history-entry-${entry.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[hsl(var(--primary))]">{entry.actorName}</p>
                  <time className="text-[10px] text-[hsl(var(--muted-foreground))]" dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-xs">
                    <thead className="text-[10px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">
                      <tr><th className="pb-2 pr-3 font-bold">Məlumat</th><th className="pb-2 pr-3 font-bold">Əvvəlki dəyər</th><th className="pb-2 font-bold">Yeni dəyər</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">
                      {entry.changedFields.map((field) => <tr key={field}>
                        <th className="py-2 pr-3 font-semibold text-[hsl(var(--primary))]">{userProfileHistoryFieldLabels[field] ?? field}</th>
                        <td className="py-2 pr-3 text-[hsl(var(--muted-foreground))]">{userProfileHistoryValue(entry.previousValues[field])}</td>
                        <td className="py-2 font-semibold text-[hsl(var(--foreground))]">{userProfileHistoryValue(entry.newValues[field])}</td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}</div>}
    </section>
  );
}

function UserProfileEditor({ user, onClose, onSaved, readOnly = false, inline = false, canViewHistory = false }: { user: AdminUser; onClose: () => void; onSaved?: () => Promise<void>; readOnly?: boolean; inline?: boolean; canViewHistory?: boolean }) {
  const profileQuery = useGetAdminUserProfile(user.id);
  const updateProfile = useUpdateAdminUserProfile();
  const queryClient = useQueryClient();
  // Clerk panelindən birbaşa yaradılmış heyət hesabı: müraciət (tələbə profili) yoxdur — telefon, doğum tarixi və səviyyə saxlanılmır.
  const staffOnly = profileQuery.data?.hasApplication === false;
  const [form, setForm] = useState<AdminUserProfileInput>({
    firstName: '', lastName: '', username: null, email: '', phone: '', birthDate: '', arabicLevel: 'Orta',
  });
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!profileQuery.data) return;
    setForm({
      firstName: profileQuery.data.firstName,
      lastName: profileQuery.data.lastName,
      username: profileQuery.data.username,
      email: profileQuery.data.email,
      phone: profileQuery.data.phone,
      birthDate: profileQuery.data.birthDate,
      arabicLevel: profileQuery.data.arabicLevel,
    });
  }, [profileQuery.data]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    try {
      await updateProfile.mutateAsync({ userId: user.id, data: staffOnly ? { ...form, phone: '', birthDate: '', arabicLevel: 'Orta' } : form });
      // Ad müəllim seçicilərində, qruplarda və cədvəllərdə də dərhal yenilənsin.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetAdminUserProfileQueryKey(user.id) }),
        queryClient.invalidateQueries({ queryKey: getGetAdminTeachersQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() }),
      ]);
       await onSaved?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'İstifadəçi məlumatları yadda saxlanılmadı.');
    }
  };
  return <div className={inline ? 'mt-4 rounded-xl border-2 border-[hsl(var(--accent)/.65)] bg-[hsl(var(--accent)/.12)] p-4' : 'fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--primary)/.5)] px-4 py-6 backdrop-blur-sm'} role="dialog" aria-modal={!inline} aria-labelledby="user-profile-editor-title">
    <form onSubmit={(event) => void submit(event)} className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-4">
         <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--secondary-foreground))]">İstifadəçi məlumatları</p><h4 id="user-profile-editor-title" className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{readOnly ? 'Məlumatlara baxış' : 'Məlumatları düzəlt'}</h4><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{readOnly ? 'Bu məlumatlar yalnız görüntüləmə üçündür.' : 'Ad, əlaqə və müraciət məlumatlarını yeniləyin. Rol bu bölmədən dəyişdirilmir.'}</p></div>
        <button type="button" onClick={onClose} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Bağla"><X size={18} /></button>
      </div>
      {profileQuery.isLoading ? <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">Məlumatlar yüklənir...</p> : profileQuery.isError ? <p className="mt-6 rounded-xl bg-[hsl(var(--destructive)/.08)] p-3 text-sm font-semibold text-[hsl(var(--destructive))]">İstifadəçi məlumatları yüklənə bilmədi.</p> : <div className="mt-5 grid gap-4 sm:grid-cols-2">
         <Field label="Ad"><input required={!readOnly} disabled={readOnly} className={inputClass} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></Field>
         <Field label="Soyad"><input required={!readOnly} disabled={readOnly} className={inputClass} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></Field>
         <Field label="E-poçt"><input required={!readOnly} disabled={readOnly} type="email" className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
         {staffOnly
           ? <p className="rounded-xl bg-[hsl(var(--muted)/.6)] p-3 text-xs leading-5 text-[hsl(var(--muted-foreground))] sm:col-span-2" data-testid="text-profile-staff-only">Bu hesabın tələbə müraciəti yoxdur (məsələn, Clerk panelindən yaradılmış müəllim hesabı). Burada ad, soyad və e-poçt dəyişdirilir; ad rol kartlarında, müəllim seçicilərində, cədvəllərdə və AI-da göstərilir.</p>
           : <>
         <Field label="Telefon"><input required={!readOnly} disabled={readOnly} className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+994501234567" /></Field>
         <Field label="Doğum tarixi"><input required={!readOnly} disabled={readOnly} type="date" className={inputClass} value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></Field>
         <Field label="Ərəb dili səviyyəsi"><select required={!readOnly} disabled={readOnly} className={inputClass} value={form.arabicLevel} onChange={(event) => setForm({ ...form, arabicLevel: event.target.value as AdminUserProfileInput['arabicLevel'] })}><option value="Zəif">Zəif</option><option value="Orta">Orta</option><option value="Yaxşı">Yaxşı</option><option value="Əla">Əla</option></select></Field>
           </>}
      </div>}
       {canViewHistory && <UserProfileHistory userId={user.id} />}
      {notice && <p className="mt-4 rounded-xl bg-[hsl(var(--destructive)/.08)] p-3 text-sm font-semibold text-[hsl(var(--destructive))]">{notice}</p>}
       <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="focus-ring rounded-xl px-4 py-2.5 text-xs font-bold text-[hsl(var(--muted-foreground))]">{readOnly ? 'Bağla' : 'Ləğv et'}</button>{!readOnly && <button type="submit" disabled={profileQuery.isLoading || profileQuery.isError || updateProfile.isPending} className={buttonClass}>{updateProfile.isPending ? 'Yadda saxlanılır...' : 'Dəyişiklikləri yadda saxla'}</button>}</div>
    </form>
  </div>;
}

function StudentDeletionAudit() {
  const auditQuery = useGetAdminStudentDeletionAudit({ query: { queryKey: getGetAdminStudentDeletionAuditQueryKey() } });
  const formatDate = (value: string) => new Intl.DateTimeFormat('az-AZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  return (
    <section className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5" data-testid="student-deletion-audit">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">Audit tarixçəsi</p>
        <h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Silinmiş tələbələr</h3>
      </div>
      {auditQuery.isLoading ? <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Tarixçə yüklənir...</p> :
        auditQuery.isError ? <p className="mt-4 text-sm font-semibold text-[hsl(var(--destructive))]">Silinmə tarixçəsi yüklənə bilmədi.</p> :
        auditQuery.data?.length ? <div className="mt-4 space-y-3">{auditQuery.data.map((entry) => <article key={entry.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.3)] p-4">
          <div className="flex flex-wrap justify-between gap-2"><p className="font-bold text-[hsl(var(--primary))]">{entry.studentName}</p><time className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(entry.deletedAt)}</time></div>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{entry.email} · Silən: {entry.deletedByName}</p>
          <p className="mt-3 text-sm leading-6">{entry.reason}</p>
        </article>)}</div> :
        <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Hələ silinmiş tələbə yoxdur.</p>}
    </section>
  );
}

function ApplicationWindowSettings() {
  const query = useGetAdminApplicationWindow();
  const updateWindow = useUpdateAdminApplicationWindow();
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!query.data) return;
    const toLocal = (value: string | null) => {
      if (!value) return '';
      const date = new Date(value);
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: azerbaijanTimeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
        result[part.type] = part.value;
        return result;
      }, {});
      return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
    };
    setOpensAt(toLocal(query.data.opensAt));
    setClosesAt(toLocal(query.data.closesAt));
  }, [query.data]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    if ((opensAt && !closesAt) || (!opensAt && closesAt)) {
      setNotice('Başlama və bitmə vaxtlarını birlikdə daxil edin.');
      return;
    }
    const opensDate = opensAt ? parseAzerbaijanDateTime(opensAt) : null;
    const closesDate = closesAt ? parseAzerbaijanDateTime(closesAt) : null;
    if (opensDate && closesDate && closesDate.getTime() <= opensDate.getTime()) {
      setNotice('Bitmə vaxtı başlama vaxtından sonra olmalıdır.');
      return;
    }
    try {
      await updateWindow.mutateAsync({
        data: {
          opensAt: opensDate?.toISOString() ?? null,
          closesAt: closesDate?.toISOString() ?? null,
        },
      });
      await query.refetch();
      setNotice('Müraciət vaxtı yadda saxlanıldı.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Müraciət vaxtı yadda saxlanılmadı.');
    }
  };

  const statusLabel = query.data?.status === 'open'
    ? 'Hazırda açıqdır'
    : query.data?.status === 'not_started'
    ? 'Başlamayıb'
    : query.data?.status === 'ended'
    ? 'Bitib'
    : 'Vaxt təyin edilməyib';

  return (
    <section className="mb-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] p-4" data-testid="section-application-window">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--secondary-foreground))]">Müraciət vaxtı</p><h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Qəbul pəncərəsini idarə et</h3></div>
        <span className="rounded-full bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]">{query.isLoading ? 'Yüklənir...' : statusLabel}</span>
      </div>
      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void save(event)}>
        <Field label="Başlama tarixi və vaxtı (Azərbaycan vaxtı)"><input type="datetime-local" className={inputClass} value={opensAt} onChange={(event) => setOpensAt(event.target.value)} data-testid="input-application-window-opens" /></Field>
        <Field label="Bitmə tarixi və vaxtı (Azərbaycan vaxtı)"><input type="datetime-local" className={inputClass} value={closesAt} onChange={(event) => setClosesAt(event.target.value)} data-testid="input-application-window-closes" /></Field>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button type="submit" disabled={updateWindow.isPending} className={buttonClass} data-testid="button-save-application-window">{updateWindow.isPending ? 'Yadda saxlanılır...' : 'Vaxtı yadda saxla'}</button>
          <button type="button" onClick={() => { setOpensAt(''); setClosesAt(''); }} className="focus-ring rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--muted-foreground))]">Vaxtı təmizlə</button>
          {notice && <p className="text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{notice}</p>}
        </div>
      </form>
      <p className="mt-3 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">Vaxt təyin edilmədikdə müraciətlər əvvəlki kimi açıq qalır. Bütün tarix və saatlar Azərbaycan vaxtı ilə (UTC+4) hesablanır.</p>
    </section>
  );
}

type PanelPreviewRole = 'owner_assistant' | 'teacher' | 'supervisor' | 'user';

function PanelPreview({ role, ownerName, onClose }: { role: PanelPreviewRole; ownerName: string; onClose: () => void }) {
  const details: Record<PanelPreviewRole, { label: string; title: string; description: string }> = {
    owner_assistant: { label: 'İdarə heyəti paneli', title: 'İdarə heyətinin ana səhifəsi', description: 'Bu görünüş idarə heyətinə açılan icazələrə uyğun idarəetmə sahəsini yoxlamaq üçündür.' },
    teacher: { label: 'Müəllim paneli', title: 'Müəllimin ana səhifəsi', description: 'Müəllimin cədvəl, tələbə əlaqəsi və sual-cavab bölmələrini yoxlayın.' },
    supervisor: { label: 'Nəzarətçi paneli', title: 'Nəzarətçinin ana səhifəsi', description: 'Nəzarətçinin tələbə və müraciət nəzarəti görünüşünü yoxlayın.' },
    user: { label: 'İstifadəçi paneli', title: 'İstifadəçinin ana səhifəsi', description: 'Tələbənin dərs cədvəli, elanlar və şəxsi məlumat görünüşünü yoxlayın.' },
  };
  const current = details[role];
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[hsl(var(--background))]" data-testid={`panel-preview-${role}`}>
      <header className="sticky top-0 z-10 border-b border-[hsl(var(--border))] bg-[hsl(var(--card)/.95)] px-5 py-4 backdrop-blur md:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">Önizləmə</p><h1 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{current.title}</h1></div>
          <button type="button" onClick={onClose} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="button-close-panel-preview"><X size={16} /> Sahib panelinə qayıt</button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-7 md:px-10">
        <section className="rounded-2xl bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-sm)]">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--accent))]">{current.label}</p>
          <h2 className="mt-3 max-w-2xl font-serif text-4xl leading-tight">{current.title}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[hsl(var(--primary-foreground)/.75)]">{current.description}</p>
        </section>
        <div className="mt-5 grid gap-5 lg:grid-cols-[190px_1fr_250px]">
          <nav className="h-fit rounded-2xl bg-[hsl(var(--sidebar))] p-3 text-[hsl(var(--sidebar-foreground))]" aria-label={`${current.label} menyusu`}>
            <p className="px-3 py-3 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--sidebar-foreground)/.5)]">Menyu</p>
            {(role === 'user' ? ['İcmal', 'Profilim', 'Dərs Cədvəlim', 'Yeniliklər'] : role === 'teacher' ? ['İcmal', 'Mənim cədvəlim', 'Müəllimlər cədvəli', 'Məsləhətləşmə / Əlaqə', 'Sual-cavab'] : role === 'supervisor' ? ['İcmal', 'Tələbələr', 'Müraciətlər', 'Elanlar', 'Semestr cədvəli'] : ['İcmal', 'Müraciətlər', 'Semestr cədvəli', 'İstifadəçi rolları', 'Məsləhətləşmə / Əlaqə']).map((item, index) => <div key={item} className={`rounded-xl px-3 py-3 text-xs font-semibold ${index === 0 ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.68)]'}`}>{item}</div>)}
          </nav>
          <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-xs)]">
            <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">İcmal</p><h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{current.title}</h3></div><Eye className="text-[hsl(var(--secondary-foreground))]" size={20} /></div>
            {role === 'teacher' && <><p className="mb-4 text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Müəllim görünüşü</p><TeacherSchedule ownerName={ownerName} /></>}
            {role === 'owner_assistant' && <><p className="mb-4 text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">İdarə heyəti görünüşü</p><div className="grid gap-3 sm:grid-cols-2"><PreviewCard title="Müraciətlər" text="Tələbə müraciətlərinə baxış" /><PreviewCard title="Semestr cədvəli" text="Dərs və materiallara nəzarət" /><PreviewCard title="Müəllim təyinatı" text="Açıq icazələrə əsasən" /><PreviewCard title="Mesajlar" text="Tələbə və müəllimlərlə əlaqə" /></div></>}
            {role === 'supervisor' && <><p className="mb-4 text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Nəzarətçi görünüşü</p><div className="grid gap-3 sm:grid-cols-2"><PreviewCard title="Tələbələr" text="Akademik məlumatlara baxış" /><PreviewCard title="Müraciətlər" text="Qəbul prosesini izləyin" /><PreviewCard title="Elanlar" text="Akademiya yenilikləri" /></div></>}
            {role === 'user' && <><p className="mb-4 text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">İstifadəçi görünüşü</p><div className="grid gap-3 sm:grid-cols-2"><PreviewCard title="Dərs Cədvəlim" text="Fənlər və materiallar" /><PreviewCard title="Həftəlik cədvəl" text="Gündəlik dərslərə baxış" /><PreviewCard title="Yeniliklər" text="Elan və məqalələr" /><PreviewCard title="Profilim" text="Şəxsi məlumatlar" /></div></>}
          </section>
          <aside className="space-y-4">
            <div className="rounded-2xl bg-[hsl(var(--accent)/.35)] p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">Yoxlama qeydi</p><p className="mt-3 text-sm leading-6 text-[hsl(var(--primary))]">Bu görünüş seçilmiş rolun ana səhifəsini tam quruluşda yoxlamaq üçündür. Real istifadəçi icazələri dəyişdirilmir.</p></div>
            <PreviewCard title="Bildirişlər" text="Yeni elan və müraciət məlumatları" />
            <PreviewCard title="Məsləhətləşmə / Əlaqə" text="İstifadəçilərlə əlaqə bölməsi" />
          </aside>
        </div>
      </main>
    </div>
  );
}

function PreviewCard({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)] p-4"><p className="font-bold text-[hsl(var(--primary))]">{title}</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{text}</p></div>;
}

type AdminSearchResult = {
  kind: 'student' | 'application' | 'course';
  id: string;
  title: string;
  subtitle: string;
  profileId?: number | null;
};

function AdminGlobalSearch({ onSelectStudent }: { onSelectStudent: (profileId: number) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(`${apiUrl('/admin/search')}?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('Axtarış baş tutmadı.');
          return response.json() as Promise<AdminSearchResult[]>;
        })
        .then(setResults)
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, query]);

  return <>
    <button type="button" onClick={() => setOpen(true)} className="focus-ring inline-flex shrink-0 items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="button-open-admin-search" aria-label="Qlobal axtarış">
      <Search size={15} /><span className="hidden sm:inline">Axtar</span><kbd className="hidden rounded-md bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] sm:inline">Ctrl K</kbd>
    </button>
    {open && <div className="fixed inset-0 z-[70] overflow-y-auto bg-[hsl(var(--primary)/.45)] p-3 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Qlobal axtarış" data-testid="admin-global-search">
      <div className="mx-auto mt-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-lg)] sm:mt-[10vh]">
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 sm:gap-3 sm:px-4">
          <Search size={18} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-4 text-sm font-semibold outline-none" placeholder="Tələbə, müraciət və ya dərs axtar..." data-testid="input-admin-global-search" />
          <button type="button" onClick={() => setOpen(false)} className="focus-ring shrink-0 rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Axtarışı bağla"><X size={18} /></button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-3">
          {!query.trim() && <p className="p-5 text-center text-sm text-[hsl(var(--muted-foreground))]">Axtarış üçün ən azı iki simvol yazın.</p>}
          {query.trim().length >= 2 && loading && <p className="p-5 text-center text-sm text-[hsl(var(--muted-foreground))]">Axtarılır...</p>}
          {query.trim().length >= 2 && !loading && !results.length && <p className="p-5 text-center text-sm text-[hsl(var(--muted-foreground))]">Uyğun nəticə tapılmadı.</p>}
          {results.map((result) => <button key={result.id} type="button" onClick={() => { if (result.kind === 'student' && result.profileId) onSelectStudent(result.profileId); setOpen(false); }} className="focus-ring flex w-full min-w-0 items-start gap-3 rounded-xl p-3 text-left hover:bg-[hsl(var(--muted)/.55)]" data-testid={`admin-search-result-${result.kind}`}>
            <span className="mt-0.5 shrink-0 rounded-lg bg-[hsl(var(--secondary)/.65)] px-2 py-1 text-[10px] font-black uppercase text-[hsl(var(--secondary-foreground))]">{result.kind === 'student' ? 'Tələbə' : result.kind === 'application' ? 'Müraciət' : 'Dərs'}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[hsl(var(--primary))]">{result.title}</span><span className="mt-1 block truncate text-xs text-[hsl(var(--muted-foreground))]">{result.subtitle}</span></span>
          </button>)}
        </div>
      </div>
    </div>}
  </>;
}

export function AdminPanel() {
  const { t: tr, locale, dir } = useI18n();
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab | null>('schedule');
  // «Qruplar» bölməsinin alt bölməsi: «2 Tələbələr» və ya «3 Müəllimlər» (addım göstəricisi birbaşa açır).
  const [groupsView, setGroupsView] = useState<GroupsView>('students');
  const [focusStudentId, setFocusStudentId] = useState<number | null>(null);
  const [unansweredQuestionCount, setUnansweredQuestionCount] = useState(0);
  useEffect(() => {
    void loadUnansweredQuestionCount().then(setUnansweredQuestionCount);
  }, []);
  const [isAnnouncementListOpen, setIsAnnouncementListOpen] = useState(false);
  const [decisionBusyId, setDecisionBusyId] = useState<number | null>(null);
  const [teacherBusyId, setTeacherBusyId] = useState<number | null>(null);
  const [decisionNotice, setDecisionNotice] = useState('');
  const [readExcuseIds, setReadExcuseIds] = useState<number[]>(() => {
    try { return JSON.parse(window.localStorage.getItem('medine-read-attendance-excuses') || '[]') as number[]; } catch { return []; }
  });
  const accountProfileQuery = useGetOwnUserProfile({ query: { enabled: Boolean(user), queryKey: getGetOwnUserProfileQueryKey(), ...accountProfileQueryRetry } });
  const profileName = [accountProfileQuery.data?.firstName, accountProfileQuery.data?.lastName].filter(Boolean).join(' ').trim();
  const firstName = user?.firstName || accountProfileQuery.data?.firstName || user?.username || 'Hesab';
  const owner = accountProfileQuery.data?.role === 'owner' || isSystemOwner(user);
  const metadataRole = typeof user?.publicMetadata === 'object' && user.publicMetadata !== null && 'role' in user.publicMetadata && typeof user.publicMetadata.role === 'string' ? user.publicMetadata.role : '';
  const activeRole = accountProfileQuery.data?.role ?? metadataRole;
  const ownerAssistant = activeRole === 'owner_assistant';
  const rolePermissions = new Set(accountProfileQuery.data?.rolePermissions ?? []);
  // Only fire the admin list requests the server will actually allow for this
  // account (mirrors permissionForAdminRequest/requireTeacher on the API; note
  // /admin/attendance-excuses resolves to the 'attendance' permission there), so a
  // teacher whose permissions were narrowed does not trigger 403 responses.
  // If the profile itself could not be loaded, fall back to the previous behaviour
  // (let the server decide) instead of leaving the panel empty.
  const permissionsUnknown = accountProfileQuery.isError;
  const canRead = (permission: string) => Boolean(user) && (owner || permissionsUnknown || rolePermissions.has(permission));
  const canReadResources = canRead('schedule') || (Boolean(user) && ownerAssistant && rolePermissions.has('assignments'));
  const resourcesQuery = useGetAdminResources({ query: { enabled: canReadResources, queryKey: getGetAdminResourcesQueryKey() } });
  const articlesQuery = useGetAdminArticles({ query: { enabled: canRead('articles'), queryKey: getGetAdminArticlesQueryKey() } });
  const dailyBenefitsQuery = useGetAdminDailyBenefits({ query: { enabled: canRead('dailyBenefits'), queryKey: getGetAdminDailyBenefitsQueryKey() } });
  const applicationsQuery = useGetAdminApplications({ query: { enabled: canRead('applications'), queryKey: getGetAdminApplicationsQueryKey() } });
  const academicProfilesQuery = useGetAdminAcademicProfiles({ query: { enabled: canRead('students'), queryKey: getGetAdminAcademicProfilesQueryKey() } });
  const articles = articlesQuery.data ?? [];
  const dailyBenefits = dailyBenefitsQuery.data ?? [];
  const excusesQuery = useGetAdminAttendanceExcuses({ query: { enabled: canRead('attendance'), queryKey: getGetAdminAttendanceExcusesQueryKey() } });
  const subjectRequestsQuery = useGetAdminSubjectRemovalRequests({ query: { enabled: canRead('applications'), queryKey: getGetAdminSubjectRemovalRequestsQueryKey() } });
  const pendingSubjectRequestCount = subjectRequestsQuery.data?.filter((item) => item.status === 'pending').length ?? 0;
  const pendingExcuseCount = excusesQuery.data?.filter((item) => item.status === 'pending' && !readExcuseIds.includes(item.id)).length ?? 0;
  const pendingApplicationCount = applicationsQuery.data?.filter((item) => item.status === 'pending').length ?? 0;
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  useEffect(() => {
    // Wait until Clerk is ready so the first poll carries a valid session token
    // (an early request with a stale cookie used to answer 401).
    if (!authLoaded || !isSignedIn) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await authFetch(apiUrl('/messages/unread-count'), { cache: 'no-store' });
        if (!response.ok) return;
        const result = await response.json() as { count: number };
        if (active && typeof result.count === 'number') setUnreadMessageCount(result.count);
      } catch { /* keep the previous count */ }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [authLoaded, isSignedIn]);
  const clerkFullName = user?.fullName?.trim() || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const configuredOwnerName = import.meta.env.VITE_SYSTEM_OWNER_NAME?.trim();
  const ownerName = configuredOwnerName && configuredOwnerName !== 'SYSTEM_OWNER_NAME' && configuredOwnerName !== 'VITE_SYSTEM_OWNER_NAME' ? configuredOwnerName : '';
  const displayName = owner ? (ownerName || profileName || clerkFullName || firstName) : (profileName || clerkFullName || firstName);
  const fullName = owner
    ? (ownerName || profileName || clerkFullName || firstName)
    : (profileName || clerkFullName || firstName);
  const canManageAssignments = owner || rolePermissions.has('assignments') && (activeRole === 'teacher' || activeRole === 'admin' || activeRole === 'owner_assistant');
  const canEditCourseContent = owner || rolePermissions.has('schedule') || activeRole === 'teacher' || activeRole === 'admin';
  const adminExamsQuery = useGetAdminExams({ query: { enabled: authLoaded && Boolean(isSignedIn) && canManageAssignments, queryKey: getGetAdminExamsQueryKey(), refetchInterval: 120_000 } });
  const pendingExamReviewCount = canManageAssignments ? (adminExamsQuery.data ?? []).reduce((sum, exam) => sum + (exam.pendingReviewCount ?? 0), 0) : 0;
  const accountCode = owner ? 'N1' : (typeof user?.publicMetadata === 'object' && user.publicMetadata !== null && 'staffNumber' in user.publicMetadata && typeof user.publicMetadata.staffNumber === 'string' ? user.publicMetadata.staffNumber : metadataRole === 'owner_assistant' ? 'NK1' : metadataRole === 'supervisor' ? 'B001' : 'M01');
  const scrollTabRef = useRef<Tab | null>(null);
  const toggleTab = (nextTab: Tab) => {
    const next = tab === nextTab ? null : nextTab;
    scrollTabRef.current = next;
    setTab(next);
  };
  useEffect(() => {
    if (!tab || scrollTabRef.current !== tab) return;
    scrollTabRef.current = null;
    revealTileAndPanel(`tab-admin-${tab}`, `panel-admin-${tab}`);
  }, [tab]);
  const onLogout = () => void signOut({ redirectUrl: import.meta.env.BASE_URL || '/' });
  const decideApplication = async (application: Application, status: 'approved' | 'rejected', rejectionReason?: string) => {
    setDecisionBusyId(application.id);
    setDecisionNotice('');
    try {
      const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/admin/applications/${application.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rejectionReason }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Qərar tətbiq edilə bilmədi.');
      setDecisionNotice(status === 'approved' ? 'Müraciət təsdiqləndi və tələbəyə Gmail mesajı göndərildi.' : 'İmtina səbəbi tələbəyə Gmail ilə göndərildi.');
      await applicationsQuery.refetch();
    } catch (error) {
      setDecisionNotice(error instanceof Error ? error.message : 'Qərar tətbiq edilə bilmədi.');
    } finally {
      setDecisionBusyId(null);
    }
  };
  const assignApplicationTeacher = async (application: Application) => {
    setTeacherBusyId(application.id);
    setDecisionNotice('');
    try {
      const response = await fetch(apiUrl(`/admin/applications/${application.id}/teacher-role`), { method: 'POST' });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Müraciətçiyə müəllim rolu verilə bilmədi.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminTeachersQueryKey() }),
      ]);
      setDecisionNotice(`${application.firstName} ${application.lastName} müəllim təyin edildi.`);
    } catch (error) {
      setDecisionNotice(error instanceof Error ? error.message : 'Müraciətçiyə müəllim rolu verilə bilmədi.');
    } finally {
      setTeacherBusyId(null);
    }
  };

  const renderTabContent = (t: Tab): ReactNode => [
    t === 'student-notifications' && rolePermissions.has('announcements') && <StudentNotificationForm />,
    t === 'exams' && canManageAssignments && <AdminExamsSection resources={resourcesQuery.data ?? []} teacherClerkUserId={activeRole === 'teacher' || activeRole === 'admin' ? user?.id : undefined} owner={owner} />,
    t === 'course-activation' && (owner || ownerAssistant) && <CourseActivationSettings />,
    t === 'groups' && canEditCourseContent && <GroupManagementSection view={groupsView} onViewChange={setGroupsView} onOpenSchedule={(owner || ownerAssistant || activeRole === 'admin') ? () => { scrollTabRef.current = 'schedule-prep'; setTab('schedule-prep'); } : undefined} />,
    t === 'announcement' && <><button type="button" onClick={() => setIsAnnouncementListOpen((current) => !current)} aria-expanded={isAnnouncementListOpen} className="focus-ring mb-5 inline-flex items-center gap-2.5 rounded-xl border border-[hsl(var(--border))] px-5 py-3.5 text-sm font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="button-existing-announcements"><Megaphone size={18} /> {tr('existingAnnouncements')}</button>{isAnnouncementListOpen && <AnnouncementList />}<AnnouncementForm onSaved={() => setLocation('/admin')} /></>,
    t === 'article' && <ArticleForm />,
    t === 'benefit' && <DailyBenefitForm />,
    t === 'application' && <>{(owner || ownerAssistant) && <ApplicationWindowSettings />}<ApplicationList applications={applicationsQuery.data ?? []} isLoading={applicationsQuery.isLoading} busyId={decisionBusyId} onDecision={decideApplication} canDecide={!ownerAssistant} canAssignTeacher={owner || ownerAssistant} onAssignTeacher={assignApplicationTeacher} teacherBusyId={teacherBusyId} />{decisionNotice && <p className="mt-4 rounded-xl bg-[hsl(var(--secondary)/.35)] p-3 text-sm font-semibold text-[hsl(var(--secondary-foreground))]">{decisionNotice}</p>}</>,
    t === 'student-management' && <StudentManagementSection pendingSubjectRequestCount={pendingSubjectRequestCount} pendingExcuseCount={pendingExcuseCount} onReadExcuses={() => setReadExcuseIds(excusesQuery.data?.map((item) => item.id) ?? [])} canViewDeletedStudents={owner} canGraduate={owner} resources={resourcesQuery.data ?? []} canManageAssignments={canManageAssignments} assignmentTeacherClerkUserId={activeRole === 'teacher' || activeRole === 'admin' ? user?.id : undefined} focusStudentId={focusStudentId} />,
    t === 'users' && (owner || ownerAssistant) && <RoleManagement canConfigurePermissions={owner} />,
    t === 'statistics' && owner && <><AnalyticsDashboard applications={applicationsQuery.data ?? []} profiles={academicProfilesQuery.data ?? []} resources={resourcesQuery.data ?? []} onRefresh={() => { void Promise.all([applicationsQuery.refetch(), academicProfilesQuery.refetch(), resourcesQuery.refetch()]); }} /><SystemStatisticsSettings /><StudentAiExternalSettings /></>,
    t === 'audit-history' && owner && <AuditHistory />,
    t === 'graduation-certificates' && (owner || ownerAssistant) && <GraduateCertificateSection canRevoke={owner} />,
    t === 'schedule-prep' && (owner || ownerAssistant || activeRole === 'admin') && <SchedulePrepSection onOpenStudents={() => { setGroupsView('students'); scrollTabRef.current = 'groups'; setTab('groups'); }} onOpenTeachers={() => { setGroupsView('teachers'); scrollTabRef.current = 'groups'; setTab('groups'); }} />,
    t === 'library' && <MedreseLibrary canManage={owner || ownerAssistant || activeRole === 'admin'} />,
    t === 'schedule' && <TeacherSchedule ownerName={fullName} onOpenGroups={canEditCourseContent ? () => { setGroupsView('students'); scrollTabRef.current = 'groups'; setTab('groups'); } : undefined} />,
    t === 'teachers-schedule' && <TeachersSchedule ownerName={fullName} />,
    t === 'messages' && <MessageCenter staff />,
    t === 'questions' && <QaCenter canAnswer onUnansweredCountChange={setUnansweredQuestionCount} />,
  ].find(Boolean) || null;
  // Tabs shown as pills under the tile grid; their panel opens right under that row.
  const pillTabs: Tab[] = ['schedule', 'teachers-schedule', 'messages', 'questions'];
  // Filled while the tile grid renders, so a section opened without a visible tile
  // (e.g. from the global search) still gets a panel right under the grid.
  const tileTabsRendered = new Set<Tab>();
  const inlinePanel = (value: Tab) => {
    tileTabsRendered.add(value);
    if (tab !== value) return null;
    const content = renderTabContent(value);
    return content ? <InlineSectionPanel id={`panel-admin-${value}`}>{content}</InlineSectionPanel> : null;
  };

  return (
    <div dir={dir} className={`grain min-h-[100dvh] overflow-x-hidden bg-[hsl(var(--background))]${locale === 'ar' ? ' font-ar' : ''}`}>
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <Link href="/user-portal" className="focus-ring flex min-w-0 items-center gap-2.5 rounded-xl" data-testid="link-admin-back">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--accent))] font-serif text-lg font-bold text-[hsl(var(--primary))]">M</div>
             <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">{tr('academyShort')}</p><p className="truncate text-sm font-bold leading-tight text-[hsl(var(--primary))]">{owner ? tr('adminOwner') : ownerAssistant ? tr('adminBoard') : activeRole === 'supervisor' ? tr('adminSupervisor') : tr('adminTeacher')}</p></div>
          </Link>
          <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
            <HomeLink compact />
            <ArticlesLink compact />
             <AdminGlobalSearch onSelectStudent={(profileId) => { setFocusStudentId(profileId); scrollTabRef.current = 'student-management'; setTab('student-management'); }} />
             <span className="hidden max-w-52 items-center gap-2 truncate rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))] sm:inline-flex">{owner ? 'N1 · ' : ownerAssistant ? 'NK1 · ' : ''}{displayName} <ChevronDown size={14} className="text-[hsl(var(--muted-foreground))]" /></span>
             <LanguageSwitch />
             <button type="button" onClick={onLogout} className="focus-ring inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))]" aria-label={tr('logout')} data-testid="button-admin-logout"><LogOut size={15} /> <span className="hidden sm:inline">{tr('logout')}</span></button>
          </div>
        </div>
      </header>
       <div className="mx-auto min-w-0 max-w-6xl px-4 pt-5 md:px-8">
         <section className="flex flex-wrap items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 shadow-[var(--shadow-xs)] sm:gap-5 sm:px-4" data-testid="section-admin-account">
           <div className="flex min-w-0 items-center gap-2.5">
             <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[hsl(var(--border))] font-serif text-xs font-bold text-[hsl(var(--primary))]">{accountCode}</div>
             <div className="min-w-0">
               <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">{tr('accountInfo')}</p>
               <p className="truncate font-bold text-[hsl(var(--primary))]">{fullName}</p>
             </div>
           </div>
           <div className="sm:ms-auto sm:border-s sm:border-[hsl(var(--border))] sm:ps-6">
             <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">{tr('accountCode')}</p>
             <p className="mt-0.5 text-lg font-bold text-[hsl(var(--primary))]">{accountCode}</p>
           </div>
           <div className="sm:border-s sm:border-[hsl(var(--border))] sm:ps-6">
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">{tr('accountStatus')}</p>
               <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-[hsl(var(--primary))]"><span className="h-2 w-2 rounded-full bg-emerald-500" />{owner ? tr('systemOwner') : ownerAssistant ? tr('roleBoard') : metadataRole === 'supervisor' ? tr('roleSupervisor') : tr('roleTeacher')}</p>
           </div>
         </section>
       </div>
      <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 md:px-8">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-xl font-bold tracking-wide text-[hsl(var(--primary))]"><ShieldCheck size={20} /> {tr('adminArea')}</p>
          {!owner && <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{tr('adminAreaHint')}</p>}
        </div>
        <TeacherStats canEdit={owner || ownerAssistant} canReadProfiles={canRead('students')} />
        <section className="mt-5 min-w-0 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-[var(--shadow-sm)] sm:p-4">
           <h2 className="mb-3 flex items-center gap-2 font-serif text-2xl leading-none tracking-[-.03em] text-[hsl(var(--primary))]"><ShieldCheck size={18} /> {tr('adminPanel')}</h2>
            <div className="grid grid-flow-row-dense grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
                  {([['announcement', 'tileAnnouncement', Megaphone, 'announcements'], ['student-notifications', 'tileStudentNotice', Send, 'announcements'], ['article', 'tileArticle', BookOpenText, 'articles'], ['benefit', 'tileBenefit', Quote, 'dailyBenefits'], ['student-management', 'tileStudents', UsersRound, 'students'], ['application', 'tileApplications', UsersRound, 'applications'], ['exams', 'tileExams', ClipboardList, 'assignments'], ['schedule-prep', 'tileSchedulePrep', CalendarRange, null], ['groups', 'tileGroups', Users, 'schedule'], ['users', 'tileRoles', UserCog, 'userRoleManagement'], ['course-activation', 'tileCourses', BookOpen, 'schedule'], ['statistics', 'tileStatistics', UsersRound, null], ['audit-history', 'tileAudit', ShieldCheck, null]] as const).filter(([value, , , permission]) => owner || (value === 'schedule-prep' && (ownerAssistant || activeRole === 'admin')) || (value === 'student-management' && canManageAssignments) || (activeRole !== 'teacher' && (value === 'users' || value === 'course-activation')) || (value !== 'users' && value !== 'course-activation' && value !== 'statistics' && value !== 'audit-history' && permission !== null && rolePermissions.has(permission))).map(([value, label, Icon]) => <Fragment key={value}><button type="button" onClick={() => toggleTab(value)} className={adminTileClass(value, tab === value)} aria-expanded={tab === value} aria-controls={tab === value ? `panel-admin-${value}` : undefined} data-testid={`tab-admin-${value}`}><span className="grid size-7 place-items-center rounded-lg bg-white/70"><Icon size={16} /></span><span className="leading-4">{tr(label)} {value === 'application' && pendingApplicationCount > 0 && <span className="ms-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white" data-testid="badge-pending-applications">{pendingApplicationCount}</span>}{value === 'exams' && pendingExamReviewCount > 0 && <span className="ms-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white" title="Yoxlama gözləyən açıq cavablar" data-testid="badge-pending-exam-reviews">{pendingExamReviewCount}</span>}{value === 'student-management' && (pendingExcuseCount + pendingSubjectRequestCount) > 0 && <span className="ms-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">{pendingExcuseCount + pendingSubjectRequestCount}</span>}</span>{tab === value && <TilePointer />}</button>{inlinePanel(value)}</Fragment>)}
                   {(owner || ownerAssistant) && <button type="button" onClick={() => toggleTab('graduation-certificates')} className={adminTileClass('graduation-certificates', tab === 'graduation-certificates')} aria-expanded={tab === 'graduation-certificates'} aria-controls={tab === 'graduation-certificates' ? 'panel-admin-graduation-certificates' : undefined} data-testid="tab-admin-graduation-certificates"><span className="grid size-7 place-items-center rounded-lg bg-white/70"><FileBadge size={16} /></span><span className="leading-4">{tr('tileCertificates')}</span>{tab === 'graduation-certificates' && <TilePointer />}</button>}{inlinePanel('graduation-certificates')}
                   
                   <button type="button" onClick={() => toggleTab('library')} className={adminTileClass('library', tab === 'library')} aria-expanded={tab === 'library'} aria-controls={tab === 'library' ? 'panel-admin-library' : undefined} data-testid="tab-admin-library"><span className="grid size-7 place-items-center rounded-lg bg-white/70"><Library size={16} /></span><span className="leading-4">{tr('navLibrary')}</span>{tab === 'library' && <TilePointer />}</button>{inlinePanel('library')}
            </div>
               <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[hsl(var(--border))] pt-3">
                 <button type="button" onClick={() => toggleTab('schedule')} className={`relative ${adminTabButtonClass('schedule', tab === 'schedule')}`} aria-expanded={tab === 'schedule'} aria-controls={tab === 'schedule' ? 'panel-admin-schedule' : undefined} data-testid="tab-admin-schedule"><CalendarRange size={16} /> {tr('mySchedule')}{tab === 'schedule' && <TilePointer />}</button>
                  <button type="button" onClick={() => toggleTab('teachers-schedule')} className={`relative ${adminTabButtonClass('teachers-schedule', tab === 'teachers-schedule')}`} aria-expanded={tab === 'teachers-schedule'} aria-controls={tab === 'teachers-schedule' ? 'panel-admin-teachers-schedule' : undefined} data-testid="tab-admin-teachers-schedule"><CalendarRange size={16} /> {tr('teachersSchedule')}{tab === 'teachers-schedule' && <TilePointer />}</button>
                   <button type="button" onClick={() => toggleTab('messages')} className={`relative ${adminTabButtonClass('messages', tab === 'messages')}`} aria-expanded={tab === 'messages'} aria-controls={tab === 'messages' ? 'panel-admin-messages' : undefined} data-testid="tab-admin-messages"><Mail size={16} /> {tr('navMessages')} {unreadMessageCount > 0 && <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">{unreadMessageCount}</span>}{tab === 'messages' && <TilePointer />}</button>
                   <button type="button" onClick={() => toggleTab('questions')} className={`relative ${adminTabButtonClass('questions', tab === 'questions')}`} aria-expanded={tab === 'questions'} aria-controls={tab === 'questions' ? 'panel-admin-questions' : undefined} data-testid="tab-admin-questions"><HelpCircle size={16} /> {tr('navQa')} {unansweredQuestionCount > 0 && <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">{unansweredQuestionCount}</span>}{tab === 'questions' && <TilePointer />}</button>
              </div>
              {tab && pillTabs.includes(tab) && inlinePanel(tab)}
              {tab && !pillTabs.includes(tab) && !tileTabsRendered.has(tab) && inlinePanel(tab)}
          </section>
          <div className="mt-4 space-y-4">
            <DailyBenefitList benefits={dailyBenefits} />
            <section className="rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-xs)]">
              <ArticleList articles={articles} />
            </section>
          </div>
      </main>
      <AiAssistantLauncher href="/ai" />
    </div>
  );
}