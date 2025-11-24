
'use client';

import * as React from 'react';
import Image from "next/image";
import Link from "next/link";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Input } from "@/components/ui/input";
import { Search, BrainCircuit, User } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import type { Topic, Book } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

function TopicSkeleton() {
  return (
    <Card className="flex flex-col overflow-hidden">
      <Skeleton className="aspect-video w-full" />
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-5/6 mt-1" />
      </CardHeader>
      <CardContent className="flex-grow" />
      <CardFooter>
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
}

function TopicCard({ topic }: { topic: Topic }) {
    const firestore = useFirestore();
    const topicImage = PlaceHolderImages.find(p => p.id === topic.id);
    const [bookCount, setBookCount] = React.useState(0);
    const [isLoadingCount, setIsLoadingCount] = React.useState(true);

    React.useEffect(() => {
        if (!firestore) return;
        
        const fetchBookCount = async () => {
            setIsLoadingCount(true);
            const booksQuery = query(collection(firestore, 'books'), where('topicId', '==', topic.id));
            const snapshot = await getDocs(booksQuery);
            setBookCount(snapshot.size);
            setIsLoadingCount(false);
        }
        
        fetchBookCount();
    }, [firestore, topic.id]);

    return (
        <Card className="flex flex-col overflow-hidden hover:shadow-xl transition-shadow duration-300">
            {topicImage && (
                <div className="aspect-video relative">
                <Image
                    src={topicImage.imageUrl}
                    alt={topic.name}
                    fill
                    className="object-cover"
                    data-ai-hint={topicImage.imageHint}
                />
                </div>
            )}
             <CardHeader>
                <CardTitle>{topic.name}</CardTitle>
                <CardDescription className="line-clamp-2">{topic.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                 {isLoadingCount ? <Skeleton className="h-5 w-24" /> : (
                    <Badge variant="outline">{bookCount} {bookCount === 1 ? 'Book' : 'Books'}</Badge>
                 )}
            </CardContent>
            <CardFooter>
                <Link href={`/legal-topics/${topic.id}`} className="w-full">
                <Button className="w-full">
                    View Topic
                </Button>
                </Link>
            </CardFooter>
        </Card>
    )
}

export default function LegalTopicsPage() {
  const firestore = useFirestore();
  const topicsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'legal_topics'), orderBy('displayOrder'));
  }, [firestore]);

  const { data: topics, isLoading } = useCollection<Topic>(topicsQuery);

  return (
    <MainLayout>
      <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Find a Topic</CardTitle>
                <CardDescription>Search for a specific legal topic or browse the categories below.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Search topics..." className="pl-10" />
                </div>
            </CardContent>
        </Card>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && (
            <>
              <TopicSkeleton />
              <TopicSkeleton />
              <TopicSkeleton />
              <TopicSkeleton />
              <TopicSkeleton />
              <TopicSkeleton />
            </>
          )}
          {topics && topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
