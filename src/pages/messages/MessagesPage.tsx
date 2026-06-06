import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Plus, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { User } from '@/types';
import { useAppStore } from '@/store';
import {
  messageService,
  type MessageThread,
  type ThreadMessage,
  type MessageAudience,
} from '@/services/messageService';

const AUDIENCE_LABELS: Record<MessageAudience, string> = {
  all_teachers: 'All teachers',
  all_parents: 'All parents',
  class_parents: 'Class parents',
  direct: 'Direct',
  school_admin: 'School admin',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

export default function MessagesPage() {
  const { user } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const schoolId = user?.schoolId;
  const userId = user?.id;
  const role = user?.role;

  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() => searchParams.get('thread'));
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  const loadInbox = useCallback(
    async (pickFirstIfEmpty = false) => {
      if (!schoolId || !userId || !role) return [];
      const { threads: list, error } = await messageService.listInbox(schoolId, userId, role);
      if (error) {
        setSetupError(error);
        setThreads([]);
        return [];
      }
      setSetupError(null);
      setThreads(list);
      if (pickFirstIfEmpty) {
        setActiveId((current) => current ?? list[0]?.id ?? null);
      }
      return list;
    },
    [schoolId, userId, role]
  );

  const loadMessages = useCallback(
    async (threadId: string) => {
      const rows = await messageService.getMessages(threadId);
      setMessages(rows);
      if (schoolId && userId) {
        await messageService.markRead(schoolId, threadId, userId);
      }
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, unread: false } : t))
      );
    },
    [schoolId, userId]
  );

  // Open thread from URL (e.g. notification link)
  useEffect(() => {
    const fromUrl = searchParams.get('thread');
    if (fromUrl) {
      setActiveId((current) => (current === fromUrl ? current : fromUrl));
    }
  }, [searchParams]);

  // Initial inbox load once
  useEffect(() => {
    if (!schoolId || !userId || !role) {
      setLoading(false);
      return;
    }
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    setLoading(true);
    void loadInbox(true).finally(() => setLoading(false));
  }, [schoolId, userId, role, loadInbox]);

  // Load conversation when active thread changes (no full-page reload)
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }

    void loadMessages(activeId);

    setSearchParams(
      (prev) => {
        if (prev.get('thread') === activeId) return prev;
        const next = new URLSearchParams(prev);
        next.set('thread', activeId);
        return next;
      },
      { replace: true }
    );
  }, [activeId, loadMessages, setSearchParams]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime updates (optional — page still works without it)
  useEffect(() => {
    if (!schoolId || setupError) return;

    const channel = supabase
      .channel(`school-messages:${schoolId}:${userId ?? 'anon'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'thread_messages',
          filter: `school_id=eq.${schoolId}`,
        },
        () => {
          if (activeId) void loadMessages(activeId);
          void loadInbox(false);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [schoolId, userId, activeId, loadMessages, loadInbox, setupError]);

  const activeThread = threads.find((t) => t.id === activeId);

  const handleSend = async () => {
    if (!draft.trim() || !activeId || !schoolId || !userId || !role || !user) return;
    setSending(true);
    const result = await messageService.reply(
      schoolId,
      activeId,
      userId,
      role,
      user.fullName,
      draft,
      activeThread
    );
    setSending(false);
    if (result.success) {
      setDraft('');
      await loadMessages(activeId);
      await loadInbox(false);
    }
  };

  const canCompose = role === 'admin' || role === 'parent';

  if (!user || !schoolId) {
    return <p className="text-secondary-text">Sign in to view messages.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-7 h-7" />
            Messages
          </h1>
          <p className="text-secondary-text text-sm mt-1">
            School announcements and direct replies.
          </p>
        </div>
        {canCompose && !setupError && (
          <button type="button" onClick={() => setShowCompose(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New message
          </button>
        )}
      </div>

      {setupError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-100">
          {setupError}
        </div>
      )}

      <div className="card !p-0 overflow-hidden flex flex-col md:flex-row min-h-[480px] max-h-[calc(100vh-12rem)]">
        <div className="md:w-80 border-b md:border-b-0 md:border-r border-border dark:border-gray-800 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-border dark:border-gray-800 font-semibold text-sm">
            Inbox ({threads.filter((t) => t.unread).length} new)
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : threads.length === 0 ? (
              <p className="text-sm text-secondary-text p-4">
                {setupError ? 'Messaging is not available yet.' : 'No messages yet.'}
              </p>
            ) : (
              threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveId(t.id)}
                  className={`w-full text-left px-4 py-3 border-b border-border/50 dark:border-gray-800/50 hover:bg-secondary-bg/50 transition-colors ${
                    activeId === t.id ? 'bg-secondary-bg dark:bg-dark-card' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm truncate ${t.unread ? 'font-bold' : 'font-medium'}`}>{t.subject}</p>
                    {t.unread && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-xs text-secondary-text truncate mt-0.5">{t.lastMessagePreview}</p>
                  <p className="text-[10px] text-secondary-text mt-1">
                    {AUDIENCE_LABELS[t.audience] ?? t.audience} · {formatTime(t.lastMessageAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {activeThread ? (
            <>
              <div className="px-4 py-3 border-b border-border dark:border-gray-800">
                <h2 className="font-semibold">{activeThread.subject}</h2>
                <p className="text-xs text-secondary-text">
                  {AUDIENCE_LABELS[activeThread.audience] ?? activeThread.audience}
                  {activeThread.createdByName ? ` · started by ${activeThread.createdByName}` : ''}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => {
                  const mine = m.senderId === userId;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? 'bg-black text-white dark:bg-white dark:text-black rounded-br-md'
                            : 'bg-secondary-bg dark:bg-dark-card rounded-bl-md'
                        }`}
                      >
                        {!mine && (
                          <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.senderName}</p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`text-[10px] mt-1 ${mine ? 'opacity-70' : 'text-secondary-text'}`}>
                          {formatTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="p-3 border-t border-border dark:border-gray-800 flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Type a reply…"
                  className="input-field flex-1"
                  maxLength={2000}
                  disabled={!!setupError}
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending || !draft.trim() || !!setupError}
                  className="btn-primary px-4 flex items-center gap-1"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-secondary-text text-sm">
              {setupError ? 'Apply the messaging migration to use this page.' : 'Select a conversation'}
            </div>
          )}
        </div>
      </div>

      {showCompose && user && schoolId && (
        <ComposeModal
          schoolId={schoolId}
          user={user}
          onClose={() => setShowCompose(false)}
          onSent={async (threadId) => {
            setShowCompose(false);
            await loadInbox(false);
            setActiveId(threadId);
          }}
        />
      )}
    </div>
  );
}

function ComposeModal({
  schoolId,
  user,
  onClose,
  onSent,
}: {
  schoolId: string;
  user: User;
  onClose: () => void;
  onSent: (threadId: string) => void;
}) {
  const isAdmin = user.role === 'admin';
  const [audience, setAudience] = useState<MessageAudience>(
    isAdmin ? 'all_teachers' : 'school_admin'
  );
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [classId, setClassId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [childId, setChildId] = useState(user.children?.[0]?.id ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const [teachers, setTeachers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [parents, setParents] = useState<Array<{ id: string; name: string }>>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (isAdmin) {
      void messageService.listTeachers(schoolId).then(setTeachers);
      void messageService.listParents(schoolId).then(setParents);
      void messageService.listClasses(schoolId).then(setClasses);
    }
  }, [schoolId, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);

    let targetUserId: string | undefined;
    let targetRole: User['role'] | undefined;
    const resolvedClassId = classId || undefined;
    let studentId = childId || undefined;

    if (user.role === 'parent') {
      if (audience === 'direct' && childId) {
        const teacher = await messageService.getClassTeacherForStudent(schoolId, childId);
        if (!teacher) {
          setError('No class teacher assigned for this child.');
          setSending(false);
          return;
        }
        targetUserId = teacher.teacherId;
        targetRole = 'teacher';
        studentId = childId;
      }
    } else if (audience === 'direct') {
      const isTeacher = teachers.some((t) => t.id === targetId);
      targetUserId = targetId;
      targetRole = isTeacher ? 'teacher' : 'parent';
    }

    const result = await messageService.createThread({
      schoolId,
      subject,
      audience: user.role === 'parent' && audience !== 'school_admin' ? 'direct' : audience,
      body,
      senderId: user.id,
      senderRole: user.role,
      senderName: user.fullName,
      classId: audience === 'class_parents' ? resolvedClassId : undefined,
      targetUserId,
      targetRole,
      studentId,
    });

    setSending(false);
    if (!result.success || !result.threadId) {
      setError(result.error ?? 'Failed to send');
      return;
    }
    onSent(result.threadId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-lg bg-white dark:bg-dark-bg rounded-2xl shadow-xl">
        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          <h2 className="text-xl font-bold">New message</h2>

          {isAdmin ? (
            <div>
              <label className="label mb-1 block">Send to</label>
              <select
                className="input-field w-full"
                value={audience}
                onChange={(e) => setAudience(e.target.value as MessageAudience)}
              >
                <option value="all_teachers">All teachers</option>
                <option value="all_parents">All parents</option>
                <option value="class_parents">Parents in a class</option>
                <option value="direct">One person</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="label mb-1 block">Send to</label>
              <select
                className="input-field w-full"
                value={audience}
                onChange={(e) => setAudience(e.target.value as MessageAudience)}
              >
                <option value="school_admin">School administration</option>
                <option value="direct">My child&apos;s class teacher</option>
              </select>
            </div>
          )}

          {isAdmin && audience === 'class_parents' && (
            <div>
              <label className="label mb-1 block">Class</label>
              <select className="input-field w-full" value={classId} onChange={(e) => setClassId(e.target.value)} required>
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {isAdmin && audience === 'direct' && (
            <div>
              <label className="label mb-1 block">Recipient</label>
              <select className="input-field w-full" value={targetId} onChange={(e) => setTargetId(e.target.value)} required>
                <option value="">Select recipient</option>
                <optgroup label="Teachers">
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </optgroup>
                <optgroup label="Parents">
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          {!isAdmin && audience === 'direct' && (user.children?.length ?? 0) > 0 && (
            <div>
              <label className="label mb-1 block">Regarding child</label>
              <select className="input-field w-full" value={childId} onChange={(e) => setChildId(e.target.value)} required>
                {user.children!.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                    {c.className ? ` (${c.className})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label mb-1 block">Subject</label>
            <input
              className="input-field w-full"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. PTA meeting Friday"
              required
              maxLength={120}
            />
          </div>

          <div>
            <label className="label mb-1 block">Message</label>
            <textarea
              className="input-field w-full min-h-[100px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your announcement…"
              required
              maxLength={2000}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={sending} className="btn-primary flex items-center gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
