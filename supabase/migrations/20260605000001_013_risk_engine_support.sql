/*
  # Risk engine support — student risk_level + permissive RLS for app-layer auth
*/

ALTER TABLE students ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'low'
  CHECK (risk_level IN ('low', 'medium', 'high', 'critical'));

ALTER TABLE students ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;

-- Allow app (PIN login) to write risk scores and alerts
DROP POLICY IF EXISTS "School staff can view school risk scores" ON risk_scores;

CREATE POLICY "Anyone can view risk scores" ON risk_scores FOR SELECT USING (true);
CREATE POLICY "Anyone can insert risk scores" ON risk_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update risk scores" ON risk_scores FOR UPDATE USING (true);

DROP POLICY IF EXISTS "School staff can view school alerts" ON student_alerts;
DROP POLICY IF EXISTS "System can manage alerts" ON student_alerts;

CREATE POLICY "Anyone can view student alerts" ON student_alerts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert student alerts" ON student_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update student alerts" ON student_alerts FOR UPDATE USING (true);
