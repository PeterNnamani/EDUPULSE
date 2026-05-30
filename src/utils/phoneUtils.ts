/**
 * Phone number utility functions
 * Handles normalization and validation of phone numbers
 * Ensures consistent formatting across the system
 */

/**
 * Normalize a phone number to a standard format
 * Handles various international and local formats for Nigerian numbers
 * 
 * Examples:
 * 08062692662 -> 2348062692662
 * +2348062692662 -> 2348062692662
 * +234 806 269 2662 -> 2348062692662
 * 08062692662 -> 2348062692662
 * 
 * @param phone - Raw phone number
 * @returns Normalized phone number (country code + number)
 */
export function normalizePhone(phone: string | undefined | null): string | null {
    if (!phone) return null;

    // Remove all whitespace, hyphens, parentheses
    let cleaned = phone.trim().replace(/[\s\-().]/g, '');

    // Remove any plus sign
    cleaned = cleaned.replace(/^\+/, '');

    // If it starts with 234 (Nigeria country code), keep it as is
    if (cleaned.startsWith('234')) {
        return cleaned;
    }

    // If it starts with 0 (Nigerian local format), replace with 234
    if (cleaned.startsWith('0')) {
        return '234' + cleaned.substring(1);
    }

    // If it doesn't start with 234 or 0, assume it's a local number starting with 0
    // This handles edge cases where the leading 0 might have been stripped
    if (cleaned.length === 10) {
        return '234' + cleaned;
    }

    // If it starts with country code without leading zero, keep as is
    if (cleaned.length === 13 && cleaned.startsWith('234')) {
        return cleaned;
    }

    // Return as-is if we can't determine format (might be invalid, but preserve for logging)
    return cleaned;
}

/**
 * Validate if a phone number is in the correct format
 * @param phone - Phone number to validate
 * @returns True if phone is valid
 */
export function validatePhone(phone: string | undefined | null): boolean {
    if (!phone) return false;

    const normalized = normalizePhone(phone);
    if (!normalized) return false;

    // Should be 13 digits starting with 234 (Nigeria)
    return /^234\d{10}$/.test(normalized);
}

/**
 * Format phone for display
 * Converts 2348062692662 to +234 806 269 2662
 * @param phone - Normalized phone number
 * @returns Formatted phone for display
 */
export function formatPhoneForDisplay(phone: string | undefined | null): string {
    if (!phone) return '';

    const normalized = normalizePhone(phone);
    if (!normalized) return phone || '';

    // Format as +234 XXX XXX XXXX
    return `+${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9)}`;
}

/**
 * Get a shortened version of phone for lookup
 * Useful for searching in database
 * @param phone - Phone number
 * @returns Last 10 digits
 */
export function getPhoneShort(phone: string | undefined | null): string | null {
    const normalized = normalizePhone(phone);
    if (!normalized || normalized.length < 10) return null;
    return normalized.slice(-10);
}

/**
 * Compare two phone numbers
 * Returns true if they represent the same number
 * @param phone1 - First phone number
 * @param phone2 - Second phone number
 * @returns True if phones match
 */
export function comparePhones(
    phone1: string | undefined | null,
    phone2: string | undefined | null
): boolean {
    const normalized1 = normalizePhone(phone1);
    const normalized2 = normalizePhone(phone2);
    return normalized1 === normalized2 && normalized1 !== null;
}

/**
 * Extract all phone numbers from a parent record
 * Useful for checking multiple phone fields
 * @param parent - Parent object with multiple phone fields
 * @returns Array of normalized phone numbers (non-null)
 */
export function extractParentPhones(parent: {
    primary_phone?: string | null;
    father_phone?: string | null;
    mother_phone?: string | null;
    guardian_phone?: string | null;
}): string[] {
    const phones: string[] = [];

    if (parent.primary_phone) {
        const normalized = normalizePhone(parent.primary_phone);
        if (normalized && !phones.includes(normalized)) phones.push(normalized);
    }
    if (parent.father_phone) {
        const normalized = normalizePhone(parent.father_phone);
        if (normalized && !phones.includes(normalized)) phones.push(normalized);
    }
    if (parent.mother_phone) {
        const normalized = normalizePhone(parent.mother_phone);
        if (normalized && !phones.includes(normalized)) phones.push(normalized);
    }
    if (parent.guardian_phone) {
        const normalized = normalizePhone(parent.guardian_phone);
        if (normalized && !phones.includes(normalized)) phones.push(normalized);
    }

    return phones;
}
