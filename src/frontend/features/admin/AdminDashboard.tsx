import React, { useState, useEffect } from 'react';
import { useAuth } from '../../firebase/AuthProvider';
import { 
  Users, Shield, Settings, Activity, LayoutGrid, HeartPulse, 
  MoreHorizontal, UserPlus, Trash2, X, BarChart3, PieChart as PieChartIcon, 
  AlertCircle, ShieldCheck, ChevronRight, Search, TrendingUp, CheckCircle2,
  Stethoscope, Eye, Calendar, Key, Check, Server, Lock, Cpu, RefreshCw,
  Mail, Sparkles, UserCheck, Award, ArrowRight, ShieldAlert, CheckCircle
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
import { ADMIN_EMAILS, normalizeRole, isAdminEmail, EmailRoleAssignment } from '../../../shared/types';

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

const MEDICAL_SPECIALTIES = [
  'General Practice',
  'Cardiology',
  'Internal Medicine',
  'Pediatrics',
  'Hematology & Oncology',
  'Neurology',
  'Dermatology',
  'Radiology & Imaging',
  'Orthopedic Surgery',
  'Pulmonology',
  'Endocrinology',
  'Emergency Medicine'
];

const AdminDashboard: React.FC = () => {
  const { user, setActiveRole } = useAuth();
  const [view, setView] = useState<'admin' | 'doctor' | 'patient'>('admin');
  const [adminTab, setAdminTab] = useState<'overview' | 'users' | 'doctors' | 'patients' | 'appointments' | 'system'>('overview');
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [emailRoles, setEmailRoles] = useState<EmailRoleAssignment[]>([]);
  const [stats, setStats] = useState({ total: 0, doctors: 0, clients: 0, admins: 0 });
  const [diagnosisStats, setDiagnosisStats] = useState({ completed: 0, verified: 0, failed: 0, total: 0 });
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [selectedDoctorForEdit, setSelectedDoctorForEdit] = useState<UserData | null>(null);
  const [editingSpecialty, setEditingSpecialty] = useState('');
  const [selectedPatientForInspect, setSelectedPatientForInspect] = useState<string | null>(null);

  // Quick Email Role Grant State
  const [grantEmail, setGrantEmail] = useState('');
  const [grantRole, setGrantRole] = useState<'DOCTOR' | 'PATIENT' | 'ADMIN'>('DOCTOR');
  const [grantSpecialty, setGrantSpecialty] = useState('General Practice');
  const [grantName, setGrantName] = useState('');
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);
  const [grantError, setGrantError] = useState<string | null>(null);

  const [newUser, setNewUser] = useState({ 
    email: '', 
    name: '', 
    role: 'PATIENT',
    specialty: 'General Practice'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'DOCTOR' | 'PATIENT'>('ALL');

  useEffect(() => {
    // 1. Subscribe to users
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

    // 2. Subscribe to email_roles
    const emailRolesQ = query(collection(db, 'email_roles'));
    const unsubscribeEmailRoles = onSnapshot(emailRolesQ, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as EmailRoleAssignment));
      setEmailRoles(list);
    }, (error) => {
      console.warn("Email roles fetch warning:", error);
    });

    // 3. Subscribe to lab results
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
      unsubscribeEmailRoles();
      unsubscribeLabs();
    };
  }, []);

  const handleGrantEmailRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrantError(null);
    setGrantSuccess(null);

    const cleanEmail = grantEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setGrantError('Please provide a valid email address.');
      return;
    }

    setGrantLoading(true);
    try {
      const finalRole = isAdminEmail(cleanEmail) ? 'ADMIN' : grantRole;

      // 1. Save to email_roles
      await setDoc(doc(db, 'email_roles', cleanEmail), {
        email: cleanEmail,
        role: finalRole,
        specialty: finalRole === 'DOCTOR' ? (grantSpecialty || 'General Practice') : null,
        name: grantName.trim() || undefined,
        assignedBy: user?.email || 'Admin',
        assignedAt: new Date().toISOString()
      }, { merge: true });

      // 2. If a user account already exists with this email, immediately upgrade their role
      const matchingUsers = users.filter(u => u.email?.toLowerCase().trim() === cleanEmail);
      for (const mUser of matchingUsers) {
        await updateDoc(doc(db, 'users', mUser.id), {
          role: finalRole,
          ...(finalRole === 'DOCTOR' ? { specialty: grantSpecialty || 'General Practice' } : {}),
          isVerified: true,
          updatedAt: new Date().toISOString()
        });
      }

      setGrantSuccess(`Successfully granted ${finalRole} permissions to ${cleanEmail}! The user will have full access whenever they sign in.`);
      setGrantEmail('');
      setGrantName('');
      setTimeout(() => setGrantSuccess(null), 6000);
    } catch (err: any) {
      console.error("Grant role error:", err);
      setGrantError(err.message || "Failed to grant role. Please try again.");
    } finally {
      setGrantLoading(false);
    }
  };

  const handleRevokeEmailRole = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (isAdminEmail(cleanEmail)) {
      alert("Cannot revoke permissions for a primary whitelisted Administrator.");
      return;
    }

    if (!window.confirm(`Revoke special permissions for ${cleanEmail}? Account will revert to standard PATIENT status.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'email_roles', cleanEmail));
      
      // Also downgrade any existing user profiles with this email
      const matching = users.filter(u => u.email?.toLowerCase().trim() === cleanEmail);
      for (const u of matching) {
        await updateDoc(doc(db, 'users', u.id), {
          role: 'PATIENT',
          updatedAt: new Date().toISOString()
        });
      }
      setGrantSuccess(`Permissions revoked for ${cleanEmail}. Reverted to PATIENT.`);
      setTimeout(() => setGrantSuccess(null), 4000);
    } catch (err) {
      console.error("Failed to revoke email role:", err);
    }
  };

  const handleUpdateRole = async (userId: string, userEmail: string, newRole: string) => {
    const isWhitelisted = isAdminEmail(userEmail);
    if (isWhitelisted && newRole !== 'ADMIN') {
      alert("Notice: This account is permanently whitelisted as a System Administrator and cannot be demoted.");
      return;
    }

    const cleanEmail = userEmail.toLowerCase().trim();

    try {
      // 1. Update user profile
      await updateDoc(doc(db, 'users', userId), { 
        role: newRole,
        updatedAt: new Date().toISOString()
      });

      // 2. Also persist to email_roles so future logins maintain this permission
      await setDoc(doc(db, 'email_roles', cleanEmail), {
        email: cleanEmail,
        role: newRole,
        assignedBy: user?.email || 'Admin',
        assignedAt: new Date().toISOString()
      }, { merge: true });

      setGrantSuccess(`Updated ${userEmail} role to ${newRole}`);
      setTimeout(() => setGrantSuccess(null), 3000);
    } catch (err) {
      console.error("Failed to update role:", err);
    }
  };

  const handleSaveDoctorSpecialty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorForEdit) return;
    const cleanEmail = selectedDoctorForEdit.email.toLowerCase().trim();

    try {
      await updateDoc(doc(db, 'users', selectedDoctorForEdit.id), {
        specialty: editingSpecialty
      });
      // Also sync to email_roles
      await setDoc(doc(db, 'email_roles', cleanEmail), {
        specialty: editingSpecialty
      }, { merge: true });

      setSelectedDoctorForEdit(null);
      setGrantSuccess(`Updated specialty for ${selectedDoctorForEdit.email}`);
      setTimeout(() => setGrantSuccess(null), 3000);
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
      // Also delete from email_roles if exists
      const cleanEmail = userEmail.toLowerCase().trim();
      await deleteDoc(doc(db, 'email_roles', cleanEmail)).catch(() => {});
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
      // 1. Create user document
      await setDoc(doc(db, 'users', tempUid), {
        email: cleanEmail,
        displayName: newUser.name,
        name: newUser.name,
        role: finalRole,
        specialty: finalRole === 'DOCTOR' ? (newUser.specialty || 'General Practice') : undefined,
        createdAt: new Date().toISOString(),
        isVerified: true
      });

      // 2. Create email_roles assignment so when user actually registers/logs in, role is preserved
      await setDoc(doc(db, 'email_roles', cleanEmail), {
        email: cleanEmail,
        role: finalRole,
        specialty: finalRole === 'DOCTOR' ? (newUser.specialty || 'General Practice') : undefined,
        name: newUser.name,
        assignedBy: user?.email || 'Admin',
        assignedAt: new Date().toISOString()
      }, { merge: true });

      setShowProvisionModal(false);
      setNewUser({ email: '', name: '', role: 'PATIENT', specialty: 'General Practice' });
      setGrantSuccess(`Provisioned account and granted ${finalRole} role to ${cleanEmail}`);
      setTimeout(() => setGrantSuccess(null), 4000);
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
        {/* Feedback Alert Toast */}
        <AnimatePresence>
          {grantSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between gap-3 shadow-lg mb-6"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{grantSuccess}</span>
              </div>
              <button onClick={() => setGrantSuccess(null)} className="text-emerald-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {grantError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-between gap-3 shadow-lg mb-6"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{grantError}</span>
              </div>
              <button onClick={() => setGrantError(null)} className="text-rose-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

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
                  { id: 'doctors', label: `Doctor Registry (${doctorsList.length + emailRoles.filter(e => e.role === 'DOCTOR' && !users.some(u => u.email?.toLowerCase() === e.email.toLowerCase())).length})`, icon: Stethoscope },
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
                <div className="space-y-6">
                  {/* HERO: Quick Email-Based Permission Grant Card */}
                  <div className="p-6 bg-gradient-to-br from-blue-900/30 via-purple-900/20 to-black border border-blue-500/30 rounded-2xl shadow-2xl relative overflow-hidden">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                      <div className="space-y-2 max-w-xl">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                          Email-Based Role Authorization
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                          Grant Doctor or Staff Permissions by Email
                        </h2>
                        <p className="text-xs text-gray-300 leading-relaxed">
                          All new user accounts automatically default to <span className="text-blue-400 font-semibold">PATIENT</span>. As an Administrator, you can grant <span className="text-emerald-400 font-semibold">DOCTOR</span> features to any specific account using their email. When that user logs in or registers with that email, they immediately gain full clinical tools and patient review rights.
                        </p>
                      </div>

                      {/* Role Summary Badges */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        <div className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl">
                          <div className="text-gray-400 text-[10px] uppercase font-semibold">Default Role</div>
                          <div className="font-bold text-blue-400">PATIENT (AI Diagnostic)</div>
                        </div>
                        <div className="px-3 py-2 bg-black/40 border border-emerald-500/30 rounded-xl">
                          <div className="text-emerald-400/80 text-[10px] uppercase font-semibold">Admin-Grantable</div>
                          <div className="font-bold text-emerald-400">DOCTOR (Lab & Vitals Review)</div>
                        </div>
                      </div>
                    </div>

                    {/* Grant Form */}
                    <form onSubmit={handleGrantEmailRole} className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-12 gap-3">
                      {/* Email Field */}
                      <div className="md:col-span-4 space-y-1">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">User / Physician Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input
                            type="email"
                            required
                            value={grantEmail}
                            onChange={(e) => setGrantEmail(e.target.value)}
                            placeholder="e.g. doctor.smith@hospital.com"
                            className="w-full bg-black/60 border border-white/15 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 transition-all font-mono"
                          />
                        </div>
                      </div>

                      {/* Role Picker */}
                      <div className="md:col-span-3 space-y-1">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">Target Role</label>
                        <select
                          value={grantRole}
                          onChange={(e) => setGrantRole(e.target.value as any)}
                          className={cn(
                            "w-full bg-black/60 border rounded-xl py-2.5 px-3 text-xs font-bold outline-none transition-all cursor-pointer",
                            grantRole === 'DOCTOR' ? "border-emerald-500/50 text-emerald-400" :
                            grantRole === 'ADMIN' ? "border-amber-500/50 text-amber-400" :
                            "border-blue-500/50 text-blue-400"
                          )}
                        >
                          <option value="DOCTOR" className="bg-[#0a0a0a] text-emerald-400">DOCTOR (Clinical & Diagnostics)</option>
                          <option value="PATIENT" className="bg-[#0a0a0a] text-blue-400">PATIENT (Default User)</option>
                          <option value="ADMIN" className="bg-[#0a0a0a] text-amber-400">ADMIN (Full Governance)</option>
                        </select>
                      </div>

                      {/* Doctor Specialty (if Doctor) */}
                      {grantRole === 'DOCTOR' ? (
                        <div className="md:col-span-3 space-y-1">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-400">Specialty / Department</label>
                          <select
                            value={grantSpecialty}
                            onChange={(e) => setGrantSpecialty(e.target.value)}
                            className="w-full bg-black/60 border border-emerald-500/30 rounded-xl py-2.5 px-3 text-xs text-emerald-300 font-medium outline-none cursor-pointer"
                          >
                            {MEDICAL_SPECIALTIES.map(s => (
                              <option key={s} value={s} className="bg-[#0a0a0a] text-white">{s}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="md:col-span-3 space-y-1">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">Name / Notes (Optional)</label>
                          <input
                            type="text"
                            value={grantName}
                            onChange={(e) => setGrantName(e.target.value)}
                            placeholder="Optional display name"
                            className="w-full bg-black/60 border border-white/15 rounded-xl py-2.5 px-3 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 font-medium"
                          />
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="md:col-span-2 flex items-end">
                        <button
                          type="submit"
                          disabled={grantLoading}
                          className={cn(
                            "w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg active:scale-95",
                            grantRole === 'DOCTOR'
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30"
                              : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30"
                          )}
                        >
                          {grantLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Grant Role</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>

                    {/* Quick Specialty Department Chips */}
                    {grantRole === 'DOCTOR' && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 uppercase font-bold mr-1">Quick Presets:</span>
                        {['Cardiology', 'Hematology & Oncology', 'Pediatrics', 'Neurology', 'Internal Medicine', 'General Practice'].map(dept => (
                          <button
                            type="button"
                            key={dept}
                            onClick={() => setGrantSpecialty(dept)}
                            className={cn(
                              "px-2.5 py-0.5 rounded-lg text-[10px] font-semibold transition-all",
                              grantSpecialty === dept 
                                ? "bg-emerald-500 text-black font-bold" 
                                : "bg-white/5 hover:bg-white/10 text-gray-300"
                            )}
                          >
                            {dept}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Registered Users Table */}
                  <div className="bg-white/[0.03] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg sm:text-xl font-bold tracking-tight">Active User Accounts Directory</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Manage permissions, update user roles dynamically, or revoke privileges.</p>
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
                            <th className="px-5 py-3.5">Role Classification & Permissions</th>
                            <th className="px-5 py-3.5">Authorization Source</th>
                            <th className="px-5 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs">
                          {filteredUsers.map((u) => {
                            const norm = normalizeRole(u.role, u.email);
                            const isWhitelistedAdmin = isAdminEmail(u.email);
                            const emailRoleEntry = emailRoles.find(e => e.email.toLowerCase() === u.email?.toLowerCase());

                            return (
                              <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      "w-9 h-9 rounded-xl border flex items-center justify-center text-xs font-bold flex-shrink-0",
                                      norm === 'DOCTOR' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" :
                                      norm === 'ADMIN' ? "bg-amber-500/20 border-amber-500/30 text-amber-400" :
                                      "bg-blue-500/20 border-blue-500/30 text-blue-400"
                                    )}>
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
                                      {norm === 'DOCTOR' && u.specialty && (
                                        <div className="text-[10px] text-emerald-400/90 font-medium">Dept: {u.specialty}</div>
                                      )}
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
                                        "bg-white/5 border rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer outline-none hover:border-blue-500/50 transition-all",
                                        norm === 'ADMIN' ? "text-amber-400 border-amber-400/30" :
                                        norm === 'DOCTOR' ? "text-emerald-400 border-emerald-400/30" :
                                        "text-blue-400 border-blue-400/30"
                                      )}
                                    >
                                      <option value="PATIENT" className="bg-[#0a0a0a] text-blue-400">PATIENT (Default User)</option>
                                      <option value="DOCTOR" className="bg-[#0a0a0a] text-emerald-400">DOCTOR (Attending Medic)</option>
                                      <option value="ADMIN" className="bg-[#0a0a0a] text-amber-400">ADMIN (Administrator)</option>
                                    </select>
                                  )}
                                </td>
                                <td className="px-5 py-3.5">
                                  {isWhitelistedAdmin ? (
                                    <span className="text-[11px] text-amber-400 font-mono font-medium">Root Whitelist</span>
                                  ) : emailRoleEntry ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded text-[10px] font-semibold">
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      Email Grant by {emailRoleEntry.assignedBy?.split('@')[0] || 'Admin'}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-gray-500 font-mono">Standard Signup</span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 text-right space-x-1">
                                  {emailRoleEntry && !isWhitelistedAdmin && (
                                    <button
                                      onClick={() => handleRevokeEmailRole(u.email)}
                                      className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-[10px] font-bold uppercase transition-all"
                                      title="Revoke email-granted role"
                                    >
                                      Revoke
                                    </button>
                                  )}
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
                </div>
              )}

              {/* TAB 3: DOCTOR REGISTRY & PRE-AUTHORIZATIONS */}
              {adminTab === 'doctors' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Stethoscope className="w-5 h-5 text-emerald-500" />
                        Clinical Doctor Staff & Specialty Credentials
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">Manage attending physicians, authorized doctor emails, and clinical verification rights.</p>
                    </div>

                    <button
                      onClick={() => {
                        setAdminTab('users');
                        setGrantRole('DOCTOR');
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/30"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      + Authorize Doctor Email
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* 1. Active Registered Doctors */}
                    {doctorsList.map((docItem) => (
                      <div key={docItem.id} className="p-5 bg-white/[0.03] border border-emerald-500/20 rounded-2xl space-y-4 shadow-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-lg flex-shrink-0">
                            {(docItem.displayName || docItem.name)?.[0]?.toUpperCase() || 'D'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-sm text-white truncate">{docItem.displayName || docItem.name || 'Dr. Attending'}</h4>
                              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[9px] rounded font-bold uppercase">Active</span>
                            </div>
                            <p className="text-xs text-gray-400 font-mono truncate">{docItem.email}</p>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-900/40 text-emerald-300 border border-emerald-700/40 rounded text-[10px] font-bold uppercase">
                              {docItem.specialty || 'General Practice'}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                          <span className="text-[11px] text-emerald-400/80 font-medium">Verification Rights: Active</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedDoctorForEdit(docItem);
                                setEditingSpecialty(docItem.specialty || 'Cardiology');
                              }}
                              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold"
                            >
                              Edit Dept
                            </button>
                            <button
                              onClick={() => handleRevokeEmailRole(docItem.email)}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold"
                              title="Revoke doctor permissions"
                            >
                              Revoke
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* 2. Pre-Authorized Doctor Emails (Not yet logged in or registered) */}
                    {emailRoles
                      .filter(e => e.role === 'DOCTOR' && !doctorsList.some(d => d.email.toLowerCase() === e.email.toLowerCase()))
                      .map((preAuth) => (
                        <div key={preAuth.email} className="p-5 bg-white/[0.02] border border-dashed border-emerald-500/40 rounded-2xl space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-lg flex-shrink-0">
                              <Mail className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-bold text-sm text-white truncate">{preAuth.name || 'Pre-Authorized Doctor'}</h4>
                                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[9px] rounded font-bold uppercase">Pre-Authorized</span>
                              </div>
                              <p className="text-xs text-gray-400 font-mono truncate">{preAuth.email}</p>
                              <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-900/40 text-emerald-300 border border-emerald-700/40 rounded text-[10px] font-bold uppercase">
                                {preAuth.specialty || 'General Practice'}
                              </span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[11px] text-amber-400/80 font-medium">Awaiting Login Activation</span>
                            <button
                              onClick={() => handleRevokeEmailRole(preAuth.email)}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-semibold"
                            >
                              Cancel Authorization
                            </button>
                          </div>
                        </div>
                      ))}

                    {doctorsList.length === 0 && emailRoles.filter(e => e.role === 'DOCTOR').length === 0 && (
                      <div className="col-span-3 text-center py-12 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                        <p className="text-gray-400 text-xs">No doctors currently authorized. Grant DOCTOR permissions by email above.</p>
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

                  {/* Active Email-Based Roles Registry */}
                  <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 sm:p-6">
                    <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      Active Email-Based Role Assignments Database (`email_roles`)
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">
                      Every email registered here overrides default PATIENT behavior upon login.
                    </p>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-white/5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            <th className="py-2.5 px-3">Email Address</th>
                            <th className="py-2.5 px-3">Granted Role</th>
                            <th className="py-2.5 px-3">Specialty / Notes</th>
                            <th className="py-2.5 px-3">Assigned By</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs">
                          {emailRoles.map((er) => (
                            <tr key={er.email}>
                              <td className="py-2.5 px-3 font-mono text-white font-medium">{er.email}</td>
                              <td className="py-2.5 px-3">
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                  er.role === 'DOCTOR' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                                  er.role === 'ADMIN' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                                  "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                )}>
                                  {er.role}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-gray-300">{er.specialty || er.name || '—'}</td>
                              <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px]">{er.assignedBy || 'Admin'}</td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => handleRevokeEmailRole(er.email)}
                                  className="text-rose-400 hover:text-rose-300 text-[11px] font-semibold"
                                >
                                  Revoke
                                </button>
                              </td>
                            </tr>
                          ))}
                          {emailRoles.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-4 text-center text-gray-500 text-xs">
                                No custom email role assignments created yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
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
                        Admin email whitelist and `email_roles` verification baked into security rules.
                      </p>
                    </div>

                    <div className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                        <Server className="w-4 h-4" />
                        Default Registration Policy
                      </div>
                      <h4 className="font-bold text-sm text-white">New User → PATIENT</h4>
                      <p className="text-xs text-gray-400">
                        All new signups enter as Patients unless their email is pre-granted Doctor or Admin permissions.
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
