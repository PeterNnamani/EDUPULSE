import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send } from 'lucide-react';
import { useAppStore } from '@/store';
import { sendChatMessage } from '@/services/chatService';
import type { ChatMessage } from '@/types';

interface ChatBotProps {
    onOpenChange?: (open: boolean) => void;
}

export default function ChatBot({ onOpenChange }: ChatBotProps) {
    const { user, isAuthenticated } = useAppStore();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || !user) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await sendChatMessage(inputValue, {
                userId: user.id,
                userRole: user.role,
                userName: user.fullName || user.name || 'User',
                schoolId: user.schoolId,
                staffId: user.staffId ?? user.id,
                children: user.children?.map((c) => ({
                    id: c.id,
                    firstName: c.firstName,
                    lastName: c.lastName,
                    className: c.className,
                })),
                conversationHistory: messages.map((m) => ({
                    role: m.role,
                    content: m.content,
                })),
            });

            const botMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.message,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, botMessage]);
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="fixed bottom-6 right-6 z-40">
            <AnimatePresence mode="wait">
                {isOpen ? (
                    <motion.div
                        key="chat-window"
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="absolute bottom-0 right-0 w-96 h-[600px] bg-white dark:bg-dark-card rounded-2xl shadow-2xl dark:shadow-dark-elevated flex flex-col border border-border dark:border-dark-border overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-slate-700 dark:to-slate-800 text-white p-4 flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">EduPulse Assistant</h3>
                                <p className="text-sm text-blue-100">Always here to help</p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onOpenChange?.(false);
                                }}
                                className="p-1 hover:bg-blue-700 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center">
                                    <MessageCircle className="w-12 h-12 text-gray-300 dark:text-dark-icon mb-3" />
                                    <p className="text-gray-500 dark:text-dark-muted text-sm leading-relaxed">
                                        Hello, {(user?.fullName || user?.name || 'there').trim()}! Ask about your classes, activities, lesson notes, or any data in your account.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {messages.map((message) => (
                                        <motion.div
                                            key={message.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-xs px-4 py-2 rounded-lg ${message.role === 'user'
                                                        ? 'bg-blue-600 text-white rounded-br-none'
                                                        : 'bg-gray-200 dark:bg-dark-elevated text-gray-900 dark:text-dark-text rounded-bl-none'
                                                    }`}
                                            >
                                                <p className="text-sm">{message.content}</p>
                                                <span className="text-xs opacity-70 block mt-1">
                                                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </motion.div>
                                    ))}
                                    {isLoading && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex justify-start"
                                        >
                                            <div className="bg-gray-200 dark:bg-dark-elevated px-4 py-3 rounded-lg rounded-bl-none">
                                                <div className="flex space-x-2">
                                                    <div className="w-2 h-2 bg-gray-600 dark:bg-dark-muted rounded-full animate-bounce" />
                                                    <div className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                                    <div className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSendMessage} className="border-t border-border dark:border-dark-border p-4 bg-gray-50 dark:bg-darker-bg">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Ask me something..."
                                    className="flex-1 px-3 py-2 bg-white dark:bg-dark-bg border border-border dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:text-dark-text"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim() || isLoading}
                                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </form>
                    </motion.div>
                ) : null}
            </AnimatePresence>

            {/* Chat Bubble */}
            <motion.button
                onClick={() => {
                    setIsOpen(true);
                    onOpenChange?.(true);
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 dark:from-slate-600 dark:to-slate-700 text-white rounded-full shadow-lg dark:shadow-dark-card hover:shadow-xl transition-shadow flex items-center justify-center hover:from-blue-700 hover:to-blue-800 dark:hover:from-slate-500 dark:hover:to-slate-600"
            >
                <MessageCircle className="w-6 h-6" />
            </motion.button>
        </div>
    );
}
