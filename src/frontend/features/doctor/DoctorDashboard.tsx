import React, { useState, useEffect } from 'react';
import { useAuth } from '../../firebase/AuthProvider';
import { collection, query, onSnapshot, where, limit, orderBy, collectionGroup, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { 
  Search, Clipboard, Calendar, MessageSquare, ExternalLink, Activity, Users, 
  AlertCircle, ChevronRight, HeartPulse, BarChart3, PieChart as PieChartIcon, 
  Stethoscope, ShieldCheck, Clock, FileText, CheckCircle2, AlertTriangle, Eye, X, Filter 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PatientDashboard from '../patient/PatientDashboard';
import AnalysisResults from '../lab/AnalysisResults';
import AppointmentsManager from '../appointments/AppointmentsManager';
import { cn } from '../../utils/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const DoctorDashboard: React.FC = () => {
  const { user, roleData, setActiveRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'queue' | 'appointments' | 'patients' | 'analytics'>('queue');
  const [patients, setPatients] = useState<any[]>([]);
  const [labReviews, setLabReviews] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified'>('all');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<any | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [stats, setStats] = useState({ active: 0, performed: 0, verified: 0, pending: 0, failed: 0, helped: 0 });

  useEffect(() => {
    // Fetch patients
    const q = query(collection(db, 'users'), where('role', '==', 'client'), limit(30));
    const unsubscribePatients = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPatients(list);
      setStats(s => ({ ...s, active: list.length }));
    }, (err) => console.warn("Doctor patients listener:", err));

    // Fetch all lab results across all patients for doctor review queue
    const labQ = query(collectionGroup(db, 'lab_results'));
    const unsubscribeLabs = onSnapshot(labQ, (snap) => {
      const labs = snap.docs.map(d => {
        const data = d.data();
        const patientUserId = d.ref.parent.parent?.id || data.userId;
        return {
          id: d.id,
          patientUserId,
          refPath: d.ref.path,
          ...data
        };
      });

      // Sort by upload date descending
      labs.sort((a: any, b: any) => {
        const timeA = a.uploadDate?.toMillis ? a.uploadDate.toMillis() : (a.uploadDate ? new Date(a.uploadDate).getTime() : 0);
        const timeB = b.uploadDate?.toMillis ? b.uploadDate.toMillis() : (b.uploadDate ? new Date(b.uploadDate).getTime() : 0);
        return timeB - timeA;
      });

      setLabReviews(labs);

      const verifiedCount = labs.filter((l: any) => l.status === 'verified').length;
      const pendingCount = labs.filter((l: any) => l.status === 'completed' || l.status === 'pending').length;
      const failedCount = labs.filter((l: any) => l.status === 'failed' || l.status === 'error').length;
      const uniquePatients = new Set(labs.map(l => l.patientUserId).filter(Boolean));

      setStats(s => ({
        ...s,
        performed: labs.length,
        verified: verifiedCount,
        pending: pendingCount,
        failed: failedCount,
        helped: uniquePatients.size
      }));
    }, (error) => {
      console.warn("Doctor Labs CollectionGroup Error:", error);
    });

    return () => {
      unsubscribePatients();
      unsubscribeLabs();
    };
  }, []);

  const handleVerifyLab = async (review: any, notes?: string) => {
    if (!user || !review?.patientUserId) return;
    setIsVerifying(true);
    try {
      const doctorDisplayName = roleData?.displayName || user.displayName || `Dr. ${user.email?.split('@')[0]}`;
      const doctorSpecialty = roleData?.specialty || 'Attending Physician';

      const docPath = `users/${review.patientUserId}/lab_results/${review.id}`;
      await updateDoc(doc(db, docPath), {
        status: 'verified',
        verifiedBy: user.uid,
        performedBy: user.uid,
        verifiedByDoctorId: user.uid,
        verifiedByDoctorName: doctorDisplayName,
        doctorSpecialty: doctorSpecialty,
        doctorNotes: notes || 'Biomarkers verified by attending physician. Findings conform with clinical parameters.',
        verifiedAt: new Date()
      });

      setSelectedReview(null);
    } catch (err) {
      console.error("Verification failed:", err);
    } finally {
      setIsVerifying(false);
    }
  };

  const chartData = [
    { name: 'Verified', value: stats.verified, color: '#10b981' },
    { name: 'Pending Review', value: stats.pending, color: '#3b82f6' },
    { name: 'Anomalies/Errors', value: stats.failed, color: '#ef4444' },
  ];

  const distributionData = [
    { name: 'Verified', value: stats.verified },
    { name: 'Pending', value: stats.pending },
    { name: 'Critical/Other', value: Math.max(stats.failed, 1) },
  ];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

  const filteredPatients = patients.filter(p => 
    p.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredReviews = labReviews.filter(r => {
    const matchesSearch = 
      r.fileName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.patientUserId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'pending') return matchesSearch && (r.status === 'completed' || r.status === 'pending');
    if (statusFilter === 'verified') return matchesSearch && r.status === 'verified';
    return matchesSearch;
  });

  if (selectedPatientId) {
    return (
      <div className="min-h-screen bg-[#050505] text-white transition-all pb-12">
        <div className="max-w-7xl mx-auto py-4 sm:py-8 px-3 sm:px-6">
           <button 
            onClick={() => setSelectedPatientId(null)}
            className="mb-6 flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest hover:-translate-x-1 transition-transform"
           >
            ← Return to Physician Command Center
           </button>
           <PatientDashboard patientId={selectedPatientId} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white transition-colors duration-300 pb-16">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Physician Role Header */}
        <header className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Role Classification: Attending Physician / Medical Doctor
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              Clinical <span className="text-emerald-400">Operations & Diagnostic Review</span>
            </h1>
            <p className="text-gray-400 mt-1 text-xs sm:text-sm">
              Attending: <span className="font-semibold text-gray-200">{roleData?.displayName || user?.displayName || user?.email}</span>
              {roleData?.specialty && <span className="text-emerald-400 font-medium"> • {roleData.specialty}</span>}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-emerald-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search labs & patients..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/40 shadow-sm transition-all text-white placeholder:text-gray-500"
              />
            </div>

            <button
              onClick={() => setActiveRole('PATIENT')}
              className="px-3.5 py-2 bg-[#0a0a0a] border border-white/10 hover:border-emerald-500/40 text-gray-200 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
              title="Preview patient health dashboard"
            >
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              Patient Preview
            </button>
          </div>
        </header>

        {/* Clinical Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <DocStat icon={<Users className="w-4 h-4" />} label="Patient Load" value={stats.active.toString()} color="blue" />
          <DocStat icon={<Clipboard className="w-4 h-4" />} label="Pending Reviews" value={stats.pending.toString()} color="orange" />
          <DocStat icon={<ShieldCheck className="w-4 h-4" />} label="Verified Diags" value={stats.verified.toString()} color="emerald" />
          <DocStat icon={<HeartPulse className="w-4 h-4" />} label="Patients Helped" value={stats.helped.toString()} color="purple" />
          <DocStat icon={<Activity className="w-4 h-4" />} label="Total Reports" value={stats.performed.toString()} color="blue" />
          <DocStat icon={<AlertCircle className="w-4 h-4" />} label="Anomalies" value={stats.failed.toString()} color="red" />
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('queue')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap",
              activeTab === 'queue'
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-400/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Clipboard className="w-3.5 h-3.5" />
            Lab Review Queue ({stats.pending} Pending)
          </button>

          <button
            onClick={() => setActiveTab('appointments')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap",
              activeTab === 'appointments'
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-400/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            Appointments & Consultations
          </button>

          <button
            onClick={() => setActiveTab('patients')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap",
              activeTab === 'patients'
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-400/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Patient Directory ({patients.length})
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap",
              activeTab === 'analytics'
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-400/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Clinical Telemetry
          </button>
        </div>

        {/* TAB 1: LAB REVIEWS QUEUE */}
        {activeTab === 'queue' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0a0a0a] p-4 rounded-2xl border border-white/10 shadow-lg">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-emerald-400" />
                  Clinical Diagnostic Verification Queue
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Review AI parsed blood biomarkers, enter physician clinical notes, and certify lab diagnoses.
                </p>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-400 font-medium mr-1">Filter:</span>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors",
                    statusFilter === 'all' ? "bg-white/15 text-white" : "text-gray-400 hover:bg-white/5"
                  )}
                >
                  All ({labReviews.length})
                </button>
                <button
                  onClick={() => setStatusFilter('pending')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors",
                    statusFilter === 'pending' ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-gray-400 hover:bg-white/5"
                  )}
                >
                  Pending ({stats.pending})
                </button>
                <button
                  onClick={() => setStatusFilter('verified')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors",
                    statusFilter === 'verified' ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "text-gray-400 hover:bg-white/5"
                  )}
                >
                  Verified ({stats.verified})
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              {filteredReviews.map((review, i) => {
                const isVerified = review.status === 'verified';
                const hasCritical = review.analysis?.keyMetrics?.some((m: any) => m.status === 'critical');

                return (
                  <motion.div
                    key={review.id || i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="p-4 sm:p-5 bg-[#0a0a0a] rounded-2xl border border-white/10 shadow-md hover:shadow-xl hover:border-emerald-500/40 hover:bg-white/[0.03] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
                        isVerified 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" 
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                      )}>
                        {isVerified ? <ShieldCheck className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-sm sm:text-base text-white truncate">
                            {review.fileName || 'Blood Panel Submission'}
                          </h4>
                          
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1",
                            isVerified
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          )}>
                            {isVerified ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {isVerified ? 'Physician Verified' : 'Pending Review'}
                          </span>

                          {hasCritical && (
                            <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 text-[10px] font-bold uppercase tracking-wider rounded-md border border-rose-500/30 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Critical Biomarker
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-1">
                          <span>Patient ID: <span className="font-mono text-gray-300">{review.patientUserId?.slice(0, 10)}...</span></span>
                          <span>•</span>
                          <span>{review.uploadDate?.toDate ? new Date(review.uploadDate.toDate()).toLocaleDateString() : 'Recent'}</span>
                          {review.analysis?.keyMetrics && (
                            <>
                              <span>•</span>
                              <span>{review.analysis.keyMetrics.length} Biomarkers Analyzed</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-end md:self-center">
                      <button
                        onClick={() => setSelectedReview(review)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm",
                          isVerified
                            ? "bg-white/10 text-gray-200 hover:bg-white/20"
                            : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/30"
                        )}
                      >
                        {isVerified ? <Eye className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                        {isVerified ? 'View Certified Report' : 'Review & Certify'}
                      </button>

                      {review.patientUserId && (
                        <button
                          onClick={() => setSelectedPatientId(review.patientUserId)}
                          className="p-2 bg-white/5 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 rounded-xl transition-all"
                          title="Open full patient health hub"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {filteredReviews.length === 0 && (
                <div className="text-center py-16 bg-[#0a0a0a] rounded-2xl border-2 border-dashed border-white/10">
                  <Clipboard className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400 font-medium text-xs">No lab reports found matching this criteria.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: APPOINTMENTS & CONSULTATIONS */}
        {activeTab === 'appointments' && (
          <AppointmentsManager mode="doctor" />
        )}

        {/* TAB 3: PATIENTS DIRECTORY */}
        {activeTab === 'patients' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-bold text-base sm:text-lg text-white">
                Assigned Clinical Patient Registry
              </h3>
              <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full uppercase tracking-wider border border-emerald-500/30">
                {filteredPatients.length} Active Patients
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredPatients.map((p, i) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  key={p.id} 
                  onClick={() => setSelectedPatientId(p.id)}
                  className="p-4 bg-[#0a0a0a] rounded-2xl border border-white/10 shadow-md hover:shadow-xl hover:border-emerald-500/40 hover:bg-white/[0.03] transition-all flex items-center justify-between gap-4 group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shadow-inner overflow-hidden border border-emerald-500/30">
                        {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : <Users className="w-5 h-5" />}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-neutral-900 bg-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                        {p.displayName || 'Patient Member'}
                      </h4>
                      <p className="text-[10px] sm:text-xs text-gray-400 font-mono truncate mt-0.5">{p.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span className="hidden sm:inline-block text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Open Charts →
                    </span>
                    <div className="p-2 bg-white/5 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-white" />
                    </div>
                  </div>
                </motion.div>
              ))}

              {filteredPatients.length === 0 && (
                <div className="col-span-2 text-center py-12 bg-[#0a0a0a] rounded-2xl border-2 border-dashed border-white/10">
                  <p className="text-gray-400 font-medium text-xs">No matching patient profiles found.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CLINICAL ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
             <div className="bg-[#0a0a0a] p-5 sm:p-6 rounded-2xl border border-white/10 shadow-xl">
               <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                 <BarChart3 className="w-4 h-4 text-emerald-400" />
                 Diagnostic Review Ratio
               </h3>
               <div className="h-56 sm:h-64 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                     <XAxis dataKey="name" stroke="#ffffff60" fontSize={11} fontWeight="600" tickLine={false} axisLine={false} />
                     <YAxis stroke="#ffffff60" fontSize={11} fontWeight="600" tickLine={false} axisLine={false} />
                     <Tooltip contentStyle={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: '#fff', fontSize: '11px' }} />
                     <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                       {chartData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               </div>
             </div>

             <div className="bg-[#0a0a0a] p-5 sm:p-6 rounded-2xl border border-white/10 shadow-xl">
               <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                 <PieChartIcon className="w-4 h-4 text-purple-400" />
                 Verification & Triage Breakdown
               </h3>
               <div className="h-56 sm:h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distributionData}
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {distributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#141414', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: '#fff', fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
               </div>
             </div>
          </div>
        )}

      </div>

      {/* Review & Certify Modal */}
      <AnimatePresence>
        {selectedReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReview(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0a0a0a] border border-white/15 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl text-white"
            >
              <button 
                onClick={() => setSelectedReview(null)}
                className="absolute top-5 right-5 p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="mb-6">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <Stethoscope className="w-4 h-4" />
                  Physician Diagnostic Clinical Assessment
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {selectedReview.fileName}
                </h2>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <div className="text-xs text-gray-400">
                    Patient User ID: {selectedReview.patientUserId}
                  </div>
                  <div className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
                    selectedReview.status === 'verified' ? "bg-emerald-500 text-white" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  )}>
                    {selectedReview.status === 'verified' ? 'Verified' : 'Pending Certification'}
                  </div>
                </div>
              </div>

              {selectedReview.analysis ? (
                <AnalysisResults 
                  data={selectedReview.analysis} 
                  isDoctor={true}
                  status={selectedReview.status}
                  verifiedByDoctorName={selectedReview.verifiedByDoctorName}
                  doctorSpecialty={selectedReview.doctorSpecialty}
                  doctorNotes={selectedReview.doctorNotes}
                  verifiedAt={selectedReview.verifiedAt}
                  onVerify={(notes) => handleVerifyLab(selectedReview, notes)}
                  isVerifying={isVerifying}
                />
              ) : (
                <div className="p-8 text-center text-gray-400">Analysis data is processing.</div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DocStat = ({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) => {
  const colors: any = {
    blue: 'bg-blue-600 text-white',
    purple: 'bg-purple-600 text-white',
    emerald: 'bg-emerald-600 text-white',
    orange: 'bg-amber-500 text-white',
    red: 'bg-red-600 text-white'
  };
  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0a0a0a] border border-white/10 shadow-md group hover:border-white/20 transition-all">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 shadow-sm ${colors[color] || colors.blue}`}>
        {icon}
      </div>
      <div className="text-lg sm:text-xl font-bold text-white tracking-tight mb-0.5">{value}</div>
      <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{label}</div>
    </div>
  );
};

export default DoctorDashboard;
