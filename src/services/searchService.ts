import { apiUrl } from '../utils/apiConfig';
import { getAuthToken } from './aiClient';
import { Conversation, StudyNote, StudyDocument } from '../types/chat';

export interface BackendSearchResults {
  aiOverview?: {
    answer: string;
    model: string;
  } | null;
  rateLimitNotice?: string | null;
  conversations: Array<{
    id: string;
    title: string;
    studyMode: string;
    updatedAt: number;
    snippet?: string;
  }>;
  notes: Array<{
    id: string;
    title: string;
    content: string;
    subject: string;
    tags: string[];
  }>;
  documents: Array<{
    id: string;
    name: string;
    size: string;
    pageCount: number;
    matchedSnippet?: string;
  }>;
}

export interface UnifiedSearchResults {
  conversations: Conversation[];
  notes: StudyNote[];
  documents: StudyDocument[];
  totalCount: number;
}

export const searchService = {
  /**
   * Performs safe search with exact single-consumption response reading
   */
  async searchBackend(query: string, signal?: AbortSignal): Promise<BackendSearchResults> {
    const idToken = await getAuthToken();

    const response = await fetch(apiUrl('/api/search'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ query }),
      signal
    });

    // Safely consume the response stream EXACTLY ONCE
    const responseText = await response.text();

    let data: any;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { error: responseText || 'Invalid server response' };
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Search request failed');
    }

    const results = data.results || {
      conversations: [],
      notes: [],
      documents: []
    };

    return {
      ...results,
      aiOverview: data.aiOverview || null,
      rateLimitNotice: data.rateLimitNotice || null
    };
  },

  /**
   * Merges server search results with local in-memory collections for fast, zero-duplicate results
   */
  mergeResults(
    query: string,
    backendResults: BackendSearchResults,
    localConversations: Conversation[],
    localNotes: StudyNote[],
    localDocuments: StudyDocument[]
  ): UnifiedSearchResults {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        conversations: localConversations.slice(0, 5),
        notes: localNotes.slice(0, 4),
        documents: localDocuments.slice(0, 3),
        totalCount: Math.min(localConversations.length, 5) + Math.min(localNotes.length, 4) + Math.min(localDocuments.length, 3)
      };
    }

    // Match local conversations
    const matchedConvs = localConversations.filter(
      c =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some(m => m.content.toLowerCase().includes(q))
    );

    // Merge with any backend conversations not already in local state
    const convMap = new Map<string, Conversation>();
    matchedConvs.forEach(c => convMap.set(c.id, c));
    backendResults.conversations.forEach(bc => {
      if (!convMap.has(bc.id)) {
        convMap.set(bc.id, {
          id: bc.id,
          title: bc.title,
          isPinned: false,
          studyMode: (bc.studyMode as any) || 'general',
          createdAt: bc.updatedAt || Date.now(),
          updatedAt: bc.updatedAt || Date.now(),
          messages: []
        });
      }
    });

    // Match local notes
    const matchedNotes = localNotes.filter(
      n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(q)))
    );

    const noteMap = new Map<string, StudyNote>();
    matchedNotes.forEach(n => noteMap.set(n.id, n));
    backendResults.notes.forEach(bn => {
      if (!noteMap.has(bn.id)) {
        noteMap.set(bn.id, {
          id: bn.id,
          title: bn.title,
          content: bn.content,
          subject: bn.subject,
          tags: bn.tags,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    });

    // Match local documents
    const matchedDocs = localDocuments.filter(
      d =>
        d.name.toLowerCase().includes(q) ||
        (d as any).subject?.toLowerCase().includes(q)
    );

    const docMap = new Map<string, StudyDocument>();
    matchedDocs.forEach(d => docMap.set(d.id, d));
    backendResults.documents.forEach(bd => {
      if (!docMap.has(bd.id)) {
        docMap.set(bd.id, {
          id: bd.id,
          name: bd.name,
          size: bd.size,
          pageCount: bd.pageCount,
          pages: bd.pageCount,
          chunkCount: 1,
          status: 'ready',
          isScanned: false,
          uploadedAt: Date.now()
        });
      }
    });

    const finalConvs = Array.from(convMap.values());
    const finalNotes = Array.from(noteMap.values());
    const finalDocs = Array.from(docMap.values());

    return {
      conversations: finalConvs,
      notes: finalNotes,
      documents: finalDocs,
      totalCount: finalConvs.length + finalNotes.length + finalDocs.length
    };
  }
};
