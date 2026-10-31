import React from 'react';
import {
  Sparkles,
  Lightbulb,
  Languages,
  ListOrdered,
  FileCheck2
} from 'lucide-react';
import { PersonalizationAction, Message } from '../../types/chat';
import { useChat } from '../../context/ChatContext';

interface PersonalizationPillsProps {
  message: Message;
}

export const PersonalizationPills: React.FC<PersonalizationPillsProps> = ({ message }) => {
  const { triggerPersonalization, isStreaming } = useChat();

  // Don't show pills while the response is streaming or on error messages
  if (message.isStreaming || message.status === 'error' || !message.content) {
    return null;
  }

  const actions: Array<{
    id: PersonalizationAction;
    label: string;
    icon: React.ReactNode;
    hoverColor: string;
  }> = [
    {
      id: 'simplify',
      label: 'Explain more simply',
      icon: <Sparkles size={12} className="text-white" />,
      hoverColor: 'hover:border-zinc-500 hover:bg-[#1C1C1C] text-zinc-300 hover:text-white'
    },
    {
      id: 'example',
      label: 'Give an example',
      icon: <Lightbulb size={12} className="text-white" />,
      hoverColor: 'hover:border-zinc-500 hover:bg-[#1C1C1C] text-zinc-300 hover:text-white'
    },
    {
      id: 'hinglish',
      label: 'Explain in Hinglish',
      icon: <Languages size={12} className="text-white" />,
      hoverColor: 'hover:border-zinc-500 hover:bg-[#1C1C1C] text-zinc-300 hover:text-white'
    },
    {
      id: 'summarize',
      label: 'Summarize this answer',
      icon: <ListOrdered size={12} className="text-white" />,
      hoverColor: 'hover:border-zinc-500 hover:bg-[#1C1C1C] text-zinc-300 hover:text-white'
    },
    {
      id: 'revision-notes',
      label: 'Create revision notes',
      icon: <FileCheck2 size={12} className="text-white" />,
      hoverColor: 'hover:border-zinc-500 hover:bg-[#1C1C1C] text-zinc-300 hover:text-white'
    }
  ];

  return (
    <div className="mt-2.5 pt-2 border-t border-[#262626] flex items-center gap-1.5 flex-wrap select-none">
      <span className="text-[10.5px] font-mono text-[#71717A] uppercase tracking-wider mr-1">
        Ai Actions:
      </span>
      {actions.map(action => (
        <button
          key={action.id}
          type="button"
          disabled={isStreaming}
          onClick={() => triggerPersonalization(action.id, message)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#141414] border border-[#262626] flex items-center gap-1.5 transition-all shadow-sm ${action.hoverColor} ${
            isStreaming ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
          }`}
          title={`Click to ask Ai: ${action.label}`}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
};
