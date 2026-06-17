import { createStaff, updateStaff } from '@/services/authService';
import type { ParsedStaffRow } from './columnMap';
import { findExistingStaff } from './duplicateMatch';

export interface StaffImportRowResult {
  rowIndex: number;
  fullName: string;
  staffId: string;
  temporaryPin: string;
  role: string;
  updated?: boolean;
}

export interface StaffImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ rowIndex: number; message: string }>;
  credentials: StaffImportRowResult[];
}

type ProgressFn = (done: number, total: number) => void;

export async function bulkImportStaff(
  schoolId: string,
  rows: ParsedStaffRow[],
  onProgress?: ProgressFn
): Promise<StaffImportResult> {
  const result: StaffImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    credentials: [],
  };

  const sessionByPhone = new Map<string, string>();

  let done = 0;
  for (const row of rows) {
    done++;
    onProgress?.(done, rows.length);

    try {
      const sessionKey = row.phone;
      if (sessionByPhone.has(sessionKey)) {
        result.updated++;
        continue;
      }

      const existing = await findExistingStaff(schoolId, row);

      if (existing) {
        const response = await updateStaff(
          existing.id,
          row.fullName,
          row.email,
          row.phone,
          row.role,
          existing.pin ?? '',
          row.department
        );

        if (!response.success) {
          result.errors.push({
            rowIndex: row.rowIndex,
            message: response.error ?? 'Failed to update staff',
          });
          result.skipped++;
          continue;
        }

        sessionByPhone.set(sessionKey, existing.id);
        result.updated++;
        result.credentials.push({
          rowIndex: row.rowIndex,
          fullName: row.fullName,
          staffId: existing.staff_id,
          temporaryPin: existing.pin ?? '—',
          role: row.role,
          updated: true,
        });
        continue;
      }

      const response = await createStaff(
        schoolId,
        row.fullName,
        row.email,
        row.phone,
        row.role,
        row.department
      );

      if (!response.success || !response.data) {
        result.errors.push({
          rowIndex: row.rowIndex,
          message: response.error ?? 'Failed to create staff',
        });
        result.skipped++;
        continue;
      }

      sessionByPhone.set(sessionKey, response.data.staffId);
      result.created++;
      result.credentials.push({
        rowIndex: row.rowIndex,
        fullName: response.data.fullName,
        staffId: response.data.staffId,
        temporaryPin: response.data.temporaryPin,
        role: response.data.role,
        updated: false,
      });
    } catch (e) {
      result.errors.push({
        rowIndex: row.rowIndex,
        message: e instanceof Error ? e.message : 'Unknown error',
      });
      result.skipped++;
    }
  }

  return result;
}
