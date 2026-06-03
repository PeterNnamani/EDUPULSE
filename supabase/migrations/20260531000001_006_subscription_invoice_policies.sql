-- Add INSERT and UPDATE policies for subscriptions and invoices tables

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Subscriptions can be inserted" ON subscriptions;
DROP POLICY IF EXISTS "Subscriptions can be updated" ON subscriptions;
DROP POLICY IF EXISTS "Invoices can be inserted" ON invoices;
DROP POLICY IF EXISTS "Invoices can be updated" ON invoices;

-- Allow authenticated staff to insert subscriptions
CREATE POLICY "Subscriptions can be inserted"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated staff to update subscriptions
CREATE POLICY "Subscriptions can be updated"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated staff to insert invoices
CREATE POLICY "Invoices can be inserted"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated staff to update invoices
CREATE POLICY "Invoices can be updated"
  ON invoices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
