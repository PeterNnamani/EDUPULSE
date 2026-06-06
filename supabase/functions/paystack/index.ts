import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlanPayload {
    plan: string;
    amount: number;
    currency?: string;
    billingCycle: string;
    startDate: string;
    endDate: string;
    maxStudents: number;
    autoRenew: boolean;
}

interface PaystackVerifyRequest {
    reference: string;
    schoolId: string;
    email?: string;
    plan?: PlanPayload;
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
            error: "Paystack secret key not configured on server. Add PAYSTACK_SECRET_KEY in Supabase Edge Function secrets.",
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

        if (!response.ok || !data.status || data.data?.reference !== reference) {
            return {
                verified: false,
                response: data,
                error: data.message || "Paystack verification failed",
            };
        }

        return { verified: true, response: data };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown Paystack API error";
        return { verified: false, error: errorMessage };
    }
}

async function activateSchool(supabase: ReturnType<typeof createClient>, schoolId: string) {
    await supabase
        .from("schools")
        .update({ subscription_status: "active", updated_at: new Date().toISOString() })
        .eq("id", schoolId);
}

async function fulfillSubscription(
    supabase: ReturnType<typeof createClient>,
    schoolId: string,
    reference: string,
    paystackResponse: PaystackVerifyResponse,
    plan?: PlanPayload
): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    const { data: existing, error: selectError } = await supabase
        .from("subscriptions")
        .select("id, status, school_id")
        .eq("payment_reference", reference)
        .eq("school_id", schoolId)
        .maybeSingle();

    if (selectError) {
        return { success: false, error: `Database query error: ${selectError.message}` };
    }

    if (existing) {
        if (existing.status !== "active") {
            const { error: updateError } = await supabase
                .from("subscriptions")
                .update({ status: "active", updated_at: new Date().toISOString() })
                .eq("id", existing.id);

            if (updateError) {
                return { success: false, error: `Failed to activate subscription: ${updateError.message}` };
            }
        }
        await activateSchool(supabase, schoolId);
        return { success: true, subscriptionId: existing.id };
    }

    if (!plan) {
        return {
            success: false,
            error: "No subscription row found. Pass plan details from the client so the server can create the record.",
        };
    }

    const paidKobo = paystackResponse.data?.amount ?? 0;
    const expectedKobo = Math.round(plan.amount * 100);
    if (paidKobo > 0 && paidKobo < expectedKobo) {
        return {
            success: false,
            error: `Payment amount mismatch. Expected ${expectedKobo} kobo, got ${paidKobo}.`,
        };
    }

    const { data: inserted, error: insertError } = await supabase
        .from("subscriptions")
        .insert({
            school_id: schoolId,
            plan: plan.plan,
            amount: plan.amount,
            currency: plan.currency ?? "NGN",
            payment_reference: reference,
            status: "active",
            start_date: plan.startDate,
            end_date: plan.endDate,
            billing_cycle: plan.billingCycle,
            max_students: plan.maxStudents,
            auto_renew: plan.autoRenew,
        })
        .select("id")
        .single();

    if (insertError) {
        return { success: false, error: `Failed to create subscription: ${insertError.message}` };
    }

    const invoiceNumber = `INV-${schoolId.slice(0, 8)}-${Date.now()}`;
    await supabase.from("invoices").insert({
        school_id: schoolId,
        subscription_id: inserted.id,
        invoice_number: invoiceNumber,
        amount: plan.amount,
        currency: plan.currency ?? "NGN",
        due_date: plan.startDate,
        paid_at: paystackResponse.data?.paid_at ?? new Date().toISOString(),
        status: "paid",
        payment_method: "paystack",
        payment_reference: reference,
    });

    await activateSchool(supabase, schoolId);
    return { success: true, subscriptionId: inserted.id };
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
        result.logs.push({ timestamp: new Date().toISOString(), message, level, details });
        console.log(`[${level.toUpperCase()}] ${message}`, details ? JSON.stringify(details) : "");
    };

    try {
        const body = (await req.json()) as PaystackVerifyRequest;
        const { reference, schoolId, email, plan } = body;

        if (!reference || !schoolId) {
            throw new Error("Missing required fields: reference and schoolId");
        }

        result.transactionReference = reference;
        addLog("Request validated", "info", { reference, schoolId, email, hasPlan: !!plan });

        const paystackResult = await verifyWithPaystack(reference);
        if (!paystackResult.verified) {
            result.paystackResponse = paystackResult.response;
            return new Response(
                JSON.stringify({ ...result, error: `Paystack verification failed: ${paystackResult.error}` }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
            );
        }

        result.paystackVerified = true;
        result.paystackResponse = paystackResult.response;

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error(
                "Supabase URL/service role missing. Do not add SUPABASE_* as custom secrets — they are injected automatically when the function is deployed."
            );
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const subscriptionResult = await fulfillSubscription(
            supabase,
            schoolId,
            reference,
            paystackResult.response!,
            plan
        );

        if (!subscriptionResult.success) {
            return new Response(
                JSON.stringify({ ...result, error: subscriptionResult.error }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
            );
        }

        result.subscriptionUpdated = true;
        result.subscriptionId = subscriptionResult.subscriptionId;
        result.success = true;

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        addLog("Payment verification failed", "error", { error: errorMessage });
        return new Response(JSON.stringify({ ...result, error: errorMessage }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
