
"use client";

import * as React from "react";
import Link from "next/link";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Timer,
  Heart,
  Zap,
  Crown,
  Calendar,
  Trophy,
  ArrowLeft,
  Loader2,
  X,
  HelpCircle,
  Swords,
  Lock,
  CheckCircle as CheckCircleIcon,
  Flag,
  List,
  Text,
  TextIcon,
  Lightbulb,
} from "lucide-react";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import type { Topic, QuizQuestion, GameResult, UserStatistics, FormattedQuizQuestion, SiteSettings, QuestionReport } from "@/lib/types";
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp, addDoc, setDoc, getDoc, orderBy } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import * as LucideIcons from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GamingTools } from '@/components/gaming-tools';


type IconName = keyof typeof LucideIcons;

type View = "mode-selection" | "topic-selection" | "active-game" | "results";
type GameMode = "timed" | "survival" | "lightning" | "boss" | "daily";
export type ChoiceTextSize = 'sm' | 'base' | 'lg';


const GameModeConfig = {
  timed: { name: "Timed Challenge", icon: Timer, color: "text-red-500", totalQuestions: 10, timePerQuestion: 30, lives: null, comboEnabled: false, basePoints: 100 },
  survival: { name: "Survival Mode", icon: Heart, color: "text-rose-500", totalQuestions: null, timePerQuestion: 45, lives: 3, comboEnabled: false, basePoints: 150 },
  lightning: { name: "Lightning Round", icon: Zap, color: "text-amber-500", totalQuestions: 15, timePerQuestion: 15, lives: null, comboEnabled: true, basePoints: 75 },
  boss: { name: "Boss Battle", icon: Crown, color: "text-purple-500", totalQuestions: 15, timePerQuestion: null, lives: 3, comboEnabled: false, basePoints: 200, passAccuracy: 0.7 },
  daily: { name: "Daily Challenge", icon: Calendar, color: "text-blue-500", totalQuestions: 9, timePerQuestion: 20, lives: null, comboEnabled: false, basePoints: 125 },
};

const getOptionText = (question: FormattedQuizQuestion, option: "A" | "B" | "C" | "D") => {
    const optionMap = { A: 0, B: 1, C: 2, D: 3 };
    return question.options[optionMap[option]];
};

const playCorrectSound = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  const audioContext = new AudioContext();

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.2);
};

const playWrongSound = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  const audioContext = new AudioContext();

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.15);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.25);
};

export default function GamingModePage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [view, setView] = React.useState<View>("mode-selection");
    const [selectedMode, setSelectedMode] = React.useState<GameMode | null>(null);
    const [selectedTopic, setSelectedTopic] = React.useState<{ id: string, name: string } | null>(null);

    const [questions, setQuestions] = React.useState<FormattedQuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
    const [userAnswers, setUserAnswers] = React.useState<(number|null)[]>([]);
    const [score, setScore] = React.useState(0);
    const [lives, setLives] = React.useState<number | null>(null);
    const [timeLeft, setTimeLeft] = React.useState<number | null>(null);
    const [combo, setCombo] = React.useState(1);
    const [maxCombo, setMaxCombo] = React.useState(1);
    
    const [isAnswered, setIsAnswered] = React.useState(false);
    const [selectedAnswer, setSelectedAnswer] = React.useState<number | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isReporting, setIsReporting] = React.useState(false);
    const [reportComment, setReportComment] = React.useState("");
    const [questionCount, setQuestionCount] = React.useState(10);
    const [choiceTextSize, setChoiceTextSize] = React.useState<ChoiceTextSize>('base');


    const [lastGameResult, setLastGameResult] = React.useState<GameResult | null>(null);

    const topicsQuery = useMemoFirebase(() => !firestore ? null : query(collection(firestore, 'legal_topics'), orderBy('displayOrder')), [firestore]);
    const { data: topics, isLoading: isLoadingTopics } = useCollection<Topic>(topicsQuery);
    
    const bossModeResultsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users', user.uid, 'game_results'), where('gameMode', '==', 'boss'));
    }, [firestore, user]);
    const { data: bossModeResults, isLoading: isLoadingBossResults } = useCollection<GameResult>(bossModeResultsQuery);


    const userStatsRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid, 'statistics', 'main');
    }, [firestore, user]);
    const { data: userStats, isLoading: isLoadingStats } = useDoc<UserStatistics>(userStatsRef);

    const handleModeSelect = async (mode: GameMode) => {
        setSelectedMode(mode);
        if (mode === 'daily') {
            await startDailyChallenge();
        } else {
            setView("topic-selection");
        }
    };
    
    const startDailyChallenge = async () => {
        setIsLoading(true);
        setSelectedTopic({ id: 'daily-challenge', name: 'Daily Challenge' });

        if (!firestore) {
            setIsLoading(false);
            return;
        }

        try {
            const questionsSnapshot = await getDocs(collection(firestore, 'questions'));
            let allQuestions: QuizQuestion[] = questionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizQuestion));
            
            const config = GameModeConfig.daily;
            if (allQuestions.length < config.totalQuestions) {
                alert(`Not enough questions in the database for a Daily Challenge. At least ${config.totalQuestions} questions are needed.`);
                setIsLoading(false);
                return;
            }

            const gameQuestions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, config.totalQuestions);
            
            const formattedQuestions: FormattedQuizQuestion[] = gameQuestions.map(q => ({
                id: q.id,
                question: q.question,
                options: [q.optionA, q.optionB, q.optionC, q.optionD],
                correctAnswer: ['A', 'B', 'C', 'D'].indexOf(q.correctAnswer),
                explanation: q.explanation,
                difficulty: q.difficulty
            }));
            
            setQuestions(formattedQuestions);
            startNewGame(config, formattedQuestions.length);
            setView("active-game");

        } catch (error) {
            console.error("Error starting Daily Challenge:", error);
            alert("Could not start the Daily Challenge. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    };


    const handleTopicSelect = async (topicId: string, topicName: string) => {
        setIsLoading(true);
        setSelectedTopic({ id: topicId, name: topicName });

        if (!firestore || !selectedMode) {
            setIsLoading(false);
            return;
        }

        try {
            const q = query(collection(firestore, 'questions'), where('topicId', '==', topicId));
            const snapshot = await getDocs(q);
            let fetchedQuestions: QuizQuestion[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizQuestion));
            
            const config = GameModeConfig[selectedMode];
            let gameQuestionsSource = fetchedQuestions;
            
            let numQuestions = config.totalQuestions;
            if (selectedMode === 'timed' || selectedMode === 'lightning') {
                numQuestions = questionCount;
            }

            if (selectedMode === 'survival') {
                if (fetchedQuestions.length === 0) {
                    alert(`This topic doesn't have any questions for Survival Mode.`);
                    setIsLoading(false);
                    return;
                }
            } else {
                const minQuestions = numQuestions ?? 1;
                if (fetchedQuestions.length < minQuestions) {
                    alert(`This topic doesn't have enough questions for ${config.name}. It needs at least ${minQuestions}.`);
                    setIsLoading(false);
                    return;
                }
                gameQuestionsSource = fetchedQuestions.sort(() => 0.5 - Math.random()).slice(0, minQuestions);
            }
            
            const formattedQuestions: FormattedQuizQuestion[] = gameQuestionsSource.map(q => ({
                id: q.id,
                question: q.question,
                options: [q.optionA, q.optionB, q.optionC, q.optionD],
                correctAnswer: ['A', 'B', 'C', 'D'].indexOf(q.correctAnswer),
                explanation: q.explanation,
                difficulty: q.difficulty
            }));
            
            setQuestions(formattedQuestions);
            startNewGame(config, formattedQuestions.length);
            setView("active-game");

        } catch (error) {
            console.error("Error fetching questions:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const startNewGame = (config: typeof GameModeConfig[GameMode], numQuestions: number) => {
        setCurrentQuestionIndex(0);
        setScore(0);
        setLives(config.lives);
        setTimeLeft(config.timePerQuestion);
        setCombo(1);
        setMaxCombo(1);
        setIsAnswered(false);
        setSelectedAnswer(null);
        setUserAnswers(new Array(numQuestions).fill(null));
    }
    
    const handleAnswer = (selectedIndex: number) => {
        if (isAnswered) return;
        setIsAnswered(true);
        setSelectedAnswer(selectedIndex);
        
        const newAnswers = [...userAnswers];
        newAnswers[currentQuestionIndex] = selectedIndex;
        setUserAnswers(newAnswers);

        const currentQuestion = questions[currentQuestionIndex];
        const isCorrect = selectedIndex === currentQuestion.correctAnswer;
        
        if (isCorrect) {
            playCorrectSound();
            const points = (GameModeConfig[selectedMode!].basePoints + (timeLeft || 0) * 2) * combo;
            setScore(prev => prev + points);
            const newCombo = combo + 1;
            setCombo(newCombo);
            if (newCombo > maxCombo) setMaxCombo(newCombo);
        } else {
            playWrongSound();
            setCombo(1);
            if (lives !== null) setLives(prev => prev! - 1);
        }

        setTimeout(() => {
            if (lives !== null && lives - (isCorrect ? 0 : 1) <= 0) {
                endGame();
            } else if (currentQuestionIndex === questions.length - 1) {
                endGame();
            } else {
                setCurrentQuestionIndex(prev => prev + 1);
                setIsAnswered(false);
                setSelectedAnswer(null);
                setTimeLeft(GameModeConfig[selectedMode!].timePerQuestion);
            }
        }, 4000);
    }

    const endGame = async () => {
        const correctAnswersCount = userAnswers.reduce((acc, answer, index) => {
            if (answer === null || index >= questions.length) return acc;
            return acc + (answer === questions[index].correctAnswer ? 1 : 0);
        }, 0);

        const result: GameResult = {
            userId: user!.uid,
            gameMode: selectedMode!,
            topicId: selectedTopic!.id,
            score,
            correctAnswers: correctAnswersCount,
            totalQuestions: questions.length,
            timeTaken: 0, 
            maxCombo,
            completedAt: new Date().toISOString(),
        };

        setLastGameResult(result);

        if (firestore && user) {
            try {
                const batch = writeBatch(firestore);
                
                const userResultsRef = collection(firestore, 'users', user.uid, 'game_results');
                batch.set(doc(userResultsRef), result);
                
                const globalResultsRef = collection(firestore, 'game_results');
                batch.set(doc(globalResultsRef), result);

                const statsRef = doc(firestore, 'users', user.uid, 'statistics', 'main');
                const statsSnap = await getDoc(statsRef);
                const currentStats = statsSnap.exists() ? statsSnap.data() as UserStatistics : {};

                const newStats: Partial<UserStatistics> = {};

                let highscoreField: keyof UserStatistics | null = null;
                switch (selectedMode) {
                    case 'timed': highscoreField = 'timedBest'; break;
                    case 'survival': highscoreField = 'survivalRecord'; break;
                    case 'lightning': highscoreField = 'lightningHigh'; break;
                    case 'boss': 
                        const accuracy = result.totalQuestions > 0 ? result.correctAnswers / result.totalQuestions : 0;
                        if(accuracy >= GameModeConfig.boss.passAccuracy) {
                            newStats.bossLevel = Math.max(currentStats.bossLevel || 0, topics?.findIndex(t => t.id === result.topicId) ?? -1 + 1);
                        }
                        break;
                }
                
                if (highscoreField && (!currentStats[highscoreField] || score > (currentStats[highscoreField] as number || 0))) {
                    newStats[highscoreField] = score;
                }
                
                if (Object.keys(newStats).length > 0) {
                    if (!statsSnap.exists()) {
                       await setDoc(statsRef, newStats);
                    } else {
                       batch.update(statsRef, newStats);
                    }
                }

                await batch.commit();
            } catch (error) {
                console.error("Error saving game results:", error);
            }
        }

        setView("results");
    }

    const handleReportSubmit = async () => {
        const currentQuestion = questions[currentQuestionIndex];
        if (!firestore || !user || !currentQuestion || !reportComment.trim()) {
            toast({ variant: 'destructive', title: 'Could not submit report.', description: 'Please make sure you are logged in and have entered a comment.' });
            return;
        }

        setIsReporting(true);
        try {
            const reportData: Omit<QuestionReport, 'id'> = {
                questionId: currentQuestion.id,
                questionText: currentQuestion.question,
                reporterId: user.uid,
                reporterComment: reportComment,
                status: 'new',
                createdAt: serverTimestamp(),
            };
            await addDoc(collection(firestore, 'questionReports'), reportData);
            toast({ title: 'Report Submitted', description: 'Thank you for your feedback. An admin will review it shortly.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsReporting(false);
            setReportComment('');
            // Close the dialog by targeting the cancel button if it exists
            const cancelButton = document.getElementById('report-dialog-cancel-popover') as HTMLButtonElement | null;
            if (cancelButton) {
                cancelButton.click();
            }
        }
    };

    React.useEffect(() => {
        if (view !== 'active-game' || isAnswered || timeLeft === null) return;
        
        if (timeLeft === 0) {
            handleAnswer(-1); // Times up
            return;
        }

        const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
        return () => clearTimeout(timer);
    }, [timeLeft, view, isAnswered]);

    const renderView = () => {
        const currentQuestion = questions[currentQuestionIndex];
        switch (view) {
            case "mode-selection":
                return <ModeSelection onModeSelect={handleModeSelect} stats={userStats} isLoadingStats={isLoadingStats} isLoadingAction={isLoading} />;
            case "topic-selection":
                 return <TopicSelection 
                            topics={topics} 
                            onTopicSelect={handleTopicSelect} 
                            onBack={() => setView("mode-selection")} 
                            isLoading={isLoadingTopics || isLoading}
                            gameMode={selectedMode!}
                            bossModeResults={bossModeResults ?? []}
                            isLoadingBossResults={isLoadingBossResults}
                            questionCount={questionCount}
                            onQuestionCountChange={setQuestionCount}
                         />;
            case "active-game":
                 if (!currentQuestion) return <Loader2 className="animate-spin" />;
                 
                 const config = GameModeConfig[selectedMode!];
                 const textSizeClass = `text-${choiceTextSize}`;
                return (
                    <div className="relative">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>{config.name}</CardTitle>
                                    <CardDescription>{selectedTopic?.name}</CardDescription>
                                </div>
                                <Button variant="destructive" size="sm" onClick={() => setView("mode-selection")}>
                                    <X className="mr-2 h-4 w-4" /> Quit
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-between items-center mb-4 text-sm font-semibold">
                                    <span>Score: {score}</span>
                                    {lives !== null && <span>Lives: {'❤️'.repeat(lives)}</span>}
                                    {config.comboEnabled && <span>Combo: x{combo}</span>}
                                    <span>Question: {currentQuestionIndex + 1}/{questions.length}</span>
                                </div>

                                {config.timePerQuestion && (
                                    <div className="mb-4">
                                        <Progress value={(timeLeft! / config.timePerQuestion) * 100} />
                                        <p className="text-center text-sm mt-1">{timeLeft}s remaining</p>
                                    </div>
                                )}
                                
                                <div className="my-6">
                                    <h3 className="text-xl font-semibold text-center">{currentQuestion.question}</h3>
                                </div>


                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {currentQuestion.options.map((option, index) => {
                                        const isCorrect = index === currentQuestion.correctAnswer;
                                        const isSelected = index === selectedAnswer;
                                        
                                        let stateClass = "bg-card hover:bg-accent hover:text-accent-foreground";
                                        if(isAnswered) {
                                            if (isCorrect) stateClass = "bg-green-200 border-green-500";
                                            else if (isSelected) stateClass = "bg-red-200 border-red-500";
                                            else stateClass = "bg-card opacity-50";
                                        }

                                        return (
                                            <Button
                                                key={index}
                                                variant="outline"
                                                className={cn("h-auto whitespace-normal p-4 justify-start text-left", stateClass, textSizeClass)}
                                                onClick={() => handleAnswer(index)}
                                                disabled={isAnswered}
                                            >
                                                <span className="font-bold mr-2">{String.fromCharCode(65 + index)}.</span>
                                                {option}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                        <AlertDialog open={isAnswered}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                        <Lightbulb className="text-yellow-400" />
                                        Explanation
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {currentQuestion.explanation}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                            </AlertDialogContent>
                        </AlertDialog>
                        
                        <div className="fixed bottom-6 right-6 z-50">
                            <GamingTools 
                                currentTextSize={choiceTextSize}
                                onTextSizeChange={setChoiceTextSize}
                                reportComment={reportComment}
                                onReportCommentChange={setReportComment}
                                isReporting={isReporting}
                                onReportSubmit={handleReportSubmit}
                            />
                        </div>
                    </div>
                )
            case "results":
                if (!lastGameResult) return null;
                const accuracy = lastGameResult.totalQuestions > 0 ? (lastGameResult!.correctAnswers / lastGameResult!.totalQuestions) * 100 : 0;
                return (
                    <Card className="text-center">
                        <CardHeader>
                             <CardTitle className="text-3xl font-bold">
                                {lives === 0 ? "Game Over" : "Game Complete!"}
                             </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-5xl font-bold text-primary">{lastGameResult?.score} pts</p>
                            <div className="grid grid-cols-2 gap-4 text-left">
                                <p><strong>Correct Answers:</strong> {lastGameResult?.correctAnswers} / {lastGameResult?.totalQuestions}</p>
                                <p><strong>Accuracy:</strong> {accuracy.toFixed(0)}%</p>
                                <p><strong>Max Combo:</strong> x{lastGameResult?.maxCombo}</p>
                                <p><strong>Topic:</strong> {selectedTopic?.name}</p>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-center gap-4">
                            <Button onClick={() => selectedMode === 'daily' ? startDailyChallenge() : handleTopicSelect(selectedTopic!.id, selectedTopic!.name)}>Play Again</Button>
                            <Button variant="outline" onClick={() => setView("mode-selection")}>Change Mode</Button>
                            <Link href="/leaderboard">
                                <Button variant="secondary">
                                    <Trophy className="mr-2 h-4 w-4"/>
                                    View Leaderboard
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>
                )
        }
    }
    

  return (
    <MainLayout>
        {renderView()}
    </MainLayout>
  );
}


function ModeSelection({ onModeSelect, stats, isLoadingStats, isLoadingAction }: { onModeSelect: (mode: GameMode) => void; stats: UserStatistics | null; isLoadingStats: boolean; isLoadingAction: boolean; }) {
    const gameModes: GameMode[] = ["timed", "survival", "lightning"];
    
    const getStat = (mode: GameMode) => {
        if(isLoadingStats) return <Loader2 className="h-4 w-4 animate-spin" />;
        if (!stats) return 'Best: N/A';
        
        let value: number | string | undefined;
        let label = "Best";

        switch(mode) {
            case 'timed': value = stats?.timedBest; break;
            case 'survival': value = stats?.survivalRecord; label = "Record"; break;
            case 'lightning': value = stats?.lightningHigh; label = "High Score"; break;
            case 'boss': value = stats?.bossLevel; label = "Level"; break;
            case 'daily': value = stats?.dailyStreak; label = "Streak"; break;
            default: return null;
        }

        let displayValue: string;
        if (value === undefined || value === null) {
            displayValue = mode === 'daily' ? '0 days' : 'N/A';
        } else if (mode === 'daily') {
            displayValue = `${value} day${value === 1 ? '' : 's'}`;
        } else {
            displayValue = value.toString();
        }

        return `${label}: ${displayValue}`;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Gaming Mode</CardTitle>
                    <CardDescription>Learn through interactive challenges. Select a mode to begin.</CardDescription>
                </CardHeader>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 <Card className="flex flex-col hover:shadow-lg transition-shadow bg-purple-50 border-purple-200">
                    <CardHeader className="flex-row items-center gap-4">
                        <Crown className={`h-10 w-10 ${GameModeConfig.boss.color}`} />
                        <div>
                            <CardTitle>{GameModeConfig.boss.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{getStat('boss')}</p>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <p>Challenge bosses in a specific topic to unlock the next. A true test of mastery!</p>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => onModeSelect('boss')}>Start Campaign</Button>
                    </CardFooter>
                </Card>
                 <Card className="flex flex-col hover:shadow-lg transition-shadow bg-blue-50 border-blue-200">
                    <CardHeader className="flex-row items-center gap-4">
                        <Calendar className={`h-10 w-10 ${GameModeConfig.daily.color}`} />
                        <div>
                            <CardTitle>{GameModeConfig.daily.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{getStat('daily')}</p>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <p>A new random quiz every day. Test your knowledge across all topics!</p>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => onModeSelect('daily')} disabled={isLoadingAction}>
                             {isLoadingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             Play Now
                        </Button>
                    </CardFooter>
                </Card>
                {gameModes.map(mode => {
                    const config = GameModeConfig[mode];
                    return (
                        <Card key={mode} className="flex flex-col hover:shadow-lg transition-shadow">
                            <CardHeader className="flex-row items-center gap-4">
                                <config.icon className={`h-10 w-10 ${config.color}`} />
                                <div>
                                    <CardTitle>{config.name}</CardTitle>
                                    <p className="text-sm text-muted-foreground">{getStat(mode)}</p>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p>A short description of the game mode goes here.</p>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" onClick={() => onModeSelect(mode)}>Play Now</Button>
                            </CardFooter>
                        </Card>
                    );
                })}
                 <Card className="flex flex-col hover:shadow-lg transition-shadow">
                    <CardHeader className="flex-row items-center gap-4">
                        <Trophy className="h-10 w-10 text-yellow-500" />
                        <div>
                            <CardTitle>Leaderboards</CardTitle>
                            <p className="text-sm text-muted-foreground">See how you rank!</p>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <p>Check out the top scores for each game mode and compete for the top spot.</p>
                    </CardContent>
                    <CardFooter>
                        <Link href="/leaderboard" className="w-full">
                            <Button variant="outline" className="w-full">View Leaderboards</Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}

function TopicCard({ topic, onTopicSelect, isLocked }: { topic: Topic; onTopicSelect: (id: string, name: string) => void; isLocked: boolean; }) {
    const firestore = useFirestore();
    const [questionCount, setQuestionCount] = React.useState(0);
    const [isLoadingCount, setIsLoadingCount] = React.useState(true);

    React.useEffect(() => {
        if (!firestore) return;

        const fetchCount = async () => {
            setIsLoadingCount(true);
            try {
                const q = query(collection(firestore, 'questions'), where('topicId', '==', topic.id));
                const snapshot = await getDocs(q);
                setQuestionCount(snapshot.size);
            } catch (e) {
                console.error("Failed to fetch question count for topic:", topic.id, e);
                setQuestionCount(0); // Assume 0 on error
            } finally {
                setIsLoadingCount(false);
            }
        };

        fetchCount();
    }, [firestore, topic.id]);

    const isDisabled = isLocked || questionCount === 0;

    const getIcon = (iconName: string) => {
        const Icon = LucideIcons[iconName as IconName] as React.FC<React.SVGProps<SVGSVGElement>>;
        return Icon ? <Icon className={`h-8 w-8 ${isDisabled ? 'text-muted-foreground' : 'text-primary'}`} /> : <LucideIcons.Book className="h-8 w-8 text-primary" />;
    };
    
    return (
        <Card 
            className={`text-center p-4 flex flex-col justify-between relative overflow-hidden ${isDisabled ? 'bg-muted/50 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'}`} 
            onClick={() => !isDisabled && onTopicSelect(topic.id, topic.name)}
        >
             {isLocked && <Lock className="absolute top-2 right-2 h-4 w-4 text-muted-foreground" />}
             
            <div className="flex-grow flex flex-col justify-center items-center">
                {getIcon(topic.icon)}
                <h3 className={`font-semibold mt-2 text-sm ${isDisabled ? 'text-muted-foreground' : ''}`}>{topic.name}</h3>
            </div>
            { !isLocked && (
                 <div className="mt-2 flex-shrink-0 h-6 flex items-center justify-center">
                    {isLoadingCount ? (
                        <Skeleton className="h-5 w-20" />
                    ) : (
                        <Badge variant={questionCount === 0 ? "destructive" : "outline"}>
                            {questionCount} {questionCount === 1 ? 'Question' : 'Questions'}
                        </Badge>
                    )}
                </div>
            )}
        </Card>
    );
}


function TopicSelection({ topics, onTopicSelect, onBack, isLoading, gameMode, bossModeResults, isLoadingBossResults, questionCount, onQuestionCountChange }: { topics: Topic[] | null; onTopicSelect: (id: string, name: string) => void; onBack: () => void; isLoading: boolean; gameMode: GameMode; bossModeResults: GameResult[], isLoadingBossResults: boolean; questionCount: number; onQuestionCountChange: (count: number) => void; }) {
    const { user } = useUser();
    
    const completedBossTopics = React.useMemo(() => {
        if (gameMode !== 'boss' || !bossModeResults) {
            return new Set<string>();
        }
        const passAccuracy = GameModeConfig.boss.passAccuracy;
        return new Set(
            bossModeResults
                .filter(r => r.totalQuestions > 0 && (r.correctAnswers / r.totalQuestions) >= passAccuracy)
                .map(r => r.topicId)
        );
    }, [bossModeResults, gameMode]);
    
    const isBossMode = gameMode === 'boss';
    const isConfigurableCountMode = gameMode === 'timed' || gameMode === 'lightning';
    const totalLoading = isLoading || isLoadingBossResults;

    const renderTopicGrid = () => {
        if (totalLoading) {
             return (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            );
        }

        if (!topics || topics.length === 0) {
             return (
                <div className="col-span-full text-center p-8">
                    <Alert>
                        <HelpCircle className="h-4 w-4" />
                        <AlertTitle>No Topics Found</AlertTitle>
                        <AlertDescription>Please ask an admin to add topics before you can play.</AlertDescription>
                    </Alert>
                </div>
            );
        }
        
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {topics.map((topic, index) => {
                    let isLocked = false;
                    
                    if (isBossMode && index > 0) {
                        const previousTopic = topics[index - 1];
                        if (!completedBossTopics.has(previousTopic.id)) {
                             isLocked = true;
                        }
                    }

                    return (
                        <TopicCard 
                            key={topic.id} 
                            topic={topic} 
                            onTopicSelect={onTopicSelect}
                            isLocked={isBossMode && isLocked}
                         />
                    );
                })}
            </div>
        );
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft/></Button>
                    <div>
                        <CardTitle>{isBossMode ? 'Boss Battle Campaign' : 'Choose Your Topic'}</CardTitle>
                        <CardDescription>
                            {isBossMode 
                                ? 'Defeat each topic\'s boss to unlock the next challenge. Good luck!' 
                                : 'Select a topic to start your game.'}
                        </CardDescription>
                    </div>
                </div>
                
            </CardHeader>
            <CardContent>
                { isConfigurableCountMode && (
                    <div className="mb-8 p-4 border rounded-lg max-w-md mx-auto">
                        <Label htmlFor="question-slider" className="mb-2 flex items-center gap-2 font-semibold">
                            <List className="h-5 w-5" />
                            Number of Questions: {questionCount}
                        </Label>
                        <Slider
                            id="question-slider"
                            min={5}
                            max={20}
                            step={1}
                            value={[questionCount]}
                            onValueChange={(value) => onQuestionCountChange(value[0])}
                        />
                    </div>
                )}
                { !user && (
                     <Alert>
                        <HelpCircle className="h-4 w-4" />
                        <AlertTitle>Please Log In</AlertTitle>
                        <AlertDescription>You need to be logged in to play games and save your progress.</AlertDescription>
                    </Alert>
                )}
                { user && renderTopicGrid() }
            </CardContent>
        </Card>
    );
}

    

    




    


    
