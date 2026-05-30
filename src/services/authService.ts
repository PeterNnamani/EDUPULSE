import { supabase } from '@/lib/supabase';
import { getChildrenByParentPhone } from './studentService';
import { normalizePhone, extractParentPhones } from '@/utils/phoneUtils';

interface AdminLoginResponse {
    success: boolean;
    user?: {
        id: string;
        email: string;
        staffId: string;
        fullName: string;
        phone: string;
        schoolId: string;
        photoUrl: string | null;
    };
    error?: string;
}

interface CreateStaffResponse {
    success: boolean;
    data?: {
        staffId: string;
        temporaryPin: string;
        fullName: string;
        role: string;
    };
    error?: string;
}

interface StaffLoginResponse {
    success: boolean;
    user?: {
        id: string;
        staffId: string;
        fullName: string;
        phone: string;
        schoolId: string;
        role: string;
        photoUrl: string | null;
    };
    error?: string;
}

/**
 * Admin login with email and password
 * Verifies credentials against both Supabase Auth and Staff table
 */
export async function adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
    try {
        // Step 1: Authenticate with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            return {
                success: false,
                error: authError.message || 'Invalid email or password',
            };
        }

        if (!authData.user) {
            return {
                success: false,
                error: 'Authentication failed',
            };
        }

        // Step 2: Verify user exists in staff table with role='admin'
        const { data: staffData, error: staffError } = await supabase
            .from('staff')
            .select('id, staff_id, full_name, email, phone, school_id, photo_url, role')
            .eq('email', email)
            .eq('role', 'admin')
            .eq('is_active', true)
            .maybeSingle();

        if (staffError) {
            console.error('Staff lookup error:', staffError);
            return {
                success: false,
                error: 'Failed to verify admin credentials',
            };
        }

        if (!staffData) {
            // User authenticated but not found in staff table as admin
            await supabase.auth.signOut();
            return {
                success: false,
                error: 'User account not found in staff records or is not an admin',
            };
        }

        // Step 3: Success - return admin user data
        return {
            success: true,
            user: {
                id: authData.user.id,
                email: staffData.email || email,
                staffId: staffData.staff_id,
                fullName: staffData.full_name,
                phone: staffData.phone,
                schoolId: staffData.school_id,
                photoUrl: staffData.photo_url,
            },
        };
    } catch (error) {
        console.error('Admin login error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Login failed',
        };
    }
}

/**
 * Staff login with staff ID and PIN
 * Verifies credentials against Staff table
 */
export async function staffLogin(
    staffId: string,
    pin: string,
    role: string
): Promise<StaffLoginResponse> {
    try {
        const { data: staffData, error: staffError } = await supabase
            .from('staff')
            .select('id, staff_id, full_name, phone, school_id, role, photo_url, is_active')
            .eq('staff_id', staffId)
            .eq('pin', pin)
            .eq('role', role)
            .eq('is_active', true)
            .maybeSingle();

        if (staffError) {
            console.error('Staff login error:', staffError);
            return {
                success: false,
                error: 'Failed to verify credentials',
            };
        }

        if (!staffData) {
            return {
                success: false,
                error: 'Invalid Staff ID or PIN',
            };
        }

        return {
            success: true,
            user: {
                id: staffData.id,
                staffId: staffData.staff_id,
                fullName: staffData.full_name,
                phone: staffData.phone,
                schoolId: staffData.school_id,
                role: staffData.role,
                photoUrl: staffData.photo_url,
            },
        };
    } catch (error) {
        console.error('Staff login error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Login failed',
        };
    }
}

/**
 * Parent login with phone number
 * Fetches parent account and their children
 * Handles phone normalization for flexible matching
 */
export async function parentLogin(phone: string) {
    try {
        // Normalize the input phone
        const normalizedPhone = normalizePhone(phone);

        if (!normalizedPhone) {
            console.error('[PARENT_LOGIN] Invalid phone number provided:', phone);
            return {
                success: false,
                error: 'Invalid phone number format',
            };
        }

        console.log(`[PARENT_LOGIN] Attempting login with phone: ${phone} (normalized: ${normalizedPhone})`);

        // Get all parents (we'll filter by normalized phone manually)
        // This is needed because we can't do complex matching in Supabase query easily
        const { data: allParents, error: parentsError } = await supabase
            .from('parents')
            .select('id, father_name, mother_name, guardian_name, school_id, primary_phone, father_phone, mother_phone, guardian_phone, is_active')
            .eq('is_active', true);

        if (parentsError) {
            console.error('[PARENT_LOGIN] Error fetching parents:', parentsError);
            return {
                success: false,
                error: 'Failed to verify parent account',
            };
        }

        if (!allParents || allParents.length === 0) {
            console.log('[PARENT_LOGIN] No active parents found in system');
            return {
                success: false,
                error: 'No account found with this phone number',
            };
        }

        // Find parent with matching phone across all phone fields
        let parentData = null;
        for (const parent of allParents) {
            const parentPhones = extractParentPhones(parent);
            if (parentPhones.includes(normalizedPhone)) {
                parentData = parent;
                console.log(`[PARENT_LOGIN] Found matching parent: ${parent.id}`);
                break;
            }
        }

        if (!parentData) {
            console.log('[PARENT_LOGIN] No parent found with matching phone number');
            return {
                success: false,
                error: 'No account found with this phone number',
            };
        }

        // Fetch children for this parent
        console.log(`[PARENT_LOGIN] Fetching children for parent: ${parentData.id}`);
        const children = await getChildrenByParentPhone(parentData.school_id, normalizedPhone);

        console.log(`[PARENT_LOGIN] Parent login successful. Found ${children.length} children`);

        return {
            success: true,
            user: {
                id: parentData.id,
                fullName: parentData.father_name || parentData.mother_name || parentData.guardian_name || 'Parent',
                phone: normalizedPhone,
                schoolId: parentData.school_id,
                role: 'parent',
                children: children.map(child => ({
                    id: child.id,
                    studentId: child.student_id,
                    firstName: child.first_name,
                    lastName: child.last_name,
                    gender: child.gender,
                    classId: child.class_id,
                })),
            },
        };
    } catch (error) {
        console.error('[PARENT_LOGIN] Parent login error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Login failed',
        };
    }
}

/**
 * Logout the current user
 */
export async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Logout failed',
        };
    }
}

/**
 * Create a new staff member
 * Generates staff ID and temporary PIN
 */
export async function createStaff(
    schoolId: string,
    fullName: string,
    email: string | undefined,
    phone: string,
    role: string,
    department?: string
): Promise<CreateStaffResponse> {
    try {
        // Generate staff ID prefix based on role
        const rolePrefix: Record<string, string> = {
            teacher: 'TCH',
            principal: 'PRN',
            counselor: 'CNS',
            finance: 'FIN',
            admin: 'ADM',
            bursar: 'BUR',
        };

        const prefix = rolePrefix[role] || 'STF';

        // Get the count of staff with this role to generate unique number
        const { data: existingStaff, error: countError } = await supabase
            .from('staff')
            .select('staff_id')
            .eq('school_id', schoolId)
            .ilike('staff_id', `${prefix}%`);

        if (countError) {
            console.error('Error fetching existing staff:', countError);
            throw countError;
        }

        const staffNumber = (existingStaff?.length || 0) + 1;
        const staffId = `${prefix}${String(staffNumber).padStart(4, '0')}`;

        // Generate temporary PIN (4 digits)
        const temporaryPin = String(Math.floor(Math.random() * 10000)).padStart(4, '0');

        // Create the staff record
        const { data: newStaff, error: createError } = await supabase
            .from('staff')
            .insert([
                {
                    school_id: schoolId,
                    staff_id: staffId,
                    full_name: fullName,
                    email: email || null,
                    phone: phone,
                    role: role,
                    department: department || null,
                    temporary_pin: temporaryPin,
                    pin: temporaryPin, // Initial PIN is the temporary PIN
                    is_active: true,
                }
            ])
            .select()
            .single();

        if (createError) {
            console.error('Error creating staff:', createError);
            return {
                success: false,
                error: createError.message || 'Failed to create staff',
            };
        }

        return {
            success: true,
            data: {
                staffId: staffId,
                temporaryPin: temporaryPin,
                fullName: fullName,
                role: role,
            },
        };
    } catch (error) {
        console.error('Create staff error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create staff',
        };
    }
}

/**
 * Update an existing staff member
 */
export async function updateStaff(
    staffId: string,
    fullName: string,
    email: string | undefined,
    phone: string,
    role: string,
    pin: string,
    department?: string
) {
    try {
        const { data: updatedStaff, error: updateError } = await supabase
            .from('staff')
            .update({
                full_name: fullName,
                email: email || null,
                phone: phone,
                role: role,
                pin: pin,
                department: department || null,
            })
            .eq('id', staffId)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating staff:', updateError);
            return {
                success: false,
                error: updateError.message || 'Failed to update staff',
            };
        }

        return {
            success: true,
            data: updatedStaff,
        };
    } catch (error) {
        console.error('Update staff error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update staff',
        };
    }
}
