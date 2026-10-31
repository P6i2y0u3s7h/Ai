import React from 'react';
import {
  Sparkles,
  GraduationCap,
  FileText,
  FileQuestion,
  ArrowUpRight,
  Code
} from 'lucide-react';
import { StudyMode } from '../../types/chat';
import { useChat } from '../../context/ChatContext';
import { AiLogo } from '../common/LumoraLogo';

interface SuggestionCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  mode: StudyMode;
  prompt: string;
}

export const WelcomeScreen: React.FC = () => {
  const { sendMessage, setStudyMode, setActiveModal } = useChat();

  const suggestions: SuggestionCard[] = [
    {
      title: 'Explain a Topic',
      description: 'Learn complex concepts with clear, step-by-step intuition.',
      icon: <Sparkles size={18} className="text-white" />,
      mode: 'study',
      prompt: 'Explain the working of Transformers in deep learning with an intuitive step-by-step breakdown.'
    },
    {
      title: 'Coding & Algorithms',
      description: 'Master data structures, algorithms, syntax, and complexity.',
      icon: <Code size={18} className="text-white" />,
      mode: 'coding',
      prompt: 'Explain Arrays in Java: declaration, memory layout, code example, complexity, and common interview questions.'
    },
    {
      title: 'Exam Preparation',
      description: 'Generate structured high-scoring university model answers.',
      icon: <GraduationCap size={18} className="text-white" />,
      mode: 'exam',
      prompt: 'Provide an 8-mark university exam model answer on ACID Properties in Database Management Systems.'
    },
    {
      title: 'Study a PDF Document',
      description: 'Upload lecture slides or notes to synthesize takeaways.',
      icon: <FileText size={18} className="text-white" />,
      mode: 'pdf',
      prompt: 'Summarize the core takeaways from my uploaded study material and create flashcards.'
    }
  ];

  const handleCardClick = (card: SuggestionCard) => {
    setStudyMode(card.mode);
    if (card.mode === 'pdf') {
      setActiveModal('documents');
    } else {
      sendMessage(card.prompt, [], undefined, card.mode);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-[800px] mx-auto w-full select-none text-center">
      {/* Ai Emblem Icon */}
      <div className="mb-6 flex justify-center">
        <AiLogo size="xl" showWordmark={false} />
      </div>

      {/* Main Welcome Heading */}
      <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight mb-3">
        Your ideas deserve better answers.
      </h1>

      {/* Subtitle */}
      <p className="text-sm sm:text-base text-[#A1A1AA] max-w-lg mx-auto mb-10 font-normal leading-relaxed">
        Learn, explore, and understand anything with Ai.
      </p>

      {/* Suggestion Cards Container */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        {suggestions.map((card, idx) => (
          <button
            key={idx}
            onClick={() => handleCardClick(card)}
            className="group relative p-4 rounded-2xl bg-[#141414] hover:bg-[#1C1C1C] border border-[#262626] hover:border-[#383838] transition-all duration-200 text-left flex flex-col justify-between shadow-sm"
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="p-2 rounded-xl bg-[#0A0A0A] border border-[#262626] group-hover:border-[#333333] transition-colors">
                {card.icon}
              </div>
              <ArrowUpRight
                size={16}
                className="text-[#71717A] group-hover:text-white transition-colors transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </div>

            <div>
              <h2 className="text-[14px] font-semibold text-white transition-colors mb-1">
                {card.title}
              </h2>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                {card.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
