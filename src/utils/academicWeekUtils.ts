/**
 * Calculate academic week within a term
 * Academic terms typically have 12-13 weeks
 */

export interface AcademicWeekInfo {
    weekNumber: number;
    totalWeeks: number;
    weekDisplay: string;
    percentComplete: number;
    dayInWeek: number;
    isLastWeek: boolean;
}

/**
 * Calculate which academic week we're in based on term dates
 * @param termStartDate - Start date of the term
 * @param termEndDate - End date of the term
 * @param currentDate - Current date (defaults to today)
 * @returns Academic week information
 */
export function getAcademicWeek(
    termStartDate: string | Date,
    termEndDate: string | Date,
    currentDate: Date = new Date()
): AcademicWeekInfo {
    try {
        const start = typeof termStartDate === 'string' ? new Date(termStartDate) : termStartDate;
        const end = typeof termEndDate === 'string' ? new Date(termEndDate) : termEndDate;
        const current = new Date(currentDate);

        // Set all to start of day for consistent calculation
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        current.setHours(0, 0, 0, 0);

        // Calculate total days in term
        const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        // Calculate total weeks (typically 12-13 weeks per term)
        const totalWeeks = Math.ceil(totalDays / 7);

        // Calculate days elapsed since start of term
        let daysElapsed = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        // If current date is before term start, set to 0
        if (daysElapsed < 0) {
            daysElapsed = 0;
        }

        // Calculate current week (0-indexed, so add 1)
        let weekNumber = Math.floor(daysElapsed / 7) + 1;

        // Ensure week number doesn't exceed total weeks
        if (weekNumber > totalWeeks) {
            weekNumber = totalWeeks;
        }

        // If before term starts, show as week 0 (Pre-term)
        if (current < start) {
            weekNumber = 0;
        }

        // Day within the week (1-7, Monday-Sunday)
        const dayInWeek = (daysElapsed % 7) + 1;

        // Percentage of term complete
        const percentComplete = Math.round((daysElapsed / totalDays) * 100);

        // Check if it's the last week
        const isLastWeek = weekNumber === totalWeeks;

        // Format display string
        let weekDisplay: string;
        if (weekNumber === 0) {
            weekDisplay = 'Pre-Term';
        } else if (weekNumber > totalWeeks) {
            weekDisplay = 'Post-Term';
        } else {
            weekDisplay = `Week ${weekNumber} of ${totalWeeks}`;
        }

        return {
            weekNumber,
            totalWeeks,
            weekDisplay,
            percentComplete: Math.min(percentComplete, 100),
            dayInWeek,
            isLastWeek,
        };
    } catch (error) {
        console.error('Error calculating academic week:', error);
        return {
            weekNumber: 0,
            totalWeeks: 0,
            weekDisplay: 'N/A',
            percentComplete: 0,
            dayInWeek: 0,
            isLastWeek: false,
        };
    }
}

/**
 * Get day name from day number (1-7)
 */
export function getDayName(dayNumber: number): string {
    const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayNumber] || 'Unknown';
}
