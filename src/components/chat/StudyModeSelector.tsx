import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  GraduationCap,
  FileQuestion,
  FileText,
  Code,
  MessageSquare,
  ChevronDown,
  Check
} from 'lucide-react';
import { StudyMode, StudyModeOption } from '../../types/chat';
import { useChat } from '../../context/ChatContext';

export const STUDY_MODES: StudyModeOption[] = [
  {
    id: 'general',
    label: 'General Chat',
    description: 'Ask questions, learn concepts, and explore ideas',
    iconName: 'MessageSquare',
    badgeColor: 'text-white bg-[#141414] border-[#262626]',
    promptPlaceholder: 'Ask Ai anything...'
  },
  {
    id: 'study',
    label: 'Study Mode',
    description: 'Learn concepts step-by-step with intuitive analogies',
    iconName: 'Sparkles',
    badgeColor: 'text-white bg-[#141414] border-[#262626]',
    promptPlaceholder: 'Enter a topic to learn step-by-step with Ai...'
  },
  {
    id: 'exam',
    label: 'Exam Preparation',
    description: 'Structured high-scoring answers & key definitions',
    iconName: 'GraduationCap',
    badgeColor: 'text-white bg-[#141414] border-[#262626]',
    promptPlaceholder: 'Ask an exam question for structured marks...'
  },
  {
    id: 'mcq',
    label: 'MCQ Practice',
    description: 'Interactive questions with instant explanations',
    iconName: 'FileQuestion',
    badgeColor: 'text-white bg-[#141414] border-[#262626]',
    promptPlaceholder: 'Test me on a topic with multiple-choice questions...'
  },
  {
    id: 'pdf',
    label: 'PDF Learning',
    description: 'Ask questions based on your uploaded notes and textbooks',
    iconName: 'FileText',
    badgeColor: 'text-white bg-[#141414] border-[#262626]',
    promptPlaceholder: 'Ask questions or summarize your study documents...'
  },
  {
    id: 'coding',
    label: 'Coding Tutor',
    description: 'Code explanations, algorithms, and debugging',
    iconName: 'Code',
    badgeColor: 'text-white bg-[#141414] border-[#262626]',
    promptPlaceholder: 'Paste code or ask Ai about an algorithm...'
  }
];

interface StudyModeSelectorProps {
  compact?: boolean;
}

export const StudyModeSelector: React.FC<StudyModeSelectorProps> = ({ compact = false }) => {
  const { studyMode, setStudyMode, showToast } = useChat();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeModeObj = STUDY_MODES.find(m => m.id === studyMode) || STUDY_MODES[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getIcon = (id: StudyMode) => {
    switch (id) {
      case 'study': return <Sparkles size={14} className="text-white" />;
      case 'exam': return <GraduationCap size={14} className="text-white" />;
      case 'mcq': return <FileQuestion size={14} className="text-white" />;
      case 'pdf': return <FileText size={14} className="text-white" />;
      case 'coding': return <Code size={14} className="text-white" />;
      default: return <MessageSquare size={14} className="text-white" />;
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-1.5 rounded-full transition-all text-xs font-medium border select-none ${
          compact
            ? 'px-2 py-1 bg-[#141414] hover:bg-[#1C1C1C] border-[#262626] text-zinc-300'
            : 'px-2.5 sm:px-3 py-1.5 bg-[#141414] hover:bg-[#1C1C1C] border-[#262626] text-white shadow-sm'
        }`}
      >
        {getIcon(activeModeObj.id)}
        <span className="truncate max-w-[100px] sm:max-w-none">{activeModeObj.label}</span>
        <ChevronDown
          size={13}
          className={`text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-64 sm:w-72 bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl z-50 p-1.5 backdrop-blur-md">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-[#262626] mb-1">
            Select Study Mode
          </div>

          <div className="space-y-0.5">
            {STUDY_MODES.map(mode => (
              <button
                key={mode.id}
                onClick={() => {
                  setStudyMode(mode.id);
                  setIsOpen(false);
                  showToast(`Mode switched to: ${mode.label}`);
                }}
                className={`w-full px-2.5 py-2 rounded-xl flex items-start gap-2.5 text-left transition-colors ${
                  mode.id === studyMode
                    ? 'bg-[#1C1C1C] text-white border border-[#262626]'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C] border border-transparent'
                }`}
              >
                <div className="mt-0.5 p-1 rounded-lg bg-[#0A0A0A] border border-[#262626]">
                  {getIcon(mode.id)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white">{mode.label}</span>
                    {mode.id === studyMode && (
                      <Check size={14} className="text-white" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#A1A1AA] line-clamp-1 leading-normal">
                    {mode.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
