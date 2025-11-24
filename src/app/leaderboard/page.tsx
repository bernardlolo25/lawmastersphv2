
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useDoc, useMemoFirebase, useUser, useCollection } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import type { GameResult, UserProfile, Topic, SiteSettings } from '@/lib/types';
import { Crown, Medal, Trophy, Loader2, User as UserIcon, LogIn } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type GameMode = "timed" | "survival" | "lightning" | "boss";

interface LeaderboardListProps {
    gameMode: GameMode;
    topicId: string;
}

interface EnrichedGameResult extends GameResult {
    id: string;
    userProfile?: Pick<UserProfile, 'username' | 'firstName' | 'lastName' | 'displayNamePreference' | 'avatarUrl' | 'leaderboardAnonymity'>;
    topicName?: string;
}

function getRankColor(rank: number) {
    if (rank === 1) return "text-yellow-500";
    if (rank === 2) return "text-gray-400";
    if (rank === 3) return "text-orange-600";
    return "text-muted-foreground";
}

function LeaderboardList({ gameMode, topicId }: LeaderboardListProps) {
    const firestore = useFirestore();

    const fetchLeaderboardData = async () => {
        if (!firestore) throw new Error("Firestore is not available.");
        
        const gameResultsQuery = query(
            collection(firestore, 'game_results'),
            where('gameMode', '==', gameMode),
            limit(100)
        );

        const gameResultsSnapshot = await getDocs(gameResultsQuery);
        let gameResults = gameResultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameResult & {id: string}));

        // Client-side sorting and filtering
        gameResults.sort((a, b) => b.score - a.score);

        if (topicId !== 'all') {
            gameResults = gameResults.filter(result => result.topicId === topicId);
        }
        
        const topResults = gameResults.slice(0, 25);

        if (topResults.length === 0) {
            return [];
        }

        const userIds = [...new Set(topResults.map(r => r.userId))];
        const topicIds = [...new Set(topResults.map(r => r.topicId))];

        const userProfilePromises = userIds.map(async (userId) => {
            try {
                const profileRef = doc(firestore, `users`, userId);
                const profileSnap = await getDoc(profileRef);
                if (profileSnap.exists()) {
                    return { userId, profile: profileSnap.data() as UserProfile };
                }
            } catch (e) {
                console.error(`Failed to fetch profile for user ${userId}:`, e);
            }
            return { userId, profile: null };
        });
        
        const topicPromises = topicIds.map(async (id) => {
            const topicRef = doc(firestore, 'legal_topics', id);
            const topicSnap = await getDoc(topicRef);
            return { id, topic: topicSnap.exists() ? topicSnap.data() as Topic : null };
        });
        
        const userProfilesData = await Promise.all(userProfilePromises);
        const topicsData = await Promise.all(topicPromises);

        const userProfilesMap = new Map(userProfilesData.map(d => [d.userId, d.profile]));
        const topicsMap = new Map(topicsData.map(d => [d.id, d.topic]));


        const enrichedResults: EnrichedGameResult[] = topResults.map(result => ({
            ...result,
            userProfile: userProfilesMap.get(result.userId) || undefined,
            topicName: topicsMap.get(result.topicId)?.name || 'Unknown Topic',
        }));

        return enrichedResults;
    };

    const { data: results, isLoading, error } = useQuery<EnrichedGameResult[], Error>({
        queryKey: ['leaderboard', gameMode, topicId],
        queryFn: fetchLeaderboardData,
        enabled: !!firestore,
    });
    
    const getDisplayName = (profile?: EnrichedGameResult['userProfile']) => {
        if (!profile || profile.leaderboardAnonymity === true) {
            return 'Anonymous';
        }
        
        if (profile.displayNamePreference === 'username' && profile.username) {
            return profile.username;
        }
        if (profile.firstName && profile.lastName) {
            return `${profile.firstName} ${profile.lastName}`;
        }
        
        return profile.username || profile.firstName || 'Anonymous Player';
    };


    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    if (error) {
      return (
        <Alert variant="destructive">
            <AlertTitle>Error Loading Leaderboard</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )
    }
    
    if (!results || results.length === 0) {
        return <p className="text-center text-muted-foreground py-8">No results yet for this filter. Be the first!</p>
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[50px]">Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {results.map((result, index) => {
                    const displayName = getDisplayName(result.userProfile);
                    const isAnonymous = displayName === 'Anonymous' || displayName === 'Anonymous Player';

                    return (
                        <TableRow key={result.id}>
                            <TableCell className="font-bold text-lg">
                               <span className={getRankColor(index + 1)}>
                                    {index === 0 ? <Crown className="h-6 w-6" /> : index === 1 ? <Medal className="h-6 w-6" /> : index === 2 ? <Trophy className="h-6 w-6" /> : index + 1}
                               </span>
                            </TableCell>
                            <TableCell>
                               <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                        {!isAnonymous && <AvatarImage src={result.userProfile?.avatarUrl} alt={displayName} />}
                                        <AvatarFallback>
                                            {isAnonymous ? <UserIcon className="h-4 w-4" /> : displayName.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{displayName}</span>
                               </div>
                            </TableCell>
                            <TableCell>{result.topicName}</TableCell>
                            <TableCell className="text-right font-bold text-primary">{result.score.toLocaleString()}</TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>
    );
}


export default function LeaderboardPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const [selectedTopicId, setSelectedTopicId] = React.useState<string>('all');
    
    const siteSettingsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'site_content', 'site_settings');
    }, [firestore]);
    const { data: siteSettings, isLoading: isLoadingSiteSettings } = useDoc<SiteSettings>(siteSettingsRef);
    
    const topicsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'legal_topics'), orderBy('displayOrder'));
    }, [firestore]);
    const { data: topics, isLoading: isLoadingTopics } = useCollection<Topic>(topicsQuery);


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
    
    if (siteSettings && siteSettings.isLeaderboardEnabled === false) {
        return (
             <MainLayout>
                <Card className="text-center">
                    <CardHeader>
                        <Trophy className="mx-auto h-16 w-16 text-muted-foreground" />
                        <CardTitle className="mt-4 text-3xl font-headline">Coming Soon!</CardTitle>
                        <CardDescription>The leaderboards are currently under maintenance. Please check back later.</CardDescription>
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
          <CardTitle className="font-headline text-3xl">Leaderboards</CardTitle>
          <CardDescription>See how you stack up against other players across different game modes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 max-w-sm space-y-2">
            <Label htmlFor="topic-filter">Filter by Topic</Label>
            <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
                <SelectTrigger id="topic-filter">
                    <SelectValue placeholder="Filter by topic..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Topics</SelectItem>
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
          <Tabs defaultValue="timed" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="timed">Timed</TabsTrigger>
              <TabsTrigger value="survival">Survival</TabsTrigger>
              <TabsTrigger value="lightning">Lightning</TabsTrigger>
              <TabsTrigger value="boss">Boss Battle</TabsTrigger>
            </TabsList>
            <TabsContent value="timed">
                <LeaderboardList gameMode="timed" topicId={selectedTopicId} />
            </TabsContent>
            <TabsContent value="survival">
                 <LeaderboardList gameMode="survival" topicId={selectedTopicId} />
            </TabsContent>
            <TabsContent value="lightning">
                 <LeaderboardList gameMode="lightning" topicId={selectedTopicId} />
            </TabsContent>
             <TabsContent value="boss">
                 <LeaderboardList gameMode="boss" topicId={selectedTopicId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
