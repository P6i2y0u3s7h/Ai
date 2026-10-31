import { auth, storage } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { apiUrl } from '../utils/apiConfig';
import { StudyDocument } from '../types/chat';

export interface DocumentUploadProgressCallback {
  (progress: number, status: 'uploading' | 'processing' | 'ready' | 'scanned_needs_ocr' | 'error', error?: string): void;
}

/**
 * Service to manage PDF document uploads, text extraction, and chat grounding
 */
export const documentService = {
  /**
   * Uploads and triggers backend text extraction & chunking for a PDF file
   */
  async uploadAndProcessPdf(
    file: File,
    onProgress?: DocumentUploadProgressCallback
  ): Promise<StudyDocument> {
    // 1. Client-Side Validation
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      throw new Error('Validation Error: Only PDF documents (.pdf) are supported.');
    }

    const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
    if (file.size > MAX_SIZE) {
      throw new Error('Validation Error: File size exceeds the maximum limit of 25 MB.');
    }

    // 2. Prepare Authentication Token
    let idToken = 'guest-student-session';
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        idToken = await currentUser.getIdToken(true);
      } catch (err) {
        console.warn('Could not refresh token for PDF upload, using session:', err);
      }
    }

    // 3. Optional parallel backup to Firebase Storage under user-specific path
    let storagePath = '';
    let downloadUrl = '';
    const tempDocId = `doc-${Date.now()}`;
    const userId = currentUser?.uid || 'guest-student-session';

    if (currentUser && storage) {
      try {
        const fileRef = ref(storage, `users/${userId}/documents/${tempDocId}/${file.name}`);
        storagePath = `users/${userId}/documents/${tempDocId}/${file.name}`;
        
        // Upload to Storage
        const uploadTask = uploadBytesResumable(fileRef, file);
        uploadTask.on('state_changed', snapshot => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 50);
          onProgress?.(pct, 'uploading');
        });

        await uploadTask;
        downloadUrl = await getDownloadURL(fileRef);
      } catch (storageErr) {
        console.warn('Firebase Storage direct upload notice (falling back to server upload):', storageErr);
      }
    }

    // 4. Send file to secure backend processing endpoint (/api/documents/process)
    return new Promise<StudyDocument>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', apiUrl('/api/documents/process'));
      xhr.setRequestHeader('Authorization', `Bearer ${idToken}`);

      xhr.upload.onprogress = event => {
        if (event.lengthComputable) {
          const uploadPct = Math.round((event.loaded / event.total) * 100);
          if (uploadPct < 100) {
            onProgress?.(uploadPct, 'uploading');
          } else {
            onProgress?.(100, 'processing');
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            const doc: StudyDocument = {
              ...data.document,
              storagePath,
              downloadUrl: downloadUrl || data.document.downloadUrl
            };
            onProgress?.(100, doc.status === 'scanned_needs_ocr' ? 'scanned_needs_ocr' : 'ready', doc.error);
            resolve(doc);
          } catch (e) {
            reject(new Error('Invalid response from document processing server.'));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            const errMsg = errData.error || `Server error (${xhr.status}): Failed to process document.`;
            onProgress?.(0, 'error', errMsg);
            reject(new Error(errMsg));
          } catch {
            const errMsg = `Upload failed with HTTP status ${xhr.status}`;
            onProgress?.(0, 'error', errMsg);
            reject(new Error(errMsg));
          }
        }
      };

      xhr.onerror = () => {
        const errMsg = 'Network connection failed while uploading PDF to StudyAI server.';
        onProgress?.(0, 'error', errMsg);
        reject(new Error(errMsg));
      };

      const formData = new FormData();
      formData.append('file', file);
      xhr.send(formData);
    });
  },

  /**
   * Fetch all uploaded documents for the authenticated student
   */
  async getDocuments(): Promise<StudyDocument[]> {
    let idToken = 'guest-student-session';
    if (auth.currentUser) {
      try {
        idToken = await auth.currentUser.getIdToken(true);
      } catch {}
    }

    try {
      const res = await fetch(apiUrl('/api/documents'), {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      const responseText = await res.text();
      let data: any;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { error: responseText || 'Invalid server response' };
      }
      if (!res.ok) return [];
      return data.documents || [];
    } catch {
      return [];
    }
  },

  /**
   * Delete a document and its stored chunks
   */
  async deleteDocument(documentId: string, storagePath?: string): Promise<boolean> {
    let idToken = 'guest-student-session';
    if (auth.currentUser) {
      try {
        idToken = await auth.currentUser.getIdToken(true);
      } catch {}
    }

    // 1. Delete from Firebase Storage if path was recorded
    if (storagePath && storage) {
      try {
        const fileRef = ref(storage, storagePath);
        await deleteObject(fileRef);
      } catch (err) {
        console.warn('Storage delete notice:', err);
      }
    }

    // 2. Delete from backend server
    try {
      const res = await fetch(apiUrl(`/api/documents/${documentId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      return res.ok;
    } catch {
      return false;
    }
  }
};
