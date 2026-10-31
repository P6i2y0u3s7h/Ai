import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { ParsedMcqQuestion } from '../../types/chat';
import { useChat } from '../../context/ChatContext';

interface InteractiveMcqCardProps {
  question: ParsedMcqQuestion;
  testMode?: boolean;
}

export const InteractiveMcqCard: React.FC<InteractiveMcqCardProps> = ({
  question,
  testMode = true
}) => {
  const { showToast } = useChat();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(!testMode);
  const [revealExplanation, setRevealExplanation] = useState<boolean>(!testMode);

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  const handleSubmit = () => {
    if (selectedOption === null) {
      showToast('Please select an option first');
      return;
    }
    setIsSubmitted(true);
    setRevealExplanation(true);
  };

  const handleReset = () => {
    setSelectedOption(null);
    setIsSubmitted(false);
    setRevealExplanation(false);
  };

  const isCorrect = selectedOption === question.correctIndex;

  return (
    <div className="my-4 p-4 sm:p-5 rounded-2xl bg-[#141414] border border-[#262626] shadow-lg transition-all">
      {/* Header with Topic, Difficulty, and Test Mode Indicator */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-[#262626]">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#1C1C1C] text-white border border-[#2E2E2E]">
            MCQ Practice
          </span>
          {question.difficulty && (
            <span className="text-[11px] font-mono text-[#71717A] uppercase">
              • {question.difficulty}
            </span>
          )}
        </div>
        <span className="text-[11px] text-[#71717A] font-mono">
          {testMode && !isSubmitted ? '🔒 Test Mode (Hidden Answer)' : '💡 Answer Verified'}
        </span>
      </div>

      {/* Question Text */}
      <h4 className="text-[14.5px] sm:text-[15px] font-medium text-white leading-snug mb-4">
        {question.question}
      </h4>

      {/* Options List */}
      <div className="space-y-2 mb-4">
        {question.options.map((option, idx) => {
          const letter = optionLetters[idx] || `${idx + 1}`;
          const isSelected = selectedOption === idx;
          const isThisCorrect = idx === question.correctIndex;

          let optionStyle = 'border-[#262626] bg-[#0A0A0A] text-zinc-300 hover:border-zinc-500 hover:bg-[#1C1C1C]';

          if (isSubmitted) {
            if (isThisCorrect) {
              optionStyle = 'border-white bg-[#1C1C1C] text-white font-medium';
            } else if (isSelected && !isThisCorrect) {
              optionStyle = 'border-zinc-600 bg-[#161616] text-[#A1A1AA] line-through';
            } else {
              optionStyle = 'border-[#262626] bg-[#0A0A0A] text-[#71717A] opacity-50';
            }
          } else if (isSelected) {
            optionStyle = 'border-white bg-[#1C1C1C] text-white shadow-sm';
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={isSubmitted}
              onClick={() => setSelectedOption(idx)}
              className={`w-full p-3 rounded-xl border text-left text-xs sm:text-[13px] flex items-start gap-3 transition-all ${optionStyle}`}
            >
              <span className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                isSubmitted
                  ? isThisCorrect
                    ? 'bg-white text-black'
                    : isSelected
                    ? 'bg-zinc-700 text-white'
                    : 'bg-zinc-900 text-zinc-500'
                  : isSelected
                  ? 'bg-white text-black'
                  : 'bg-zinc-800 text-zinc-300'
              }`}>
                {letter}
              </span>

              <span className="flex-1 pt-0.5 leading-relaxed">{option}</span>

              {isSubmitted && isThisCorrect && (
                <CheckCircle2 size={16} className="text-white flex-shrink-0 mt-0.5" />
              )}
              {isSubmitted && isSelected && !isThisCorrect && (
                <XCircle size={16} className="text-[#A1A1AA] flex-shrink-0 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Action Buttons: Submit / Retake */}
      <div className="flex items-center justify-between pt-2">
        {!isSubmitted ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedOption === null}
            className={`px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              selectedOption !== null
                ? 'bg-white text-black hover:bg-zinc-200 shadow-md'
                : 'bg-[#1C1C1C] text-[#71717A] cursor-not-allowed opacity-60 border border-[#262626]'
            }`}
          >
            <span>Submit Answer</span>
            <ArrowRight size={13} />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
              isCorrect
                ? 'bg-[#1C1C1C] text-white border-white/50'
                : 'bg-[#141414] text-[#A1A1AA] border-[#262626]'
            }`}>
              {isCorrect ? (
                <>
                  <CheckCircle2 size={13} />
                  <span>Correct (+1)</span>
                </>
              ) : (
                <>
                  <XCircle size={13} />
                  <span>Incorrect (0)</span>
                </>
              )}
            </span>

            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1 rounded-lg text-xs text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C] transition-colors flex items-center gap-1 border border-transparent hover:border-[#262626]"
            >
              <RotateCcw size={12} />
              <span>Retry</span>
            </button>
          </div>
        )}
      </div>

      {/* Explanation Box (Revealed after submission or in practice mode) */}
      {revealExplanation && (
        <div className="mt-3.5 pt-3.5 border-t border-[#262626] text-xs text-zinc-300 bg-[#0A0A0A] p-3.5 rounded-xl border border-[#262626] animate-fadeIn">
          <div className="flex items-center gap-1.5 font-semibold text-white mb-1.5">
            <Sparkles size={13} />
            <span>Detailed Conceptual Explanation:</span>
          </div>
          <p className="leading-relaxed text-[#A1A1AA] whitespace-pre-line">
            {question.explanation}
          </p>
        </div>
      )}
    </div>
  );
};
