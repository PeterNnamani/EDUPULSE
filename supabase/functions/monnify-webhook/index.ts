import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type Supa = ReturnType<typeof createClient>;

interface MonnifyConfig {
  monnify_api_key: string;
  monnify_secret_key: string;
  monnify_contract_code: string;
  monnify_base_url: string;
}

function buildAccountReference(schoolId: string, studentId: string): string {
  return `EDU-${schoolId}-${studentId}`;
}

function parseAccountReference(ref: string): { schoolId: string; studentId: string } | null {
  const parts = ref.split("-");
  // EDU-{uuid}-{uuid} but uuids contain dashes, so rejoin.
  if (parts.length < 3 || parts[0] !== "EDU") return null;
  const rest = ref.slice(4); // after "EDU-"
  const splitAt = rest.indexOf("-", 36); // first uuid is 36 chars
  if (splitAt === -1) return null;
  return { schoolId: rest.slice(0, 36), studentId: rest.slice(splitAt + 1) };
}

async function getConfig(supabase: Supa, schoolId: string): Promise<MonnifyConfig | null> {
  const { data } = await supabase
    .from("school_payment_config")
    .select("monnify_api_key, monnify_secret_key, monnify_contract_code, monnify_base_url, is_active")
    .eq("school_id", schoolId)
    .eq("provider", "monnify")
    .maybeSingle();
  if (!data || !data.is_active || !data.monnify_secret_key || !data.monnify_api_key) return null;
  return {
    monnify_api_key: data.monnify_api_key,
    monnify_secret_key: data.monnify_secret_key,
    monnify_contract_code: data.monnify_contract_code,
    monnify_base_url: data.monnify_base_url || "https://api.monnify.com",
  };
}

async function monnifyAuth(cfg: MonnifyConfig): Promise<string | null> {
  const basic = btoa(`${cfg.monnify_api_key}:${cfg.monnify_secret_key}`);
  const res = await fetch(`${cfg.monnify_base_url}/api/v1/auth/login`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
  });
  const json = await res.json();
  return json?.responseBody?.accessToken ?? null;
}

async function syncAccountNameWithMonnify(
  cfg: MonnifyConfig,
  token: string,
  accountReference: string,
  accountName: string
): Promise<boolean> {
  const res = await fetch(
    `${cfg.monnify_base_url}/api/v1/bank-transfer/reserved-accounts/${encodeURIComponent(accountReference)}/kyc-info`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ accountName }),
    }
  );
  const json = await res.json();
  return !!(res.ok && json?.requestSuccessful);
}

async function syncStoredAccountName(
  supabase: Supa,
  schoolId: string,
  studentId: string,
  student: { first_name: string; last_name: string }
): Promise<{ success: boolean; error?: string; account?: Record<string, unknown> }> {
  const { data: row } = await supabase
    .from("student_virtual_accounts")
    .select("account_number, account_name, bank_name, reservation_reference")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("is_active", true)
    .maybeSingle();

  if (!row?.account_number) {
    return { success: false, error: "No virtual account found for this student." };
  }

  const expectedName = `${student.first_name} ${student.last_name}`.trim();
  if (row.account_name === expectedName) {
    return { success: true, account: row };
  }

  const cfg = await getConfig(supabase, schoolId);
  if (cfg) {
    const token = await monnifyAuth(cfg);
    if (token) {
      const accountReference = buildAccountReference(schoolId, studentId);
      await syncAccountNameWithMonnify(cfg, token, accountReference, expectedName);
    }
  }

  const { data: updated, error } = await supabase
    .from("student_virtual_accounts")
    .update({ account_name: expectedName, updated_at: new Date().toISOString() })
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("provider", "monnify")
    .select("account_number, account_name, bank_name, reservation_reference")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  return { success: true, account: updated ?? { ...row, account_name: expectedName } };
}

async function reserveAccount(
  supabase: Supa,
  schoolId: string,
  studentId: string
): Promise<{ success: boolean; error?: string; account?: Record<string, unknown> }> {
  const { data: student } = await supabase
    .from("students")
    .select("first_name, last_name, student_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { success: false, error: "Student not found." };

  const { data: existingRow } = await supabase
    .from("student_virtual_accounts")
    .select("account_number, account_name, bank_name, reservation_reference")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("is_active", true)
    .maybeSingle();

  if (existingRow?.account_number) {
    return syncStoredAccountName(supabase, schoolId, studentId, student);
  }

  const cfg = await getConfig(supabase, schoolId);
  if (!cfg) return { success: false, error: "Monnify is not configured for this school." };

  const token = await monnifyAuth(cfg);
  if (!token) return { success: false, error: "Monnify authentication failed." };

  const accountReference = buildAccountReference(schoolId, studentId);
  const accountName = `${student.first_name} ${student.last_name}`.trim();

  const res = await fetch(`${cfg.monnify_base_url}/api/v2/bank-transfer/reserved-accounts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      accountReference,
      accountName,
      currencyCode: "NGN",
      contractCode: cfg.monnify_contract_code,
      customerEmail: `${student.student_id || studentId}@edupulse.school`,
      customerName: accountName,
      getAllAvailableBanks: true,
    }),
  });
  const json = await res.json();
  const body = json?.responseBody;
  if (!res.ok || !body) {
    return { success: false, error: json?.responseMessage || "Failed to reserve account." };
  }

  const first = body.accounts?.[0] ?? {};
  const accountRow = {
    school_id: schoolId,
    student_id: studentId,
    account_number: first.accountNumber ?? null,
    account_name: body.accountName ?? accountName,
    bank_name: first.bankName ?? null,
    bank_code: first.bankCode ?? null,
    reservation_reference: body.accountReference ?? accountReference,
    provider: "monnify",
    is_active: true,
  };

  await supabase
    .from("student_virtual_accounts")
    .upsert([accountRow], { onConflict: "student_id,provider" });

  return { success: true, account: accountRow };
}

async function handleWebhook(
  supabase: Supa,
  payload: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const eventType = payload?.eventType;
  const eventData = payload?.eventData ?? payload;

  if (eventType && eventType !== "SUCCESSFUL_TRANSACTION") {
    return { success: true }; // ignore non-success events
  }

  const accountReference: string =
    eventData?.product?.reference ||
    eventData?.destinationAccountInformation?.reference ||
    eventData?.accountReference ||
    "";
  const amountPaid = Number(eventData?.amountPaid ?? eventData?.amount ?? 0);
  const paymentReference: string =
    eventData?.paymentReference || eventData?.transactionReference || `MNFY-${Date.now()}`;

  const parsed = parseAccountReference(accountReference);
  if (!parsed) return { success: false, error: "Could not resolve student from account reference." };
  if (amountPaid <= 0) return { success: false, error: "Invalid amount." };

  const { schoolId, studentId } = parsed;

  // Idempotency: skip if this payment reference already recorded.
  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("school_id", schoolId)
    .eq("payment_reference", paymentReference)
    .maybeSingle();
  if (existing) return { success: true };

  const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const { error: payErr } = await supabase.from("payments").insert([
    {
      school_id: schoolId,
      student_id: studentId,
      amount: amountPaid,
      payment_method: "bank_transfer",
      payment_reference: paymentReference,
      receipt_number: receiptNumber,
      status: "completed",
      paid_at: new Date().toISOString(),
      notes: "Monnify virtual account transfer",
    },
  ]);
  if (payErr) return { success: false, error: payErr.message };

  // Apply against obligations (FIFO).
  let remaining = amountPaid;
  const { data: obligations } = await supabase
    .from("fee_obligations")
    .select("id, amount_due, amount_paid, amount_outstanding")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .order("due_date", { ascending: true });

  for (const o of obligations ?? []) {
    if (remaining <= 0) break;
    const outstanding = Number(o.amount_outstanding ?? 0);
    if (outstanding <= 0) continue;
    const applied = Math.min(remaining, outstanding);
    const newPaid = Number(o.amount_paid ?? 0) + applied;
    const newOutstanding = Number(o.amount_due ?? 0) - newPaid;
    await supabase
      .from("fee_obligations")
      .update({
        amount_paid: newPaid,
        amount_outstanding: Math.max(0, newOutstanding),
        paid_in_full: newOutstanding <= 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", o.id);
    remaining -= applied;
  }

  // Audit log.
  await supabase.from("audit_logs").insert([
    {
      school_id: schoolId,
      user_type: "system",
      action: "payment_confirmed",
      entity_type: "payment",
      entity_id: studentId,
      new_values: { amount: amountPaid, paymentReference, receiptNumber, source: "monnify" },
    },
  ]);

  // Notify parents + finance (in-app).
  const { data: links } = await supabase
    .from("student_parents")
    .select("parent_id")
    .eq("student_id", studentId);
  const { data: student } = await supabase
    .from("students")
    .select("first_name, last_name")
    .eq("id", studentId)
    .maybeSingle();
  const studentName = student ? `${student.first_name} ${student.last_name}`.trim() : "Student";

  for (const l of links ?? []) {
    await supabase.from("notifications").insert([
      {
        school_id: schoolId,
        recipient_id: l.parent_id,
        recipient_role: "parent",
        notification_type: "payment_confirmation",
        title: "✅ Payment Received",
        message: `Payment of ₦${amountPaid.toLocaleString()} received for ${studentName}. Receipt: ${receiptNumber}`,
        priority: "medium",
        related_student_id: studentId,
        delivery_channels: ["in_app"],
      },
    ]);
  }

  return { success: true };
}

Deno.serve({ auth: false }, async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase URL/service role missing (auto-injected on deploy).");
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = (await req.json()) as Record<string, any>;

    // Internal action: reserve a virtual account for a student.
    if (body?.action === "reserve_account") {
      const { schoolId, studentId } = body;
      if (!schoolId || !studentId) throw new Error("schoolId and studentId are required.");
      const result = await reserveAccount(supabase, schoolId, studentId);
      return jsonResponse(req, result, result.success ? 200 : 400);
    }

    if (body?.action === "sync_account_name") {
      const { schoolId, studentId } = body;
      if (!schoolId || !studentId) throw new Error("schoolId and studentId are required.");
      const { data: student } = await supabase
        .from("students")
        .select("first_name, last_name")
        .eq("id", studentId)
        .maybeSingle();
      if (!student) throw new Error("Student not found.");
      const result = await syncStoredAccountName(supabase, schoolId, studentId, student);
      return jsonResponse(req, result, result.success ? 200 : 400);
    }

    // Otherwise treat as a Monnify webhook.
    const result = await handleWebhook(supabase, body);
    return jsonResponse(req, result, result.success ? 200 : 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(req, { success: false, error: message }, 500);
  }
});
