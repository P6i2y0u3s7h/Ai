import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Search,
  X,
  MessageSquare,
  BookOpen,
  FileText,
  ArrowRight,
  Loader2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Code2,
  GraduationCap
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { StudyMode } from '../../types/chat';
import { searchService, BackendSearchResults, UnifiedSearchResults } from '../../services/searchService';

type SearchCategory = 'all' | 'chats' | 'notes' | 'documents';

const SUGGESTED_TOPICS: Array<{ label: string; mode: StudyMode; icon: string }> = [
  { label: 'Array in Java', mode: 'coding', icon: '💻' },
  { label: 'Two Pointer Technique', mode: 'coding', icon: '⚡' },
  { label: 'Binary Search Algorithm', mode: 'coding', icon: '🔍' },
  { label: 'Sorting Algorithms', mode: 'coding', icon: '📊' },
  { label: 'Linked List Implementation', mode: 'coding', icon: '🔗' },
  { label: 'Stack and Queue', mode: 'coding', icon: '🥞' },
  { label: "Newton's Laws of Motion", mode: 'study', icon: '⚛️' },
  { label: 'CABG in Physiotherapy', mode: 'exam', icon: '🫀' }
];

export const SearchModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    conversations,
    selectConversation,
    createNewChat,
    notes,
    documents
  } = useChat();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchCategory>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendResults, setBackendResults] = useState<BackendSearchResults>({
    conversations: [],
    notes: [],
    documents: []
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  // Focus input whenever modal opens
  useEffect(() => {
    if (activeModal === 'search') {
      setTimeout(() => inputRef.current?.focus(), 50);
      setError(null);
    } else {
      setQuery('');
      setError(null);
      setIsLoading(false);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  }, [activeModal]);

  // Execute safe search across backend and local state
  const executeSearch = useCallback(async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) {
      setIsLoading(false);
      setError(null);
      setBackendResults({ conversations: [], notes: [], documents: [] });
      return;
    }

    // Cancel any previous pending search request (prevents duplicate body reads or race conditions)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const results = await searchService.searchBackend(q, controller.signal);
      setBackendResults(results);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // Request was aborted due to new consecutive search keystroke
      }
      console.warn('Backend search notice (falling back to local index):', err.message);
      setError(err.message || 'Unable to connect to search service.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle consecutive input searches with debounce
  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      executeSearch(val);
    }, 180);
  };

  const handleLaunchStudy = (topic: string, mode: StudyMode = 'general') => {
    setActiveModal(null);
    createNewChat(topic, mode);
  };

  // Merge backend and local results
  const unifiedResults: UnifiedSearchResults = React.useMemo(() => {
    return searchService.mergeResults(query, backendResults, conversations, notes, documents);
  }, [query, backendResults, conversations, notes, documents]);

  if (activeModal !== 'search') return null;

  const showConversations = activeTab === 'all' || activeTab === 'chats';
  const showNotes = activeTab === 'all' || activeTab === 'notes';
  const showDocuments = activeTab === 'all' || activeTab === 'documents';

  const hasAnyResults =
    unifiedResults.conversations.length > 0 ||
    unifiedResults.notes.length > 0 ||
    unifiedResults.documents.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-[#0A0A0A] border border-[#262626] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Search Input Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#262626] gap-3 bg-[#0A0A0A]">
          {isLoading ? (
            <Loader2 size={18} className="text-white animate-spin flex-shrink-0" />
          ) : (
            <Search size={18} className="text-[#A1A1AA] flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && query.trim()) {
                e.preventDefault();
                handleLaunchStudy(query.trim(), 'study');
              }
            }}
            placeholder="Search conversations, topics, lecture notes, or documents..."
            className="flex-1 bg-transparent text-white placeholder:text-[#71717A] text-sm focus:outline-none"
          />
          {query && (
            <button
              onClick={() => handleQueryChange('')}
              className="p-1 text-[#A1A1AA] hover:text-white rounded-md transition-colors"
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
          <button
            onClick={() => setActiveModal(null)}
            className="text-xs px-2.5 py-1 rounded bg-[#141414] text-[#A1A1AA] hover:text-white border border-[#262626] transition-colors"
          >
            Esc
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 bg-[#0A0A0A] border-b border-[#262626] overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-white text-black'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C]'
            }`}
          >
            All Results ({unifiedResults.totalCount})
          </button>
          <button
            onClick={() => setActiveTab('chats')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              activeTab === 'chats'
                ? 'bg-white text-black'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C]'
            }`}
          >
            Chats ({unifiedResults.conversations.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              activeTab === 'notes'
                ? 'bg-white text-black'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C]'
            }`}
          >
            Notes ({unifiedResults.notes.length})
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              activeTab === 'documents'
                ? 'bg-white text-black'
                : 'text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C]'
            }`}
          >
            Documents ({unifiedResults.documents.length})
          </button>
        </div>

        {/* Error Notice Bar (if any) */}
        {error && (
          <div className="px-4 py-2 bg-[#141414] border-b border-[#262626] flex items-center justify-between text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0 text-white" />
              <span>{error} (showing local records)</span>
            </div>
            <button
              onClick={() => executeSearch(query)}
              className="flex items-center gap-1 hover:text-white font-medium underline"
            >
              <RotateCcw size={12} />
              Retry
            </button>
          </div>
        )}

        {/* Results Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0A0A0A]">
          {/* AI Concept Overview from Groq (when available) */}
          {backendResults.aiOverview?.answer && (
            <div className="p-4 bg-[#111111] border border-[#262626] rounded-xl shadow-lg space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#262626] pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-white text-black flex items-center justify-center flex-shrink-0">
                    <Sparkles size={13} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white">Ai Concept Overview</span>
                    <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1C1C1C] text-zinc-400 border border-[#2E2E2E]">
                      {backendResults.aiOverview.model || 'qwen/qwen3.8-27b'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleLaunchStudy(query.trim(), 'study')}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white hover:bg-zinc-200 text-black transition-colors flex items-center gap-1"
                  >
                    <span>Full Study Chat</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
              </div>
              <div className="markdown-content text-xs text-zinc-200 leading-relaxed max-h-60 overflow-y-auto pr-1">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {backendResults.aiOverview.answer}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Rate Limit Notice if Free Tier exceeded */}
          {backendResults.rateLimitNotice && (
            <div className="p-3 bg-[#141414] border border-[#262626] rounded-xl text-xs text-zinc-300 flex items-center gap-2">
              <AlertCircle size={15} className="text-white flex-shrink-0" />
              <span>{backendResults.rateLimitNotice}</span>
            </div>
          )}

          {/* Ask Ai Action Card (always available when query is typed) */}
          {query.trim().length > 0 && (
            <div className="p-3.5 bg-[#141414] border border-[#262626] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center flex-shrink-0">
                  <Sparkles size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-white uppercase tracking-wider">Ask Ai Deep Dive</p>
                  <p className="text-[13px] font-medium text-zinc-200 truncate max-w-sm">"{query.trim()}"</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                <button
                  onClick={() => handleLaunchStudy(query.trim(), 'study')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white hover:bg-zinc-200 text-black transition-colors flex items-center gap-1"
                >
                  <GraduationCap size={13} />
                  Study Guide
                </button>
                <button
                  onClick={() => handleLaunchStudy(query.trim(), 'coding')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-[#1C1C1C] hover:bg-[#252525] text-white border border-[#2E2E2E] transition-colors flex items-center gap-1"
                >
                  <Code2 size={13} />
                  Code & Syntax
                </button>
                <button
                  onClick={() => handleLaunchStudy(query.trim(), 'exam')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-[#1C1C1C] hover:bg-[#252525] text-white border border-[#2E2E2E] transition-colors"
                >
                  Exam Answer
                </button>
              </div>
            </div>
          )}

          {/* Quick University & Coding Topics (when query is empty) */}
          {!query.trim() && (
            <div>
              <div className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider px-1 mb-2.5 flex items-center gap-1.5">
                <Sparkles size={12} className="text-white" />
                <span>Popular University & Coding Topics</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTED_TOPICS.map(item => (
                  <button
                    key={item.label}
                    onClick={() => handleLaunchStudy(item.label, item.mode)}
                    className="p-2.5 rounded-xl bg-[#141414] hover:bg-[#1C1C1C] border border-[#262626] hover:border-[#383838] text-left transition-all group flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base">{item.icon}</span>
                      <span className="text-xs text-zinc-300 group-hover:text-white font-medium truncate">
                        {item.label}
                      </span>
                    </div>
                    <ArrowRight size={13} className="text-[#71717A] group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {!hasAnyResults && !isLoading && query.trim() && (
            <div className="py-8 text-center bg-[#141414] border border-[#262626] rounded-xl p-4">
              <Search size={28} className="mx-auto mb-2 opacity-40 text-zinc-400" />
              <p className="text-white text-sm font-medium">No previous records match "{query}"</p>
              <p className="text-[#A1A1AA] text-xs mt-1 max-w-md mx-auto">
                Click <strong>Study Guide</strong> or <strong>Code & Syntax</strong> above to generate a comprehensive AI explanation immediately.
              </p>
            </div>
          )}

          {/* Conversations Section */}
          {showConversations && unifiedResults.conversations.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
                <span>Conversations</span>
                <span className="text-[10px] text-[#71717A]">{unifiedResults.conversations.length}</span>
              </div>
              <div className="space-y-1">
                {unifiedResults.conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => {
                      selectConversation(conv.id);
                      setActiveModal(null);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-left hover:bg-[#1C1C1C] transition-colors group border border-transparent hover:border-[#262626]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-[#141414] border border-[#262626] flex items-center justify-center text-white flex-shrink-0">
                        <MessageSquare size={14} />
                      </div>
                      <div className="truncate">
                        <p className="text-[13px] text-zinc-300 group-hover:text-white truncate font-medium">
                          {conv.title}
                        </p>
                        <p className="text-[11px] text-[#71717A] truncate">
                          {conv.messages.length} messages • Mode: {conv.studyMode?.toUpperCase() || 'STUDY'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-[#71717A] group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Study Notes Section */}
          {showNotes && unifiedResults.notes.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
                <span>Study Notes</span>
                <span className="text-[10px] text-[#71717A]">{unifiedResults.notes.length}</span>
              </div>
              <div className="space-y-1">
                {unifiedResults.notes.map(note => (
                  <button
                    key={note.id}
                    onClick={() => {
                      setActiveModal('notes');
                    }}
                    className="w-full px-3 py-2.5 rounded-xl flex items-start gap-3 text-left hover:bg-[#1C1C1C] transition-colors group border border-transparent hover:border-[#262626]"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#141414] border border-[#262626] flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                      <BookOpen size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] text-zinc-300 group-hover:text-white font-medium truncate">
                          {note.title}
                        </p>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#141414] text-zinc-400 border border-[#262626] font-mono flex-shrink-0">
                          {note.subject || 'General'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#71717A] line-clamp-1 mt-0.5">
                        {note.content}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Uploaded Documents Section */}
          {showDocuments && unifiedResults.documents.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
                <span>Uploaded Documents</span>
                <span className="text-[10px] text-[#71717A]">{unifiedResults.documents.length}</span>
              </div>
              <div className="space-y-1">
                {unifiedResults.documents.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setActiveModal('documents');
                    }}
                    className="w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-left hover:bg-[#1C1C1C] transition-colors group border border-transparent hover:border-[#262626]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-[#141414] border border-[#262626] flex items-center justify-center text-white flex-shrink-0">
                        <FileText size={14} />
                      </div>
                      <div className="truncate">
                        <p className="text-[13px] text-zinc-300 group-hover:text-white truncate font-medium">
                          {doc.name}
                        </p>
                        <p className="text-[11px] text-[#71717A] truncate">
                          {doc.size || 'PDF'} • {doc.pageCount || 1} pages
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-[#71717A] group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
