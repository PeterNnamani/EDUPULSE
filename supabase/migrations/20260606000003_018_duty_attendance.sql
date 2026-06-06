/*
  # 018 - Teacher-On-Duty Attendance System

  A second attendance layer, separate from classroom attendance. Administrators
  assign weekly duty teachers who record student arrival/departure across all classes.

  New tables:
    - duty_rosters     - weekly duty teacher assignments
    - duty_attendance  - per-student arrival/departure record (one row per student/day)
*/

-- ============================================================================
-- DUTY ROSTERS (weekly assignment)
-- ============================================================================
CREATE TABLE IF NOT EXISTS duty_rosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  staff_name TEXT,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  assigned_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, staff_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_duty_rosters_school_week ON duty_rosters(school_id, week_start, week_end);

ALTER TABLE duty_rosters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view duty rosters" ON duty_rosters FOR SELECT USING (true);
CREATE POLICY "Anyone can insert duty rosters" ON duty_rosters FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update duty rosters" ON duty_rosters FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete duty rosters" ON duty_rosters FOR DELETE USING (true);

-- ============================================================================
-- DUTY ATTENDANCE (arrival / departure)
-- ============================================================================
CREATE TABLE IF NOT EXISTS duty_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  arrival_time TIME,
  departure_time TIME,
  is_late BOOLEAN DEFAULT false,
  is_early_departure BOOLEAN DEFAULT false,
  visitor_notes TEXT,
  pickup_status TEXT CHECK (pickup_status IN ('pending', 'picked_up', 'self', 'bus', 'not_applicable')),
  authorized_pickup_person TEXT,
  transport_method TEXT,
  recorded_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_duty_attendance_school_date ON duty_attendance(school_id, date);
CREATE INDEX IF NOT EXISTS idx_duty_attendance_student ON duty_attendance(student_id, date DESC);

ALTER TABLE duty_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view duty attendance" ON duty_attendance FOR SELECT USING (true);
CREATE POLICY "Anyone can insert duty attendance" ON duty_attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update duty attendance" ON duty_attendance FOR UPDATE USING (true);
