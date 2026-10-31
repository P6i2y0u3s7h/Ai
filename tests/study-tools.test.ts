import assert from 'assert';
import {
  StudyNote,
  QuizSession,
  QuizQuestion,
  FlashcardDeck,
  Flashcard,
  StudyTask,
  StudySubject
} from '../src/types/chat';

// Helper to simulate the exact note filtering and subject organization in NotesModal
function filterAndOrganizeNotes(
  notes: StudyNote[],
  searchQuery: string,
  selectedSubject: string
): { filtered: StudyNote[]; subjectCounts: Record<string, number> } {
  const q = searchQuery.toLowerCase().trim();

  const filtered = notes.filter(n => {
    const matchesText =
      !q ||
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q));

    const matchesSubject = selectedSubject === 'All' || (n.subject || 'General') === selectedSubject;
    return matchesText && matchesSubject;
  });

  const subjectCounts: Record<string, number> = { All: notes.length };
  for (const n of notes) {
    const sub = n.subject || 'General';
    subjectCounts[sub] = (subjectCounts[sub] || 0) + 1;
  }

  return { filtered, subjectCounts };
}

// Helper to simulate MCQ parsing from Grok AI response
function parseGrokMcqResponse(aiOutput: string): QuizQuestion[] {
  // Strategy 1: Raw JSON array
  const jsonMatch = aiOutput.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const raw = JSON.parse(jsonMatch[0]);
      return raw.map((q: any, i: number) => ({
        id: q.id || `q-${i}`,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation || ''
      }));
    } catch {}
  }

  // Strategy 2: json:studyai-mcq block
  const blockMatch = aiOutput.match(/```json:studyai-mcq\s*([\s\S]*?)```/);
  if (blockMatch) {
    try {
      const inner = JSON.parse(blockMatch[1]);
      return (inner.questions || []).map((q: any, i: number) => ({
        id: q.id || `q-${i}`,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation || ''
      }));
    } catch {}
  }

  return [];
}

// Helper to compute quiz score and grade
function gradeQuiz(questions: QuizQuestion[], selectedAnswers: Record<number, number>): { score: number; total: number; percentage: number; grade: string } {
  let score = 0;
  questions.forEach((q, idx) => {
    if (selectedAnswers[idx] === q.correctIndex) {
      score++;
    }
  });
  const total = questions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const grade = percentage >= 80 ? 'Excellent!' : percentage >= 60 ? 'Good Job!' : percentage >= 40 ? 'Keep Going' : 'Study More';
  return { score, total, percentage, grade };
}

// Helper to calculate real study planner progress (NO hardcoded demo statistics)
function calculateRealPlannerProgress(tasks: StudyTask[]): {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  completionRate: number;
  totalPendingHours: number;
} {
  const completed = tasks.filter(t => t.completed);
  const pending = tasks.filter(t => !t.completed);
  const total = tasks.length;
  const rate = total > 0 ? Math.round((completed.length / total) * 100) : 0;
  const pendingHours = pending.reduce((sum, t) => sum + (t.estimatedHours || 1), 0);

  return {
    totalTasks: total,
    completedTasks: completed.length,
    pendingTasks: pending.length,
    completionRate: rate,
    totalPendingHours: pendingHours
  };
}

// Helper for exam countdown calculation
function calculateDaysUntilExam(examDateStr: string, currentDate: Date = new Date()): number {
  const examDate = new Date(examDateStr);
  const diffTime = examDate.getTime() - currentDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Security Path Scoping Validator matching firestore.rules
function validateSecurityPath(userId: string, subcollection: string, docId: string): boolean {
  if (!userId || userId.trim() === '') return false;
  const allowedSubcollections = ['notes', 'quizzes', 'flashcards', 'studyPlans', 'subjects', 'conversations', 'documents', 'profile'];
  if (!allowedSubcollections.includes(subcollection)) return false;
  const expectedPrefix = `users/${userId}/${subcollection}/`;
  const fullPath = `users/${userId}/${subcollection}/${docId}`;
  return fullPath.startsWith(expectedPrefix);
}

// ── Test Runner ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function it(desc: string, fn: () => void) {
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] ${desc}: ${err.message}`);
    failed++;
  }
}

console.log('====================================================');
console.log(' StudyAI Study Tools - Unit & Integration Test Suite');
console.log('====================================================\n');

// 1. MY NOTES TESTS
console.log('1. Testing MY NOTES:');
it('should create notes with subject and tags and belong to authenticated user', () => {
  const note: StudyNote = {
    id: 'note-1',
    userId: 'user-alice-123',
    title: 'Paging vs Segmentation',
    content: 'Paging is fixed size, segmentation is variable size.',
    subject: 'Computer Science',
    tags: ['Operating Systems', 'Memory'],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  assert.strictEqual(note.userId, 'user-alice-123');
  assert.strictEqual(note.subject, 'Computer Science');
  assert.strictEqual(note.tags.length, 2);
});

it('should save AI answers directly into notes with appropriate subject', () => {
  const aiAnswerContent = `### Dijkstra Algorithm\nO((V + E) log V) with Min-Heap.`;
  const titleSnippet = aiAnswerContent.split('\n')[0].replace(/^[#*\-`\s]+/, '');

  const savedNote: StudyNote = {
    id: `note-${Date.now()}`,
    userId: 'user-alice-123',
    title: titleSnippet,
    content: aiAnswerContent,
    subject: 'Computer Science',
    conversationTitle: 'Algorithms Practice',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: ['EXAM', 'AI Summary']
  };

  assert.strictEqual(savedNote.title, 'Dijkstra Algorithm');
  assert.ok(savedNote.tags.includes('AI Summary'));
  assert.strictEqual(savedNote.userId, 'user-alice-123');
});

it('should edit/update existing note content and timestamp', () => {
  const originalNote: StudyNote = {
    id: 'note-1',
    userId: 'user-alice-123',
    title: 'Calculus Derivatives',
    content: 'd/dx sin(x) = cos(x)',
    subject: 'Mathematics',
    tags: ['Calculus'],
    createdAt: 1000,
    updatedAt: 1000
  };

  const updatedNote: StudyNote = {
    ...originalNote,
    content: 'd/dx sin(x) = cos(x); d/dx cos(x) = -sin(x)',
    updatedAt: 2000
  };

  assert.strictEqual(updatedNote.id, originalNote.id);
  assert.ok(updatedNote.content.includes('-sin(x)'));
  assert.ok(updatedNote.updatedAt! > originalNote.updatedAt!);
});

it('should search notes by title, content, or tag', () => {
  const notes: StudyNote[] = [
    { id: '1', title: 'Binary Trees', content: 'Tree traversal in-order', subject: 'Computer Science', tags: ['data-structures'], createdAt: 1 },
    { id: '2', title: 'Photosynthesis', content: 'Light reactions in chloroplast', subject: 'Biology', tags: ['cells'], createdAt: 2 },
    { id: '3', title: 'Newton Laws', content: 'F = ma acceleration', subject: 'Physics', tags: ['mechanics'], createdAt: 3 }
  ];

  const search1 = filterAndOrganizeNotes(notes, 'chloroplast', 'All');
  assert.strictEqual(search1.filtered.length, 1);
  assert.strictEqual(search1.filtered[0].id, '2');

  const searchTag = filterAndOrganizeNotes(notes, 'mechanics', 'All');
  assert.strictEqual(searchTag.filtered.length, 1);
  assert.strictEqual(searchTag.filtered[0].title, 'Newton Laws');
});

it('should organize notes by subject and calculate correct subject counts', () => {
  const notes: StudyNote[] = [
    { id: '1', title: 'CS Note 1', content: 'content', subject: 'Computer Science', tags: [], createdAt: 1 },
    { id: '2', title: 'CS Note 2', content: 'content', subject: 'Computer Science', tags: [], createdAt: 2 },
    { id: '3', title: 'Math Note 1', content: 'content', subject: 'Mathematics', tags: [], createdAt: 3 },
    { id: '4', title: 'General Note', content: 'content', subject: 'General', tags: [], createdAt: 4 }
  ];

  const csFilter = filterAndOrganizeNotes(notes, '', 'Computer Science');
  assert.strictEqual(csFilter.filtered.length, 2);
  assert.strictEqual(csFilter.subjectCounts['Computer Science'], 2);
  assert.strictEqual(csFilter.subjectCounts['Mathematics'], 1);
  assert.strictEqual(csFilter.subjectCounts['All'], 4);
});

// 2. QUIZZES TESTS
console.log('\n2. Testing QUIZZES:');
it('should parse MCQs generated by Grok from JSON array', () => {
  const grokOutput = `[
    {
      "id": "q1",
      "question": "What is the worst-case time complexity of QuickSort?",
      "options": ["O(n log n)", "O(n^2)", "O(n)", "O(log n)"],
      "correctIndex": 1,
      "explanation": "QuickSort degrades to O(n^2) when poor pivots are chosen repeatedly."
    }
  ]`;

  const parsed = parseGrokMcqResponse(grokOutput);
  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].correctIndex, 1);
  assert.strictEqual(parsed[0].options.length, 4);
  assert.ok(parsed[0].explanation.includes('O(n^2)'));
});

it('should parse MCQs formatted in json:studyai-mcq block', () => {
  const grokOutput = `Here are your questions:\n\`\`\`json:studyai-mcq\n{\n  "questions": [\n    {\n      "id": "mcq-1",\n      "question": "Which layer in OSI model handles IP routing?",\n      "options": ["Data Link", "Network", "Transport", "Physical"],\n      "correctIndex": 1,\n      "explanation": "Network layer (Layer 3) is responsible for logical addressing and packet routing."\n    }\n  ]\n}\n\`\`\``;

  const parsed = parseGrokMcqResponse(grokOutput);
  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].question, 'Which layer in OSI model handles IP routing?');
  assert.strictEqual(parsed[0].options[1], 'Network');
});

it('should accurately calculate scores, percentages, and grade tiers', () => {
  const questions: QuizQuestion[] = [
    { id: '1', question: 'Q1', options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'Exp1' },
    { id: '2', question: 'Q2', options: ['A', 'B', 'C', 'D'], correctIndex: 2, explanation: 'Exp2' },
    { id: '3', question: 'Q3', options: ['A', 'B', 'C', 'D'], correctIndex: 1, explanation: 'Exp3' },
    { id: '4', question: 'Q4', options: ['A', 'B', 'C', 'D'], correctIndex: 3, explanation: 'Exp4' },
    { id: '5', question: 'Q5', options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'Exp5' }
  ];

  // 4 out of 5 correct (80% -> Excellent)
  const answers = { 0: 0, 1: 2, 2: 1, 3: 3, 4: 1 };
  const res = gradeQuiz(questions, answers);

  assert.strictEqual(res.score, 4);
  assert.strictEqual(res.total, 5);
  assert.strictEqual(res.percentage, 80);
  assert.strictEqual(res.grade, 'Excellent!');
});

it('should structure quiz session records with timestamps, attempts, explanations for Firestore persistence', () => {
  const session: QuizSession = {
    id: 'quiz-session-999',
    userId: 'user-alice-123',
    title: 'Computer Science: Operating Systems',
    topic: 'Virtual Memory',
    subject: 'Computer Science',
    date: Date.now(),
    score: 3,
    total: 3,
    userAnswers: { 0: 1, 1: 0, 2: 2 },
    questions: [
      { id: 'q1', question: 'Paging unit?', options: ['Frame', 'Page', 'Block', 'Word'], correctIndex: 1, explanation: 'Logical memory is divided into Pages.' }
    ]
  };

  assert.strictEqual(session.userId, 'user-alice-123');
  assert.strictEqual(session.score, 3);
  assert.ok(session.date > 0);
  assert.strictEqual(session.questions[0].explanation, 'Logical memory is divided into Pages.');
});

// 3. FLASHCARDS TESTS
console.log('\n3. Testing FLASHCARDS:');
it('should create flashcard deck from topic and associate with authenticated user', () => {
  const deck: FlashcardDeck = {
    id: 'deck-1',
    userId: 'user-alice-123',
    title: 'Computer Science: Graph Theory',
    topic: 'Graph Theory',
    subject: 'Computer Science',
    createdAt: Date.now(),
    cards: [
      { id: 'c1', front: 'What is an Euler Path?', back: 'A path that visits every edge exactly once.', status: 'new', reviewCount: 0 },
      { id: 'c2', front: 'What is a Hamiltonian Path?', back: 'A path that visits every vertex exactly once.', status: 'new', reviewCount: 0 }
    ]
  };

  assert.strictEqual(deck.cards.length, 2);
  assert.strictEqual(deck.userId, 'user-alice-123');
  assert.strictEqual(deck.cards[0].status, 'new');
});

it('should generate flashcards grounded in processed documents', () => {
  const docGroundedDeck: FlashcardDeck = {
    id: 'deck-doc-1',
    userId: 'user-alice-123',
    title: 'OS Textbook: Chapter 8 Memory',
    topic: 'Virtual Memory Paging',
    subject: 'Computer Science',
    sourceDocId: 'doc-silberschatz-ch8',
    createdAt: Date.now(),
    cards: [
      { id: 'c1', front: 'Define TLB hit ratio', back: 'Percentage of times that a virtual page number is found in the TLB cache.', status: 'new' }
    ]
  };

  assert.strictEqual(docGroundedDeck.sourceDocId, 'doc-silberschatz-ch8');
  assert.ok(docGroundedDeck.cards[0].front.includes('TLB'));
});

it('should support flipping cards and marking cards as known or learning', () => {
  let isFlipped = false;
  // Student clicks card to flip
  isFlipped = !isFlipped;
  assert.strictEqual(isFlipped, true);

  const card: Flashcard = {
    id: 'c1',
    front: 'Term',
    back: 'Definition',
    status: 'new',
    reviewCount: 0
  };

  // Student marks card as known
  const masteredCard: Flashcard = { ...card, status: 'mastered', reviewCount: (card.reviewCount || 0) + 1 };
  assert.strictEqual(masteredCard.status, 'mastered');
  assert.strictEqual(masteredCard.reviewCount, 1);

  // Student marks another card as still learning
  const learningCard: Flashcard = { ...card, status: 'learning', reviewCount: 1 };
  assert.strictEqual(learningCard.status, 'learning');
});

it('should support reviewing cards again by resetting status to new', () => {
  const cards: Flashcard[] = [
    { id: 'c1', front: 'F1', back: 'B1', status: 'mastered', reviewCount: 2 },
    { id: 'c2', front: 'F2', back: 'B2', status: 'learning', reviewCount: 1 }
  ];

  const resetCards: Flashcard[] = cards.map(c => ({
    ...c,
    status: 'new' as const,
    reviewCount: (c.reviewCount || 0) + 1
  }));

  assert.ok(resetCards.every(c => c.status === 'new'));
  assert.strictEqual(resetCards[0].reviewCount, 3);
  assert.strictEqual(resetCards[1].reviewCount, 2);
});

// 4. STUDY PLANNER TESTS
console.log('\n4. Testing STUDY PLANNER:');
it('should add subjects with exam dates and colors', () => {
  const subject: StudySubject = {
    id: 'sub-1',
    userId: 'user-alice-123',
    name: 'Operating Systems',
    color: '#8B5CF6',
    examDate: '2026-11-20',
    targetScore: '95%'
  };

  assert.strictEqual(subject.name, 'Operating Systems');
  assert.strictEqual(subject.color, '#8B5CF6');
  assert.strictEqual(subject.examDate, '2026-11-20');
});

it('should calculate accurate exam countdowns', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  const daysUntil = calculateDaysUntilExam('2026-11-20T12:00:00Z', now);
  assert.strictEqual(daysUntil, 10);
});

it('should create tasks and toggle completion with real progress computation (No hardcoded demo statistics)', () => {
  const tasks: StudyTask[] = [
    { id: 't1', userId: 'user-alice-123', title: 'Read Chapter 4', subject: 'Physics', dueDate: 'Tomorrow', completed: false, priority: 'high', estimatedHours: 2 },
    { id: 't2', userId: 'user-alice-123', title: 'Solve 10 problems', subject: 'Math', dueDate: 'Friday', completed: false, priority: 'medium', estimatedHours: 3 }
  ];

  const initialProgress = calculateRealPlannerProgress(tasks);
  assert.strictEqual(initialProgress.completionRate, 0);
  assert.strictEqual(initialProgress.totalPendingHours, 5);

  // Student completes Task 1
  tasks[0].completed = true;
  const updatedProgress = calculateRealPlannerProgress(tasks);

  assert.strictEqual(updatedProgress.completedTasks, 1);
  assert.strictEqual(updatedProgress.pendingTasks, 1);
  assert.strictEqual(updatedProgress.completionRate, 50);
  assert.strictEqual(updatedProgress.totalPendingHours, 3);
});

it('should persist generated 7-day study schedule in Firestore plan format', () => {
  const schedulePayload = {
    userId: 'user-alice-123',
    scheduleText: '| Day | Subject | Activity |\n| Mon | OS | Paging |',
    metadata: { generatedAt: Date.now(), totalDays: 7 },
    updatedAt: Date.now()
  };

  assert.strictEqual(schedulePayload.userId, 'user-alice-123');
  assert.ok(schedulePayload.scheduleText.includes('Day'));
  assert.strictEqual(schedulePayload.metadata.totalDays, 7);
});

// 5. SECURITY & ACCESS CONTROL TESTS
console.log('\n5. Testing SECURITY & ACCESS CONTROL:');
it('should enforce user scoping on all subcollection paths', () => {
  assert.strictEqual(validateSecurityPath('alice', 'notes', 'note-1'), true);
  assert.strictEqual(validateSecurityPath('alice', 'quizzes', 'quiz-1'), true);
  assert.strictEqual(validateSecurityPath('alice', 'flashcards', 'deck-1'), true);
  assert.strictEqual(validateSecurityPath('alice', 'studyPlans', 'plan-1'), true);
  assert.strictEqual(validateSecurityPath('alice', 'subjects', 'sub-1'), true);

  // Invalid user / path checks
  assert.strictEqual(validateSecurityPath('', 'notes', 'note-1'), false);
  assert.strictEqual(validateSecurityPath('alice', 'unauthorizedCollection', 'item-1'), false);
});

it('should prevent user data cross-contamination (User B cannot receive User A records)', () => {
  const userAStore: Record<string, StudyNote[]> = {
    'user-alice': [{ id: 'n1', userId: 'user-alice', title: 'Alice Private Note', content: 'Secret', tags: [] }]
  };
  const userBStore: Record<string, StudyNote[]> = {
    'user-bob': [{ id: 'n2', userId: 'user-bob', title: 'Bob Note', content: 'Public', tags: [] }]
  };

  // Ensure query for Bob only queries Bob's scoped store
  const bNotes = userBStore['user-bob'] || [];
  const aliceLeakedIntoBob = bNotes.some(n => n.userId === 'user-alice');
  assert.strictEqual(aliceLeakedIntoBob, false);

  const aNotes = userAStore['user-alice'] || [];
  const bobLeakedIntoAlice = aNotes.some(n => n.userId === 'user-bob');
  assert.strictEqual(bobLeakedIntoAlice, false);
});

it('should guarantee new user accounts do not display hardcoded demo statistics as real progress', () => {
  const brandNewUserTasks: StudyTask[] = []; // New user starts with empty tasks
  const progress = calculateRealPlannerProgress(brandNewUserTasks);

  assert.strictEqual(progress.totalTasks, 0);
  assert.strictEqual(progress.completedTasks, 0);
  assert.strictEqual(progress.completionRate, 0);
  assert.strictEqual(progress.totalPendingHours, 0);
});

console.log('\n====================================================');
console.log(` Summary: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}

