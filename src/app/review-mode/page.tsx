
'use client';

import * as React from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Topic } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import * as LucideIcons from 'lucide-react';

type IconName = keyof typeof LucideIcons;

function TopicCardSkeleton() {
    return (
        <Card className="text-center p-4 flex flex-col justify-between">
            <div className="flex-grow flex flex-col justify-center items-center">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-5 w-3/4 mt-2" />
            </div>
            <div className="mt-2 flex-shrink-0 h-6 flex items-center justify-center">
                <Skeleton className="h-5 w-20" />
            </div>
        </Card>
    );
}

function TopicCard({ topic }: { topic: Topic }) {
    const getIcon = (iconName: string) => {
        const Icon = LucideIcons[iconName as IconName] as React.FC<React.SVGProps<SVGSVGElement>>;
        return Icon ? <Icon className="h-8 w-8 text-primary" /> : <LucideIcons.Book className="h-8 w-8 text-primary" />;
    };
    
    const questionCount = topic.questionCount ?? 0;

    return (
        <Link href={`/review-mode/${topic.id}`}>
            <Card className="text-center p-4 flex flex-col justify-between h-full hover:bg-muted cursor-pointer transition-colors">
                <div className="flex-grow flex flex-col justify-center items-center">
                    {getIcon(topic.icon)}
                    <h3 className="font-semibold mt-2 text-sm">{topic.name}</h3>
                </div>
                <div className="mt-2 flex-shrink-0 h-6 flex items-center justify-center">
                    <Badge variant={questionCount === 0 ? "destructive" : "outline"}>
                        {questionCount} {questionCount === 1 ? 'Question' : 'Questions'}
                    </Badge>
                </div>
            </Card>
        </Link>
    );
}


export default function ReviewModePage() {
  const firestore = useFirestore();
  const topicsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'legal_topics'), orderBy('displayOrder'));
  }, [firestore]);

  const { data: topics, isLoading } = useCollection<Topic>(topicsQuery);

  return (
    <MainLayout>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Review Mode</CardTitle>
          <CardDescription>
            Select a topic to review all related questions, answers, and explanations.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {isLoading && (
                    <>
                        <TopicCardSkeleton />
                        <TopicCardSkeleton />
                        <TopicCardSkeleton />
                        <TopicCardSkeleton />
                        <TopicCardSkeleton />
                        <TopicCardSkeleton />
                    </>
                )}
                {topics && topics.map((topic) => (
                    <TopicCard key={topic.id} topic={topic} />
                ))}
            </div>
            {!isLoading && topics?.length === 0 && (
                <div className="text-center p-8 text-muted-foreground">No topics available for review.</div>
            )}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
