import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { WelcomeScreen } from './WelcomeScreen';
import { useChat } from '../../context/ChatContext';

export const MessageList: React.FC = () => {
  const { activeConversation, isStreaming } = useChat();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);

  const messages = activeConversation?.messages || [];

  // Check scroll position to avoid hijacking user scroll when reading older messages
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const near = distanceFromBottom < 120;
    setIsNearBottom(near);
    setShowScrollBottomButton(distanceFromBottom > 240);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior
      });
    }
  };

  // Scroll down when new messages are added or streaming updates, if user was already near bottom
  useEffect(() => {
    if (isNearBottom) {
      scrollToBottom(isStreaming ? 'auto' : 'smooth');
    }
  }, [messages, isStreaming, isNearBottom]);

  // When changing conversation, scroll to bottom
  useEffect(() => {
    scrollToBottom('auto');
    setIsNearBottom(true);
  }, [activeConversation?.id]);

  if (messages.length === 0) {
    return (
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 flex flex-col justify-center"
      >
        <WelcomeScreen />
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 relative"
    >
      {/* Centered Conversation Column (max 800px) */}
      <div className="w-full max-w-[800px] mx-auto py-4">
        {messages.map(message => (
          <React.Fragment key={message.id}>
            {message.role === 'user' ? (
              <UserMessage message={message} />
            ) : (
              <AssistantMessage message={message} />
            )}
          </React.Fragment>
        ))}

        <div ref={messagesEndRef} className="h-10 sm:h-6" />
      </div>

      {/* Floating scroll to bottom button */}
      {showScrollBottomButton && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-3 right-3 sm:right-6 z-20 p-2 rounded-full bg-[#27272A] hover:bg-[#323236] text-white shadow-xl border border-[#3A3A40] transition-all transform hover:scale-105"
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <ArrowDown size={17} />
        </button>
      )}
    </div>
  );
};
