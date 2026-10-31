import React, { useState, useCallback } from 'react';
import {
  Award, X, CheckCircle2, XCircle, HelpCircle,
  RotateCcw, Sparkles, History, Loader2, ChevronRight,
  BookOpen, Trophy, AlertCircle, FileText, Trash2
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { getAuthToken } from '../../services/aiClient';
import { apiUrl } from '../../utils/apiConfig';
import { validateMcqQuestion, extractAndValidateMcqs } from '../../utils/mcqParser';
import { QuizQuestion, QuizSession } from '../../types/chat';

type QuizView = 'home' | 'setup' | 'active' | 'results' | 'history';

interface QuizSetup {
  topic: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
  documentId?: string;
}

const SUBJECTS = [
  'Computer Science', 'Mathematics', 'Physics', 'Chemistry',
  'Biology', 'History', 'Economics', 'English', 'General'
];

export const QuizModal: React.FC = () => {
  const { activeModal, setActiveModal, quizSessions, addQuizSession, deleteQuizSession, documents } = useChat();
  const { user } = useAuth();

  const [view, setView]                     = useState<QuizView>('home');
  const [setup, setSetup]                   = useState<QuizSetup>({ topic: '', subject: 'Computer Science', difficulty: 'medium', count: 5 });
  const [questions, setQuestions]           = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx]         = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted]           = useState<Record<number, boolean>>({});
  const [score, setScore]                   = useState(0);
  const [generating, setGenerating]         = useState(false);
  const [genError, setGenError]             = useState('');
  const [selectedHistory, setSelectedHistory] = useState<QuizSession | null>(null);

  if (activeModal !== 'quiz') return null;

  /* ── Generate quiz via Grok backend ── */
  const generateQuiz = useCallback(async () => {
    if (!setup.topic.trim()) return;
    setGenerating(true);
    setGenError('');

    try {
      const idToken = await getAuthToken();

      const docSourceInfo = setup.documentId
        ? ` based strictly on the uploaded document passages for ${setup.subject}`
        : '';

      const prompt = `Generate exactly ${setup.count} exam-standard MCQ questions on the topic: "${setup.topic}" for subject "${setup.subject}"${docSourceInfo}. Difficulty: ${setup.difficulty}.
Return ONLY a valid JSON array matching this exact schema (no additional markdown, no code fence, just the raw JSON array):
[{"id":"q1","question":"Question text?","options":["Option A","Option B","Option C","Option D"],"correctIndex":0,"explanation":"Detailed reason why this answer is correct and others are wrong."}]`;

      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          studyMode: 'mcq',
          options: {
            difficulty: setup.difficulty,
            topic: setup.topic,
            subject: setup.subject,
            documentId: setup.documentId
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
        throw new Error(data.error || data.message || `Quiz request failed (${response.status})`);
      }

      // Collect full SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream received from server.');
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

      // 1. Parse & strictly validate JSON array from MCQ response
      let parsed: QuizQuestion[] = [];
      const jsonMatch = fullText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const raw = JSON.parse(jsonMatch[0]);
          if (Array.isArray(raw)) {
            parsed = raw.map((q: any, i: number) => {
              const validated = validateMcqQuestion(q, i);
              if (!validated) return null;
              return {
                id: validated.id,
                question: validated.question,
                options: validated.options,
                correctIndex: validated.correctIndex,
                explanation: validated.explanation
              };
            }).filter(Boolean) as QuizQuestion[];
          }
        } catch {}
      }

      // 2. Fallback: try json:studyai-mcq block or embedded questions
      if (parsed.length === 0) {
        const mcqResult = extractAndValidateMcqs(fullText);
        if (mcqResult.hasMcq && mcqResult.questions.length > 0) {
          parsed = mcqResult.questions.map(q => ({
            id: q.id,
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation
          }));
        }
      }

      if (parsed.length === 0) throw new Error('Could not parse valid quiz questions from AI response. Please retry.');

      setQuestions(parsed);
      setCurrentIdx(0);
      setSelectedAnswers({});
      setSubmitted({});
      setScore(0);
      setView('active');
    } catch (err: any) {
      setGenError(err.message || 'Failed to generate quiz. Please try again.');
    } finally {
      setGenerating(false);
    }
  }, [setup, user]);

  /* ── Select + auto-show explanation ── */
  const handleSelect = (optIdx: number) => {
    if (submitted[currentIdx]) return;
    setSelectedAnswers(p => ({ ...p, [currentIdx]: optIdx }));
    setSubmitted(p => ({ ...p, [currentIdx]: true }));
    if (optIdx === questions[currentIdx].correctIndex) {
      setScore(p => p + 1);
    }
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(p => p + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    const session: QuizSession = {
      id:          `quiz-${Date.now()}`,
      userId:      user?.uid,
      title:       `${setup.subject}: ${setup.topic}`,
      topic:       setup.topic,
      subject:     setup.subject,
      date:        Date.now(),
      score,
      total:       questions.length,
      userAnswers: selectedAnswers,
      questions
    };
    addQuizSession(session);
    setView('results');
  };

  const handleRestart = () => {
    setView('setup');
    setSetup(s => ({ ...s, topic: '' }));
    setQuestions([]);
    setSelectedAnswers({});
    setSubmitted({});
    setScore(0);
    setGenError('');
  };

  /* ── Render: Home ── */
  const renderHome = () => (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setView('setup')}
          className="p-5 rounded-2xl bg-[#141414] border border-[#262626] hover:border-zinc-500 hover:bg-[#1C1C1C] text-left transition-all group"
        >
          <Sparkles size={22} className="text-white mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="text-sm font-semibold text-white mb-1">Generate New Quiz</h3>
          <p className="text-[11px] text-[#A1A1AA]">Create AI-powered MCQs on any topic</p>
        </button>
        <button
          onClick={() => setView('history')}
          className="p-5 rounded-2xl bg-[#141414] border border-[#262626] hover:border-zinc-500 hover:bg-[#1C1C1C] text-left transition-all group"
        >
          <History size={22} className="text-white mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="text-sm font-semibold text-white mb-1">Past Attempts</h3>
          <p className="text-[11px] text-[#A1A1AA]">{quizSessions.length} quiz{quizSessions.length !== 1 ? 'zes' : ''} completed</p>
        </button>
      </div>

      {quizSessions.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider mb-2">Recent Quizzes</p>
          <div className="space-y-2">
            {quizSessions.slice(0, 4).map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedHistory(s); setView('history'); }}
                className="w-full p-3.5 rounded-xl bg-[#141414] border border-[#262626] hover:border-zinc-500 hover:bg-[#1C1C1C] text-left flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{s.title}</p>
                  <p className="text-[11px] text-[#71717A]">{new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs font-bold text-white">
                    {s.score}/{s.total}
                  </p>
                  <p className="text-[10px] text-[#A1A1AA]">{Math.round((s.score / s.total) * 100)}%</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /* ── Render: Setup ── */
  const renderSetup = () => (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div>
        <label className="text-xs text-[#A1A1AA] mb-1.5 block">Topic *</label>
        <input
          type="text"
          value={setup.topic}
          onChange={e => setSetup(p => ({ ...p, topic: e.target.value }))}
          placeholder="e.g. Dijkstra's Algorithm, Photosynthesis, World War 2…"
          className="w-full bg-[#111111] text-sm text-white px-3.5 py-2.5 rounded-xl border border-[#262626] focus:outline-none focus:border-white placeholder:text-[#71717A] transition-colors"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#A1A1AA] mb-1.5 block">Subject</label>
          <select
            value={setup.subject}
            onChange={e => setSetup(p => ({ ...p, subject: e.target.value }))}
            className="w-full bg-[#111111] text-xs text-white px-3 py-2.5 rounded-xl border border-[#262626] focus:outline-none focus:border-white"
          >
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#A1A1AA] mb-1.5 block">Difficulty</label>
          <select
            value={setup.difficulty}
            onChange={e => setSetup(p => ({ ...p, difficulty: e.target.value as any }))}
            className="w-full bg-[#111111] text-xs text-white px-3 py-2.5 rounded-xl border border-[#262626] focus:outline-none focus:border-white"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {documents.length > 0 && (
        <div>
          <label className="text-xs text-[#A1A1AA] mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-white">
              <FileText size={13} className="text-white" />
              Ground in Processed Document (Optional)
            </span>
            {setup.documentId && (
              <button
                type="button"
                onClick={() => setSetup(p => ({ ...p, documentId: undefined }))}
                className="text-[10px] text-[#A1A1AA] hover:text-white"
              >
                Clear
              </button>
            )}
          </label>
          <select
            value={setup.documentId || ''}
            onChange={e => {
              const docId = e.target.value || undefined;
              const docObj = documents.find(d => d.id === docId);
              setSetup(p => ({
                ...p,
                documentId: docId,
                topic: docObj && !p.topic ? docObj.name.replace(/\.pdf$/i, '') : p.topic
              }));
            }}
            className="w-full bg-[#111111] text-xs text-white px-3 py-2.5 rounded-xl border border-[#262626] focus:outline-none focus:border-white"
          >
            <option value="">None (Use general academic knowledge)</option>
            {documents
              .filter(d => d.status === 'ready')
              .map(d => (
                <option key={d.id} value={d.id}>
                  📄 {d.name} ({d.pageCount || d.pages || '?'} pages)
                </option>
              ))}
          </select>
          <p className="text-[10px] text-[#71717A] mt-1">
            Questions will be extracted and verified directly from your uploaded PDF text.
          </p>
        </div>
      )}

      <div>
        <label className="text-xs text-[#A1A1AA] mb-1.5 block">Number of Questions: <span className="text-white font-mono">{setup.count}</span></label>
        <input
          type="range" min={3} max={15} step={1}
          value={setup.count}
          onChange={e => setSetup(p => ({ ...p, count: Number(e.target.value) }))}
          className="w-full accent-white"
        />
        <div className="flex justify-between text-[10px] text-[#71717A] mt-0.5">
          <span>3</span><span>15</span>
        </div>
      </div>

      {genError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[#1C1C1C] border border-[#262626] text-xs text-white">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-[#A1A1AA]" />
          {genError}
        </div>
      )}

      <button
        onClick={generateQuiz}
        disabled={!setup.topic.trim() || generating}
        className="w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {generating ? <><Loader2 size={15} className="animate-spin" />Generating {setup.count} questions…</> : <><Sparkles size={15} />Generate Quiz</>}
      </button>
    </div>
  );

  /* ── Render: Active quiz ── */
  const renderActive = () => {
    const q = questions[currentIdx];
    const isSubmitted = submitted[currentIdx];
    const selected = selectedAnswers[currentIdx];
    const pct = Math.round(((currentIdx) / questions.length) * 100);

    return (
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs text-[#A1A1AA] mb-1.5">
            <span>Question {currentIdx + 1} of {questions.length}</span>
            <span className="font-mono text-white">Score: {score}/{currentIdx + (isSubmitted ? 1 : 0)}</span>
          </div>
          <div className="h-1 bg-[#1C1C1C] rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Question */}
        <div className="p-4 rounded-xl bg-[#141414] border border-[#262626]">
          <p className="text-sm font-medium text-white leading-relaxed">{q.question}</p>
        </div>

        {/* Options */}
        <div className="space-y-2">
          {q.options.map((opt, idx) => {
            let cls = 'bg-[#141414] border-[#262626] text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C] hover:border-zinc-500 cursor-pointer';
            if (isSubmitted) {
              if (idx === q.correctIndex) cls = 'bg-white text-black border-white font-medium cursor-default shadow-sm';
              else if (selected === idx) cls = 'bg-[#1C1C1C] border-[#3F3F46] text-[#71717A] line-through cursor-default';
              else cls = 'bg-[#111111] border-[#262626] text-[#52525B] opacity-50 cursor-default';
            }
            return (
              <button
                key={idx}
                onClick={() => handleSelect(idx)}
                disabled={isSubmitted}
                className={`w-full p-3 rounded-xl border text-left text-xs transition-all flex items-center justify-between gap-2 ${cls}`}
              >
                <span className="flex-1">{opt}</span>
                {isSubmitted && idx === q.correctIndex && <CheckCircle2 size={15} className="text-black flex-shrink-0" />}
                {isSubmitted && selected === idx && idx !== q.correctIndex && <XCircle size={15} className="text-[#71717A] flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {isSubmitted && (
          <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] text-xs text-[#A1A1AA] leading-relaxed">
            <p className="font-semibold text-white mb-1 flex items-center gap-1.5">
              <HelpCircle size={13} className="text-white" />Explanation
            </p>
            {q.explanation}
          </div>
        )}

        {isSubmitted && (
          <div className="flex justify-end">
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors"
            >
              {currentIdx < questions.length - 1 ? 'Next Question' : 'View Results'}
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    );
  };

  /* ── Render: Results ── */
  const renderResults = () => {
    const pct = Math.round((score / questions.length) * 100);
    const grade = pct >= 80 ? 'Excellent!'
                : pct >= 60 ? 'Good Job!'
                : pct >= 40 ? 'Keep Going'
                :             'Study More';

    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full border-2 border-[#262626] bg-[#141414] text-white flex items-center justify-center mx-auto mb-4">
            <Trophy size={32} className="text-white" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{grade}</h3>
          <p className="text-white text-lg font-semibold">{score} / {questions.length} correct</p>
          <p className="text-[#A1A1AA] text-sm mt-1">{pct}% accuracy · {setup.topic}</p>
        </div>

        {/* Per-question review */}
        <div className="space-y-2 mb-6">
          <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider mb-2">Question Review</p>
          {questions.map((q, i) => {
            const userAns = selectedAnswers[i];
            const correct = userAns === q.correctIndex;
            return (
              <div key={q.id} className="p-3.5 rounded-xl border border-[#262626] bg-[#141414] text-xs">
                <div className="flex items-start gap-2">
                  {correct ? <CheckCircle2 size={14} className="text-white flex-shrink-0 mt-0.5" /> : <XCircle size={14} className="text-[#71717A] flex-shrink-0 mt-0.5" />}
                  <div>
                    <p className="text-white font-medium mb-1">{q.question}</p>
                    {!correct && <p className="text-[#A1A1AA]">Your answer: <span className="text-[#71717A] line-through">{q.options[userAns] ?? 'No answer'}</span></p>}
                    <p className="text-[#A1A1AA]">Correct: <span className="text-white font-medium">{q.options[q.correctIndex]}</span></p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleRestart}
            className="flex-1 py-2.5 rounded-xl bg-[#141414] text-white text-xs font-semibold hover:bg-[#1C1C1C] border border-[#262626] flex items-center justify-center gap-2"
          >
            <RotateCcw size={14} /> New Quiz
          </button>
          <button
            onClick={() => setView('history')}
            className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 flex items-center justify-center gap-2"
          >
            <History size={14} /> View History
          </button>
        </div>
      </div>
    );
  };

  /* ── Render: History ── */
  const renderHistory = () => {
    if (selectedHistory) {
      const pct = Math.round((selectedHistory.score / selectedHistory.total) * 100);
      return (
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => setSelectedHistory(null)} className="flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-white">
              ← Back to history
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setQuestions(selectedHistory.questions);
                  setCurrentIdx(0);
                  setSelectedAnswers({});
                  setSubmitted({});
                  setScore(0);
                  setView('active');
                }}
                className="flex items-center gap-1 text-xs text-black font-semibold hover:bg-zinc-200 px-3 py-1.5 rounded-xl bg-white transition-colors"
              >
                <RotateCcw size={12} /> Retake
              </button>
              <button
                onClick={() => {
                  deleteQuizSession(selectedHistory.id);
                  setSelectedHistory(null);
                }}
                className="flex items-center gap-1 text-xs text-[#A1A1AA] hover:text-white px-2.5 py-1.5 rounded-xl bg-[#141414] border border-[#262626] hover:bg-[#1C1C1C] transition-colors"
                title="Delete attempt"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#141414] border border-[#262626]">
            <h3 className="text-sm font-semibold text-white">{selectedHistory.title}</h3>
            <p className="text-xs text-[#71717A] mt-0.5">{new Date(selectedHistory.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            <div className="flex items-center gap-4 mt-3">
              <div className="text-center">
                <p className="text-xl font-bold text-white">{selectedHistory.score}/{selectedHistory.total}</p>
                <p className="text-[10px] text-[#71717A]">Score</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{pct}%</p>
                <p className="text-[10px] text-[#71717A]">Accuracy</p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-[#71717A] font-semibold uppercase tracking-wider">Questions & Explanations</p>
          {selectedHistory.questions.map((q, i) => {
            const userAns = selectedHistory.userAnswers?.[i];
            const correct = userAns === q.correctIndex;
            return (
              <div key={q.id} className="p-3.5 rounded-xl border border-[#262626] bg-[#141414] text-xs space-y-2">
                <div className="flex items-start gap-2">
                  {correct ? <CheckCircle2 size={14} className="text-white flex-shrink-0 mt-0.5" /> : <XCircle size={14} className="text-[#71717A] flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-white font-medium leading-relaxed">{q.question}</p>
                    <div className="mt-1.5 space-y-0.5">
                      <p className="text-[#A1A1AA]">Correct: <span className="text-white font-medium">{q.options[q.correctIndex]}</span></p>
                      {!correct && typeof userAns === 'number' && (
                        <p className="text-[#A1A1AA]">Your answer: <span className="text-[#71717A] line-through">{q.options[userAns]}</span></p>
                      )}
                    </div>
                  </div>
                </div>
                {q.explanation && (
                  <div className="bg-[#111111] p-3 rounded-lg border border-[#262626] text-[11px] text-[#A1A1AA] leading-relaxed">
                    <span className="text-white font-semibold flex items-center gap-1 mb-0.5">
                      <HelpCircle size={11} /> Explanation:
                    </span>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {quizSessions.length === 0 ? (
          <div className="py-14 text-center">
            <BookOpen size={32} className="mx-auto mb-3 opacity-40 text-white" />
            <p className="text-white text-sm font-medium">No quiz history yet</p>
            <p className="text-[#71717A] text-xs mt-1">Generate and complete a quiz to see your history here.</p>
          </div>
        ) : (
          quizSessions.map(s => {
            const pct = Math.round((s.score / s.total) * 100);
            return (
              <button
                key={s.id}
                onClick={() => setSelectedHistory(s)}
                className="w-full p-4 rounded-xl bg-[#141414] border border-[#262626] hover:border-zinc-500 hover:bg-[#1C1C1C] text-left transition-colors flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-[#1C1C1C] text-white border border-[#262626]">
                  {pct}%
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{s.title}</p>
                  <p className="text-[11px] text-[#71717A]">{new Date(s.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {s.score}/{s.total} correct</p>
                </div>
                <ChevronRight size={15} className="text-[#71717A] flex-shrink-0" />
              </button>
            );
          })
        )}
      </div>
    );
  };

  const VIEW_TITLES: Record<QuizView, string> = {
    home:    'Quiz Practice',
    setup:   'Create New Quiz',
    active:  `${setup.subject}: ${setup.topic || 'Quiz'}`,
    results: 'Quiz Results',
    history: 'Attempt History'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
      <div className="w-full max-w-xl bg-[#0A0A0A] border border-[#262626] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#141414] text-white border border-[#262626]">
              <Award size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">{VIEW_TITLES[view]}</h2>
              <p className="text-xs text-[#A1A1AA]">AI-generated · scored · Firestore-backed</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view !== 'home' && (
              <button
                onClick={() => { setView('home'); setGenError(''); }}
                className="text-xs text-[#A1A1AA] hover:text-white px-2.5 py-1 rounded-lg hover:bg-[#1C1C1C] transition-colors"
              >
                ← Home
              </button>
            )}
            <button onClick={() => setActiveModal(null)} className="p-1.5 text-[#A1A1AA] hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        {view === 'home'    && renderHome()}
        {view === 'setup'   && renderSetup()}
        {view === 'active'  && renderActive()}
        {view === 'results' && renderResults()}
        {view === 'history' && renderHistory()}
      </div>
    </div>
  );
};
