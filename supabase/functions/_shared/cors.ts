/**
 * Restrict edge-function CORS to configured app origins.
 * Set ALLOWED_ORIGINS in Supabase secrets (comma-separated), e.g.:
 *   https://your-app.vercel.app,http://localhost:5173
 */
export function corsHeaders(req: Request): Record<string, string> {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const origin = req.headers.get("Origin") ?? "";
  const isLocalhost =
    origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");

  let allowOrigin = "";
  if (origin && configured.includes(origin)) {
    allowOrigin = origin;
  } else if (origin && isLocalhost && configured.length === 0) {
    // Local dev when ALLOWED_ORIGINS is not configured yet
    allowOrigin = origin;
  } else if (configured.length > 0) {
    allowOrigin = configured[0];
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, monnify-signature",
    Vary: "Origin",
  };

  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
  }

  return headers;
}

export function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}
