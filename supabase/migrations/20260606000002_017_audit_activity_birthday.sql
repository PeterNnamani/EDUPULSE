/*
  # 017 - Phase A Foundations: Audit, Teacher Activity, Birthday, Notification types

  1. Audit logging
     - Add RLS policies to existing `audit_logs` (permissive, school-scoped at app layer)
     - Add performance indexes

  2. New tables
     - `teacher_activity_logs` - complete teacher activity feed
     - `birthday_greetings_log` - dedupe automatic birthday greetings

  3. Notifications
     - Extend `notifications.notification_type` CHECK with new event types
*/

-- ============================================================================
-- AUDIT LOGS - enable app-layer writes + indexes
-- ============================================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audit logs are viewable" ON audit_logs;
DROP POLICY IF EXISTS "Audit logs are insertable" ON audit_logs;
DROP POLICY IF EXISTS "Anyone can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON audit_logs;

CREATE POLICY "Anyone can view audit logs" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert audit logs" ON audit_logs FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_logs_school_created ON audit_logs(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(school_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(school_id, action);

-- ============================================================================
-- TEACHER ACTIVITY LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS teacher_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  staff_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  related_student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  related_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_activity_school_created ON teacher_activity_logs(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_activity_staff ON teacher_activity_logs(school_id, staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_activity_action ON teacher_activity_logs(school_id, action);

ALTER TABLE teacher_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view teacher activity" ON teacher_activity_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert teacher activity" ON teacher_activity_logs FOR INSERT WITH CHECK (true);

-- ============================================================================
-- BIRTHDAY GREETINGS LOG (dedupe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS birthday_greetings_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  person_type TEXT NOT NULL CHECK (person_type IN ('student', 'parent', 'teacher', 'staff')),
  person_id UUID NOT NULL,
  person_name TEXT,
  greeting_date DATE NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, person_type, person_id, greeting_date, channel)
);

CREATE INDEX IF NOT EXISTS idx_birthday_greetings_school_date ON birthday_greetings_log(school_id, greeting_date);

ALTER TABLE birthday_greetings_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view birthday greetings" ON birthday_greetings_log FOR SELECT USING (true);
CREATE POLICY "Anyone can insert birthday greetings" ON birthday_greetings_log FOR INSERT WITH CHECK (true);

-- ============================================================================
-- DATE OF BIRTH for staff & parents (birthday automation)
-- ============================================================================
ALTER TABLE staff ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- ============================================================================
-- EXTEND NOTIFICATION TYPES
-- ============================================================================
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
  -- new event types (Phase A-D)
  'arrival_alert',
  'departure_alert',
  'birthday_greeting',
  'teacher_activity',
  'payment_confirmation',
  'reconciliation_alert'
));
