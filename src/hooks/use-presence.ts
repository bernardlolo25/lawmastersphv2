'use client';

import { useEffect, useState } from 'react';
import { useFirebase, useUser } from '@/firebase';
import { onValue, ref, serverTimestamp, set, onDisconnect } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

interface PresenceUser {
  id: string;
  state: 'online' | 'offline' | 'in-game' | 'idle';
  last_changed: number;
  displayName: string;
  avatarUrl?: string;
}

/**
 * Manages the current user's presence status in the Realtime Database.
 * This is the definitive hook for presence management, based on official Firebase patterns.
 */
export function usePresence() {
  const { user } = useUser();
  const { database, firestore } = useFirebase();
  const pathname = usePathname();

  useEffect(() => {
    // CRITICAL FIX: If the database is not initialized (e.g., missing URL), do nothing.
    // This prevents the entire app from crashing on deployment or client-side.
    if (!user || !database) {
      return;
    }

    // Reference to this user's status node in the Realtime Database.
    const userStatusDatabaseRef = ref(database, `/status/${user.uid}`);
    
    // Reference to the special '.info/connected' node which is a boolean 
    // indicating the client's connection status to the Firebase Realtime Database servers.
    const connectedRef = ref(database, '.info/connected');

    const unsubscribe = onValue(connectedRef, async (snap) => {
      if (snap.val() === false) {
        // We're not connected. If we wanted to manually handle this, we would,
        // but onDisconnect is the primary mechanism.
        return;
      }
        
      // --- We are connected ---
      
      const userProfileRef = doc(firestore, 'users', user.uid);
      
      try {
        const profileSnap = await getDoc(userProfileRef);
        let userProfile: UserProfile | null = null;
        if(profileSnap.exists()) {
            userProfile = profileSnap.data() as UserProfile;
        }

        const displayName = (userProfile?.displayNamePreference === 'username' && userProfile.username)
            ? userProfile.username
            : (userProfile?.firstName && userProfile.lastName ? `${userProfile.firstName} ${userProfile.lastName}` : userProfile?.firstName || 'Anonymous');

        // 1. Create the data that will be written to the database when this client disconnects.
        const offlineStatus = {
          state: 'offline',
          last_changed: serverTimestamp(),
          displayName: displayName,
          avatarUrl: userProfile?.avatarUrl || '',
        };
        await onDisconnect(userStatusDatabaseRef).set(offlineStatus);
        
        const state = pathname.startsWith('/multiplayer/match/') ? 'in-game' : 'online';

        // 4. Create the final status object to write to the database.
        const onlineStatus = {
          state: state,
          last_changed: serverTimestamp(),
          displayName: displayName,
          avatarUrl: userProfile?.avatarUrl || '',
        };
        
        // 5. Finally, after setting up the disconnect behavior, set the user's status to online.
        await set(userStatusDatabaseRef, onlineStatus);
      } catch (e) {
        // This might happen if there are temporary network issues fetching the profile.
        // The onDisconnect is still set, so this is not critical.
        console.error("Error setting online presence:", e);
      }
    });

    // Cleanup function when the component unmounts or dependencies change.
    return () => {
      unsubscribe(); // Detach the '.info/connected' listener.
    };
  }, [user, database, firestore, pathname]);
}


/**
 * Hook to fetch the list of all users who are currently online or in-game.
 * @returns An object from react-query with data, isLoading, etc.
 */
export function useOnlineUsers() {
    const { database } = useFirebase();

    const fetchOnlineUsers = async () => {
        // CRITICAL FIX: If the database is not initialized, return an empty array.
        if (!database) return [];

        const statusRef = ref(database, 'status');
        const snapshot = await new Promise<any>((resolve) => onValue(statusRef, resolve, { onlyOnce: true }));
        
        const users: PresenceUser[] = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot: any) => {
                const userStatus = childSnapshot.val();
                if (userStatus.state === 'online' || userStatus.state === 'in-game') {
                    users.push({
                        id: childSnapshot.key,
                        ...userStatus
                    });
                }
            });
        }
        return users;
    };

    return useQuery<PresenceUser[], Error>({
        queryKey: ['onlineUsers'],
        queryFn: fetchOnlineUsers,
        enabled: !!database,
        refetchInterval: 15000, // Refetch every 15 seconds
    });
}

/**
 * Hook to monitor the client's connection status to Firebase.
 * @returns An object with `isConnected` boolean.
 */
export function useConnectionStatus() {
    const [isConnected, setIsConnected] = useState(true);
    const { database } = useFirebase();

    useEffect(() => {
        // CRITICAL FIX: If the database is not initialized, assume not connected and do nothing.
        if (!database) {
            setIsConnected(false);
            return;
        };
        const connectedRef = ref(database, '.info/connected');

        const unsubscribe = onValue(connectedRef, (snap) => {
            setIsConnected(snap.val() === true);
        });

        return () => unsubscribe();
    }, [database]);

    return { isConnected };
}
