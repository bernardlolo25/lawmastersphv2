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
import { ReadingTools, type FontOption, type ThemeOption } from '@/components/reading-tools';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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

const themeClasses: Record<ThemeOption, string> = {
    'theme-light': 'bg-card text-card-foreground',
    'theme-sepia': 'bg-[#fbf5e9] text-[#5b4636]',
    'theme-dark': 'bg-[#121212] text-gray-300 dark:prose-invert prose-p:text-gray-300 prose-headings:text-gray-200 prose-strong:text-gray-200 prose-ul:text-gray-300 prose-ol:text-gray-300 prose-li:text-gray-300 prose-a:text-blue-400',
};

export default function BookPage() {
  const params = useParams();
  const topicId = params.topicId as string;
  const bookId = params.bookId as string;
  const firestore = useFirestore();

  const [font, setFont] = React.useState<FontOption>('font-body');
  const [theme, setTheme] = React.useState<ThemeOption>('theme-light');

  React.useEffect(() => {
    const savedFont = localStorage.getItem('reading-font') as FontOption;
    const savedTheme = localStorage.getItem('reading-theme') as ThemeOption;
    if (savedFont) setFont(savedFont);
    if (savedTheme) setTheme(savedTheme);
  }, []);

  const handleFontChange = (newFont: FontOption) => {
    setFont(newFont);
    localStorage.setItem('reading-font', newFont);
  };

  const handleThemeChange = (newTheme: ThemeOption) => {
    setTheme(newTheme);
    localStorage.setItem('reading-theme', newTheme);
  };

  const bookRef = useMemoFirebase(() => {
    if (!firestore || !bookId) return null;
    return doc(firestore, 'books', bookId);
  }, [firestore, bookId]);

  const { data: book, isLoading } = useDoc<Book>(bookRef);
  
  const parsedContent = React.useMemo(() => {
    if (book?.content) {
      marked.setOptions({ breaks: true });
      return marked.parse(book.content);
    }
    return '';
  }, [book?.content]);

  return (
    <MainLayout>
      <div className="relative">
        <div className={cn("rounded-lg p-6 md:p-10 transition-colors duration-300", themeClasses[theme])}>
          {isLoading && <BookSkeleton />}
          
          {!isLoading && book && (
            <article className={cn("prose prose-lg max-w-full mx-auto", font)}>
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

        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={`/books/${topicId}`}>
                    <Button variant="outline" size="icon" className="rounded-full h-14 w-14 shadow-lg">
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Back to Topic Details</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <ReadingTools 
              currentFont={font}
              currentTheme={theme}
              onFontChange={handleFontChange}
              onThemeChange={handleThemeChange}
            />
        </div>
      </div>
    </MainLayout>
  );
}
