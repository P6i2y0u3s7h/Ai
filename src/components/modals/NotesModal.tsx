import React, { useState, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen, X, Trash2, Copy, Check, Search,
  Plus, Edit2, Save, Tag, Filter, Sparkles,
  Download, FileText, HelpCircle, Layers,
  ChevronDown, ChevronUp, Eye, EyeOff, Loader2,
  Heading1, Heading2, Bold, Italic, List, ListOrdered,
  Code2, Quote, Minus, GraduationCap, Languages, FileDown,
  Star, Folder, FolderPlus, ArrowRight, BookMarked,
  RotateCcw, CheckCircle2, AlertTriangle, Play
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { StudyNote, FlashcardDeck } from '../../types/chat';
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
  folder: string;
  isBookmarked: boolean;
  content: string;
  tags: string;
}

const defaultForm = (): NoteFormState => ({
  title: '',
  topic: '',
  subject: 'General',
  semester: 'All Semesters',
  folder: 'General Notes',
  isBookmarked: false,
  content: '',
  tags: ''
});

type ActiveAiTool = 'generate' | 'summary' | 'explain' | 'questions' | 'flashcards' | 'quiz' | null;

export const NotesModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    notes,
    deleteNote,
    showToast,
    addNote,
    updateNote,
    addQuizSession,
    addFlashcardDeck
  } = useChat();
  const { user } = useAuth();

  const [filter, setFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [semesterFilter, setSemesterFilter] = useState<string>('All Semesters');
  const [folderFilter, setFolderFilter] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NoteFormState>(defaultForm());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // AI features state
  const [activeAiTool, setActiveAiTool] = useState<ActiveAiTool>(null);
  const [targetNote, setTargetNote] = useState<StudyNote | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResultText, setAiResultText] = useState<string>('');
  const [aiQuestions, setAiQuestions] = useState<GeneratedQuestions | null>(null);
  const [aiFlashcards, setAiFlashcards] = useState<GeneratedFlashcard[] | null>(null);
  const [aiGeneratedQuiz, setAiGeneratedQuiz] = useState<any[] | null>(null);
  const [aiTopicInput, setAiTopicInput] = useState('');
  const [aiSubjectInput, setAiSubjectInput] = useState('Computer Science');
  const [aiSemesterInput, setAiSemesterInput] = useState('All Semesters');

  // Custom Folders
  const [newFolderName, setNewFolderName] = useState('');
  const [showAddFolder, setShowAddFolder] = useState(false);

  if (activeModal !== 'notes') return null;

  // Discovered folders
  const allFolders = useMemo(() => {
    const set = new Set<string>(['General Notes', 'Exam Prep', 'Lecture Summaries', 'Assignments']);
    (notes || []).forEach(n => {
      if (n.folder && n.folder.trim()) set.add(n.folder.trim());
    });
    return Array.from(set);
  }, [notes]);

  // Filtered notes based on Search, Folder, Subject, and Semester
  const filteredNotes = useMemo(() => {
    return (notes || []).filter(n => {
      if (!n) return false;
      const q = (filter || '').toLowerCase().trim();
      const nTitle = (n.title || '').toLowerCase();
      const nTopic = (n.topic || '').toLowerCase();
      const nContent = (n.content || '').toLowerCase();
      const nSemester = (n.semester || '').toLowerCase();
      const nFolder = (n.folder || 'General Notes').toLowerCase();
      const nTags = Array.isArray(n.tags) ? n.tags : [];

      const matchesText =
        !q ||
        nTitle.includes(q) ||
        nTopic.includes(q) ||
        nContent.includes(q) ||
        nSemester.includes(q) ||
        nFolder.includes(q) ||
        nTags.some(t => typeof t === 'string' && t.toLowerCase().includes(q));

      const matchesSubject = subjectFilter === 'All' || (n.subject || 'General') === subjectFilter;
      const matchesSemester =
        semesterFilter === 'All Semesters' ||
        (n.semester && n.semester === semesterFilter) ||
        (!n.semester && semesterFilter === 'All Semesters');

      let matchesFolder = true;
      if (folderFilter === 'Favorites') {
        matchesFolder = Boolean(n.isBookmarked);
      } else if (folderFilter === 'AI Generated') {
        matchesFolder = nTags.includes('ai-generated') || nTitle.includes('ai') || nFolder.includes('ai');
      } else if (folderFilter !== 'All') {
        matchesFolder = (n.folder || 'General Notes') === folderFilter;
      }

      return matchesText && matchesSubject && matchesSemester && matchesFolder;
    });
  }, [notes, filter, subjectFilter, semesterFilter, folderFilter]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Note copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleBookmark = (note: StudyNote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = !note.isBookmarked;
    updateNote(note.id, { isBookmarked: updated });
    showToast(updated ? 'Added to Bookmarks ⭐' : 'Removed from Bookmarks');
  };

  const startEdit = (note: StudyNote) => {
    setEditingId(note.id);
    setCreating(false);
    setForm({
      title: note.title || '',
      topic: note.topic || '',
      subject: note.subject || 'General',
      semester: note.semester || 'All Semesters',
      folder: note.folder || 'General Notes',
      isBookmarked: Boolean(note.isBookmarked),
      content: note.content || '',
      tags: Array.isArray(note.tags) ? note.tags.join(', ') : ''
    });
    setTargetNote(note);
  };

  const startCreate = () => {
    setEditingId(null);
    setCreating(true);
    setForm({
      ...defaultForm(),
      subject: subjectFilter !== 'All' ? subjectFilter : 'General',
      semester: semesterFilter !== 'All Semesters' ? semesterFilter : 'All Semesters',
      folder: folderFilter !== 'All' && folderFilter !== 'Favorites' && folderFilter !== 'AI Generated' ? folderFilter : 'General Notes'
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
      folder: form.folder || 'General Notes',
      isBookmarked: form.isBookmarked,
      content: form.content.trim(),
      tags
    });
    cancelEdit();
    showToast('Note updated successfully');
  };

  const handleSaveCreate = () => {
    if (!form.title.trim()) return;
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    addNote({
      title: form.title.trim(),
      topic: form.topic.trim(),
      subject: form.subject,
      semester: form.semester,
      folder: form.folder || 'General Notes',
      isBookmarked: form.isBookmarked,
      content: form.content.trim(),
      tags
    });
    cancelEdit();
    showToast('Note created successfully');
  };

  const handleDeleteWithConfirm = (id: string) => {
    deleteNote(id);
    setDeleteConfirmId(null);
    if (editingId === id) cancelEdit();
  };

  // AI tool launchers
  const handleOpenAiGenerate = () => {
    setActiveAiTool('generate');
    setAiTopicInput('');
    setAiResultText('');
    setAiQuestions(null);
    setAiFlashcards(null);
    setAiGeneratedQuiz(null);
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
        folder: 'AI Generated',
        isBookmarked: false,
        content: generated,
        tags: 'ai-generated, curriculum-notes'
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
      showToast(err.message || 'Failed to generate explanation');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleRunGenerateQuestions = async (note: StudyNote) => {
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

  const handleRunConvertFlashcards = async (note: StudyNote) => {
    setTargetNote(note);
    setActiveAiTool('flashcards');
    setIsAiLoading(true);
    setAiFlashcards(null);
    try {
      const result = await notesAiService.generateFlashcards(note.title, note.content);
      setAiFlashcards(result);
      
      // Auto-save as interactive deck in StudyTools
      const newDeck: FlashcardDeck = {
        id: `deck-${Date.now()}`,
        userId: user?.uid,
        title: `${note.title} (Flashcards)`,
        topic: note.topic || note.title,
        subject: note.subject || 'General',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        cards: result.map((c, i) => ({
          id: `c-${Date.now()}-${i}`,
          front: c.front,
          back: c.back,
          status: 'new'
        }))
      };
      addFlashcardDeck(newDeck);
      showToast('Flashcards generated & saved to Study Tools!');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate flashcards');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Cross-Connection: Generate Quiz from Note & launch into Quiz Modal
  const handleRunGenerateQuizFromNote = async (note: StudyNote) => {
    setTargetNote(note);
    setActiveAiTool('quiz');
    setIsAiLoading(true);
    try {
      const questions = await notesAiService.generateQuizFromNote(note.title, note.content, 5);
      setAiGeneratedQuiz(questions);

      const session = {
        id: `quiz-${Date.now()}`,
        userId: user?.uid,
        title: `${note.title} Quiz`,
        topic: note.topic || note.title,
        subject: note.subject || 'General',
        date: Date.now(),
        score: 0,
        total: questions.length,
        difficulty: 'medium' as const,
        quizType: 'notes-generated' as const,
        questions: questions.map(q => ({
          id: q.id,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          topic: note.topic || note.title
        }))
      };
      addQuizSession(session);
      showToast('Quiz generated from note & saved to Quiz History!');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate quiz from note');
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
      folder: 'AI Generated',
      isBookmarked: false,
      content: aiResultText,
      tags: ['ai-notes', activeAiTool || 'study']
    });
    setActiveAiTool(null);
    showToast('Saved to My Notes!');
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md"
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          setActiveModal(null);
        }
      }}
    >
      <div className="w-full max-w-[1300px] h-[92vh] bg-[#0A0A0A] border border-[#262626] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* ── Top Master Header ── */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#262626] bg-[#0D0D0D]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#141414] text-white border border-[#262626]">
              <BookOpen size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">My Notes — Digital Notebook</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#1C1C1C] text-zinc-300 border border-[#262626]">
                  {notes.length} notes
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA] hidden sm:block">
                Curriculum notebook with AI generation, exam questions, flashcards & Firestore sync
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAiGenerate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1C1C] hover:bg-[#262626] text-white border border-[#333333] text-xs font-semibold transition-all shadow-sm"
              title="Generate full study notes with AI"
            >
              <Sparkles size={13} className="text-white" />
              <span className="hidden sm:inline">AI Generate Note</span>
            </button>

            <button
              type="button"
              onClick={startCreate}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors shadow-sm"
            >
              <Plus size={14} />
              <span>Create New Note</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors ml-1"
              aria-label="Close notes modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── 3-Panel Main Area ── */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#0A0A0A]">
          
          {/* ══════════════════════════════════════════════════════════
              LEFT PANEL: Subjects & Folders Sidebar (Desktop / Tablet)
             ══════════════════════════════════════════════════════════ */}
          <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#262626] bg-[#0A0A0A] flex flex-col overflow-y-auto p-3 space-y-4 flex-shrink-0">
            
            {/* Folder Organization Section */}
            <div>
              <div className="flex items-center justify-between mb-1.5 px-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A] flex items-center gap-1.5">
                  <Folder size={12} /> Folders
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddFolder(prev => !prev)}
                  className="text-zinc-400 hover:text-white text-xs p-0.5 rounded hover:bg-[#1C1C1C]"
                  title="Create new folder"
                >
                  <Plus size={13} />
                </button>
              </div>

              {/* Add folder input */}
              {showAddFolder && (
                <div className="mb-2 p-2 rounded-xl bg-[#141414] border border-[#262626] flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder="Folder name..."
                    className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newFolderName.trim()) {
                        setFolderFilter(newFolderName.trim());
                        setNewFolderName('');
                        setShowAddFolder(false);
                      }
                    }}
                    className="px-2 py-0.5 bg-white text-black text-[11px] font-semibold rounded"
                  >
                    Add
                  </button>
                </div>
              )}

              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setFolderFilter('All')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    folderFilter === 'All'
                      ? 'bg-white text-black font-semibold'
                      : 'text-zinc-300 hover:text-white hover:bg-[#141414]'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <BookOpen size={13} /> All Notes
                  </span>
                  <span className="text-[10px] opacity-75 font-mono">{notes.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFolderFilter('Favorites')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    folderFilter === 'Favorites'
                      ? 'bg-white text-black font-semibold'
                      : 'text-zinc-300 hover:text-white hover:bg-[#141414]'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Star size={13} className="text-amber-400 fill-amber-400" /> Bookmarks ⭐
                  </span>
                  <span className="text-[10px] opacity-75 font-mono">
                    {notes.filter(n => n.isBookmarked).length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFolderFilter('AI Generated')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    folderFilter === 'AI Generated'
                      ? 'bg-white text-black font-semibold'
                      : 'text-zinc-300 hover:text-white hover:bg-[#141414]'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Sparkles size={13} /> AI Generated
                  </span>
                  <span className="text-[10px] opacity-75 font-mono">
                    {notes.filter(n => (n.tags || []).includes('ai-generated') || n.folder === 'AI Generated').length}
                  </span>
                </button>

                {allFolders.map(folder => (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => setFolderFilter(folder)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      folderFilter === folder
                        ? 'bg-white text-black font-semibold'
                        : 'text-zinc-300 hover:text-white hover:bg-[#141414]'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Folder size={13} /> {folder}
                    </span>
                    <span className="text-[10px] opacity-75 font-mono">
                      {notes.filter(n => (n.folder || 'General Notes') === folder).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Subjects Filter Section */}
            <div className="pt-2 border-t border-[#1C1C1C]">
              <div className="flex items-center justify-between mb-1.5 px-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A] flex items-center gap-1.5">
                  <Tag size={12} /> Subjects
                </span>
                {subjectFilter !== 'All' && (
                  <button
                    type="button"
                    onClick={() => setSubjectFilter('All')}
                    className="text-[10px] text-zinc-400 hover:text-white"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setSubjectFilter('All')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    subjectFilter === 'All'
                      ? 'bg-[#1C1C1C] text-white border border-[#2E2E2E]'
                      : 'text-zinc-400 hover:text-white hover:bg-[#141414]'
                  }`}
                >
                  <span>All Subjects</span>
                  <span className="text-[10px] opacity-60 font-mono">{notes.length}</span>
                </button>
                {SUBJECTS.map(sub => {
                  const count = notes.filter(n => (n.subject || 'General') === sub).length;
                  if (count === 0 && sub !== 'Computer Science' && sub !== 'Mathematics') return null;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSubjectFilter(sub)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        subjectFilter === sub
                          ? 'bg-[#1C1C1C] text-white border border-[#2E2E2E]'
                          : 'text-zinc-400 hover:text-white hover:bg-[#141414]'
                      }`}
                    >
                      <span className="truncate">{sub}</span>
                      <span className="text-[10px] opacity-60 font-mono">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Semester Filter Section */}
            <div className="pt-2 border-t border-[#1C1C1C]">
              <div className="flex items-center justify-between mb-1.5 px-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A] flex items-center gap-1.5">
                  <GraduationCap size={12} /> Semesters
                </span>
              </div>
              <select
                value={semesterFilter}
                onChange={e => setSemesterFilter(e.target.value)}
                className="w-full bg-[#111111] text-xs text-zinc-200 py-1.5 px-2.5 rounded-lg border border-[#262626] focus:outline-none"
              >
                {SEMESTERS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </aside>

          {/* ══════════════════════════════════════════════════════════
              CENTER PANEL: Notes List & Rich Editor
             ══════════════════════════════════════════════════════════ */}
          <main className="flex-1 flex flex-col overflow-hidden bg-[#0A0A0A] border-b md:border-b-0 md:border-r border-[#262626]">
            
            {/* Top Search & Filter Bar */}
            <div className="p-3 border-b border-[#262626] bg-[#0D0D0D] flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141414] border border-[#262626] focus-within:border-zinc-500">
                <Search size={14} className="text-[#71717A] flex-shrink-0" />
                <input
                  type="text"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder="Search notes by title, topic, content, or #tag..."
                  className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-[#71717A] focus:outline-none"
                />
                {filter && (
                  <button type="button" onClick={() => setFilter('')} className="text-zinc-500 hover:text-white">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Active Filter Pill */}
              {(folderFilter !== 'All' || subjectFilter !== 'All' || semesterFilter !== 'All Semesters') && (
                <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#181818] border border-[#2A2A2A] text-[11px] text-zinc-300">
                  <span>Filtered: {folderFilter !== 'All' ? folderFilter : subjectFilter}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFolderFilter('All');
                      setSubjectFilter('All');
                      setSemesterFilter('All Semesters');
                    }}
                    className="hover:text-white"
                  >
                    <X size={11} />
                  </button>
                </div>
              )}
            </div>

            {/* Note Editor OR Notes List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {creating ? (
                <NoteRichEditor
                  form={form}
                  setForm={setForm}
                  subjects={SUBJECTS}
                  semesters={SEMESTERS}
                  folders={allFolders}
                  onSave={handleSaveCreate}
                  onCancel={cancelEdit}
                  saveLabel="Save New Note"
                />
              ) : editingId ? (
                <NoteRichEditor
                  form={form}
                  setForm={setForm}
                  subjects={SUBJECTS}
                  semesters={SEMESTERS}
                  folders={allFolders}
                  onSave={handleSaveEdit}
                  onCancel={cancelEdit}
                  saveLabel="Update Note"
                />
              ) : filteredNotes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-400">
                  <div className="w-14 h-14 rounded-2xl bg-[#141414] border border-[#262626] flex items-center justify-center text-zinc-500 mb-3">
                    <BookOpen size={26} />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">
                    {filter ? 'No notes matched your query' : 'Your digital notebook is empty'}
                  </h3>
                  <p className="text-xs text-[#71717A] max-w-sm mb-4">
                    {filter
                      ? 'Try clearing search filters or searching for different keywords.'
                      : 'Create structured curriculum notes manually or generate complete study guides instantly with AI.'}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={startCreate}
                      className="px-3.5 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors"
                    >
                      + Create Note
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenAiGenerate}
                      className="px-3.5 py-2 rounded-xl bg-[#141414] border border-[#262626] text-white text-xs font-semibold hover:bg-[#1C1C1C] transition-colors"
                    >
                      ✨ Generate with AI
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredNotes.map(note => (
                    <NoteCardItem
                      key={note.id}
                      note={note}
                      copied={copiedId === note.id}
                      onCopy={() => handleCopy(note.id, `${note.title}\n\n${note.content}`)}
                      onEdit={() => startEdit(note)}
                      onDelete={() => setDeleteConfirmId(note.id)}
                      onBookmark={e => handleToggleBookmark(note, e)}
                      onSummarize={() => handleRunSummarize(note)}
                      onExplainEnglish={() => handleRunExplain(note, 'english')}
                      onExplainHinglish={() => handleRunExplain(note, 'hinglish')}
                      onGenerateQuestions={() => handleRunGenerateQuestions(note)}
                      onGenerateFlashcards={() => handleRunConvertFlashcards(note)}
                      onGenerateQuiz={() => handleRunGenerateQuizFromNote(note)}
                      onDownloadTxt={() => downloadNoteAsTxt(note)}
                      onDownloadPdf={() => downloadNoteAsPdf(note)}
                    />
                  ))}
                </div>
              )}
            </div>
          </main>

          {/* ══════════════════════════════════════════════════════════
              RIGHT PANEL: AI Learning & Transformation Power Tools
             ══════════════════════════════════════════════════════════ */}
          <aside className="w-full md:w-80 bg-[#0C0C0C] flex flex-col overflow-y-auto p-4 flex-shrink-0">
            <div className="flex items-center gap-2 pb-3 border-b border-[#262626] mb-3">
              <Sparkles size={16} className="text-white" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">AI Study Assistant</h3>
            </div>

            {/* AI Generator Form View */}
            {activeAiTool === 'generate' ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-[#141414] border border-[#262626]">
                  <h4 className="text-xs font-semibold text-white mb-1">Generate Complete Study Note</h4>
                  <p className="text-[11px] text-[#A1A1AA] mb-3">
                    Enter any academic topic to generate complete curriculum notes with formulas, definitions, and exam tips.
                  </p>

                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[10px] font-semibold text-[#71717A] uppercase">Topic / Concept</label>
                      <input
                        type="text"
                        value={aiTopicInput}
                        onChange={e => setAiTopicInput(e.target.value)}
                        placeholder="e.g. Dijkstra's Algorithm, Photosynthesis..."
                        className="w-full bg-[#0A0A0A] text-xs text-white p-2 rounded-lg border border-[#262626] focus:outline-none focus:border-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-[#71717A] uppercase">Subject</label>
                      <select
                        value={aiSubjectInput}
                        onChange={e => setAiSubjectInput(e.target.value)}
                        className="w-full bg-[#0A0A0A] text-xs text-white p-2 rounded-lg border border-[#262626] focus:outline-none"
                      >
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-[#71717A] uppercase">Semester</label>
                      <select
                        value={aiSemesterInput}
                        onChange={e => setAiSemesterInput(e.target.value)}
                        className="w-full bg-[#0A0A0A] text-xs text-white p-2 rounded-lg border border-[#262626] focus:outline-none"
                      >
                        {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleRunAiGenerate}
                      disabled={isAiLoading || !aiTopicInput.trim()}
                      className="w-full py-2 px-3 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {isAiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      <span>{isAiLoading ? 'Synthesizing Notes...' : 'Generate Full Note'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : isAiLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                <Loader2 size={24} className="animate-spin text-white" />
                <p className="text-xs text-white font-medium">Processing with StudyAI...</p>
                <p className="text-[11px] text-[#71717A]">Formulating structured academic answers...</p>
              </div>
            ) : aiQuestions ? (
              /* Generated Questions View */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <GraduationCap size={14} /> Exam Questions
                  </h4>
                  <button type="button" onClick={() => setAiQuestions(null)} className="text-xs text-zinc-400 hover:text-white">
                    Close
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-[#141414] border border-[#262626] space-y-3 text-xs overflow-y-auto max-h-[70vh]">
                  {aiQuestions.mcqs && aiQuestions.mcqs.length > 0 && (
                    <div>
                      <p className="font-semibold text-white mb-2">Multiple Choice Questions</p>
                      {aiQuestions.mcqs.map((m, i) => (
                        <div key={i} className="mb-2 p-2 rounded bg-[#0A0A0A] border border-[#262626]">
                          <p className="font-medium text-white mb-1">{i + 1}. {m.question}</p>
                          <ul className="text-[11px] text-[#A1A1AA] space-y-0.5 mb-1.5">
                            {m.options.map((opt, oi) => <li key={oi}>• {opt}</li>)}
                          </ul>
                          <p className="text-[10px] text-zinc-300 font-mono">Answer: {m.answer}</p>
                          <p className="text-[10px] text-[#71717A] mt-0.5">{m.explanation}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {aiQuestions.shortQuestions && aiQuestions.shortQuestions.length > 0 && (
                    <div className="pt-2 border-t border-[#262626]">
                      <p className="font-semibold text-white mb-1.5">Short Answer Questions</p>
                      {aiQuestions.shortQuestions.map((s, i) => (
                        <div key={i} className="mb-2 p-2 rounded bg-[#0A0A0A] border border-[#262626]">
                          <p className="font-medium text-white mb-1">Q{i + 1}: {s.question}</p>
                          <p className="text-[11px] text-[#A1A1AA]">{s.answer}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : aiFlashcards ? (
              /* Generated Flashcards View */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers size={14} /> Flashcards ({aiFlashcards.length})
                  </h4>
                  <button type="button" onClick={() => setAiFlashcards(null)} className="text-xs text-zinc-400 hover:text-white">
                    Close
                  </button>
                </div>
                <div className="space-y-2 text-xs overflow-y-auto max-h-[65vh]">
                  {aiFlashcards.map((fc, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-[#141414] border border-[#262626]">
                      <p className="text-[10px] text-[#71717A] uppercase font-semibold">Front</p>
                      <p className="text-white font-medium mb-1.5">{fc.front}</p>
                      <p className="text-[10px] text-[#71717A] uppercase font-semibold">Back</p>
                      <p className="text-zinc-300 text-[11px]">{fc.back}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : aiGeneratedQuiz ? (
              /* Generated Quiz Confirmation */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Quiz Created!
                  </h4>
                  <button type="button" onClick={() => setAiGeneratedQuiz(null)} className="text-xs text-zinc-400 hover:text-white">
                    Close
                  </button>
                </div>
                <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] space-y-2.5 text-xs">
                  <p className="text-white font-medium">5 Questions generated from "{targetNote?.title}".</p>
                  <p className="text-[11px] text-[#A1A1AA]">
                    This quiz has been saved into your Quiz History. You can take it right now to measure your understanding.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveModal('quiz')}
                    className="w-full py-2 px-3 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Play size={13} /> Take Quiz Now
                  </button>
                </div>
              </div>
            ) : aiResultText ? (
              /* Generated Text View (Summary or Explanation) */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles size={14} /> {activeAiTool === 'summary' ? 'Revision Summary' : 'Explanation'}
                  </h4>
                  <button type="button" onClick={() => setAiResultText('')} className="text-xs text-zinc-400 hover:text-white">
                    Close
                  </button>
                </div>
                <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] text-xs text-zinc-200 overflow-y-auto max-h-[60vh] leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {aiResultText}
                  </ReactMarkdown>
                </div>
                <button
                  type="button"
                  onClick={handleSaveAiResultAsNewNote}
                  className="w-full py-2 px-3 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Save size={13} /> Save to My Notes
                </button>
              </div>
            ) : (
              /* Idle AI Helper Guide */
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] space-y-2">
                  <p className="font-semibold text-white">How to use AI Tools</p>
                  <p className="text-[#A1A1AA] text-[11px] leading-relaxed">
                    Select any note card from the center panel to unlock 1-click AI powers:
                  </p>
                  <ul className="text-[11px] text-zinc-300 space-y-1.5 list-disc pl-3">
                    <li><strong>Summarize</strong>: 5-bullet high-yield executive revision.</li>
                    <li><strong>ELI5 / Hinglish</strong>: Breaks down hard concepts into conversational terms.</li>
                    <li><strong>Generate Qs</strong>: Creates exam MCQs and long questions.</li>
                    <li><strong>Make Flashcards</strong>: Converts note into an interactive revision deck.</li>
                    <li><strong>Generate Quiz</strong>: Creates a practice test saved to Quiz History.</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAiGenerate}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#141414] hover:bg-[#1C1C1C] text-white border border-[#262626] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={13} className="text-white" />
                  <span>Generate New Topic Notes</span>
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0F0F0F] border border-[#262626] rounded-2xl p-5 shadow-2xl space-y-3 text-center">
            <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle size={20} />
            </div>
            <h4 className="text-sm font-bold text-white">Delete Study Note?</h4>
            <p className="text-xs text-[#A1A1AA]">
              This note will be permanently removed from your digital notebook and Firestore.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 rounded-xl bg-[#181818] text-zinc-300 hover:text-white text-xs font-semibold border border-[#262626]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteWithConfirm(deleteConfirmId)}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
              >
                Delete Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Individual Note Card Component ─────────────────────────────────────── */
const NoteCardItem: React.FC<{
  note: StudyNote;
  copied: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onBookmark: (e: React.MouseEvent) => void;
  onSummarize: () => void;
  onExplainEnglish: () => void;
  onExplainHinglish: () => void;
  onGenerateQuestions: () => void;
  onGenerateFlashcards: () => void;
  onGenerateQuiz: () => void;
  onDownloadTxt: () => void;
  onDownloadPdf: () => void;
}> = ({
  note,
  copied,
  onCopy,
  onEdit,
  onDelete,
  onBookmark,
  onSummarize,
  onExplainEnglish,
  onExplainHinglish,
  onGenerateQuestions,
  onGenerateFlashcards,
  onGenerateQuiz,
  onDownloadTxt,
  onDownloadPdf
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const colorCls = SUBJECT_COLORS[note.subject || 'General'] || SUBJECT_COLORS['General'];

  return (
    <div className="p-4 rounded-2xl bg-[#0D0D0D] border border-[#202020] hover:border-zinc-700 transition-all shadow-sm">
      {/* Note Header & Action Buttons */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colorCls}`}>
              {note.subject || 'General'}
            </span>
            {note.semester && note.semester !== 'All Semesters' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#181818] text-zinc-400 border border-[#262626]">
                {note.semester}
              </span>
            )}
            {note.folder && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#141414] text-zinc-400 border border-[#262626] flex items-center gap-1">
                <Folder size={10} /> {note.folder}
              </span>
            )}
            {note.topic && (
              <span className="text-[11px] text-[#A1A1AA] truncate">
                • {note.topic}
              </span>
            )}
          </div>
          <h4 className="text-sm sm:text-base font-bold text-white truncate">{note.title}</h4>
        </div>

        {/* Toolbar Icons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Bookmark Toggle */}
          <button
            type="button"
            onClick={onBookmark}
            className={`p-1.5 rounded-lg transition-colors ${
              note.isBookmarked
                ? 'text-amber-400 hover:text-amber-300 bg-amber-400/10'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#1A1A1A]'
            }`}
            title={note.isBookmarked ? 'Bookmarked' : 'Add to Bookmarks'}
          >
            <Star size={14} className={note.isBookmarked ? 'fill-amber-400' : ''} />
          </button>

          <button
            type="button"
            onClick={onCopy}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1A1A1A] transition-colors"
            title="Copy Note Text"
          >
            {copied ? <Check size={14} className="text-white" /> : <Copy size={14} />}
          </button>

          <button
            type="button"
            onClick={onDownloadTxt}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1A1A1A] transition-colors"
            title="Download TXT"
          >
            <FileDown size={14} />
          </button>

          <button
            type="button"
            onClick={onDownloadPdf}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1A1A1A] transition-colors"
            title="Export PDF Document"
          >
            <Download size={14} />
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1A1A1A] transition-colors"
            title="Edit Note"
          >
            <Edit2 size={14} />
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete Note"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Note Content Preview (Markdown) */}
      <div className={`text-xs text-zinc-200 bg-[#0A0A0A] p-3.5 rounded-xl border border-[#202020] font-sans leading-relaxed overflow-hidden transition-all ${isExpanded ? 'max-h-none' : 'max-h-36'}`}>
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
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[#141414] text-zinc-400 border border-[#262626] flex items-center gap-1 font-mono">
              <Tag size={9} />#{tag}
            </span>
          ))}
        </div>
      )}

      {/* AI Action Pills Bar */}
      <div className="mt-3 pt-2.5 border-t border-[#1C1C1C] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onSummarize}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141414] hover:bg-[#202020] text-[11px] font-medium text-zinc-300 hover:text-white border border-[#2A2A2A] transition-colors"
          >
            <Sparkles size={11} className="text-white" />
            <span>Summarize</span>
          </button>

          <button
            type="button"
            onClick={onExplainEnglish}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141414] hover:bg-[#202020] text-[11px] font-medium text-zinc-300 hover:text-white border border-[#2A2A2A] transition-colors"
          >
            <span>ELI5</span>
          </button>

          <button
            type="button"
            onClick={onExplainHinglish}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141414] hover:bg-[#202020] text-[11px] font-medium text-zinc-300 hover:text-white border border-[#2A2A2A] transition-colors"
          >
            <Languages size={11} className="text-white" />
            <span>Hinglish</span>
          </button>

          <button
            type="button"
            onClick={onGenerateQuestions}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141414] hover:bg-[#202020] text-[11px] font-medium text-zinc-300 hover:text-white border border-[#2A2A2A] transition-colors"
          >
            <GraduationCap size={11} className="text-white" />
            <span>Questions</span>
          </button>

          <button
            type="button"
            onClick={onGenerateFlashcards}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141414] hover:bg-[#202020] text-[11px] font-medium text-zinc-300 hover:text-white border border-[#2A2A2A] transition-colors"
          >
            <Layers size={11} className="text-white" />
            <span>Flashcards</span>
          </button>

          {/* Cross Connection: Generate Quiz from Note */}
          <button
            type="button"
            onClick={onGenerateQuiz}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white text-zinc-200 hover:text-black text-[11px] font-semibold border border-zinc-700 transition-colors"
            title="Generate quiz from this note and attempt it in Quiz History"
          >
            <Play size={11} />
            <span>Quiz from Note</span>
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
  folders: string[];
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}> = ({ form, setForm, subjects, semesters, folders, onSave, onCancel, saveLabel }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const insertFormatting = (prefix: string, suffix = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = form.content;
    const selected = current.slice(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;
    const nextContent = current.slice(0, start) + replacement + current.slice(end);
    setForm(prev => ({ ...prev, content: nextContent }));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + (selected ? selected.length : 4));
    }, 0);
  };

  return (
    <div className="space-y-4">
      {/* Title & Metadata Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Note Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="e.g. Master Theorem & Complexity Analysis"
            className="w-full bg-[#111111] text-sm text-white px-3.5 py-2.5 rounded-xl border border-[#262626] focus:outline-none focus:border-white font-medium"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Subject</label>
          <select
            value={form.subject}
            onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
            className="w-full bg-[#111111] text-xs text-white px-3 py-2.5 rounded-xl border border-[#262626] focus:outline-none"
          >
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Folder</label>
          <select
            value={form.folder}
            onChange={e => setForm(p => ({ ...p, folder: e.target.value }))}
            className="w-full bg-[#111111] text-xs text-white px-3 py-2.5 rounded-xl border border-[#262626] focus:outline-none"
          >
            {folders.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Semester</label>
          <select
            value={form.semester}
            onChange={e => setForm(p => ({ ...p, semester: e.target.value }))}
            className="w-full bg-[#111111] text-xs text-white px-3 py-2.5 rounded-xl border border-[#262626] focus:outline-none"
          >
            {semesters.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Topic / Chapter</label>
          <input
            type="text"
            value={form.topic}
            onChange={e => setForm(p => ({ ...p, topic: e.target.value }))}
            placeholder="e.g. Asymptotic Analysis, Chapter 2"
            className="w-full bg-[#111111] text-xs text-white px-3 py-2.5 rounded-xl border border-[#262626] focus:outline-none"
          />
        </div>
      </div>

      {/* Rich Text Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-[#141414] border border-[#262626]">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => insertFormatting('# ')}
            className="p-1.5 rounded hover:bg-[#202020] text-zinc-300 hover:text-white"
            title="Heading 1"
          >
            <Heading1 size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('## ')}
            className="p-1.5 rounded hover:bg-[#202020] text-zinc-300 hover:text-white"
            title="Heading 2"
          >
            <Heading2 size={14} />
          </button>
          <div className="w-[1px] h-4 bg-[#262626] mx-0.5" />
          <button
            type="button"
            onClick={() => insertFormatting('**', '**')}
            className="p-1.5 rounded hover:bg-[#202020] text-zinc-300 hover:text-white"
            title="Bold"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('*', '*')}
            className="p-1.5 rounded hover:bg-[#202020] text-zinc-300 hover:text-white"
            title="Italic"
          >
            <Italic size={14} />
          </button>
          <div className="w-[1px] h-4 bg-[#262626] mx-0.5" />
          <button
            type="button"
            onClick={() => insertFormatting('- ')}
            className="p-1.5 rounded hover:bg-[#202020] text-zinc-300 hover:text-white"
            title="Bullet list"
          >
            <List size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('1. ')}
            className="p-1.5 rounded hover:bg-[#202020] text-zinc-300 hover:text-white"
            title="Numbered list"
          >
            <ListOrdered size={14} />
          </button>
          <div className="w-[1px] h-4 bg-[#262626] mx-0.5" />
          <button
            type="button"
            onClick={() => insertFormatting('`', '`')}
            className="p-1.5 rounded hover:bg-[#202020] text-zinc-300 hover:text-white"
            title="Code span"
          >
            <Code2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('> ')}
            className="p-1.5 rounded hover:bg-[#202020] text-zinc-300 hover:text-white"
            title="Quote block"
          >
            <Quote size={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setPreviewMode(prev => !prev)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#202020] text-zinc-300 hover:text-white text-xs"
        >
          {previewMode ? <EyeOff size={13} /> : <Eye size={13} />}
          <span>{previewMode ? 'Edit' : 'Markdown Preview'}</span>
        </button>
      </div>

      {/* Editor Content Area */}
      {previewMode ? (
        <div className="min-h-[260px] p-4 rounded-xl bg-[#0F0F0F] border border-[#262626] text-xs text-zinc-200 overflow-y-auto max-h-[400px]">
          <div className="prose prose-invert prose-xs max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {form.content || '*Preview is empty*'}
            </ReactMarkdown>
          </div>
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={form.content}
          onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
          placeholder="Write your study notes using Markdown (headings #, bullets -, formulas, code blocks)..."
          className="w-full h-64 bg-[#111111] text-xs sm:text-sm text-zinc-200 p-4 rounded-xl border border-[#262626] focus:outline-none focus:border-white font-mono leading-relaxed"
        />
      )}

      {/* Tags and Bookmark Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Tags (comma separated)</label>
          <input
            type="text"
            value={form.tags}
            onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
            placeholder="algorithms, exams, important, midterms"
            className="w-full bg-[#111111] text-xs text-white px-3 py-2 rounded-xl border border-[#262626] focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => setForm(p => ({ ...p, isBookmarked: !p.isBookmarked }))}
          className={`mt-4 px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
            form.isBookmarked
              ? 'bg-amber-400/10 text-amber-300 border-amber-500/40'
              : 'bg-[#141414] text-zinc-400 border-[#262626] hover:text-white'
          }`}
        >
          <Star size={13} className={form.isBookmarked ? 'fill-amber-400' : ''} />
          <span>{form.isBookmarked ? 'Bookmarked ⭐' : 'Bookmark this Note'}</span>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#262626]">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-[#141414] text-zinc-300 hover:text-white border border-[#262626] text-xs font-semibold transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!form.title.trim()}
          className="px-5 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <Save size={13} />
          <span>{saveLabel}</span>
        </button>
      </div>
    </div>
  );
};
