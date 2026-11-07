import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  PanelLeftOpen,
  Share2,
  MoreVertical,
  Trash2,
  Settings,
  BookOpen,
  Check,
  GraduationCap
} from 'lucide-react';
import { StudyModeSelector } from './StudyModeSelector';
import { useChat } from '../../context/ChatContext';

export const ChatHeader: React.FC = () => {
  const {
    activeConversation,
    sidebarCollapsed,
    setSidebarCollapsed,
    setMobileSidebarOpen,
    setActiveModal,
    clearCurrentChat,
    showToast
  } = useChat();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('Share link copied to clipboard');
    } else {
      setActiveModal('share');
    }
  };

  return (
    <header className="h-14 w-full flex items-center justify-between px-3 sm:px-4 border-b border-[#262626] bg-black/80 backdrop-blur-md z-30 select-none flex-shrink-0">
      {/* Left controls */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden p-2 text-[#A1A1AA] hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors"
          aria-label="Open navigation drawer"
        >
          <Menu size={19} />
        </button>

        {/* Desktop expand sidebar button when collapsed */}
        {sidebarCollapsed && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="hidden md:flex p-2 text-[#A1A1AA] hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen size={19} />
          </button>
        )}

        {/* Study Mode Selector Pill in header */}
        <StudyModeSelector />

        {/* Current Conversation Title (truncated) */}
        {activeConversation && activeConversation.title && (
          <span className="hidden lg:inline-block text-xs text-[#A1A1AA] max-w-[280px] truncate border-l border-[#262626] pl-3 font-medium">
            {activeConversation.title}
          </span>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-[#1C1C1C] transition-colors border border-transparent hover:border-[#262626]"
          title="Share conversation"
        >
          <Share2 size={15} />
          <span className="hidden sm:inline">Share</span>
        </button>

        {/* More options menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(prev => !prev)}
            className="p-1.5 text-[#A1A1AA] hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors"
            title="Chat options"
          >
            <MoreVertical size={18} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#141414] border border-[#262626] rounded-xl shadow-2xl z-50 py-1.5 text-xs backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  setActiveModal('notes');
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-[#1C1C1C] text-left transition-colors"
              >
                <BookOpen size={14} className="text-white" />
                <span>Open Notebook</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveModal('settings');
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-[#1C1C1C] text-left transition-colors"
              >
                <Settings size={14} className="text-zinc-400" />
                <span>Chat Settings</span>
              </button>

              <div className="my-1 border-t border-[#262626]" />

              <button
                type="button"
                onClick={() => {
                  clearCurrentChat();
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-[#1C1C1C] text-left transition-colors"
              >
                <Trash2 size={14} />
                <span>Clear Messages</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
