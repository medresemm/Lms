import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
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
  Mail,
  Megaphone,
  Plus,
  Pencil,
  Quote,
  Send,
  ShieldCheck,
  Upload,
  UserCog,
  UsersRound,
  RefreshCw,
  Search,
  X,
  Trash2,
  ClipboardCheck,
  ClipboardList,
  Paperclip,
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
  ResourceInputKind,
  getGetCourseQueryKey,
  type AnnouncementInput,
  type ResourceInput,
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
  useCreateCourse,
  useCreateDailyBenefit,
  useCreateResource,
  useGetAdminResources,
  useGetAdminTeachers,
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
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useClerk, useUser } from '@clerk/react';
import { Link, useLocation } from 'wouter';
import { ArticlesLink, HomeLink } from '@/components/home-link';
import { MessageCenter } from '@/components/message-center';
import { loadUnansweredQuestionCount, QaCenter } from '@/components/qa-center';
import { AdminExamsSection } from '@/components/exam-module';
import { GraduateCertificateSection } from '@/components/graduate-certificate';
import { formatFullName, formatPersonName } from '@/lib/utils';

type Tab = 'course-content' | 'course-activation' | 'announcement' | 'student-notifications' | 'article' | 'benefit' | 'schedule' | 'teachers-schedule' | 'messages' | 'questions' | 'student-management' | 'application' | 'exams' | 'users' | 'statistics' | 'audit-history' | 'graduation-certificates';

const emptyCourse: CourseInput = {
  title: '',
  category: '',
  instructor: '',
  totalLessons: 12,
  color: 'teal',
  progress: 0,
  completedLessons: 0,
  nextLesson: '',
  pdfUrl: null,
  telegramUrl: null,
  zoomUrl: null,
  googleMeetUrl: null,
  lessonUrl: null,
  description: '',
  curriculum: [],
  lessonDescription: '',
  lessonDays: [],
  lessonTime: '',
  credits: 3,
  hours: 45,
};
const emptyCourseEdit = {
  title: '', category: '', instructor: '', totalLessons: 0, color: 'teal',
  description: '', curriculum: '', lessonDescription: '', nextLesson: '',
  pdfUrl: '', telegramUrl: '', zoomUrl: '', googleMeetUrl: '', lessonUrl: '',
  lessonDays: [] as string[], lessonTime: '', credits: 3, hours: 45,
};

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
    ? resources.filter((resource) => resource.teacherClerkUserId === teacherClerkUserId)
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
    if (!window.confirm('Bu üzr müraciətini silmək istəyirsiniz?')) return;
    const response = await fetch(apiUrl(`/admin/attendance-excuses/${id}`), { method: 'DELETE' });
    if (!response.ok) return;
    setItems((current) => current.filter((item) => item.id !== id));
  };
  const removeAttendanceRecord = async (recordId: number, excuseId: number) => {
    if (!window.confirm('Bu qayıb qeydini silmək istəyirsiniz?')) return;
    const response = await fetch(apiUrl(`/admin/attendance-records/${recordId}`), { method: 'DELETE' });
    if (!response.ok) return;
    setItems((current) => current.filter((item) => item.id !== excuseId));
  };
  return <div className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.22)] p-4">
    <button type="button" onClick={() => { if (!isOpen) markExcusesRead(); else setIsOpen(false); }} className="focus-ring flex w-full items-center justify-between gap-3 text-left" aria-expanded={isOpen} data-testid="button-teacher-excuses">
      <span><span className="block text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">Müəllimə gələn üzrlər</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Tələbələrin göndərdiyi izahatlar</span></span>
      {unreadIds.length > 0 && <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white">{unreadIds.length}</span>}
    </button>
    {isOpen && <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">{isLoading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Üzrlər yüklənir...</p> : !items.length ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Yeni üzr müraciəti yoxdur.</p> : <div className="space-y-3">{items.map((item) => <div key={item.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-[hsl(var(--primary))]">{item.studentName} · {item.courseTitle}</p><div className="flex items-center gap-2"><span className="text-xs text-[hsl(var(--muted-foreground))]">{item.attendanceDate}</span><button type="button" onClick={() => void removeExcuse(item.id)} className="focus-ring rounded-lg border border-[hsl(var(--border))] px-2 py-1 text-[10px] font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid={`button-delete-excuse-${item.id}`}>Üzrü sil</button><button type="button" onClick={() => void removeAttendanceRecord(item.attendanceRecordId, item.id)} className="focus-ring rounded-lg bg-[hsl(var(--destructive))] px-2 py-1 text-[10px] font-bold text-white hover:opacity-90" data-testid={`button-delete-attendance-${item.attendanceRecordId}`}>Qayıbı sil</button></div></div><p className="mt-2 text-sm leading-6 text-[hsl(var(--foreground))]">{item.reason}</p><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Davamiyyəti qeyd edən müəllim: {item.teacherName} · {item.status === 'pending' ? 'Gözləmədə' : item.status}</p></div>)}</div>}</div>}
  </div>;
}

function LessonAttendance() {
  const [items, setItems] = useState<Array<{ id: number; studentName: string; courseTitle: string; sessionDate: string; joinedAt: string; punctuality: string; finalStatus: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); void fetch(apiUrl('/admin/lesson-attendance'), { cache: 'no-store' }).then((r) => r.ok ? r.json() : Promise.reject()).then(setItems).catch(() => setItems([])).finally(() => setLoading(false)); };
  useEffect(load, []);
  const decide = async (id: number, status: 'present' | 'late' | 'absent') => {
    const response = await fetch(apiUrl(`/admin/lesson-attendance/${id}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (response.ok) setItems((current) => current.map((item) => item.id === id ? { ...item, finalStatus: status } : item));
  };
  return <section className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4" data-testid="section-lesson-attendance">
    <p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">Onlayn dərsə qoşulmalar</p>
    {loading ? <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Yüklənir...</p> : !items.length ? <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Qoşulma qeydi yoxdur.</p> : <div className="mt-3 space-y-2">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[hsl(var(--muted)/.35)] p-3"><div><p className="text-sm font-bold text-[hsl(var(--primary))]">{item.studentName} · {item.courseTitle}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{item.sessionDate} · {new Date(item.joinedAt).toLocaleString('az-AZ')} · {item.punctuality === 'on_time' ? 'Vaxtında' : 'Gecikib'}</p></div><div className="flex gap-1.5">{(['present', 'late', 'absent'] as const).map((status) => <button key={status} type="button" onClick={() => void decide(item.id, status)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${item.finalStatus === status ? 'bg-[hsl(var(--primary))] text-white' : 'border border-[hsl(var(--border))] text-[hsl(var(--primary))]'}`}>{status === 'present' ? 'İştirak' : status === 'late' ? 'Gecikib' : 'Qayıb'}</button>)}</div></div>)}</div>}
  </section>;
}

function TeacherChoiceRequests() {
  const [items, setItems] = useState<Array<{ id: number; studentName: string; teacherName?: string; courseId: number; termNumber: number; status: string; studentCapacity: number; activeChoiceCount: number; isFull: boolean }>>([]);
  const [notice, setNotice] = useState('');
  const load = async () => { try { const response = await fetch(apiUrl('/admin/teacher-choices'), { cache: 'no-store' }); if (!response.ok) throw new Error('load'); setItems(await response.json()); } catch { setItems([]); } };
  useEffect(() => { void load(); }, []);
  const decide = async (id: number, decision: 'approved' | 'rejected') => {
    const response = await fetch(apiUrl(`/admin/teacher-choices/${id}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }) });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { setNotice(data.error ?? 'Seçimə qərar vermək mümkün olmadı.'); await load(); return; }
    await load();
    setNotice(decision === 'approved' ? 'Tələbə seçimi təsdiqləndi.' : 'Tələbə seçimi rədd edildi.');
  };
  return <section className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.22)] p-4" data-testid="section-teacher-choice-requests"><p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">Müəllim seçim müraciətləri</p>{notice && <p className="mt-2 text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{notice}</p>}{!items.length ? <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Müraciət yoxdur.</p> : <div className="mt-4 space-y-2">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[hsl(var(--card))] p-3"><div><p className="text-sm font-bold text-[hsl(var(--primary))]">{item.studentName}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{item.teacherName ?? 'Müəllim'} · Fənn № {item.courseId} · {item.termNumber}-ci semestr · Qrup: {item.studentCapacity > 0 ? `${item.activeChoiceCount}/${item.studentCapacity}` : `${item.activeChoiceCount} · limitsiz`} · {item.status === 'pending' ? 'Gözləmədə' : item.status === 'approved' ? 'Təsdiqlənib' : 'Rədd edilib'}</p></div>{item.status === 'pending' && <div className="flex gap-2"><button type="button" onClick={() => void decide(item.id, 'approved')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Təsdiqlə</button><button type="button" onClick={() => void decide(item.id, 'rejected')} className="rounded-lg bg-[hsl(var(--destructive))] px-3 py-2 text-xs font-bold text-white">Rədd et</button></div>}</div>)}</div>}</section>;
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
  owner_assistant: 'Sahib köməkçisi',
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
  curriculum: 'Tədris proqramı',
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
  const query = useGetAdminSubjectRemovalRequests();
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<number, string>>({});
  const [decisionError, setDecisionError] = useState<Record<number, string>>({});
  const decide = async (id: number, profileId: number, decision: 'approved' | 'rejected', reason?: string) => {
    const rejectionReason = reason?.trim();
    if (decision === 'rejected' && (!rejectionReason || rejectionReason.length < 3)) {
      setDecisionError((current) => ({ ...current, [id]: 'Rədd səbəbi ən azı 3 simvol olmalıdır.' }));
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
      setDecisionError((current) => ({ ...current, [id]: data.error ?? 'Qərar yadda saxlanılmadı.' }));
    }
  };
  return <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.22)] p-4" data-testid="section-subject-removal-requests">
    <p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">İcbari dərs silinmə müraciətləri</p>
    {query.isLoading ? <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Müraciətlər yüklənir...</p> : !query.data?.length ? <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Müraciət yoxdur.</p> : <div className="mt-4 space-y-3">{query.data.map((item) => <div key={item.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-[hsl(var(--primary))]">{item.studentName} · {item.courseTitle}</p><span className="text-xs font-bold">{item.termNumber}-ci semestr · {item.status === 'pending' ? 'Gözləmədə' : item.status === 'approved' ? 'Təsdiqlənib' : 'Rədd edilib'}</span></div><p className="mt-2 text-sm"><strong>Tələbənin səbəbi:</strong> {item.reason}</p>{item.status === 'rejected' && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-900"><strong>Göndərilən rədd izahı:</strong> {item.rejectionReason || 'İzah qeyd edilməyib.'}</p>}{item.status === 'pending' && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void decide(item.id, item.profileId, 'approved')} className="focus-ring rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Təsdiqlə</button>{rejectingId !== item.id && <button type="button" onClick={() => { setRejectingId(item.id); setDecisionError((current) => ({ ...current, [item.id]: '' })); }} className="focus-ring rounded-lg bg-[hsl(var(--destructive))] px-3 py-2 text-xs font-bold text-white">Rədd et</button>}{rejectingId === item.id && <div className="basis-full rounded-lg border border-red-200 bg-red-50 p-3"><label className="block text-xs font-bold text-red-900" htmlFor={`input-subject-removal-rejection-${item.id}`}>Tələbəyə göndəriləcək izah</label><textarea id={`input-subject-removal-rejection-${item.id}`} value={rejectionReasons[item.id] ?? ''} onChange={(event) => setRejectionReasons((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={1000} rows={3} placeholder="Rədd səbəbini yazın..." className="focus-ring mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs" data-testid={`input-subject-removal-rejection-${item.id}`} />{decisionError[item.id] && <p className="mt-2 text-xs font-semibold text-red-800" role="alert">{decisionError[item.id]}</p>}<div className="mt-2 flex gap-2"><button type="button" onClick={() => void decide(item.id, item.profileId, 'rejected', rejectionReasons[item.id])} className="focus-ring rounded-lg bg-[hsl(var(--destructive))] px-3 py-2 text-xs font-bold text-white">Rəddi göndər</button><button type="button" onClick={() => setRejectingId(null)} className="focus-ring rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-900">Ləğv et</button></div></div>}</div>}</div>)}</div>}
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
  const [activeSection, setActiveSection] = useState<StudentManagementTab | null>('subject-requests');
  const [isPromotionDirectoryOpen, setIsPromotionDirectoryOpen] = useState(false);
  useEffect(() => {
    if (focusStudentId) {
      setActiveSection('promotion');
      setIsPromotionDirectoryOpen(true);
    }
  }, [focusStudentId]);
  const sections: Array<{ value: StudentManagementTab; label: string; description: string; Icon: typeof Send }> = [
    { value: 'subject-requests', label: 'Dərs silinməsi', description: 'Tələbələrin dərs dəyişiklik müraciətləri', Icon: Send },
    { value: 'grading', label: 'Qiymətləndirmə', description: 'Qiymətləri tələbə və semestr üzrə idarə et', Icon: GraduationCap },
    { value: 'attendance', label: 'Davamiyyət', description: 'Davamiyyət qeydlərini əlavə et və yenilə', Icon: CalendarDays },
    { value: 'excuses', label: 'Üzr müraciətləri', description: 'Tələbələrin üzr və izahat müraciətləri', Icon: FileText },
    { value: 'teacher-choices', label: 'Müəllim seçimləri', description: 'Tələbələrin müəllim seçimi müraciətləri', Icon: UsersRound },
    { value: 'promotion', label: 'Semestr keçidini təsdiqlə', description: 'Tələbəni seç və növbəti semestrə keçidini təsdiqlə', Icon: GraduationCap },
    { value: 'schedule-access', label: 'Cədvələ giriş təsdiqi', description: 'Tələbələrin dərs cədvəlinə girişini təsdiqlə', Icon: CalendarDays },
    ...(canManageAssignments ? [{ value: 'assignments' as const, label: 'Ev tapşırıqları', description: 'Tapşırıqları və tələbə təhvilini idarə et', Icon: ClipboardCheck }] : []),
    ...(canGraduate ? [{ value: 'graduation' as const, label: 'Təxərrüc et', description: '4, 6 və ya 8-ci semestr tələbələrini məzun et', Icon: GraduationCap }] : []),
    ...(canViewDeletedStudents ? [{ value: 'deleted-students' as const, label: 'Silinmiş hesablar', description: 'Silinmiş tələbə hesablarının tarixçəsi', Icon: Trash2 }] : []),
  ];

  return (
    <section className="space-y-5" data-testid="section-student-management">
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.22)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--secondary-foreground))]">Tələbə əməliyyatları</p>
            <h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Tələbələri idarə et</h3>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Tələbələrin akademik məlumatlarını və müraciətlərini bir yerdən idarə edin.</p>
          </div>
          <span className="rounded-full bg-[hsl(var(--card))] px-3 py-1.5 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">{sections.length} bölmə</span>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2" aria-label="Tələbə idarəetmə bölmələri">
          {sections.map(({ value, label, description, Icon }) => (
            <button
              key={value}
              type="button"
              aria-expanded={activeSection === value}
              onClick={() => setActiveSection((current) => current === value ? null : value)}
              className={`focus-ring flex items-start gap-3 rounded-xl border p-3 text-left transition ${activeSection === value ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-xs)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))] hover:border-[hsl(var(--secondary-foreground)/.45)] hover:bg-[hsl(var(--secondary)/.2)]'}`}
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
            </button>
          ))}
        </div>
      </div>
      <div aria-live="polite">
        {activeSection === 'subject-requests' && <SubjectRemovalRequests />}
        {activeSection === 'grading' && <AcademicManagement mode="grades" />}
        {activeSection === 'attendance' && <><AcademicManagement mode="attendance" /><LessonAttendance /></>}
        {activeSection === 'excuses' && <AttendanceExcuses onRead={onReadExcuses} />}
        {activeSection === 'teacher-choices' && <TeacherChoiceRequests />}
        {activeSection === 'promotion' && <div className="rounded-2xl border border-[hsl(var(--accent)/.55)] bg-[hsl(var(--accent)/.12)] p-5" data-testid="section-semester-promotion-entry"><p className="text-sm font-bold text-[hsl(var(--primary))]">Tələbənin növbəti semestrə keçidini təsdiqləyin</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Tələbəni seçdikdən sonra cari semestri və əsas nəticələri görünəcək. Təsdiq düyməsi tələbə məlumatlarında yerləşir.</p><button type="button" onClick={() => setIsPromotionDirectoryOpen(true)} className={`${buttonClass} mt-4`} data-testid="button-open-semester-promotion"><GraduationCap size={16} /> Tələbə seç və keçidi təsdiqlə</button>{isPromotionDirectoryOpen && <StudentDirectory filter="all" onClose={() => setIsPromotionDirectoryOpen(false)} canEdit={canGraduate} focusStudentId={focusStudentId} />}</div>}
        {activeSection === 'schedule-access' && <div className="space-y-4" data-testid="section-schedule-access-entry"><div className="rounded-2xl border border-[hsl(var(--accent)/.55)] bg-[hsl(var(--accent)/.12)] p-5"><p className="text-sm font-bold text-[hsl(var(--primary))]">Tələbələrin cədvəl girişini təsdiqləyin</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Aşağıdakı siyahıdan tələbəni seçin və dərs cədvəlinə giriş icazəsini verin.</p></div><StudentDirectory filter="all" onClose={() => undefined} canEdit={false} embedded /></div>}
        {activeSection === 'assignments' && canManageAssignments && <AdminAssignmentsSection resources={resources} teacherClerkUserId={assignmentTeacherClerkUserId} />}
        {activeSection === 'graduation' && <GraduationSection />}
        {activeSection === 'deleted-students' && canViewDeletedStudents && <StudentDeletionAudit />}
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

function CourseForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState<CourseInput>(emptyCourse);
  const [termNumber, setTermNumber] = useState(1);
  const pdfInput = useRef<HTMLInputElement>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [notice, setNotice] = useState('');
  const mutation = useCreateCourse();
  const teachersQuery = useGetAdminTeachers();
  const resourcesQuery = useGetAdminResources();
  const queryClient = useQueryClient();
  const semesterTeacherIds = new Set(
    (resourcesQuery.data ?? [])
      .filter((resource) => resource.termNumber === termNumber && resource.teacherClerkUserId)
      .map((resource) => resource.teacherClerkUserId),
  );
  const availableTeachers = (teachersQuery.data ?? []).filter((teacher) => semesterTeacherIds.has(teacher.clerkUserId));

  const update = (key: keyof CourseInput, value: string | string[] | number | null) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const uploadCoursePdf = async (file: File) => {
    const request = await fetch(apiUrl('/admin/courses/upload-url'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, size: file.size, contentType: 'application/pdf' }),
    });
    const upload = await request.json() as { uploadURL?: string; objectPath?: string; error?: string };
    if (!request.ok || !upload.uploadURL || !upload.objectPath) throw new Error(upload.error || 'PDF yükləməyə hazırlana bilmədi.');
    const uploaded = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: file });
    if (!uploaded.ok) throw new Error('PDF faylı yüklənə bilmədi.');
    return upload.objectPath;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    setIsUploadingPdf(Boolean(pdfFile));
    try {
      const uploadedPdfUrl = pdfFile ? await uploadCoursePdf(pdfFile) : null;
      const createdCourse = await mutation.mutateAsync({
        data: {
          ...form,
          category: form.title,
          curriculum: form.curriculum?.filter(Boolean),
          nextLesson: form.nextLesson || null,
          pdfUrl: uploadedPdfUrl ?? (form.pdfUrl || null),
          telegramUrl: form.telegramUrl || null,
          lessonUrl: form.lessonUrl || null,
          lessonDays: form.lessonDays,
          lessonTime: form.lessonTime,
        },
      });
      const selectedTeacher = teachersQuery.data?.find((teacher) => teacher.displayName === form.instructor);
      if (!selectedTeacher) throw new Error('Aktiv müəllim seçin.');
      const resourceResponse = await fetch(apiUrl('/admin/resources'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: createdCourse.id,
          termNumber,
          kind: ResourceInputKind.material,
          title: form.title,
          body: form.description,
          url: uploadedPdfUrl ?? (form.pdfUrl || null),
          lessonDays: form.lessonDays,
          lessonTime: form.lessonTime,
          isMandatory: true,
          teacherClerkUserId: selectedTeacher.clerkUserId,
          studentCapacity: 0,
        }),
      });
      const resourceResult = await resourceResponse.json().catch(() => ({})) as { error?: string };
      if (!resourceResponse.ok) throw new Error(resourceResult.error || 'Dərs seçilən semestrə əlavə edilə bilmədi.');
      {
        void queryClient.invalidateQueries({ queryKey: getGetCoursesQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setForm(emptyCourse);
        setTermNumber(1);
        setPdfFile(null);
        if (pdfInput.current) pdfInput.current.value = '';
        setNotice('Dərs uğurla əlavə edildi.');
        onSaved();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Dərs əlavə edilə bilmədi. Məlumatları yoxlayın.');
    } finally {
      setIsUploadingPdf(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" data-testid="form-create-course">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Semestr">
          <select required className={inputClass} value={termNumber} onChange={(event) => { setTermNumber(Number(event.target.value)); update('instructor', ''); }} data-testid="select-course-term">
            {Array.from({ length: 8 }, (_, index) => index + 1).map((term) => <option key={term} value={term}>{term}-ci semestr</option>)}
          </select>
        </Field>
        <Field label="Dərsin adı">
          <input required className={inputClass} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="Məsələn, Təfsirə giriş" data-testid="input-course-title" />
        </Field>
        <Field label="Müəllim" hint="Sistemdə olan müəllimi seçmək üçün adına klikləyin.">
          <div className="space-y-2" role="radiogroup" aria-label="Dərsin müəllimi">
            {teachersQuery.isLoading ? (
              <div className="rounded-xl border border-dashed border-[hsl(var(--border))] px-3.5 py-3 text-sm text-[hsl(var(--muted-foreground))]">Müəllimlər yüklənir...</div>
            ) : teachersQuery.isError ? (
              <div className="rounded-xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.05)] px-3.5 py-3 text-sm text-[hsl(var(--destructive))]">Müəllimlər yüklənə bilmədi. Səhifəni yeniləyin.</div>
            ) : availableTeachers.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {availableTeachers.map((teacher) => {
                  const isSelected = form.instructor === teacher.displayName;
                  return (
                    <button
                      key={teacher.clerkUserId}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => update('instructor', teacher.displayName)}
                      className={`focus-ring rounded-xl border px-3.5 py-3 text-left transition ${isSelected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary)/.55)] text-[hsl(var(--primary))] shadow-sm' : 'border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:border-[hsl(var(--primary)/.5)] hover:bg-[hsl(var(--muted)/.5)]'}`}
                      data-testid={`button-select-course-teacher-${teacher.clerkUserId}`}
                    >
                      <span className="block text-sm font-bold">{teacher.displayName}</span>
                      <span className="mt-1 block text-[11px] text-[hsl(var(--muted-foreground))]">Müəllim</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[hsl(var(--border))] px-3.5 py-3 text-sm text-[hsl(var(--muted-foreground))]">Bu semestrdə təyin olunmuş aktiv müəllim yoxdur.</div>
            )}
          </div>
          <input required tabIndex={-1} className="sr-only" value={form.instructor} onChange={() => undefined} aria-label="Seçilmiş müəllim" data-testid="input-course-instructor" />
        </Field>
        <Field label="Rəng">
          <select className={inputClass} value={form.color} onChange={(e) => update('color', e.target.value)} data-testid="select-course-color">
            <option value="teal">Firuzəyi</option>
            <option value="blue">Mavi</option>
            <option value="amber">Qızılı</option>
            <option value="rose">Gül</option>
            <option value="violet">Bənövşəyi</option>
          </select>
        </Field>
        <Field label="Dərs sayı">
          <input min="0" type="number" className={inputClass} value={form.totalLessons || ''} onChange={(e) => update('totalLessons', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="İstəyə bağlı" data-testid="input-course-total-lessons" />
        </Field>
        <Field label="Kredit" hint="Rəsmi akademik kredit dəyəri.">
          <input min="0" step="0.5" required type="number" className={inputClass} value={form.credits} onChange={(e) => update('credits', e.target.value === '' ? 0 : Number(e.target.value))} data-testid="input-course-credits" />
        </Field>
        <Field label="Dərs saatı" hint="Sənəddə göstəriləcək ümumi saat.">
          <input min="0" step="1" required type="number" className={inputClass} value={form.hours} onChange={(e) => update('hours', e.target.value === '' ? 0 : Number(e.target.value))} data-testid="input-course-hours" />
        </Field>
        <Field label="Növbəti dərs">
          <input className={inputClass} value={form.nextLesson ?? ''} onChange={(e) => update('nextLesson', e.target.value)} placeholder="İlk mövzu" data-testid="input-course-next-lesson" />
        </Field>
      </div>
      <Field label="Dərs haqqında">
        <textarea required rows={3} className={`${inputClass} resize-y`} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Tələbənin bu dərsdə nə öyrənəcəyini yazın." data-testid="textarea-course-description" />
      </Field>
      <Field label="Tədris proqramı" hint="Hər mövzunu yeni sətirdə yazın.">
        <textarea rows={4} className={`${inputClass} resize-y`} value={form.curriculum?.join('\n') ?? ''} onChange={(e) => update('curriculum', e.target.value.split('\n'))} placeholder={'Mövzu 1\nMövzu 2\nMövzu 3'} data-testid="textarea-course-curriculum" />
      </Field>
      <Field label="Növbəti dərsin təsviri">
        <textarea required rows={3} className={`${inputClass} resize-y`} value={form.lessonDescription} onChange={(e) => update('lessonDescription', e.target.value)} placeholder="Dərsin qısa təsviri" data-testid="textarea-course-lesson-description" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Həftənin dərs günləri" hint="Ən azı bir gün seçin.">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
            {lessonDayOptions.map(([value, label]) => <label key={value} className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))]">
              <input type="checkbox" checked={form.lessonDays.includes(value)} onChange={(event) => update('lessonDays', event.target.checked ? [...form.lessonDays, value] : form.lessonDays.filter((day) => day !== value))} />
              {label}
            </label>)}
          </div>
        </Field>
        <Field label="Dərs saatı">
          <input required type="time" className={inputClass} value={form.lessonTime} onChange={(event) => update('lessonTime', event.target.value)} data-testid="input-course-lesson-time" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="PDF linki" hint={pdfFile ? 'Fayl seçildiyi üçün link əvəzinə yüklənən PDF istifadə olunacaq.' : 'Hazırda internetdə olan PDF linkini əlavə edə bilərsiniz.'}>
          <input type="url" className={inputClass} value={form.pdfUrl ?? ''} onChange={(e) => { setPdfFile(null); update('pdfUrl', e.target.value); }} placeholder="https://" data-testid="input-course-pdf-url" />
        </Field>
        <Field label="Telegram linki"><input type="url" className={inputClass} value={form.telegramUrl ?? ''} onChange={(e) => update('telegramUrl', e.target.value)} placeholder="https://" data-testid="input-course-telegram-url" /></Field>
        <Field label="Zoom linki"><input type="url" className={inputClass} value={form.zoomUrl ?? ''} onChange={(e) => update('zoomUrl', e.target.value)} placeholder="https://" data-testid="input-course-zoom-url" /></Field>
        <Field label="Google Meet linki"><input type="url" className={inputClass} value={form.googleMeetUrl ?? ''} onChange={(e) => update('googleMeetUrl', e.target.value)} placeholder="https://" data-testid="input-course-google-meet-url" /></Field>
        <Field label="Dərs linki"><input type="url" className={inputClass} value={form.lessonUrl ?? ''} onChange={(e) => update('lessonUrl', e.target.value)} placeholder="https://" /></Field>
      </div>
      <Field label="PDF faylı yüklə" hint="Yalnız PDF formatı, maksimum 25 MB.">
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)] p-3">
          <input ref={pdfInput} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
              setNotice('Yalnız PDF faylı seçə bilərsiniz.');
              event.target.value = '';
              return;
            }
            if (file.size > 25 * 1024 * 1024) {
              setNotice('PDF faylının ölçüsü 25 MB-dan çox ola bilməz.');
              event.target.value = '';
              return;
            }
            setNotice('');
            setPdfFile(file);
            update('pdfUrl', '');
          }} data-testid="input-course-pdf-file" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              {pdfFile ? <p className="truncate text-sm font-semibold text-[hsl(var(--primary))]">{pdfFile.name}</p> : <p className="text-sm text-[hsl(var(--muted-foreground))]">Dərsə PDF faylı əlavə edin</p>}
              {pdfFile && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{(pdfFile.size / 1024 / 1024).toFixed(1)} MB · yadda saxlanarkən yüklənəcək</p>}
            </div>
            <div className="flex items-center gap-2">
              {pdfFile && <button type="button" className="focus-ring rounded-lg px-2.5 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" onClick={() => { setPdfFile(null); if (pdfInput.current) pdfInput.current.value = ''; }}>Sil</button>}
              <button type="button" className="focus-ring inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--card))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary)/.45)]" onClick={() => pdfInput.current?.click()}><Upload size={14} /> {pdfFile ? 'PDF-i dəyiş' : 'PDF seç'}</button>
            </div>
          </div>
        </div>
      </Field>
      <div className="flex justify-end">
        <button type="submit" className={buttonClass} disabled={mutation.isPending || isUploadingPdf} data-testid="button-create-course"><Plus size={16} /> {isUploadingPdf ? 'PDF yüklənir...' : mutation.isPending ? 'Əlavə olunur...' : 'Yeni dərsi əlavə et'}</button>
      </div>
      <FormNotice text={notice} error={notice.includes('edilə bilmədi') || notice.includes('yüklənə') || notice.includes('seçə') || notice.includes('çox ola')} />
    </form>
  );
}

function AnnouncementForm({ onSaved }: { onSaved: () => void }) {
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
      <Field label="Elanın başlığı"><input required className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Yeni xəbər başlığı" data-testid="input-announcement-title" /></Field>
      <Field label="Mətn"><textarea required rows={6} className={`${inputClass} resize-y`} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Elanın mətnini yazın." data-testid="textarea-announcement-body" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tarix"><input required type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="input-announcement-date" /></Field>
        <Field label="Növ">
          <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })} data-testid="select-announcement-type">
            <option value={AnnouncementInputType.info}>Məlumat</option>
            <option value={AnnouncementInputType.lesson}>Yeni dərs</option>
            <option value={AnnouncementInputType.book}>Yeni Kitab</option>
            <option value={AnnouncementInputType.announcement}>Elan</option>
            <option value={AnnouncementInputType.important}>Vacib elan</option>
            <option value={AnnouncementInputType.news}>Xəbər</option>
            <option value={AnnouncementInputType.admission}>Tələbə qəbulu</option>
          </select>
        </Field>
      </div>
      <div className="flex justify-end"><button type="submit" className={buttonClass} disabled={mutation.isPending} data-testid="button-create-announcement"><Megaphone size={16} /> {mutation.isPending ? 'Yayımlanır...' : 'Elanı yayımla'}</button></div>
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
        setNotice('Məqalə uğurla yayımlandı.');
      },
      onError: () => setNotice('Məqalə yayımlanmadı. Məlumatları yoxlayın.'),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5" data-testid="form-create-article">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Məqalənin başlığı"><input required minLength={3} maxLength={160} className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Məqalə başlığı" data-testid="input-article-title" /></Field>
        <Field label="Müəllif"><input required maxLength={120} className={inputClass} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Ad və soyad" data-testid="input-article-author" /></Field>
      </div>
      <Field label="Qısa təqdimat" hint="Ana səhifədə oxucunun ilk görəcəyi qısa mətn.">
        <textarea required maxLength={320} rows={3} className={`${inputClass} resize-y`} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="Məqalənin qısa təqdimatını yazın." data-testid="textarea-article-excerpt" />
      </Field>
      <Field label="Məqalənin mətni" hint="Mətn təhlükəsiz plain text kimi göstəriləcək.">
        <textarea required maxLength={12000} rows={10} className={`${inputClass} resize-y`} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Məqalənin tam mətnini yazın." data-testid="textarea-article-body" />
      </Field>
      <div className="flex justify-end"><button type="submit" className={buttonClass} disabled={mutation.isPending} data-testid="button-create-article"><BookOpenText size={16} /> {mutation.isPending ? 'Yayımlanır...' : 'Məqaləni yayımla'}</button></div>
      <FormNotice text={notice} error={notice.includes('yayımlanmadı')} />
    </form>
  );
}

function DailyBenefitForm() {
  const days = [
    ['monday', '1-ci gün'], ['tuesday', '2-ci gün'], ['wednesday', '3-cü gün'],
    ['thursday', '4-cü gün'], ['friday', '5-ci gün'], ['saturday', '6-cı gün'], ['sunday', '7-ci gün'],
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
      setNotice(`${label} üçün fayda və mənbəni doldurun.`);
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
      setNotice(`${label} üçün fayda əlavə edildi.`);
    } catch {
      setNotice(`${label} üçün fayda yadda saxlanılmadı.`);
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
      setNotice('Həftənin 7 günü üçün faydalar yadda saxlanıldı.');
    } catch {
      setNotice('Faydalar yadda saxlanılmadı. Məlumatları yoxlayın.');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" data-testid="form-create-daily-benefit">
      <div><p className="text-sm font-bold text-[hsl(var(--primary))]">Həftənin faydaları</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Hər xana bir gün üçündür. Müəllim xananı doldurduqdan sonra həmin günün faydası avtomatik göstəriləcək.</p></div>
      <div className="space-y-4">{days.map(([day, label]) => <div key={day} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.22)] p-4">
        <button type="button" onClick={() => setOpenDay((current) => current === day ? null : day)} aria-expanded={openDay === day} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))]" data-testid={`button-daily-benefit-day-${day}`}>{isPastBenefitStale(day) && <span className="h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_0_3px_hsl(0_84%_60%/.2)]" title="Bu günün faydası yenilənməyib" aria-label="Fayda yenilənməyib" />}{label}</button>
        {openDay === day && <div className="mt-3 space-y-3"><textarea maxLength={2000} rows={3} className={`${inputClass} resize-y`} value={form[day].body} onChange={(e) => setForm((current) => ({ ...current, [day]: { ...current[day], body: e.target.value } }))} placeholder={`${label} üçün faydanı yazın.`} data-testid={`textarea-daily-benefit-body-${day}`} /><input maxLength={200} className={inputClass} value={form[day].source} onChange={(e) => setForm((current) => ({ ...current, [day]: { ...current[day], source: e.target.value } }))} placeholder="Mənbə" data-testid={`input-daily-benefit-source-${day}`} /><div className="flex justify-end"><button type="button" onClick={() => void saveDay(day, label)} disabled={savingDay !== null} className={buttonClass} data-testid={`button-add-daily-benefit-${day}`}><Plus size={16} /> {savingDay === day ? 'Əlavə olunur...' : 'Əlavə et'}</button></div></div>}
      </div>)}</div>
      <div className="flex justify-end"><button type="submit" className={buttonClass} disabled={benefitsQuery.isLoading || benefitsQuery.isFetching} data-testid="button-create-daily-benefit"><Quote size={16} /> Yadda saxla</button></div>
      <FormNotice text={notice} error={notice.includes('yadda saxlanılmadı')} />
    </form>
  );
}

function ArticleList({ articles }: { articles: Article[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ArticleInput>({ title: '', excerpt: '', body: '', author: '' });
  const [notice, setNotice] = useState('');
  const queryClient = useQueryClient();
  const startEdit = (article: Article) => { setEditingId(article.id); setForm({ title: article.title, excerpt: article.excerpt, body: article.body, author: article.author }); setNotice(''); };
  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch(apiUrl(`/admin/articles/${editingId}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (!response.ok) { setNotice('Məqalə yenilənmədi.'); return; }
    setEditingId(null); setNotice('Məqalə yeniləndi.');
    await Promise.all([queryClient.invalidateQueries({ queryKey: getGetAdminArticlesQueryKey() }), queryClient.invalidateQueries({ queryKey: getGetArticlesQueryKey() })]);
  };
  const deleteArticle = async (articleId: number) => {
    if (!window.confirm('Bu məqaləni silmək istədiyinizə əminsiniz?')) return;
    const response = await fetch(apiUrl(`/admin/articles/${articleId}`), { method: 'DELETE' });
    if (!response.ok) { setNotice('Məqalə silinmədi.'); return; }
    setNotice('Məqalə silindi.');
    await Promise.all([queryClient.invalidateQueries({ queryKey: getGetAdminArticlesQueryKey() }), queryClient.invalidateQueries({ queryKey: getGetArticlesQueryKey() })]);
  };
  return (
    <div className="mt-8 border-t border-[hsl(var(--border))] pt-6">
      <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Son yayımlananlar</p><h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Məqalələr</h3></div><BookOpenText className="text-[hsl(var(--secondary-foreground))]" size={20} /></div>
      {articles.length ? <div className="space-y-2">{articles.slice(0, 5).map((article) => editingId === article.id ? <form key={article.id} onSubmit={saveEdit} className="space-y-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.55)] p-3"><input required className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Başlıq" /><input required className={inputClass} value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} placeholder="Müəllif" /><textarea required rows={2} className={`${inputClass} resize-y`} value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} placeholder="Qısa təqdimat" /><textarea required rows={5} className={`${inputClass} resize-y`} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Məqalənin mətni" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingId(null)} className="focus-ring rounded-lg px-3 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))]">Ləğv et</button><button type="submit" className={buttonClass}>Yadda saxla</button></div></form> : <div key={article.id} className="rounded-xl bg-[hsl(var(--muted)/.55)] p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-bold text-[hsl(var(--primary))]">{article.title}</p><div className="flex shrink-0 gap-1"><button type="button" onClick={() => startEdit(article)} className="focus-ring rounded-lg px-2 py-1 text-[11px] font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--card))]">Redaktə et</button><button type="button" onClick={() => void deleteArticle(article.id)} className="focus-ring rounded-lg px-2 py-1 text-[11px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--card))]">Sil</button></div></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{article.excerpt}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--secondary-foreground))]">{formatPersonName(article.author)}</p></div>)}</div> : <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-5 text-center text-xs text-[hsl(var(--muted-foreground))]">Hələ məqalə əlavə edilməyib.</p>}
      {notice && <FormNotice text={notice} error={notice.includes('məqalə') && !notice.includes('yeniləndi') && !notice.includes('silindi')} />}
    </div>
  );
}

function DailyBenefitList({ benefits }: { benefits: DailyBenefit[] }) {
  const benefit = benefits[0];
  return (
    <div className="mt-8 rounded-2xl bg-[hsl(var(--accent)/.38)] p-5">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]"><Quote size={14} /> Günün faydası</p>
      {benefit ? <div className="mt-3 rounded-xl bg-[hsl(var(--card)/.55)] p-3"><p className="font-serif text-base leading-6 text-[hsl(var(--primary))]">“{benefit.body}”</p><p className="mt-2 text-xs font-bold text-[hsl(var(--secondary-foreground))]">— {benefit.source}</p></div> : <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Hələ günün faydası əlavə edilməyib.</p>}
    </div>
  );
}

function CourseLessonCountForm() {
  const coursesQuery = useGetCourses();
  const teachersQuery = useGetAdminTeachers();
  const [courseId, setCourseId] = useState('');
  const [totalLessons, setTotalLessons] = useState(0);
  const [instructor, setInstructor] = useState('');
  const [notice, setNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const selectCourse = (value: string) => {
    setCourseId(value);
    const course = (coursesQuery.data ?? []).find((item) => String(item.id) === value);
    setTotalLessons(course?.totalLessons ?? 0);
    setInstructor(course?.instructor ?? '');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    setIsSaving(true);
    try {
      const response = await fetch(apiUrl(`/admin/courses/${courseId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalLessons, instructor }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Dərs sayı yenilənə bilmədi.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetCoursesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
      ]);
        setNotice('Dərsin ümumi dərs sayı yeniləndi.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Dərs sayı yenilənə bilmədi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-8 border-t border-[hsl(var(--border))] pt-6" data-testid="form-update-course-lessons">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Mövcud dərsi yenilə</p>
        <h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Dərs sayını təyin et</h3>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Tələbə panelində “0 / ümumi dərs” kimi görünəcək.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_1.5fr_180px_auto] sm:items-end">
      <Field label="Dərs">
          <select required className={inputClass} value={courseId} onChange={(event) => selectCourse(event.target.value)} data-testid="select-update-course-lessons">
            <option value="">Dərs seçin</option>
            {(coursesQuery.data ?? []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        </Field>
        <Field label="Müəllim seçimi" hint="Müəllim təyin edilməyibsə, boş saxlamaq üçün seçimi təmizləyin.">
          <div className="space-y-2" role="radiogroup" aria-label="Dərs müəllimi seçimi">
            {teachersQuery.isLoading ? (
              <div className="rounded-xl border border-dashed border-[hsl(var(--border))] px-3.5 py-3 text-sm text-[hsl(var(--muted-foreground))]">Müəllimlər yüklənir...</div>
            ) : teachersQuery.isError ? (
              <div className="rounded-xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.05)] px-3.5 py-3 text-sm text-[hsl(var(--destructive))]">Müəllimlər yüklənə bilmədi.</div>
            ) : teachersQuery.data?.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {teachersQuery.data.map((teacher) => {
                  const isSelected = instructor === teacher.displayName;
                  return (
                    <button
                      key={teacher.clerkUserId}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setInstructor(teacher.displayName)}
                      className={`focus-ring rounded-xl border px-3 py-2.5 text-left transition ${isSelected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary)/.55)] text-[hsl(var(--primary))] shadow-sm' : 'border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:border-[hsl(var(--primary)/.5)] hover:bg-[hsl(var(--muted)/.5)]'}`}
                      data-testid={`button-select-update-course-teacher-${teacher.clerkUserId}`}
                    >
                      <span className="block truncate text-sm font-bold">{teacher.displayName}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[hsl(var(--border))] px-3.5 py-3 text-sm text-[hsl(var(--muted-foreground))]">Sistemdə aktiv müəllim yoxdur.</div>
            )}
            {instructor && <button type="button" onClick={() => setInstructor('')} className="focus-ring text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]" data-testid="button-clear-update-course-teacher">Müəllim seçimini təmizlə</button>}
          </div>
          <input tabIndex={-1} className="sr-only" value={instructor} onChange={() => undefined} aria-label="Seçilmiş müəllim" data-testid="input-update-course-instructor" />
        </Field>
        <Field label="Ümumi dərs sayı">
          <input required min="0" type="number" className={inputClass} value={totalLessons} onChange={(event) => setTotalLessons(Number(event.target.value))} data-testid="input-update-course-total-lessons" />
        </Field>
        <button type="submit" className={buttonClass} disabled={!courseId || isSaving || coursesQuery.isLoading} data-testid="button-update-course-lessons">{isSaving ? 'Yenilənir...' : 'Yadda saxla'}</button>
      </div>
      <FormNotice text={notice} error={notice.includes('bil') || notice.includes('olmalıdır')} />
    </form>
  );
}

function CourseContentEditor({ initialCourseId, teacherOnly = false }: { initialCourseId?: string; teacherOnly?: boolean }) {
  const coursesQuery = useGetCourses();
  const resourcesQuery = useGetAdminResources();
  const teachersQuery = useGetAdminTeachers();
  const [termNumber, setTermNumber] = useState(1);
  const [courseId, setCourseId] = useState('');
  const [form, setForm] = useState(emptyCourseEdit);
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingTeacher, setIsAddingTeacher] = useState(false);
  const [newTeacherId, setNewTeacherId] = useState('');
  const [teacherCourseIds, setTeacherCourseIds] = useState<number[] | null>(teacherOnly ? null : []);
  const [teacherCoursesError, setTeacherCoursesError] = useState('');
  const queryClient = useQueryClient();
  const teacherCoursesLoading = teacherOnly && teacherCourseIds === null;

  useEffect(() => {
    if (!teacherOnly) return;
    setTeacherCoursesError('');
    setTeacherCourseIds(null);
    void fetch(apiUrl(`/admin/teacher-courses?termNumber=${termNumber}`))
      .then((response) => response.ok ? response.json() as Promise<Array<{ id: number }>> : response.json().then((result: { error?: string }) => Promise.reject(new Error(result.error || 'Müəllim dərsləri yüklənə bilmədi.'))))
      .then((courses) => setTeacherCourseIds(courses.map((course) => course.id)))
      .catch((error) => {
        setTeacherCourseIds([]);
        setTeacherCoursesError(error instanceof Error ? error.message : 'Müəllim dərsləri yüklənə bilmədi.');
      });
  }, [teacherOnly, termNumber]);

  const termCourseIds = new Set((resourcesQuery.data ?? []).filter((resource) => resource.termNumber === termNumber).map((resource) => resource.courseId));
  const availableCourses = (coursesQuery.data ?? [])
    .filter((course) => termCourseIds.has(course.id))
    .filter((course) => !teacherOnly || teacherCourseIds?.includes(course.id));
  const selectedCourseTeacherIds = new Set(
    (resourcesQuery.data ?? [])
      .filter((resource) => resource.termNumber === termNumber && String(resource.courseId) === courseId && resource.teacherClerkUserId)
      .map((resource) => resource.teacherClerkUserId),
  );
  const availableCourseTeachers = (teachersQuery.data ?? []).filter((teacher) => selectedCourseTeacherIds.has(teacher.clerkUserId));
  const availableAdditionalTeachers = (teachersQuery.data ?? []).filter((teacher) => !selectedCourseTeacherIds.has(teacher.clerkUserId));

  const changeTerm = (value: string) => {
    setTermNumber(Number(value));
    setCourseId('');
    setForm(emptyCourseEdit);
    setNotice('');
  };

  const loadCourse = async (value: string) => {
    setCourseId(value);
    setNotice('');
    if (!value) {
      setForm(emptyCourseEdit);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl(`/admin/courses/${value}`));
      const course = await response.json() as {
        title?: string; category?: string; instructor?: string; totalLessons?: number; color?: string; credits?: number; hours?: number;
        description?: string; curriculum?: string[]; lessonDescription?: string; nextLesson?: string | null;
        pdfUrl?: string | null; telegramUrl?: string | null; zoomUrl?: string | null; googleMeetUrl?: string | null; lessonUrl?: string | null; lessonDays?: string[]; lessonTime?: string | null; error?: string;
      };
      if (!response.ok) throw new Error(course.error || 'Dərs məlumatları yüklənə bilmədi.');
      setForm({
        title: course.title ?? '',
        category: course.category ?? '',
        instructor: course.instructor ?? '',
        totalLessons: course.totalLessons ?? 0,
        credits: course.credits ?? 3,
        hours: course.hours ?? 45,
        color: course.color ?? 'teal',
        description: course.description ?? '',
        curriculum: course.curriculum?.join('\n') ?? '',
        lessonDescription: course.lessonDescription ?? '',
         lessonDays: course.lessonDays ?? [],
         lessonTime: course.lessonTime ?? '',
        nextLesson: course.nextLesson ?? '',
        pdfUrl: course.pdfUrl ?? '',
        telegramUrl: course.telegramUrl ?? '',
        zoomUrl: course.zoomUrl ?? '',
        googleMeetUrl: course.googleMeetUrl ?? '',
        lessonUrl: course.lessonUrl ?? '',
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Dərs məlumatları yüklənə bilmədi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialCourseId) void loadCourse(initialCourseId);
  }, [initialCourseId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    setIsSaving(true);
    try {
      const response = await fetch(apiUrl(`/admin/courses/${courseId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          category: form.title,
          instructor: form.instructor,
          totalLessons: form.totalLessons,
          credits: form.credits,
          hours: form.hours,
          color: form.color,
          description: form.description,
          curriculum: form.curriculum.split('\n'),
          lessonDescription: form.lessonDescription,
          nextLesson: form.nextLesson || null,
          pdfUrl: form.pdfUrl || null,
          telegramUrl: form.telegramUrl || null,
          zoomUrl: form.zoomUrl || null,
          googleMeetUrl: form.googleMeetUrl || null,
          lessonUrl: form.lessonUrl || null,
           lessonDays: form.lessonDays,
           lessonTime: form.lessonTime || null,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Dərs mətnləri yadda saxlanıla bilmədi.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetCoursesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
      ]);
      setNotice('Dərs mətnləri uğurla yeniləndi.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Dərs mətnləri yadda saxlanıla bilmədi.');
    } finally {
      setIsSaving(false);
    }
  };

  const addTeacherToCourse = async () => {
    if (!courseId || !newTeacherId) return;
    const teacher = teachersQuery.data?.find((item) => item.clerkUserId === newTeacherId);
    if (!teacher) return;
    setIsAddingTeacher(true);
    setNotice('');
    try {
      const response = await fetch(apiUrl('/admin/resources'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: Number(courseId),
          termNumber,
          kind: ResourceInputKind.material,
          title: form.title,
          body: form.description,
          url: form.pdfUrl || null,
          lessonDays: form.lessonDays,
          lessonTime: form.lessonTime || null,
          isMandatory: true,
          teacherClerkUserId: teacher.clerkUserId,
          studentCapacity: 0,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Müəllim bu dərsə əlavə edilə bilmədi.');
      setNewTeacherId('');
      setNotice(`${teacher.displayName} müəllimi ${termNumber}-ci semestr üzrə dərsə əlavə edildi.`);
      await queryClient.invalidateQueries({ queryKey: getGetAdminResourcesQueryKey() });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Müəllim dərsə əlavə edilə bilmədi.');
    } finally {
      setIsAddingTeacher(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-8 border-t border-[hsl(var(--border))] pt-6" data-testid="form-edit-course-content">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Dərs məzmununu redaktə et</p>
        <h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Mövcud dərsi redaktə et</h3>
      </div>
      <Field label="Semestr">
        <select required className={inputClass} value={termNumber} onChange={(event) => changeTerm(event.target.value)} disabled={resourcesQuery.isLoading} data-testid="select-edit-course-term">
          {Array.from({ length: 8 }, (_, index) => index + 1).map((term) => <option key={term} value={term}>{term}-ci semestr</option>)}
        </select>
      </Field>
      {!initialCourseId && <Field label="Dərs seçin">
        {teacherCoursesLoading || resourcesQuery.isLoading ? <p className="rounded-xl border border-dashed border-[hsl(var(--border))] px-3.5 py-3 text-sm text-[hsl(var(--muted-foreground))]">Dərslər yüklənir...</p> : teacherCoursesError ? <p className="rounded-xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.05)] px-3.5 py-3 text-sm text-[hsl(var(--destructive))]">{teacherCoursesError}</p> : <select required className={inputClass} value={courseId} onChange={(event) => void loadCourse(event.target.value)} data-testid="select-edit-course-content">
          <option value="">Dərs seçin</option>
          {availableCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>}
      </Field>}
      {!teacherCoursesLoading && !resourcesQuery.isLoading && !teacherCoursesError && availableCourses.length === 0 && <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{termNumber}-ci semestr üçün dərs tapılmadı.</p>}
      {courseId && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
             <Field label="Dərsin adı"><input required className={inputClass} value={form.title} disabled={isLoading} onChange={(event) => setForm({ ...form, title: event.target.value })} data-testid="input-edit-course-title" /></Field>
            <Field label="Müəllimlər"><select className={inputClass} value={form.instructor} disabled={isLoading || teachersQuery.isLoading || resourcesQuery.isLoading} onChange={(event) => setForm({ ...form, instructor: event.target.value })} data-testid="select-edit-course-instructor"><option value="">Müəllim seçin</option>{availableCourseTeachers.map((teacher) => <option key={teacher.clerkUserId} value={teacher.displayName}>{teacher.displayName}</option>)}</select>
              <div className="mt-2 flex gap-2">
                <select className={`${inputClass} min-w-0 flex-1`} value={newTeacherId} disabled={isLoading || isAddingTeacher || teachersQuery.isLoading || resourcesQuery.isLoading} onChange={(event) => setNewTeacherId(event.target.value)} data-testid="select-add-course-teacher">
                  <option value="">Bu semestrə başqa müəllim əlavə et</option>
                  {availableAdditionalTeachers.map((teacher) => <option key={teacher.clerkUserId} value={teacher.clerkUserId}>{teacher.displayName}</option>)}
                </select>
                <button type="button" className={`${buttonClass} shrink-0 px-3`} disabled={!newTeacherId || isAddingTeacher} onClick={() => void addTeacherToCourse()} data-testid="button-add-course-teacher">{isAddingTeacher ? 'Əlavə olunur...' : 'Əlavə et'}</button>
              </div>
            </Field>
            <Field label="Ümumi dərs sayı"><input required min="0" type="number" className={inputClass} value={form.totalLessons} disabled={isLoading} onChange={(event) => setForm({ ...form, totalLessons: Number(event.target.value) })} data-testid="input-edit-course-total-lessons" /></Field>
          </div>
          <Field label="Dərs haqqında">
            <textarea required rows={4} className={`${inputClass} resize-y`} value={form.description} disabled={isLoading} onChange={(event) => setForm({ ...form, description: event.target.value })} data-testid="textarea-edit-course-description" />
          </Field>
          <Field label="Tədris proqramı" hint="Hər mövzunu yeni sətirdə yazın.">
            <textarea rows={5} className={`${inputClass} resize-y`} value={form.curriculum} disabled={isLoading} onChange={(event) => setForm({ ...form, curriculum: event.target.value })} data-testid="textarea-edit-course-curriculum" />
            <button type="submit" className={`${buttonClass} mt-3`} disabled={isLoading || isSaving} data-testid="button-save-course-curriculum">{isSaving ? 'Yadda saxlanılır...' : 'Tədris proqramını yadda saxla'}</button>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Növbəti dərs">
              <input className={inputClass} value={form.nextLesson} disabled={isLoading} onChange={(event) => setForm({ ...form, nextLesson: event.target.value })} data-testid="input-edit-course-next-lesson" />
            </Field>
            <Field label="Növbəti dərsin təsviri">
              <textarea required rows={3} className={`${inputClass} resize-y`} value={form.lessonDescription} disabled={isLoading} onChange={(event) => setForm({ ...form, lessonDescription: event.target.value })} data-testid="textarea-edit-course-lesson-description" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="PDF linki"><input type="url" className={inputClass} value={form.pdfUrl} disabled={isLoading} onChange={(event) => setForm({ ...form, pdfUrl: event.target.value })} /></Field>
            <Field label="Telegram linki"><input type="url" className={inputClass} value={form.telegramUrl} disabled={isLoading} onChange={(event) => setForm({ ...form, telegramUrl: event.target.value })} /></Field>
            <Field label="Zoom linki"><input type="url" className={inputClass} value={form.zoomUrl} disabled={isLoading} onChange={(event) => setForm({ ...form, zoomUrl: event.target.value })} /></Field>
            <Field label="Google Meet linki"><input type="url" className={inputClass} value={form.googleMeetUrl} disabled={isLoading} onChange={(event) => setForm({ ...form, googleMeetUrl: event.target.value })} /></Field>
          </div>
          <div className="flex justify-end"><button type="submit" className={buttonClass} disabled={isLoading || isSaving} data-testid="button-save-course-content">{isSaving ? 'Yadda saxlanılır...' : 'Bütün dərs məlumatlarını yadda saxla'}</button></div>
        </div>
      )}
      <FormNotice text={notice} error={notice.includes('bil') || notice.includes('saxlanıla')} />
    </form>
  );
}

function CourseCatalog({ onEdit }: { onEdit: (courseId: string) => void }) {
  const coursesQuery = useGetCourses();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const deleteCourse = async (courseId: number, title: string) => {
    if (!window.confirm(`“${title}” dərsini və ona bağlı material, qiymət və davamiyyət məlumatlarını silmək istəyirsiniz?`)) return;
    setDeletingId(courseId);
    const response = await fetch(apiUrl(`/admin/courses/${courseId}`), { method: 'DELETE' });
    if (response.ok) await queryClient.invalidateQueries({ queryKey: getGetCoursesQueryKey() });
    setDeletingId(null);
  };
  return (
    <div className="mb-8 border-b border-[hsl(var(--border))] pb-7" data-testid="section-admin-course-catalog">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Akademiyanın dərsləri</p>
          <h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Mövcud dərslər</h3>
        </div>
        <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{coursesQuery.data?.length ?? 0} dərs</span>
      </div>
      {coursesQuery.isLoading ? (
        <p className="rounded-xl bg-[hsl(var(--muted)/.45)] p-4 text-xs text-[hsl(var(--muted-foreground))]">Dərslər yüklənir...</p>
      ) : coursesQuery.data?.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {coursesQuery.data.map((course) => (
            <article key={course.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.3)] p-4 transition hover:-translate-y-0.5 hover:border-[hsl(var(--secondary-foreground)/.45)] hover:shadow-[var(--shadow-sm)]" data-testid={`admin-course-${course.id}`}>
              <button type="button" onClick={() => onEdit(String(course.id))} className="w-full text-left"><p className="font-serif text-lg text-[hsl(var(--primary))]">{course.title}</p>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{course.instructor || 'Müəllim təyin edilməyib'}</p>
              <p className="mt-3 text-[11px] font-semibold text-[hsl(var(--secondary-foreground))]">0 / {course.totalLessons} dərs · tələbə irəliləyişi başlanmayıb</p>
              <p className="mt-3 text-[11px] font-bold text-[hsl(var(--primary))]">Redaktə etmək üçün kliklə</p>
              </button>
              <button type="button" onClick={() => void deleteCourse(course.id, course.title)} disabled={deletingId === course.id} className="mt-3 rounded-lg border border-[hsl(var(--destructive)/.3)] px-3 py-2 text-xs font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)] disabled:opacity-50" data-testid={`button-delete-course-${course.id}`}>{deletingId === course.id ? 'Silinir...' : 'Dərsi sil'}</button>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-4 text-xs text-[hsl(var(--muted-foreground))]">Hələ dərs əlavə edilməyib.</p>
      )}
    </div>
  );
}

function ResourceForm({ onSaved, teacherOnly = false, teacherName }: { onSaved: () => void; teacherOnly?: boolean; teacherName?: string }) {
  type ResourceStudent = { profileId: number; studentNumber: number; firstName: string; lastName: string };
  const coursesQuery = useGetCourses();
  const resourcesQuery = useGetAdminResources();
  const teachersQuery = useGetAdminTeachers();
  const { user } = useUser();
  const [form, setForm] = useState<Omit<ResourceInput, 'courseId' | 'teacherClerkUserId'> & { courseId: string; teacherClerkUserId?: string }>({ courseId: '', termNumber: 1, kind: ResourceInputKind.material, title: '', body: '', url: '', lessonDays: [], lessonTime: '', isMandatory: true, teacherClerkUserId: '', studentCapacity: 0 });
  const [isNewSubject, setIsNewSubject] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [courseTotalLessons, setCourseTotalLessons] = useState(0);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAddingAssignment, setIsAddingAssignment] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSemesterDatesOpen, setIsSemesterDatesOpen] = useState(false);
  const [showSelectedSubjects, setShowSelectedSubjects] = useState(false);
  const [isCourseCardOpen, setIsCourseCardOpen] = useState(false);
  const [courseLinks, setCourseLinks] = useState({ pdfUrl: '', telegramUrl: '', zoomUrl: '', googleMeetUrl: '', lessonUrl: '' });
  const [cardContent, setCardContent] = useState({ title: '', description: '', nextLesson: '', lessonDescription: '', curriculum: '' });
  const [resourceStudents, setResourceStudents] = useState<ResourceStudent[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [unavailableStudentIds, setUnavailableStudentIds] = useState<number[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [isSavingStudents, setIsSavingStudents] = useState(false);
  const [isStudentSelectorOpen, setIsStudentSelectorOpen] = useState(true);
  const [selectedSubjects, setSelectedSubjects] = useState<Array<{ id: number; title: string; instructor?: string | null }>>([]);
  const [focusedSelectedSubjectId, setFocusedSelectedSubjectId] = useState<number | null>(null);
  const [isSelectedEditorOpen, setIsSelectedEditorOpen] = useState(false);
  const [selectedEditorPosition, setSelectedEditorPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [activeTerms, setActiveTerms] = useState<number[]>([1, 2, 3, 4]);
  const [expandedSelectedTerm, setExpandedSelectedTerm] = useState<number | null>(null);
  const mutation = useCreateResource();
  const createCourseMutation = useCreateCourse();
  const queryClient = useQueryClient();
  const ownTeacherName = teacherName?.trim() || user?.fullName?.trim() || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.username || 'Müəllim';
  useEffect(() => {
    if (!teacherOnly || !user?.id) return;
    setForm((current) => current.teacherClerkUserId === user.id ? current : { ...current, teacherClerkUserId: user.id });
  }, [teacherOnly, user?.id]);
  useEffect(() => {
    if (editingId === null) return;
    const resource = resourcesQuery.data?.find((item) => item.id === editingId);
    if (resource) setForm((current) => ({ ...current, teacherClerkUserId: resource.teacherClerkUserId ?? '' }));
  }, [editingId, resourcesQuery.data]);
  useEffect(() => {
    if (editingId !== null || isAddingAssignment || !form.courseId) return;
    const course = coursesQuery.data?.find((item) => item.id === Number(form.courseId));
    const semesterResource = resourcesQuery.data?.find((item) => item.courseId === Number(form.courseId) && item.termNumber === form.termNumber);
    if (semesterResource?.teacherClerkUserId) {
      setForm((current) => current.teacherClerkUserId === semesterResource.teacherClerkUserId ? current : { ...current, teacherClerkUserId: semesterResource.teacherClerkUserId ?? '' });
      return;
    }
    if (form.termNumber === 1) {
      const instructor = course?.instructor?.trim().toLocaleLowerCase('az-AZ');
      const matchingTeacher = instructor
        ? teachersQuery.data?.find((teacher) => teacher.displayName.trim().toLocaleLowerCase('az-AZ') === instructor)
        : undefined;
      setForm((current) => current.teacherClerkUserId === (matchingTeacher?.clerkUserId ?? '') ? current : { ...current, teacherClerkUserId: matchingTeacher?.clerkUserId ?? '' });
      return;
    }
    setForm((current) => current.teacherClerkUserId ? { ...current, teacherClerkUserId: '' } : current);
  }, [coursesQuery.data, editingId, isAddingAssignment, form.courseId, form.termNumber, resourcesQuery.data, teachersQuery.data]);
  useEffect(() => {
    if (isAddingAssignment) return;
    const course = coursesQuery.data?.find((item) => item.id === Number(form.courseId));
    if (course) {
      const courseCard = course as typeof course & { description?: string | null; nextLesson?: string | null; lessonDescription?: string | null; curriculum?: string[] | null };
      setCourseTotalLessons(course.totalLessons ?? 0);
      setCardContent({
        title: courseCard.title ?? '',
        description: courseCard.description ?? '',
        nextLesson: courseCard.nextLesson ?? '',
        lessonDescription: courseCard.lessonDescription ?? '',
        curriculum: courseCard.curriculum?.join('\n') ?? '',
      });
      setCourseLinks({
        pdfUrl: course.pdfUrl ?? '',
        telegramUrl: course.telegramUrl ?? '',
        zoomUrl: course.zoomUrl ?? '',
        googleMeetUrl: course.googleMeetUrl ?? '',
        lessonUrl: course.lessonUrl ?? '',
      });
    }
  }, [coursesQuery.data, form.courseId, isAddingAssignment]);
  useEffect(() => {
    if (!form.courseId) {
      setResourceStudents([]);
      setSelectedStudentIds([]);
      return;
    }
    let cancelled = false;
    setStudentsLoading(true);
    const courseResources = (resourcesQuery.data ?? []).filter((item) => item.courseId === Number(form.courseId) && item.termNumber === form.termNumber);
    const resource = editingId !== null ? courseResources.find((item) => item.id === editingId) : undefined;
    void Promise.all([
      fetch(apiUrl(`/admin/courses/${form.courseId}/students?termNumber=${form.termNumber}`)).then((response) => response.ok ? response.json() as Promise<ResourceStudent[]> : Promise.reject()),
      ...courseResources.map((courseResource) => fetch(apiUrl(`/admin/resources/${courseResource.id}/students`)).then((response) => response.ok ? response.json() as Promise<{ selectedProfileIds: number[]; unavailableProfileIds?: number[] }> : Promise.reject())),
    ]).then(([students, ...assignments]) => {
      if (cancelled) return;
      setResourceStudents(students);
      const currentAssignments = resource ? assignments[courseResources.findIndex((item) => item.id === resource.id)] : undefined;
      const selectedIds = currentAssignments?.selectedProfileIds ?? [];
      const unavailableIds = assignments
        .filter((_, index) => courseResources[index]?.id !== resource?.id)
        .flatMap((assignment) => assignment?.selectedProfileIds ?? []);
      setUnavailableStudentIds(Array.from(new Set(unavailableIds)));
      const availableIds = new Set(students.map((student) => student.profileId));
      setSelectedStudentIds(selectedIds.filter((id) => availableIds.has(id)));
    }).catch(() => {
      if (!cancelled) {
        setResourceStudents([]);
        setSelectedStudentIds([]);
        setUnavailableStudentIds([]);
      }
    }).finally(() => {
      if (!cancelled) setStudentsLoading(false);
    });
    return () => { cancelled = true; };
  }, [form.courseId, form.termNumber, resourcesQuery.data]);
  useEffect(() => {
    void fetch(apiUrl(`/admin/selected-courses?termNumber=${form.termNumber}`))
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setSelectedSubjects(data))
      .catch(() => setSelectedSubjects([]));
  }, [form.termNumber]);
  useEffect(() => {
    const section = document.querySelector<HTMLElement>('[data-testid="section-selected-subjects"]');
    section?.setAttribute('data-focused', focusedSelectedSubjectId === null ? 'false' : 'true');
    section?.setAttribute('data-semester-open', expandedSelectedTerm === null ? 'false' : 'true');
    document.querySelectorAll<HTMLElement>('[id^="selected-course-"]').forEach((element) => {
      const isFocused = element.id === `selected-course-${focusedSelectedSubjectId}`;
      element.setAttribute('aria-pressed', String(isFocused));
    });
  }, [focusedSelectedSubjectId, selectedSubjects, showSelectedSubjects, expandedSelectedTerm]);
  useEffect(() => {
    void fetch(apiUrl('/admin/course-activation'))
      .then((response) => response.ok ? response.json() as Promise<{ activeTermNumbers: number[] }> : Promise.reject())
      .then((data) => {
        const terms = data.activeTermNumbers.filter((term) => Number.isInteger(term) && term >= 1 && term <= 8);
        setActiveTerms(terms);
        setForm((current) => terms.includes(current.termNumber) || terms.length === 0 ? current : { ...current, termNumber: terms[0] });
      })
      .catch(() => undefined);
  }, []);

  const uploadPdf = async (file: File) => {
    const request = await fetch(apiUrl('/admin/courses/upload-url'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, size: file.size, contentType: 'application/pdf' }),
    });
    const upload = await request.json() as { uploadURL?: string; objectPath?: string; error?: string };
    if (!request.ok || !upload.uploadURL || !upload.objectPath) throw new Error(upload.error || 'PDF yükləməyə hazırlıq alınmadı.');
    const uploaded = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: file });
    if (!uploaded.ok) throw new Error('PDF faylı yüklənə bilmədi.');
    return upload.objectPath;
  };
  const saveStudentAssignments = async () => {
    const resource = editingId !== null
      ? editingId
      : resourcesQuery.data?.find((item) => item.courseId === Number(form.courseId) && item.termNumber === form.termNumber)?.id;
    if (!resource) {
      setNotice('Əvvəlcə dərsi əlavə edin, sonra tələbələri qrupa əlavə edin.');
      return;
    }
    setIsSavingStudents(true);
    try {
      const response = await fetch(apiUrl(`/admin/resources/${resource}/students`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds: selectedStudentIds }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; selectedProfileIds?: number[] };
      if (!response.ok) throw new Error(result.error || 'Tələbə seçimi yadda saxlanıla bilmədi.');
      setSelectedStudentIds(result.selectedProfileIds ?? selectedStudentIds);
      setNotice('Tələbələr dərs qrupuna əlavə edildi.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Tələbə seçimi yadda saxlanıla bilmədi.');
    } finally {
      setIsSavingStudents(false);
    }
  };
  const editSelectedSubject = (course: { id: number; title: string; instructor?: string | null }) => {
    if (focusedSelectedSubjectId === course.id) {
      setFocusedSelectedSubjectId(null);
      setEditingId(null);
      setSelectedEditorPosition(null);
      setIsSelectedEditorOpen(false);
      return;
    }
    setExpandedSelectedTerm(form.termNumber);
    setIsSelectedEditorOpen(true);
    setFocusedSelectedSubjectId(course.id);
    const resource = resourcesQuery.data?.find((item) => item.courseId === course.id && item.termNumber === form.termNumber);
    if (resource) {
      setIsAddingAssignment(false);
      setEditingId(resource.id);
      setForm({ courseId: String(resource.courseId), termNumber: resource.termNumber, kind: resource.kind as ResourceInputKind, title: resource.title, body: resource.body, url: resource.url ?? '', lessonDays: resource.lessonDays, lessonTime: resource.lessonTime ?? '', isMandatory: resource.isMandatory, teacherClerkUserId: resource.teacherClerkUserId ?? '', studentCapacity: resource.studentCapacity });
    } else {
      setIsAddingAssignment(false);
      setEditingId(null);
      setIsNewSubject(false);
      setForm((current) => ({ ...current, courseId: String(course.id), termNumber: form.termNumber }));
    }
    window.setTimeout(() => {
      const card = document.getElementById(`selected-course-${course.id}`) ?? Array.from(document.querySelectorAll<HTMLElement>('[data-testid="section-selected-subjects-final"] div.mt-4 button')).find((element) => element.textContent?.includes(course.title));
      if (!card) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      window.setTimeout(() => {
        const rect = card.getBoundingClientRect();
        setSelectedEditorPosition({ top: rect.bottom, left: Math.max(12, rect.left), width: Math.min(rect.width, window.innerWidth - 24) });
        document.getElementById('form-create-resource')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    }, 0);
  };
  const deleteSelectedSubject = async (course: { id: number; title: string }) => {
    if (!window.confirm(`“${course.title}” dərsini silmək istədiyinizə əminsiniz? Bu əməliyyat dərsin bütün məlumatlarını siləcək.`)) return;
    const response = await fetch(apiUrl(`/admin/courses/${course.id}`), { method: 'DELETE' });
    if (!response.ok) { setNotice('Dərs silinə bilmədi.'); return; }
    setFocusedSelectedSubjectId(null);
    await queryClient.invalidateQueries({ queryKey: getGetCoursesQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getGetAdminResourcesQueryKey() });
    setNotice('Dərs silindi.');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    setIsSaving(true);
    try {
      if (!form.lessonDays.length || !form.lessonTime) throw new Error('Həftənin ən azı bir gününü və dərs saatını seçin.');
      let courseId = Number(form.courseId);
      let resourceUrl = form.url || null;
      let uploadedPdfUrl: string | null = null;
      if (isNewSubject && editingId === null) {
        if (!subjectName.trim()) throw new Error('Yeni dərsin adını yazın.');
        uploadedPdfUrl = pdfFile ? await uploadPdf(pdfFile) : null;
        const course = await createCourseMutation.mutateAsync({
          data: {
            title: subjectName.trim(),
            category: 'İslam elmləri',
            instructor: '',
            totalLessons: courseTotalLessons,
            credits: 3,
            hours: 45,
            color: 'teal',
            progress: 0,
            completedLessons: 0,
            pdfUrl: uploadedPdfUrl,
            telegramUrl: courseLinks.telegramUrl || null,
            zoomUrl: courseLinks.zoomUrl || null,
            googleMeetUrl: courseLinks.googleMeetUrl || null,
            lessonUrl: courseLinks.lessonUrl || null,
            description: cardContent.description || `${subjectName.trim()} dərsi üzrə tədris materialları.`,
            curriculum: cardContent.curriculum.split('\n').map((item) => item.trim()).filter(Boolean),
            lessonDescription: cardContent.lessonDescription || 'Bu dərs üçün növbəti dərs müəyyən edilməyib.',
            nextLesson: cardContent.nextLesson || null,
            lessonDays: form.lessonDays,
            lessonTime: form.lessonTime,
          },
        });
        courseId = course.id;
      }
      if (pdfFile && uploadedPdfUrl === null) uploadedPdfUrl = await uploadPdf(pdfFile);
       if (uploadedPdfUrl) resourceUrl = uploadedPdfUrl;
        const teacherClerkUserId = teacherOnly ? user?.id : form.teacherClerkUserId;
        if (!teacherClerkUserId) throw new Error('Müəllim hesabı yüklənir. Bir az sonra yenidən cəhd edin.');
        // A newly created course already contains the card fields above.
        // Do not PATCH it before its first resource assignment exists: the
        // server correctly restricts course edits to assigned teachers.
        if (!(editingId === null && (isNewSubject || isAddingAssignment))) {
          const courseUpdateResponse = await fetch(apiUrl(`/admin/courses/${courseId}`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               ...((isNewSubject ? subjectName : cardContent.title).trim() ? { title: (isNewSubject ? subjectName : cardContent.title).trim() } : {}),
               description: cardContent.description,
               curriculum: cardContent.curriculum.split('\n').map((item) => item.trim()).filter(Boolean),
               lessonDescription: cardContent.lessonDescription,
               nextLesson: cardContent.nextLesson || null,
              pdfUrl: uploadedPdfUrl ?? (courseLinks.pdfUrl || null),
              telegramUrl: courseLinks.telegramUrl || null,
              zoomUrl: courseLinks.zoomUrl || null,
              googleMeetUrl: courseLinks.googleMeetUrl || null,
              lessonUrl: courseLinks.lessonUrl || null,
            }),
          });
          const courseUpdateResult = await courseUpdateResponse.json().catch(() => ({})) as { error?: string };
          if (!courseUpdateResponse.ok) throw new Error(courseUpdateResult.error || 'Dərs linkləri yadda saxlanıla bilmədi.');
        }
        const data = { courseId, termNumber: form.termNumber, kind: form.kind, title: form.title, body: form.body, url: resourceUrl, lessonDays: form.lessonDays, lessonTime: form.lessonTime, isMandatory: form.isMandatory, teacherClerkUserId, studentCapacity: form.studentCapacity };
       let savedResourceId = editingId;
       if (editingId === null) {
         const createdResource = await mutation.mutateAsync({ data });
         savedResourceId = createdResource.id;
       } else {
        const response = await fetch(apiUrl(`/admin/resources/${editingId}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const result = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(result.error || 'Dərs materialı yenilənə bilmədi.');
      }
       if (savedResourceId !== null) {
         const studentsResponse = await fetch(apiUrl(`/admin/resources/${savedResourceId}/students`), {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ profileIds: selectedStudentIds }),
         });
         const studentsResult = await studentsResponse.json().catch(() => ({})) as { error?: string };
         if (!studentsResponse.ok) throw new Error(studentsResult.error || 'Tələbə seçimi yadda saxlanıla bilmədi.');
       }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetAdminResourcesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetCoursesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetCourseQueryKey(Number(form.courseId)) }),
      ]);
       setForm({ courseId: form.courseId, termNumber: form.termNumber, kind: form.kind, title: '', body: '', url: '', lessonDays: form.lessonDays, lessonTime: form.lessonTime, isMandatory: form.isMandatory, teacherClerkUserId: form.teacherClerkUserId, studentCapacity: form.studentCapacity });
      setSubjectName('');
       setCourseTotalLessons(0);
       setCardContent({ title: '', description: '', nextLesson: '', lessonDescription: '', curriculum: '' });
      setPdfFile(null);
      if (pdfInput.current) pdfInput.current.value = '';
      setIsNewSubject(false);
       setSelectedStudentIds([]);
      setEditingId(null);
      setNotice(editingId === null ? 'Semestr dərsi və kitab məlumatı əlavə edildi.' : 'Semestr dərsi yeniləndi.');
      onSaved();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Dərs materialı yadda saxlanılmadı.'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="flex flex-col" data-testid="section-semester-management">
    <form onSubmit={submit} className="order-2 space-y-5" data-testid="form-create-resource">
      <p className="rounded-xl border border-[hsl(var(--accent)/.7)] bg-[hsl(var(--accent)/.12)] p-3 text-xs font-semibold text-[hsl(var(--primary))]">Material linkləri əlavə olunduqdan 2 saat sonra tələbələr üçün avtomatik gizlənir. Linki yenilədikdə müddət yenidən başlayır.</p>
      {editingId !== null && (() => {
        const editedResource = resourcesQuery.data?.find((resource) => resource.id === editingId);
        if (!editedResource?.url || !editedResource.expiresAt) return null;
        const expired = new Date(editedResource.expiresAt).getTime() <= Date.now();
        return <p className={`text-xs font-bold ${expired ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--secondary-foreground))]'}`}>{expired ? 'Bu material linkinin müddəti bitib.' : `Link tələbə üçün ${new Date(editedResource.expiresAt).toLocaleString('az-AZ')} tarixinədək görünür.`}</p>;
      })()}
      <Field label="Semestr">
        <select required className={inputClass} value={form.termNumber} onChange={(e) => setForm({ ...form, termNumber: Number(e.target.value) })} data-testid="select-resource-semester">
          {activeTerms.map((term) => <option key={term} value={term}>{term}-{termSuffixes[term] ?? 'ci'} Semestr</option>)}
        </select>
      </Field>
      <div><div className="flex items-start justify-between gap-3"><div>{editingId !== null && <h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Dərs və kitab məlumatını redaktə et</h3>}</div>{focusedSelectedSubjectId !== null && <button type="button" onClick={() => { setFocusedSelectedSubjectId(null); setEditingId(null); setSelectedEditorPosition(null); setIsSelectedEditorOpen(false); }} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Düzənləməni bağla"><X size={18} /></button>}</div></div>
       {!isNewSubject && <Field label="Dərsin adı">
        <select required={editingId === null} className={inputClass} value={form.courseId} onChange={(e) => { setIsAddingAssignment(Boolean(e.target.value)); setEditingId(null); setForm({ ...form, courseId: e.target.value, teacherClerkUserId: '', title: '', body: '', url: '' }); setCardContent({ title: '', description: '', nextLesson: '', lessonDescription: '', curriculum: '' }); setCourseLinks({ pdfUrl: '', telegramUrl: '', zoomUrl: '', googleMeetUrl: '', lessonUrl: '' }); }} data-testid="select-resource-course">
           <option value="">Dərs seçin</option>
          {(coursesQuery.data ?? []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </Field>}
      {form.courseId && (() => {
        const assignedTeachers = (resourcesQuery.data ?? [])
           .filter((resource) => resource.courseId === Number(form.courseId) && resource.termNumber === form.termNumber)
          .map((resource) => {
            const teacherName = teachersQuery.data
              ? teachersQuery.data.find((teacher) => teacher.clerkUserId === resource.teacherClerkUserId)?.displayName
              : resource.teacherName
              || 'Müəllim təyin edilməyib';
            return `${teacherName} · ${resource.termNumber}-${termSuffixes[resource.termNumber] ?? 'ci'} semestr`;
          })
          .filter((value, index, values) => values.indexOf(value) === index);
        return (
          <div className="rounded-xl border border-[hsl(var(--accent)/.7)] bg-[hsl(var(--accent)/.12)] p-3" data-testid="section-course-assigned-teachers">
             <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black text-[hsl(var(--primary))]">Bu dərs üzrə seçilmiş müəllimlər · {form.termNumber}-ci semestr</p><button type="button" className="focus-ring rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-[11px] font-bold text-[hsl(var(--primary-foreground))]" onClick={() => { setIsAddingAssignment(true); setEditingId(null); setForm((current) => ({ ...current, courseId: String(current.courseId), termNumber: form.termNumber, title: '', body: '', url: '', teacherClerkUserId: '' })); setSelectedStudentIds([]); setNotice('Yeni müəllim təyinatı üçün məlumatları doldurun.'); }} data-testid="button-add-another-course-teacher">+ Başqa müəllim əlavə et</button></div>
             {assignedTeachers.length > 0
               ? <div className="mt-2 flex flex-wrap gap-2">{assignedTeachers.map((teacher) => <span key={teacher} className="rounded-lg bg-[hsl(var(--card))] px-3 py-2 text-xs font-semibold text-[hsl(var(--primary))]">{teacher}</span>)}</div>
               : <p className="mt-2 text-xs font-semibold text-[hsl(var(--muted-foreground))]">Bu semestr üçün bu dərsə hələ müəllim seçilməyib.</p>}
          </div>
        );
      })()}
      {editingId === null && <button type="button" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" onClick={() => { setIsNewSubject((current) => !current); setForm({ ...form, courseId: '' }); }}>{isNewSubject ? 'Mövcud dərsi seç' : '+ Yeni dərs adı əlavə et'}</button>}
      {isNewSubject && <Field label="Dərsin adı">
        <input required className={inputClass} value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Dərsin adını yazın" data-testid="input-resource-course-title" />
      </Field>}
      <Field label="Dərs sayı" hint="0 və ya daha böyük tam ədəd">
        <input min="0" step="1" type="number" className={inputClass} value={courseTotalLessons} onChange={(event) => setCourseTotalLessons(Math.max(0, Math.trunc(Number(event.target.value) || 0)))} data-testid="input-resource-course-total-lessons" />
      </Field>
      {(isNewSubject || form.courseId) && <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] p-4" data-testid="section-course-card-content">
        <button type="button" onClick={() => setIsCourseCardOpen((open) => !open)} className="focus-ring flex w-full items-center justify-between gap-3 text-left text-xs font-black uppercase tracking-[.12em] text-[hsl(var(--secondary-foreground))]" aria-expanded={isCourseCardOpen} data-testid="button-toggle-course-card">
          <span>Dərs kartı</span><ChevronDown size={16} className={`transition-transform ${isCourseCardOpen ? 'rotate-180' : ''}`} />
        </button>
        {isCourseCardOpen && <div className="mt-4 space-y-4">
        <Field label="Dərsin təsviri">
          <textarea rows={3} className={`${inputClass} resize-y`} value={cardContent.description} onChange={(event) => setCardContent({ ...cardContent, description: event.target.value })} placeholder="Tələbə kartında görünəcək qısa təsvir" data-testid="textarea-resource-course-description" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Növbəti dərs"><input className={inputClass} value={cardContent.nextLesson} onChange={(event) => setCardContent({ ...cardContent, nextLesson: event.target.value })} data-testid="input-resource-next-lesson" /></Field>
          <Field label="Növbəti dərsin təsviri"><textarea rows={2} className={`${inputClass} resize-y`} value={cardContent.lessonDescription} onChange={(event) => setCardContent({ ...cardContent, lessonDescription: event.target.value })} data-testid="textarea-resource-lesson-description" /></Field>
        </div>
        <Field label="Tədris proqramı" hint="Hər mövzunu yeni sətirdə yazın.">
          <textarea rows={5} className={`${inputClass} resize-y`} value={cardContent.curriculum} onChange={(event) => setCardContent({ ...cardContent, curriculum: event.target.value })} placeholder={'Mövzu 1\nMövzu 2\nMövzu 3'} data-testid="textarea-resource-course-curriculum" />
        </Field>
        </div>}
      </div>}
      <Field label="Müəllim" hint={teacherOnly ? 'Bu dərs avtomatik olaraq sizin müəllim hesabınıza bağlanacaq.' : 'Yalnız aktiv müəllim rolu olan hesablar göstərilir.'}>
        <select required className={inputClass} value={teacherOnly ? (user?.id ?? '') : form.teacherClerkUserId} disabled={teacherOnly} onChange={(e) => setForm({ ...form, teacherClerkUserId: e.target.value })} data-testid="select-resource-teacher">
          {teacherOnly
            ? <option value={user?.id ?? ''}>{ownTeacherName}</option>
            : <><option value="">Müəllim seçin</option>{(teachersQuery.data ?? []).map((teacher) => <option key={teacher.clerkUserId} value={teacher.clerkUserId}>{teacher.displayName}</option>)}</>}
        </select>
      </Field>
       <Field label="Bu qrup üçün nəzərdə tutulan tələbə sayı" hint="Eyni dərs üçün başqa müəllim qrupu əlavə edə bilərsiniz.">
        <input required type="number" min="0" step="1" className={inputClass} value={form.studentCapacity} onChange={(e) => setForm({ ...form, studentCapacity: Number(e.target.value) })} data-testid="input-resource-student-capacity" />
      </Field>
        <Field label="Bu qrupda olacaq tələbələr — checkbox ilə seçim" hint={form.studentCapacity > 0 ? `Ən çox ${form.studentCapacity} tələbə seçə bilərsiniz.` : 'Limit 0 olduqda tələbə sayı limitsizdir.'}>
          <button type="button" onClick={() => setIsStudentSelectorOpen((open) => !open)} className="focus-ring mb-3 inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" aria-expanded={isStudentSelectorOpen} data-testid="button-toggle-resource-students">
            {isStudentSelectorOpen ? 'Tələbə siyahısını bağla' : 'Tələbə siyahısını aç'} <ChevronDown size={15} className={`transition-transform ${isStudentSelectorOpen ? 'rotate-180' : ''}`} />
          </button>
          {isStudentSelectorOpen && (form.courseId ? <><div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3" data-testid="resource-student-selector">
           {studentsLoading ? <p className="text-xs text-[hsl(var(--muted-foreground))]">Tələbələr yüklənir...</p> : resourceStudents.length === 0 ? <p className="text-xs text-[hsl(var(--muted-foreground))]">Aktiv tələbə tapılmadı.</p> : resourceStudents.map((student) => {
             const selected = selectedStudentIds.includes(student.profileId);
              const unavailable = unavailableStudentIds.includes(student.profileId);
              const disabled = (!selected && unavailable) || (!selected && form.studentCapacity > 0 && selectedStudentIds.length >= form.studentCapacity);
             return <label key={student.profileId} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${selected ? 'bg-[hsl(var(--secondary)/.45)] text-[hsl(var(--primary))]' : 'hover:bg-[hsl(var(--muted))]'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
               <input type="checkbox" checked={selected} disabled={disabled} onChange={() => setSelectedStudentIds((current) => selected ? current.filter((id) => id !== student.profileId) : [...current, student.profileId])} data-testid={`checkbox-resource-student-${student.profileId}`} />
                <span><span className="block font-semibold">{student.firstName} {student.lastName}</span><span className="text-[11px] text-[hsl(var(--muted-foreground))]">T{String(student.studentNumber).padStart(4, '0')}{unavailable ? ' · Başqa müəllim qrupundadır' : ''}</span></span>
             </label>;
           })}
         </div>
         <p className="mt-2 text-xs font-bold text-[hsl(var(--secondary-foreground))]">{selectedStudentIds.length} tələbə seçilib</p>
         <button type="button" onClick={() => void saveStudentAssignments()} disabled={isSavingStudents || studentsLoading || !form.courseId} className="focus-ring mt-3 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-black text-[hsl(var(--primary-foreground))] shadow-[0_3px_0_hsl(var(--primary)/.35)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-save-resource-students">{isSavingStudents ? 'Yadda saxlanılır...' : 'Tələbələri qrupa əlavə et'}</button>
          </> : <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-3 text-xs text-[hsl(var(--muted-foreground))]">Tələbələri görmək üçün əvvəlcə dərs seçin.</p>)}
          {!isStudentSelectorOpen && <p className="text-xs font-bold text-[hsl(var(--secondary-foreground))]">{selectedStudentIds.length} tələbə seçilib</p>}
        </Field>
      <Field label="Dərsin növü" hint="İcbari dərs hamı üçün cədvəldə qalır; ixtiyari dərsi tələbə özü çıxara bilər.">
        <select className={inputClass} value={form.isMandatory ? 'mandatory' : 'optional'} onChange={(e) => setForm({ ...form, isMandatory: e.target.value === 'mandatory' })} data-testid="select-resource-requirement">
          <option value="mandatory">İcbari dərs</option>
          <option value="optional">İxtiyari dərs</option>
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Həftənin dərs günləri" hint="Bir neçə gün seçə bilərsiniz.">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
            {lessonDayOptions.map(([value, label]) => <label key={value} className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--primary))]"><input type="checkbox" checked={form.lessonDays.includes(value)} onChange={(event) => setForm({ ...form, lessonDays: event.target.checked ? [...form.lessonDays, value] : form.lessonDays.filter((day) => day !== value) })} />{label}</label>)}
          </div>
        </Field>
        <Field label="Dərs saatı">
          <input required type="time" className={inputClass} value={form.lessonTime} onChange={(e) => setForm({ ...form, lessonTime: e.target.value })} data-testid="input-resource-lesson-time" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
       <Field label="Dərsin kitab adı"><input required className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Məsələn, Təcvid qaydaları" data-testid="input-resource-title" /></Field>
      </div>
      <Field label="Müəllif və kitab məlumatı"><textarea required rows={6} className={`${inputClass} resize-y`} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Müəllif, nəşriyyat, nəşr ili və digər məlumatlar." data-testid="textarea-resource-body" /></Field>
       <Field label="PDF faylı yüklə" hint="PDF seçin; maksimum 25 MB. Link yazmaq əvəzinə birbaşa fayl yükləyə bilərsiniz."><input ref={pdfInput} type="file" accept="application/pdf,.pdf" className="block w-full cursor-pointer text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-[hsl(var(--primary))] file:px-4 file:py-2.5 file:text-xs file:font-black file:text-[hsl(var(--primary-foreground))] file:transition hover:file:bg-[hsl(var(--primary)/.85)]" onChange={(e) => { const file = e.target.files?.[0] ?? null; if (file && (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) { setNotice('Yalnız PDF faylı seçə bilərsiniz.'); e.target.value = ''; return; } if (file && file.size > 25 * 1024 * 1024) { setNotice('PDF faylı 25 MB-dan böyük ola bilməz.'); e.target.value = ''; return; } setPdfFile(file); }} data-testid="input-resource-pdf-file" />{pdfFile && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{pdfFile.name}</p>}</Field>
       <div className="grid gap-4 sm:grid-cols-2">
         <Field label="PDF linki"><input type="url" className={inputClass} value={courseLinks.pdfUrl} onChange={(e) => setCourseLinks((current) => ({ ...current, pdfUrl: e.target.value }))} placeholder="https://" data-testid="input-resource-pdf-url" /></Field>
         <Field label="Telegram linki"><input type="url" className={inputClass} value={courseLinks.telegramUrl} onChange={(e) => setCourseLinks((current) => ({ ...current, telegramUrl: e.target.value }))} placeholder="https://" data-testid="input-resource-telegram-url" /></Field>
         <Field label="Zoom linki"><input type="url" className={inputClass} value={courseLinks.zoomUrl} onChange={(e) => setCourseLinks((current) => ({ ...current, zoomUrl: e.target.value }))} placeholder="https://" data-testid="input-resource-zoom-url" /></Field>
         <Field label="Google Meet linki"><input type="url" className={inputClass} value={courseLinks.googleMeetUrl} onChange={(e) => setCourseLinks((current) => ({ ...current, googleMeetUrl: e.target.value }))} placeholder="https://" data-testid="input-resource-google-meet-url" /></Field>
         <Field label="Dərs linki"><input type="url" className={inputClass} value={courseLinks.lessonUrl} onChange={(e) => setCourseLinks((current) => ({ ...current, lessonUrl: e.target.value }))} placeholder="https://" data-testid="input-resource-lesson-url" /></Field>
       </div>
        <div className="flex justify-end gap-2">{editingId !== null && <button type="button" className="focus-ring rounded-xl px-4 py-3 text-sm font-bold text-[hsl(var(--muted-foreground))]" onClick={() => { setEditingId(null); setForm({ courseId: '', termNumber: 1, kind: ResourceInputKind.material, title: '', body: '', url: '', lessonDays: [], lessonTime: '', isMandatory: true, teacherClerkUserId: '', studentCapacity: 0 }); }}>Ləğv et</button>}<button type="submit" className={buttonClass} disabled={isSaving || mutation.isPending || coursesQuery.isLoading || teachersQuery.isLoading} data-testid="button-create-resource"><FilePlus2 size={16} /> {isSaving ? 'Yadda saxlanılır...' : editingId === null ? 'Dərsi əlavə et' : 'Dəyişiklikləri saxla'}</button></div>
      <FormNotice text={notice} error={notice.includes('bil') || notice.includes('olmaya')} />
    </form>
      <div className="mt-8 border-t border-[hsl(var(--border))] pt-6"><button type="button" onClick={() => setShowSelectedSubjects((current) => !current)} className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--accent))] px-4 py-3 text-sm font-black text-[hsl(var(--primary))] shadow-[0_4px_0_hsl(37_83%_52%)]" aria-expanded={showSelectedSubjects} data-testid="button-show-selected-subjects"><BookOpen size={16} /> Seçili fənlər</button>{showSelectedSubjects && <div className="mt-4 rounded-2xl border-2 border-[hsl(var(--accent)/.6)] bg-[hsl(var(--accent)/.12)] p-4" data-testid="section-selected-subjects"><p className="text-sm font-black text-[hsl(var(--primary))]">Hazırda seçili fənlər</p>{resourcesQuery.data?.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{resourcesQuery.data.map((resource) => <div key={resource.id} className="rounded-xl bg-[hsl(var(--card))] p-3"><p className="text-sm font-bold text-[hsl(var(--primary))]">{coursesQuery.data?.find((course) => course.id === resource.courseId)?.title ?? 'Fənn'}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{resource.teacherName ?? 'Müəllim təyin edilməyib'} · {resource.termNumber}-ci semestr</p></div>)}</div> : <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Hələ seçili fənn yoxdur.</p>}</div>}<div className="mt-4"><h4 className="font-serif text-xl text-[hsl(var(--primary))]">Semestr fənləri</h4>{resourcesQuery.isLoading ? <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Fənlər yüklənir...</p> : resourcesQuery.data?.length ? <div className="mt-3 space-y-2">{resourcesQuery.data.map((resource) => <div key={resource.id} className="flex items-start justify-between gap-3 rounded-xl bg-[hsl(var(--muted)/.5)] p-3"><div className="min-w-0"><p className="text-sm font-bold text-[hsl(var(--primary))]"><span className="text-[hsl(var(--secondary-foreground))]">{resource.teacherName ? `Müəllim: ${resource.teacherName}` : 'Müəllim təyin edilməyib'}</span> · {coursesQuery.data?.find((course) => course.id === resource.courseId)?.title ?? 'Fənn'}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{resource.title} · {resource.termNumber}-ci semestr · {resource.isMandatory ? 'İcbari' : 'İxtiyari'} · {resource.studentCapacity} tələbəlik qrup · {resource.lessonDays.length ? resource.lessonDays.map((day) => lessonDayOptions.find(([value]) => value === day)?.[1]).join(', ') : 'Gün təyin edilməyib'} · {resource.lessonTime || 'Saat təyin edilməyib'}</p></div><div className="flex shrink-0 gap-1"><button type="button" className="focus-ring rounded-lg p-2 text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--card))]" aria-label="Fənni redaktə et" onClick={() => { setEditingId(resource.id); setForm({ courseId: String(resource.courseId), termNumber: resource.termNumber, kind: resource.kind as ResourceInputKind, title: resource.title, body: resource.body, url: resource.url ?? '', lessonDays: resource.lessonDays, lessonTime: resource.lessonTime ?? '', isMandatory: resource.isMandatory, teacherClerkUserId: resource.teacherClerkUserId ?? '', studentCapacity: resource.studentCapacity }); }}><Pencil size={15} /></button><button type="button" className="focus-ring rounded-lg p-2 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--card))]" aria-label="Fənni sil" onClick={async () => { if (!window.confirm('Bu fənni semestrdən silmək istədiyinizə əminsiniz?')) return; const response = await fetch(apiUrl(`/admin/resources/${resource.id}`), { method: 'DELETE' }); if (!response.ok) { setNotice('Fənn silinə bilmədi.'); return; } await queryClient.invalidateQueries({ queryKey: getGetAdminResourcesQueryKey() }); await queryClient.invalidateQueries({ queryKey: getGetCoursesQueryKey() }); setNotice('Fənn semestrdən silindi.'); }}><Trash2 size={15} /></button></div></div>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">Hələ semestr fənni əlavə edilməyib.</p>}</div></div>
    </div>
  );
}

function ResourceList({ resources }: { resources: LearningResource[] }) {
  const kindLabels: Record<string, string> = { pdf: 'PDF', telegram: 'Telegram', material: 'Material', text: 'Mətn' };
  const termLabels: Record<number, string> = { 1: '1-ci Semestr', 2: '2-ci Semestr', 3: '3-cü Semestr', 4: '4-cü Semestr' };
  return (
    <div className="mt-8 border-t border-[hsl(var(--border))] pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Son əlavə olunanlar</p><h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Dərs resursları</h3></div>
        <FileText className="text-[hsl(var(--secondary-foreground))]" size={20} />
      </div>
      {resources.length ? <div className="space-y-2">{resources.slice(-5).reverse().map((resource) => <div key={resource.id} className="flex items-start gap-3 rounded-xl bg-[hsl(var(--muted)/.55)] p-3"><div className="mt-0.5 rounded-lg bg-[hsl(var(--secondary))] p-2 text-[hsl(var(--secondary-foreground))]">{resource.kind === 'text' ? <FileText size={15} /> : <BookOpen size={15} />}</div><div className="min-w-0"><p className="text-sm font-bold text-[hsl(var(--primary))]">{resource.title}</p><p className="mt-0.5 text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--secondary-foreground))]">{kindLabels[resource.kind] ?? resource.kind} · {termLabels[resource.termNumber]}</p><p className="mt-0.5 line-clamp-1 text-xs text-[hsl(var(--muted-foreground))]">{resource.body}</p></div></div>)}</div> : <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-5 text-center text-xs text-[hsl(var(--muted-foreground))]">Hələ resurs əlavə edilməyib.</p>}
    </div>
  );
}

function SemesterDatesForm() {
  const labels = ['1-ci Semestr', '2-ci Semestr', '3-cü Semestr', '4-cü Semestr', '5-ci Semestr', '6-cı Semestr', '7-ci Semestr', '8-ci Semestr'];
  type SemesterDate = { termNumber: number; startDate: string; endDate: string };
  const displayDate = (value: string | null) => value ? value.split('-').reverse().join('.') : '';
  const formatDateInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    return digits.length > 4 ? `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}` : digits.length > 2 ? `${digits.slice(0, 2)}.${digits.slice(2)}` : digits;
  };
  const isoDate = (value: string) => {
    const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    const iso = `${year}-${month}-${day}`;
    const parsed = new Date(`${iso}T00:00:00Z`);
    return parsed.getUTCFullYear() === Number(year) && parsed.getUTCMonth() + 1 === Number(month) && parsed.getUTCDate() === Number(day) ? iso : null;
  };
  const [dates, setDates] = useState<SemesterDate[]>(
    labels.map((_, index) => ({ termNumber: index + 1, startDate: '', endDate: '' })),
  );
  const [notice, setNotice] = useState('');
  const [savingTerm, setSavingTerm] = useState<number | null>(null);

  useEffect(() => {
    void fetch(apiUrl('/admin/semester-dates'))
      .then(async (response) => {
        if (!response.ok) throw new Error('load');
        return response.json() as Promise<Array<{ termNumber: number; startDate: string | null; endDate: string | null }>>;
      })
      .then((result) => setDates(result.map((item) => ({ termNumber: item.termNumber, startDate: displayDate(item.startDate), endDate: displayDate(item.endDate) }))))
      .catch(() => setNotice('Semestr tarixləri yüklənmədi.'));
  }, []);

  const saveTerm = async (termNumber: number) => {
    const date = dates.find((item) => item.termNumber === termNumber);
    if (!date || !isoDate(date.startDate) || !isoDate(date.endDate)) {
      setNotice('Başlama və bitmə tarixlərini birlikdə daxil edin.');
      return;
    }
    const startDate = isoDate(date.startDate);
    const endDate = isoDate(date.endDate);
    setSavingTerm(termNumber);
    setNotice('');
    try {
      const response = await fetch(apiUrl(`/admin/semester-dates/${termNumber}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      });
      const result = await response.json().catch(() => ({})) as Array<{ termNumber: number; startDate: string | null; endDate: string | null }> & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Tarixlər yadda saxlanılmadı.');
      setDates(result.map((item) => ({ termNumber: item.termNumber, startDate: displayDate(item.startDate), endDate: displayDate(item.endDate) })));
      setNotice(`${labels[termNumber - 1]} tarixləri yadda saxlanıldı.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Tarixlər yadda saxlanılmadı.');
    } finally {
      setSavingTerm(null);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.28)] p-4" data-testid="section-semester-dates">
      <div className="mb-4"><p className="text-sm font-bold text-[hsl(var(--primary))]">Semestr tarixləri</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Tarixləri hər semestr üçün ayrıca yadda saxlayın.</p></div>
      <div className="space-y-3">
        {dates.map((date) => <div key={date.termNumber} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
          <p className="mb-3 text-sm font-bold text-[hsl(var(--primary))]">{labels[date.termNumber - 1]}</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Başlama tarixi"><input type="text" inputMode="numeric" maxLength={10} className={inputClass} placeholder="GG.AA.İİİİ" value={date.startDate} onChange={(event) => setDates((current) => current.map((item) => item.termNumber === date.termNumber ? { ...item, startDate: formatDateInput(event.target.value) } : item))} /></Field>
            <Field label="Bitmə tarixi"><input type="text" inputMode="numeric" maxLength={10} className={inputClass} placeholder="GG.AA.İİİİ" value={date.endDate} onChange={(event) => setDates((current) => current.map((item) => item.termNumber === date.termNumber ? { ...item, endDate: formatDateInput(event.target.value) } : item))} /></Field>
            <button type="button" onClick={() => void saveTerm(date.termNumber)} disabled={savingTerm !== null} className={buttonClass}><Plus size={16} /> {savingTerm === date.termNumber ? 'Yadda saxlanır...' : 'Əlavə et'}</button>
          </div>
        </div>)}
      </div>
      {notice && <FormNotice text={notice} error={notice.includes('yadda saxlanılmadı') || notice.includes('yüklənmədi')} />}
    </section>
  );
}

function CourseActivationSettings() {
  const [activeTerms, setActiveTerms] = useState<number[]>([1, 2, 3, 4]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingTerm, setSavingTerm] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const labels = { 5: '3-cü tədris ili', 7: '4-cü tədris ili' } as const;
  const courseTerms = { 5: [5, 6], 7: [7, 8] } as const;

  useEffect(() => {
    void fetch(apiUrl('/admin/course-activation'))
      .then(async (response) => {
        if (!response.ok) throw new Error('load');
        return response.json() as Promise<{ activeTermNumbers: number[] }>;
      })
      .then((result) => setActiveTerms(result.activeTermNumbers))
      .catch(() => setNotice('Dərs mərhələlərinin aktivlik məlumatı yüklənmədi.'))
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
      if (!response.ok || !result.activeTermNumbers) throw new Error(result.error || 'Dərs mərhələsinin aktivliyi dəyişdirilə bilmədi.');
      setActiveTerms(result.activeTermNumbers);
      setNotice(`${labels[courseStartTerm]} ${shouldActivate ? 'aktivləşdirildi' : 'deaktiv edildi'}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Dərs mərhələsinin aktivliyi dəyişdirilə bilmədi.');
    } finally {
      setSavingTerm(null);
    }
  };

  return (
    <section className="space-y-5" data-testid="section-course-activation">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">Dərs mərhələləri</p>
        <h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Dərs mərhələlərini idarə et</h3>
        <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">3-cü və 4-cü dərs mərhələsini aktivləşdirin. Aktiv olmayan mərhələ tələbə kabinetində görünməyəcək.</p>
      </div>
      {isLoading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Dərs mərhələlərinin aktivlik vəziyyəti yüklənir...</p> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {([5, 7] as const).map((courseStartTerm) => {
            const terms = courseTerms[courseStartTerm];
            const active = terms.every((term) => activeTerms.includes(term));
            return <article key={courseStartTerm} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-serif text-xl text-[hsl(var(--primary))]">{labels[courseStartTerm]}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{terms[0]}–{terms[1]}-ci semestrlər və dərs materialları</p></div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{active ? 'Aktiv' : 'Bağlı'}</span>
              </div>
              <button type="button" onClick={() => void toggleTerm(courseStartTerm)} disabled={savingTerm !== null} className={`${active ? 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))]' : buttonClass} mt-4 w-full`} data-testid={`button-toggle-course-${courseStartTerm}`}>
                {savingTerm === courseStartTerm ? 'Yadda saxlanır...' : active ? `${labels[courseStartTerm]} deaktiv et` : `${labels[courseStartTerm]} aktiv et`}
              </button>
            </article>;
          })}
        </div>
      )}
      {notice && <FormNotice text={notice} error={notice.includes('yüklənmədi') || notice.includes('dəyişdirilə bilmədi')} />}
    </section>
  );
}

function TeacherSchedule({ ownerName }: { ownerName: string }) {
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
  const schedule = lessonDayOptions.map(([day, label]) => ({
    day,
    label,
    lessons: lessons.filter((resource) => resource.lessonDays.includes(day)).sort((a, b) => (a.lessonTime ?? '99:99').localeCompare(b.lessonTime ?? '99:99') || a.termNumber - b.termNumber),
  }));
  const activeDay = selectedDay ?? todayKey;
  const selected = schedule.find((item) => item.day === activeDay) ?? schedule[0];
  const currentUserName = ownerName || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.fullName || user?.username || 'İstifadəçi';
  const displayMyTeacherName = (lesson: LearningResource) => lesson.teacherClerkUserId === user?.id || lesson.teacherName?.trim().toLowerCase() === 'sistem sahibi' ? currentUserName : (lesson.teacherName ?? 'Müəllim təyin edilməyib');
  const openLesson = (lesson: LearningResource) => {
    setSelectedLesson(lesson);
    setEditing(false);
    setLinkOnlyOpen(false);
    setNotice('');
    setPdfFile(null);
    setEditForm({ title: lesson.title, body: lesson.body, url: lesson.url ?? '', lessonTime: lesson.lessonTime ?? '', lessonDays: lesson.lessonDays });
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
      setSelectedLesson({ ...selectedLesson, title: editForm.title.trim(), body: editForm.body.trim(), url: materialUrl, lessonDays: editForm.lessonDays as LearningResource['lessonDays'], lessonTime: editForm.lessonTime });
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
       <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Mənim dərslərim</p><h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Həftəlik cədvəl</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">1-ci, 2-ci, 3-cü və 4-cü semestrlər üzrə sizə təyin edilmiş dərslər görünür.</p></div><button type="button" disabled={!selectedLesson} onClick={openLessonLinks} className={`${buttonClass} ${selectedLesson ? 'bg-[hsl(var(--secondary-foreground))]' : 'bg-[hsl(var(--muted-foreground))]'}`} data-testid="button-my-schedule-links"><Link2 size={16} /> Yalnız linklər</button></div>
       {isLoading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Cədvəl yüklənir...</p> : <><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">{schedule.map(({ day, label, lessons }) => <button key={day} type="button" onClick={() => setSelectedDay(day)} className={`focus-ring rounded-xl border px-2 py-3 text-center ${day === activeDay ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))]'}`} data-testid={`button-teacher-schedule-day-${day}`}><span className="block text-xs font-black">{label}</span><span className="mt-1 block text-[10px]">{lessons.length ? `${lessons.length} dərs` : 'Dərs yoxdur'}</span></button>)}</div><div className="rounded-xl border border-[hsl(var(--border))] p-4" data-testid="section-teacher-selected-schedule"><p className="text-xs font-black text-[hsl(var(--primary))]">{selected?.label} günü</p>{selected?.lessons.length ? <div className="mt-3 space-y-2">{selected.lessons.map((lesson) => <button key={lesson.id} type="button" onClick={() => openLesson(lesson)} className="focus-ring flex w-full items-center justify-between gap-3 rounded-lg bg-[hsl(var(--muted)/.45)] px-3 py-3 text-left hover:bg-[hsl(var(--secondary)/.25)]"><div><p className="text-sm font-bold text-[hsl(var(--primary))]">{lesson.title}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{lesson.termNumber}-ci semestr · {lesson.teacherClerkUserId === user?.id || lesson.teacherName?.toLowerCase() === 'sistem sahibi' ? currentUserName : (lesson.teacherName ?? 'Müəllim təyin edilməyib')}</p></div><span className="rounded-lg bg-[hsl(var(--secondary)/.6)] px-2.5 py-1 text-sm font-black text-[hsl(var(--secondary-foreground))]">{lesson.lessonTime ?? '—'}</span></button>)}</div> : <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Bu gün üçün dərs yoxdur.</p>}</div>{selectedLesson && <section className="rounded-xl border border-[hsl(var(--accent)/.7)] bg-[hsl(var(--accent)/.12)] p-4" data-testid="section-teacher-lesson-details"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.12em] text-[hsl(var(--secondary-foreground))]">{selectedLesson.termNumber}-ci semestr · {selectedLesson.lessonTime ?? 'Saat təyin edilməyib'}</p><h4 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{selectedLesson.title}</h4></div><div className="flex gap-2"><button type="button" onClick={openLessonLinks} className={`${buttonClass} bg-[hsl(var(--secondary-foreground))]`} data-testid="button-open-scheduled-lesson-links"><Link2 size={15} /> Yalnız linklər</button><button type="button" onClick={() => { setEditing((value) => !value); setLinkOnlyOpen(false); }} className={buttonClass} data-testid="button-edit-scheduled-lesson"><Pencil size={15} /> {editing ? 'Baxışa qayıt' : 'Redaktə et'}</button></div></div>{editing ? <form onSubmit={saveLesson} className="mt-4 space-y-4"><Field label="Dərsin adı"><input required className={inputClass} value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} /></Field><Field label="Dərs haqqında geniş məlumat"><textarea required rows={5} className={`${inputClass} resize-y`} value={editForm.body} onChange={(event) => setEditForm({ ...editForm, body: event.target.value })} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Həftənin günləri"><div className="grid grid-cols-2 gap-2 rounded-xl border border-[hsl(var(--border))] p-3">{lessonDayOptions.map(([day, label]) => <label key={day} className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={editForm.lessonDays.includes(day)} onChange={(event) => setEditForm({ ...editForm, lessonDays: event.target.checked ? [...editForm.lessonDays, day] : editForm.lessonDays.filter((item) => item !== day) })} />{label}</label>)}</div></Field><Field label="Saat"><input required type="time" className={inputClass} value={editForm.lessonTime} onChange={(event) => setEditForm({ ...editForm, lessonTime: event.target.value })} /></Field></div><Field label="PDF və ya material linki"><input type="text" className={inputClass} value={editForm.url} onChange={(event) => setEditForm({ ...editForm, url: event.target.value })} placeholder="Mövcud link" /><input ref={pdfInput} type="file" accept="application/pdf,.pdf" className="mt-2 block w-full text-xs" onChange={(event) => { const file = event.target.files?.[0] ?? null; setPdfFile(file); }} data-testid="input-schedule-pdf-file" />{pdfFile && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{pdfFile.name} — yadda saxlanarkən dəyişdiriləcək</p>}</Field><button type="submit" className={buttonClass}>Yadda saxla</button>{notice && <p className="text-xs font-semibold">{notice}</p>}</form> : <div className="mt-4 space-y-3"><p className="whitespace-pre-wrap text-sm leading-6 text-[hsl(var(--muted-foreground))]">{selectedLesson.body || 'Bu dərs üçün əlavə məlumat yazılmayıb.'}</p>{selectedLesson.url && <a href={selectedLesson.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-[hsl(var(--secondary-foreground))]">Materialı aç</a>}{notice && <p className="text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{notice}</p>}</div>}</section>}</>}
    </section>
  );
}

function TeachersSchedule({ ownerName }: { ownerName: string }) {
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
  const schedule = lessonDayOptions.map(([day, label]) => ({
    day,
    label,
    lessons: (resourcesQuery.data ?? [])
      .filter((resource) => resource.lessonDays.includes(day))
      .sort((a, b) => (a.lessonTime ?? '99:99').localeCompare(b.lessonTime ?? '99:99') || a.termNumber - b.termNumber)
      .map((lesson) => ({ ...lesson, teacherName: lesson.teacherName?.trim().toLowerCase() === 'sistem sahibi' ? ownerName : lesson.teacherName })),
  }));
  const selected = schedule.find((item) => item.day === activeDay) ?? schedule[0];
  const displayTeacherName = (lesson: LearningResource) => lesson.teacherName?.trim().toLowerCase() === 'sistem sahibi' ? ownerName : (lesson.teacherName ?? 'Müəllim təyin edilməyib');
  const openLesson = (lesson: LearningResource) => {
    setSelectedLesson(lesson);
    setEditing(false);
    setLinkOnlyOpen(false);
    setNotice('');
    setEditForm({ title: lesson.title, body: lesson.body, url: lesson.url ?? '', lessonTime: lesson.lessonTime ?? '', lessonDays: lesson.lessonDays });
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
      const response = await fetch(apiUrl(`/admin/resources/${selectedLesson.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: selectedLesson.courseId, termNumber: selectedLesson.termNumber, kind: selectedLesson.kind, title: editForm.title.trim(), body: editForm.body.trim(), url: editForm.url.trim() || null, lessonDays: editForm.lessonDays, lessonTime: editForm.lessonTime, isMandatory: selectedLesson.isMandatory, teacherClerkUserId: selectedLesson.teacherClerkUserId }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Dərs yenilənə bilmədi.');
      await queryClient.invalidateQueries({ queryKey: getGetAdminResourcesQueryKey() });
      setSelectedLesson({ ...selectedLesson, title: editForm.title.trim(), body: editForm.body.trim(), url: editForm.url.trim() || null, lessonDays: editForm.lessonDays as LearningResource['lessonDays'], lessonTime: editForm.lessonTime });
      setEditing(false);
      setNotice('Dərs məlumatları yadda saxlanıldı.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Dərs yenilənə bilmədi.');
    }
  };
  return (
    <section className="space-y-5" data-testid="section-teachers-schedule">
      {selectedLesson && <TeachersScheduleLinksAction onClick={() => setLinkOnlyOpen((value) => !value)} />}
      <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Akademiyanın cədvəli</p><h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Müəllimlər cədvəli</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Bütün müəllimlərə təyin edilmiş dərslər və dərs saatları.</p></div>
      {selectedLesson && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setLinkOnlyOpen((value) => !value)} className={`${buttonClass} bg-[hsl(var(--secondary-foreground))]`} data-testid="button-open-teachers-schedule-links"><Link2 size={15} /> Yalnız linklər</button></div>}
       {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800" data-testid="text-teachers-lesson-save-notice">{notice}</p>}
      {selectedLesson && linkOnlyOpen && <section className="rounded-xl border border-[hsl(var(--accent)/.7)] bg-[hsl(var(--accent)/.12)] p-4" data-testid="section-teachers-schedule-links"><TeacherCourseLinksEditor links={courseLinks} onChange={(key, value) => setCourseLinks((current) => ({ ...current, [key]: value }))} /><button type="button" onClick={() => void saveCourseLinks()} className={`${buttonClass} mt-3`} data-testid="button-save-teachers-schedule-links"><Link2 size={15} /> Yalnız linkləri yadda saxla</button></section>}
       {resourcesQuery.isLoading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Müəllimlər cədvəli yüklənir...</p> : <><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">{schedule.map(({ day, label, lessons }) => <button key={day} type="button" onClick={() => setSelectedDay(day)} className={`focus-ring rounded-xl border px-2 py-3 text-center ${day === activeDay ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))]'}`}><span className="block text-xs font-black">{label}</span><span className="mt-1 block text-[10px]">{lessons.length ? `${lessons.length} dərs` : 'Dərs yoxdur'}</span></button>)}</div><div className="rounded-xl border border-[hsl(var(--border))] p-4" data-testid="section-teachers-selected-schedule"><p className="text-xs font-black text-[hsl(var(--primary))]">{selected?.label} günü</p>{selected?.lessons.length ? <div className="mt-3 space-y-2">{selected.lessons.map((lesson) => <button key={lesson.id} type="button" onClick={() => openLesson(lesson)} className="focus-ring flex w-full flex-wrap items-center justify-between gap-3 rounded-lg bg-[hsl(var(--muted)/.45)] px-3 py-3 text-left hover:bg-[hsl(var(--secondary)/.25)]"><div><p className="text-sm font-bold text-[hsl(var(--primary))]">{lesson.title}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{lesson.teacherName ?? 'Müəllim təyin edilməyib'} · {lesson.termNumber}-ci semestr</p><p className="mt-1 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">{lesson.body}</p></div><span className="rounded-lg bg-[hsl(var(--secondary)/.6)] px-2.5 py-1 text-sm font-black text-[hsl(var(--secondary-foreground))]">{lesson.lessonTime ?? '—'}</span></button>)}</div> : <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Bu gün üçün dərs yoxdur.</p>}</div>{selectedLesson && <section className="rounded-xl border border-[hsl(var(--accent)/.7)] bg-[hsl(var(--accent)/.12)] p-4" data-testid="section-teachers-lesson-details"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.12em] text-[hsl(var(--secondary-foreground))]">{selectedLesson.teacherName ?? 'Müəllim'} · {selectedLesson.termNumber}-ci semestr · {selectedLesson.lessonTime ?? '—'}</p><h4 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{selectedLesson.title}</h4></div><button type="button" onClick={() => setEditing((value) => !value)} className={buttonClass} data-testid="button-edit-teachers-lesson"><Pencil size={15} /> {editing ? 'Baxışa qayıt' : 'Redaktə et'}</button></div>{editing ? <form onSubmit={saveLesson} className="mt-4 space-y-4"><Field label="Dərsin adı"><input required className={inputClass} value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} /></Field><Field label="Dərs haqqında məlumat"><textarea required rows={5} className={`${inputClass} resize-y`} value={editForm.body} onChange={(event) => setEditForm({ ...editForm, body: event.target.value })} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Həftənin günləri"><div className="grid grid-cols-2 gap-2 rounded-xl border border-[hsl(var(--border))] p-3">{lessonDayOptions.map(([day, label]) => <label key={day} className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={editForm.lessonDays.includes(day)} onChange={(event) => setEditForm({ ...editForm, lessonDays: event.target.checked ? [...editForm.lessonDays, day] : editForm.lessonDays.filter((item) => item !== day) })} />{label}</label>)}</div></Field><Field label="Saat"><input required type="time" className={inputClass} value={editForm.lessonTime} onChange={(event) => setEditForm({ ...editForm, lessonTime: event.target.value })} /></Field></div><Field label="PDF və ya material linki"><input type="text" className={inputClass} value={editForm.url} onChange={(event) => setEditForm({ ...editForm, url: event.target.value })} placeholder="https:// və ya yüklənmiş PDF" /></Field><button type="submit" className={buttonClass}>Yadda saxla</button>{notice && <p className="text-xs font-semibold">{notice}</p>}</form> : <div className="mt-4 space-y-3"><p className="whitespace-pre-wrap text-sm leading-6 text-[hsl(var(--muted-foreground))]">{selectedLesson.body || 'Bu dərs üçün əlavə məlumat yazılmayıb.'}</p>{selectedLesson.url && <a href={selectedLesson.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-[hsl(var(--secondary-foreground))]">Materialı aç</a>}{notice && <p className="text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{notice}</p>}</div>}</section>}</>}
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
  const [activeStatus, setActiveStatus] = useState<Application['status'] | null>('pending');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (isRejecting && !reason) setReason('\u200B');
  }, [isRejecting, reason]);
  const downloadPath = (applicationId: number, fileIndex: number) =>
    `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/admin/applications/${applicationId}/recommendations/${fileIndex}`;

  if (isLoading) return <p className="text-sm text-[hsl(var(--muted-foreground))]">Müraciətlər yüklənir...</p>;
  if (!applications.length) return <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-7 text-center text-sm text-[hsl(var(--muted-foreground))]">Hələ yeni müraciət yoxdur.</p>;
  const statusItems = [
    { value: 'pending' as const, label: 'Gözləmədə', count: applications.filter((application) => application.status === 'pending').length, className: 'border-amber-200 bg-amber-50 text-amber-900' },
    { value: 'approved' as const, label: 'Təsdiqlənən', count: applications.filter((application) => application.status === 'approved').length, className: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    { value: 'rejected' as const, label: 'Qəbul edilməyən', count: applications.filter((application) => application.status === 'rejected').length, className: 'border-rose-200 bg-rose-50 text-rose-900' },
  ];
  const visibleApplications = activeStatus ? applications.filter((application) => application.status === activeStatus) : [];
  return (
    <div className="space-y-4" data-testid="list-admin-applications">
      <div className="grid items-start gap-3 sm:grid-cols-3" data-testid="application-status-summary">{statusItems.map((item) => <div key={item.value} className="space-y-0">
        <button type="button" onClick={() => setActiveStatus((current) => current === item.value ? null : item.value)} aria-expanded={activeStatus === item.value} className={`focus-ring w-full rounded-2xl border p-4 text-left transition hover:shadow-sm ${item.className} ${activeStatus === item.value ? 'ring-2 ring-[hsl(var(--primary)/.35)]' : 'opacity-80'}`} data-testid={`button-application-status-${item.value}`}><p className="text-[10px] font-bold uppercase tracking-[.14em]">{item.label}</p><p className="mt-2 font-serif text-3xl">{item.count}</p><p className="mt-1 text-xs font-semibold">{activeStatus === item.value ? 'Adları gizlət' : 'Adları görmək üçün basın'}</p></button>
        {activeStatus === item.value && <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] p-4" data-testid={`application-names-${activeStatus}`}><p className="text-xs font-bold text-[hsl(var(--muted-foreground))]">{item.label} müraciətçiləri</p>{visibleApplications.length ? <div className="mt-3 flex flex-wrap gap-2">{visibleApplications.map((application) => <button type="button" key={application.id} onClick={() => { setReason(''); setIsRejecting(false); setSelectedApplication(application); }} className="focus-ring rounded-xl bg-[hsl(var(--card))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary)/.25)]" data-testid={`button-application-name-${application.id}`}>{application.firstName} {application.lastName}</button>)}</div> : <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Bu statusda müraciət yoxdur.</p>}</div>}
      </div>)}</div>
      {selectedApplication && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--primary)/.5)] px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="application-details-title"><div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)]"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--secondary-foreground))]">Müraciət məlumatları</p><h4 id="application-details-title" className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{selectedApplication.firstName} {selectedApplication.lastName}</h4><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{selectedApplication.status === 'pending' ? 'Gözləmədə' : selectedApplication.status === 'approved' ? 'Təsdiqlənib' : 'İmtina edilib'}</p></div><button type="button" onClick={() => setSelectedApplication(null)} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Bağla"><X size={18} /></button></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">E-poçt</dt><dd className="mt-1 font-semibold">{selectedApplication.email}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Telefon</dt><dd className="mt-1 font-semibold">{selectedApplication.phone}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Doğum tarixi</dt><dd className="mt-1 font-semibold">{selectedApplication.birthDate}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Ərəb dili səviyyəsi</dt><dd className="mt-1 font-semibold">{selectedApplication.arabicLevel}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Müraciət tarixi</dt><dd className="mt-1 font-semibold">{new Intl.DateTimeFormat('az-AZ', { dateStyle: 'medium' }).format(new Date(selectedApplication.createdAt))}</dd></div></dl>{selectedApplication.status !== 'rejected' && <div className="mt-5 border-t border-[hsl(var(--border))] pt-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Yüklənmiş PDF-lər</p><div className="mt-2 flex flex-wrap gap-2">{selectedApplication.recommendationNames.map((name, index) => <a key={name} href={downloadPath(selectedApplication.id, index)} className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--muted))] px-2.5 py-2 text-xs font-bold text-[hsl(var(--secondary-foreground))] hover:underline"><FileText size={14} /> {name}</a>)}</div></div>}{selectedApplication.status === 'rejected' && selectedApplication.rejectionReason && <p className="mt-5 rounded-lg bg-[hsl(var(--destructive)/.08)] p-3 text-xs leading-5 text-[hsl(var(--destructive))]"><strong>İmtina səbəbi:</strong> {selectedApplication.rejectionReason}</p>}{canDecide && selectedApplication.status === 'pending' && <div className="mt-5 border-t border-[hsl(var(--border))] pt-4"><div className="flex flex-wrap gap-2"><button type="button" disabled={busyId === selectedApplication.id || teacherBusyId === selectedApplication.id} onClick={() => { onDecision(selectedApplication, 'approved'); setSelectedApplication(null); }} className="focus-ring rounded-lg bg-[hsl(var(--secondary))] px-3 py-2 text-xs font-bold text-[hsl(var(--secondary-foreground))] disabled:opacity-50" data-testid={`button-approve-application-${selectedApplication.id}`}>Təsdiqlə</button><button type="button" disabled={busyId === selectedApplication.id || teacherBusyId === selectedApplication.id} onClick={() => { setIsRejecting(true); setReason(''); }} className="focus-ring rounded-lg border border-[hsl(var(--destructive)/.3)] px-3 py-2 text-xs font-bold text-[hsl(var(--destructive))] disabled:opacity-50">İmtina</button></div>{isRejecting && <><textarea required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="İmtina səbəbini yazın" className={`${inputClass} mt-3 min-h-20`} /><button type="button" disabled={!reason.trim() || busyId === selectedApplication.id} onClick={() => { onDecision(selectedApplication, 'rejected', reason); setSelectedApplication(null); }} className="mt-2 focus-ring rounded-lg bg-[hsl(var(--destructive))] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">İmtina mesajını göndər</button></>}</div>}{canAssignTeacher && selectedApplication.status !== 'rejected' && <div className="mt-5 border-t border-[hsl(var(--border))] pt-4"><button type="button" disabled={teacherBusyId === selectedApplication.id || busyId === selectedApplication.id} onClick={() => onAssignTeacher(selectedApplication)} className="focus-ring rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50" data-testid={`button-assign-teacher-${selectedApplication.id}`}>{teacherBusyId === selectedApplication.id ? 'Təyin olunur...' : 'Bu müraciətçini müəllim təyin et'}</button></div>}<div className="mt-6 flex justify-end"><button type="button" onClick={() => setSelectedApplication(null)} className="focus-ring rounded-xl px-4 py-2.5 text-xs font-bold text-[hsl(var(--muted-foreground))]">Bağla</button></div></div></div>}
    </div>
  );
}

function AcademicManagement({ mode }: { mode: 'grades' | 'attendance' }) {
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
      setNotice('Qiymət 0 ilə 100 arasında olmalıdır.');
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
      setNotice(`${subject.title} qiyməti yadda saxlanıldı.`);
    } catch {
      setNotice(`${subject.title} qiyməti yadda saxlanıla bilmədi.`);
    } finally {
      setSavingCourseId(null);
    }
  };

  if (profilesQuery.isLoading) return <p className="text-sm text-[hsl(var(--muted-foreground))]">Tələbə profilləri yüklənir...</p>;
  if (!(profilesQuery.data ?? []).length) return <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-7 text-center text-sm text-[hsl(var(--muted-foreground))]">Təsdiqlənmiş tələbə profili hələ yoxdur.</p>;
  return (
    <form onSubmit={save} className="space-y-5" data-testid="form-academic-grading">
      <Field label="Tələbə">
        <input type="search" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Ad, soyad, istifadəçi adı və ya tələbə nömrəsi ilə axtar..." className={`${inputClass} mb-2`} data-testid="input-academic-student-search" />
        <select className={inputClass} value={selectedProfileId ?? ''} onChange={(event) => setSelectedProfileId(Number(event.target.value))} data-testid="select-academic-student">
          {filteredProfiles.length ? filteredProfiles.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} · N{item.studentNumber} — {item.statusLabel}</option>) : <option value="">Tələbə tapılmadı</option>}
        </select>
      </Field>
      {profileQuery.isLoading && <p className="text-sm text-[hsl(var(--muted-foreground))]">Profil məlumatları yüklənir...</p>}
      {profile && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rəsmi proqram" hint="Akademik sənədlərdə tələbə ilə birlikdə göstərilir.">
              <input required minLength={1} maxLength={160} className={inputClass} value={program} onChange={(event) => setProgram(event.target.value)} data-testid="input-academic-program" />
            </Field>
            <Field label="Cari dərs mərhələsi">
              <div className={`${inputClass} bg-[hsl(var(--muted)/.45)]`}>{profile ? `${profile.courseYear}-ci tədris ili` : 'Tələbə seçin'}</div>
            </Field>
            <Field label="Cari semestr" hint="Tələbə seçiləndə avtomatik göstərilir.">
              <div className={`${inputClass} bg-[hsl(var(--muted)/.45)]`}>{profile ? `${profile.currentTermNumber}-ci semestr` : 'Tələbə seçin'}</div>
            </Field>
          </div>
          <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Qiymət və davamiyyət tələbənin cari semestrinə yazılacaq: {selectedSemester?.label ?? '—'}</p>
           {mode === 'grades' && <div className="rounded-2xl border border-[hsl(var(--border))] p-4">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Dərs qiymətləri</p><p className="mt-1 text-sm font-bold text-[hsl(var(--primary))]">{selectedSemester?.label}</p></div><span className="text-xs font-bold text-[hsl(var(--secondary-foreground))]">0 – 100</span></div>
            <div className="space-y-3">{(selectedSemester?.subjects ?? []).map((subject) => {
              const names = gradingComponents[subject.courseId] ?? [];
              const scores = componentScores[subject.courseId] ?? {};
              const toggleComponent = (name: string) => setGradingComponents((current) => ({ ...current, [subject.courseId]: names.includes(name) ? names.filter((item) => item !== name) : [...names, name] }));
              return <div key={subject.courseId} className={`overflow-hidden rounded-2xl border transition ${openGradeCourseId === subject.courseId ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.08)] shadow-sm' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/.35)]'}`}>
                <button type="button" onClick={() => setOpenGradeCourseId((current) => current === subject.courseId ? null : subject.courseId)} className={`flex w-full items-center gap-3 p-4 text-left transition ${openGradeCourseId === subject.courseId ? 'bg-[hsl(var(--accent)/.16)]' : 'hover:bg-[hsl(var(--muted)/.35)]'}`} aria-expanded={openGradeCourseId === subject.courseId} data-testid={`button-open-grade-${subject.courseId}`}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--primary))] text-xs font-black text-[hsl(var(--primary-foreground))]">F</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[hsl(var(--primary))]">{subject.title}</span><span className="mt-1 block text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{names.length ? `${names.length} qiymət meyarı aktivdir` : 'Birbaşa yekun qiymət yazılır'}</span></span><span className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${openGradeCourseId === subject.courseId ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--primary))]'}`}>{openGradeCourseId === subject.courseId ? 'Bağla' : 'Aç'}</span></button>
                {!names.length && <div className="flex items-center gap-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] p-3"><input type="number" min="0" max="100" step="1" value={grades[subject.courseId] ?? ''} onChange={(event) => setGrades((current) => ({ ...current, [subject.courseId]: event.target.value }))} placeholder="Yekun qiymət (0–100)" className={`${inputClass} min-w-0 flex-1`} data-testid={`input-quick-grade-${subject.courseId}`} /><button type="button" onClick={() => void saveSingleGrade(subject)} disabled={savingCourseId === subject.courseId} className="shrink-0 rounded-xl bg-[hsl(var(--primary))] px-3 py-2.5 text-[10px] font-bold text-[hsl(var(--primary-foreground))] transition hover:opacity-90 disabled:opacity-60" data-testid={`button-quick-save-grade-${subject.courseId}`}>{savingCourseId === subject.courseId ? '...' : 'Yadda saxla'}</button></div>}
                {openGradeCourseId === subject.courseId && <div className="mt-3 space-y-3 border-t border-[hsl(var(--border))] pt-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {['Dərsdə iştirak', 'Dərslərdə fəallıq', 'Birinci imtahan nəticələri', 'Sonuncu imtahan nəticələri'].map((name) => <label key={name} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${names.includes(name) ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.16)] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/.45)]'}`}><input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" checked={names.includes(name)} onChange={() => toggleComponent(name)} />{name}</label>)}
                  </div>
                  <button type="button" className="inline-flex items-center rounded-xl border border-dashed border-[hsl(var(--primary)/.45)] bg-[hsl(var(--card))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))]" onClick={() => setShowCustomComponentInput((current) => ({ ...current, [subject.courseId]: !current[subject.courseId] }))}>+ Yeni qiymət meyarı əlavə et</button>
                  {showCustomComponentInput[subject.courseId] && <div className="rounded-xl border border-[hsl(var(--accent)/.55)] bg-[hsl(var(--card))] p-3 shadow-sm"><label className="mb-2 block text-[11px] font-bold text-[hsl(var(--primary))]">Yeni meyarın adı</label><div className="flex flex-col gap-2 sm:flex-row"><input autoFocus type="text" value={customComponentInputs[subject.courseId] ?? ''} onChange={(event) => setCustomComponentInputs((current) => ({ ...current, [subject.courseId]: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); const name = (customComponentInputs[subject.courseId] ?? '').trim(); if (name && !names.includes(name)) { toggleComponent(name); setCustomComponentInputs((current) => ({ ...current, [subject.courseId]: '' })); setShowCustomComponentInput((current) => ({ ...current, [subject.courseId]: false })); } } }} placeholder="Məsələn: Layihə işi" className={`${inputClass} flex-1`} data-testid={`input-custom-grade-name-${subject.courseId}`} /><button type="button" className="rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] hover:opacity-90" onClick={() => { const name = (customComponentInputs[subject.courseId] ?? '').trim(); if (name && !names.includes(name)) { toggleComponent(name); setCustomComponentInputs((current) => ({ ...current, [subject.courseId]: '' })); setShowCustomComponentInput((current) => ({ ...current, [subject.courseId]: false })); } }}>Əlavə et</button></div></div>}
                  {names.length ? <div className="space-y-2">{names.map((name) => <div key={name} className="grid grid-cols-[1fr_110px] items-center gap-3"><label className="text-xs">{name}</label><input type="number" min="0" max="100" step="1" value={scores[name] ?? ''} onChange={(event) => setComponentScores((current) => ({ ...current, [subject.courseId]: { ...(current[subject.courseId] ?? {}), [name]: event.target.value } }))} placeholder="0–100" className={inputClass} /></div>)}</div> : <p className="text-xs text-[hsl(var(--muted-foreground))]">Meyar seçilməyibsə, yalnız yekun qiymət yazılır.</p>}
                </div>}
                {openGradeCourseId === subject.courseId && <button type="button" onClick={() => void saveSingleGrade(subject)} disabled={savingCourseId === subject.courseId} className="mt-3 w-full rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60" data-testid={`button-save-grade-${subject.courseId}`}>{savingCourseId === subject.courseId ? 'Yadda saxlanılır...' : 'Bu dərsin qiymətini yadda saxla'}</button>}
              </div>;
            })}</div>
           </div>}
             {mode === 'attendance' && <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.28)] p-4">
              <p className="mb-3 text-xs font-bold text-[hsl(var(--primary))]">Davamiyyət qeydi</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Dərs">
                  <select className={inputClass} value={attendanceCourseId} onChange={(event) => setAttendanceCourseId(event.target.value)} required data-testid="select-attendance-course">
                    <option value="">Dərs seçin</option>
                    {(selectedSemester?.subjects ?? []).map((subject) => <option key={subject.courseId} value={subject.courseId}>{subject.title}</option>)}
                  </select>
                </Field>
                 <Field label="Davamiyyət tarixi" hint="Qeyd bu tarixə yazılacaq.">
                   <input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} className={inputClass} required data-testid="input-attendance-date" />
                 </Field>
                <Field label="İştirak vəziyyəti">
                  <select className={inputClass} value={attendanceStatus} onChange={(event) => setAttendanceStatus(event.target.value as typeof attendanceStatus)} data-testid="select-attendance-status">
                    <option value="present">İştirak edib</option>
                    <option value="absent">İştirak etməyib</option>
                    <option value="late">Gecikib</option>
                    <option value="excused">Üzrlü</option>
                  </select>
                </Field>
              </div>
              <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Qeyd yadda saxlanarkən müəllim adı serverdə giriş hesabından götürülür.</p>
            </div>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{mode === 'grades' ? 'Boş saxlanan qiymətlər GPA hesablanmasına daxil edilmir.' : 'Qeyd seçilmiş dərs və tarix üzrə tələbənin tarixçəsinə əlavə olunur.'}</p>
              <div className="flex flex-wrap gap-2">
                {mode === 'attendance' && <button type="button" disabled={updateAttendance.isPending} onClick={() => void save(undefined, 'absent')} className="focus-ring rounded-xl border border-[hsl(var(--destructive)/.35)] px-4 py-2.5 text-sm font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)] disabled:opacity-50" data-testid="button-mark-absent">
                  Davamiyyət qeyd et
                </button>}
                <button type="submit" disabled={updateProfile.isPending || updateGrades.isPending || updateAttendance.isPending} className={buttonClass} data-testid={mode === 'grades' ? 'button-save-grades' : 'button-save-attendance'}>{updateProfile.isPending || updateGrades.isPending || updateAttendance.isPending ? 'Yadda saxlanılır...' : mode === 'grades' ? 'Qiymətləri yadda saxla' : 'Davamiyyəti yadda saxla'}</button>
              </div>
            </div>
          <FormNotice text={notice} error={notice.includes('bilmədi') || notice.includes('arasında')} />
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
  const title = filter === 'all' ? 'Ümumi tələbələr' : `${filter}-cü tədris ili tələbələri`;
  const formatDate = (value: string) => new Intl.DateTimeFormat('az-AZ', { dateStyle: 'medium' }).format(new Date(value));
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
    const reason = window.prompt(`${fullName} hesabının silinmə səbəbini yazın (məcburidir):`, '');
    if (reason === null || !reason.trim()) {
      setNotice('Silinmə səbəbi yazılmadan hesab silinə bilməz.');
      return;
    }
    if (!window.confirm(`${fullName} hesabını deaktiv etmək istəyirsiniz? Bu əməliyyat geri qaytarıla bilməz.`)) return;
    setNotice('');
    deleteStudent.mutate({ profileId: student.profileId, data: { reason: reason.trim() } }, {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetAdminStudentsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetAdminAcademicProfilesQueryKey() }),
        ]);
        setNotice(`${fullName} hesabı silindi.`);
      },
      onError: () => setNotice('Tələbə hesabı silinə bilmədi. Bir qədər sonra yenidən cəhd edin.'),
    });
  };
  return (
    <div className={embedded ? 'w-full' : 'fixed inset-0 z-50 overflow-y-auto bg-[hsl(var(--primary)/.48)] px-4 py-8 backdrop-blur-sm'} role={embedded ? 'region' : 'dialog'} aria-modal={embedded ? undefined : true} aria-labelledby="student-directory-title" data-testid="student-directory">
      <div className={`mx-auto max-w-4xl rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-lg)] md:p-8 ${embedded ? 'shadow-[var(--shadow-xs)]' : ''}`}>
        <div className="flex items-start justify-between gap-4 border-b border-[hsl(var(--border))] pb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--secondary-foreground))]">Akademik kataloq</p>
            <h2 id="student-directory-title" className="mt-1 font-serif text-3xl text-[hsl(var(--primary))]">{title}</h2>
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Yalnız təsdiqlənmiş tələbələr göstərilir.</p>
          </div>
          <button type="button" onClick={onClose} className="focus-ring rounded-xl p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Pəncərəni bağla"><X size={20} /></button>
        </div>
        <div className="mt-5">
          <label htmlFor="student-directory-search" className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Tələbə axtar</label>
          <input id="student-directory-search" className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ad, soyad, tələbə nömrəsi, email və ya telefon..." data-testid="input-student-search" />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.28)] p-3" data-testid="student-bulk-actions">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--primary))]">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection} disabled={!visibleProfileIds.length} data-testid="checkbox-select-all-students" />
            Hamısını seç
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{selectedProfileIds.length} tələbə seçilib</span>
            <button type="button" onClick={() => void bulkPromote()} disabled={!canEdit || !selectedProfileIds.length || bulkBusy !== null} className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-bulk-promote"><GraduationCap size={14} /> {bulkBusy === 'promotion' ? 'Keçirilir...' : 'Semestrə keçir'}</button>
            <button type="button" onClick={() => setNotificationOpen((current) => !current)} disabled={!selectedProfileIds.length || bulkBusy !== null} className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--secondary-foreground))] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-open-bulk-notification"><Send size={14} /> Bildiriş göndər</button>
          </div>
        </div>
        {notificationOpen && <form onSubmit={sendBulkNotification} className="mt-3 space-y-3 rounded-xl border border-[hsl(var(--secondary-foreground)/.25)] bg-[hsl(var(--secondary)/.25)] p-4" data-testid="form-bulk-notification">
          <p className="text-xs font-bold text-[hsl(var(--primary))]">{selectedProfileIds.length} seçilmiş tələbəyə bildiriş</p>
          <input required maxLength={160} className={inputClass} value={notificationForm.title} onChange={(event) => setNotificationForm((current) => ({ ...current, title: event.target.value }))} placeholder="Bildiriş başlığı" data-testid="input-bulk-notification-title" />
          <textarea required maxLength={5000} rows={3} className={`${inputClass} resize-y`} value={notificationForm.body} onChange={(event) => setNotificationForm((current) => ({ ...current, body: event.target.value }))} placeholder="Bildiriş mətni" data-testid="textarea-bulk-notification-body" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select className={`${inputClass} max-w-xs`} value={notificationForm.destination} onChange={(event) => setNotificationForm((current) => ({ ...current, destination: event.target.value }))} data-testid="select-bulk-notification-destination">
              <option value="home">Tələbə panelində</option><option value="gmail">Gmail ilə</option><option value="both">Panel və Gmail</option>
            </select>
            <button type="submit" disabled={bulkBusy !== null} className={buttonClass} data-testid="button-send-bulk-notification">{bulkBusy === 'notification' ? 'Göndərilir...' : 'Göndər'}</button>
          </div>
        </form>}
        {notice && <p className={`mt-3 rounded-xl p-3 text-xs font-semibold ${notice.includes('silinə bilmədi') ? 'bg-[hsl(var(--destructive)/.08)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--secondary)/.45)] text-[hsl(var(--secondary-foreground))]'}`}>{notice}</p>}
        {studentsQuery.isLoading ? (
          <div className="mt-6 space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" />)}</div>
        ) : studentsQuery.isError ? (
          <p className="mt-6 rounded-2xl border border-[hsl(var(--destructive)/.2)] bg-[hsl(var(--destructive)/.05)] p-5 text-sm font-semibold text-[hsl(var(--destructive))]">Tələbə siyahısı yüklənə bilmədi.</p>
        ) : (
          <div className="mt-6 space-y-5">
            {terms.map((termNumber) => {
              const termStudents = filteredStudents.filter((student) => student.currentTermNumber === termNumber);
              return (
                <section key={termNumber} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.22)] p-4" aria-labelledby={`student-term-${termNumber}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 id={`student-term-${termNumber}`} className="font-bold text-[hsl(var(--primary))]">{studentTermLabel(termNumber)}</h3>
                    <span className="rounded-full bg-[hsl(var(--secondary)/.6)] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--secondary-foreground))]">{termStudents.length} tələbə</span>
                  </div>
                  {termStudents.length ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {termStudents.map((student) => (
                        <article key={student.profileId} onClick={() => setSelectedStudentId(student.profileId)} className="cursor-pointer rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 transition hover:-translate-y-0.5 hover:border-[hsl(var(--secondary-foreground)/.45)] hover:shadow-[var(--shadow-sm)]" data-testid={`student-directory-item-${student.profileId}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2"><input type="checkbox" checked={selectedProfileIds.includes(student.profileId)} onChange={() => toggleStudentSelection(student.profileId)} onClick={(event) => event.stopPropagation()} aria-label={`${formatFullName(student.firstName, student.lastName)} seç`} data-testid={`checkbox-select-student-${student.profileId}`} /><div><h4 className="font-bold text-[hsl(var(--primary))]">{formatFullName(student.firstName, student.lastName)}</h4><span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">Tələbə № T{String(student.studentNumber).padStart(4, '0')}</span></div></div>
                              <div className="flex items-center gap-1"><button type="button" onClick={(event) => { event.stopPropagation(); setEditingStudentUserId(student.clerkUserId); }} disabled={!canEdit} className="focus-ring rounded-lg px-2 py-1 text-[10px] font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))] disabled:hidden" data-testid={`button-edit-student-${student.profileId}`}>Düzənlə</button><button type="button" onClick={(event) => { event.stopPropagation(); deleteStudentAccount(student); }} disabled={deleteStudent.isPending} className="focus-ring rounded-lg px-2 py-1 text-[10px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)] disabled:opacity-50" data-testid={`button-delete-student-${student.profileId}`}>Hesabı sil</button></div>
                          </div>
                          <dl className="mt-3 space-y-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                            <div className="flex justify-between gap-3"><dt>Email</dt><dd className="text-right font-semibold text-[hsl(var(--primary))]">{student.email}</dd></div>
                            <div className="flex justify-between gap-3"><dt>Telefon</dt><dd className="font-semibold text-[hsl(var(--primary))]">{student.phone}</dd></div>
                            <div className="flex justify-between gap-3"><dt>Qeydiyyat tarixi</dt><dd className="font-semibold text-[hsl(var(--primary))]">{formatDate(student.registeredAt)}</dd></div>
                          </dl>
                           <div className="mt-4 border-t border-[hsl(var(--border))] pt-3">
                             <p className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Dərs cədvəlinə giriş</p>
                              {scheduleAccessLoading ? <span className="text-xs text-[hsl(var(--muted-foreground))]">Status yoxlanılır...</span> : <button type="button" onClick={(event) => { event.stopPropagation(); void updateScheduleAccess(student.profileId, formatFullName(student.firstName, student.lastName), !scheduleAccess[student.profileId]); }} disabled={approvingScheduleProfileId === student.profileId} className={`focus-ring inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${scheduleAccess[student.profileId] ? 'border border-emerald-300 bg-emerald-100 text-emerald-800' : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'}`} data-testid={`${scheduleAccess[student.profileId] ? 'button-revoke-schedule-access' : 'button-approve-schedule-access'}-${student.profileId}`}><CheckCircle2 size={14} /> {approvingScheduleProfileId === student.profileId ? 'Yadda saxlanılır...' : scheduleAccess[student.profileId] ? 'Təsdiqlənib · geri al' : 'Cədvələ girişi təsdiqlə'}</button>}
                           </div>
                          {editingStudentUserId === student.clerkUserId && <UserProfileEditor inline user={{ id: student.clerkUserId, firstName: student.firstName, lastName: student.lastName, username: student.username, email: student.email, role: 'none' }} onClose={() => setEditingStudentUserId(null)} onSaved={async () => { setEditingStudentUserId(null); await studentsQuery.refetch(); }} />}
                        </article>
                      ))}
                    </div>
                  ) : <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Bu semestrdə tələbə yoxdur.</p>}
                </section>
              );
            })}
            {!students.length && <p className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-7 text-center text-sm text-[hsl(var(--muted-foreground))]">Təsdiqlənmiş tələbə tapılmadı.</p>}
          </div>
        )}
        {selectedStudentId !== null && <StudentDetail profileId={selectedStudentId} onClose={() => setSelectedStudentId(null)} />}
      </div>
    </div>
  );
}

function StudentDetail({ profileId, onClose }: { profileId: number; onClose: () => void }) {
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
    if (!window.confirm(`${profile.firstName} ${profile.lastName} üçün növbəti semestrə keçidi təsdiqləmək istəyirsiniz?`)) return;
    setIsPromoting(true);
    setPromotionNotice('');
    try {
      const response = await fetch(apiUrl(`/admin/academic-profiles/${profileId}/promote`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedTermNumber: profile.currentTermNumber }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Keçid təsdiqlənmədi.');
      await Promise.all([
        profileQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: getGetAdminAcademicProfilesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminStudentsQueryKey() }),
      ]);
      setPromotionNotice('Növbəti semestrə keçid təsdiqləndi.');
    } catch (error) {
      setPromotionNotice(error instanceof Error ? error.message : 'Keçid təsdiqlənmədi.');
    } finally {
      setIsPromoting(false);
    }
  };
  const demoteStudent = async () => {
    if (!profile || profile.currentTermNumber <= 1) return;
    if (!window.confirm(`${profile.firstName} ${profile.lastName} tələbəsini əvvəlki semestrə qaytarmaq istəyirsiniz?`)) return;
    setIsPromoting(true);
    setPromotionNotice('');
    try {
      const response = await fetch(apiUrl(`/admin/academic-profiles/${profileId}/demote`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedTermNumber: profile.currentTermNumber }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Tələbə əvvəlki semestrə qaytarılmadı.');
      await Promise.all([
        profileQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: getGetAdminAcademicProfilesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetAdminStudentsQueryKey() }),
      ]);
      setPromotionNotice('Tələbə əvvəlki semestrə qaytarıldı.');
    } catch (error) {
      setPromotionNotice(error instanceof Error ? error.message : 'Tələbə əvvəlki semestrə qaytarılmadı.');
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
      if (!response.ok) throw new Error(result.error || 'Cədvəl giriş statusu dəyişdirilmədi.');
      setScheduleAccessApproved(result.approved === true);
      setPromotionNotice(approved ? 'Tələbənin dərs cədvəlinə girişi təsdiqləndi.' : 'Tələbənin dərs cədvəlinə girişi geri alındı.');
    } catch (error) {
      setPromotionNotice(error instanceof Error ? error.message : 'Cədvəl giriş statusu dəyişdirilmədi.');
    } finally {
      setIsApprovingScheduleAccess(false);
    }
  };
  return <div className="fixed inset-0 z-[60] overflow-y-auto bg-[hsl(var(--primary)/.52)] px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="student-detail-title">
    <div className="mx-auto max-w-5xl rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-lg)] md:p-8">
      <div className="flex items-start justify-between gap-4 border-b border-[hsl(var(--border))] pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--secondary-foreground))]">Tələbə məlumatları</p><h2 id="student-detail-title" className="mt-1 font-serif text-3xl text-[hsl(var(--primary))]">{profile ? `${profile.firstName} ${profile.lastName}` : 'Tələbə profili'}</h2></div><button type="button" onClick={onClose} className="focus-ring rounded-xl p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Məlumatları bağla"><X size={20} /></button></div>
      {profileQuery.isLoading ? <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">Tələbə məlumatları yüklənir...</p> : !profile ? <p className="mt-6 text-sm text-[hsl(var(--destructive))]">Tələbə məlumatları yüklənə bilmədi.</p> : <div className="mt-6 space-y-6">
        <dl className="grid gap-3 rounded-2xl bg-[hsl(var(--muted)/.35)] p-4 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Tələbə №</dt><dd className="mt-1 font-bold">T{String(profile.studentNumber).padStart(4, '0')}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">E-poçt</dt><dd className="mt-1 font-bold">{profile.email}</dd></div><div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Telefon</dt><dd className="mt-1 font-bold">{profile.phone}</dd></div></dl>
        <section className="rounded-2xl border border-[hsl(var(--accent)/.55)] bg-[hsl(var(--accent)/.12)] p-4" data-testid="section-semester-promotion">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">Semestr keçidi</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Cari semestr: <strong>{profile.currentTermNumber}-ci semestr</strong></p></div>
             <div className="flex flex-wrap gap-2">
               {profile.currentTermNumber > 1 && <button type="button" onClick={() => void demoteStudent()} disabled={isPromoting} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="button-demote-semester"><GraduationCap size={16} /> {isPromoting ? 'Təsdiqlənir...' : 'Əvvəlki semestrə qaytar'}</button>}
               {profile.currentTermNumber < 8 ? <button type="button" onClick={() => void promoteStudent()} disabled={isPromoting} className={buttonClass} data-testid="button-confirm-semester-promotion"><GraduationCap size={16} /> {isPromoting ? 'Təsdiqlənir...' : 'Növbəti semestrə keçidi təsdiqlə'}</button> : <span className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">Son semestr</span>}
             </div>
          </div>
          {promotionNotice && <p className="mt-3 text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{promotionNotice}</p>}
        </section>
         <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] p-4" data-testid="section-schedule-access">
           <div className="flex flex-wrap items-center justify-between gap-3">
             <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">Dərs cədvəlinə giriş</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{scheduleAccessApproved ? 'Tələbə dərs cədvəlini görə bilər.' : 'Yeni tələbə təsdiqlənənə qədər dərs cədvəlini görə bilməz.'}</p></div>
              {isScheduleAccessLoading ? <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Yoxlanılır...</span> : <button type="button" onClick={() => void updateScheduleAccess()} disabled={isApprovingScheduleAccess} className={scheduleAccessApproved ? 'focus-ring inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-200 disabled:opacity-50' : buttonClass} data-testid={scheduleAccessApproved ? 'button-revoke-schedule-access' : 'button-approve-schedule-access'}><CheckCircle2 size={16} /> {isApprovingScheduleAccess ? 'Yadda saxlanılır...' : scheduleAccessApproved ? 'Təsdiqlənib · geri al' : 'Cədvələ girişi təsdiqlə'}</button>}
           </div>
         </section>
        {profile.semesters.filter((semester) => semester.termNumber <= profile.currentTermNumber).map((semester) => <section key={semester.termNumber} className="rounded-2xl border border-[hsl(var(--border))] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-serif text-xl text-[hsl(var(--primary))]">{semester.label}</h3><span className="text-xs font-bold text-[hsl(var(--secondary-foreground))]">GPA: {semester.gpa === null ? '—' : semester.gpa.toFixed(2)} · Ümumi qayıb: {semester.subjects.reduce((sum, subject) => sum + subject.absenceCount, 0)}</span></div><div className="mt-3 divide-y divide-[hsl(var(--border))]">{semester.subjects.map((subject) => <div key={subject.courseId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span className="font-semibold">{subject.title}</span><span className="text-xs font-bold text-[hsl(var(--secondary-foreground))]">Qiymət: {subject.grade === null ? '—' : `${subject.grade.toFixed(2)} / 5`} · Qayıb: {subject.absenceCount} · Qayıb faizi: {subject.attendancePercent === null ? '—%' : `${subject.attendancePercent}%`}</span></div>)}</div>{semester.attendanceRecords.length ? <div className="mt-4 overflow-x-auto"><p className="mb-2 text-xs font-bold text-[hsl(var(--primary))]">Davamiyyət tarixçəsi</p><div className="space-y-2">{semester.attendanceRecords.map((record) => <div key={record.id} className="grid gap-1 rounded-lg bg-[hsl(var(--muted)/.4)] p-3 text-xs sm:grid-cols-[1fr_auto_auto]"><span className="font-semibold">{record.courseTitle}</span><span>{record.attendanceDate}</span><span>{record.teacherName} · {record.status === 'absent' ? 'Qayıb' : record.status === 'present' ? 'İştirak edib' : record.status}</span></div>)}</div></div> : <p className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">Bu semestr üzrə davamiyyət qeydi yoxdur.</p>}</section>)}
      </div>}
    </div>
  </div>;
}

function TeacherStats({ canEdit }: { canEdit: boolean }) {
  const profilesQuery = useGetAdminAcademicProfiles();
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
    <section className="mt-8" aria-labelledby="teacher-stats-title" data-testid="teacher-stats">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--secondary-foreground))]">Akademik icmal</p>
          <h2 id="teacher-stats-title" className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Tələbə statistikası</h2>
        </div>
        <p className="hidden text-xs text-[hsl(var(--muted-foreground))] sm:block">Təsdiqlənmiş tələbələr üzrə</p>
      </div>
      {profilesQuery.isLoading ? (
         <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" />)}
        </div>
      ) : profilesQuery.isError ? (
        <p className="rounded-2xl border border-[hsl(var(--destructive)/.2)] bg-[hsl(var(--destructive)/.05)] p-4 text-sm font-semibold text-[hsl(var(--destructive))]">Tələbə statistikası yüklənə bilmədi.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
           <button type="button" onClick={() => setDirectoryFilter('all')} className="focus-ring rounded-2xl bg-[hsl(var(--primary))] p-5 text-left text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5">
            <UsersRound size={19} className="text-[hsl(var(--accent))]" />
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--primary-foreground)/.62)]">Ümumi tələbə</p>
            <p className="mt-1 font-serif text-4xl leading-none">{profiles.length}</p>
           </button>
           <button type="button" onClick={() => setDirectoryFilter(1)} className="focus-ring rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5">
            <GraduationCap size={19} className="text-[hsl(var(--secondary-foreground))]" />
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">1-ci tədris ili</p>
            <p className="mt-1 font-serif text-4xl leading-none text-[hsl(var(--primary))]">{firstYearCount}</p>
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">tələbə</p>
           </button>
           <button type="button" onClick={() => setDirectoryFilter(2)} className="focus-ring rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5">
            <GraduationCap size={19} className="text-[hsl(var(--secondary-foreground))]" />
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">2-ci tədris ili</p>
            <p className="mt-1 font-serif text-4xl leading-none text-[hsl(var(--primary))]">{secondYearCount}</p>
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">tələbə</p>
           </button>
            {activeTerms.includes(5) && activeTerms.includes(6) && <button type="button" onClick={() => setDirectoryFilter(3)} className="focus-ring rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5">
             <GraduationCap size={19} className="text-[hsl(var(--secondary-foreground))]" />
             <p className="mt-5 text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">3-cü tədris ili</p>
             <p className="mt-1 font-serif text-4xl leading-none text-[hsl(var(--primary))]">{thirdYearCount}</p>
             <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">tələbə</p>
            </button>}
            {activeTerms.includes(7) && activeTerms.includes(8) && <button type="button" onClick={() => setDirectoryFilter(4)} className="focus-ring rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5">
             <GraduationCap size={19} className="text-[hsl(var(--secondary-foreground))]" />
             <p className="mt-5 text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">4-cü tədris ili</p>
             <p className="mt-1 font-serif text-4xl leading-none text-[hsl(var(--primary))]">{fourthYearCount}</p>
             <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">tələbə</p>
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
  owner_assistant: 'Sahib köməkçisi',
  teacher: 'Müəllim',
  supervisor: 'Nəzarətçi',
  admin: 'Köhnə admin rolu',
};

const formatTeacherNumber = (index: number) => `M${String(index + 1).padStart(2, '0')}`;
const formatSupervisorNumber = (index: number) => `B${String(index + 1).padStart(3, '0')}`;
const formatOwnerAssistantNumber = (index: number) => `NK${index + 1}`;
const adminUserName = (user: Pick<AdminUser, 'firstName' | 'lastName' | 'username'>) =>
  [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || 'İstifadəçi';
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
  schedule: 'Tədris proqramı',
  assignments: 'Ev tapşırıqları',
  teacherAssignment: 'Müəllim olsun (müəllim təyinatı)',
  userRoleManagement: 'Başqalarına müəllimlik verə bilsin',
} as const;
type RolePermissionKey = keyof typeof rolePermissionLabels;
type IndividualPermissionRole = 'teacher' | 'supervisor' | 'owner_assistant';
const individualPermissionRole = (user: AdminUser): IndividualPermissionRole | null =>
  user.role === 'teacher' || user.role === 'supervisor' || user.role === 'owner_assistant' ? user.role : null;

const adminTabButtonClass = (value: string, active: boolean) =>
  `focus-ring inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${active ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`;

function RoleManagement({ canConfigurePermissions }: { canConfigurePermissions: boolean }) {
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
  const individualProfileQuery = useGetAdminUserProfile(permissionUser?.id ?? '', {
    query: {
      enabled: Boolean(permissionUser),
      queryKey: getGetAdminUserProfileQueryKey(permissionUser?.id ?? ''),
    },
  });

  useEffect(() => {
    void fetch(apiUrl('/admin/role-permissions')).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { teacher?: RolePermissionKey[]; supervisor?: RolePermissionKey[]; owner_assistant?: RolePermissionKey[] };
      setRolePermissions((current) => ({
        teacher: data.teacher ?? current.teacher,
        supervisor: data.supervisor ?? current.supervisor,
        owner_assistant: data.owner_assistant ?? current.owner_assistant,
      }));
    }).catch(() => undefined);
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
       setNotice(`${user.firstName || user.username || user.email} üçün rol yeniləndi. Yeni rol istifadəçi səhifəni yenilədikdə aktiv olacaq.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'İstifadəçi rolu yenilənə bilmədi.');
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
        Buradan qeydiyyatdan keçmiş istifadəçilərə müəllim, nəzarətçi və ya sahib köməkçisi rolu verə bilərsiniz. Sistem sahibi sabitdir və bu bölmədən dəyişdirilə bilməz.
      </div>
         <div className="grid gap-4 md:grid-cols-3" data-testid="staff-role-summary">
         <section className="order-2 rounded-2xl border border-[hsl(var(--primary))] bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))]" data-testid="teacher-summary">
           <button type="button" onClick={() => setExpandedSummaryRole((current) => current === 'teacher' ? null : 'teacher')} aria-expanded={expandedSummaryRole === 'teacher'} className="focus-ring flex w-full items-start justify-between gap-4 rounded-xl text-left"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--accent))]">Müəllim heyəti</p><h3 className="mt-2 font-serif text-3xl">{teachers.length}</h3><p className="mt-1 text-xs text-[hsl(var(--primary-foreground)/.65)]">{expandedSummaryRole === 'teacher' ? 'adları gizlət' : 'adları görmək üçün basın'}</p></div><UsersRound className="text-[hsl(var(--accent))]" size={24} /></button>
            {expandedSummaryRole === 'teacher' && (teachers.length ? <div className="mt-5 flex flex-wrap gap-2">{teachers.map((teacher, index) => <button type="button" key={teacher.id} onClick={() => setViewingUser(teacher)} className="focus-ring rounded-full bg-[hsl(var(--primary-foreground)/.12)] px-3 py-1.5 text-xs font-semibold hover:bg-[hsl(var(--primary-foreground)/.22)]">{teacher.role === 'owner' ? 'Sahib' : formatTeacherNumber(index)} · {adminUserName(teacher)}</button>)}</div> : <p className="mt-5 text-xs text-[hsl(var(--primary-foreground)/.65)]">Hələ müəllim təyin edilməyib.</p>)}
         </section>
          <section className="order-1 rounded-2xl border border-[hsl(var(--secondary)/.75)] bg-[hsl(var(--secondary)/.48)] p-5 shadow-[var(--shadow-xs)]" data-testid="owner-assistant-summary">
           <button type="button" onClick={() => setExpandedSummaryRole((current) => current === 'assistant' ? null : 'assistant')} aria-expanded={expandedSummaryRole === 'assistant'} className="focus-ring flex w-full items-start justify-between gap-4 rounded-xl text-left"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">Sahib köməkçiləri</p><h3 className="mt-2 font-serif text-3xl text-[hsl(var(--primary))]">{ownerAssistants.length}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{expandedSummaryRole === 'assistant' ? 'adları gizlət' : 'adları görmək üçün basın'}</p></div><UserCog className="text-[hsl(var(--secondary-foreground))]" size={24} /></button>
            {expandedSummaryRole === 'assistant' && (ownerAssistants.length ? <div className="mt-5 flex flex-wrap gap-2">{ownerAssistants.map((assistant, index) => <button type="button" key={assistant.id} onClick={() => setViewingUser(assistant)} className="focus-ring rounded-full bg-[hsl(var(--muted))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--border))]">{formatOwnerAssistantNumber(index)} · {adminUserName(assistant)}</button>)}</div> : <p className="mt-5 text-xs text-[hsl(var(--muted-foreground))]">Hələ sahib köməkçisi təyin edilməyib.</p>)}
         </section>
          <section className="order-3 rounded-2xl border border-[hsl(var(--accent)/.8)] bg-[hsl(var(--accent)/.22)] p-5 shadow-[var(--shadow-xs)]" data-testid="supervisor-summary">
           <button type="button" onClick={() => setExpandedSummaryRole((current) => current === 'supervisor' ? null : 'supervisor')} aria-expanded={expandedSummaryRole === 'supervisor'} className="focus-ring flex w-full items-start justify-between gap-4 rounded-xl text-left"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">Nəzarətçilər</p><h3 className="mt-2 font-serif text-3xl text-[hsl(var(--primary))]">{supervisors.length}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{expandedSummaryRole === 'supervisor' ? 'adları gizlət' : 'adları görmək üçün basın'}</p></div><ShieldCheck className="text-[hsl(var(--secondary-foreground))]" size={24} /></button>
            {expandedSummaryRole === 'supervisor' && (supervisors.length ? <div className="mt-5 flex flex-wrap gap-2">{supervisors.map((supervisor, index) => <button type="button" key={supervisor.id} onClick={() => setViewingUser(supervisor)} className="focus-ring rounded-full bg-[hsl(var(--muted))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--border))]">{formatSupervisorNumber(index)} · {adminUserName(supervisor)}</button>)}</div> : <p className="mt-5 text-xs text-[hsl(var(--muted-foreground))]">Hələ nəzarətçi təyin edilməyib.</p>)}
         </section>
       </div>
      <h3 id="user-role-management-list" className="pt-2 font-serif text-2xl text-[hsl(var(--primary))]">İstifadəçi rollarını idarə et</h3>
       {canConfigurePermissions && <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPermissionRole('teacher')} className="focus-ring rounded-xl border border-[hsl(var(--border))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="button-configure-teacher-permissions">Müəllim rollarını təyin et</button>
        <button type="button" onClick={() => setPermissionRole('supervisor')} className="focus-ring rounded-xl border border-[hsl(var(--border))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="button-configure-supervisor-permissions">Nəzarətçi rollarını təyin et</button>
       </div>}
      <button type="button" disabled={!canConfigurePermissions} onClick={() => setPermissionRole('owner_assistant')} className="focus-ring rounded-xl border border-[hsl(var(--border))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-manage-owner-assistant-roles">Sahib köməkçisinin ümumi icazələri</button>
      {users.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-7 text-center text-sm text-[hsl(var(--muted-foreground))]">Hələ qeydiyyatdan keçən istifadəçi yoxdur.</p>
      ) : (
        <div className="space-y-3">
          {sortedUsers.map((user) => {
            const role = selectedRole(user);
            const isOwner = user.role === 'owner';
            const hasChange = !isOwner && role !== (user.role === 'admin' ? UserRoleUpdateInputRole.teacher : user.role);
            return (
              <article key={user.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[hsl(var(--primary))]">{adminUserName(user)}</p>
                    <p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{user.email}{user.username ? ` · @${user.username}` : ''}</p>
                  </div>
                 <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${roleBadgeClass(user.role)}`}>{isOwner ? 'N1 · Sistem sahibi' : user.role === 'owner_assistant' ? `${formatOwnerAssistantNumber(ownerAssistants.findIndex((assistant) => assistant.id === user.id))} · ${roleLabels[user.role]}` : user.role === 'teacher' || user.role === 'admin' ? `${formatTeacherNumber(teachers.findIndex((teacher) => teacher.id === user.id))} · ${roleLabels[user.role]}` : user.role === 'supervisor' ? `${formatSupervisorNumber(supervisors.findIndex((supervisor) => supervisor.id === user.id))} · ${roleLabels[user.role]}` : roleLabels[user.role]}</span>
                </div>
                {isOwner ? (
                  <p className="mt-4 text-xs font-semibold text-[hsl(var(--muted-foreground))]">Bu hesab sistem sahibidir; rolunu dəyişmək mümkün deyil.</p>
                ) : (
                  <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[hsl(var(--border))] pt-4">
                    <label className="min-w-48 flex-1">
                      <span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Səlahiyyət</span>
                      <select value={role} onChange={(event) => setDraftRoles((current) => ({ ...current, [user.id]: event.target.value as typeof role }))} className={inputClass} data-testid={`select-user-role-${user.id}`}>
                        <option value={UserRoleUpdateInputRole.owner_assistant} data-testid="option-role-owner-assistant">Sahib köməkçisi</option>
                        <option value={UserRoleUpdateInputRole.teacher}>Müəllim</option>
                        <option value={UserRoleUpdateInputRole.supervisor}>Nəzarətçi</option>
                        <option value={UserRoleUpdateInputRole.none}>Adi istifadəçi</option>
                      </select>
                    </label>
                     <div className="flex flex-wrap gap-2">
                       <button type="button" className={buttonClass} disabled={!hasChange || busyUserId === user.id} onClick={() => void saveRole(user)} data-testid={`button-save-user-role-${user.id}`}>
                         {busyUserId === user.id ? 'Yadda saxlanılır...' : 'Rolu yadda saxla'}
                       </button>
                        {canConfigurePermissions && individualPermissionRole(user) && <button type="button" className="focus-ring rounded-xl border border-[hsl(var(--secondary)/.65)] px-3 py-2 text-xs font-bold text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary)/.2)]" onClick={() => { setPermissionUser(user); setIndividualPermissions([]); }} data-testid={`button-edit-individual-permissions-${user.id}`}>Fərdi icazələr</button>}
                        <button type="button" className="focus-ring rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--card))]" onClick={() => setEditingUser(user)} data-testid={`button-edit-user-${user.id}`}>Məlumatları düzəlt</button>
                         {canConfigurePermissions && user.role === 'none' && <button type="button" className="focus-ring rounded-xl border border-[hsl(var(--destructive)/.28)] px-3 py-2 text-xs font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)] disabled:opacity-50" disabled={deletingUserId === user.id} onClick={() => void removeUser(user)} data-testid={`button-delete-user-${user.id}`}>{deletingUserId === user.id ? 'Silinir...' : 'Hesabı sil'}</button>}
                     </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      <FormNotice text={notice} error={notice.includes('bilmədi') || notice.includes('tapılmadı') || notice.includes('dəyişdirilə')} />
      {permissionRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--primary)/.5)] px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="role-permissions-title">
          <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--secondary-foreground))]">Sahib icazələri</p>
                <h4 id="role-permissions-title" className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{permissionRole === 'teacher' ? 'Müəllim rollarını təyin et' : permissionRole === 'supervisor' ? 'Nəzarətçi rollarını təyin et' : 'Sahib köməkçisi rollarını idarə et'}</h4>
                 <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Bu seçim fərdi icazəsi olmayan həmin roldakı istifadəçilər üçün ümumi səlahiyyət profilini müəyyən edir.</p>
              </div>
              <button type="button" onClick={() => setPermissionRole(null)} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Bağla"><X size={18} /></button>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {(Object.entries(rolePermissionLabels) as Array<[RolePermissionKey, string]>)
                .filter(([key]) => permissionRole === 'owner_assistant' || (key !== 'teacherAssignment' && key !== 'userRoleManagement'))
                .map(([key, label]) => {
                const checked = rolePermissions[permissionRole].includes(key);
                return <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[hsl(var(--border))] px-3.5 py-3 text-sm font-semibold hover:bg-[hsl(var(--muted)/.5)]"><input type="checkbox" checked={checked} onChange={() => setRolePermissions((current) => ({ ...current, [permissionRole]: checked ? current[permissionRole].filter((item) => item !== key) : [...current[permissionRole], key] }))} className="h-4 w-4 accent-[hsl(var(--primary))]" />{label}</label>;
              })}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPermissionRole(null)} className="focus-ring rounded-xl px-4 py-2.5 text-xs font-bold text-[hsl(var(--muted-foreground))]">Ləğv et</button>
              <button type="button" disabled={isSavingPermissions} onClick={async () => {
                setIsSavingPermissions(true);
                try {
                  const response = await fetch(apiUrl('/admin/role-permissions'), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rolePermissions) });
                  const data = await response.json() as { error?: string };
                  if (!response.ok) throw new Error(data.error || 'İcazələr yadda saxlanıla bilmədi.');
                  setPermissionRole(null);
                  setNotice('Rol icazələri yadda saxlanıldı.');
                } catch (error) {
                  setNotice(error instanceof Error ? error.message : 'İcazələr yadda saxlanıla bilmədi.');
                } finally { setIsSavingPermissions(false); }
              }} className={buttonClass}>{isSavingPermissions ? 'Yadda saxlanılır...' : 'İcazələri yadda saxla'}</button>
            </div>
          </div>
        </div>
      )}
      {permissionUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--primary)/.5)] px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="individual-permissions-title">
          <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--secondary-foreground))]">Fərdi səlahiyyətlər</p>
                <h4 id="individual-permissions-title" className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{adminUserName(permissionUser)} · {permissionUser.role === 'teacher' ? 'Müəllim' : permissionUser.role === 'supervisor' ? 'Nəzarətçi' : 'Sahib köməkçisi'}</h4>
                <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Bu seçim yalnız seçilmiş sahib köməkçisinə tətbiq olunur və digər sahib köməkçilərinin icazələrini dəyişmir.</p>
              </div>
              <button type="button" onClick={() => setPermissionUser(null)} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Bağla"><X size={18} /></button>
            </div>
            {individualProfileQuery.isLoading ? <p className="mt-5 text-sm text-[hsl(var(--muted-foreground))]">İcazələr yüklənir...</p> :
              individualProfileQuery.isError ? <p className="mt-5 rounded-xl bg-[hsl(var(--destructive)/.08)] p-3 text-sm font-semibold text-[hsl(var(--destructive))]">Bu istifadəçinin icazələri yüklənə bilmədi.</p> :
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {(Object.entries(rolePermissionLabels) as Array<[RolePermissionKey, string]>).map(([key, label]) => {
                    const checked = individualPermissions.includes(key);
                    return <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[hsl(var(--border))] px-3.5 py-3 text-sm font-semibold hover:bg-[hsl(var(--muted)/.5)]"><input type="checkbox" checked={checked} onChange={() => setIndividualPermissions((current) => checked ? current.filter((item) => item !== key) : [...current, key])} className="h-4 w-4 accent-[hsl(var(--primary))]" />{label}</label>;
                  })}
                </div>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPermissionUser(null)} className="focus-ring rounded-xl px-4 py-2.5 text-xs font-bold text-[hsl(var(--muted-foreground))]">Ləğv et</button>
              <button type="button" disabled={isSavingIndividualPermissions || individualProfileQuery.isLoading || individualProfileQuery.isError} onClick={async () => {
                if (!permissionUser) return;
                setIsSavingIndividualPermissions(true);
                try {
                  const role = individualPermissionRole(permissionUser);
                  if (!role) return;
                  await updateRole.mutateAsync({ userId: permissionUser.id, data: { role, permissions: individualPermissions } });
                  await queryClient.invalidateQueries({ queryKey: getGetAdminUserProfileQueryKey(permissionUser.id) });
                  setPermissionUser(null);
                  setNotice(`${adminUserName(permissionUser)} üçün fərdi icazələr yadda saxlanıldı.`);
                } catch (error) {
                  setNotice(error instanceof Error ? error.message : 'Fərdi icazələr yadda saxlanıla bilmədi.');
                } finally { setIsSavingIndividualPermissions(false); }
              }} className={buttonClass}>{isSavingIndividualPermissions ? 'Yadda saxlanılır...' : 'Fərdi icazələri yadda saxla'}</button>
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
      await updateProfile.mutateAsync({ userId: user.id, data: form });
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
         <Field label="Telefon"><input required={!readOnly} disabled={readOnly} className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+994501234567" /></Field>
         <Field label="Doğum tarixi"><input required={!readOnly} disabled={readOnly} type="date" className={inputClass} value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></Field>
         <Field label="Ərəb dili səviyyəsi"><select required={!readOnly} disabled={readOnly} className={inputClass} value={form.arabicLevel} onChange={(event) => setForm({ ...form, arabicLevel: event.target.value as AdminUserProfileInput['arabicLevel'] })}><option value="Zəif">Zəif</option><option value="Orta">Orta</option><option value="Yaxşı">Yaxşı</option><option value="Əla">Əla</option></select></Field>
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
    owner_assistant: { label: 'Sahib köməkçisi paneli', title: 'Sahib köməkçisinin ana səhifəsi', description: 'Bu görünüş sahib köməkçisinə açılan icazələrə uyğun idarəetmə sahəsini yoxlamaq üçündür.' },
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
            {role === 'owner_assistant' && <><p className="mb-4 text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Sahib köməkçisi görünüşü</p><div className="grid gap-3 sm:grid-cols-2"><PreviewCard title="Müraciətlər" text="Tələbə müraciətlərinə baxış" /><PreviewCard title="Semestr cədvəli" text="Dərs və materiallara nəzarət" /><PreviewCard title="Müəllim təyinatı" text="Açıq icazələrə əsasən" /><PreviewCard title="Mesajlar" text="Tələbə və müəllimlərlə əlaqə" /></div></>}
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
    <button type="button" onClick={() => setOpen(true)} className="focus-ring inline-flex shrink-0 items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-2.5 py-2 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))] sm:px-3" data-testid="button-open-admin-search" aria-label="Qlobal axtarış">
      <Search size={15} /><span className="hidden sm:inline">Axtar</span><kbd className="hidden rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] sm:inline">Ctrl K</kbd>
    </button>
    {open && <div className="fixed inset-0 z-[70] bg-[hsl(var(--primary)/.45)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Qlobal axtarış" data-testid="admin-global-search">
      <div className="mx-auto mt-[10vh] max-w-2xl overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-lg)]">
        <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-4">
          <Search size={18} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-4 text-sm font-semibold outline-none" placeholder="Tələbə, müraciət və ya dərs axtar..." data-testid="input-admin-global-search" />
          <button type="button" onClick={() => setOpen(false)} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Axtarışı bağla"><X size={18} /></button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-3">
          {!query.trim() && <p className="p-5 text-center text-sm text-[hsl(var(--muted-foreground))]">Axtarış üçün ən azı iki simvol yazın.</p>}
          {query.trim().length >= 2 && loading && <p className="p-5 text-center text-sm text-[hsl(var(--muted-foreground))]">Axtarılır...</p>}
          {query.trim().length >= 2 && !loading && !results.length && <p className="p-5 text-center text-sm text-[hsl(var(--muted-foreground))]">Uyğun nəticə tapılmadı.</p>}
          {results.map((result) => <button key={result.id} type="button" onClick={() => { if (result.kind === 'student' && result.profileId) onSelectStudent(result.profileId); setOpen(false); }} className="focus-ring flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-[hsl(var(--muted)/.55)]" data-testid={`admin-search-result-${result.kind}`}>
            <span className="mt-0.5 rounded-lg bg-[hsl(var(--secondary)/.65)] px-2 py-1 text-[10px] font-black uppercase text-[hsl(var(--secondary-foreground))]">{result.kind === 'student' ? 'Tələbə' : result.kind === 'application' ? 'Müraciət' : 'Dərs'}</span>
            <span className="min-w-0"><span className="block truncate text-sm font-bold text-[hsl(var(--primary))]">{result.title}</span><span className="mt-1 block truncate text-xs text-[hsl(var(--muted-foreground))]">{result.subtitle}</span></span>
          </button>)}
        </div>
      </div>
    </div>}
  </>;
}

export function AdminPanel() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab | null>('schedule');
  const [focusStudentId, setFocusStudentId] = useState<number | null>(null);
  const [unansweredQuestionCount, setUnansweredQuestionCount] = useState(0);
  useEffect(() => {
    void loadUnansweredQuestionCount().then(setUnansweredQuestionCount);
  }, []);
  const [isAnnouncementListOpen, setIsAnnouncementListOpen] = useState(false);
  const resourcesQuery = useGetAdminResources();
  const articlesQuery = useGetAdminArticles();
  const dailyBenefitsQuery = useGetAdminDailyBenefits();
  const applicationsQuery = useGetAdminApplications();
  const academicProfilesQuery = useGetAdminAcademicProfiles();
  const [decisionBusyId, setDecisionBusyId] = useState<number | null>(null);
  const [teacherBusyId, setTeacherBusyId] = useState<number | null>(null);
  const [decisionNotice, setDecisionNotice] = useState('');
  const [readExcuseIds, setReadExcuseIds] = useState<number[]>(() => {
    try { return JSON.parse(window.localStorage.getItem('medine-read-attendance-excuses') || '[]') as number[]; } catch { return []; }
  });
  const articles = articlesQuery.data ?? [];
  const dailyBenefits = dailyBenefitsQuery.data ?? [];
  const accountProfileQuery = useGetOwnUserProfile({ query: { enabled: Boolean(user), queryKey: getGetOwnUserProfileQueryKey() } });
  const profileName = [accountProfileQuery.data?.firstName, accountProfileQuery.data?.lastName].filter(Boolean).join(' ').trim();
  const firstName = user?.firstName || accountProfileQuery.data?.firstName || user?.username || 'Hesab';
  const owner = accountProfileQuery.data?.role === 'owner' || isSystemOwner(user);
  const metadataRole = typeof user?.publicMetadata === 'object' && user.publicMetadata !== null && 'role' in user.publicMetadata && typeof user.publicMetadata.role === 'string' ? user.publicMetadata.role : '';
  const activeRole = accountProfileQuery.data?.role ?? metadataRole;
  const ownerAssistant = activeRole === 'owner_assistant';
  const excusesQuery = useGetAdminAttendanceExcuses({ query: { enabled: Boolean(user), queryKey: getGetAdminAttendanceExcusesQueryKey() } });
  const subjectRequestsQuery = useGetAdminSubjectRemovalRequests({ query: { enabled: Boolean(user), queryKey: getGetAdminSubjectRemovalRequestsQueryKey() } });
  const pendingSubjectRequestCount = subjectRequestsQuery.data?.filter((item) => item.status === 'pending').length ?? 0;
  const pendingExcuseCount = excusesQuery.data?.filter((item) => item.status === 'pending' && !readExcuseIds.includes(item.id)).length ?? 0;
  const pendingApplicationCount = applicationsQuery.data?.filter((item) => item.status === 'pending').length ?? 0;
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () => { void fetch(apiUrl('/messages/unread-count')).then((response) => response.ok ? response.json() as Promise<{ count: number }> : Promise.reject()).then((result) => { if (active) setUnreadMessageCount(result.count); }).catch(() => undefined); };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const clerkFullName = user?.fullName?.trim() || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const displayName = owner ? (import.meta.env.VITE_SYSTEM_OWNER_NAME?.trim() || profileName || clerkFullName || firstName) : (profileName || clerkFullName || firstName);
  const fullName = owner
    ? (import.meta.env.VITE_SYSTEM_OWNER_NAME?.trim() || profileName || clerkFullName || firstName)
    : (profileName || clerkFullName || firstName);
  const rolePermissions = new Set(accountProfileQuery.data?.rolePermissions ?? []);
  const canManageAssignments = owner || rolePermissions.has('assignments') && (activeRole === 'teacher' || activeRole === 'admin' || activeRole === 'owner_assistant');
  const canEditCourseContent = owner || rolePermissions.has('schedule') || activeRole === 'teacher' || activeRole === 'admin';
  const accountCode = owner ? 'N1' : (typeof user?.publicMetadata === 'object' && user.publicMetadata !== null && 'staffNumber' in user.publicMetadata && typeof user.publicMetadata.staffNumber === 'string' ? user.publicMetadata.staffNumber : metadataRole === 'owner_assistant' ? 'NK1' : metadataRole === 'supervisor' ? 'B001' : 'M01');
  const toggleTab = (nextTab: Tab) => setTab((current) => current === nextTab ? null : nextTab);
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

  return (
    <div className="grain min-h-[100dvh] bg-[hsl(var(--background))]">
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card)/.9)] px-5 py-5 md:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/user-portal" className="focus-ring flex items-center gap-3 rounded-xl" data-testid="link-admin-back">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[hsl(var(--accent))] font-serif text-xl font-bold text-[hsl(var(--primary))] shadow-[0_7px_0_hsl(37_83%_52%)]">M</div>
             <div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Mədinə</p><p className="font-serif text-[17px] leading-none text-[hsl(var(--primary))]">{owner ? 'Sahib paneli' : ownerAssistant ? 'Sahib köməkçisi paneli' : activeRole === 'supervisor' ? 'Nəzarətçi paneli' : 'Müəllim paneli'}</p></div>
          </Link>
          <div className="flex shrink-0 flex-nowrap items-center gap-1 sm:gap-2">
            <HomeLink />
            <ArticlesLink />
             <AdminGlobalSearch onSelectStudent={(profileId) => { setFocusStudentId(profileId); setTab('student-management'); }} />
             <span className="hidden text-xs font-semibold text-[hsl(var(--muted-foreground))] sm:block">{owner ? 'N1 · ' : ownerAssistant ? 'NK1 · ' : ''}{displayName}</span>
             <button type="button" onClick={onLogout} className="focus-ring inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-2.5 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] sm:px-3" data-testid="button-admin-logout"><LogOut size={15} /> Çıxış</button>
          </div>
        </div>
      </header>
       <div className="mx-auto max-w-6xl px-5 pt-6 md:px-10">
         <section className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-xs)]" data-testid="section-admin-account">
           <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent)/.45)] font-serif text-xl font-bold text-[hsl(var(--primary))]">{accountCode}</div>
           <div>
             <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Hesab məlumatları</p>
             <p className="mt-1 font-bold text-[hsl(var(--primary))]">{fullName}</p>
           </div>
           <div className="sm:ml-auto">
             <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Hesab kodu</p>
             <p className="mt-1 text-lg font-bold text-[hsl(var(--secondary-foreground))]">{accountCode}</p>
           </div>
           <div>
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Status</p>
               <p className="mt-1 text-sm font-bold text-[hsl(var(--primary))]">{owner ? 'Sistem sahibi' : ownerAssistant ? 'Sahib köməkçisi' : metadataRole === 'supervisor' ? 'Nəzarətçi' : 'Müəllim'}</p>
           </div>
         </section>
       </div>
      <main className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-2xl font-bold text-[hsl(var(--primary))]"><ShieldCheck size={22} /> İDARƏETMƏ SAHƏSİ</p>
          <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{owner ? 'Akademiyanın məzmununu idarə edin və qeydiyyatdan keçmiş istifadəçilərə işçi rolları verin.' : 'Tələbələr və ziyarətçilər üçün dərsləri, elanları, məqalələri, günün faydasını və dərs resurslarını buradan əlavə edin.'}</p>
        </div>
        <TeacherStats canEdit={owner || ownerAssistant} />
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] md:p-7">
           <h2 className="mb-5 font-serif text-3xl leading-none tracking-[-.03em] text-[hsl(var(--primary))] md:text-4xl">İdarə paneli</h2>
            <div className="mb-7 flex flex-wrap gap-2 border-b border-[hsl(var(--border))] pb-4">
                  {([['announcement', 'Yeni elan', Megaphone, 'announcements'], ['student-notifications', 'Tələbələrə bildiriş', Send, 'announcements'], ['article', 'Məqalə', BookOpenText, 'articles'], ['benefit', 'Günün faydası', Quote, 'dailyBenefits'], ['student-management', 'Tələbələri idarə et', UsersRound, 'students'], ['application', 'Müraciətlər', UsersRound, 'applications'], ['exams', 'İmtahan və testlər', ClipboardList, 'assignments'], ['course-content', 'Tədris proqramı', BookOpenText, 'schedule'], ['users', 'İstifadəçi rolları', UserCog, 'userRoleManagement'], ['course-activation', 'Dərsləri idarə et', BookOpen, 'schedule'], ['statistics', 'Statistika', UsersRound, null], ['audit-history', 'Audit tarixçəsi', ShieldCheck, null]] as const).filter(([value, , , permission]) => owner || (value === 'student-management' && canManageAssignments) || (activeRole !== 'teacher' && (value === 'users' || value === 'course-activation')) || (value !== 'users' && value !== 'course-activation' && value !== 'statistics' && value !== 'audit-history' && permission !== null && rolePermissions.has(permission))).map(([value, label, Icon]) => <button key={value} type="button" onClick={() => toggleTab(value)} className={adminTabButtonClass(value, tab === value)} data-testid={`tab-admin-${value}`}><Icon size={15} /> {label} {value === 'application' && pendingApplicationCount > 0 && <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white" data-testid="badge-pending-applications">{pendingApplicationCount}</span>}{value === 'student-management' && (pendingExcuseCount + pendingSubjectRequestCount) > 0 && <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">{pendingExcuseCount + pendingSubjectRequestCount}</span>}</button>)}
                   {(owner || ownerAssistant) && <button type="button" onClick={() => toggleTab('graduation-certificates')} className={adminTabButtonClass('graduation-certificates', tab === 'graduation-certificates')} data-testid="tab-admin-graduation-certificates"><FileBadge size={15} /> Şəhadətnamə idarəsi</button>}
            </div>
              {tab === 'student-notifications' && rolePermissions.has('announcements') && <StudentNotificationForm />}
              {tab === 'exams' && canManageAssignments && <AdminExamsSection resources={resourcesQuery.data ?? []} teacherClerkUserId={activeRole === 'teacher' || activeRole === 'admin' ? user?.id : undefined} owner={owner} />}
            {tab === 'course-activation' && (owner || ownerAssistant) && <CourseActivationSettings />}
               {tab === 'course-content' && canEditCourseContent && <div className="space-y-8" data-testid="section-course-content-management"><section><div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Dərs idarəetməsi</p><h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">Yeni dərs əlavə et</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Yeni dərsi, semestrini, müəllimini, cədvəlini və materiallarını buradan əlavə edin.</p></div><ResourceForm teacherOnly={activeRole === 'teacher' || activeRole === 'admin'} teacherName={fullName} onSaved={() => setLocation('/admin')} /></section>{activeRole !== 'teacher' && <CourseContentEditor teacherOnly={!owner && !ownerAssistant} />}</div>}
              {tab === 'announcement' && <><button type="button" onClick={() => setIsAnnouncementListOpen((current) => !current)} aria-expanded={isAnnouncementListOpen} className="focus-ring mb-5 inline-flex items-center gap-2.5 rounded-xl border border-[hsl(var(--border))] px-5 py-3.5 text-sm font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="button-existing-announcements"><Megaphone size={18} /> Mövcud elanlar</button>{isAnnouncementListOpen && <AnnouncementList />}<AnnouncementForm onSaved={() => setLocation('/admin')} /></>}
            {tab === 'article' && <ArticleForm />}
            {tab === 'benefit' && <DailyBenefitForm />}
            {tab === 'application' && <>{(owner || ownerAssistant) && <ApplicationWindowSettings />}<ApplicationList applications={applicationsQuery.data ?? []} isLoading={applicationsQuery.isLoading} busyId={decisionBusyId} onDecision={decideApplication} canDecide={!ownerAssistant} canAssignTeacher={owner || ownerAssistant} onAssignTeacher={assignApplicationTeacher} teacherBusyId={teacherBusyId} />{decisionNotice && <p className="mt-4 rounded-xl bg-[hsl(var(--secondary)/.35)] p-3 text-sm font-semibold text-[hsl(var(--secondary-foreground))]">{decisionNotice}</p>}</>}
             {tab === 'student-management' && <StudentManagementSection pendingSubjectRequestCount={pendingSubjectRequestCount} pendingExcuseCount={pendingExcuseCount} onReadExcuses={() => setReadExcuseIds(excusesQuery.data?.map((item) => item.id) ?? [])} canViewDeletedStudents={owner} canGraduate={owner} resources={resourcesQuery.data ?? []} canManageAssignments={canManageAssignments} assignmentTeacherClerkUserId={activeRole === 'teacher' || activeRole === 'admin' ? user?.id : undefined} focusStudentId={focusStudentId} />}
            {tab === 'users' && (owner || ownerAssistant) && <RoleManagement canConfigurePermissions={owner} />}
            {tab === 'statistics' && owner && <><AnalyticsDashboard applications={applicationsQuery.data ?? []} profiles={academicProfilesQuery.data ?? []} resources={resourcesQuery.data ?? []} onRefresh={() => { void Promise.all([applicationsQuery.refetch(), academicProfilesQuery.refetch(), resourcesQuery.refetch()]); }} /><SystemStatisticsSettings /></>}
            {tab === 'audit-history' && owner && <AuditHistory />}
            {tab === 'graduation-certificates' && (owner || ownerAssistant) && <GraduateCertificateSection canRevoke={owner} />}
               <div className="mb-5 flex flex-wrap gap-2">
                 <button type="button" onClick={() => toggleTab('schedule')} className={adminTabButtonClass('schedule', tab === 'schedule')} data-testid="tab-admin-schedule"><CalendarRange size={18} /> Mənim cədvəlim</button>
                  <button type="button" onClick={() => toggleTab('teachers-schedule')} className={adminTabButtonClass('teachers-schedule', tab === 'teachers-schedule')} data-testid="tab-admin-teachers-schedule"><CalendarRange size={18} /> Müəllimlər cədvəli</button>
                   <button type="button" onClick={() => toggleTab('messages')} className={adminTabButtonClass('messages', tab === 'messages')} data-testid="tab-admin-messages"><Mail size={18} /> Məsləhətləşmə / Əlaqə {unreadMessageCount > 0 && <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">{unreadMessageCount}</span>}</button>
                   <button type="button" onClick={() => toggleTab('questions')} className={adminTabButtonClass('questions', tab === 'questions')} data-testid="tab-admin-questions"><HelpCircle size={18} /> Sual-cavab {unansweredQuestionCount > 0 && <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">{unansweredQuestionCount}</span>}</button>
              </div>
             {tab === 'schedule' && <TeacherSchedule ownerName={fullName} />}
              {tab === 'teachers-schedule' && <TeachersSchedule ownerName={fullName} />}
               {tab === 'messages' && <MessageCenter staff />}
                {tab === 'questions' && <QaCenter canAnswer onUnansweredCountChange={setUnansweredQuestionCount} />}
          </section>
          <aside className="space-y-4">
            <div className="rounded-2xl bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))]">
              <Send className="mb-8 text-[hsl(var(--accent))]" size={20} />
              <p className="text-sm font-bold">Məzmunu canlı saxla</p>
              <p className="mt-2 text-xs leading-5 text-[hsl(var(--primary-foreground)/.62)]">Əlavə etdiyiniz məlumat tələbələrin kabinetində və ana səhifədə görünəcək.</p>
            </div>
            <DailyBenefitList benefits={dailyBenefits} />
            <ArticleList articles={articles} />
          </aside>
        </div>
      </main>
    </div>
  );
}