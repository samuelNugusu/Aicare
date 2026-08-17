/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import LabUpload from './features/lab/LabUpload';
import ChatAssistant from './features/chat/ChatAssistant';
import Footer from './components/Footer';
import AdminDashboard from './features/admin/AdminDashboard';
import DoctorDashboard from './features/doctor/DoctorDashboard';
import PatientDashboard from './features/patient/PatientDashboard';
import DashboardLayout from './components/DashboardLayout';
import AuthModal from './components/AuthModal';
import { useAuth } from './firebase/AuthProvider';
import { motion, useScroll, useSpring } from 'motion/react';
import { Activity, ArrowRight } from 'lucide-react';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return <Navigate to="/" />;

  return <>{children}</>;
};

const DashboardRouter = () => {
  const { user, activeRole, loading } = useAuth();
  
  if (loading) return null; // Handled by DashboardLayout wrapper

  if (!user) return <Navigate to="/" />;

  if (activeRole === 'ADMIN') return <AdminDashboard />;
  if (activeRole === 'DOCTOR') return <DoctorDashboard />;
  return <PatientDashboard />;
};

export default function App() {
  const { user } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const handleCtaClick = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      setIsAuthOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 selection:bg-blue-600/30 transition-colors duration-300">
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-blue-600 origin-left z-[60]"
        style={{ scaleX }}
      />
      
      <Navbar />
      
      <main className="pt-16">
        <Routes>
          <Route path="/" element={
            <>
              <Hero />
              <Features />
              
              <div id="how-it-works" className="py-14 sm:py-20 bg-[#050505] border-y border-white/5 transition-colors">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                   <div className="text-center mb-10 sm:mb-14">
                      <span className="text-blue-400 font-semibold uppercase tracking-wider text-xs">Workflow</span>
                      <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2 mb-3 tracking-tight">How AiCare Works</h2>
                   </div>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                     {[
                       { step: "01", title: "Upload Results", desc: "Scan or upload your physical lab documents securely." },
                       { step: "02", title: "AI Analysis", desc: "Our engine parses every marker and explains the data." },
                       { step: "03", title: "Get Recommendations", desc: "Receive personalized health advice based on your biology." },
                       { step: "04", title: "Chat with AI", desc: "Ask follow-up questions to your personal assistant." }
                     ].map((item, i) => (
                       <div key={i} className="relative p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10 group hover:border-blue-500/30 hover:bg-white/[0.05] hover:shadow-lg transition-all">
                          <span className="text-2xl sm:text-3xl font-bold text-blue-500/20 absolute top-4 right-5 group-hover:text-blue-400/40 transition-colors">{item.step}</span>
                          <h3 className="text-base sm:text-lg font-bold text-white mb-2 relative z-10">{item.title}</h3>
                          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed relative z-10">{item.desc}</p>
                       </div>
                     ))}
                   </div>
                </div>
              </div>

              <div id="assistant">
                <ChatAssistant />
              </div>

              {/* Ready to Take Control Section */}
              <section className="py-14 sm:py-20 bg-blue-600 dark:bg-blue-700 relative overflow-hidden transition-colors">
                 <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-white blur-[100px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-white blur-[100px] translate-x-1/2 translate-y-1/2 rounded-full" />
                 </div>
                 
                 <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3.5 tracking-tight">
                      Ready to Take Control of Your Health?
                    </h2>
                    <p className="text-blue-100 mb-7 sm:mb-8 text-sm sm:text-base opacity-90 max-w-xl mx-auto leading-relaxed">
                      Join thousands of users making data-driven decisions about their wellness. 
                      Start your free AI health analysis today.
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleCtaClick}
                      className="w-full sm:w-auto bg-white text-blue-600 dark:text-blue-700 px-7 sm:px-9 py-3 sm:py-3.5 rounded-xl font-bold text-sm sm:text-base shadow-lg shadow-blue-900/20 hover:bg-blue-50 transition-all inline-flex items-center justify-center gap-2"
                    >
                      {user ? 'Open Your Dashboard' : 'Get Started for Free'}
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </motion.button>
                 </div>
              </section>
            </>
          } />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout>
                <DashboardRouter />
              </DashboardLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </main>
      
      <Footer />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}

