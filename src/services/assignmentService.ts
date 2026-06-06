import { supabase } from '@/lib/supabase';

interface CreateAssignmentRequest {
    schoolId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    title: string;
    description?: string;
    totalMarks?: number;
    dueDate: string;
    assignmentType: 'homework' | 'project' | 'assignment' | 'test';
    academicTermId?: string;
}

interface AssignmentData {
    id: string;
    school_id: string;
    class_id: string;
    subject_id: string;
    teacher_id: string;
    title: string;
    description?: string;
    total_marks: number;
    due_date: string;
    assignment_type: string;
    status: string;
    created_at: string;
    updated_at: string;
}

interface AssignmentSubmissionData {
    id: string;
    assignment_id: string;
    student_id: string;
    submitted_at?: string;
    score?: number;
    remarks?: string;
    attachment_url?: string;
    status: string;
    graded_by?: string;
    graded_at?: string;
    created_at: string;
    updated_at: string;
}

/**
 * Create a new assignment
 */
export async function createAssignment(
    request: CreateAssignmentRequest
): Promise<{ success: boolean; data?: AssignmentData; error?: string }> {
    try {
        if (!request.title || !request.classId) {
            return {
                success: false,
                error: 'Title and class are required',
            };
        }

        const { data, error } = await supabase
            .from('assignments')
            .insert([
                {
                    school_id: request.schoolId,
                    class_id: request.classId,
                    subject_id: request.subjectId,
                    teacher_id: request.teacherId,
                    title: request.title,
                    description: request.description || null,
                    total_marks: request.totalMarks || 100,
                    due_date: request.dueDate,
                    assignment_type: request.assignmentType,
                    academic_term_id: request.academicTermId || null,
                    status: 'active',
                },
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating assignment:', error);
            return {
                success: false,
                error: error.message || 'Failed to create assignment',
            };
        }

        console.log('[ASSIGNMENT_CREATED]', data.id, 'for class', request.classId);

        const { dispatchNewAssignment } = await import('@/services/notificationDispatchService');
        void dispatchNewAssignment(
            request.schoolId,
            request.title,
            data.id,
            request.classId,
            request.dueDate
        );

        const { teacherActivityService } = await import('@/services/teacherActivityService');
        void teacherActivityService.logActivity({
            schoolId: request.schoolId,
            staffId: request.teacherId ?? null,
            action: 'assignment_created',
            entityType: 'assignment',
            entityId: data.id,
            relatedClassId: request.classId,
            details: { title: request.title, dueDate: request.dueDate },
        });

        return { success: true, data };
    } catch (error) {
        console.error('Create assignment error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create assignment',
        };
    }
}

/**
 * Get all assignments for a teacher
 */
export async function getTeacherAssignments(
    schoolId: string,
    teacherId: string
): Promise<(AssignmentData & { submissions?: number; total_students?: number })[]> {
    try {
        const { data, error } = await supabase
            .from('assignments')
            .select('*')
            .eq('school_id', schoolId)
            .eq('teacher_id', teacherId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching teacher assignments:', error);
            return [];
        }

        // Get submission counts for each assignment
        const assignmentsWithStats = await Promise.all(
            (data || []).map(async (assignment: any) => {
                // Get submission count
                const { count: submissionCount } = await supabase
                    .from('assignment_submissions')
                    .select('*', { count: 'exact', head: true })
                    .eq('assignment_id', assignment.id)
                    .in('status', ['submitted', 'graded', 'late']);

                // Get total students in the class
                const { count: totalStudents } = await supabase
                    .from('students')
                    .select('*', { count: 'exact', head: true })
                    .eq('class_id', assignment.class_id)
                    .eq('school_id', schoolId);

                return {
                    ...assignment,
                    submissions: submissionCount || 0,
                    total_students: totalStudents || 0,
                };
            })
        );

        return assignmentsWithStats;
    } catch (error) {
        console.error('Get teacher assignments error:', error);
        return [];
    }
}

/**
 * Get assignments for a class
 */
export async function getClassAssignments(classId: string): Promise<AssignmentData[]> {
    try {
        const { data, error } = await supabase
            .from('assignments')
            .select('*')
            .eq('class_id', classId)
            .order('due_date', { ascending: true });

        if (error) {
            console.error('Error fetching class assignments:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Get class assignments error:', error);
        return [];
    }
}

/**
 * Get assignments for a student across all their classes
 */
export async function getStudentAssignments(
    schoolId: string,
    studentId: string
): Promise<(AssignmentData & { submissions?: AssignmentSubmissionData[] })[]> {
    try {
        // First get the student's class
        const { data: studentData, error: studentError } = await supabase
            .from('students')
            .select('class_id')
            .eq('id', studentId)
            .single();

        if (studentError) {
            console.error('Error fetching student:', studentError);
            return [];
        }

        if (!studentData.class_id) {
            return [];
        }

        // Get all assignments for the student's class
        const { data: assignments, error: assignError } = await supabase
            .from('assignments')
            .select('*')
            .eq('school_id', schoolId)
            .eq('class_id', studentData.class_id)
            .order('due_date', { ascending: true });

        if (assignError) {
            console.error('Error fetching assignments:', assignError);
            return [];
        }

        // Get submissions for each assignment
        const assignmentsWithSubmissions = await Promise.all(
            (assignments || []).map(async (assignment) => {
                const { data: submissions, error: subError } = await supabase
                    .from('assignment_submissions')
                    .select('*')
                    .eq('assignment_id', assignment.id)
                    .eq('student_id', studentId);

                if (subError) {
                    console.error('Error fetching submissions:', subError);
                    return assignment;
                }

                return {
                    ...assignment,
                    submissions: submissions || [],
                };
            })
        );

        return assignmentsWithSubmissions;
    } catch (error) {
        console.error('Get student assignments error:', error);
        return [];
    }
}

export type SubmissionOption =
    | 'homework_completed'
    | 'attendance_confirmed'
    | 'project_submitted'
    | 'parent_acknowledged'
    | 'other';

export const SUBMISSION_OPTION_LABELS: Record<SubmissionOption, string> = {
    homework_completed: 'Homework completed',
    attendance_confirmed: 'Attendance confirmed',
    project_submitted: 'Project submitted',
    parent_acknowledged: 'Parent acknowledged',
    other: 'Other',
};

function buildSubmissionRemarks(
    option: SubmissionOption,
    notes?: string,
    submittedBy?: 'parent' | 'teacher'
): string {
    const label = SUBMISSION_OPTION_LABELS[option];
    const by = submittedBy === 'teacher' ? 'Teacher' : 'Parent';
    const extra = notes?.trim() ? ` — ${notes.trim()}` : '';
    return `[${by}] ${label}${extra}`;
}

/**
 * Create assignment submission (parent or teacher marking as submitted)
 */
export async function submitAssignment(
    schoolId: string,
    assignmentId: string,
    studentId: string,
    options?: {
        attachmentUrl?: string;
        remarks?: string;
        submissionOption?: SubmissionOption;
        submittedBy?: 'parent' | 'teacher';
        notes?: string;
    }
): Promise<{ success: boolean; data?: AssignmentSubmissionData; error?: string }> {
    const attachmentUrl = options?.attachmentUrl;
    const submissionOption = options?.submissionOption ?? 'homework_completed';
    const submittedBy = options?.submittedBy ?? 'parent';
    const remarks =
        options?.remarks ??
        buildSubmissionRemarks(submissionOption, options?.notes, submittedBy);
    try {
        // Check if submission already exists
        const { data: existing } = await supabase
            .from('assignment_submissions')
            .select('id')
            .eq('assignment_id', assignmentId)
            .eq('student_id', studentId)
            .maybeSingle();

        const now = new Date().toISOString();
        let saved: AssignmentSubmissionData | undefined;

        if (existing) {
            const { data, error } = await supabase
                .from('assignment_submissions')
                .update({
                    submitted_at: now,
                    attachment_url: attachmentUrl || null,
                    remarks: remarks || null,
                    status: 'submitted',
                    updated_at: now,
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating submission:', error);
                return {
                    success: false,
                    error: error.message || 'Failed to update submission',
                };
            }
            saved = data;
        } else {
            const { data, error } = await supabase
                .from('assignment_submissions')
                .insert([
                    {
                        school_id: schoolId,
                        assignment_id: assignmentId,
                        student_id: studentId,
                        submitted_at: now,
                        attachment_url: attachmentUrl || null,
                        remarks: remarks || null,
                        status: 'submitted',
                    },
                ])
                .select()
                .single();

            if (error) {
                console.error('Error creating submission:', error);
                return {
                    success: false,
                    error: error.message || 'Failed to create submission',
                };
            }
            saved = data;
        }

        console.log('[ASSIGNMENT_SUBMITTED]', assignmentId, 'by', submittedBy, studentId);

        const { dispatchAssignmentSubmitted } = await import('@/services/notificationDispatchService');
        void dispatchAssignmentSubmitted(
            schoolId,
            assignmentId,
            studentId,
            submittedBy,
            SUBMISSION_OPTION_LABELS[submissionOption]
        );

        return { success: true, data: saved };
    } catch (error) {
        console.error('Submit assignment error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to submit assignment',
        };
    }
}

/**
 * Teacher marks a student's assignment as submitted
 */
export async function teacherMarkSubmitted(
    schoolId: string,
    assignmentId: string,
    studentId: string,
    submissionOption: SubmissionOption = 'homework_completed',
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    const result = await submitAssignment(schoolId, assignmentId, studentId, {
        submissionOption,
        submittedBy: 'teacher',
        notes,
    });
    return { success: result.success, error: result.error };
}

export interface AssignmentSubmissionWithStudent extends AssignmentSubmissionData {
    student_name: string;
    student_number?: string;
}

/**
 * All submissions for an assignment with student names (teacher view)
 */
export async function getAssignmentSubmissions(
    schoolId: string,
    assignmentId: string,
    classId: string
): Promise<AssignmentSubmissionWithStudent[]> {
    try {
        const { data: students } = await supabase
            .from('students')
            .select('id, first_name, last_name, student_id')
            .eq('school_id', schoolId)
            .eq('class_id', classId)
            .eq('status', 'active')
            .order('first_name');

        const { data: submissions } = await supabase
            .from('assignment_submissions')
            .select('*')
            .eq('assignment_id', assignmentId);

        const subMap = new Map((submissions ?? []).map((s) => [s.student_id, s]));

        return (students ?? []).map((s) => {
            const sub = subMap.get(s.id);
            return {
                id: sub?.id ?? '',
                assignment_id: assignmentId,
                student_id: s.id,
                submitted_at: sub?.submitted_at,
                score: sub?.score,
                remarks: sub?.remarks,
                attachment_url: sub?.attachment_url,
                status: sub?.status ?? 'pending',
                graded_by: sub?.graded_by,
                graded_at: sub?.graded_at,
                created_at: sub?.created_at ?? '',
                updated_at: sub?.updated_at ?? '',
                student_name: `${s.first_name} ${s.last_name}`,
                student_number: s.student_id,
            };
        });
    } catch (error) {
        console.error('Get assignment submissions error:', error);
        return [];
    }
}

/**
 * Grade an assignment submission
 */
export async function gradeSubmission(
    submissionId: string,
    score: number,
    remarks?: string,
    gradedById?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const now = new Date().toISOString();

        const { error } = await supabase
            .from('assignment_submissions')
            .update({
                score,
                remarks: remarks || null,
                graded_by: gradedById || null,
                graded_at: now,
                status: 'graded',
                updated_at: now,
            })
            .eq('id', submissionId);

        if (error) {
            console.error('Error grading submission:', error);
            return {
                success: false,
                error: error.message || 'Failed to grade submission',
            };
        }

        console.log('[ASSIGNMENT_GRADED]', submissionId);
        return { success: true };
    } catch (error) {
        console.error('Grade submission error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to grade submission',
        };
    }
}

/**
 * Get assignment statistics for a class
 */
export async function getAssignmentStats(
    classId: string
): Promise<{
    totalAssignments: number;
    activeAssignments: number;
    completedAssignments: number;
    averageSubmissionRate: number;
} | null> {
    try {
        const { data: assignments, error: assignError } = await supabase
            .from('assignments')
            .select('id, status')
            .eq('class_id', classId);

        if (assignError) {
            console.error('Error fetching assignments:', assignError);
            return null;
        }

        if (!assignments || assignments.length === 0) {
            return {
                totalAssignments: 0,
                activeAssignments: 0,
                completedAssignments: 0,
                averageSubmissionRate: 0,
            };
        }

        let totalSubmissions = 0;
        let totalExpected = 0;

        for (const assignment of assignments) {
            const { count: submissionCount, error: subError } = await supabase
                .from('assignment_submissions')
                .select('id', { count: 'exact' })
                .eq('assignment_id', assignment.id)
                .neq('status', 'pending');

            const { count: studentCount, error: stdError } = await supabase
                .from('students')
                .select('id', { count: 'exact' })
                .eq('class_id', classId);

            if (!subError && submissionCount) {
                totalSubmissions += submissionCount;
            }
            if (!stdError && studentCount) {
                totalExpected += studentCount;
            }
        }

        const activeCount = assignments.filter((a) => a.status === 'active').length;
        const completedCount = assignments.filter((a) => a.status === 'closed').length;

        return {
            totalAssignments: assignments.length,
            activeAssignments: activeCount,
            completedAssignments: completedCount,
            averageSubmissionRate: totalExpected > 0 ? (totalSubmissions / totalExpected) * 100 : 0,
        };
    } catch (error) {
        console.error('Get assignment stats error:', error);
        return null;
    }
}
