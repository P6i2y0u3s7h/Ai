import React, { useEffect } from 'react';
import { Sidebar } from '../sidebar/Sidebar';
import { ChatHeader } from '../chat/ChatHeader';
import { MessageList } from '../chat/MessageList';
import { MessageComposer } from '../chat/MessageComposer';
import { SearchModal } from '../modals/SearchModal';
import { NotesModal } from '../modals/NotesModal';
import { StudyToolsModal } from '../modals/StudyToolsModal';
import { DocumentsModal } from '../modals/DocumentsModal';
import { QuizModal } from '../modals/QuizModal';
import { PlannerModal } from '../modals/PlannerModal';
import { SettingsModal } from '../modals/SettingsModal';
import { ShareModal } from '../modals/ShareModal';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useChat } from '../../context/ChatContext';

export const AppLayout: React.FC = () => {
  const { toastMessage, setActiveModal, setSidebarCollapsed } = useChat();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle sidebar: Ctrl+B or Ctrl+\ or Cmd+B
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B' || e.key === '\\')) {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }
      // Open Search: Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setActiveModal('search');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSidebarCollapsed, setActiveModal]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-[#FFFFFF] font-sans antialiased">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Conversation Workspace */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-black relative">
        {/* Top Header */}
        <ChatHeader />

        {/* Scrollable Conversation Container */}
        <MessageList />

        {/* Fixed Message Composer (anchored at bottom) */}
        <MessageComposer />

        {/* Toast Notification Banner */}
        {toastMessage && (
          <div className="fixed top-16 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="px-4 py-2.5 rounded-xl bg-[#141414] text-white border border-[#262626] shadow-2xl text-xs sm:text-[13px] flex items-center gap-2.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}
      </main>

      {/* Feature Modals wrapped in Error Boundary */}
      <ErrorBoundary onReset={() => setActiveModal(null)}>
        <SearchModal />
        <NotesModal />
        <StudyToolsModal />
        <DocumentsModal />
        <QuizModal />
        <PlannerModal />
        <SettingsModal />
        <ShareModal />
      </ErrorBoundary>
    </div>
  );
};
