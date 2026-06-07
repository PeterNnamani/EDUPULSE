import type { ChatAccountContext, ChatIntent } from '@/services/chatContextService';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function buildSystemPrompt(params: {
  userName: string;
  userRole: string;
  intent: ChatIntent;
  userMessage: string;
  accountContext: ChatAccountContext;
}): string {
  const { userName, userRole, intent, userMessage, accountContext } = params;
  const q = userMessage.toLowerCase();

  let taskHint =
    'Answer like ChatGPT — fully and helpfully. Use ACCOUNT DATA only for specific school record facts.';
  if (intent === 'timetable' && /ss|jss|general maths|mathematics|term|scheme/.test(q)) {
    taskHint =
      'Generate a FULL SS/JSS term scheme of work / weekly topic timetable as a markdown table. Nigerian NERDC curriculum. Do NOT refuse.';
  } else if (intent === 'lesson_note') {
    taskHint = 'Draft a complete Nigerian-style lesson note with objectives, presentation, evaluation, homework.';
  }

  return `You are EduPulse Assistant for ${userName} (${userRole}) — a ChatGPT-quality AI for schools in Nigeria.

You answer ALL questions: curriculum timetables (e.g. General Maths SS1 2nd term), lesson notes, explanations, writing, and general knowledge — not only school database lookups.

School record rule: NEVER invent student/staff names or counts — use ACCOUNT DATA for those only.

For subject/class/term timetables: provide week-by-week topics in a markdown table (10–13 weeks). Base on Nigerian curriculum standards.

Task: ${taskHint}

ACCOUNT DATA:
${JSON.stringify(accountContext, null, 2)}`;
}

function modelForIntent(intent: ChatIntent): string {
  return intent === 'platform_help' ? 'llama-3.1-8b-instant' : 'llama-3.3-70b-versatile';
}

function maxTokensForIntent(intent: ChatIntent, userMessage: string): number {
  const q = userMessage.toLowerCase();
  if (intent === 'timetable' && /ss|jss|term|maths/.test(q)) return 2800;
  if (intent === 'lesson_note') return 2500;
  if (intent === 'general') return 1800;
  return 1200;
}

export async function invokeGroqDirect(params: {
  userMessage: string;
  userRole: string;
  userName: string;
  intent: ChatIntent;
  accountContext: ChatAccountContext;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<{ message: string; model: string }> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (!apiKey?.trim()) {
    throw new Error('Groq API key not configured');
  }

  const systemPrompt = buildSystemPrompt({
    userName: params.userName,
    userRole: params.userRole,
    intent: params.intent,
    userMessage: params.userMessage,
    accountContext: params.accountContext,
  });

  const history = (params.conversationHistory ?? [])
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));

  const model = modelForIntent(params.intent);

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: params.userMessage.trim() },
      ],
      temperature: 0.7,
      max_tokens: maxTokensForIntent(params.intent, params.userMessage),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `Groq error ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const message = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!message) throw new Error('Empty response from Groq');

  return { message, model: `${model} (direct)` };
}
