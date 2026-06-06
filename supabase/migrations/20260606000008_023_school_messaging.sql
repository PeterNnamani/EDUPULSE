/*
  # 023 - Lightweight school messaging (announcements + direct replies)

  Design goals:
  - One thread row per conversation/broadcast (not N copies per recipient)
  - Append-only messages, paginated reads (max 50 per load)
  - Read cursors only created when a user opens a thread (lazy, 1 row per user/thread)
  - Realtime-friendly indexes on school_id + thread_id
*/

CREATE TABLE IF NOT EXISTS message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN (
    'all_teachers',
    'all_parents',
    'class_parents',
    'direct',
    'school_admin'
  )),
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  target_user_id UUID,
  target_role TEXT,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_by_role TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_preview TEXT NOT NULL DEFAULT '',
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS thread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_read_cursors (
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_threads_school_last
  ON message_threads(school_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_threads_audience
  ON message_threads(school_id, audience);

CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_created
  ON thread_messages(thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_thread_messages_school_created
  ON thread_messages(school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_read_cursors_user
  ON message_read_cursors(user_id, school_id);

ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_cursors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_threads_select" ON message_threads;
DROP POLICY IF EXISTS "message_threads_insert" ON message_threads;
DROP POLICY IF EXISTS "message_threads_update" ON message_threads;
DROP POLICY IF EXISTS "thread_messages_select" ON thread_messages;
DROP POLICY IF EXISTS "thread_messages_insert" ON thread_messages;
DROP POLICY IF EXISTS "message_read_cursors_all" ON message_read_cursors;

CREATE POLICY "message_threads_select" ON message_threads FOR SELECT USING (true);
CREATE POLICY "message_threads_insert" ON message_threads FOR INSERT WITH CHECK (true);
CREATE POLICY "message_threads_update" ON message_threads FOR UPDATE USING (true);
CREATE POLICY "thread_messages_select" ON thread_messages FOR SELECT USING (true);
CREATE POLICY "thread_messages_insert" ON thread_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "message_read_cursors_all" ON message_read_cursors FOR ALL USING (true) WITH CHECK (true);

-- Optional bell alert for 1:1 messages only (broadcasts use Messages page + realtime)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check CHECK (notification_type IN (
  'attendance_alert',
  'academic_alert',
  'behaviour_alert',
  'assignment_alert',
  'fee_reminder',
  'fee_alert',
  'risk_alert',
  'intervention_reminder',
  'escalation_alert',
  'academic_event',
  'system_alert',
  'arrival_alert',
  'departure_alert',
  'birthday_greeting',
  'teacher_activity',
  'payment_confirmation',
  'reconciliation_alert',
  'school_message'
));
