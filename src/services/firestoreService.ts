import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { Conversation, Message, StudyNote, StudyTask, QuizSession, FlashcardDeck, StudySubject } from '../types/chat';

/**
 * Cloud Firestore Service matching requested schema:
 * users/
 *   {userId}/
 *     profile/
 *       settings
 *     conversations/
 *       {conversationId}/
 *         messages/
 *           {messageId}
 *     notes/
 *       {noteId}
 *     quizzes/
 *       {quizId}
 *     studyPlans/
 *       {planId}
 */

export const firestoreService = {
  // ==========================================
  // 1. Profile Settings (users/{userId}/profile/settings)
  // ==========================================
  async saveProfileSettings(userId: string, settings: Record<string, any>): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const settingsRef = doc(db, 'users', userId, 'profile', 'settings');
      await setDoc(settingsRef, {
        ...settings,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore saveProfileSettings error:', e);
    }
  },

  async loadProfileSettings(userId: string): Promise<Record<string, any> | null> {
    if (!isFirebaseConfigured || !userId) return null;
    try {
      const settingsRef = doc(db, 'users', userId, 'profile', 'settings');
      const snap = await getDoc(settingsRef);
      return snap.exists() ? snap.data() : null;
    } catch (e) {
      console.warn('Firestore loadProfileSettings error:', e);
      return null;
    }
  },

  // ==========================================
  // 2. Conversations & Nested Messages
  // users/{userId}/conversations/{conversationId}/messages/{messageId}
  // ==========================================
  async saveConversation(userId: string, conversation: Conversation): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      // Save top-level conversation metadata
      const convRef = doc(db, 'users', userId, 'conversations', conversation.id);
      await setDoc(convRef, {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: Date.now(),
        isPinned: conversation.isPinned,
        studyMode: conversation.studyMode,
        messageCount: conversation.messages.length
      }, { merge: true });

      // Save messages in nested subcollection: messages/{messageId}
      if (conversation.messages && conversation.messages.length > 0) {
        const batch = writeBatch(db);
        conversation.messages.forEach(msg => {
          const msgRef = doc(db, 'users', userId, 'conversations', conversation.id, 'messages', msg.id);
          batch.set(msgRef, {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            studyMode: msg.studyMode || conversation.studyMode,
            attachments: msg.attachments || [],
            feedback: msg.feedback || null,
            savedToNotes: msg.savedToNotes || false
          }, { merge: true });
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn('Firestore saveConversation error:', e);
    }
  },

  async loadConversations(userId: string): Promise<Conversation[]> {
    if (!isFirebaseConfigured || !userId) return [];
    try {
      const convsCol = collection(db, 'users', userId, 'conversations');
      const convsQuery = query(convsCol, orderBy('updatedAt', 'desc'));
      const convsSnapshot = await getDocs(convsQuery);

      const conversations: Conversation[] = [];

      for (const docSnap of convsSnapshot.docs) {
        const convData = docSnap.data();
        
        // Fetch nested messages for this conversation
        const messagesCol = collection(db, 'users', userId, 'conversations', docSnap.id, 'messages');
        const messagesQuery = query(messagesCol, orderBy('timestamp', 'asc'));
        const messagesSnapshot = await getDocs(messagesQuery);

        const messages: Message[] = [];
        messagesSnapshot.forEach(mSnap => {
          messages.push(mSnap.data() as Message);
        });

        conversations.push({
          id: convData.id || docSnap.id,
          title: convData.title || 'Conversation',
          createdAt: convData.createdAt || Date.now(),
          updatedAt: convData.updatedAt || Date.now(),
          isPinned: Boolean(convData.isPinned),
          studyMode: convData.studyMode || 'general',
          messages
        });
      }

      return conversations;
    } catch (e) {
      console.warn('Firestore loadConversations error:', e);
      return [];
    }
  },

  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      // Delete nested messages first
      const messagesCol = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
      const messagesSnapshot = await getDocs(messagesCol);
      const batch = writeBatch(db);
      messagesSnapshot.forEach(mSnap => {
        batch.delete(mSnap.ref);
      });
      // Delete the conversation document itself
      const convRef = doc(db, 'users', userId, 'conversations', conversationId);
      batch.delete(convRef);
      await batch.commit();
    } catch (e) {
      console.warn('Firestore deleteConversation error:', e);
    }
  },

  // ==========================================
  // 3. Notes (users/{userId}/notes/{noteId})
  // ==========================================
  async saveNote(userId: string, note: StudyNote): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const noteRef = doc(db, 'users', userId, 'notes', note.id);
      await setDoc(noteRef, {
        id: note.id,
        userId,
        title: note.title,
        content: note.content,
        subject: note.subject || 'General',
        conversationTitle: note.conversationTitle || null,
        createdAt: note.createdAt || Date.now(),
        updatedAt: Date.now(),
        tags: note.tags || []
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore saveNote error:', e);
    }
  },

  async loadNotes(userId: string): Promise<StudyNote[]> {
    if (!isFirebaseConfigured || !userId) return [];
    try {
      const colRef = collection(db, 'users', userId, 'notes');
      const q = query(colRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const list: StudyNote[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as StudyNote);
      });
      return list;
    } catch (e) {
      console.warn('Firestore loadNotes error:', e);
      return [];
    }
  },

  async deleteNote(userId: string, noteId: string): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const noteRef = doc(db, 'users', userId, 'notes', noteId);
      await deleteDoc(noteRef);
    } catch (e) {
      console.warn('Firestore deleteNote error:', e);
    }
  },

  // ==========================================
  // 4. Quizzes (users/{userId}/quizzes/{quizId})
  // ==========================================
  async saveQuiz(userId: string, quiz: QuizSession): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const quizRef = doc(db, 'users', userId, 'quizzes', quiz.id);
      await setDoc(quizRef, {
        ...quiz,
        userId,
        date: quiz.date || Date.now()
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore saveQuiz error:', e);
    }
  },

  async loadQuizzes(userId: string): Promise<QuizSession[]> {
    if (!isFirebaseConfigured || !userId) return [];
    try {
      const colRef = collection(db, 'users', userId, 'quizzes');
      const q = query(colRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      const list: QuizSession[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as QuizSession);
      });
      return list;
    } catch (e) {
      console.warn('Firestore loadQuizzes error:', e);
      return [];
    }
  },

  async deleteQuiz(userId: string, quizId: string): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const quizRef = doc(db, 'users', userId, 'quizzes', quizId);
      await deleteDoc(quizRef);
    } catch (e) {
      console.warn('Firestore deleteQuiz error:', e);
    }
  },

  // ==========================================
  // 5. Flashcards (users/{userId}/flashcards/{deckId})
  // ==========================================
  async saveFlashcardDeck(userId: string, deck: FlashcardDeck): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const deckRef = doc(db, 'users', userId, 'flashcards', deck.id);
      await setDoc(deckRef, {
        ...deck,
        userId,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore saveFlashcardDeck error:', e);
    }
  },

  async loadFlashcardDecks(userId: string): Promise<FlashcardDeck[]> {
    if (!isFirebaseConfigured || !userId) return [];
    try {
      const colRef = collection(db, 'users', userId, 'flashcards');
      const q = query(colRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const list: FlashcardDeck[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as FlashcardDeck);
      });
      return list;
    } catch (e) {
      console.warn('Firestore loadFlashcardDecks error:', e);
      return [];
    }
  },

  async deleteFlashcardDeck(userId: string, deckId: string): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const deckRef = doc(db, 'users', userId, 'flashcards', deckId);
      await deleteDoc(deckRef);
    } catch (e) {
      console.warn('Firestore deleteFlashcardDeck error:', e);
    }
  },

  // ==========================================
  // 6. Study Plans & Tasks (users/{userId}/studyPlans/{planId})
  // ==========================================
  async saveStudyPlan(userId: string, plan: StudyTask): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const planRef = doc(db, 'users', userId, 'studyPlans', plan.id);
      await setDoc(planRef, {
        ...plan,
        userId
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore saveStudyPlan error:', e);
    }
  },

  async loadStudyPlans(userId: string): Promise<StudyTask[]> {
    if (!isFirebaseConfigured || !userId) return [];
    try {
      const colRef = collection(db, 'users', userId, 'studyPlans');
      const snapshot = await getDocs(colRef);
      const list: StudyTask[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as StudyTask);
      });
      return list;
    } catch (e) {
      console.warn('Firestore loadStudyPlans error:', e);
      return [];
    }
  },

  async deleteStudyPlan(userId: string, planId: string): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const planRef = doc(db, 'users', userId, 'studyPlans', planId);
      await deleteDoc(planRef);
    } catch (e) {
      console.warn('Firestore deleteStudyPlan error:', e);
    }
  },

  async saveStudySchedule(userId: string, scheduleText: string, metadata?: any): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const scheduleRef = doc(db, 'users', userId, 'studyPlans', 'activeSchedule');
      await setDoc(scheduleRef, {
        userId,
        scheduleText,
        metadata: metadata || {},
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore saveStudySchedule error:', e);
    }
  },

  async loadStudySchedule(userId: string): Promise<string | null> {
    if (!isFirebaseConfigured || !userId) return null;
    try {
      const scheduleRef = doc(db, 'users', userId, 'studyPlans', 'activeSchedule');
      const snap = await getDoc(scheduleRef);
      if (snap.exists()) {
        const data = snap.data();
        return data.scheduleText || null;
      }
      return null;
    } catch (e) {
      console.warn('Firestore loadStudySchedule error:', e);
      return null;
    }
  },

  // ==========================================
  // 7. Subjects (users/{userId}/subjects/{subjectId})
  // ==========================================
  async saveSubject(userId: string, subject: StudySubject): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const subRef = doc(db, 'users', userId, 'subjects', subject.id);
      await setDoc(subRef, {
        ...subject,
        userId
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore saveSubject error:', e);
    }
  },

  async loadSubjects(userId: string): Promise<StudySubject[]> {
    if (!isFirebaseConfigured || !userId) return [];
    try {
      const colRef = collection(db, 'users', userId, 'subjects');
      const snapshot = await getDocs(colRef);
      const list: StudySubject[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as StudySubject);
      });
      return list;
    } catch (e) {
      console.warn('Firestore loadSubjects error:', e);
      return [];
    }
  },

  async deleteSubject(userId: string, subjectId: string): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const subRef = doc(db, 'users', userId, 'subjects', subjectId);
      await deleteDoc(subRef);
    } catch (e) {
      console.warn('Firestore deleteSubject error:', e);
    }
  },

  // Document metadata helpers
  async saveDocumentMetadata(userId: string, docItem: any): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const docRef = doc(db, 'users', userId, 'documents', docItem.id);
      await setDoc(docRef, docItem, { merge: true });
    } catch (e) {
      console.warn('Firestore saveDocumentMetadata error:', e);
    }
  },

  async deleteDocumentMetadata(userId: string, docId: string): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const docRef = doc(db, 'users', userId, 'documents', docId);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('Firestore deleteDocumentMetadata error:', e);
    }
  }
};
