import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, ClipboardList, Eye, FilePlus2, Pencil, Plus, Power, RefreshCw, Send, Trash2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { AdminExam, AdminExamSubmission, Exam, LearningResource } from '@workspace/api-client-react';
import {
  getGetAdminExamsQueryKey,
  getGetAdminAdmissionModeQueryKey,
  getGetExamSubmissionsQueryKey,
  getGetStudentExamQueryKey,
  getGetStudentExamsQueryKey,
  useCreateExam,
  useDeleteExam,
  useApproveExamSubmission,
  useGetAdminExams,
  useGetAdminAdmissionMode,
  useGetExamSubmissions,
  useGetStudentExam,
  useGetStudentExams,
  useResendExamToStudent,
  useSubmitExam,
  useUpdateExam,
  useUpdateAdminAdmissionMode,
} from '@workspace/api-client-react';

const inputClass = 'focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm text-[hsl(var(--foreground))] outline-none transition placeholder:text-[hsl(var(--muted-foreground)/.65)]';
const buttonClass = 'focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButtonClass = 'focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))] disabled:cursor-not-allowed disabled:opacity-50';

type QuestionDraft = { prompt: string; options: string[]; correctOptionIndex: number };

const blankQuestion = (): QuestionDraft => ({ prompt: '', options: ['', ''], correctOptionIndex: 0 });

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function AdmissionModeSettings({ owner }: { owner: boolean }) {
  const query = useGetAdminAdmissionMode({
    query: {
      enabled: owner,
      queryKey: getGetAdminAdmissionModeQueryKey(),
    },
  });
  const updateMutation = useUpdateAdminAdmissionMode();
  const [notice, setNotice] = useState('');

  if (!owner) return null;

  const save = async (examRequired: boolean) => {
    if (query.data?.examRequired === examRequired || updateMutation.isPending) return;
    setNotice('');
    try {
      await updateMutation.mutateAsync({ data: { examRequired } });
      await query.refetch();
      setNotice(examRequired ? 'Yeni tələbələr imtahanla qəbul olunacaq.' : 'Yeni tələbələr imtahansız qəbul olunacaq.');
    } catch (error) {
      setNotice(errorMessage(error, 'Qəbul qaydası yadda saxlanılmadı.'));
    }
  };

  const examRequired = query.data?.examRequired;
  const disabled = query.isLoading || updateMutation.isPending;

  return (
    <section className="rounded-2xl border border-[hsl(var(--accent)/.65)] bg-[hsl(var(--accent)/.1)] p-5" data-testid="section-admission-mode">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">Yeni tələbə qəbulu</p>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">Yeni təsdiqlənən tələbələrin qəbul imtahanı verib-verməyəcəyini buradan seçin. Bu seçim imtahanın öz açıq/bağlı statusundan ayrıdır.</p>
        </div>
        <span className="rounded-full bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]" data-testid="status-admission-mode">
          {query.isLoading ? 'Yüklənir...' : examRequired ? 'İmtahanla qəbul' : 'İmtahansız qəbul'}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label="Yeni tələbə qəbul qaydası">
        <button type="button" onClick={() => void save(true)} disabled={disabled} aria-pressed={examRequired === true} className={`focus-ring rounded-xl border px-4 py-3 text-left text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${examRequired === true ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]'}`} data-testid="button-admission-mode-exam"><Power size={16} className="mb-1" /> İmtahanla qəbul<span className="mt-1 block text-[11px] font-normal opacity-75">Tələbə testdən sonra təsdiq gözləyir.</span></button>
        <button type="button" onClick={() => void save(false)} disabled={disabled} aria-pressed={examRequired === false} className={`focus-ring rounded-xl border px-4 py-3 text-left text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${examRequired === false ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]'}`} data-testid="button-admission-mode-direct"><Power size={16} className="mb-1" /> İmtahansız qəbul<span className="mt-1 block text-[11px] font-normal opacity-75">Tələbə təsdiqdən sonra birbaşa ana səhifəyə keçir.</span></button>
      </div>
      {notice && <p className="mt-3 rounded-xl bg-[hsl(var(--secondary)/.35)] p-3 text-xs font-semibold text-[hsl(var(--secondary-foreground))]" data-testid="status-admission-mode-notice">{notice}</p>}
    </section>
  );
}

function ExamQuestionEditor({ questions, onChange }: { questions: QuestionDraft[]; onChange: (value: QuestionDraft[]) => void }) {
  const updateQuestion = (index: number, value: Partial<QuestionDraft>) => onChange(questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...value } : question));
  const updateOption = (questionIndex: number, optionIndex: number, value: string) => onChange(questions.map((question, index) => index === questionIndex ? { ...question, options: question.options.map((option, index) => index === optionIndex ? value : option) } : question));
  const removeOption = (questionIndex: number, optionIndex: number) => onChange(questions.map((question, index) => {
    if (index !== questionIndex) return question;
    const options = question.options.filter((_, currentIndex) => currentIndex !== optionIndex);
    const correctOptionIndex = question.correctOptionIndex === optionIndex
      ? 0
      : question.correctOptionIndex > optionIndex ? question.correctOptionIndex - 1 : question.correctOptionIndex;
    return { ...question, options, correctOptionIndex: Math.min(correctOptionIndex, options.length - 1) };
  }));
  return (
    <div className="space-y-3">
      {questions.map((question, questionIndex) => (
        <div key={questionIndex} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.62)] p-4">
          <div className="flex items-start gap-3">
            <span className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--secondary)/.65)] text-xs font-black text-[hsl(var(--secondary-foreground))]">{questionIndex + 1}</span>
            <div className="min-w-0 flex-1">
              <input required maxLength={2000} value={question.prompt} onChange={(event) => updateQuestion(questionIndex, { prompt: event.target.value })} className={inputClass} placeholder="Sualı yazın" data-testid={`input-exam-question-${questionIndex}`} />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <input type="radio" name={`correct-option-${questionIndex}`} checked={question.correctOptionIndex === optionIndex} onChange={() => updateQuestion(questionIndex, { correctOptionIndex: optionIndex })} className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" aria-label={`${optionIndex + 1}-ci variantı düzgün cavab kimi seç`} data-testid={`radio-exam-correct-${questionIndex}-${optionIndex}`} />
                    <span className="w-5 text-center text-xs font-black text-[hsl(var(--muted-foreground))]">{String.fromCharCode(65 + optionIndex)}</span>
                    <input required maxLength={500} value={option} onChange={(event) => updateOption(questionIndex, optionIndex, event.target.value)} className={inputClass} placeholder={`Variant ${String.fromCharCode(65 + optionIndex)}`} data-testid={`input-exam-option-${questionIndex}-${optionIndex}`} />
                    {question.options.length > 2 && <button type="button" onClick={() => removeOption(questionIndex, optionIndex)} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Variantı sil"><X size={15} /></button>}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => updateQuestion(questionIndex, { options: [...question.options, ''] })} disabled={question.options.length >= 8} className="mt-3 text-xs font-bold text-[hsl(var(--secondary-foreground))] disabled:opacity-40">+ Variant əlavə et</button>
            </div>
            {questions.length > 1 && <button type="button" onClick={() => onChange(questions.filter((_, index) => index !== questionIndex))} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Sualı sil"><X size={17} /></button>}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...questions, blankQuestion()])} disabled={questions.length >= 50} className={secondaryButtonClass}><Plus size={15} /> Sual əlavə et</button>
    </div>
  );
}

function ExamForm({ resources, teacherClerkUserId, editing, defaultOnboarding = false, onCancel, onSaved }: { resources: LearningResource[]; teacherClerkUserId?: string; editing: AdminExam | null; defaultOnboarding?: boolean; onCancel: () => void; onSaved: () => void }) {
  const createMutation = useCreateExam();
  const updateMutation = useUpdateExam();
  const availableResources = teacherClerkUserId ? resources.filter((resource) => resource.teacherClerkUserId === teacherClerkUserId) : resources;
  const [isOnboarding, setIsOnboarding] = useState(editing?.isOnboarding ?? defaultOnboarding);
  const [resourceId, setResourceId] = useState(String(isOnboarding ? '' : editing?.resourceId ?? availableResources[0]?.id ?? ''));
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [status, setStatus] = useState<'open' | 'closed'>(editing?.status ?? 'open');
  const [durationMinutes, setDurationMinutes] = useState(String(editing?.durationMinutes ?? ''));
  const [questions, setQuestions] = useState<QuestionDraft[]>(editing?.questions.map((question) => {
    const correctOptionId = (question as { correctOptionId?: number | null }).correctOptionId;
    return { prompt: question.prompt, options: question.options.map((option) => option.label), correctOptionIndex: Math.max(0, question.options.findIndex((option) => option.id === correctOptionId)) };
  }) ?? [blankQuestion()]);
  const [error, setError] = useState('');
  const isPending = createMutation.isPending || updateMutation.isPending;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const normalized = questions.map((question) => ({ prompt: question.prompt.trim(), options: question.options.map((option) => option.trim()), correctOptionIndex: question.correctOptionIndex }));
    const parsedDuration = durationMinutes ? Number(durationMinutes) : null;
    if (parsedDuration !== null && (!Number.isInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > 240)) {
      setError('Test vaxtı 1–240 dəqiqə aralığında olmalıdır.');
      return;
    }
    if ((!isOnboarding && !resourceId) || !title.trim() || !description.trim() || normalized.some((question) => !question.prompt || question.options.length < 2 || question.options.some((option) => !option) || question.correctOptionIndex < 0 || question.correctOptionIndex >= question.options.length)) {
      setError(`${isOnboarding ? 'Başlıq' : 'Qrup, başlıq'}, izah, suallar və hər sualın düzgün cavabı seçilməlidir.`);
      return;
    }
    const duplicate = normalized.some((question) => new Set(question.options.map((option) => option.toLocaleLowerCase('az'))).size !== question.options.length);
    if (duplicate) {
      setError('Eyni sualın cavab variantları təkrarlana bilməz.');
      return;
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ examId: editing.id, data: { title: title.trim(), description: description.trim(), status, isOnboarding, durationMinutes: parsedDuration, questions: normalized } });
      } else {
        await createMutation.mutateAsync({ data: { ...(isOnboarding ? {} : { resourceId: Number(resourceId) }), title: title.trim(), description: description.trim(), status, isOnboarding, durationMinutes: parsedDuration, questions: normalized } });
      }
      onSaved();
    } catch (saveError) {
      setError(errorMessage(saveError, 'Test yadda saxlanmadı.'));
    }
  };

  return (
    <form onSubmit={(event) => void save(event)} className="rounded-2xl border border-[hsl(var(--accent)/.6)] bg-[hsl(var(--accent)/.1)] p-5" data-testid="form-admin-exam">
       <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{editing ? 'Testi yenilə' : 'Yeni test'}</p><h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{editing ? editing.title : isOnboarding ? 'Qəbul testi yarat' : 'Dərs üçün test yarat'}</h3></div><button type="button" onClick={onCancel} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))]" aria-label="Test formasını bağla"><X size={17} /></button></div>
       <div className="mt-5 grid gap-4 sm:grid-cols-2">
         {isOnboarding ? <div className="rounded-xl border border-[hsl(var(--accent)/.65)] bg-[hsl(var(--accent)/.12)] px-3.5 py-3"><p className="text-xs font-black text-[hsl(var(--primary))]">Ümumi qəbul testi</p><p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">Bu test konkret müəllim qrupuna bağlı deyil və sistemə daxil olan tələbələr üçün istifadə olunur.</p></div> : <label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Dərs</span><select required disabled={Boolean(editing)} value={resourceId} onChange={(event) => setResourceId(event.target.value)} className={inputClass} data-testid="select-exam-resource"><option value="">Dərs seçin</option>{availableResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.title} · {resource.teacherName ?? 'Müəllim'} · {resource.termNumber}-ci semestr</option>)}</select></label>}
        <label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Status</span><select value={status} onChange={(event) => setStatus(event.target.value as 'open' | 'closed')} className={inputClass} data-testid="select-exam-status"><option value="open">Açıq — tələbələr cavablandıra bilər</option><option value="closed">Bağlı</option></select></label>
      </div>
       <label className="mt-4 block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Test vaxtı</span><select value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} className={inputClass} data-testid="select-exam-duration"><option value="">Vaxt limiti yoxdur</option><option value="5">5 dəqiqə</option><option value="10">10 dəqiqə</option><option value="15">15 dəqiqə</option><option value="20">20 dəqiqə</option><option value="30">30 dəqiqə</option><option value="45">45 dəqiqə</option><option value="60">60 dəqiqə</option><option value="90">90 dəqiqə</option><option value="120">120 dəqiqə</option></select><span className="mt-1 block text-[11px] text-[hsl(var(--muted-foreground))]">Tələbə testə başladığı andan bu müddət ərzində cavab göndərməlidir.</span></label>
      <div className="mt-4 space-y-4"><label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Testin başlığı</span><input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="Məsələn: 1-ci aralıq test" data-testid="input-exam-title" /></label><label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">İzah</span><textarea required maxLength={12000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} resize-y`} placeholder="Tələbə test haqqında nə bilməlidir?" data-testid="input-exam-description" /></label></div>
       <div className="mt-5"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-bold text-[hsl(var(--primary))]">Seçimli suallar</p><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Hər sualda 2–8 cavab variantı olmalıdır. Düzgün cavabı seçmək üçün variantın dairəsinə klikləyin.</p></div><span className="text-[11px] font-bold text-[hsl(var(--muted-foreground))]">{questions.length} sual</span></div><ExamQuestionEditor questions={questions} onChange={setQuestions} /></div>
      {error && <p className="mt-4 rounded-xl bg-[hsl(var(--destructive)/.08)] p-3 text-xs font-semibold text-[hsl(var(--destructive))]" data-testid="status-exam-form-error">{error}</p>}
       <div className="mt-5 flex flex-wrap gap-2"><button type="submit" disabled={isPending || (!isOnboarding && !availableResources.length)} className={buttonClass} data-testid="button-save-exam"><FilePlus2 size={15} /> {isPending ? 'Yadda saxlanır...' : editing ? 'Dəyişiklikləri saxla' : 'Test yarat'}</button><button type="button" onClick={onCancel} className={secondaryButtonClass}>Ləğv et</button></div>
    </form>
  );
}

function AdminExamSubmissions({ examId }: { examId: number }) {
  const query = useGetExamSubmissions(examId, { query: { queryKey: getGetExamSubmissionsQueryKey(examId) } });
  const examsQuery = useGetAdminExams({ query: { queryKey: getGetAdminExamsQueryKey() } });
  const isOnboarding = examsQuery.data?.find((exam) => exam.id === examId)?.isOnboarding === true;
  const approveMutation = useApproveExamSubmission();
  const resendMutation = useResendExamToStudent();
  const [notice, setNotice] = useState('');
  const resend = async (submission: AdminExamSubmission) => {
    if (!window.confirm(`${submission.studentName} üçün bu testi yenidən göndərmək istəyirsiniz? Əvvəlki cavab silinəcək.`)) return;
    setNotice('');
    try {
      await resendMutation.mutateAsync({ examId, profileId: submission.profileId });
      await query.refetch();
      setNotice(`${submission.studentName} üçün test yenidən açıldı.`);
    } catch (error) {
      setNotice(errorMessage(error, 'Test yenidən göndərilmədi.'));
    }
  };
  const approve = async (submission: AdminExamSubmission) => {
    if (!window.confirm(`${submission.studentName} üçün imtahan nəticəsini təsdiqləmək istəyirsiniz?`)) return;
    setNotice('');
    try {
      await approveMutation.mutateAsync({ examId, profileId: submission.profileId });
      await query.refetch();
      setNotice(`${submission.studentName} üçün imtahan təsdiqləndi.`);
    } catch (error) {
      setNotice(errorMessage(error, 'İmtahan təsdiqlənmədi.'));
    }
  };
  return (
    <div className="mt-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-[hsl(var(--primary))]">Tələbə cavabları</p><button type="button" onClick={() => void query.refetch()} className={secondaryButtonClass}><RefreshCw size={13} /> Yenilə</button></div>
      {notice && <p className="mt-3 rounded-lg bg-[hsl(var(--secondary)/.35)] p-2.5 text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{notice}</p>}
      {query.isLoading ? <div className="skeleton mt-3 h-20 rounded-xl" /> : query.isError ? <p className="mt-3 text-xs text-[hsl(var(--destructive))]">Cavabları yükləmək mümkün olmadı.</p> : !query.data?.length ? <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Hələ cavab göndərən tələbə yoxdur.</p> : <div className="mt-3 space-y-3">{query.data.map((submission: AdminExamSubmission) => <div key={submission.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] p-3" data-testid={`card-exam-submission-${submission.id}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-bold text-[hsl(var(--primary))]">{submission.studentName}</p><p className="text-[11px] text-[hsl(var(--muted-foreground))]">#{submission.studentNumber} · {submission.email}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><span className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">{new Date(submission.submittedAt).toLocaleString('az-AZ')}</span>{isOnboarding && <span className={`rounded-full px-2 py-1 text-[10px] font-black ${submission.reviewStatus === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{submission.reviewStatus === 'approved' ? 'Təsdiqlənib' : 'Təsdiq gözləyir'}</span>}{isOnboarding && submission.reviewStatus !== 'approved' && <button type="button" onClick={() => void approve(submission)} disabled={approveMutation.isPending || resendMutation.isPending} className={secondaryButtonClass} data-testid={`button-approve-exam-${submission.profileId}`}><CheckCircle2 size={13} /> Təsdiqlə</button>}<button type="button" onClick={() => void resend(submission)} disabled={resendMutation.isPending || approveMutation.isPending} className={secondaryButtonClass} data-testid={`button-resend-exam-${submission.profileId}`}><RefreshCw size={13} /> Yenidən göndər</button></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(submission.answerLabels).map(([questionId, label]) => <div key={questionId} className="rounded-lg bg-[hsl(var(--card))] px-3 py-2 text-xs"><span className="font-bold text-[hsl(var(--muted-foreground))]">Sual #{questionId}</span><span className="ml-2 font-semibold text-[hsl(var(--primary))]">{label}</span></div>)}</div></div>)}</div>}
    </div>
  );
}

 function AdminExamsSectionLegacy({ resources, teacherClerkUserId }: { resources: LearningResource[]; teacherClerkUserId?: string }) {
  const queryClient = useQueryClient();
  const examsQuery = useGetAdminExams({ query: { queryKey: getGetAdminExamsQueryKey() } });
  const updateMutation = useUpdateExam();
  const [editing, setEditing] = useState<AdminExam | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const exams = examsQuery.data ?? [];
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: getGetAdminExamsQueryKey() }); };
  const closeExam = async (exam: AdminExam) => {
    if (!window.confirm('Bu testi bağlamaq istəyirsiniz? Tələbələr artıq cavab göndərə bilməyəcək.')) return;
    try { await updateMutation.mutateAsync({ examId: exam.id, data: { status: 'closed' } }); await refresh(); setNotice('Test bağlandı.'); } catch (error) { setNotice(errorMessage(error, 'Test bağlanmadı.')); }
  };
  return <section className="space-y-5" data-testid="section-admin-exams"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">Müəllim qrupları üzrə qiymətləndirmə</p><h3 className="mt-1 font-serif text-3xl text-[hsl(var(--primary))]">İmtahan və testlər</h3><p className="mt-2 max-w-xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">Seçimli suallar yaradın, testi qrupunuza açın və tələbə cavablarını izləyin.</p></div><div className="flex gap-2"><button type="button" onClick={() => void examsQuery.refetch()} className={secondaryButtonClass} data-testid="button-reload-admin-exams"><RefreshCw size={14} /> Yenilə</button><button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className={buttonClass} data-testid="button-create-exam"><Plus size={15} /> Yeni test</button></div></div>{notice && <p className="rounded-xl bg-[hsl(var(--secondary)/.35)] p-3 text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{notice}</p>}{showForm && <ExamForm resources={resources} teacherClerkUserId={teacherClerkUserId} editing={editing} onCancel={() => { setShowForm(false); setEditing(null); }} onSaved={() => { setShowForm(false); setEditing(null); void refresh(); setNotice(editing ? 'Test yeniləndi.' : 'Test yaradıldı.'); }} />}{examsQuery.isLoading ? <div className="space-y-3"><div className="skeleton h-32 rounded-xl" /><div className="skeleton h-32 rounded-xl" /></div> : examsQuery.isError ? <div className="rounded-xl border border-[hsl(var(--destructive)/.22)] bg-[hsl(var(--destructive)/.06)] p-4 text-sm text-[hsl(var(--destructive))]">Testləri yükləmək mümkün olmadı. <button type="button" onClick={() => void examsQuery.refetch()} className="font-bold underline">Yenidən cəhd et</button></div> : !exams.length ? <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] px-5 py-10 text-center"><ClipboardList className="mx-auto text-[hsl(var(--secondary-foreground))]" /><p className="mt-3 text-sm font-bold text-[hsl(var(--primary))]">Hələ test yoxdur</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">İlk testi yaradaraq qrupunuz üçün yoxlama hazırlayın.</p></div> : <div className="space-y-3">{exams.map((exam) => <div key={exam.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.17)] p-4" data-testid={`card-admin-exam-${exam.id}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{exam.courseTitle} · {exam.teacherName} · {exam.termNumber}-ci semestr</p><h4 className="mt-1 text-base font-bold text-[hsl(var(--primary))]">{exam.title}</h4><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{exam.questions.length} sual · {exam.submissionCount} cavab</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${exam.status === 'closed' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>{exam.status === 'closed' ? 'Bağlanıb' : 'Açıq'}</span></div><div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" onClick={() => setSelectedId(selectedId === exam.id ? null : exam.id)} className={secondaryButtonClass} data-testid={`button-open-exam-submissions-${exam.id}`}><Eye size={14} /> Cavablara bax</button><button type="button" onClick={() => { setEditing(exam); setShowForm(true); }} className={secondaryButtonClass} data-testid={`button-edit-exam-${exam.id}`}><Pencil size={14} /> Redaktə</button>{exam.status !== 'closed' && <button type="button" onClick={() => void closeExam(exam)} disabled={updateMutation.isPending} className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-[hsl(var(--destructive)/.25)] px-3 py-2.5 text-xs font-bold text-[hsl(var(--destructive))]">Bağla</button>}</div>{selectedId === exam.id && <AdminExamSubmissions examId={exam.id} />}</div>)}</div>}</section>;
}

export function AdminExamsSection({ resources, teacherClerkUserId, owner }: { resources: LearningResource[]; teacherClerkUserId?: string; owner: boolean }) {
  const queryClient = useQueryClient();
  const examsQuery = useGetAdminExams({ query: { queryKey: getGetAdminExamsQueryKey() } });
  const updateMutation = useUpdateExam();
  const deleteMutation = useDeleteExam();
  const [editing, setEditing] = useState<AdminExam | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [audience, setAudience] = useState<'all' | 'onboarding'>('all');
  const exams = (examsQuery.data ?? []).filter((exam) => audience === 'onboarding' ? exam.isOnboarding : !exam.isOnboarding);
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: getGetAdminExamsQueryKey() }); };
   const setExamStatus = async (exam: AdminExam, status: 'open' | 'closed') => {
    if (exam.isOnboarding && !owner) {
      setNotice('Qəbul testini yalnız sistem sahibi aça və bağlaya bilər.');
      return;
    }
     const confirmation = status === 'open'
       ? 'Bu qəbul testini açmaq istəyirsiniz? Müraciəti qəbul olunmuş yeni tələbələr bu testi görəcək.'
       : 'Bu qəbul testini bağlamaq istəyirsiniz? Tələbələr imtahan vermədən birbaşa ana səhifəyə keçəcək.';
     if (!window.confirm(confirmation)) return;
     try {
       await updateMutation.mutateAsync({ examId: exam.id, data: { status } });
       await refresh();
       setNotice(status === 'open' ? 'Qəbul testi açıldı.' : 'Qəbul testi bağlandı.');
     } catch (error) {
       setNotice(errorMessage(error, status === 'open' ? 'Test açılmadı.' : 'Test bağlanmadı.'));
     }
  };
   const deleteExam = async (exam: AdminExam) => {
     if (!window.confirm(`“${exam.title}” testini silmək istəyirsiniz? Bu testə aid suallar, cavablar və nəticələr də silinəcək.`)) return;
     try {
       await deleteMutation.mutateAsync({ examId: exam.id });
       setSelectedId(null);
       if (editing?.id === exam.id) {
         setEditing(null);
         setShowForm(false);
       }
       await refresh();
       setNotice('Test silindi.');
     } catch (error) {
       setNotice(errorMessage(error, 'Test silinmədi.'));
     }
   };
  return (
    <section className="space-y-5" data-testid="section-admin-exams">
      <AdmissionModeSettings owner={owner} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">Müəllim qrupları üzrə qiymətləndirmə</p>
          <h3 className="mt-1 font-serif text-3xl text-[hsl(var(--primary))]">İmtahan və testlər</h3>
          <p className="mt-2 max-w-xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">Adi qrup testlərini və yeni tələbələr üçün qəbul testlərini ayrı-ayrılıqda idarə edin.</p>
        </div>
        <button type="button" onClick={() => void examsQuery.refetch()} className={secondaryButtonClass} data-testid="button-reload-admin-exams"><RefreshCw size={14} /> Yenilə</button>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[hsl(var(--muted)/.45)] p-1.5" role="tablist" aria-label="Test auditoriyası">
        <button type="button" role="tab" aria-selected={audience === 'all'} onClick={() => { setAudience('all'); setSelectedId(null); }} className={`focus-ring rounded-xl px-3 py-3 text-xs font-black transition ${audience === 'all' ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--card)/.6)]'}`} data-testid="button-admin-exams-all">Bütün tələbələr üçün testlər</button>
        <button type="button" role="tab" aria-selected={audience === 'onboarding'} onClick={() => { setAudience('onboarding'); setSelectedId(null); }} className={`focus-ring rounded-xl px-3 py-3 text-xs font-black transition ${audience === 'onboarding' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--card)/.6)]'}`} data-testid="button-admin-exams-onboarding">Yeni tələbələr üçün testlər</button>
      </div>
      <div className="flex justify-end">
         <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} disabled={audience === 'onboarding' && !owner} className={buttonClass} data-testid={audience === 'onboarding' ? 'button-create-onboarding-exam' : 'button-create-exam'}><Plus size={15} /> {audience === 'onboarding' ? owner ? 'Yeni tələbə testi yarat' : 'Yalnız sahib yarada bilər' : 'Yeni test yarat'}</button>
      </div>
      {notice && <p className="rounded-xl bg-[hsl(var(--secondary)/.35)] p-3 text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{notice}</p>}
      {showForm && <ExamForm resources={resources} teacherClerkUserId={teacherClerkUserId} editing={editing} defaultOnboarding={audience === 'onboarding'} onCancel={() => { setShowForm(false); setEditing(null); }} onSaved={() => { setShowForm(false); setEditing(null); void refresh(); setNotice(editing ? 'Test yeniləndi.' : 'Test yaradıldı.'); }} />}
       {examsQuery.isLoading ? <div className="space-y-3"><div className="skeleton h-32 rounded-xl" /><div className="skeleton h-32 rounded-xl" /></div> : examsQuery.isError ? <div className="rounded-xl border border-[hsl(var(--destructive)/.22)] bg-[hsl(var(--destructive)/.06)] p-4 text-sm text-[hsl(var(--destructive))]">Testləri yükləmək mümkün olmadı. <button type="button" onClick={() => void examsQuery.refetch()} className="font-bold underline">Yenidən cəhd et</button></div> : !exams.length ? <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] px-5 py-10 text-center"><ClipboardList className="mx-auto text-[hsl(var(--secondary-foreground))]" /><p className="mt-3 text-sm font-bold text-[hsl(var(--primary))]">{audience === 'onboarding' ? 'Yeni tələbə testi yoxdur' : 'Hələ test yoxdur'}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{audience === 'onboarding' ? 'Yeni tələbə testi yarat düyməsi ilə ilk qəbul testini hazırlayın.' : 'İlk testi yaradaraq dərsiniz üçün yoxlama hazırlayın.'}</p></div> : <div className="space-y-3">{exams.map((exam) => <div key={exam.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.17)] p-4" data-testid={`card-admin-exam-${exam.id}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{exam.courseTitle} · {exam.teacherName} · {exam.termNumber}-ci semestr</p><h4 className="mt-1 text-base font-bold text-[hsl(var(--primary))]">{exam.title}</h4><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{exam.questions.length} sual · {exam.submissionCount} cavab · {exam.durationMinutes ? `${exam.durationMinutes} dəqiqə` : 'Vaxt limiti yoxdur'}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${exam.status === 'closed' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>{exam.status === 'closed' ? 'Bağlanıb' : 'Açıq'}</span></div><div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" onClick={() => setSelectedId(selectedId === exam.id ? null : exam.id)} className={secondaryButtonClass} data-testid={`button-open-exam-submissions-${exam.id}`}><Eye size={14} /> Cavablara bax</button><button type="button" onClick={() => { setEditing(exam); setShowForm(true); }} className={secondaryButtonClass}><Pencil size={14} /> Redaktə</button>{exam.isOnboarding && owner ? <button type="button" onClick={() => void setExamStatus(exam, exam.status === 'closed' ? 'open' : 'closed')} disabled={updateMutation.isPending || deleteMutation.isPending} className={`focus-ring inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold ${exam.status === 'closed' ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-[hsl(var(--destructive)/.25)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.05)]'}`} data-testid={`button-toggle-onboarding-exam-${exam.id}`}><Power size={14} /> {exam.status === 'closed' ? 'Aç' : 'Bağla'}</button> : !exam.isOnboarding && exam.status !== 'closed' && <button type="button" onClick={() => void setExamStatus(exam, 'closed')} disabled={updateMutation.isPending || deleteMutation.isPending} className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-[hsl(var(--destructive)/.25)] px-3 py-2.5 text-xs font-bold text-[hsl(var(--destructive))]">Bağla</button>}{(!exam.isOnboarding || owner) && <button type="button" onClick={() => void deleteExam(exam)} disabled={deleteMutation.isPending || updateMutation.isPending} className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-[hsl(var(--destructive)/.25)] px-3 py-2.5 text-xs font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.05)]" data-testid={`button-delete-exam-${exam.id}`}><Trash2 size={14} /> Sil</button>}</div>{selectedId === exam.id && <AdminExamSubmissions examId={exam.id} />}</div>)}</div>}
    </section>
  );
}

export function StudentExamsLauncher({ termNumber, onOpen }: { termNumber: number; onOpen: () => void }) {
  const examsQuery = useGetStudentExams({ termNumber }, { query: { queryKey: getGetStudentExamsQueryKey({ termNumber }) } });
  const exams = examsQuery.data ?? [];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="focus-ring group flex min-h-[132px] w-full flex-col items-stretch justify-between gap-3 rounded-2xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary))] p-4 text-left shadow-[0_12px_30px_hsl(var(--primary)/.18)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_hsl(var(--primary)/.25)] sm:flex-row sm:items-center sm:gap-4 md:p-5"
      data-testid="button-open-student-exams"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--primary))] shadow-sm"><ClipboardList size={21} /></span>
        <span className="min-w-0"><span className="block break-words text-[10px] font-black uppercase tracking-[.17em] text-[hsl(var(--primary-foreground)/.68)]">Cari semestr · {termNumber}-ci semestr</span><span className="mt-1 block break-words font-serif text-2xl text-[hsl(var(--primary-foreground))]">Testlər</span><span className="mt-1 block break-words text-xs font-semibold text-[hsl(var(--primary-foreground)/.68)]">Testləri görmək üçün toxunun</span></span>
      </span>
      <span className="flex w-full items-center justify-between gap-2 rounded-xl bg-[hsl(var(--accent))] px-3 py-2 text-xs font-black text-[hsl(var(--primary))] shadow-sm transition group-hover:bg-[hsl(var(--accent)/.88)] sm:w-auto sm:justify-start"><span>{examsQuery.isLoading ? '...' : `${exams.length} test`}</span><span aria-hidden="true">→</span></span>
    </button>
  );
}

function ExamResultSummary({ result }: { result: { correctCount: number; totalQuestions: number; percentage: number } }) {
  return (
    <div className="mt-4 rounded-2xl border border-[hsl(var(--accent)/.65)] bg-[hsl(var(--accent)/.16)] p-4" data-testid="card-student-exam-result">
      <p className="text-[10px] font-black uppercase tracking-[.16em] text-[hsl(var(--primary))]">Test nəticəniz</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <p className="font-serif text-3xl text-[hsl(var(--primary))]">{result.percentage}%</p>
        <p className="text-sm font-bold text-[hsl(var(--primary))]">{result.correctCount} / {result.totalQuestions} düzgün cavab</p>
      </div>
      <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Nəticə test tamamlandıqdan sonra hesablanıb.</p>
    </div>
  );
}

function formatRemainingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function ExamTimer({ seconds, compact = false }: { seconds: number | null; compact?: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${seconds !== null && seconds <= 60 ? 'bg-red-100 text-red-800' : 'bg-[hsl(var(--accent))] text-[hsl(var(--primary))]'}`} data-testid="exam-timer">{seconds === null ? 'Vaxt limiti yoxdur' : seconds <= 0 ? 'Vaxt bitib' : `${compact ? '' : 'Vaxt: '}${formatRemainingTime(seconds)}`}</span>;
}

export function StudentExamsSection({ termNumber, onClose, initialExamId, onSubmitted }: { termNumber: number; onClose?: () => void; initialExamId?: number; onSubmitted?: () => void }) {
  const queryClient = useQueryClient();
  const examsQuery = useGetStudentExams({ termNumber }, { query: { queryKey: getGetStudentExamsQueryKey({ termNumber }) } });
  const [selectedId, setSelectedId] = useState<number | null>(initialExamId ?? null);
  const selectedQuery = useGetStudentExam(selectedId ?? 0, { query: { enabled: selectedId !== null, queryKey: getGetStudentExamQueryKey(selectedId ?? 0) } });
  const submitMutation = useSubmitExam();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const exam = selectedQuery.data;
  const onboardingAwaitingApproval = Boolean(exam?.isOnboarding && exam.submission);
  const isOnboardingExam = Boolean(initialExamId !== undefined || exam?.isOnboarding);
  useEffect(() => { setAnswers(exam?.submission?.answers ?? {}); setError(''); }, [exam]);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const submitAnswers = async (currentAnswers: Record<string, number>, allowIncomplete = false) => {
    if (!exam || submitMutation.isPending || exam.submission) return;
    if (!allowIncomplete && Object.keys(currentAnswers).length !== exam.questions.length) {
      setError('Göndərməzdən əvvəl bütün sualları cavablandırın.');
      return;
    }
    setError('');
    try {
      await submitMutation.mutateAsync({ examId: exam.id, data: { answers: currentAnswers } });
      await Promise.all([queryClient.invalidateQueries({ queryKey: getGetStudentExamsQueryKey({ termNumber }) }), selectedQuery.refetch()]);
      onSubmitted?.();
    } catch (submitError) { setError(errorMessage(submitError, 'Cavablar göndərilmədi.')); }
  };
  useEffect(() => {
    if (!exam || exam.submission || !exam.durationMinutes || !exam.startedAt) {
      setRemainingSeconds(null);
      return;
    }
    const update = () => setRemainingSeconds(Math.max(0, Math.ceil((new Date(exam.startedAt!).getTime() + exam.durationMinutes! * 60_000 - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [exam]);
  useEffect(() => {
    if (remainingSeconds === 0 && exam && !exam.submission && !submitMutation.isPending) void submitAnswers(answers, true);
  }, [remainingSeconds, exam, submitMutation.isPending]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void submitAnswers(answers, remainingSeconds === 0);
  };
  return (
    <section className="rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)] md:p-7" data-testid="section-student-exams">
       <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">Cari semestr · {termNumber}-ci semestr</p><h2 className="mt-1 font-serif text-3xl text-[hsl(var(--primary))]">İmtahan və testlər</h2><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Sizə açıq olan seçimli testləri cavablandırın. Göndərilən cavab dəyişdirilə bilməz.</p></div><div className="flex gap-2"><button type="button" onClick={() => void examsQuery.refetch()} className={secondaryButtonClass}><RefreshCw size={14} /> Yenilə</button>{onClose && !isOnboardingExam && <button type="button" onClick={onClose} className={secondaryButtonClass}><X size={14} /> Bağla</button>}</div></div>
        {onboardingAwaitingApproval && <div className="mt-4 rounded-xl border border-[hsl(var(--accent)/.6)] bg-[hsl(var(--accent)/.14)] p-4 text-sm font-semibold text-[hsl(var(--primary))]" data-testid="state-onboarding-exam-review">İmtahanınız göndərildi. İmtahanınız müəllim tərəfindən təsdiqləndikdən sonra ana səhifəyə tam giriş edə biləcəksiniz.</div>}
       {selectedId === null ? (examsQuery.isLoading ? <div className="mt-5 grid gap-3 md:grid-cols-2"><div className="skeleton h-32 rounded-xl" /><div className="skeleton h-32 rounded-xl" /></div> : examsQuery.isError ? <p className="mt-5 rounded-xl bg-[hsl(var(--destructive)/.08)] p-4 text-sm text-[hsl(var(--destructive))]">Testləri yükləmək mümkün olmadı.</p> : !examsQuery.data?.length ? <div className="mt-5 rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center"><ClipboardList className="mx-auto text-[hsl(var(--secondary-foreground))]" /><p className="mt-3 text-sm font-bold text-[hsl(var(--primary))]">Hazırda açıq test yoxdur</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Müəlliminiz test paylaşanda burada görünəcək.</p></div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{examsQuery.data.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="focus-ring rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[hsl(var(--accent))]" data-testid={`card-student-exam-${item.id}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{item.courseTitle}</p><p className="mt-1 text-base font-bold text-[hsl(var(--primary))]">{item.title}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.submission ? 'bg-emerald-100 text-emerald-800' : 'bg-[hsl(var(--secondary)/.55)] text-[hsl(var(--secondary-foreground))]'}`}>{item.submission ? 'Göndərilib' : 'Cavablandır'}</span></div><p className="mt-3 line-clamp-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{item.description}</p><div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]"><span>{item.questions.length} seçimli sual · {item.teacherName}</span><ExamTimer seconds={item.durationMinutes ? item.durationMinutes * 60 : null} compact /></div></button>)}</div>) : <div className="mt-5"><button type="button" onClick={() => setSelectedId(null)} className="mb-4 text-xs font-bold text-[hsl(var(--secondary-foreground))]">← Test siyahısına qayıt</button>{selectedQuery.isLoading || !exam ? <div className="skeleton h-64 rounded-xl" /> : <><div className="rounded-2xl bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))]"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--accent))]">{exam.courseTitle} · {exam.teacherName}</p><h3 className="mt-2 font-serif text-2xl">{exam.title}</h3></div>{!exam.submission && <ExamTimer seconds={remainingSeconds ?? (exam.durationMinutes ? exam.durationMinutes * 60 : null)} />}</div><p className="mt-2 text-sm leading-6 text-[hsl(var(--primary-foreground)/.75)]">{exam.description}</p></div>{exam.submission ? <div className="mt-4 rounded-xl bg-[hsl(var(--secondary)/.35)] p-4 text-sm font-semibold text-[hsl(var(--secondary-foreground))]"><CheckCircle2 className="mb-2" size={20} />Cavabınız {new Date(exam.submission.submittedAt).toLocaleString('az-AZ')} tarixində göndərilib. Bu cavab artıq dəyişdirilə bilməz.<ExamResultSummary result={exam.submission.result} /></div> : <form onSubmit={submit} className="mt-4 space-y-3">{exam.questions.map((question, index) => <fieldset key={question.id} className="rounded-2xl border border-[hsl(var(--border))] p-4"><legend className="max-w-full px-1 text-sm font-bold leading-5 text-[hsl(var(--primary))]">{index + 1}. {question.prompt}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{question.options.map((option) => <label key={option.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-3 text-sm transition ${answers[String(question.id)] === option.id ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.15)]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/.45)]'}`}><input type="radio" name={`question-${question.id}`} checked={answers[String(question.id)] === option.id} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))} className="mt-0.5" /> <span>{option.label}</span></label>)}</div></fieldset>)}{error && <p className="rounded-xl bg-[hsl(var(--destructive)/.08)] p-3 text-xs font-semibold text-[hsl(var(--destructive))]" data-testid="status-student-exam-error">{error}</p>}<button type="submit" disabled={submitMutation.isPending} className={`${buttonClass} w-full sm:w-auto`} data-testid="button-submit-exam"><Send size={15} /> {submitMutation.isPending ? 'Göndərilir...' : remainingSeconds === 0 ? 'Vaxt bitdi — göndər' : 'Cavabları göndər'}</button></form>}</>}</div>}
    </section>
  );
}