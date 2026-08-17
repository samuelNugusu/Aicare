import React, { useState, useEffect } from 'react';
import { useAuth } from '../../firebase/AuthProvider';
import { db } from '../../firebase/firebase';
import { 
  collection, query, where, onSnapshot, addDoc, 
  updateDoc, doc, serverTimestamp, orderBy 
} from 'firebase/firestore';
import { 
  Calendar, Clock, User, Stethoscope, CheckCircle2, 
  XCircle, AlertCircle, Plus, FileText, ChevronRight,
  Filter, Check, X, ShieldAlert, Sparkles, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../utils/utils';
import { AppointmentRecord, UserProfile } from '../../../shared/types';

interface AppointmentsManagerProps {
  mode: 'patient' | 'doctor' | 'admin';
  patientId?: string;
}

export default function AppointmentsManager({ mode, patientId }: AppointmentsManagerProps) {
  const { user, roleData, activeRole } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [doctors, setDoctors] = useState<UserProfile[]>([]);
  const [showBookModal, setShowBookModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [loading, setLoading] = useState(true);

  // Booking Form State
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('10:00 AM');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Doctor Note/Completion State
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [prescriptions, setPrescriptions] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Fetch Doctors list for booking
  useEffect(() => {
    const qDocs = query(collection(db, 'users'));
    const unsub = onSnapshot(qDocs, (snap) => {
      const docsList: UserProfile[] = [];
      snap.forEach(d => {
        const data = d.data() as UserProfile;
        const role = (data.role || '').toUpperCase();
        if (role === 'DOCTOR') {
          docsList.push({
            id: d.id,
            uid: d.id,
            ...data
          });
        }
      });
      setDoctors(docsList);
      if (docsList.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(docsList[0].id || docsList[0].uid);
      }
    });

    return () => unsub();
  }, []);

  // Fetch Appointments based on user role / mode
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    let q = query(collection(db, 'appointments'), orderBy('createdAt', 'desc'));

    if (mode === 'patient') {
      const targetUserId = patientId || user.uid;
      q = query(
        collection(db, 'appointments'),
        where('patientId', '==', targetUserId)
      );
    } else if (mode === 'doctor' && activeRole === 'DOCTOR') {
      q = query(
        collection(db, 'appointments'),
        where('doctorId', '==', user.uid)
      );
    }

    const unsub = onSnapshot(q, (snap) => {
      const list: AppointmentRecord[] = [];
      snap.forEach(d => {
        list.push({
          id: d.id,
          ...d.data() as AppointmentRecord
        });
      });

      // Sort client side if compound index isn't ready
      list.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });

      setAppointments(list);
      setLoading(false);
    }, (err) => {
      console.warn("Appointments listener fallback:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user, mode, patientId, activeRole]);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !appointmentDate || !reason) {
      setErrorMsg('Please select a date and enter the consultation reason.');
      return;
    }

    const selectedDoc = doctors.find(d => (d.id || d.uid) === selectedDoctorId);
    const doctorName = selectedDoc?.displayName || selectedDoc?.name || 'Dr. Specialist';
    const doctorSpecialty = selectedDoc?.specialty || 'General Practice';

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await addDoc(collection(db, 'appointments'), {
        patientId: user.uid,
        patientName: user.displayName || user.email?.split('@')[0] || 'Patient Member',
        patientEmail: user.email || '',
        doctorId: selectedDoctorId,
        doctorName: doctorName,
        doctorSpecialty: doctorSpecialty,
        date: appointmentDate,
        time: appointmentTime,
        reason: reason,
        status: 'PENDING',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setShowBookModal(false);
      setReason('');
      setAppointmentDate('');
    } catch (err: any) {
      console.error("Booking error:", err);
      setErrorMsg(err.message || 'Failed to book consultation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (
    apptId: string, 
    newStatus: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
    notes?: string,
    rx?: string
  ) => {
    setIsUpdatingStatus(true);
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };
      if (notes !== undefined) updateData.clinicalNotes = notes;
      if (rx !== undefined) updateData.prescriptions = rx;

      await updateDoc(doc(db, 'appointments', apptId), updateData);
      
      if (selectedAppointment && selectedAppointment.id === apptId) {
        setSelectedAppointment({
          ...selectedAppointment,
          status: newStatus,
          clinicalNotes: notes !== undefined ? notes : selectedAppointment.clinicalNotes,
          prescriptions: rx !== undefined ? rx : selectedAppointment.prescriptions
        });
      }
    } catch (err) {
      console.error("Status update error:", err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const filteredAppointments = appointments.filter(a => {
    if (statusFilter === 'ALL') return true;
    return a.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'COMPLETED':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {mode === 'patient' 
              ? 'Doctor Consultations & Appointments' 
              : mode === 'doctor' 
                ? 'Clinical Consultation Schedule' 
                : 'Hospital Consultation Registry'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {mode === 'patient'
              ? 'Schedule and manage appointments with attending physicians and medical specialists.'
              : mode === 'doctor'
                ? 'Review upcoming patient appointments, confirm visits, and document clinical notes.'
                : 'Facility-wide schedule monitoring and consultation status oversight.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold">
            {(['ALL', 'PENDING', 'CONFIRMED', 'COMPLETED'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-all",
                  statusFilter === filter 
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs" 
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                {filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {mode === 'patient' && (
            <button
              onClick={() => setShowBookModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              Book Doctor Consultation
            </button>
          )}
        </div>
      </div>

      {/* Appointments List */}
      <div className="grid gap-3">
        {filteredAppointments.map((appt) => (
          <div
            key={appt.id}
            onClick={() => {
              setSelectedAppointment(appt);
              setClinicalNotes(appt.clinicalNotes || '');
              setPrescriptions(appt.prescriptions || '');
            }}
            className="group p-4 sm:p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
          >
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-bold shadow-sm",
                appt.status === 'COMPLETED' ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50" :
                appt.status === 'CONFIRMED' ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50" :
                appt.status === 'CANCELLED' ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50" :
                "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50"
              )}>
                {mode === 'doctor' ? <User className="w-5 h-5" /> : <Stethoscope className="w-5 h-5" />}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                    {mode === 'doctor' ? appt.patientName : appt.doctorName}
                  </h4>
                  <span className={cn("px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md border", getStatusBadge(appt.status))}>
                    {appt.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    {appt.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    {appt.time}
                  </span>
                  {appt.doctorSpecialty && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      • {appt.doctorSpecialty}
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 line-clamp-1 italic">
                  "{appt.reason}"
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
              {mode === 'doctor' && appt.status === 'PENDING' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (appt.id) handleUpdateStatus(appt.id, 'CONFIRMED');
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Accept
                </button>
              )}

              {mode === 'doctor' && appt.status === 'CONFIRMED' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAppointment(appt);
                    setClinicalNotes(appt.clinicalNotes || '');
                    setPrescriptions(appt.prescriptions || '');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Complete Visit
                </button>
              )}

              {mode === 'patient' && appt.status === 'PENDING' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (appt.id && window.confirm("Cancel this appointment request?")) {
                      handleUpdateStatus(appt.id, 'CANCELLED');
                    }
                  }}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 text-xs font-bold rounded-lg transition-all"
                >
                  Cancel
                </button>
              )}

              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        ))}

        {!loading && filteredAppointments.length === 0 && (
          <div className="p-8 sm:p-12 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
              No Consultations Found
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
              {mode === 'patient' 
                ? 'You do not have any appointments in this status. Click "Book Doctor Consultation" to schedule your visit.'
                : 'No patient appointments match the selected filter.'}
            </p>
            {mode === 'patient' && (
              <button
                onClick={() => setShowBookModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-sm"
              >
                Schedule Appointment Now
              </button>
            )}
          </div>
        )}
      </div>

      {/* Book Consultation Modal (Patient) */}
      <AnimatePresence>
        {showBookModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBookModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setShowBookModal(false)}
                className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                  <Stethoscope className="w-4 h-4" />
                  Physician Consultation Scheduling
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Book Doctor Consultation
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Connect directly with verified clinical specialists for health assessment and guidance.
                </p>
              </div>

              {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium rounded-xl border border-red-200 dark:border-red-800">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleBookAppointment} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                    Select Attending Specialist
                  </label>
                  {doctors.length > 0 ? (
                    <select
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {doctors.map(d => (
                        <option key={d.id || d.uid} value={d.id || d.uid}>
                          {d.displayName || d.name || 'Doctor'} - {d.specialty || 'General Practitioner'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-xs rounded-xl border border-amber-200 dark:border-amber-800">
                      Attending physicians are on active duty. Selecting on-call hospital specialist.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                      Preferred Date
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={appointmentDate}
                      onChange={(e) => setAppointmentDate(e.target.value)}
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                      Preferred Time
                    </label>
                    <select
                      value={appointmentTime}
                      onChange={(e) => setAppointmentTime(e.target.value)}
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="09:00 AM">09:00 AM</option>
                      <option value="10:00 AM">10:00 AM</option>
                      <option value="11:30 AM">11:30 AM</option>
                      <option value="02:00 PM">02:00 PM</option>
                      <option value="03:30 PM">03:30 PM</option>
                      <option value="04:30 PM">04:30 PM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                    Reason for Consultation / Symptoms
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe your health symptoms, recent lab concerns, or questions for the doctor..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-all disabled:opacity-50 shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? 'Requesting Appointment...' : 'Submit Appointment Request'}
                    {!isSubmitting && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Appointment Detail & Doctor Clinical Note Modal */}
      <AnimatePresence>
        {selectedAppointment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAppointment(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setSelectedAppointment(null)}
                className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn("px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md border", getStatusBadge(selectedAppointment.status))}>
                    {selectedAppointment.status}
                  </span>
                  <span className="text-xs text-gray-400">• Consultation Record</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {mode === 'doctor' ? `Patient: ${selectedAppointment.patientName}` : `Doctor: ${selectedAppointment.doctorName}`}
                </h3>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>{selectedAppointment.date} at {selectedAppointment.time}</span>
                  {selectedAppointment.doctorSpecialty && (
                    <span>• Specialty: {selectedAppointment.doctorSpecialty}</span>
                  )}
                </div>
              </div>

              {/* Consultation Details */}
              <div className="space-y-4 text-xs sm:text-sm">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                    Patient Consultation Reason
                  </span>
                  <p className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed">
                    {selectedAppointment.reason}
                  </p>
                </div>

                {/* Doctor Note Section */}
                {(mode === 'doctor' || mode === 'admin') ? (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1.5">
                        Physician Clinical Assessment & Diagnosis
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Document medical evaluation, biomarker interpretations, and diagnosis..."
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1.5">
                        Prescriptions & Recommended Next Steps
                      </label>
                      <textarea
                        rows={2}
                        placeholder="List medications, dosage instructions, lifestyle changes, or follow-up tests..."
                        value={prescriptions}
                        onChange={(e) => setPrescriptions(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      {selectedAppointment.status !== 'COMPLETED' && (
                        <button
                          disabled={isUpdatingStatus}
                          onClick={() => {
                            if (selectedAppointment.id) {
                              handleUpdateStatus(selectedAppointment.id, 'COMPLETED', clinicalNotes, prescriptions);
                            }
                          }}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Sign Off & Complete Consultation
                        </button>
                      )}

                      {selectedAppointment.status === 'PENDING' && (
                        <button
                          disabled={isUpdatingStatus}
                          onClick={() => {
                            if (selectedAppointment.id) {
                              handleUpdateStatus(selectedAppointment.id, 'CONFIRMED', clinicalNotes, prescriptions);
                            }
                          }}
                          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm"
                        >
                          Confirm
                        </button>
                      )}

                      <button
                        disabled={isUpdatingStatus}
                        onClick={() => {
                          if (selectedAppointment.id) {
                            handleUpdateStatus(selectedAppointment.id, selectedAppointment.status, clinicalNotes, prescriptions);
                          }
                        }}
                        className="py-2.5 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                      >
                        Save Notes
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Patient View of Clinical Notes */
                  <div className="space-y-3 pt-2">
                    {selectedAppointment.clinicalNotes ? (
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block mb-1">
                          Doctor's Clinical Notes
                        </span>
                        <p className="text-emerald-950 dark:text-emerald-100 font-medium leading-relaxed">
                          {selectedAppointment.clinicalNotes}
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 text-gray-500 text-xs rounded-xl">
                        Doctor clinical assessment will be recorded during or after your consultation.
                      </div>
                    )}

                    {selectedAppointment.prescriptions && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-800/50">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block mb-1">
                          Prescription / Follow-Up Directives
                        </span>
                        <p className="text-blue-950 dark:text-blue-100 font-medium leading-relaxed">
                          {selectedAppointment.prescriptions}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
