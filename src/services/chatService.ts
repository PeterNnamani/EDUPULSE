import { supabase } from '@/lib/supabase';
import {
  buildChatAccountContext,
  answerFromAccountContext,
  detectChatIntent,
  type ChatAccountContext,
  type ChatIntent,
} from '@/services/chatContextService';
import { invokeGroqDirect } from '@/services/groqChatFallback';
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
  intent?: ChatIntent;
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

    const intent = detectChatIntent(userMessage);

    const factualAnswer = answerFromAccountContext(userMessage, accountContext);
    if (factualAnswer) {
      await logChatMessage(userMessage, factualAnswer, context.userId);
      return { message: factualAnswer, context: { source: 'database' }, intent };
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
        conversationHistory: context.conversationHistory?.slice(-10) ?? [],
        accountContext,
        intent,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    const message = data?.message ?? '';
    await logChatMessage(userMessage, message, context.userId);

    return {
      message,
      context: { model: data?.model ?? 'groq' },
      intent,
    };
  } catch (error) {
    console.error('Error in sendChatMessage:', error);

    if (accountContext) {
      try {
        const intent = detectChatIntent(userMessage);
        const direct = await invokeGroqDirect({
          userMessage,
          userRole: context.userRole,
          userName: context.userName,
          intent,
          accountContext,
          conversationHistory: context.conversationHistory,
        });
        await logChatMessage(userMessage, direct.message, context.userId);
        return { message: direct.message, context: { model: direct.model }, intent };
      } catch (directError) {
        console.error('Groq direct fallback failed:', directError);
      }

      const local = answerFromAccountContext(userMessage, accountContext);
      if (local) {
        await logChatMessage(userMessage, local, context.userId);
        return { message: local };
      }
    }

    return {
      message:
        'I could not reach the assistant service right now. I can still help with curriculum, timetable, attendance, staff, students, classes, fees, assignments, interventions, lesson note drafts, and EduPulse navigation — try a specific question.',
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
