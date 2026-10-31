import React, { useState, useEffect } from 'react';
import {
  Layers, X, ChevronLeft, ChevronRight, Sparkles, Loader2,
  Check, RefreshCw, BookMarked, Plus, Trash2, Timer,
  Play, Pause, RotateCcw, AlertCircle, FileText
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { getAuthToken } from '../../services/aiClient';
import { apiUrl } from '../../utils/apiConfig';
import { FlashcardDeck, Flashcard } from '../../types/chat';

type ToolTab = 'flashcards' | 'pomodoro';

const SUBJECTS = [
  'Computer Science', 'Mathematics', 'Physics', 'Chemistry',
  'Biology', 'History', 'Economics', 'English', 'General'
];

export const StudyToolsModal: React.FC = () => {
  const {
    activeModal, setActiveModal,
    flashcardDecks, addFlashcardDeck, deleteFlashcardDeck, updateFlashcard,
    documents, showToast
  } = useChat();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<ToolTab>('flashcards');

  // ── Flashcard state ───────────────────────────────────────────────────────
  const [selectedDeckId, setSelectedDeckId]   = useState<string | null>(null);
  const [cardIndex, setCardIndex]             = useState(0);
  const [cardFlipped, setCardFlipped]         = useState(false);
  const [showCreateDeck, setShowCreateDeck]   = useState(false);
  const [deckTopic, setDeckTopic]             = useState('');
  const [deckSubject, setDeckSubject]         = useState('Computer Science');
  const [deckCount, setDeckCount]             = useState(8);
  const [selectedDocId, setSelectedDocId]     = useState<string>('');
  const [generating, setGenerating]           = useState(false);
  const [genError, setGenError]               = useState('');

  // ── Pomodoro state ────────────────────────────────────────────────────────
  const [timerSeconds, setTimerSeconds]       = useState(25 * 60);
  const [timerRunning, setTimerRunning]       = useState(false);
  const [timerMode, setTimerMode]             = useState<'focus' | 'break'>('focus');

  if (activeModal !== 'tools') return null;

  const selectedDeck = flashcardDecks.find(d => d.id === selectedDeckId) || null;
  const currentCard  = selectedDeck?.cards[cardIndex] || null;

  /* ── Pomodoro ── */
  useEffect(() => {
    let interval: any = null;
    if (timerRunning && timerSeconds > 0) {
      interval = setInterval(() => setTimerSeconds(p => p - 1), 1000);
    } else if (timerSeconds === 0) {
      setTimerRunning(false);
      showToast(timerMode === 'focus' ? 'Focus session done! Take a break.' : 'Break over — back to studying!');
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerSeconds, timerMode]);

  const formatTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const resetTimer = (mode: 'focus' | 'break' = timerMode) => {
    setTimerRunning(false);
    setTimerMode(mode);
    setTimerSeconds(mode === 'focus' ? 25 * 60 : 5 * 60);
  };

  /* ── Generate deck via Grok ── */
  const handleGenerateDeck = async () => {
    if (!deckTopic.trim() && !selectedDocId) return;
    setGenerating(true);
    setGenError('');

    try {
      const idToken = await getAuthToken();
      const selectedDoc = documents.find(d => d.id === selectedDocId);
      const effectiveTopic = deckTopic.trim() || selectedDoc?.name.replace(/\.pdf$/i, '') || 'Key Concepts';

      const docDirective = selectedDoc
        ? ` based strictly on the extracted text and concepts from the student's uploaded document "${selectedDoc.name}"`
        : '';

      const prompt = `Generate exactly ${deckCount} study flashcards on the topic: "${effectiveTopic}" for subject "${deckSubject}"${docDirective}.
Return ONLY a valid JSON array matching this exact schema (no markdown, no code fences, no extra text):
[{"front":"Key question, formula or core concept","back":"Concise, high-yield answer or definition"}]
Make each card concise, exam-focused, and memorable.`;

      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          studyMode: 'study',
          options: {
            topic: effectiveTopic,
            subject: deckSubject,
            documentId: selectedDocId || undefined
          }
        })
      });

      if (!response.ok) {
        const responseText = await response.text();
        let data: any;
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch {
          data = { error: responseText || 'Invalid server response' };
        }
        throw new Error(data.error || data.message || `Flashcard request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream available from server.');
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          try {
            const d = JSON.parse(t.replace(/^data:\s*/, ''));
            if (d.error) throw new Error(d.error);
            if (d.fullText) fullText = d.fullText;
            else if (d.delta) fullText += d.delta;
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }

      const jsonMatch = fullText.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) throw new Error('Could not parse flashcards from AI response.');
      const raw: Array<{ front: string; back: string }> = JSON.parse(jsonMatch[0]);

      const cards: Flashcard[] = raw.map((c, i) => ({
        id:          `card-${Date.now()}-${i}`,
        front:       c.front,
        back:        c.back,
        status:      'new',
        reviewCount: 0
      }));

      const deck: FlashcardDeck = {
        id:          `deck-${Date.now()}`,
        userId:      user?.uid,
        title:       `${deckSubject}: ${effectiveTopic}`,
        topic:       effectiveTopic,
        subject:     deckSubject,
        sourceDocId: selectedDocId || undefined,
        createdAt:   Date.now(),
        cards
      };

      addFlashcardDeck(deck);
      setSelectedDeckId(deck.id);
      setCardIndex(0);
      setCardFlipped(false);
      setShowCreateDeck(false);
      setDeckTopic('');
      setSelectedDocId('');
      showToast(`Flashcard deck "${deck.title}" created!`);
    } catch (err: any) {
      setGenError(err.message || 'Failed to generate flashcards. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  /* ── Card navigation ── */
  const prevCard = () => { setCardIndex(p => Math.max(0, p - 1)); setCardFlipped(false); };
  const nextCard = () => { if (!selectedDeck) return; setCardIndex(p => Math.min(selectedDeck.cards.length - 1, p + 1)); setCardFlipped(false); };

  const markCard = (status: Flashcard['status']) => {
    if (!selectedDeck || !currentCard) return;
    updateFlashcard(selectedDeck.id, currentCard.id, status);
    if (cardIndex < selectedDeck.cards.length - 1) {
      nextCard();
    } else {
      showToast('Deck complete! Great job.');
    }
  };

  /* ── Reset Deck to review again ── */
  const handleResetDeckProgress = () => {
    if (!selectedDeck) return;
    const resetCards = selectedDeck.cards.map(c => ({
      ...c,
      status: 'new' as const,
      reviewCount: (c.reviewCount || 0) + 1
    }));
    const updated = { ...selectedDeck, cards: resetCards };
    addFlashcardDeck(updated);
    setCardIndex(0);
    setCardFlipped(false);
    showToast('Deck reset: Ready to review again!');
  };

  /* ── Flashcards tab ── */
  const renderFlashcards = () => {
    if (showCreateDeck) {
      return (
        <div className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Generate Flashcard Deck</h3>

          {documents.filter(d => d.status === 'ready').length > 0 && (
            <div>
              <label className="text-xs text-[#A1A1AA] mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-white">
                  <FileText size={13} className="text-white" />
                  Source: Processed Document (Optional)
                </span>
                {selectedDocId && (
                  <button
                    type="button"
                    onClick={() => setSelectedDocId('')}
                    className="text-[10px] text-[#A1A1AA] hover:text-white"
                  >
                    Clear Document
                  </button>
                )}
              </label>
              <select
                value={selectedDocId}
                onChange={e => {
                  const id = e.target.value;
                  setSelectedDocId(id);
                  const found = documents.find(d => d.id === id);
                  if (found && !deckTopic) {
                    setDeckTopic(found.name.replace(/\.pdf$/i, ''));
                  }
                }}
                className="w-full bg-[#111111] text-xs text-white px-3 py-2.5 rounded-xl border border-[#262626] focus:outline-none focus:border-white"
              >
                <option value="">None (Generate from Topic prompt)</option>
                {documents
                  .filter(d => d.status === 'ready')
                  .map(doc => (
                    <option key={doc.id} value={doc.id}>
                      📄 {doc.name} ({doc.pageCount || doc.pages || '?'} pages)
                    </option>
                  ))}
              </select>
              <p className="text-[10px] text-[#71717A] mt-1">
                Ai will extract flashcard terms and definitions directly from this uploaded document.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs text-[#A1A1AA] mb-1.5 block">
              {selectedDocId ? 'Specific Chapter / Topic in Document' : 'Topic *'}
            </label>
            <input
              type="text"
              value={deckTopic}
              onChange={e => setDeckTopic(e.target.value)}
              placeholder="e.g. Binary Search Trees, Virtual Memory, Cell Division…"
              className="w-full bg-[#111111] text-sm text-white px-3.5 py-2.5 rounded-xl border border-[#262626] focus:outline-none focus:border-white placeholder:text-[#71717A]"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#A1A1AA] mb-1.5 block">Subject</label>
              <select
                value={deckSubject}
                onChange={e => setDeckSubject(e.target.value)}
                className="w-full bg-[#111111] text-xs text-white px-3 py-2.5 rounded-xl border border-[#262626] focus:outline-none focus:border-white"
              >
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#A1A1AA] mb-1.5 block">Cards: <span className="text-white font-mono">{deckCount}</span></label>
              <input type="range" min={4} max={20} step={1} value={deckCount} onChange={e => setDeckCount(Number(e.target.value))} className="w-full accent-white mt-1.5" />
            </div>
          </div>

          {genError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#1C1C1C] border border-[#262626] text-xs text-white">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-[#A1A1AA]" />{genError}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => { setShowCreateDeck(false); setGenError(''); }} className="flex-1 py-2 rounded-xl text-xs text-[#A1A1AA] hover:text-white bg-[#141414] border border-[#262626] hover:bg-[#1C1C1C] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleGenerateDeck}
              disabled={(!deckTopic.trim() && !selectedDocId) || generating}
              className="flex-1 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 disabled:opacity-40 flex items-center justify-center gap-1.5 transition-colors"
            >
              {generating ? <><Loader2 size={14} className="animate-spin" />Generating…</> : <><Sparkles size={14} />Generate {deckCount} Cards</>}
            </button>
          </div>
        </div>
      );
    }

    if (selectedDeck && currentCard) {
      const known    = selectedDeck.cards.filter(c => c.status === 'mastered').length;
      const learning = selectedDeck.cards.filter(c => c.status === 'learning').length;
      const remaining = selectedDeck.cards.filter(c => c.status === 'new').length;
      const isAtEnd = cardIndex === selectedDeck.cards.length - 1;

      return (
        <div className="p-5 flex flex-col items-center space-y-4">
          {/* Deck header */}
          <div className="w-full flex items-center justify-between">
            <button onClick={() => { setSelectedDeckId(null); setCardFlipped(false); }} className="text-xs text-[#A1A1AA] hover:text-white flex items-center gap-1">
              <ChevronLeft size={14} /> Decks
            </button>
            <div className="text-xs text-white font-mono">
              Card {cardIndex + 1} / {selectedDeck.cards.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetDeckProgress}
                className="text-xs text-[#A1A1AA] hover:text-white flex items-center gap-1"
                title="Reset all cards to review again"
              >
                <RotateCcw size={12} /> Reset
              </button>
              <button onClick={() => deleteFlashcardDeck(selectedDeck.id)} className="text-xs text-[#71717A] hover:text-white" title="Delete deck">
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Progress pills */}
          <div className="flex gap-2 w-full">
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white text-black font-semibold">✓ Mastered: {known}</span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#1C1C1C] text-zinc-300 border border-[#262626]">~ Learning: {learning}</span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#141414] text-[#71717A] border border-[#262626]">New: {remaining}</span>
          </div>

          {/* Flip card */}
          <div
            onClick={() => setCardFlipped(p => !p)}
            className="w-full min-h-[190px] rounded-2xl bg-[#141414] border border-[#262626] hover:border-zinc-500 transition-all cursor-pointer p-6 flex flex-col justify-center items-center text-center relative shadow-lg select-none"
          >
            <span className="absolute top-3 left-3 text-[10px] font-mono px-2 py-0.5 rounded bg-[#1C1C1C] text-white uppercase border border-[#262626]">
              {cardFlipped ? 'Answer' : 'Question'}
            </span>
            {currentCard.status !== 'new' && (
              <span className={`absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full font-medium ${currentCard.status === 'mastered' ? 'bg-white text-black font-semibold' : 'bg-[#1C1C1C] text-zinc-300 border border-[#262626]'}`}>
                {currentCard.status}
              </span>
            )}
            <p className="text-sm sm:text-base font-medium text-white leading-relaxed mt-3">
              {cardFlipped ? currentCard.back : currentCard.front}
            </p>
            <p className="text-[10px] text-[#71717A] mt-4 flex items-center gap-1">
              <RefreshCw size={10} /> click to flip card
            </p>
          </div>

          {/* Action buttons: Mark Known vs Still Learning */}
          {cardFlipped ? (
            <div className="flex gap-2 w-full">
              <button onClick={() => markCard('learning')} className="flex-1 py-2.5 rounded-xl bg-[#1C1C1C] text-white text-xs font-semibold border border-[#262626] hover:bg-[#262626] flex items-center justify-center gap-1.5 transition-colors">
                <RefreshCw size={13} /> Still Learning
              </button>
              <button onClick={() => markCard('mastered')} className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 flex items-center justify-center gap-1.5 transition-colors">
                <Check size={13} /> Got It (Known)
              </button>
            </div>
          ) : (
            <button onClick={() => setCardFlipped(true)} className="px-6 py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors">
              Flip to Check Answer
            </button>
          )}

          {/* Nav & Review Again buttons */}
          <div className="flex items-center gap-3 w-full justify-center pt-1">
            <button onClick={prevCard} disabled={cardIndex === 0} className="p-2 rounded-xl bg-[#141414] text-white hover:bg-[#1C1C1C] border border-[#262626] disabled:opacity-30">
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => { setCardIndex(0); setCardFlipped(false); }}
              className="text-xs text-[#A1A1AA] hover:text-white px-3 py-1.5 rounded-xl bg-[#141414] border border-[#262626] hover:bg-[#1C1C1C] flex items-center gap-1 transition-colors"
            >
              <RotateCcw size={12} /> Review Again
            </button>
            <button onClick={nextCard} disabled={isAtEnd} className="p-2 rounded-xl bg-[#141414] text-white hover:bg-[#1C1C1C] border border-[#262626] disabled:opacity-30">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      );
    }

    // Deck list
    return (
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-[#71717A]">{flashcardDecks.length} deck{flashcardDecks.length !== 1 ? 's' : ''}</p>
          <button
            onClick={() => { setShowCreateDeck(true); setGenError(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors"
          >
            <Plus size={13} /> New Deck
          </button>
        </div>

        {flashcardDecks.length === 0 ? (
          <div className="py-14 text-center">
            <Layers size={32} className="mx-auto mb-3 opacity-40 text-white" />
            <p className="text-white text-sm font-medium">No flashcard decks yet</p>
            <p className="text-[#71717A] text-xs mt-1">Click "New Deck" to generate one with Ai.</p>
          </div>
        ) : (
          flashcardDecks.map(deck => {
            const mastered = deck.cards.filter(c => c.status === 'mastered').length;
            const pct = Math.round((mastered / deck.cards.length) * 100);
            return (
              <button
                key={deck.id}
                onClick={() => { setSelectedDeckId(deck.id); setCardIndex(0); setCardFlipped(false); }}
                className="w-full p-4 rounded-xl bg-[#141414] border border-[#262626] hover:border-zinc-500 hover:bg-[#1C1C1C] text-left transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{deck.title}</p>
                    <p className="text-[11px] text-[#71717A]">{deck.cards.length} cards · {new Date(deck.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <span className="text-[11px] text-white font-mono">{pct}% done</span>
                </div>
                <div className="h-1 bg-[#1C1C1C] rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })
        )}
      </div>
    );
  };

  /* ── Pomodoro tab ── */
  const renderPomodoro = () => (
    <div className="p-6 flex flex-col items-center justify-center text-center space-y-6">
      <div className="flex gap-2">
        <button
          onClick={() => resetTimer('focus')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${timerMode === 'focus' ? 'bg-white text-black' : 'bg-[#141414] text-[#71717A] hover:text-white border border-[#262626]'}`}
        >
          25m Study
        </button>
        <button
          onClick={() => resetTimer('break')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${timerMode === 'break' ? 'bg-white text-black' : 'bg-[#141414] text-[#71717A] hover:text-white border border-[#262626]'}`}
        >
          5m Break
        </button>
      </div>

      {/* Circular timer visual */}
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#1C1C1C" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="52" fill="none"
            stroke="#FFFFFF"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 52}
            strokeDashoffset={2 * Math.PI * 52 * (1 - timerSeconds / (timerMode === 'focus' ? 25 * 60 : 5 * 60))}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-mono font-bold text-white tracking-widest">{formatTimer(timerSeconds)}</span>
          <span className="text-[10px] text-[#71717A] mt-1 uppercase tracking-wider">{timerMode === 'focus' ? 'Focus' : 'Break'}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setTimerRunning(p => !p)}
          className="px-7 py-2.5 rounded-xl bg-white text-black font-semibold text-xs flex items-center gap-2 hover:bg-zinc-200 transition-colors shadow-lg"
        >
          {timerRunning ? <><Pause size={16} />Pause</> : <><Play size={16} />Start</>}
        </button>
        <button
          onClick={() => resetTimer()}
          className="p-2.5 rounded-xl bg-[#141414] text-white hover:bg-[#1C1C1C] transition-colors border border-[#262626]"
          title="Reset"
        >
          <RotateCcw size={16} />
        </button>
      </div>
      <p className="text-xs text-[#71717A]">{timerMode === 'focus' ? 'Deep concentration block · stay off distractions' : 'Hydrate, stretch, and rest your eyes'}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="w-full max-w-xl bg-[#0A0A0A] border border-[#262626] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#141414] text-white border border-[#262626]">
              <Layers size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Study Tools</h2>
              <p className="text-xs text-[#A1A1AA]">Flashcards & Pomodoro timer</p>
            </div>
          </div>
          <button onClick={() => setActiveModal(null)} className="p-1.5 text-[#A1A1AA] hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-[#262626] px-4 bg-[#0A0A0A]">
          {([
            { key: 'flashcards', label: 'Smart Flashcards', icon: <BookMarked size={13} /> },
            { key: 'pomodoro',   label: 'Pomodoro Timer',   icon: <Timer size={13} /> },
          ] as { key: ToolTab; label: string; icon: React.ReactNode }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 py-3 px-3 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-white text-white font-semibold' : 'border-transparent text-[#71717A] hover:text-white'}`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'flashcards' && renderFlashcards()}
          {activeTab === 'pomodoro'   && renderPomodoro()}
        </div>
      </div>
    </div>
  );
};
