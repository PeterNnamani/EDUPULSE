import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';
import type { UserRole } from '@/types';

export type MessageAudience =
  | 'all_teachers'
  | 'all_parents'
  | 'class_parents'
  | 'direct'
  | 'school_admin';

export interface MessageThread {
  id: string;
  schoolId: string;
  subject: string;
  audience: MessageAudience;
  classId?: string | null;
  targetUserId?: string | null;
  targetRole?: string | null;
  studentId?: string | null;
  createdBy: string;
  createdByRole: string;
  createdByName: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  messageCount: number;
  unread?: boolean;
}

export interface ThreadMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export interface CreateThreadInput {
  schoolId: string;
  subject: string;
  audience: MessageAudience;
  body: string;
  senderId: string;
  senderRole: UserRole;
  senderName: string;
  classId?: string;
  targetUserId?: string;
  targetRole?: UserRole;
  studentId?: string;
}

const MAX_THREADS = 40;
const MAX_MESSAGES = 50;

function mapThread(row: Record<string, unknown>): MessageThread {
  return {
    id: row.id as string,
    schoolId: row.school_id as string,
    subject: row.subject as string,
    audience: row.audience as MessageAudience,
    classId: (row.class_id as string) ?? null,
    targetUserId: (row.target_user_id as string) ?? null,
    targetRole: (row.target_role as string) ?? null,
    studentId: (row.student_id as string) ?? null,
    createdBy: row.created_by as string,
    createdByRole: row.created_by_role as string,
    createdByName: row.created_by_name as string,
    lastMessageAt: row.last_message_at as string,
    lastMessagePreview: row.last_message_preview as string,
    messageCount: row.message_count as number,
  };
}

function mapMessage(row: Record<string, unknown>): ThreadMessage {
  return {
    id: row.id as string,
    threadId: row.thread_id as string,
    senderId: row.sender_id as string,
    senderRole: row.sender_role as string,
    senderName: row.sender_name as string,
    body: row.body as string,
    createdAt: row.created_at as string,
  };
}

async function getParentClassIds(schoolId: string, parentId: string): Promise<Set<string>> {
  const { data: links } = await supabase
    .from('student_parents')
    .select('student_id')
    .eq('parent_id', parentId);

  const studentIds = (links ?? []).map((l) => l.student_id).filter(Boolean);
  if (studentIds.length === 0) return new Set();

  const { data: students } = await supabase
    .from('students')
    .select('class_id')
    .eq('school_id', schoolId)
    .in('id', studentIds);

  return new Set((students ?? []).map((s) => s.class_id).filter(Boolean));
}

function canAccessThread(
  thread: MessageThread,
  userId: string,
  role: UserRole,
  parentClassIds: Set<string>
): boolean {
  if (thread.createdBy === userId) return true;
  if (thread.targetUserId === userId) return true;

  switch (thread.audience) {
    case 'all_teachers':
      return role === 'teacher';
    case 'all_parents':
      return role === 'parent';
    case 'school_admin':
      return role === 'admin';
    case 'class_parents':
      return role === 'parent' && !!thread.classId && parentClassIds.has(thread.classId);
    case 'direct':
      return thread.targetUserId === userId;
    default:
      return false;
  }
}

async function loadReadCursors(
  schoolId: string,
  userId: string,
  threadIds: string[]
): Promise<Map<string, string>> {
  if (threadIds.length === 0) return new Map();

  const { data } = await supabase
    .from('message_read_cursors')
    .select('thread_id, last_read_at')
    .eq('school_id', schoolId)
    .eq('user_id', userId)
    .in('thread_id', threadIds);

  return new Map((data ?? []).map((r) => [r.thread_id, r.last_read_at]));
}

function isMissingMessagingTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('message_threads') ||
    lower.includes('thread_messages') ||
    lower.includes('does not exist') ||
    lower.includes('schema cache')
  );
}

export const messageService = {
  async listInbox(
    schoolId: string,
    userId: string,
    role: UserRole
  ): Promise<{ threads: MessageThread[]; error?: string }> {
    const parentClasses = role === 'parent' ? await getParentClassIds(schoolId, userId) : new Set<string>();

    const { data, error } = await supabase
      .from('message_threads')
      .select('*')
      .eq('school_id', schoolId)
      .order('last_message_at', { ascending: false })
      .limit(MAX_THREADS * 2);

    if (error) {
      console.error('[MESSAGES] inbox error:', error.message);
      if (isMissingMessagingTableError(error.message)) {
        return {
          threads: [],
          error:
            'Messaging tables are not set up yet. Run migration 023_school_messaging.sql on your Supabase project.',
        };
      }
      return { threads: [], error: error.message };
    }

    const visible = (data ?? [])
      .map(mapThread)
      .filter((t) => canAccessThread(t, userId, role, parentClasses))
      .slice(0, MAX_THREADS);

    const cursors = await loadReadCursors(
      schoolId,
      userId,
      visible.map((t) => t.id)
    );

    const threads = visible.map((t) => {
      const lastRead = cursors.get(t.id);
      const unread =
        t.lastMessageAt > (lastRead ?? '1970-01-01T00:00:00Z') &&
        t.createdBy !== userId &&
        t.lastMessagePreview.length > 0;
      return { ...t, unread };
    });
    return { threads };
  },

  async getUnreadCount(schoolId: string, userId: string, role: UserRole): Promise<number> {
    const { threads } = await this.listInbox(schoolId, userId, role);
    return threads.filter((t) => t.unread).length;
  },

  async getMessages(threadId: string, limit = MAX_MESSAGES): Promise<ThreadMessage[]> {
    const { data, error } = await supabase
      .from('thread_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[MESSAGES] fetch error:', error.message);
      return [];
    }
    return (data ?? []).map(mapMessage);
  },

  async markRead(schoolId: string, threadId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();
    await supabase.from('message_read_cursors').upsert(
      {
        school_id: schoolId,
        thread_id: threadId,
        user_id: userId,
        last_read_at: now,
      },
      { onConflict: 'thread_id,user_id' }
    );
  },

  async createThread(input: CreateThreadInput): Promise<{ success: boolean; threadId?: string; error?: string }> {
    const preview = input.body.trim().slice(0, 120);
    const now = new Date().toISOString();

    const { data: thread, error: threadError } = await supabase
      .from('message_threads')
      .insert([
        {
          school_id: input.schoolId,
          subject: input.subject.trim(),
          audience: input.audience,
          class_id: input.classId ?? null,
          target_user_id: input.targetUserId ?? null,
          target_role: input.targetRole ?? null,
          student_id: input.studentId ?? null,
          created_by: input.senderId,
          created_by_role: input.senderRole,
          created_by_name: input.senderName,
          last_message_at: now,
          last_message_preview: preview,
          message_count: 1,
        },
      ])
      .select('id')
      .single();

    if (threadError || !thread) {
      return { success: false, error: threadError?.message ?? 'Failed to create thread' };
    }

    const { error: msgError } = await supabase.from('thread_messages').insert([
      {
        school_id: input.schoolId,
        thread_id: thread.id,
        sender_id: input.senderId,
        sender_role: input.senderRole,
        sender_name: input.senderName,
        body: input.body.trim(),
      },
    ]);

    if (msgError) {
      return { success: false, error: msgError.message };
    }

    if (input.audience === 'direct' && input.targetUserId && input.targetRole) {
      void notificationService.sendNotification({
        schoolId: input.schoolId,
        recipientId: input.targetUserId,
        recipientRole: input.targetRole,
        notificationType: 'school_message',
        title: input.subject.trim(),
        message: preview,
        priority: 'medium',
        actionUrl: `/messages?thread=${thread.id}`,
      });
    } else if (input.audience === 'school_admin') {
      const { data: admins } = await supabase
        .from('staff')
        .select('id')
        .eq('school_id', input.schoolId)
        .eq('role', 'admin')
        .eq('is_active', true)
        .limit(5);
      for (const admin of admins ?? []) {
        void notificationService.sendNotification({
          schoolId: input.schoolId,
          recipientId: admin.id,
          recipientRole: 'admin',
          notificationType: 'school_message',
          title: input.subject.trim(),
          message: preview,
          priority: 'medium',
          actionUrl: `/messages?thread=${thread.id}`,
        });
      }
    }

    return { success: true, threadId: thread.id };
  },

  async reply(
    schoolId: string,
    threadId: string,
    senderId: string,
    senderRole: UserRole,
    senderName: string,
    body: string,
    thread?: MessageThread
  ): Promise<{ success: boolean; error?: string }> {
    const trimmed = body.trim();
    if (!trimmed) return { success: false, error: 'Message cannot be empty' };

    const preview = trimmed.slice(0, 120);
    const now = new Date().toISOString();

    const { error: msgError } = await supabase.from('thread_messages').insert([
      {
        school_id: schoolId,
        thread_id: threadId,
        sender_id: senderId,
        sender_role: senderRole,
        sender_name: senderName,
        body: trimmed,
      },
    ]);

    if (msgError) return { success: false, error: msgError.message };

    const { data: current } = await supabase
      .from('message_threads')
      .select(
        'message_count, audience, target_user_id, target_role, subject, created_by, created_by_role'
      )
      .eq('id', threadId)
      .maybeSingle();

    const count = (current?.message_count ?? 0) + 1;
    await supabase
      .from('message_threads')
      .update({
        last_message_at: now,
        last_message_preview: preview,
        message_count: count,
      })
      .eq('id', threadId);

    if (current?.audience === 'direct' && current.target_user_id && current.target_user_id !== senderId) {
      void notificationService.sendNotification({
        schoolId,
        recipientId: current.target_user_id,
        recipientRole: (current.target_role as UserRole) ?? 'teacher',
        notificationType: 'school_message',
        title: current.subject ?? 'New reply',
        message: preview,
        priority: 'medium',
        actionUrl: `/messages?thread=${threadId}`,
      });
    } else if (current?.audience === 'direct' && current.created_by && current.created_by !== senderId) {
      void notificationService.sendNotification({
        schoolId,
        recipientId: current.created_by,
        recipientRole: 'parent',
        notificationType: 'school_message',
        title: current.subject ?? 'New reply',
        message: preview,
        priority: 'medium',
        actionUrl: `/messages?thread=${threadId}`,
      });
    } else if (current?.created_by && current.created_by !== senderId) {
      void notificationService.sendNotification({
        schoolId,
        recipientId: current.created_by,
        recipientRole: (current.created_by_role as UserRole) ?? 'parent',
        notificationType: 'school_message',
        title: current.subject ?? 'New reply',
        message: preview,
        priority: 'medium',
        actionUrl: `/messages?thread=${threadId}`,
      });
    }

    return { success: true };
  },

  /** Admin compose helpers */
  async listTeachers(schoolId: string) {
    const { data } = await supabase
      .from('staff')
      .select('id, full_name')
      .eq('school_id', schoolId)
      .eq('role', 'teacher')
      .eq('is_active', true)
      .order('full_name');
    return data ?? [];
  },

  async listParents(schoolId: string) {
    const { data } = await supabase
      .from('parents')
      .select('id, father_name, mother_name, guardian_name')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .limit(200);
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.father_name || p.mother_name || p.guardian_name || 'Parent',
    }));
  },

  async listClasses(schoolId: string) {
    const { data } = await supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name');
    return data ?? [];
  },

  async getClassTeacherForStudent(schoolId: string, studentId: string) {
    const { data: student } = await supabase
      .from('students')
      .select('class_id')
      .eq('school_id', schoolId)
      .eq('id', studentId)
      .maybeSingle();

    if (!student?.class_id) return null;

    const { data: cls } = await supabase
      .from('classes')
      .select('class_teacher_id, staff!class_teacher_id(full_name)')
      .eq('id', student.class_id)
      .maybeSingle();

    if (!cls?.class_teacher_id) return null;
    const staff = cls.staff as { full_name?: string } | null;
    return {
      teacherId: cls.class_teacher_id,
      teacherName: staff?.full_name ?? 'Class teacher',
    };
  },
};
