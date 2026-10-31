import React from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';
import { Message } from '../../types/chat';

interface UserMessageProps {
  message: Message;
}

export const UserMessage: React.FC<UserMessageProps> = ({ message }) => {
  return (
    <div className="flex justify-end my-4 select-text">
      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl bg-[#1C1C1C] border border-[#262626] text-[#FFFFFF] px-4 py-2.5 sm:px-5 sm:py-3 shadow-sm">
        {/* Render Attachments if any */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 pb-2 border-b border-[#262626]">
            {message.attachments.map(att => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141414] text-xs text-zinc-300 border border-[#262626]"
              >
                {att.type === 'pdf' ? (
                  <FileText size={13} className="text-white" />
                ) : (
                  <ImageIcon size={13} className="text-[#A1A1AA]" />
                )}
                <span className="truncate max-w-[140px] font-mono text-[11px]">{att.name}</span>
                <span className="text-[#71717A] text-[10px]">({att.size})</span>
              </div>
            ))}
          </div>
        )}

        {/* Message Content */}
        <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap break-words font-normal">
          {message.content}
        </p>
      </div>
    </div>
  );
};
