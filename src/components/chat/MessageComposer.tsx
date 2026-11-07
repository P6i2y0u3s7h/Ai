import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Square,
  Paperclip,
  Mic,
  MicOff,
  X,
  FileText,
  Image as ImageIcon,
  Languages
} from 'lucide-react';
import { Attachment, StudyLanguage } from '../../types/chat';
import { useChat } from '../../context/ChatContext';
import { STUDY_MODES } from './StudyModeSelector';
import { ExamPreparationPanel } from './ExamPreparationPanel';
import { McqPracticePanel } from './McqPracticePanel';

export const MessageComposer: React.FC = () => {
  const {
    sendMessage,
    isStreaming,
    stopGeneration,
    studyMode,
    language,
    setLanguage,
    showToast,
    activeDocument,
    setActiveDocumentId,
    setActiveModal,
    uploadDocument
  } = useChat();

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentModeInfo = STUDY_MODES.find(m => m.id === studyMode) || STUDY_MODES[0];

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Cap at ~180px height
      textareaRef.current.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ignore IME composition events (mobile predictive keyboard, accents, IME)
    if (e.nativeEvent.isComposing) {
      return;
    }

    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift + Enter: Insert a new line in textarea without sending, and isolate from parents
        e.stopPropagation();
        return;
      }

      // Plain Enter: Prevent default form submit/newline, stop bubbling, and submit message
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation?.();
      handleSend();
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    handleSend();
  };

  const handleSend = () => {
    if (isStreaming) {
      stopGeneration();
      return;
    }

    const trimmedInput = input.trim();
    if (!trimmedInput && attachments.length === 0) return;

    sendMessage(trimmedInput, attachments);
    setInput('');
    setAttachments([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPdf = file.name.endsWith('.pdf') || file.type.includes('pdf');
      const sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

      newAttachments.push({
        id: `att-${Date.now()}-${i}`,
        name: file.name,
        type: isPdf ? 'pdf' : 'text',
        size: sizeStr
      });
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    showToast(`Attached ${newAttachments.length} file(s)`);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleVoiceToggle = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showToast('Voice speech-to-text is not supported in this browser environment');
      return;
    }

    // Toggle speech recognition if supported
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      if (!isRecording) {
        setIsRecording(true);
        showToast('Listening... Speak now');
        recognition.start();

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
          setIsRecording(false);
        };

        recognition.onerror = () => {
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };
      } else {
        setIsRecording(false);
      }
    } catch {
      setIsRecording(false);
      showToast('Microphone access requires permission');
    }
  };

  const canSend = input.trim().length > 0 || attachments.length > 0;

  return (
    <div className="w-full max-w-[800px] mx-auto px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-5 pt-1">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept=".pdf,.doc,.docx,.txt,.md"
        className="hidden"
      />

      {/* Mode-Specific Educational Toolbar Panels */}
      {studyMode === 'exam' && <ExamPreparationPanel />}
      {studyMode === 'mcq' && <McqPracticePanel />}

      {/* Active Document Grounding Badge */}
      {activeDocument && (
        <div className="flex items-center justify-between mb-2 px-3.5 py-2 rounded-2xl bg-[#141414] border border-[#262626] text-xs text-zinc-300 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1 rounded-lg bg-[#0A0A0A] border border-[#262626] text-white flex-shrink-0">
              <FileText size={15} />
            </div>
            <div className="truncate flex items-center gap-2">
              <span className="font-medium text-white truncate max-w-[220px] sm:max-w-[360px]">
                {activeDocument.name}
              </span>
              {activeDocument.pageCount && (
                <span className="text-[10px] text-zinc-400 px-1.5 py-0.5 rounded bg-[#0A0A0A] border border-[#262626] font-mono">
                  {activeDocument.pageCount} {activeDocument.pageCount === 1 ? 'page' : 'pages'}
                </span>
              )}
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-zinc-300 font-medium bg-[#1C1C1C] px-2 py-0.5 rounded-full border border-[#262626]">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              Grounded
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setActiveModal('documents')}
              className="text-[11px] text-zinc-400 hover:text-white underline underline-offset-2 transition-colors"
            >
              Change PDF
            </button>
            <button
              type="button"
              onClick={() => setActiveDocumentId(null)}
              className="p-1 text-zinc-400 hover:text-white hover:bg-[#1C1C1C] rounded transition-colors"
              title="Detach PDF from chat"
              aria-label="Detach PDF"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* PDF Mode without selected document prompt */}
      {studyMode === 'pdf' && !activeDocument && (
        <div className="flex items-center justify-between mb-2 px-3.5 py-2 rounded-2xl bg-[#141414] border border-[#262626] text-xs text-zinc-300 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-white" />
            <span>Select or upload a study document to ground questions and notes.</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveModal('documents')}
            className="px-2.5 py-1 rounded-lg bg-white text-black hover:bg-zinc-200 font-medium text-[11px] transition-colors shadow-sm flex-shrink-0"
          >
            Select / Upload PDF
          </button>
        </div>
      )}

      {/* Floating composer container */}
      <form
        onSubmit={handleSubmit}
        className="relative rounded-[24px] bg-[#141414] border border-[#262626] focus-within:border-zinc-500 transition-all shadow-xl flex flex-col p-1.5 sm:p-2"
      >
        {/* Attached files preview chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-2.5 pt-1.5 pb-2 border-b border-[#262626]">
            {attachments.map(att => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1C1C1C] text-xs text-zinc-200 border border-[#2E2E2E]"
              >
                {att.type === 'pdf' ? (
                  <FileText size={12} className="text-white" />
                ) : (
                  <ImageIcon size={12} className="text-zinc-400" />
                )}
                <span className="truncate max-w-[120px] font-mono text-[11px]">{att.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="p-0.5 hover:text-white text-zinc-400"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Input Row */}
        <div className="flex items-end gap-1.5 sm:gap-2 px-1">
          {/* Attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 sm:p-2.5 rounded-full text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C] transition-colors flex-shrink-0 mb-0.5"
            title="Attach study documents or PDFs"
            aria-label="Attach file"
          >
            <Paperclip size={18} />
          </button>

          {/* Multiline auto-expanding textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentModeInfo.promptPlaceholder || 'Ask Ai anything...'}
            className="flex-1 bg-transparent text-[#FFFFFF] placeholder:text-[#71717A] text-[16px] sm:text-[14.5px] leading-relaxed resize-none focus:outline-none py-2 px-1 max-h-[180px] overflow-y-auto"
          />

          {/* Voice Input Button */}
          <button
            type="button"
            onClick={handleVoiceToggle}
            className={`p-2 sm:p-2.5 rounded-full transition-colors flex-shrink-0 mb-0.5 ${
              isRecording
                ? 'text-white bg-[#262626] animate-pulse ring-1 ring-white/50'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C]'
            }`}
            title={isRecording ? 'Listening...' : 'Voice input'}
            aria-label="Voice input"
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          {/* Send / Stop Generation Button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={stopGeneration}
              className="p-2.5 rounded-full bg-white text-black hover:bg-zinc-200 transition-colors flex-shrink-0 mb-0.5"
              title="Stop generating"
              aria-label="Stop generating"
            >
              <Square size={16} fill="black" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              className={`p-2 sm:p-2.5 rounded-full transition-all flex-shrink-0 mb-0.5 ${
                canSend
                  ? 'bg-white text-black hover:bg-zinc-200'
                  : 'bg-[#1C1C1C] text-[#71717A] cursor-not-allowed opacity-60 border border-[#262626]'
              }`}
              title="Send message (Enter)"
              aria-label="Send message"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </form>

      {/* Footer bar with Language Selector & Notice */}
      <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-[#71717A]">
        <div className="flex items-center gap-1.5">
          <Languages size={13} className="text-[#A1A1AA]" />
          <span className="text-[#A1A1AA]">Language:</span>
          <button
            type="button"
            onClick={() => {
              const next: StudyLanguage = language === 'english' ? 'hinglish' : 'english';
              setLanguage(next);
              showToast(`Language set to: ${next === 'hinglish' ? 'Hinglish (Hindi+English)' : 'Easy English'}`);
            }}
            className="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors border bg-[#141414] border-[#262626] text-zinc-300 hover:text-white hover:bg-[#1C1C1C]"
            title="Click to toggle between Easy English and Hinglish"
          >
            {language === 'hinglish' ? '🇮🇳 Hinglish' : '🇬🇧 Easy English'}
          </button>
        </div>

        <span className="hidden sm:inline font-normal">
          Ai can make mistakes. Verify important formulas & exam facts.
        </span>
      </div>
    </div>
  );
};
