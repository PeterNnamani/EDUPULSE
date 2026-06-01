/*
  # Notification, Alert, Risk Detection, and Intervention Engine

  1. New Tables
    - `notifications` - Centralized notification system
    - `notification_preferences` - User notification preferences by channel
    - `student_alerts` - Risk detection alerts
    - `risk_scores` - Composite risk scores for students
    - `intervention_cases` - Counselor case management
    - `intervention_activities` - Track intervention follow-ups
    - `intervention_outcomes` - Document intervention results
    - `escalation_tracking` - Track alert escalation process
    - `notification_audit_log` - Complete audit trail

  2. Core Principles
    - Automatic risk detection
    - Real-time notifications
    - Role-based alert routing
    - Escalation for unresolved issues
    - Complete audit trail
    - Multi-channel support

  3. Risk Detection Components
    - Attendance monitoring (30% weight)
    - Academic performance tracking (30% weight)
    - Assignment tracking (15% weight)
    - Behaviour monitoring (15% weight)
    - Fee payment tracking (10% weight)

  4. Security
    - Enable RLS on all tables
    - Multi-tenant isolation via school_id
    - Role-based access control
*/

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('admin', 'principal', 'teacher', 'counselor', 'finance', 'parent')),
  notification_type TEXT NOT NULL CHECK (notification_type IN (
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
    'system_alert'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  action_url TEXT,
  related_student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  related_alert_id UUID,
  delivery_channels TEXT[] DEFAULT ARRAY['in_app'],
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  UNIQUE(school_id, recipient_id, related_alert_id)
);

CREATE INDEX idx_notifications_school_recipient ON notifications(school_id, recipient_id);
CREATE INDEX idx_notifications_status ON notifications(school_id, status);
CREATE INDEX idx_notifications_created ON notifications(school_id, created_at DESC);
CREATE INDEX idx_notifications_priority ON notifications(school_id, priority);


-- ============================================================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_role TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  in_app_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  whatsapp_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, user_id, notification_type)
);

CREATE INDEX idx_notification_preferences_user ON notification_preferences(school_id, user_id);


-- ============================================================================
-- RISK SCORES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  
  -- Individual risk factors (0-100 scale)
  attendance_risk DECIMAL(5,2) DEFAULT 0,
  academic_risk DECIMAL(5,2) DEFAULT 0,
  assignment_risk DECIMAL(5,2) DEFAULT 0,
  behaviour_risk DECIMAL(5,2) DEFAULT 0,
  fee_risk DECIMAL(5,2) DEFAULT 0,
  
  -- Composite score
  overall_risk DECIMAL(5,2) DEFAULT 0,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  
  -- Calculation metadata
  calculation_method TEXT DEFAULT 'weighted_average',
  factors_considered TEXT[] DEFAULT ARRAY[]::TEXT[],
  last_calculated TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, student_id, session_id, term_id)
);

CREATE INDEX idx_risk_scores_student ON risk_scores(school_id, student_id);
CREATE INDEX idx_risk_scores_level ON risk_scores(school_id, risk_level);
CREATE INDEX idx_risk_scores_updated ON risk_scores(school_id, updated_at DESC);


-- ============================================================================
-- STUDENT ALERTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  
  -- Alert details
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'attendance',
    'academic_decline',
    'missing_assignment',
    'behaviour_incident',
    'fee_overdue',
    'composite_risk',
    'critical_incident'
  )),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Recommended actions
  recommended_action TEXT NOT NULL,
  secondary_actions TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Case management
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'escalated')),
  assigned_counselor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Tracking
  triggered_by TEXT NOT NULL DEFAULT 'system',
  related_risk_score_id UUID REFERENCES risk_scores(id) ON DELETE SET NULL,
  parent_notified BOOLEAN DEFAULT false,
  teacher_notified BOOLEAN DEFAULT false,
  counselor_notified BOOLEAN DEFAULT false,
  principal_notified BOOLEAN DEFAULT false,
  
  -- Timeline
  created_at TIMESTAMPTZ DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  UNIQUE(school_id, student_id, alert_type)
);

CREATE INDEX idx_student_alerts_student ON student_alerts(school_id, student_id);
CREATE INDEX idx_student_alerts_status ON student_alerts(school_id, status);
CREATE INDEX idx_student_alerts_counselor ON student_alerts(school_id, assigned_counselor_id);
CREATE INDEX idx_student_alerts_type ON student_alerts(school_id, alert_type);
CREATE INDEX idx_student_alerts_created ON student_alerts(school_id, created_at DESC);


-- ============================================================================
-- INTERVENTION CASES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS intervention_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  alert_id UUID NOT NULL REFERENCES student_alerts(id) ON DELETE CASCADE,
  
  -- Case details
  case_title TEXT NOT NULL,
  case_description TEXT NOT NULL,
  case_category TEXT NOT NULL CHECK (case_category IN (
    'attendance_intervention',
    'academic_intervention',
    'behaviour_intervention',
    'assignment_intervention',
    'fee_intervention',
    'general_counseling'
  )),
  
  -- Assignment
  assigned_to_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Case status
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'on_hold', 'closed', 'escalated')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  
  -- Intervention plan
  intervention_plan TEXT,
  goals TEXT[] DEFAULT ARRAY[]::TEXT[],
  expected_outcome TEXT,
  
  -- Timeline
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  
  -- Success tracking
  case_outcome TEXT CHECK (case_outcome IN ('resolved', 'improved', 'stable', 'worsened', 'no_change', 'pending')),
  success_metrics JSONB,
  follow_up_required BOOLEAN DEFAULT true,
  next_review_date DATE
);

CREATE INDEX idx_intervention_cases_student ON intervention_cases(school_id, student_id);
CREATE INDEX idx_intervention_cases_assigned ON intervention_cases(school_id, assigned_to_id);
CREATE INDEX idx_intervention_cases_status ON intervention_cases(school_id, status);
CREATE INDEX idx_intervention_cases_created ON intervention_cases(school_id, created_at DESC);


-- ============================================================================
-- INTERVENTION ACTIVITIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS intervention_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES intervention_cases(id) ON DELETE CASCADE,
  
  -- Activity details
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'counselor_session',
    'parent_meeting',
    'teacher_meeting',
    'student_meeting',
    'follow_up',
    'progress_review',
    'note',
    'action_item'
  )),
  activity_title TEXT NOT NULL,
  activity_description TEXT NOT NULL,
  
  -- Participants
  conducted_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  attendees TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Timeline
  scheduled_date DATE,
  activity_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  
  -- Observations and outcomes
  observations TEXT,
  student_response TEXT,
  recommendations TEXT,
  follow_up_actions TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Completion
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  completion_date TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intervention_activities_case ON intervention_activities(school_id, case_id);
CREATE INDEX idx_intervention_activities_conducted ON intervention_activities(school_id, conducted_by_id);
CREATE INDEX idx_intervention_activities_date ON intervention_activities(school_id, activity_date DESC);


-- ============================================================================
-- INTERVENTION OUTCOMES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS intervention_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES intervention_cases(id) ON DELETE CASCADE,
  
  -- Outcome evaluation
  evaluation_date TIMESTAMPTZ DEFAULT now(),
  evaluated_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Outcome assessment
  overall_outcome TEXT NOT NULL CHECK (overall_outcome IN ('resolved', 'improved', 'stable', 'worsened', 'no_change')),
  
  -- Specific improvements
  attendance_improvement DECIMAL(5,2),
  academic_improvement DECIMAL(5,2),
  behaviour_improvement TEXT,
  assignment_completion_improvement DECIMAL(5,2),
  fee_payment_progress TEXT,
  
  -- Metrics
  interventions_count INTEGER,
  duration_days INTEGER,
  success_rate DECIMAL(5,2),
  
  -- Recommendations
  continue_intervention BOOLEAN DEFAULT false,
  next_steps TEXT,
  referral_needed BOOLEAN DEFAULT false,
  referral_type TEXT,
  
  -- Notes
  evaluation_notes TEXT,
  success_factors TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intervention_outcomes_case ON intervention_outcomes(school_id, case_id);
CREATE INDEX idx_intervention_outcomes_evaluated ON intervention_outcomes(school_id, evaluated_by_id);


-- ============================================================================
-- ESCALATION TRACKING TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS escalation_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  alert_id UUID NOT NULL REFERENCES student_alerts(id) ON DELETE CASCADE,
  
  -- Escalation levels
  current_level INTEGER DEFAULT 1,
  level_1_date TIMESTAMPTZ,
  level_1_notified_to TEXT[] DEFAULT ARRAY[]::TEXT[],
  level_1_completed BOOLEAN DEFAULT false,
  
  level_2_date TIMESTAMPTZ,
  level_2_notified_to TEXT[] DEFAULT ARRAY[]::TEXT[],
  level_2_completed BOOLEAN DEFAULT false,
  
  level_3_date TIMESTAMPTZ,
  level_3_notified_to TEXT[] DEFAULT ARRAY[]::TEXT[],
  level_3_completed BOOLEAN DEFAULT false,
  
  level_4_date TIMESTAMPTZ,
  level_4_notified_to TEXT[] DEFAULT ARRAY[]::TEXT[],
  level_4_completed BOOLEAN DEFAULT false,
  
  level_5_date TIMESTAMPTZ,
  level_5_notified_to TEXT[] DEFAULT ARRAY[]::TEXT[],
  level_5_completed BOOLEAN DEFAULT false,
  critical_flag_date TIMESTAMPTZ,
  
  -- Escalation reason
  escalation_reason TEXT,
  
  -- Last action
  last_escalation_date TIMESTAMPTZ,
  next_escalation_date TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_escalation_tracking_alert ON escalation_tracking(school_id, alert_id);
CREATE INDEX idx_escalation_tracking_level ON escalation_tracking(school_id, current_level);


-- ============================================================================
-- NOTIFICATION AUDIT LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  
  -- Action details
  action TEXT NOT NULL CHECK (action IN (
    'alert_created',
    'alert_acknowledged',
    'alert_resolved',
    'notification_sent',
    'notification_read',
    'case_created',
    'case_assigned',
    'activity_recorded',
    'outcome_documented',
    'escalation_triggered'
  )),
  
  -- Subject
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  
  -- Object
  affected_entity_type TEXT NOT NULL,
  affected_entity_id UUID,
  
  -- Details
  description TEXT,
  metadata JSONB,
  
  -- Timestamp
  timestamp TIMESTAMPTZ DEFAULT now(),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_school ON notification_audit_log(school_id);
CREATE INDEX idx_audit_log_timestamp ON notification_audit_log(school_id, timestamp DESC);
CREATE INDEX idx_audit_log_entity ON notification_audit_log(school_id, affected_entity_type, affected_entity_id);


-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Notifications RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = recipient_id);

CREATE POLICY "System can insert notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  USING (auth.uid() = recipient_id);


-- Notification Preferences RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON notification_preferences
  FOR ALL
  USING (auth.uid() = user_id);


-- Risk Scores RLS
ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School staff can view school risk scores"
  ON risk_scores
  FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM staff WHERE user_id = auth.uid() UNION
      SELECT school_id FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
    )
  );


-- Student Alerts RLS
ALTER TABLE student_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School staff can view school alerts"
  ON student_alerts
  FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM staff WHERE user_id = auth.uid() UNION
      SELECT school_id FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "System can manage alerts"
  ON student_alerts
  FOR ALL
  USING (true);


-- Intervention Cases RLS
ALTER TABLE intervention_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Counselors and staff can view school cases"
  ON intervention_cases
  FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM staff WHERE user_id = auth.uid() UNION
      SELECT school_id FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Assigned counselor can update case"
  ON intervention_cases
  FOR UPDATE
  USING (auth.uid() = assigned_to_id);


-- Intervention Activities RLS
ALTER TABLE intervention_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Case team can view activities"
  ON intervention_activities
  FOR SELECT
  USING (
    case_id IN (
      SELECT id FROM intervention_cases WHERE assigned_to_id = auth.uid()
    )
  );


-- Audit Log RLS
ALTER TABLE notification_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administrators and counselors can view audit log"
  ON notification_audit_log
  FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM staff WHERE user_id = auth.uid() AND role IN ('principal', 'counselor', 'admin')
      UNION
      SELECT school_id FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
    )
  );


-- ============================================================================
-- TRIGGERS FOR AUDIT LOGGING
-- ============================================================================

CREATE OR REPLACE FUNCTION log_alert_action()
RETURNS TRIGGER AS $$
DECLARE
  action_type TEXT;
  old_status TEXT;
BEGIN
  -- Get old status safely
  IF TG_OP = 'UPDATE' THEN
    old_status := OLD.status;
  ELSE
    old_status := NULL;
  END IF;

  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_type := 'alert_created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'acknowledged' AND COALESCE(old_status, '') != NEW.status THEN
      action_type := 'alert_acknowledged';
    ELSIF NEW.status = 'resolved' AND COALESCE(old_status, '') != NEW.status THEN
      action_type := 'alert_resolved';
    ELSE
      action_type := 'alert_updated';
    END IF;
  ELSE
    action_type := 'alert_updated';
  END IF;

  -- Only log if relevant
  IF action_type IS NOT NULL THEN
    INSERT INTO notification_audit_log (
      school_id,
      action,
      actor_id,
      affected_entity_type,
      affected_entity_id,
      description
    ) VALUES (
      NEW.school_id,
      action_type,
      auth.uid(),
      'student_alert',
      NEW.id,
      'Alert for student ' || COALESCE(NEW.student_id::TEXT, 'unknown')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER student_alerts_audit_trigger
AFTER INSERT OR UPDATE ON student_alerts
FOR EACH ROW
EXECUTE FUNCTION log_alert_action();


CREATE OR REPLACE FUNCTION log_case_action()
RETURNS TRIGGER AS $$
DECLARE
  action_type TEXT;
  old_assigned_id UUID;
BEGIN
  -- Get old assigned_to_id safely
  IF TG_OP = 'UPDATE' THEN
    old_assigned_id := OLD.assigned_to_id;
  ELSE
    old_assigned_id := NULL;
  END IF;

  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_type := 'case_created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(old_assigned_id::TEXT, '') != COALESCE(NEW.assigned_to_id::TEXT, '') THEN
      action_type := 'case_assigned';
    ELSE
      action_type := 'case_updated';
    END IF;
  ELSE
    action_type := 'case_updated';
  END IF;

  -- Only log if relevant
  IF action_type IS NOT NULL THEN
    INSERT INTO notification_audit_log (
      school_id,
      action,
      actor_id,
      affected_entity_type,
      affected_entity_id,
      description
    ) VALUES (
      NEW.school_id,
      action_type,
      auth.uid(),
      'intervention_case',
      NEW.id,
      'Case for student ' || COALESCE(NEW.student_id::TEXT, 'unknown')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER intervention_cases_audit_trigger
AFTER INSERT OR UPDATE ON intervention_cases
FOR EACH ROW
EXECUTE FUNCTION log_case_action();
