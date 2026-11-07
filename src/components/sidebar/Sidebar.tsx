import React from 'react';
import {
  Plus,
  Search,
  Wrench,
  BookOpen,
  FileText,
  Award,
  CalendarDays,
  X
} from 'lucide-react';
import { SidebarHeader } from './SidebarHeader';
import { NavigationItem } from './NavigationItem';
import { ConversationList } from './ConversationList';
import { UserProfileMenu } from './UserProfileMenu';
import { useChat } from '../../context/ChatContext';

export const Sidebar: React.FC = () => {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    createNewChat,
    setActiveModal,
    activeModal,
    notes,
    documents,
    tasks
  } = useChat();

  const handleToggleCollapse = () => {
    setSidebarCollapsed(prev => !prev);
  };

  const handleOpenModal = (modal: typeof activeModal) => {
    setActiveModal(modal);
    setMobileSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Main Sidebar Element (ChatGPT-style full slide toggle) */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col bg-[#0A0A0A] border-r border-[#262626] transition-all duration-300 ease-in-out select-none overflow-hidden ${
          sidebarCollapsed
            ? 'w-0 md:w-0 opacity-0 -translate-x-full md:translate-x-0 border-r-0 pointer-events-none'
            : 'w-[280px] md:w-[270px] opacity-100 translate-x-0'
        } ${
          mobileSidebarOpen
            ? '!translate-x-0 !w-[280px] !opacity-100 !pointer-events-auto'
            : ''
        }`}
      >
        {/* Inner static-width wrapper keeps content stable during width transitions */}
        <div className="w-[270px] h-full flex flex-col flex-shrink-0">
          {/* Mobile close button header on small screens */}
          <div className="flex md:hidden items-center justify-between px-3 h-12 border-b border-[#262626] bg-[#0A0A0A]">
            <span className="text-sm font-semibold text-white tracking-tight">Ai</span>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="p-1.5 text-[#A1A1AA] hover:text-white rounded-lg hover:bg-[#1C1C1C]"
            >
              <X size={18} />
            </button>
          </div>

          {/* Sidebar Header */}
          <SidebarHeader
            onToggleCollapse={handleToggleCollapse}
          />

          {/* Top Action: New Chat Button */}
          <div className="p-2.5 pb-2">
            <NavigationItem
              icon={Plus}
              label="New Chat"
              variant="primary"
              isCollapsed={false}
              onClick={() => createNewChat()}
            />
          </div>

          {/* Main Navigation Tools */}
          <div className="px-2.5 py-1 space-y-0.5 border-b border-[#1F1F1F] pb-2.5">
            <NavigationItem
              icon={Search}
              label="Search Chats"
              isCollapsed={false}
              onClick={() => handleOpenModal('search')}
            />
            <NavigationItem
              icon={Wrench}
              label="Study Tools"
              isCollapsed={false}
              isActive={activeModal === 'tools'}
              onClick={() => handleOpenModal('tools')}
            />
            <NavigationItem
              icon={BookOpen}
              label="My Notes"
              badge={notes.length > 0 ? notes.length : undefined}
              isCollapsed={false}
              isActive={activeModal === 'notes'}
              onClick={() => handleOpenModal('notes')}
            />
            <NavigationItem
              icon={FileText}
              label="My Documents"
              badge={documents.length > 0 ? documents.length : undefined}
              isCollapsed={false}
              isActive={activeModal === 'documents'}
              onClick={() => handleOpenModal('documents')}
            />
            <NavigationItem
              icon={Award}
              label="Quiz History"
              isCollapsed={false}
              isActive={activeModal === 'quiz'}
              onClick={() => handleOpenModal('quiz')}
            />
            <NavigationItem
              icon={CalendarDays}
              label="Study Planner"
              badge={tasks.filter(t => !t.completed).length || undefined}
              isCollapsed={false}
              isActive={activeModal === 'planner'}
              onClick={() => handleOpenModal('planner')}
            />
          </div>

          {/* Scrollable Conversation List Area */}
          <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
            <ConversationList isCollapsed={false} />
          </div>

          {/* Anchored Footer Profile */}
          <UserProfileMenu isCollapsed={false} />
        </div>
      </aside>
    </>
  );
};
