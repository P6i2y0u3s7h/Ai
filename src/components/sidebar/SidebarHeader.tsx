import React from 'react';
import { Search, PanelLeft } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { AiLogo } from '../common/LumoraLogo';

interface SidebarHeaderProps {
  isCollapsed?: boolean;
  onToggleCollapse: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  onToggleCollapse,
}) => {
  const { setActiveModal } = useChat();

  return (
    <div className="h-14 flex items-center justify-between border-b border-[#262626] px-3.5 bg-[#0A0A0A] flex-shrink-0 select-none">
      {/* Ai Brand Logo & Wordmark */}
      <AiLogo size="sm" showWordmark={true} />

      {/* Header Action Buttons (Search & ChatGPT-style Close Sidebar Toggle) */}
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

        <button
          type="button"
          onClick={onToggleCollapse}
          title="Close sidebar (Ctrl+B)"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C] transition-colors"
          aria-label="Close sidebar"
        >
          <PanelLeft size={18} />
        </button>
      </div>
    </div>
  );
};
