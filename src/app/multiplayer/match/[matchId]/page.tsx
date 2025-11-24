
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import type { Match, Player, FormattedQuizQuestion } from '@/lib/types';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Crown, Shield, Swords, AlertCircle, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

function MatchSkeleton() {
    return (
        <Card>
            <CardHeader><CardTitle>Loading Match...</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center h-64">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </CardContent>
        </Card>
    );
}

export default function MatchPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const matchId = params.matchId as string;

    const matchRef = useMemoFirebase(() => {
        if (!firestore || !matchId) return null;
        return doc(firestore, 'matches', matchId);
    }, [firestore, matchId]);

    const { data: match, isLoading, error } = useDoc<Match>(matchRef);
    
    const [isAnswering, setIsAnswering] = React.useState(false);
    const [selectedAnswer, setSelectedAnswer] = React.useState<number | null>(null);

    const playerIndex = match?.players.findIndex(p => p?.userId === user?.uid);
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const player: Player | undefined = match?.players[playerIndex!] as Player;
    const opponent: Player | undefined | null = match?.players[opponentIndex];
    const currentQuestion: FormattedQuizQuestion | undefined = match?.questions[match.currentQuestionIndex];
    const playerHasAnswered = player?.answers.length > match?.currentQuestionIndex!;

    const handleAnswer = async (selectedIndex: number) => {
        if (!matchRef || !match || !user || playerHasAnswered || isAnswering) return;
        
        setIsAnswering(true);
        setSelectedAnswer(selectedIndex);

        const isCorrect = selectedIndex === currentQuestion?.correctAnswer;
        const newScore = player.score + (isCorrect ? 100 : 0);
        
        const updates: any = {};
        updates[`players.${playerIndex}.score`] = newScore;
        updates[`players.${playerIndex}.answers`] = [...player.answers, selectedIndex];
        
        try {
            await updateDoc(matchRef, updates);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error submitting answer', description: e.message });
        } finally {
            setIsAnswering(false);
        }
    };
    
    // Effect to advance the game state
    React.useEffect(() => {
        if (!match || !matchRef || match.status !== 'active') return;

        const allAnswered = match.players.every(p => p && p.answers.length > match.currentQuestionIndex);

        if (allAnswered) {
            const timeout = setTimeout(async () => {
                const isLastQuestion = match.currentQuestionIndex === match.questions.length - 1;
                let updates: any = {};

                if (isLastQuestion) {
                    updates.status = 'finished';
                    const p1Score = match.players[0]!.score;
                    const p2Score = match.players[1]!.score;
                    updates.winnerId = p1Score > p2Score ? match.players[0]!.userId : (p2Score > p1Score ? match.players[1]!.userId : 'draw');
                } else {
                    updates.currentQuestionIndex = match.currentQuestionIndex + 1;
                }
                
                updates.updatedAt = serverTimestamp();
                await updateDoc(matchRef, updates);
                setSelectedAnswer(null);

            }, 3000); // 3 seconds to show results before next question

            return () => clearTimeout(timeout);
        }
    }, [match, matchRef]);

    if (isLoading) return <MainLayout><MatchSkeleton /></MainLayout>;
    if (error) return <MainLayout><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert></MainLayout>;
    if (!match) return <MainLayout><Alert><AlertTitle>Match Not Found</AlertTitle><AlertDescription>The match you are looking for does not exist or has been deleted.</AlertDescription></Alert></MainLayout>;
    
    if (match.status === 'declined') {
        return (
            <MainLayout>
                <Card className="text-center">
                    <CardHeader>
                        <XCircle className="mx-auto h-16 w-16 text-destructive" />
                        <CardTitle className="mt-4">Challenge Declined</CardTitle>
                        <CardDescription>{opponent?.displayName} declined your challenge.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Button onClick={() => router.push('/multiplayer/lobby')}>Back to Lobby</Button>
                    </CardContent>
                </Card>
            </MainLayout>
        );
    }

    if (match.status === 'waiting') {
        return (
            <MainLayout>
                <Card className="text-center">
                    <CardHeader>
                        <CardTitle>Waiting for Opponent</CardTitle>
                        <CardDescription>You have challenged {opponent?.displayName} to a duel in {match.topicName}.</CardDescription>
                    </CardHeader>
                    <CardContent className="py-12">
                        <Loader2 className="h-16 w-16 mx-auto animate-spin text-primary" />
                        <p className="mt-4 text-muted-foreground">The match will begin as soon as they accept...</p>
                    </CardContent>
                </Card>
            </MainLayout>
        );
    }
    
     if (match.status === 'finished') {
        const isWinner = player?.userId === match.winnerId;
        const isDraw = match.winnerId === 'draw';
        
        let title = '';
        if (isDraw) title = "It's a Draw!";
        else if (isWinner) title = 'You are Victorious!';
        else title = 'You Have Been Defeated!';
        
        return (
            <MainLayout>
                <Card className="text-center">
                    <CardHeader>
                        <CardTitle className="text-4xl font-bold">{title}</CardTitle>
                        <CardDescription>Final Score</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex justify-around items-center text-2xl font-semibold">
                            <div className={`p-4 rounded-lg ${isWinner || isDraw ? 'bg-green-100' : 'bg-red-100'}`}>
                                {player?.displayName}: <span className="font-bold text-primary">{player?.score}</span>
                            </div>
                            <div className={`p-4 rounded-lg ${!isWinner || isDraw ? 'bg-green-100' : 'bg-red-100'}`}>
                                {opponent?.displayName}: <span className="font-bold text-primary">{opponent?.score}</span>
                            </div>
                        </div>
                         <Button onClick={() => router.push('/multiplayer/lobby')}>Back to Lobby</Button>
                    </CardContent>
                </Card>
            </MainLayout>
        );
    }

    const opponentHasAnswered = opponent?.answers.length ?? 0 > match.currentQuestionIndex;

    return (
        <MainLayout>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Avatar>
                                <AvatarFallback>{player?.displayName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold">{player?.displayName} (You)</p>
                                <p className="text-lg font-bold text-primary">{player?.score} pts</p>
                            </div>
                        </div>
                         <div className="text-center">
                            <p className="font-bold text-muted-foreground">VS</p>
                         </div>
                         <div className="flex items-center gap-4 text-right">
                             <div>
                                <p className="font-bold">{opponent?.displayName}</p>
                                <p className="text-lg font-bold text-primary">{opponent?.score} pts</p>
                            </div>
                             <Avatar>
                                <AvatarFallback>{opponent?.displayName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    <Progress value={((match.currentQuestionIndex + 1) / match.questions.length) * 100} className="mb-4" />
                    <p className="text-center text-sm text-muted-foreground mb-4">Question {match.currentQuestionIndex + 1} of {match.questions.length}</p>

                    <h3 className="text-xl font-semibold text-center my-6 min-h-[6rem]">{currentQuestion?.question}</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentQuestion?.options.map((option, index) => {
                            const isCorrect = index === currentQuestion.correctAnswer;
                            const isSelectedByPlayer = index === selectedAnswer;
                            const bothAnswered = playerHasAnswered && opponentHasAnswered;
                            
                            let stateClass = "bg-card hover:bg-muted";
                            if(bothAnswered) {
                                if (isCorrect) stateClass = "bg-green-200 border-green-500 text-green-900";
                                else stateClass = "bg-card opacity-60";
                            } else if (playerHasAnswered) {
                                if(isSelectedByPlayer && isCorrect) stateClass = "bg-green-200 border-green-500";
                                else if (isSelectedByPlayer && !isCorrect) stateClass = "bg-red-200 border-red-500";
                                else stateClass = "bg-card opacity-60";
                            }

                             return (
                                <Button
                                    key={index}
                                    variant="outline"
                                    className={`h-auto whitespace-normal p-4 justify-start text-left ${stateClass}`}
                                    onClick={() => handleAnswer(index)}
                                    disabled={playerHasAnswered || isAnswering}
                                >
                                    <span className="font-bold mr-2">{String.fromCharCode(65 + index)}.</span>
                                    {option}
                                </Button>
                            );
                        })}
                    </div>

                    {playerHasAnswered && !opponentHasAnswered && (
                        <div className="text-center mt-6">
                            <Loader2 className="h-6 w-6 mx-auto animate-spin" />
                            <p className="text-muted-foreground mt-2">Waiting for {opponent?.displayName} to answer...</p>
                        </div>
                    )}
                    
                     {playerHasAnswered && opponentHasAnswered && (
                        <Alert className="mt-6 border-blue-500 bg-blue-50">
                            <AlertTitle className="font-bold">Explanation</AlertTitle>
                            <AlertDescription>{currentQuestion?.explanation}</AlertDescription>
                        </Alert>
                     )}
                </CardContent>
            </Card>
        </MainLayout>
    );
}

    

    