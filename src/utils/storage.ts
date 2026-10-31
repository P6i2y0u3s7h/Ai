import { Conversation, StudyNote, StudyDocument, QuizSession, StudyTask, FlashcardDeck, StudySubject } from '../types/chat';

const STORAGE_KEYS = {
  CONVERSATIONS:    'studyai_conversations_v1',
  ACTIVE_CHAT_ID:   'studyai_active_chat_id_v1',
  NOTES:            'studyai_notes_v1',
  DOCUMENTS:        'studyai_documents_v1',
  QUIZZES:          'studyai_quizzes_v1',
  TASKS:            'studyai_tasks_v1',
  FLASHCARD_DECKS:  'studyai_flashcard_decks_v1',
  SUBJECTS:         'studyai_subjects_v1',
  SETTINGS:         'studyai_settings_v1',
};

// Initial pre-loaded study conversations to give immediate ChatGPT-like depth
const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    title: 'Operating Systems: Virtual Memory & Paging',
    createdAt: Date.now() - 3600000 * 2,
    updatedAt: Date.now() - 3600000 * 2,
    isPinned: true,
    studyMode: 'exam',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Explain Paging vs Segmentation in Operating Systems with a comparison table for my semester exam.',
        timestamp: Date.now() - 3600000 * 2,
        studyMode: 'exam'
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: `### 🎯 Exam Master Answer: Paging vs. Segmentation in OS

In modern operating systems, both **Paging** and **Segmentation** are memory management schemes used to allocate non-contiguous physical memory to processes.

---

### 1. Key Definitions

* **Paging:** A fixed-size memory management scheme where physical memory is divided into fixed-sized blocks called **Frames**, and logical memory is divided into blocks of the same size called **Pages**.
* **Segmentation:** A variable-size memory management scheme that divides logical address space into modules/segments based on logical units (e.g., functions, arrays, stack, code).

---

### 2. Comprehensive Comparison Table (8-Mark Question)

| Feature | Paging | Segmentation |
| :--- | :--- | :--- |
| **Block Size** | Fixed size (e.g., 4 KB) | Variable size (dependent on user module) |
| **Visibility** | Invisible to the programmer | Visible to the programmer |
| **Address Structure** | Page Number ($p$) + Offset ($d$) | Segment Number ($s$) + Offset ($d$) |
| **Hardware Overhead** | Single Page Table | Segment Table (Base + Limit register) |
| **Internal Fragmentation** | **Yes** (occurs in the last page) | **No** (exact sizes allocated) |
| **External Fragmentation** | **No** (all frames uniform) | **Yes** (storage holes created over time) |
| **Primary Goal** | Maximize physical memory utilization | Reflect programmer's logical view of memory |

---

### 3. Core Working & Translation Formula

#### Paging Address Translation:
$$\\text{Physical Address} = (\\text{Frame Number} \\times \\text{Page Size}) + \\text{Offset}$$

* The OS maintains a **Page Table** mapping logical page numbers ($p$) to physical frame numbers ($f$).
* A **TLB (Translation Lookaside Buffer)** cache accelerates lookup times from $O(2)$ memory accesses to near $O(1)$.

#### Segmentation Check:
$$\\text{If } \\text{Offset} < \\text{Limit} \\implies \\text{Physical Address} = \\text{Base} + \\text{Offset}$$
* If $\\text{Offset} \\ge \\text{Limit}$, the MMU throws a **Segmentation Fault** trap to the OS kernel.

---

> 💡 **Examiner's Secret Tip:** Always conclude your answer by mentioning **Paged Segmentation** (used in x86 architectures), which combines both methods: segmenting logical memory first, then dividing each segment into fixed-size pages to eliminate external fragmentation!`,
        timestamp: Date.now() - 3600000 * 2 + 3000,
        studyMode: 'exam',
        savedToNotes: true
      }
    ]
  },
  {
    id: 'conv-2',
    title: 'Data Structures: Dijkstra Algorithm in Python',
    createdAt: Date.now() - 3600000 * 24,
    updatedAt: Date.now() - 3600000 * 24,
    isPinned: true,
    studyMode: 'coding',
    messages: [
      {
        id: 'msg-3',
        role: 'user',
        content: 'Can you show me Dijkstra\'s algorithm implementation using a min-heap in Python with time complexity analysis?',
        timestamp: Date.now() - 3600000 * 24,
        studyMode: 'coding'
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content: `### ⚡ Dijkstra's Shortest Path Algorithm (Priority Queue)

Dijkstra's algorithm finds the shortest path from a single source node to all other vertices in a weighted graph with **non-negative edge weights**.

\`\`\`python
import heapq

def dijkstra(graph: dict, start: str) -> dict:
    # Initialize distances with infinity
    distances = {node: float('inf') for node in graph}
    distances[start] = 0
    
    # Priority queue stores tuples of (current_distance, node)
    pq = [(0, start)]
    
    while pq:
        curr_dist, curr_node = heapq.heappop(pq)
        
        # If we found a longer path already in queue, skip
        if curr_dist > distances[curr_node]:
            continue
            
        for neighbor, weight in graph[curr_node].items():
            distance = curr_dist + weight
            
            # Found a shorter path to neighbor
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                heapq.heappush(pq, (distance, neighbor))
                
    return distances

# Example Usage
graph = {
    'A': {'B': 4, 'C': 2},
    'B': {'A': 4, 'C': 1, 'D': 5},
    'C': {'A': 2, 'B': 1, 'D': 8, 'E': 10},
    'D': {'B': 5, 'C': 8, 'E': 2},
    'E': {'C': 10, 'D': 2}
}

print("Shortest distances from node A:", dijkstra(graph, 'A'))
\`\`\`

---

### 📊 Complexity Analysis

* **Time Complexity:** $\\mathcal{O}((V + E) \\log V)$ using a binary min-heap where $V$ is vertices and $E$ is edges.
* **Space Complexity:** $\\mathcal{O}(V)$ for storing the distances dictionary and priority queue.
* **Crucial Constraint:** Dijkstra **fails** on graphs with negative weight cycles. For negative weights, use the **Bellman-Ford Algorithm** ($\\\\mathcal{O}(V \\cdot E)$).`,
        timestamp: Date.now() - 3600000 * 24 + 4000,
        studyMode: 'coding'
      }
    ]
  },
  {
    id: 'conv-3',
    title: 'Machine Learning: Backpropagation Intuition',
    createdAt: Date.now() - 3600000 * 48,
    updatedAt: Date.now() - 3600000 * 48,
    isPinned: false,
    studyMode: 'study',
    messages: [
      {
        id: 'msg-5',
        role: 'user',
        content: 'Help me understand Backpropagation without getting lost in partial derivatives.',
        timestamp: Date.now() - 3600000 * 48,
        studyMode: 'study'
      },
      {
        id: 'msg-6',
        role: 'assistant',
        content: `### 🧠 Intuitive Guide to Backpropagation

Think of a neural network as an **orchestra**, and the output as the symphony it produces:

1. **Forward Pass:** Every musician plays their instrument based on the sheet music (weights). The conductor hears the overall song and notices a sour note (Loss / Error).
2. **The Blame Game:** How much did the trumpeter contribute to the sour note vs. the violinist?
3. **Backward Pass (Chain Rule):** You start from the finish line (the ear of the conductor) and walk backwards. Each musician is told: *"Tune your string 5% sharper or flatter."*
4. **Gradient Descent:** In the next practice session, every musician plays with their slightly tuned instruments, making the error smaller.`,
        timestamp: Date.now() - 3600000 * 48 + 2000,
        studyMode: 'study'
      }
    ]
  },
  {
    id: 'conv-4',
    title: 'Chemistry: Thermodynamics Laws & Entropy',
    createdAt: Date.now() - 3600000 * 72,
    updatedAt: Date.now() - 3600000 * 72,
    isPinned: false,
    studyMode: 'general',
    messages: []
  }
];

const INITIAL_NOTES: StudyNote[] = [
  {
    id: 'note-1',
    title: 'Paging vs Segmentation Quick Summary',
    content: 'Paging = Fixed size blocks (Frames & Pages), Internal fragmentation exists, no external. Segmentation = Variable size logical modules, External fragmentation exists, no internal. Paged segmentation in x86 solves both.',
    conversationTitle: 'Operating Systems: Virtual Memory & Paging',
    createdAt: Date.now() - 3600000 * 2,
    tags: ['Operating Systems', 'Exams', 'Computer Science']
  },
  {
    id: 'note-2',
    title: 'Dijkstra Priority Queue Complexity',
    content: 'O((V + E) log V) with Min-Heap. Cannot handle negative edge weights (must switch to Bellman-Ford O(V*E)).',
    conversationTitle: 'Data Structures: Dijkstra Algorithm in Python',
    createdAt: Date.now() - 3600000 * 20,
    tags: ['Algorithms', 'Python', 'Graph Theory']
  }
];

const INITIAL_DOCUMENTS: StudyDocument[] = [
  {
    id: 'doc-1',
    name: 'Operating_Systems_Silberschatz_Ch8_Memory.pdf',
    size: '4.2 MB',
    pages: 48,
    pageCount: 48,
    uploadedAt: Date.now() - 3600000 * 30,
    status: 'ready',
    topic: 'Computer Science'
  },
  {
    id: 'doc-2',
    name: 'Calculus_III_Vector_Fields_CheatSheet.pdf',
    size: '1.8 MB',
    pages: 12,
    pageCount: 12,
    uploadedAt: Date.now() - 3600000 * 60,
    status: 'ready',
    topic: 'Mathematics'
  }
];

const INITIAL_TASKS: StudyTask[] = [
  {
    id: 'task-1',
    title: 'Review Virtual Memory & Page Replacement Algorithms',
    subject: 'Operating Systems',
    dueDate: 'Tomorrow, 5:00 PM',
    completed: false,
    priority: 'high'
  },
  {
    id: 'task-2',
    title: 'Solve 10 LeetCode Graph Traversal Problems',
    subject: 'Data Structures',
    dueDate: 'Friday',
    completed: true,
    priority: 'medium'
  },
  {
    id: 'task-3',
    title: 'Prepare presentation on Neural Network Loss Functions',
    subject: 'Machine Learning',
    dueDate: 'Sunday',
    completed: false,
    priority: 'low'
  }
];

export function getStoredConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(INITIAL_CONVERSATIONS));
      return INITIAL_CONVERSATIONS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_CONVERSATIONS;
  }
}

export function saveStoredConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
  } catch (e) {
    console.error('Failed to save conversations to localStorage', e);
  }
}

export function getStoredActiveChatId(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT_ID) || 'conv-1';
  } catch {
    return 'conv-1';
  }
}

export function saveStoredActiveChatId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT_ID, id);
  } catch (e) {
    console.error('Failed to save active chat ID', e);
  }
}

export function getStoredNotes(): StudyNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(INITIAL_NOTES));
      return INITIAL_NOTES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_NOTES;
  }
}

export function saveStoredNotes(notes: StudyNote[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save notes', e);
  }
}

export function getStoredDocuments(): StudyDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(INITIAL_DOCUMENTS));
      return INITIAL_DOCUMENTS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_DOCUMENTS;
  }
}

export function saveStoredDocuments(docs: StudyDocument[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
  } catch (e) {
    console.error('Failed to save documents', e);
  }
}

export function getStoredTasks(): StudyTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
      return INITIAL_TASKS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_TASKS;
  }
}

export function saveStoredTasks(tasks: StudyTask[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks', e);
  }
}

export function getStoredFlashcardDecks(): FlashcardDeck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FLASHCARD_DECKS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredFlashcardDecks(decks: FlashcardDeck[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FLASHCARD_DECKS, JSON.stringify(decks));
  } catch (e) {
    console.error('Failed to save flashcard decks', e);
  }
}

export function getStoredQuizSessions(): QuizSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QUIZZES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredQuizSessions(sessions: QuizSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to save quiz sessions', e);
  }
}

export function getStoredSubjects(): StudySubject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredSubjects(subjects: StudySubject[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
  } catch (e) {
    console.error('Failed to save subjects', e);
  }
}
