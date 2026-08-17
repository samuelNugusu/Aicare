import React from 'react';
import { useAuth } from '../firebase/AuthProvider';
import { Loader2 } from 'lucide-react';

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs animate-pulse">
           Authenticating with AiCare Cloud...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      {children}
    </div>
  );
};

export default DashboardLayout;
