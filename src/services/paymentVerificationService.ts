import { supabase } from '@/lib/supabase';
import { paymentLogger } from './paymentLogger';

interface VerificationRetryConfig {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: VerificationRetryConfig = {
    maxAttempts: 3,
    delayMs: 2000,
    backoffMultiplier: 2,
};

export class PaymentVerificationService {
    /**
     * Verify payment with Paystack using server-side Edge Function
     * Implements retry logic with exponential backoff
     */
    static async verifyPayment(
        reference: string,
        schoolId: string,
        email: string,
        config: Partial<VerificationRetryConfig> = {}
    ): Promise<{
        success: boolean;
        subscriptionId?: string;
        paystackVerified?: boolean;
        error?: string;
        logs?: any[];
        attempts?: number;
    }> {
        const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
        let lastError: Error | null = null;
        let attempts = 0;

        for (attempts = 1; attempts <= finalConfig.maxAttempts; attempts++) {
            try {
                paymentLogger.info('VERIFICATION_ATTEMPT', `Paystack verification attempt ${attempts}/${finalConfig.maxAttempts}`, {
                    reference,
                    schoolId,
                });

                const session = await supabase.auth.getSession();
                const token =
                    session.data.session?.access_token ??
                    import.meta.env.VITE_SUPABASE_ANON_KEY;

                if (!token) {
                    throw new Error('Supabase configuration missing');
                }

                const response = await fetch(
                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paystack`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
                        },
                        body: JSON.stringify({ reference, schoolId, email }),
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(`Verification failed: ${data.error || response.statusText}`);
                }

                if (!data.success) {
                    throw new Error(data.error || 'Verification returned false');
                }

                paymentLogger.info(
                    'VERIFICATION_SUCCESS',
                    `Verification successful on attempt ${attempts}`,
                    {
                        subscriptionId: data.subscriptionId,
                        paystackVerified: data.paystackVerified,
                    }
                );

                return {
                    success: true,
                    subscriptionId: data.subscriptionId,
                    paystackVerified: data.paystackVerified,
                    logs: data.logs,
                    attempts,
                };
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                paymentLogger.error(
                    'VERIFICATION_ATTEMPT_FAILED',
                    `Attempt ${attempts} failed`,
                    lastError.message,
                    { attempt: attempts }
                );

                // Don't retry on last attempt
                if (attempts < finalConfig.maxAttempts) {
                    const delayMs = finalConfig.delayMs * Math.pow(finalConfig.backoffMultiplier, attempts - 1);
                    paymentLogger.info('VERIFICATION_RETRY_WAIT', `Waiting ${delayMs}ms before retry attempt ${attempts + 1}`);
                    await this.delay(delayMs);
                }
            }
        }

        const errorMsg = lastError?.message || 'Payment verification failed after all retry attempts';
        paymentLogger.error('VERIFICATION_FAILED', 'All verification attempts exhausted', errorMsg, {
            totalAttempts: attempts,
        });

        return {
            success: false,
            error: errorMsg,
            attempts,
        };
    }

    /**
     * Check subscription status in database with retry
     */
    static async getSubscriptionStatus(
        schoolId: string,
        reference: string
    ): Promise<{
        exists: boolean;
        status?: string;
        subscriptionId?: string;
        error?: string;
    }> {
        try {
            paymentLogger.info('SUBSCRIPTION_STATUS_CHECK', 'Checking subscription status', {
                schoolId,
                reference,
            });

            const { data, error } = await supabase
                .from('subscriptions')
                .select('id, status, plan, start_date, end_date')
                .eq('school_id', schoolId)
                .eq('payment_reference', reference)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (data) {
                paymentLogger.info('SUBSCRIPTION_FOUND', 'Subscription record exists', {
                    subscriptionId: data.id,
                    status: data.status,
                    plan: data.plan,
                });

                return {
                    exists: true,
                    status: data.status,
                    subscriptionId: data.id,
                };
            }

            paymentLogger.info('SUBSCRIPTION_NOT_FOUND', 'No subscription found yet');
            return {
                exists: false,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            paymentLogger.error('SUBSCRIPTION_CHECK_ERROR', 'Failed to check subscription status', errorMsg);
            return {
                exists: false,
                error: errorMsg,
            };
        }
    }

    /**
     * Refresh billing history for school
     */
    static async refreshBillingHistory(schoolId: string): Promise<any[]> {
        try {
            paymentLogger.info('BILLING_HISTORY_REFRESH', 'Fetching updated billing history', {
                schoolId,
            });

            const { data, error } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('school_id', schoolId)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                throw error;
            }

            paymentLogger.info('BILLING_HISTORY_FETCHED', 'Billing history updated', {
                count: data?.length || 0,
            });

            return data || [];
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            paymentLogger.error('BILLING_HISTORY_ERROR', 'Failed to fetch billing history', errorMsg);
            return [];
        }
    }

    /**
     * Handle payment timeout - check status and notify user
     */
    static async handlePaymentTimeout(reference: string, schoolId: string): Promise<{
        status: 'completed' | 'pending' | 'failed' | 'unknown';
        message: string;
    }> {
        try {
            paymentLogger.info('TIMEOUT_HANDLER', 'Handling payment timeout', {
                reference,
                schoolId,
            });

            const statusCheck = await this.getSubscriptionStatus(schoolId, reference);

            if (statusCheck.exists) {
                const message = `Payment was ${statusCheck.status === 'active' ? 'completed and verified' : statusCheck.status
                    }. Check your billing history.`;
                paymentLogger.info('TIMEOUT_RESOLVED_ACTIVE', message, {
                    status: statusCheck.status,
                });
                return {
                    status: 'completed',
                    message,
                };
            }

            paymentLogger.info('TIMEOUT_UNRESOLVED', 'Payment status unclear after timeout');
            return {
                status: 'unknown',
                message: `Payment verification is still processing. Reference: ${reference}. Please refresh in a few moments or contact support.`,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            paymentLogger.error('TIMEOUT_HANDLER_ERROR', 'Failed to handle payment timeout', errorMsg);
            return {
                status: 'unknown',
                message: `Unable to determine payment status. Reference: ${reference}. Please contact support.`,
            };
        }
    }

    /**
     * Utility to create human-readable error messages
     */
    static getErrorMessage(error: any): string {
        if (error?.message) {
            return error.message;
        }

        if (typeof error === 'string') {
            return error;
        }

        return 'An unexpected error occurred. Please try again or contact support.';
    }

    /**
     * Utility delay function for retries
     */
    private static delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
