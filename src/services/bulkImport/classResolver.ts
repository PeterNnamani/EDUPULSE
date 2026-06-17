import { supabase } from '@/lib/supabase';

export interface SchoolClass {
  id: string;
  name: string;
  grade_level: string;
  section: string | null;
}

export interface ParsedClassCode {
  code: string;
  gradeLevel: string;
  section: string | null;
}

export function parseExcelClassCode(code: string): ParsedClassCode {
  const c = String(code || '').toUpperCase().trim();
  const m = c.match(/^(NR|KG|PR|JS|SS)(\d+)([A-Z]+)$/);
  if (!m) return { code: c, gradeLevel: c, section: null };

  const [, prefix, level, suffix] = m;
  const label: Record<string, string> = {
    NR: 'Nursery',
    KG: 'Kindergarten',
    PR: 'Primary',
    JS: 'JSS',
    SS: 'SS',
  };

  if (prefix === 'SS') {
    return { code: c, gradeLevel: `SS ${level}`, section: suffix };
  }
  return { code: c, gradeLevel: `${label[prefix]} ${level}`, section: suffix };
}

function sectionsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim().toUpperCase() === (b ?? '').trim().toUpperCase();
}

function gradeMatches(classGrade: string, parsed: ParsedClassCode): boolean {
  const g = classGrade.trim();
  const p = parsed.gradeLevel.trim();
  if (g.toUpperCase() === p.toUpperCase()) return true;
  if (g.toUpperCase().replace(/\s/g, '') === p.toUpperCase().replace(/\s/g, '')) return true;
  if (p.startsWith('JSS ') && g.toUpperCase().includes(p.slice(4))) return true;
  if (p.startsWith('SS ') && (g.toUpperCase().includes('SS ' + p.slice(3)) || g.toUpperCase().includes('SS' + p.slice(3)))) {
    return true;
  }
  return g.toUpperCase().includes(p.split(' ')[0].toUpperCase());
}

export function resolveClassFromList(
  classes: SchoolClass[],
  classCode: string
): SchoolClass | null {
  const parsed = parseExcelClassCode(classCode);
  const compact = parsed.code;

  const exact = classes.find(
    (c) => c.name.toUpperCase().replace(/\s/g, '') === compact
  );
  if (exact) return exact;

  if (parsed.section) {
    const byGradeSection = classes.find(
      (c) => sectionsMatch(c.section, parsed.section) && gradeMatches(c.grade_level, parsed)
    );
    if (byGradeSection) return byGradeSection;
  }

  const fuzzy = classes.find(
    (c) =>
      parsed.section &&
      c.name.toUpperCase().includes(parsed.section) &&
      gradeMatches(c.grade_level, parsed)
  );
  return fuzzy ?? null;
}

export async function loadSchoolClasses(schoolId: string): Promise<SchoolClass[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, grade_level, section')
    .eq('school_id', schoolId)
    .eq('is_active', true);

  if (error) throw new Error(error.message);
  return (data ?? []) as SchoolClass[];
}

export async function ensureClassForCode(
  schoolId: string,
  classCode: string,
  cache: Map<string, SchoolClass>
): Promise<SchoolClass | null> {
  const key = classCode.toUpperCase();
  if (cache.has(key)) return cache.get(key)!;

  const classes = [...cache.values()];
  let found = resolveClassFromList(classes, key);
  if (found) {
    cache.set(key, found);
    return found;
  }

  const parsed = parseExcelClassCode(key);
  if (!parsed.section || !parsed.gradeLevel) return null;

  const displayName = `${parsed.gradeLevel} — Section ${parsed.section}`;
  const isEarlyYears = key.startsWith('NR') || key.startsWith('KG');

  const { data: created, error } = await supabase
    .from('classes')
    .insert({
      school_id: schoolId,
      name: displayName,
      grade_level: parsed.gradeLevel,
      section: parsed.section,
      capacity: 40,
      is_active: true,
      is_early_years: isEarlyYears,
    })
    .select('id, name, grade_level, section')
    .single();

  if (error) {
    const { data: existing } = await supabase
      .from('classes')
      .select('id, name, grade_level, section')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .ilike('grade_level', parsed.gradeLevel)
      .eq('section', parsed.section)
      .maybeSingle();

    if (existing) {
      found = existing as SchoolClass;
      cache.set(key, found);
      return found;
    }
    return null;
  }

  found = created as SchoolClass;
  cache.set(key, found);
  return found;
}
