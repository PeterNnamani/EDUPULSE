-- Create staff_subjects table to track which subjects each staff member teaches

CREATE TABLE IF NOT EXISTS staff_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, subject_id)
);

-- Add RLS policy for staff_subjects
ALTER TABLE staff_subjects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view staff_subjects for their school
CREATE POLICY "staff_subjects_read" ON staff_subjects
  FOR SELECT USING (true);

-- Allow authenticated users to insert staff_subjects for their school
CREATE POLICY "staff_subjects_insert" ON staff_subjects
  FOR INSERT WITH CHECK (true);

-- Allow authenticated users to update staff_subjects for their school
CREATE POLICY "staff_subjects_update" ON staff_subjects
  FOR UPDATE USING (true) WITH CHECK (true);

-- Allow authenticated users to delete staff_subjects for their school
CREATE POLICY "staff_subjects_delete" ON staff_subjects
  FOR DELETE USING (true);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_staff_subjects_staff_id ON staff_subjects(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_subjects_subject_id ON staff_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_staff_subjects_school_id ON staff_subjects(school_id);
