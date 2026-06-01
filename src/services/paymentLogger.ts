import { supabase } from '@/lib/supabase';

export interface PaymentLog {
    schoolId: string;
    paymentReference: string;
    status: 'initiated' | 'success' | 'failed' | 'verified' | 'error';
    stage: string;
    message: string;
    paystackResponse?: Record<string, unknown>;
    supabaseResponse?: Record<string, unknown>;
    supabaseError?: Record<string, unknown>;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
    timestamp?: string;
}

class PaymentLogger {
    private logs: PaymentLog[] = [];
    private schoolId: string = '';
    private paymentReference: string = '';

    initialize(schoolId: string, paymentReference: string) {
        this.schoolId = schoolId;
        this.paymentReference = paymentReference;
        this.logs = [];
    }

    log(payload: Omit<PaymentLog, 'schoolId' | 'paymentReference' | 'timestamp'>) {
        const logEntry: PaymentLog = {
            ...payload,
            schoolId: this.schoolId,
            paymentReference: this.paymentReference,
            timestamp: new Date().toISOString(),
        };

        this.logs.push(logEntry);
        console.log(
            `[${logEntry.status.toUpperCase()}] ${logEntry.stage}: ${logEntry.message}`,
            {
                errorMessage: logEntry.errorMessage,
                metadata: logEntry.metadata,
            }
        );
    }

    error(stage: string, message: string, errorMessage?: string, details?: Record<string, unknown>) {
        this.log({
            status: 'error',
            stage,
            message,
            errorMessage: errorMessage || message,
            metadata: details,
        });
    }

    info(stage: string, message: string, details?: Record<string, unknown>) {
        this.log({
            status: 'initiated',
            stage,
            message,
            metadata: details,
        });
    }

    paystackVerification(response: any, error?: string) {
        if (error) {
            this.log({
                status: 'failed',
                stage: 'PAYSTACK_VERIFICATION',
                message: 'Paystack API verification failed',
                errorMessage: error,
                paystackResponse: response,
            });
        } else {
            this.log({
                status: 'verified',
                stage: 'PAYSTACK_VERIFICATION',
                message: 'Paystack API verification successful',
                paystackResponse: response,
            });
        }
    }

    supabaseInsert(result: 'success' | 'error', table: string, data?: any, error?: any) {
        this.log({
            status: result === 'success' ? 'success' : 'error',
            stage: `SUPABASE_INSERT_${table.toUpperCase()}`,
            message: `Insert into ${table} ${result === 'success' ? 'succeeded' : 'failed'}`,
            supabaseResponse: result === 'success' ? data : undefined,
            supabaseError: result === 'error' ? error : undefined,
            errorMessage: result === 'error' ? error?.message : undefined,
        });
    }

    supabaseUpdate(result: 'success' | 'error', table: string, data?: any, error?: any) {
        this.log({
            status: result === 'success' ? 'success' : 'error',
            stage: `SUPABASE_UPDATE_${table.toUpperCase()}`,
            message: `Update ${table} ${result === 'success' ? 'succeeded' : 'failed'}`,
            supabaseResponse: result === 'success' ? data : undefined,
            supabaseError: result === 'error' ? error : undefined,
            errorMessage: result === 'error' ? error?.message : undefined,
        });
    }

    getLogs(): PaymentLog[] {
        return this.logs;
    }

    getErrorLogs(): PaymentLog[] {
        return this.logs.filter((log) => log.status === 'error' || log.status === 'failed');
    }

    /**
     * Save all logs to audit_logs table for debugging
     */
    async saveLogs() {
        try {
            if (this.logs.length === 0) return;

            const auditLogs = this.logs.map((log) => ({
                school_id: this.schoolId,
                action: `payment_${log.status}`,
                entity_type: 'subscription_payment',
                entity_id: null,
                old_values: null,
                new_values: {
                    reference: this.paymentReference,
                    stage: log.stage,
                    message: log.message,
                    paystack_response: log.paystackResponse,
                    supabase_response: log.supabaseResponse,
                    supabase_error: log.supabaseError,
                    error: log.errorMessage,
                },
                user_type: 'system',
                created_at: log.timestamp,
            }));

            await supabase.from('audit_logs').insert(auditLogs);
        } catch (err) {
            console.error('Failed to save payment logs:', err);
        }
    }

    getSummary(): {
        totalLogs: number;
        errorCount: number;
        successCount: number;
        lastStatus: PaymentLog['status'] | null;
        summary: string;
    } {
        const errorLogs = this.getErrorLogs();
        const successLogs = this.logs.filter((log) => log.status === 'success' || log.status === 'verified');
        const lastLog = this.logs[this.logs.length - 1];

        return {
            totalLogs: this.logs.length,
            errorCount: errorLogs.length,
            successCount: successLogs.length,
            lastStatus: lastLog?.status || null,
            summary:
                errorLogs.length > 0
                    ? `Payment processing failed with ${errorLogs.length} error(s): ${errorLogs.map((e) => e.message).join('; ')}`
                    : `Payment processing successful: ${successLogs.length} stages completed`,
        };
    }
}

export const paymentLogger = new PaymentLogger();
