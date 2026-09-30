import { useEffect, useState, type FormEvent } from 'react';
import { HelpCircle, Send } from 'lucide-react';

type Question = { id: number; title: string; body: string; answer: string | null; answeredByName: string | null; answeredAt: string | null; createdAt: string };
const apiUrl = (path: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api${path}`;

export async function loadUnansweredQuestionCount() {
  const response = await fetch(apiUrl('/questions'));
  if (!response.ok) return 0;
  const questions = await response.json() as Question[];
  return questions.filter((question) => !question.answer).length;
}

export function QaCenter({ canAsk = false, canAnswer = false, onUnansweredCountChange }: { canAsk?: boolean; canAnswer?: boolean; onUnansweredCountChange?: (count: number) => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState('');
  const load = async () => {
    const response = await fetch(apiUrl('/questions'));
    if (response.ok) {
      const nextQuestions = await response.json() as Question[];
      setQuestions(nextQuestions);
      onUnansweredCountChange?.(nextQuestions.filter((question) => !question.answer).length);
    }
  };
  useEffect(() => { void load(); }, []);
  const submitQuestion = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch(apiUrl('/questions'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body }) });
    const result = await response.json() as Question & { error?: string };
    if (!response.ok) { setNotice(result.error || 'Sual göndərilə bilmədi.'); return; }
    setTitle(''); setBody(''); setNotice('Sualınız göndərildi.'); await load();
  };
  const answerQuestion = async (question: Question) => {
    const answer = answers[question.id]?.trim();
    if (!answer) return;
    const response = await fetch(apiUrl(`/questions/${question.id}/answer`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setNotice(result.error || 'Cavab göndərilə bilmədi.'); return; }
    setAnswers((current) => ({ ...current, [question.id]: '' })); setNotice('Cavab yayımlandı.'); await load();
  };
  return <section className="space-y-5" data-testid="section-qa-center">
    <div><p className="flex items-center gap-2 font-serif text-3xl font-bold leading-tight tracking-[-.02em] text-[hsl(var(--secondary-foreground))] sm:text-4xl"><HelpCircle size={23} /> Sual-cavab {questions.some((question) => !question.answer) && <span className="rounded-full bg-red-600 px-2 py-0.5 font-sans text-xs font-black text-white" aria-label={`${questions.filter((question) => !question.answer).length} cavabsız sual`}>{questions.filter((question) => !question.answer).length}</span>}</p><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Suallar ümumi şəkildə verilir və müəllim heyəti tərəfindən cavablandırılır.</p></div>
    {canAsk && <form onSubmit={submitQuestion} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"><input required value={title} onChange={(event) => setTitle(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 text-sm" placeholder="Sual başlığı" data-testid="input-question-title" /><textarea required rows={3} value={body} onChange={(event) => setBody(event.target.value)} className="focus-ring mt-3 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 text-sm" placeholder="Sualınızı yazın..." data-testid="textarea-question-body" /><button type="submit" className="focus-ring mt-3 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]"><Send size={15} /> Sualı göndər</button></form>}
    {notice && <p className="rounded-xl bg-[hsl(var(--secondary)/.35)] p-3 text-sm font-semibold">{notice}</p>}
    {!questions.length ? <p className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Hələ sual verilməyib.</p> : <div className="space-y-3">{questions.map((question) => <article key={question.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"><h4 className="font-bold text-[hsl(var(--primary))]">{question.title}</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[hsl(var(--foreground))]">{question.body}</p>{question.answer ? <div className="mt-4 rounded-xl bg-[hsl(var(--secondary)/.35)] p-3"><p className="text-xs font-bold text-[hsl(var(--secondary-foreground))]">Cavablayan müəllim: {question.answeredByName || 'Müəllim'}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{question.answer}</p></div> : canAnswer ? <div className="mt-4"><textarea rows={2} value={answers[question.id] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 text-sm" placeholder="Cavabınızı yazın..." /><button type="button" onClick={() => void answerQuestion(question)} className="focus-ring mt-2 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]"><Send size={14} /> Cavablandır</button></div> : <p className="mt-3 text-xs font-semibold text-[hsl(var(--muted-foreground))]">Bu sual hələ cavablandırılmayıb.</p>}</article>)}</div>}
  </section>;
}