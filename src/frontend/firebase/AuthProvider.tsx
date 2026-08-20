import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './errorHandlers';
import { normalizeRole, isAdminEmail, ADMIN_EMAILS, UserProfile } from '../../shared/types';

interface AuthContextType {
  user: FirebaseUser | null;
  roleData: UserProfile | null;
  role: 'ADMIN' | 'DOCTOR' | 'PATIENT';
  activeRole: 'ADMIN' | 'DOCTOR' | 'PATIENT';
  isAdmin: boolean;
  isDoctor: boolean;
  isPatient: boolean;
  setActiveRole: (role: 'ADMIN' | 'DOCTOR' | 'PATIENT') => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null, 
  roleData: null, 
  role: 'PATIENT',
  activeRole: 'PATIENT', 
  isAdmin: false,
  isDoctor: false,
  isPatient: true,
  setActiveRole: () => {}, 
  loading: true 
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [roleData, setRoleData] = useState<UserProfile | null>(null);
  const [activeRoleOverride, setActiveRoleOverride] = useState<'ADMIN' | 'DOCTOR' | 'PATIENT' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setRoleData(null);
        setActiveRoleOverride(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !user.email) {
      if (!user) setLoading(false);
      return;
    }

    const cleanEmail = user.email.toLowerCase().trim();
    const isWhitelistedAdmin = isAdminEmail(cleanEmail);
    const userRef = doc(db, 'users', user.uid);
    const emailRoleRef = doc(db, 'email_roles', cleanEmail);

    let emailRoleData: { role?: 'ADMIN' | 'DOCTOR' | 'PATIENT'; specialty?: string; name?: string } | null = null;

    // Listen to email_roles authorization
    const unsubscribeEmailRole = onSnapshot(
      emailRoleRef,
      (emailSnap) => {
        if (emailSnap.exists()) {
          emailRoleData = emailSnap.data() as any;
        } else {
          emailRoleData = null;
        }

        // If email_roles grants DOCTOR or ADMIN, sync to user profile
        const assignedByEmailRole = emailRoleData?.role;
        const targetRole: 'ADMIN' | 'DOCTOR' | 'PATIENT' = isWhitelistedAdmin 
          ? 'ADMIN' 
          : (assignedByEmailRole || 'PATIENT');

        if (assignedByEmailRole === 'DOCTOR' || isWhitelistedAdmin) {
          setDoc(userRef, {
            role: targetRole,
            ...(emailRoleData?.specialty ? { specialty: emailRoleData.specialty } : {}),
            isVerified: true,
            email: cleanEmail
          }, { merge: true }).catch(console.error);
        }
      },
      (err) => {
        console.warn("Email role snapshot warning:", err);
      }
    );

    // Listen to user's profile document
    const unsubscribeUser = onSnapshot(
      userRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          const assignedByEmailRole = emailRoleData?.role;
          const finalRole: 'ADMIN' | 'DOCTOR' | 'PATIENT' = isWhitelistedAdmin 
            ? 'ADMIN' 
            : (assignedByEmailRole || normalizeRole(data.role, cleanEmail));

          // Ensure whitelisted admin or pre-authorized doctor is synced
          if (finalRole !== normalizeRole(data.role)) {
            setDoc(userRef, { 
              role: finalRole,
              ...(emailRoleData?.specialty && !data.specialty ? { specialty: emailRoleData.specialty } : {})
            }, { merge: true }).catch(console.error);
          }

          setRoleData({
            ...data,
            role: finalRole,
            specialty: data.specialty || emailRoleData?.specialty || (finalRole === 'DOCTOR' ? 'General Practice' : undefined)
          });
          setLoading(false);
        } else {
          // New User auto-registration: check if email is admin or assigned as DOCTOR in email_roles
          const assignedByEmailRole = emailRoleData?.role;
          const assignedRole: 'ADMIN' | 'DOCTOR' | 'PATIENT' = isWhitelistedAdmin 
            ? 'ADMIN' 
            : (assignedByEmailRole || 'PATIENT');

          const initialProfile: UserProfile = {
            uid: user.uid,
            id: user.uid,
            email: cleanEmail,
            displayName: user.displayName || user.email?.split('@')[0] || (assignedRole === 'DOCTOR' ? 'Dr. Physician' : 'Patient User'),
            photoURL: user.photoURL || null,
            role: assignedRole,
            specialty: emailRoleData?.specialty || (assignedRole === 'DOCTOR' ? 'General Practice' : undefined),
            createdAt: serverTimestamp(),
            created_at: serverTimestamp(),
            lastLogin: serverTimestamp(),
            isVerified: assignedRole === 'DOCTOR' || assignedRole === 'ADMIN'
          };

          setDoc(userRef, initialProfile, { merge: true }).then(() => {
            setRoleData(initialProfile);
            setLoading(false);
          }).catch(err => {
             console.error("Auto-init failed:", err);
             setLoading(false);
          });
        }
      },
      (error) => {
        console.error("Auth Snapshot Error:", error);
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeEmailRole();
      unsubscribeUser();
    };
  }, [user]);

  const actualRole = normalizeRole(roleData?.role, user?.email || undefined);
  const activeRole = activeRoleOverride || actualRole;
  const isAdmin = actualRole === 'ADMIN';
  const isDoctor = actualRole === 'DOCTOR';
  const isPatient = actualRole === 'PATIENT';

  const setActiveRole = (role: 'ADMIN' | 'DOCTOR' | 'PATIENT') => {
    // Only admins can test perspective switching
    if (isAdmin) {
      setActiveRoleOverride(role);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      roleData, 
      role: actualRole, 
      activeRole, 
      isAdmin, 
      isDoctor, 
      isPatient, 
      setActiveRole, 
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

