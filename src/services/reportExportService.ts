import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { getTeacherTeachingLoad } from '@/services/classService';
import { unwrapJoinUnknown, buildClassDisplayMap, formatClassDisplay } from '@/utils/displayUtils';
import type { UserRole } from '@/types';

export type ReportCategory =
  | 'attendance'
  | 'academic'
  | 'behaviour'
  | 'risk'
  | 'financial'
  | 'student';

export type ExportFormat = 'PDF' | 'Excel' | 'CSV';

interface ExportRow {
  [key: string]: string | number;
}

export interface ReportExportOptions {
  role?: UserRole;
  staffId?: string;
}

/** undefined = school-wide; [] = teacher with no assigned classes */
export type ReportClassScope = string[] | undefined;

function joinedStudentName(students: unknown): string {
  const student = unwrapJoinUnknown<{ first_name?: string; last_name?: string }>(students);
  if (!student) return 'Unknown';
  const name = `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim();
  return name || 'Unknown';
}

function joinedField(value: unknown, field: string, fallback = 'N/A'): string {
  const row = unwrapJoinUnknown<Record<string, string | null | undefined>>(value);
  const text = row?.[field];
  return text != null && String(text).trim() !== '' ? String(text) : fallback;
}

export async function resolveReportClassScope(
  schoolId: string,
  role?: UserRole,
  staffId?: string
): Promise<ReportClassScope> {
  if (role !== 'teacher' || !staffId) return undefined;
  const load = await getTeacherTeachingLoad(schoolId, staffId);
  return load.classes.map((c) => c.classId);
}

function scopedEmptyResult(title: string): {
  headers: string[];
  rows: ExportRow[];
  title: string;
} {
  return { title, headers: [], rows: [] };
}

async function fetchReportRows(
  schoolId: string,
  category: ReportCategory,
  classIds?: ReportClassScope
): Promise<{ headers: string[]; rows: ExportRow[]; title: string }> {
  if (classIds !== undefined && classIds.length === 0) {
    const emptyTitles: Record<ReportCategory, string> = {
      attendance: 'Attendance Report',
      academic: 'Academic Report',
      behaviour: 'Behaviour Report',
      risk: 'Risk Analysis Report',
      financial: 'Financial Report',
      student: 'Student Profile Report',
    };
    return scopedEmptyResult(emptyTitles[category]);
  }

  switch (category) {
    case 'attendance': {
      let query = supabase
        .from('attendance')
        .select('date, status, students(first_name, last_name), classes(name)')
        .eq('school_id', schoolId)
        .order('date', { ascending: false })
        .limit(500);

      if (classIds) query = query.in('class_id', classIds);

      const { data, error } = await query;
      if (error) console.error('[reportExport] attendance query failed:', error);

      const rows = (data ?? []).map((r: any) => ({
        Date: r.date ?? '',
        Student: joinedStudentName(r.students),
        Class: joinedField(r.classes, 'name'),
        Status: r.status ?? '',
      }));

      return {
        title: 'Attendance Report',
        headers: ['Date', 'Student', 'Class', 'Status'],
        rows,
      };
    }

    case 'academic': {
      let query = supabase
        .from('grades')
        .select(
          'score, max_score, assessment_type, students(first_name, last_name), subjects(name), classes(name)'
        )
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (classIds) query = query.in('class_id', classIds);

      const { data, error } = await query;
      if (error) console.error('[reportExport] academic query failed:', error);

      const rows = (data ?? []).map((r: any) => ({
        Student: joinedStudentName(r.students),
        Class: joinedField(r.classes, 'name'),
        Subject: joinedField(r.subjects, 'name'),
        Assessment: r.assessment_type ?? '',
        Score: r.score ?? 0,
        'Max Score': r.max_score ?? 100,
        Percentage:
          r.max_score > 0
            ? Math.round((r.score / r.max_score) * 100)
            : 0,
      }));

      return {
        title: 'Academic Report',
        headers: ['Student', 'Class', 'Subject', 'Assessment', 'Score', 'Max Score', 'Percentage'],
        rows,
      };
    }

    case 'behaviour': {
      let query = supabase
        .from('behaviour_records')
        .select(
          'behaviour_type, points, description, created_at, students(first_name, last_name), classes(name)'
        )
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (classIds) query = query.in('class_id', classIds);

      const { data, error } = await query;
      if (error) console.error('[reportExport] behaviour query failed:', error);

      const rows = (data ?? []).map((r: any) => ({
        Date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
        Student: joinedStudentName(r.students),
        Class: joinedField(r.classes, 'name'),
        Type: r.behaviour_type ?? '',
        Points: r.points ?? 0,
        Description: r.description ?? '',
      }));

      return {
        title: 'Behaviour Report',
        headers: ['Date', 'Student', 'Class', 'Type', 'Points', 'Description'],
        rows,
      };
    }

    case 'risk': {
      let studentFilterQuery = supabase
        .from('students')
        .select('id')
        .eq('school_id', schoolId);

      if (classIds) studentFilterQuery = studentFilterQuery.in('class_id', classIds);

      const { data: scopedStudents } = classIds ? await studentFilterQuery : { data: null };
      const scopedStudentIds =
        classIds && scopedStudents
          ? scopedStudents.map((s) => s.id)
          : null;

      if (classIds && (!scopedStudentIds || scopedStudentIds.length === 0)) {
        return scopedEmptyResult('Risk Analysis Report');
      }

      let riskQuery = supabase
        .from('risk_scores')
        .select('*')
        .eq('school_id', schoolId)
        .order('overall_risk', { ascending: false })
        .limit(200);

      if (scopedStudentIds) riskQuery = riskQuery.in('student_id', scopedStudentIds);

      const { data: riskScores } = await riskQuery;

      const studentIds = [...new Set((riskScores ?? []).map((r) => r.student_id))];
      const { data: students } = studentIds.length
        ? await supabase
            .from('students')
            .select('id, first_name, last_name, class_id')
            .in('id', studentIds)
        : { data: [] };

      const { data: classes } = await supabase
        .from('classes')
        .select('id, name, grade_level, section')
        .eq('school_id', schoolId);

      const studentMap = new Map((students ?? []).map((s) => [s.id, s]));
      const classMap = buildClassDisplayMap(classes ?? []);

      const rows = (riskScores ?? []).map((r) => {
        const student = studentMap.get(r.student_id);
        return {
          Student: student
            ? `${student.first_name} ${student.last_name}`
            : 'Unknown',
          Class: student?.class_id
            ? classMap.get(student.class_id) ?? 'N/A'
            : 'N/A',
          'Risk Level': r.risk_level ?? '',
          'Overall Risk': Math.round(r.overall_risk ?? 0),
          Attendance: Math.round(r.attendance_risk ?? 0),
          Academic: Math.round(r.academic_risk ?? 0),
          Behaviour: Math.round(r.behaviour_risk ?? 0),
        };
      });

      return {
        title: 'Risk Analysis Report',
        headers: ['Student', 'Class', 'Risk Level', 'Overall Risk', 'Attendance', 'Academic', 'Behaviour'],
        rows,
      };
    }

    case 'financial': {
      const { data, error } = await supabase
        .from('fee_obligations')
        .select(
          'amount_due, amount_paid, status, due_date, students(first_name, last_name), fee_structures(name)'
        )
        .eq('school_id', schoolId)
        .order('due_date', { ascending: false })
        .limit(500);

      if (error) console.error('[reportExport] financial query failed:', error);

      const rows = (data ?? []).map((r: any) => ({
        Student: joinedStudentName(r.students),
        Fee: joinedField(r.fee_structures, 'name', 'Fee'),
        'Amount Due': r.amount_due ?? 0,
        'Amount Paid': r.amount_paid ?? 0,
        Outstanding: (r.amount_due ?? 0) - (r.amount_paid ?? 0),
        Status: r.status ?? '',
        'Due Date': r.due_date ?? '',
      }));

      return {
        title: 'Financial Report',
        headers: ['Student', 'Fee', 'Amount Due', 'Amount Paid', 'Outstanding', 'Status', 'Due Date'],
        rows,
      };
    }

    case 'student': {
      let studentQuery = supabase
        .from('students')
        .select('id, first_name, last_name, class_id, status')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .limit(200);

      if (classIds) studentQuery = studentQuery.in('class_id', classIds);

      const { data: students } = await studentQuery;

      const studentClassIds = [
        ...new Set((students ?? []).map((s) => s.class_id).filter(Boolean)),
      ] as string[];
      const { data: classes } = studentClassIds.length
        ? await supabase.from('classes').select('id, name, grade_level, section').in('id', studentClassIds)
        : { data: [] };

      const classMap = buildClassDisplayMap(classes ?? []);

      const rows = (students ?? []).map((s) => ({
        'Student ID': s.id,
        Name: `${s.first_name} ${s.last_name}`,
        Class: s.class_id ? classMap.get(s.class_id) ?? 'N/A' : 'N/A',
        Status: s.status ?? 'active',
      }));

      return {
        title: 'Student Profile Report',
        headers: ['Student ID', 'Name', 'Class', 'Status'],
        rows,
      };
    }

    default:
      return { title: 'Report', headers: [], rows: [] };
  }
}

interface SchoolBranding {
  name: string;
  motto?: string | null;
  city?: string;
  state?: string;
  address?: string;
  logoDataUrl?: string | null;
}

const PDF_COLORS = {
  primary: [37, 99, 235] as const,
  primaryDark: [30, 64, 175] as const,
  primaryLight: [219, 234, 254] as const,
  accent: [16, 163, 74] as const,
  gold: [245, 158, 11] as const,
  text: [17, 24, 39] as const,
  muted: [107, 114, 128] as const,
  white: [255, 255, 255] as const,
  rowAlt: [249, 250, 251] as const,
};

const brandingCache = new Map<
  string,
  { branding: SchoolBranding; at: number }
>();
const BRANDING_CACHE_MS = 10 * 60 * 1000;
const LOGO_FETCH_MS = 600;

async function tryLoadLogo(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSchoolBranding(schoolId: string): Promise<SchoolBranding> {
  const cached = brandingCache.get(schoolId);
  if (cached && Date.now() - cached.at < BRANDING_CACHE_MS) {
    return cached.branding;
  }

  const { data } = await supabase
    .from('schools')
    .select('name, motto, city, state, address, logo_url')
    .eq('id', schoolId)
    .single();

  const branding: SchoolBranding = {
    name: data?.name ?? 'School Report',
    motto: data?.motto,
    city: data?.city,
    state: data?.state,
    address: data?.address,
    logoDataUrl: null,
  };

  if (data?.logo_url) {
    branding.logoDataUrl = await tryLoadLogo(data.logo_url, LOGO_FETCH_MS);
  }

  brandingCache.set(schoolId, { branding, at: Date.now() });
  return branding;
}

function schoolInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function setFill(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setDraw(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function setText(doc: jsPDF, rgb: readonly [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

const A4_FORMAT = 'a4' as const;

function createPdf(orientation: 'portrait' | 'landscape' = 'portrait') {
  return new jsPDF({ orientation, unit: 'mm', format: A4_FORMAT });
}

function fitFontSize(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  font: string,
  style: string,
  maxSize: number,
  minSize: number
): number {
  for (let size = maxSize; size >= minSize; size -= 0.5) {
    doc.setFont(font, style);
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= maxWidth) return size;
  }
  return minSize;
}

function drawCoverHeader(doc: jsPDF, pageWidth: number) {
  setFill(doc, PDF_COLORS.primary);
  doc.rect(0, 0, pageWidth, 28, 'F');
  setFill(doc, PDF_COLORS.primaryDark);
  doc.rect(0, 24, pageWidth, 6, 'F');
  setFill(doc, PDF_COLORS.primaryLight);
  doc.circle(pageWidth - 12, 10, 14, 'F');
  setFill(doc, PDF_COLORS.white);
  doc.circle(14, 18, 4, 'F');
}

function drawLogoCard(
  doc: jsPDF,
  centerX: number,
  topY: number,
  branding: SchoolBranding
): number {
  const cardW = 82;
  const cardH = 54;
  const left = centerX - cardW / 2;

  setFill(doc, [236, 242, 255]);
  doc.roundedRect(left + 0.8, topY + 0.8, cardW, cardH, 4, 4, 'F');

  setFill(doc, PDF_COLORS.white);
  setDraw(doc, PDF_COLORS.primaryLight);
  doc.setLineWidth(0.35);
  doc.roundedRect(left, topY, cardW, cardH, 4, 4, 'FD');

  const hasLogo = Boolean(branding.logoDataUrl);
  const nameMaxW = cardW - 14;
  let textY = topY + (hasLogo ? 34 : 28);

  if (hasLogo && branding.logoDataUrl) {
    const logoSize = 20;
    const logoY = topY + 8;
    setFill(doc, PDF_COLORS.primaryLight);
    doc.circle(centerX, logoY + logoSize / 2, logoSize / 2 + 2, 'F');
    try {
      const fmt = imageFormatFromDataUrl(branding.logoDataUrl);
      doc.addImage(
        branding.logoDataUrl,
        fmt,
        centerX - logoSize / 2,
        logoY,
        logoSize,
        logoSize
      );
    } catch {
      drawSoftMonogram(doc, centerX, logoY + logoSize / 2, branding.name, 9);
    }
  } else {
    drawSoftMonogram(doc, centerX, topY + 16, branding.name, 10);
    textY = topY + 30;
  }

  doc.setFont('times', 'bolditalic');
  const singleLine = branding.name.length <= 28;
  if (singleLine) {
    const size = fitFontSize(doc, branding.name, nameMaxW, 'times', 'bolditalic', 17, 11);
    doc.setFontSize(size);
    setText(doc, PDF_COLORS.primaryDark);
    doc.text(branding.name, centerX, textY, { align: 'center' });
  } else {
    doc.setFontSize(13);
    setText(doc, PDF_COLORS.primaryDark);
    const nameLines = doc.splitTextToSize(branding.name, nameMaxW);
    doc.text(nameLines, centerX, textY - (nameLines.length - 1) * 3, { align: 'center' });
  }

  const lineW = Math.min(nameMaxW * 0.55, 42);
  setFill(doc, PDF_COLORS.primary);
  doc.rect(centerX - lineW / 2, topY + cardH - 9, lineW, 0.5, 'F');

  return topY + cardH + 10;
}

function drawSoftMonogram(doc: jsPDF, cx: number, cy: number, schoolName: string, fontSize: number) {
  setFill(doc, PDF_COLORS.primaryLight);
  setDraw(doc, PDF_COLORS.primary);
  doc.setLineWidth(0.25);
  doc.circle(cx, cy, 11, 'FD');
  doc.setFont('times', 'italic');
  doc.setFontSize(fontSize);
  setText(doc, PDF_COLORS.primaryDark);
  doc.text(schoolInitials(schoolName), cx, cy + 1.2, { align: 'center' });
}

function imageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.includes('image/png')) return 'PNG';
  if (dataUrl.includes('image/webp')) return 'WEBP';
  return 'JPEG';
}

function drawCategoryIcon(
  doc: jsPDF,
  category: ReportCategory,
  cx: number,
  cy: number,
  size: number
) {
  setDraw(doc, PDF_COLORS.white);
  doc.setLineWidth(0.7);
  const s = size / 10;

  switch (category) {
    case 'attendance': {
      setFill(doc, PDF_COLORS.white);
      doc.roundedRect(cx - 5 * s, cy - 6 * s, 10 * s, 11 * s, 1.2, 1.2, 'FD');
      doc.setLineWidth(0.5);
      doc.line(cx - 4 * s, cy - 3.5 * s, cx + 4 * s, cy - 3.5 * s);
      setDraw(doc, PDF_COLORS.primaryLight);
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          doc.circle(cx - 3 * s + c * 3 * s, cy + r * 3 * s, 0.6 * s, 'S');
        }
      }
      setDraw(doc, PDF_COLORS.accent);
      doc.setLineWidth(0.9);
      doc.line(cx + 2 * s, cy + 2 * s, cx + 4 * s, cy + 4.5 * s);
      doc.line(cx + 4 * s, cy + 4.5 * s, cx + 7 * s, cy + 0.5 * s);
      break;
    }
    case 'academic': {
      const outer = 5.5 * s;
      const inner = 2.5 * s;
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const angle = Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? outer : inner;
        pts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }
      const segments: [number, number][] = [];
      for (let i = 1; i < pts.length; i++) {
        segments.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
      }
      segments.push([pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]]);
      setFill(doc, PDF_COLORS.white);
      setDraw(doc, PDF_COLORS.white);
      doc.lines(segments, pts[0][0], pts[0][1], [1, 1], 'FD', true);
      break;
    }
    case 'behaviour': {
      setFill(doc, PDF_COLORS.white);
      doc.circle(cx, cy + 1.5 * s, 4.5 * s, 'FD');
      setFill(doc, PDF_COLORS.gold);
      doc.circle(cx, cy - 3.5 * s, 2.2 * s, 'F');
      setDraw(doc, PDF_COLORS.primaryDark);
      doc.setLineWidth(0.4);
      doc.line(cx - 3 * s, cy + 1 * s, cx - 1 * s, cy + 3 * s);
      doc.line(cx + 3 * s, cy + 1 * s, cx + 1 * s, cy + 3 * s);
      break;
    }
    case 'risk': {
      setFill(doc, PDF_COLORS.white);
      doc.triangle(cx, cy - 5.5 * s, cx - 6 * s, cy + 4.5 * s, cx + 6 * s, cy + 4.5 * s, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9 * s);
      setText(doc, PDF_COLORS.primaryDark);
      doc.text('!', cx, cy + 2 * s, { align: 'center' });
      break;
    }
    case 'financial': {
      setFill(doc, PDF_COLORS.white);
      doc.circle(cx, cy, 5.5 * s, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10 * s);
      setText(doc, PDF_COLORS.primaryDark);
      doc.text('₦', cx, cy + 1.8 * s, { align: 'center' });
      break;
    }
    case 'student':
    default: {
      setFill(doc, PDF_COLORS.white);
      doc.circle(cx, cy - 2 * s, 2.8 * s, 'F');
      doc.roundedRect(cx - 4.5 * s, cy + 1.5 * s, 9 * s, 5 * s, 2, 2, 'F');
      break;
    }
  }
}

function drawCoverPage(
  doc: jsPDF,
  branding: SchoolBranding,
  category: ReportCategory,
  title: string,
  recordCount: number
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;

  drawCoverHeader(doc, pageWidth);

  let y = drawLogoCard(doc, centerX, 48, branding);

  if (branding.motto) {
    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    setText(doc, PDF_COLORS.muted);
    const mottoLines = doc.splitTextToSize(`“${branding.motto}”`, pageWidth - 56);
    doc.text(mottoLines, centerX, y + 2, { align: 'center' });
    y += mottoLines.length * 4.5 + 6;
  }

  const location = [branding.city, branding.state].filter(Boolean).join(', ');
  if (location) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setText(doc, PDF_COLORS.muted);
    doc.text(location, centerX, y, { align: 'center' });
    y += 10;
  }

  const boxW = Math.min(pageWidth - 48, 132);
  const boxH = 22;
  const boxX = centerX - boxW / 2;
  const boxY = y + 8;
  setFill(doc, PDF_COLORS.primary);
  doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, 'F');
  setFill(doc, PDF_COLORS.primaryDark);
  doc.roundedRect(boxX, boxY, 20, boxH, 3, 3, 'F');
  drawCategoryIcon(doc, category, boxX + 10, boxY + boxH / 2, 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setText(doc, PDF_COLORS.white);
  doc.text(title, boxX + 24, boxY + boxH / 2 + 1, { maxWidth: boxW - 30 });

  y = boxY + boxH + 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, PDF_COLORS.text);
  doc.text(
    new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    centerX,
    y,
    { align: 'center' }
  );

  y += 9;
  setFill(doc, PDF_COLORS.accent);
  const badgeText = `${recordCount.toLocaleString()} record${recordCount === 1 ? '' : 's'}`;
  const badgeW = doc.getTextWidth(badgeText) + 14;
  doc.roundedRect(centerX - badgeW / 2, y - 4, badgeW, 9, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setText(doc, PDF_COLORS.white);
  doc.text(badgeText, centerX, y + 1, { align: 'center' });

  setFill(doc, PDF_COLORS.primaryLight);
  doc.circle(16, pageHeight - 28, 10, 'F');
  doc.circle(pageWidth - 18, pageHeight - 22, 12, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setText(doc, PDF_COLORS.muted);
  doc.text('Confidential — For official school use only', centerX, pageHeight - 14, { align: 'center' });
  doc.setFontSize(7);
  setText(doc, PDF_COLORS.primary);
  doc.text('Powered by EduPulse', centerX, pageHeight - 9, { align: 'center' });
}

function drawPageHeader(
  doc: jsPDF,
  branding: SchoolBranding,
  title: string,
  pageNum: number
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  setFill(doc, PDF_COLORS.primary);
  doc.rect(0, 0, pageWidth, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setText(doc, PDF_COLORS.white);
  doc.text(branding.name, 10, 9);
  doc.setFont('helvetica', 'normal');
  doc.text(title, pageWidth / 2, 9, { align: 'center' });
  doc.text(`Page ${pageNum}`, pageWidth - 10, 9, { align: 'right' });
}

function drawPageFooter(doc: jsPDF, branding: SchoolBranding) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  setDraw(doc, PDF_COLORS.primaryLight);
  doc.setLineWidth(0.3);
  doc.line(10, pageHeight - 10, pageWidth - 10, pageHeight - 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setText(doc, PDF_COLORS.muted);
  doc.text(`${branding.name} · EduPulse Report`, pageWidth / 2, pageHeight - 5, { align: 'center' });
}

function downloadCSV(title: string, headers: string[], rows: ExportRow[]) {
  const lines = [
    title,
    `Generated: ${new Date().toLocaleString()}`,
    '',
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${title.replace(/\s+/g, '_')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadExcel(title: string, headers: string[], rows: ExportRow[]) {
  const sheetData = [
    [title],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    headers,
    ...rows.map((row) => headers.map((h) => row[h] ?? '')),
  ];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
}

async function downloadPDF(
  category: ReportCategory,
  branding: SchoolBranding,
  title: string,
  headers: string[],
  rows: ExportRow[]
) {
  const dataOrientation = headers.length > 5 ? 'landscape' : 'portrait';
  const doc = createPdf('portrait');
  const margin = 14;
  const headerH = 14;
  const footerH = 12;
  const rowHeight = 6;
  const contentTop = headerH + 8;

  drawCoverPage(doc, branding, category, title, rows.length);
  doc.addPage(A4_FORMAT, dataOrientation);

  let pageIndex = 2;
  let rowIndex = 0;

  const startDataPage = () => {
    drawPageHeader(doc, branding, title, pageIndex);
    let y = contentTop;
    const pw = doc.internal.pageSize.getWidth();
    const cw = (pw - margin * 2) / headers.length;
    setFill(doc, PDF_COLORS.primary);
    doc.rect(margin, y - 4, pw - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setText(doc, PDF_COLORS.white);
    headers.forEach((h, i) => {
      doc.text(h, margin + 2 + i * cw, y, { maxWidth: cw - 3 });
    });
    return y + 5;
  };

  let y = startDataPage();

  while (rowIndex < rows.length) {
    const pw = doc.internal.pageSize.getWidth();
    const cw = (pw - margin * 2) / headers.length;
    const bottom = doc.internal.pageSize.getHeight() - footerH;

    if (y + rowHeight > bottom) {
      drawPageFooter(doc, branding);
      doc.addPage(A4_FORMAT, dataOrientation);
      pageIndex += 1;
      y = startDataPage();
    }

    if (rowIndex % 2 === 0) {
      setFill(doc, PDF_COLORS.rowAlt);
      doc.rect(margin, y - 3.5, pw - margin * 2, rowHeight, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setText(doc, PDF_COLORS.text);
    const row = rows[rowIndex];
    headers.forEach((h, i) => {
      doc.text(String(row[h] ?? ''), margin + 2 + i * cw, y, { maxWidth: cw - 3 });
    });
    y += rowHeight;
    rowIndex += 1;
  }

  drawPageFooter(doc, branding);
  const safeName = branding.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  doc.save(`${safeName}_${title.replace(/\s+/g, '_')}.pdf`);
}

export async function exportSchoolReport(
  schoolId: string,
  category: ReportCategory,
  format: ExportFormat,
  options?: ReportExportOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    const classIds = await resolveReportClassScope(
      schoolId,
      options?.role,
      options?.staffId
    );

    if (classIds !== undefined && classIds.length === 0) {
      return {
        success: false,
        error: 'No classes assigned to you. Reports are limited to your assigned classes.',
      };
    }

    const [{ title, headers, rows }, branding] = await Promise.all([
      fetchReportRows(schoolId, category, classIds),
      fetchSchoolBranding(schoolId),
    ]);

    if (rows.length === 0) {
      return { success: false, error: 'No data found for this report' };
    }

    if (format === 'PDF') await downloadPDF(category, branding, title, headers, rows);
    else if (format === 'Excel') downloadExcel(title, headers, rows);
    else downloadCSV(title, headers, rows);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    };
  }
}

export function categoryFromReportType(type: string): ReportCategory {
  const map: Record<string, ReportCategory> = {
    Attendance: 'attendance',
    Academic: 'academic',
    Behaviour: 'behaviour',
    Risk: 'risk',
    Financial: 'financial',
    Student: 'student',
  };
  return map[type] ?? 'student';
}
