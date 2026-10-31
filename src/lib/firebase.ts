import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const getEnv = (key: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return '';
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID'),
};

// Check if credentials are placeholders or actually configured
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.includes('Placeholder') &&
  !firebaseConfig.apiKey.includes('your_') &&
  firebaseConfig.projectId &&
  !firebaseConfig.projectId.includes('your_')
);

let app: FirebaseApp = {} as FirebaseApp;
let auth: Auth = {} as Auth;
let db: Firestore = {} as Firestore;
let storage: FirebaseStorage = {} as FirebaseStorage;

const effectiveConfig = isFirebaseConfigured
  ? firebaseConfig
  : {
      apiKey: 'AIzaSyDq6mFRaa9513BUUB_2pS4IRmIztkxvpCM',
      authDomain: 'ai-chatbot-c21ae.firebaseapp.com',
      projectId: 'ai-chatbot-c21ae',
      storageBucket: 'ai-chatbot-c21ae.firebasestorage.app',
      messagingSenderId: '503190898076',
      appId: '1:503190898076:web:9cdfa6ca18518c1001f459',
    };

try {
  app = getApps().length > 0 ? getApp() : initializeApp(effectiveConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  console.warn('Firebase initialization notice: Running with fallback handling.', error);
  try {
    app = initializeApp({
      apiKey: 'AIzaSyDq6mFRaa9513BUUB_2pS4IRmIztkxvpCM',
      authDomain: 'ai-chatbot-c21ae.firebaseapp.com',
      projectId: 'ai-chatbot-c21ae',
      storageBucket: 'ai-chatbot-c21ae.firebasestorage.app',
      messagingSenderId: '503190898076',
      appId: '1:503190898076:web:9cdfa6ca18518c1001f459',
    }, 'fallback-app');
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch {
    auth = {} as Auth;
    db = {} as Firestore;
    storage = {} as FirebaseStorage;
  }
}

export { app, auth, db, storage };
export default app;
