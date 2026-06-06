/*
  # 019 - Kindergarten & Preschool Competency Assessment

  Competency-based (rating) assessment for early-years classes instead of numeric scores.

  New tables:
    - preschool_assessments - one row per student/category/term competency rating

  Also flags early-years classes via classes.is_early_years.
*/

-- Flag early-years classes (Creche..Kindergarten)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_early_years BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS preschool_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  academic_term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN (
    'literacy_skills',
    'numeracy_skills',
    'communication_skills',
    'social_development',
    'emotional_development',
    'motor_skills',
    'creativity',
    'participation',
    'personal_hygiene',
    'class_behaviour'
  )),
  rating TEXT NOT NULL CHECK (rating IN (
    'outstanding',
    'excellent',
    'very_good',
    'good',
    'developing',
    'needs_attention'
  )),
  teacher_comment TEXT,
  assessed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  assessed_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, category, academic_term_id)
);

CREATE INDEX IF NOT EXISTS idx_preschool_assessments_student ON preschool_assessments(school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_preschool_assessments_term ON preschool_assessments(school_id, academic_term_id);
CREATE INDEX IF NOT EXISTS idx_preschool_assessments_class ON preschool_assessments(school_id, class_id);

ALTER TABLE preschool_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view preschool assessments" ON preschool_assessments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert preschool assessments" ON preschool_assessments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update preschool assessments" ON preschool_assessments FOR UPDATE USING (true);

-- Best-effort backfill: mark existing early-years classes based on grade_level text
UPDATE classes
SET is_early_years = true
WHERE is_early_years IS DISTINCT FROM true
  AND (
    lower(grade_level) LIKE '%creche%' OR
    lower(grade_level) LIKE '%playgroup%' OR
    lower(grade_level) LIKE '%nursery%' OR
    lower(grade_level) LIKE '%kindergarten%' OR
    lower(grade_level) LIKE '%kg%' OR
    lower(grade_level) LIKE '%pre%'
  );
