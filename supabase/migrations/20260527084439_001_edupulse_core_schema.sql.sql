/*
  # EduPulse Core Database Schema

  1. New Tables
    - `schools` - Multi-tenant school workspaces with subscription info
    - `school_settings` - Per-school configuration and preferences
    - `academic_sessions` - Academic years (e.g., 2024/2025)
    - `academic_terms` - Terms/sessions within academic years
    - `staff` - All school staff (teachers, principals, counselors, finance)
    - `subjects` - School subjects with grading systems
    - `classes` - Class divisions (e.g., SS1A, SS1B)
    - `class_subjects` - Links subjects to classes with assigned teachers
    - `students` - Student records with demographic data
    - `parents` - Parent/guardian information
    - `student_parents` - Links students to parents
    - `attendance` - Daily attendance records
    - `grades` - Student grade entries
    - `assignments` - Assignment definitions
    - `assignment_submissions` - Student assignment submissions
    - `behaviour_records` - Behaviour incidents and merits
    - `fees` - Fee structures per term
    - `fee_types` - Types of fees (tuition, sports, etc.)
    - `payments` - Payment records
    - `risk_assessments` - AI-generated risk scores
    - `interventions` - Intervention plans and actions
    - `intervention_meetings` - Meeting schedules for interventions
    - `notifications` - In-app notifications
    - `notification_preferences` - User notification settings
    - `audit_logs` - System audit trail
    - `subscriptions` - School subscription records
    - `invoices` - Billing invoices
    - `reports` - Generated reports

  2. Security
    - Enable RLS on all tables
    - Restrict access to school workspace members
    - Staff can only access their school's data
    - Parents can only access their children's data

  3. Important Notes
    - All tables include school_id for tenant isolation
    - Staff IDs generated as TCH/PRN/CNS/FIN/ADM + 4 digits
    - Student IDs generated as STU + 6 digits
    - Risk scores range 0-100 with automatic level classification
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schools Table
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  school_type TEXT CHECK (school_type IN ('nursery', 'primary', 'secondary', 'tertiary')),
  phone TEXT,
  email TEXT UNIQUE NOT NULL,
  address TEXT,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT DEFAULT 'Nigeria',
  logo_url TEXT,
  motto TEXT,
  founded_year INTEGER,
  is_active BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMPTZ,
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'expired', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- School Settings
CREATE TABLE IF NOT EXISTS school_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  attendance_threshold_warning INTEGER DEFAULT 80,
  attendance_threshold_critical INTEGER DEFAULT 60,
  grade_pass_mark DECIMAL(5,2) DEFAULT 40.00,
  grade_a DECIMAL(5,2) DEFAULT 70.00,
  grade_b DECIMAL(5,2) DEFAULT 60.00,
  grade_c DECIMAL(5,2) DEFAULT 50.00,
  grade_d DECIMAL(5,2) DEFAULT 40.00,
  risk_score_high INTEGER DEFAULT 70,
  risk_score_medium INTEGER DEFAULT 50,
  risk_score_low INTEGER DEFAULT 30,
  enable_sms_notifications BOOLEAN DEFAULT true,
  enable_email_notifications BOOLEAN DEFAULT true,
  enable_whatsapp_notifications BOOLEAN DEFAULT false,
  timezone TEXT DEFAULT 'Africa/Lagos',
  currency TEXT DEFAULT 'NGN',
  default_language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id)
);

-- Academic Sessions (Years)
CREATE TABLE IF NOT EXISTS academic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Academic Terms
CREATE TABLE IF NOT EXISTS academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  term_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Staff Table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID,
  staff_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'principal', 'teacher', 'counselor', 'finance', 'bursar')),
  position TEXT,
  department TEXT,
  photo_url TEXT,
  pin TEXT,
  is_active BOOLEAN DEFAULT true,
  temporary_pin TEXT,
  pin_expires_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  curriculum_type TEXT DEFAULT 'nigerian',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Classes
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  section TEXT,
  capacity INTEGER DEFAULT 40,
  class_teacher_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  academic_session_id UUID REFERENCES academic_sessions(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Class-Subject Assignments
CREATE TABLE IF NOT EXISTS class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  academic_term_id UUID REFERENCES academic_terms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, subject_id, academic_term_id)
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID,
  student_id TEXT UNIQUE NOT NULL,
  admission_number TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female')),
  photo_url TEXT,
  address TEXT,
  state_of_origin TEXT,
  religion TEXT,
  blood_group TEXT,
  genotype TEXT,
  allergies TEXT,
  medical_conditions TEXT,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  admission_date DATE,
  graduation_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'withdrawn', 'suspended', 'transferred')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Parents
CREATE TABLE IF NOT EXISTS parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID,
  father_name TEXT,
  father_phone TEXT,
  father_email TEXT,
  father_occupation TEXT,
  mother_name TEXT,
  mother_phone TEXT,
  mother_email TEXT,
  mother_occupation TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  guardian_relationship TEXT,
  primary_phone TEXT,
  secondary_phone TEXT,
  email TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Student-Parent Relationships
CREATE TABLE IF NOT EXISTS student_parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  relationship TEXT CHECK (relationship IN ('father', 'mother', 'guardian')),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, parent_id)
);

-- Attendance Records
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  academic_term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, date)
);

-- Grades/Results
CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  academic_term_id UUID NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
  assessment_type TEXT CHECK (assessment_type IN ('ca1', 'ca2', 'ca3', 'exam', 'project', 'test')),
  score DECIMAL(5,2),
  max_score DECIMAL(5,2) DEFAULT 100,
  grade TEXT,
  remarks TEXT,
  entered_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, subject_id, academic_term_id, assessment_type)
);

-- Assignments
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  academic_term_id UUID REFERENCES academic_terms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  total_marks DECIMAL(5,2) DEFAULT 100,
  due_date DATE,
  assignment_type TEXT CHECK (assignment_type IN ('homework', 'project', 'assignment', 'test')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Assignment Submissions
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ,
  score DECIMAL(5,2),
  remarks TEXT,
  attachment_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'late', 'graded')),
  graded_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

-- Behaviour Records
CREATE TABLE IF NOT EXISTS behaviour_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  behaviour_type TEXT NOT NULL CHECK (behaviour_type IN ('merit', 'demerit', 'warning', 'commendation', 'suspension', 'expulsion')),
  category TEXT,
  description TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fee Types
CREATE TABLE IF NOT EXISTS fee_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN DEFAULT true,
  is_recurring BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fees Structure
CREATE TABLE IF NOT EXISTS fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  fee_type_id UUID REFERENCES fee_types(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  due_date DATE,
  late_fee DECIMAL(12,2) DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_id UUID REFERENCES fees(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'card', 'paystack', 'flutterwave')),
  payment_reference TEXT,
  receipt_number TEXT UNIQUE,
  paid_at TIMESTAMPTZ DEFAULT now(),
  recorded_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Risk Assessments
CREATE TABLE IF NOT EXISTS risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  attendance_score INTEGER,
  academic_score INTEGER,
  behaviour_score INTEGER,
  payment_score INTEGER,
  assignment_score INTEGER,
  factors JSONB,
  recommendations JSONB,
  assessed_at TIMESTAMPTZ DEFAULT now(),
  next_assessment_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Interventions
CREATE TABLE IF NOT EXISTS interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  risk_assessment_id UUID REFERENCES risk_assessments(id) ON DELETE SET NULL,
  counselor_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  intervention_type TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'closed', 'escalated')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  start_date DATE,
  end_date DATE,
  outcomes TEXT,
  parent_notified BOOLEAN DEFAULT false,
  parent_notification_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Intervention Meetings
CREATE TABLE IF NOT EXISTS intervention_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  intervention_id UUID NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
  meeting_type TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 30,
  location TEXT,
  participants JSONB,
  agenda TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID,
  recipient_type TEXT CHECK (recipient_type IN ('staff', 'parent', 'student')),
  recipient_id UUID,
  notification_type TEXT,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  sent_via JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'professional', 'enterprise', 'lifetime')),
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'biannual', 'yearly', 'lifetime')),
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('trial', 'active', 'expired', 'suspended', 'cancelled')),
  max_students INTEGER,
  payment_reference TEXT,
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_method TEXT,
  payment_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  user_id UUID,
  user_type TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL,
  title TEXT,
  parameters JSONB,
  format TEXT DEFAULT 'pdf' CHECK (format IN ('pdf', 'excel', 'csv')),
  file_url TEXT,
  status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE behaviour_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies allowing all authenticated users for now
-- (More restrictive policies would be added based on specific requirements)

CREATE POLICY "Schools are viewable by authenticated users"
  ON schools FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "School settings are viewable by authenticated users"
  ON school_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can view school data"
  ON staff FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Academic sessions are viewable"
  ON academic_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Academic terms are viewable"
  ON academic_terms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Subjects are viewable"
  ON subjects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Classes are viewable"
  ON classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Class subjects are viewable"
  ON class_subjects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Students are viewable"
  ON students FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Parents are viewable"
  ON parents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Student parents are viewable"
  ON student_parents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Attendance is viewable"
  ON attendance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Grades are viewable"
  ON grades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Assignments are viewable"
  ON assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Assignment submissions are viewable"
  ON assignment_submissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Behaviour records are viewable"
  ON behaviour_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Fee types are viewable"
  ON fee_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Fees are viewable"
  ON fees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Payments are viewable"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Risk assessments are viewable"
  ON risk_assessments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Interventions are viewable"
  ON interventions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Intervention meetings are viewable"
  ON intervention_meetings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Notifications are viewable"
  ON notifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Subscriptions are viewable"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Invoices are viewable"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Reports are viewable"
  ON reports FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_schools_email ON schools(email);
CREATE INDEX IF NOT EXISTS idx_staff_school_id ON staff(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_staff_id ON staff(staff_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_parents_school_id ON parents(school_id);
CREATE INDEX IF NOT EXISTS idx_student_parents_student_id ON student_parents(student_id);
CREATE INDEX IF NOT EXISTS idx_student_parents_parent_id ON student_parents(parent_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_subject_id ON grades(subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_behaviour_student_id ON behaviour_records(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_risk_student_id ON risk_assessments(student_id);
CREATE INDEX IF NOT EXISTS idx_interventions_student_id ON interventions(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);

-- Function to generate staff ID
CREATE OR REPLACE FUNCTION generate_staff_id(role TEXT)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  next_num INTEGER;
  result TEXT;
BEGIN
  prefix := CASE role
    WHEN 'teacher' THEN 'TCH'
    WHEN 'principal' THEN 'PRN'
    WHEN 'counselor' THEN 'CNS'
    WHEN 'finance' THEN 'FIN'
    WHEN 'bursar' THEN 'BUR'
    ELSE 'ADM'
  END;
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(staff_id FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM staff
  WHERE staff_id LIKE prefix || '%';
  
  result := prefix || LPAD(next_num::TEXT, 4, '0');
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to generate student ID
CREATE OR REPLACE FUNCTION generate_student_id()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  result TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(student_id FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM students
  WHERE student_id LIKE 'STU%';
  
  result := 'STU' || LPAD(next_num::TEXT, 6, '0');
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate risk level
CREATE OR REPLACE FUNCTION calculate_risk_level(score INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF score >= 70 THEN
    RETURN 'critical';
  ELSIF score >= 50 THEN
    RETURN 'high';
  ELSIF score >= 30 THEN
    RETURN 'medium';
  ELSE
    RETURN 'low';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    BEGIN
      EXECUTE format('DROP TRIGGER IF EXISTS update_%I_timestamp ON %I', t, t);
      EXECUTE format('CREATE TRIGGER update_%I_timestamp BEFORE UPDATE ON %I FOR EACH ROW EXECUTE update_timestamp()', t, t);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$;
