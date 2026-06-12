/*
  # 029 - Payment config security + schools insert hardening

  - school_payment_config: school-scoped RLS; only admin/finance can write
  - student_virtual_accounts: read for app layer; writes via service role only
  - reconciliation_summaries: school-scoped read; service role writes
  - schools: only authenticated users may insert (registration flow)
*/

-- ============================================================================
-- SCHOOL PAYMENT CONFIG
-- ============================================================================
ALTER TABLE school_payment_config
  ADD COLUMN IF NOT EXISTS monnify_secret_set BOOLEAN NOT NULL DEFAULT false;

UPDATE school_payment_config
SET monnify_secret_set = (monnify_secret_key IS NOT NULL AND btrim(monnify_secret_key) <> '')
WHERE monnify_secret_set IS DISTINCT FROM (monnify_secret_key IS NOT NULL AND btrim(monnify_secret_key) <> '');

-- Client roles must never read raw secret keys (edge function uses service role).
REVOKE SELECT (monnify_secret_key) ON school_payment_config FROM anon, authenticated;
DROP POLICY IF EXISTS "Anyone can view payment config" ON school_payment_config;
DROP POLICY IF EXISTS "Anyone can insert payment config" ON school_payment_config;
DROP POLICY IF EXISTS "Anyone can update payment config" ON school_payment_config;

CREATE POLICY "School members view payment config"
  ON school_payment_config FOR SELECT
  USING (school_id IN (SELECT public.user_school_ids()));

CREATE POLICY "School admins manage payment config"
  ON school_payment_config FOR INSERT
  WITH CHECK (
    school_id IN (SELECT public.user_school_ids())
    AND EXISTS (
      SELECT 1 FROM staff
      WHERE staff.school_id = school_payment_config.school_id
        AND staff.is_active = true
        AND staff.role IN ('admin', 'finance')
        AND (
          staff.user_id = auth.uid()
          OR (
            staff.email IS NOT NULL
            AND lower(staff.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
        )
    )
  );

CREATE POLICY "School admins update payment config"
  ON school_payment_config FOR UPDATE
  USING (
    school_id IN (SELECT public.user_school_ids())
    AND EXISTS (
      SELECT 1 FROM staff
      WHERE staff.school_id = school_payment_config.school_id
        AND staff.is_active = true
        AND staff.role IN ('admin', 'finance')
        AND (
          staff.user_id = auth.uid()
          OR (
            staff.email IS NOT NULL
            AND lower(staff.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
        )
    )
  );

-- ============================================================================
-- STUDENT VIRTUAL ACCOUNTS (parents use anon sessions — keep SELECT open)
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can insert virtual accounts" ON student_virtual_accounts;
DROP POLICY IF EXISTS "Anyone can update virtual accounts" ON student_virtual_accounts;

-- SELECT policy "Anyone can view virtual accounts" remains (migration 021)

-- ============================================================================
-- RECONCILIATION SUMMARIES
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view reconciliation" ON reconciliation_summaries;
DROP POLICY IF EXISTS "Anyone can insert reconciliation" ON reconciliation_summaries;
DROP POLICY IF EXISTS "Anyone can update reconciliation" ON reconciliation_summaries;

CREATE POLICY "School members view reconciliation"
  ON reconciliation_summaries FOR SELECT
  USING (school_id IN (SELECT public.user_school_ids()));

-- Inserts/updates run via service role (edge functions / cron)

-- ============================================================================
-- SCHOOLS — registration requires authenticated Supabase user
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can insert schools" ON schools;

CREATE POLICY "Authenticated users insert schools"
  ON schools FOR INSERT
  TO authenticated
  WITH CHECK (true);
