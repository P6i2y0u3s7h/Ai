import React, { useState, useMemo } from 'react';
import {
  BookOpen, X, Trash2, Copy, Check, Search,
  Plus, Edit2, Save, Tag, ChevronDown, Filter
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { StudyNote } from '../../types/chat';

const SUBJECT_COLORS: Record<string, string> = {
  'General':         'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'Mathematics':     'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'Physics':         'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'Chemistry':       'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'Biology':         'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'Computer Science':'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'History':         'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'English':         'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'Economics':       'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
  'Other':           'bg-[#1C1C1C] text-zinc-300 border-[#262626]',
};

const SUBJECTS = Object.keys(SUBJECT_COLORS);

interface NoteFormState {
  title: string;
  content: string;
  subject: string;
  tags: string;
}

const defaultForm = (): NoteFormState => ({
  title: '',
  content: '',
  subject: 'General',
  tags: ''
});

export const NotesModal: React.FC = () => {
  const { activeModal, setActiveModal, notes, deleteNote, showToast, addNote, updateNote } = useChat();

  const [filter, setFilter]             = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [copiedId, setCopiedId]         = useState<string | null>(null);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [creating, setCreating]         = useState(false);
  const [form, setForm]                 = useState<NoteFormState>(defaultForm());
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);

  if (activeModal !== 'notes') return null;

  // Derived unique subject list from current notes
  const subjectsInUse = useMemo(() => {
    const set = new Set<string>(['All']);
    notes.forEach(n => set.add(n.subject || 'General'));
    return Array.from(set);
  }, [notes]);

  const filteredNotes = useMemo(() =>
    notes.filter(n => {
      const q = filter.toLowerCase();
      const matchesText =
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q));
      const matchesSubject = subjectFilter === 'All' || (n.subject || 'General') === subjectFilter;
      return matchesText && matchesSubject;
    }),
    [notes, filter, subjectFilter]
  );

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
      title:   note.title,
      content: note.content,
      subject: note.subject || 'General',
      tags:    note.tags.join(', ')
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
      title:   form.title.trim(),
      content: form.content.trim(),
      subject: form.subject,
      tags
    });
    cancelEdit();
  };

  const handleCreateNote = () => {
    if (!form.title.trim()) return;
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    addNote({
      title:   form.title.trim(),
      content: form.content.trim(),
      subject: form.subject,
      tags
    });
    cancelEdit();
  };

  const startCreate = () => {
    setCreating(true);
    setEditingId(null);
    setForm(defaultForm());
  };

  const subjectBadge = (subject?: string) => {
    const s = subject || 'General';
    const cls = SUBJECT_COLORS[s] || SUBJECT_COLORS['Other'];
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cls}`}>{s}</span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#141416] border border-[#2B2B2B] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#1C1C1C] text-white border border-[#262626]">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">My Study Notes</h2>
              <p className="text-xs text-[#A1A1AA]">
                {notes.length} note{notes.length !== 1 ? 's' : ''} · click any card to edit
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors"
            >
              <Plus size={14} /> New Note
            </button>
            <button
              onClick={() => setActiveModal(null)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#1C1C1C]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Search + subject filter bar ── */}
        <div className="px-5 py-3 border-b border-[#262626] flex items-center gap-2.5">
          <Search size={14} className="text-[#71717A] flex-shrink-0" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search by title, keywords or tags…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-[#71717A] focus:outline-none"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="p-1 text-zinc-500 hover:text-zinc-300 text-xs"
              title="Clear search"
            >
              Clear
            </button>
          )}
        </div>

        {/* ── Subject Organization Tabs ── */}
        <div className="px-5 py-2.5 bg-[#0A0A0A] border-b border-[#262626] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider mr-1 flex items-center gap-1 flex-shrink-0">
            <Filter size={11} /> Subjects:
          </span>
          {subjectsInUse.map(s => {
            const count = s === 'All' ? notes.length : notes.filter(n => (n.subject || 'General') === s).length;
            const isSelected = subjectFilter === s;
            return (
              <button
                key={s}
                onClick={() => setSubjectFilter(s)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-white text-black shadow-sm'
                    : 'bg-[#141414] text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C] border border-[#262626]'
                }`}
              >
                <span>{s}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-zinc-200 text-black' : 'bg-[#1C1C1C] text-[#71717A]'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Create new note form ── */}
        {creating && (
          <NoteEditForm
            form={form}
            setForm={setForm}
            subjects={SUBJECTS}
            onSave={handleCreateNote}
            onCancel={cancelEdit}
            saveLabel="Create Note"
          />
        )}

        {/* ── Notes list ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {filteredNotes.length === 0 && !creating ? (
            <div className="py-14 text-center text-[#71717A] text-sm">
              <BookOpen size={32} className="mx-auto mb-3 opacity-40 text-white" />
              <p className="font-medium text-white">
                {notes.length === 0 ? 'No notes yet' : 'No notes match your search'}
              </p>
              <p className="text-xs text-[#71717A] mt-1 max-w-xs mx-auto">
                {notes.length === 0
                  ? 'Click "New Note" to create one, or save any AI answer using the bookmark icon.'
                  : 'Try a different search term or subject filter.'}
              </p>
            </div>
          ) : (
            filteredNotes.map(note => (
              <div key={note.id}>
                {editingId === note.id ? (
                  <NoteEditForm
                    form={form}
                    setForm={setForm}
                    subjects={SUBJECTS}
                    onSave={handleSaveEdit}
                    onCancel={cancelEdit}
                    saveLabel="Save Changes"
                  />
                ) : (
                  <div className="p-4 rounded-xl bg-[#141414] border border-[#262626] hover:border-zinc-500 transition-colors group">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-white truncate">{note.title}</h3>
                          {subjectBadge(note.subject)}
                        </div>
                        {note.conversationTitle && (
                          <span className="text-[11px] text-[#71717A]">From: {note.conversationTitle}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(note)}
                          className="p-1.5 text-[#A1A1AA] hover:text-white rounded hover:bg-[#1C1C1C]"
                          title="Edit note"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleCopy(note.id, `${note.title}\n\n${note.content}`)}
                          className="p-1.5 text-[#A1A1AA] hover:text-white rounded hover:bg-[#1C1C1C]"
                          title="Copy"
                        >
                          {copiedId === note.id
                            ? <Check size={13} className="text-white" />
                            : <Copy size={13} />}
                        </button>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="p-1.5 text-[#A1A1AA] hover:text-white rounded hover:bg-[#1C1C1C]"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-white leading-relaxed whitespace-pre-wrap bg-[#111111] p-3 rounded-xl border border-[#262626] font-mono max-h-36 overflow-y-auto">
                      {note.content || <span className="text-[#71717A] italic">No content</span>}
                    </p>

                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {note.tags.map((tag, i) => (
                          <span key={i} className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#1C1C1C] text-zinc-300 border border-[#262626] flex items-center gap-1">
                            <Tag size={9} />#{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-[10px] text-[#71717A] mt-2">
                      {new Date(note.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {note.updatedAt && note.updatedAt !== note.createdAt
                        ? ` · edited ${new Date(note.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                        : ''}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Shared inline edit/create form ─────────────────────────────────────── */
const NoteEditForm: React.FC<{
  form: NoteFormState;
  setForm: React.Dispatch<React.SetStateAction<NoteFormState>>;
  subjects: string[];
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}> = ({ form, setForm, subjects, onSave, onCancel, saveLabel }) => (
  <div className="mx-5 my-3 p-4 rounded-xl bg-[#141414] border border-[#262626] space-y-3">
    <input
      type="text"
      value={form.title}
      onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
      placeholder="Note title…"
      className="w-full bg-[#111111] text-sm text-white px-3 py-2 rounded-xl border border-[#262626] focus:outline-none focus:border-white placeholder:text-[#71717A]"
      autoFocus
    />
    <textarea
      value={form.content}
      onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
      placeholder="Note content (markdown supported)…"
      rows={5}
      className="w-full bg-[#111111] text-xs text-white px-3 py-2 rounded-xl border border-[#262626] focus:outline-none focus:border-white placeholder:text-[#71717A] resize-none font-mono leading-relaxed"
    />
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="text-[11px] text-[#71717A] mb-1 block">Subject</label>
        <select
          value={form.subject}
          onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
          className="w-full bg-[#111111] text-xs text-white px-2.5 py-1.5 rounded-xl border border-[#262626] focus:outline-none focus:border-white"
        >
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[11px] text-[#71717A] mb-1 block">Tags (comma-separated)</label>
        <input
          type="text"
          value={form.tags}
          onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
          placeholder="e.g. exam, formula"
          className="w-full bg-[#111111] text-xs text-white px-2.5 py-1.5 rounded-xl border border-[#262626] focus:outline-none focus:border-white placeholder:text-[#71717A]"
        />
      </div>
    </div>
    <div className="flex justify-end gap-2 pt-1">
      <button onClick={onCancel} className="px-3 py-1.5 text-xs text-[#A1A1AA] hover:text-white">
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={!form.title.trim()}
        className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-black rounded-xl text-xs font-semibold hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Save size={13} /> {saveLabel}
      </button>
    </div>
  </div>
);
