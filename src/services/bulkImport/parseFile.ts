import * as XLSX from 'xlsx';

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export function isSupportedImportFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export async function parseImportFile(file: File): Promise<ParsedSheet[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });
    const headers =
      raw.length > 0
        ? Object.keys(raw[0])
        : (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })[0] as
            | string[]
            | undefined) ?? [];

    return {
      name,
      headers,
      rows: raw.filter((row) =>
        Object.values(row).some((v) => String(v ?? '').trim() !== '')
      ),
    };
  }).filter((s) => s.rows.length > 0);
}
