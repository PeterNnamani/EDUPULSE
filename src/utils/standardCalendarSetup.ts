import { supabase } from '@/lib/supabase';

/**
 * Nigerian Standard Academic Calendar
 * September  → First Term Begins/Ends (Sept 1 - Dec 31)
 * January    → Second Term Begins/Ends (Jan 1 - Mar 31)
 * April      → Third Term Begins/Ends (Apr 1 - Jul 31)
 * August     → Long Vacation (Aug 1 - Aug 31)
 */

interface CalendarSetupResult {
    success: boolean;
    sessionId?: string;
    termsCreated?: number;
    error?: string;
}

/**
 * Setup standard Nigerian academic calendar for a school
 * @param schoolId - School ID
 * @param academicYear - Year (e.g., 2026 for 2026/2027 session)
 * @param setAsCurrent - Whether to set this as current session
 */
export async function setupStandardNigerianCalendar(
    schoolId: string,
    academicYear: number,
    setAsCurrent: boolean = true
): Promise<CalendarSetupResult> {
    try {
        console.log(`📚 Setting up standard Nigerian calendar for ${academicYear}/${academicYear + 1}`);

        // Create session (e.g., 2026/2027)
        const sessionName = `${academicYear}/${academicYear + 1}`;
        const sessionStart = new Date(academicYear, 8, 1); // Sept 1
        const sessionEnd = new Date(academicYear + 1, 7, 31); // Aug 31

        // Check if session already exists
        const { data: existingSession } = await supabase
            .from('academic_sessions')
            .select('id')
            .eq('school_id', schoolId)
            .eq('name', sessionName)
            .single();

        let sessionId = existingSession?.id;

        if (!sessionId) {
            const { data: newSession, error: sessionError } = await supabase
                .from('academic_sessions')
                .insert({
                    school_id: schoolId,
                    name: sessionName,
                    start_date: sessionStart.toISOString().split('T')[0],
                    end_date: sessionEnd.toISOString().split('T')[0],
                    is_current: setAsCurrent,
                })
                .select('id')
                .single();

            if (sessionError) throw sessionError;
            sessionId = newSession.id;
            console.log(`✓ Session created: ${sessionName}`);
        } else {
            console.log(`✓ Session already exists: ${sessionName}`);
        }

        // Define standard terms
        const terms = [
            {
                name: 'First Term',
                termNumber: 1,
                startMonth: 8, // September (0-indexed)
                endMonth: 11, // December
            },
            {
                name: 'Second Term',
                termNumber: 2,
                startMonth: 0, // January
                endMonth: 2, // March
                yearOffset: 1, // Next year
            },
            {
                name: 'Third Term',
                termNumber: 3,
                startMonth: 3, // April
                endMonth: 6, // July
                yearOffset: 1, // Same year as session end
            },
        ];

        let termsCreated = 0;

        // Create terms
        for (const term of terms) {
            // Check if term already exists
            const { data: existingTerm } = await supabase
                .from('academic_terms')
                .select('id')
                .eq('session_id', sessionId)
                .eq('term_number', term.termNumber)
                .single();

            if (existingTerm) {
                console.log(`✓ Term already exists: ${term.name}`);
                termsCreated++;
                continue;
            }

            const startDate = new Date(
                academicYear + (term.yearOffset || 0),
                term.startMonth,
                1
            );
            const endDate = new Date(
                academicYear + (term.yearOffset || 0),
                term.endMonth,
                new Date(academicYear + (term.yearOffset || 0), term.endMonth + 1, 0).getDate()
            );

            // Determine if this term is current
            const today = new Date();
            const isCurrent =
                setAsCurrent &&
                today >= startDate &&
                today <= endDate;

            const { error: termError } = await supabase
                .from('academic_terms')
                .insert({
                    school_id: schoolId,
                    session_id: sessionId,
                    name: term.name,
                    term_number: term.termNumber,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0],
                    is_current: isCurrent,
                });

            if (termError) {
                console.warn(`⚠️ Error creating ${term.name}:`, termError);
            } else {
                console.log(
                    `✓ ${term.name}: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}${isCurrent ? ' (CURRENT)' : ''}`
                );
                termsCreated++;
            }
        }

        // If setAsCurrent is true but no term matched current date, set first term
        if (setAsCurrent && termsCreated > 0) {
            const { data: currentTerm } = await supabase
                .from('academic_terms')
                .select('id')
                .eq('session_id', sessionId)
                .eq('is_current', true)
                .single();

            if (!currentTerm) {
                // Set first term as current if none is current
                await supabase
                    .from('academic_terms')
                    .update({ is_current: true })
                    .eq('session_id', sessionId)
                    .eq('term_number', 1);
                console.log('✓ First term set as current');
            }
        }

        console.log(`========================================`);
        console.log(`✅ Calendar setup complete!`);
        console.log(`Session: ${sessionName}`);
        console.log(`Terms created/verified: ${termsCreated}`);
        console.log(`========================================`);

        return {
            success: true,
            sessionId,
            termsCreated,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Error setting up calendar:', error);
        return {
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Get the academic year for a given date
 * (Academic year starts in September)
 */
export function getAcademicYear(date: Date = new Date()): number {
    const month = date.getMonth(); // 0-11
    const year = date.getFullYear();

    // If month is Jan-Aug (0-7), academic year started in previous year
    if (month <= 7) {
        return year - 1;
    }
    // If month is Sept-Dec (8-11), academic year is current year
    return year;
}

/**
 * Get term name for a given date
 */
export function getTermForDate(date: Date = new Date()): string {
    const month = date.getMonth();

    if (month >= 8 || month === 11) {
        // Sept - Dec
        return 'First Term';
    } else if (month >= 0 && month <= 2) {
        // Jan - Mar
        return 'Second Term';
    } else if (month >= 3 && month <= 6) {
        // Apr - Jul
        return 'Third Term';
    } else if (month === 7) {
        // Aug
        return 'Long Vacation';
    }

    return 'Unknown';
}

/**
 * Validate if calendar is properly set up for a school
 */
export async function validateCalendarSetup(schoolId: string): Promise<{
    isSetup: boolean;
    hasCurrentSession: boolean;
    hasCurrentTerm: boolean;
    sessionCount: number;
    termCount: number;
}> {
    try {
        const [{ data: sessions }, { data: terms }] = await Promise.all([
            supabase
                .from('academic_sessions')
                .select('id, is_current')
                .eq('school_id', schoolId),
            supabase
                .from('academic_terms')
                .select('id, is_current')
                .eq('school_id', schoolId),
        ]);

        const hasCurrentSession = sessions?.some((s: any) => s.is_current) || false;
        const hasCurrentTerm = terms?.some((t: any) => t.is_current) || false;
        const isSetup = (sessions?.length || 0) > 0 && (terms?.length || 0) >= 3;

        return {
            isSetup,
            hasCurrentSession,
            hasCurrentTerm,
            sessionCount: sessions?.length || 0,
            termCount: terms?.length || 0,
        };
    } catch (error) {
        console.error('Error validating calendar:', error);
        return {
            isSetup: false,
            hasCurrentSession: false,
            hasCurrentTerm: false,
            sessionCount: 0,
            termCount: 0,
        };
    }
}
