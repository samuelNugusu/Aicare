import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ShieldCheck, Zap, HeartPulse } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../firebase/AuthProvider';
import AuthModal from './AuthModal';

export default function Hero() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const handleStart = async () => {
    if (user) {
      navigate('/dashboard');
    } else {
      setIsAuthOpen(true);
    }
  };

  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background patterns */}
      <div className="absolute top-0 right-0 -z-10 opacity-10">
        <div className="w-[600px] h-[600px] rounded-full bg-blue-600 blur-[120px]" />
      </div>
      
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-5">
              <Zap className="w-3.5 h-3.5" />
              Advanced Health Intelligence
            </div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight mb-5">
              AI-Powered <br />
              <span className="text-blue-500">Health Diagnostics</span> <br />
              at Your Fingertips
            </h1>
            
            <p className="text-base sm:text-lg text-gray-300 mb-8 max-w-lg leading-relaxed">
              Upload your lab results and get instant, professional-grade AI analysis. 
              Monitor your health trends and chat with your personal medical assistant 24/7.
            </p>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-8">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStart}
                className="w-full sm:w-auto bg-blue-600 text-white px-7 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30"
              >
                {user ? 'Go to Dashboard' : 'Analyze Your Health Now'}
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </motion.button>
              
              <div className="flex items-center gap-3.5 py-1">
                <div className="flex -space-x-2.5">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-neutral-900 bg-neutral-800 flex items-center justify-center overflow-hidden">
                       <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User" />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm font-bold text-white">10k+ Users</span>
                  <span className="text-[10px] sm:text-xs text-gray-400">Managing health better</span>
                </div>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative mt-4 lg:mt-0"
          >
            <div className="relative z-10 bg-[#0a0a0a] p-5 sm:p-6 rounded-2xl shadow-2xl border border-white/10 transition-colors">
              <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                   <div className="w-10 h-10 bg-blue-500/20 border border-blue-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                     <HeartPulse className="text-blue-400 w-5 h-5" />
                   </div>
                   <div className="min-w-0">
                     <h3 className="font-bold text-sm sm:text-base text-white truncate">Health Overview</h3>
                     <div className="flex items-center gap-1.5 mt-0.5">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                       <p className="text-[10px] sm:text-xs text-gray-400 truncate">Live monitoring enabled</p>
                     </div>
                   </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs font-semibold">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Low Risk</span>
                  </div>
                  <div className="text-right pl-2 sm:border-l sm:border-white/10">
                    <span className="text-lg sm:text-xl font-bold text-white">98%</span>
                    <p className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-400 leading-none">Wellness Score</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                {[
                  { label: "Hemoglobin", value: "14.2", unit: "g/dL", status: "Optimal" },
                  { label: "Cholesterol", value: "185", unit: "mg/dL", status: "Healthy" },
                  { label: "Blood Sugar", value: "92", unit: "mg/dL", status: "Normal" }
                ].map((item, i) => (
                  <div key={i} className="bg-white/5 border border-white/5 p-3 sm:p-3.5 rounded-xl flex items-center justify-between transition-colors">
                    <div>
                      <span className="text-[10px] sm:text-xs text-gray-400 font-medium">{item.label}</span>
                      <p className="font-bold text-sm sm:text-base text-white">{item.value} <span className="text-[10px] text-gray-400 font-normal">{item.unit}</span></p>
                    </div>
                    <span className="text-[9px] sm:text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold uppercase">{item.status}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-5 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 text-blue-400 mb-1">
                   <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                   <span className="text-xs font-semibold uppercase tracking-wider">AI Verified Diagnosis</span>
                </div>
                <p className="text-xs text-gray-400 italic">"Results indicate optimal metabolic health. Maintain current diet."</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </section>
  );
}
