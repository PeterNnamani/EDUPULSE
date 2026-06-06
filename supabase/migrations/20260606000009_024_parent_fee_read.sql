/*
  # 024 - Parent/staff fee read access (anon sessions)

  Parent and staff PIN login use the anon key without Supabase Auth.
  Migration 010 restricted payments/fees to authenticated only, which
  broke fee status on the parent dashboard. Match fee_structures pattern.
*/

DROP POLICY IF EXISTS "Fees are viewable" ON fees;
DROP POLICY IF EXISTS "Payments are viewable" ON payments;
DROP POLICY IF EXISTS "Users view payments in their school" ON payments;

CREATE POLICY "Anyone can view fees" ON fees FOR SELECT USING (true);
CREATE POLICY "Anyone can view payments" ON payments FOR SELECT USING (true);
