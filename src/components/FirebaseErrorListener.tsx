'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * In a development environment, it throws any received error to be caught by Next.js's global-error.tsx.
 * In production, it does nothing, preventing raw errors from being shown to the user.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    // Only listen for errors in the development environment.
    if (process.env.NODE_ENV === 'development') {
      const handleError = (error: FirestorePermissionError) => {
        setError(error);
      };

      errorEmitter.on('permission-error', handleError);

      return () => {
        errorEmitter.off('permission-error', handleError);
      };
    }
  }, []);

  // On re-render, if an error exists in state, throw it.
  // This will only happen in development.
  if (error) {
    throw error;
  }

  // This component renders nothing.
  return null;
}
