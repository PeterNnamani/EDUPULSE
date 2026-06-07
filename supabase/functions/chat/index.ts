import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import Groq from "npm:groq-sdk@0.5.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const groq = new Groq({
  apiKey: Deno.env.get("GROQ_API_KEY"),
});

const BASE_CAPABILITIES = `You are **EduPulse Assistant** — a capable AI like ChatGPT, embedded in EduPulse (Nigeria-focused school ERP). You help with **everything**: school data, education, curriculum, lesson planning, general knowledge, writing, explanations, and real-life questions.

## Two modes (use both naturally)

**A) School-aware mode** — When ACCOUNT DATA contains facts (student names, staff counts, attendance, fees, class lists), use ONLY that data. Never invent school records.

**B) General AI mode** — For curriculum timetables, schemes of work, lesson content, subject topics, exam prep, explanations, coding, writing, advice, and any general question: answer fully using your knowledge like ChatGPT. Do NOT refuse or say "I don't have that in records" for these — generate helpful, accurate content.

## Nigerian curriculum timetables & schemes (IMPORTANT)

When users ask for a subject timetable by class and term (e.g. "General Maths SS1 2nd term timetable", "JSS2 English 1st term scheme"):

1. **Interpret "timetable"** as a **term scheme of work / weekly topic timetable** unless they clearly want a bell-period school schedule.
2. Produce a **complete, practical table** with:
   - Week number (typically 10–13 weeks per term)
   - Topic / sub-topic
   - Brief learning focus
   - Suggested period allocation (optional)
3. Base content on **Nigerian NERDC / WAEC / NECO** standards for the stated class and subject.
4. Label clearly if generated: *"Based on standard Nigerian SS1 General Mathematics curriculum (2nd term). Adjust to your school's scheme if needed."*
5. For **SS1 General Mathematics 2nd term**, typical topics include: further algebra, simultaneous equations, quadratic equations, variation, logical reasoning, mensuration extensions, etc. — be thorough and week-by-week.

If ACCOUNT DATA has matching subjects/classes, mention alignment; if not, still deliver the full scheme.

## Lesson notes
Structure: Topic, Class, Duration, Objectives, Previous Knowledge, Materials, Presentation, Evaluation, Homework, Reference. Nigerian classroom style.

## EduPulse app help
Explain modules when asked (Attendance, Grades, Fees, Interventions, etc.) using platformGuide in ACCOUNT DATA when present.

## Style
- Helpful, thorough, ChatGPT-quality — not overly brief unless user wants short.
- Use markdown: **headings**, tables, bullet lists.
- Address user by name when natural.
- For factual school data you lack, say what's missing and still help with general/educational content.`;

function intentHint(intent: ChatIntent | undefined, userMessage: string): string {
  const q = userMessage.toLowerCase();
  switch (intent) {
    case "lesson_note":
      return "Draft a complete LESSON NOTE / LESSON PLAN. Be thorough.";
    case "timetable":
      if (/ss|jss|general maths|mathematics|term|scheme|syllabus|weekly/.test(q)) {
        return "Generate a FULL term scheme of work / weekly topic timetable for the requested Nigerian class, subject, and term. Use a markdown table. Do NOT refuse — this is general curriculum content, not school DB lookup.";
      }
      return "If school period timetable: use teachingLoad from ACCOUNT DATA. If subject/term scheme: generate full weekly topics table.";
    case "curriculum":
      return "Explain curriculum topics, syllabus, or schemes for the requested level/subject. Generate complete content; supplement with ACCOUNT DATA if available.";
    case "fees":
      return "Use ACCOUNT DATA for fee amounts. Explain Monnify/parent payment for general fee questions.";
    case "platform_help":
      return "Explain EduPulse features clearly.";
    default:
      return "Answer like ChatGPT — fully, accurately, and helpfully. Use ACCOUNT DATA only for specific school record facts (names, counts, dates).";
  }
}

function tokensForIntent(intent: ChatIntent | undefined, userMessage: string): number {
  const q = userMessage.toLowerCase();
  if (intent === "lesson_note") return 2500;
  if (intent === "timetable" && /ss|jss|term|maths|scheme/.test(q)) return 2800;
  if (intent === "curriculum") return 2000;
  if (intent === "general") return 1800;
  return 1200;
}

function modelForIntent(intent: ChatIntent | undefined): string {
  if (intent === "platform_help") return "llama-3.1-8b-instant";
  return "llama-3.3-70b-versatile";
}

type StaffRole = "admin" | "principal" | "teacher" | "counselor" | "finance" | "bursar";
type ChatIntent = "lesson_note" | "timetable" | "curriculum" | "fees" | "platform_help" | "general";

interface ChatRequestBody {
  userMessage?: string;
  userRole?: string;
  userName?: string;
  schoolId?: string;
  userId?: string;
  staffId?: string;
  children?: Array<{ id: string; firstName: string; lastName: string; className?: string }>;
  conversationHistory?: Array<{ role: string; content: string }>;
  accountContext?: Record<string, unknown>;
  intent?: ChatIntent;
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
      conversationHistory = [],
      accountContext,
      intent,
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

    const resolvedName = identity.userName ?? userName;
    const accountData =
      accountContext &&
      typeof accountContext === "object" &&
      accountContext.schoolId === schoolId
        ? accountContext
        : {
            userName: resolvedName,
            role: userRole,
            schoolId,
            generatedAt: new Date().toISOString(),
            data: {},
          };

    const roleHints: Record<string, string> = {
      admin: "User is school admin — operations, staff, subscriptions, configuration.",
      teacher: "User is a teacher — classes, lesson notes, attendance, grades, assignments.",
      principal: "User is principal — school-wide oversight, risk, interventions, leadership.",
      counselor: "User is counselor — intervention cases, student wellbeing, follow-ups.",
      finance: "User handles finance — fees, payments, Monnify virtual accounts, reconciliation.",
      parent: "User is a parent — their children's attendance, grades, fees, behaviour updates.",
    };

    const systemPrompt = `You are the EduPulse Assistant speaking with ${resolvedName} (${userRole}).

${BASE_CAPABILITIES}

Role focus: ${roleHints[userRole] || roleHints.teacher}

Task hint: ${intentHint(intent, userMessage.trim())}

ACCOUNT DATA (live from EduPulse — source of truth for school facts):
${JSON.stringify(accountData, null, 2)}`;

    const historyMessages = conversationHistory
      .filter((m) => m.content && (m.role === "user" || m.role === "assistant"))
      .slice(-10)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const model = modelForIntent(intent);

    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: userMessage.trim() },
      ],
      temperature: intent === "lesson_note" || intent === "timetable" || intent === "general" ? 0.7 : 0.55,
      max_tokens: tokensForIntent(intent, userMessage.trim()),
    });

    const message = completion.choices[0].message.content || "";

    return jsonResponse(req, { message, model, intent: intent ?? "general" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Chat Error:", errorMessage);
    return jsonResponse(req, { error: errorMessage || "Unknown error" }, 500);
  }
});
