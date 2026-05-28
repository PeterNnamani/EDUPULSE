import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { ChatMessage } from '@/types';

interface ChatContextType {
    messages: ChatMessage[];
    addMessage: (message: ChatMessage) => void;
    clearMessages: () => void;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    hasNewMessage: boolean;
    setHasNewMessage: (hasNew: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
    children: ReactNode;
}

/**
 * ChatProvider - Global context for managing chat state across the application
 * Optional: Use this if you want more advanced state management
 * 
 * Usage:
 * 1. Wrap your app with <ChatProvider>
 * 2. Use useChat() hook in any component
 * 
 * Example:
 * const { messages, addMessage } = useChat();
 */
export function ChatProvider({ children }: ChatProviderProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [hasNewMessage, setHasNewMessage] = useState(false);

    const addMessage = (message: ChatMessage) => {
        setMessages((prev) => [...prev, message]);
        if (message.role === 'assistant' && !isOpen) {
            setHasNewMessage(true);
        }
    };

    const clearMessages = () => {
        setMessages([]);
    };

    return (
        <ChatContext.Provider
            value={{
                messages,
                addMessage,
                clearMessages,
                isOpen,
                setIsOpen,
                hasNewMessage,
                setHasNewMessage,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
}

/**
 * Hook to use Chat context
 * Usage: const { messages, addMessage } = useChat();
 */
export function useChat() {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within ChatProvider');
    }
    return context;
}
