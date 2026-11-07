import React, { useState } from 'react';
import {
  GraduationCap,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Languages,
  Check,
  FileSpreadsheet,
  Mic2
} from 'lucide-react';
import { ExamConfig, StudyLanguage } from '../../types/chat';
import { useChat } from '../../context/ChatContext';

export const ExamPreparationPanel: React.FC = () => {
  const { examConfig, setExamConfig, sendMessage, isStreaming, showToast } = useChat();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleGenerate = () => {
    if (!examConfig.topic.trim()) {
      showToast('Please enter an exam topic (e.g. Deadlock Detection)');
      return;
    }

    let prompt = '';
    if (examConfig.marks === 'viva') {
      prompt = `Prepare comprehensive Viva Voce questions and model examiner answers for the topic: "${examConfig.topic}" in ${examConfig.subject || 'this subject'}. Difficulty: ${examConfig.difficulty}. Language: ${examConfig.language}.`;
    } else {
      prompt = `Generate a high-scoring university exam model answer for: "${examConfig.topic}" in subject: "${examConfig.subject || 'General'}". Target: ${examConfig.marks} Marks. Question Type: ${examConfig.questionType}. Difficulty: ${examConfig.difficulty}. Language: ${examConfig.language}.`;
    }

    sendMessage(prompt, undefined, undefined, 'exam', {
      subject: examConfig.subject,
      topic: examConfig.topic,
      marks: examConfig.marks,
      difficulty: examConfig.difficulty,
      language: examConfig.language,
      questionType: examConfig.questionType
    });
  };

  return (
    <div className="w-full max-w-[800px] mx-auto px-3 sm:px-4 mb-2">
      <div className="rounded-2xl bg-[#141414] border border-[#262626] p-2.5 sm:p-3.5 shadow-md">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2 cursor-pointer select-none" onClick={() => setIsExpanded(prev => !prev)}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#0A0A0A] text-white flex items-center justify-center border border-[#262626]">
              <GraduationCap size={14} />
            </div>
            <div>
              <span className="text-xs font-semibold text-white">
                Exam Preparation Blueprint
              </span>
              <span className="hidden sm:inline-block text-[11px] text-[#A1A1AA] ml-2">
                Configure Marks ({examConfig.marks === 'viva' ? 'Viva' : `${examConfig.marks}M`}), Difficulty ({examConfig.difficulty}), & Language ({examConfig.language === 'hinglish' ? 'Hinglish' : 'English'})
              </span>
            </div>
          </div>

          <button
            type="button"
            className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors"
            aria-label="Toggle exam panel"
          >
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {/* Configuration Body (Visible when expanded or on quick controls) */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-[#262626] space-y-3 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Subject Input */}
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Subject Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Operating Systems, DBMS, Physics"
                  value={examConfig.subject}
                  onChange={e => setExamConfig(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#0A0A0A] border border-[#262626] text-[16px] sm:text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Topic Input */}
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Exam Topic:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Banker's Algorithm, Normalization"
                  value={examConfig.topic}
                  onChange={e => setExamConfig(prev => ({ ...prev, topic: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#0A0A0A] border border-[#262626] text-[16px] sm:text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            {/* Marks & Answer Format Selectors */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {/* Marks */}
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Marks:</label>
                <select
                  value={examConfig.marks}
                  onChange={e => {
                    const val = e.target.value;
                    const marksVal = val === 'viva' ? 'viva' : (Number(val) as 2 | 5 | 10 | 16);
                    setExamConfig(prev => ({
                      ...prev,
                      marks: marksVal,
                      questionType: val === 'viva' ? 'viva' : Number(val) <= 3 ? 'short' : Number(val) <= 7 ? 'standard' : 'long'
                    }));
                  }}
                  className="w-full px-2 py-1.5 rounded-xl bg-[#0A0A0A] border border-[#262626] text-white text-xs focus:outline-none"
                >
                  <option value={2}>2 Marks (Short Answer)</option>
                  <option value={5}>5 Marks (Medium Answer)</option>
                  <option value={10}>10 Marks (Detailed Long)</option>
                  <option value={16}>16 Marks (University Essay)</option>
                  <option value="viva">Viva Voce (Oral Exam)</option>
                </select>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Difficulty:</label>
                <select
                  value={examConfig.difficulty}
                  onChange={e => setExamConfig(prev => ({ ...prev, difficulty: e.target.value as any }))}
                  className="w-full px-2 py-1.5 rounded-xl bg-[#0A0A0A] border border-[#262626] text-white text-xs focus:outline-none"
                >
                  <option value="easy">Easy (Fundamentals)</option>
                  <option value="medium">Medium (Standard Exam)</option>
                  <option value="hard">Hard (Advanced Scoring)</option>
                </select>
              </div>

              {/* Language */}
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Language:</label>
                <select
                  value={examConfig.language}
                  onChange={e => setExamConfig(prev => ({ ...prev, language: e.target.value as StudyLanguage }))}
                  className="w-full px-2 py-1.5 rounded-xl bg-[#0A0A0A] border border-[#262626] text-white text-xs focus:outline-none"
                >
                  <option value="english">Easy English</option>
                  <option value="hinglish">Hinglish (Hindi + Eng)</option>
                </select>
              </div>

              {/* Action Button */}
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={isStreaming}
                  onClick={handleGenerate}
                  className="w-full py-1.5 px-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <Sparkles size={13} />
                  <span>Generate Model Answer</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
