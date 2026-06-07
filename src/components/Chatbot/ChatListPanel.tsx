import { MessageSquarePlus, Trash2 } from 'lucide-react';
import type { ChatConversation } from '@/services/chatConversationsStorage';
import {
  EDUBOT_NAME,
  EDUBOT_TAGLINE,
  formatRelativeTime,
  lastPreview,
} from '@/services/chatConversationsStorage';
import EdubotAvatar from './EdubotAvatar';

interface ChatListPanelProps {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
}

export default function ChatListPanel({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
}: ChatListPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {conversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <EdubotAvatar size="lg" className="mb-4 opacity-90" />
            <p className="text-[14px] font-semibold text-neutral-900 dark:text-white">No chats yet</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              Start a conversation with {EDUBOT_NAME} — lesson notes, timetables, school data, and more.
            </p>
            <button
              type="button"
              onClick={onNewChat}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <MessageSquarePlus className="h-4 w-4" />
              New chat
            </button>
          </div>
        ) : (
          <ul className="space-y-1">
            {conversations.map((conv) => {
              const isActive = conv.id === activeId;
              return (
                <li key={conv.id}>
                  <div
                    className={`group flex items-stretch gap-1 rounded-xl transition-colors ${
                      isActive
                        ? 'bg-neutral-100 dark:bg-neutral-900'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(conv.id)}
                      className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3 text-left"
                    >
                      <EdubotAvatar size="sm" className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[13px] font-semibold text-neutral-900 dark:text-white">
                            {conv.title}
                          </p>
                          <span className="shrink-0 text-[10px] text-neutral-400 dark:text-neutral-500">
                            {formatRelativeTime(conv.updatedAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                          {lastPreview(conv)}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(conv.id);
                      }}
                      className="mr-2 flex shrink-0 items-center self-center rounded-lg p-2 text-neutral-400 opacity-0 transition-all hover:bg-neutral-200 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-neutral-800 dark:hover:text-red-400"
                      aria-label="Delete chat"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {conversations.length > 0 && (
        <div className="shrink-0 border-t border-neutral-100 p-3 dark:border-neutral-800">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white py-2.5 text-[12px] font-medium text-neutral-800 transition-colors hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-500 dark:hover:text-white"
          >
            <MessageSquarePlus className="h-4 w-4" />
            New chat
          </button>
        </div>
      )}

      <p className="shrink-0 pb-3 text-center text-[10px] text-neutral-400 dark:text-neutral-600">
        {EDUBOT_NAME} · {EDUBOT_TAGLINE}
      </p>
    </div>
  );
}
