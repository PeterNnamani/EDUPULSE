import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUp, ChevronLeft, MessageSquarePlus } from 'lucide-react';
import { useAppStore } from '@/store';
import { sendChatMessage } from '@/services/chatService';
import type { ChatMessage, UserRole } from '@/types';
import {
  loadConversations,
  saveConversations,
  createConversation,
  titleFromMessage,
  toStoredMessage,
  fromStoredMessage,
  EDUBOT_NAME,
  EDUBOT_TAGLINE,
  type ChatConversation,
} from '@/services/chatConversationsStorage';
import ChatMessageContent from './ChatMessageContent';
import EduPulseChatIcon from './EduPulseChatIcon';
import EdubotAvatar from './EdubotAvatar';
import ChatListPanel from './ChatListPanel';

interface ChatBotProps {
  onOpenChange?: (open: boolean) => void;
}

type PanelView = 'list' | 'conversation';

const QUICK_PROMPTS: Record<UserRole | 'default', string[]> = {
  admin: [
    'School overview',
    'List all subjects in our curriculum',
    'How many staff do we have?',
    "Today's attendance summary",
    'How do I set up fees?',
  ],
  principal: [
    'School overview',
    'Students at risk',
    'Open intervention cases',
    'Show teaching timetable',
    'How does risk analysis work?',
  ],
  teacher: [
    'General Maths SS1 2nd term timetable',
    'Draft a lesson note for JSS2 English',
    'My teaching timetable',
    'Explain quadratic equations simply',
    'How do I record attendance?',
  ],
  counselor: ['My open cases', 'High risk students', 'How do I create an intervention?', 'School overview'],
  finance: [
    'List fee structures',
    'How do Monnify virtual accounts work?',
    'Pending payments',
    'School overview',
  ],
  parent: [
    'Tell me about my children',
    'How do I pay school fees?',
    'What is EduPulse?',
    'How can I see grades?',
  ],
  default: ['What can you help me with?', 'School overview', 'Show curriculum subjects'],
};

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 dark:bg-neutral-500"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export default function ChatBot({ onOpenChange }: ChatBotProps) {
  const { user, isAuthenticated } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>('list');
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const quickPrompts = useMemo(() => {
    const role = user?.role ?? 'default';
    return QUICK_PROMPTS[role] ?? QUICK_PROMPTS.default;
  }, [user?.role]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const messages: ChatMessage[] = useMemo(
    () => activeConversation?.messages.map(fromStoredMessage) ?? [],
    [activeConversation]
  );

  const persist = useCallback(
    (next: ChatConversation[]) => {
      const sorted = [...next].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setConversations(sorted);
      if (user?.id) saveConversations(user.id, sorted);
    },
    [user?.id]
  );

  useEffect(() => {
    if (user?.id) {
      setConversations(loadConversations(user.id));
    }
  }, [user?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (panelView === 'conversation') scrollToBottom();
  }, [messages, isLoading, panelView]);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const toggleChat = useCallback(() => {
    if (isOpen) {
      closeChat();
    } else {
      setIsOpen(true);
      setPanelView('list');
      onOpenChange?.(true);
    }
  }, [isOpen, closeChat, onOpenChange]);

  const startNewChat = useCallback(() => {
    const conv = createConversation();
    persist([conv, ...conversations]);
    setActiveConversationId(conv.id);
    setPanelView('conversation');
    setInputValue('');
  }, [conversations, persist]);

  const openConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setPanelView('conversation');
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      const next = conversations.filter((c) => c.id !== id);
      persist(next);
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setPanelView('list');
      }
    },
    [conversations, persist, activeConversationId]
  );

  const updateConversationMessages = useCallback(
    (conversationId: string, nextMessages: ChatMessage[], title?: string) => {
      const now = new Date().toISOString();
      const stored = nextMessages.map(toStoredMessage);

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conversationId);
        let next: ChatConversation[];

        if (exists) {
          next = prev.map((c) =>
            c.id === conversationId
              ? { ...c, messages: stored, title: title ?? c.title, updatedAt: now }
              : c
          );
        } else {
          next = [
            {
              id: conversationId,
              title: title ?? 'New chat',
              messages: stored,
              createdAt: now,
              updatedAt: now,
            },
            ...prev,
          ];
        }

        const sorted = [...next].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        if (user?.id) saveConversations(user.id, sorted);
        return sorted;
      });
    },
    [user?.id]
  );

  const submitMessage = async (text: string) => {
    if (!text.trim() || !user || isLoading) return;

    let conversationId = activeConversationId;
    let historyAsChat: ChatMessage[] = [];

    if (conversationId) {
      historyAsChat = (conversations.find((c) => c.id === conversationId)?.messages ?? []).map(
        fromStoredMessage
      );
    } else {
      const conv = createConversation(titleFromMessage(text));
      conversationId = conv.id;
      persist([conv, ...conversations]);
      setActiveConversationId(conv.id);
      setPanelView('conversation');
      historyAsChat = [];
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    const withUser = [...historyAsChat, userMessage];
    const isFirstMessage = historyAsChat.length === 0;

    updateConversationMessages(
      conversationId,
      withUser,
      isFirstMessage ? titleFromMessage(text) : undefined
    );

    setInputValue('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage(text.trim(), {
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
        conversationHistory: historyAsChat.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      updateConversationMessages(conversationId, [
        ...withUser,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
      updateConversationMessages(conversationId, [
        ...withUser,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage(inputValue);
  };

  if (!isAuthenticated) return null;

  const displayName = (user?.fullName || user?.name || 'there').trim();
  const firstName = displayName.split(/\s+/)[0] || displayName;
  const headerTitle = activeConversation?.title ?? 'New chat';

  return (
    <>
      {/* Backdrop — tap outside to close */}
      <AnimatePresence>
        {isOpen && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[39] cursor-default bg-black/25 backdrop-blur-[2px] dark:bg-black/50"
            onClick={closeChat}
            aria-label="Close chat"
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 right-6 z-40">
        <AnimatePresence mode="wait">
          {isOpen && (
            <motion.div
              ref={panelRef}
              key="chat-window"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 right-0 flex h-[min(88vh,680px)] w-[min(100vw-1.5rem,22rem)] flex-col overflow-hidden rounded-[1.35rem] border border-neutral-200/90 bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.22)] dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] sm:w-[min(100vw-1.5rem,28rem)]"
            >
              {/* Header */}
              <div className="flex shrink-0 items-center gap-2 border-b border-neutral-100 bg-white px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-950">
                {panelView === 'conversation' ? (
                  <button
                    type="button"
                    onClick={() => setPanelView('list')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white"
                    aria-label="Back to chats"
                  >
                    <ChevronLeft className="h-5 w-5" strokeWidth={2} />
                  </button>
                ) : (
                  <div className="w-1 shrink-0" />
                )}

                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <EdubotAvatar size="sm" showOnline={panelView === 'list'} />
                  <div className="min-w-0 flex-1">
                    {panelView === 'list' ? (
                      <>
                        <p className="truncate text-[14px] font-semibold leading-tight text-neutral-900 dark:text-white">
                          {EDUBOT_NAME}
                        </p>
                        <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                          {EDUBOT_TAGLINE}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="truncate text-[13px] font-semibold leading-tight text-neutral-900 dark:text-white">
                          {headerTitle}
                        </p>
                        <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                          {EDUBOT_NAME}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {panelView === 'list' ? (
                  <button
                    type="button"
                    onClick={startNewChat}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white"
                    aria-label="New chat"
                  >
                    <MessageSquarePlus className="h-[18px] w-[18px]" strokeWidth={2} />
                  </button>
                ) : (
                  <div className="w-9 shrink-0" />
                )}

                <button
                  type="button"
                  onClick={closeChat}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-white"
                  aria-label="Close chat"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>
              </div>

              {/* Body */}
              {panelView === 'list' ? (
                <div className="min-h-0 flex-1 bg-[#fafafa] dark:bg-neutral-950/50">
                  <ChatListPanel
                    conversations={conversations}
                    activeId={activeConversationId}
                    onSelect={openConversation}
                    onNewChat={startNewChat}
                    onDelete={deleteConversation}
                  />
                </div>
              ) : (
                <>
                  <div className="min-h-0 flex-1 overflow-y-auto bg-[#fafafa] px-4 py-5 dark:bg-neutral-950/50">
                    {messages.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center px-1 text-center">
                        <EdubotAvatar size="lg" className="mb-4" />
                        <p className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">
                          Hi, {firstName}
                        </p>
                        <p className="mt-2 max-w-[240px] text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                          {EDUBOT_NAME} can help with your school, curriculum, timetables, and more.
                        </p>
                        <div className="mt-6 flex w-full flex-wrap justify-center gap-2">
                          {quickPrompts.map((prompt) => (
                            <button
                              key={prompt}
                              type="button"
                              onClick={() => submitMessage(prompt)}
                              disabled={isLoading}
                              className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-700 transition-all hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-white dark:hover:text-white"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((message) => (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex gap-2.5 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                          >
                            {message.role === 'user' ? (
                              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold uppercase text-white dark:bg-white dark:text-neutral-900">
                                {firstName.charAt(0)}
                              </div>
                            ) : (
                              <EdubotAvatar size="xs" className="mt-0.5" />
                            )}

                            <div
                              className={`flex max-w-[82%] flex-col ${
                                message.role === 'user' ? 'items-end' : 'items-start'
                              }`}
                            >
                              <div
                                className={`px-3.5 py-2.5 ${
                                  message.role === 'user'
                                    ? 'rounded-2xl rounded-tr-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                                    : 'rounded-2xl rounded-tl-md border border-neutral-200/80 bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100'
                                }`}
                              >
                                {message.role === 'assistant' ? (
                                  <ChatMessageContent content={message.content} />
                                ) : (
                                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{message.content}</p>
                                )}
                              </div>
                              <span className="mt-1 px-1 text-[10px] text-neutral-400 dark:text-neutral-500">
                                {message.timestamp.toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </motion.div>
                        ))}

                        {isLoading && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                            <EdubotAvatar size="xs" className="mt-0.5" />
                            <div className="rounded-2xl rounded-tl-md border border-neutral-200/80 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                              <TypingIndicator />
                            </div>
                          </motion.div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  {messages.length > 0 && !isLoading && (
                    <div className="flex shrink-0 gap-1.5 overflow-x-auto bg-[#fafafa] px-4 pb-2 dark:bg-neutral-950/50">
                      {quickPrompts.slice(0, 3).map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => submitMessage(prompt)}
                          className="whitespace-nowrap rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-medium text-neutral-600 transition-colors hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-white"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}

                  <form
                    onSubmit={handleSendMessage}
                    className="shrink-0 border-t border-neutral-100 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <div className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-1.5 pl-3.5 transition-colors focus-within:border-neutral-900 focus-within:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:focus-within:border-neutral-500 dark:focus-within:bg-neutral-950">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={`Message ${EDUBOT_NAME}…`}
                        className="min-h-[40px] flex-1 bg-transparent py-2 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-white dark:placeholder:text-neutral-500"
                      />
                      <button
                        type="submit"
                        disabled={!inputValue.trim() || isLoading}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                        aria-label="Send message"
                      >
                        <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB — tap again to close */}
        <motion.button
          type="button"
          onClick={toggleChat}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="group relative flex h-[3.75rem] w-[3.75rem] items-center justify-center"
          aria-label={isOpen ? 'Close chat' : `Open ${EDUBOT_NAME}`}
          aria-expanded={isOpen}
        >
          {!isOpen && (
            <span className="absolute inset-0 animate-ping rounded-full bg-neutral-900/10 opacity-75 [animation-duration:2.5s] group-hover:opacity-0 dark:bg-white/10" />
          )}
          <span
            className={`relative flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.2)] ring-1 transition-all ${
              isOpen
                ? 'bg-neutral-800 text-white ring-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:ring-neutral-600'
                : 'bg-neutral-950 text-white ring-neutral-900/10 hover:shadow-[0_12px_40px_rgba(0,0,0,0.28)] dark:bg-white dark:text-neutral-950 dark:ring-white/20'
            }`}
          >
            {isOpen ? (
              <X className="h-6 w-6" strokeWidth={2} />
            ) : (
              <EduPulseChatIcon variant="fab" className="h-7 w-7" />
            )}
          </span>
        </motion.button>
      </div>
    </>
  );
}
