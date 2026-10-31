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

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col bg-[#0A0A0A] border-r border-[#262626] transition-all duration-300 ease-in-out select-none ${
          /* Desktop dimensions: 270px wide, or 64px when collapsed */
          sidebarCollapsed ? 'md:w-16' : 'md:w-[270px]'
        } ${
          /* Mobile slide-out drawer behavior */
          mobileSidebarOpen
            ? 'translate-x-0 w-[280px]'
            : '-translate-x-full md:translate-x-0'
        }`}
      >
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
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />

        {/* Top Action: New Chat Button */}
        <div className="p-2.5 pb-2">
          <NavigationItem
            icon={Plus}
            label="New Chat"
            variant="primary"
            isCollapsed={sidebarCollapsed}
            onClick={() => createNewChat()}
          />
        </div>

        {/* Main Navigation Tools */}
        <div className="px-2.5 py-1 space-y-0.5 border-b border-[#1F1F1F] pb-2.5">
          <NavigationItem
            icon={Search}
            label="Search Chats"
            isCollapsed={sidebarCollapsed}
            onClick={() => setActiveModal('search')}
          />
          <NavigationItem
            icon={Wrench}
            label="Study Tools"
            isCollapsed={sidebarCollapsed}
            isActive={activeModal === 'tools'}
            onClick={() => setActiveModal('tools')}
          />
          <NavigationItem
            icon={BookOpen}
            label="My Notes"
            badge={notes.length > 0 ? notes.length : undefined}
            isCollapsed={sidebarCollapsed}
            isActive={activeModal === 'notes'}
            onClick={() => setActiveModal('notes')}
          />
          <NavigationItem
            icon={FileText}
            label="My Documents"
            badge={documents.length > 0 ? documents.length : undefined}
            isCollapsed={sidebarCollapsed}
            isActive={activeModal === 'documents'}
            onClick={() => setActiveModal('documents')}
          />
          <NavigationItem
            icon={Award}
            label="Quiz History"
            isCollapsed={sidebarCollapsed}
            isActive={activeModal === 'quiz'}
            onClick={() => setActiveModal('quiz')}
          />
          <NavigationItem
            icon={CalendarDays}
            label="Study Planner"
            badge={tasks.filter(t => !t.completed).length || undefined}
            isCollapsed={sidebarCollapsed}
            isActive={activeModal === 'planner'}
            onClick={() => setActiveModal('planner')}
          />
        </div>

        {/* Scrollable Conversation List Area */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
          <ConversationList isCollapsed={sidebarCollapsed} />
        </div>

        {/* Anchored Footer Profile */}
        <UserProfileMenu isCollapsed={sidebarCollapsed} />
      </aside>
    </>
  );
};
