export type UserRole = 'ADMIN' | 'DOCTOR' | 'PATIENT' | 'admin' | 'doctor' | 'client' | 'patient';

export const ADMIN_EMAILS = [
  'sami478779@gmail.com',
  'samuelnugusu7@gmail.com',
  'afronexhub@gmail.com'
] as const;

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  return ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === clean);
}

export function normalizeRole(role?: string, email?: string): 'ADMIN' | 'DOCTOR' | 'PATIENT' {
  if (isAdminEmail(email)) {
    return 'ADMIN';
  }
  if (!role) return 'PATIENT';
  const clean = role.toUpperCase().trim();
  if (clean === 'ADMIN') return 'ADMIN';
  if (clean === 'DOCTOR') return 'DOCTOR';
  return 'PATIENT';
}

export interface UserProfile {
  id?: string;
  uid: string;
  email: string;
  displayName: string;
  name?: string;
  photoURL?: string | null;
  role: 'ADMIN' | 'DOCTOR' | 'PATIENT' | 'admin' | 'doctor' | 'client' | 'patient';
  specialty?: string;
  licenseNumber?: string;
  isVerified?: boolean;
  createdAt?: any;
  created_at?: any;
  lastLogin?: any;
}

export interface AppointmentRecord {
  id?: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty?: string;
  date: string;
  time: string;
  reason: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  clinicalNotes?: string;
  prescriptions?: string;
  createdAt: any;
  updatedAt?: any;
}

export interface LabAnalysisData {
  summary: string;
  keyMetrics: {
    marker: string;
    value: string;
    unit: string;
    referenceRange: string;
    status: 'normal' | 'high' | 'low' | 'critical';
  }[];
  recommendations: string[];
  predictiveAlerts: string[];
}

export interface LabResultRecord {
  id?: string;
  userId: string;
  patientName?: string;
  patientEmail?: string;
  fileName: string;
  uploadDate: any;
  status: 'pending' | 'processing' | 'completed' | 'verified' | 'failed' | 'error';
  analysis: LabAnalysisData;
  verifiedByDoctorId?: string;
  verifiedByDoctorName?: string;
  doctorSpecialty?: string;
  doctorNotes?: string;
  verifiedAt?: any;
  previewUrl?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  image?: string;
}


