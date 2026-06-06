import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import Groq from "npm:groq-sdk@0.5.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const groq = new Groq({
  apiKey: Deno.env.get("GROQ_API_KEY"),
});

const BASE_CAPABILITIES = `EduPulse helps schools intervene early — not only by flagging struggling students, but through counselor workflows, behaviour tracking, parent notifications, and continuous risk-based monitoring.

You can help users with:
- School activities and assignments (including drafting lesson note outlines)
- Questions about THEIR account data (classes, students, attendance, risk flags, interventions)
- Practical next steps inside EduPulse

RULES:
- Use ONLY facts from ACCOUNT DATA for numbers, names, dates, and lists.
- NEVER invent student names, teacher names, class names, grade levels, or counts. No placeholders like "Ms. Thompson" or made-up totals.
- If ACCOUNT DATA lacks the answer, reply exactly: "I don't have that in your school records yet. Check the relevant page in EduPulse or ask again after data is recorded."
- Do not say you are "checking" or "accessing" systems — the data is already provided above.
- Keep answers concise, warm, and professional.
- Address the user by name when natural.`;

type StaffRole = "admin" | "principal" | "teacher" | "counselor" | "finance" | "bursar";

interface ChatRequestBody {
  userMessage?: string;
  userRole?: string;
  userName?: string;
  schoolId?: string;
  userId?: string;
  staffId?: string;
  children?: Array<{ id: string; firstName: string; lastName: string; className?: string }>;
  conversationHistory?: Array<{ role: string; content: string }>;
}

async function validateCaller(
  supabase: SupabaseClient,
  input: { userId: string; schoolId: string; userRole: string }
): Promise<{ ok: true; staffDbId?: string; userName?: string } | { ok: false; error: string }> {
  const { userId, schoolId, userRole } = input;

  if (userRole === "parent") {
    const { data, error } = await supabase
      .from("parents")
      .select("id, school_id")
      .eq("id", userId)
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      return { ok: false, error: "Invalid parent identity for this school" };
    }
    return { ok: true };
  }

  const staffRoles: StaffRole[] = ["admin", "principal", "teacher", "counselor", "finance", "bursar"];
  if (!staffRoles.includes(userRole as StaffRole)) {
    return { ok: false, error: "Unsupported role" };
  }

  const { data: staffRow, error } = await supabase
    .from("staff")
    .select("id, school_id, role, full_name, user_id")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();

  if (error || !staffRow) {
    return { ok: false, error: "Invalid staff identity for this school" };
  }

  const normalizedRole = staffRow.role === "bursar" ? "finance" : staffRow.role;
  if (normalizedRole !== userRole) {
    return { ok: false, error: "Role mismatch" };
  }

  return { ok: true, staffDbId: staffRow.id, userName: staffRow.full_name };
}

async function fetchSchoolOverview(supabase: SupabaseClient, schoolId: string) {
  const [
    { count: studentCount },
    { data: staffRows },
    { data: classRows },
    { count: interventionCount },
    { count: assignmentCount },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active"),
    supabase
      .from("staff")
      .select("full_name, role")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("full_name")
      .limit(40),
    supabase
      .from("classes")
      .select("name")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("name")
      .limit(30),
    supabase
      .from("intervention_cases")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .in("status", ["open", "in_progress", "on_hold"]),
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active"),
  ]);

  const staffByRole: Record<string, number> = {};
  for (const s of staffRows ?? []) {
    const role = s.role ?? "staff";
    staffByRole[role] = (staffByRole[role] ?? 0) + 1;
  }

  return {
    activeStudents: studentCount ?? 0,
    activeStaff: (staffRows ?? []).length,
    activeClasses: (classRows ?? []).length,
    staffByRole,
    staff: (staffRows ?? []).map((s) => ({ name: s.full_name, role: s.role })),
    classes: (classRows ?? []).map((c) => c.name),
    openInterventionCases: interventionCount ?? 0,
    activeAssignments: assignmentCount ?? 0,
  };
}

async function buildServerAccountContext(
  supabase: SupabaseClient,
  params: {
    schoolId: string;
    userRole: string;
    userName: string;
    staffDbId?: string;
    children?: ChatRequestBody["children"];
  }
) {
  const overview = await fetchSchoolOverview(supabase, params.schoolId);
  const base = {
    userName: params.userName,
    role: params.userRole,
    schoolId: params.schoolId,
    generatedAt: new Date().toISOString(),
    platform: {
      earlyIntervention:
        "EduPulse supports early intervention through risk-based monitoring, counselor workflows, behaviour tracking, and automated parent notifications.",
    },
    data: { schoolOverview: overview } as Record<string, unknown>,
  };

  if (params.userRole === "parent" && params.children?.length) {
    base.data.children = params.children.slice(0, 5).map((c) => ({
      name: `${c.firstName} ${c.lastName}`.trim(),
      class: c.className ?? "—",
    }));
  }

  if (params.staffDbId && params.userRole === "teacher") {
    const { data: classSubjects } = await supabase
      .from("class_subjects")
      .select("classes(name)")
      .eq("school_id", params.schoolId)
      .eq("teacher_id", params.staffDbId)
      .limit(15);

    const classNames = [
      ...new Set(
        (classSubjects ?? [])
          .map((row) => (row.classes as { name?: string } | null)?.name)
          .filter(Boolean)
      ),
    ];
    base.data.teacherClasses = classNames;
  }

  return base;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(req, { error: "Missing authorization" }, 401);
  }

  try {
    const body = (await req.json()) as ChatRequestBody;
    const {
      userMessage,
      userRole = "teacher",
      userName = "there",
      schoolId,
      userId,
      staffId,
      children,
      conversationHistory = [],
    } = body;

    if (!userMessage?.trim()) {
      return jsonResponse(req, { error: "Message is required" }, 400);
    }

    if (!schoolId || !userId) {
      return jsonResponse(req, { error: "schoolId and userId are required" }, 400);
    }

    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) {
      return jsonResponse(req, { error: "Groq API key not configured" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse(req, { error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const identity = await validateCaller(supabase, { userId, schoolId, userRole });
    if (!identity.ok) {
      return jsonResponse(req, { error: identity.error }, 403);
    }

    const accountData = await buildServerAccountContext(supabase, {
      schoolId,
      userRole,
      userName: identity.userName ?? userName,
      staffDbId: staffId ?? identity.staffDbId,
      children,
    });

    const roleHints: Record<string, string> = {
      admin: "Focus on school operations, subscriptions, staff, and oversight.",
      teacher: "Focus on classes, attendance, grades, assignments, lesson notes, and students needing attention.",
      principal: "Focus on leadership, risk oversight, interventions, and school-wide trends.",
      counselor: "Focus on intervention cases, student wellbeing, and follow-up actions.",
      finance: "Focus on fees, payments, and financial records.",
      parent: "Focus on their children's attendance, behaviour, and school updates.",
    };

    const systemPrompt = `You are the EduPulse Assistant speaking with ${accountData.userName} (${userRole}).

${BASE_CAPABILITIES}

Role focus: ${roleHints[userRole] || roleHints.teacher}

ACCOUNT DATA (live from database — treat as source of truth):
${JSON.stringify(accountData, null, 2)}`;

    const historyMessages = conversationHistory
      .filter((m) => m.content && (m.role === "user" || m.role === "assistant"))
      .slice(-8)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: userMessage.trim() },
      ],
      temperature: 0.5,
      max_tokens: 700,
    });

    const message = completion.choices[0].message.content || "";

    return jsonResponse(req, { message, model: "llama-3.1-8b-instant" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Chat Error:", errorMessage);
    return jsonResponse(req, { error: errorMessage || "Unknown error" }, 500);
  }
});
