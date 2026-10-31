import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  MoreHorizontal,
  Pin,
  PinOff,
  Edit2,
  Trash2,
  Share2,
  Check,
  X
} from 'lucide-react';
import { Conversation } from '../../types/chat';
import { useChat } from '../../context/ChatContext';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  isCollapsed: boolean;
  onSelect: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  isCollapsed,
  onSelect,
}) => {
  const { renameConversation, deleteConversation, togglePinConversation, setActiveModal } = useChat();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const [menuOpen, setMenuOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Click outside to close menu
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

  const handleSaveRename = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitle.trim()) {
      renameConversation(conversation.id, editTitle.trim());
    } else {
      setEditTitle(conversation.title);
    }
    setIsEditing(false);
  };

  const handleCancelRename = () => {
    setEditTitle(conversation.title);
    setIsEditing(false);
  };

  if (isCollapsed) {
    return (
      <button
        onClick={onSelect}
        title={conversation.title}
        className={`w-10 h-10 mx-auto my-0.5 rounded-xl flex items-center justify-center transition-colors relative group ${
          isActive
            ? 'bg-[#1C1C1C] text-white border border-[#262626]'
            : 'text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C]'
        }`}
      >
        <MessageSquare size={17} />
        {conversation.isPinned && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-white"></span>
        )}
      </button>
    );
  }

  return (
    <div
      className={`group relative h-9 px-2.5 rounded-xl flex items-center transition-all duration-150 select-none ${
        isActive
          ? 'bg-[#1C1C1C] text-white font-medium border border-[#262626]'
          : 'text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C] border border-transparent'
      }`}
    >
      {isEditing ? (
        <form onSubmit={handleSaveRename} className="flex-1 flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            className="w-full bg-[#111111] text-white text-[13px] px-2 py-1 rounded-md border border-white/60 focus:outline-none"
            onKeyDown={e => {
              if (e.key === 'Escape') handleCancelRename();
            }}
          />
          <button
            type="submit"
            className="p-1 text-white hover:text-zinc-300"
            title="Save"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={handleCancelRename}
            className="p-1 text-[#71717A] hover:text-white"
            title="Cancel"
          >
            <X size={14} />
          </button>
        </form>
      ) : (
        <>
          <button
            onClick={onSelect}
            className="flex-1 flex items-center gap-2.5 min-w-0 text-left h-full"
          >
            <div className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-[#71717A] group-hover:text-white'}`}>
              <MessageSquare size={15} />
            </div>

            <span className="text-[13px] truncate flex-1 tracking-tight">
              {conversation.title}
            </span>

            {conversation.isPinned && (
              <Pin size={12} className="text-white flex-shrink-0" />
            )}
          </button>

          {/* Contextual menu button */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(prev => !prev);
              }}
              className={`p-1 rounded-md transition-opacity ${
                menuOpen
                  ? 'opacity-100 bg-[#242424] text-white'
                  : 'opacity-0 group-hover:opacity-100 text-[#71717A] hover:text-white hover:bg-[#242424]'
              }`}
              title="Conversation options"
            >
              <MoreHorizontal size={14} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-[#141414] border border-[#262626] rounded-xl shadow-xl z-50 py-1.5 text-[12.5px] backdrop-blur-md">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePinConversation(conversation.id);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-[#1C1C1C] text-left transition-colors"
                >
                  {conversation.isPinned ? (
                    <>
                      <PinOff size={14} className="text-white" />
                      <span>Unpin conversation</span>
                    </>
                  ) : (
                    <>
                      <Pin size={14} />
                      <span>Pin conversation</span>
                    </>
                  )}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-[#1C1C1C] text-left transition-colors"
                >
                  <Edit2 size={14} />
                  <span>Rename</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveModal('share');
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-[#1C1C1C] text-left transition-colors"
                >
                  <Share2 size={14} />
                  <span>Share chat</span>
                </button>

                <div className="my-1 border-t border-[#262626]" />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conversation.id);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2.5 text-zinc-300 hover:text-white hover:bg-[#222222] text-left transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Delete conversation</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
