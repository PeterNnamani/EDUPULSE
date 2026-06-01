/*
  # Academic Session Management Engine

  1. New Tables
    - `class_definitions` - Standard class definitions for the school
    - `promotion_rules` - Rules for class progression
    - `academic_calendars` - Custom academic calendars
    - `student_academic_records` - Historical records of student progress
    - `graduation_records` - Track graduating students
    - `fee_structures` - Dynamic fee structures by class/term
    - `fee_obligations` - Student-specific fee obligations
    - `archived_attendance` - Archived attendance records
    - `archived_assignments` - Archived assignment records
    - `archived_results` - Archived grade records
    - `archived_risk_assessments` - Archived risk assessments
    - `term_automation_logs` - Log of automated actions

  2. Core Principles
    - Student profiles are permanent
    - Academic records are historical
    - Never overwrite academic history
    - All records preserved by session, term, class
    - Full audit trail of all system actions

  3. Security
    - Enable RLS on all tables
    - Multi-tenant isolation via school_id
*/

-- Class Definitions (Standard Classes)
CREATE TABLE IF NOT EXISTS class_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  class_level TEXT NOT NULL,
  display_order INTEGER,
  is_primary BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, class_name),
  UNIQUE(school_id, class_level)
);

-- Promotion Rules
CREATE TABLE IF NOT EXISTS promotion_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  from_class_id UUID NOT NULL REFERENCES class_definitions(id) ON DELETE CASCADE,
  to_class_id UUID NOT NULL REFERENCES class_definitions(id) ON DELETE CASCADE,
  attendance_threshold INTEGER DEFAULT 80,
  grade_threshold DECIMAL(5,2) DEFAULT 40.00,
  behaviour_threshold INTEGER DEFAULT 40,
  allows_repeat BOOLEAN DEFAULT true,
  allows_manual_review BOOLEAN DEFAULT true,
  requires_principal_approval BOOLEAN DEFAULT false,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, from_class_id, to_class_id)
);

-- Academic Calendars
CREATE TABLE IF NOT EXISTS academic_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  calendar_name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  first_term_start_month INTEGER DEFAULT 9,
  first_term_end_month INTEGER DEFAULT 12,
  second_term_start_month INTEGER DEFAULT 1,
  second_term_end_month INTEGER DEFAULT 3,
  third_term_start_month INTEGER DEFAULT 4,
  third_term_end_month INTEGER DEFAULT 7,
  vacation_month INTEGER DEFAULT 8,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, calendar_name)
);

-- Student Academic Records (Historical)
CREATE TABLE IF NOT EXISTS student_academic_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  average_score DECIMAL(5,2),
  attendance_rate DECIMAL(5,2),
  behaviour_score INTEGER,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  subjects_count INTEGER,
  promoted BOOLEAN,
  promotion_status TEXT CHECK (promotion_status IN ('promoted', 'repeat', 'manual_review', 'graduated', 'pending')),
  promotion_notes TEXT,
  principal_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, session_id, term_id)
);

-- Graduation Records
CREATE TABLE IF NOT EXISTS graduation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  final_class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  graduation_date DATE NOT NULL,
  final_gpa DECIMAL(5,2),
  qualification TEXT,
  certificate_number TEXT UNIQUE,
  transcript_generated BOOLEAN DEFAULT false,
  transcript_url TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, session_id)
);

-- Fee Structures
CREATE TABLE IF NOT EXISTS fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id UUID REFERENCES academic_sessions(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  fee_type_id UUID REFERENCES fee_types(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  due_month INTEGER,
  due_date INTEGER,
  late_fee_percentage DECIMAL(5,2) DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, session_id, class_id, fee_type_id)
);

-- Student Fee Obligations
CREATE TABLE IF NOT EXISTS fee_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE RESTRICT,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  amount_due DECIMAL(12,2) NOT NULL,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  amount_outstanding DECIMAL(12,2) NOT NULL,
  carry_over_balance DECIMAL(12,2) DEFAULT 0,
  due_date DATE,
  paid_in_full BOOLEAN DEFAULT false,
  payment_plan TEXT,
  exemption_reason TEXT,
  exemption_approved_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, fee_structure_id, session_id)
);

-- Archived Attendance Records
CREATE TABLE IF NOT EXISTS archived_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  attendance_data JSONB,
  total_days INTEGER,
  present_days INTEGER,
  absent_days INTEGER,
  late_days INTEGER,
  attendance_percentage DECIMAL(5,2),
  archived_at TIMESTAMPTZ DEFAULT now()
);

-- Archived Assignments
CREATE TABLE IF NOT EXISTS archived_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  assignment_data JSONB,
  total_assignments INTEGER,
  submitted_count INTEGER,
  average_score DECIMAL(5,2),
  archived_at TIMESTAMPTZ DEFAULT now()
);

-- Archived Results
CREATE TABLE IF NOT EXISTS archived_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  results_data JSONB,
  average_score DECIMAL(5,2),
  total_subjects INTEGER,
  class_position INTEGER,
  best_subject TEXT,
  weakest_subject TEXT,
  archived_at TIMESTAMPTZ DEFAULT now()
);

-- Archived Risk Assessments
CREATE TABLE IF NOT EXISTS archived_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  risk_score INTEGER,
  risk_level TEXT,
  factors JSONB,
  recommendations JSONB,
  interventions_count INTEGER,
  archived_at TIMESTAMPTZ DEFAULT now()
);

-- Term Automation Logs
CREATE TABLE IF NOT EXISTS term_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'term_activated',
    'attendance_created',
    'assignments_created',
    'gradebook_created',
    'fees_generated',
    'risk_monitoring_activated',
    'teacher_workspace_activated',
    'promotion_processed',
    'graduation_processed',
    'session_archived',
    'session_created'
  )),
  action_details JSONB,
  executed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  affected_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Session Transition Audit
CREATE TABLE IF NOT EXISTS session_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  from_session_id UUID REFERENCES academic_sessions(id) ON DELETE SET NULL,
  to_session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  transition_date TIMESTAMPTZ DEFAULT now(),
  students_promoted INTEGER,
  students_graduated INTEGER,
  students_repeated INTEGER,
  new_classes_created INTEGER,
  fees_obligations_created INTEGER,
  executed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE class_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_academic_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE graduation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE term_automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_transitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for School Isolation
CREATE POLICY "class_definitions_school_isolation"
  ON class_definitions FOR ALL
  USING (school_id = auth.uid()::uuid OR EXISTS (
    SELECT 1 FROM staff WHERE staff.school_id = class_definitions.school_id AND staff.user_id = auth.uid()
  ));

CREATE POLICY "promotion_rules_school_isolation"
  ON promotion_rules FOR ALL
  USING (school_id = auth.uid()::uuid OR EXISTS (
    SELECT 1 FROM staff WHERE staff.school_id = promotion_rules.school_id AND staff.user_id = auth.uid()
  ));

CREATE POLICY "academic_calendars_school_isolation"
  ON academic_calendars FOR ALL
  USING (school_id = auth.uid()::uuid OR EXISTS (
    SELECT 1 FROM staff WHERE staff.school_id = academic_calendars.school_id AND staff.user_id = auth.uid()
  ));

CREATE POLICY "student_academic_records_school_isolation"
  ON student_academic_records FOR ALL
  USING (school_id = auth.uid()::uuid OR EXISTS (
    SELECT 1 FROM staff WHERE staff.school_id = student_academic_records.school_id AND staff.user_id = auth.uid()
  ));

CREATE POLICY "graduation_records_school_isolation"
  ON graduation_records FOR ALL
  USING (school_id = auth.uid()::uuid OR EXISTS (
    SELECT 1 FROM staff WHERE staff.school_id = graduation_records.school_id AND staff.user_id = auth.uid()
  ));

CREATE POLICY "fee_structures_school_isolation"
  ON fee_structures FOR ALL
  USING (school_id = auth.uid()::uuid OR EXISTS (
    SELECT 1 FROM staff WHERE staff.school_id = fee_structures.school_id AND staff.user_id = auth.uid()
  ));

CREATE POLICY "fee_obligations_school_isolation"
  ON fee_obligations FOR ALL
  USING (school_id = auth.uid()::uuid OR EXISTS (
    SELECT 1 FROM staff WHERE staff.school_id = fee_obligations.school_id AND staff.user_id = auth.uid()
  ));

CREATE POLICY "archived_attendance_school_isolation"
  ON archived_attendance FOR ALL
  USING (school_id = auth.uid()::uuid OR EXISTS (
    SELECT 1 FROM staff WHERE staff.school_id = archived_attendance.school_id AND staff.user_id = auth.uid()
  ));

CREATE POLICY "archived_assignments_school_isolation"
  ON archived_assignments FOR ALL
  USING (school_id = auth.uid()::uuid OR EXISTS (
    SELECT 1 FROM staff WHERE staff.school_id = archived_assignments.school_id AND staff.user_id = auth.uid()
  ));

CREATE POLICY "archived_results_school_isolation"
  ON archived_results FOR ALL
  USING (school_id = auth.uid()::uuid OR EXISTS (
    SELECT 1 FROM staff WHERE staff.school_id = archived_results.school_id AND staff.user_id = auth.uid()
  ));

CREATE POLICY "archived_risk_assessments_school_isolation"
  ON archived_risk_assessments FOR ALL
  USING (school_id = auth.uid()::uuid OR EXISTS (
    SELECT 1 FROM staff WHERE staff.school_id = archived_risk_assessments.school_id AND staff.user_id = auth.uid()
  ));

CREATE POLICY "term_automation_logs_school_isolation"
  ON term_automation_logs FOR ALL
  USING (school_id = auth.uid()::uuid OR EXISTS (
    SELECT 1 FROM staff WHERE staff.school_id = term_automation_logs.school_id AND staff.user_id = auth.uid()
  ));

CREATE POLICY "session_transitions_school_isolation"
  ON session_transitions FOR ALL
  USING (school_id = auth.uid()::uuid OR EXISTS (
    SELECT 1 FROM staff WHERE staff.school_id = session_transitions.school_id AND staff.user_id = auth.uid()
  ));

-- Create indexes for performance
CREATE INDEX idx_promotion_rules_school ON promotion_rules(school_id);
CREATE INDEX idx_student_academic_records_student ON student_academic_records(student_id);
CREATE INDEX idx_student_academic_records_session ON student_academic_records(session_id);
CREATE INDEX idx_student_academic_records_term ON student_academic_records(term_id);
CREATE INDEX idx_graduation_records_student ON graduation_records(student_id);
CREATE INDEX idx_fee_structures_session ON fee_structures(session_id);
CREATE INDEX idx_fee_obligations_student ON fee_obligations(student_id);
CREATE INDEX idx_fee_obligations_session ON fee_obligations(session_id);
CREATE INDEX idx_archived_attendance_student ON archived_attendance(student_id);
CREATE INDEX idx_archived_results_student ON archived_results(student_id);
CREATE INDEX idx_term_automation_logs_session ON term_automation_logs(session_id);
CREATE INDEX idx_session_transitions_school ON session_transitions(school_id);
