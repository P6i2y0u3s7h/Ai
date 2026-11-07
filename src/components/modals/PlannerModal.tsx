import React, { useState, useEffect } from 'react';
import {
  CalendarDays, X, CheckCircle2, Circle, Plus, Trash2,
  Sparkles, Loader2, AlertCircle,
  Target, Clock, X as XIcon, Copy, Check
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { getAuthToken } from '../../services/aiClient';
import { apiUrl } from '../../utils/apiConfig';
import { firestoreService } from '../../services/firestoreService';

type PlannerView = 'overview' | 'tasks' | 'schedule';

const PRIORITY_COLORS = {
  high:   'bg-white text-black border-white font-semibold',
  medium: 'bg-[#1C1C1C] text-zinc-200 border-[#2E2E2E]',
  low:    'bg-[#141414] text-[#71717A] border-[#262626]',
};

const SUBJECT_PALETTE = [
  '#FFFFFF', '#E4E4E7', '#D4D4D8', '#A1A1AA',
  '#71717A', '#52525B', '#3F3F46', '#27272A'
];

export const PlannerModal: React.FC = () => {
  const {
    activeModal, setActiveModal,
    tasks, toggleTask, addTask, deleteTask,
    subjects, addSubject, deleteSubject
  } = useChat();

  const [view, setView] = useState<PlannerView>('overview');

  // ── Task form ──────────────────────────────────────────────────────────────
  const [showAddTask, setShowAddTask]     = useState(false);
  const [taskTitle, setTaskTitle]         = useState('');
  const [taskSubject, setTaskSubject]     = useState('');
  const [taskDate, setTaskDate]           = useState('');
  const [taskPriority, setTaskPriority]   = useState<'low' | 'medium' | 'high'>('medium');
  const [taskHours, setTaskHours]         = useState('');
  const [taskFilter, setTaskFilter]       = useState<'all' | 'pending' | 'done'>('all');

  // ── Subject form ───────────────────────────────────────────────────────────
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [subjectName, setSubjectName]       = useState('');
  const [subjectExam, setSubjectExam]       = useState('');
  const [subjectColor, setSubjectColor]     = useState(SUBJECT_PALETTE[0]);

  // ── Grok schedule ─────────────────────────────────────────────────────────
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [scheduleText, setScheduleText]             = useState('');
  const [scheduleError, setScheduleError]           = useState('');
  const [copiedSchedule, setCopiedSchedule]         = useState(false);

  const { user } = useAuth();

  // Load persistent study schedule from Firestore
  useEffect(() => {
    if (activeModal === 'planner' && user?.uid && !user.isGuest) {
      firestoreService.loadStudySchedule(user.uid).then(saved => {
        if (saved && !scheduleText) {
          setScheduleText(saved);
        }
      });
    }
  }, [activeModal, user?.uid]);

  if (activeModal !== 'planner') return null;

  const pendingTasks   = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const filteredTasks  = taskFilter === 'all' ? tasks : taskFilter === 'pending' ? pendingTasks : completedTasks;

  // Days until exam helper
  const daysUntil = (dateStr?: string) => {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  /* ── Add task ── */
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskSubject.trim() || !taskDate) return;
    addTask(taskTitle.trim(), taskSubject.trim(), taskDate, taskPriority, taskHours ? Number(taskHours) : undefined);
    setTaskTitle(''); setTaskSubject(''); setTaskDate(''); setTaskHours('');
    setShowAddTask(false);
  };

  /* ── Add subject ── */
  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;
    addSubject(subjectName.trim(), subjectColor, subjectExam || undefined);
    setSubjectName(''); setSubjectExam(''); setSubjectColor(SUBJECT_PALETTE[0]);
    setShowAddSubject(false);
  };

  /* ── Generate Grok study schedule ── */
  const generateSchedule = async () => {
    setGeneratingSchedule(true);
    setScheduleError('');
    setScheduleText('');
    try {
      const idToken = await getAuthToken();

      const subjectList = subjects.length > 0
        ? subjects.map(s => `${s.name}${s.examDate ? ` (exam: ${s.examDate})` : ''}`).join(', ')
        : 'General study';

      const pendingList = pendingTasks.slice(0, 10).map(t =>
        `- ${t.title} [${t.subject}] due ${t.dueDate} priority=${t.priority}${t.estimatedHours ? ` est.${t.estimatedHours}h` : ''}`
      ).join('\n');

      const prompt = `Create a realistic, pedagogically balanced 7-day study schedule for a college student.

Subjects & Exam Dates: ${subjectList}
Pending Tasks (priority order):
${pendingList || 'No specific tasks yet.'}

Format the schedule as a clean markdown table with columns: Day | Time Block | Subject | Activity | Priority.
Add a motivational tip at the end. Keep it concise, practical, and achievable.`;

      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          studyMode: 'study'
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
        throw new Error(data.error || data.message || `Schedule request failed (${response.status})`);
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
            else if (d.delta) { fullText += d.delta; setScheduleText(fullText); }
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }
      setScheduleText(fullText);

      // Save generated plan in Firestore
      if (user?.uid && !user.isGuest) {
        await firestoreService.saveStudySchedule(user.uid, fullText, {
          generatedAt: Date.now(),
          subjectCount: subjects.length,
          pendingTaskCount: pendingTasks.length
        });
      }
    } catch (err: any) {
      setScheduleError(err.message || 'Failed to generate schedule.');
    } finally {
      setGeneratingSchedule(false);
    }
  };

  /* ── Overview ── */
  const renderOverview = () => {
    const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
    const totalEstHours = pendingTasks.reduce((acc, t) => acc + (t.estimatedHours || 1), 0);

    return (
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Real Progress Tracking Bar */}
        <div className="p-4 rounded-xl bg-[#141414] border border-[#262626] space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Target size={14} className="text-white" /> Verified Study Progress
            </span>
            <span className="text-white font-mono font-medium">
              {completedTasks.length}/{tasks.length} tasks ({completionRate}%)
            </span>
          </div>
          <div className="h-1.5 bg-[#1C1C1C] rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-[#A1A1AA] pt-0.5">
            <span className="flex items-center gap-1">
              <Clock size={11} className="text-white" />
              {totalEstHours}h study remaining
            </span>
            <span>{subjects.length} active subject{subjects.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pending', value: pendingTasks.length },
            { label: 'Completed', value: completedTasks.length },
            { label: 'Subjects', value: subjects.length },
          ].map(s => (
            <div key={s.label} className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] text-center">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-[11px] text-[#71717A] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Upcoming exams */}
        {subjects.filter(s => s.examDate).length > 0 && (
          <div>
            <p className="text-[11px] text-[#71717A] font-semibold uppercase tracking-wider mb-2">Upcoming Exams</p>
            <div className="space-y-2">
              {subjects
                .filter(s => s.examDate)
                .sort((a, b) => new Date(a.examDate!).getTime() - new Date(b.examDate!).getTime())
                .map(s => {
                  const days = daysUntil(s.examDate);
                  return (
                    <div key={s.id} className="flex items-center justify-between p-3.5 rounded-xl bg-[#141414] border border-[#262626]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color || '#FFFFFF' }} />
                        <p className="text-xs font-medium text-white">{s.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#A1A1AA]">{s.examDate}</p>
                        {days !== null && (
                          <p className="text-[10px] font-bold text-white">
                            {days > 0 ? `${days} days left` : days === 0 ? 'Today!' : 'Past'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setView('tasks')} className="p-4 rounded-xl bg-[#141414] border border-[#262626] hover:border-zinc-500 hover:bg-[#1C1C1C] text-left transition-all">
            <CheckCircle2 size={20} className="text-white mb-2" />
            <p className="text-xs font-semibold text-white">Manage Tasks</p>
            <p className="text-[11px] text-[#71717A] mt-0.5">{pendingTasks.length} pending</p>
          </button>
          <button onClick={() => { setView('schedule'); setScheduleText(''); }} className="p-4 rounded-xl bg-[#141414] border border-[#262626] hover:border-zinc-500 hover:bg-[#1C1C1C] text-left transition-all">
            <Sparkles size={20} className="text-white mb-2" />
            <p className="text-xs font-semibold text-white">AI Schedule</p>
            <p className="text-[11px] text-[#71717A] mt-0.5">Generate 7-day plan</p>
          </button>
        </div>

        {/* Subjects */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] text-[#71717A] font-semibold uppercase tracking-wider">Subjects</p>
            <button onClick={() => setShowAddSubject(p => !p)} className="flex items-center gap-1 text-xs text-white hover:text-zinc-300">
              <Plus size={13} /> Add
            </button>
          </div>

          {showAddSubject && (
            <form onSubmit={handleAddSubject} className="p-3.5 rounded-xl bg-[#141414] border border-[#262626] space-y-2.5 mb-3">
              <input
                type="text" value={subjectName} onChange={e => setSubjectName(e.target.value)}
                placeholder="Subject name" autoFocus
                className="w-full bg-[#111111] text-xs text-white px-3 py-2 rounded-xl border border-[#262626] focus:outline-none focus:border-white placeholder:text-[#71717A]"
              />
              <div className="flex gap-2">
                <input
                  type="date" value={subjectExam} onChange={e => setSubjectExam(e.target.value)}
                  className="flex-1 bg-[#111111] text-xs text-white px-3 py-2 rounded-xl border border-[#262626] focus:outline-none focus:border-white"
                />
                <div className="flex gap-1.5 flex-wrap items-center">
                  {SUBJECT_PALETTE.map(c => (
                    <button key={c} type="button" onClick={() => setSubjectColor(c)}
                      className={`w-4 h-4 rounded-full transition-all border border-black ${subjectColor === c ? 'ring-2 ring-white scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddSubject(false)} className="text-xs text-[#71717A] hover:text-white px-2 py-1">Cancel</button>
                <button type="submit" disabled={!subjectName.trim()} className="px-3.5 py-1.5 bg-white text-black rounded-xl text-xs font-semibold hover:bg-zinc-200 disabled:opacity-40">Add Subject</button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap gap-2">
            {subjects.map(s => (
              <div key={s.id} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#141414] border border-[#262626] group">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color || '#FFFFFF' }} />
                <span className="text-xs text-white">{s.name}</span>
                <button onClick={() => deleteSubject(s.id)} className="opacity-0 group-hover:opacity-100 text-[#71717A] hover:text-white transition-opacity ml-1">
                  <XIcon size={11} />
                </button>
              </div>
            ))}
            {subjects.length === 0 && <p className="text-xs text-[#71717A]">No subjects added yet.</p>}
          </div>
        </div>
      </div>
    );
  };

  /* ── Tasks ── */
  const renderTasks = () => (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="flex items-center gap-2">
        {(['all', 'pending', 'done'] as const).map(f => (
          <button key={f} onClick={() => setTaskFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${taskFilter === f ? 'bg-white text-black font-semibold' : 'bg-[#141414] text-[#A1A1AA] hover:text-white border border-[#262626]'}`}
          >
            {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Completed'}
          </button>
        ))}
        <button onClick={() => setShowAddTask(p => !p)} className="ml-auto flex items-center gap-1 text-xs text-white hover:text-zinc-300">
          <Plus size={13} /> Add Task
        </button>
      </div>

      {showAddTask && (
        <form onSubmit={handleAddTask} className="p-4 rounded-xl bg-[#141414] border border-[#262626] space-y-2.5">
          <input
            type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)}
            placeholder="Task title…" autoFocus
            className="w-full bg-[#111111] text-[16px] sm:text-xs text-white px-3 py-2 rounded-xl border border-[#262626] focus:outline-none focus:border-white placeholder:text-[#71717A]"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <input
              type="text" value={taskSubject} onChange={e => setTaskSubject(e.target.value)}
              placeholder="Subject" list="subject-suggestions"
              className="bg-[#111111] text-[16px] sm:text-xs text-white px-3 py-2 rounded-xl border border-[#262626] focus:outline-none focus:border-white placeholder:text-[#71717A]"
            />
            <datalist id="subject-suggestions">
              {subjects.map(s => <option key={s.id} value={s.name} />)}
            </datalist>
            <input
              type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)}
              className="bg-[#111111] text-[16px] sm:text-xs text-white px-3 py-2 rounded-xl border border-[#262626] focus:outline-none focus:border-white"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select value={taskPriority} onChange={e => setTaskPriority(e.target.value as any)}
              className="bg-[#111111] text-[16px] sm:text-xs text-white px-3 py-2 rounded-xl border border-[#262626] focus:outline-none focus:border-white"
            >
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
            <input
              type="number" value={taskHours} onChange={e => setTaskHours(e.target.value)}
              placeholder="Est. hours" min="0.5" max="12" step="0.5"
              className="bg-[#111111] text-[16px] sm:text-xs text-white px-3 py-2 rounded-xl border border-[#262626] focus:outline-none focus:border-white placeholder:text-[#71717A]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAddTask(false)} className="text-xs text-[#71717A] hover:text-white px-3 py-1">Cancel</button>
            <button type="submit" disabled={!taskTitle.trim() || !taskSubject.trim() || !taskDate}
              className="px-4 py-1.5 bg-white text-black rounded-xl text-xs font-semibold hover:bg-zinc-200 disabled:opacity-40"
            >
              Add Task
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="py-10 text-center text-[#71717A] text-xs">
            No {taskFilter === 'done' ? 'completed' : taskFilter === 'pending' ? 'pending' : ''} tasks.
          </div>
        ) : filteredTasks.map(task => (
          <div
            key={task.id}
            className={`p-3.5 rounded-xl border transition-colors flex items-center justify-between gap-3 ${task.completed ? 'bg-[#111111] border-[#262626] opacity-60' : 'bg-[#141414] border-[#262626] hover:border-zinc-500'}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => toggleTask(task.id)} className={`flex-shrink-0 ${task.completed ? 'text-white' : 'text-[#71717A] hover:text-white'} transition-colors`}>
                {task.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              </button>
              <div className="truncate">
                <p className={`text-xs font-medium truncate ${task.completed ? 'line-through text-[#71717A]' : 'text-white'}`}>
                  {task.title}
                </p>
                <p className="text-[11px] text-[#71717A]">
                  {task.subject} · {task.dueDate}{task.estimatedHours ? ` · ~${task.estimatedHours}h` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${PRIORITY_COLORS[task.priority]}`}>
                {task.priority}
              </span>
              <button onClick={() => deleteTask(task.id)} className="p-1 text-[#71717A] hover:text-white rounded transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ── AI Schedule ── */
  const renderSchedule = () => (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {!scheduleText ? (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#141414] border border-[#262626] flex items-center justify-center mx-auto text-white">
            <Sparkles size={28} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Generate Your 7-Day Study Plan</h3>
            <p className="text-xs text-[#A1A1AA] max-w-xs mx-auto">
              Ai will create a personalized schedule based on your subjects, exam dates, and pending tasks.
            </p>
          </div>

          {scheduleError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#1C1C1C] border border-[#262626] text-xs text-white text-left">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-[#A1A1AA]" />{scheduleError}
            </div>
          )}

          <button
            onClick={generateSchedule}
            disabled={generatingSchedule}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 disabled:opacity-50 mx-auto"
          >
            {generatingSchedule ? <><Loader2 size={16} className="animate-spin" />Generating schedule…</> : <><Sparkles size={16} />Generate Schedule</>}
          </button>

          {subjects.length === 0 && (
            <p className="text-[11px] text-[#71717A]">💡 Add subjects on the Overview tab for a more tailored schedule.</p>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Your 7-Day Study Schedule</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(scheduleText);
                  setCopiedSchedule(true);
                  setTimeout(() => setCopiedSchedule(false), 2000);
                }}
                className="flex items-center gap-1 text-xs text-white px-3 py-1.5 rounded-xl bg-[#141414] border border-[#262626] hover:bg-[#1C1C1C] transition-colors"
              >
                {copiedSchedule ? <><Check size={12} className="text-white" /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
              <button onClick={() => { setScheduleText(''); setScheduleError(''); }} className="text-xs text-[#A1A1AA] hover:text-white px-2 py-1">
                Regenerate
              </button>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#141414] border border-[#262626] text-xs text-white leading-relaxed whitespace-pre-wrap font-mono max-h-[50vh] overflow-y-auto">
            {scheduleText}
            {generatingSchedule && <span className="inline-block w-2 h-3.5 bg-white animate-pulse ml-1 rounded-sm" />}
          </div>
        </div>
      )}
    </div>
  );

  const VIEW_LABELS: Record<PlannerView, string> = {
    overview: 'Study Planner',
    tasks:    'My Tasks',
    schedule: 'AI Study Schedule'
  };

  return (
    <div className="fixed inset-0 z-[60] w-screen h-screen bg-[#0A0A0A] flex flex-col overflow-hidden select-none">
      <div className="w-full h-full bg-[#0A0A0A] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[#262626] bg-[#0D0D0D]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-[#141414] text-white border border-[#262626] flex-shrink-0">
              <CalendarDays size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-white truncate">{VIEW_LABELS[view]}</h2>
              <p className="text-xs text-[#A1A1AA] hidden sm:block">Track subjects, tasks & exam deadlines</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {view !== 'overview' && (
              <button onClick={() => setView('overview')} className="text-xs text-[#A1A1AA] hover:text-white px-2.5 py-1 rounded-lg hover:bg-[#1C1C1C] transition-colors">
                ← Overview
              </button>
            )}
            <button onClick={() => setActiveModal(null)} className="p-1.5 text-[#A1A1AA] hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab bar (only on overview) */}
        {view === 'overview' && (
          <div className="flex border-b border-[#262626] px-4 sm:px-6 bg-[#0D0D0D]">
            {[
              { v: 'tasks' as const, label: 'Tasks' },
              { v: 'schedule' as const, label: 'AI Schedule' },
            ].map(tab => (
              <button key={tab.v} onClick={() => setView(tab.v)}
                className="flex items-center gap-1.5 py-3 px-3 text-xs font-medium border-b-2 border-transparent text-[#A1A1AA] hover:text-white transition-colors"
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full p-3 sm:p-6">
            {view === 'overview' && renderOverview()}
            {view === 'tasks'    && renderTasks()}
            {view === 'schedule' && renderSchedule()}
          </div>
        </div>
      </div>
    </div>
  );
};
