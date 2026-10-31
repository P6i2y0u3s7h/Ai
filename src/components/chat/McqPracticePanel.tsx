import React, { useState } from 'react';
import {
  FileQuestion,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  EyeOff,
  BookOpen
} from 'lucide-react';
import { McqConfig } from '../../types/chat';
import { useChat } from '../../context/ChatContext';

export const McqPracticePanel: React.FC = () => {
  const { mcqConfig, setMcqConfig, sendMessage, isStreaming, showToast } = useChat();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleGenerate = () => {
    if (!mcqConfig.topic.trim()) {
      showToast('Please enter an MCQ topic (e.g. Binary Search Trees)');
      return;
    }

    const prompt = `Generate challenging exam-level Multiple Choice Questions for topic: "${mcqConfig.topic}". Difficulty: ${mcqConfig.difficulty}. Test Mode: ${mcqConfig.testMode ? 'True (keep answer hidden in validated JSON block)' : 'False'}. Each question must have exactly 4 options (A, B, C, D) and 1 correct answer with a thorough explanation.`;

    sendMessage(prompt, undefined, undefined, 'mcq', {
      topic: mcqConfig.topic,
      difficulty: mcqConfig.difficulty,
      testMode: mcqConfig.testMode
    });
  };

  return (
    <div className="w-full max-w-[800px] mx-auto px-3 sm:px-4 mb-2">
      <div className="rounded-2xl bg-[#141414] border border-[#262626] p-2.5 sm:p-3.5 shadow-md">
        {/* Header Bar */}
        <div
          className="flex items-center justify-between gap-2 cursor-pointer select-none"
          onClick={() => setIsExpanded(prev => !prev)}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#0A0A0A] text-white flex items-center justify-center border border-[#262626]">
              <FileQuestion size={14} />
            </div>
            <div>
              <span className="text-xs font-semibold text-white">
                MCQ Practice Center
              </span>
              <span className="hidden sm:inline-block text-[11px] text-[#A1A1AA] ml-2">
                4 Options • Single Correct • {mcqConfig.difficulty.toUpperCase()} • {mcqConfig.testMode ? 'Test Mode (Hidden Answers)' : 'Study Mode'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors"
            aria-label="Toggle MCQ panel"
          >
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {/* Configuration Options */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-[#262626] space-y-3 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Topic Input */}
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Topic / Subject:
                </label>
                <input
                  type="text"
                  placeholder="e.g. React Hooks, Thermodynamics, Graph Algorithms"
                  value={mcqConfig.topic}
                  onChange={e => setMcqConfig(prev => ({ ...prev, topic: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#0A0A0A] border border-[#262626] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Difficulty & Mode Selectors */}
              <div className="grid grid-cols-2 gap-2">
                {/* Difficulty */}
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">Difficulty:</label>
                  <select
                    value={mcqConfig.difficulty}
                    onChange={e => setMcqConfig(prev => ({ ...prev, difficulty: e.target.value as any }))}
                    className="w-full px-2 py-1.5 rounded-xl bg-[#0A0A0A] border border-[#262626] text-white text-xs focus:outline-none"
                  >
                    <option value="easy">Easy (Fundamentals)</option>
                    <option value="medium">Medium (Standard)</option>
                    <option value="hard">Hard (Exam Tough)</option>
                  </select>
                </div>

                {/* Mode Selector */}
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">Mode:</label>
                  <button
                    type="button"
                    onClick={() => setMcqConfig(prev => ({ ...prev, testMode: !prev.testMode }))}
                    className={`w-full py-1.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 border transition-all ${
                      mcqConfig.testMode
                        ? 'bg-[#1C1C1C] border-white/40 text-white'
                        : 'bg-[#0A0A0A] border-[#262626] text-zinc-300'
                    }`}
                  >
                    {mcqConfig.testMode ? <EyeOff size={13} /> : <BookOpen size={13} />}
                    <span>{mcqConfig.testMode ? 'Test Mode' : 'Study Mode'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={isStreaming}
                onClick={handleGenerate}
                className="py-1.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Sparkles size={13} />
                <span>Generate Questions</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
