'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getDatabase, type Database } from 'firebase/database';

let firebaseApp: FirebaseApp;

// Standard Firebase initialization
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp();
}

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

// Initialize database safely, only if the URL is present
let database: Database | null = null;
if (firebaseConfig.databaseURL) {
  try {
    database = getDatabase(firebaseApp);
  } catch (e) {
    console.error("Could not initialize Firebase Realtime Database:", e);
  }
}

// Export a function to get the initialized services
export function initializeFirebase() {
  return {
    firebaseApp,
    auth,
    firestore,
    database, // This will be null if databaseURL is not set or invalid
  };
}


// Re-export other necessary hooks and providers
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';