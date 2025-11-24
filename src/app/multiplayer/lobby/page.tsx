
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, doc, getDoc, updateDoc, getDocs, onSnapshot, limit } from 'firebase/firestore';
import type { Topic, UserProfile, Match, Player, FormattedQuizQuestion, QuizQuestion, SiteSettings } from '@/lib/types';
import { Loader2, Swords, User as UserIcon, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useOnlineUsers } from '@/hooks/use-presence';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

export default function LobbyPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const [challengeTarget, setChallengeTarget] = React.useState<any | null>(null);
    const [isTopicSelectOpen, setIsTopicSelectOpen] = React.useState(false);
    const [isCreatingMatch, setIsCreatingMatch] = React.useState(false);
    const [selectedTopicId, setSelectedTopicId] = React.useState<string>('');
    const [incomingChallenge, setIncomingChallenge] = React.useState<Match | null>(null);

    const { data: onlineUsers, isLoading: isLoadingPresence } = useOnlineUsers();

    const topicsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'legal_topics'));
    }, [firestore]);

    const { data: topics, isLoading: isLoadingTopics } = useCollection<Topic>(topicsQuery);
    
    const siteSettingsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'site_content', 'site_settings');
    }, [firestore]);
    const { data: siteSettings, isLoading: isLoadingSiteSettings } = useDoc<SiteSettings>(siteSettingsRef);

    // Listen for incoming challenges
    React.useEffect(() => {
        if (!firestore || !user) return;
        
        const challengesQuery = query(
            collection(firestore, 'matches'),
            where('opponentId', '==', user.uid),
            where('status', '==', 'waiting')
        );

        const unsubscribe = onSnapshot(challengesQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                 if (change.type === 'added') {
                    const match = { id: change.doc.id, ...change.doc.data() } as Match;
                    setIncomingChallenge(match);
                }
            });
        });

        return () => unsubscribe();
    }, [firestore, user]);
    
    const getDisplayName = (profile?: UserProfile) => {
        if (!profile) return 'Anonymous';
        if (profile.displayNamePreference === 'username' && profile.username) return profile.username;
        if (profile.firstName && profile.lastName) return `${profile.firstName} ${profile.lastName}`;
        return profile.username || profile.firstName || 'Anonymous';
    };

    const handleChallengeClick = (targetUser: any) => {
        if (targetUser.id === user?.uid) {
            toast({ variant: 'destructive', title: "You can't challenge yourself!" });
            return;
        }
        setChallengeTarget(targetUser);
    };
    
    const handleConfirmChallenge = () => {
        // This function now just opens the topic selection dialog
        if (challengeTarget) {
            setIsTopicSelectOpen(true);
        }
    };


    const handleSendChallenge = async () => {
        if (!user || !firestore || !challengeTarget || !selectedTopicId || isCreatingMatch) return;
        
        setIsCreatingMatch(true);
        try {
            const userProfileRef = doc(firestore, `users/${user.uid}`);
            const userProfileSnap = await getDoc(userProfileRef);
            if (!userProfileSnap.exists()) throw new Error("Your user profile was not found.");
            const userProfile = userProfileSnap.data() as UserProfile;

            const selectedTopic = topics?.find(t => t.id === selectedTopicId);
            if (!selectedTopic) throw new Error("Selected topic not found.");
            
            const questionsSnapshot = await getDocs(query(collection(firestore, 'questions'), where('topicId', '==', selectedTopicId), limit(5)));
            const fetchedQuestions = questionsSnapshot.docs.map(d => ({id: d.id, ...d.data()} as QuizQuestion));
            if(fetchedQuestions.length < 5) throw new Error("This topic doesn't have enough questions for a match (minimum 5).");

            const matchQuestions: FormattedQuizQuestion[] = fetchedQuestions
                .sort(() => 0.5 - Math.random())
                .slice(0, 5)
                .map(q => ({
                    id: q.id,
                    question: q.question,
                    options: [q.optionA, q.optionB, q.optionC, q.optionD],
                    correctAnswer: ['A', 'B', 'C', 'D'].indexOf(q.correctAnswer),
                    explanation: q.explanation,
                    difficulty: q.difficulty
                }));

            const challenger: Player = {
                userId: user.uid,
                displayName: getDisplayName(userProfile),
                score: 0,
                answers: [],
            };

            const opponent: Player = {
                userId: challengeTarget.id,
                displayName: challengeTarget.displayName,
                score: 0,
                answers: [],
            };

            const newMatch: Omit<Match, 'id'> = {
                topicId: selectedTopicId,
                topicName: selectedTopic.name,
                players: [challenger, opponent],
                opponentId: challengeTarget.id,
                questions: matchQuestions,
                currentQuestionIndex: 0,
                status: 'waiting',
                winnerId: null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            const matchRef = await addDoc(collection(firestore, 'matches'), newMatch);
            
            toast({ title: 'Challenge Sent!', description: `Waiting for ${challengeTarget.displayName} to respond.` });
            setIsTopicSelectOpen(false);
            setChallengeTarget(null);
            router.push(`/multiplayer/match/${matchRef.id}`);

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to create match', description: error.message });
        } finally {
            setIsCreatingMatch(false);
        }
    };
    
    const handleAcceptChallenge = async () => {
        if (!incomingChallenge || !firestore || !user) return;
        
        const matchRef = doc(firestore, 'matches', incomingChallenge.id);
        
        try {
            await updateDoc(matchRef, {
                status: 'active',
                updatedAt: serverTimestamp(),
            });
            
            router.push(`/multiplayer/match/${incomingChallenge.id}`);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to join match', description: error.message });
        }
    };

    const handleDeclineChallenge = async () => {
        if (!incomingChallenge || !firestore) return;
        const matchRef = doc(firestore, 'matches', incomingChallenge.id);
        try {
            await updateDoc(matchRef, { status: 'declined', updatedAt: serverTimestamp() });
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error declining match', description: error.message });
        } finally {
            setIncomingChallenge(null);
        }
    };

    const isLoading = isLoadingSiteSettings || isUserLoading;

    if (isLoading) {
        return (
            <MainLayout>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-12 w-12 animate-spin" />
                </div>
            </MainLayout>
        )
    }
    
    if ((siteSettings && siteSettings.isMultiplayerEnabled === false)) {
        return (
             <MainLayout>
                <Card className="text-center">
                    <CardHeader>
                        <Swords className="mx-auto h-16 w-16 text-muted-foreground" />
                        <CardTitle className="mt-4 text-3xl font-headline">Coming Soon!</CardTitle>
                        <CardDescription>1v1 Battle is currently under maintenance. Please check back later.</CardDescription>
                    </CardHeader>
                </Card>
            </MainLayout>
        )
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

    return (
        <MainLayout>
            <Card>
                <CardHeader>
                    <CardTitle>1v1 Battle Lobby</CardTitle>
                    <CardDescription>Challenge another player to a real-time quiz battle.</CardDescription>
                </CardHeader>
                <CardContent>
                    <h3 className="text-lg font-semibold mb-4">Online Players</h3>
                    {isLoadingPresence ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : onlineUsers && onlineUsers.length > 1 ? (
                        <div className="space-y-3">
                            {onlineUsers.filter(u => u.id !== user?.uid).map(u => (
                                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarImage src={u.avatarUrl} alt={u.displayName} />
                                            <AvatarFallback>{u.displayName?.charAt(0).toUpperCase() || '?'}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-medium">{u.displayName}</p>
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn(
                                                    "h-2 w-2 rounded-full",
                                                    u.state === 'online' && 'bg-green-500',
                                                    u.state === 'in-game' && 'bg-red-500',
                                                    u.state === 'idle' && 'bg-yellow-500',
                                                )} />
                                                <p className="text-xs text-muted-foreground capitalize">{u.state?.replace('-', ' ') || 'Online'}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <AlertDialog onOpenChange={(open) => !open && setChallengeTarget(null)}>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                size="sm"
                                                onClick={() => handleChallengeClick(u)}
                                                disabled={u.state === 'in-game'}
                                            >
                                                <Swords className="mr-2 h-4 w-4" />
                                                {u.state === 'in-game' ? 'In a Match' : 'Challenge'}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Challenge {u.displayName}?</AlertDialogTitle>
                                                <AlertDialogDescription>Are you sure you want to send a match request to this player?</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleConfirmChallenge}>
                                                    <Swords className="mr-2 h-4 w-4" />
                                                    Yes, Challenge
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <UserIcon className="mx-auto h-12 w-12" />
                            <p className="mt-4">It's quiet in here... No other players are online right now.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Topic Selection Dialog */}
            <AlertDialog open={isTopicSelectOpen} onOpenChange={setIsTopicSelectOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Select a Topic</AlertDialogTitle>
                        <AlertDialogDescription>Choose the subject for your quiz battle against {challengeTarget?.displayName}.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="topic-select">Topic</Label>
                            <Select onValueChange={setSelectedTopicId} value={selectedTopicId}>
                                <SelectTrigger id="topic-select">
                                    <SelectValue placeholder="Select a topic..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {isLoadingTopics ? (
                                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                                    ) : (
                                        topics?.map(topic => (
                                            <SelectItem key={topic.id} value={topic.id}>{topic.name}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedTopicId && (<p className="text-sm text-muted-foreground">{topics?.find(t => t.id === selectedTopicId)?.description}</p>)}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSendChallenge} disabled={!selectedTopicId || isCreatingMatch || isLoadingTopics}>
                            {isCreatingMatch ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Swords className="mr-2 h-4 w-4" />}
                            Send Challenge
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Incoming Challenge Dialog */}
            <AlertDialog open={!!incomingChallenge}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Incoming Challenge!</AlertDialogTitle>
                        <AlertDialogDescription>
                            {incomingChallenge?.players[0]?.displayName} has challenged you to a duel in {incomingChallenge?.topicName}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDeclineChallenge}>Decline</AlertDialogAction>
                        <AlertDialogAction onClick={handleAcceptChallenge}>Accept</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </MainLayout>
    );
}
