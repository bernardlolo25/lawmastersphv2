
'use client';

import * as React from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';
import { MainLayout } from '@/components/main-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { UserDashboard } from './user-dashboard';
import { AdminDashboard } from './admin-dashboard';
import { AuthDialog } from '@/components/auth/auth-dialog';
import type { UserProfile } from '@/lib/types';


function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    )
}

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isAuthDialogOpen, setIsAuthDialogOpen] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    // User profiles are stored directly in the /users/{userId} document
    return doc(firestore, `users`, user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);
  
  const handleAuthDialogOpen = () => setIsAuthDialogOpen(true);

  const isLoading = isUserLoading || (user && isProfileLoading);
  const isAdminByEmail = user?.email === 'bernardlolo25@gmail.com';
  const isAdminByProfile = userProfile?.userType === 'admin';

  // Render the skeleton while any data is loading.
  if (isLoading) {
    return (
        <MainLayout onAuthDialogOpen={handleAuthDialogOpen}>
            <DashboardSkeleton />
        </MainLayout>
    );
  }

  // Once loading is complete, check the user type.
  // If user is an admin, show the AdminDashboard
  if (user && (isAdminByProfile || isAdminByEmail)) {
    return <AdminDashboard onAuthDialogOpen={handleAuthDialogOpen} />;
  }
  
  // Otherwise, show the regular UserDashboard for guests or non-admin users.
  return (
    <>
        <UserDashboard onAuthDialogOpen={handleAuthDialogOpen} />
        <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
    </>
  );
}
