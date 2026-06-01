import { supabase } from '@/lib/supabase';

/**
 * Academic History Service
 * Manages archival and retrieval of historical student records
 */

export const academicHistoryService = {
    /**
     * Get complete academic history for a student
     */
    async getStudentAcademicHistory(studentId: string) {
        try {
            // Get all academic records
            const { data: records } = await supabase
                .from('student_academic_records')
                .select(`
          *,
          academic_sessions(name, start_date, end_date),
          academic_terms(name, term_number, start_date, end_date),
          classes(name, grade_level, section)
        `)
                .eq('student_id', studentId)
                .order('created_at', { ascending: false });

            return { records, error: null };
        } catch (error) {
            console.error('Error fetching academic history:', error);
            return { records: null, error };
        }
    },

    /**
     * Get student's historical attendance records
     */
    async getStudentAttendanceHistory(
        studentId: string,
        sessionId?: string,
        termId?: string
    ) {
        try {
            let query = supabase
                .from('archived_attendance')
                .select('*')
                .eq('student_id', studentId);

            if (sessionId) {
                query = query.eq('session_id', sessionId);
            }
            if (termId) {
                query = query.eq('term_id', termId);
            }

            const { data, error } = await query.order('archived_at', { ascending: false });

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error fetching attendance history:', error);
            return { data: null, error };
        }
    },

    /**
     * Get student's historical results
     */
    async getStudentResultsHistory(
        studentId: string,
        sessionId?: string,
        termId?: string
    ) {
        try {
            let query = supabase
                .from('archived_results')
                .select('*')
                .eq('student_id', studentId);

            if (sessionId) {
                query = query.eq('session_id', sessionId);
            }
            if (termId) {
                query = query.eq('term_id', termId);
            }

            const { data, error } = await query.order('archived_at', { ascending: false });

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error fetching results history:', error);
            return { data: null, error };
        }
    },

    /**
     * Get student's risk score history
     */
    async getStudentRiskHistory(
        studentId: string,
        sessionId?: string,
        termId?: string
    ) {
        try {
            let query = supabase
                .from('archived_risk_assessments')
                .select('*')
                .eq('student_id', studentId);

            if (sessionId) {
                query = query.eq('session_id', sessionId);
            }
            if (termId) {
                query = query.eq('term_id', termId);
            }

            const { data, error } = await query.order('archived_at', { ascending: false });

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error fetching risk history:', error);
            return { data: null, error };
        }
    },

    /**
     * Get full record for specific term
     */
    async getStudentTermRecord(
        studentId: string,
        sessionId: string,
        termId: string
    ) {
        try {
            // Get academic record
            const { data: academicRecord } = await supabase
                .from('student_academic_records')
                .select(`
          *,
          academic_sessions(name),
          academic_terms(name, term_number),
          classes(name, grade_level)
        `)
                .eq('student_id', studentId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .single();

            // Get attendance
            const { data: attendance } = await supabase
                .from('archived_attendance')
                .select('*')
                .eq('student_id', studentId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .single();

            // Get results
            const { data: results } = await supabase
                .from('archived_results')
                .select('*')
                .eq('student_id', studentId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .single();

            // Get risk assessment
            const { data: riskAssessment } = await supabase
                .from('archived_risk_assessments')
                .select('*')
                .eq('student_id', studentId)
                .eq('session_id', sessionId)
                .eq('term_id', termId)
                .single();

            return {
                academicRecord,
                attendance,
                results,
                riskAssessment,
                error: null
            };
        } catch (error) {
            console.error('Error fetching term record:', error);
            return {
                academicRecord: null,
                attendance: null,
                results: null,
                riskAssessment: null,
                error
            };
        }
    },

    /**
     * Get class progression history for student
     */
    async getStudentClassProgression(studentId: string) {
        try {
            const { data, error } = await supabase
                .from('student_academic_records')
                .select(`
          session_id,
          term_id,
          class_id,
          promotion_status,
          academic_sessions(name, start_date, end_date),
          classes(name, grade_level, section)
        `)
                .eq('student_id', studentId)
                .order('academic_sessions(start_date)', { ascending: true });

            if (error) throw error;

            // Transform to show progression
            const progression = data?.map(record => ({
                session: record.academic_sessions?.name,
                class: `${record.classes?.grade_level}${record.classes?.section || ''}`,
                status: record.promotion_status
            })) || [];

            return { progression, error: null };
        } catch (error) {
            console.error('Error fetching class progression:', error);
            return { progression: null, error };
        }
    },

    /**
     * Get graduation record for student
     */
    async getGraduationRecord(studentId: string) {
        try {
            const { data, error } = await supabase
                .from('graduation_records')
                .select(`
          *,
          academic_sessions(name),
          classes(name, grade_level)
        `)
                .eq('student_id', studentId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error fetching graduation record:', error);
            return { data: null, error };
        }
    },

    /**
     * Get academic performance trend for student
     */
    async getPerformanceTrend(studentId: string) {
        try {
            const { data: results } = await supabase
                .from('archived_results')
                .select('archived_at, average_score')
                .eq('student_id', studentId)
                .order('archived_at', { ascending: true });

            const { data: attendance } = await supabase
                .from('archived_attendance')
                .select('archived_at, attendance_percentage')
                .eq('student_id', studentId)
                .order('archived_at', { ascending: true });

            const { data: risk } = await supabase
                .from('archived_risk_assessments')
                .select('archived_at, risk_score')
                .eq('student_id', studentId)
                .order('archived_at', { ascending: true });

            return {
                results,
                attendance,
                risk,
                error: null
            };
        } catch (error) {
            console.error('Error fetching performance trend:', error);
            return {
                results: null,
                attendance: null,
                risk: null,
                error
            };
        }
    },

    /**
     * Search student academic records
     */
    async searchAcademicRecords(
        schoolId: string,
        filters: {
            sessionId?: string;
            termId?: string;
            classId?: string;
            promotionStatus?: string;
            riskLevel?: string;
        }
    ) {
        try {
            let query = supabase
                .from('student_academic_records')
                .select(`
          *,
          students(first_name, last_name, student_id),
          academic_sessions(name),
          academic_terms(name),
          classes(name, grade_level)
        `)
                .eq('school_id', schoolId);

            if (filters.sessionId) {
                query = query.eq('session_id', filters.sessionId);
            }
            if (filters.termId) {
                query = query.eq('term_id', filters.termId);
            }
            if (filters.classId) {
                query = query.eq('class_id', filters.classId);
            }
            if (filters.promotionStatus) {
                query = query.eq('promotion_status', filters.promotionStatus);
            }
            if (filters.riskLevel) {
                query = query.eq('risk_level', filters.riskLevel);
            }

            const { data, error } = await query;

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error searching academic records:', error);
            return { data: null, error };
        }
    },

    /**
     * Export student academic history as JSON
     */
    async exportStudentHistory(studentId: string) {
        try {
            const { records } = await this.getStudentAcademicHistory(studentId);
            const { progression } = await this.getStudentClassProgression(studentId);
            const { data: graduationRecord } = await this.getGraduationRecord(studentId);

            const { data: student } = await supabase
                .from('students')
                .select('*')
                .eq('id', studentId)
                .single();

            const historyData = {
                student: {
                    id: student?.id,
                    admissionNumber: student?.admission_number,
                    firstName: student?.first_name,
                    lastName: student?.last_name,
                    dateOfBirth: student?.date_of_birth
                },
                academicHistory: records,
                classProgression: progression,
                graduation: graduationRecord,
                exportedAt: new Date().toISOString()
            };

            return {
                data: historyData,
                error: null
            };
        } catch (error) {
            console.error('Error exporting history:', error);
            return {
                data: null,
                error
            };
        }
    }
};
