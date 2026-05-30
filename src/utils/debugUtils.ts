/**
 * Debugging utility for parent-student linking system
 * Provides comprehensive logging and diagnostics
 */

import { supabase } from '@/lib/supabase';
import { normalizePhone, extractParentPhones } from '@/utils/phoneUtils';

export interface DebugReport {
    timestamp: string;
    parentPhone: string;
    normalizedPhone: string | null;
    schoolId: string;
    findings: {
        parentFound: boolean;
        parentId?: string;
        parentName?: string;
        parentPhoneFields?: {
            primary_phone?: string;
            father_phone?: string;
            mother_phone?: string;
            guardian_phone?: string;
        };
        normalizedParentPhones?: string[];
        childrenCount: number;
        childrenDetails?: Array<{
            id: string;
            name: string;
            studentId: string;
            status: string;
        }>;
        relationshipsCreated: boolean;
        relationshipDetails?: Array<{
            studentId: string;
            relationshipType: string;
        }>;
    };
    logs: string[];
    errors: string[];
}

const logs: string[] = [];
const errors: string[] = [];

function addLog(message: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    logs.push(logEntry);
    console.log(logEntry);
}

function addError(message: string) {
    const timestamp = new Date().toISOString();
    const errorEntry = `[${timestamp}] ERROR: ${message}`;
    errors.push(errorEntry);
    console.error(errorEntry);
}

/**
 * Generate a comprehensive debug report for a parent's account
 */
export async function debugParentAccount(
    phone: string,
    schoolId: string
): Promise<DebugReport> {
    logs.length = 0;
    errors.length = 0;

    const report: DebugReport = {
        timestamp: new Date().toISOString(),
        parentPhone: phone,
        normalizedPhone: normalizePhone(phone),
        schoolId: schoolId,
        findings: {
            parentFound: false,
            childrenCount: 0,
            relationshipsCreated: false,
        },
        logs: [],
        errors: [],
    };

    try {
        addLog(`Starting debug for phone: ${phone} in school: ${schoolId}`);

        if (!report.normalizedPhone) {
            addError('Invalid phone number format');
            report.findings.parentFound = false;
            report.logs = logs;
            report.errors = errors;
            return report;
        }

        addLog(`Normalized phone: ${report.normalizedPhone}`);

        // Fetch all parents in school
        const { data: allParents, error: parentError } = await supabase
            .from('parents')
            .select('id, father_name, mother_name, guardian_name, primary_phone, father_phone, mother_phone, guardian_phone')
            .eq('school_id', schoolId);

        if (parentError) {
            addError(`Failed to fetch parents: ${parentError.message}`);
            report.logs = logs;
            report.errors = errors;
            return report;
        }

        addLog(`Found ${allParents?.length || 0} parents in school`);

        // Find matching parent
        let matchingParent = null;
        if (allParents) {
            for (const parent of allParents) {
                const parentPhones = extractParentPhones(parent);
                addLog(`Checking parent ${parent.id}: phones = [${parentPhones.join(', ')}]`);

                if (parentPhones.includes(report.normalizedPhone!)) {
                    matchingParent = parent;
                    addLog(`MATCH FOUND: Parent ${parent.id} has matching phone`);
                    break;
                }
            }
        }

        if (!matchingParent) {
            addLog('No matching parent found');
            report.findings.parentFound = false;
            report.logs = logs;
            report.errors = errors;
            return report;
        }

        report.findings.parentFound = true;
        report.findings.parentId = matchingParent.id;
        report.findings.parentName = matchingParent.father_name || matchingParent.mother_name || matchingParent.guardian_name || 'Unknown';
        report.findings.parentPhoneFields = {
            primary_phone: matchingParent.primary_phone,
            father_phone: matchingParent.father_phone,
            mother_phone: matchingParent.mother_phone,
            guardian_phone: matchingParent.guardian_phone,
        };
        report.findings.normalizedParentPhones = extractParentPhones(matchingParent);

        // Fetch children linked to this parent
        const { data: relationships, error: relationError } = await supabase
            .from('student_parents')
            .select('student_id, relationship, students(id, student_id, first_name, last_name, status)')
            .eq('parent_id', matchingParent.id);

        if (relationError) {
            addError(`Failed to fetch relationships: ${relationError.message}`);
        } else {
            addLog(`Found ${relationships?.length || 0} children linked to parent`);
            report.findings.childrenCount = relationships?.length || 0;
            report.findings.relationshipsCreated = (relationships?.length || 0) > 0;

            if (relationships && relationships.length > 0) {
                report.findings.childrenDetails = relationships.map((rel: any) => ({
                    id: rel.students.id,
                    name: `${rel.students.first_name} ${rel.students.last_name}`,
                    studentId: rel.students.student_id,
                    status: rel.students.status,
                }));

                report.findings.relationshipDetails = relationships.map((rel: any) => ({
                    studentId: rel.students.student_id,
                    relationshipType: rel.relationship,
                }));
            }
        }

        addLog('Debug report generation completed successfully');
    } catch (error) {
        addError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    }

    report.logs = logs;
    report.errors = errors;
    return report;
}

/**
 * Verify parent-student relationship
 */
export async function verifyRelationship(
    parentId: string,
    studentId: string,
    schoolId: string
): Promise<{
    exists: boolean;
    details?: {
        id: string;
        relationship: string;
        isPrimary: boolean;
    };
    errors: string[];
}> {
    const errors: string[] = [];

    try {
        const { data, error } = await supabase
            .from('student_parents')
            .select('id, relationship, is_primary')
            .eq('parent_id', parentId)
            .eq('student_id', studentId)
            .maybeSingle();

        if (error) {
            errors.push(`Database error: ${error.message}`);
            return { exists: false, errors };
        }

        if (data) {
            return {
                exists: true,
                details: {
                    id: data.id,
                    relationship: data.relationship,
                    isPrimary: data.is_primary,
                },
                errors: [],
            };
        }

        return { exists: false, errors };
    } catch (error) {
        errors.push(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
        return { exists: false, errors };
    }
}

/**
 * List all parents in a school with their children count
 */
export async function listSchoolParents(schoolId: string): Promise<
    Array<{
        id: string;
        name: string;
        primaryPhone: string;
        phones: string[];
        childrenCount: number;
    }>
> {
    try {
        const { data: parents, error } = await supabase
            .from('parents')
            .select(
                `id,
        father_name,
        mother_name,
        guardian_name,
        primary_phone,
        father_phone,
        mother_phone,
        guardian_phone,
        student_parents(count)`
            )
            .eq('school_id', schoolId);

        if (error) {
            console.error('Error fetching parents:', error);
            return [];
        }

        return (
            parents?.map((parent: any) => ({
                id: parent.id,
                name: parent.father_name || parent.mother_name || parent.guardian_name || 'Unknown',
                primaryPhone: parent.primary_phone,
                phones: extractParentPhones(parent),
                childrenCount: parent.student_parents[0]?.count || 0,
            })) || []
        );
    } catch (error) {
        console.error('Unexpected error listing parents:', error);
        return [];
    }
}

/**
 * Create a detailed audit log for debugging
 */
export async function createAuditLog(
    event: string,
    details: Record<string, any>,
    schoolId: string
) {
    try {
        console.log(`[AUDIT] Event: ${event}`, details);

        // In a production system, you would insert this into an audit_logs table
        // For now, we're just logging to console
        const auditEntry = {
            timestamp: new Date().toISOString(),
            event,
            details,
            schoolId,
        };

        console.log('[AUDIT_LOG]', JSON.stringify(auditEntry, null, 2));
    } catch (error) {
        console.error('Error creating audit log:', error);
    }
}

/**
 * Export debug report as JSON
 */
export function exportReport(report: DebugReport): string {
    return JSON.stringify(report, null, 2);
}

/**
 * Format debug report for console output
 */
export function formatReportForConsole(report: DebugReport): string {
    let output = '\n=== PARENT ACCOUNT DEBUG REPORT ===\n';
    output += `Timestamp: ${report.timestamp}\n`;
    output += `Phone: ${report.parentPhone} (normalized: ${report.normalizedPhone})\n`;
    output += `School ID: ${report.schoolId}\n\n`;

    output += '--- FINDINGS ---\n';
    output += `Parent Found: ${report.findings.parentFound}\n`;

    if (report.findings.parentFound) {
        output += `Parent ID: ${report.findings.parentId}\n`;
        output += `Parent Name: ${report.findings.parentName}\n`;
        output += `Phone Fields: ${JSON.stringify(report.findings.parentPhoneFields, null, 2)}\n`;
        output += `Normalized Phones: [${report.findings.normalizedParentPhones?.join(', ')}]\n`;
        output += `Children Count: ${report.findings.childrenCount}\n`;

        if (report.findings.childrenDetails && report.findings.childrenDetails.length > 0) {
            output += '\nLinked Children:\n';
            report.findings.childrenDetails.forEach((child) => {
                output += `  - ${child.name} (${child.studentId})\n`;
            });
        }
    }

    output += '\n--- LOGS ---\n';
    report.logs.forEach((log) => {
        output += `${log}\n`;
    });

    if (report.errors.length > 0) {
        output += '\n--- ERRORS ---\n';
        report.errors.forEach((error) => {
            output += `${error}\n`;
        });
    }

    output += '\n=== END REPORT ===\n';
    return output;
}
