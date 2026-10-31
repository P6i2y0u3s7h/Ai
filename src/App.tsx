import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { AppLayout } from './components/layout/AppLayout';
import { AuthScreen } from './components/auth/AuthScreen';

const AuthenticatedApp: React.FC = () => {
  const { user, loading } = useAuth();

  // Full-screen loading state during initial auth resolution
  if (loading) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white select-none">
        <div className="w-9 h-9 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mb-3.5" />
        <span className="text-xs text-zinc-500 font-mono tracking-wider uppercase">
          Verifying StudyAI Session...
        </span>
      </div>
    );
  }

  // Protected Route: If logged out, render AuthScreen
  if (!user) {
    return <AuthScreen />;
  }

  // Authenticated: Render StudyAI Chat Application
  return (
    <ChatProvider>
      <AppLayout />
    </ChatProvider>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
};

export default App;
