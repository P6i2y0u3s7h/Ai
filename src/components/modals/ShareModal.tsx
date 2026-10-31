import React, { useState } from 'react';
import { Share2, X, Copy, Check, Lock } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export const ShareModal: React.FC = () => {
  const { activeModal, setActiveModal, activeConversation, showToast } = useChat();
  const [copied, setCopied] = useState(false);

  if (activeModal !== 'share') return null;

  const shareUrl = `${window.location.origin}/share/${activeConversation?.id || 'demo'}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    showToast('Share link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="w-full max-w-md bg-[#0A0A0A] border border-[#262626] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#141414] text-white border border-[#262626]">
              <Share2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Share Study Session</h2>
              <p className="text-xs text-[#A1A1AA]">Share your notes or exam preparation snapshot</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1.5 text-[#A1A1AA] hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626]">
            <p className="text-xs font-semibold text-white truncate mb-1">
              {activeConversation?.title || 'Ai Conversation'}
            </p>
            <p className="text-[11px] text-[#71717A]">
              {activeConversation?.messages.length || 0} messages included in this study snapshot.
            </p>
          </div>

          <div>
            <label className="block text-xs text-[#A1A1AA] mb-1.5 font-medium">
              Public link to chat
            </label>
            <div className="flex items-center gap-2 bg-[#111111] p-1.5 rounded-xl border border-[#262626]">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-transparent text-xs text-white px-2 focus:outline-none font-mono truncate"
              />
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-colors"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#71717A]">
            <Lock size={13} className="text-white" />
            <span>Messages are anonymous; personal credentials are never shared.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
