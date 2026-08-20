import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../firebase/AuthProvider';
import { useTheme } from '../utils/ThemeContext';
import { auth } from '../firebase/firebase';
import { signOut } from 'firebase/auth';
import { Activity, LogIn, User as UserIcon, LayoutDashboard, Sun, Moon, Menu, X, Shield, Stethoscope, HeartPulse } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils/utils';
import AuthModal from './AuthModal';

export default function Navbar() {
  const { user, activeRole, setActiveRole, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-amber-100/80 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50';
      case 'DOCTOR':
        return 'bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50';
      default:
        return 'bg-blue-100/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50';
    }
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      navigate('/');
      return;
    }

    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(`/#${id}`);
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  };

  const handleSignOut = () => {
    signOut(auth);
    navigate('/');
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/10 transition-colors duration-300 font-sans not-italic">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20">
            <Activity className="text-white w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="font-bold text-lg sm:text-xl tracking-tight text-white">AiCare</span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-6 lg:gap-8 text-xs lg:text-sm font-semibold text-gray-300">
          <a href="/" onClick={(e) => scrollToSection(e, 'top')} className="hover:text-blue-400 transition-colors">Home</a>
          <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="hover:text-blue-400 transition-colors">Features</a>
          <a href="#assistant" onClick={(e) => scrollToSection(e, 'assistant')} className="hover:text-blue-400 transition-colors">AI Assistant</a>
          {user && (
            <Link to="/dashboard" className="flex items-center gap-1.5 text-blue-400 font-bold hover:opacity-80 transition-opacity">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
          )}
        </div>

        {/* Right Section: Theme Toggle + User Info / Auth */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Admin Perspective Mode Selector Pill */}
          {user && isAdmin && (
            <div className="hidden lg:flex items-center gap-1 bg-white/5 border border-amber-500/30 p-1 rounded-xl">
              <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider px-1.5 flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-400" /> Mode:
              </span>
              {(['ADMIN', 'DOCTOR', 'PATIENT'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setActiveRole(r);
                    navigate('/dashboard');
                  }}
                  className={cn(
                    "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                    activeRole === r 
                      ? (r === 'ADMIN' ? "bg-amber-500 text-black shadow-sm" : r === 'DOCTOR' ? "bg-emerald-500 text-black shadow-sm" : "bg-blue-600 text-white shadow-sm")
                      : "text-gray-400 hover:text-white hover:bg-white/10"
                  )}
                  title={`Switch active perspective to ${r}`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={toggleTheme}
            className="p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* User details (visible on sm+) */}
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-100 max-w-[110px] md:max-w-[140px] truncate">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span className={`text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${getRoleBadgeStyle(activeRole)}`}>
                    {activeRole}
                  </span>
                </div>
                <button 
                  onClick={handleSignOut}
                  className="text-[10px] text-gray-400 hover:text-red-400 font-bold uppercase tracking-wider mt-0.5 transition-colors"
                >
                  Sign Out
                </button>
              </div>

              {/* User Avatar */}
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-white/10 flex-shrink-0 flex items-center justify-center bg-emerald-600 text-white font-bold text-xs sm:text-sm">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span>{(user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}</span>
                )}
              </div>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              id="nav-auth-btn"
              onClick={() => {
                setAuthMode('login');
                setIsAuthOpen(true);
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Get Started</span>
            </motion.button>
          )}

          {/* Mobile Menu Toggle Button */}
          <button 
            className="md:hidden p-2 text-gray-300 hover:bg-white/5 border border-white/10 rounded-xl transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#0a0a0a] border-b border-white/10 overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-6 space-y-4 flex flex-col items-stretch text-center">
              <a 
                href="/" 
                onClick={(e) => scrollToSection(e, 'top')} 
                className="py-2 text-base font-bold text-white hover:text-blue-400"
              >
                Home
              </a>
              <a 
                href="#features" 
                onClick={(e) => scrollToSection(e, 'features')} 
                className="py-2 text-base font-bold text-white hover:text-blue-400"
              >
                Features
              </a>
              <a 
                href="#assistant" 
                onClick={(e) => scrollToSection(e, 'assistant')} 
                className="py-2 text-base font-bold text-white hover:text-blue-400"
              >
                AI Assistant
              </a>
              
              {user ? (
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <Link 
                    to="/dashboard" 
                    onClick={() => setIsMobileMenuOpen(false)} 
                    className="w-full py-3 bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold rounded-xl flex items-center justify-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Open Dashboard
                  </Link>

                  <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl text-left">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center flex-shrink-0">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="Profile" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span>{(user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{user.displayName || user.email}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${getRoleBadgeStyle(activeRole)}`}>{activeRole}</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleSignOut}
                      className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/30 transition-colors flex-shrink-0"
                    >
                      Sign Out
                    </button>
                  </div>

                  {isAdmin && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-left">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" />
                        Admin Perspective Mode:
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['ADMIN', 'DOCTOR', 'PATIENT'] as const).map((r) => (
                          <button
                            key={r}
                            onClick={() => {
                              setActiveRole(r);
                              setIsMobileMenuOpen(false);
                              navigate('/dashboard');
                            }}
                            className={cn(
                              "py-1.5 px-2 rounded-lg text-xs font-bold uppercase tracking-wider text-center transition-all",
                              activeRole === r 
                                ? (r === 'ADMIN' ? "bg-amber-500 text-black" : r === 'DOCTOR' ? "bg-emerald-500 text-black" : "bg-blue-600 text-white")
                                : "bg-white/5 text-gray-400 hover:text-white"
                            )}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-2">
                  <button 
                    type="button"
                    id="mobile-nav-auth-btn"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setAuthMode('login');
                      setIsAuthOpen(true);
                    }}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-colors cursor-pointer text-sm"
                  >
                    <LogIn className="w-4 h-4" />
                    Get Started
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} initialMode={authMode} />
    </nav>
  );
}
