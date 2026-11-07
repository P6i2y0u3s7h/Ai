import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Conversation,
  Message,
  StudyMode,
  Attachment,
  StudyNote,
  StudyDocument,
  StudyTask,
  ActiveModal,
  StudyLanguage,
  ExamConfig,
  McqConfig,
  StudyOptions,
  PersonalizationAction,
  FlashcardDeck,
  Flashcard,
  QuizSession,
  StudySubject
} from '../types/chat';
import {
  getStoredConversations,
  saveStoredConversations,
  getStoredActiveChatId,
  saveStoredActiveChatId,
  getStoredNotes,
  saveStoredNotes,
  getStoredDocuments,
  saveStoredDocuments,
  getStoredTasks,
  saveStoredTasks,
  getStoredFlashcardDecks,
  saveStoredFlashcardDecks,
  getStoredQuizSessions,
  saveStoredQuizSessions,
  getStoredSubjects,
  saveStoredSubjects
} from '../utils/storage';
import { generateStudyResponse } from '../utils/studyAiEngine';
import { useAuth } from './AuthContext';
import { firestoreService } from '../services/firestoreService';
import { firestoreChatService, generateConversationTitle } from '../services/firestoreChatService';
import { streamAiResponse, AiApiError } from '../services/aiClient';
import { documentService } from '../services/documentService';

interface ChatContextType {
  conversations: Conversation[];
  activeConversationId: string;
  activeConversation: Conversation | null;
  studyMode: StudyMode;
  setStudyMode: (mode: StudyMode) => void;
  language: StudyLanguage;
  setLanguage: (lang: StudyLanguage) => void;
  examConfig: ExamConfig;
  setExamConfig: React.Dispatch<React.SetStateAction<ExamConfig>>;
  mcqConfig: McqConfig;
  setMcqConfig: React.Dispatch<React.SetStateAction<McqConfig>>;
  activeDocumentId: string | null;
  setActiveDocumentId: (id: string | null) => void;
  activeDocument: StudyDocument | null;
  isStreaming: boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  activeModal: ActiveModal;
  setActiveModal: (modal: ActiveModal) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  notes: StudyNote[];
  documents: StudyDocument[];
  tasks: StudyTask[];
  flashcardDecks: FlashcardDeck[];
  quizSessions: QuizSession[];
  subjects: StudySubject[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Actions
  createNewChat: (initialPrompt?: string, mode?: StudyMode) => void;
  selectConversation: (id: string) => void;
  renameConversation: (id: string, newTitle: string) => void;
  deleteConversation: (id: string) => void;
  togglePinConversation: (id: string) => void;
  sendMessage: (
    content: string,
    attachments?: Attachment[],
    targetConvId?: string,
    mode?: StudyMode,
    customOptions?: StudyOptions
  ) => Promise<void>;
  stopGeneration: () => void;
  regenerateMessage: (messageId: string) => Promise<void>;
  triggerPersonalization: (action: PersonalizationAction, referenceMessage?: Message) => Promise<void>;
  setMessageFeedback: (messageId: string, feedback: 'up' | 'down') => void;
  saveMessageToNotes: (message: Message, customSubject?: string) => void;
  addNote: (partial: Partial<StudyNote> & Pick<StudyNote, 'title' | 'content'>) => void;
  updateNote: (id: string, partial: Partial<StudyNote>) => void;
  deleteNote: (id: string) => void;
  uploadDocument: (file: File) => Promise<StudyDocument>;
  addDocument: (doc: Omit<StudyDocument, 'id' | 'uploadedAt'>) => void;
  deleteDocument: (id: string) => Promise<void>;
  toggleTask: (id: string) => void;
  addTask: (title: string, subject: string, dueDate: string, priority: 'low' | 'medium' | 'high', estimatedHours?: number) => void;
  deleteTask: (id: string) => void;
  addFlashcardDeck: (deck: FlashcardDeck) => void;
  deleteFlashcardDeck: (deckId: string) => void;
  updateFlashcard: (deckId: string, cardId: string, status: Flashcard['status']) => void;
  addQuizSession: (session: QuizSession) => void;
  deleteQuizSession: (sessionId: string) => void;
  addSubject: (name: string, color?: string, examDate?: string, targetScore?: string) => void;
  deleteSubject: (id: string) => void;
  clearCurrentChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>(getStoredConversations);
  const [activeConversationId, setActiveConversationId] = useState<string>(getStoredActiveChatId);
  const [studyMode, setStudyMode] = useState<StudyMode>('general');
  const [language, setLanguage] = useState<StudyLanguage>('english');
  const [examConfig, setExamConfig] = useState<ExamConfig>({
    subject: '',
    topic: '',
    marks: 5,
    difficulty: 'medium',
    questionType: 'standard',
    language: 'english'
  });
  const [mcqConfig, setMcqConfig] = useState<McqConfig>({
    topic: '',
    difficulty: 'medium',
    testMode: true,
    questionCount: 3
  });
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [notes, setNotes] = useState<StudyNote[]>(getStoredNotes);
  const [documents, setDocuments] = useState<StudyDocument[]>(getStoredDocuments);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [tasks, setTasks]                       = useState<StudyTask[]>(getStoredTasks);
  const [flashcardDecks, setFlashcardDecks]     = useState<FlashcardDeck[]>(getStoredFlashcardDecks);
  const [quizSessions, setQuizSessions]         = useState<QuizSession[]>(getStoredQuizSessions);
  const [subjects, setSubjects]                 = useState<StudySubject[]>(getStoredSubjects);

  const activeDocument = documents.find(d => d.id === activeDocumentId) || null;

  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const isExplicitStopRef = useRef<boolean>(false);
  const activeRequestIdRef = useRef<string | null>(null);
  const lastSendTimestampRef = useRef<number>(0);
  const rateLimitCooldownUntilRef = useRef<number>(0);
  const toastTimeoutRef = useRef<number | null>(null);

  // 1. Subscribe to real-time User Conversations in Firestore
  useEffect(() => {
    if (!user?.uid || user.isGuest) return;

    // Listen to conversations collection
    const unsubConversations = firestoreChatService.subscribeToUserConversations(
      user.uid,
      remoteConvs => {
        if (remoteConvs.length > 0) {
          setConversations(prev => {
            // Merge remote conversations while preserving loaded messages
            return remoteConvs.map(rc => {
              const localMatch = prev.find(p => p.id === rc.id);
              return {
                ...rc,
                messages: localMatch?.messages?.length ? localMatch.messages : []
              };
            });
          });
        }
      }
    );

    // Initial load for all user study data
    const fetchUserData = async () => {
      try {
        const [remoteNotes, remotePlans, remoteDecks, remoteQuizzes, remoteSubjects] = await Promise.all([
          firestoreService.loadNotes(user.uid),
          firestoreService.loadStudyPlans(user.uid),
          firestoreService.loadFlashcardDecks(user.uid),
          firestoreService.loadQuizzes(user.uid),
          firestoreService.loadSubjects(user.uid)
        ]);
        // Ensure every authenticated record belongs to this user and no demo stats leak
        setNotes(remoteNotes);
        setTasks(remotePlans);
        setFlashcardDecks(remoteDecks);
        setQuizSessions(remoteQuizzes);
        setSubjects(remoteSubjects);
      } catch (err) {
        console.warn('Initial Firestore data load notice:', err);
      }
    };
    fetchUserData();

    return () => {
      unsubConversations();
    };
  }, [user?.uid, user?.isGuest]);

  // Reset to local preview store only when guest or unauthenticated
  useEffect(() => {
    if (!user || user.isGuest) {
      setNotes(getStoredNotes());
      setTasks(getStoredTasks());
      setFlashcardDecks(getStoredFlashcardDecks());
      setQuizSessions(getStoredQuizSessions());
      setSubjects(getStoredSubjects());
    }
  }, [user === null, user?.isGuest]);

  // 2. Subscribe to real-time subcollection messages for active conversation
  useEffect(() => {
    if (!user?.uid || user.isGuest || !activeConversationId) return;

    const unsubMessages = firestoreChatService.subscribeToConversationMessages(
      user.uid,
      activeConversationId,
      remoteMessages => {
        if (remoteMessages.length > 0) {
          setConversations(prev =>
            prev.map(c =>
              c.id === activeConversationId
                ? { ...c, messages: remoteMessages }
                : c
            )
          );
        }
      }
    );

    return () => {
      unsubMessages();
    };
  }, [user?.uid, activeConversationId]);

  // Sync to local storage for instant offline availability
  useEffect(() => {
    saveStoredConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    saveStoredActiveChatId(activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    saveStoredNotes(notes);
  }, [notes]);

  useEffect(() => {
    saveStoredDocuments(documents);
  }, [documents]);

  useEffect(() => {
    saveStoredTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    saveStoredFlashcardDecks(flashcardDecks);
  }, [flashcardDecks]);

  useEffect(() => {
    saveStoredQuizSessions(quizSessions);
  }, [quizSessions]);

  useEffect(() => {
    saveStoredSubjects(subjects);
  }, [subjects]);

  // Active conversation object
  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  // Sync studyMode with active conversation when active conversation changes
  useEffect(() => {
    if (activeConversation) {
      setStudyMode(activeConversation.studyMode || 'general');
    }
  }, [activeConversationId]);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Create New Chat
  const createNewChat = (initialPrompt?: string, mode: StudyMode = studyMode) => {
    const newId = `conv-${Date.now()}`;
    const initialTitle = initialPrompt
      ? generateConversationTitle(initialPrompt)
      : 'New Conversation';

    const newChat: Conversation = {
      id: newId,
      userId: user?.uid,
      title: initialTitle,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPinned: false,
      studyMode: mode,
      messages: []
    };

    setConversations(prev => [newChat, ...prev]);
    setActiveConversationId(newId);
    setStudyMode(mode);
    setMobileSidebarOpen(false);

    // Save initial conversation metadata to Firestore
    if (user?.uid && !user.isGuest) {
      firestoreChatService.upsertConversation(user.uid, newId, {
        title: initialTitle,
        studyMode: mode,
        isPinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    if (initialPrompt) {
      setTimeout(() => {
        sendMessage(initialPrompt, [], newId, mode);
      }, 50);
    }
  };

  const selectConversation = (id: string) => {
    setActiveConversationId(id);
    setMobileSidebarOpen(false);
  };

  const renameConversation = (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    const cleanTitle = newTitle.trim();
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, title: cleanTitle, updatedAt: Date.now() } : c))
    );
    if (user?.uid && !user.isGuest) {
      firestoreChatService.renameConversation(user.uid, id, cleanTitle);
    }
    showToast('Conversation renamed');
  };

  const deleteConversation = (id: string) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (activeConversationId === id) {
        if (filtered.length > 0) {
          setActiveConversationId(filtered[0].id);
        } else {
          const freshId = `conv-${Date.now()}`;
          const freshChat: Conversation = {
            id: freshId,
            userId: user?.uid,
            title: 'New Conversation',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isPinned: false,
            studyMode: 'general',
            messages: []
          };
          setActiveConversationId(freshId);
          return [freshChat];
        }
      }
      return filtered;
    });

    if (user?.uid && !user.isGuest) {
      firestoreChatService.deleteConversation(user.uid, id);
    }
    showToast('Conversation deleted');
  };

  const togglePinConversation = (id: string) => {
    setConversations(prev =>
      prev.map(c => {
        if (c.id === id) {
          const nextState = !c.isPinned;
          showToast(nextState ? 'Conversation pinned' : 'Conversation unpinned');
          if (user?.uid && !user.isGuest) {
            firestoreChatService.togglePinConversation(user.uid, id, nextState);
          }
          return { ...c, isPinned: nextState, updatedAt: Date.now() };
        }
        return c;
      })
    );
  };

  const clearCurrentChat = () => {
    if (!activeConversation) return;
    setConversations(prev =>
      prev.map(c => (c.id === activeConversationId ? { ...c, messages: [], updatedAt: Date.now() } : c))
    );
    showToast('Conversation cleared');
  };

  const stopGeneration = () => {
    isExplicitStopRef.current = true;
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    setIsStreaming(false);
    showToast('Generation stopped');
  };

  // Send message with progressive Grok response & Firestore subcollection persistence
  const sendMessage = async (
    content: string,
    attachments: Attachment[] = [],
    targetConvId = activeConversationId,
    mode = studyMode,
    customOptions?: StudyOptions
  ) => {
    if (!content.trim() && attachments.length === 0) return;

    // Check rate limit cooldown (honors Retry-After to protect free tier)
    const now = Date.now();
    const cooldownRemaining = Math.ceil((rateLimitCooldownUntilRef.current - now) / 1000);
    if (cooldownRemaining > 0) {
      showToast(`Rate limit cooldown active. Please wait ${cooldownRemaining}s before sending.`);
      return;
    }

    // Prevent duplicate rapid submissions (double-clicks / double-enter)
    if (now - lastSendTimestampRef.current < 450) {
      return;
    }
    lastSendTimestampRef.current = now;

    // Track request sequence to prevent older cancelled requests from overwriting newer ones
    const currentRequestId = `req-${Date.now()}`;
    activeRequestIdRef.current = currentRequestId;
    isExplicitStopRef.current = false;

    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    const userMsgId = `msg-${Date.now()}`;
    const assistantMsgId = `msg-${Date.now() + 1}`;

    const currentConv = conversations.find(c => c.id === targetConvId);
    const isFirstMessage = !currentConv || currentConv.messages.length === 0;
    const finalTitle = isFirstMessage
      ? generateConversationTitle(content)
      : (currentConv?.title || 'Conversation');

    const userMessage: Message = {
      id: userMsgId,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
      status: 'sent',
      studyMode: mode,
      attachments
    };

    const initialAssistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
      studyMode: mode,
      isStreaming: true
    };

    // Update conversation in local state
    setConversations(prev =>
      prev.map(conv => {
        if (conv.id === targetConvId) {
          return {
            ...conv,
            title: finalTitle,
            studyMode: mode,
            updatedAt: Date.now(),
            messages: [...conv.messages, userMessage, initialAssistantMessage]
          };
        }
        return conv;
      })
    );

    // Save user message and update conversation metadata in Firestore
    if (user?.uid && !user.isGuest) {
      firestoreChatService.upsertConversation(user.uid, targetConvId, {
        title: finalTitle,
        studyMode: mode,
        updatedAt: Date.now()
      });
      firestoreChatService.saveUserMessage(user.uid, targetConvId, userMessage);
    }

    setIsStreaming(true);

    let accumulatedText = '';

    try {
      // Build conversation context: prior messages + current user prompt (limit context to last 6 messages / 3 turns for free-tier TPM efficiency)
      const priorHistory = (currentConv?.messages || [])
        .filter(m => m.status === 'completed' && m.content.trim())
        .slice(-6)
        .map(m => ({
          role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: m.role === 'assistant' && m.content.length > 1500
            ? m.content.slice(0, 1500) + '... [earlier response shortened for token efficiency]'
            : m.content
        }));

      const contextMessages = [
        ...priorHistory,
        { role: 'user' as const, content: content.trim() }
      ];

      // Build active tutor configuration options
      const activeOptions: StudyOptions = {
        language: customOptions?.language || (mode === 'exam' ? examConfig.language : language),
        documentId: customOptions?.documentId || (mode === 'pdf' ? activeDocumentId || undefined : undefined),
        documentName: customOptions?.documentName || (mode === 'pdf' ? activeDocument?.name : undefined),
        ...(mode === 'exam' ? {
          subject: examConfig.subject,
          topic: examConfig.topic,
          marks: examConfig.marks,
          difficulty: examConfig.difficulty,
          questionType: examConfig.questionType
        } : {}),
        ...(mode === 'mcq' ? {
          topic: mcqConfig.topic,
          difficulty: mcqConfig.difficulty,
          testMode: mcqConfig.testMode
        } : {}),
        ...customOptions
      };

      // Stream response from secure AI backend (Groq / Free Tier) with controlled backoff
      accumulatedText = await streamAiResponse({
        messages: contextMessages,
        studyMode: mode,
        options: activeOptions,
        signal: controller.signal,
        onRetry: (attempt, delayMs) => {
          const secs = Math.ceil(delayMs / 1000);
          showToast(`Rate limit cooldown: retrying in ${secs}s (attempt ${attempt}/3)...`);
        },
        onChunk: (delta, fullText) => {
          if (activeRequestIdRef.current !== currentRequestId) return;
          accumulatedText = fullText;
          setConversations(prev =>
            prev.map(conv => {
              if (conv.id === targetConvId) {
                return {
                  ...conv,
                  messages: conv.messages.map(m =>
                    m.id === assistantMsgId ? { ...m, content: fullText } : m
                  )
                };
              }
              return conv;
            })
          );
        }
      });

      // Ignore if a newer request was dispatched in the meantime
      if (activeRequestIdRef.current !== currentRequestId) return;

      const completedAssistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: accumulatedText,
        timestamp: Date.now(),
        status: 'completed',
        studyMode: mode,
        isStreaming: false
      };

      setConversations(prev =>
        prev.map(conv => {
          if (conv.id === targetConvId) {
            return {
              ...conv,
              messages: conv.messages.map(m =>
                m.id === assistantMsgId ? completedAssistantMsg : m
              )
            };
          }
          return conv;
        })
      );

      if (user?.uid && !user.isGuest) {
        firestoreChatService.saveAssistantMessage(
          user.uid,
          targetConvId,
          completedAssistantMsg,
          true
        );
      }
    } catch (err: any) {
      if (activeRequestIdRef.current !== currentRequestId) return;

      const wasExplicitStop = isExplicitStopRef.current && (err.name === 'AbortError' || err.message?.includes('aborted'));

      if (wasExplicitStop) {
        const cancelledAssistantMsg: Message = {
          id: assistantMsgId,
          role: 'assistant',
          content: accumulatedText,
          timestamp: Date.now(),
          status: 'cancelled',
          studyMode: mode,
          isStreaming: false
        };

        setConversations(prev =>
          prev.map(conv => {
            if (conv.id === targetConvId) {
              return {
                ...conv,
                messages: conv.messages.map(m =>
                  m.id === assistantMsgId ? cancelledAssistantMsg : m
                )
              };
            }
            return conv;
          })
        );

        if (user?.uid && !user.isGuest) {
          firestoreChatService.saveAssistantMessage(
            user.uid,
            targetConvId,
            cancelledAssistantMsg,
            false
          );
        }
      } else {
        const isRateLimit = err.statusCode === 429 || err.message?.toLowerCase().includes('rate limit');
        let errorMessage = err.message || 'Failed to generate response from StudyAI server.';

        if (isRateLimit) {
          const retrySec = err.retryAfter || 15;
          rateLimitCooldownUntilRef.current = Date.now() + (retrySec * 1000);
          showToast(`Groq free limit reached. Cooldown active for ${retrySec}s.`);

          errorMessage = `### ⏳ Rate Limit Notice (Groq Free Tier)

The request or token limit for model \`qwen/qwen3.8-27b\` has been temporarily reached on Groq's Free Tier.

* **Status:** Free tier quotas refresh automatically every 60 seconds.
* **Cooldown:** Please wait approximately **${retrySec} seconds** before sending another message.
* **Tip:** Keeping questions concise or starting a new conversation helps preserve your free-tier token capacity.`;
        }

        const errorAssistantMsg: Message = {
          id: assistantMsgId,
          role: 'assistant',
          content: errorMessage,
          timestamp: Date.now(),
          status: 'error',
          studyMode: mode,
          isStreaming: false
        };

        setConversations(prev =>
          prev.map(conv => {
            if (conv.id === targetConvId) {
              return {
                ...conv,
                messages: conv.messages.map(m =>
                  m.id === assistantMsgId ? errorAssistantMsg : m
                )
              };
            }
            return conv;
          })
        );

        if (user?.uid && !user.isGuest) {
          firestoreChatService.saveAssistantMessage(
            user.uid,
            targetConvId,
            errorAssistantMsg,
            false
          );
        }
      }
    } finally {
      if (activeRequestIdRef.current === currentRequestId) {
        setIsStreaming(false);
        activeAbortControllerRef.current = null;
        isExplicitStopRef.current = false;
      }
    }
  };

  const regenerateMessage = async (messageId: string) => {
    if (!activeConversation) return;
    const msgIndex = activeConversation.messages.findIndex(m => m.id === messageId);
    if (msgIndex <= 0) return;
    const previousUserMsg = activeConversation.messages[msgIndex - 1];
    if (previousUserMsg.role !== 'user') return;
    await sendMessage(
      previousUserMsg.content,
      previousUserMsg.attachments,
      activeConversationId,
      activeConversation.studyMode
    );
  };

  // Educational Personalization Action Handler
  const triggerPersonalization = async (
    action: PersonalizationAction,
    referenceMessage?: Message
  ) => {
    let prompt = '';
    let langOverride: StudyLanguage = language;

    switch (action) {
      case 'simplify':
        prompt = 'Explain more simply: Break down your previous explanation using intuitive everyday analogies and plain language so a beginner can easily understand.';
        break;
      case 'example':
        prompt = 'Give an example: Provide 2-3 concrete real-world examples, practical use-cases, and scenarios for the concept explained above.';
        break;
      case 'hinglish':
        prompt = 'Explain in Hinglish: Re-explain the previous answer in natural, conversational Hinglish (Hindi + English in Roman script) for Indian college students.';
        langOverride = 'hinglish';
        break;
      case 'summarize':
        prompt = 'Summarize this answer: Provide a concise, high-yield summary with 3-5 key takeaway bullet points.';
        break;
      case 'revision-notes':
        prompt = 'Create revision notes: Turn your explanation into quick revision notes including definitions, important formulas/points, and 3 flashcard review questions.';
        break;
    }

    await sendMessage(prompt, undefined, activeConversationId, studyMode, {
      language: langOverride
    });
  };

  const setMessageFeedback = (messageId: string, feedback: 'up' | 'down') => {
    if (!activeConversation) return;
    setConversations(prev =>
      prev.map(c => {
        if (c.id === activeConversationId) {
          return {
            ...c,
            messages: c.messages.map(m => (m.id === messageId ? { ...m, feedback } : m))
          };
        }
        return c;
      })
    );
    showToast(feedback === 'up' ? 'Thanks for the positive feedback!' : 'Feedback noted. We will improve!');
  };

  const saveMessageToNotes = (message: Message, customSubject?: string) => {
    const titleSnippet = message.content
      .split('\n')
      .find(line => line.trim().length > 0)
      ?.replace(/^[#*\-`\s]+/, '')
      .slice(0, 45) || 'Study Note';

    const defaultSubject = examConfig.subject 
      ? examConfig.subject 
      : activeConversation?.studyMode === 'coding' 
      ? 'Computer Science' 
      : 'General';

    const newNote: StudyNote = {
      id: `note-${Date.now()}`,
      userId: user?.uid,
      title: titleSnippet,
      content: message.content,
      subject: customSubject || defaultSubject,
      conversationTitle: activeConversation?.title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [studyMode.toUpperCase(), 'AI Summary']
    };

    setNotes(prev => [newNote, ...prev]);

    setConversations(prev =>
      prev.map(c => {
        if (c.id === activeConversationId) {
          return {
            ...c,
            messages: c.messages.map(m => (m.id === message.id ? { ...m, savedToNotes: true } : m))
          };
        }
        return c;
      })
    );

    if (user?.uid && !user.isGuest) {
      firestoreService.saveNote(user.uid, newNote);
    }

    showToast('Saved to My Notes');
  };

  const addNote = (partial: Partial<StudyNote> & Pick<StudyNote, 'title' | 'content'>) => {
    const newNote: StudyNote = {
      id:        `note-${Date.now()}`,
      userId:    user?.uid,
      title:     partial.title,
      content:   partial.content,
      subject:   partial.subject || 'General',
      topic:     partial.topic || '',
      semester:  partial.semester || 'All Semesters',
      tags:      partial.tags || [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setNotes(prev => [newNote, ...prev]);
    if (user?.uid && !user.isGuest) {
      firestoreService.saveNote(user.uid, newNote);
    }
    showToast('Note created');
  };

  const updateNote = (id: string, partial: Partial<StudyNote>) => {
    setNotes(prev => prev.map(n => {
      if (n.id !== id) return n;
      const updated = { ...n, ...partial, updatedAt: Date.now() };
      if (user?.uid && !user.isGuest) {
        firestoreService.saveNote(user.uid, updated);
      }
      return updated;
    }));
    showToast('Note updated');
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (user?.uid && !user.isGuest) {
      firestoreService.deleteNote(user.uid, id);
    }
    showToast('Note deleted');
  };

  const uploadDocument = async (file: File): Promise<StudyDocument> => {
    const tempId = `doc-${Date.now()}`;
    const optimisticDoc: StudyDocument = {
      id: tempId,
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      uploadedAt: Date.now(),
      status: 'uploading',
      progress: 0
    };

    setDocuments(prev => [optimisticDoc, ...prev]);

    try {
      const processedDoc = await documentService.uploadAndProcessPdf(
        file,
        (progress, status, error) => {
          setDocuments(prev =>
            prev.map(d =>
              d.id === tempId ? { ...d, progress, status, error } : d
            )
          );
        }
      );

      setDocuments(prev =>
        prev.map(d => (d.id === tempId ? processedDoc : d))
      );
      saveStoredDocuments(documents);
      showToast(`PDF "${processedDoc.name}" ready for study!`);
      return processedDoc;
    } catch (err: any) {
      setDocuments(prev =>
        prev.map(d =>
          d.id === tempId
            ? { ...d, status: 'error', error: err.message || 'Upload failed' }
            : d
        )
      );
      showToast(err.message || 'Failed to process PDF');
      throw err;
    }
  };

  const addDocument = (docItem: Omit<StudyDocument, 'id' | 'uploadedAt'>) => {
    const newDoc: StudyDocument = {
      ...docItem,
      id: `doc-${Date.now()}`,
      userId: user?.uid,
      uploadedAt: Date.now(),
      status: docItem.status || 'ready'
    };
    setDocuments(prev => [newDoc, ...prev]);
    if (user?.uid && !user.isGuest) {
      firestoreService.saveDocumentMetadata(user.uid, newDoc);
    }
    showToast(`Uploaded "${docItem.name}"`);
  };

  const deleteDocument = async (id: string) => {
    const docToDelete = documents.find(d => d.id === id);
    setDocuments(prev => prev.filter(d => d.id !== id));
    if (activeDocumentId === id) {
      setActiveDocumentId(null);
    }
    await documentService.deleteDocument(id, docToDelete?.storagePath);
    if (user?.uid && !user.isGuest) {
      firestoreService.deleteDocumentMetadata(user.uid, id);
    }
    showToast('Document removed');
  };

  const toggleTask = (id: string) => {
    setTasks(prev =>
      prev.map(t => {
        if (t.id !== id) return t;
        const updated = { ...t, completed: !t.completed };
        if (user?.uid && !user.isGuest) {
          firestoreService.saveStudyPlan(user.uid, updated);
        }
        return updated;
      })
    );
  };

  const addTask = (title: string, subject: string, dueDate: string, priority: 'low' | 'medium' | 'high', estimatedHours?: number) => {
    const newTask: StudyTask = {
      id: `task-${Date.now()}`,
      userId: user?.uid,
      title,
      subject,
      dueDate,
      completed: false,
      priority,
      estimatedHours,
      createdAt: Date.now()
    };
    setTasks(prev => [newTask, ...prev]);
    if (user?.uid && !user.isGuest) {
      firestoreService.saveStudyPlan(user.uid, newTask);
    }
    showToast('Study task added');
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (user?.uid && !user.isGuest) {
      firestoreService.deleteStudyPlan(user.uid, id);
    }
    showToast('Task removed');
  };

  const addFlashcardDeck = (deck: FlashcardDeck) => {
    const deckWithUser: FlashcardDeck = {
      ...deck,
      userId: user?.uid,
      createdAt: deck.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    setFlashcardDecks(prev => [deckWithUser, ...prev]);
    if (user?.uid && !user.isGuest) {
      firestoreService.saveFlashcardDeck(user.uid, deckWithUser);
    }
  };

  const deleteFlashcardDeck = (deckId: string) => {
    setFlashcardDecks(prev => prev.filter(d => d.id !== deckId));
    if (user?.uid && !user.isGuest) {
      firestoreService.deleteFlashcardDeck(user.uid, deckId);
    }
    showToast('Deck removed');
  };

  const updateFlashcard = (deckId: string, cardId: string, status: Flashcard['status']) => {
    setFlashcardDecks(prev =>
      prev.map(d => {
        if (d.id !== deckId) return d;
        const updatedCards = d.cards.map(c => {
          if (c.id !== cardId) return c;
          return {
            ...c,
            status,
            reviewCount: (c.reviewCount || 0) + 1
          };
        });
        const updatedDeck = { ...d, cards: updatedCards, updatedAt: Date.now() };
        if (user?.uid && !user.isGuest) {
          firestoreService.saveFlashcardDeck(user.uid, updatedDeck);
        }
        return updatedDeck;
      })
    );
  };

  const addQuizSession = (session: QuizSession) => {
    const sessionWithUser: QuizSession = {
      ...session,
      userId: user?.uid,
      date: session.date || Date.now()
    };
    setQuizSessions(prev => [sessionWithUser, ...prev]);
    if (user?.uid && !user.isGuest) {
      firestoreService.saveQuiz(user.uid, sessionWithUser);
    }
  };

  const deleteQuizSession = (sessionId: string) => {
    setQuizSessions(prev => prev.filter(q => q.id !== sessionId));
    if (user?.uid && !user.isGuest) {
      firestoreService.deleteQuiz(user.uid, sessionId);
    }
    showToast('Quiz attempt deleted');
  };

  const addSubject = (name: string, color?: string, examDate?: string, targetScore?: string) => {
    const newSubject: StudySubject = {
      id: `sub-${Date.now()}`,
      userId: user?.uid,
      name,
      color: color || '#8B5CF6',
      examDate,
      targetScore
    };
    setSubjects(prev => [newSubject, ...prev]);
    if (user?.uid && !user.isGuest) {
      firestoreService.saveSubject(user.uid, newSubject);
    }
    showToast(`Subject "${name}" added`);
  };

  const deleteSubject = (id: string) => {
    setSubjects(prev => prev.filter(s => s.id !== id));
    if (user?.uid && !user.isGuest) {
      firestoreService.deleteSubject(user.uid, id);
    }
    showToast('Subject removed');
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversationId,
        activeConversation,
        studyMode,
        setStudyMode,
        language,
        setLanguage,
        examConfig,
        setExamConfig,
        mcqConfig,
        setMcqConfig,
        activeDocumentId,
        setActiveDocumentId,
        activeDocument,
        isStreaming,
        sidebarCollapsed,
        setSidebarCollapsed,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        activeModal,
        setActiveModal,
        toastMessage,
        showToast,
        notes,
        documents,
        tasks,
        flashcardDecks,
        quizSessions,
        subjects,
        searchQuery,
        setSearchQuery,
        createNewChat,
        selectConversation,
        renameConversation,
        deleteConversation,
        togglePinConversation,
        sendMessage,
        stopGeneration,
        regenerateMessage,
        triggerPersonalization,
        setMessageFeedback,
        saveMessageToNotes,
        addNote,
        updateNote,
        deleteNote,
        uploadDocument,
        addDocument,
        deleteDocument,
        toggleTask,
        addTask,
        deleteTask,
        addFlashcardDeck,
        deleteFlashcardDeck,
        updateFlashcard,
        addQuizSession,
        deleteQuizSession,
        addSubject,
        deleteSubject,
        clearCurrentChat
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
