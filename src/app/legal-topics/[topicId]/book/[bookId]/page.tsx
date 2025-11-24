'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useMemoFirebase } from '@/firebase';
import type { Book } from '@/lib/types';
import { MainLayout } from '@/components/main-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';
import { marked } from 'marked';
import { Button } from '@/components/ui/button';

function BookSkeleton() {
  return (
    <div className="prose prose-lg dark:prose-invert max-w-full mx-auto">
      <Skeleton className="h-12 w-3/4 mb-4" />
      <Skeleton className="h-6 w-1/2 mb-8" />
      <div className="space-y-4">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-5 w-full mt-6" />
        <Skeleton className="h-5 w-4/5" />
      </div>
    </div>
  );
}

export default function BookPage() {
  const params = useParams();
  const topicId = params.topicId as string;
  const bookId = params.bookId as string;
  const firestore = useFirestore();

  const bookRef = useMemoFirebase(() => {
    if (!firestore || !bookId) return null;
    return doc(firestore, 'books', bookId);
  }, [firestore, bookId]);

  const { data: book, isLoading } = useDoc<Book>(bookRef);
  
  const parsedContent = React.useMemo(() => {
    if (book?.content) {
      // Configure marked to handle line breaks properly
      marked.setOptions({
        breaks: true,
      });
      return marked.parse(book.content);
    }
    return '';
  }, [book?.content]);

  return (
    <MainLayout>
      <div className="mb-4">
        <Link href={`/legal-topics/${topicId}`}>
            <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Topic Details
            </Button>
        </Link>
      </div>
      <div className="bg-card rounded-lg p-6 md:p-10">
        {isLoading && <BookSkeleton />}
        
        {!isLoading && book && (
          <article className="prose prose-lg dark:prose-invert max-w-full mx-auto">
            <h1>{book.title}</h1>
            <p className="lead text-muted-foreground">By {book.author}</p>
            <div
                className="mt-8"
                dangerouslySetInnerHTML={{ __html: parsedContent }}
            />
          </article>
        )}

        {!isLoading && !book && (
            <Alert>
                <BookOpen className="h-4 w-4" />
                <AlertTitle>Book Not Found</AlertTitle>
                <AlertDescription>
                    The requested study material could not be found. It may have been moved or deleted.
                </AlertDescription>
            </Alert>
        )}
      </div>
    </MainLayout>
  );
}
