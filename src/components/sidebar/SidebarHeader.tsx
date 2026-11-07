import React from 'react';
import { Search } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { AiLogo } from '../common/LumoraLogo';

interface SidebarHeaderProps {
  isCollapsed: boolean;
  onToggleCollapse?: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  isCollapsed,
  onToggleCollapse,
}) => {
  const { setActiveModal } = useChat();

  return (
    <div
      className={`h-14 flex items-center border-b border-[#262626] transition-all px-3.5 bg-[#0A0A0A] ${
        isCollapsed ? 'justify-center' : 'justify-between'
      }`}
    >
      {/* Ai Brand Logo & Wordmark */}
      <div
        className={isCollapsed ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
        onClick={() => {
          if (isCollapsed && onToggleCollapse) {
            onToggleCollapse();
          }
        }}
        title={isCollapsed ? 'Expand sidebar' : undefined}
      >
        <AiLogo size="sm" showWordmark={!isCollapsed} />
      </div>

      {/* Header Action Buttons */}
      {!isCollapsed && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveModal('search')}
            title="Search chats (Ctrl+K)"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C] transition-colors"
            aria-label="Search conversations"
          >
            <Search size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
