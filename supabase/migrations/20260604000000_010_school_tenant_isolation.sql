/*
  # School tenant isolation (RLS hardening)

  Replaces permissive USING (true) SELECT policies with school-scoped policies
  for authenticated users linked to a staff record.

  Note: Staff PIN login uses the anon key without Supabase Auth — those sessions
  rely on application-layer .eq('school_id', user.schoolId) filtering.
  Admin email login uses authenticated + these policies.
*/

-- Helper: school IDs the current user belongs to
CREATE OR REPLACE FUNCTION public.user_school_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM staff WHERE user_id = auth.uid()
  UNION
  SELECT (raw_user_meta_data->>'school_id')::uuid
  FROM auth.users
  WHERE id = auth.uid()
    AND raw_user_meta_data->>'school_id' IS NOT NULL;
$$;

-- Drop permissive policies (core tables)
DROP POLICY IF EXISTS "Students are viewable" ON students;
DROP POLICY IF EXISTS "Classes are viewable" ON classes;
DROP POLICY IF EXISTS "Staff can view school data" ON staff;
DROP POLICY IF EXISTS "Attendance is viewable" ON attendance;
DROP POLICY IF EXISTS "Grades are viewable" ON grades;
DROP POLICY IF EXISTS "Behaviour records are viewable" ON behaviour_records;
DROP POLICY IF EXISTS "Subjects are viewable" ON subjects;
DROP POLICY IF EXISTS "Payments are viewable" ON payments;
DROP POLICY IF EXISTS "School settings are viewable by authenticated users" ON school_settings;

-- School-scoped SELECT policies
CREATE POLICY "Users view students in their school"
  ON students FOR SELECT TO authenticated
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Users view classes in their school"
  ON classes FOR SELECT TO authenticated
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Users view staff in their school"
  ON staff FOR SELECT TO authenticated
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Users view attendance in their school"
  ON attendance FOR SELECT TO authenticated
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Users view grades in their school"
  ON grades FOR SELECT TO authenticated
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Users view behaviour in their school"
  ON behaviour_records FOR SELECT TO authenticated
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Users view subjects in their school"
  ON subjects FOR SELECT TO authenticated
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Users view payments in their school"
  ON payments FOR SELECT TO authenticated
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "Users view school settings for their school"
  ON school_settings FOR SELECT TO authenticated
  USING (school_id IN (SELECT public.user_school_ids()));
