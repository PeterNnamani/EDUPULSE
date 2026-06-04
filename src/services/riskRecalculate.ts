import { riskDetectionService } from './riskDetectionService';

/** Fire-and-forget risk recalculation after data changes. */
export function scheduleRiskRecalculation(schoolId: string, studentId: string): void {
  if (!schoolId || !studentId) return;
  void riskDetectionService.recalculateForStudent(schoolId, studentId).catch((err) => {
    console.warn('[RISK] Recalculation failed:', err);
  });
}
