import React, { useState } from 'react';
import {
  Settings,
  X,
  Key,
  Palette,
  Cpu,
  Check
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { firestoreService } from '../../services/firestoreService';

export const SettingsModal: React.FC = () => {
  const { activeModal, setActiveModal, showToast } = useChat();
  const { user } = useAuth();

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('studyai_custom_api_key') || '');
  const [modelChoice, setModelChoice] = useState('Ai 4.0 Omni (Educational Fine-tuned)');
  const [themeMode, setThemeMode] = useState<'minimal' | 'oled'>('minimal');

  if (activeModal !== 'settings') return null;

  const handleSave = async () => {
    localStorage.setItem('studyai_custom_api_key', apiKey.trim());
    if (user?.uid && !user.isGuest) {
      await firestoreService.saveProfileSettings(user.uid, {
        apiKey: apiKey.trim(),
        modelChoice,
        accent: 'monochrome'
      });
    }
    showToast('Settings saved successfully');
    setActiveModal(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg bg-[#0A0A0A] border border-[#262626] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#141414] text-white border border-[#262626]">
              <Settings size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Settings & Preferences</h2>
              <p className="text-xs text-[#A1A1AA]">Configure AI model engine and display options</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1.5 text-[#A1A1AA] hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* AI Model selector */}
          <div>
            <label className="block text-xs font-semibold text-[#71717A] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Cpu size={14} className="text-white" />
              <span>Default Ai Engine</span>
            </label>
            <select
              value={modelChoice}
              onChange={e => setModelChoice(e.target.value)}
              className="w-full bg-[#111111] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none focus:border-white"
            >
              <option>Ai 4.0 Omni (Educational Fine-tuned)</option>
              <option>Ai 3.5 Turbo (High-speed exam cramming)</option>
              <option>Ai Math & Reasoning Specialist</option>
            </select>
            <p className="text-[11px] text-[#71717A] mt-1">
              Optimized for syllabus alignment, marking schemes, and pedagogical clarity.
            </p>
          </div>

          {/* Theme Mode */}
          <div>
            <label className="block text-xs font-semibold text-[#71717A] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Palette size={14} className="text-white" />
              <span>Color Aesthetic</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setThemeMode('minimal')}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs text-white transition-all ${
                  themeMode === 'minimal'
                    ? 'border-white bg-[#1C1C1C]'
                    : 'border-[#262626] bg-[#141414] hover:bg-[#1C1C1C]'
                }`}
              >
                <div className="text-left">
                  <p className="font-semibold text-white">Monochrome Dark</p>
                  <p className="text-[11px] text-[#A1A1AA]">Clean black & white surfaces</p>
                </div>
                {themeMode === 'minimal' && <Check size={14} className="text-white" />}
              </button>

              <button
                type="button"
                onClick={() => setThemeMode('oled')}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs text-white transition-all ${
                  themeMode === 'oled'
                    ? 'border-white bg-[#1C1C1C]'
                    : 'border-[#262626] bg-[#141414] hover:bg-[#1C1C1C]'
                }`}
              >
                <div className="text-left">
                  <p className="font-semibold text-white">Pure Black OLED</p>
                  <p className="text-[11px] text-[#A1A1AA]">Deep contrasts & sharp lines</p>
                </div>
                {themeMode === 'oled' && <Check size={14} className="text-white" />}
              </button>
            </div>
          </div>

          {/* Custom API Key (optional) */}
          <div>
            <label className="block text-xs font-semibold text-[#71717A] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Key size={14} className="text-white" />
              <span>Bring Your Own API Key (Optional)</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="gsk_... or sk-..."
              className="w-full bg-[#111111] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none focus:border-white font-mono placeholder:text-[#71717A]"
            />
            <p className="text-[11px] text-[#71717A] mt-1">
              By default, Ai runs with our server-side Groq educational engine. You can optionally supply your own key.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#262626] flex justify-end gap-2 bg-[#0A0A0A]">
          <button
            onClick={() => setActiveModal(null)}
            className="px-4 py-2 text-xs text-[#A1A1AA] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
