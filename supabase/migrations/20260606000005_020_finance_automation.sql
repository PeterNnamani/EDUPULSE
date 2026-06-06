/*
  # 020 - Advanced Finance Automation

  Builds automation on the proper fee model (fee_structures -> fee_obligations).
    - Seed standard fee_types per school
    - Add invoice_number to fee_obligations (source-of-truth invoice model)
    - New payment_schedules table (installments)
    - Permissive RLS so app-layer automation works (school-scoped in code)
*/

-- ============================================================================
-- SEED STANDARD FEE TYPES (idempotent, per existing school)
-- ============================================================================
INSERT INTO fee_types (school_id, name, description, is_mandatory, is_recurring)
SELECT s.id, ft.name, ft.description, ft.is_mandatory, ft.is_recurring
FROM schools s
CROSS JOIN (
  VALUES
    ('Tuition', 'Termly tuition fee', true, true),
    ('Development Levy', 'Infrastructure & development levy', true, true),
    ('PTA', 'Parent-Teacher Association dues', true, true),
    ('Exam Fees', 'Examination fees', true, true),
    ('Transport', 'School bus / transport fee', false, true),
    ('Hostel', 'Boarding / hostel fee', false, true),
    ('Other Fees', 'Miscellaneous fees', false, false)
) AS ft(name, description, is_mandatory, is_recurring)
WHERE NOT EXISTS (
  SELECT 1 FROM fee_types existing
  WHERE existing.school_id = s.id AND lower(existing.name) = lower(ft.name)
);

-- ============================================================================
-- INVOICE NUMBER on fee_obligations (source of truth)
-- ============================================================================
ALTER TABLE fee_obligations ADD COLUMN IF NOT EXISTS invoice_number TEXT;
CREATE INDEX IF NOT EXISTS idx_fee_obligations_student ON fee_obligations(school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_fee_obligations_invoice ON fee_obligations(school_id, invoice_number);

-- ============================================================================
-- PAYMENT SCHEDULES (installments per obligation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_obligation_id UUID REFERENCES fee_obligations(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_schedules_student ON payment_schedules(school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_due ON payment_schedules(school_id, due_date, status);

ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view payment schedules" ON payment_schedules FOR SELECT USING (true);
CREATE POLICY "Anyone can insert payment schedules" ON payment_schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update payment schedules" ON payment_schedules FOR UPDATE USING (true);

-- ============================================================================
-- PERMISSIVE RLS for fee automation tables (school-scoped in app layer)
-- ============================================================================
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view fee structures" ON fee_structures;
DROP POLICY IF EXISTS "Anyone can manage fee structures" ON fee_structures;
CREATE POLICY "Anyone can view fee structures" ON fee_structures FOR SELECT USING (true);
CREATE POLICY "Anyone can insert fee structures" ON fee_structures FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update fee structures" ON fee_structures FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete fee structures" ON fee_structures FOR DELETE USING (true);

DROP POLICY IF EXISTS "Anyone can view fee obligations" ON fee_obligations;
CREATE POLICY "Anyone can view fee obligations" ON fee_obligations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert fee obligations" ON fee_obligations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update fee obligations" ON fee_obligations FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can view fee types" ON fee_types;
CREATE POLICY "Anyone can view fee types" ON fee_types FOR SELECT USING (true);
CREATE POLICY "Anyone can insert fee types" ON fee_types FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update fee types" ON fee_types FOR UPDATE USING (true);
