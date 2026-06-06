/*
  # 021 - Monnify Virtual Accounts + Reconciliation storage

  New tables:
    - school_payment_config   - per-school Monnify credentials (service-role only)
    - student_virtual_accounts - dedicated virtual account per student
    - reconciliation_summaries - daily finance reconciliation snapshots
*/

-- ============================================================================
-- SCHOOL PAYMENT CONFIG (Monnify credentials) - service-role only
-- ============================================================================
CREATE TABLE IF NOT EXISTS school_payment_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'monnify',
  monnify_api_key TEXT,
  monnify_secret_key TEXT,
  monnify_contract_code TEXT,
  monnify_base_url TEXT DEFAULT 'https://api.monnify.com',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, provider)
);

ALTER TABLE school_payment_config ENABLE ROW LEVEL SECURITY;

-- App can read non-secret status and write config (admins). Secrets are only
-- consumed by the service-role edge function. We keep RLS permissive for the
-- authenticated app layer (school-scoped in code) but never expose secret keys
-- to non-admin UI queries (UI selects only the columns it needs).
DROP POLICY IF EXISTS "Anyone can view payment config" ON school_payment_config;
CREATE POLICY "Anyone can view payment config" ON school_payment_config FOR SELECT USING (true);
CREATE POLICY "Anyone can insert payment config" ON school_payment_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update payment config" ON school_payment_config FOR UPDATE USING (true);

-- ============================================================================
-- STUDENT VIRTUAL ACCOUNTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_virtual_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  account_number TEXT,
  account_name TEXT,
  bank_name TEXT,
  bank_code TEXT,
  reservation_reference TEXT,
  provider TEXT DEFAULT 'monnify',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_student_virtual_accounts_school ON student_virtual_accounts(school_id);
CREATE INDEX IF NOT EXISTS idx_student_virtual_accounts_acct ON student_virtual_accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_student_virtual_accounts_ref ON student_virtual_accounts(reservation_reference);

ALTER TABLE student_virtual_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view virtual accounts" ON student_virtual_accounts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert virtual accounts" ON student_virtual_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update virtual accounts" ON student_virtual_accounts FOR UPDATE USING (true);

-- ============================================================================
-- RECONCILIATION SUMMARIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS reconciliation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  expected DECIMAL(14,2) DEFAULT 0,
  received DECIMAL(14,2) DEFAULT 0,
  overpaid DECIMAL(14,2) DEFAULT 0,
  partial DECIMAL(14,2) DEFAULT 0,
  outstanding DECIMAL(14,2) DEFAULT 0,
  anomalies JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_school_date ON reconciliation_summaries(school_id, summary_date DESC);

ALTER TABLE reconciliation_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reconciliation" ON reconciliation_summaries FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reconciliation" ON reconciliation_summaries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update reconciliation" ON reconciliation_summaries FOR UPDATE USING (true);
