/*
  # Admin login + school registration fixes

  - user_school_ids(): also match staff by auth email (fixes login before user_id is linked)
  - Staff: authenticated users can read their own admin row
  - Schools: allow registration inserts
*/

CREATE OR REPLACE FUNCTION public.user_school_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM staff WHERE user_id = auth.uid()
  UNION
  SELECT school_id FROM staff
  WHERE email IS NOT NULL
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  UNION
  SELECT (raw_user_meta_data->>'school_id')::uuid
  FROM auth.users
  WHERE id = auth.uid()
    AND raw_user_meta_data->>'school_id' IS NOT NULL;
$$;

DROP POLICY IF EXISTS "Authenticated users read own staff record" ON staff;
CREATE POLICY "Authenticated users read own staff record"
  ON staff FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      email IS NOT NULL
      AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

DROP POLICY IF EXISTS "Anyone can insert schools" ON schools;
CREATE POLICY "Anyone can insert schools"
  ON schools FOR INSERT
  WITH CHECK (true);
