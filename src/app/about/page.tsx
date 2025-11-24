'use client';

import * as React from 'react';
import Image from "next/image";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { AboutPageContent } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Mail, Wallet } from 'lucide-react';
import Link from 'next/link';

function AboutPageSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-5/6" />
        <Skeleton className="h-7 w-1/3 mt-4" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-4/5" />
      </CardContent>
    </Card>
  );
}

export default function AboutPage() {
  const firestore = useFirestore();

  const aboutContentRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'site_content', 'about_page');
  }, [firestore]);

  const { data: aboutContent, isLoading } = useDoc<AboutPageContent>(aboutContentRef);

  const defaultContent = {
      mainParagraph: 'LegalMasters PH is a revolutionary platform designed to empower law students, legal professionals, and enthusiasts with comprehensive and accessible legal knowledge tailored for the Philippines. Our mission is to democratize legal education and provide powerful tools that make learning the law engaging, efficient, and effective.',
      vision: `I’ve always been drawn to the inner workings of technology—curious about how systems connect, evolve, and solve problems. What started as late-night tinkering with software and troubleshooting devices gradually turned into a full-fledged passion for IT. Over the years, I’ve carved out a path focused on systems architecture, mobile integration, and secure document workflows.

My strength lies in designing modular, scalable solutions that don’t just work—they look and feel right. I enjoy blending technical precision with clean, creative presentation, whether I’m building responsive web interfaces, refining backend logic, or adapting workflows for mobile environments. Every project is an opportunity to push for clarity, polish, and performance.

I believe great systems should be intuitive and visually engaging. That’s why I’m always learning, experimenting, and refining—staying ahead of the curve in a field that never stands still.`,
      team: 'For any questions, support requests, or suggestions, please do not hesitate to reach out. Your feedback is invaluable in the continuous improvement of LegalMasters PH.',
      gcashQrUrl: 'https://i.imgur.com/029j1Xw.jpg'
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {isLoading ? (
          <AboutPageSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">About LegalMasters PH</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                {aboutContent?.mainParagraph || defaultContent.mainParagraph}
              </p>
              <h3 className="font-headline text-xl font-semibold pt-4">From the Developer</h3>
              <p className="whitespace-pre-line">
                {aboutContent?.vision || defaultContent.vision}
              </p>
              <h3 className="font-headline text-xl font-semibold pt-4">Support & Feedback</h3>
              <p>
                {aboutContent?.team || defaultContent.team}
              </p>
              <a href="mailto:mr.softexpert@gmail.com" className="inline-flex items-center gap-2">
                 <Button variant="outline">
                    <Mail className="h-4 w-4 mr-2" />
                    mr.softexpert@gmail.com
                 </Button>
              </a>
            </CardContent>
            <CardFooter className="flex-col items-start gap-4 border-t pt-6">
                <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        Support the App
                    </p>
                    <p className="text-sm text-muted-foreground">If you find this application helpful, please consider supporting its continued development and maintenance.</p>
                </div>
                 {(aboutContent?.gcashQrUrl || defaultContent.gcashQrUrl) && (
                    <div className="w-full max-w-xs p-4 border rounded-lg bg-muted/50">
                        <p className="text-center text-sm font-semibold mb-2">Scan to donate via GCash</p>
                        <div className="relative aspect-square w-full">
                             <Image 
                                src={aboutContent?.gcashQrUrl || defaultContent.gcashQrUrl} 
                                alt="GCash QR Code" 
                                fill
                                className="object-contain rounded-md"
                             />
                        </div>
                    </div>
                )}
            </CardFooter>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
