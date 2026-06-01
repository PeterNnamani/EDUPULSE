import { supabase } from '@/lib/supabase';

export interface AcademicSession {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
}

export interface AcademicTerm {
    id: string;
    session_id: string;
    name: string;
    term_number: number;
    start_date: string;
    end_date: string;
    is_current: boolean;
}

/**
 * Get the current academic session based on today's date
 * Falls back to is_current flag if date doesn't match any session
 */
export async function getCurrentSession(schoolId: string): Promise<AcademicSession | null> {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        // First, try to find session that contains today's date
        const { data: sessionByDate, error: dateError } = await supabase
            .from('academic_sessions')
            .select('*')
            .eq('school_id', schoolId)
            .lte('start_date', today)
            .gte('end_date', today)
            .single();

        if (sessionByDate && !dateError) {
            console.log('✓ Current session found by date:', sessionByDate.name);
            return sessionByDate;
        }

        // Fallback: use is_current flag
        const { data: sessionByCurrent } = await supabase
            .from('academic_sessions')
            .select('*')
            .eq('school_id', schoolId)
            .eq('is_current', true)
            .single();

        if (sessionByCurrent) {
            console.log('✓ Current session found by is_current flag:', sessionByCurrent.name);
            return sessionByCurrent;
        }

        console.warn('⚠️ No current session found for school:', schoolId);
        return null;
    } catch (error) {
        console.error('Error getting current session:', error);
        return null;
    }
}

/**
 * Get the current academic term based on today's date
 * Falls back to is_current flag if date doesn't match any term
 */
export async function getCurrentTerm(schoolId: string): Promise<AcademicTerm | null> {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        // First, try to find term that contains today's date
        const { data: termByDate, error: dateError } = await supabase
            .from('academic_terms')
            .select('*')
            .eq('school_id', schoolId)
            .lte('start_date', today)
            .gte('end_date', today)
            .single();

        if (termByDate && !dateError) {
            console.log('✓ Current term found by date:', termByDate.name);
            return termByDate;
        }

        // Fallback: use is_current flag
        const { data: termByCurrent } = await supabase
            .from('academic_terms')
            .select('*')
            .eq('school_id', schoolId)
            .eq('is_current', true)
            .single();

        if (termByCurrent) {
            console.log('✓ Current term found by is_current flag:', termByCurrent.name);
            return termByCurrent;
        }

        console.warn('⚠️ No current term found for school:', schoolId);
        return null;
    } catch (error) {
        console.error('Error getting current term:', error);
        return null;
    }
}

/**
 * Get both current session and term together
 */
export async function getCurrentSessionAndTerm(schoolId: string) {
    try {
        const session = await getCurrentSession(schoolId);
        const term = await getCurrentTerm(schoolId);

        return {
            session,
            term,
            sessionName: session?.name || 'N/A',
            termName: term?.name || 'N/A',
            sessionId: session?.id || null,
            termId: term?.id || null,
        };
    } catch (error) {
        console.error('Error getting current session and term:', error);
        return {
            session: null,
            term: null,
            sessionName: 'N/A',
            termName: 'N/A',
            sessionId: null,
            termId: null,
        };
    }
}

/**
 * Get all sessions for a school
 */
export async function getAllSessions(schoolId: string): Promise<AcademicSession[]> {
    try {
        const { data, error } = await supabase
            .from('academic_sessions')
            .select('*')
            .eq('school_id', schoolId)
            .order('start_date', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting all sessions:', error);
        return [];
    }
}

/**
 * Get all terms for a specific session
 */
export async function getTermsForSession(sessionId: string): Promise<AcademicTerm[]> {
    try {
        const { data, error } = await supabase
            .from('academic_terms')
            .select('*')
            .eq('session_id', sessionId)
            .order('term_number', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting terms for session:', error);
        return [];
    }
}

/**
 * Create a new academic session
 */
export async function createSession(
    schoolId: string,
    name: string,
    startDate: string,
    endDate: string,
    isCurrent: boolean = false
): Promise<{ success: boolean; session?: AcademicSession; error?: string }> {
    try {
        // If setting as current, unset other current sessions
        if (isCurrent) {
            await supabase
                .from('academic_sessions')
                .update({ is_current: false })
                .eq('school_id', schoolId)
                .eq('is_current', true);
        }

        const { data, error } = await supabase
            .from('academic_sessions')
            .insert({
                school_id: schoolId,
                name,
                start_date: startDate,
                end_date: endDate,
                is_current: isCurrent,
            })
            .select()
            .single();

        if (error) throw error;
        console.log('✓ Session created:', name);
        return { success: true, session: data };
    } catch (error) {
        console.error('Error creating session:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Create a new academic term
 */
export async function createTerm(
    schoolId: string,
    sessionId: string,
    name: string,
    termNumber: number,
    startDate: string,
    endDate: string,
    isCurrent: boolean = false
): Promise<{ success: boolean; term?: AcademicTerm; error?: string }> {
    try {
        // If setting as current, unset other current terms for this school
        if (isCurrent) {
            await supabase
                .from('academic_terms')
                .update({ is_current: false })
                .eq('school_id', schoolId)
                .eq('is_current', true);
        }

        const { data, error } = await supabase
            .from('academic_terms')
            .insert({
                school_id: schoolId,
                session_id: sessionId,
                name,
                term_number: termNumber,
                start_date: startDate,
                end_date: endDate,
                is_current: isCurrent,
            })
            .select()
            .single();

        if (error) throw error;
        console.log('✓ Term created:', name);
        return { success: true, term: data };
    } catch (error) {
        console.error('Error creating term:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Update session current status
 */
export async function setCurrentSession(schoolId: string, sessionId: string): Promise<boolean> {
    try {
        // Unset all other current sessions
        await supabase
            .from('academic_sessions')
            .update({ is_current: false })
            .eq('school_id', schoolId);

        // Set the specified session as current
        const { error } = await supabase
            .from('academic_sessions')
            .update({ is_current: true })
            .eq('id', sessionId);

        if (error) throw error;
        console.log('✓ Session set as current');
        return true;
    } catch (error) {
        console.error('Error setting current session:', error);
        return false;
    }
}

/**
 * Update term current status
 */
export async function setCurrentTerm(schoolId: string, termId: string): Promise<boolean> {
    try {
        // Unset all other current terms for this school
        await supabase
            .from('academic_terms')
            .update({ is_current: false })
            .eq('school_id', schoolId);

        // Set the specified term as current
        const { error } = await supabase
            .from('academic_terms')
            .update({ is_current: true })
            .eq('id', termId);

        if (error) throw error;
        console.log('✓ Term set as current');
        return true;
    } catch (error) {
        console.error('Error setting current term:', error);
        return false;
    }
}
