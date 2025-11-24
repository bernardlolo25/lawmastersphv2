
'use client';

import * as React from 'react';
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth, useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { addDoc, collection, doc, getDoc, limit, orderBy, query, serverTimestamp, getDocs } from 'firebase/firestore';
import type { Feedback as FeedbackType, UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User as UserIcon, Send } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AuthDialog } from '@/components/auth/auth-dialog';

interface EnrichedFeedback extends FeedbackType {
    userProfile?: Pick<UserProfile, 'username' | 'firstName' | 'lastName' | 'displayNamePreference' | 'avatarUrl'>;
}


function FeedbackSkeleton() {
    return (
        <div className="space-y-6">
            {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                    <Avatar>
                        <AvatarFallback><Loader2 className="animate-spin h-4 w-4"/></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-1/4" />
                        <div className="h-4 bg-muted rounded w-full" />
                        <div className="h-4 bg-muted rounded w-3/4" />
                    </div>
                </div>
            ))}
        </div>
    );
}


function RecentFeedbackSection() {
    const firestore = useFirestore();
    const { toast } = useToast();

    const feedbackQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'feedback'), orderBy('submissionDate', 'desc'), limit(5));
    }, [firestore]);

    const fetchFeedbackWithProfiles = async () => {
        if (!feedbackQuery || !firestore) return [];

        try {
            const feedbackSnapshot = await getDocs(feedbackQuery);
            if (feedbackSnapshot.empty) {
                return [];
            }

            const feedbackData = feedbackSnapshot.docs.map(d => ({ ...d.data(), id: d.id } as FeedbackType));

            const enrichedFeedbackPromises = feedbackData.map(async (feedback) => {
                if (!feedback.userProfileId) {
                    return { ...feedback, userProfile: { firstName: 'Anonymous' } } as EnrichedFeedback;
                }
                
                try {
                    const profileRef = doc(firestore, 'users', feedback.userProfileId);
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) {
                        return { ...feedback, userProfile: profileSnap.data() as UserProfile };
                    }
                } catch (e) {
                     console.error(`Failed to fetch profile for user ${feedback.userProfileId}`, e);
                }
                
                return { ...feedback, userProfile: { firstName: 'User' } } as EnrichedFeedback;
            });
            
            return await Promise.all(enrichedFeedbackPromises);
        } catch (error: any) {
            // Only show toast on actual error, not just an empty collection
             if (error.code !== 'permission-denied') { // Example of a real error to check for
                toast({
                    variant: 'destructive',
                    title: 'Error loading feedback',
                    description: 'Could not fetch recent feedback. Please try again later.'
                });
             }
            // We throw the error so react-query can handle the error state
            throw error;
        }
    };
    
    const { data: recentFeedback, isLoading, isError } = useQuery<EnrichedFeedback[]>({
        queryKey: ['recentFeedback'],
        queryFn: fetchFeedbackWithProfiles,
        enabled: !!firestore,
        retry: false, // Don't retry on error, we show a message
    });
    
     const getDisplayName = (profile?: EnrichedFeedback['userProfile']) => {
        if (!profile) return 'Anonymous';
        if (profile.displayNamePreference === 'username' && profile.username) return profile.username;
        if (profile.firstName && profile.lastName) return `${profile.firstName} ${profile.lastName}`;
        return profile.username || profile.firstName || 'Anonymous';
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Recent Feedback</CardTitle>
                <CardDescription>
                    Here's what other users are saying.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {isLoading && <FeedbackSkeleton />}
                {!isLoading && !isError && recentFeedback && recentFeedback.length > 0 ? (
                    recentFeedback.map((item) => (
                        <div key={item.id} className="flex items-start gap-4">
                            <Avatar>
                                <AvatarImage src={item.userProfile?.avatarUrl} alt={getDisplayName(item.userProfile)} />
                                <AvatarFallback>
                                    {item.userProfile ? getDisplayName(item.userProfile).charAt(0).toUpperCase() : <UserIcon />}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="font-semibold">{getDisplayName(item.userProfile)}</p>
                                <p className="text-sm text-muted-foreground">
                                    {item.message}
                                </p>
                            </div>
                        </div>
                    ))
                 ) : (
                    !isLoading && <p className="text-center text-muted-foreground py-8">No feedback has been submitted yet.</p>
                 )}
            </CardContent>
        </Card>
    )
}

function FeedbackForm() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [message, setMessage] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isAuthDialogOpen, setIsAuthDialogOpen] = React.useState(false);

    const profanityList = ['arse', 'damn', 'hell', 'bitch', 'asshole', 'fuck']; // Add more words as needed

    const containsProfanity = (text: string) => {
        const lowerCaseText = text.toLowerCase();
        return profanityList.some(word => lowerCaseText.includes(word));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user) {
            setIsAuthDialogOpen(true);
            return;
        }
        if (!firestore || !message.trim()) return;

        if (containsProfanity(message)) {
            toast({
                variant: 'destructive',
                title: 'Inappropriate Language Detected',
                description: 'Please avoid using harsh or profane words in your feedback.',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const feedbackData = {
                userProfileId: user.uid,
                submissionDate: serverTimestamp(),
                message: message.trim(),
                status: 'new'
            };
            await addDoc(collection(firestore, 'feedback'), feedbackData);
            toast({
                title: 'Feedback Sent!',
                description: "Thank you for helping us improve.",
            });
            setMessage('');
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Submission Failed',
                description: error.message || "An unknown error occurred.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
         <>
            <Card>
                <form onSubmit={handleSubmit}>
                    <CardHeader>
                        <CardTitle>Submit Feedback</CardTitle>
                        <CardDescription>
                            Have a suggestion or encountered an issue? Let us know.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid w-full gap-2">
                            <Label htmlFor="feedback">Your Message</Label>
                            <Textarea
                                id="feedback"
                                name="feedback"
                                placeholder={user ? "Type your feedback here..." : "Please log in to submit feedback."}
                                rows={5}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                disabled={!user || isSubmitting}
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={!user || isSubmitting || !message.trim()}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
            <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
         </>
    )
}

export default function FeedbackPage() {
  return (
    <MainLayout>
      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
            <h2 className="font-headline text-2xl font-semibold">Share Your Thoughts</h2>
            <p className="mt-2 text-muted-foreground">We value your input. Help us make LegalMasters PH even better.</p>
        </div>
        <div className="md:col-span-2 space-y-8">
            <FeedbackForm />
            <RecentFeedbackSection />
        </div>
      </div>
    </MainLayout>
  );
}
