import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { storage, isFirebaseConfigured } from '../lib/firebase';

/**
 * Firebase Storage Service
 * Restricts all file uploads and downloads strictly to users/{userId}/documents/...
 */

export const storageService = {
  async uploadDocument(userId: string, file: File): Promise<{ url: string; path: string }> {
    if (!isFirebaseConfigured || !userId) {
      // Mock local URL for demo/offline
      return {
        url: URL.createObjectURL(file),
        path: `local/documents/${file.name}`
      };
    }

    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `users/${userId}/documents/${Date.now()}_${sanitizedName}`;
      const fileRef = ref(storage, storagePath);

      const snapshot = await uploadBytes(fileRef, file, {
        contentType: file.type || 'application/pdf',
        customMetadata: {
          uploadedBy: userId,
          originalName: file.name
        }
      });

      const downloadUrl = await getDownloadURL(snapshot.ref);
      return {
        url: downloadUrl,
        path: storagePath
      };
    } catch (error) {
      console.warn('Firebase Storage uploadDocument error:', error);
      return {
        url: URL.createObjectURL(file),
        path: `fallback/${file.name}`
      };
    }
  },

  async deleteDocument(storagePath: string): Promise<void> {
    if (!isFirebaseConfigured || storagePath.startsWith('local') || storagePath.startsWith('fallback')) {
      return;
    }

    try {
      const fileRef = ref(storage, storagePath);
      await deleteObject(fileRef);
    } catch (error) {
      console.warn('Firebase Storage deleteDocument error:', error);
    }
  }
};
