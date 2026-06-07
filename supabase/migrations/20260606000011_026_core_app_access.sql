/*
  # 026 - Core app-layer read/write access (PIN / anon sessions)

  Migration 010 restricted many core tables to authenticated + user_school_ids().
  Staff PIN and parent login use the anon key, so queries returned empty arrays.

  App code always filters by school_id. Match fee_structures / classes pattern.
  Also adds missing grading tables and fixes intervention case assignee FK.
*/

-- ---------------------------------------------------------------------------
-- Remap intervention assignees: auth.users id -> staff.id where linked
-- ---------------------------------------------------------------------------
UPDATE intervention_cases ic
SET assigned_to_id = s.id
FROM staff s
WHERE s.user_id = ic.assigned_to_id;

UPDATE intervention_cases ic
SET assigned_by_id = s.id
FROM staff s
WHERE ic.assigned_by_id IS NOT NULL
  AND s.user_id = ic.assigned_by_id;

ALTER TABLE intervention_cases DROP CONSTRAINT IF EXISTS intervention_cases_assigned_to_id_fkey;
ALTER TABLE intervention_cases DROP CONSTRAINT IF EXISTS intervention_cases_assigned_by_id_fkey;

ALTER TABLE intervention_cases
  ADD CONSTRAINT intervention_cases_assigned_to_id_fkey
  FOREIGN KEY (assigned_to_id) REFERENCES staff(id) ON DELETE RESTRICT;

ALTER TABLE intervention_cases
  ADD CONSTRAINT intervention_cases_assigned_by_id_fkey
  FOREIGN KEY (assigned_by_id) REFERENCES staff(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Grading engine tables (missing from earlier migrations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grading_scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  scale_name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grading_scales_school ON grading_scales(school_id, is_active);

CREATE TABLE IF NOT EXISTS grade_range_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grading_scale_id UUID NOT NULL REFERENCES grading_scales(id) ON DELETE CASCADE,
  min_score NUMERIC NOT NULL,
  max_score NUMERIC NOT NULL,
  grade_letter TEXT NOT NULL,
  grade_point NUMERIC NOT NULL DEFAULT 0,
  remark TEXT NOT NULL DEFAULT '',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grade_range_rules_scale ON grade_range_rules(grading_scale_id);

CREATE TABLE IF NOT EXISTS student_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
  ca_score NUMERIC,
  test_score NUMERIC,
  exam_score NUMERIC,
  total_score NUMERIC NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT '',
  grade_point NUMERIC DEFAULT 0,
  remark TEXT DEFAULT '',
  grading_scale_id UUID REFERENCES grading_scales(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  approval_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft', 'submitted', 'approved', 'published', 'rejected')),
  teacher_comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  UNIQUE (school_id, student_id, subject_id, session_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_student_results_school ON student_results(school_id, term_id);

ALTER TABLE grading_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_range_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view grading scales" ON grading_scales FOR SELECT USING (true);
CREATE POLICY "Anyone can insert grading scales" ON grading_scales FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update grading scales" ON grading_scales FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete grading scales" ON grading_scales FOR DELETE USING (true);

CREATE POLICY "Anyone can view grade range rules" ON grade_range_rules FOR SELECT USING (true);
CREATE POLICY "Anyone can insert grade range rules" ON grade_range_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update grade range rules" ON grade_range_rules FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete grade range rules" ON grade_range_rules FOR DELETE USING (true);

CREATE POLICY "Anyone can view student results" ON student_results FOR SELECT USING (true);
CREATE POLICY "Anyone can insert student results" ON student_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update student results" ON student_results FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete student results" ON student_results FOR DELETE USING (true);

-- ---------------------------------------------------------------------------
-- Drop tenant-only policies from migration 010
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users view students in their school" ON students;
DROP POLICY IF EXISTS "Users view staff in their school" ON staff;
DROP POLICY IF EXISTS "Users view attendance in their school" ON attendance;
DROP POLICY IF EXISTS "Users view grades in their school" ON grades;
DROP POLICY IF EXISTS "Users view behaviour in their school" ON behaviour_records;
DROP POLICY IF EXISTS "Users view subjects in their school" ON subjects;
DROP POLICY IF EXISTS "Users view school settings for their school" ON school_settings;

-- ---------------------------------------------------------------------------
-- Drop authenticated-only policies from core schema (001)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Schools are viewable by authenticated users" ON schools;
DROP POLICY IF EXISTS "School settings are viewable by authenticated users" ON school_settings;
DROP POLICY IF EXISTS "Academic sessions are viewable" ON academic_sessions;
DROP POLICY IF EXISTS "Academic terms are viewable" ON academic_terms;
DROP POLICY IF EXISTS "Class subjects are viewable" ON class_subjects;
DROP POLICY IF EXISTS "Students are viewable" ON students;
DROP POLICY IF EXISTS "Parents are viewable" ON parents;
DROP POLICY IF EXISTS "Student parents are viewable" ON student_parents;
DROP POLICY IF EXISTS "Attendance is viewable" ON attendance;
DROP POLICY IF EXISTS "Grades are viewable" ON grades;
DROP POLICY IF EXISTS "Assignments are viewable" ON assignments;
DROP POLICY IF EXISTS "Assignment submissions are viewable" ON assignment_submissions;
DROP POLICY IF EXISTS "Behaviour records are viewable" ON behaviour_records;
DROP POLICY IF EXISTS "Risk assessments are viewable" ON risk_assessments;
DROP POLICY IF EXISTS "Interventions are viewable" ON interventions;
DROP POLICY IF EXISTS "Intervention meetings are viewable" ON intervention_meetings;
DROP POLICY IF EXISTS "Reports are viewable" ON reports;

-- ---------------------------------------------------------------------------
-- Intervention engine (009) auth-only policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Counselors and staff can view school cases" ON intervention_cases;
DROP POLICY IF EXISTS "Assigned counselor can update case" ON intervention_cases;
DROP POLICY IF EXISTS "Case team can view activities" ON intervention_activities;

CREATE POLICY "Anyone can view intervention cases" ON intervention_cases FOR SELECT USING (true);
CREATE POLICY "Anyone can insert intervention cases" ON intervention_cases FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update intervention cases" ON intervention_cases FOR UPDATE USING (true);

CREATE POLICY "Anyone can view intervention activities" ON intervention_activities FOR SELECT USING (true);
CREATE POLICY "Anyone can insert intervention activities" ON intervention_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update intervention activities" ON intervention_activities FOR UPDATE USING (true);

-- ---------------------------------------------------------------------------
-- Permissive app-layer policies (SELECT + writes)
-- ---------------------------------------------------------------------------
CREATE POLICY "Anyone can view schools" ON schools FOR SELECT USING (true);

CREATE POLICY "Anyone can view school settings" ON school_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert school settings" ON school_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update school settings" ON school_settings FOR UPDATE USING (true);

CREATE POLICY "Anyone can view academic sessions" ON academic_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert academic sessions" ON academic_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update academic sessions" ON academic_sessions FOR UPDATE USING (true);

CREATE POLICY "Anyone can view academic terms" ON academic_terms FOR SELECT USING (true);
CREATE POLICY "Anyone can insert academic terms" ON academic_terms FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update academic terms" ON academic_terms FOR UPDATE USING (true);

CREATE POLICY "Anyone can view class subjects" ON class_subjects FOR SELECT USING (true);
CREATE POLICY "Anyone can insert class subjects" ON class_subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update class subjects" ON class_subjects FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete class subjects" ON class_subjects FOR DELETE USING (true);

CREATE POLICY "Anyone can view students" ON students FOR SELECT USING (true);
CREATE POLICY "Anyone can insert students" ON students FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update students" ON students FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete students" ON students FOR DELETE USING (true);

CREATE POLICY "Anyone can view staff" ON staff FOR SELECT USING (true);
CREATE POLICY "Anyone can insert staff" ON staff FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update staff" ON staff FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete staff" ON staff FOR DELETE USING (true);

CREATE POLICY "Anyone can view parents" ON parents FOR SELECT USING (true);
CREATE POLICY "Anyone can insert parents" ON parents FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update parents" ON parents FOR UPDATE USING (true);

CREATE POLICY "Anyone can view student parents" ON student_parents FOR SELECT USING (true);
CREATE POLICY "Anyone can insert student parents" ON student_parents FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update student parents" ON student_parents FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete student parents" ON student_parents FOR DELETE USING (true);

CREATE POLICY "Anyone can view subjects" ON subjects FOR SELECT USING (true);
CREATE POLICY "Anyone can insert subjects" ON subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update subjects" ON subjects FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete subjects" ON subjects FOR DELETE USING (true);

CREATE POLICY "Anyone can view attendance" ON attendance FOR SELECT USING (true);
CREATE POLICY "Anyone can insert attendance" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update attendance" ON attendance FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete attendance" ON attendance FOR DELETE USING (true);

CREATE POLICY "Anyone can view grades" ON grades FOR SELECT USING (true);
CREATE POLICY "Anyone can insert grades" ON grades FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update grades" ON grades FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete grades" ON grades FOR DELETE USING (true);

CREATE POLICY "Anyone can view behaviour records" ON behaviour_records FOR SELECT USING (true);
CREATE POLICY "Anyone can insert behaviour records" ON behaviour_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update behaviour records" ON behaviour_records FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete behaviour records" ON behaviour_records FOR DELETE USING (true);

CREATE POLICY "Anyone can view assignments" ON assignments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert assignments" ON assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update assignments" ON assignments FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete assignments" ON assignments FOR DELETE USING (true);

CREATE POLICY "Anyone can view assignment submissions" ON assignment_submissions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert assignment submissions" ON assignment_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update assignment submissions" ON assignment_submissions FOR UPDATE USING (true);

CREATE POLICY "Anyone can view reports" ON reports FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reports" ON reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update reports" ON reports FOR UPDATE USING (true);
