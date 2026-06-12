import { supabase } from '@/lib/supabase';

/**
 * Graduation Service
 * Handles graduation records, transcripts, and alumni management
 */

export const graduationService = {
    /**
     * Check if student is eligible for graduation
     */
    async checkGraduationEligibility(
        studentId: string,
        finalClassId: string,
        sessionId: string
    ) {
        try {
            // Get student
            const { data: student } = await supabase
                .from('students')
                .select('*')
                .eq('id', studentId)
                .single();

            if (!student) {
                return { eligible: false, reason: 'Student not found' };
            }

            // Check if in final class
            const { data: finalClass } = await supabase
                .from('classes')
                .select('grade_level')
                .eq('id', finalClassId)
                .single();

            if (!finalClass) {
                return { eligible: false, reason: 'Final class not found' };
            }

            // Check if in final year (SS3, or equivalent)
            const finalYearClasses = ['SS3', 'JSS3', 'PRIMARY_6', 'KG_FINAL'];
            const isFinalYear = finalYearClasses.some(year =>
                finalClass.grade_level.includes(year)
            );

            if (!isFinalYear) {
                return {
                    eligible: false,
                    reason: `Student is not in final year. Current class: ${finalClass.grade_level}`
                };
            }

            // Get academic record for final year
            const { data: academicRecord } = await supabase
                .from('student_academic_records')
                .select('*')
                .eq('student_id', studentId)
                .eq('session_id', sessionId)
                .single();

            if (!academicRecord) {
                return { eligible: false, reason: 'Academic record not found' };
            }

            // Check thresholds
            const hasPassedAllSubjects = academicRecord.average_score && academicRecord.average_score >= 40;
            const hasGoodAttendance = academicRecord.attendance_rate && academicRecord.attendance_rate >= 80;

            const checks = {
                isFinalYear: true,
                passedAllSubjects: hasPassedAllSubjects,
                goodAttendance: hasGoodAttendance,
                goodBehaviour: (academicRecord.behaviour_score || 0) >= 40,
                noOutstandingFees: await this.checkOutstandingFees(studentId, sessionId)
            };

            const allChecksPassed = Object.values(checks).every(check => check);

            return {
                eligible: allChecksPassed,
                checks,
                reason: allChecksPassed
                    ? 'Student is eligible for graduation'
                    : 'Student does not meet graduation requirements'
            };
        } catch (error) {
            console.error('Error checking graduation eligibility:', error);
            return {
                eligible: false,
                reason: 'Error checking eligibility'
            };
        }
    },

    /**
     * Check for outstanding fees
     */
    async checkOutstandingFees(studentId: string, sessionId: string): Promise<boolean> {
        try {
            const { data: obligations } = await supabase
                .from('fee_obligations')
                .select('amount_outstanding')
                .eq('student_id', studentId)
                .eq('session_id', sessionId);

            if (!obligations) return true;

            const totalOutstanding = obligations.reduce((sum, obj) => sum + (obj.amount_outstanding || 0), 0);
            return totalOutstanding === 0;
        } catch (error) {
            console.error('Error checking fees:', error);
            return false;
        }
    },

    /**
     * Graduate a student
     */
    async graduateStudent(
        studentId: string,
        schoolId: string,
        finalClassId: string,
        sessionId: string,
        finalGPA?: number,
        remarks?: string
    ) {
        try {
            const certificateNumber = await this.generateCertificateNumber(sessionId);

            const { data: graduation, error: gradError } = await supabase
                .from('graduation_records')
                .insert({
                    school_id: schoolId,
                    student_id: studentId,
                    final_class_id: finalClassId,
                    session_id: sessionId,
                    graduation_date: new Date().toISOString().split('T')[0],
                    final_gpa: finalGPA,
                    certificate_number: certificateNumber,
                    qualification: 'Graduation Certificate',
                    remarks
                })
                .select()
                .single();

            if (gradError) throw gradError;

            // Update student status to graduated
            const { error: statusError } = await supabase
                .from('students')
                .update({ status: 'graduated' })
                .eq('id', studentId);

            if (statusError) throw statusError;

            // Update academic record
            const { error: recordError } = await supabase
                .from('student_academic_records')
                .update({ promotion_status: 'graduated' })
                .eq('student_id', studentId)
                .eq('session_id', sessionId);

            if (recordError) throw recordError;

            const { auditService } = await import('@/services/auditService');
            void auditService.logAudit({
                schoolId,
                userType: 'staff',
                action: 'student_graduated',
                entityType: 'student',
                entityId: studentId,
                newValues: { sessionId, finalClassId, certificateNumber, finalGPA },
            });

            return { success: true, data: graduation };
        } catch (error) {
            console.error('Error graduating student:', error);
            return { success: false, error };
        }
    },

    /**
     * Generate unique certificate number
     */
    async generateCertificateNumber(sessionId: string): Promise<string> {
        try {
            // Format: EDUPULSE-2025/2026-00001
            const { data: lastGraduate } = await supabase
                .from('graduation_records')
                .select('certificate_number')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            let sequenceNumber = 1;
            if (lastGraduate?.certificate_number) {
                const lastSequence = parseInt(lastGraduate.certificate_number.split('-').pop() || '0');
                sequenceNumber = lastSequence + 1;
            }

            const { data: session } = await supabase
                .from('academic_sessions')
                .select('name')
                .eq('id', sessionId)
                .single();

            const certificateNumber = `EDUPULSE-${session?.name}-${String(sequenceNumber).padStart(5, '0')}`;
            return certificateNumber;
        } catch (error) {
            console.error('Error generating certificate number:', error);
            return `EDUPULSE-${Date.now()}`;
        }
    },

    /**
     * Get graduation candidates
     */
    async getGraduationCandidates(
        schoolId: string,
        sessionId: string,
        finalClassId?: string
    ) {
        try {
            let query = supabase
                .from('students')
                .select(`
          *,
          classes(name, grade_level),
          student_academic_records(
            average_score,
            attendance_rate,
            behaviour_score
          )
        `)
                .eq('school_id', schoolId)
                .eq('status', 'active');

            if (finalClassId) {
                query = query.eq('class_id', finalClassId);
            }

            const { data: candidates, error } = await query;

            if (error) throw error;

            // Filter to final year students
            const graduationCandidates = candidates?.filter(student => {
                const finalYearClasses = ['SS3', 'JSS3', 'PRIMARY_6', 'KG_FINAL'];
                return finalYearClasses.some(year =>
                    student.classes?.grade_level.includes(year)
                );
            }) || [];

            return { data: graduationCandidates, error: null };
        } catch (error) {
            console.error('Error fetching graduation candidates:', error);
            return { data: null, error };
        }
    },

    /**
     * Generate transcript for graduated student
     */
    async generateTranscript(
        studentId: string,
        includeDetails: boolean = true
    ) {
        try {
            const { data: student } = await supabase
                .from('students')
                .select('*')
                .eq('id', studentId)
                .single();

            const { data: graduation } = await supabase
                .from('graduation_records')
                .select('*')
                .eq('student_id', studentId)
                .single();

            if (!student || !graduation) {
                return {
                    success: false,
                    error: 'Student or graduation record not found'
                };
            }

            const transcriptData: {
                student: {
                    name: string;
                    admissionNumber: string | null;
                    dateOfBirth: string | null;
                };
                graduation: {
                    date: string | null;
                    certificateNumber: string | null;
                    finalGPA: number | null;
                    qualification: string | null;
                };
                academicHistory?: unknown;
            } = {
                student: {
                    name: `${student.first_name} ${student.last_name}`,
                    admissionNumber: student.admission_number,
                    dateOfBirth: student.date_of_birth
                },
                graduation: {
                    date: graduation.graduation_date,
                    certificateNumber: graduation.certificate_number,
                    finalGPA: graduation.final_gpa,
                    qualification: graduation.qualification
                }
            };

            if (includeDetails) {
                // Get full academic history
                const { data: academicRecords } = await supabase
                    .from('student_academic_records')
                    .select(`
            *,
            academic_sessions(name),
            academic_terms(name)
          `)
                    .eq('student_id', studentId)
                    .order('academic_sessions(start_date)', { ascending: true });

                transcriptData.academicHistory = academicRecords;
            }

            // Generate transcript URL (would be implemented with PDF generation service)
            const transcriptUrl = `/transcripts/${studentId}/${graduation.session_id}`;

            // Update graduation record
            await supabase
                .from('graduation_records')
                .update({
                    transcript_generated: true,
                    transcript_url: transcriptUrl
                })
                .eq('id', graduation.id);

            return {
                success: true,
                data: transcriptData,
                transcriptUrl
            };
        } catch (error) {
            console.error('Error generating transcript:', error);
            return {
                success: false,
                error
            };
        }
    },

    /**
     * Get all graduated students (alumni)
     */
    async getAlumni(schoolId: string) {
        try {
            const { data, error } = await supabase
                .from('students')
                .select(`
          *,
          graduation_records(*)
        `)
                .eq('school_id', schoolId)
                .eq('status', 'graduated');

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('Error fetching alumni:', error);
            return { data: null, error };
        }
    },

    /**
     * Check graduation status for a student
     */
    async getGraduationStatus(studentId: string) {
        try {
            const { data: student } = await supabase
                .from('students')
                .select('status')
                .eq('id', studentId)
                .single();

            if (!student) {
                return { graduated: false, reason: 'Student not found' };
            }

            if (student.status === 'graduated') {
                const { data: graduation } = await supabase
                    .from('graduation_records')
                    .select('*')
                    .eq('student_id', studentId)
                    .single();

                return {
                    graduated: true,
                    graduationDetails: graduation
                };
            }

            return { graduated: false, reason: 'Student has not graduated' };
        } catch (error) {
            console.error('Error checking graduation status:', error);
            return { graduated: false, reason: 'Error checking status' };
        }
    }
};
