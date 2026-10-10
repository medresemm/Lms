import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, ChevronRight, ClipboardList, Eye, FilePlus2, Hourglass, Languages, ListChecks, PenLine, Pencil, Plus, Power, RefreshCw, Send, Trash2, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { teachesResource } from '@/lib/co-teachers';
import type { AdminExam, AdminExamQuestionsItem, AdminExamSubmission, Exam, ExamResult, LearningResource } from '@workspace/api-client-react';
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
  useGradeExamSubmission,
  useResendExamToStudent,
  useSubmitExam,
  useUpdateExam,
  useUpdateAdminAdmissionMode,
} from '@workspace/api-client-react';
import {
  blankQuestion,
  examQuestionCountLabel,
  examResultHeadline,
  examTextProps,
  formatPoints,
  hasArabic,
  prepareExamQuestions,
  switchQuestionType,
  type ExamLanguage,
  type QuestionDraft,
} from '@/lib/exam-text';

const inputClass = 'focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm text-[hsl(var(--foreground))] outline-none transition placeholder:text-[hsl(var(--muted-foreground)/.65)]';
const buttonClass = 'focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButtonClass = 'focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))] disabled:cursor-not-allowed disabled:opacity-50';

const latinLetters = 'ABCDEFGH';
const arabicLetters = 'أبجدهوزح';
const optionLetter = (index: number, language: ExamLanguage) => (language === 'ar' ? arabicLetters : latinLetters)[index] ?? String(index + 1);

/** AdminExam suallarında düzgün variant və nümunə cavab da olur. */
const adminQuestions = (exam: AdminExam) => exam.questions as AdminExamQuestionsItem[];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Mətni (sual, variant, cavab) düzgün istiqamətdə göstərir: ərəbcə test sağdan sola, qarışıq mətn hər abzas üzrə. */
function ExamText({ text, language, className = '', as: Tag = 'span' }: { text: string; language: ExamLanguage | undefined; className?: string; as?: 'span' | 'p' | 'div' }) {
  const props = examTextProps(language, text);
  return <Tag dir={props.dir} lang={props.lang} style={props.style} className={`whitespace-pre-wrap break-words text-start ${className}`}>{text}</Tag>;
}

function AdmissionModeSettings({ owner }: { owner: boolean }) {
  const { t } = useI18n();
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
      setNotice(examRequired ? t('admissionExamOn') : t('admissionExamOff'));
    } catch (error) {
      setNotice(errorMessage(error, t('admissionNotSaved')));
    }
  };

  const examRequired = query.data?.examRequired;
  const disabled = query.isLoading || updateMutation.isPending;

  return (
    <section className="rounded-2xl border border-[hsl(var(--accent)/.65)] bg-[hsl(var(--accent)/.1)] p-5" data-testid="section-admission-mode">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--secondary-foreground))]">{t('newAdmission')}</p>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('admissionModeHint')}</p>
        </div>
        <span className="rounded-full bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]" data-testid="status-admission-mode">
          {query.isLoading ? t('loading') : examRequired ? t('withExam') : t('withoutExam')}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label={t('admissionRule')}>
        <button type="button" onClick={() => void save(true)} disabled={disabled} aria-pressed={examRequired === true} className={`focus-ring rounded-xl border px-4 py-3 text-left text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${examRequired === true ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]'}`} data-testid="button-admission-mode-exam"><Power size={16} className="mb-1" /> {t('withExam')}<span className="mt-1 block text-[11px] font-normal opacity-75">{t('withExamHint')}</span></button>
        <button type="button" onClick={() => void save(false)} disabled={disabled} aria-pressed={examRequired === false} className={`focus-ring rounded-xl border px-4 py-3 text-left text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${examRequired === false ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]'}`} data-testid="button-admission-mode-direct"><Power size={16} className="mb-1" /> {t('withoutExam')}<span className="mt-1 block text-[11px] font-normal opacity-75">{t('withoutExamHint')}</span></button>
      </div>
      {notice && <p className="mt-3 rounded-xl bg-[hsl(var(--secondary)/.35)] p-3 text-xs font-semibold text-[hsl(var(--secondary-foreground))]" data-testid="status-admission-mode-notice">{notice}</p>}
    </section>
  );
}

function ExamQuestionEditor({ questions, language, onChange }: { questions: QuestionDraft[]; language: ExamLanguage; onChange: (value: QuestionDraft[]) => void }) {
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
  const arabic = language === 'ar';
  const fieldProps = (text: string) => {
    const props = examTextProps(language, text);
    return { dir: props.dir, lang: props.lang, style: props.style };
  };
  return (
    <div className="space-y-3">
      {questions.map((question, questionIndex) => (
        <div key={questionIndex} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.62)] p-3 sm:p-4" data-testid={`card-exam-question-editor-${questionIndex}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--secondary)/.65)] text-xs font-black text-[hsl(var(--secondary-foreground))]">{questionIndex + 1}</span>
            <div className="inline-flex rounded-xl bg-[hsl(var(--muted)/.6)] p-1" role="group" aria-label="Sualın növü">
              <button type="button" onClick={() => onChange(questions.map((item, index) => index === questionIndex ? switchQuestionType(item, 'choice') : item))} aria-pressed={question.type === 'choice'} className={`focus-ring inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-black transition ${question.type === 'choice' ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid={`button-question-type-choice-${questionIndex}`}><ListChecks size={13} /> Seçimli</button>
              <button type="button" onClick={() => onChange(questions.map((item, index) => index === questionIndex ? switchQuestionType(item, 'open') : item))} aria-pressed={question.type === 'open'} className={`focus-ring inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-black transition ${question.type === 'open' ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid={`button-question-type-open-${questionIndex}`}><PenLine size={13} /> Açıq sual</button>
            </div>
            <span className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">{question.type === 'open' ? `${question.maxPoints || 5} bal · müəllim yoxlayır` : '1 bal · avtomatik'}</span>
            {questions.length > 1 && <button type="button" onClick={() => onChange(questions.filter((_, index) => index !== questionIndex))} className="focus-ring ml-auto rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Sualı sil"><X size={17} /></button>}
          </div>
          <textarea required maxLength={2000} rows={2} value={question.prompt} onChange={(event) => updateQuestion(questionIndex, { prompt: event.target.value })} className={`${inputClass} mt-3 resize-y`} placeholder={arabic ? 'اكتب السؤال هنا' : 'Sualı yazın'} aria-label={`${questionIndex + 1}-ci sualın mətni`} data-testid={`input-exam-question-${questionIndex}`} {...fieldProps(question.prompt)} />
          {question.type === 'choice' ? (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-2" dir={arabic ? 'rtl' : undefined}>
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <input type="radio" name={`correct-option-${questionIndex}`} checked={question.correctOptionIndex === optionIndex} onChange={() => updateQuestion(questionIndex, { correctOptionIndex: optionIndex })} className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" aria-label={`${optionIndex + 1}-ci variantı düzgün cavab kimi seç`} data-testid={`radio-exam-correct-${questionIndex}-${optionIndex}`} />
                    <span className="w-5 shrink-0 text-center text-xs font-black text-[hsl(var(--muted-foreground))]">{optionLetter(optionIndex, language)}</span>
                    <input required maxLength={500} value={option} onChange={(event) => updateOption(questionIndex, optionIndex, event.target.value)} className={inputClass} placeholder={arabic ? `الخيار ${optionLetter(optionIndex, language)}` : `Variant ${optionLetter(optionIndex, language)}`} aria-label={`${optionIndex + 1}-ci variant`} data-testid={`input-exam-option-${questionIndex}-${optionIndex}`} {...fieldProps(option)} />
                    {question.options.length > 2 && <button type="button" onClick={() => removeOption(questionIndex, optionIndex)} className="focus-ring shrink-0 rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Variantı sil"><X size={15} /></button>}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => updateQuestion(questionIndex, { options: [...question.options, ''] })} disabled={question.options.length >= 8} className="mt-3 text-xs font-bold text-[hsl(var(--secondary-foreground))] disabled:opacity-40">+ Variant əlavə et</button>
            </>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr]">
              <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-[hsl(var(--primary))]">Maksimum bal</span><input type="number" inputMode="numeric" min={1} max={100} step={1} value={question.maxPoints} onChange={(event) => updateQuestion(questionIndex, { maxPoints: event.target.value })} className={inputClass} placeholder="5" data-testid={`input-exam-open-points-${questionIndex}`} /></label>
              <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-[hsl(var(--primary))]">Nümunə cavab <span className="font-normal text-[hsl(var(--muted-foreground))]">(istəyə bağlı · yalnız müəllim görür)</span></span><textarea maxLength={4000} rows={2} value={question.modelAnswer} onChange={(event) => updateQuestion(questionIndex, { modelAnswer: event.target.value })} className={`${inputClass} resize-y`} placeholder={arabic ? 'الإجابة النموذجية' : 'Yoxlayarkən sizə kömək edəcək nümunə cavab'} data-testid={`input-exam-open-model-${questionIndex}`} {...fieldProps(question.modelAnswer)} /></label>
              <p className="text-[11px] leading-5 text-[hsl(var(--muted-foreground))] sm:col-span-2">Tələbə cavabı özü yazacaq. Cavab «Yoxlanılır» statusunda gələcək, siz bal verəndən sonra nəticə tələbəyə açılacaq.</p>
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange([...questions, blankQuestion('choice')])} disabled={questions.length >= 50} className={secondaryButtonClass} data-testid="button-add-choice-question"><Plus size={15} /> Seçimli sual</button>
        <button type="button" onClick={() => onChange([...questions, blankQuestion('open')])} disabled={questions.length >= 50} className={secondaryButtonClass} data-testid="button-add-open-question"><Plus size={15} /> Açıq sual</button>
      </div>
    </div>
  );
}

function ExamForm({ resources, teacherClerkUserId, editing, defaultOnboarding = false, onCancel, onSaved }: { resources: LearningResource[]; teacherClerkUserId?: string; editing: AdminExam | null; defaultOnboarding?: boolean; onCancel: () => void; onSaved: () => void }) {
  const createMutation = useCreateExam();
  const updateMutation = useUpdateExam();
  const availableResources = teacherClerkUserId ? resources.filter((resource) => teachesResource(resource, teacherClerkUserId)) : resources;
  const [isOnboarding] = useState(editing?.isOnboarding ?? defaultOnboarding);
  const [resourceId, setResourceId] = useState(String(isOnboarding ? '' : editing?.resourceId ?? availableResources[0]?.id ?? ''));
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [status, setStatus] = useState<'open' | 'closed'>(editing?.status ?? 'open');
  const [language, setLanguage] = useState<ExamLanguage>(editing?.language ?? 'az');
  const [durationMinutes, setDurationMinutes] = useState(String(editing?.durationMinutes ?? ''));
  const [questions, setQuestions] = useState<QuestionDraft[]>((editing ? adminQuestions(editing) : undefined)?.map((question) => ({
    type: question.type,
    prompt: question.prompt,
    options: question.options.map((option) => option.label),
    correctOptionIndex: Math.max(0, question.options.findIndex((option) => option.id === question.correctOptionId)),
    maxPoints: String(question.type === 'open' ? question.maxPoints : 5),
    modelAnswer: question.modelAnswer ?? '',
  })) ?? [blankQuestion()]);
  const [error, setError] = useState('');
  const isPending = createMutation.isPending || updateMutation.isPending;
  const arabic = language === 'ar';
  const textFieldProps = (text: string) => {
    const props = examTextProps(language, text);
    return { dir: props.dir, lang: props.lang, style: props.style };
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const parsedDuration = durationMinutes ? Number(durationMinutes) : null;
    if (parsedDuration !== null && (!Number.isInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > 240)) {
      setError('Test vaxtı 1–240 dəqiqə aralığında olmalıdır.');
      return;
    }
    if ((!isOnboarding && !resourceId) || !title.trim() || !description.trim()) {
      setError(`${isOnboarding ? 'Başlıq' : 'Dərs, başlıq'} və izah doldurulmalıdır.`);
      return;
    }
    const prepared = prepareExamQuestions(questions);
    if (!prepared.ok) {
      setError(prepared.error);
      return;
    }
    try {
      const common = { title: title.trim(), description: description.trim(), status, isOnboarding, language, durationMinutes: parsedDuration, questions: prepared.questions };
      if (editing) {
        await updateMutation.mutateAsync({ examId: editing.id, data: common });
      } else {
        await createMutation.mutateAsync({ data: { ...(isOnboarding ? {} : { resourceId: Number(resourceId) }), ...common } });
      }
      onSaved();
    } catch (saveError) {
      setError(errorMessage(saveError, 'Test yadda saxlanmadı.'));
    }
  };

  return (
    <form onSubmit={(event) => void save(event)} className="rounded-2xl border border-[hsl(var(--accent)/.6)] bg-[hsl(var(--accent)/.1)] p-4 sm:p-5" data-testid="form-admin-exam">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{editing ? 'Testi yenilə' : 'Yeni test'}</p><h3 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{editing ? <ExamText text={editing.title} language={undefined} /> : isOnboarding ? 'Qəbul testi yarat' : 'Dərs üçün test yarat'}</h3></div><button type="button" onClick={onCancel} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))]" aria-label="Test formasını bağla"><X size={17} /></button></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {isOnboarding ? <div className="rounded-xl border border-[hsl(var(--accent)/.65)] bg-[hsl(var(--accent)/.12)] px-3.5 py-3"><p className="text-xs font-black text-[hsl(var(--primary))]">Ümumi qəbul testi</p><p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">Bu test konkret müəllim qrupuna bağlı deyil və sistemə daxil olan tələbələr üçün istifadə olunur.</p></div> : <label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Dərs</span><select required disabled={Boolean(editing)} value={resourceId} onChange={(event) => setResourceId(event.target.value)} className={inputClass} data-testid="select-exam-resource"><option value="">Dərs seçin</option>{availableResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.title} · {resource.teacherName ?? 'Müəllim'} · {resource.termNumber}-ci semestr</option>)}</select></label>}
        <label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Status</span><select value={status} onChange={(event) => setStatus(event.target.value as 'open' | 'closed')} className={inputClass} data-testid="select-exam-status"><option value="open">Açıq — tələbələr cavablandıra bilər</option><option value="closed">Bağlı</option></select></label>
        <label className="block"><span className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--primary))]"><Languages size={14} /> Testin dili</span><select value={language} onChange={(event) => setLanguage(event.target.value as ExamLanguage)} className={inputClass} data-testid="select-exam-language"><option value="az">Azərbaycanca (soldan sağa)</option><option value="ar">Ərəbcə — العربية (sağdan sola)</option></select><span className="mt-1 block text-[11px] text-[hsl(var(--muted-foreground))]">{arabic ? 'Suallar, variantlar və cavablar sağdan sola yazılır və göstərilir.' : 'Ayrı-ayrı sahələrdə ərəbcə yazsanız da, mətn avtomatik düzgün istiqamətdə göstərilir.'}</span></label>
        <label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Test vaxtı</span><select value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} className={inputClass} data-testid="select-exam-duration"><option value="">Vaxt limiti yoxdur</option><option value="5">5 dəqiqə</option><option value="10">10 dəqiqə</option><option value="15">15 dəqiqə</option><option value="20">20 dəqiqə</option><option value="30">30 dəqiqə</option><option value="45">45 dəqiqə</option><option value="60">60 dəqiqə</option><option value="90">90 dəqiqə</option><option value="120">120 dəqiqə</option></select><span className="mt-1 block text-[11px] text-[hsl(var(--muted-foreground))]">Tələbə testə başladığı andan bu müddət ərzində cavab göndərməlidir.</span></label>
      </div>
      <div className="mt-4 space-y-4"><label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">Testin başlığı</span><input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder={arabic ? 'مثال: اختبار الطهارة' : 'Məsələn: 1-ci aralıq test'} data-testid="input-exam-title" {...textFieldProps(title)} /></label><label className="block"><span className="mb-2 block text-xs font-bold text-[hsl(var(--primary))]">İzah</span><textarea required maxLength={12000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} resize-y`} placeholder="Tələbə test haqqında nə bilməlidir?" data-testid="input-exam-description" {...textFieldProps(description)} /></label></div>
      <div className="mt-5"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-bold text-[hsl(var(--primary))]">Suallar</p><p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">Seçimli sualda 2–8 variant olur və düzgün cavab dairəyə klikləməklə seçilir (avtomatik yoxlanılır). Açıq sualda tələbə cavabı özü yazır, siz bal verirsiniz.</p></div><span className="shrink-0 text-[11px] font-bold text-[hsl(var(--muted-foreground))]">{questions.length} sual</span></div><ExamQuestionEditor questions={questions} language={language} onChange={setQuestions} /></div>
      {editing && editing.submissionCount > 0 && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold leading-5 text-amber-900">Bu testə artıq {editing.submissionCount} cavab gəlib. Sualları dəyişsəniz, əvvəlki cavablar yeni suallara uyğun gəlməyə bilər. Yalnız başlıq, status və ya dil dəyişirsə, problem yoxdur.</p>}
      {error && <p className="mt-4 rounded-xl bg-[hsl(var(--destructive)/.08)] p-3 text-xs font-semibold text-[hsl(var(--destructive))]" data-testid="status-exam-form-error">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-2"><button type="submit" disabled={isPending || (!isOnboarding && !availableResources.length)} className={buttonClass} data-testid="button-save-exam"><FilePlus2 size={15} /> {isPending ? 'Yadda saxlanır...' : editing ? 'Dəyişiklikləri saxla' : 'Test yarat'}</button><button type="button" onClick={onCancel} className={secondaryButtonClass}>Ləğv et</button></div>
    </form>
  );
}

function GradingBadge({ result }: { result: ExamResult }) {
  if (!result.openQuestionCount) return null;
  return result.status === 'pending_review'
    ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800"><Hourglass size={11} /> Yoxlanılır</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-800"><CheckCircle2 size={11} /> Qiymətləndirilib</span>;
}

function OpenAnswersReview({ exam, submission, onSaved }: { exam: AdminExam; submission: AdminExamSubmission; onSaved: (message: string) => void }) {
  const gradeMutation = useGradeExamSubmission();
  const openQuestions = adminQuestions(exam).filter((question) => question.type === 'open');
  const [points, setPoints] = useState<Record<string, string>>(() => Object.fromEntries(openQuestions.map((question) => [String(question.id), submission.openGrades[String(question.id)] ? String(submission.openGrades[String(question.id)].points) : ''])));
  const [comments, setComments] = useState<Record<string, string>>(() => Object.fromEntries(openQuestions.map((question) => [String(question.id), submission.openGrades[String(question.id)]?.comment ?? ''])));
  const [error, setError] = useState('');
  const questionNumber = new Map(exam.questions.map((question, index) => [question.id, index + 1]));
  const save = async () => {
    setError('');
    const grades: Record<string, { points: number; comment: string | null }> = {};
    for (const question of openQuestions) {
      const key = String(question.id);
      const raw = (points[key] ?? '').replace(',', '.').trim();
      if (!raw) continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > question.maxPoints) {
        setError(`${questionNumber.get(question.id)}-ci sual üçün bal 0 ilə ${question.maxPoints} arasında olmalıdır.`);
        return;
      }
      grades[key] = { points: Math.round(value * 100) / 100, comment: comments[key]?.trim() || null };
    }
    if (!Object.keys(grades).length) {
      setError('Ən azı bir açıq cavaba bal yazın.');
      return;
    }
    try {
      const updated = await gradeMutation.mutateAsync({ examId: exam.id, profileId: submission.profileId, data: { grades } });
      onSaved(updated.result.status === 'graded'
        ? `${submission.studentName}: ${formatPoints(updated.result.score)} / ${formatPoints(updated.result.maxScore)} bal. Nəticə tələbəyə açıldı.`
        : `${submission.studentName}: ballar yadda saxlandı. Qalan açıq suallar yoxlanandan sonra nəticə tələbəyə açılacaq.`);
    } catch (saveError) {
      setError(errorMessage(saveError, 'Ballar yadda saxlanmadı.'));
    }
  };
  if (!openQuestions.length) return null;
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[hsl(var(--accent)/.6)] bg-[hsl(var(--accent)/.08)] p-3" data-testid={`panel-open-review-${submission.profileId}`}>
      <p className="text-xs font-black text-[hsl(var(--primary))]">Açıq cavabların yoxlanması</p>
      {openQuestions.map((question) => {
        const key = String(question.id);
        const answer = submission.openAnswers[key];
        return (
          <div key={question.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
            <p className="text-[11px] font-bold text-[hsl(var(--muted-foreground))]">{questionNumber.get(question.id)}-ci sual · maks. {question.maxPoints} bal</p>
            <ExamText as="p" text={question.prompt} language={exam.language} className="mt-1 text-sm font-bold leading-6 text-[hsl(var(--primary))]" />
            <div className="mt-2 rounded-lg bg-[hsl(var(--muted)/.35)] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Tələbənin cavabı</p>
              {answer ? <ExamText as="p" text={answer} language={exam.language} className="mt-1 text-sm leading-7 text-[hsl(var(--foreground))]" /> : <p className="mt-1 text-xs italic text-[hsl(var(--muted-foreground))]">Cavab yazılmayıb.</p>}
            </div>
            {question.modelAnswer && <details className="mt-2 rounded-lg border border-dashed border-[hsl(var(--border))] p-2.5"><summary className="cursor-pointer text-[11px] font-bold text-[hsl(var(--secondary-foreground))]">Nümunə cavab (yalnız müəllim görür)</summary><ExamText as="p" text={question.modelAnswer} language={exam.language} className="mt-1 text-sm leading-7 text-[hsl(var(--foreground)/.85)]" /></details>}
            <div className="mt-3 grid gap-2 sm:grid-cols-[150px_1fr]">
              <label className="block"><span className="mb-1 block text-[11px] font-bold text-[hsl(var(--primary))]">Bal (0–{question.maxPoints})</span><input type="number" inputMode="decimal" min={0} max={question.maxPoints} step={0.25} value={points[key] ?? ''} onChange={(event) => setPoints((current) => ({ ...current, [key]: event.target.value }))} className={inputClass} data-testid={`input-open-grade-${submission.profileId}-${question.id}`} /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-bold text-[hsl(var(--primary))]">Şərh <span className="font-normal text-[hsl(var(--muted-foreground))]">(istəyə bağlı · tələbə görəcək)</span></span><textarea rows={2} maxLength={2000} value={comments[key] ?? ''} onChange={(event) => setComments((current) => ({ ...current, [key]: event.target.value }))} className={`${inputClass} resize-y`} dir="auto" style={{ unicodeBidi: 'plaintext' }} data-testid={`input-open-comment-${submission.profileId}-${question.id}`} /></label>
            </div>
          </div>
        );
      })}
      {error && <p className="rounded-lg bg-[hsl(var(--destructive)/.08)] p-2.5 text-xs font-semibold text-[hsl(var(--destructive))]">{error}</p>}
      <button type="button" onClick={() => void save()} disabled={gradeMutation.isPending} className={`${buttonClass} w-full sm:w-auto`} data-testid={`button-save-open-grades-${submission.profileId}`}><CheckCircle2 size={15} /> {gradeMutation.isPending ? 'Yadda saxlanır...' : 'Balları yadda saxla'}</button>
    </div>
  );
}

function AdminExamSubmissions({ exam }: { exam: AdminExam }) {
  const examId = exam.id;
  const queryClient = useQueryClient();
  const query = useGetExamSubmissions(examId, { query: { queryKey: getGetExamSubmissionsQueryKey(examId) } });
  const isOnboarding = exam.isOnboarding;
  const hasOpen = exam.questions.some((question) => question.type === 'open');
  const approveMutation = useApproveExamSubmission();
  const resendMutation = useResendExamToStudent();
  const [notice, setNotice] = useState('');
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending'>('all');
  const submissions = (query.data ?? []).filter((submission) => filter === 'all' || submission.result.status === 'pending_review');
  const pendingCount = (query.data ?? []).filter((submission) => submission.result.status === 'pending_review').length;
  const resend = async (submission: AdminExamSubmission) => {
    if (!window.confirm(`${submission.studentName} üçün bu testi yenidən göndərmək istəyirsiniz? Əvvəlki cavab silinəcək.`)) return;
    setNotice('');
    try {
      await resendMutation.mutateAsync({ examId, profileId: submission.profileId });
      await Promise.all([query.refetch(), queryClient.invalidateQueries({ queryKey: getGetAdminExamsQueryKey() })]);
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
  const questionNumber = new Map(exam.questions.map((question, index) => [question.id, index + 1]));
  return (
    <div className="mt-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-[hsl(var(--primary))]">Tələbə cavabları</p><div className="flex flex-wrap gap-2">{hasOpen && <div className="inline-flex rounded-xl bg-[hsl(var(--muted)/.6)] p-1 text-[11px] font-black" role="group" aria-label="Cavab filtri"><button type="button" onClick={() => setFilter('all')} aria-pressed={filter === 'all'} className={`rounded-lg px-2.5 py-1.5 ${filter === 'all' ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`}>Hamısı</button><button type="button" onClick={() => setFilter('pending')} aria-pressed={filter === 'pending'} className={`rounded-lg px-2.5 py-1.5 ${filter === 'pending' ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid={`button-filter-pending-${examId}`}>Yoxlanılır ({pendingCount})</button></div>}<button type="button" onClick={() => void query.refetch()} className={secondaryButtonClass}><RefreshCw size={13} /> Yenilə</button></div></div>
      {notice && <p className="mt-3 rounded-lg bg-[hsl(var(--secondary)/.35)] p-2.5 text-xs font-semibold text-[hsl(var(--secondary-foreground))]" data-testid="status-exam-submissions-notice">{notice}</p>}
      {query.isLoading ? <div className="skeleton mt-3 h-20 rounded-xl" /> : query.isError ? <p className="mt-3 text-xs text-[hsl(var(--destructive))]">Cavabları yükləmək mümkün olmadı.</p> : !submissions.length ? <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">{filter === 'pending' ? 'Yoxlama gözləyən cavab yoxdur.' : 'Hələ cavab göndərən tələbə yoxdur.'}</p> : <div className="mt-3 space-y-3">{submissions.map((submission: AdminExamSubmission) => (
        <div key={submission.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] p-3" data-testid={`card-exam-submission-${submission.id}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0"><p className="text-sm font-bold text-[hsl(var(--primary))]">{submission.studentName}</p><p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">#{submission.studentNumber} · {submission.email}</p><p className="mt-1 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">{new Date(submission.submittedAt).toLocaleString('az-AZ')}</p></div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <GradingBadge result={submission.result} />
              <span className="rounded-full bg-[hsl(var(--card))] px-2 py-1 text-[11px] font-black text-[hsl(var(--primary))]" data-testid={`text-exam-score-${submission.profileId}`}>{submission.result.status === 'pending_review' ? `Avtomatik: ${formatPoints(submission.result.autoScore)} bal · açıq suallar gözləyir` : `${examResultHeadline(submission.result)} · ${submission.result.percentage}%`}</span>
              {isOnboarding && <span className={`rounded-full px-2 py-1 text-[10px] font-black ${submission.reviewStatus === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{submission.reviewStatus === 'approved' ? 'Təsdiqlənib' : 'Təsdiq gözləyir'}</span>}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {hasOpen && <button type="button" onClick={() => setReviewing(reviewing === submission.id ? null : submission.id)} className={submission.result.status === 'pending_review' ? `${buttonClass} px-3 py-2.5 text-xs` : secondaryButtonClass} data-testid={`button-review-open-${submission.profileId}`}><PenLine size={13} /> {submission.result.status === 'pending_review' ? 'Yoxla' : 'Balları dəyiş'}</button>}
            {isOnboarding && submission.reviewStatus !== 'approved' && <button type="button" onClick={() => void approve(submission)} disabled={approveMutation.isPending || resendMutation.isPending} className={secondaryButtonClass} data-testid={`button-approve-exam-${submission.profileId}`}><CheckCircle2 size={13} /> Təsdiqlə</button>}
            <button type="button" onClick={() => void resend(submission)} disabled={resendMutation.isPending || approveMutation.isPending} className={secondaryButtonClass} data-testid={`button-resend-exam-${submission.profileId}`}><RefreshCw size={13} /> Yenidən göndər</button>
          </div>
          {Object.keys(submission.answerLabels).length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(submission.answerLabels).map(([questionId, label]) => {
            const question = adminQuestions(exam).find((item) => String(item.id) === questionId);
            const correct = question?.correctOptionId != null && submission.answers[questionId] === question.correctOptionId;
            return <div key={questionId} className={`rounded-lg px-3 py-2 text-xs ${correct ? 'bg-emerald-50' : 'bg-[hsl(var(--card))]'}`}><span className="font-bold text-[hsl(var(--muted-foreground))]">{correct ? '✓ ' : '✗ '}Sual {questionNumber.get(Number(questionId)) ?? '?'}</span> <ExamText text={label.replace(/^\d+\.\s*/, '')} language={exam.language} className="ml-1 font-semibold text-[hsl(var(--primary))]" /></div>;
          })}</div>}
          {reviewing === submission.id && <OpenAnswersReview exam={exam} submission={submission} onSaved={(message) => { setNotice(message); setReviewing(null); void query.refetch(); void queryClient.invalidateQueries({ queryKey: getGetAdminExamsQueryKey() }); }} />}
        </div>
      ))}</div>}
    </div>
  );
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
  const pendingReviewTotal = (examsQuery.data ?? []).reduce((sum, exam) => sum + exam.pendingReviewCount, 0);
  const pendingByAudience = (onboarding: boolean) => (examsQuery.data ?? []).filter((exam) => exam.isOnboarding === onboarding).reduce((sum, exam) => sum + exam.pendingReviewCount, 0);
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
          <p className="mt-2 max-w-xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">Adi qrup testlərini və yeni tələbələr üçün qəbul testlərini ayrı-ayrılıqda idarə edin. Testlər Azərbaycanca və ya ərəbcə ola bilər; seçimli suallarla yanaşı açıq suallar da əlavə edə bilərsiniz.</p>
        </div>
        <button type="button" onClick={() => void examsQuery.refetch()} className={secondaryButtonClass} data-testid="button-reload-admin-exams"><RefreshCw size={14} /> Yenilə</button>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[hsl(var(--muted)/.45)] p-1.5" role="tablist" aria-label="Test auditoriyası">
        <button type="button" role="tab" aria-selected={audience === 'all'} onClick={() => { setAudience('all'); setSelectedId(null); }} className={`focus-ring rounded-xl px-3 py-3 text-xs font-black transition ${audience === 'all' ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--card)/.6)]'}`} data-testid="button-admin-exams-all">Bütün tələbələr üçün testlər{pendingByAudience(false) > 0 && <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">{pendingByAudience(false)}</span>}</button>
        <button type="button" role="tab" aria-selected={audience === 'onboarding'} onClick={() => { setAudience('onboarding'); setSelectedId(null); }} className={`focus-ring rounded-xl px-3 py-3 text-xs font-black transition ${audience === 'onboarding' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--card)/.6)]'}`} data-testid="button-admin-exams-onboarding">Yeni tələbələr üçün testlər{pendingByAudience(true) > 0 && <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white">{pendingByAudience(true)}</span>}</button>
      </div>
      <div className="flex justify-end">
         <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} disabled={audience === 'onboarding' && !owner} className={buttonClass} data-testid={audience === 'onboarding' ? 'button-create-onboarding-exam' : 'button-create-exam'}><Plus size={15} /> {audience === 'onboarding' ? owner ? 'Yeni tələbə testi yarat' : 'Yalnız sahib yarada bilər' : 'Yeni test yarat'}</button>
      </div>
      {pendingReviewTotal > 0 && <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900" data-testid="status-exam-pending-reviews"><Hourglass size={15} /> Yoxlama gözləyən açıq cavablar: {pendingReviewTotal}. Testin «Cavablara bax» bölməsində «Yoxla» düyməsi ilə bal verin.</p>}
      {notice && <p className="rounded-xl bg-[hsl(var(--secondary)/.35)] p-3 text-xs font-semibold text-[hsl(var(--secondary-foreground))]">{notice}</p>}
      {showForm && <ExamForm resources={resources} teacherClerkUserId={teacherClerkUserId} editing={editing} defaultOnboarding={audience === 'onboarding'} onCancel={() => { setShowForm(false); setEditing(null); }} onSaved={() => { setShowForm(false); setEditing(null); void refresh(); setNotice(editing ? 'Test yeniləndi.' : 'Test yaradıldı.'); }} />}
       {examsQuery.isLoading ? <div className="space-y-3"><div className="skeleton h-32 rounded-xl" /><div className="skeleton h-32 rounded-xl" /></div> : examsQuery.isError ? <div className="rounded-xl border border-[hsl(var(--destructive)/.22)] bg-[hsl(var(--destructive)/.06)] p-4 text-sm text-[hsl(var(--destructive))]">Testləri yükləmək mümkün olmadı. <button type="button" onClick={() => void examsQuery.refetch()} className="font-bold underline">Yenidən cəhd et</button></div> : !exams.length ? <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] px-5 py-10 text-center"><ClipboardList className="mx-auto text-[hsl(var(--secondary-foreground))]" /><p className="mt-3 text-sm font-bold text-[hsl(var(--primary))]">{audience === 'onboarding' ? 'Yeni tələbə testi yoxdur' : 'Hələ test yoxdur'}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{audience === 'onboarding' ? 'Yeni tələbə testi yarat düyməsi ilə ilk qəbul testini hazırlayın.' : 'İlk testi yaradaraq dərsiniz üçün yoxlama hazırlayın.'}</p></div> : <div className="space-y-3">{exams.map((exam) => <div key={exam.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.17)] p-4" data-testid={`card-admin-exam-${exam.id}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{exam.courseTitle} · {exam.teacherName} · {exam.termNumber}-ci semestr</p><h4 className="mt-1 text-base font-bold text-[hsl(var(--primary))]"><ExamText text={exam.title} language={hasArabic(exam.title) ? exam.language : undefined} /></h4><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{examQuestionCountLabel(exam.questions)} · {exam.submissionCount} cavab · {exam.durationMinutes ? `${exam.durationMinutes} dəqiqə` : 'Vaxt limiti yoxdur'}</p></div><div className="flex flex-wrap items-center justify-end gap-1.5">{exam.language === 'ar' && <span className="rounded-full bg-[hsl(var(--secondary)/.55)] px-2.5 py-1 text-[10px] font-bold text-[hsl(var(--secondary-foreground))]">Ərəbcə</span>}{exam.pendingReviewCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-800" data-testid={`badge-exam-pending-${exam.id}`}><Hourglass size={11} /> {exam.pendingReviewCount} yoxlanılır</span>}<span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${exam.status === 'closed' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>{exam.status === 'closed' ? 'Bağlanıb' : 'Açıq'}</span></div></div><div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" onClick={() => setSelectedId(selectedId === exam.id ? null : exam.id)} className={secondaryButtonClass} data-testid={`button-open-exam-submissions-${exam.id}`}><Eye size={14} /> Cavablara bax{exam.pendingReviewCount > 0 ? ` (${exam.pendingReviewCount} yoxlanılır)` : ''}</button><button type="button" onClick={() => { setEditing(exam); setShowForm(true); }} className={secondaryButtonClass}><Pencil size={14} /> Redaktə</button>{exam.isOnboarding && owner ? <button type="button" onClick={() => void setExamStatus(exam, exam.status === 'closed' ? 'open' : 'closed')} disabled={updateMutation.isPending || deleteMutation.isPending} className={`focus-ring inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold ${exam.status === 'closed' ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-[hsl(var(--destructive)/.25)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.05)]'}`} data-testid={`button-toggle-onboarding-exam-${exam.id}`}><Power size={14} /> {exam.status === 'closed' ? 'Aç' : 'Bağla'}</button> : !exam.isOnboarding && exam.status !== 'closed' && <button type="button" onClick={() => void setExamStatus(exam, 'closed')} disabled={updateMutation.isPending || deleteMutation.isPending} className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-[hsl(var(--destructive)/.25)] px-3 py-2.5 text-xs font-bold text-[hsl(var(--destructive))]">Bağla</button>}{(!exam.isOnboarding || owner) && <button type="button" onClick={() => void deleteExam(exam)} disabled={deleteMutation.isPending || updateMutation.isPending} className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-[hsl(var(--destructive)/.25)] px-3 py-2.5 text-xs font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.05)]" data-testid={`button-delete-exam-${exam.id}`}><Trash2 size={14} /> Sil</button>}</div>{selectedId === exam.id && <AdminExamSubmissions exam={exam} />}</div>)}</div>}
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
      className="focus-ring group flex h-full w-full items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary))] px-3 py-2.5 text-left shadow-[0_8px_18px_hsl(var(--primary)/.16)] transition hover:-translate-y-0.5"
      data-testid="button-open-student-exams"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--primary))]"><ClipboardList size={18} /></span>
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--primary-foreground)/.68)]">{termNumber}-ci semestr</span>
          <span className="mt-0.5 block truncate font-serif text-lg leading-tight text-[hsl(var(--primary-foreground))]">Testlər</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 rounded-lg bg-[hsl(var(--accent))] px-2.5 py-1.5 text-[11px] font-black text-[hsl(var(--primary))]"><span>{examsQuery.isLoading ? '...' : exams.length}</span><ChevronRight size={15} /></span>
    </button>
  );
}

function ExamResultSummary({ exam }: { exam: Exam }) {
  const submission = exam.submission;
  if (!submission) return null;
  const result = submission.result;
  const openQuestions = exam.questions.filter((question) => question.type === 'open');
  if (result.status === 'pending_review') {
    return (
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900" data-testid="card-student-exam-pending">
        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.14em]"><Hourglass size={14} /> Yoxlanılır</p>
        <p className="mt-2 text-sm font-semibold leading-6">Cavablarınız qəbul olundu. Testdə {openQuestions.length || result.openQuestionCount} açıq sual var — müəllim onları yoxlayıb bal verəndən sonra yekun nəticəniz burada görünəcək və sizə bildiriş gələcək.</p>
      </div>
    );
  }
  const choiceMax = result.maxScore - openQuestions.reduce((sum, question) => sum + question.maxPoints, 0);
  return (
    <div className="mt-4 rounded-2xl border border-[hsl(var(--accent)/.65)] bg-[hsl(var(--accent)/.16)] p-4" data-testid="card-student-exam-result">
      <p className="text-[10px] font-black uppercase tracking-[.16em] text-[hsl(var(--primary))]">Test nəticəniz</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <p className="font-serif text-3xl text-[hsl(var(--primary))]">{result.percentage}%</p>
        <p className="text-sm font-bold text-[hsl(var(--primary))]">{examResultHeadline(result)}</p>
      </div>
      {result.openQuestionCount > 0 ? (
        <>
          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Seçimli suallar: {formatPoints(result.autoScore)} / {formatPoints(Math.max(0, choiceMax))} bal ({result.correctCount} düzgün) · Açıq suallar: {formatPoints(result.manualScore)} / {formatPoints(result.maxScore - Math.max(0, choiceMax))} bal</p>
          <div className="mt-3 space-y-2">
            {openQuestions.map((question) => {
              const key = String(question.id);
              const grade = submission.openGrades[key];
              return (
                <div key={question.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-[hsl(var(--foreground))]">
                  <ExamText as="p" text={question.prompt} language={exam.language} className="text-sm font-bold leading-6 text-[hsl(var(--primary))]" />
                  {submission.openAnswers[key] ? <ExamText as="p" text={submission.openAnswers[key]} language={exam.language} className="mt-1 text-sm leading-7" /> : <p className="mt-1 text-xs italic text-[hsl(var(--muted-foreground))]">Cavab yazılmayıb.</p>}
                  <p className="mt-2 text-xs font-black text-[hsl(var(--secondary-foreground))]">Bal: {grade ? formatPoints(grade.points) : 0} / {question.maxPoints}</p>
                  {grade?.comment && <p className="mt-1 flex gap-1.5 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><span className="font-bold">Müəllim:</span><ExamText text={grade.comment} language={undefined} /></p>}
                </div>
              );
            })}
          </div>
        </>
      ) : <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Nəticə test tamamlandıqdan sonra hesablanıb.</p>}
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

const draftKey = (examId: number) => `akademiya-exam-draft:${examId}`;

function loadDraft(examId: number): { answers: Record<string, number>; openAnswers: Record<string, string> } | null {
  try {
    const raw = window.localStorage.getItem(draftKey(examId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { answers?: Record<string, number>; openAnswers?: Record<string, string> };
    return { answers: parsed.answers ?? {}, openAnswers: parsed.openAnswers ?? {} };
  } catch {
    return null;
  }
}

function saveDraft(examId: number, answers: Record<string, number>, openAnswers: Record<string, string>) {
  try {
    window.localStorage.setItem(draftKey(examId), JSON.stringify({ answers, openAnswers }));
  } catch {
    // Brauzer yaddaşı əlçatan deyilsə, qaralama saxlanılmır.
  }
}

function clearDraft(examId: number) {
  try { window.localStorage.removeItem(draftKey(examId)); } catch { /* yox */ }
}

export function StudentExamsSection({ termNumber, onClose, initialExamId, onSubmitted }: { termNumber: number; onClose?: () => void; initialExamId?: number; onSubmitted?: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const examsQuery = useGetStudentExams({ termNumber }, { query: { queryKey: getGetStudentExamsQueryKey({ termNumber }) } });
  const [selectedId, setSelectedId] = useState<number | null>(initialExamId ?? null);
  const selectedQuery = useGetStudentExam(selectedId ?? 0, { query: { enabled: selectedId !== null, queryKey: getGetStudentExamQueryKey(selectedId ?? 0) } });
  const submitMutation = useSubmitExam();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [openAnswers, setOpenAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const exam = selectedQuery.data;
  const onboardingAwaitingApproval = Boolean(exam?.isOnboarding && exam.submission);
  const isOnboardingExam = Boolean(initialExamId !== undefined || exam?.isOnboarding);
  useEffect(() => {
    if (!exam) { setAnswers({}); setOpenAnswers({}); setError(''); return; }
    if (exam.submission) {
      setAnswers(exam.submission.answers ?? {});
      setOpenAnswers(exam.submission.openAnswers ?? {});
    } else {
      const draft = loadDraft(exam.id);
      const questionIds = new Set(exam.questions.map((question) => String(question.id)));
      setAnswers(Object.fromEntries(Object.entries(draft?.answers ?? {}).filter(([key]) => questionIds.has(key))));
      setOpenAnswers(Object.fromEntries(Object.entries(draft?.openAnswers ?? {}).filter(([key]) => questionIds.has(key))));
    }
    setError('');
  }, [exam]);
  useEffect(() => {
    if (exam && !exam.submission) saveDraft(exam.id, answers, openAnswers);
  }, [exam, answers, openAnswers]);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const unanswered = useMemo(() => (exam?.questions ?? []).filter((question) => question.type === 'open' ? !(openAnswers[String(question.id)] ?? '').trim() : answers[String(question.id)] === undefined).length, [exam, answers, openAnswers]);
  const submitAnswers = async (currentAnswers: Record<string, number>, currentOpenAnswers: Record<string, string>, allowIncomplete = false) => {
    if (!exam || submitMutation.isPending || exam.submission) return;
    const missing = exam.questions.filter((question) => question.type === 'open' ? !(currentOpenAnswers[String(question.id)] ?? '').trim() : currentAnswers[String(question.id)] === undefined).length;
    if (!allowIncomplete && missing > 0) {
      setError(`Göndərməzdən əvvəl bütün sualları cavablandırın (cavabsız: ${missing}).`);
      return;
    }
    setError('');
    const cleanedOpen = Object.fromEntries(Object.entries(currentOpenAnswers).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));
    try {
      await submitMutation.mutateAsync({ examId: exam.id, data: { answers: currentAnswers, openAnswers: cleanedOpen } });
      clearDraft(exam.id);
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
    if (remainingSeconds === 0 && exam && !exam.submission && !submitMutation.isPending) void submitAnswers(answers, openAnswers, true);
  }, [remainingSeconds, exam, submitMutation.isPending]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void submitAnswers(answers, openAnswers, remainingSeconds === 0);
  };
  const arabic = exam?.language === 'ar';
  return (
    <section className="rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[var(--shadow-sm)] sm:p-5 md:p-7" data-testid="section-student-exams">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">{t('currentTermLine')} · {termNumber}. {t('termLabel')}</p><h2 className="mt-1 font-serif text-3xl text-[hsl(var(--primary))]">{t('navExams')}</h2><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{t('examHint')}</p></div><div className="flex gap-2"><button type="button" onClick={() => void examsQuery.refetch()} className={secondaryButtonClass}><RefreshCw size={14} /> {t('refresh')}</button>{onClose && !isOnboardingExam && <button type="button" onClick={onClose} className={secondaryButtonClass}><X size={14} /> {t('close')}</button>}</div></div>
      {onboardingAwaitingApproval && <div className="mt-4 rounded-xl border border-[hsl(var(--accent)/.6)] bg-[hsl(var(--accent)/.14)] p-4 text-sm font-semibold text-[hsl(var(--primary))]" data-testid="state-onboarding-exam-review">İmtahanınız göndərildi. İmtahanınız müəllim tərəfindən təsdiqləndikdən sonra ana səhifəyə tam giriş edə biləcəksiniz.</div>}
      {selectedId === null ? (examsQuery.isLoading ? <div className="mt-5 grid gap-3 md:grid-cols-2"><div className="skeleton h-32 rounded-xl" /><div className="skeleton h-32 rounded-xl" /></div> : examsQuery.isError ? <p className="mt-5 rounded-xl bg-[hsl(var(--destructive)/.08)] p-4 text-sm text-[hsl(var(--destructive))]">{t('examsLoadFailed')}</p> : !examsQuery.data?.length ? <div className="mt-5 rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center"><ClipboardList className="mx-auto text-[hsl(var(--secondary-foreground))]" /><p className="mt-3 text-sm font-bold text-[hsl(var(--primary))]">{t('noOpenExam')}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t('noOpenExamBody')}</p></div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{examsQuery.data.map((item) => {
        const pending = item.submission?.result.status === 'pending_review';
        return <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="focus-ring rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.2)] p-4 text-left transition hover:-translate-y-0.5 hover:border-[hsl(var(--accent))]" data-testid={`card-student-exam-${item.id}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{item.courseTitle}{item.language === 'ar' ? ` · ${t('examArabic')}` : ''}</p><p className="mt-1 text-base font-bold text-[hsl(var(--primary))]"><ExamText text={item.title} language={hasArabic(item.title) ? item.language : undefined} /></p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${pending ? 'bg-amber-100 text-amber-800' : item.submission ? 'bg-emerald-100 text-emerald-800' : 'bg-[hsl(var(--secondary)/.55)] text-[hsl(var(--secondary-foreground))]'}`}>{pending ? t('examPending') : item.submission ? t('examSent') : t('examAnswer')}</span></div><ExamText as="p" text={item.description} language={hasArabic(item.description) ? item.language : undefined} className="mt-3 line-clamp-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]" /><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]"><span>{examQuestionCountLabel(item.questions)} · {item.teacherName}</span><ExamTimer seconds={item.durationMinutes ? item.durationMinutes * 60 : null} compact /></div></button>;
      })}</div>) : <div className="mt-5"><button type="button" onClick={() => setSelectedId(null)} className="mb-4 text-xs font-bold text-[hsl(var(--secondary-foreground))]">← {t('backToExams')}</button>{selectedQuery.isLoading || !exam ? <div className="skeleton h-64 rounded-xl" /> : <>
        <div className="rounded-2xl bg-[hsl(var(--primary))] p-4 text-[hsl(var(--primary-foreground))] sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--accent))]">{exam.courseTitle} · {exam.teacherName}</p><h3 className="mt-2 font-serif text-2xl"><ExamText text={exam.title} language={hasArabic(exam.title) ? exam.language : undefined} /></h3></div>{!exam.submission && <ExamTimer seconds={remainingSeconds ?? (exam.durationMinutes ? exam.durationMinutes * 60 : null)} />}</div><ExamText as="p" text={exam.description} language={hasArabic(exam.description) ? exam.language : undefined} className="mt-2 text-sm leading-6 text-[hsl(var(--primary-foreground)/.75)]" /></div>
        {exam.submission ? <div className="mt-4 rounded-xl bg-[hsl(var(--secondary)/.35)] p-4 text-sm font-semibold text-[hsl(var(--secondary-foreground))]"><CheckCircle2 className="mb-2" size={20} />Cavabınız {new Date(exam.submission.submittedAt).toLocaleString('az-AZ')} tarixində göndərilib. Bu cavab artıq dəyişdirilə bilməz.<ExamResultSummary exam={exam} /></div> : <form onSubmit={submit} className="mt-4 space-y-3">
          {exam.questions.some((question) => question.type === 'open') && <p className="rounded-xl bg-[hsl(var(--muted)/.45)] p-3 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">Bu testdə açıq suallar var: cavabı xanaya özünüz yazın{arabic ? ' (ərəbcə yaza bilərsiniz)' : ''}. Seçimli suallar avtomatik, açıq suallar müəllim tərəfindən yoxlanılır; nəticə yoxlamadan sonra görünəcək. Yazdıqlarınız bu cihazda avtomatik saxlanılır.</p>}
          {exam.questions.map((question, index) => {
            const key = String(question.id);
            const promptProps = examTextProps(exam.language, question.prompt);
            return <fieldset key={question.id} className="min-w-0 rounded-2xl border border-[hsl(var(--border))] p-3 sm:p-4" dir={arabic ? 'rtl' : undefined} data-testid={`fieldset-exam-question-${question.id}`}>
              <legend className="w-full max-w-full px-1 text-sm font-bold leading-6 text-[hsl(var(--primary))]"><span className="flex items-start gap-1.5"><span className="shrink-0">{index + 1}.</span><span dir={promptProps.dir} lang={promptProps.lang} style={promptProps.style} className="min-w-0 whitespace-pre-wrap break-words text-start">{question.prompt}</span></span><span className="mt-1 block text-[10px] font-semibold text-[hsl(var(--muted-foreground))]" dir="ltr">{question.type === 'open' ? `Açıq sual · ${question.maxPoints} bal` : 'Seçimli sual · 1 bal'}</span></legend>
              {question.type === 'open' ? (() => {
                const value = openAnswers[key] ?? '';
                const props = examTextProps(exam.language, value);
                return <div className="mt-2"><textarea rows={5} maxLength={10000} value={value} onChange={(event) => setOpenAnswers((current) => ({ ...current, [key]: event.target.value }))} dir={props.dir} lang={props.lang} style={props.style} className={`${inputClass} resize-y text-start leading-7`} placeholder={arabic ? 'اكتب إجابتك هنا' : 'Cavabınızı bura yazın'} aria-label={`${index + 1}-ci sualın cavabı`} data-testid={`textarea-exam-open-${question.id}`} /><p className="mt-1 text-end text-[10px] text-[hsl(var(--muted-foreground))]" dir="ltr">{value.length} / 10000</p></div>;
              })() : <div className="mt-2 grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => <label key={option.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-3 text-sm transition ${answers[key] === option.id ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.15)]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/.45)]'}`}><input type="radio" name={`question-${question.id}`} checked={answers[key] === option.id} onChange={() => setAnswers((current) => ({ ...current, [key]: option.id }))} className="mt-1 shrink-0" /><span className="shrink-0 pt-0.5 text-xs font-black text-[hsl(var(--muted-foreground))]">{optionLetter(optionIndex, exam.language)})</span><ExamText text={option.label} language={exam.language} className="min-w-0 flex-1" /></label>)}</div>}
            </fieldset>;
          })}
          {error && <p className="rounded-xl bg-[hsl(var(--destructive)/.08)] p-3 text-xs font-semibold text-[hsl(var(--destructive))]" data-testid="status-student-exam-error">{error}</p>}
          <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.95)] p-2.5 shadow-[var(--shadow-sm)] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"><button type="submit" disabled={submitMutation.isPending} className={`${buttonClass} w-full sm:w-auto`} data-testid="button-submit-exam"><Send size={15} /> {submitMutation.isPending ? 'Göndərilir...' : remainingSeconds === 0 ? 'Vaxt bitdi — göndər' : 'Cavabları göndər'}</button>{unanswered > 0 && <span className="w-full text-center text-[11px] font-semibold text-[hsl(var(--muted-foreground))] sm:w-auto">Cavabsız sual: {unanswered}</span>}</div>
        </form>}
      </>}</div>}
    </section>
  );
}
