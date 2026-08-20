import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Mail, Lock, User, Chrome, ArrowRight, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithGoogle, registerWithEmail, loginWithEmail } from '../firebase/firebase';
import { useNavigate } from 'react-router-dom';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
      // Prevent background scrolling when modal is open
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      onClose();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'register') {
        // Enforces PATIENT role by default on all public registrations
        await registerWithEmail(email, password, name);
      } else {
        await loginWithEmail(email, password);
      }
      onClose();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || `Failed to ${mode}`);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div 
          id="auth-modal-root"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {/* Dark Blurred Backdrop */}
          <motion.div 
            id="auth-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          
          {/* Centered Modal Box */}
          <motion.div 
            id="auth-modal-dialog"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="relative w-full max-w-md bg-[#0a0a0a] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-white/15 my-auto text-left z-10 max-h-[90vh] flex flex-col"
          >
            {/* Close button */}
            <button 
              id="auth-modal-close-btn"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors z-20 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Scrollable Form Content */}
            <div className="p-5 sm:p-8 overflow-y-auto flex-1">
              {/* Centered Brand Header */}
              <header className="mb-5 text-center pr-6 pl-6">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-gray-400 text-xs sm:text-sm mt-1 leading-relaxed">
                  {mode === 'login' 
                    ? 'Access your clinical health diagnostics and records.' 
                    : 'Register for personalized AI diagnostics and consultations.'}
                </p>
              </header>

              {/* Mode Toggle Tabs */}
              <div className="grid grid-cols-2 p-1 bg-white/5 border border-white/10 rounded-xl mb-5">
                <button
                  type="button"
                  id="auth-tab-login"
                  onClick={() => { setMode('login'); setError(''); }}
                  className={`py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all text-center cursor-pointer ${
                    mode === 'login' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  id="auth-tab-register"
                  onClick={() => { setMode('register'); setError(''); }}
                  className={`py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition-all text-center cursor-pointer ${
                    mode === 'register' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Register
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 text-red-400 text-xs font-medium rounded-xl border border-red-500/20 text-center">
                  {error}
                </div>
              )}

              {mode === 'register' && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed text-blue-200">
                    <span className="font-semibold">Patient Account:</span> New registrations default to the <span className="font-bold">Patient</span> role.
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === 'register' && (
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="auth-name-input"
                      type="text"
                      placeholder="Full Name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-white placeholder:text-gray-500"
                    />
                  </div>
                )}
                
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="auth-email-input"
                    type="email"
                    placeholder="Email Address"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-white placeholder:text-gray-500"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="auth-password-input"
                    type="password"
                    placeholder="Password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-white placeholder:text-gray-500"
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  disabled={loading}
                  id="auth-submit-btn"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-3 shadow-lg shadow-blue-600/25 cursor-pointer"
                >
                  {loading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Create Patient Account')}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </motion.button>
              </form>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-semibold text-gray-400 tracking-wider">
                  <span className="bg-[#0a0a0a] px-3">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                id="auth-google-btn"
                onClick={handleGoogle}
                disabled={loading}
                className="w-full py-2.5 sm:py-3 bg-white/5 border border-white/10 text-gray-200 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 hover:bg-white/10 transition-all shadow-sm cursor-pointer"
              >
                <Chrome className="w-4 h-4 text-[#4285F4]" />
                Google Account
              </button>

              <p className="mt-5 text-center text-xs text-gray-400 font-medium">
                {mode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login');
                    setError('');
                  }}
                  className="text-blue-400 font-bold uppercase text-xs tracking-wider hover:underline ml-1 cursor-pointer"
                >
                  {mode === 'login' ? 'Register Now' : 'Sign In'}
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}

