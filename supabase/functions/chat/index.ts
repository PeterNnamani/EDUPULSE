import Groq from "npm:groq-sdk@0.5.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const groq = new Groq({
    apiKey: Deno.env.get("GROQ_API_KEY"),
});

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { userMessage, userRole } = await req.json();

        // Check if API key exists
        const apiKey = Deno.env.get("GROQ_API_KEY");
        if (!apiKey) {
            console.error("GROQ_API_KEY is not set in Supabase secrets");
            return new Response(
                JSON.stringify({ error: "Groq API key not configured" }),
                {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 500,
                }
            );
        }

        const rolePrompts: Record<string, string> = {
            admin: "You are an educational assistant helping a school administrator manage students, staff, and subscriptions. Provide helpful, concise guidance.",
            teacher: "You are an assistant helping a teacher manage attendance, grades, assignments, and student behavior. Give practical advice.",
            principal: "You are an assistant for school principals managing operations, staff, and academic performance.",
            counselor: "You are a school counselor assistant helping with student wellbeing and intervention tracking.",
            finance: "You are an assistant for finance staff managing fees and budgets.",
            parent: "You are a helpful assistant for parents tracking their child's progress and communication with school.",
        };

        const systemPrompt = rolePrompts[userRole] || rolePrompts.teacher;

        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            temperature: 0.7,
            max_tokens: 500,
        });

        const message = completion.choices[0].message.content || "";

        return new Response(
            JSON.stringify({ message }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Chat Error:", errorMessage);
        return new Response(
            JSON.stringify({ error: errorMessage || "Unknown error" }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500,
            }
        );
    }
});
