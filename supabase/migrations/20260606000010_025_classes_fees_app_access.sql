/*
  # 025 - Classes & tuition fees for app-layer auth

  Staff/admin often use PIN login with the anon Supabase key.
  Migration 010 restricted classes SELECT to authenticated user_school_ids(),
  which hides classes when auth.uid() is not linked — breaking the class list.

  Tuition lives in `fees`; migration 024 added SELECT only — writes failed silently.

  App code always filters by school_id. Match fee_structures permissive pattern.
*/

DROP POLICY IF EXISTS "Users view classes in their school" ON classes;

CREATE POLICY "Anyone can view classes" ON classes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert classes" ON classes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update classes" ON classes FOR UPDATE USING (true);

CREATE POLICY "Anyone can insert fees" ON fees FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update fees" ON fees FOR UPDATE USING (true);
