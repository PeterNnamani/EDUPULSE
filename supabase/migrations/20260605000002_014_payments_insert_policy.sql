/*
  # Payments write access for PIN-based finance staff

  Finance users log in without Supabase Auth; app filters by school_id.
*/

CREATE POLICY "Anyone can insert payments"
  ON payments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update payments"
  ON payments FOR UPDATE
  USING (true);
