import React from 'react';
import { Pin, Clock, MessageSquareDashed } from 'lucide-react';
import { ConversationItem } from './ConversationItem';
import { useChat } from '../../context/ChatContext';

interface ConversationListProps {
  isCollapsed: boolean;
  filterQuery?: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  isCollapsed,
  filterQuery = '',
}) => {
  const { conversations, activeConversationId, selectConversation } = useChat();

  const filteredConversations = conversations.filter(conv => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    const titleMatch = conv.title.toLowerCase().includes(q);
    const contentMatch = conv.messages.some(m => m.content.toLowerCase().includes(q));
    return titleMatch || contentMatch;
  });

  const pinnedList = filteredConversations.filter(c => c.isPinned);
  const recentList = filteredConversations.filter(c => !c.isPinned);

  if (filteredConversations.length === 0) {
    if (isCollapsed) return null;
    return (
      <div className="px-4 py-8 text-center text-zinc-500 text-xs">
        <MessageSquareDashed size={24} className="mx-auto mb-2 opacity-50" />
        {filterQuery ? 'No matching conversations' : 'No chats yet'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pinned Section */}
      {pinnedList.length > 0 && (
        <div>
          {!isCollapsed && (
            <div className="px-3 pb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <Pin size={11} className="text-white" />
              <span>Pinned</span>
            </div>
          )}
          <div className="space-y-0.5">
            {pinnedList.map(conversation => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeConversationId}
                isCollapsed={isCollapsed}
                onSelect={() => selectConversation(conversation.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Section */}
      <div>
        {!isCollapsed && (
          <div className="px-3 pb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <Clock size={11} />
            <span>Recent</span>
          </div>
        )}
        <div className="space-y-0.5">
          {recentList.map(conversation => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === activeConversationId}
              isCollapsed={isCollapsed}
              onSelect={() => selectConversation(conversation.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
