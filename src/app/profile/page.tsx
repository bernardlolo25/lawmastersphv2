
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MainLayout } from '@/components/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, User as UserIcon, Check, BadgePercent, Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  username: z.string().min(3, 'Username must be at least 3 characters').optional().or(z.literal('')),
  displayNamePreference: z.enum(['fullName', 'username']).default('fullName'),
  leaderboardAnonymity: z.boolean().default(false),
  userType: z.enum(['student', 'professional', 'admin']),
  schoolFirm: z.string().optional(),
  bio: z.string().max(300, 'Bio must be 300 characters or less').optional(),
  avatarUrl: z.string().url('Please enter a valid URL.').optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const ADMIN_EMAIL = 'bernardlolo25@gmail.com';

const builtInAvatars = [
    'https://picsum.photos/seed/avatar1/128/128',
    'https://picsum.photos/seed/avatar2/128/128',
    'https://picsum.photos/seed/avatar3/128/128',
    'https://picsum.photos/seed/avatar4/128/128',
    'https://picsum.photos/seed/avatar5/128/128',
    'https://picsum.photos/seed/avatar6/128/128',
];

function ProfileSkeleton() {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <Skeleton className="h-24 w-24 rounded-full" />
        <Skeleton className="h-8 w-48 mt-4" />
        <Skeleton className="h-4 w-32 mt-2" />
      </CardHeader>
      <CardContent className="mt-6 space-y-4">
         <div className="flex justify-between items-center"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-6 w-1/2" /></div>
         <div className="flex justify-between items-center"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-6 w-1/2" /></div>
         <div className="flex justify-between items-center"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-12 w-1/2" /></div>
      </CardContent>
    </Card>
  );
}


export default function ProfilePage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isEditing, setIsEditing] = React.useState(false);
    const [avatarSelectionMode, setAvatarSelectionMode] = React.useState<'url' | 'select'>('select');


    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, `users/${user.uid}`);
    }, [firestore, user]);

    const { data: userProfile, isLoading: isProfileLoading } = useDoc<ProfileFormData>(userProfileRef);

    const form = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            firstName: '', lastName: '', username: '', displayNamePreference: 'fullName',
            leaderboardAnonymity: false, userType: 'student', schoolFirm: '', bio: '', avatarUrl: ''
        },
    });

    React.useEffect(() => {
        if (userProfile) {
            form.reset(userProfile);
             if (userProfile.avatarUrl && !builtInAvatars.includes(userProfile.avatarUrl)) {
                setAvatarSelectionMode('url');
            }
        } else if (user?.email === ADMIN_EMAIL) {
            form.setValue('userType', 'admin');
        }
         if (!isEditing) { // If we switch to view mode, reset form to stored values
            if (userProfile) form.reset(userProfile);
        }
    }, [userProfile, form, user, isEditing]);

    const getDisplayName = (data: Partial<ProfileFormData> = userProfile ?? {}) => {
        const { displayNamePreference, username, firstName, lastName } = data;
        if (displayNamePreference === 'username' && username) return username;
        if (firstName && lastName) return `${firstName} ${lastName}`;
        return username || firstName || user?.email || 'Legal Eagle';
    };

    const onSubmit = async (data: ProfileFormData) => {
        if (!userProfileRef || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Cannot update profile.' });
            return;
        }
        
        const finalUserType = user.email === ADMIN_EMAIL ? 'admin' : data.userType;

        const dataToSave = {
            ...data,
            id: user.uid, userId: user.uid, email: user.email, userType: finalUserType,
            updatedAt: serverTimestamp(),
            ...(!userProfile && { createdAt: serverTimestamp() })
        };

        setDoc(userProfileRef, dataToSave, { merge: true })
            .then(() => {
                toast({ title: 'Success', description: 'Your profile has been updated.' });
                setIsEditing(false);
            })
            .catch((serverError) => {
                 const permissionError = new FirestorePermissionError({
                    path: userProfileRef.path,
                    operation: userProfile ? 'update' : 'create',
                    requestResourceData: dataToSave,
                 });
                 errorEmitter.emit('permission-error', permissionError);
            });
    };

    const isLoading = isUserLoading || (user && isProfileLoading);

    if (isLoading) {
        return (
             <MainLayout>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-12 w-12 animate-spin" />
                </div>
            </MainLayout>
        );
    }
    
    if (!user) {
        // This is a failsafe. MainLayout should handle the redirect.
        return (
            <MainLayout>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-12 w-12 animate-spin" />
                </div>
            </MainLayout>
        )
    }

    if (!isEditing && !isProfileLoading && !userProfile) {
        // If profile doesn't exist and we are not loading, force edit mode.
        setIsEditing(true);
    }

    if (!isEditing) {
        return (
            <MainLayout>
                <div className="mx-auto max-w-3xl space-y-8">
                     <div className="space-y-2 flex justify-between items-start">
                        <div>
                            <h2 className="font-headline text-3xl font-bold">My Profile</h2>
                            <p className="text-muted-foreground">Your personal information and preferences.</p>
                        </div>
                        <Button onClick={() => setIsEditing(true)}><Edit className="mr-2 h-4 w-4" /> Edit Profile</Button>
                    </div>

                    <Card>
                        <CardHeader className="items-center text-center pb-4">
                            <Avatar className="h-24 w-24 text-4xl">
                                <AvatarImage src={userProfile?.avatarUrl} alt={getDisplayName()} />
                                <AvatarFallback>{getDisplayName().charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <CardTitle className="text-2xl pt-4">{getDisplayName()}</CardTitle>
                            <CardDescription className="capitalize">{userProfile?.userType} {userProfile?.schoolFirm && ` at ${userProfile.schoolFirm}`}</CardDescription>
                        </CardHeader>
                        <CardContent className="mt-6 border-t pt-6">
                            <div className="space-y-4 text-sm">
                                <div className="grid grid-cols-3 gap-4">
                                    <span className="font-medium text-muted-foreground">Full Name</span>
                                    <span className="col-span-2">{userProfile?.firstName} {userProfile?.lastName}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <span className="font-medium text-muted-foreground">Username</span>
                                    <span className="col-span-2">{userProfile?.username || 'Not set'}</span>
                                </div>
                                 <div className="grid grid-cols-3 gap-4">
                                    <span className="font-medium text-muted-foreground">Email</span>
                                    <span className="col-span-2">{user.email}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4 items-center">
                                    <span className="font-medium text-muted-foreground">Leaderboard</span>
                                    <div className="col-span-2 flex items-center gap-2">
                                        {userProfile?.leaderboardAnonymity ? (
                                            <>
                                                <EyeOff className="h-4 w-4" />
                                                <span>Anonymous</span>
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="h-4 w-4" />
                                                <span>Public</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                 <div className="grid grid-cols-3 gap-4">
                                    <span className="font-medium text-muted-foreground">Bio</span>
                                    <p className="col-span-2 whitespace-pre-line">{userProfile?.bio || 'No bio yet.'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="mx-auto max-w-3xl space-y-8">
                <div className="space-y-2">
                    <h2 className="font-headline text-3xl font-bold">{userProfile ? 'Edit Profile' : 'Create Your Profile'}</h2>
                    <p className="text-muted-foreground">{userProfile ? 'Update your personal information.' : 'Please complete your profile to continue.'}</p>
                </div>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <Card>
                             <CardHeader><CardTitle>Avatar</CardTitle></CardHeader>
                             <CardContent className="space-y-4">
                                 <Controller
                                    control={form.control}
                                    name="avatarUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <RadioGroup onValueChange={setAvatarSelectionMode} value={avatarSelectionMode} className="mb-4 flex gap-4">
                                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="select"/></FormControl><FormLabel>Select an Avatar</FormLabel></FormItem>
                                                <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="url"/></FormControl><FormLabel>Use a URL</FormLabel></FormItem>
                                            </RadioGroup>
                                            
                                            {avatarSelectionMode === 'select' ? (
                                                <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
                                                    {builtInAvatars.map(avatar => (
                                                        <button type="button" key={avatar} onClick={() => field.onChange(avatar)} className={cn('rounded-full ring-2 ring-offset-2 ring-offset-background', field.value === avatar ? 'ring-primary' : 'ring-transparent')}>
                                                            <Avatar className="h-16 w-16"><AvatarImage src={avatar} /></Avatar>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <FormControl><Input placeholder="https://example.com/image.png" value={field.value ?? ''} onChange={field.onChange} /></FormControl>
                                            )}
                                        </FormItem>
                                    )}
                                 />
                                  <FormMessage>{form.formState.errors.avatarUrl?.message}</FormMessage>
                             </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle>Profile Details</CardTitle></CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                                <FormField control={form.control} name="username" render={({ field }) => (<FormItem><FormLabel>Username</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>Your unique username on the platform.</FormDescription><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="displayNamePreference" render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>Display Name Preference</FormLabel>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="fullName" /></FormControl><FormLabel className="font-normal">Full Name (e.g., {form.watch('firstName') || 'Jane'} {form.watch('lastName') || 'Doe'})</FormLabel></FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="username" disabled={!form.watch('username')} /></FormControl><FormLabel className="font-normal">Username (e.g., {form.watch('username') || 'janedoe123'})</FormLabel></FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <Separator />
                                <FormField control={form.control} name="leaderboardAnonymity" render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>Leaderboard Privacy</FormLabel>
                                        <FormDescription>Choose how your name appears on public leaderboards.</FormDescription>
                                        <FormControl>
                                            <RadioGroup onValueChange={(value) => field.onChange(value === 'true')} value={String(field.value)} className="flex flex-col space-y-1">
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl><RadioGroupItem value="false" /></FormControl>
                                                    <FormLabel className="font-normal flex items-center gap-2"><Eye className="h-4 w-4" /> Public (Show my name)</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl><RadioGroupItem value="true" /></FormControl>
                                                    <FormLabel className="font-normal flex items-center gap-2"><EyeOff className="h-4 w-4" /> Anonymous (Appear as "Anonymous")</FormLabel>
                                                </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <Separator />
                                <FormField control={form.control} name="userType" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>I am a...</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={user.email === ADMIN_EMAIL}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select your role" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="student">Student</SelectItem>
                                                <SelectItem value="professional">Legal Professional</SelectItem>
                                                {user.email === ADMIN_EMAIL && <SelectItem value="admin">Admin</SelectItem>}
                                            </SelectContent>
                                        </Select>
                                        {user.email === ADMIN_EMAIL && <FormDescription>Your user type is automatically set to Admin.</FormDescription>}
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={form.control} name="schoolFirm" render={({ field }) => (<FormItem><FormLabel>School or Firm</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>The name of your current school or law firm.</FormDescription><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name="bio" render={({ field }) => (<FormItem><FormLabel>Bio</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormDescription>A short description about yourself.</FormDescription><FormMessage /></FormItem>)}/>
                            </CardContent>
                            <CardFooter className="gap-4">
                                <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}</Button>
                                {userProfile && <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>}
                            </CardFooter>
                        </Card>
                    </form>
                </Form>
            </div>
        </MainLayout>
    );
}
