import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../../firebase-applet-config.json';
import { ADMIN_EMAILS, normalizeRole } from '../../shared/types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); 
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './errorHandlers';

async function syncUserRecord(user: any) {
  if (!user?.uid) return;
  const userRef = doc(db, 'users', user.uid);
  let userDoc;
  try {
    userDoc = await getDoc(userRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
  }
  
  // Real world role resolution:
  // 1. If in designated ADMIN_EMAILS whitelist, assign 'ADMIN'
  // 2. If new user, assign 'PATIENT' by default
  // 3. If existing user, PRESERVE their role and update lastLogin
  const isWhitelistedAdmin = user.email && ADMIN_EMAILS.some(
    adminEmail => adminEmail.toLowerCase() === user.email.toLowerCase().trim()
  );
  
  try {
    if (!userDoc?.exists()) {
      const assignedRole: 'ADMIN' | 'PATIENT' = isWhitelistedAdmin ? 'ADMIN' : 'PATIENT';
      await setDoc(userRef, {
        id: user.uid,
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'Patient Member',
        name: user.displayName || user.email?.split('@')[0] || 'Patient Member',
        photoURL: user.photoURL || null,
        role: assignedRole,
        createdAt: serverTimestamp(),
        created_at: serverTimestamp(),
        lastLogin: serverTimestamp(),
        isVerified: true
      });
    } else {
      const existingData = userDoc.data();
      const currentRole = isWhitelistedAdmin ? 'ADMIN' : normalizeRole(existingData.role, user.email);
      await setDoc(userRef, { 
        lastLogin: serverTimestamp(),
        role: currentRole,
        displayName: user.displayName || existingData.displayName || user.email?.split('@')[0],
        name: user.displayName || existingData.name || existingData.displayName || user.email?.split('@')[0],
        photoURL: user.photoURL || existingData.photoURL || null,
        isVerified: existingData.isVerified !== undefined ? existingData.isVerified : true
      }, { merge: true });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
  }
}

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await syncUserRecord(result.user);
    return result.user;
  } catch (error: any) {
    console.error("Auth Error:", error);
    if (error.code === 'auth/popup-blocked') {
      alert("Popup blocked! Please allow popups for this site or open in a new tab.");
    }
    throw error;
  }
};

export const registerWithEmail = async (email: string, pass: string, name: string) => {
  try {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(res.user, { displayName: name });
    await syncUserRecord(res.user);
    return res.user;
  } catch (error) {
    console.error("Register Error:", error);
    throw error;
  }
};

export const loginWithEmail = async (email: string, pass: string) => {
  try {
    const res = await signInWithEmailAndPassword(auth, email, pass);
    await syncUserRecord(res.user);
    return res.user;
  } catch (error) {
    console.error("Login Error:", error);
    throw error;
  }
};

