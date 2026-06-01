import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaystackVerifyRequest {
    reference: string;
    schoolId: string;
    email: string;
}

interface PaystackVerifyResponse {
    status: boolean;
    message: string;
    data?: {
        id: number;
        reference: string;
        amount: number;
        paid_at: string;
        channel: string;
        currency: string;
        authorization?: {
            authorization_code: string;
            card_type: string;
            last4: string;
            exp_month: string;
            exp_year: string;
        };
    };
}

interface VerificationResult {
    success: boolean;
    transactionReference: string;
    paystackVerified: boolean;
    paystackResponse?: PaystackVerifyResponse;
    subscriptionUpdated: boolean;
    subscriptionId?: string;
    error?: string;
    logs: {
        timestamp: string;
        message: string;
        level: "info" | "warn" | "error";
        details?: Record<string, unknown>;
    }[];
}

async function verifyWithPaystack(reference: string): Promise<{ verified: boolean; response?: PaystackVerifyResponse; error?: string }> {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!PAYSTACK_SECRET_KEY) {
        return {
            verified: false,
            error: "Paystack secret key not configured",
        };
    }

    try {
        const url = `https://api.paystack.co/transaction/verify/${reference}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                "Content-Type": "application/json",
            },
        });

        const data = (await response.json()) as PaystackVerifyResponse;

        if (!response.ok || !data.status) {
            return {
                verified: false,
                response: data,
                error: data.message || "Paystack verification failed",
            };
        }

        return {
            verified: true,
            response: data,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown Paystack API error";
        return {
            verified: false,
            error: errorMessage,
        };
    }
}

async function updateSubscriptionRecord(
    supabase: any,
    schoolId: string,
    reference: string,
    paystackResponse: PaystackVerifyResponse
): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    try {
        // Check if subscription with this payment_reference already exists
        const { data: existingSubscription, error: selectError } = await supabase
            .from("subscriptions")
            .select("id, school_id")
            .eq("payment_reference", reference)
            .eq("school_id", schoolId)
            .maybeSingle();

        if (selectError && selectError.code !== "PGRST116") {
            return {
                success: false,
                error: `Database query error: ${selectError.message}`,
            };
        }

        // If subscription already updated, return success
        if (existingSubscription) {
            return {
                success: true,
                subscriptionId: existingSubscription.id,
            };
        }

        // Find the subscription with matching reference that hasn't been fully updated yet
        const { data: subscriptions, error: fetchError } = await supabase
            .from("subscriptions")
            .select("id, school_id, plan, billing_cycle, amount")
            .eq("payment_reference", reference)
            .limit(1);

        if (fetchError) {
            return {
                success: false,
                error: `Failed to fetch subscription: ${fetchError.message}`,
            };
        }

        if (!subscriptions || subscriptions.length === 0) {
            return {
                success: false,
                error: `No subscription found with payment reference: ${reference}`,
            };
        }

        const subscription = subscriptions[0];

        // Verify school_id matches
        if (subscription.school_id !== schoolId) {
            return {
                success: false,
                error: "School ID mismatch - potential tenant isolation breach",
            };
        }

        // Update subscription status to 'active' and verify the payment
        const { data: updateData, error: updateError } = await supabase
            .from("subscriptions")
            .update({
                status: "active",
                updated_at: new Date().toISOString(),
            })
            .eq("id", subscription.id)
            .eq("school_id", schoolId)
            .select("id");

        if (updateError) {
            return {
                success: false,
                error: `Failed to update subscription: ${updateError.message}`,
            };
        }

        if (!updateData || updateData.length === 0) {
            return {
                success: false,
                error: "Subscription update returned no records (RLS policy may have blocked it)",
            };
        }

        return {
            success: true,
            subscriptionId: updateData[0].id,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error during subscription update";
        return {
            success: false,
            error: errorMessage,
        };
    }
}

Deno.serve({ auth: false }, async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const result: VerificationResult = {
        success: false,
        transactionReference: "",
        paystackVerified: false,
        subscriptionUpdated: false,
        logs: [],
    };

    const addLog = (message: string, level: "info" | "warn" | "error" = "info", details?: Record<string, unknown>) => {
        result.logs.push({
            timestamp: new Date().toISOString(),
            message,
            level,
            details,
        });
        console.log(`[${level.toUpperCase()}] ${message}`, details ? JSON.stringify(details) : "");
    };

    try {
        addLog("Payment verification request received");

        const body = (await req.json()) as PaystackVerifyRequest;
        const { reference, schoolId, email } = body;

        if (!reference || !schoolId) {
            throw new Error("Missing required fields: reference and schoolId");
        }

        result.transactionReference = reference;
        addLog("Request validated", "info", { reference, schoolId, email });

        // Step 1: Verify with Paystack
        addLog("Starting Paystack API verification", "info", { reference });
        const paystackResult = await verifyWithPaystack(reference);

        if (!paystackResult.verified) {
            addLog("Paystack verification failed", "error", {
                error: paystackResult.error,
                response: paystackResult.response,
            });
            result.paystackResponse = paystackResult.response;
            return new Response(
                JSON.stringify({
                    ...result,
                    error: `Paystack verification failed: ${paystackResult.error}`,
                }),
                {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 400,
                }
            );
        }

        result.paystackVerified = true;
        result.paystackResponse = paystackResult.response;
        addLog("Paystack verification successful", "info", {
            transactionId: paystackResult.response?.data?.id,
            amount: paystackResult.response?.data?.amount,
            paidAt: paystackResult.response?.data?.paid_at,
        });

        // Step 2: Initialize Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error("Supabase configuration not found");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        addLog("Supabase client initialized");

        // Step 3: Update subscription record
        addLog("Updating subscription record", "info", { schoolId, reference });
        const subscriptionResult = await updateSubscriptionRecord(
            supabase,
            schoolId,
            reference,
            paystackResult.response!
        );

        if (!subscriptionResult.success) {
            addLog("Subscription update failed", "error", {
                error: subscriptionResult.error,
            });
            return new Response(
                JSON.stringify({
                    ...result,
                    error: subscriptionResult.error,
                }),
                {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 400,
                }
            );
        }

        result.subscriptionUpdated = true;
        result.subscriptionId = subscriptionResult.subscriptionId;
        addLog("Subscription successfully updated", "info", {
            subscriptionId: subscriptionResult.subscriptionId,
        });

        // Step 4: Return success
        result.success = true;
        addLog("Payment verification complete", "info");

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        addLog("Payment verification failed with exception", "error", {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
        });

        return new Response(
            JSON.stringify({
                ...result,
                error: errorMessage,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500,
            }
        );
    }
});
