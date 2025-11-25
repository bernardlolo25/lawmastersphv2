'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getDatabase, type Database } from 'firebase/database';

let firebaseApp: FirebaseApp;
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp();
}

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

// Safely initialize Realtime Database only on the client-side
let database: Database | null = null;
if (typeof window !== 'undefined' && firebaseConfig.databaseURL) {
    database = getDatabase(firebaseApp);
}

export function initializeFirebase() {
  return {
    firebaseApp,
    auth,
    firestore,
    database,
  };
}

// Re-export other necessary hooks and providers
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';
