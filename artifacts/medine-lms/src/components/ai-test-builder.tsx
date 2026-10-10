import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { AiAnswerCard } from '@/components/ai-blocks';
import { frameOf } from '@/lib/ai-blocks';

// Mədinə AI → «Test hazırla» (yalnız müəllim və adminlər).
// Kitabxanadakı kitabın mətnindən (OCR qatı) qayda əsaslı suallar hazırlanır — xarici AI yoxdur.
// Nəticə önizlənir, redaktə olunur və mövcud «İmtahan və testlər» sistemində BAĞLI (qaralama) test kimi saxlanılır.

type GetToken = () => Promise<string | null>;
type Kind = 'cloze' | 'truefalse' | 'chapter' | 'open';

type ConfigBook = {
  slug: string;
  title: string;
  shortTitle: string;
  subject: string;
  pageCount: number;
  pageOffset: number;
  hasText: boolean;
  chapters: { title: string; level: number; page: number; printedPage: number }[];
};
type ConfigGroup = { id: number; title: string; termNumber: number; teacherName: string | null };
export type TestBuilderConfig = { books: ConfigBook[]; groups: ConfigGroup[]; counts: number[]; maxRangePages: number };

type Draft = {
  key: string;
  kind: Kind;
  type: 'choice' | 'open';
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  maxPoints: number;
  modelAnswer: string;
  printedPage: number;
  chapterTitle: string | null;
};

type GenerateBody = { slug: string; chapterIndex?: number; fromPage?: number; toPage?: number; topic?: string; count: number; kinds: Kind[]; excludeKeys?: string[]; salt?: number };
type GenerateResponse = {
  questions: (Omit<Draft, 'modelAnswer'> & { modelAnswer: string | null; page: number })[];
  warnings: string[];
  suggestedTitle: string;
  suggestedDescription: string;
  range: { printedFrom: number; printedTo: number };
  chapterTitle: string | null;
};

const gold = '#e3c27a';
const arabicFont = '"Amiri", "Noto Naskh Arabic", "Scheherazade New", "Traditional Arabic", "Geeza Pro", serif';
const KIND_LABELS: Record<Kind, string> = { cloze: 'Boşluq doldurma', truefalse: 'Doğru / yanlış', chapter: 'Hansı babda?', open: 'Açıq sual' };
const ALL_KINDS: Kind[] = ['cloze', 'truefalse', 'chapter', 'open'];
const field = 'w-full rounded-xl border border-[#e3c27a]/30 bg-black/40 px-3 py-2 text-sm text-[#f4ead5] outline-none focus:border-[#e3c27a] disabled:opacity-50';
const label = 'mb-1 block text-[11px] font-bold uppercase tracking-[.12em] text-[#f4ead5]/60';
const arabicField = { fontFamily: arabicFont, fontSize: '1.05em', lineHeight: 1.9, unicodeBidi: 'plaintext' as const };

async function api<T>(getToken: GetToken, url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const token = await getToken().catch(() => null);
  const response = await fetch(url, {
    method: init?.method ?? 'GET',
    headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !data) throw new Error(data?.error || 'Sorğu alınmadı. Bir az sonra yenidən cəhd edin.');
  return data;
}

export async function loadTestBuilderConfig(getToken: GetToken): Promise<TestBuilderConfig | null> {
  try {
    return await api<TestBuilderConfig>(getToken, '/api/ai/test-builder/config');
  } catch {
    return null;
  }
}

function toDraft(question: GenerateResponse['questions'][number]): Draft {
  return {
    key: question.key,
    kind: question.kind,
    type: question.type,
    prompt: question.prompt,
    options: question.options,
    correctOptionIndex: question.correctOptionIndex,
    maxPoints: question.maxPoints || 5,
    modelAnswer: question.modelAnswer ?? '',
    printedPage: question.printedPage,
    chapterTitle: question.chapterTitle,
  };
}

function draftProblem(draft: Draft): string | null {
  if (!draft.prompt.trim()) return 'Sual mətni boşdur.';
  if (draft.type === 'choice') {
    const options = draft.options.map((option) => option.trim());
    if (options.length < 2) return 'Ən azı 2 variant lazımdır.';
    if (options.some((option) => !option)) return 'Boş variant var.';
    if (new Set(options).size !== options.length) return 'Eyni variant iki dəfə yazılıb.';
  }
  return null;
}

function groupLabel(group: ConfigGroup) {
  return `${group.title}${group.teacherName ? ` · ${group.teacherName}` : ''} · ${group.termNumber}-ci semestr`;
}

export function AiTestBuilder({ config, getToken, onClose }: { config: TestBuilderConfig; getToken: GetToken; onClose: () => void }) {
  const [slug, setSlug] = useState(() => config.books.find((book) => book.hasText)?.slug ?? config.books[0]?.slug ?? '');
  const book = config.books.find((item) => item.slug === slug) ?? null;
  const [rangeMode, setRangeMode] = useState<'chapter' | 'pages'>('chapter');
  const [chapterIndex, setChapterIndex] = useState<string>('');
  const [fromPage, setFromPage] = useState('');
  const [toPage, setToPage] = useState('');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [kinds, setKinds] = useState<Kind[]>(ALL_KINDS);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastRequest, setLastRequest] = useState<GenerateBody | null>(null);
  const [salt, setSalt] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [groupId, setGroupId] = useState<string>(() => (config.groups.length === 1 ? String(config.groups[0].id) : ''));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ title: string; group: string; questions: number; open: number } | null>(null);

  useEffect(() => { setChapterIndex(''); setFromPage(''); setToPage(''); }, [slug]);

  const chapters = useMemo(() => (book?.chapters ?? []).map((chapter, index) => ({ ...chapter, index })), [book]);
  const printedMin = book ? Math.max(1, 1 - book.pageOffset) : 1;
  const printedMax = book ? book.pageCount - book.pageOffset : 1;

  function toggleKind(kind: Kind) {
    setKinds((current) => (current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]));
  }

  function buildRequest(): GenerateBody | string {
    if (!book) return 'Kitab seçin.';
    if (!book.hasText) return 'Bu kitabın mətn qatı yoxdur (skan edilmiş PDF). Test yalnız mətni oxuna bilən kitablardan hazırlanır.';
    if (!kinds.length) return 'Ən azı bir sual növü seçin.';
    const body: GenerateBody = { slug: book.slug, count, kinds, ...(topic.trim() ? { topic: topic.trim().slice(0, 100) } : {}) };
    if (rangeMode === 'chapter' && chapterIndex !== '') body.chapterIndex = Number(chapterIndex);
    if (rangeMode === 'pages' && (fromPage || toPage)) {
      const from = Number(fromPage || toPage);
      const to = Number(toPage || fromPage);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < printedMin || to > printedMax || from > to) return `Səhifə aralığı ${printedMin}–${printedMax} arasında olmalıdır.`;
      if (to - from + 1 > config.maxRangePages) return `Bir dəfəyə ən çox ${config.maxRangePages} səhifə seçmək olar.`;
      body.fromPage = from;
      body.toPage = to;
    }
    if (body.chapterIndex === undefined && body.fromPage === undefined && !body.topic) return 'Bab, səhifə aralığı və ya mövzu seçin.';
    return body;
  }

  async function generate() {
    const request = buildRequest();
    if (typeof request === 'string') { setError(request); return; }
    setGenerating(true);
    setError(null);
    setSaved(null);
    try {
      const data = await api<GenerateResponse>(getToken, '/api/ai/test-builder/generate', { method: 'POST', body: request });
      setDrafts(data.questions.map(toDraft));
      setWarnings(data.warnings ?? []);
      setLastRequest(request);
      setTitle(data.suggestedTitle);
      setDescription(data.suggestedDescription);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Test hazırlanmadı.');
    } finally {
      setGenerating(false);
    }
  }

  async function regenerate(index: number) {
    if (!drafts || !lastRequest) return;
    const current = drafts[index];
    const nextSalt = salt + 1;
    setSalt(nextSalt);
    setBusyKey(current.key);
    setError(null);
    try {
      const data = await api<GenerateResponse>(getToken, '/api/ai/test-builder/generate', {
        method: 'POST',
        body: { ...lastRequest, count: 1, kinds: [current.kind], excludeKeys: drafts.map((draft) => draft.key).slice(0, 80), salt: nextSalt },
      });
      const replacement = data.questions[0];
      if (!replacement) throw new Error('Bu növdən başqa sual tapılmadı. Sualı silə və ya özünüz redaktə edə bilərsiniz.');
      setDrafts((list) => list && list.map((draft, position) => (position === index ? toDraft(replacement) : draft)));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Sual yenilənmədi.');
    } finally {
      setBusyKey(null);
    }
  }

  function update(index: number, patch: Partial<Draft>) {
    setDrafts((list) => list && list.map((draft, position) => (position === index ? { ...draft, ...patch } : draft)));
  }

  async function save() {
    if (!drafts?.length) return;
    const group = config.groups.find((item) => String(item.id) === groupId);
    if (!group) { setError('Testin hansı qrup üçün olduğunu seçin.'); return; }
    if (!title.trim() || !description.trim()) { setError('Testin adı və təsviri boş ola bilməz.'); return; }
    const problemIndex = drafts.findIndex((draft) => draftProblem(draft));
    if (problemIndex >= 0) { setError(`${problemIndex + 1}-ci sual: ${draftProblem(drafts[problemIndex])}`); return; }
    setSaving(true);
    setError(null);
    try {
      await api(getToken, '/api/admin/exams', {
        method: 'POST',
        body: {
          resourceId: group.id,
          title: title.trim().slice(0, 200),
          description: description.trim().slice(0, 12000),
          status: 'closed', // qaralama: tələbələr görmür, müəllim özü açır
          isOnboarding: false,
          language: 'ar',
          durationMinutes: null,
          questions: drafts.slice(0, 50).map((draft) => draft.type === 'choice'
            ? { type: 'choice', prompt: draft.prompt.trim(), options: draft.options.map((option) => option.trim()), correctOptionIndex: draft.correctOptionIndex, maxPoints: null, modelAnswer: null }
            : { type: 'open', prompt: draft.prompt.trim(), options: [], correctOptionIndex: 0, maxPoints: Math.min(100, Math.max(1, Math.round(draft.maxPoints) || 5)), modelAnswer: draft.modelAnswer.trim().slice(0, 4000) || null }),
        },
      });
      setSaved({ title: title.trim(), group: groupLabel(group), questions: Math.min(50, drafts.length), open: drafts.slice(0, 50).filter((draft) => draft.type !== 'choice').length });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Test yadda saxlanmadı.');
    } finally {
      setSaving(false);
    }
  }

  const choiceCount = drafts?.filter((draft) => draft.type === 'choice').length ?? 0;
  const openCount = (drafts?.length ?? 0) - choiceCount;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#121010]/[.98] text-[#f4ead5]" role="dialog" aria-label="Test hazırla" data-testid="panel-ai-test-builder">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#e3c27a]/20 px-3 py-3 pt-[max(.75rem,env(safe-area-inset-top))] sm:px-5">
        <div className="min-w-0">
          <p className="font-serif text-lg leading-none">Test <span style={{ color: gold }}>hazırla</span></p>
          <p className="mt-1 truncate text-[11px] text-[#f4ead5]/55">Kitabxanadakı kitabın mətnindən · ərəbcə · qaralama kimi saxlanılır</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full border border-[#e3c27a]/30 p-2 text-[#f4ead5]/80 hover:border-[#e3c27a]/70" aria-label="Bağla" data-testid="button-test-builder-close"><X size={15} /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
        <div className="mx-auto max-w-3xl space-y-4">
          <section className="space-y-3 rounded-2xl border border-[#e3c27a]/25 bg-white/[.03] p-3 sm:p-4" data-testid="form-test-builder">
            <div>
              <span className={label}>Kitab</span>
              <select value={slug} onChange={(event) => setSlug(event.target.value)} className={field} data-testid="select-test-book">
                {config.books.map((item) => <option key={item.slug} value={item.slug}>{item.title} ({item.shortTitle}){item.hasText ? '' : ' — mətn yoxdur'}</option>)}
              </select>
              {book && !book.hasText && <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-200"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> Bu kitab skan edilmiş PDF-dir, mətn qatı yoxdur. Test yalnız mətni oxuna bilən kitablardan hazırlanır.</p>}
            </div>

            <div>
              <div className="mb-1 flex items-center gap-1.5">
                {(['chapter', 'pages'] as const).map((value) => (
                  <button key={value} type="button" onClick={() => setRangeMode(value)} className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${rangeMode === value ? 'bg-[#e3c27a] text-[#17130c]' : 'border border-[#e3c27a]/30 text-[#f4ead5]/70'}`} data-testid={`button-test-range-${value}`}>
                    {value === 'chapter' ? 'Bab (mündəricat)' : 'Səhifə aralığı'}
                  </button>
                ))}
              </div>
              {rangeMode === 'chapter' ? (
                <select value={chapterIndex} onChange={(event) => setChapterIndex(event.target.value)} className={field} dir="auto" style={{ fontFamily: arabicFont }} data-testid="select-test-chapter">
                  <option value="">— Bab seçin —</option>
                  {chapters.map((chapter) => <option key={chapter.index} value={chapter.index}>{chapter.level > 1 ? '   ' : ''}{chapter.title} — s. {chapter.printedPage}</option>)}
                </select>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="numeric" min={printedMin} max={printedMax} value={fromPage} onChange={(event) => setFromPage(event.target.value)} placeholder="s. -dan" className={field} data-testid="input-test-from" />
                  <span className="text-[#f4ead5]/50">–</span>
                  <input type="number" inputMode="numeric" min={printedMin} max={printedMax} value={toPage} onChange={(event) => setToPage(event.target.value)} placeholder="s. -dək" className={field} data-testid="input-test-to" />
                </div>
              )}
              <p className="mt-1 text-[11px] text-[#f4ead5]/45">Səhifələr kitabın çap nömrəsi ilədir (oxucudakı «s. N»). Ən çox {config.maxRangePages} səhifə.</p>
            </div>

            <div>
              <span className={label}>Mövzu (istəyə görə)</span>
              <input value={topic} onChange={(event) => setTopic(event.target.value.slice(0, 100))} dir="auto" placeholder="məs. dəstəmazı pozan şeylər, نواقض الوضوء, fail" className={field} data-testid="input-test-topic" />
              <p className="mt-1 text-[11px] text-[#f4ead5]/45">Bab və səhifə seçilməyibsə, mövzunun keçdiyi bab avtomatik tapılır.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[auto,1fr]">
              <div>
                <span className={label}>Sual sayı</span>
                <div className="flex gap-1.5">
                  {config.counts.map((value) => (
                    <button key={value} type="button" onClick={() => setCount(value)} className={`h-9 w-11 rounded-xl text-sm font-bold transition ${count === value ? 'bg-[#e3c27a] text-[#17130c]' : 'border border-[#e3c27a]/30 text-[#f4ead5]/75'}`} data-testid={`button-test-count-${value}`}>{value}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className={label}>Sual növləri</span>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_KINDS.map((kind) => (
                    <label key={kind} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition ${kinds.includes(kind) ? 'border-[#e3c27a] bg-[#e3c27a]/15 text-[#f3dca6]' : 'border-[#e3c27a]/25 text-[#f4ead5]/60'}`}>
                      <input type="checkbox" checked={kinds.includes(kind)} onChange={() => toggleKind(kind)} className="accent-[#e3c27a]" data-testid={`checkbox-test-kind-${kind}`} />
                      {KIND_LABELS[kind]}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button type="button" onClick={() => void generate()} disabled={generating || !book} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#f3dca6] to-[#c49a4c] px-4 py-2.5 text-sm font-bold text-[#17130c] disabled:opacity-50 sm:w-auto" data-testid="button-test-generate">
              {generating ? <Loader2 size={15} className="animate-spin" /> : <ClipboardCheck size={15} />} {drafts ? 'Yenidən hazırla' : 'Testi hazırla'}
            </button>
          </section>

          {error && <p className="rounded-xl border border-red-400/40 bg-red-950/40 px-3 py-2 text-sm text-red-100" role="alert" data-testid="text-test-builder-error">{error}</p>}

          {drafts && (
            <section className="space-y-3" data-testid="list-test-preview">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-bold">Önizləmə · {drafts.length} sual <span className="font-normal text-[#f4ead5]/55">({choiceCount} seçimli, {openCount} açıq)</span></p>
                <p className="text-[11px] text-[#f4ead5]/50">Hər sualı redaktə edə, yeniləyə və ya silə bilərsiniz.</p>
              </div>
              {warnings.map((warning) => <p key={warning} className="flex items-start gap-1.5 rounded-xl border border-amber-300/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {warning}</p>)}
              {drafts.map((draft, index) => (
                <article key={`${draft.key}-${index}`} className="rounded-2xl border border-[#e3c27a]/25 bg-white/[.03] p-3 sm:p-4" data-testid={`card-test-question-${index}`}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded-full bg-[#e3c27a]/15 px-2 py-0.5 font-bold text-[#f3dca6]">{index + 1}. {KIND_LABELS[draft.kind]}</span>
                      <span className="text-[#f4ead5]/55">s. {draft.printedPage}{draft.chapterTitle ? ' · ' : ''}</span>
                      {draft.chapterTitle && <span dir="rtl" lang="ar" className="truncate text-[#f4ead5]/55" style={{ fontFamily: arabicFont }}>{draft.chapterTitle}</span>}
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => void regenerate(index)} disabled={busyKey !== null} className="inline-flex items-center gap-1 rounded-lg border border-[#e3c27a]/30 px-2 py-1 text-[11px] font-semibold text-[#f4ead5]/80 hover:border-[#e3c27a]/70 disabled:opacity-40" data-testid={`button-test-regenerate-${index}`}>
                        {busyKey === draft.key ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Yenilə
                      </button>
                      <button type="button" onClick={() => setDrafts((list) => list && list.filter((_, position) => position !== index))} className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 px-2 py-1 text-[11px] font-semibold text-red-200 hover:border-red-400/70" data-testid={`button-test-remove-${index}`}>
                        <Trash2 size={12} /> Sil
                      </button>
                    </div>
                  </div>
                  <textarea value={draft.prompt} onChange={(event) => update(index, { prompt: event.target.value.slice(0, 2000) })} dir="rtl" lang="ar" rows={Math.min(6, Math.max(2, Math.ceil(draft.prompt.length / 70)))} className={`${field} resize-y`} style={arabicField} aria-label={`${index + 1}-ci sualın mətni`} />
                  {draft.type === 'choice' ? (
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2" dir="rtl">
                      {draft.options.map((option, optionIndex) => (
                        <div key={optionIndex} className={`flex items-center gap-2 rounded-xl border px-2 py-1 ${draft.correctOptionIndex === optionIndex ? 'border-emerald-400/60 bg-emerald-900/20' : 'border-[#e3c27a]/20'}`}>
                          <input type="radio" name={`correct-${index}`} checked={draft.correctOptionIndex === optionIndex} onChange={() => update(index, { correctOptionIndex: optionIndex })} className="shrink-0 accent-emerald-400" aria-label={`${optionIndex + 1}-ci variant düzgündür`} />
                          <input value={option} onChange={(event) => update(index, { options: draft.options.map((item, position) => (position === optionIndex ? event.target.value.slice(0, 500) : item)) })} dir="rtl" lang="ar" className="min-w-0 flex-1 bg-transparent py-1 text-sm text-[#f4ead5] outline-none" style={arabicField} aria-label={`${optionIndex + 1}-ci variant`} />
                          {draft.options.length > 2 && draft.kind !== 'truefalse' && (
                            <button type="button" onClick={() => update(index, { options: draft.options.filter((_, position) => position !== optionIndex), correctOptionIndex: draft.correctOptionIndex === optionIndex ? 0 : draft.correctOptionIndex > optionIndex ? draft.correctOptionIndex - 1 : draft.correctOptionIndex })} className="shrink-0 text-[#f4ead5]/40 hover:text-red-200" aria-label="Variantı sil"><X size={12} /></button>
                          )}
                        </div>
                      ))}
                      {draft.options.length < 8 && draft.kind !== 'truefalse' && (
                        <button type="button" onClick={() => update(index, { options: [...draft.options, ''] })} className="inline-flex items-center justify-center gap-1 rounded-xl border border-dashed border-[#e3c27a]/30 px-2 py-1.5 text-[11px] text-[#f4ead5]/60" dir="ltr"><Plus size={12} /> Variant</button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      <label className="flex items-center gap-2 text-[11px] text-[#f4ead5]/60">Bal
                        <input type="number" min={1} max={100} value={draft.maxPoints} onChange={(event) => update(index, { maxPoints: Number(event.target.value) })} className="w-16 rounded-lg border border-[#e3c27a]/30 bg-black/40 px-2 py-1 text-sm text-[#f4ead5]" />
                      </label>
                      <details className="rounded-xl border border-dashed border-[#e3c27a]/25 p-2">
                        <summary className="cursor-pointer text-[11px] font-bold text-[#f3dca6]">Nümunə cavab (yalnız müəllim görür)</summary>
                        <textarea value={draft.modelAnswer} onChange={(event) => update(index, { modelAnswer: event.target.value.slice(0, 4000) })} dir="rtl" lang="ar" rows={5} className={`${field} mt-1.5 resize-y`} style={arabicField} aria-label="Nümunə cavab" />
                      </details>
                    </div>
                  )}
                  {draftProblem(draft) && <p className="mt-1.5 text-[11px] text-amber-200">{draftProblem(draft)}</p>}
                </article>
              ))}

              {drafts.length > 0 ? (
                <div className="space-y-3 rounded-2xl border border-[#e3c27a]/40 bg-[#1c1812] p-3 sm:p-4" data-testid="panel-test-save">
                  <p className="text-sm font-bold">Testi yadda saxla</p>
                  {config.groups.length === 0 ? (
                    <p className="text-xs text-amber-200">Sizə bağlı müəllim qrupu tapılmadı. Test yalnız öz qrupunuz üçün yaradıla bilər.</p>
                  ) : (
                    <>
                      <div>
                        <span className={label}>Qrup / semestr</span>
                        <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className={field} data-testid="select-test-group">
                          <option value="">— Qrup seçin —</option>
                          {config.groups.map((group) => <option key={group.id} value={group.id}>{groupLabel(group)}</option>)}
                        </select>
                      </div>
                      <div>
                        <span className={label}>Testin adı</span>
                        <input value={title} onChange={(event) => setTitle(event.target.value.slice(0, 200))} dir="auto" className={field} style={{ fontFamily: `"DM Sans", ${arabicFont}` }} data-testid="input-test-title" />
                      </div>
                      <div>
                        <span className={label}>Təsvir</span>
                        <textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 12000))} dir="auto" rows={2} className={`${field} resize-y`} style={{ fontFamily: `"DM Sans", ${arabicFont}` }} data-testid="input-test-description" />
                      </div>
                      <p className="text-[11px] leading-5 text-[#f4ead5]/55">Testin dili: Ərəbcə. Test <b>bağlı (qaralama)</b> saxlanılır — tələbələr görmür. Yoxlayıb hazır olanda Admin paneldəki «İmtahan və testlər» bölməsindən açın.</p>
                      <button type="button" onClick={() => void save()} disabled={saving || Boolean(saved)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#f3dca6] to-[#c49a4c] px-4 py-2.5 text-sm font-bold text-[#17130c] disabled:opacity-50 sm:w-auto" data-testid="button-test-save">
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Testi yadda saxla
                      </button>
                    </>
                  )}
                  {saved && (
                    <div data-testid="text-test-saved">
                      <AiAnswerCard
                        testId="ai-test-saved-card"
                        frame={frameOf('exam', { title: 'Test yadda saxlanıldı', badge: { text: 'qaralama', tone: 'good' } })}
                        blocks={[
                          { type: 'card', rows: [
                            { label: 'Test', value: saved.title },
                            { label: 'Qrup', value: saved.group },
                            { label: 'Sual sayı', value: saved.open ? `${saved.questions} (${saved.open} açıq sual)` : String(saved.questions) },
                            { label: 'Vəziyyət', value: 'bağlı — tələbələr görmür' },
                          ] },
                          { type: 'text', tone: 'muted', text: '«İmtahan və testlər» bölməsində yoxlayıb tələbələr üçün açın.' },
                        ]}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#f4ead5]/55">Bütün suallar silindi. «Yenidən hazırla» düyməsi ilə yeni suallar alın.</p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
