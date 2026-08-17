import React, { useState, useEffect } from 'react';
import { useAuth } from '../../firebase/AuthProvider';
import { 
  Users, Shield, Settings, Activity, LayoutGrid, HeartPulse, 
  MoreHorizontal, UserPlus, Trash2, X, BarChart3, PieChart as PieChartIcon, 
  AlertCircle, ShieldCheck, ChevronRight, Search, TrendingUp, CheckCircle2,
  Stethoscope, Eye, Calendar, Key, Check, Server, Lock, Cpu, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PatientDashboard from '../patient/PatientDashboard';
import DoctorDashboard from '../doctor/DoctorDashboard';
import AppointmentsManager from '../appointments/AppointmentsManager';
import { cn } from '../../utils/utils';
import { db } from '../../firebase/firebase';
import { 
  collection, query, onSnapshot, doc, updateDoc, 
  deleteDoc, setDoc, collectionGroup, orderBy 
} from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { ADMIN_EMAILS, normalizeRole, isAdminEmail } from '../../../shared/types';

interface UserData {
  id: string;
  displayName: string;
  name?: string;
  email: string;
  role: string;
  specialty?: string;
  licenseNumber?: string;
  createdAt?: any;
}

const AdminDashboard: React.FC = () => {
  const { user, setActiveRole } = useAuth();
  const [view, setView] = useState<'admin' | 'doctor' | 'patient'>('admin');
  const [adminTab, setAdminTab] = useState<'overview' | 'users' | 'doctors' | 'patients' | 'appointments' | 'system'>('overview');
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState({ total: 0, doctors: 0, clients: 0, admins: 0 });
  const [diagnosisStats, setDiagnosisStats] = useState({ completed: 0, verified: 0, failed: 0, total: 0 });
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [selectedDoctorForEdit, setSelectedDoctorForEdit] = useState<UserData | null>(null);
  const [editingSpecialty, setEditingSpecialty] = useState('');
  const [selectedPatientForInspect, setSelectedPatientForInspect] = useState<string | null>(null);

  const [newUser, setNewUser] = useState({ 
    email: '', 
    name: '', 
    role: 'PATIENT',
    specialty: 'General Practice'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'DOCTOR' | 'PATIENT'>('ALL');

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(q, (snap) => {
      const userList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserData));
      setUsers(userList);
      
      const counts = userList.reduce((acc, u) => {
        const norm = normalizeRole(u.role, u.email);
        if (norm === 'DOCTOR') acc.doctors++;
        else if (norm === 'ADMIN') acc.admins++;
        else acc.clients++;
        acc.total++;
        return acc;
      }, { total: 0, doctors: 0, clients: 0, admins: 0 });
      setStats(counts);
    }, (error) => {
      console.error("Admin Users Fetch Error:", error);
    });

    const labQ = query(collectionGroup(db, 'lab_results'));
    const unsubscribeLabs = onSnapshot(labQ, (snap) => {
      const labCounts = snap.docs.reduce((acc, doc) => {
        const status = doc.data().status;
        if (status === 'completed') acc.completed++;
        else if (status === 'verified') acc.verified++;
        else if (status === 'failed' || status === 'error') acc.failed++;
        acc.total++;
        return acc;
      }, { completed: 0, verified: 0, failed: 0, total: 0 });
      setDiagnosisStats(labCounts);
    }, (error) => {
      console.warn("Admin Labs Snapshot Error:", error);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeLabs();
    };
  }, []);

  const handleUpdateRole = async (userId: string, userEmail: string, newRole: string) => {
    const isWhitelisted = isAdminEmail(userEmail);
    if (isWhitelisted && newRole !== 'ADMIN') {
      alert("Notice: This account is permanently whitelisted as a System Administrator and cannot be demoted.");
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), { 
        role: newRole,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to update role:", err);
    }
  };

  const handleSaveDoctorSpecialty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorForEdit) return;
    try {
      await updateDoc(doc(db, 'users', selectedDoctorForEdit.id), {
        specialty: editingSpecialty
      });
      setSelectedDoctorForEdit(null);
    } catch (err) {
      console.error("Failed to update doctor specialty:", err);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (isAdminEmail(userEmail)) {
      alert("Cannot delete designated System Administrator account.");
      return;
    }

    if (!window.confirm(`Are you sure you want to terminate account access for ${userEmail}?`)) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (err) {
      console.error("Failed to delete user:", err);
    }
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.name) return;
    const tempUid = `id_${Date.now()}`;
    const cleanEmail = newUser.email.trim().toLowerCase();
    const finalRole = isAdminEmail(cleanEmail) ? 'ADMIN' : newUser.role;

    try {
      await setDoc(doc(db, 'users', tempUid), {
        email: cleanEmail,
        displayName: newUser.name,
        name: newUser.name,
        role: finalRole,
        specialty: finalRole === 'DOCTOR' ? (newUser.specialty || 'General Practice') : undefined,
        createdAt: new Date().toISOString()
      });
      setShowProvisionModal(false);
      setNewUser({ email: '', name: '', role: 'PATIENT', specialty: 'General Practice' });
    } catch (err) {
      console.error("Provisioning failed:", err);
    }
  };

  const filteredUsers = users.filter(u => {
    const norm = normalizeRole(u.role, u.email);
    const matchesSearch = 
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (roleFilter === 'ALL') return matchesSearch;
    return matchesSearch && norm === roleFilter;
  });

  const doctorsList = users.filter(u => normalizeRole(u.role, u.email) === 'DOCTOR');
  const patientsList = users.filter(u => normalizeRole(u.role, u.email) === 'PATIENT');

  const chartData = [
    { name: 'Verified', value: diagnosisStats.verified, color: '#10B981' },
    { name: 'Pending Review', value: diagnosisStats.completed, color: '#3B82F6' },
    { name: 'Errors/Failed', value: diagnosisStats.failed, color: '#F43F5E' },
  ];

  const pieData = [
    { name: 'Patients', value: stats.clients, color: '#3B82F6' },
    { name: 'Doctors', value: stats.doctors, color: '#10B981' },
    { name: 'Admins', value: stats.admins, color: '#F59E0B' },
  ];

  if (selectedPatientForInspect) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-8">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => setSelectedPatientForInspect(null)}
            className="mb-6 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2 transition-all"
          >
            ← Return to Master Admin Command
          </button>
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 sm:p-6 border border-white/10">
            <PatientDashboard patientId={selectedPatientForInspect} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-600/30 overflow-x-hidden font-sans pb-16">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none opacity-40">
        <div className="absolute top-0 left-0 w-full h-[350px] sm:h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent" />
        <div className="absolute top-1/4 -right-20 w-64 sm:w-96 h-64 sm:h-96 bg-purple-600/10 blur-[100px] sm:blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 -left-20 w-64 sm:w-96 h-64 sm:h-96 bg-blue-600/10 blur-[100px] sm:blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 relative z-10">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-semibold tracking-wider text-[11px] sm:text-xs uppercase mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Role Classification: System Administrator (Global Governance)
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              Hospital <span className="text-blue-500">Administration & RBAC Governance</span>
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Logged in as Master Administrator: <span className="font-mono text-gray-300">{user?.email}</span>
            </p>
          </div>

          {/* Perspective Switcher for Testing */}
          <nav 
            aria-label="Role perspective switcher"
            className="w-full lg:w-auto p-1 sm:p-1.5 bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/10 shadow-lg shadow-black/40"
          >
            <div className="grid grid-cols-3 gap-1 sm:gap-1.5 lg:flex lg:items-center">
              <button 
                onClick={() => setView('admin')}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 min-h-[40px] rounded-lg sm:rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                  view === 'admin' 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/30" 
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Admin View</span>
              </button>

              <button 
                onClick={() => setView('doctor')}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 min-h-[40px] rounded-lg sm:rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                  view === 'doctor' 
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/30" 
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Doctor View</span>
              </button>

              <button 
                onClick={() => setView('patient')}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 min-h-[40px] rounded-lg sm:rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                  view === 'patient' 
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30 border border-rose-400/30" 
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <HeartPulse className="w-3.5 h-3.5" />
                <span>Patient View</span>
              </button>
            </div>
          </nav>
        </header>

        <AnimatePresence mode="wait">
          {view === 'admin' ? (
            <motion.div
              key="admin-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6 sm:space-y-8"
            >
              {/* Admin Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
                {([
                  { id: 'overview', label: 'Telemetry & Stats', icon: BarChart3 },
                  { id: 'users', label: `User Governance (${users.length})`, icon: Users },
                  { id: 'doctors', label: `Doctor Registry (${doctorsList.length})`, icon: Stethoscope },
                  { id: 'patients', label: `Patient Directory (${patientsList.length})`, icon: HeartPulse },
                  { id: 'appointments', label: 'Consultations Schedule', icon: Calendar },
                  { id: 'system', label: 'RBAC Security & System Config', icon: Lock },
                ] as const).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = adminTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setAdminTab(tab.id)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap",
                        isActive 
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" 
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: OVERVIEW */}
              {adminTab === 'overview' && (
                <div className="space-y-6">
                  {/* Real-time Stat Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <StatCard icon={<Users />} label="Total Registered" value={stats.total.toString()} sub="Verified Entities" color="blue" />
                    <StatCard icon={<Shield />} label="Clinical Doctors" value={stats.doctors.toString()} sub="Licensed Attending" color="emerald" />
                    <StatCard icon={<Activity />} label="Diagnostics" value={diagnosisStats.total.toString()} sub="Lab Submissions" color="purple" />
                    <StatCard icon={<TrendingUp />} label="Verification Efficacy" value={`${Math.round((diagnosisStats.verified / (diagnosisStats.total || 1)) * 100)}%`} sub="Doctor Review Rate" color="blue" />
                  </div>

                  {/* Visual Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div className="lg:col-span-2 bg-white/[0.03] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl">
                      <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <h3 className="text-sm sm:text-base font-bold tracking-tight flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-blue-500" />
                          Diagnostic Review Distribution
                        </h3>
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Live Stream
                        </span>
                      </div>
                      <div className="h-48 sm:h-60 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                            <XAxis dataKey="name" stroke="#ffffff50" fontSize={11} axisLine={false} tickLine={false} />
                            <YAxis stroke="#ffffff50" fontSize={11} axisLine={false} tickLine={false} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff15', borderRadius: '10px', fontSize: '11px', color: '#fff' }}
                            />
                            <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                              {chartData.map((entry, index) => (
                                <Cell key={`bar-${index}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl">
                      <h3 className="text-sm sm:text-base font-bold tracking-tight mb-4 flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4 text-purple-400" />
                        Role Distribution
                      </h3>
                      <div className="h-44 sm:h-52 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              innerRadius={48}
                              outerRadius={70}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff15', borderRadius: '10px', fontSize: '11px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                          <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
                          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Total Accounts</div>
                        </div>
                      </div>
                      <div className="space-y-1.5 mt-3">
                        {pieData.map((item) => (
                          <div key={item.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-xs text-gray-400">{item.name}</span>
                            </div>
                            <span className="font-semibold">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: USER GOVERNANCE */}
              {adminTab === 'users' && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
                  <div className="p-4 sm:p-6 border-b border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold tracking-tight">Role-Based Access Control Governance</h2>
                      <p className="text-xs text-gray-400 mt-0.5">Assign, promote, or restrict roles: PATIENT, DOCTOR, or ADMIN.</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Filter by role */}
                      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl text-xs">
                        {(['ALL', 'PATIENT', 'DOCTOR', 'ADMIN'] as const).map((r) => (
                          <button
                            key={r}
                            onClick={() => setRoleFilter(r)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg font-semibold transition-all",
                              roleFilter === r ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                            )}
                          >
                            {r}
                          </button>
                        ))}
                      </div>

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <input 
                          type="text"
                          placeholder="Search users..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-xl py-2 pl-8 pr-3 text-xs font-medium focus:outline-none focus:border-blue-500 transition-all placeholder:text-gray-500 w-48 sm:w-60"
                        />
                      </div>
                      
                      <button 
                        onClick={() => setShowProvisionModal(true)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold text-xs uppercase tracking-wider hover:bg-blue-700 transition-all shadow-md active:scale-95 flex-shrink-0"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Provision Account
                      </button>
                    </div>
                  </div>

                  {/* Table View */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/5 text-xs font-semibold uppercase tracking-wider text-gray-400 bg-white/[0.01]">
                          <th className="px-5 py-3.5">User Identity Profile</th>
                          <th className="px-5 py-3.5">Current Role Classification</th>
                          <th className="px-5 py-3.5">Account ID</th>
                          <th className="px-5 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs">
                        {filteredUsers.map((u) => {
                          const norm = normalizeRole(u.role, u.email);
                          const isWhitelistedAdmin = isAdminEmail(u.email);

                          return (
                            <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                                    {(u.displayName || u.name)?.[0]?.toUpperCase() || '?'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-white truncate max-w-[200px] flex items-center gap-1.5">
                                      {u.displayName || u.name || 'User Member'}
                                      {isWhitelistedAdmin && (
                                        <span className="px-1.5 py-0.2 bg-amber-400/20 text-amber-300 text-[9px] rounded font-mono font-bold">
                                          PRIMARY ADMIN
                                        </span>
                                      )}
                                    </div>
                                    <div className="font-mono text-gray-500 truncate max-w-[200px]">{u.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                {isWhitelistedAdmin ? (
                                  <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg font-bold text-[11px] uppercase tracking-wider">
                                    ADMIN (Whitelisted)
                                  </span>
                                ) : (
                                  <select 
                                    value={norm}
                                    onChange={(e) => handleUpdateRole(u.id, u.email, e.target.value)}
                                    className={cn(
                                      "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer outline-none hover:border-blue-500/50 transition-all",
                                      norm === 'ADMIN' ? "text-amber-400 border-amber-400/30" :
                                      norm === 'DOCTOR' ? "text-emerald-400 border-emerald-400/30" :
                                      "text-blue-400 border-blue-400/30"
                                    )}
                                  >
                                    <option value="PATIENT" className="bg-[#0a0a0a]">PATIENT (Standard User)</option>
                                    <option value="DOCTOR" className="bg-[#0a0a0a]">DOCTOR (Attending Medic)</option>
                                    <option value="ADMIN" className="bg-[#0a0a0a]">ADMIN (Administrator)</option>
                                  </select>
                                )}
                              </td>
                              <td className="px-5 py-3.5 font-mono text-gray-500 truncate max-w-[120px]">{u.id}</td>
                              <td className="px-5 py-3.5 text-right">
                                <button 
                                  onClick={() => handleDeleteUser(u.id, u.email)}
                                  disabled={isWhitelistedAdmin}
                                  className={cn(
                                    "p-2 rounded-lg transition-all",
                                    isWhitelistedAdmin ? "text-gray-700 cursor-not-allowed" : "hover:bg-rose-500/10 text-gray-500 hover:text-rose-400"
                                  )}
                                  title={isWhitelistedAdmin ? "Whitelisted admin cannot be deleted" : "Delete Record"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: DOCTOR MANAGEMENT */}
              {adminTab === 'doctors' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Stethoscope className="w-5 h-5 text-emerald-500" />
                        Clinical Doctor Staff & Specialty Credentials
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">Manage physician credentials, assigned department specialties, and consultation permissions.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {doctorsList.map((docItem) => (
                      <div key={docItem.id} className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-lg flex-shrink-0">
                            {(docItem.displayName || docItem.name)?.[0]?.toUpperCase() || 'D'}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-white truncate">{docItem.displayName || docItem.name || 'Dr. Attending'}</h4>
                            <p className="text-xs text-gray-400 font-mono truncate">{docItem.email}</p>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-900/40 text-emerald-300 border border-emerald-700/40 rounded text-[10px] font-bold uppercase">
                              {docItem.specialty || 'General Practitioner'}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                          <span className="text-xs text-gray-500">Clinical Verification Rights: Active</span>
                          <button
                            onClick={() => {
                              setSelectedDoctorForEdit(docItem);
                              setEditingSpecialty(docItem.specialty || 'Cardiology & Internal Medicine');
                            }}
                            className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold"
                          >
                            Edit Specialty
                          </button>
                        </div>
                      </div>
                    ))}

                    {doctorsList.length === 0 && (
                      <div className="col-span-3 text-center py-12 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                        <p className="text-gray-400 text-xs">No doctors currently registered. Promote a user to DOCTOR in the User Governance tab.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: PATIENT DIRECTORY */}
              {adminTab === 'patients' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <HeartPulse className="w-5 h-5 text-blue-500" />
                        Patient Medical Records & Vitals Oversight
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">Inspect patient health metrics, biometric trend tracking, and diagnostic submissions.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {patientsList.map((p) => (
                      <div key={p.id} className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl space-y-4 hover:border-blue-500/30 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-sm flex-shrink-0">
                              {(p.displayName || p.name)?.[0]?.toUpperCase() || 'P'}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm text-white truncate">{p.displayName || p.name || 'Patient'}</h4>
                              <p className="text-xs text-gray-400 font-mono truncate">{p.email}</p>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                          <span className="text-[11px] text-gray-500 font-mono">ID: {p.id.substring(0, 10)}...</span>
                          <button
                            onClick={() => setSelectedPatientForInspect(p.id)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Health Hub
                          </button>
                        </div>
                      </div>
                    ))}

                    {patientsList.length === 0 && (
                      <div className="col-span-3 text-center py-12 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                        <p className="text-gray-400 text-xs">No patients registered in database.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: APPOINTMENTS */}
              {adminTab === 'appointments' && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-6">
                  <AppointmentsManager mode="admin" />
                </div>
              )}

              {/* TAB 6: SYSTEM SECURITY & RBAC CONFIG */}
              {adminTab === 'system' && (
                <div className="space-y-6">
                  {/* Whitelist Banner */}
                  <div className="p-6 bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/30 rounded-2xl">
                    <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm uppercase tracking-wider mb-2">
                      <ShieldCheck className="w-5 h-5" />
                      Authorized System Administrator Whitelist
                    </div>
                    <p className="text-xs text-gray-300 mb-4 max-w-2xl">
                      The following designated accounts are granted immutable, top-level administrative authority. New accounts default to PATIENT unless explicitly matching this whitelist or upgraded by an admin:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {ADMIN_EMAILS.map((email) => (
                        <div key={email} className="p-3 bg-black/40 border border-amber-500/20 rounded-xl flex items-center gap-2.5">
                          <Key className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <span className="text-xs font-mono text-amber-200 font-bold truncate">{email}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Security Architecture Status */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4" />
                        Backend Firestore Rules
                      </div>
                      <h4 className="font-bold text-sm text-white">Rule Enforced RBAC</h4>
                      <p className="text-xs text-gray-400">
                        Admin email whitelist and user role verification baked directly into `firestore.rules`.
                      </p>
                    </div>

                    <div className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                        <Server className="w-4 h-4" />
                        Default Registration Policy
                      </div>
                      <h4 className="font-bold text-sm text-white">New User → PATIENT</h4>
                      <p className="text-xs text-gray-400">
                        Zero self-elevation vulnerabilities. All new signups automatically enter as Patients.
                      </p>
                    </div>

                    <div className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
                        <Cpu className="w-4 h-4" />
                        AI Lab Diagnostics
                      </div>
                      <h4 className="font-bold text-sm text-white">Gemini 2.5 Engine</h4>
                      <p className="text-xs text-gray-400">
                        Server-side lab analysis proxy with strict doctor verification workflow.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : view === 'doctor' ? (
            <motion.div
              key="doctor-simulation"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-emerald-400 font-semibold uppercase tracking-wider text-xs px-1">
                <Stethoscope className="w-4 h-4" />
                Admin Simulation: Attending Physician Terminal
              </div>
              <div className="rounded-2xl border border-white/10 overflow-hidden bg-gray-900">
                <DoctorDashboard />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="patient-simulation"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-rose-500 font-semibold uppercase tracking-wider text-xs px-1">
                <AlertCircle className="w-4 h-4" />
                Admin Simulation: Patient Health Hub
              </div>
              <div className="bg-white dark:bg-gray-950 rounded-2xl border border-white/10 overflow-hidden">
                <PatientDashboard />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Edit Doctor Specialty Modal */}
      <AnimatePresence>
        {selectedDoctorForEdit && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDoctorForEdit(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <button
                onClick={() => setSelectedDoctorForEdit(null)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-bold text-white mb-1">Edit Doctor Specialty</h3>
              <p className="text-xs text-gray-400 mb-4">{selectedDoctorForEdit.displayName || selectedDoctorForEdit.email}</p>

              <form onSubmit={handleSaveDoctorSpecialty} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Specialty / Department</label>
                  <input
                    type="text"
                    required
                    value={editingSpecialty}
                    onChange={(e) => setEditingSpecialty(e.target.value)}
                    placeholder="e.g. Cardiology, Hematology, General Practice"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-medium focus:outline-none focus:border-emerald-500 text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Save Specialty Credentials
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Provision Modal */}
      <AnimatePresence>
        {showProvisionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProvisionModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowProvisionModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-5 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-1">Provision <span className="text-blue-500">Account</span></h3>
                <p className="text-gray-400 text-xs">Create and classify new real-world account</p>
              </div>

              <form onSubmit={handleProvision} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-400 ml-1">Identity Name</label>
                  <input 
                    required
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    placeholder="Full name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-400 ml-1">Email Address</label>
                  <input 
                    required
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    placeholder="user@internal.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400 ml-1">Account Classification Tier</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'PATIENT', label: 'Patient', icon: HeartPulse, color: 'text-blue-400' },
                      { id: 'DOCTOR', label: 'Doctor', icon: Stethoscope, color: 'text-emerald-400' },
                      { id: 'ADMIN', label: 'Admin', icon: ShieldCheck, color: 'text-amber-400' }
                    ] as const).map((r) => {
                      const Icon = r.icon;
                      const isSelected = newUser.role === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setNewUser({...newUser, role: r.id})}
                          className={cn(
                            "py-2.5 px-2 rounded-xl text-xs font-semibold uppercase tracking-wider border transition-all text-center flex flex-col sm:flex-row items-center justify-center gap-1.5 min-h-[44px]",
                            isSelected 
                              ? "bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-600/20" 
                              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                          )}
                        >
                          <Icon className={cn("w-3.5 h-3.5", isSelected ? "text-white" : r.color)} />
                          <span className="truncate">{r.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {newUser.role === 'DOCTOR' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-emerald-400 ml-1">Doctor Specialty</label>
                    <input 
                      value={newUser.specialty}
                      onChange={(e) => setNewUser({...newUser, specialty: e.target.value})}
                      placeholder="e.g. Cardiology, Pediatrics"
                      className="w-full bg-white/5 border border-emerald-500/30 rounded-xl p-3 text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500 text-white"
                    />
                  </div>
                )}

                <div className="pt-2">
                  <button 
                    type="submit"
                    className="w-full py-3 bg-white text-black rounded-xl font-semibold text-xs sm:text-sm uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
                  >
                    Commit Account Creation
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StatCard = ({ icon, label, value, sub, color }: { icon: any, label: string, value: string, sub: string, color: 'blue' | 'emerald' | 'purple' }) => {
  const colors = {
    blue: 'text-blue-500 border-blue-500/20 bg-blue-500/5',
    emerald: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5',
    purple: 'text-purple-500 border-purple-500/20 bg-purple-500/5',
  };

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 sm:p-5 group hover:bg-white/[0.05] transition-all relative overflow-hidden">
      <div className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-3 sm:mb-4 border transition-all", colors[color])}>
        {React.cloneElement(icon, { className: 'w-4 h-4 sm:w-4.5 sm:h-4.5' })}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">{label}</div>
      <div className="text-xl sm:text-2xl font-bold tracking-tight mb-0.5">{value}</div>
      <div className="text-[10px] text-gray-500">{sub}</div>
    </div>
  );
};

export default AdminDashboard;
