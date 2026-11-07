import React, { useState, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen, X, Trash2, Copy, Check, Search,
  Plus, Edit2, Save, Tag, Filter, Sparkles,
  Download, FileText, HelpCircle, Layers,
  ChevronDown, ChevronUp, Eye, EyeOff, Loader2,
  Heading1, Heading2, Bold, Italic, List, ListOrdered,
  Code2, Quote, Minus, GraduationCap, Languages, FileDown
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { StudyNote } from '../../types/chat';
import { notesAiService, GeneratedQuestions, GeneratedFlashcard } from '../../services/notesAiService';
import { downloadNoteAsTxt, downloadNoteAsPdf } from '../../utils/noteExport';
import { firestoreService } from '../../services/firestoreService';
import { useAuth } from '../../context/AuthContext';

const SUBJECT_COLORS: Record<string, string> = {
  'General':          'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'Computer Science': 'bg-[#1C1C1C] text-white border-zinc-600',
  'Mathematics':      'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'Physics':          'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'Chemistry':        'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'Biology':          'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'Engineering':      'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'Economics':        'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'History':          'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'English':          'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'Other':            'bg-[#1C1C1C] text-zinc-300 border-[#262626]'
};

const SUBJECTS = [
  'General',
  'Computer Science',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Engineering',
  'Economics',
  'History',
  'English',
  'Other'
];

const SEMESTERS = [
  'All Semesters',
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8'
];

interface NoteFormState {
  title: string;
  topic: string;
  subject: string;
  semester: string;
  content: string;
  tags: string;
}

const defaultForm = (): NoteFormState => ({
  title: '',
  topic: '',
  subject: 'General',
  semester: 'All Semesters',
  content: '',
  tags: ''
});

type ActiveAiTool = 'generate' | 'summary' | 'explain' | 'questions' | 'flashcards' | null;

export const NotesModal: React.FC = () => {
  const { activeModal, setActiveModal, notes, deleteNote, showToast, addNote, updateNote } = useChat();
  const { user } = useAuth();

  const [filter, setFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [semesterFilter, setSemesterFilter] = useState<string>('All Semesters');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NoteFormState>(defaultForm());

  // AI features state
  const [activeAiTool, setActiveAiTool] = useState<ActiveAiTool>(null);
  const [targetNote, setTargetNote] = useState<StudyNote | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResultText, setAiResultText] = useState<string>('');
  const [aiQuestions, setAiQuestions] = useState<GeneratedQuestions | null>(null);
  const [aiFlashcards, setAiFlashcards] = useState<GeneratedFlashcard[] | null>(null);
  const [aiTopicInput, setAiTopicInput] = useState('');
  const [aiSubjectInput, setAiSubjectInput] = useState('Computer Science');
  const [aiSemesterInput, setAiSemesterInput] = useState('All Semesters');

  if (activeModal !== 'notes') return null;

  // Filtered notes based on Search, Subject, and Semester
  const filteredNotes = useMemo(() => {
    return (notes || []).filter(n => {
      if (!n) return false;
      const q = (filter || '').toLowerCase().trim();
      const nTitle = (n.title || '').toLowerCase();
      const nTopic = (n.topic || '').toLowerCase();
      const nContent = (n.content || '').toLowerCase();
      const nSemester = (n.semester || '').toLowerCase();
      const nTags = Array.isArray(n.tags) ? n.tags : [];

      const matchesText =
        !q ||
        nTitle.includes(q) ||
        nTopic.includes(q) ||
        nContent.includes(q) ||
        nSemester.includes(q) ||
        nTags.some(t => typeof t === 'string' && t.toLowerCase().includes(q));

      const matchesSubject = subjectFilter === 'All' || (n.subject || 'General') === subjectFilter;
      const matchesSemester =
        semesterFilter === 'All Semesters' ||
        (n.semester && n.semester === semesterFilter) ||
        (!n.semester && semesterFilter === 'All Semesters');

      return matchesText && matchesSubject && matchesSemester;
    });
  }, [notes, filter, subjectFilter, semesterFilter]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Note copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startEdit = (note: StudyNote) => {
    setEditingId(note.id);
    setCreating(false);
    setForm({
      title: note.title || '',
      topic: note.topic || '',
      subject: note.subject || 'General',
      semester: note.semester || 'All Semesters',
      content: note.content || '',
      tags: Array.isArray(note.tags) ? note.tags.join(', ') : ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCreating(false);
    setForm(defaultForm());
  };

  const handleSaveEdit = () => {
    if (!editingId || !form.title.trim()) return;
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    updateNote(editingId, {
      title: form.title.trim(),
      topic: form.topic.trim(),
      subject: form.subject,
      semester: form.semester,
      content: form.content.trim(),
      tags
    });
    cancelEdit();
  };

  const handleCreateNote = () => {
    if (!form.title.trim()) return;
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    addNote({
      title: form.title.trim(),
      topic: form.topic.trim(),
      subject: form.subject,
      semester: form.semester,
      content: form.content.trim(),
      tags
    });
    cancelEdit();
  };

  const startCreate = () => {
    setCreating(true);
    setEditingId(null);
    setForm(defaultForm());
  };

  // ── AI Handlers ───────────────────────────────────────────────────────────
  const handleOpenAiGenerate = () => {
    setActiveAiTool('generate');
    setAiTopicInput('');
    setAiResultText('');
    setAiQuestions(null);
    setAiFlashcards(null);
  };

  const handleRunAiGenerate = async () => {
    if (!aiTopicInput.trim()) {
      showToast('Please enter a topic to generate notes for');
      return;
    }
    setIsAiLoading(true);
    try {
      const generated = await notesAiService.generateNotes(
        aiTopicInput.trim(),
        aiSubjectInput,
        aiSemesterInput
      );
      setForm({
        title: aiTopicInput.trim(),
        topic: aiTopicInput.trim(),
        subject: aiSubjectInput,
        semester: aiSemesterInput,
        content: generated,
        tags: 'ai-generated, exam-prep'
      });
      setCreating(true);
      setActiveAiTool(null);
      showToast('AI Study Notes generated! Review and save.');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate AI notes');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleRunSummarize = async (note: StudyNote) => {
    setTargetNote(note);
    setActiveAiTool('summary');
    setIsAiLoading(true);
    setAiResultText('');
    try {
      const result = await notesAiService.summarizeNote(note.title, note.content);
      setAiResultText(result);
      showToast('Summary generated!');
    } catch (err: any) {
      showToast(err.message || 'Failed to summarize note');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleRunExplain = async (note: StudyNote, lang: 'english' | 'hinglish') => {
    setTargetNote(note);
    setActiveAiTool('explain');
    setIsAiLoading(true);
    setAiResultText('');
    try {
      const result = await notesAiService.explainConcept(note.title, note.content, lang);
      setAiResultText(result);
      showToast(lang === 'hinglish' ? 'Hinglish explanation generated!' : 'Simplified explanation generated!');
    } catch (err: any) {
      showToast(err.message || 'Failed to explain note');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleRunQuestions = async (note: StudyNote) => {
    setTargetNote(note);
    setActiveAiTool('questions');
    setIsAiLoading(true);
    setAiQuestions(null);
    try {
      const result = await notesAiService.generateQuestions(note.title, note.content);
      setAiQuestions(result);
      showToast('Exam questions generated!');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate questions');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleRunFlashcards = async (note: StudyNote) => {
    setTargetNote(note);
    setActiveAiTool('flashcards');
    setIsAiLoading(true);
    setAiFlashcards(null);
    try {
      const cards = await notesAiService.generateFlashcards(note.title, note.content);
      setAiFlashcards(cards);

      // Automatically persist into the user's Firestore flashcards collection
      if (user?.uid && !user.isGuest) {
        await firestoreService.saveFlashcardDeck(user.uid, {
          id: `deck-${Date.now()}`,
          userId: user.uid,
          title: `${note.title} (Revision Deck)`,
          topic: note.topic || note.title,
          subject: note.subject || 'General',
          createdAt: Date.now(),
          cards: cards.map((c, i) => ({
            id: `card-${Date.now()}-${i}`,
            front: c.front,
            back: c.back,
            status: 'new'
          }))
        });
        showToast('Converted & saved to Study Tools Flashcards!');
      } else {
        showToast('Flashcards generated!');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to generate flashcards');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveAiResultAsNewNote = () => {
    if (!aiResultText.trim()) return;
    addNote({
      title: `${targetNote?.title || 'Concept'} (${activeAiTool === 'summary' ? 'Summary' : 'Explanation'})`,
      topic: targetNote?.topic || '',
      subject: targetNote?.subject || 'General',
      semester: targetNote?.semester || 'All Semesters',
      content: aiResultText,
      tags: ['ai-notes', activeAiTool || 'study']
    });
    setActiveAiTool(null);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md"
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          setActiveModal(null);
        }
      }}
    >
      <div className="w-full max-w-4xl bg-[#0A0A0A] border border-[#262626] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* ── Top Header ── */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#262626] bg-[#0A0A0A]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#141414] text-white border border-[#262626]">
              <BookOpen size={19} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Study Notes</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#1C1C1C] text-zinc-300 border border-[#262626]">
                  {notes.length}
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA] hidden sm:block">
                AI-powered curriculum notes, exam questions, flashcards & export
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAiGenerate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1C1C] hover:bg-[#262626] text-white border border-[#333333] text-xs font-semibold transition-all shadow-sm"
              title="Generate comprehensive notes with AI"
            >
              <Sparkles size={13} className="text-white" />
              <span className="hidden sm:inline">AI Generate</span>
            </button>

            <button
              type="button"
              onClick={startCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors shadow-sm"
            >
              <Plus size={14} />
              <span>New Note</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors"
              aria-label="Close notes modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Search Bar & Filter Controls ── */}
        <div className="px-4 sm:px-6 py-3 border-b border-[#262626] bg-[#0D0D0D] flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141414] border border-[#262626] focus-within:border-zinc-500">
            <Search size={14} className="text-[#71717A] flex-shrink-0" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              placeholder="Search by title, topic, semester, content, or #tag..."
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-[#71717A] focus:outline-none"
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter('')}
                className="p-1 text-zinc-400 hover:text-white text-xs"
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Semester Selector */}
          <div className="flex items-center gap-1">
            <select
              value={semesterFilter}
              onChange={e => setSemesterFilter(e.target.value)}
              className="bg-[#141414] text-xs text-zinc-300 border border-[#262626] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-zinc-500 font-medium"
            >
              {SEMESTERS.map(sem => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>

          {/* Subject Selector */}
          <div className="flex items-center gap-1">
            <select
              value={subjectFilter}
              onChange={e => setSubjectFilter(e.target.value)}
              className="bg-[#141414] text-xs text-zinc-300 border border-[#262626] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-zinc-500 font-medium"
            >
              <option value="All">All Subjects</option>
              {SUBJECTS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── AI Generator Drawer (When Active) ── */}
        {activeAiTool === 'generate' && (
          <div className="p-4 sm:p-5 bg-[#121212] border-b border-[#262626] animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Sparkles size={14} className="text-white" />
                <span>AI Study Notes Generator</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveAiTool(null)}
                className="text-zinc-400 hover:text-white text-xs"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
              <div className="sm:col-span-1">
                <label className="text-[11px] text-[#A1A1AA] block mb-1 font-mono">Topic / Chapter Name</label>
                <input
                  type="text"
                  value={aiTopicInput}
                  onChange={e => setAiTopicInput(e.target.value)}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleRunAiGenerate();
                    }
                  }}
                  placeholder="e.g. Binary Search Trees, ACID Properties..."
                  className="w-full bg-[#181818] text-xs text-white px-3 py-2 rounded-xl border border-[#2E2E2E] focus:outline-none focus:border-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] text-[#A1A1AA] block mb-1 font-mono">Subject</label>
                <select
                  value={aiSubjectInput}
                  onChange={e => setAiSubjectInput(e.target.value)}
                  className="w-full bg-[#181818] text-xs text-white px-3 py-2 rounded-xl border border-[#2E2E2E] focus:outline-none"
                >
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[#A1A1AA] block mb-1 font-mono">Semester</label>
                <select
                  value={aiSemesterInput}
                  onChange={e => setAiSemesterInput(e.target.value)}
                  className="w-full bg-[#181818] text-xs text-white px-3 py-2 rounded-xl border border-[#2E2E2E] focus:outline-none"
                >
                  {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isAiLoading || !aiTopicInput.trim()}
                onClick={handleRunAiGenerate}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 disabled:opacity-50 transition-all shadow-sm"
              >
                {isAiLoading ? <Loader2 size={13} className="animate-spin text-black" /> : <Sparkles size={13} />}
                <span>{isAiLoading ? 'Synthesizing Curriculum Notes...' : 'Generate Notes'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── AI Modal Tool Output (Summary / Explain / Questions / Flashcards) ── */}
        {(activeAiTool === 'summary' || activeAiTool === 'explain' || activeAiTool === 'questions' || activeAiTool === 'flashcards') && (
          <div className="p-4 sm:p-5 bg-[#121212] border-b border-[#262626] max-h-[45vh] overflow-y-auto animate-in fade-in">
            <div className="flex items-center justify-between mb-3 border-b border-[#262626] pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Sparkles size={14} className="text-white" />
                <span className="capitalize">{activeAiTool} for: {targetNote?.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveAiTool(null)}
                className="p-1 text-zinc-400 hover:text-white rounded"
              >
                <X size={14} />
              </button>
            </div>

            {isAiLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-zinc-400">
                <Loader2 size={20} className="animate-spin text-white" />
                <span>AI Tutor is thinking & formatting response...</span>
              </div>
            ) : (
              <>
                {/* Text Result (Summary / Explain) */}
                {(activeAiTool === 'summary' || activeAiTool === 'explain') && (
                  <div>
                    <div className="prose prose-invert prose-xs max-w-none bg-[#161616] p-3.5 rounded-xl border border-[#262626] font-sans leading-relaxed text-zinc-200 mb-3">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResultText}</ReactMarkdown>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy('ai-result', aiResultText)}
                        className="px-3 py-1.5 text-xs rounded-xl bg-[#1C1C1C] text-white border border-[#2E2E2E] hover:bg-[#262626]"
                      >
                        Copy Result
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveAiResultAsNewNote}
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white text-black hover:bg-zinc-200"
                      >
                        Save as Separate Note
                      </button>
                    </div>
                  </div>
                )}

                {/* Exam Questions Result */}
                {activeAiTool === 'questions' && aiQuestions && (
                  <div className="space-y-4 text-xs">
                    {/* MCQs */}
                    {aiQuestions.mcqs.length > 0 && (
                      <div className="space-y-2">
                        <span className="font-semibold text-white uppercase text-[11px] tracking-wider block">
                          Multiple Choice Questions:
                        </span>
                        {aiQuestions.mcqs.map((q, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-[#161616] border border-[#262626] space-y-1.5">
                            <p className="font-medium text-white">{idx + 1}. {q.question}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-zinc-300">
                              {q.options.map((opt, optIdx) => (
                                <div key={optIdx} className="px-2 py-1 rounded bg-[#0F0F0F] border border-[#262626]">
                                  {opt}
                                </div>
                              ))}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-1">
                              <strong>Answer:</strong> {q.answer} — <span className="italic">{q.explanation}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Short Questions */}
                    {aiQuestions.shortQuestions.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-[#262626]">
                        <span className="font-semibold text-white uppercase text-[11px] tracking-wider block">
                          Short Answer Questions (2 Marks):
                        </span>
                        {aiQuestions.shortQuestions.map((sq, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-[#161616] border border-[#262626]">
                            <p className="font-medium text-white">Q{idx + 1}: {sq.question}</p>
                            <p className="text-zinc-300 mt-1"><strong>Ans:</strong> {sq.answer}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Long Questions */}
                    {aiQuestions.longQuestions.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-[#262626]">
                        <span className="font-semibold text-white uppercase text-[11px] tracking-wider block">
                          Long Descriptive Questions (5-10 Marks):
                        </span>
                        {aiQuestions.longQuestions.map((lq, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-[#161616] border border-[#262626]">
                            <p className="font-medium text-white">Q{idx + 1}: {lq.question}</p>
                            <ul className="list-disc list-inside text-zinc-300 mt-1 space-y-0.5">
                              {lq.keyPoints.map((kp, kIdx) => (
                                <li key={kIdx}>{kp}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Flashcards Result */}
                {activeAiTool === 'flashcards' && aiFlashcards && (
                  <div>
                    <p className="text-xs text-zinc-400 mb-3">
                      Generated {aiFlashcards.length} revision cards. (Saved directly to your Study Tools!)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {aiFlashcards.map((c, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-[#161616] border border-[#262626] text-xs">
                          <p className="font-semibold text-white mb-1.5">Q: {c.front}</p>
                          <p className="text-zinc-300 pt-1.5 border-t border-[#262626]">A: {c.back}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Create / Edit Note Form ── */}
        {(creating || editingId) && (
          <NoteRichEditor
            form={form}
            setForm={setForm}
            subjects={SUBJECTS}
            semesters={SEMESTERS}
            onSave={editingId ? handleSaveEdit : handleCreateNote}
            onCancel={cancelEdit}
            saveLabel={editingId ? 'Save Changes' : 'Create Note'}
          />
        )}

        {/* ── Notes List Container ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
          {filteredNotes.length === 0 && !creating && !editingId ? (
            <div className="py-16 text-center text-[#71717A] text-sm">
              <BookOpen size={36} className="mx-auto mb-3 opacity-30 text-white" />
              <p className="font-semibold text-white text-base">
                {notes.length === 0 ? 'No study notes yet' : 'No notes match your filter'}
              </p>
              <p className="text-xs text-[#71717A] mt-1 max-w-sm mx-auto">
                {notes.length === 0
                  ? 'Click "New Note" to author one, "AI Generate" for automated notes, or bookmark any AI chat answer.'
                  : 'Try adjusting your search terms, subject, or semester filter.'}
              </p>
            </div>
          ) : (
            filteredNotes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                copiedId={copiedId}
                onCopy={handleCopy}
                onEdit={startEdit}
                onDelete={deleteNote}
                onSummarize={() => handleRunSummarize(note)}
                onExplainEnglish={() => handleRunExplain(note, 'english')}
                onExplainHinglish={() => handleRunExplain(note, 'hinglish')}
                onGenerateQuestions={() => handleRunQuestions(note)}
                onGenerateFlashcards={() => handleRunFlashcards(note)}
                onDownloadTxt={() => downloadNoteAsTxt(note)}
                onDownloadPdf={() => downloadNoteAsPdf(note)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Note Card Component with Action Bar ────────────────────────────────── */
const NoteCard: React.FC<{
  note: StudyNote;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
  onEdit: (note: StudyNote) => void;
  onDelete: (id: string) => void;
  onSummarize: () => void;
  onExplainEnglish: () => void;
  onExplainHinglish: () => void;
  onGenerateQuestions: () => void;
  onGenerateFlashcards: () => void;
  onDownloadTxt: () => void;
  onDownloadPdf: () => void;
}> = ({
  note,
  copiedId,
  onCopy,
  onEdit,
  onDelete,
  onSummarize,
  onExplainEnglish,
  onExplainHinglish,
  onGenerateQuestions,
  onGenerateFlashcards,
  onDownloadTxt,
  onDownloadPdf
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#141414] border border-[#262626] hover:border-zinc-500 transition-all shadow-sm">
      {/* Top Details & Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm sm:text-base font-bold text-white truncate">{note.title}</h3>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full border border-[#2E2E2E] bg-[#1A1A1A] text-zinc-300 font-medium">
              {note.subject || 'General'}
            </span>
            {note.semester && note.semester !== 'All Semesters' && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#1C1C1C] text-zinc-400 font-mono border border-[#262626]">
                {note.semester}
              </span>
            )}
            {note.topic && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#1C1C1C] text-zinc-400 border border-[#262626] truncate max-w-[150px]">
                {note.topic}
              </span>
            )}
          </div>
          {note.conversationTitle && (
            <span className="text-[11px] text-[#71717A] block truncate">
              Source: {note.conversationTitle}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(note)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors"
            title="Edit note"
          >
            <Edit2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => onCopy(note.id, `${note.title}\n\n${note.content}`)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors"
            title="Copy text"
          >
            {copiedId === note.id ? <Check size={13} className="text-white" /> : <Copy size={13} />}
          </button>
          <button
            type="button"
            onClick={onDownloadTxt}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors"
            title="Download as TXT"
          >
            <FileDown size={13} />
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors"
            title="Download / Print as PDF"
          >
            <Download size={13} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(note.id)}
            className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-[#1C1C1C] transition-colors"
            title="Delete note"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Note Content preview / markdown */}
      <div className={`text-xs text-zinc-200 bg-[#0F0F0F] p-3.5 rounded-xl border border-[#262626] font-sans leading-relaxed overflow-hidden transition-all ${isExpanded ? 'max-h-none' : 'max-h-36'}`}>
        <div className="prose prose-invert prose-xs max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {note.content || '*No content provided*'}
          </ReactMarkdown>
        </div>
      </div>

      {note.content && note.content.length > 250 && (
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className="mt-1.5 text-[11px] text-[#A1A1AA] hover:text-white flex items-center gap-1 transition-colors"
        >
          {isExpanded ? <>Show less <ChevronUp size={12} /></> : <>Read full note <ChevronDown size={12} /></>}
        </button>
      )}

      {/* Tags */}
      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {note.tags.map((tag, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[#181818] text-zinc-400 border border-[#262626] flex items-center gap-1 font-mono">
              <Tag size={9} />#{tag}
            </span>
          ))}
        </div>
      )}

      {/* AI Toolkit Action Pills Bar */}
      <div className="mt-3 pt-2.5 border-t border-[#1F1F1F] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onSummarize}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#181818] hover:bg-[#222222] text-[11px] font-medium text-zinc-300 hover:text-white border border-[#2A2A2A] transition-colors"
          >
            <Sparkles size={11} className="text-white" />
            <span>Summarize</span>
          </button>

          <button
            type="button"
            onClick={onExplainEnglish}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#181818] hover:bg-[#222222] text-[11px] font-medium text-zinc-300 hover:text-white border border-[#2A2A2A] transition-colors"
          >
            <span>ELI5 (Simple)</span>
          </button>

          <button
            type="button"
            onClick={onExplainHinglish}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#181818] hover:bg-[#222222] text-[11px] font-medium text-zinc-300 hover:text-white border border-[#2A2A2A] transition-colors"
          >
            <span>Hinglish</span>
          </button>

          <button
            type="button"
            onClick={onGenerateQuestions}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#181818] hover:bg-[#222222] text-[11px] font-medium text-zinc-300 hover:text-white border border-[#2A2A2A] transition-colors"
          >
            <GraduationCap size={11} className="text-white" />
            <span>Generate Qs</span>
          </button>

          <button
            type="button"
            onClick={onGenerateFlashcards}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#181818] hover:bg-[#222222] text-[11px] font-medium text-zinc-300 hover:text-white border border-[#2A2A2A] transition-colors"
          >
            <Layers size={11} className="text-white" />
            <span>Make Flashcards</span>
          </button>
        </div>

        <span className="text-[10px] text-[#71717A] font-mono">
          {new Date(note.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </div>
  );
};

/* ─── Rich Markdown & Text Note Editor ───────────────────────────────────── */
const NoteRichEditor: React.FC<{
  form: NoteFormState;
  setForm: React.Dispatch<React.SetStateAction<NoteFormState>>;
  subjects: string[];
  semesters: string[];
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}> = ({ form, setForm, subjects, semesters, onSave, onCancel, saveLabel }) => {
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertFormatting = (prefix: string, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = form.content;
    const selectedText = text.substring(start, end) || 'text';

    const replacement = `${prefix}${selectedText}${suffix}`;
    const newContent = text.substring(0, start) + replacement + text.substring(end);

    setForm(p => ({ ...p, content: newContent }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 10);
  };

  return (
    <div className="mx-4 sm:mx-6 my-3 p-4 sm:p-5 rounded-2xl bg-[#121212] border border-[#2E2E2E] space-y-3.5 animate-in fade-in">
      {/* Title & Topic row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-[11px] text-[#A1A1AA] font-mono block mb-1">Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            onKeyDown={e => e.stopPropagation()}
            placeholder="Note title (e.g. Binary Search Trees)..."
            className="w-full bg-[#181818] text-sm text-white px-3 py-2 rounded-xl border border-[#2E2E2E] focus:outline-none focus:border-white"
            autoFocus
          />
        </div>

        <div>
          <label className="text-[11px] text-[#A1A1AA] font-mono block mb-1">Topic / Chapter</label>
          <input
            type="text"
            value={form.topic}
            onChange={e => setForm(p => ({ ...p, topic: e.target.value }))}
            onKeyDown={e => e.stopPropagation()}
            placeholder="e.g. Data Structures, Unit 2..."
            className="w-full bg-[#181818] text-sm text-white px-3 py-2 rounded-xl border border-[#2E2E2E] focus:outline-none focus:border-white"
          />
        </div>
      </div>

      {/* Subject, Semester, Tags Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="text-[11px] text-[#A1A1AA] font-mono block mb-1">Subject</label>
          <select
            value={form.subject}
            onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
            className="w-full bg-[#181818] text-xs text-white px-3 py-2 rounded-xl border border-[#2E2E2E] focus:outline-none"
          >
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-[#A1A1AA] font-mono block mb-1">Semester</label>
          <select
            value={form.semester}
            onChange={e => setForm(p => ({ ...p, semester: e.target.value }))}
            className="w-full bg-[#181818] text-xs text-white px-3 py-2 rounded-xl border border-[#2E2E2E] focus:outline-none"
          >
            {semesters.map(sem => <option key={sem} value={sem}>{sem}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-[#A1A1AA] font-mono block mb-1">Tags (comma-separated)</label>
          <input
            type="text"
            value={form.tags}
            onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
            onKeyDown={e => e.stopPropagation()}
            placeholder="exam, formula, imp"
            className="w-full bg-[#181818] text-xs text-white px-3 py-2 rounded-xl border border-[#2E2E2E] focus:outline-none"
          />
        </div>
      </div>

      {/* Rich Formatting Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 rounded-xl bg-[#161616] border border-[#282828]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => insertFormatting('# ')}
            className="p-1.5 rounded hover:bg-[#242424] text-zinc-300 hover:text-white"
            title="Heading 1"
          >
            <Heading1 size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('## ')}
            className="p-1.5 rounded hover:bg-[#242424] text-zinc-300 hover:text-white"
            title="Heading 2"
          >
            <Heading2 size={14} />
          </button>
          <div className="w-[1px] h-4 bg-[#2A2A2A] mx-0.5" />
          <button
            type="button"
            onClick={() => insertFormatting('**', '**')}
            className="p-1.5 rounded hover:bg-[#242424] text-zinc-300 hover:text-white"
            title="Bold"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('*', '*')}
            className="p-1.5 rounded hover:bg-[#242424] text-zinc-300 hover:text-white"
            title="Italic"
          >
            <Italic size={14} />
          </button>
          <div className="w-[1px] h-4 bg-[#2A2A2A] mx-0.5" />
          <button
            type="button"
            onClick={() => insertFormatting('- ')}
            className="p-1.5 rounded hover:bg-[#242424] text-zinc-300 hover:text-white"
            title="Bullet list"
          >
            <List size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('1. ')}
            className="p-1.5 rounded hover:bg-[#242424] text-zinc-300 hover:text-white"
            title="Numbered list"
          >
            <ListOrdered size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('```\n', '\n```')}
            className="p-1.5 rounded hover:bg-[#242424] text-zinc-300 hover:text-white"
            title="Code block"
          >
            <Code2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('> ')}
            className="p-1.5 rounded hover:bg-[#242424] text-zinc-300 hover:text-white"
            title="Blockquote"
          >
            <Quote size={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsPreview(p => !p)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            isPreview ? 'bg-white text-black' : 'bg-[#222222] text-zinc-300 hover:text-white'
          }`}
        >
          {isPreview ? <EyeOff size={13} /> : <Eye size={13} />}
          <span>{isPreview ? 'Edit Mode' : 'Preview'}</span>
        </button>
      </div>

      {/* Editor Content Textarea / Preview */}
      {isPreview ? (
        <div className="w-full bg-[#181818] p-4 rounded-xl border border-[#2E2E2E] min-h-[180px] max-h-[300px] overflow-y-auto prose prose-invert prose-xs max-w-none text-zinc-200">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {form.content || '*No content to preview*'}
          </ReactMarkdown>
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={form.content}
          onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
          onKeyDown={e => {
            e.stopPropagation();
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              onSave();
            }
          }}
          placeholder="Write your study notes here (Markdown supported). Tip: Press Ctrl+Enter to save..."
          rows={8}
          className="w-full bg-[#181818] text-xs text-white p-3 rounded-xl border border-[#2E2E2E] focus:outline-none focus:border-white resize-y font-mono leading-relaxed"
        />
      )}

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-[#71717A] font-mono">
          Tip: Press Ctrl + Enter to save
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs text-[#A1A1AA] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!form.title.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-black rounded-xl text-xs font-semibold hover:bg-zinc-200 disabled:opacity-40 transition-colors shadow-sm"
          >
            <Save size={13} />
            <span>{saveLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
