/*
  Hope Bay College — bulk seed / top-up script
  ============================================================
  Targets (totals after run):
    • Full class ladder (early years → SS3, sections A & B)
    • 300 active students   (skips if already at/above 300)
    • 20 active teachers    (skips if already at/above 20)
    • Subjects (Nigerian curriculum set)
    • Parents + student_parents links for students missing a parent
    • Fee obligations (term tuition) for students missing fees
    • Attendance (last 20 weekdays) for students missing those dates
    • Risk scores + student alerts for a sample of at-risk pupils

  HOW TO RUN
  ----------
  1. Supabase Dashboard → SQL Editor → New query
  2. Paste this entire file and click Run
  3. Check the NOTICE messages at the bottom for counts

  Safe to re-run: uses NOT EXISTS / ON CONFLICT DO NOTHING where possible.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Resolve Hope Bay College + current session/term
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_school_id   UUID;
  v_session_id  UUID;
  v_term_id     UUID;
  v_students_before INT;
  v_students_after  INT;
  v_teachers_before INT;
  v_teachers_after  INT;
BEGIN
  SELECT id INTO v_school_id
  FROM schools
  WHERE name ILIKE '%Hope Bay College%'
  ORDER BY created_at
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'School "Hope Bay College" not found. Check the exact name in public.schools.';
  END IF;

  SELECT id INTO v_session_id
  FROM academic_sessions
  WHERE school_id = v_school_id AND is_current = true
  ORDER BY start_date DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    INSERT INTO academic_sessions (school_id, name, start_date, end_date, is_current)
    VALUES (
      v_school_id,
      to_char(CURRENT_DATE, 'YYYY') || '/' || to_char(CURRENT_DATE + INTERVAL '1 year', 'YYYY') || ' Session',
      date_trunc('year', CURRENT_DATE)::date,
      (date_trunc('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day')::date,
      true
    )
    RETURNING id INTO v_session_id;
  END IF;

  SELECT id INTO v_term_id
  FROM academic_terms
  WHERE school_id = v_school_id AND session_id = v_session_id AND is_current = true
  ORDER BY term_number
  LIMIT 1;

  IF v_term_id IS NULL THEN
    INSERT INTO academic_terms (school_id, session_id, name, term_number, start_date, end_date, is_current)
    VALUES (
      v_school_id, v_session_id, 'First Term', 1,
      date_trunc('year', CURRENT_DATE)::date,
      (date_trunc('year', CURRENT_DATE) + INTERVAL '4 months')::date,
      true
    )
    RETURNING id INTO v_term_id;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _hbc_ctx (
    school_id UUID, session_id UUID, term_id UUID
  ) ON COMMIT DROP;
  DELETE FROM _hbc_ctx;
  INSERT INTO _hbc_ctx VALUES (v_school_id, v_session_id, v_term_id);

  SELECT count(*) INTO v_students_before FROM students WHERE school_id = v_school_id AND status = 'active';
  SELECT count(*) INTO v_teachers_before FROM staff WHERE school_id = v_school_id AND role = 'teacher' AND is_active = true;

  RAISE NOTICE 'Hope Bay College id: %', v_school_id;
  RAISE NOTICE 'Session: % | Term: %', v_session_id, v_term_id;
  RAISE NOTICE 'Before — students: %, teachers: %', v_students_before, v_teachers_before;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) CLASSES — full school ladder (skips grade + section combos that exist)
--    Names match the app: "Primary 1 — Section A"
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO classes (school_id, name, grade_level, section, capacity, is_active, is_early_years)
SELECT
  c.school_id,
  cl.grade_level || ' — Section ' || cl.section AS name,
  cl.grade_level,
  cl.section,
  40,
  true,
  cl.is_early_years
FROM _hbc_ctx c
CROSS JOIN (VALUES
  -- Early years (₦65,000 – ₦75,000)
  ('Creche',       'A', true),  ('Creche',       'B', true),
  ('Playgroup',    'A', true),  ('Playgroup',    'B', true),
  ('Nursery 1',    'A', true),  ('Nursery 1',    'B', true),
  ('Nursery 2',    'A', true),  ('Nursery 2',    'B', true),
  ('Nursery 3',    'A', true),
  ('Kindergarten', 'A', true),  ('Kindergarten', 'B', true),
  -- Primary (₦120,000)
  ('Primary 1', 'A', false), ('Primary 1', 'B', false),
  ('Primary 2', 'A', false), ('Primary 2', 'B', false),
  ('Primary 3', 'A', false), ('Primary 3', 'B', false),
  ('Primary 4', 'A', false), ('Primary 4', 'B', false),
  ('Primary 5', 'A', false), ('Primary 5', 'B', false),
  ('Primary 6', 'A', false), ('Primary 6', 'B', false),
  -- Junior secondary (₦150,000)
  ('JSS1', 'A', false), ('JSS1', 'B', false),
  ('JSS2', 'A', false), ('JSS2', 'B', false),
  ('JSS3', 'A', false), ('JSS3', 'B', false),
  -- Senior secondary (₦150,000)
  ('SS1', 'A', false), ('SS1', 'B', false),
  ('SS2', 'A', false), ('SS2', 'B', false),
  ('SS3', 'A', false), ('SS3', 'B', false)
) AS cl(grade_level, section, is_early_years)
WHERE NOT EXISTS (
  SELECT 1 FROM classes x
  WHERE x.school_id = c.school_id
    AND x.grade_level = cl.grade_level
    AND coalesce(x.section, '') = cl.section
    AND x.is_active = true
);

-- Back-fill is_early_years on any existing early-years rows
UPDATE classes cl
SET is_early_years = true
FROM _hbc_ctx c
WHERE cl.school_id = c.school_id
  AND cl.is_active = true
  AND (
    cl.grade_level ILIKE ANY (ARRAY['%creche%','%playgroup%','%nursery%','%kindergarten%'])
    OR cl.grade_level ~* '^(creche|playgroup|nursery|kindergarten|kg)'
  )
  AND cl.is_early_years IS DISTINCT FROM true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) SUBJECTS (skip if name already exists for this school)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO subjects (school_id, name, code, curriculum_type, is_active)
SELECT c.school_id, s.name, s.code, 'nigerian', true
FROM _hbc_ctx c
CROSS JOIN (VALUES
  ('Mathematics',              'MTH'),
  ('English Language',         'ENG'),
  ('Basic Science',            'BSC'),
  ('Social Studies',           'SST'),
  ('Civic Education',          'CIV'),
  ('Computer Studies',         'CMP'),
  ('Christian Religious Studies','CRS'),
  ('Physical & Health Education','PHE'),
  ('Agricultural Science',     'AGR'),
  ('Home Economics',           'HEC'),
  ('Yoruba',                   'YOR'),
  ('Igbo',                     'IGB'),
  ('Hausa',                    'HAU'),
  ('French',                   'FRN'),
  ('Fine Arts',                'ART'),
  ('Music',                    'MUS'),
  ('Verbal Reasoning',         'VRN'),
  ('Quantitative Reasoning',   'QRN'),
  ('Literature in English',    'LIT'),
  ('Economics',                'ECO')
) AS s(name, code)
WHERE NOT EXISTS (
  SELECT 1 FROM subjects x
  WHERE x.school_id = c.school_id AND lower(x.name) = lower(s.name)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) TEACHERS — top up to 20 (HBC_TCH0001 … HBC_TCH0020)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO staff (school_id, staff_id, full_name, email, phone, role, pin, is_active)
SELECT
  c.school_id,
  'HBC_TCH' || lpad(g.n::text, 4, '0'),
  (ARRAY[
    'Adaeze Okonkwo','Chinedu Eze','Fatima Bello','Emeka Nwosu','Amina Yusuf',
    'Tunde Bakare','Ngozi Okafor','Ibrahim Musa','Blessing Adeyemi','Kelechi Amadi',
    'Halima Garba','Obinna Ibe','Zainab Aliyu','Segun Oladipo','Chioma Egbuonu',
    'Yusuf Abdullahi','Precious Edet','Samuel Adebanjo','Ruth Akpan','Daniel Ojo'
  ])[g.n],
  'teacher' || g.n || '@hopebaycollege.demo',
  '080' || lpad((3000000000 + g.n)::text, 8, '0'),
  'teacher',
  lpad((1000 + g.n)::text, 4, '0'),
  true
FROM _hbc_ctx c
CROSS JOIN generate_series(1, 20) AS g(n)
WHERE NOT EXISTS (
  SELECT 1 FROM staff s
  WHERE s.school_id = c.school_id AND s.staff_id = 'HBC_TCH' || lpad(g.n::text, 4, '0')
);

-- Assign a form teacher to classes that don't have one yet
WITH ctx AS (SELECT school_id FROM _hbc_ctx LIMIT 1),
teacher_pool AS (
  SELECT id, row_number() OVER (ORDER BY staff_id) - 1 AS rn
  FROM staff s
  JOIN ctx ON s.school_id = ctx.school_id
  WHERE s.role = 'teacher' AND s.is_active = true
),
classes_needing AS (
  SELECT cl.id, row_number() OVER (ORDER BY cl.grade_level, cl.section, cl.name) - 1 AS rn
  FROM classes cl
  JOIN ctx ON cl.school_id = ctx.school_id
  WHERE cl.is_active = true AND cl.class_teacher_id IS NULL
)
UPDATE classes cl
SET class_teacher_id = tp.id,
    updated_at = now()
FROM classes_needing cn
JOIN teacher_pool tp ON tp.rn = cn.rn % greatest((SELECT count(*) FROM teacher_pool), 1)
WHERE cl.id = cn.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) STUDENTS — top up to 300 active (HBC_STU000001 … HBC_STU000300)
--    Distributed round-robin across active classes
-- ─────────────────────────────────────────────────────────────────────────────
WITH ctx AS (SELECT school_id, session_id, term_id FROM _hbc_ctx LIMIT 1),
class_pool AS (
  SELECT cl.id AS class_id,
         row_number() OVER (ORDER BY cl.grade_level, cl.section, cl.name) - 1 AS rn,
         count(*) OVER () AS class_count
  FROM classes cl
  JOIN ctx ON cl.school_id = ctx.school_id
  WHERE cl.is_active = true
),
bounds AS (
  SELECT
    coalesce(max(
      CASE WHEN s.student_id ~ '^HBC_STU[0-9]+$'
           THEN substring(s.student_id from '[0-9]+$')::int ELSE 0 END
    ), 0) AS max_num,
    greatest(0, 300 - count(*) FILTER (WHERE s.status = 'active')) AS to_add
  FROM ctx
  LEFT JOIN students s ON s.school_id = ctx.school_id
),
first_names AS (
  SELECT unnest(ARRAY[
    'Chiamaka','Emmanuel','Aisha','Ifeanyi','Halima','Tobi','Nneka','Usman','Grace','David',
    'Fatima','Michael','Adesuwa','Abubakar','Blessing','Kelvin','Zainab','Samuel','Ebere','Victor',
    'Amina','Daniel','Chioma','Musa','Precious','Joseph','Hadiza','Peter','Ruth','Paul',
    'Joy','Andrew','Maryam','Simon','Faith','John','Khadija','Mark','Hope','James',
    'Peace','Thomas','Salma','George','Mercy','Stephen','Aisha','Philip','Gift','Matthew'
  ]) AS fn
),
last_names AS (
  SELECT unnest(ARRAY[
    'Okafor','Adeyemi','Bello','Nwachukwu','Yusuf','Bakare','Eze','Musa','Okoro','Adebanjo',
    'Garba','Ibe','Aliyu','Oladipo','Egbuonu','Abdullahi','Edet','Akpan','Ojo','Chukwu',
    'Nnamani','Obi','Sule','Danjuma','Ekwueme','Uche','Lawal','Igwe','Onyeka','Sani'
  ]) AS ln
),
to_insert AS (
  SELECT
    g.i,
    'HBC_STU' || lpad(g.i::text, 6, '0') AS student_id,
    (SELECT fn FROM first_names OFFSET (g.i % 50) LIMIT 1) AS first_name,
    (SELECT ln FROM last_names OFFSET (g.i % 30) LIMIT 1) AS last_name,
    CASE WHEN g.i % 2 = 0 THEN 'male' ELSE 'female' END AS gender,
    (CURRENT_DATE - ((5 + (g.i % 10)) * INTERVAL '1 year') - ((g.i % 365) * INTERVAL '1 day'))::date AS dob,
    cp.class_id
  FROM bounds b
  JOIN generate_series(b.max_num + 1, b.max_num + b.to_add) AS g(i) ON b.to_add > 0
  JOIN class_pool cp ON cp.class_count > 0 AND cp.rn = (g.i - 1) % cp.class_count
)
INSERT INTO students (
  school_id, student_id, first_name, last_name, gender, date_of_birth,
  class_id, status, admission_date
)
SELECT
  c.school_id, t.student_id, t.first_name, t.last_name, t.gender, t.dob,
  t.class_id, 'active', CURRENT_DATE
FROM to_insert t
CROSS JOIN _hbc_ctx c
ON CONFLICT (student_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) PARENTS + student_parents (one parent per student without a link)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO parents (
  school_id, father_name, father_phone, primary_phone, email, is_active
)
SELECT
  s.school_id,
  'Mr ' || s.last_name,
  '0808' || lpad((abs(hashtext(s.id::text)) % 99999999)::text, 8, '0'),
  '0808' || lpad((abs(hashtext(s.id::text)) % 99999999)::text, 8, '0'),
  lower(replace(s.first_name || '.' || s.last_name, ' ', '')) || '.parent@hopebay.demo',
  true
FROM students s
JOIN _hbc_ctx c ON s.school_id = c.school_id
WHERE s.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM student_parents sp WHERE sp.student_id = s.id);

INSERT INTO student_parents (student_id, parent_id, relationship, is_primary)
SELECT s.id, p.id, 'father', true
FROM students s
JOIN _hbc_ctx c ON s.school_id = c.school_id
JOIN parents p ON p.school_id = s.school_id
  AND p.father_phone = '0808' || lpad((abs(hashtext(s.id::text)) % 99999999)::text, 8, '0')
WHERE s.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM student_parents sp WHERE sp.student_id = s.id)
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) FEE TYPE + FEE STRUCTURES (if missing) + FEE OBLIGATIONS per student
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO fee_types (school_id, name, description, is_mandatory, is_recurring)
SELECT c.school_id, 'Tuition', 'Term tuition fee', true, true
FROM _hbc_ctx c
WHERE NOT EXISTS (
  SELECT 1 FROM fee_types ft WHERE ft.school_id = c.school_id AND ft.name = 'Tuition'
);

INSERT INTO fee_structures (school_id, session_id, class_id, fee_type_id, amount, description, is_active)
SELECT
  c.school_id, c.session_id, cl.id, ft.id,
  CASE
    WHEN cl.grade_level ILIKE '%creche%' OR cl.grade_level ILIKE '%playgroup%' THEN 65000
    WHEN cl.grade_level ILIKE '%nursery%' OR cl.grade_level ILIKE '%kindergarten%' THEN 75000
    WHEN cl.grade_level ILIKE '%primary%' THEN 120000
    WHEN cl.grade_level ILIKE '%jss%' OR cl.grade_level ILIKE '%ss%' THEN 150000
    ELSE 100000
  END,
  'Term tuition — ' || cl.name,
  true
FROM _hbc_ctx c
JOIN classes cl ON cl.school_id = c.school_id AND cl.is_active = true
JOIN fee_types ft ON ft.school_id = c.school_id AND ft.name = 'Tuition'
WHERE NOT EXISTS (
  SELECT 1 FROM fee_structures fs
  WHERE fs.school_id = c.school_id AND fs.class_id = cl.id AND fs.session_id = c.session_id
);

-- Legacy fees table (used by some dashboards)
INSERT INTO fees (school_id, academic_term_id, class_id, fee_type_id, amount, currency, due_date, description, is_active)
SELECT
  c.school_id, c.term_id, cl.id, ft.id, fs.amount, 'NGN',
  (CURRENT_DATE + INTERVAL '30 days')::date,
  fs.description, true
FROM _hbc_ctx c
JOIN classes cl ON cl.school_id = c.school_id AND cl.is_active = true
JOIN fee_types ft ON ft.school_id = c.school_id AND ft.name = 'Tuition'
JOIN fee_structures fs ON fs.school_id = c.school_id AND fs.class_id = cl.id AND fs.session_id = c.session_id
WHERE NOT EXISTS (
  SELECT 1 FROM fees f
  WHERE f.school_id = c.school_id AND f.class_id = cl.id AND f.academic_term_id = c.term_id
);

INSERT INTO fee_obligations (
  school_id, student_id, fee_structure_id, session_id, term_id,
  amount_due, amount_paid, amount_outstanding, due_date, paid_in_full,
  invoice_number
)
SELECT
  s.school_id, s.id, fs.id, c.session_id, c.term_id,
  fs.amount,
  CASE
    WHEN (hashtext(s.id::text) % 5) = 0 THEN fs.amount
    WHEN (hashtext(s.id::text) % 5) = 1 THEN round(fs.amount * 0.5, 2)
    ELSE 0
  END,
  fs.amount - CASE
    WHEN (hashtext(s.id::text) % 5) = 0 THEN fs.amount
    WHEN (hashtext(s.id::text) % 5) = 1 THEN round(fs.amount * 0.5, 2)
    ELSE 0
  END,
  (CURRENT_DATE + INTERVAL '30 days')::date,
  (hashtext(s.id::text) % 5) = 0,
  'INV-HBC-' || upper(substr(replace(s.student_id, '_', ''), 1, 12)) || '-' || to_char(CURRENT_DATE, 'YYMM')
FROM students s
JOIN _hbc_ctx c ON s.school_id = c.school_id
JOIN fee_structures fs ON fs.school_id = s.school_id AND fs.class_id = s.class_id AND fs.session_id = c.session_id
WHERE s.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM fee_obligations fo
    WHERE fo.student_id = s.id AND fo.fee_structure_id = fs.id AND fo.session_id = c.session_id
  );

-- Sample payment records (~20% fully paid)
INSERT INTO payments (school_id, student_id, amount, payment_method, payment_reference, receipt_number, status, paid_at, notes)
SELECT
  fo.school_id, fo.student_id, fo.amount_paid, 'bank_transfer',
  'PAY-HBC-' || substr(md5(fo.id::text), 1, 10),
  'RCP-HBC-' || substr(md5(fo.id::text), 1, 8),
  'completed', now() - ((hashtext(fo.student_id::text) % 14) * INTERVAL '1 day'),
  'Seed payment — Hope Bay College'
FROM fee_obligations fo
JOIN _hbc_ctx c ON fo.school_id = c.school_id
WHERE fo.amount_paid > 0
  AND NOT EXISTS (
    SELECT 1 FROM payments p WHERE p.student_id = fo.student_id AND p.school_id = fo.school_id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) ATTENDANCE — last 20 weekdays per student (skip existing dates)
-- ─────────────────────────────────────────────────────────────────────────────
WITH ctx AS (SELECT school_id, term_id FROM _hbc_ctx LIMIT 1),
days AS (
  SELECT d::date AS dt
  FROM generate_series(CURRENT_DATE - 30, CURRENT_DATE, '1 day') AS d
  WHERE extract(isodow FROM d) < 6
  ORDER BY d DESC
  LIMIT 20
),
pairs AS (
  SELECT s.id AS student_id, s.school_id, s.class_id, ctx.term_id, days.dt
  FROM students s
  JOIN ctx ON s.school_id = ctx.school_id
  CROSS JOIN days
  WHERE s.status = 'active'
)
INSERT INTO attendance (school_id, student_id, class_id, academic_term_id, date, status)
SELECT
  p.school_id, p.student_id, p.class_id, p.term_id, p.dt,
  CASE
    WHEN (hashtext(p.student_id::text || p.dt::text) % 10) < 7 THEN 'present'
    WHEN (hashtext(p.student_id::text || p.dt::text) % 10) < 9 THEN 'absent'
    ELSE 'late'
  END
FROM pairs p
WHERE NOT EXISTS (
  SELECT 1 FROM attendance a WHERE a.student_id = p.student_id AND a.date = p.dt
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8) RISK SCORES + STUDENT ALERTS (~15% medium/high/critical)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO risk_scores (
  school_id, student_id, session_id, term_id,
  attendance_risk, academic_risk, assignment_risk, behaviour_risk, fee_risk,
  overall_risk, risk_level, factors_considered, last_calculated
)
SELECT
  s.school_id, s.id, c.session_id, c.term_id,
  (hashtext(s.id::text) % 40)::numeric,
  (hashtext(s.id::text || 'a') % 50)::numeric,
  (hashtext(s.id::text || 'b') % 35)::numeric,
  (hashtext(s.id::text || 'c') % 25)::numeric,
  (hashtext(s.id::text || 'f') % 45)::numeric,
  LEAST(100, (hashtext(s.id::text) % 30) + (hashtext(s.id::text || 'x') % 40) + 20)::numeric,
  CASE
    WHEN (hashtext(s.id::text) % 20) >= 17 THEN 'critical'
    WHEN (hashtext(s.id::text) % 20) >= 14 THEN 'high'
    WHEN (hashtext(s.id::text) % 20) >= 10 THEN 'medium'
    ELSE 'low'
  END,
  ARRAY['attendance','academic','assignment','behaviour','fee'],
  now()
FROM students s
JOIN _hbc_ctx c ON s.school_id = c.school_id
WHERE s.status = 'active'
  AND (hashtext(s.id::text) % 7) = 0
  AND NOT EXISTS (
    SELECT 1 FROM risk_scores rs
    WHERE rs.student_id = s.id AND rs.session_id = c.session_id
  );

INSERT INTO student_alerts (
  school_id, student_id, alert_type, risk_level, title, description,
  recommended_action, status, triggered_by
)
SELECT
  rs.school_id, rs.student_id,
  (ARRAY['attendance','academic_decline','missing_assignment','behaviour_incident','fee_overdue','composite_risk'])[
    1 + (hashtext(rs.student_id::text) % 6)
  ],
  rs.risk_level,
  CASE rs.risk_level
    WHEN 'critical' THEN 'Critical: Immediate intervention required'
    WHEN 'high'     THEN 'High risk: Student needs follow-up'
    WHEN 'medium'   THEN 'Medium risk: Monitor closely'
    ELSE 'Low risk: Routine check-in'
  END,
  'Automated risk flag for ' || st.first_name || ' ' || st.last_name ||
  ' (overall score ' || rs.overall_risk::text || '). Review attendance, grades, and fee status.',
  CASE rs.risk_level
    WHEN 'critical' THEN 'Schedule counselor session within 48 hours and notify principal.'
    WHEN 'high'     THEN 'Contact parent and class teacher this week.'
    ELSE 'Add to weekly counselor review list.'
  END,
  CASE WHEN rs.risk_level IN ('critical','high') THEN 'open' ELSE 'acknowledged' END,
  'system'
FROM risk_scores rs
JOIN students st ON st.id = rs.student_id
JOIN _hbc_ctx c ON rs.school_id = c.school_id
WHERE rs.risk_level IN ('medium','high','critical')
  AND NOT EXISTS (
    SELECT 1 FROM student_alerts sa
    WHERE sa.student_id = rs.student_id
      AND sa.alert_type = (ARRAY['attendance','academic_decline','missing_assignment','behaviour_incident','fee_overdue','composite_risk'])[
        1 + (hashtext(rs.student_id::text) % 6)
      ]
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 9) CLASS-SUBJECT assignments (teachers ↔ subjects for each class)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO class_subjects (school_id, class_id, subject_id, teacher_id, academic_term_id)
SELECT ctx.school_id, cl.id, sub.id, t.id, ctx.term_id
FROM _hbc_ctx ctx
JOIN classes cl ON cl.school_id = ctx.school_id AND cl.is_active = true
JOIN subjects sub ON sub.school_id = ctx.school_id AND sub.is_active = true
JOIN LATERAL (
  SELECT id FROM staff
  WHERE school_id = ctx.school_id AND role = 'teacher' AND is_active = true
  ORDER BY staff_id
  OFFSET (abs(hashtext(cl.id::text || sub.id::text)) % greatest(1, (SELECT count(*) FROM staff WHERE school_id = ctx.school_id AND role = 'teacher')))
  LIMIT 1
) t ON true
WHERE NOT EXISTS (
  SELECT 1 FROM class_subjects cs
  WHERE cs.class_id = cl.id AND cs.subject_id = sub.id AND cs.academic_term_id = ctx.term_id
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Summary
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_school_id UUID;
  v_classes INT;
  v_students INT;
  v_teachers INT;
  v_parents INT;
  v_subjects INT;
  v_attendance INT;
  v_fees INT;
  v_alerts INT;
BEGIN
  SELECT school_id INTO v_school_id FROM _hbc_ctx LIMIT 1;
  SELECT count(*) INTO v_classes FROM classes WHERE school_id = v_school_id AND is_active = true;
  SELECT count(*) INTO v_students FROM students WHERE school_id = v_school_id AND status = 'active';
  SELECT count(*) INTO v_teachers FROM staff WHERE school_id = v_school_id AND role = 'teacher' AND is_active = true;
  SELECT count(*) INTO v_parents FROM parents WHERE school_id = v_school_id;
  SELECT count(*) INTO v_subjects FROM subjects WHERE school_id = v_school_id AND is_active = true;
  SELECT count(*) INTO v_attendance FROM attendance WHERE school_id = v_school_id;
  SELECT count(*) INTO v_fees FROM fee_obligations WHERE school_id = v_school_id;
  SELECT count(*) INTO v_alerts FROM student_alerts WHERE school_id = v_school_id;

  RAISE NOTICE '──────── Hope Bay College seed summary ────────';
  RAISE NOTICE 'Active classes  : % (target ~35)', v_classes;
  RAISE NOTICE 'Active students : % (target 300)', v_students;
  RAISE NOTICE 'Teachers        : % (target 20)', v_teachers;
  RAISE NOTICE 'Parents         : %', v_parents;
  RAISE NOTICE 'Subjects        : %', v_subjects;
  RAISE NOTICE 'Attendance rows : %', v_attendance;
  RAISE NOTICE 'Fee obligations : %', v_fees;
  RAISE NOTICE 'Student alerts  : %', v_alerts;
  RAISE NOTICE '──────────────────────────────────────────────';
END $$;
