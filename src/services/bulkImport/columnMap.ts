import { normalizePhone } from '@/utils/phoneUtils';

export type BulkImportType = 'students' | 'staff' | 'unknown';

export interface ParsedStudentRow {
  rowIndex: number;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  classCode: string;
  fatherPhone?: string;
  motherPhone?: string;
  fatherName?: string;
  fatherEmail?: string;
  fatherAddress?: string;
  motherName?: string;
  motherAddress?: string;
  stateOfOrigin?: string;
  religion?: string;
  bloodGroup?: string;
  genotype?: string;
  disability?: string;
}

export interface ParsedStaffRow {
  rowIndex: number;
  fullName: string;
  email?: string;
  phone: string;
  role: string;
  department?: string;
}

function normHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pick(row: Record<string, unknown>, ...needles: string[]): string {
  for (const [key, value] of Object.entries(row)) {
    const h = normHeader(key);
    if (needles.some((n) => h.includes(n))) {
      const s = String(value ?? '').trim();
      if (s && s !== '--') return s;
    }
  }
  return '';
}

function pickPhone(row: Record<string, unknown>, ...needles: string[]): string | undefined {
  const raw = pick(row, ...needles);
  if (!raw) return undefined;
  const n = normalizePhone(raw);
  if (!n || n.length < 12 || raw === '080') return undefined;
  return n;
}

function cleanName(v: string): string {
  const s = v.trim();
  if (!s || s === '--' || s === '.') return '';
  return s.replace(/\s+/g, ' ');
}

function parseDob(v: string): string | undefined {
  if (!v || v === '--') return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function parseGender(v: string): 'male' | 'female' | undefined {
  const g = v.trim().toLowerCase();
  if (g === 'male' || g === 'm') return 'male';
  if (g === 'female' || g === 'f') return 'female';
  return undefined;
}

const STAFF_ROLES = new Set([
  'admin',
  'principal',
  'teacher',
  'counselor',
  'finance',
  'bursar',
]);

export function detectImportType(headers: string[]): BulkImportType {
  const joined = headers.map(normHeader).join('|');
  if (
    joined.includes('cur class') ||
    joined.includes('class adm') ||
    (joined.includes('firstname') && joined.includes('father'))
  ) {
    return 'students';
  }
  if (
    (joined.includes('full name') || joined.includes('staff name')) &&
    (joined.includes('role') || joined.includes('staff role'))
  ) {
    return 'staff';
  }
  if (joined.includes('firstname') && joined.includes('lastname') && joined.includes('class')) {
    return 'students';
  }
  return 'unknown';
}

export function mapStudentRow(
  row: Record<string, unknown>,
  rowIndex: number
): ParsedStudentRow | null {
  const firstName = cleanName(pick(row, 'firstname', 'first name'));
  const lastName = cleanName(pick(row, 'lastname', 'last name', 'surname'));
  const middleName = cleanName(pick(row, 'middlename', 'middle name', 'other name')) || undefined;

  const classCode = (
    pick(row, 'cur class', 'current class', 'class') ||
    pick(row, 'class adm', 'admission class')
  ).toUpperCase();

  if (!lastName && !firstName) return null;
  if (!classCode) return null;

  const fatherPhone = pickPhone(row, 'dad', 'father phone');
  const motherPhone = pickPhone(row, 'mum', 'mother phone');

  return {
    rowIndex,
    firstName: firstName || '.',
    lastName: lastName || firstName || 'STUDENT',
    middleName,
    dateOfBirth: parseDob(pick(row, 'date of birth', 'dob', 'birth')),
    gender: parseGender(pick(row, 'gender', 'sex')),
    classCode,
    fatherPhone,
    motherPhone,
    fatherName: cleanName(pick(row, 'father name', 'fathers name')) || undefined,
    fatherEmail: cleanName(pick(row, 'father email')) || undefined,
    fatherAddress: cleanName(pick(row, 'father address')) || undefined,
    motherName: cleanName(pick(row, 'mother name', 'mothers name')) || undefined,
    motherAddress: cleanName(pick(row, 'mother address')) || undefined,
    stateOfOrigin: cleanName(pick(row, 'state', 'state of origin')) || undefined,
    religion: cleanName(pick(row, 'religion')) || undefined,
    bloodGroup: cleanName(pick(row, 'blood')) || undefined,
    genotype: cleanName(pick(row, 'genotype')) || undefined,
    disability: (() => {
      const d = cleanName(pick(row, 'disability'));
      if (!d || d.toUpperCase() === 'NONE') return undefined;
      return d;
    })(),
  };
}

export function mapStaffRow(row: Record<string, unknown>, rowIndex: number): ParsedStaffRow | null {
  const fullName = cleanName(
    pick(row, 'full name', 'staff name', 'name') ||
      `${pick(row, 'first name', 'firstname')} ${pick(row, 'last name', 'lastname')}`.trim()
  );
  const phone = pick(row, 'phone', 'mobile', 'telephone');
  const normalized = normalizePhone(phone);

  if (!fullName) return null;
  if (!normalized) return null;

  let role = pick(row, 'role', 'staff role').toLowerCase() || 'teacher';
  if (!STAFF_ROLES.has(role)) {
    if (role.includes('teach')) role = 'teacher';
    else if (role.includes('princ')) role = 'principal';
    else if (role.includes('coun')) role = 'counselor';
    else if (role.includes('fin') || role.includes('burs')) role = 'finance';
    else if (role.includes('admin')) role = 'admin';
    else role = 'teacher';
  }

  return {
    rowIndex,
    fullName,
    email: cleanName(pick(row, 'email')) || undefined,
    phone: normalized,
    role,
    department: cleanName(pick(row, 'department')) || undefined,
  };
}

export function mapStudentRows(rows: Record<string, unknown>[]): ParsedStudentRow[] {
  return rows
    .map((row, i) => mapStudentRow(row, i + 2))
    .filter((r): r is ParsedStudentRow => r !== null);
}

export function mapStaffRows(rows: Record<string, unknown>[]): ParsedStaffRow[] {
  return rows
    .map((row, i) => mapStaffRow(row, i + 2))
    .filter((r): r is ParsedStaffRow => r !== null);
}
