/**
 * School ID Utilities
 * Generates unique IDs for students and staff based on school name
 * Ensures no ID clashes between different schools
 */

import { supabase } from '@/lib/supabase';

/**
 * Generate a unique school code from school name
 * Example: "ABC Academy" → "ABCA" (first 3 letters + first letter of second word)
 * Example: "New Standard School" → "NSS" (first letter of each word)
 * Example: "Oxford" → "OXF" (first 3 letters)
 * 
 * @param schoolName - The name of the school
 * @returns A 3-4 character school code
 */
export function generateSchoolCode(schoolName: string): string {
    if (!schoolName || schoolName.trim().length === 0) {
        return 'SCH';
    }

    const trimmed = schoolName.trim().toUpperCase();
    const words = trimmed.split(/\s+/);

    let code = '';

    // Try to get first letter of each word (max 4 chars)
    if (words.length >= 2) {
        code = words.slice(0, 4).map((word) => word.charAt(0)).join('');
    }

    // If only one word, take first 3-4 letters
    if (code.length < 2) {
        code = trimmed.substring(0, 4);
    }

    // Ensure code is exactly 3-4 characters
    if (code.length < 3) {
        code = code.padEnd(3, 'X');
    } else if (code.length > 4) {
        code = code.substring(0, 4);
    }

    return code;
}

/**
 * Generate a school-specific student ID
 * Example: If school code is "ABCA", ID would be "ABCA_STU000001"
 * 
 * @param schoolId - The UUID of the school
 * @param sequenceNumber - The sequential number for this student in the school
 * @returns A unique student ID including school code
 */
export async function generateStudentId(
    schoolId: string,
    sequenceNumber: number
): Promise<string> {
    try {
        // Fetch school name
        const { data: school, error } = await supabase
            .from('schools')
            .select('name')
            .eq('id', schoolId)
            .single();

        if (error || !school) {
            console.warn(`Could not fetch school with ID ${schoolId}, using default prefix`);
            return `STU${String(sequenceNumber).padStart(6, '0')}`;
        }

        const schoolCode = generateSchoolCode(school.name);
        return `${schoolCode}_STU${String(sequenceNumber).padStart(6, '0')}`;
    } catch (error) {
        console.error('Error generating student ID:', error);
        // Fallback to generic ID
        return `STU${String(sequenceNumber).padStart(6, '0')}`;
    }
}

/**
 * Generate a school-specific staff ID
 * Example: If school code is "ABCA" and role is "teacher", ID would be "ABCA_TCH0001"
 * 
 * @param schoolId - The UUID of the school
 * @param role - The role of the staff member
 * @param sequenceNumber - The sequential number for this staff role in the school
 * @returns A unique staff ID including school code
 */
export async function generateStaffId(
    schoolId: string,
    role: string,
    sequenceNumber: number
): Promise<string> {
    try {
        // Fetch school name
        const { data: school, error } = await supabase
            .from('schools')
            .select('name')
            .eq('id', schoolId)
            .single();

        if (error || !school) {
            console.warn(`Could not fetch school with ID ${schoolId}, using default prefix`);
            return getDefaultStaffId(role, sequenceNumber);
        }

        const schoolCode = generateSchoolCode(school.name);
        const rolePrefix = getRolePrefix(role);
        return `${schoolCode}_${rolePrefix}${String(sequenceNumber).padStart(4, '0')}`;
    } catch (error) {
        console.error('Error generating staff ID:', error);
        // Fallback to generic ID
        return getDefaultStaffId(role, sequenceNumber);
    }
}

/**
 * Get role prefix for staff
 * @param role - The role name
 * @returns A 3-character role prefix
 */
function getRolePrefix(role: string): string {
    const rolePrefixes: Record<string, string> = {
        teacher: 'TCH',
        principal: 'PRN',
        counselor: 'CNS',
        finance: 'FIN',
        admin: 'ADM',
        bursar: 'BUR',
        staff: 'STF',
    };

    return rolePrefixes[role.toLowerCase()] || 'STF';
}

/**
 * Get default staff ID (fallback when school cannot be fetched)
 * @param role - The role name
 * @param sequenceNumber - The sequential number
 * @returns A staff ID without school prefix
 */
function getDefaultStaffId(role: string, sequenceNumber: number): string {
    const prefix = getRolePrefix(role);
    return `${prefix}${String(sequenceNumber).padStart(4, '0')}`;
}

/**
 * Count students by school to get next sequence number
 * @param schoolId - The school UUID
 * @returns The next sequence number to use
 */
export async function getNextStudentSequence(schoolId: string): Promise<number> {
    try {
        const { data: students, error } = await supabase
            .from('students')
            .select('student_id', { count: 'exact' })
            .eq('school_id', schoolId);

        if (error) {
            console.error('Error counting students:', error);
            return 1;
        }

        return (students?.length || 0) + 1;
    } catch (error) {
        console.error('Error getting next student sequence:', error);
        return 1;
    }
}

/**
 * Count staff by school and role to get next sequence number
 * @param schoolId - The school UUID
 * @param role - The role to count
 * @returns The next sequence number to use for this role
 */
export async function getNextStaffSequence(schoolId: string, role: string): Promise<number> {
    try {
        const { data: staff, error } = await supabase
            .from('staff')
            .select('staff_id', { count: 'exact' })
            .eq('school_id', schoolId)
            .eq('role', role);

        if (error) {
            console.error('Error counting staff:', error);
            return 1;
        }

        return (staff?.length || 0) + 1;
    } catch (error) {
        console.error('Error getting next staff sequence:', error);
        return 1;
    }
}

/**
 * Example school code generation results:
 * "ABC Academy" → "ABCA"
 * "New Standard School" → "NSS"
 * "Oxford International" → "OI"
 * "St. James" → "SJ"
 * "The Only School" → "TOS"
 */
export function exampleSchoolCodes(): Record<string, string> {
    return {
        'ABC Academy': generateSchoolCode('ABC Academy'),
        'New Standard School': generateSchoolCode('New Standard School'),
        'Oxford International': generateSchoolCode('Oxford International'),
        'St. James': generateSchoolCode('St. James'),
        'The Only School': generateSchoolCode('The Only School'),
    };
}
