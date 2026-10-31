import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  LogOut,
  Keyboard,
  ChevronUp,
  BookOpen,
  UserCheck
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';

interface UserProfileMenuProps {
  isCollapsed: boolean;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({ isCollapsed }) => {
  const { setActiveModal, showToast } = useChat();
  const { user, signOutUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    showToast('Signed out successfully');
    await signOutUser();
  };

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Alex Morgan';
  const displayEmail = user?.email || 'student@university.edu';
  const initials = displayName
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'ST';

  return (
    <div className="relative border-t border-[#262626] p-2 bg-[#0A0A0A]" ref={menuRef}>
      {/* Profile button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full h-12 flex items-center rounded-xl transition-all duration-150 select-none ${
          isCollapsed ? 'justify-center px-0' : 'px-2.5 gap-2.5'
        } ${isOpen ? 'bg-[#1C1C1C] text-white' : 'text-zinc-300 hover:text-white hover:bg-[#1C1C1C]'}`}
        title={`${displayName} (${displayEmail})`}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-[#1C1C1C] text-white border border-[#2E2E2E] flex items-center justify-center font-semibold text-xs shadow-sm">
            {initials}
          </div>
          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-white ring-2 ring-black"></span>
        </div>

        {!isCollapsed && (
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="text-[13px] font-medium text-white truncate">
                {displayName}
              </span>
              <span className="text-[10px] bg-[#141414] text-zinc-300 px-1.5 py-0.2 rounded border border-[#262626] font-mono">
                {user?.isGuest ? 'DEMO' : 'PRO'}
              </span>
            </div>
            <p className="text-[11.5px] text-[#71717A] truncate">
              {displayEmail}
            </p>
          </div>
        )}

        {!isCollapsed && (
          <ChevronUp
            size={15}
            className={`text-zinc-500 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-zinc-300' : ''
            }`}
          />
        )}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className={`absolute bottom-full mb-2 bg-[#141414] border border-[#262626] rounded-xl shadow-2xl z-50 py-1.5 backdrop-blur-md ${
          isCollapsed ? 'left-full ml-2 w-56' : 'left-2 right-2'
        }`}>
          <div className="px-3 py-2 border-b border-[#262626] mb-1">
            <div className="flex items-center gap-1.5">
              <UserCheck size={14} className="text-white" />
              <p className="text-[13px] font-medium text-white truncate">{displayName}</p>
            </div>
            <p className="text-[11px] text-[#A1A1AA] truncate">{displayEmail}</p>
          </div>

          <button
            onClick={() => {
              setActiveModal('settings');
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-[13px] text-zinc-300 hover:text-white hover:bg-[#1C1C1C] text-left transition-colors"
          >
            <Settings size={15} className="text-zinc-400" />
            <span>Settings & Preferences</span>
          </button>

          <button
            onClick={() => {
              setActiveModal('notes');
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-[13px] text-zinc-300 hover:text-white hover:bg-[#1C1C1C] text-left transition-colors"
          >
            <BookOpen size={15} className="text-white" />
            <span>My Notebook & Notes</span>
          </button>

          <button
            onClick={() => {
              showToast('Shortcuts: Enter = Send, Shift+Enter = Newline, Ctrl+K = Search');
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-[13px] text-zinc-300 hover:text-white hover:bg-[#1C1C1C] text-left transition-colors"
          >
            <Keyboard size={15} className="text-zinc-400" />
            <span>Keyboard Shortcuts</span>
          </button>

          <div className="my-1 border-t border-[#262626]" />

          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-[13px] text-red-400 hover:text-red-300 hover:bg-red-500/10 text-left transition-colors"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};
