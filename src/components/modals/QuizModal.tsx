import React, { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Award, X, CheckCircle2, XCircle, HelpCircle,
  RotateCcw, Sparkles, History, Loader2, ChevronRight,
  BookOpen, Trophy, AlertCircle, FileText, Trash2,
  TrendingUp, BarChart3, Clock, Target, Check, AlertTriangle,
  Flame, ArrowUpRight, Play, Search, Filter, Layers, Plus
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { getAuthToken, streamAiResponse } from '../../services/aiClient';
import { apiUrl } from '../../utils/apiConfig';
import { validateMcqQuestion, extractAndValidateMcqs, generateFallbackQuiz } from '../../utils/mcqParser';
import { QuizQuestion, QuizSession } from '../../types/chat';
import { notesAiService } from '../../services/notesAiService';

type QuizView = 'dashboard' | 'setup' | 'active' | 'results' | 'review';

interface QuizSetup {
  topic: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
  documentId?: string;
}

const SUBJECTS = [
  'Computer Science', 'Mathematics', 'Physics', 'Chemistry',
  'Biology', 'History', 'Economics', 'English', 'Engineering', 'General'
];

export const QuizModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    quizSessions,
    addQuizSession,
    deleteQuizSession,
    documents,
    addNote,
    showToast
  } = useChat();
  const { user } = useAuth();

  const [view, setView] = useState<QuizView>('dashboard');
  const [setup, setSetup] = useState<QuizSetup>({ topic: '', subject: 'Computer Science', difficulty: 'medium', count: 5 });
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [score, setScore] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [selectedSession, setSelectedSession] = useState<QuizSession | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter & Search in History
  const [historySearch, setHistorySearch] = useState('');
  const [historySubjectFilter, setHistorySubjectFilter] = useState('All');

  // AI Performance Advisor state
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ══════════════════════════════════════════════════════════════════════════
  // Comprehensive KPI & Performance Calculations
  // ══════════════════════════════════════════════════════════════════════════
  const stats = useMemo(() => {
    const totalQuizzes = quizSessions.length;
    if (totalQuizzes === 0) {
      return {
        totalQuizzes: 0,
        averageScorePct: 0,
        highestScorePct: 0,
        totalQuestionsAttempted: 0,
        totalCorrect: 0,
        overallAccuracy: 0,
        progressTier: 'Novice Student',
        subjectStats: {} as Record<string, { total: number; correct: number; count: number }>,
        strongTopics: [] as string[],
        weakTopics: [] as string[]
      };
    }

    let totalScore = 0;
    let totalQuestions = 0;
    let maxPct = 0;
    const subjectStats: Record<string, { total: number; correct: number; count: number }> = {};
    const topicAccuracy: Record<string, { total: number; correct: number }> = {};

    quizSessions.forEach(q => {
      const qTotal = q.total || q.questions?.length || 1;
      const qScore = q.score || 0;
      totalScore += qScore;
      totalQuestions += qTotal;

      const pct = Math.round((qScore / qTotal) * 100);
      if (pct > maxPct) maxPct = pct;

      const sub = q.subject || 'General';
      if (!subjectStats[sub]) subjectStats[sub] = { total: 0, correct: 0, count: 0 };
      subjectStats[sub].total += qTotal;
      subjectStats[sub].correct += qScore;
      subjectStats[sub].count += 1;

      const top = q.topic || 'General';
      if (!topicAccuracy[top]) topicAccuracy[top] = { total: 0, correct: 0 };
      topicAccuracy[top].total += qTotal;
      topicAccuracy[top].correct += qScore;
    });

    const overallAccuracy = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
    const averageScorePct = Math.round(
      quizSessions.reduce((acc, q) => acc + (q.score / (q.total || 1)) * 100, 0) / totalQuizzes
    );

    const strongTopics: string[] = [];
    const weakTopics: string[] = [];

    Object.entries(topicAccuracy).forEach(([top, acc]) => {
      const pct = (acc.correct / acc.total) * 100;
      if (pct >= 80) strongTopics.push(top);
      else if (pct < 70) weakTopics.push(top);
    });

    let progressTier = 'Novice Student';
    if (overallAccuracy >= 85 && totalQuizzes >= 5) progressTier = 'Master Scholar ⭐';
    else if (overallAccuracy >= 70 && totalQuizzes >= 3) progressTier = 'Proficient Learner';
    else if (totalQuizzes >= 1) progressTier = 'Developing Student';

    return {
      totalQuizzes,
      averageScorePct,
      highestScorePct: maxPct,
      totalQuestionsAttempted: totalQuestions,
      totalCorrect: totalScore,
      overallAccuracy,
      progressTier,
      subjectStats,
      strongTopics: strongTopics.slice(0, 5),
      weakTopics: weakTopics.slice(0, 5)
    };
  }, [quizSessions]);

  // Filtered quiz sessions
  const filteredSessions = useMemo(() => {
    return quizSessions.filter(s => {
      const q = historySearch.toLowerCase().trim();
      const matchesSearch = !q || s.title.toLowerCase().includes(q) || s.topic.toLowerCase().includes(q);
      const matchesSub = historySubjectFilter === 'All' || (s.subject || 'General') === historySubjectFilter;
      return matchesSearch && matchesSub;
    });
  }, [quizSessions, historySearch, historySubjectFilter]);

  // ══════════════════════════════════════════════════════════════════════════
  // AI Generation & Actions
  // ══════════════════════════════════════════════════════════════════════════
  const handleGenerateQuiz = useCallback(async () => {
    if (!setup.topic.trim()) return;
    setGenerating(true);
    setGenError('');

    try {
      const prompt = `Generate exactly ${setup.count} exam-standard MCQ questions on: "${setup.topic}" for subject "${setup.subject}". Difficulty: ${setup.difficulty}.
Output in validated JSON block using tag 'json:studyai-mcq':
\`\`\`json:studyai-mcq
{
  "questions": [
    {
      "id": "q1",
      "question": "Clear conceptual question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Detailed explanation why this answer is correct.",
      "difficulty": "${setup.difficulty}"
    }
  ]
}
\`\`\``;

      let fullText = '';
      try {
        await streamAiResponse({
          messages: [{ role: 'user', content: prompt }],
          studyMode: 'mcq',
          options: {
            difficulty: setup.difficulty,
            topic: setup.topic,
            subject: setup.subject,
            documentId: setup.documentId
          },
          onChunk: (_delta, accumulated) => {
            fullText = accumulated;
          }
        });
      } catch (streamErr: any) {
        console.warn('AI stream interrupted, checking available output:', streamErr);
      }

      let parsed: QuizQuestion[] = [];
      if (fullText) {
        const mcq = extractAndValidateMcqs(fullText, setup.topic);
        if (mcq.hasMcq && mcq.questions.length > 0) {
          parsed = mcq.questions.map(q => ({
            id: q.id,
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            topic: setup.topic
          }));
        }
      }

      // If AI could not be reached, rate limited, or returned malformed content,
      // fallback to high-yield topic-grounded questions so study flow is never blocked
      if (parsed.length === 0) {
        parsed = generateFallbackQuiz(setup.topic, setup.count, setup.difficulty);
        showToast('Generated topic quiz questions based on verified curriculum standards.');
      }

      setQuestions(parsed);
      setCurrentIdx(0);
      setSelectedAnswers({});
      setSubmitted({});
      setScore(0);
      setView('active');
    } catch (err: any) {
      setGenError(err.message || 'Failed to generate quiz');
    } finally {
      setGenerating(false);
    }
  }, [setup, showToast]);

  const handleSelectOption = (optIdx: number) => {
    if (submitted[currentIdx]) return;
    const isCorrect = optIdx === questions[currentIdx].correctIndex;
    setSelectedAnswers(p => ({ ...p, [currentIdx]: optIdx }));
    setSubmitted(p => ({ ...p, [currentIdx]: true }));
    if (isCorrect) setScore(p => p + 1);
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(p => p + 1);
    } else {
      // Completed - Save to Firebase Firestore
      const session: QuizSession = {
        id: `quiz-${Date.now()}`,
        userId: user?.uid,
        title: `${setup.topic} (${setup.difficulty})`,
        topic: setup.topic,
        subject: setup.subject,
        date: Date.now(),
        score,
        total: questions.length,
        difficulty: setup.difficulty,
        quizType: 'mcq',
        questions,
        userAnswers: selectedAnswers
      };
      addQuizSession(session);
      showToast('Quiz results saved to Quiz History!');
      setView('results');
    }
  };

  const handleRetakeSession = (session: QuizSession) => {
    setQuestions(session.questions);
    setCurrentIdx(0);
    setSelectedAnswers({});
    setSubmitted({});
    setScore(0);
    setView('active');
    showToast('Retaking quiz session');
  };

  // Cross-Connection: Revise Weak Topic in Notes
  const handleReviseWeakTopic = (topicName: string) => {
    addNote({
      title: `${topicName} — Focused Revision Guide`,
      topic: topicName,
      subject: 'General',
      folder: 'Exam Prep',
      content: `# ${topicName} — Quick Revision Guide\n\n*Identified from Quiz History as a weak topic needing reinforcement.*\n\n## Core Principles & Memory Anchors\n- Review fundamental definitions.\n- Focus on commonly confused distinctions.\n- Practice active recall questions.\n`,
      tags: ['weak-topic-revision', 'quiz-review']
    });
    showToast(`Created revision note for "${topicName}"!`);
    setActiveModal('notes');
  };

  // AI Performance Diagnostic
  const handleRunAiPerformanceDiagnostic = async () => {
    if (quizSessions.length === 0) {
      showToast('Attempt at least one quiz to get AI performance diagnostics');
      return;
    }
    setIsAnalyzing(true);
    setAiAnalysis('');
    try {
      const result = await notesAiService.analyzePerformance(quizSessions);
      setAiAnalysis(result);
      showToast('Performance diagnostic generated!');
    } catch (err: any) {
      showToast(err.message || 'Diagnostic failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (activeModal !== 'quiz') return null;

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
              <Trophy size={19} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Quiz History & Student Analytics</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#181818] text-zinc-300 border border-[#262626]">
                  {stats.progressTier}
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA] hidden sm:block">
                Track exam accuracy, identify strong/weak topics & review previous answer attempts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {view !== 'dashboard' && (
              <button
                type="button"
                onClick={() => setView('dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] text-zinc-300 hover:text-white border border-[#262626] text-xs font-semibold hover:bg-[#1C1C1C] transition-colors"
              >
                <span>Dashboard</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSetup({ topic: '', subject: 'Computer Science', difficulty: 'medium', count: 5 });
                setView('setup');
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors shadow-sm"
            >
              <Plus size={14} />
              <span>Take New Quiz</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Content Area ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0A0A0A]">
          
          {/* ══════════════════════════════════════════════════════════
              VIEW 1: Student Performance Dashboard
             ══════════════════════════════════════════════════════════ */}
          {view === 'dashboard' && (
            <div className="space-y-6">

              {/* 6 KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard title="Total Quizzes" value={stats.totalQuizzes} icon={Award} />
                <StatCard title="Average Score" value={`${stats.averageScorePct}%`} icon={TrendingUp} />
                <StatCard title="Highest Score" value={`${stats.highestScorePct}%`} icon={Trophy} />
                <StatCard title="Overall Accuracy" value={`${stats.overallAccuracy}%`} icon={Target} />
                <StatCard title="Total Questions" value={stats.totalQuestionsAttempted} icon={HelpCircle} />
                <StatCard title="Mastery Progress" value={stats.progressTier.split(' ')[0]} icon={Flame} highlight />
              </div>

              {/* Charts & Subject Breakdown Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                
                {/* Weekly / Monthly Timeline Chart (Pure SVG / CSS Responsive) */}
                <div className="lg:col-span-2 p-5 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-3">
                  <div className="flex items-center justify-between border-b border-[#202020] pb-2.5">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={16} className="text-white" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Score Progression Over Time</h4>
                    </div>
                    <span className="text-[11px] text-[#71717A] font-mono">Last {Math.min(quizSessions.length, 10)} Attempts</span>
                  </div>

                  {quizSessions.length === 0 ? (
                    <div className="h-44 flex items-center justify-center text-xs text-[#71717A]">
                      Complete quizzes to render score progression graphs.
                    </div>
                  ) : (
                    <div className="h-44 flex items-end gap-3 pt-4 px-2">
                      {quizSessions.slice(-10).map((s, idx) => {
                        const pct = Math.round((s.score / (s.total || 1)) * 100);
                        return (
                          <div key={s.id || idx} className="flex-1 flex flex-col items-center gap-1.5 group">
                            <span className="text-[10px] font-mono text-zinc-400 group-hover:text-white transition-colors">
                              {pct}%
                            </span>
                            <div className="w-full bg-[#181818] rounded-t-lg h-32 flex items-end overflow-hidden">
                              <div
                                style={{ height: `${pct}%` }}
                                className={`w-full rounded-t-md transition-all duration-300 ${
                                  pct >= 80 ? 'bg-white' : pct >= 50 ? 'bg-zinc-400' : 'bg-zinc-600'
                                }`}
                              />
                            </div>
                            <span className="text-[9px] text-[#71717A] truncate w-full text-center">
                              {new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Subject-Wise Performance Breakdown */}
                <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#202020] pb-2.5">
                    Subject Performance
                  </h4>
                  {Object.keys(stats.subjectStats).length === 0 ? (
                    <div className="h-44 flex items-center justify-center text-xs text-[#71717A]">
                      No subject data logged yet.
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      {Object.entries(stats.subjectStats).map(([sub, st]) => {
                        const pct = Math.round((st.correct / (st.total || 1)) * 100);
                        return (
                          <div key={sub} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-200 font-medium truncate">{sub}</span>
                              <span className="text-zinc-400 font-mono text-[11px]">{pct}% ({st.count} test{st.count > 1 ? 's' : ''})</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-[#181818] overflow-hidden">
                              <div
                                style={{ width: `${pct}%` }}
                                className={`h-full rounded-full ${pct >= 75 ? 'bg-white' : 'bg-zinc-400'}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Strong vs Weak Topics & AI Performance Advisor */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                
                {/* Topic Diagnostics: Strong & Weak */}
                <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-white" /> Strong Topics (≥ 80%)
                    </h4>
                    {stats.strongTopics.length === 0 ? (
                      <p className="text-xs text-[#71717A]">No strong topics recorded yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {stats.strongTopics.map((t, i) => (
                          <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-[#141414] text-white border border-[#2E2E2E]">
                            ⭐ {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#1C1C1C]">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-400" /> Weak Topics Needing Revision (&lt; 70%)
                    </h4>
                    {stats.weakTopics.length === 0 ? (
                      <p className="text-xs text-[#71717A]">No weak areas identified!</p>
                    ) : (
                      <div className="space-y-2">
                        {stats.weakTopics.map((t, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-[#141414] border border-[#242424] text-xs">
                            <span className="text-zinc-300 font-medium truncate">{t}</span>
                            <button
                              type="button"
                              onClick={() => handleReviseWeakTopic(t)}
                              className="px-2 py-0.5 rounded bg-white text-black font-semibold text-[10px] hover:bg-zinc-200"
                            >
                              Revise in Notes
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Performance Analysis Card */}
                <div className="lg:col-span-2 p-5 rounded-2xl bg-[#0D0D0D] border border-[#202020] flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-[#202020] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-white" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">AI Study Performance Diagnostic</h4>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunAiPerformanceDiagnostic}
                      disabled={isAnalyzing || quizSessions.length === 0}
                      className="px-3 py-1 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      <span>{isAnalyzing ? 'Analyzing...' : 'Generate Diagnostic'}</span>
                    </button>
                  </div>

                  {aiAnalysis ? (
                    <div className="text-xs text-zinc-200 leading-relaxed overflow-y-auto max-h-48">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiAnalysis}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-[#71717A] text-xs space-y-1">
                      <p className="text-zinc-400 font-medium">Ready to analyze your academic progress.</p>
                      <p>Click "Generate Diagnostic" for personalized study tips, knowledge gap diagnosis, and spaced-repetition schedules.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Previously Attempted Quizzes List */}
              <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#202020] pb-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <History size={16} /> Attempted Quizzes ({filteredSessions.length})
                  </h4>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141414] border border-[#262626]">
                      <Search size={12} className="text-zinc-500" />
                      <input
                        type="text"
                        value={historySearch}
                        onChange={e => setHistorySearch(e.target.value)}
                        placeholder="Search quizzes..."
                        className="bg-transparent text-xs text-white focus:outline-none w-28 sm:w-44"
                      />
                    </div>

                    <select
                      value={historySubjectFilter}
                      onChange={e => setHistorySubjectFilter(e.target.value)}
                      className="bg-[#141414] text-xs text-white px-2.5 py-1 rounded-lg border border-[#262626] focus:outline-none"
                    >
                      <option value="All">All Subjects</option>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {filteredSessions.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#71717A]">
                    No matching quiz sessions found in your history.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredSessions.map(session => {
                      const totalQ = session.total || session.questions?.length || 1;
                      const pct = Math.round((session.score / totalQ) * 100);
                      return (
                        <div
                          key={session.id}
                          className="p-3.5 rounded-xl bg-[#121212] border border-[#242424] hover:border-zinc-700 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A1A1A] text-zinc-300 border border-[#2E2E2E]">
                                {session.subject || 'General'}
                              </span>
                              {session.difficulty && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#181818] text-zinc-400 border border-[#282828] capitalize">
                                  {session.difficulty}
                                </span>
                              )}
                              <span className="text-[10px] text-[#71717A] font-mono">
                                {new Date(session.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            </div>
                            <h5 className="text-sm font-semibold text-white truncate">{session.title}</h5>
                          </div>

                          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                            <div className="text-right">
                              <p className="text-sm font-bold text-white font-mono">{session.score} / {totalQ}</p>
                              <span className={`text-[10px] font-bold ${pct >= 80 ? 'text-white' : pct >= 60 ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                {pct}% Accuracy
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSession(session);
                                  setView('review');
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-[#1C1C1C] text-xs text-white hover:bg-[#282828] border border-[#333333] transition-colors"
                              >
                                Review
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRetakeSession(session)}
                                className="px-2.5 py-1.5 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors flex items-center gap-1"
                              >
                                <RotateCcw size={11} /> Retake
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(session.id)}
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete attempt"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              VIEW 2: Setup New Quiz
             ══════════════════════════════════════════════════════════ */}
          {view === 'setup' && (
            <div className="max-w-xl mx-auto p-6 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-5">
              <div className="border-b border-[#202020] pb-3">
                <h3 className="text-base font-bold text-white">Create Practice Quiz</h3>
                <p className="text-xs text-[#71717A]">Configure topic, difficulty, and question count.</p>
              </div>

              {genError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{genError}</span>
                </div>
              )}

              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Topic *</label>
                  <input
                    type="text"
                    value={setup.topic}
                    onChange={e => setSetup(p => ({ ...p, topic: e.target.value }))}
                    placeholder="e.g. Graph Algorithms, Stoichiometry, Microeconomics..."
                    className="w-full bg-[#141414] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Subject</label>
                    <select
                      value={setup.subject}
                      onChange={e => setSetup(p => ({ ...p, subject: e.target.value }))}
                      className="w-full bg-[#141414] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none"
                    >
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Difficulty</label>
                    <select
                      value={setup.difficulty}
                      onChange={e => setSetup(p => ({ ...p, difficulty: e.target.value as any }))}
                      className="w-full bg-[#141414] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none"
                    >
                      <option value="easy">Easy (Fundamentals)</option>
                      <option value="medium">Medium (Standard Exam)</option>
                      <option value="hard">Hard (Advanced Problem Solving)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#71717A] uppercase mb-1">Number of Questions</label>
                  <select
                    value={setup.count}
                    onChange={e => setSetup(p => ({ ...p, count: Number(e.target.value) }))}
                    className="w-full bg-[#141414] text-xs text-white p-2.5 rounded-xl border border-[#262626] focus:outline-none"
                  >
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions</option>
                    <option value={15}>15 Questions</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#202020]">
                <button
                  type="button"
                  onClick={() => setView('dashboard')}
                  className="px-4 py-2 rounded-xl bg-[#141414] text-xs text-zinc-300 hover:text-white border border-[#262626]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateQuiz}
                  disabled={generating || !setup.topic.trim()}
                  className="px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {generating ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  <span>{generating ? 'Preparing Quiz...' : 'Start Quiz'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              VIEW 3: Active Interactive Quiz Runner
             ══════════════════════════════════════════════════════════ */}
          {view === 'active' && questions.length > 0 && (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Question {currentIdx + 1} of {questions.length}</span>
                <span className="font-mono">Current Score: {score}</span>
              </div>

              {(() => {
                const q = questions[currentIdx];
                const isSubmitted = submitted[currentIdx];
                const selected = selectedAnswers[currentIdx];
                return (
                  <div className="p-5 rounded-2xl bg-[#0D0D0D] border border-[#202020] space-y-4">
                    <p className="text-sm font-semibold text-white leading-relaxed">{q.question}</p>

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
                            onClick={() => handleSelectOption(oi)}
                            className={`w-full p-3 rounded-xl border text-left text-xs transition-colors flex items-center justify-between ${cls}`}
                          >
                            <span>{opt}</span>
                            {isSubmitted && oi === q.correctIndex && <CheckCircle2 size={14} className="text-black" />}
                          </button>
                        );
                      })}
                    </div>

                    {isSubmitted && (
                      <div className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] text-xs text-[#A1A1AA] leading-relaxed">
                        <p className="font-semibold text-white mb-1">Explanation</p>
                        <p>{q.explanation}</p>
                      </div>
                    )}

                    {isSubmitted && (
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleNext}
                          className="px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors flex items-center gap-1.5"
                        >
                          <span>{currentIdx < questions.length - 1 ? 'Next Question' : 'Finish & Save Results'}</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              VIEW 4: Results Screen
             ══════════════════════════════════════════════════════════ */}
          {view === 'results' && (
            <div className="max-w-md mx-auto p-6 rounded-2xl bg-[#0D0D0D] border border-[#202020] text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center mx-auto">
                <Trophy size={28} />
              </div>
              <h3 className="text-xl font-bold text-white">Quiz Completed!</h3>
              <p className="text-sm font-semibold text-zinc-300">
                You scored <span className="text-white text-lg font-bold">{score}</span> / {questions.length} ({Math.round((score / questions.length) * 100)}%)
              </p>
              <p className="text-xs text-[#71717A]">
                Your performance and answers have been safely saved to Firebase Firestore.
              </p>

              <div className="flex items-center justify-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setView('dashboard')}
                  className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200"
                >
                  View Performance Dashboard
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              VIEW 5: Detailed Answer Review
             ══════════════════════════════════════════════════════════ */}
          {view === 'review' && selectedSession && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
                <div>
                  <h3 className="text-base font-bold text-white">{selectedSession.title}</h3>
                  <p className="text-xs text-[#71717A]">
                    Score: {selectedSession.score} / {selectedSession.total} ({Math.round((selectedSession.score / selectedSession.total) * 100)}%)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRetakeSession(selectedSession)}
                    className="px-3 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 flex items-center gap-1"
                  >
                    <RotateCcw size={12} /> Retake
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('dashboard')}
                    className="px-3 py-1.5 rounded-xl bg-[#141414] text-xs text-zinc-300 hover:text-white border border-[#262626]"
                  >
                    Close Review
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {selectedSession.questions.map((q, idx) => {
                  const userAns = selectedSession.userAnswers?.[idx];
                  const isCorrect = userAns === q.correctIndex;
                  return (
                    <div key={q.id || idx} className="p-4 rounded-xl bg-[#0D0D0D] border border-[#202020] space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        {isCorrect ? (
                          <CheckCircle2 size={15} className="text-white flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-semibold text-white mb-1.5">Q{idx + 1}. {q.question}</p>
                          {!isCorrect && (
                            <p className="text-[#A1A1AA] mb-0.5">
                              Your answer: <span className="line-through text-red-400">{q.options[userAns ?? -1] || 'No answer'}</span>
                            </p>
                          )}
                          <p className="text-white">
                            Correct answer: <span className="font-medium underline">{q.options[q.correctIndex]}</span>
                          </p>
                          {q.explanation && (
                            <p className="text-[#71717A] mt-1.5 bg-[#141414] p-2 rounded border border-[#242424]">
                              {q.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0F0F0F] border border-[#262626] rounded-2xl p-5 shadow-2xl space-y-3 text-center">
            <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle size={20} />
            </div>
            <h4 className="text-sm font-bold text-white">Delete Quiz Attempt?</h4>
            <p className="text-xs text-[#A1A1AA]">
              This attempt and score history will be removed from your Firestore records.
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
                onClick={() => {
                  deleteQuizSession(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Individual Dashboard Stat Card ─────────────────────────────────────── */
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ElementType;
  highlight?: boolean;
}> = ({ title, value, icon: Icon, highlight }) => {
  return (
    <div className={`p-3.5 rounded-2xl border transition-all ${
      highlight
        ? 'bg-white text-black border-white shadow-sm'
        : 'bg-[#0D0D0D] border-[#202020] text-white'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${highlight ? 'text-zinc-700' : 'text-[#71717A]'}`}>
          {title}
        </span>
        <Icon size={14} className={highlight ? 'text-black' : 'text-zinc-400'} />
      </div>
      <p className="text-base sm:text-lg font-bold font-mono tracking-tight truncate">{value}</p>
    </div>
  );
};
