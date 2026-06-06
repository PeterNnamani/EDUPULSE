import { supabase } from '@/lib/supabase';

/**
 * KINDERGARTEN & PRESCHOOL COMPETENCY ASSESSMENT SERVICE
 *
 * Rating-based assessment for early-years classes (no numeric scores).
 * Also computes a preschool-specific risk signal based on repeated low ratings.
 */

export const PRESCHOOL_CATEGORIES = [
  { key: 'literacy_skills', label: 'Literacy Skills' },
  { key: 'numeracy_skills', label: 'Numeracy Skills' },
  { key: 'communication_skills', label: 'Communication Skills' },
  { key: 'social_development', label: 'Social Development' },
  { key: 'emotional_development', label: 'Emotional Development' },
  { key: 'motor_skills', label: 'Motor Skills' },
  { key: 'creativity', label: 'Creativity' },
  { key: 'participation', label: 'Participation' },
  { key: 'personal_hygiene', label: 'Personal Hygiene' },
  { key: 'class_behaviour', label: 'Class Behaviour' },
] as const;

export type PreschoolCategory = (typeof PRESCHOOL_CATEGORIES)[number]['key'];

export const PRESCHOOL_RATINGS = [
  { key: 'outstanding', label: 'Outstanding', value: 6, color: '#16A34A' },
  { key: 'excellent', label: 'Excellent', value: 5, color: '#22C55E' },
  { key: 'very_good', label: 'Very Good', value: 4, color: '#84CC16' },
  { key: 'good', label: 'Good', value: 3, color: '#EAB308' },
  { key: 'developing', label: 'Developing', value: 2, color: '#F97316' },
  { key: 'needs_attention', label: 'Needs Attention', value: 1, color: '#EF4444' },
] as const;

export type PreschoolRating = (typeof PRESCHOOL_RATINGS)[number]['key'];

export const RATING_VALUE: Record<string, number> = PRESCHOOL_RATINGS.reduce(
  (acc, r) => ({ ...acc, [r.key]: r.value }),
  {} as Record<string, number>
);

export const RATING_LABEL: Record<string, string> = PRESCHOOL_RATINGS.reduce(
  (acc, r) => ({ ...acc, [r.key]: r.label }),
  {} as Record<string, string>
);

export const RATING_COLOR: Record<string, string> = PRESCHOOL_RATINGS.reduce(
  (acc, r) => ({ ...acc, [r.key]: r.color }),
  {} as Record<string, string>
);

const LOW_RATINGS = new Set(['developing', 'needs_attention']);

export interface PreschoolAssessmentRow {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string | null;
  academic_term_id: string | null;
  category: string;
  rating: string;
  teacher_comment: string | null;
  assessed_by: string | null;
  assessed_at: string;
}

export interface ProgressSummary {
  averageValue: number;
  averageLabel: string;
  strengths: string[];
  needsAttention: string[];
  assessedCount: number;
}

export interface GrowthPoint {
  termId: string;
  termName: string;
  averageValue: number;
}

export const preschoolAssessmentService = {
  async saveAssessments(
    schoolId: string,
    studentId: string,
    classId: string | null,
    academicTermId: string | null,
    assessedBy: string | null,
    ratings: Array<{ category: PreschoolCategory; rating: PreschoolRating; comment?: string }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const rows = ratings.map((r) => ({
        school_id: schoolId,
        student_id: studentId,
        class_id: classId,
        academic_term_id: academicTermId,
        category: r.category,
        rating: r.rating,
        teacher_comment: r.comment ?? null,
        assessed_by: assessedBy,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('preschool_assessments')
        .upsert(rows, { onConflict: 'student_id,category,academic_term_id' });

      if (error) return { success: false, error: error.message };

      // Update preschool risk after saving.
      void this.recomputePreschoolRisk(schoolId, studentId);

      const { teacherActivityService } = await import('@/services/teacherActivityService');
      void teacherActivityService.logActivity({
        schoolId,
        staffId: assessedBy,
        action: 'results_uploaded',
        entityType: 'preschool_assessment',
        relatedStudentId: studentId,
        relatedClassId: classId,
        details: { categories: ratings.length },
      });

      const { auditService } = await import('@/services/auditService');
      void auditService.logAudit({
        schoolId,
        userId: assessedBy,
        userType: 'staff',
        action: 'result_uploaded',
        entityType: 'preschool_assessment',
        entityId: studentId,
        newValues: { categories: ratings.length, termId: academicTermId },
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to save' };
    }
  },

  async getStudentAssessments(
    schoolId: string,
    studentId: string,
    academicTermId?: string
  ): Promise<PreschoolAssessmentRow[]> {
    let query = supabase
      .from('preschool_assessments')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', studentId);
    if (academicTermId) query = query.eq('academic_term_id', academicTermId);
    const { data } = await query;
    return (data ?? []) as PreschoolAssessmentRow[];
  },

  async getClassAssessments(
    schoolId: string,
    classId: string,
    academicTermId: string
  ): Promise<PreschoolAssessmentRow[]> {
    const { data } = await supabase
      .from('preschool_assessments')
      .select('*')
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .eq('academic_term_id', academicTermId);
    return (data ?? []) as PreschoolAssessmentRow[];
  },

  buildProgressSummary(rows: PreschoolAssessmentRow[]): ProgressSummary {
    if (rows.length === 0) {
      return { averageValue: 0, averageLabel: '-', strengths: [], needsAttention: [], assessedCount: 0 };
    }
    const total = rows.reduce((sum, r) => sum + (RATING_VALUE[r.rating] ?? 0), 0);
    const averageValue = total / rows.length;

    const labelFor = (v: number): string => {
      const rounded = Math.round(v);
      const match = PRESCHOOL_RATINGS.find((r) => r.value === rounded);
      return match?.label ?? 'Good';
    };

    const categoryLabel = (key: string) =>
      PRESCHOOL_CATEGORIES.find((c) => c.key === key)?.label ?? key;

    const strengths = rows
      .filter((r) => (RATING_VALUE[r.rating] ?? 0) >= 5)
      .map((r) => categoryLabel(r.category));
    const needsAttention = rows
      .filter((r) => LOW_RATINGS.has(r.rating))
      .map((r) => categoryLabel(r.category));

    return {
      averageValue,
      averageLabel: labelFor(averageValue),
      strengths: [...new Set(strengths)],
      needsAttention: [...new Set(needsAttention)],
      assessedCount: rows.length,
    };
  },

  async getGrowthTrend(schoolId: string, studentId: string): Promise<GrowthPoint[]> {
    const { data: rows } = await supabase
      .from('preschool_assessments')
      .select('academic_term_id, rating')
      .eq('school_id', schoolId)
      .eq('student_id', studentId);

    if (!rows || rows.length === 0) return [];

    const byTerm = new Map<string, { total: number; count: number }>();
    for (const r of rows) {
      const key = r.academic_term_id ?? 'unknown';
      const cur = byTerm.get(key) ?? { total: 0, count: 0 };
      cur.total += RATING_VALUE[r.rating] ?? 0;
      cur.count += 1;
      byTerm.set(key, cur);
    }

    const termIds = [...byTerm.keys()].filter((k) => k !== 'unknown');
    const termNames = new Map<string, string>();
    if (termIds.length) {
      const { data: terms } = await supabase
        .from('academic_terms')
        .select('id, name')
        .in('id', termIds);
      (terms ?? []).forEach((t) => termNames.set(t.id, t.name));
    }

    return [...byTerm.entries()].map(([termId, agg]) => ({
      termId,
      termName: termNames.get(termId) ?? 'Term',
      averageValue: agg.count ? agg.total / agg.count : 0,
    }));
  },

  /**
   * Preschool risk: based on repeated LOW ratings (developing / needs_attention)
   * rather than exam scores. Writes risk_level/risk_score back to the student.
   */
  async recomputePreschoolRisk(schoolId: string, studentId: string): Promise<void> {
    try {
      const { data: rows } = await supabase
        .from('preschool_assessments')
        .select('rating')
        .eq('school_id', schoolId)
        .eq('student_id', studentId);

      if (!rows || rows.length === 0) return;

      const lowCount = rows.filter((r) => LOW_RATINGS.has(r.rating)).length;
      const lowRatio = lowCount / rows.length;

      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      let riskScore = Math.round(lowRatio * 100);
      if (lowRatio >= 0.5 || lowCount >= 5) riskLevel = 'high';
      else if (lowRatio >= 0.25 || lowCount >= 3) riskLevel = 'medium';

      await supabase
        .from('students')
        .update({ risk_level: riskLevel, risk_score: riskScore })
        .eq('id', studentId)
        .eq('school_id', schoolId);

      // Notify counselors/parents if high risk.
      if (riskLevel === 'high') {
        const { notificationTriggerService } = await import('@/services/notificationTriggerService');
        const { getParentIdsForStudent, getStaffIdsByRole, getStudentDisplayName } = await import(
          '@/services/notificationDispatchService'
        );
        const [name, parentIds, counselors, principals] = await Promise.all([
          getStudentDisplayName(studentId),
          getParentIdsForStudent(studentId),
          getStaffIdsByRole(schoolId, 'counselor'),
          getStaffIdsByRole(schoolId, 'principal'),
        ]);
        void notificationTriggerService.onAcademicRiskDetected(
          schoolId,
          studentId,
          name,
          'high',
          ['Repeated low competency ratings'],
          parentIds,
          counselors,
          principals[0] ?? counselors[0] ?? ''
        );
      }
    } catch (err) {
      console.warn('[PRESCHOOL_RISK] recompute failed:', err);
    }
  },
};
