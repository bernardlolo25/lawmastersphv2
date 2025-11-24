'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

// A private variable to hold the memoized SDKs.
let firebaseServices: any = null;

export function initializeFirebase() {
  // This check ensures that Firebase is only initialized once.
  if (firebaseServices) {
    return firebaseServices;
  }

  // Get the Firebase App instance, initializing it if it doesn't exist.
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  // Initialize core services that are safe on the server.
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  let database = null;

  // --- CRITICAL FIX ---
  // The Realtime Database SDK should only be initialized in the browser (client-side)
  // where `window` is defined. This prevents the build server from crashing.
  if (typeof window !== 'undefined' && firebaseConfig.databaseURL) {
    database = getDatabase(app);
  }

  firebaseServices = {
    firebaseApp: app,
    auth: auth,
    firestore: firestore,
    database: database,
  };

  return firebaseServices;
}

export function getSdks(firebaseApp: FirebaseApp) {
  // This function is now a compatibility layer but initializeFirebase is preferred.
  // We call initializeFirebase to ensure the safe, conditional logic is always used.
  return initializeFirebase();
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
