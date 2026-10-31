import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AiLogo } from '../common/LumoraLogo';

type AuthMode = 'signin' | 'signup' | 'forgot';

export const AuthScreen: React.FC = () => {
  const {
    signIn,
    signUp,
    resetPassword,
    loginAsGuest,
    authError,
    clearAuthError,
    loading,
    isFirebaseConfigured
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const switchMode = (newMode: AuthMode) => {
    clearAuthError();
    setFormError(null);
    setResetSent(false);
    setMode(newMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setFormError(null);

    if (!email.trim()) {
      setFormError('Please enter your email address.');
      return;
    }

    if (mode === 'forgot') {
      try {
        await resetPassword(email.trim());
        setResetSent(true);
      } catch (err: any) {
        // Handled in context
      }
      return;
    }

    if (!password) {
      setFormError('Please enter your password.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setFormError('Password must be at least 6 characters.');
        return;
      }
      try {
        await signUp(email.trim(), password, name.trim());
      } catch (err: any) {
        // Handled in context
      }
    } else {
      try {
        await signIn(email.trim(), password);
      } catch (err: any) {
        // Handled in context
      }
    }
  };

  return (
    <div className="min-h-screen w-screen bg-black flex flex-col items-center justify-center p-4 select-none relative overflow-hidden font-sans">
      {/* Background subtle radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.03] rounded-full blur-[160px] pointer-events-none" />

      {/* Main Authentication Card */}
      <div className="w-full max-w-[420px] bg-[#0A0A0A] border border-[#262626] rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-4">
            <AiLogo size="xl" />
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {mode === 'signin' && 'Welcome back'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'forgot' && 'Reset your password'}
          </h1>

          <p className="text-xs sm:text-[13px] text-[#A1A1AA] mt-1.5 max-w-[320px]">
            {mode === 'signin' && 'Sign in to access your notes, quizzes, and study history.'}
            {mode === 'signup' && 'Your AI-powered study companion for exams and coursework.'}
            {mode === 'forgot' && 'Enter your email to receive a secure password recovery link.'}
          </p>
        </div>

        {/* Firebase Config Notice Badge */}
        {!isFirebaseConfigured && (
          <div className="mb-5 p-3 rounded-xl bg-[#141414] border border-[#262626] text-[11.5px] text-[#A1A1AA] flex items-start gap-2">
            <Sparkles size={14} className="text-white flex-shrink-0 mt-0.5" />
            <div>
              <span>Firebase placeholder keys detected. You can test in <strong>Interactive Demo Mode</strong> or supply live credentials in <code>.env</code>.</span>
            </div>
          </div>
        )}

        {/* Error / Alert banner */}
        {(formError || authError) && (
          <div className="mb-4 p-3 rounded-xl bg-[#1C1C1C] border border-[#3F3F46] text-white text-xs flex items-center gap-2">
            <AlertCircle size={15} className="flex-shrink-0 text-white" />
            <span>{formError || authError}</span>
          </div>
        )}

        {/* Password Reset Success notification */}
        {resetSent && (
          <div className="mb-4 p-3 rounded-xl bg-[#1C1C1C] border border-[#262626] text-white text-xs flex items-center gap-2">
            <CheckCircle2 size={15} className="flex-shrink-0 text-white" />
            <span>Password reset email dispatched! Check your inbox.</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Name field for Sign Up */}
          {mode === 'signup' && (
            <div>
              <label className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#71717A]">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full bg-[#111111] text-white text-[13px] pl-9 pr-3 py-2.5 rounded-xl border border-[#262626] focus:border-white focus:outline-none transition-colors placeholder:text-[#71717A]"
                />
              </div>
            </div>
          )}

          {/* Email field */}
          <div>
            <label className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#71717A]">
                <Mail size={16} />
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="student@university.edu"
                required
                className="w-full bg-[#111111] text-white text-[13px] pl-9 pr-3 py-2.5 rounded-xl border border-[#262626] focus:border-white focus:outline-none transition-colors placeholder:text-[#71717A]"
              />
            </div>
          </div>

          {/* Password field (for Sign In & Sign Up) */}
          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-[11px] text-[#A1A1AA] hover:text-white font-medium"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#71717A]">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#111111] text-white text-[13px] pl-9 pr-9 py-2.5 rounded-xl border border-[#262626] focus:border-white focus:outline-none transition-colors placeholder:text-[#71717A]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#71717A] hover:text-white"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-[13.5px] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <span>
                  {mode === 'signin' && 'Sign In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'forgot' && 'Send Reset Email'}
                </span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Student Mode Button */}
        <div className="mt-4 pt-4 border-t border-[#262626]">
          <button
            type="button"
            onClick={() => loginAsGuest('Alex Morgan')}
            className="w-full py-2.5 px-3 rounded-xl bg-[#141414] hover:bg-[#1C1C1C] text-white text-xs font-semibold border border-[#262626] transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles size={14} className="text-white" />
            <span>Continue as Guest Student (Demo)</span>
          </button>
        </div>

        {/* Footer Mode Switchers */}
        <div className="mt-5 text-center text-xs text-[#A1A1AA]">
          {mode === 'signin' && (
            <p>
              Don't have an account?{' '}
              <button
                onClick={() => switchMode('signup')}
                className="text-white hover:underline font-semibold"
              >
                Sign up free
              </button>
            </p>
          )}

          {mode === 'signup' && (
            <p>
              Already have an account?{' '}
              <button
                onClick={() => switchMode('signin')}
                className="text-white hover:underline font-semibold"
              >
                Sign in
              </button>
            </p>
          )}

          {mode === 'forgot' && (
            <p>
              Remember your password?{' '}
              <button
                onClick={() => switchMode('signin')}
                className="text-white hover:underline font-semibold"
              >
                Back to Sign in
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Security badge at bottom */}
      <div className="mt-6 flex items-center gap-1.5 text-[#71717A] text-xs z-10">
        <ShieldCheck size={14} className="text-white" />
        <span>End-to-end encrypted session • Firestore Security Rules enforced</span>
      </div>
    </div>
  );
};
