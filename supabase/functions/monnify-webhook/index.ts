import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { verifyMonnifyWebhookSignature, verifySchoolStaffAccess } from "../_shared/monnifySecurity.ts";

type Supa = ReturnType<typeof createClient>;

interface MonnifyConfig {
  monnify_api_key: string;
  monnify_secret_key: string;
  monnify_contract_code: string;
  monnify_base_url: string;
}

/** Moniepoint Microfinance Bank — Monnify's default virtual-account partner. */
const DEFAULT_PREFERRED_BANKS = ["50515"];
const MONNIFY_LIVE_BASE_URL = "https://api.monnify.com";
const MONNIFY_SANDBOX_BASE_URL = "https://sandbox.monnify.com";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MonnifyJson = {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: Record<string, unknown>;
};

function resolveMonnifyBaseUrl(apiKey: string, configured?: string | null): string {
  const trimmed = configured?.trim().replace(/\/$/, "") ?? "";
  const key = apiKey.trim().toUpperCase();
  const isSandboxKey = key.includes("TEST") || key.includes("SANDBOX") || key.startsWith("MK_TEST");
  if (!trimmed) return isSandboxKey ? MONNIFY_SANDBOX_BASE_URL : MONNIFY_LIVE_BASE_URL;
  if (isSandboxKey && trimmed.includes("api.monnify.com")) return MONNIFY_SANDBOX_BASE_URL;
  if (!isSandboxKey && trimmed.includes("sandbox.monnify.com")) return MONNIFY_LIVE_BASE_URL;
  return trimmed;
}

function buildAccountReference(_schoolId: string, studentId: string): string {
  return `EDU-${studentId}`;
}

function buildAccountReferenceCandidates(schoolId: string, studentId: string): string[] {
  const primary = buildAccountReference(schoolId, studentId);
  const legacy = `EDU-${schoolId}-${studentId}`;
  return primary === legacy ? [primary] : [primary, legacy];
}

function parseAccountReference(ref: string): { schoolId: string; studentId: string } | null {
  if (!ref.startsWith("EDU-")) return null;
  const rest = ref.slice(4);
  const splitAt = rest.indexOf("-", 36);
  if (splitAt === -1) {
    return UUID_RE.test(rest) ? { schoolId: "", studentId: rest } : null;
  }
  const schoolId = rest.slice(0, 36);
  const studentId = rest.slice(splitAt + 1);
  return UUID_RE.test(studentId) ? { schoolId, studentId } : null;
}

async function resolveSchoolAndStudentFromReference(
  supabase: Supa,
  accountReference: string
): Promise<{ schoolId: string; studentId: string } | null> {
  const parsed = parseAccountReference(accountReference);
  if (!parsed) return null;
  if (parsed.schoolId) return parsed;
  const { data: student } = await supabase
    .from("students")
    .select("school_id")
    .eq("id", parsed.studentId)
    .maybeSingle();
  if (!student?.school_id) return null;
  return { schoolId: student.school_id, studentId: parsed.studentId };
}

async function readMonnifyJson(res: Response): Promise<MonnifyJson | null> {
  try {
    return (await res.json()) as MonnifyJson;
  } catch {
    return null;
  }
}

function monnifyErrorMessage(json: MonnifyJson | null, fallback: string): string {
  const msg = json?.responseMessage?.trim() || fallback;
  if (/service is currently unavailable/i.test(msg)) {
    return `${msg} Check that your base URL matches your keys (sandbox: ${MONNIFY_SANDBOX_BASE_URL}, live: ${MONNIFY_LIVE_BASE_URL}), your contract code is correct, and retry in a few minutes.`;
  }
  return msg;
}

async function getConfig(supabase: Supa, schoolId: string): Promise<MonnifyConfig | null> {
  const { data } = await supabase
    .from("school_payment_config")
    .select("monnify_api_key, monnify_secret_key, monnify_contract_code, monnify_base_url, is_active")
    .eq("school_id", schoolId)
    .eq("provider", "monnify")
    .maybeSingle();
  if (
    !data ||
    !data.is_active ||
    !data.monnify_secret_key ||
    !data.monnify_api_key ||
    !data.monnify_contract_code
  ) {
    return null;
  }
  return {
    monnify_api_key: data.monnify_api_key,
    monnify_secret_key: data.monnify_secret_key,
    monnify_contract_code: data.monnify_contract_code,
    monnify_base_url: resolveMonnifyBaseUrl(data.monnify_api_key, data.monnify_base_url),
  };
}

async function monnifyAuth(
  cfg: MonnifyConfig
): Promise<{ token: string | null; error?: string }> {
  try {
    const basic = btoa(`${cfg.monnify_api_key}:${cfg.monnify_secret_key}`);
    const res = await fetch(`${cfg.monnify_base_url}/api/v1/auth/login`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    });
    const json = await readMonnifyJson(res);
    const token = (json?.responseBody?.accessToken as string | undefined) ?? null;
    if (json?.requestSuccessful && token) {
      return { token };
    }
    return {
      token: null,
      error: monnifyErrorMessage(
        json,
        `Monnify authentication failed. Verify API key, secret, and base URL (${cfg.monnify_base_url}).`
      ),
    };
  } catch {
    return {
      token: null,
      error: `Could not reach Monnify at ${cfg.monnify_base_url}. Check your base URL and try again.`,
    };
  }
}

/** One Monnify customer per student — use the stable student UUID as the email local-part. */
function buildCustomerEmail(studentId: string): string {
  return `${studentId}@va.edupulse.app`;
}

function buildStudentFullName(student: {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
}): string {
  return [student.first_name, student.middle_name, student.last_name]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function rowFromMonnifyReservedBody(
  schoolId: string,
  studentId: string,
  body: Record<string, unknown>,
  fallbackAccountName: string
) {
  const accounts = Array.isArray(body.accounts) ? body.accounts : [];
  const first = (accounts[0] ?? {}) as Record<string, unknown>;
  return {
    school_id: schoolId,
    student_id: studentId,
    account_number: (first.accountNumber ?? body.accountNumber ?? null) as string | null,
    account_name: fallbackAccountName,
    bank_name: (first.bankName ?? body.bankName ?? null) as string | null,
    bank_code: (first.bankCode ?? body.bankCode ?? null) as string | null,
    reservation_reference: (body.reservationReference ?? body.accountReference ?? null) as string | null,
    provider: "monnify",
    is_active: true,
  };
}

async function fetchReservedAccountFromMonnify(
  cfg: MonnifyConfig,
  token: string,
  accountReferences: string[]
): Promise<{ success: boolean; body?: Record<string, unknown>; error?: string }> {
  for (const accountReference of accountReferences) {
    const res = await fetch(
      `${cfg.monnify_base_url}/api/v2/bank-transfer/reserved-accounts/${encodeURIComponent(accountReference)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const json = await readMonnifyJson(res);
    const body = json?.responseBody;
    if (json?.requestSuccessful && body) {
      return { success: true, body };
    }
  }
  return { success: false, error: "Reserved account not found on Monnify." };
}

async function createReservedAccountOnMonnify(
  cfg: MonnifyConfig,
  token: string,
  payload: {
    accountReference: string;
    accountName: string;
    customerEmail: string;
  }
): Promise<{ success: boolean; body?: Record<string, unknown>; error?: string }> {
  const v2Res = await fetch(`${cfg.monnify_base_url}/api/v2/bank-transfer/reserved-accounts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      accountReference: payload.accountReference,
      accountName: payload.accountName,
      currencyCode: "NGN",
      contractCode: cfg.monnify_contract_code,
      customerEmail: payload.customerEmail,
      customerName: payload.accountName,
      getAllAvailableBanks: false,
      preferredBanks: DEFAULT_PREFERRED_BANKS,
    }),
  });
  const v2Json = await readMonnifyJson(v2Res);
  if (v2Json?.requestSuccessful && v2Json.responseBody) {
    return { success: true, body: v2Json.responseBody };
  }

  const v2Error = monnifyErrorMessage(v2Json, "Failed to reserve account.");
  if (!/service is currently unavailable|failed to reserve/i.test(v2Error)) {
    return { success: false, error: v2Error };
  }

  const v1Res = await fetch(`${cfg.monnify_base_url}/api/v1/bank-transfer/reserved-accounts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      accountReference: payload.accountReference,
      accountName: payload.accountName,
      currencyCode: "NGN",
      contractCode: cfg.monnify_contract_code,
      customerEmail: payload.customerEmail,
      customerName: payload.accountName,
    }),
  });
  const v1Json = await readMonnifyJson(v1Res);
  if (v1Json?.requestSuccessful && v1Json.responseBody) {
    return { success: true, body: v1Json.responseBody };
  }
  return { success: false, error: monnifyErrorMessage(v1Json, v2Error) };
}

function isDuplicateReservationError(message: string): boolean {
  return /more than 1 account|same reference|already been used|existing active reserved/i.test(message);
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
  student: { first_name: string; middle_name?: string | null; last_name: string }
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

  const expectedName = buildStudentFullName(student);
  if (row.account_name === expectedName) {
    return { success: true, account: row };
  }

  const cfg = await getConfig(supabase, schoolId);
  if (cfg) {
    const auth = await monnifyAuth(cfg);
    if (auth.token) {
      for (const accountReference of buildAccountReferenceCandidates(schoolId, studentId)) {
        const synced = await syncAccountNameWithMonnify(
          cfg,
          auth.token,
          accountReference,
          expectedName
        );
        if (synced) break;
      }
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
    .select("first_name, middle_name, last_name, student_id")
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

  const auth = await monnifyAuth(cfg);
  if (!auth.token) {
    return { success: false, error: auth.error ?? "Monnify authentication failed." };
  }

  const accountReference = buildAccountReference(schoolId, studentId);
  const referenceCandidates = buildAccountReferenceCandidates(schoolId, studentId);
  const accountName = buildStudentFullName(student);
  const customerEmail = buildCustomerEmail(studentId);

  // Recover account already created on Monnify but missing from our DB (e.g. after a partial failure).
  const existingOnMonnify = await fetchReservedAccountFromMonnify(
    cfg,
    auth.token,
    referenceCandidates
  );
  if (existingOnMonnify.success && existingOnMonnify.body) {
    const recovered = rowFromMonnifyReservedBody(
      schoolId,
      studentId,
      existingOnMonnify.body,
      accountName
    );
    if (recovered.account_number) {
      await supabase
        .from("student_virtual_accounts")
        .upsert([recovered], { onConflict: "student_id,provider" });
      return { success: true, account: recovered };
    }
  }

  const created = await createReservedAccountOnMonnify(cfg, auth.token, {
    accountReference,
    accountName,
    customerEmail,
  });
  if (!created.success || !created.body) {
    const errMsg = created.error ?? "Failed to reserve account.";
    if (isDuplicateReservationError(errMsg)) {
      const retry = await fetchReservedAccountFromMonnify(cfg, auth.token, referenceCandidates);
      if (retry.success && retry.body) {
        const recovered = rowFromMonnifyReservedBody(schoolId, studentId, retry.body, accountName);
        if (recovered.account_number) {
          await supabase
            .from("student_virtual_accounts")
            .upsert([recovered], { onConflict: "student_id,provider" });
          return { success: true, account: recovered };
        }
      }
    }
    return { success: false, error: errMsg };
  }

  const accountRow = rowFromMonnifyReservedBody(schoolId, studentId, created.body, accountName);

  await supabase
    .from("student_virtual_accounts")
    .upsert([accountRow], { onConflict: "student_id,provider" });

  return { success: true, account: accountRow };
}

async function applyPaymentToObligations(
  supabase: Supa,
  schoolId: string,
  studentId: string,
  amount: number
): Promise<number> {
  let remaining = amount;
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

  const { data: after } = await supabase
    .from("fee_obligations")
    .select("amount_outstanding")
    .eq("school_id", schoolId)
    .eq("student_id", studentId);

  return (after ?? []).reduce((sum, row) => sum + Math.max(0, Number(row.amount_outstanding ?? 0)), 0);
}

async function notifyPaymentConfirmation(
  supabase: Supa,
  schoolId: string,
  studentId: string,
  studentName: string,
  amountPaid: number,
  newBalance: number,
  receiptNumber: string
): Promise<void> {
  const amountText = `₦${amountPaid.toLocaleString()}`;
  const balanceText = `₦${newBalance.toLocaleString()}`;

  const [{ data: links }, { data: financeStaff }] = await Promise.all([
    supabase.from("student_parents").select("parent_id").eq("student_id", studentId),
    supabase
      .from("staff")
      .select("id")
      .eq("school_id", schoolId)
      .eq("role", "finance")
      .eq("is_active", true),
  ]);

  const parentRows = (links ?? []).map((l) => ({
    school_id: schoolId,
    recipient_id: l.parent_id,
    recipient_role: "parent",
    notification_type: "payment_confirmation",
    title: "✅ Payment Received",
    message: `Payment of ${amountText} received for ${studentName}. Outstanding balance: ${balanceText}. Receipt: ${receiptNumber}`,
    priority: "medium",
    related_student_id: studentId,
    delivery_channels: ["in_app"],
  }));

  const financeRows = (financeStaff ?? []).map((s) => ({
    school_id: schoolId,
    recipient_id: s.id,
    recipient_role: "finance",
    notification_type: "payment_confirmation",
    title: "💰 Payment Received",
    message: `${amountText} received for ${studentName}. Balance: ${balanceText}. Receipt: ${receiptNumber}`,
    priority: "medium",
    related_student_id: studentId,
    delivery_channels: ["in_app"],
  }));

  const rows = [...parentRows, ...financeRows];
  if (rows.length > 0) {
    await supabase.from("notifications").insert(rows);
  }
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

  const resolved = await resolveSchoolAndStudentFromReference(supabase, accountReference);
  if (!resolved) {
    return { success: false, error: "Could not resolve student from account reference." };
  }
  if (amountPaid <= 0) return { success: false, error: "Invalid amount." };

  const { schoolId, studentId } = resolved;

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

  const newBalance = await applyPaymentToObligations(supabase, schoolId, studentId, amountPaid);

  await supabase.from("audit_logs").insert([
    {
      school_id: schoolId,
      user_type: "system",
      action: "payment_confirmed",
      entity_type: "payment",
      entity_id: studentId,
      new_values: {
        amount: amountPaid,
        paymentReference,
        receiptNumber,
        newBalance,
        source: "monnify",
      },
    },
  ]);

  const { data: student } = await supabase
    .from("students")
    .select("first_name, middle_name, last_name")
    .eq("id", studentId)
    .maybeSingle();
  const studentName = student ? buildStudentFullName(student) : "Student";

  await notifyPaymentConfirmation(
    supabase,
    schoolId,
    studentId,
    studentName,
    amountPaid,
    newBalance,
    receiptNumber
  );

  return { success: true };
}

async function verifyWebhookForPayload(
  supabase: Supa,
  rawBody: string,
  payload: Record<string, any>,
  signatureHeader: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (Deno.env.get("MONNIFY_ALLOW_UNSIGNED_WEBHOOKS") === "true") {
    return { ok: true };
  }

  const eventData = payload?.eventData ?? payload;
  const accountReference: string =
    eventData?.product?.reference ||
    eventData?.destinationAccountInformation?.reference ||
    eventData?.accountReference ||
    "";

  const resolved = await resolveSchoolAndStudentFromReference(supabase, accountReference);
  if (!resolved) {
    return { ok: false, error: "Could not resolve school for webhook verification." };
  }

  const cfg = await getConfig(supabase, resolved.schoolId);
  if (!cfg?.monnify_secret_key) {
    return { ok: false, error: "Monnify is not configured for this school." };
  }

  const valid = await verifyMonnifyWebhookSignature(
    rawBody,
    signatureHeader,
    cfg.monnify_secret_key
  );
  if (!valid) {
    return { ok: false, error: "Invalid Monnify webhook signature." };
  }

  return { ok: true };
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

    const rawBody = await req.text();
    let body: Record<string, any>;
    try {
      body = JSON.parse(rawBody) as Record<string, any>;
    } catch {
      return jsonResponse(req, { success: false, error: "Invalid JSON body." }, 400);
    }

    const internalAction = body?.action;

    if (internalAction === "reserve_account" || internalAction === "sync_account_name") {
      const { schoolId, studentId } = body;
      if (!schoolId || !studentId) {
        return jsonResponse(req, { success: false, error: "schoolId and studentId are required." }, 400);
      }

      const access = await verifySchoolStaffAccess(req, supabase, schoolId);
      if (!access.ok) {
        return jsonResponse(req, { success: false, error: access.error }, access.status);
      }

      if (internalAction === "reserve_account") {
        const result = await reserveAccount(supabase, schoolId, studentId);
        return jsonResponse(req, result, result.success ? 200 : 400);
      }

      const { data: student } = await supabase
        .from("students")
        .select("first_name, middle_name, last_name")
        .eq("id", studentId)
        .maybeSingle();
      if (!student) {
        return jsonResponse(req, { success: false, error: "Student not found." }, 404);
      }
      const result = await syncStoredAccountName(supabase, schoolId, studentId, student);
      return jsonResponse(req, result, result.success ? 200 : 400);
    }

    const signature = req.headers.get("monnify-signature");
    const verified = await verifyWebhookForPayload(supabase, rawBody, body, signature);
    if (!verified.ok) {
      return jsonResponse(req, { success: false, error: verified.error }, 401);
    }

    const result = await handleWebhook(supabase, body);
    return jsonResponse(req, result, result.success ? 200 : 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(req, { success: false, error: message }, 500);
  }
});
