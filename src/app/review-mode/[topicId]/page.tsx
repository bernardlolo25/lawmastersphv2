
'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import type { QuizQuestion, Topic } from '@/lib/types';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { HelpCircle, CheckCircle } from 'lucide-react';

function ReviewSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-8 w-1/2" />
            <div className="space-y-2 pt-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    );
}

export default function TopicReviewPage() {
    const params = useParams();
    const topicId = params.topicId as string;
    const firestore = useFirestore();

    const topicRef = useMemoFirebase(() => {
        if (!firestore || !topicId) return null;
        return doc(firestore, `legal_topics/${topicId}`);
    }, [firestore, topicId]);

    const questionsQuery = useMemoFirebase(() => {
        if (!firestore || !topicId) return null;
        return query(collection(firestore, 'questions'), where('topicId', '==', topicId));
    }, [firestore, topicId]);

    const { data: topic, isLoading: isTopicLoading } = useDoc<Topic>(topicRef);
    const { data: questions, isLoading: areQuestionsLoading } = useCollection<QuizQuestion>(questionsQuery);

    const getOptionText = (question: QuizQuestion, option: "A" | "B" | "C" | "D") => {
        switch (option) {
            case "A": return question.optionA;
            case "B": return question.optionB;
            case "C": return question.optionC;
            case "D": return question.optionD;
        }
    };

    if (isTopicLoading || areQuestionsLoading) {
        return <MainLayout><ReviewSkeleton /></MainLayout>;
    }

    if (!topic) {
        return <MainLayout><div>Topic not found.</div></MainLayout>
    }

    return (
        <MainLayout>
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-3xl">Review Mode: {topic.name}</CardTitle>
                    <CardDescription>{topic.description}</CardDescription>
                </CardHeader>
                <CardContent>
                    {questions && questions.length > 0 ? (
                        <Accordion type="multiple" className="w-full">
                            {questions.map((q) => (
                                <AccordionItem key={q.id} value={q.id}>
                                    <AccordionTrigger className="text-left hover:no-underline">
                                       <div className="flex items-start gap-4">
                                            <HelpCircle className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
                                            <span>{q.question}</span>
                                       </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pl-10">
                                        <Alert className="border-green-500 bg-green-50 text-green-900">
                                            <CheckCircle className="h-4 w-4 !text-green-500" />
                                            <AlertTitle className="font-semibold">Correct Answer</AlertTitle>
                                            <AlertDescription className="space-y-3">
                                                <p className="font-medium">{getOptionText(q, q.correctAnswer)}</p>
                                                <p><strong>Explanation:</strong> {q.explanation}</p>
                                            </AlertDescription>
                                        </Alert>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                         <Alert>
                            <HelpCircle className="h-4 w-4" />
                            <AlertTitle>No Questions Yet</AlertTitle>
                            <AlertDescription>
                                There are no review questions available for this topic yet. Please check back later.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </MainLayout>
    );
}
