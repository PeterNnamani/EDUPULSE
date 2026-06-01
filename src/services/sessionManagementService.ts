import { supabase } from '@/lib/supabase';
import {
    StudentAcademicRecord,
    PromotionRule,
    ClassDefinition,
    AcademicCalendar
} from '@/types';

/**
 * Academic Session Management Service
 * Handles creation, activation, and lifecycle management of academic sessions and terms
 */

export const sessionManagementService = {
    /**
     * Create new academic session
     */
    async createSession(
        schoolId: string,
        sessionName: string,
        startYear: number,
        endYear: number,
        startMonth: number = 9,
        endMonth: number = 7
    ) {
        try {
            const { data, error } = await supabase
                .from('academic_sessions')
                .insert({
                    school_id: schoolId,
                    name: sessionName,
                    start_date: new Date(startYear, startMonth - 1, 1),
                    end_date: new Date(endYear, endMonth - 1, 30),
                    is_current: false
                })
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error creating session:', error);
            return { success: false, error };
        }
    },

    /**
     * Get current active session for school
     */
    async getCurrentSession(schoolId: string) {
        try {
            const { data, error } = await supabase
                .from('academic_sessions')
                .select('*')
                .eq('school_id', schoolId)
                .eq('is_current', true)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return { data, error };
        } catch (error) {
            console.error('Error fetching current session:', error);
            return { data: null, error };
        }
    },

    /**
     * Get all sessions for school
     */
    async getAllSessions(schoolId: string) {
        try {
            const { data, error } = await supabase
                .from('academic_sessions')
                .select('*')
                .eq('school_id', schoolId)
                .order('start_date', { ascending: false });

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error fetching sessions:', error);
            return { data: null, error };
        }
    },

    /**
     * Activate a session (only one active at a time)
     */
    async activateSession(schoolId: string, sessionId: string) {
        try {
            // First, deactivate all other sessions
            const { error: deactivateError } = await supabase
                .from('academic_sessions')
                .update({ is_current: false })
                .eq('school_id', schoolId);

            if (deactivateError) throw deactivateError;

            // Activate the target session
            const { data, error } = await supabase
                .from('academic_sessions')
                .update({ is_current: true })
                .eq('id', sessionId)
                .select()
                .single();

            if (error) throw error;

            // Log the action
            await this.logTermAutomation(
                schoolId,
                sessionId,
                'session_created',
                { action: 'session_activated' },
                true
            );

            return { success: true, data };
        } catch (error) {
            console.error('Error activating session:', error);
            return { success: false, error };
        }
    },

    /**
     * Create default terms for a session
     */
    async createDefaultTerms(schoolId: string, sessionId: string, calendarId?: string) {
        try {
            let calendar: AcademicCalendar | null = null;

            if (calendarId) {
                const { data } = await supabase
                    .from('academic_calendars')
                    .select('*')
                    .eq('id', calendarId)
                    .single();
                calendar = data;
            } else {
                // Get default calendar
                const { data } = await supabase
                    .from('academic_calendars')
                    .select('*')
                    .eq('school_id', schoolId)
                    .eq('is_default', true)
                    .single();
                calendar = data;
            }

            if (!calendar) {
                // Use Nigerian default calendar
                calendar = {
                    firstTermStartMonth: 9,
                    firstTermEndMonth: 12,
                    secondTermStartMonth: 1,
                    secondTermEndMonth: 3,
                    thirdTermStartMonth: 4,
                    thirdTermEndMonth: 7
                } as AcademicCalendar;
            }

            const terms = [
                {
                    school_id: schoolId,
                    session_id: sessionId,
                    name: 'First Term',
                    term_number: 1,
                    start_date: new Date(new Date().getFullYear(), calendar.firstTermStartMonth - 1, 1),
                    end_date: new Date(new Date().getFullYear(), calendar.firstTermEndMonth - 1, 30),
                    is_current: false
                },
                {
                    school_id: schoolId,
                    session_id: sessionId,
                    name: 'Second Term',
                    term_number: 2,
                    start_date: new Date(new Date().getFullYear(), calendar.secondTermStartMonth - 1, 1),
                    end_date: new Date(new Date().getFullYear(), calendar.secondTermEndMonth - 1, 30),
                    is_current: false
                },
                {
                    school_id: schoolId,
                    session_id: sessionId,
                    name: 'Third Term',
                    term_number: 3,
                    start_date: new Date(new Date().getFullYear(), calendar.thirdTermStartMonth - 1, 1),
                    end_date: new Date(new Date().getFullYear(), calendar.thirdTermEndMonth - 1, 30),
                    is_current: false
                }
            ];

            const { data, error } = await supabase
                .from('academic_terms')
                .insert(terms)
                .select();

            if (error) throw error;

            await this.logTermAutomation(
                schoolId,
                sessionId,
                'session_created',
                { termsCreated: terms.length },
                true
            );

            return { success: true, data };
        } catch (error) {
            console.error('Error creating default terms:', error);
            return { success: false, error };
        }
    },

    /**
     * Activate a term
     */
    async activateTerm(schoolId: string, sessionId: string, termId: string) {
        try {
            // Deactivate all other terms in this session
            const { error: deactivateError } = await supabase
                .from('academic_terms')
                .update({ is_current: false })
                .eq('session_id', sessionId);

            if (deactivateError) throw deactivateError;

            // Activate target term
            const { data, error } = await supabase
                .from('academic_terms')
                .update({ is_current: true })
                .eq('id', termId)
                .select()
                .single();

            if (error) throw error;

            await this.logTermAutomation(
                schoolId,
                sessionId,
                'term_activated',
                { termId },
                true
            );

            return { success: true, data };
        } catch (error) {
            console.error('Error activating term:', error);
            return { success: false, error };
        }
    },

    /**
     * Get current term
     */
    async getCurrentTerm(schoolId: string, sessionId: string) {
        try {
            const { data, error } = await supabase
                .from('academic_terms')
                .select('*')
                .eq('session_id', sessionId)
                .eq('is_current', true)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return { data, error };
        } catch (error) {
            console.error('Error fetching current term:', error);
            return { data: null, error };
        }
    },

    /**
     * Get all terms in session
     */
    async getSessionTerms(sessionId: string) {
        try {
            const { data, error } = await supabase
                .from('academic_terms')
                .select('*')
                .eq('session_id', sessionId)
                .order('term_number');

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error fetching session terms:', error);
            return { data: null, error };
        }
    },

    /**
     * Archive completed session
     */
    async archiveSession(schoolId: string, sessionId: string) {
        try {
            // Archive all session data
            const actions = [];

            // Get all students in session
            const { data: students } = await supabase
                .from('students')
                .select('id')
                .eq('school_id', schoolId);

            if (students) {
                for (const student of students) {
                    // Archive attendance
                    const { data: attendance } = await supabase
                        .from('attendance')
                        .select('*')
                        .eq('student_id', student.id);

                    if (attendance && attendance.length > 0) {
                        await supabase.from('archived_attendance').insert(
                            attendance.map(a => ({
                                school_id: schoolId,
                                student_id: student.id,
                                session_id: sessionId,
                                attendance_data: a,
                                total_days: 0,
                                present_days: 0,
                                absent_days: 0,
                                late_days: 0,
                                attendance_percentage: 0
                            }))
                        );
                    }

                    // Archive results
                    const { data: results } = await supabase
                        .from('grades')
                        .select('*')
                        .eq('student_id', student.id);

                    if (results && results.length > 0) {
                        await supabase.from('archived_results').insert(
                            results.map(r => ({
                                school_id: schoolId,
                                student_id: student.id,
                                session_id: sessionId,
                                results_data: r,
                                average_score: 0,
                                total_subjects: 0
                            }))
                        );
                    }

                    // Archive risk assessments
                    const { data: risks } = await supabase
                        .from('risk_assessments')
                        .select('*')
                        .eq('student_id', student.id);

                    if (risks && risks.length > 0) {
                        await supabase.from('archived_risk_assessments').insert(
                            risks.map(r => ({
                                school_id: schoolId,
                                student_id: student.id,
                                session_id: sessionId,
                                risk_score: r.risk_score,
                                risk_level: r.risk_level,
                                factors: r.factors,
                                recommendations: r.recommendations,
                                interventions_count: 0
                            }))
                        );
                    }
                }
            }

            await this.logTermAutomation(
                schoolId,
                sessionId,
                'session_archived',
                { archivedRecords: students?.length || 0 },
                true
            );

            return { success: true };
        } catch (error) {
            console.error('Error archiving session:', error);
            return { success: false, error };
        }
    },

    /**
     * Log automation actions
     */
    async logTermAutomation(
        schoolId: string,
        sessionId: string,
        actionType: string,
        actionDetails: Record<string, unknown>,
        success: boolean,
        errorMessage?: string,
        termId?: string
    ) {
        try {
            const { error } = await supabase
                .from('term_automation_logs')
                .insert({
                    school_id: schoolId,
                    session_id: sessionId,
                    term_id: termId,
                    action_type: actionType,
                    action_details: actionDetails,
                    success,
                    error_message: errorMessage,
                    affected_count: 0
                });

            if (error) console.error('Error logging automation:', error);
        } catch (error) {
            console.error('Error in logTermAutomation:', error);
        }
    }
};
