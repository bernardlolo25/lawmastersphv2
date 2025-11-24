
'use client';

import * as React from 'react';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Bell,
  Book,
  ChartBar,
  History,
  Info,
  TrendingUp,
  CheckCircle,
  Clock,
  BookOpen,
  Database,
  Megaphone,
  Loader2,
  Gamepad2,
  Swords,
  Library,
  Icon as LucideIcon
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useCollection, useDoc, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, doc, query, orderBy, limit } from 'firebase/firestore';
import type { SiteNotification, Topic, FeatureShowcaseContent, SiteSettings } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import Autoplay from "embla-carousel-autoplay";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const stats = [
  {
    title: 'Topics Studied',
    value: '0',
    description: 'of 0 available',
    icon: BookOpen,
  },
  {
    title: 'Quizzes Completed',
    value: '0',
    description: 'Average: 0%',
    icon: CheckCircle,
  },
  {
    title: 'Study Time',
    value: '0h',
    description: 'Total time spent',
    icon: Clock,
  },
  {
    title: 'Current Streak',
    value: '0',
    description: 'consecutive days',
    icon: TrendingUp,
  },
];

function FeatureShowcase({ onGetStartedClick }: { onGetStartedClick: () => void }) {
    const firestore = useFirestore();
    const plugin = React.useRef(Autoplay({ delay: 5000, stopOnInteraction: true }));
    
    const showcaseRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'site_content', 'feature_showcase');
    }, [firestore]);

    const { data: showcaseContent, isLoading } = useDoc<FeatureShowcaseContent>(showcaseRef);

    if (isLoading) {
        return (
             <Card className="overflow-hidden">
                <Skeleton className="h-64 w-full" />
                <CardFooter className="p-4"><Skeleton className="h-10 w-full" /></CardFooter>
            </Card>
        );
    }

    if (!showcaseContent || !showcaseContent.slides || showcaseContent.slides.length === 0) {
        return null;
    }

    const getIcon = (iconName: string): React.ComponentType<{ className?: string }> => {
        const Icon = (LucideIcons as any)[iconName];
        return Icon || LucideIcon;
    };

    return (
        <Card className="overflow-hidden">
            <Carousel
                plugins={[plugin.current]}
                className="w-full"
                onMouseEnter={plugin.current.stop}
                onMouseLeave={plugin.current.reset}
            >
                <CarouselContent>
                    {showcaseContent.slides.map((feature, index) => {
                        const Icon = getIcon(feature.icon);
                        return (
                            <CarouselItem key={index}>
                                <div className={`relative h-64 w-full bg-gradient-to-br ${feature.gradient}`}>
                                    <div className="absolute inset-0 bg-black/30" />
                                    <div className="absolute bottom-0 left-0 p-6 text-white">
                                        <h3 className="text-2xl font-bold font-headline flex items-center gap-2">
                                            <Icon className="h-6 w-6" />
                                            {feature.title}
                                        </h3>
                                        <p className="mt-2 text-white/90 max-w-prose">{feature.description}</p>
                                    </div>
                                </div>
                            </CarouselItem>
                        );
                    })}
                </CarouselContent>
            </Carousel>
             <CardFooter className="bg-card p-4 flex flex-col sm:flex-row items-center justify-center text-center sm:justify-between gap-4">
                <p className="text-base font-medium text-foreground">
                    Create an account to save your progress and access all features!
                </p>
                <Button onClick={onGetStartedClick} size="lg">Get Started</Button>
            </CardFooter>
        </Card>
    )
}

export function UserDashboard({ onAuthDialogOpen }: { onAuthDialogOpen: () => void }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isAuthDialogOpen, setIsAuthDialogOpen] = React.useState(false);
  
  const announcementCarouselPlugin = React.useRef(
    Autoplay({ delay: 4000, stopOnInteraction: true })
  )

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc'));
  }, [firestore, user]);
  const { data: notifications, isLoading: notificationsLoading } = useCollection<SiteNotification>(notificationsQuery);
  
  const topicsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'legal_topics'), orderBy('displayOrder'), limit(6));
  }, [firestore]);
  const { data: topics, isLoading: topicsLoading } = useCollection<Topic>(topicsQuery);
  
  const siteSettingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'site_content', 'site_settings');
  }, [firestore]);
  const { data: siteSettings, isLoading: isLoadingSiteSettings } = useDoc<SiteSettings>(siteSettingsRef);

  const handleAuthDialogOpen = () => setIsAuthDialogOpen(true);
  
  if (isUserLoading) {
    return (
      <MainLayout onAuthDialogOpen={onAuthDialogOpen}>
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <Skeleton className="h-64 w-full" />
            <CardFooter className="p-4"><Skeleton className="h-10 w-full" /></CardFooter>
          </Card>
        </div>
      </MainLayout>
    );
  }
  
  return (
    <>
      <MainLayout onAuthDialogOpen={handleAuthDialogOpen}>
        <div className="space-y-6">
          {!user && (siteSettings?.showFeatureShowcase ?? true) && (
              <FeatureShowcase onGetStartedClick={handleAuthDialogOpen} />
          )}

          {user && notificationsLoading && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5" />
                  Announcements
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[120px] flex items-center justify-center">
                <Loader2 className="animate-spin" />
              </CardContent>
            </Card>
          )}

          {user && notifications && notifications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5" />
                  Announcements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[240px] w-full pr-4">
                  <div className="space-y-4">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-4 rounded-lg border bg-card text-card-foreground">
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold">{n.title}</h4>
                          {n.priority === 'high' && <Badge variant="destructive">High Priority</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">{new Date(n.createdAt).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {user && (
              <>
                  <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                      <ChartBar className="w-5 h-5" />
                      Quick Stats
                      </CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                      {stats.map((stat) => (
                          <Card key={stat.title} className="text-center">
                          <CardHeader className="pb-2">
                              <div className="flex items-center justify-center gap-2">
                                  <stat.icon className="h-4 w-4 text-muted-foreground"/>
                                  <p className="text-sm text-muted-foreground">
                                  {stat.title}
                                  </p>
                              </div>
                          </CardHeader>
                          <CardContent>
                              <p className="text-4xl font-bold text-accent">
                              {stat.value}
                              </p>
                              <p className="text-xs text-muted-foreground">
                              {stat.description}
                              </p>
                          </CardContent>
                          </Card>
                      ))}
                      </div>
                  </CardContent>
                  </Card>

                  <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                      <Book className="w-5 h-5" />
                      Continue Studying
                      </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {topicsLoading && [...Array(3)].map((_, i) => <Card key={i} className="p-4"><Loader2 className="animate-spin"/></Card>)}
                      {topics && topics.map((topic) => (
                      <Card
                          key={topic.id}
                          className="p-4 hover:shadow-lg transition-shadow border-t-4 border-accent"
                      >
                          <div className="text-center">
                          <h3 className="font-semibold">{topic.name}</h3>
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {topic.description}
                          </p>
                          <div className="mt-2">
                              <Progress value={0} className="h-2" />
                              <p className="text-xs mt-1 text-muted-foreground">
                              0% Complete
                              </p>
                          </div>
                          <Link href={`/review-mode/${topic.id}`}>
                              <Button variant="secondary" size="sm" className="mt-4">
                                  Continue
                              </Button>
                          </Link>
                          </div>
                      </Card>
                      ))}
                      {!topicsLoading && topics?.length === 0 && (
                          <div className="text-center text-muted-foreground py-8 col-span-full">
                          <BookOpen className="mx-auto w-12 h-12 opacity-50" />
                          <p className="mt-4">No topics available yet.</p>
                          <p className="text-sm">
                              An administrator needs to add study topics first.
                          </p>
                          </div>
                      )}
                  </CardContent>
                  </Card>

                   <Card>
                      <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                          <History className="w-5 h-5" />
                          Recent Activity
                          </CardTitle>
                      </CardHeader>
                      <CardContent>
                          <div className="space-y-4">
                              <div className="text-center text-muted-foreground py-8">
                              <History className="mx-auto w-12 h-12 opacity-50" />
                              <p className="mt-4">No recent activity</p>
                              <p className="text-sm">
                                  Complete a quiz or study session to see your activity here.
                              </p>
                              </div>
                          </div>
                      </CardContent>
                  </Card>
              </>
          )}
        </div>
      </MainLayout>
      <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
    </>
  );
}
