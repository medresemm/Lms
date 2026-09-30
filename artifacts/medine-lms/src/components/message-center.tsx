import { useEffect, useState } from 'react';
import { Mail, Reply, Send, Trash2, UserRound } from 'lucide-react';

type Message = {
  id: number;
  senderClerkUserId: string;
  recipientClerkUserId: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  senderUsername: string | null;
  senderStudentNumber: number | null;
  senderProgram: string | null;
  senderCourseYear: number | null;
  senderSemester: number | null;
  recipientName: string;
  subject: string;
  body: string;
  parentMessageId: number | null;
  readAt: string | null;
  deletedAt?: string | null;
  createdAt: string;
};

type Teacher = { clerkUserId: string; firstName: string; lastName: string; displayName: string };

const apiUrl = (path: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api${path}`;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('az-AZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function MessageThread({
  selected,
  messages,
  staff,
  isEditing,
  editBody,
  reply,
  onToggleEdit,
  onEditBodyChange,
  onEdit,
  onReplyChange,
  onReply,
  onDelete,
}: {
  selected: Message;
  messages: Message[];
  staff: boolean;
  isEditing: boolean;
  editBody: string;
  reply: string;
  onToggleEdit: () => void;
  onEditBodyChange: (value: string) => void;
  onEdit: (event: React.FormEvent) => void;
  onReplyChange: (value: string) => void;
  onReply: (event: React.FormEvent) => void;
  onDelete: () => void;
}) {
  const thread = messages
    .filter((message) => message.id === selected.id || message.parentMessageId === selected.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="mt-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5" data-testid={`thread-${selected.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--secondary-foreground))]">{staff ? 'Söhbət' : 'Müəllimlə söhbət'}</p>
          <h4 className="mt-1 font-serif text-2xl text-[hsl(var(--primary))]">{staff ? selected.senderName : selected.recipientName}</h4>
          {staff && <div className="mt-2 space-y-1 text-xs text-[hsl(var(--muted-foreground))]">
            <p className="flex items-center gap-2"><UserRound size={14} /> {selected.senderEmail} {selected.senderPhone && `· ${selected.senderPhone}`}</p>
            {(selected.senderStudentNumber !== null || selected.senderProgram || selected.senderCourseYear !== null || selected.senderSemester !== null) && (
              <p>Tələbə № {selected.senderStudentNumber ?? '—'} · {selected.senderProgram ?? 'Proqram qeyd edilməyib'} · {selected.senderCourseYear ?? '—'}-cü il · {selected.senderSemester ?? '—'}-ci semestr</p>
            )}
          </div>}
        </div>
        <div className="flex items-center gap-1">
          {!staff && selected.parentMessageId === null && <button type="button" onClick={onToggleEdit} className="focus-ring rounded-lg px-3 py-2 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="button-edit-message">{isEditing ? 'Ləğv et' : 'Redaktə et'}</button>}
          {staff && <button type="button" onClick={onDelete} className="focus-ring rounded-lg p-2 text-[hsl(var(--destructive))]" aria-label="Söhbəti sil"><Trash2 size={17} /></button>}
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {thread.map((item, index) => (
          <div key={item.id} className={`rounded-2xl p-4 ${index === 0 ? 'bg-[hsl(var(--secondary)/.42)]' : 'bg-[hsl(var(--muted)/.55)]'}`} data-testid={`thread-message-${item.id}`}>
            <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-[hsl(var(--primary))]">{item.senderName}</p><p className="text-[10px] text-[hsl(var(--muted-foreground))]">{dateLabel(item.createdAt)}</p></div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[hsl(var(--foreground))]">{item.body}</p>
            {!staff && <p className="mt-2 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">{item.readAt ? 'Oxunub' : 'Göndərilib'}</p>}
            {!staff && item.id === selected.id && isEditing && <form onSubmit={onEdit} className="mt-3 border-t border-[hsl(var(--border))] pt-3"><textarea required rows={4} value={editBody} onChange={(event) => onEditBodyChange(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 text-sm" data-testid="textarea-edit-message" /><button type="submit" className="focus-ring mt-3 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]" data-testid="button-save-message-edit"><Send size={15} /> Yadda saxla</button></form>}
          </div>
        ))}
      </div>
      {staff && <form onSubmit={onReply} className="mt-5 border-t border-[hsl(var(--border))] pt-4"><textarea required rows={3} value={reply} onChange={(event) => onReplyChange(event.target.value)} className="focus-ring w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 text-sm" placeholder="Cavabınızı yazın..." /><button type="submit" className="focus-ring mt-3 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]"><Reply size={15} /> Cavab yaz</button></form>}
    </div>
  );
}

export function MessageCenter({ staff = false, onUnreadCountChange }: { staff?: boolean; onUnreadCountChange?: (count: number) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [recipient, setRecipient] = useState('');
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');
  const [editBody, setEditBody] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [messageResponse, teacherResponse] = await Promise.all([
        fetch(apiUrl('/messages'), { cache: 'no-store' }),
        !staff ? fetch(apiUrl('/teachers'), { cache: 'no-store' }) : Promise.resolve(null),
      ]);
      if (!messageResponse.ok) throw new Error('Mesajlar yüklənə bilmədi.');
      setMessages(await messageResponse.json() as Message[]);
       if (!teacherResponse?.ok && teacherResponse !== null) throw new Error('Müəllim siyahısı yüklənmədi.');
       if (teacherResponse?.ok) setTeachers(await teacherResponse.json() as Teacher[]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Mesajlar yüklənə bilmədi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [staff]);
  useEffect(() => {
    const interval = window.setInterval(() => { void load(); }, 15000);
    return () => window.clearInterval(interval);
  }, [staff]);

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice('');
    if (!recipient || !body.trim()) { setNotice('Müəllim və mesaj mətni tələb olunur.'); return; }
    const response = await fetch(apiUrl('/messages'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientClerkUserId: recipient, body: body.trim() }) });
    const result = await response.json() as Message & { error?: string };
    if (!response.ok) { setNotice(result.error || 'Mesaj göndərilə bilmədi.'); return; }
    setBody('');
    setRecipient('');
    setNotice('Mesaj göndərildi.');
    await load();
  };

  const openMessage = async (message: Message | null) => {
    if (!message) {
      setSelected(null);
      setIsEditing(false);
      return;
    }
    setSelected(message);
    setReply('');
    setIsEditing(false);
    setEditBody(message.body);
    if (!message.readAt && staff) {
      const response = await fetch(apiUrl(`/messages/${message.id}/read`), { method: 'PATCH' });
      if (response.ok) {
        setMessages((items) => items.map((item) => item.id === message.id ? { ...item, readAt: new Date().toISOString() } : item));
      } else {
        setNotice('Mesajı oxunmuş kimi qeyd etmək mümkün olmadı.');
      }
    }
    if (!staff) {
      const unreadReplies = messages.filter((item) => item.parentMessageId === message.id && !item.readAt);
      if (unreadReplies.length) {
        const responses = await Promise.all(unreadReplies.map((item) => fetch(apiUrl(`/messages/${item.id}/read`), { method: 'PATCH' })));
        const readAt = new Date().toISOString();
        const successfulIds = new Set(unreadReplies.filter((_, index) => responses[index]?.ok).map((item) => item.id));
        setMessages((items) => items.map((item) => successfulIds.has(item.id) ? { ...item, readAt } : item));
        if (successfulIds.size !== unreadReplies.length) setNotice('Bəzi cavabları oxunmuş kimi qeyd etmək mümkün olmadı.');
      }
    }
  };

  const editMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (!editBody.trim()) { setNotice('Mesaj mətni boş ola bilməz.'); return; }
    const response = await fetch(apiUrl(`/messages/${selected.id}`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: editBody.trim() }) });
    const result = await response.json() as Message & { error?: string };
    if (!response.ok) { setNotice(result.error || 'Mesaj redaktə edilə bilmədi.'); return; }
    setMessages((items) => items.map((item) => item.id === selected.id ? result : item));
    setSelected(result);
    setIsEditing(false);
    setNotice('Mesaj redaktə edildi.');
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (!reply.trim()) { setNotice('Cavab mətni boş ola bilməz.'); return; }
    const response = await fetch(apiUrl(`/messages/${selected.id}/reply`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: reply.trim() }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setNotice(result.error || 'Cavab göndərilə bilmədi.'); return; }
    setReply('');
    setNotice('Cavab göndərildi.');
    await load();
  };

  const unreadCount = messages.filter((message) => !message.readAt && (staff ? message.parentMessageId === null : message.parentMessageId !== null)).length;
  const threadMessages = (messageId: number) => messages.filter((message) => message.id === messageId || message.parentMessageId === messageId);
  const hasUnreadReply = (messageId: number) => messages.some((message) => message.parentMessageId === messageId && !message.readAt);
  const rootMessages = messages.filter((message) => message.parentMessageId === null).sort((a, b) => {
    const unreadOrder = Number(hasUnreadReply(b.id)) - Number(hasUnreadReply(a.id));
    return unreadOrder || b.createdAt.localeCompare(a.createdAt);
  });

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [onUnreadCountChange, unreadCount]);

  const deleteMessage = async () => {
    if (!selected) return;
    const response = await fetch(apiUrl(`/messages/${selected.id}`), { method: 'DELETE' });
    if (!response.ok) { setNotice('Mesaj silinə bilmədi.'); return; }
    setMessages((items) => items.filter((item) => item.id !== selected.id));
    setSelected(null);
    setNotice('Mesaj silindi.');
  };

  return (
    <section className="space-y-5" data-testid="section-message-center">
      <div>
        <p className="flex items-center gap-2 font-serif text-2xl font-bold leading-tight tracking-[-.02em] text-[hsl(var(--primary))] sm:text-3xl"><Mail size={21} /> Məsləhətləşmə / Əlaqə {staff && unreadCount > 0 && <span className="inline-flex rounded-full bg-red-600 px-2 py-1 align-middle font-sans text-xs font-black text-white">{unreadCount}</span>}</p>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{staff ? 'Tələbələrdən gələn mesajları oxuyun və cavablandırın.' : 'Müəllim heyəti ilə əlaqə saxlayın.'}</p>
      </div>
      {!staff && <form onSubmit={sendMessage} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <select required value={recipient} onChange={(event) => setRecipient(event.target.value)} className="focus-ring rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 text-sm" data-testid="select-message-teacher">
            <option value="">Müəllim seçin</option>
             {teachers.map((teacher) => <option key={teacher.clerkUserId} value={teacher.clerkUserId}>{teacher.displayName}</option>)}
          </select>
          <textarea required rows={3} value={body} onChange={(event) => setBody(event.target.value)} className="focus-ring rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 text-sm" placeholder="Mesajınızı yazın..." data-testid="textarea-new-message" />
        </div>
        <button type="submit" className="focus-ring mt-3 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]"><Send size={15} /> Göndər</button>
      </form>}
      {notice && <p className="rounded-xl bg-[hsl(var(--secondary)/.35)] p-3 text-sm font-semibold text-[hsl(var(--secondary-foreground))]">{notice}</p>}
       {loading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Mesajlar yüklənir...</p> : !messages.length ? <p className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Hələ mesaj yoxdur.</p> : <div className="grid gap-4">
         <div className="space-y-2">{rootMessages.map((message) => { const unread = staff ? !message.readAt : hasUnreadReply(message.id); const preview = staff ? message : [...threadMessages(message.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? message; const previewName = !staff && preview.id !== message.id ? preview.senderName : staff ? message.senderName : message.recipientName; return <div key={message.id}><button type="button" onClick={() => void openMessage(message.id === selected?.id ? null : message)} className={`focus-ring w-full rounded-xl border p-3 text-left ${unread ? 'border-red-300 bg-red-50/60' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`} data-testid={`button-message-${message.id}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-[hsl(var(--primary))]">{previewName}</p><p className="mt-1 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">{preview.body}</p></div>{unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-600" />}</div><p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">{dateLabel(preview.createdAt)}</p></button>{selected?.id === message.id && selected && <MessageThread selected={selected} messages={messages} staff={staff} isEditing={isEditing} editBody={editBody} reply={reply} onToggleEdit={() => { setIsEditing((value) => !value); setEditBody(selected.body); }} onEditBodyChange={setEditBody} onEdit={(event) => void editMessage(event)} onReplyChange={setReply} onReply={(event) => void sendReply(event)} onDelete={() => void deleteMessage()} />}</div>; })}</div>
       </div>}
    </section>
  );
}