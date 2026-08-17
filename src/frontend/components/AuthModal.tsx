import React, { useState } from 'react';
import { Mail, Lock, User, Chrome, ArrowRight, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithGoogle, registerWithEmail, loginWithEmail } from '../firebase/firebase';
import { useNavigate } from 'react-router-dom';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md bg-[#0a0a0a] rounded-2xl shadow-2xl overflow-hidden border border-white/10 max-h-[90vh] overflow-y-auto"
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 sm:p-8">
            <header className="mb-6 text-center">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {mode === 'login' ? 'Welcome Back' : 'Create Patient Account'}
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm mt-1">
                {mode === 'login' 
                  ? 'Access your clinical health dashboard and medical history.' 
                  : 'Register for personalized AI health diagnostics and doctor consultations.'}
              </p>
            </header>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 text-red-400 text-xs font-medium rounded-xl border border-red-500/20">
                {error}
              </div>
            )}

            {mode === 'register' && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed text-blue-200">
                  <span className="font-semibold">Role-Based Access Notice:</span> New accounts are registered with the <span className="font-bold">Patient</span> role. Doctor and Admin credentials are provisioned by hospital administration.
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'register' && (
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Full Name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-white placeholder:text-gray-500"
                  />
                </div>
              )}
              
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  placeholder="Email Address"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-white placeholder:text-gray-500"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  placeholder="Password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-white placeholder:text-gray-500"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2 shadow-lg shadow-blue-600/20"
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
              onClick={handleGoogle}
              disabled={loading}
              className="w-full py-2.5 bg-white/5 border border-white/10 text-gray-200 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 hover:bg-white/10 transition-all shadow-sm"
            >
              <Chrome className="w-4 h-4 text-[#4285F4]" />
              Google Account
            </button>

            <p className="mt-5 text-center text-xs text-gray-400 font-medium">
              {mode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
              <button
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-blue-400 font-semibold uppercase text-xs tracking-wider hover:underline ml-1"
              >
                {mode === 'login' ? 'Join AiCare' : 'Sign In'}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

