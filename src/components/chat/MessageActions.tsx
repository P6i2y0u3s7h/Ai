import React, { useState } from 'react';
import {
  Copy,
  Check,
  RotateCw,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  BookmarkCheck,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Message } from '../../types/chat';
import { useChat } from '../../context/ChatContext';

interface MessageActionsProps {
  message: Message;
}

export const MessageActions: React.FC<MessageActionsProps> = ({ message }) => {
  const { regenerateMessage, setMessageFeedback, saveMessageToNotes, showToast } = useChat();
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    showToast('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSpeak = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        const utterance = new SpeechSynthesisUtterance(message.content.replace(/[#*`$\-\|]/g, ''));
        utterance.rate = 1.0;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
      }
    } else {
      showToast('Text-to-speech not supported in this browser');
    }
  };

  return (
    <div className="flex items-center gap-1 mt-2 text-[#71717A] select-none">
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-lg hover:text-white hover:bg-[#1C1C1C] transition-colors"
        title="Copy response"
        aria-label="Copy response"
      >
        {copied ? <Check size={14} className="text-white" /> : <Copy size={14} />}
      </button>

      {/* Save to Notes */}
      <button
        onClick={() => saveMessageToNotes(message)}
        className={`p-1.5 rounded-lg transition-colors ${
          message.savedToNotes
            ? 'text-white bg-[#1C1C1C] border border-[#262626]'
            : 'hover:text-white hover:bg-[#1C1C1C]'
        }`}
        title={message.savedToNotes ? 'Saved in My Notes' : 'Save to My Notes'}
        aria-label="Save to My Notes"
      >
        {message.savedToNotes ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
      </button>

      {/* Regenerate */}
      <button
        onClick={() => regenerateMessage(message.id)}
        className="p-1.5 rounded-lg hover:text-white hover:bg-[#1C1C1C] transition-colors"
        title="Regenerate response"
        aria-label="Regenerate response"
      >
        <RotateCw size={14} />
      </button>

      {/* Text to Speech */}
      <button
        onClick={handleToggleSpeak}
        className={`p-1.5 rounded-lg transition-colors ${
          isSpeaking ? 'text-white bg-[#1C1C1C] border border-[#262626]' : 'hover:text-white hover:bg-[#1C1C1C]'
        }`}
        title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
        aria-label="Read aloud"
      >
        {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>

      {/* Thumbs up */}
      <button
        onClick={() => setMessageFeedback(message.id, 'up')}
        className={`p-1.5 rounded-lg transition-colors ${
          message.feedback === 'up'
            ? 'text-white bg-[#1C1C1C] border border-[#262626]'
            : 'hover:text-white hover:bg-[#1C1C1C]'
        }`}
        title="Helpful response"
        aria-label="Helpful response"
      >
        <ThumbsUp size={14} />
      </button>

      {/* Thumbs down */}
      <button
        onClick={() => setMessageFeedback(message.id, 'down')}
        className={`p-1.5 rounded-lg transition-colors ${
          message.feedback === 'down'
            ? 'text-white bg-[#1C1C1C] border border-[#262626]'
            : 'hover:text-white hover:bg-[#1C1C1C]'
        }`}
        title="Unhelpful response"
        aria-label="Unhelpful response"
      >
        <ThumbsDown size={14} />
      </button>
    </div>
  );
};
