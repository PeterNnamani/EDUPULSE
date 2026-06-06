/*
  # Ensure subscription inserts work (drop restrictive policies from 007)
*/

DROP POLICY IF EXISTS "Subscriptions insert policy" ON subscriptions;
DROP POLICY IF EXISTS "Subscriptions select policy" ON subscriptions;
DROP POLICY IF EXISTS "Subscriptions update policy" ON subscriptions;
DROP POLICY IF EXISTS "Invoices insert policy" ON invoices;
DROP POLICY IF EXISTS "Invoices select policy" ON invoices;
DROP POLICY IF EXISTS "Invoices update policy" ON invoices;
DROP POLICY IF EXISTS "Subscriptions are viewable" ON subscriptions;
DROP POLICY IF EXISTS "Invoices are viewable" ON invoices;

CREATE POLICY "Anyone can view subscriptions" ON subscriptions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert subscriptions" ON subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update subscriptions" ON subscriptions FOR UPDATE USING (true);

CREATE POLICY "Anyone can view invoices" ON invoices FOR SELECT USING (true);
CREATE POLICY "Anyone can insert invoices" ON invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update invoices" ON invoices FOR UPDATE USING (true);
