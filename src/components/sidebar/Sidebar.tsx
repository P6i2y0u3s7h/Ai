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
    setMobileSidebarOpen(false);
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
          mobileSidebarOpen
            ? 'translate-x-0 opacity-100 pointer-events-auto w-[280px] shadow-2xl'
            : '-translate-x-full opacity-0 pointer-events-none w-[280px]'
        } ${
          sidebarCollapsed
            ? 'md:w-0 md:opacity-0 md:translate-x-0 md:border-r-0 md:pointer-events-none'
            : 'md:w-[270px] md:opacity-100 md:translate-x-0 md:pointer-events-auto md:border-r'
        }`}
      >
        {/* Inner static-width wrapper keeps content stable during width transitions */}
        <div className="w-[270px] h-full flex flex-col flex-shrink-0">
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
