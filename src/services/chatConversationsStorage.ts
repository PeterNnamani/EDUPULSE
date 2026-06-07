import type { ChatMessage } from '@/types';

export const EDUBOT_NAME = 'Edubot';
export const EDUBOT_TAGLINE = 'EduPulse AI';

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: StoredChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_PREFIX = 'edupulse_edubot_conversations_';

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadConversations(userId: string): ChatConversation[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatConversation[];
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      : [];
  } catch {
    return [];
  }
}

export function saveConversations(userId: string, conversations: ChatConversation[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(conversations));
  } catch (e) {
    console.warn('Could not save chat conversations', e);
  }
}

export function createConversation(title = 'New chat'): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function titleFromMessage(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New chat';
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
}

export function toStoredMessage(message: ChatMessage): StoredChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp:
      message.timestamp instanceof Date
        ? message.timestamp.toISOString()
        : new Date(message.timestamp).toISOString(),
  };
}

export function fromStoredMessage(stored: StoredChatMessage): ChatMessage {
  return {
    id: stored.id,
    role: stored.role,
    content: stored.content,
    timestamp: new Date(stored.timestamp),
  };
}

export function lastPreview(conversation: ChatConversation): string {
  const last = conversation.messages[conversation.messages.length - 1];
  if (!last) return 'No messages yet';
  const prefix = last.role === 'user' ? 'You: ' : `${EDUBOT_NAME}: `;
  const text = last.content.replace(/\s+/g, ' ').trim();
  const snippet = text.length > 56 ? `${text.slice(0, 56)}…` : text;
  return `${prefix}${snippet}`;
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
