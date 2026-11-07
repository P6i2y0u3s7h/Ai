import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Layers, X, ChevronLeft, ChevronRight, Sparkles, Loader2,
  Check, RefreshCw, BookMarked, Plus, Trash2, Timer,
  Play, Pause, RotateCcw, AlertCircle, FileText,
  HelpCircle, Code2, GraduationCap, Clock, CheckCircle2,
  CalendarDays, BookOpen, ArrowRight, Award, Trophy,
  FileUp, CheckSquare, Search, Copy
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { getAuthToken, streamAiResponse } from '../../services/aiClient';
import { apiUrl } from '../../utils/apiConfig';
import { notesAiService } from '../../services/notesAiService';
import { extractAndValidateMcqs, generateFallbackQuiz } from '../../utils/mcqParser';
import { FlashcardDeck, Flashcard, QuizQuestion, QuizSession } from '../../types/chat';

export type ToolMode =
  | 'dashboard'
  | 'quiz_generator'
  | 'flashcard_generator'
  | 'summarizer'
  | 'topic_explainer'
  | 'mcq_generator'
  | 'pdf_summarizer'
  | 'study_planner'
  | 'mock_test'
  | 'code_explainer'
  | 'pomodoro';

const SUBJECTS = [
  'Computer Science', 'Mathematics', 'Physics', 'Chemistry',
  'Biology', 'History', 'Economics', 'English', 'Engineering', 'General'
];

export const StudyToolsModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    flashcardDecks,
    addFlashcardDeck,
    deleteFlashcardDeck,
    updateFlashcard,
    documents,
    notes,
    addNote,
    addQuizSession,
    tasks,
    addTask,
    toggleTask,
    deleteTask,
    showToast
  } = useChat();
  const { user } = useAuth();

  const [currentTool, setCurrentTool] = useState<ToolMode>('dashboard');

  // ── Flashcard tool state ──────────────────────────────────────────────────
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [deckTopic, setDeckTopic] = useState('');
  const [deckSubject, setDeckSubject] = useState('Computer Science');
  const [deckCount, setDeckCount] = useState(8);
  const [deckFromNoteId, setDeckFromNoteId] = useState('');
  const [generatingCards, setGeneratingCards] = useState(false);

  // ── Quiz Generator tool state ─────────────────────────────────────────────
  const [quizTopic, setQuizTopic] = useState('');
  const [quizSubject, setQuizSubject] = useState('Computer Science');
  const [quizDiff, setQuizDiff] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [quizCount, setQuizCount] = useState(5);
  const [quizLoading, setQuizLoading] = useState(false);
  const [generatedQuizQuestions, setGeneratedQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizCurrentQ, setQuizCurrentQ] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Record<number, boolean>>({});
  const [quizScore, setQuizScore] = useState(0);

  // ── Summarizer tool state ─────────────────────────────────────────────────
  const [summarizerText, setSummarizerText] = useState('');
  const [summaryResult, setSummaryResult] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  // ── Topic Explainer tool state ────────────────────────────────────────────
  const [explainTopicInput, setExplainTopicInput] = useState('');
  const [explainSubject, setExplainSubject] = useState('General');
  const [explainLang, setExplainLang] = useState<'english' | 'hinglish'>('english');
  const [explainResult, setExplainResult] = useState('');
  const [explainLoading, setExplainLoading] = useState(false);

  // ── MCQ Generator tool state ──────────────────────────────────────────────
  const [mcqTopic, setMcqTopic] = useState('');
  const [mcqQuestions, setMcqQuestions] = useState<QuizQuestion[]>([]);
  const [mcqSelected, setMcqSelected] = useState<Record<number, number>>({});
  const [mcqLoading, setMcqLoading] = useState(false);

  // ── PDF Summarizer state ──────────────────────────────────────────────────
  const [pdfSelectedDocId, setPdfSelectedDocId] = useState('');
  const [pdfSummaryResult, setPdfSummaryResult] = useState('');
  const [pdfQuestionsResult, setPdfQuestionsResult] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);

  // ── Study Planner state ───────────────────────────────────────────────────
  const [planSubject, setPlanSubject] = useState('Computer Science');
  const [planTopic, setPlanTopic] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [planPriority, setPlanPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [aiScheduleText, setAiScheduleText] = useState('');
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // ── Mock Test state ───────────────────────────────────────────────────────
  const [mockSubject, setMockSubject] = useState('Computer Science');
  const [mockTopic, setMockTopic] = useState('');
  const [mockDuration, setMockDuration] = useState(30); // minutes
  const [mockTimeRemaining, setMockTimeRemaining] = useState(30 * 60);
  const [mockRunning, setMockRunning] = useState(false);
  const [mockQuestions, setMockQuestions] = useState<QuizQuestion[]>([]);
  const [mockAnswers, setMockAnswers] = useState<Record<number, number>>({});
  const [mockFinished, setMockFinished] = useState(false);
  const [mockScore, setMockScore] = useState(0);
  const [mockLoading, setMockLoading] = useState(false);

  // ── Code Explainer state ──────────────────────────────────────────────────
  const [codeSnippet, setCodeSnippet] = useState('');
  const [codeLang, setCodeLang] = useState('Python');
  const [codeResult, setCodeResult] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);

  // ── Pomodoro state ────────────────────────────────────────────────────────
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<'focus' | 'break'>('focus');

  const selectedDeck = flashcardDecks.find(d => d.id === selectedDeckId) || null;
  const currentCard = selectedDeck?.cards[cardIndex] || null;

  // ── Mock Test Timer Effect ────────────────────────────────────────────────
  useEffect(() => {
    let interval: any = null;
    if (mockRunning && mockTimeRemaining > 0 && !mockFinished) {
      interval = setInterval(() => {
        setMockTimeRemaining(prev => {
          if (prev <= 1) {
            handleMockSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [mockRunning, mockTimeRemaining, mockFinished]);

  // ── Pomodoro Timer Effect ─────────────────────────────────────────────────
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

  const formatTimer = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ══════════════════════════════════════════════════════════════════════════
  // Tool Handlers
  // ══════════════════════════════════════════════════════════════════════════

  // A. AI Quiz Generator
  const handleGenerateQuiz = async () => {
    if (!quizTopic.trim()) {
      showToast('Please enter a topic');
      return;
    }
    setQuizLoading(true);
    setGeneratedQuizQuestions([]);
    setQuizAnswers({});
    setQuizSubmitted({});
    setQuizScore(0);
    setQuizCurrentQ(0);

    try {
      const prompt = `Generate exactly ${quizCount} exam questions on "${quizTopic}" for ${quizSubject}. Difficulty: ${quizDiff}.
Output in validated JSON block using tag 'json:studyai-mcq':
\`\`\`json:studyai-mcq
{
  "questions": [
    {
      "id": "q1",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Explanation reason",
      "difficulty": "${quizDiff}"
    }
  ]
}
\`\`\``;

      let fullText = '';
      try {
        await streamAiResponse({
          messages: [{ role: 'user', content: prompt }],
          studyMode: 'mcq',
          options: { topic: quizTopic, subject: quizSubject, difficulty: quizDiff },
          onChunk: (_delta, accumulated) => {
            fullText = accumulated;
          }
        });
      } catch (streamErr: any) {
        console.warn('AI stream interrupted:', streamErr);
      }

      let parsed: QuizQuestion[] = [];
      if (fullText) {
        const mcq = extractAndValidateMcqs(fullText, quizTopic);
        if (mcq.hasMcq && mcq.questions.length > 0) {
          parsed = mcq.questions.map(q => ({
            id: q.id,
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation
          }));
        }
      }

      if (parsed.length === 0) {
        parsed = generateFallbackQuiz(quizTopic, quizCount, quizDiff).map(q => ({
          id: q.id,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation
        }));
        showToast('Generated curriculum practice questions.');
      }

      setGeneratedQuizQuestions(parsed);
      showToast('Quiz questions ready!');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate quiz');
    } finally {
      setQuizLoading(false);
    }
  };

  const handleSelectQuizAnswer = (qIndex: number, optIndex: number) => {
    if (quizSubmitted[qIndex]) return;
    const q = generatedQuizQuestions[qIndex];
    const isCorrect = optIndex === q.correctIndex;
    setQuizAnswers(prev => ({ ...prev, [qIndex]: optIndex }));
    setQuizSubmitted(prev => ({ ...prev, [qIndex]: true }));
    if (isCorrect) setQuizScore(prev => prev + 1);

    // If last question answered, save quiz session to Firebase
    if (Object.keys(quizSubmitted).length + 1 >= generatedQuizQuestions.length) {
      const finalScore = isCorrect ? quizScore + 1 : quizScore;
      const newSession: QuizSession = {
        id: `quiz-${Date.now()}`,
        userId: user?.uid,
        title: `${quizTopic} (${quizDiff})`,
        topic: quizTopic,
        subject: quizSubject,
        date: Date.now(),
        score: finalScore,
        total: generatedQuizQuestions.length,
        difficulty: quizDiff,
        quizType: 'mcq',
        questions: generatedQuizQuestions,
        userAnswers: { ...quizAnswers, [qIndex]: optIndex }
      };
      addQuizSession(newSession);
      showToast(`Quiz completed! Score: ${finalScore}/${generatedQuizQuestions.length}. Saved to Quiz History.`);
    }
  };

  // B. Flashcard Generator
  const handleGenerateDeck = async () => {
    if (!deckTopic.trim() && !deckFromNoteId) {
      showToast('Please enter a topic or select a note');
      return;
    }
    setGeneratingCards(true);

    try {
      let resultCards: Array<{ front: string; back: string }> = [];

      if (deckFromNoteId) {
        const found = notes.find(n => n.id === deckFromNoteId);
        if (found) {
          resultCards = await notesAiService.generateFlashcards(found.title, found.content);
        }
      }

      if (resultCards.length === 0) {
        const idToken = await getAuthToken();
        const effectiveTopic = deckTopic.trim() || 'Core Concepts';
        const prompt = `Generate exactly ${deckCount} study flashcards on "${effectiveTopic}" for "${deckSubject}".
Return ONLY a valid JSON array:
[{"front":"Question or concept","back":"Concise high-yield answer"}]`;

        const response = await fetch(apiUrl('/api/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            studyMode: 'study'
          })
        });

        const reader = response.body?.getReader();
        let fullText = '';
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;
          const text = decoder.decode(value);
          for (const line of text.split('\n')) {
            if (line.trim().startsWith('data:')) {
              try {
                const d = JSON.parse(line.replace(/^data:\s*/, ''));
                if (d.delta) fullText += d.delta;
                else if (d.fullText) fullText = d.fullText;
              } catch {}
            }
          }
        }

        const match = fullText.match(/\[[\s\S]*\]/);
        if (match) resultCards = JSON.parse(match[0]);
      }

      const cards: Flashcard[] = resultCards.map((c, i) => ({
        id: `card-${Date.now()}-${i}`,
        front: c.front,
        back: c.back,
        status: 'new'
      }));

      const newDeck: FlashcardDeck = {
        id: `deck-${Date.now()}`,
        userId: user?.uid,
        title: deckTopic.trim() || (notes.find(n => n.id === deckFromNoteId)?.title || 'Flashcards'),
        topic: deckTopic.trim() || 'General',
        subject: deckSubject,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        cards
      };

      addFlashcardDeck(newDeck);
      setSelectedDeckId(newDeck.id);
      setCardIndex(0);
      setCardFlipped(false);
      showToast('Flashcard Deck generated & saved!');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate flashcards');
    } finally {
      setGeneratingCards(false);
    }
  };

  // C. AI Summarizer
  const handleRunSummarizer = async () => {
    if (!summarizerText.trim()) {
      showToast('Please paste text to summarize');
      return;
    }
    setSummaryLoading(true);
    setSummaryResult('');
    try {
      const result = await notesAiService.summarizeText(summarizerText);
      setSummaryResult(result);
      showToast('Summary generated!');
    } catch (err: any) {
      showToast(err.message || 'Summarization failed');
    } finally {
      setSummaryLoading(false);
    }
  };

  // D. Topic Explainer
  const handleRunExplainer = async () => {
    if (!explainTopicInput.trim()) {
      showToast('Please enter a topic');
      return;
    }
    setExplainLoading(true);
    setExplainResult('');
    try {
      const result = await notesAiService.explainTopic(explainTopicInput, explainSubject, explainLang);
      setExplainResult(result);
      showToast('Topic explained!');
    } catch (err: any) {
      showToast(err.message || 'Failed to explain topic');
    } finally {
      setExplainLoading(false);
    }
  };

  // E. MCQ Generator
  const handleGenerateMcqs = async () => {
    if (!mcqTopic.trim()) {
      showToast('Please enter a topic');
      return;
    }
    setMcqLoading(true);
    setMcqQuestions([]);
    setMcqSelected({});
    try {
      const questions = await notesAiService.generateQuizFromNote(mcqTopic, `Focus on fundamental principles of ${mcqTopic}`, 5);
      setMcqQuestions(questions);
      showToast('5 MCQs generated!');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate MCQs');
    } finally {
      setMcqLoading(false);
    }
  };

  // F. PDF Summarizer
  const handleRunPdfSummarizer = async () => {
    if (!pdfSelectedDocId) {
      showToast('Please select an uploaded document');
      return;
    }
    setPdfLoading(true);
    setPdfSummaryResult('');
    setPdfQuestionsResult([]);
    try {
      const found = documents.find(d => d.id === pdfSelectedDocId);
      const docName = found?.name || 'Document';
      const prompt = `Analyze the uploaded document "${docName}".
1. **Executive Document Overview (3-4 sentences)**
2. **Key Concepts, Principles & Important Points**
3. **5 High-Yield Exam Review Questions**`;

      const idToken = await getAuthToken();
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          studyMode: 'study',
          options: { documentId: pdfSelectedDocId }
        })
      });

      const reader = response.body?.getReader();
      let fullText = '';
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        const text = decoder.decode(value);
        for (const line of text.split('\n')) {
          if (line.trim().startsWith('data:')) {
            try {
              const d = JSON.parse(line.replace(/^data:\s*/, ''));
              if (d.delta) fullText += d.delta;
              else if (d.fullText) fullText = d.fullText;
            } catch {}
          }
        }
      }

      setPdfSummaryResult(fullText);
      showToast('Document analyzed & summarized!');
    } catch (err: any) {
      showToast(err.message || 'Failed to summarize document');
    } finally {
      setPdfLoading(false);
    }
  };

  // G. Study Planner (Schedule Generation)
  const handleGenerateAiSchedule = async () => {
    setScheduleLoading(true);
    try {
      const subjectList = SUBJECTS.slice(0, 4).join(', ');
      const prompt = `Create a realistic, high-yield 7-day study timetable for a university student.
Subjects: ${subjectList}. Target: Final Semester Exams.
Provide daily morning, afternoon, and evening blocks with review sessions.`;

      const idToken = await getAuthToken();
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          studyMode: 'study'
        })
      });

      const reader = response.body?.getReader();
      let fullText = '';
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        const text = decoder.decode(value);
        for (const line of text.split('\n')) {
          if (line.trim().startsWith('data:')) {
            try {
              const d = JSON.parse(line.replace(/^data:\s*/, ''));
              if (d.delta) fullText += d.delta;
              else if (d.fullText) fullText = d.fullText;
            } catch {}
          }
        }
      }

      setAiScheduleText(fullText);
      showToast('7-Day Study Schedule generated!');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate schedule');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleAddTask = () => {
    if (!planTopic.trim()) return;
    addTask(planTopic.trim(), planSubject, planDate || 'Tomorrow', planPriority);
    setPlanTopic('');
    showToast('Task added to Study Planner');
  };

  // H. Mock Test
  const handleStartMockTest = async () => {
    if (!mockTopic.trim()) {
      showToast('Please enter an exam topic');
      return;
    }
    setMockLoading(true);
    setMockQuestions([]);
    setMockAnswers({});
    setMockFinished(false);
    setMockScore(0);
    setMockTimeRemaining(mockDuration * 60);

    try {
      const questions = await notesAiService.generateQuizFromNote(
        mockTopic,
        `Comprehensive university examination for ${mockSubject}: ${mockTopic}`,
        10
      );
      setMockQuestions(questions);
      setMockRunning(true);
      showToast(`Mock examination started! Timer set to ${mockDuration} minutes.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to prepare mock test');
    } finally {
      setMockLoading(false);
    }
  };

  const handleMockSubmit = () => {
    setMockRunning(false);
    setMockFinished(true);

    let score = 0;
    mockQuestions.forEach((q, idx) => {
      if (mockAnswers[idx] === q.correctIndex) score += 1;
    });
    setMockScore(score);

    // Save mock test session to Quiz History
    const session: QuizSession = {
      id: `mock-${Date.now()}`,
      userId: user?.uid,
      title: `Mock Exam: ${mockTopic}`,
      topic: mockTopic,
      subject: mockSubject,
      date: Date.now(),
      score,
      total: mockQuestions.length,
      difficulty: 'hard',
      quizType: 'mock',
      timeSpentSeconds: mockDuration * 60 - mockTimeRemaining,
      questions: mockQuestions,
      userAnswers: mockAnswers
    };
    addQuizSession(session);
    showToast(`Exam submitted! Score: ${score}/${mockQuestions.length}. Saved to Quiz History.`);
  };

  // I. Code Explainer
  const handleRunCodeExplainer = async () => {
    if (!codeSnippet.trim()) {
      showToast('Please paste code to explain');
      return;
    }
    setCodeLoading(true);
    setCodeResult('');
    try {
      const result = await notesAiService.explainCode(codeSnippet, codeLang);
      setCodeResult(result);
      showToast('Code explanation generated!');
    } catch (err: any) {
      showToast(err.message || 'Code explanation failed');
    } finally {
      setCodeLoading(false);
    }
  };

  // Cross-Connection: Save any tool result directly to My Notes
  const handleSaveResultToNotes = (title: string, content: string, subject = 'General') => {
    addNote({
      title,
      content,
      subject,
      topic: 'Study Tools Output',
      folder: 'Study Tools',
      tags: ['study-tools', 'ai-generated']
    });
    showToast('Saved directly to My Notes!');
  };

  if (activeModal !== 'tools') return null;

  return (
    <div
      className="fixed inset-0 z-[60] w-screen h-screen bg-[#0A0A0A] flex flex-col overflow-hidden"
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          setActiveModal(null);
        }
      }}
    >
      <div className="w-full h-full bg-[#0A0A0A] flex flex-col overflow-hidden">
        
        {/* ── Top Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#262626] bg-[#0D0D0D]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#141414] text-white border border-[#262626]">
              <Layers size={19} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Study Tools — AI Learning Toolkit</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1A1A1A] text-zinc-300 border border-[#262626]">
                  9 AI Tools
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA] hidden sm:block">
                Quizzes, flashcards, summarizers, topic explainers, mock tests & code analysis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentTool !== 'dashboard' && (
              <button
                type="button"
                onClick={() => setCurrentTool('dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] text-zinc-200 hover:text-white border border-[#262626] text-xs font-semibold hover:bg-[#1C1C1C] transition-colors"
              >
                <ChevronLeft size={14} />
                <span>All Tools</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Main Interactive Content Area ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0A0A0A]">

          {/* ══════════════════════════════════════════════════════════
              DASHBOARD VIEW: 9 Tool Cards Grid
             ══════════════════════════════════════════════════════════ */}
          {currentTool === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white mb-1">Select an AI Learning Tool</h3>
                <p className="text-xs text-[#71717A]">
                  Each tool connects directly with your Notes, Quizzes, and Firestore storage.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* 1. AI Quiz Generator */}
                <ToolCard
                  title="AI Quiz Generator"
                  desc="Generate topic-based MCQs, true/false, and conceptual questions with instant grading and explanations."
                  icon={Award}
                  badge="Exam Practice"
                  onClick={() => setCurrentTool('quiz_generator')}
                />

                {/* 2. Flashcard Generator */}
                <ToolCard
                  title="Flashcard Generator"
                  desc="Generate interactive 3D flip cards from any topic or saved note. Track learned and mastered concepts."
                  icon={Layers}
                  badge="Active Recall"
                  onClick={() => setCurrentTool('flashcard_generator')}
                />

                {/* 3. AI Summarizer */}
                <ToolCard
                  title="AI Summarizer"
                  desc="Paste lengthy textbooks, syllabus chapters or notes to extract executive takeaways and must-know definitions."
                  icon={FileText}
                  badge="High-Yield"
                  onClick={() => setCurrentTool('summarizer')}
                />

                {/* 4. Topic Explainer */}
                <ToolCard
                  title="Topic Explainer"
                  desc="Step-by-step breakdown with intuitive real-world analogies in simple English (ELI5) or conversational Hinglish."
                  icon={HelpCircle}
                  badge="Concept Clarity"
                  onClick={() => setCurrentTool('topic_explainer')}
                />

                {/* 5. MCQ Generator */}
                <ToolCard
                  title="MCQ Generator"
                  desc="Topic-based 4-option practice with immediate feedback and detailed answers for rapid revision."
                  icon={CheckCircle2}
                  badge="Practice"
                  onClick={() => setCurrentTool('mcq_generator')}
                />

                {/* 6. PDF Summarizer */}
                <ToolCard
                  title="PDF Summarizer"
                  desc="Extract and analyze uploaded documents to generate chapter summaries, key points, and exam questions."
                  icon={FileUp}
                  badge="Document RAG"
                  onClick={() => setCurrentTool('pdf_summarizer')}
                />

                {/* 7. Study Planner */}
                <ToolCard
                  title="Study Planner"
                  desc="Build daily/weekly study routines, set task deadlines, track completed assignments, and generate 7-day timetables."
                  icon={CalendarDays}
                  badge="Time Management"
                  onClick={() => setCurrentTool('study_planner')}
                />

                {/* 8. Mock Test */}
                <ToolCard
                  title="Mock Examination"
                  desc="Simulate an actual timed test with a live countdown clock, automated scoring, and performance analytics."
                  icon={Clock}
                  badge="Timed Exam"
                  onClick={() => setCurrentTool('mock_test')}
                />

                {/* 9. Code Explainer */}
                <ToolCard
                  title="Code Explainer"
                  desc="Line-by-line programming breakdown, algorithmic time & space complexity, bug detection, and clean solutions."
                  icon={Code2}
                  badge="Coding & Tech"
                  onClick={() => setCurrentTool('code_explainer')}
                />

                {/* 10. Focus Pomodoro */}
                <ToolCard
                  title="Focus Pomodoro"
                  desc="25-minute study focus interval followed by a 5-minute break to maximize mental retention."
                  icon={Timer}
                  badge="Productivity"
                  onClick={() => setCurrentTool('pomodoro')}
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TOOL A: AI Quiz Generator
             ══════════════════════════════════════════════════════════ */}
          {currentTool === 'quiz_generator' && (
            <div className="max-w-3xl mx-auto space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Award size={18} /> AI Quiz Generator
                  </h3>
                  <p className="text-xs text-[#71717A]">Generate customized quizzes with instant grading and explanations.</p>
                </div>
              </div>

              {generatedQuizQuestions.length === 0 ? (
                <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Topic *</label>
                      <input
                        type="text"
                        value={quizTopic}
                        onChange={e => setQuizTopic(e.target.value)}
                        placeholder="e.g. Operating Systems Process Scheduling, Organic Chemistry..."
                        className="w-full bg-[#141414] text-xs sm:text-sm text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Subject</label>
                      <select
                        value={quizSubject}
                        onChange={e => setQuizSubject(e.target.value)}
                        className="w-full bg-[#141414] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none"
                      >
                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Difficulty</label>
                      <select
                        value={quizDiff}
                        onChange={e => setQuizDiff(e.target.value as any)}
                        className="w-full bg-[#141414] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none"
                      >
                        <option value="easy">Easy (Foundational)</option>
                        <option value="medium">Medium (Standard Exam)</option>
                        <option value="hard">Hard (Advanced / Competitive)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateQuiz}
                    disabled={quizLoading || !quizTopic.trim()}
                    className="w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {quizLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>{quizLoading ? 'Generating Questions...' : 'Generate & Start Quiz'}</span>
                  </button>
                </div>
              ) : (
                /* Interactive Quiz Runner */
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Question {quizCurrentQ + 1} of {generatedQuizQuestions.length}</span>
                    <span className="font-mono">Score: {quizScore}</span>
                  </div>

                  {(() => {
                    const q = generatedQuizQuestions[quizCurrentQ];
                    const isSubmitted = quizSubmitted[quizCurrentQ];
                    const selected = quizAnswers[quizCurrentQ];
                    return (
                      <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-4">
                        <p className="text-sm font-semibold text-white">{q.question}</p>
                        <div className="space-y-2">
                          {q.options.map((opt, oi) => {
                            let cls = 'bg-[#141414] border-[#262626] text-zinc-300 hover:border-zinc-500';
                            if (isSubmitted) {
                              if (oi === q.correctIndex) cls = 'bg-white text-black border-white font-semibold';
                              else if (selected === oi) cls = 'bg-red-500/10 text-red-400 border-red-500/30';
                              else cls = 'bg-[#111111] border-[#222222] text-zinc-600';
                            }
                            return (
                              <button
                                key={oi}
                                type="button"
                                disabled={isSubmitted}
                                onClick={() => handleSelectQuizAnswer(quizCurrentQ, oi)}
                                className={`w-full p-3 rounded-xl border text-left text-xs transition-colors flex items-center justify-between ${cls}`}
                              >
                                <span>{opt}</span>
                                {isSubmitted && oi === q.correctIndex && <CheckCircle2 size={14} className="text-black" />}
                              </button>
                            );
                          })}
                        </div>

                        {isSubmitted && (
                          <div className="p-3 rounded-xl bg-[#141414] border border-[#262626] text-xs text-[#A1A1AA]">
                            <p className="font-semibold text-white mb-0.5">Explanation</p>
                            <p>{q.explanation}</p>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                          <button
                            type="button"
                            disabled={quizCurrentQ === 0}
                            onClick={() => setQuizCurrentQ(prev => prev - 1)}
                            className="px-3 py-1.5 rounded-xl bg-[#141414] text-xs text-zinc-300 hover:text-white border border-[#262626] disabled:opacity-40"
                          >
                            Previous
                          </button>
                          {quizCurrentQ < generatedQuizQuestions.length - 1 ? (
                            <button
                              type="button"
                              onClick={() => setQuizCurrentQ(prev => prev + 1)}
                              className="px-4 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200"
                            >
                              Next Question
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setGeneratedQuizQuestions([]);
                                setActiveModal('quiz');
                              }}
                              className="px-4 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200"
                            >
                              View in Quiz History →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TOOL B: Flashcard Generator
             ══════════════════════════════════════════════════════════ */}
          {currentTool === 'flashcard_generator' && (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Layers size={18} /> Flashcard Generator & Reviewer
                  </h3>
                  <p className="text-xs text-[#71717A]">3D flip revision cards with learning progress tracking.</p>
                </div>
              </div>

              {/* Creator Controls */}
              <div className="p-4 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Topic</label>
                    <input
                      type="text"
                      value={deckTopic}
                      onChange={e => setDeckTopic(e.target.value)}
                      placeholder="e.g. Graph Theory, Photosynthesis..."
                      className="w-full bg-[#141414] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Or Pick From Saved Notes</label>
                    <select
                      value={deckFromNoteId}
                      onChange={e => setDeckFromNoteId(e.target.value)}
                      className="w-full bg-[#141414] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none"
                    >
                      <option value="">-- Choose a note (optional) --</option>
                      {notes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateDeck}
                  disabled={generatingCards || (!deckTopic.trim() && !deckFromNoteId)}
                  className="w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generatingCards ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>{generatingCards ? 'Generating Flashcards...' : 'Generate New Deck'}</span>
                </button>
              </div>

              {/* Interactive 3D Flip Card View */}
              {selectedDeck && currentCard && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-[#71717A]">
                    <span className="text-white font-medium">{selectedDeck.title}</span>
                    <span>Card {cardIndex + 1} of {selectedDeck.cards.length}</span>
                  </div>

                  {/* 3D Flip Card */}
                  <div
                    onClick={() => setCardFlipped(prev => !prev)}
                    className="min-h-[220px] p-6 rounded-2xl bg-[#0F0F0F] border border-[#262626] hover:border-zinc-500 cursor-pointer transition-all flex flex-col items-center justify-center text-center select-none shadow-lg relative"
                  >
                    <span className="absolute top-3 left-4 text-[10px] uppercase font-bold tracking-wider text-[#71717A]">
                      {cardFlipped ? 'Answer (Click to flip)' : 'Question (Click to flip)'}
                    </span>
                    <p className="text-sm sm:text-base font-semibold text-white leading-relaxed max-w-md">
                      {cardFlipped ? currentCard.back : currentCard.front}
                    </p>
                    <span className="absolute bottom-3 text-[10px] text-zinc-500 flex items-center gap-1">
                      <RefreshCw size={10} /> Click card to flip
                    </span>
                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={cardIndex === 0}
                      onClick={() => {
                        setCardIndex(p => p - 1);
                        setCardFlipped(false);
                      }}
                      className="px-3 py-2 rounded-xl bg-[#141414] text-xs text-white border border-[#262626] disabled:opacity-40"
                    >
                      <ChevronLeft size={14} />
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          updateFlashcard(selectedDeck.id, currentCard.id, 'learning');
                          showToast('Marked as Still Learning');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#181818] text-xs text-amber-300 border border-[#2E2E2E]"
                      >
                        Still Learning
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateFlashcard(selectedDeck.id, currentCard.id, 'mastered');
                          showToast('Marked as Mastered! ⭐');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200"
                      >
                        Mastered
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={cardIndex >= selectedDeck.cards.length - 1}
                      onClick={() => {
                        setCardIndex(p => p + 1);
                        setCardFlipped(false);
                      }}
                      className="px-3 py-2 rounded-xl bg-[#141414] text-xs text-white border border-[#262626] disabled:opacity-40"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TOOL C: AI Summarizer
             ══════════════════════════════════════════════════════════ */}
          {currentTool === 'summarizer' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText size={18} /> AI Text Summarizer
                  </h3>
                  <p className="text-xs text-[#71717A]">Paste any article, paper or lecture notes to extract key takeaways.</p>
                </div>
              </div>

              <textarea
                value={summarizerText}
                onChange={e => setSummarizerText(e.target.value)}
                placeholder="Paste study text, lecture transcript, or chapter excerpt here..."
                className="w-full h-40 bg-[#0D0D0D] text-xs sm:text-sm text-white p-3.5 rounded-xl border border-[#262626] focus:outline-none"
              />

              <button
                type="button"
                onClick={handleRunSummarizer}
                disabled={summaryLoading || !summarizerText.trim()}
                className="w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {summaryLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>{summaryLoading ? 'Synthesizing Summary...' : 'Summarize Text'}</span>
              </button>

              {summaryResult && (
                <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-3">
                  <div className="flex items-center justify-between border-b border-[#202020] pb-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Executive Revision Summary</h4>
                    <button
                      type="button"
                      onClick={() => handleSaveResultToNotes('Revision Summary', summaryResult)}
                      className="px-2.5 py-1 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 flex items-center gap-1"
                    >
                      <Plus size={12} /> Save to My Notes
                    </button>
                  </div>
                  <div className="text-xs text-zinc-200 leading-relaxed max-h-72 overflow-y-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryResult}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TOOL D: Topic Explainer
             ══════════════════════════════════════════════════════════ */}
          {currentTool === 'topic_explainer' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <HelpCircle size={18} /> Topic Explainer (ELI5 & Hinglish)
                  </h3>
                  <p className="text-xs text-[#71717A]">Step-by-step intuitive concept explanations with real-world examples.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Topic *</label>
                    <input
                      type="text"
                      value={explainTopicInput}
                      onChange={e => setExplainTopicInput(e.target.value)}
                      placeholder="e.g. Backpropagation, Quantum Tunneling, Master Theorem..."
                      className="w-full bg-[#141414] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Language</label>
                    <select
                      value={explainLang}
                      onChange={e => setExplainLang(e.target.value as any)}
                      className="w-full bg-[#141414] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none"
                    >
                      <option value="english">Simple English (ELI5)</option>
                      <option value="hinglish">Conversational Hinglish</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRunExplainer}
                  disabled={explainLoading || !explainTopicInput.trim()}
                  className="w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {explainLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>{explainLoading ? 'Formulating Explanation...' : 'Explain Concept'}</span>
                </button>
              </div>

              {explainResult && (
                <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-3">
                  <div className="flex items-center justify-between border-b border-[#202020] pb-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">{explainTopicInput} Explained</h4>
                    <button
                      type="button"
                      onClick={() => handleSaveResultToNotes(`${explainTopicInput} (Explanation)`, explainResult, explainSubject)}
                      className="px-2.5 py-1 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 flex items-center gap-1"
                    >
                      <Plus size={12} /> Save to My Notes
                    </button>
                  </div>
                  <div className="text-xs text-zinc-200 leading-relaxed max-h-80 overflow-y-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{explainResult}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TOOL E: MCQ Generator
             ══════════════════════════════════════════════════════════ */}
          {currentTool === 'mcq_generator' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <CheckCircle2 size={18} /> Instant MCQ Generator
                  </h3>
                  <p className="text-xs text-[#71717A]">4-option rapid testing with instant explanations.</p>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={mcqTopic}
                  onChange={e => setMcqTopic(e.target.value)}
                  placeholder="Enter subject or topic (e.g. Data Structures, Cell Division)..."
                  className="flex-1 bg-[#0D0D0D] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleGenerateMcqs}
                  disabled={mcqLoading || !mcqTopic.trim()}
                  className="px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {mcqLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>Generate</span>
                </button>
              </div>

              {mcqQuestions.length > 0 && (
                <div className="space-y-3">
                  {mcqQuestions.map((q, qi) => {
                    const sel = mcqSelected[qi];
                    const isAnswered = sel !== undefined;
                    return (
                      <div key={q.id} className="p-4 rounded-xl bg-[#0D0D0D] border border-[#202020] space-y-2.5">
                        <p className="text-xs font-semibold text-white">{qi + 1}. {q.question}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, oi) => {
                            let cls = 'bg-[#141414] border-[#262626] text-zinc-300 hover:border-zinc-500';
                            if (isAnswered) {
                              if (oi === q.correctIndex) cls = 'bg-white text-black border-white font-semibold';
                              else if (sel === oi) cls = 'bg-red-500/10 text-red-400 border-red-500/30';
                              else cls = 'bg-[#111111] text-zinc-600 border-[#222222]';
                            }
                            return (
                              <button
                                key={oi}
                                type="button"
                                disabled={isAnswered}
                                onClick={() => setMcqSelected(p => ({ ...p, [qi]: oi }))}
                                className={`p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center justify-between ${cls}`}
                              >
                                <span>{opt}</span>
                                {isAnswered && oi === q.correctIndex && <CheckCircle2 size={13} className="text-black" />}
                              </button>
                            );
                          })}
                        </div>
                        {isAnswered && (
                          <p className="text-[11px] text-[#A1A1AA] pt-1">
                            <strong>Explanation:</strong> {q.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TOOL F: PDF Summarizer
             ══════════════════════════════════════════════════════════ */}
          {currentTool === 'pdf_summarizer' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileUp size={18} /> PDF Document Summarizer & Q&A
                  </h3>
                  <p className="text-xs text-[#71717A]">Analyze uploaded course documents to extract summaries and exam questions.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-3">
                <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Select Uploaded Document</label>
                <select
                  value={pdfSelectedDocId}
                  onChange={e => setPdfSelectedDocId(e.target.value)}
                  className="w-full bg-[#141414] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none"
                >
                  <option value="">-- Choose a document from My Documents --</option>
                  {documents.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.size})</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleRunPdfSummarizer}
                  disabled={pdfLoading || !pdfSelectedDocId}
                  className="w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>{pdfLoading ? 'Analyzing PDF Document...' : 'Summarize & Extract Questions'}</span>
                </button>
              </div>

              {pdfSummaryResult && (
                <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-3">
                  <div className="flex items-center justify-between border-b border-[#202020] pb-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Document Analysis</h4>
                    <button
                      type="button"
                      onClick={() => handleSaveResultToNotes('PDF Summary', pdfSummaryResult)}
                      className="px-2.5 py-1 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 flex items-center gap-1"
                    >
                      <Plus size={12} /> Save to My Notes
                    </button>
                  </div>
                  <div className="text-xs text-zinc-200 leading-relaxed max-h-80 overflow-y-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{pdfSummaryResult}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TOOL G: Study Planner
             ══════════════════════════════════════════════════════════ */}
          {currentTool === 'study_planner' && (
            <div className="max-w-3xl mx-auto space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <CalendarDays size={18} /> Study Planner & Schedule Builder
                  </h3>
                  <p className="text-xs text-[#71717A]">Track daily targets, deadlines, and generate 7-day study timetables.</p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAiSchedule}
                  disabled={scheduleLoading}
                  className="px-3 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 flex items-center gap-1"
                >
                  {scheduleLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  <span>AI 7-Day Timetable</span>
                </button>
              </div>

              {/* Add Task Input */}
              <div className="p-4 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={planTopic}
                      onChange={e => setPlanTopic(e.target.value)}
                      placeholder="Task or topic to study..."
                      className="w-full bg-[#141414] text-xs text-white p-2 rounded-xl border border-[#262626] focus:outline-none"
                    />
                  </div>
                  <div>
                    <select
                      value={planSubject}
                      onChange={e => setPlanSubject(e.target.value)}
                      className="w-full bg-[#141414] text-xs text-white p-2 rounded-xl border border-[#262626] focus:outline-none"
                    >
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTask}
                    disabled={!planTopic.trim()}
                    className="py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-zinc-200 disabled:opacity-50"
                  >
                    + Add Task
                  </button>
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Your Active Tasks ({tasks.length})</h4>
                {tasks.length === 0 ? (
                  <p className="text-xs text-[#71717A]">No study tasks scheduled yet.</p>
                ) : (
                  tasks.map(t => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-[#0D0D0D] border border-[#202020] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleTask(t.id)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            t.completed ? 'bg-white border-white text-black' : 'border-[#333333]'
                          }`}
                        >
                          {t.completed && <Check size={11} />}
                        </button>
                        <span className={`text-white ${t.completed ? 'line-through text-zinc-500' : ''}`}>
                          {t.title}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#141414] text-zinc-400 border border-[#262626]">
                          {t.subject}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteTask(t.id)}
                        className="text-zinc-600 hover:text-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* AI Schedule View */}
              {aiScheduleText && (
                <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-3">
                  <div className="flex items-center justify-between border-b border-[#202020] pb-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">7-Day Study Plan</h4>
                    <button
                      type="button"
                      onClick={() => handleSaveResultToNotes('7-Day Timetable', aiScheduleText)}
                      className="px-2.5 py-1 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 flex items-center gap-1"
                    >
                      <Plus size={12} /> Save to My Notes
                    </button>
                  </div>
                  <div className="text-xs text-zinc-200 leading-relaxed max-h-72 overflow-y-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiScheduleText}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TOOL H: Mock Examination Test
             ══════════════════════════════════════════════════════════ */}
          {currentTool === 'mock_test' && (
            <div className="max-w-3xl mx-auto space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Clock size={18} /> Simulated Mock Examination
                  </h3>
                  <p className="text-xs text-[#71717A]">Timed test simulation with performance diagnostics and auto-save.</p>
                </div>
                {mockRunning && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono font-bold">
                    <Clock size={14} className="animate-pulse" />
                    <span>{formatTimer(mockTimeRemaining)} remaining</span>
                  </div>
                )}
              </div>

              {!mockRunning && !mockFinished ? (
                <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Exam Topic *</label>
                      <input
                        type="text"
                        value={mockTopic}
                        onChange={e => setMockTopic(e.target.value)}
                        placeholder="e.g. Full Semester Computer Networks, Organic Reactions..."
                        className="w-full bg-[#141414] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Duration</label>
                      <select
                        value={mockDuration}
                        onChange={e => setMockDuration(Number(e.target.value))}
                        className="w-full bg-[#141414] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none"
                      >
                        <option value={15}>15 Minutes</option>
                        <option value={30}>30 Minutes</option>
                        <option value={45}>45 Minutes</option>
                        <option value={60}>60 Minutes</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartMockTest}
                    disabled={mockLoading || !mockTopic.trim()}
                    className="w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {mockLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    <span>{mockLoading ? 'Preparing Exam Paper...' : 'Begin Timed Mock Exam'}</span>
                  </button>
                </div>
              ) : mockRunning ? (
                /* Live Timed Exam Runner */
                <div className="space-y-4">
                  {mockQuestions.map((q, qi) => (
                    <div key={q.id} className="p-4 rounded-xl bg-[#0D0D0D] border border-[#202020] space-y-2.5">
                      <p className="text-xs font-semibold text-white">Q{qi + 1}. {q.question}</p>
                      <div className="space-y-1.5">
                        {q.options.map((opt, oi) => {
                          const isSel = mockAnswers[qi] === oi;
                          return (
                            <button
                              key={oi}
                              type="button"
                              onClick={() => setMockAnswers(p => ({ ...p, [qi]: oi }))}
                              className={`w-full p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center justify-between ${
                                isSel ? 'bg-white text-black font-semibold border-white' : 'bg-[#141414] text-zinc-300 border-[#262626]'
                              }`}
                            >
                              <span>{opt}</span>
                              {isSel && <CheckCircle2 size={13} className="text-black" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleMockSubmit}
                    className="w-full py-3 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors"
                  >
                    Submit Mock Exam Paper
                  </button>
                </div>
              ) : (
                /* Exam Results & Review */
                <div className="p-6 rounded-2xl bg-[#0D0D0D] border border-[#202020] text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center mx-auto">
                    <Trophy size={28} />
                  </div>
                  <h4 className="text-xl font-bold text-white">Exam Completed!</h4>
                  <p className="text-sm font-semibold text-zinc-300">
                    Your Score: <span className="text-white text-lg font-bold">{mockScore}</span> / {mockQuestions.length} ({Math.round((mockScore / mockQuestions.length) * 100)}%)
                  </p>
                  <p className="text-xs text-[#71717A]">
                    Results and incorrect answers have been logged to your Quiz History dashboard.
                  </p>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setMockFinished(false)}
                      className="px-4 py-2 rounded-xl bg-[#141414] text-white text-xs font-semibold border border-[#262626]"
                    >
                      Take Another Exam
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal('quiz')}
                      className="px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200"
                    >
                      View Quiz History →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TOOL I: Code Explainer
             ══════════════════════════════════════════════════════════ */}
          {currentTool === 'code_explainer' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Code2 size={18} /> Code Explainer & Bug Analyzer
                  </h3>
                  <p className="text-xs text-[#71717A]">Line-by-line algorithm analysis, complexity checks, and bug fixes.</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#71717A] uppercase">Language</label>
                  <select
                    value={codeLang}
                    onChange={e => setCodeLang(e.target.value)}
                    className="bg-[#141414] text-xs text-white px-2 py-1 rounded-lg border border-[#262626] focus:outline-none"
                  >
                    <option value="Python">Python</option>
                    <option value="JavaScript / TypeScript">JavaScript / TypeScript</option>
                    <option value="Java">Java</option>
                    <option value="C++">C++</option>
                    <option value="C">C</option>
                    <option value="SQL">SQL</option>
                  </select>
                </div>

                <textarea
                  value={codeSnippet}
                  onChange={e => setCodeSnippet(e.target.value)}
                  placeholder="Paste programming code snippet here..."
                  className="w-full h-44 bg-[#0A0A0A] text-xs text-white p-3.5 rounded-xl border border-[#262626] focus:outline-none font-mono"
                />

                <button
                  type="button"
                  onClick={handleRunCodeExplainer}
                  disabled={codeLoading || !codeSnippet.trim()}
                  className="w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {codeLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>{codeLoading ? 'Analyzing Code...' : 'Explain Code & Bugs'}</span>
                </button>
              </div>

              {codeResult && (
                <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-3">
                  <div className="flex items-center justify-between border-b border-[#202020] pb-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Analysis & Explanation</h4>
                    <button
                      type="button"
                      onClick={() => handleSaveResultToNotes('Code Explanation', codeResult, 'Computer Science')}
                      className="px-2.5 py-1 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 flex items-center gap-1"
                    >
                      <Plus size={12} /> Save to My Notes
                    </button>
                  </div>
                  <div className="text-xs text-zinc-200 leading-relaxed max-h-80 overflow-y-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{codeResult}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TOOL J: Pomodoro Focus Timer
             ══════════════════════════════════════════════════════════ */}
          {currentTool === 'pomodoro' && (
            <div className="max-w-md mx-auto p-6 rounded-2xl bg-[#0D0D0D] border border-[#202020] text-center space-y-6">
              <div>
                <h3 className="text-base font-bold text-white mb-1">Focus Pomodoro</h3>
                <p className="text-xs text-[#71717A]">25 min focus interval • 5 min recharge</p>
              </div>

              <div className="w-48 h-48 rounded-full border-4 border-[#262626] bg-[#0A0A0A] flex flex-col items-center justify-center mx-auto shadow-inner">
                <span className="text-4xl font-mono font-bold text-white tracking-widest">{formatTimer(timerSeconds)}</span>
                <span className="text-[11px] uppercase tracking-wider text-[#71717A] mt-1">{timerMode}</span>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setTimerRunning(p => !p)}
                  className="px-6 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors flex items-center gap-2"
                >
                  {timerRunning ? <Pause size={14} /> : <Play size={14} />}
                  <span>{timerRunning ? 'Pause' : 'Start Focus'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setTimerSeconds(timerMode === 'focus' ? 25 * 60 : 5 * 60);
                  }}
                  className="p-2.5 rounded-xl bg-[#141414] text-zinc-400 hover:text-white border border-[#262626]"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Individual Tool Card on Dashboard ──────────────────────────────────── */
const ToolCard: React.FC<{
  title: string;
  desc: string;
  icon: React.ElementType;
  badge: string;
  onClick: () => void;
}> = ({ title, desc, icon: Icon, badge, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#202020] hover:border-zinc-500 hover:bg-[#111111] transition-all cursor-pointer flex flex-col justify-between group shadow-sm select-none"
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 rounded-xl bg-[#171717] text-white border border-[#262626] group-hover:scale-105 transition-transform">
            <Icon size={18} />
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#141414] text-zinc-400 border border-[#262626]">
            {badge}
          </span>
        </div>
        <h4 className="text-sm font-bold text-white mb-1.5 group-hover:text-zinc-100">{title}</h4>
        <p className="text-xs text-[#71717A] leading-relaxed mb-4">{desc}</p>
      </div>

      <div className="pt-2 border-t border-[#1C1C1C] flex items-center justify-between text-xs font-semibold text-zinc-400 group-hover:text-white">
        <span>Launch Tool</span>
        <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
};
