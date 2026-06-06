import Groq from "npm:groq-sdk@0.5.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const {
            userMessage,
            userRole = "teacher",
            userName = "there",
            accountData,
            conversationHistory = [],
        } = body;

        const apiKey = Deno.env.get("GROQ_API_KEY");
        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: "Groq API key not configured" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
            );
        }

        const roleHints: Record<string, string> = {
            admin: "Focus on school operations, subscriptions, staff, and oversight.",
            teacher: "Focus on classes, attendance, grades, assignments, lesson notes, and students needing attention.",
            principal: "Focus on leadership, risk oversight, interventions, and school-wide trends.",
            counselor: "Focus on intervention cases, student wellbeing, and follow-up actions.",
            finance: "Focus on fees, payments, and financial records.",
            parent: "Focus on their children's attendance, behaviour, and school updates.",
        };

        const accountJson = accountData
            ? JSON.stringify(accountData, null, 2)
            : "No live account data available.";

        const systemPrompt = `You are the EduPulse Assistant speaking with ${userName} (${userRole}).

${BASE_CAPABILITIES}

Role focus: ${roleHints[userRole] || roleHints.teacher}

ACCOUNT DATA (live from database — treat as source of truth):
${accountJson}`;

        const historyMessages = (conversationHistory as Array<{ role: string; content: string }>)
            .filter((m) => m.content && (m.role === "user" || m.role === "assistant"))
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: systemPrompt },
                ...historyMessages,
                { role: "user", content: userMessage },
            ],
            temperature: 0.5,
            max_tokens: 700,
        });

        const message = completion.choices[0].message.content || "";

        return new Response(
            JSON.stringify({ message, model: "llama-3.1-8b-instant" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Chat Error:", errorMessage);
        return new Response(
            JSON.stringify({ error: errorMessage || "Unknown error" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});
