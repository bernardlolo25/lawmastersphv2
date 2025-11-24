
"use client";

import * as React from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, LabelList } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { CheckCircle, Trophy, BarChart as BarChartIcon, Loader2 } from "lucide-react";
import { useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import type { GameResult } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

const chartConfig = {
  score: {
    label: "Score",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

function ProgressSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
       <Card>
          <CardHeader>
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <Skeleton className="h-full w-full" />
            </div>
          </CardContent>
        </Card>
    </div>
  );
}

export default function ProgressTrackingPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const fetchGameResults = async () => {
        if (!user || !firestore) return [];
        const gameResultsQuery = query(
            collection(firestore, `users/${user.uid}/game_results`),
            orderBy("completedAt", "desc"),
            limit(25)
        );
        const snapshot = await getDocs(gameResultsQuery);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameResult));
    };

    const { data: gameResults, isLoading: isLoadingResults } = useQuery<GameResult[], Error>({
        queryKey: ['gameResults', user?.uid],
        queryFn: fetchGameResults,
        enabled: !!user && !!firestore,
    });
    
    const { stats, chartData } = React.useMemo(() => {
        if (!gameResults || gameResults.length === 0) {
            return {
                stats: [
                    { title: "Games Played", value: "0", icon: BarChartIcon },
                    { title: "Overall Accuracy", value: "0%", icon: CheckCircle },
                    { title: "Highest Score", value: "0", icon: Trophy },
                ],
                chartData: [],
            };
        }

        const totalGamesPlayed = gameResults.length;
        const totalCorrect = gameResults.reduce((sum, result) => sum + result.correctAnswers, 0);
        const totalQuestions = gameResults.reduce((sum, result) => sum + result.totalQuestions, 0);
        const overallAccuracy = totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(0) : 0;
        const highestScore = Math.max(...gameResults.map(r => r.score));

        const recentGamesForChart = gameResults.slice(0, 7).reverse();

        const chartData = recentGamesForChart.map((result, index) => ({
            name: `Game ${totalGamesPlayed - recentGamesForChart.length + index + 1}`,
            score: result.score
        }));

        const stats = [
            { title: "Games Played", value: totalGamesPlayed.toString(), icon: BarChartIcon },
            { title: "Overall Accuracy", value: `${overallAccuracy}%`, icon: CheckCircle },
            { title: "Highest Score", value: highestScore.toLocaleString(), icon: Trophy },
        ];
        
        return { stats, chartData };
    }, [gameResults]);

    const isLoading = isUserLoading || isLoadingResults;

    if (isLoading && !gameResults) {
      return (
        <MainLayout>
          <ProgressSkeleton />
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
        );
    }

  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="grid gap-6 md:grid-cols-3">
            {stats.map((stat) => (
                <Card key={stat.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                        <stat.icon className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stat.value}</div>
                    </CardContent>
                </Card>
            ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Recent Performance</CardTitle>
            <CardDescription>Your scores from the last 7 games you played.</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
                 <div className="h-[300px] w-full">
                    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                      <ResponsiveContainer>
                        <BarChart accessibilityLayer data={chartData}>
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="name"
                                tickLine={false}
                                tickMargin={10}
                                axisLine={false}
                            />
                            <YAxis 
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                            />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" />}
                            />
                            <Bar dataKey="score" fill="var(--color-score)" radius={8}>
                               <LabelList dataKey="score" position="top" offset={8} className="fill-foreground text-sm" />
                            </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                </div>
            ) : (
                <div className="text-center py-16 text-muted-foreground">
                    <BarChartIcon className="mx-auto h-12 w-12" />
                    <p className="mt-4">No game data yet.</p>
                    <p className="text-sm">Play a game in Gaming Mode to see your progress!</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
