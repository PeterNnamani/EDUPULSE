import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

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

async function fetchReportRows(
  schoolId: string,
  category: ReportCategory
): Promise<{ headers: string[]; rows: ExportRow[]; title: string }> {
  switch (category) {
    case 'attendance': {
      const { data } = await supabase
        .from('attendance')
        .select('date, status, students(first_name, last_name), classes(name)')
        .eq('school_id', schoolId)
        .order('date', { ascending: false })
        .limit(500);

      const rows = (data ?? []).map((r: any) => ({
        Date: r.date ?? '',
        Student: r.students
          ? `${r.students.first_name} ${r.students.last_name}`
          : 'Unknown',
        Class: r.classes?.name ?? 'N/A',
        Status: r.status ?? '',
      }));

      return {
        title: 'Attendance Report',
        headers: ['Date', 'Student', 'Class', 'Status'],
        rows,
      };
    }

    case 'academic': {
      const { data } = await supabase
        .from('grades')
        .select(
          'score, max_score, assessment_type, students(first_name, last_name), subjects(name), classes(name)'
        )
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(500);

      const rows = (data ?? []).map((r: any) => ({
        Student: r.students
          ? `${r.students.first_name} ${r.students.last_name}`
          : 'Unknown',
        Class: r.classes?.name ?? 'N/A',
        Subject: r.subjects?.name ?? 'N/A',
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
      const { data } = await supabase
        .from('behaviour_records')
        .select(
          'behaviour_type, points, description, created_at, students(first_name, last_name), classes(name)'
        )
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(500);

      const rows = (data ?? []).map((r: any) => ({
        Date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
        Student: r.students
          ? `${r.students.first_name} ${r.students.last_name}`
          : 'Unknown',
        Class: r.classes?.name ?? 'N/A',
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
      const { data: riskScores } = await supabase
        .from('risk_scores')
        .select('*')
        .eq('school_id', schoolId)
        .order('overall_risk', { ascending: false })
        .limit(200);

      const studentIds = [...new Set((riskScores ?? []).map((r) => r.student_id))];
      const { data: students } = studentIds.length
        ? await supabase
            .from('students')
            .select('id, first_name, last_name, class_id')
            .in('id', studentIds)
        : { data: [] };

      const { data: classes } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', schoolId);

      const studentMap = new Map((students ?? []).map((s) => [s.id, s]));
      const classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));

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
      const { data } = await supabase
        .from('fee_obligations')
        .select(
          'amount_due, amount_paid, status, due_date, students(first_name, last_name), fee_structures(name)'
        )
        .eq('school_id', schoolId)
        .order('due_date', { ascending: false })
        .limit(500);

      const rows = (data ?? []).map((r: any) => ({
        Student: r.students
          ? `${r.students.first_name} ${r.students.last_name}`
          : 'Unknown',
        Fee: r.fee_structures?.name ?? 'Fee',
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
      const { data: students } = await supabase
        .from('students')
        .select('id, first_name, last_name, class_id, status')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .limit(200);

      const classIds = [...new Set((students ?? []).map((s) => s.class_id).filter(Boolean))];
      const { data: classes } = classIds.length
        ? await supabase.from('classes').select('id, name').in('id', classIds)
        : { data: [] };

      const classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));

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

function downloadPDF(title: string, headers: string[], rows: ExportRow[]) {
  const doc = new jsPDF({ orientation: headers.length > 5 ? 'landscape' : 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(16);
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 10;
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
  y += 10;
  doc.text(`Records: ${rows.length}`, 14, y);
  y += 8;

  const colWidth = (pageWidth - 28) / headers.length;

  doc.setFont(undefined, 'bold');
  headers.forEach((h, i) => {
    doc.text(h, 14 + i * colWidth, y, { maxWidth: colWidth - 2 });
  });
  y += 6;
  doc.setFont(undefined, 'normal');

  for (const row of rows) {
    if (y > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 20;
    }
    headers.forEach((h, i) => {
      doc.text(String(row[h] ?? ''), 14 + i * colWidth, y, { maxWidth: colWidth - 2 });
    });
    y += 6;
  }

  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
}

export async function exportSchoolReport(
  schoolId: string,
  category: ReportCategory,
  format: ExportFormat
): Promise<{ success: boolean; error?: string }> {
  try {
    const { title, headers, rows } = await fetchReportRows(schoolId, category);

    if (rows.length === 0) {
      return { success: false, error: 'No data found for this report' };
    }

    if (format === 'PDF') downloadPDF(title, headers, rows);
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
