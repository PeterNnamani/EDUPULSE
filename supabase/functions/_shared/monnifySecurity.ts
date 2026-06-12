import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

/** Placeholder returned to the client when a secret is already stored. */
export const SECRET_MASK = "••••••••••••";

export async function verifyMonnifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  clientSecret: string
): Promise<boolean> {
  if (!signatureHeader?.trim() || !clientSecret) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(clientSecret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );

  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expected = signatureHeader.trim().toLowerCase();
  return computed === expected;
}

export async function verifySchoolStaffAccess(
  req: Request,
  serviceClient: SupabaseClient,
  schoolId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, error: "Authentication required.", status: 401 };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return { ok: false, error: "Server auth configuration missing.", status: 500 };
  }

  const token = authHeader.slice(7);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return { ok: false, error: "Invalid or expired session.", status: 401 };
  }

  const email = user.email?.trim().toLowerCase() ?? "";

  const { data: byUserId } = await serviceClient
    .from("staff")
    .select("id, role")
    .eq("school_id", schoolId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role", ["admin", "finance"])
    .maybeSingle();

  if (byUserId) return { ok: true };

  if (email) {
    const { data: byEmail } = await serviceClient
      .from("staff")
      .select("id, role")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .in("role", ["admin", "finance"])
      .ilike("email", email)
      .maybeSingle();

    if (byEmail) return { ok: true };
  }

  return { ok: false, error: "You do not have permission for this school.", status: 403 };
}
