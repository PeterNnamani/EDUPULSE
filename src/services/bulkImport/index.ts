import {
  detectImportType,
  mapStaffRows,
  mapStudentRows,
  type BulkImportType,
} from './columnMap';
import { bulkImportStaff, type StaffImportResult } from './importStaff';
import { bulkImportStudents, type StudentImportResult } from './importStudents';
import { isSupportedImportFile, parseImportFile, type ParsedSheet } from './parseFile';

export type { BulkImportType, ParsedSheet, StaffImportResult, StudentImportResult };
export { isSupportedImportFile, parseImportFile, detectImportType };

export interface BulkImportPreview {
  type: BulkImportType;
  sheetName: string;
  totalRows: number;
  sampleRows: Record<string, unknown>[];
  studentCount?: number;
  staffCount?: number;
}

export async function previewImportFile(
  file: File,
  forcedType?: BulkImportType
): Promise<BulkImportPreview> {
  const sheets = await parseImportFile(file);
  const sheet = sheets[0];
  if (!sheet) {
    return { type: 'unknown', sheetName: '', totalRows: 0, sampleRows: [] };
  }

  const type =
    forcedType && forcedType !== 'unknown'
      ? forcedType
      : detectImportType(sheet.headers);

  return {
    type,
    sheetName: sheet.name,
    totalRows: sheet.rows.length,
    sampleRows: sheet.rows.slice(0, 5),
    studentCount: type === 'students' ? mapStudentRows(sheet.rows).length : undefined,
    staffCount: type === 'staff' ? mapStaffRows(sheet.rows).length : undefined,
  };
}

export async function runBulkImport(
  schoolId: string,
  file: File,
  type: BulkImportType,
  onProgress?: (done: number, total: number) => void
): Promise<StudentImportResult | StaffImportResult> {
  const sheets = await parseImportFile(file);
  const sheet = sheets[0];
  if (!sheet?.rows.length) {
    throw new Error('The file has no data rows.');
  }

  if (type === 'staff') {
    const rows = mapStaffRows(sheet.rows);
    if (!rows.length) throw new Error('No valid staff rows found. Check column headers.');
    return bulkImportStaff(schoolId, rows, onProgress);
  }

  if (type === 'students') {
    const rows = mapStudentRows(sheet.rows);
    if (!rows.length) throw new Error('No valid student rows found. Check column headers.');
    return bulkImportStudents(schoolId, rows, onProgress);
  }

  throw new Error('Could not detect import type. Choose Students or Staff.');
}

export function downloadStaffCredentialsCsv(credentials: StaffImportResult['credentials']): void {
  const header = 'Full Name,Staff ID,Role,PIN\n';
  const body = credentials
    .map(
      (c) =>
        `"${c.fullName.replace(/"/g, '""')}",${c.staffId},${c.role},${c.temporaryPin}`
    )
    .join('\n');
  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `staff-credentials-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadImportTemplate(type: 'students' | 'staff'): void {
  import('xlsx').then((XLSX) => {
    const wb = XLSX.utils.book_new();
    if (type === 'students') {
      const data = [
        {
          FirstName: 'John',
          LastName: 'Doe',
          MiddleName: 'Paul',
          'Date of Birth (YYYY-MM-DD)': '2012-05-15',
          Gender: 'male',
          'Phone Number (with country code, e.g., +234...)DAD': '08012345678',
          'Phone Number (with country code, e.g., +234...)MUM': '08087654321',
          STATE: 'Lagos',
          "FATHER'S NAME": 'Mr John Doe Sr',
          'FATHER ADDRESS': '12 Example Street',
          'FATHER EMAIL': 'father@example.com',
          "MOTHER'S NAME": 'Mrs Jane Doe',
          'MOTHER ADDRESS': '12 Example Street',
          RELIGION: 'Christianity',
          'BLOOD GRP': 'O',
          GENOTYPE: 'AA',
          DISABILITY: 'NONE',
          'CUR CLASS': 'PR4GOLD',
        },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Students');
    } else {
      const data = [
        {
          'Full Name': 'Jane Smith',
          Email: 'jane@school.com',
          Phone: '08012345678',
          Role: 'teacher',
          Department: 'Sciences',
        },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Staff');
    }
    XLSX.writeFile(wb, `edupulse-${type}-import-template.xlsx`);
  });
}
