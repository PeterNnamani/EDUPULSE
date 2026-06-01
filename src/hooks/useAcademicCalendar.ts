import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { getCurrentTerm, getCurrentSession, AcademicSession, AcademicTerm } from '@/utils/calendarUtils';

interface UseAcademicCalendarReturn {
    currentSession: AcademicSession | null;
    currentTerm: AcademicTerm | null;
    sessionName: string;
    termName: string;
    isLoading: boolean;
    error: string | null;
    sessionId: string | null;
    termId: string | null;
}

/**
 * Hook to automatically get the current academic session and term based on the school calendar
 * Automatically updates if the school calendar configuration changes
 */
export function useAcademicCalendar(): UseAcademicCalendarReturn {
    const { user } = useAppStore();
    const [currentSession, setCurrentSession] = useState<AcademicSession | null>(null);
    const [currentTerm, setCurrentTerm] = useState<AcademicTerm | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadAcademicCalendar = async () => {
            if (!user?.schoolId) {
                setError('School ID not found');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                const [session, term] = await Promise.all([
                    getCurrentSession(user.schoolId),
                    getCurrentTerm(user.schoolId),
                ]);

                setCurrentSession(session);
                setCurrentTerm(term);

                if (!session || !term) {
                    console.warn('⚠️ Current session or term not found. Please configure the academic calendar.');
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to load academic calendar';
                setError(errorMessage);
                console.error('Error loading academic calendar:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadAcademicCalendar();
    }, [user?.schoolId]);

    return {
        currentSession,
        currentTerm,
        sessionName: currentSession?.name || 'N/A',
        termName: currentTerm?.name || 'N/A',
        isLoading,
        error,
        sessionId: currentSession?.id || null,
        termId: currentTerm?.id || null,
    };
}
