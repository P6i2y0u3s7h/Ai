import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  GraduationCap,
  Copy,
  Check,
  AlertCircle,
  RotateCcw,
  Square
} from 'lucide-react';
import { Message } from '../../types/chat';
import { MessageActions } from './MessageActions';
import { PersonalizationPills } from './PersonalizationPills';
import { InteractiveMcqCard } from './InteractiveMcqCard';
import { extractAndValidateMcqs } from '../../utils/mcqParser';
import { useChat } from '../../context/ChatContext';
import logoImg from '../../assets/logo.jpg';

interface AssistantMessageProps {
  message: Message;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({ message }) => {
  const { regenerateMessage, mcqConfig } = useChat();

  const isError = message.status === 'error';
  const isCancelled = message.status === 'cancelled';
  const isRateLimit = isError && (message.content.toLowerCase().includes('rate limit') || message.content.toLowerCase().includes('free tier'));
  const isLoading = message.isStreaming && (!message.content || message.content.length === 0);

  // Parse MCQs when in mcq mode or if message contains validated MCQ structure
  const { hasMcq, questions, cleanMarkdown } = useMemo(() => {
    return extractAndValidateMcqs(message.content);
  }, [message.content]);

  return (
    <div className="flex gap-3.5 my-5 select-text group">
      {/* Ai Avatar Icon */}
      <img
        src={logoImg}
        alt="Ai"
        className="w-7 h-7 rounded-lg object-cover flex-shrink-0 mt-0.5 shadow-sm border border-[#262626]"
      />

      {/* Message content area */}
      <div className="flex-1 min-w-0 max-w-full">
        {/* Loading State Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 py-2 text-xs text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="font-mono text-[11px] text-[#A1A1AA] uppercase tracking-wider ml-1">
              Thinking with Ai...
            </span>
          </div>
        )}

        {/* Error / Rate Limit State */}
        {isError && (
          <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] text-zinc-300 text-xs my-1">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={16} className="text-white flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-white">
                    {isRateLimit ? 'Groq Free Tier Rate Limit Reached' : 'Unable to complete response'}
                  </p>
                  {isRateLimit && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#262626] text-zinc-300 font-mono">
                      TPM: 8,000 / RPM: 30
                    </span>
                  )}
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  {message.content || 'An error occurred while generating response.'}
                </p>
                {isRateLimit && (
                  <p className="text-zinc-500 text-[11px] mt-1.5">
                    Free tier quota automatically refreshes every 60 seconds. You do not need to upgrade to a paid account.
                  </p>
                )}
                <button
                  onClick={() => regenerateMessage(message.id)}
                  className="mt-2.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 font-medium flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw size={13} />
                  <span>Retry Request</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Normal / Streamed Message Content */}
        {!isError && (
          <>
            {/* Interactive MCQ Cards (if validated MCQs exist in message) */}
            {hasMcq && questions.map((q, qIdx) => (
              <InteractiveMcqCard
                key={q.id || qIdx}
                question={q}
                testMode={mcqConfig.testMode}
              />
            ))}

            {/* Markdown Text Content */}
            {cleanMarkdown.trim().length > 0 && (
              <div className="markdown-content text-[#FFFFFF]">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const isInline = !match && !String(children).includes('\n');
                      const codeString = String(children).replace(/\n$/, '');

                      if (isInline) {
                        return (
                          <code className="bg-[#181818] text-white px-1.5 py-0.5 rounded text-[13px] font-mono border border-[#2E2E2E]" {...props}>
                            {children}
                          </code>
                        );
                      }

                      return (
                        <CodeBlock language={match ? match[1] : 'code'} code={codeString} />
                      );
                    }
                  }}
                >
                  {cleanMarkdown}
                </ReactMarkdown>

                {/* Streaming pulsing cursor */}
                {message.isStreaming && <span className="streaming-cursor" />}
              </div>
            )}

            {/* Cancelled badge if generation was interrupted by user */}
            {isCancelled && (
              <div className="flex items-center gap-2 mt-2 text-[11px] text-[#71717A] italic">
                <Square size={10} className="text-[#71717A]" />
                <span>Response stopped by student.</span>
                <button
                  onClick={() => regenerateMessage(message.id)}
                  className="text-white hover:underline font-normal not-italic ml-1"
                >
                  Regenerate
                </button>
              </div>
            )}
          </>
        )}

        {/* Message Actions (Copy, Regenerate, Save to Notes, Feedback) */}
        {!message.isStreaming && !isError && message.content.length > 0 && (
          <>
            <MessageActions message={message} />
            <PersonalizationPills message={message} />
          </>
        )}
      </div>
    </div>
  );
};

// Reusable Code Block with Copy Button & Language Badge
const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[#262626] bg-[#0D0D0D]">
      {/* Code header bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#141414] border-b border-[#262626] text-xs text-zinc-400 select-none">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
          {language}
        </span>
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[#1C1C1C] hover:text-white transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={13} className="text-white" />
              <span className="text-[11px] text-white">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span className="text-[11px]">Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code pre formatted */}
      <pre className="p-3.5 overflow-x-auto text-[13px] font-mono text-zinc-200 leading-relaxed bg-[#0D0D0D] !m-0 !rounded-none !border-none">
        <code>{code}</code>
      </pre>
    </div>
  );
};
