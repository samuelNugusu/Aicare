import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './errorHandlers';
import { normalizeRole, ADMIN_EMAILS, UserProfile } from '../../shared/types';

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
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribeRole = onSnapshot(
      userRef, 
      (docSnap) => {
        const isWhitelistedAdmin = user.email && ADMIN_EMAILS.some(
          e => e.toLowerCase() === user.email?.toLowerCase().trim()
        );

        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          // If whitelisted admin has not yet been set to ADMIN in Firestore, upgrade it
          if (isWhitelistedAdmin && normalizeRole(data.role) !== 'ADMIN') {
            setDoc(userRef, { role: 'ADMIN' }, { merge: true }).catch(console.error);
          }
          setRoleData({
            ...data,
            role: isWhitelistedAdmin ? 'ADMIN' : (data.role || 'PATIENT')
          });
          setLoading(false);
        } else {
          // New User auto-registration: PATIENT by default, unless in ADMIN_EMAILS whitelist
          const assignedRole: 'ADMIN' | 'PATIENT' = isWhitelistedAdmin ? 'ADMIN' : 'PATIENT';
          setDoc(userRef, {
            uid: user.uid,
            id: user.uid,
            email: user.email,
            displayName: user.displayName || user.email?.split('@')[0] || 'Patient User',
            photoURL: user.photoURL || null,
            role: assignedRole,
            createdAt: serverTimestamp(),
            created_at: serverTimestamp(),
            lastLogin: serverTimestamp(),
            isVerified: true
          }, { merge: true }).then(() => {
            setRoleData({
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || user.email?.split('@')[0] || 'Patient User',
              role: assignedRole,
              isVerified: true
            });
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

    return () => unsubscribeRole();
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

