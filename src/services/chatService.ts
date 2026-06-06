import { supabase } from '@/lib/supabase';
import {
  buildChatAccountContext,
  answerFromAccountContext,
  type ChatAccountContext,
} from '@/services/chatContextService';
import type { UserRole } from '@/types';

interface ChatContext {
  userId: string;
  userRole: UserRole;
  userName: string;
  schoolId: string;
  staffId?: string;
  children?: Array<{ id: string; firstName: string; lastName: string; className?: string }>;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface ChatResponse {
  message: string;
  context?: Record<string, unknown>;
  shouldRefresh?: boolean;
}

export async function sendChatMessage(
  userMessage: string,
  context: ChatContext
): Promise<ChatResponse> {
  let accountContext: ChatAccountContext | null = null;

  try {
    accountContext = await buildChatAccountContext({
      schoolId: context.schoolId,
      userId: context.userId,
      role: context.userRole,
      userName: context.userName,
      staffId: context.staffId,
      children: context.children,
    });

    const factualAnswer = answerFromAccountContext(userMessage, accountContext);
    if (factualAnswer) {
      await logChatMessage(userMessage, factualAnswer, context.userId);
      return { message: factualAnswer, context: { source: 'database' } };
    }

    const { data, error } = await supabase.functions.invoke('chat', {
      body: {
        userMessage,
        userRole: context.userRole,
        userName: context.userName,
        schoolId: context.schoolId,
        userId: context.userId,
        staffId: context.staffId,
        children: context.children,
        conversationHistory: context.conversationHistory?.slice(-8) ?? [],
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    const message = data?.message ?? '';
    await logChatMessage(userMessage, message, context.userId);

    return {
      message,
      context: { model: data?.model ?? 'groq' },
    };
  } catch (error) {
    console.error('Error in sendChatMessage:', error);

    if (accountContext) {
      const local = answerFromAccountContext(userMessage, accountContext);
      if (local) {
        await logChatMessage(userMessage, local, context.userId);
        return { message: local };
      }
    }

    return {
      message:
        'I could not reach the assistant service right now. I can answer factual questions from your school data — staff, students, classes, attendance, assignments, interventions, and risk flags.',
    };
  }
}

async function logChatMessage(userMessage: string, response: string, userId: string) {
  try {
    await supabase.from('chat_logs').insert({
      user_id: userId,
      user_message: userMessage,
      bot_response: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log chat message:', error);
  }
}
