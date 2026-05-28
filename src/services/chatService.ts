import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/types';

interface ChatContext {
    userId: string;
    userRole: string;
    sessionData?: Record<string, any>;
}

interface ChatResponse {
    message: string;
    context?: Record<string, any>;
    shouldRefresh?: boolean;
}

export async function sendChatMessage(
    userMessage: string,
    context: ChatContext
): Promise<ChatResponse> {
    try {
        // Call Supabase Edge Function instead of OpenAI directly
        const { data, error } = await supabase.functions.invoke('chat', {
            body: {
                userMessage,
                userRole: context.userRole,
            },
        });

        if (error) throw error;

        await logChatMessage(userMessage, data.message, context.userId);

        return {
            message: data.message,
            context: {
                model: 'gpt-4-turbo',
            },
        };
    } catch (error) {
        console.error('Error in sendChatMessage:', error);
        return {
            message: 'I encountered an error processing your request. Please try again.',
        };
    }
}

async function logChatMessage(userMessage: string, response: string, userId: string) {
    try {
        await supabase
            .from('chat_logs')
            .insert({
                user_id: userId,
                user_message: userMessage,
                bot_response: response,
                timestamp: new Date().toISOString(),
            });
    } catch (error) {
        console.error('Failed to log chat message:', error);
    }
}