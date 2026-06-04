import { supabase } from '@/lib/supabase';

interface ClassData {
    id: string;
    school_id: string;
    name: string;
    grade_level: string;
    section?: string;
    capacity: number;
    class_teacher_id?: string;
    class_teacher?: string;
    students: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface CreateClassRequest {
    schoolId: string;
    name: string;
    gradeLevel: string;
    section: string;
    capacity: number;
    classTeacherId?: string;
}

interface CreateClassResponse {
    success: boolean;
    data?: ClassData;
    error?: string;
}

/**
 * Create a new class
 */
export async function createClass(
    request: CreateClassRequest
): Promise<CreateClassResponse> {
    try {
        // Validate inputs
        if (!request.name || !request.gradeLevel || !request.section) {
            return {
                success: false,
                error: 'Class name, grade level, and section are required',
            };
        }

        // Create the class record
        const { data: newClass, error: createError } = await supabase
            .from('classes')
            .insert([
                {
                    school_id: request.schoolId,
                    name: request.name,
                    grade_level: request.gradeLevel,
                    section: request.section,
                    capacity: request.capacity || 40,
                    class_teacher_id: request.classTeacherId || null,
                    is_active: true,
                },
            ])
            .select()
            .single();

        if (createError) {
            console.error('Error creating class:', createError);
            return {
                success: false,
                error: createError.message || 'Failed to create class',
            };
        }

        return {
            success: true,
            data: {
                id: newClass.id,
                school_id: newClass.school_id,
                name: newClass.name,
                grade_level: newClass.grade_level,
                section: newClass.section,
                capacity: newClass.capacity,
                class_teacher_id: newClass.class_teacher_id,
                students: 0,
                is_active: newClass.is_active,
                created_at: newClass.created_at,
                updated_at: newClass.updated_at,
            },
        };
    } catch (error) {
        console.error('Class creation error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create class',
        };
    }
}

/**
 * Get all classes for a school with student counts
 */
export async function getClasses(
    schoolId: string
): Promise<(ClassData & { students: number })[]> {
    try {
        // First, get all classes
        const { data: classesData, error: classError } = await supabase
            .from('classes')
            .select('id, school_id, name, grade_level, section, capacity, class_teacher_id, is_active, created_at, updated_at')
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (classError) {
            console.error('Error fetching classes:', classError);
            return [];
        }

        if (!classesData || classesData.length === 0) {
            return [];
        }

        // Get student counts for each class
        const classesWithCounts = await Promise.all(
            classesData.map(async (cls: any) => {
                const { count, error: countError } = await supabase
                    .from('students')
                    .select('id', { count: 'exact' })
                    .eq('school_id', schoolId)
                    .eq('class_id', cls.id);

                const studentCount = !countError && count ? count : 0;

                return {
                    id: cls.id,
                    school_id: cls.school_id,
                    name: cls.name,
                    grade_level: cls.grade_level,
                    section: cls.section,
                    capacity: cls.capacity,
                    class_teacher_id: cls.class_teacher_id,
                    students: studentCount,
                    is_active: cls.is_active,
                    created_at: cls.created_at,
                    updated_at: cls.updated_at,
                };
            })
        );

        return classesWithCounts;
    } catch (error) {
        console.error('Get classes error:', error);
        return [];
    }
}

/**
 * Get class by ID
 */
export async function getClassById(classId: string): Promise<ClassData | null> {
    try {
        const { data, error } = await supabase
            .from('classes')
            .select('*')
            .eq('id', classId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching class:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Get class error:', error);
        return null;
    }
}

/**
 * Update a class
 */
export async function updateClass(
    classId: string,
    updates: Partial<{
        name: string;
        gradeLevel: string;
        section: string;
        capacity: number;
        classTeacherId: string;
    }>
): Promise<{ success: boolean; error?: string }> {
    try {
        const updateData: Record<string, any> = {};

        if (updates.name) updateData.name = updates.name;
        if (updates.gradeLevel) updateData.grade_level = updates.gradeLevel;
        if (updates.section) updateData.section = updates.section;
        if (updates.capacity) updateData.capacity = updates.capacity;
        if (updates.classTeacherId) updateData.class_teacher_id = updates.classTeacherId;

        const { error } = await supabase
            .from('classes')
            .update(updateData)
            .eq('id', classId);

        if (error) {
            console.error('Error updating class:', error);
            return {
                success: false,
                error: error.message || 'Failed to update class',
            };
        }

        return { success: true };
    } catch (error) {
        console.error('Update class error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update class',
        };
    }
}

/**
 * Delete a class
 */
export async function deleteClass(classId: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Soft delete by setting is_active to false
        const { error } = await supabase
            .from('classes')
            .update({ is_active: false })
            .eq('id', classId);

        if (error) {
            console.error('Error deleting class:', error);
            return {
                success: false,
                error: error.message || 'Failed to delete class',
            };
        }

        return { success: true };
    } catch (error) {
        console.error('Delete class error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete class',
        };
    }
}

/**
 * Get classes assigned to a teacher
 */
export async function getTeacherClasses(
    schoolId: string,
    teacherId: string
): Promise<(ClassData & { students: number })[]> {
    try {
        const { data: classesData, error: classError } = await supabase
            .from('classes')
            .select('id, school_id, name, grade_level, section, capacity, class_teacher_id, is_active, created_at, updated_at')
            .eq('school_id', schoolId)
            .eq('class_teacher_id', teacherId)
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (classError) {
            console.error('Error fetching teacher classes:', classError);
            return [];
        }

        if (!classesData || classesData.length === 0) {
            return [];
        }

        // Get student counts for each class
        const classesWithCounts = await Promise.all(
            classesData.map(async (cls: any) => {
                const { count, error: countError } = await supabase
                    .from('students')
                    .select('id', { count: 'exact' })
                    .eq('school_id', schoolId)
                    .eq('class_id', cls.id);

                const studentCount = !countError && count ? count : 0;

                return {
                    id: cls.id,
                    school_id: cls.school_id,
                    name: cls.name,
                    grade_level: cls.grade_level,
                    section: cls.section,
                    capacity: cls.capacity,
                    class_teacher_id: cls.class_teacher_id,
                    students: studentCount,
                    is_active: cls.is_active,
                    created_at: cls.created_at,
                    updated_at: cls.updated_at,
                };
            })
        );

        return classesWithCounts;
    } catch (error) {
        console.error('Get teacher classes error:', error);
        return [];
    }
}

/**
 * Get students in a class
 */
export async function getClassStudents(classId: string, schoolId?: string): Promise<Array<any>> {
    try {
        let query = supabase
            .from('students')
            .select('id, student_id, first_name, last_name, middle_name, gender, class_id, status')
            .eq('class_id', classId)
            .eq('status', 'active');

        if (schoolId) {
            query = query.eq('school_id', schoolId);
        }

        const { data, error } = await query
            .order('last_name, first_name', { ascending: true });

        if (error) {
            console.error('Error fetching class students:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Get class students error:', error);
        return [];
    }
}
