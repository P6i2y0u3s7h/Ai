import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  writeBatch,
  Unsubscribe
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { Conversation, Message, StudyMode } from '../types/chat';

/**
 * Generate a clean initial conversation title from the first message
 * Ensures sensible length limit (<= 36 chars)
 */
export function generateConversationTitle(prompt: string): string {
  if (!prompt || !prompt.trim()) return 'New Conversation';
  const clean = prompt
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[#*`\-–—\s]+/, '');
  if (clean.length <= 36) return clean;
  return clean.slice(0, 36).trim() + '...';
}

/**
 * Firestore Chat Service
 * Enforces ownership and subcollection message persistence under users/{userId}/conversations/{conversationId}/messages/{messageId}
 */
export const firestoreChatService = {
  /**
   * Create or update conversation metadata
   */
  async upsertConversation(
    userId: string,
    conversationId: string,
    data: {
      title?: string;
      studyMode?: StudyMode;
      isPinned?: boolean;
      createdAt?: number;
      updatedAt?: number;
    }
  ): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const convRef = doc(db, 'users', userId, 'conversations', conversationId);
      await setDoc(
        convRef,
        {
          id: conversationId,
          userId,
          title: data.title || 'New Conversation',
          studyMode: data.studyMode || 'general',
          isPinned: data.isPinned !== undefined ? data.isPinned : false,
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now()
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('firestoreChatService.upsertConversation error:', e);
    }
  },

  /**
   * Save user message to subcollection users/{userId}/conversations/{conversationId}/messages/{messageId}
   */
  async saveUserMessage(
    userId: string,
    conversationId: string,
    message: Message
  ): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const msgRef = doc(db, 'users', userId, 'conversations', conversationId, 'messages', message.id);
      await setDoc(msgRef, {
        id: message.id,
        conversationId,
        userId,
        role: 'user',
        content: message.content,
        timestamp: message.timestamp || Date.now(),
        createdAt: message.timestamp || Date.now(),
        status: 'sent',
        studyMode: message.studyMode || 'general',
        attachments: message.attachments || []
      }, { merge: true });

      // Touch parent conversation updatedAt
      const convRef = doc(db, 'users', userId, 'conversations', conversationId);
      await setDoc(convRef, { updatedAt: Date.now() }, { merge: true });
    } catch (e) {
      console.warn('firestoreChatService.saveUserMessage error:', e);
    }
  },

  /**
   * Save assistant message to subcollection with status 'completed' or 'cancelled'
   * Ensures that cancelled or stopped responses are never stored as 'completed'
   */
  async saveAssistantMessage(
    userId: string,
    conversationId: string,
    message: Message,
    isCompleted: boolean = true
  ): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const msgRef = doc(db, 'users', userId, 'conversations', conversationId, 'messages', message.id);
      await setDoc(msgRef, {
        id: message.id,
        conversationId,
        userId,
        role: 'assistant',
        content: message.content,
        timestamp: message.timestamp || Date.now(),
        createdAt: message.timestamp || Date.now(),
        status: message.status || (isCompleted ? 'completed' : 'error'),
        studyMode: message.studyMode || 'general',
        feedback: message.feedback || null,
        savedToNotes: message.savedToNotes || false
      }, { merge: true });

      // Touch parent conversation updatedAt
      const convRef = doc(db, 'users', userId, 'conversations', conversationId);
      await setDoc(convRef, { updatedAt: Date.now() }, { merge: true });
    } catch (e) {
      console.warn('firestoreChatService.saveAssistantMessage error:', e);
    }
  },

  /**
   * Rename a conversation
   */
  async renameConversation(
    userId: string,
    conversationId: string,
    newTitle: string
  ): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const convRef = doc(db, 'users', userId, 'conversations', conversationId);
      await setDoc(convRef, {
        title: newTitle.trim(),
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) {
      console.warn('firestoreChatService.renameConversation error:', e);
    }
  },

  /**
   * Pin or unpin a conversation
   */
  async togglePinConversation(
    userId: string,
    conversationId: string,
    isPinned: boolean
  ): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      const convRef = doc(db, 'users', userId, 'conversations', conversationId);
      await setDoc(convRef, {
        isPinned,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) {
      console.warn('firestoreChatService.togglePinConversation error:', e);
    }
  },

  /**
   * Delete a conversation and all its nested subcollection messages
   */
  async deleteConversation(
    userId: string,
    conversationId: string
  ): Promise<void> {
    if (!isFirebaseConfigured || !userId) return;
    try {
      // 1. Fetch and batch delete all messages under the conversation
      const messagesCol = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
      const messagesSnap = await getDocs(messagesCol);
      
      const batch = writeBatch(db);
      messagesSnap.forEach(mSnap => {
        batch.delete(mSnap.ref);
      });

      // 2. Delete the conversation document
      const convRef = doc(db, 'users', userId, 'conversations', conversationId);
      batch.delete(convRef);

      await batch.commit();
    } catch (e) {
      console.warn('firestoreChatService.deleteConversation error:', e);
    }
  },

  /**
   * Real-time listener for user conversations
   */
  subscribeToUserConversations(
    userId: string,
    onUpdate: (conversations: Conversation[]) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured || !userId) {
      return () => {};
    }

    const convsCol = collection(db, 'users', userId, 'conversations');
    const q = query(convsCol, orderBy('updatedAt', 'desc'));

    return onSnapshot(
      q,
      async snapshot => {
        const convList: Conversation[] = [];
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          convList.push({
            id: data.id || docSnap.id,
            userId: data.userId || userId,
            title: data.title || 'Conversation',
            createdAt: data.createdAt || Date.now(),
            updatedAt: data.updatedAt || Date.now(),
            isPinned: Boolean(data.isPinned),
            studyMode: data.studyMode || 'general',
            messages: [] // loaded via subcollection listener for active chat or on-demand
          });
        }

        onUpdate(convList);
      },
      error => {
        console.warn('Conversations onSnapshot error:', error);
      }
    );
  },

  /**
   * Real-time listener for messages of a specific conversation
   */
  subscribeToConversationMessages(
    userId: string,
    conversationId: string,
    onUpdate: (messages: Message[]) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured || !userId || !conversationId) {
      return () => {};
    }

    const messagesCol = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
    const q = query(messagesCol, orderBy('timestamp', 'asc'));

    return onSnapshot(
      q,
      snapshot => {
        const msgList: Message[] = [];
        snapshot.forEach(docSnap => {
          const d = docSnap.data();
          msgList.push({
            id: d.id || docSnap.id,
            role: d.role || 'user',
            content: d.content || '',
            timestamp: d.timestamp || d.createdAt || Date.now(),
            status: d.status || 'completed',
            studyMode: d.studyMode || 'general',
            attachments: d.attachments || [],
            feedback: d.feedback || undefined,
            savedToNotes: d.savedToNotes || false
          });
        });
        onUpdate(msgList);
      },
      error => {
        console.warn('Messages onSnapshot error:', error);
      }
    );
  }
};
