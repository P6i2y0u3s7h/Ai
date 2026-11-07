export type StudyMode =
  | 'general'
  | 'study'
  | 'exam'
  | 'mcq'
  | 'pdf'
  | 'coding';

export type StudyLanguage = 'english' | 'hinglish';

export interface ExamConfig {
  subject: string;
  topic: string;
  marks: 2 | 5 | 10 | 16 | 'viva';
  answerLength?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'short' | 'long' | 'viva' | 'standard';
  language: StudyLanguage;
}

export interface McqConfig {
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  testMode: boolean; // In test mode, correct answers are hidden until student submits
  questionCount: number;
}

export interface ParsedMcqQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty?: string;
  topic?: string;
}

export interface StudyOptions {
  subject?: string;
  topic?: string;
  marks?: number | string;
  answerLength?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  language?: StudyLanguage;
  questionType?: 'short' | 'long' | 'viva' | 'standard' | 'mcq';
  testMode?: boolean;
  documentId?: string;
  documentName?: string;
}

export type PersonalizationAction =
  | 'simplify'
  | 'example'
  | 'hinglish'
  | 'summarize'
  | 'revision-notes';

export interface StudyModeOption {
  id: StudyMode;
  label: string;
  description: string;
  iconName: string;
  badgeColor: string;
  promptPlaceholder: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'text' | 'doc';
  size: string;
  url?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  studyMode?: StudyMode;
  attachments?: Attachment[];
  isStreaming?: boolean;
  status?: 'sent' | 'streaming' | 'completed' | 'cancelled' | 'error';
  feedback?: 'up' | 'down';
  savedToNotes?: boolean;
}

export interface Conversation {
  id: string;
  userId?: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
  studyMode: StudyMode;
  messages: Message[];
}

export interface StudyNote {
  id: string;
  userId?: string;
  title: string;
  content: string;
  subject?: string;
  topic?: string;
  semester?: string;
  folder?: string;
  isBookmarked?: boolean;
  conversationTitle?: string;
  createdAt: number;
  updatedAt?: number;
  tags: string[];
}

export interface StudyDocument {
  id: string;
  userId?: string;
  name: string;
  size: string;
  pages?: number;
  pageCount?: number;
  uploadedAt: number;
  status: 'uploading' | 'processing' | 'ready' | 'scanned_needs_ocr' | 'error';
  progress?: number;
  error?: string;
  storagePath?: string;
  downloadUrl?: string;
  isScanned?: boolean;
  chunkCount?: number;
  topic?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic?: string;
}

export interface QuizSession {
  id: string;
  userId?: string;
  title: string;
  topic: string;
  subject?: string;
  date: number;
  score: number;
  total: number;
  timeSpentSeconds?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  quizType?: 'mcq' | 'mock' | 'notes-generated';
  userAnswers?: Record<number, number>;
  questions: QuizQuestion[];
  weakTopics?: string[];
  aiAnalysis?: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  status: 'new' | 'learning' | 'mastered';
  reviewCount?: number;
}

export interface FlashcardDeck {
  id: string;
  userId?: string;
  title: string;
  topic: string;
  subject?: string;
  sourceDocId?: string;
  createdAt: number;
  updatedAt?: number;
  cards: Flashcard[];
}

export interface StudySubject {
  id: string;
  userId?: string;
  name: string;
  color?: string;
  examDate?: string;
  targetScore?: string;
}

export interface StudyTask {
  id: string;
  userId?: string;
  title: string;
  subject: string;
  dueDate: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  estimatedHours?: number;
  createdAt?: number;
}

export type ActiveModal =
  | 'search'
  | 'notes'
  | 'tools'
  | 'documents'
  | 'quiz'
  | 'planner'
  | 'flashcards'
  | 'settings'
  | 'share'
  | null;
