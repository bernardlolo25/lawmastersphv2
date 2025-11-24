'use client';

import * as React from 'react';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Users, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EnrichedUserProfile extends UserProfile {
  id: string; // The user's UID
}

function UserManagementTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <div className="w-1/3">
            <div className="h-10 bg-muted rounded-md" />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead><div className="h-5 w-24 bg-muted rounded-md" /></TableHead>
            <TableHead><div className="h-5 w-24 bg-muted rounded-md" /></TableHead>
            <TableHead><div className="h-5 w-24 bg-muted rounded-md" /></TableHead>
            <TableHead><div className="h-5 w-24 bg-muted rounded-md" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><div className="h-8 w-full bg-muted rounded-md" /></TableCell>
              <TableCell><div className="h-8 w-full bg-muted rounded-md" /></TableCell>
              <TableCell><div className="h-8 w-full bg-muted rounded-md" /></TableCell>
              <TableCell><div className="h-8 w-full bg-muted rounded-md" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function UserManagement() {
  const firestore = useFirestore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState('');

  const fetchUsers = async (): Promise<EnrichedUserProfile[]> => {
    if (!firestore) return [];
    
    // Fetch all documents from the top-level 'users' collection.
    const usersCollectionRef = collection(firestore, 'users');
    const usersSnapshot = await getDocs(usersCollectionRef);

    if (usersSnapshot.empty) {
      return [];
    }
    
    const usersList: EnrichedUserProfile[] = usersSnapshot.docs.map(doc => {
        const data = doc.data() as UserProfile;
        return {
            id: doc.id,
            ...data,
            // Provide default values for any missing profile fields if necessary
            userId: data.userId || doc.id,
            email: data.email,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            userType: data.userType || 'student',
        };
    });

    return usersList;
  };

  const { data: users, isLoading } = useQuery<EnrichedUserProfile[]>({
    queryKey: ['adminUsers'],
    queryFn: fetchUsers,
    enabled: !!firestore,
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string, newRole: 'student' | 'professional' | 'admin' }) => {
      if (!firestore) throw new Error('Firestore not available');
      // The user profile is the document itself in the 'users' collection.
      const userDocRef = doc(firestore, 'users', userId);
      await updateDoc(userDocRef, { userType: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast({ title: 'Success', description: 'User role updated successfully.' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleRoleChange = (userId: string, newRole: 'student' | 'professional' | 'admin') => {
    updateUserRoleMutation.mutate({ userId, newRole });
  };
  
  const getDisplayName = (profile: EnrichedUserProfile) => {
      if (!profile) return 'Anonymous';
      if (profile.displayNamePreference === 'username' && profile.username) return profile.username;
      if (profile.firstName && profile.lastName) return `${profile.firstName} ${profile.lastName}`;
      return profile.username || profile.firstName || 'Anonymous';
  };

  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    return users.filter(user => {
      const displayName = getDisplayName(user).toLowerCase();
      const email = user.email?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();
      return displayName.includes(search) || email.includes(search);
    });
  }, [users, searchTerm]);

  if (isLoading) {
    return <UserManagementTableSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users /> User Management</CardTitle>
        <CardDescription>View, search, and manage user roles across the application.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search by name or email..." 
            className="pl-10" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length > 0 ? filteredUsers.map(user => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback>
                          {user.firstName ? user.firstName.charAt(0).toUpperCase() : <User />}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{getDisplayName(user)}</p>
                        <p className="text-xs text-muted-foreground">{user.username || 'No username'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.createdAt?.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={user.userType} 
                      onValueChange={(newRole: 'student' | 'professional' | 'admin') => handleRoleChange(user.id, newRole)}
                      disabled={updateUserRoleMutation.isPending && updateUserRoleMutation.variables?.userId === user.id}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
