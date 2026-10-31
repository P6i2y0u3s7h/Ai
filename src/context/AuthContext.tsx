import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isGuest?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  signIn: (email: string, pass: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginAsGuest: (name?: string) => void;
  isFirebaseConfigured: boolean;
}

const GUEST_STORAGE_KEY = 'studyai_guest_user_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = () => setAuthError(null);

  useEffect(() => {
    // Check if guest session exists first
    const savedGuest = localStorage.getItem(GUEST_STORAGE_KEY);
    if (savedGuest) {
      try {
        const parsed = JSON.parse(savedGuest);
        setUser(parsed);
        setLoading(false);
        return;
      } catch {
        localStorage.removeItem(GUEST_STORAGE_KEY);
      }
    }

    // Listen to Firebase persistent auth changes
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Student',
            photoURL: firebaseUser.photoURL,
            isGuest: false
          });
        } else {
          // If not signed into firebase and no guest, user is logged out
          const guest = localStorage.getItem(GUEST_STORAGE_KEY);
          if (!guest) {
            setUser(null);
          }
        }
        setLoading(false);
      });
    } catch (e) {
      console.warn('onAuthStateChanged error:', e);
      setLoading(false);
    }

    return () => unsubscribe();
  }, []);

  // Format Firebase error codes to friendly student messages
  const formatAuthError = (code: string, fallback: string): string => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Try signing in.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/network-request-failed':
        return 'Network connection error. Check your internet connection.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      default:
        return fallback;
    }
  };

  // Sign Up with Email and Password
  const signUp = async (email: string, pass: string, name: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      if (!isFirebaseConfigured) {
        // Fallback demo signup
        const mockUid = `user-${Date.now()}`;
        const newUser: AuthUser = {
          uid: mockUid,
          email,
          displayName: name.trim() || 'Student',
          photoURL: null,
          isGuest: false
        };
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(newUser));
        setUser(newUser);
        setLoading(false);
        return;
      }

      const credential = await createUserWithEmailAndPassword(auth, email, pass);
      if (name.trim()) {
        await updateProfile(credential.user, {
          displayName: name.trim()
        });
      }
      setUser({
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: name.trim() || credential.user.email?.split('@')[0] || 'Student',
        photoURL: credential.user.photoURL,
        isGuest: false
      });
    } catch (err: any) {
      const msg = formatAuthError(err.code, err.message || 'Failed to create account.');
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Sign In with Email and Password
  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      if (!isFirebaseConfigured) {
        // Demo signin
        const newUser: AuthUser = {
          uid: 'demo-student-id',
          email,
          displayName: email.split('@')[0] || 'Student',
          photoURL: null,
          isGuest: false
        };
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(newUser));
        setUser(newUser);
        setLoading(false);
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, email, pass);
      setUser({
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: credential.user.displayName || credential.user.email?.split('@')[0] || 'Student',
        photoURL: credential.user.photoURL,
        isGuest: false
      });
    } catch (err: any) {
      const msg = formatAuthError(err.code, err.message || 'Failed to sign in.');
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Sign Out
  const signOutUser = async () => {
    setLoading(true);
    try {
      localStorage.removeItem(GUEST_STORAGE_KEY);
      if (isFirebaseConfigured) {
        await signOut(auth);
      }
      setUser(null);
    } catch (err: any) {
      console.error('Sign out error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Password Reset
  const resetPassword = async (email: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      if (!isFirebaseConfigured) {
        // Simulated reset
        await new Promise(r => setTimeout(r, 600));
        setLoading(false);
        return;
      }
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      const msg = formatAuthError(err.code, err.message || 'Failed to send reset email.');
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Fast Guest / Student Evaluation Login
  const loginAsGuest = (name = 'Alex Morgan') => {
    const guestUser: AuthUser = {
      uid: 'guest-student-session',
      email: 'alex.morgan@college.edu',
      displayName: name,
      photoURL: null,
      isGuest: true
    };
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestUser));
    setUser(guestUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        clearAuthError,
        signUp,
        signIn,
        signOutUser,
        resetPassword,
        loginAsGuest,
        isFirebaseConfigured
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
