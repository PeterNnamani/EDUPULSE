/*
  # Subscription payment + academic lifecycle fixes
*/

-- Allow pending status during Paystack verification
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trial', 'active', 'expired', 'suspended', 'cancelled', 'pending'));

-- Schools: allow app-layer updates (PIN / anon clients)
DROP POLICY IF EXISTS "Anyone can update school subscription" ON schools;
CREATE POLICY "Anyone can update school subscription"
  ON schools FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Promotion rules: reference operational classes table
ALTER TABLE promotion_rules DROP CONSTRAINT IF EXISTS promotion_rules_from_class_id_fkey;
ALTER TABLE promotion_rules DROP CONSTRAINT IF EXISTS promotion_rules_to_class_id_fkey;
ALTER TABLE promotion_rules
  ADD CONSTRAINT promotion_rules_from_class_id_fkey
    FOREIGN KEY (from_class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE promotion_rules
  ADD CONSTRAINT promotion_rules_to_class_id_fkey
    FOREIGN KEY (to_class_id) REFERENCES classes(id) ON DELETE CASCADE;

-- App-layer write access (staff PIN login)
DROP POLICY IF EXISTS "Anyone can manage subscriptions" ON subscriptions;
CREATE POLICY "Anyone can view subscriptions" ON subscriptions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert subscriptions" ON subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update subscriptions" ON subscriptions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can manage invoices" ON invoices;
CREATE POLICY "Anyone can view invoices" ON invoices FOR SELECT USING (true);
CREATE POLICY "Anyone can insert invoices" ON invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update invoices" ON invoices FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can manage student_academic_records" ON student_academic_records;
CREATE POLICY "Anyone can view student_academic_records" ON student_academic_records FOR SELECT USING (true);
CREATE POLICY "Anyone can insert student_academic_records" ON student_academic_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update student_academic_records" ON student_academic_records FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can manage promotion_rules" ON promotion_rules;
CREATE POLICY "Anyone can view promotion_rules" ON promotion_rules FOR SELECT USING (true);
CREATE POLICY "Anyone can insert promotion_rules" ON promotion_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update promotion_rules" ON promotion_rules FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can manage graduation_records" ON graduation_records;
CREATE POLICY "Anyone can view graduation_records" ON graduation_records FOR SELECT USING (true);
CREATE POLICY "Anyone can insert graduation_records" ON graduation_records FOR INSERT WITH CHECK (true);

-- Dedupe subscription reminder notifications per school/day
CREATE TABLE IF NOT EXISTS subscription_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('trial_ending', 'subscription_ending', 'overdue')),
  reminder_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, reminder_type, reminder_date)
);

ALTER TABLE subscription_reminder_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage subscription_reminder_log" ON subscription_reminder_log FOR ALL USING (true);
