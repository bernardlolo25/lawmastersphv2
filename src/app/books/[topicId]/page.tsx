
'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import type { Book, Topic } from '@/lib/types';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, BrainCircuit, ChevronRight, User, Book as BookIcon } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';

function TopicDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <Card>
        <CardHeader>
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/2 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function TopicDetailPage() {
  const params = useParams();
  const topicId = params.topicId as string;
  const firestore = useFirestore();

  const topicRef = useMemoFirebase(() => {
    if (!firestore || !topicId) return null;
    return doc(firestore, 'legal_topics', topicId);
  }, [firestore, topicId]);

  const booksQuery = useMemoFirebase(() => {
    if (!firestore || !topicId) return null;
    return query(collection(firestore, 'books'), where('topicId', '==', topicId));
  }, [firestore, topicId]);

  const { data: topic, isLoading: isTopicLoading } = useDoc<Topic>(topicRef);
  const { data: books, isLoading: areBooksLoading } = useCollection<Book>(booksQuery);

  const isLoading = isTopicLoading || areBooksLoading;

  if (isLoading) {
    return (
      <MainLayout>
        <TopicDetailSkeleton />
      </MainLayout>
    );
  }

  if (!topic) {
    return (
      <MainLayout>
        <div>Topic not found.</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <Link href="/books">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Topics
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-3xl">{topic.name}</CardTitle>
            <CardDescription>{topic.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Available Study Materials
            </h3>
            <div className="border rounded-md">
              {books && books.length > 0 ? (
                books.map((book, index) => {
                  const bookImage = PlaceHolderImages.find(p => p.id === book.id) ?? PlaceHolderImages.find(p => p.id === topic.id);
                  return (
                    <Link href={`/books/${topicId}/book/${book.id}`} key={book.id}>
                      <div className={`flex items-center p-4 hover:bg-muted/50 cursor-pointer ${index < books.length - 1 ? 'border-b' : ''}`}>
                        <div className="relative w-16 h-24 mr-4 flex-shrink-0">
                          {bookImage?.imageUrl ? (
                             <Image src={bookImage.imageUrl} alt={book.title} layout="fill" className="object-cover rounded-md" data-ai-hint={bookImage.imageHint} />
                          ) : (
                            <div className="w-full h-full bg-muted rounded-md flex items-center justify-center">
                              <BookIcon className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-grow">
                          <p className="font-semibold">{book.title}</p>
                          <p className="text-sm text-muted-foreground">
                            by {book.author}
                          </p>
                           <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                              {book.isAiGenerated ? <BrainCircuit className="h-4 w-4 text-secondary" /> : <User className="h-4 w-4 text-primary" />}
                              <span>{book.isAiGenerated ? 'AI Generated' : 'Human Written'}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground ml-4" />
                      </div>
                    </Link>
                  )
                })
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  No books available for this topic yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
