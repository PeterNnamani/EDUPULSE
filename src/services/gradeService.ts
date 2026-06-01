import { supabase } from '@/lib/supabase';

export interface GradeRecord {
    id: string;
    student_id: string;
    student_name: string;
    subject_id: string;
    subject_name: string;
    assessment_type: string;
    score: number;
    max_score: number;
    grade: string;
    remarks?: string;
}

export interface StudentGrades {
    studentId: string;
    studentName: string;
    grades: GradeRecord[];
    averageScore: number;
}

/**
 * Record a grade for a student
 */
export async function recordGrade(
    schoolId: string,
    studentId: string,
    classId: string,
    subjectId: string,
    academicTermId: string,
    assessmentType: 'ca1' | 'ca2' | 'ca3' | 'exam' | 'project' | 'test',
    score: number,
    maxScore: number = 100,
    remarks?: string,
    enteredById?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (score < 0 || score > maxScore) {
            return {
                success: false,
                error: `Score must be between 0 and ${maxScore}`,
            };
        }

        // Calculate letter grade
        const percentage = (score / maxScore) * 100;
        let grade = 'F';
        if (percentage >= 80) grade = 'A';
        else if (percentage >= 70) grade = 'B';
        else if (percentage >= 60) grade = 'C';
        else if (percentage >= 50) grade = 'D';
        else if (percentage >= 40) grade = 'E';

        // Check if grade already exists for this assessment
        const { data: existing, error: checkError } = await supabase
            .from('grades')
            .select('id')
            .eq('student_id', studentId)
            .eq('subject_id', subjectId)
            .eq('academic_term_id', academicTermId)
            .eq('assessment_type', assessmentType)
            .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
            console.error('Error checking grade:', checkError);
            return { success: false, error: 'Failed to check grade' };
        }

        if (existing) {
            // Update existing grade
            const { error: updateError } = await supabase
                .from('grades')
                .update({
                    score,
                    max_score: maxScore,
                    grade,
                    remarks: remarks || null,
                    entered_by: enteredById || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

            if (updateError) {
                console.error('Error updating grade:', updateError);
                return { success: false, error: updateError.message || 'Failed to update grade' };
            }

            console.log('[GRADE_UPDATED]', studentId, assessmentType, 'score', score);
            return { success: true };
        } else {
            // Create new grade record
            const { error: insertError } = await supabase
                .from('grades')
                .insert([
                    {
                        school_id: schoolId,
                        student_id: studentId,
                        class_id: classId,
                        subject_id: subjectId,
                        academic_term_id: academicTermId,
                        assessment_type: assessmentType,
                        score,
                        max_score: maxScore,
                        grade,
                        remarks: remarks || null,
                        entered_by: enteredById || null,
                    },
                ]);

            if (insertError) {
                console.error('Error creating grade:', insertError);
                return { success: false, error: insertError.message || 'Failed to record grade' };
            }

            console.log('[GRADE_RECORDED]', studentId, assessmentType, 'score', score);
            return { success: true };
        }
    } catch (error) {
        console.error('Record grade error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to record grade',
        };
    }
}

/**
 * Bulk record grades for a class in a subject
 */
export async function bulkRecordGrades(
    schoolId: string,
    classId: string,
    subjectId: string,
    academicTermId: string,
    assessmentType: string,
    grades: Array<{
        studentId: string;
        score: number;
        maxScore?: number;
    }>,
    enteredById?: string
): Promise<{ success: boolean; error?: string; recorded?: number }> {
    try {
        let recorded = 0;

        for (const gradeData of grades) {
            const result = await recordGrade(
                schoolId,
                gradeData.studentId,
                classId,
                subjectId,
                academicTermId,
                assessmentType as any,
                gradeData.score,
                gradeData.maxScore || 100,
                undefined,
                enteredById
            );

            if (result.success) {
                recorded++;
            }
        }

        console.log('[BULK_GRADES_RECORDED]', recorded, 'grades for', classId);
        return { success: true, recorded };
    } catch (error) {
        console.error('Bulk record grades error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to record grades',
        };
    }
}

/**
 * Get grades for a student
 */
export async function getStudentGrades(
    schoolId: string,
    studentId: string,
    academicTermId?: string
): Promise<GradeRecord[]> {
    try {
        let query = supabase
            .from('grades')
            .select(`
                id,
                student_id,
                subject_id,
                assessment_type,
                score,
                max_score,
                grade,
                remarks,
                students(first_name, last_name),
                subjects(name)
            `)
            .eq('school_id', schoolId)
            .eq('student_id', studentId);

        if (academicTermId) {
            query = query.eq('academic_term_id', academicTermId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching student grades:', error);
            return [];
        }

        return (data || []).map((record: any) => ({
            id: record.id,
            student_id: record.student_id,
            student_name: `${record.students?.first_name} ${record.students?.last_name}`,
            subject_id: record.subject_id,
            subject_name: record.subjects?.name || 'Unknown Subject',
            assessment_type: record.assessment_type,
            score: record.score,
            max_score: record.max_score,
            grade: record.grade,
            remarks: record.remarks,
        }));
    } catch (error) {
        console.error('Get student grades error:', error);
        return [];
    }
}

/**
 * Get all grades for a class in a subject
 */
export async function getClassGrades(
    classId: string,
    subjectId: string,
    assessmentType?: string
): Promise<StudentGrades[]> {
    try {
        const { data: students, error: studentError } = await supabase
            .from('students')
            .select('id, first_name, last_name')
            .eq('class_id', classId)
            .order('last_name', { ascending: true });

        if (studentError) {
            console.error('Error fetching students:', studentError);
            return [];
        }

        const result: StudentGrades[] = [];

        for (const student of students || []) {
            let query = supabase
                .from('grades')
                .select('score, max_score, grade, assessment_type')
                .eq('student_id', student.id)
                .eq('subject_id', subjectId);

            if (assessmentType) {
                query = query.eq('assessment_type', assessmentType);
            }

            const { data: grades } = await query;

            const gradeRecords = (grades || []).map((g: any) => ({
                id: `${student.id}-${g.assessment_type}`,
                student_id: student.id,
                student_name: `${student.first_name} ${student.last_name}`,
                subject_id: subjectId,
                subject_name: 'Subject',
                assessment_type: g.assessment_type,
                score: g.score,
                max_score: g.max_score,
                grade: g.grade,
            }));

            const averageScore =
                gradeRecords.length > 0
                    ? Math.round(gradeRecords.reduce((sum: number, g: any) => sum + g.score, 0) / gradeRecords.length)
                    : 0;

            result.push({
                studentId: student.id,
                studentName: `${student.first_name} ${student.last_name}`,
                grades: gradeRecords,
                averageScore,
            });
        }

        return result;
    } catch (error) {
        console.error('Get class grades error:', error);
        return [];
    }
}

/**
 * Get grade statistics for a class
 */
export async function getClassGradeStats(
    classId: string,
    subjectId: string
): Promise<{
    averageClassScore: number;
    highestScore: number;
    lowestScore: number;
    passPercentage: number;
    failCount: number;
    passCount: number;
}> {
    try {
        const { data: grades, error } = await supabase
            .from('grades')
            .select('score, max_score')
            .eq('class_id', classId)
            .eq('subject_id', subjectId);

        if (error || !grades || grades.length === 0) {
            return {
                averageClassScore: 0,
                highestScore: 0,
                lowestScore: 0,
                passPercentage: 0,
                passCount: 0,
                failCount: 0,
            };
        }

        const scores = grades.map((g: any) => (g.score / g.max_score) * 100);
        const averageClassScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
        const highestScore = Math.round(Math.max(...scores));
        const lowestScore = Math.round(Math.min(...scores));
        const passCount = scores.filter((s: number) => s >= 50).length;
        const failCount = scores.filter((s: number) => s < 50).length;
        const passPercentage = Math.round((passCount / scores.length) * 100);

        return {
            averageClassScore,
            highestScore,
            lowestScore,
            passPercentage,
            passCount,
            failCount,
        };
    } catch (error) {
        console.error('Get class grade stats error:', error);
        return {
            averageClassScore: 0,
            highestScore: 0,
            lowestScore: 0,
            passPercentage: 0,
            passCount: 0,
            failCount: 0,
        };
    }
}
