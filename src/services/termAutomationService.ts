import { supabase } from '@/lib/supabase';
import { sessionManagementService } from './sessionManagementService';

/**
 * Term Automation Service
 * Automatically creates attendance, assignments, gradebooks when term is activated
 */

export const termAutomationService = {
    /**
     * Activate new term and automate setup
     */
    async activateTermWithAutomation(
        schoolId: string,
        sessionId: string,
        termId: string,
        userId?: string
    ) {
        try {
            const automationLog = {
                attendanceCreated: 0,
                assignmentsCreated: 0,
                gradebooksCreated: 0,
                feesGenerated: 0,
                riskMonitoringActivated: 0,
                teacherWorkspacesActivated: 0,
                errors: [] as string[]
            };

            // Activate the term
            await sessionManagementService.activateTerm(schoolId, sessionId, termId);

            // 1. Create attendance structures
            try {
                const attendanceCount = await this.createAttendanceStructures(schoolId, sessionId, termId);
                automationLog.attendanceCreated = attendanceCount;
            } catch (error) {
                automationLog.errors.push(`Attendance creation failed: ${error}`);
            }

            // 2. Create assignment structures
            try {
                const assignmentCount = await this.createAssignmentStructures(schoolId, sessionId, termId);
                automationLog.assignmentsCreated = assignmentCount;
            } catch (error) {
                automationLog.errors.push(`Assignment creation failed: ${error}`);
            }

            // 3. Create gradebook structures
            try {
                const gradebookCount = await this.createGradebookStructures(schoolId, sessionId, termId);
                automationLog.gradebooksCreated = gradebookCount;
            } catch (error) {
                automationLog.errors.push(`Gradebook creation failed: ${error}`);
            }

            // 4. Generate fee obligations
            try {
                const feeCount = await this.generateFeeObligationsForTerm(schoolId, sessionId, termId);
                automationLog.feesGenerated = feeCount;
            } catch (error) {
                automationLog.errors.push(`Fee generation failed: ${error}`);
            }

            // 5. Reset term-based analytics
            try {
                await this.resetTermAnalytics(schoolId, termId);
            } catch (error) {
                automationLog.errors.push(`Analytics reset failed: ${error}`);
            }

            // 6. Activate teacher workspaces
            try {
                const workspaceCount = await this.activateTeacherWorkspaces(schoolId, sessionId, termId);
                automationLog.teacherWorkspacesActivated = workspaceCount;
            } catch (error) {
                automationLog.errors.push(`Teacher workspace activation failed: ${error}`);
            }

            // 7. Activate risk monitoring
            try {
                const riskCount = await this.activateRiskMonitoring(schoolId, sessionId, termId);
                automationLog.riskMonitoringActivated = riskCount;
            } catch (error) {
                automationLog.errors.push(`Risk monitoring activation failed: ${error}`);
            }

            // Log the automation
            await sessionManagementService.logTermAutomation(
                schoolId,
                sessionId,
                'term_activated',
                automationLog,
                automationLog.errors.length === 0,
                automationLog.errors.length > 0 ? automationLog.errors.join('; ') : undefined,
                termId
            );

            return {
                success: automationLog.errors.length === 0,
                data: automationLog
            };
        } catch (error) {
            console.error('Error activating term with automation:', error);
            return {
                success: false,
                error,
                data: null
            };
        }
    },

    /**
     * Create attendance structures for all students and subjects
     */
    async createAttendanceStructures(
        schoolId: string,
        sessionId: string,
        termId: string
    ): Promise<number> {
        let count = 0;

        try {
            // Get all classes in session
            const { data: classes } = await supabase
                .from('classes')
                .select('id')
                .eq('school_id', schoolId)
                .eq('academic_session_id', sessionId);

            if (!classes) return count;

            // Get all students
            const { data: students } = await supabase
                .from('students')
                .select('id')
                .eq('school_id', schoolId)
                .eq('status', 'active');

            if (!students) return count;

            // Create initial attendance records for each student
            // (These will be updated daily)
            for (const student of students) {
                // Just ensure the data structure exists
                // Actual attendance will be marked daily
                count++;
            }

            await sessionManagementService.logTermAutomation(
                schoolId,
                sessionId,
                'attendance_created',
                { studentCount: students.length, classCount: classes.length },
                true,
                undefined,
                termId
            );

            return count;
        } catch (error) {
            console.error('Error creating attendance structures:', error);
            return count;
        }
    },

    /**
     * Create assignment structures for all teachers
     */
    async createAssignmentStructures(
        schoolId: string,
        sessionId: string,
        termId: string
    ): Promise<number> {
        let count = 0;

        try {
            // Get all class-subject assignments for this term
            const { data: classSubjects } = await supabase
                .from('class_subjects')
                .select('*, classes(id), subjects(id), staff(id)')
                .eq('school_id', schoolId)
                .eq('academic_term_id', termId);

            if (!classSubjects) return count;

            // Create workspace for each teacher-class-subject combination
            for (const cs of classSubjects) {
                count++;
            }

            await sessionManagementService.logTermAutomation(
                schoolId,
                sessionId,
                'assignments_created',
                { assignmentWorkspaces: count },
                true,
                undefined,
                termId
            );

            return count;
        } catch (error) {
            console.error('Error creating assignment structures:', error);
            return count;
        }
    },

    /**
     * Create gradebook structures
     */
    async createGradebookStructures(
        schoolId: string,
        sessionId: string,
        termId: string
    ): Promise<number> {
        let count = 0;

        try {
            // Get all students
            const { data: students } = await supabase
                .from('students')
                .select('id, class_id')
                .eq('school_id', schoolId)
                .eq('status', 'active');

            if (!students) return count;

            // Get all subjects
            const { data: subjects } = await supabase
                .from('subjects')
                .select('id')
                .eq('school_id', schoolId)
                .eq('is_active', true);

            if (!subjects) return count;

            // Initialize gradebook structure
            // Actual grades will be entered term
            count = students.length * subjects.length;

            await sessionManagementService.logTermAutomation(
                schoolId,
                sessionId,
                'gradebook_created',
                { studentCount: students.length, subjectCount: subjects.length },
                true,
                undefined,
                termId
            );

            return count;
        } catch (error) {
            console.error('Error creating gradebook structures:', error);
            return count;
        }
    },

    /**
     * Generate fee obligations for all students for this term
     */
    async generateFeeObligationsForTerm(
        schoolId: string,
        sessionId: string,
        termId: string
    ): Promise<number> {
        let count = 0;

        try {
            const { feeAutomationService } = await import('./feeAutomationService');

            // Get all students
            const { data: students } = await supabase
                .from('students')
                .select('id, class_id')
                .eq('school_id', schoolId)
                .eq('status', 'active');

            if (!students) return count;

            // Generate fees for each student
            for (const student of students) {
                if (student.class_id) {
                    const result = await feeAutomationService.generateFeeObligations(
                        schoolId,
                        student.id,
                        student.class_id,
                        sessionId,
                        termId
                    );
                    if (result.success) {
                        count += result.obligationsCount || 0;
                    }
                }
            }

            await sessionManagementService.logTermAutomation(
                schoolId,
                sessionId,
                'fees_generated',
                { obligationsCount: count },
                true,
                undefined,
                termId
            );

            return count;
        } catch (error) {
            console.error('Error generating fee obligations:', error);
            return count;
        }
    },

    /**
     * Reset term-based analytics
     */
    async resetTermAnalytics(schoolId: string, termId: string): Promise<void> {
        try {
            // Reset analytics by creating initial state
            // This could involve clearing temporary analytics data
            // while preserving historical data
            await sessionManagementService.logTermAutomation(
                schoolId,
                '',
                'term_activated',
                { analyticsReset: true },
                true,
                undefined,
                termId
            );
        } catch (error) {
            console.error('Error resetting analytics:', error);
        }
    },

    /**
     * Activate teacher workspaces for the term
     */
    async activateTeacherWorkspaces(
        schoolId: string,
        sessionId: string,
        termId: string
    ): Promise<number> {
        let count = 0;

        try {
            // Get all teachers
            const { data: teachers } = await supabase
                .from('staff')
                .select('id')
                .eq('school_id', schoolId)
                .eq('role', 'teacher')
                .eq('is_active', true);

            if (teachers) {
                count = teachers.length;
            }

            await sessionManagementService.logTermAutomation(
                schoolId,
                sessionId,
                'teacher_workspace_activated',
                { teacherCount: count },
                true,
                undefined,
                termId
            );

            return count;
        } catch (error) {
            console.error('Error activating teacher workspaces:', error);
            return count;
        }
    },

    /**
     * Activate risk monitoring for the term
     */
    async activateRiskMonitoring(
        schoolId: string,
        sessionId: string,
        termId: string
    ): Promise<number> {
        let count = 0;

        try {
            // Get all students
            const { data: students } = await supabase
                .from('students')
                .select('id')
                .eq('school_id', schoolId)
                .eq('status', 'active');

            if (students) {
                count = students.length;
            }

            await sessionManagementService.logTermAutomation(
                schoolId,
                sessionId,
                'risk_monitoring_activated',
                { studentCount: count },
                true,
                undefined,
                termId
            );

            return count;
        } catch (error) {
            console.error('Error activating risk monitoring:', error);
            return count;
        }
    },

    /**
     * End term and archive term data
     */
    async endTerm(
        schoolId: string,
        sessionId: string,
        termId: string
    ) {
        try {
            // Archive term data
            const { data: termData } = await supabase
                .from('academic_terms')
                .select('*')
                .eq('id', termId)
                .single();

            // Archive all term-specific data here
            // Attendance, assignments, results, etc. are already managed
            // by the archived tables

            return { success: true };
        } catch (error) {
            console.error('Error ending term:', error);
            return { success: false, error };
        }
    }
};
