-- Enhanced RLS Policies for Subscriptions and Invoices
-- This migration ensures proper tenant isolation and access control

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Subscriptions can be inserted" ON subscriptions;
DROP POLICY IF EXISTS "Subscriptions can be updated" ON subscriptions;
DROP POLICY IF EXISTS "Invoices can be inserted" ON invoices;
DROP POLICY IF EXISTS "Invoices can be updated" ON invoices;

-- SUBSCRIPTIONS POLICIES

-- Allow authenticated staff to insert subscriptions for their school
CREATE POLICY "Subscriptions insert policy"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be a staff member of the school they're inserting for
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.school_id = subscriptions.school_id
      AND staff.user_id = auth.uid()
      AND staff.is_active = true
      AND staff.role = 'admin'
    )
    OR
    -- Allow service role for backend verification
    auth.role() = 'service_role'
  );

-- Allow authenticated staff to view subscriptions for their school
CREATE POLICY "Subscriptions select policy"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.school_id = subscriptions.school_id
      AND staff.user_id = auth.uid()
    )
    OR
    auth.role() = 'service_role'
  );

-- Allow authenticated staff to update subscriptions for their school
CREATE POLICY "Subscriptions update policy"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.school_id = subscriptions.school_id
      AND staff.user_id = auth.uid()
      AND staff.is_active = true
      AND staff.role = 'admin'
    )
    OR
    auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.school_id = subscriptions.school_id
      AND staff.user_id = auth.uid()
      AND staff.is_active = true
      AND staff.role = 'admin'
    )
    OR
    auth.role() = 'service_role'
  );

-- INVOICES POLICIES

-- Allow authenticated staff to insert invoices for their school
CREATE POLICY "Invoices insert policy"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.school_id = invoices.school_id
      AND staff.user_id = auth.uid()
      AND staff.is_active = true
      AND staff.role IN ('admin', 'finance', 'bursar')
    )
    OR
    auth.role() = 'service_role'
  );

-- Allow authenticated staff to view invoices for their school
CREATE POLICY "Invoices select policy"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.school_id = invoices.school_id
      AND staff.user_id = auth.uid()
    )
    OR
    auth.role() = 'service_role'
  );

-- Allow authenticated staff to update invoices for their school
CREATE POLICY "Invoices update policy"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.school_id = invoices.school_id
      AND staff.user_id = auth.uid()
      AND staff.is_active = true
      AND staff.role IN ('admin', 'finance', 'bursar')
    )
    OR
    auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.school_id = invoices.school_id
      AND staff.user_id = auth.uid()
      AND staff.is_active = true
      AND staff.role IN ('admin', 'finance', 'bursar')
    )
    OR
    auth.role() = 'service_role'
  );

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_school_id_payment_ref ON subscriptions(school_id, payment_reference);
CREATE INDEX IF NOT EXISTS idx_subscriptions_school_id_status ON subscriptions(school_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_school_id_status ON invoices(school_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_reference ON invoices(payment_reference);
