import { supabase } from '@/lib/supabase';
import type { StudentStatus } from '@/types';
import { formatClassDisplay } from '@/utils/displayUtils';
import { normalizePhone, comparePhones, extractParentPhones, validatePhone } from '@/utils/phoneUtils';
import { generateStudentId, getNextStudentSequence } from '@/utils/schoolIdUtils';

export const STUDENT_STATUSES: StudentStatus[] = [
    'active',
    'graduated',
    'withdrawn',
    'suspended',
    'transferred',
];

/** Map legacy/UI values to DB-allowed student status. */
export function normalizeStudentStatus(status: string): StudentStatus | null {
    const value = status.trim().toLowerCase();
    if (value === 'inactive') return 'withdrawn';
    return STUDENT_STATUSES.includes(value as StudentStatus) ? (value as StudentStatus) : null;
}

interface CreateStudentRequest {
    schoolId: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    gender: 'male' | 'female';
    dateOfBirth?: string;
    classId: string;
    admissionNumber?: string;
    stateOfOrigin?: string;
    fatherName?: string;
    fatherPhone?: string;
    fatherEmail?: string;
    fatherOccupation?: string;
    motherName?: string;
    motherPhone?: string;
    motherEmail?: string;
    motherOccupation?: string;
    guardianName?: string;
    guardianPhone?: string;
    guardianEmail?: string;
    guardianRelationship?: string;
}

interface CreateStudentResponse {
    success: boolean;
    data?: {
        id: string;
        studentId: string;
        firstName: string;
        lastName: string;
        parentId?: string;
        virtualAccount?: {
            accountNumber: string | null;
            accountName: string | null;
            bankName: string | null;
        };
        virtualAccountError?: string;
    };
    error?: string;
}

interface StudentData {
    id: string;
    student_id: string;
    first_name: string;
    last_name: string;
    middle_name?: string;
    gender: string;
    date_of_birth?: string;
    class_id?: string;
    status: string;
    admission_number?: string;
    state_of_origin?: string;
}

interface StudentWithParent extends StudentData {
    parents?: Array<{
        id: string;
        father_name?: string;
        mother_name?: string;
        guardian_name?: string;
        primary_phone?: string;
        father_phone?: string;
        mother_phone?: string;
        guardian_phone?: string;
    }>;
}

/**
 * Create a new student and register parent/guardian
 * Links student to parent via student_parents table
 */
export interface StudentLimitInfo {
    allowed: boolean;
    current: number;
    max: number;
    planName: string;
    remaining: number;
}

/**
 * Returns the school's current student usage vs the plan limit.
 * Used to block creation and to surface usage on the dashboard.
 */
export async function checkStudentLimit(schoolId: string): Promise<StudentLimitInfo> {
    const [{ getSchoolSubscriptionStatus }, { getPlanDefinition }] = await Promise.all([
        import('@/services/subscriptionService'),
        import('@/config/planFeatures'),
    ]);

    const status = await getSchoolSubscriptionStatus(schoolId);
    // Active trial gets full access; expired/no-plan falls back to Starter.
    const planSource = status.activePlan
        ? status.activePlan
        : status.isTrial && !status.isExpired
            ? 'enterprise_plus'
            : 'starter';
    const plan = getPlanDefinition(planSource);

    const { count } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'active');

    const current = count ?? 0;
    const max = plan.maxStudents;
    const allowed = !Number.isFinite(max) || current < max;

    return {
        allowed,
        current,
        max: Number.isFinite(max) ? max : Infinity,
        planName: plan.name,
        remaining: Number.isFinite(max) ? Math.max(0, max - current) : Infinity,
    };
}

export async function createStudentWithParent(
    request: CreateStudentRequest
): Promise<CreateStudentResponse> {
    try {
        // Step 0: Enforce the plan's student limit.
        const limitCheck = await checkStudentLimit(request.schoolId);
        if (!limitCheck.allowed) {
            return {
                success: false,
                error: `Student limit reached for your ${limitCheck.planName} plan (${limitCheck.max}). Upgrade your subscription to add more students.`,
            };
        }

        // Step 1: Generate School-Specific Student ID
        const studentNumber = await getNextStudentSequence(request.schoolId);
        const studentId = await generateStudentId(request.schoolId, studentNumber);

        console.log(`[STUDENT_CREATION] Generated student ID: ${studentId} (sequence: ${studentNumber})`);

        // Step 2: Create Student Record
        const { data: newStudent, error: studentError } = await supabase
            .from('students')
            .insert([
                {
                    school_id: request.schoolId,
                    student_id: studentId,
                    first_name: request.firstName,
                    last_name: request.lastName,
                    middle_name: request.middleName || null,
                    gender: request.gender,
                    date_of_birth: request.dateOfBirth || null,
                    class_id: request.classId,
                    admission_number: request.admissionNumber || null,
                    state_of_origin: request.stateOfOrigin || null,
                    status: 'active',
                    admission_date: new Date().toISOString().split('T')[0],
                },
            ])
            .select()
            .single();

        if (studentError) {
            console.error('Error creating student:', studentError);
            return {
                success: false,
                error: studentError.message || 'Failed to create student',
            };
        }

        // Step 3: Create or Link Parent(s)
        let parentId: string | undefined;

        // Determine primary phone (prefer father, then mother, then guardian)
        const primaryPhone =
            request.fatherPhone || request.motherPhone || request.guardianPhone;

        if (primaryPhone) {
            // Normalize the phone number
            const normalizedPhone = normalizePhone(primaryPhone);

            if (!normalizedPhone) {
                console.warn('Invalid phone number provided:', primaryPhone);
                return {
                    success: false,
                    error: 'Invalid phone number format',
                };
            }

            console.log(`[STUDENT_CREATION] Normalized phone: ${primaryPhone} -> ${normalizedPhone}`);

            // Check if parent already exists with ANY matching phone field
            const { data: allParents, error: parentListError } = await supabase
                .from('parents')
                .select('id, primary_phone, father_phone, mother_phone, guardian_phone')
                .eq('school_id', request.schoolId);

            if (parentListError && parentListError.code !== 'PGRST116') {
                console.error('Error checking parents:', parentListError);
                throw parentListError;
            }

            // Find parent with matching phone across all phone fields
            let existingParent = null;
            if (allParents) {
                for (const parent of allParents) {
                    const parentPhones = extractParentPhones(parent);
                    if (parentPhones.includes(normalizedPhone)) {
                        existingParent = parent;
                        console.log(`[STUDENT_CREATION] Found existing parent: ${parent.id}`);
                        break;
                    }
                }
            }

            if (existingParent) {
                // Parent already exists, use existing ID
                parentId = existingParent.id;
            } else {
                // Create new parent record
                const { data: newParent, error: createParentError } = await supabase
                    .from('parents')
                    .insert([
                        {
                            school_id: request.schoolId,
                            father_name: request.fatherName || null,
                            father_phone: normalizedPhone && request.fatherPhone ? normalizedPhone : null,
                            father_email: request.fatherEmail || null,
                            father_occupation: request.fatherOccupation || null,
                            mother_name: request.motherName || null,
                            mother_phone: normalizedPhone && request.motherPhone ? normalizedPhone : null,
                            mother_email: request.motherEmail || null,
                            mother_occupation: request.motherOccupation || null,
                            guardian_name: request.guardianName || null,
                            guardian_phone: normalizedPhone && request.guardianPhone ? normalizedPhone : null,
                            guardian_email: request.guardianEmail || null,
                            guardian_relationship: request.guardianRelationship || null,
                            primary_phone: normalizedPhone,
                            email: request.fatherEmail || request.motherEmail || request.guardianEmail || null,
                            is_active: true,
                        },
                    ])
                    .select()
                    .single();

                if (createParentError) {
                    console.error('Error creating parent:', createParentError);
                    return {
                        success: false,
                        error: createParentError.message || 'Failed to create parent record',
                    };
                }

                parentId = newParent.id;
                console.log(`[STUDENT_CREATION] Created new parent: ${parentId}`);
            }

            // Step 4: Link Student to Parent(s)
            if (parentId) {
                // Determine relationship type
                let relationshipType: 'father' | 'mother' | 'guardian' = 'guardian';
                if (request.fatherPhone === primaryPhone) {
                    relationshipType = 'father';
                } else if (request.motherPhone === primaryPhone) {
                    relationshipType = 'mother';
                }

                // Check if relationship already exists
                const { data: existingRelationship, error: checkRelError } = await supabase
                    .from('student_parents')
                    .select('id')
                    .eq('student_id', newStudent.id)
                    .eq('parent_id', parentId)
                    .maybeSingle();

                if (checkRelError && checkRelError.code !== 'PGRST116') {
                    console.error('Error checking relationship:', checkRelError);
                }

                if (!existingRelationship) {
                    const { error: linkError } = await supabase
                        .from('student_parents')
                        .insert([
                            {
                                student_id: newStudent.id,
                                parent_id: parentId,
                                relationship: relationshipType,
                                is_primary: true,
                            },
                        ]);

                    if (linkError && linkError.code !== '23505') {
                        // 23505 is unique constraint violation - skip if already exists
                        console.error('Error linking student to parent:', linkError);
                        return {
                            success: false,
                            error: linkError.message || 'Failed to link student to parent',
                        };
                    }

                    console.log(
                        `[STUDENT_CREATION] Created relationship: student=${newStudent.id}, parent=${parentId}, type=${relationshipType}`
                    );
                } else {
                    console.log(
                        `[STUDENT_CREATION] Relationship already exists: student=${newStudent.id}, parent=${parentId}`
                    );
                }
            }
        }

        const { data: classRow } = await supabase
            .from('classes')
            .select('name, grade_level, section')
            .eq('id', request.classId)
            .eq('school_id', request.schoolId)
            .maybeSingle();

        const { dispatchStudentEnrolled } = await import('@/services/notificationDispatchService');
        void dispatchStudentEnrolled(
            request.schoolId,
            `${request.firstName} ${request.lastName}`,
            request.classId,
            classRow ? formatClassDisplay(classRow) : 'Class'
        );

        const { auditService } = await import('@/services/auditService');
        void auditService.logAudit({
            schoolId: request.schoolId,
            userType: 'staff',
            action: 'student_registered',
            entityType: 'student',
            entityId: newStudent.id,
            newValues: {
                studentId,
                name: `${request.firstName} ${request.lastName}`,
                classId: request.classId,
            },
        });

        const { feeAssignmentService } = await import('@/services/feeAssignmentService');
        void feeAssignmentService.assignFeesForStudent(
            request.schoolId,
            newStudent.id,
            request.classId,
            'registration'
        );

        let virtualAccount:
            | {
                  accountNumber: string | null;
                  accountName: string | null;
                  bankName: string | null;
              }
            | undefined;
        let virtualAccountError: string | undefined;

        try {
            const { schoolHasFeature } = await import('@/services/subscriptionService');
            const { monnifyService } = await import('@/services/monnifyService');
            if (await schoolHasFeature(request.schoolId, 'virtual_accounts')) {
                if (await monnifyService.isConfigured(request.schoolId)) {
                    const vaResult = await monnifyService.ensureVirtualAccount(
                        request.schoolId,
                        newStudent.id
                    );
                    if (vaResult.success && vaResult.account?.accountNumber) {
                        virtualAccount = {
                            accountNumber: vaResult.account.accountNumber,
                            accountName: vaResult.account.accountName,
                            bankName: vaResult.account.bankName,
                        };
                    } else if (!vaResult.success) {
                        virtualAccountError = vaResult.error;
                    } else {
                        virtualAccountError =
                            'Virtual account could not be retrieved. Check Monnify settings and try again from the student profile.';
                    }
                }
            }
        } catch (e) {
            console.warn('[STUDENT] virtual account reservation failed:', e);
            virtualAccountError =
                e instanceof Error ? e.message : 'Could not create virtual account';
        }

        return {
            success: true,
            data: {
                id: newStudent.id,
                studentId: studentId,
                firstName: request.firstName,
                lastName: request.lastName,
                parentId: parentId,
                virtualAccount,
                virtualAccountError,
            },
        };
    } catch (error) {
        console.error('Student creation error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create student',
        };
    }
}

/**
 * Fetch all students for a school
 */
export async function getStudents(schoolId: string): Promise<StudentData[]> {
    try {
        const { data, error } = await supabase
            .from('students')
            .select('id, student_id, first_name, last_name, middle_name, gender, date_of_birth, class_id, status, admission_number, state_of_origin')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching students:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Get students error:', error);
        return [];
    }
}

/**
 * Fetch children for a parent by phone number
 * Returns all students linked to a parent with that phone
 * Handles phone normalization for flexible matching
 */
export async function getChildrenByParentPhone(
    schoolId: string,
    phone: string
): Promise<StudentWithParent[]> {
    try {
        // Normalize the input phone
        const normalizedInputPhone = normalizePhone(phone);

        if (!normalizedInputPhone) {
            console.warn('[GET_CHILDREN] Invalid phone number provided:', phone);
            return [];
        }

        console.log(`[GET_CHILDREN] Looking up parent with phone: ${phone} (normalized: ${normalizedInputPhone})`);

        // Get all parents in the school
        const { data: allParents, error: parentsError } = await supabase
            .from('parents')
            .select('id, primary_phone, father_phone, mother_phone, guardian_phone, school_id')
            .eq('school_id', schoolId);

        if (parentsError) {
            console.error('[GET_CHILDREN] Error fetching parents:', parentsError);
            return [];
        }

        if (!allParents || allParents.length === 0) {
            console.log('[GET_CHILDREN] No parents found in school');
            return [];
        }

        // Find parent with matching phone across all phone fields
        let parentId: string | null = null;
        for (const parent of allParents) {
            const parentPhones = extractParentPhones(parent);
            if (parentPhones.includes(normalizedInputPhone)) {
                parentId = parent.id;
                console.log(`[GET_CHILDREN] Found matching parent: ${parentId}`);
                break;
            }
        }

        if (!parentId) {
            console.log('[GET_CHILDREN] No parent found with matching phone');
            return [];
        }

        // Get all students linked to this parent
        const { data: students, error: studentsError } = await supabase
            .from('student_parents')
            .select(
                `
        student_id,
        relationship,
        students(
          id,
          student_id,
          first_name,
          last_name,
          middle_name,
          gender,
          date_of_birth,
          class_id,
          status,
          admission_number,
          state_of_origin,
          classes(name)
        )
      `
            )
            .eq('parent_id', parentId);

        if (studentsError) {
            console.error('[GET_CHILDREN] Error fetching children:', studentsError);
            return [];
        }

        const result =
            students?.map((item: any) => ({
                id: item.students.id,
                student_id: item.students.student_id,
                first_name: item.students.first_name,
                last_name: item.students.last_name,
                middle_name: item.students.middle_name,
                gender: item.students.gender,
                date_of_birth: item.students.date_of_birth,
                class_id: item.students.class_id,
                class_name: (item.students.classes as { name?: string } | null)?.name ?? undefined,
                status: item.students.status,
                admission_number: item.students.admission_number,
                state_of_origin: item.students.state_of_origin,
            })) || [];

        console.log(`[GET_CHILDREN] Found ${result.length} children for parent`);
        return result;
    } catch (error) {
        console.error('[GET_CHILDREN] Get children error:', error);
        return [];
    }
}

/**
 * Update student information
 */
export async function updateStudent(
    studentId: string,
    updates: Partial<{
        firstName: string;
        lastName: string;
        middleName: string;
        gender: string;
        dateOfBirth: string;
        classId: string;
        status: string;
    }>
): Promise<{ success: boolean; error?: string }> {
    try {
        const updateData: Record<string, any> = {};

        if (updates.firstName) updateData.first_name = updates.firstName;
        if (updates.lastName) updateData.last_name = updates.lastName;
        if (updates.middleName) updateData.middle_name = updates.middleName;
        if (updates.gender) updateData.gender = updates.gender;
        if (updates.dateOfBirth) updateData.date_of_birth = updates.dateOfBirth;
        if (updates.classId) updateData.class_id = updates.classId;
        if (updates.status) {
            const normalizedStatus = normalizeStudentStatus(updates.status);
            if (!normalizedStatus) {
                return {
                    success: false,
                    error:
                        'Invalid student status. Use active, graduated, withdrawn, suspended, or transferred.',
                };
            }
            updateData.status = normalizedStatus;
        }

        const { error } = await supabase
            .from('students')
            .update(updateData)
            .eq('id', studentId);

        if (error) {
            console.error('Error updating student:', error);
            const constraintMsg =
                error.code === '23514'
                    ? 'Invalid student status. Use active, graduated, withdrawn, suspended, or transferred.'
                    : undefined;
            return {
                success: false,
                error: constraintMsg || error.message || 'Failed to update student',
            };
        }

        if (updates.firstName || updates.lastName || updates.middleName) {
            const { data: studentRow } = await supabase
                .from('students')
                .select('school_id')
                .eq('id', studentId)
                .maybeSingle();
            if (studentRow?.school_id) {
                void (async () => {
                    try {
                        const { monnifyService } = await import('@/services/monnifyService');
                        if (await monnifyService.isConfigured(studentRow.school_id)) {
                            await monnifyService.syncVirtualAccountName(studentRow.school_id, studentId);
                        }
                    } catch (e) {
                        console.warn('[STUDENT] virtual account name sync skipped:', e);
                    }
                })();
            }
        }

        if (updates.classId || updates.status) {
            const { data: studentRow } = await supabase
                .from('students')
                .select('school_id')
                .eq('id', studentId)
                .maybeSingle();
            if (studentRow?.school_id) {
                const { auditService } = await import('@/services/auditService');
                void auditService.logAudit({
                    schoolId: studentRow.school_id,
                    userType: 'staff',
                    action: updates.status ? 'student_transferred' : 'student_class_changed',
                    entityType: 'student',
                    entityId: studentId,
                    newValues: { classId: updates.classId, status: updates.status },
                });

                if (updates.classId) {
                    const { feeAssignmentService } = await import('@/services/feeAssignmentService');
                    void feeAssignmentService.assignFeesForStudent(
                        studentRow.school_id,
                        studentId,
                        updates.classId,
                        'class_change'
                    );
                }
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Update student error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update student',
        };
    }
}

/** Fetch a single student by internal UUID. */
export async function getStudent(studentId: string) {
    const { data, error } = await supabase
        .from('students')
        .select(
            'id, student_id, first_name, last_name, middle_name, gender, date_of_birth, class_id, status, admission_number, state_of_origin, school_id'
        )
        .eq('id', studentId)
        .maybeSingle();

    return { data, error };
}

export const studentService = {
    getStudent,
    getStudents,
    createStudentWithParent,
    updateStudent,
    getChildrenByParentPhone,
    checkStudentLimit,
    normalizeStudentStatus,
    STUDENT_STATUSES,
};
