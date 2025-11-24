

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, orderBy, getDocs, writeBatch, where, setDoc, runTransaction, increment, getDoc } from 'firebase/firestore';
import type { Topic, QuizQuestion, SiteNotification, Book, AboutPageContent, SiteSettings, BookCSVRow, FeatureSlide, Feedback as FeedbackType, UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, Bell, FileUp, Book as BookIcon, Database, Bot, FileText, Settings, AlertTriangle, Info, Swords, Trophy, Upload, Presentation, Users, Copy, Check, ShieldAlert, Eye, Library, ListChecks, HelpCircleIcon, Users2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import Papa from 'papaparse';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import backendJson from '../../../docs/backend.json';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { UserManagement } from './admin/user-management';
import { useQuery } from '@tanstack/react-query';

const topicSchema = z.object({
  name: z.string().min(1, 'Topic name is required'),
  description: z.string().min(1, 'Description is required'),
  icon: z.string().min(1, 'Lucide icon name is required'),
  displayOrder: z.coerce.number().int().min(0, 'Display order must be a positive number'),
});

const questionSchema = z.object({
  topicId: z.string().min(1, "You must select a topic."),
  question: z.string().min(1, "Question text is required."),
  optionA: z.string().min(1, "Option A is required."),
  optionB: z.string().min(1, "Option B is required."),
  optionC: z.string().min(1, "Option C is required."),
  optionD: z.string().min(1, "Option D is required."),
  correctAnswer: z.enum(["A", "B", "C", "D"]),
  explanation: z.string().min(1, "An explanation is required."),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]).default("medium"),
});

const notificationSchema = z.object({
    title: z.string().min(1, "Title is required."),
    message: z.string().min(1, "Message is required."),
    type: z.enum(["announcement", "warning", "info"]).default("announcement"),
    priority: z.enum(["normal", "high"]).default("normal"),
});

const bookSchema = z.object({
  topicId: z.string().min(1, "You must select a topic."),
  title: z.string().min(1, "Book title is required."),
  author: z.string().min(1, "Author is required."),
  imageUrl: z.string().url().optional().or(z.literal('')),
  content: z.string().min(10, "Book content is too short."),
});

const aboutContentSchema = z.object({
  mainParagraph: z.string().min(1, 'Main paragraph is required.'),
  vision: z.string().min(1, 'Vision statement is required.'),
  team: z.string().min(1, 'Team description is required.'),
  gcashQrUrl: z.string().url().optional().or(z.literal('')),
});

const featureSlideSchema = z.object({
    title: z.string().min(1, 'Title is required.'),
    description: z.string().min(1, 'Description is required.'),
    icon: z.string().min(1, 'Lucide icon name is required.'),
    gradient: z.string().min(1, 'Tailwind gradient class is required (e.g., from-blue-500 to-indigo-600).')
});


type TopicFormData = z.infer<typeof topicSchema>;
type QuestionFormData = z.infer<typeof questionSchema>;
type NotificationFormData = z.infer<typeof notificationSchema>;
type BookFormData = z.infer<typeof bookSchema>;
type AboutContentFormData = z.infer<typeof aboutContentSchema>;
type FeatureSlideFormData = z.infer<typeof featureSlideSchema>;


function TableSkeleton({ rows = 5, cells = 3 }: { rows?: number; cells?: number }) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    {Array.from({ length: cells }).map((_, i) => (
                        <TableHead key={i}><Skeleton className="h-5 w-24" /></TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from({ length: rows }).map((_, i) => (
                    <TableRow key={i}>
                        {Array.from({ length: cells }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

function StatCard({ title, value, icon, isLoading }: { title: string, value: string | number, icon: React.ElementType, isLoading: boolean }) {
  const Icon = icon;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-8 w-1/3" /> : <div className="text-2xl font-bold">{value}</div>}
      </CardContent>
    </Card>
  );
}

export function AdminDashboard({ onAuthDialogOpen }: { onAuthDialogOpen: () => void }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [editingTopic, setEditingTopic] = React.useState<Topic | null>(null);
  const [editingQuestion, setEditingQuestion] = React.useState<QuizQuestion | null>(null);
  const [editingBook, setEditingBook] = React.useState<Book | null>(null);
  const [editingSlide, setEditingSlide] = React.useState<FeatureSlide | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [hasCopied, setHasCopied] = React.useState(false);
  
  const topicCsvInputRef = React.useRef<HTMLInputElement>(null);
  const questionCsvInputRef = React.useRef<HTMLInputElement>(null);
  const bookCsvInputRef = React.useRef<HTMLInputElement>(null);
  const bookContentFileInputRef = React.useRef<HTMLInputElement>(null);

  const backendJsonString = React.useMemo(() => JSON.stringify(backendJson, null, 2), []);

  const topicsCollectionRef = useMemoFirebase(() => !firestore ? null : collection(firestore, 'legal_topics'), [firestore]);
  const questionsCollectionRef = useMemoFirebase(() => !firestore ? null : collection(firestore, 'questions'), [firestore]);
  const notificationsCollectionRef = useMemoFirebase(() => !firestore ? null : collection(firestore, 'notifications'), [firestore]);
  const booksCollectionRef = useMemoFirebase(() => !firestore ? null : collection(firestore, 'books'), [firestore]);
  const feedbackCollectionRef = useMemoFirebase(() => !firestore ? null : collection(firestore, 'feedback'), [firestore]);
  const aboutContentRef = useMemoFirebase(() => !firestore ? null : doc(firestore, 'site_content', 'about_page'), [firestore]);
  const showcaseContentRef = useMemoFirebase(() => !firestore ? null : doc(firestore, 'site_content', 'feature_showcase'), [firestore]);
  const siteSettingsRef = useMemoFirebase(() => !firestore ? null : doc(firestore, 'site_content', 'site_settings'), [firestore]);
  const gameResultsCollectionRef = useMemoFirebase(() => !firestore ? null : collection(firestore, 'game_results'), [firestore]);
  const usersCollectionRef = useMemoFirebase(() => !firestore ? null : collection(firestore, 'users'), [firestore]);


  const topicsQuery = useMemoFirebase(() => !topicsCollectionRef ? null : query(topicsCollectionRef, orderBy('displayOrder')), [topicsCollectionRef]);
  const questionsQuery = useMemoFirebase(() => !questionsCollectionRef ? null : query(questionsCollectionRef, orderBy('topicId')), [questionsCollectionRef]);
  const notificationsQuery = useMemoFirebase(() => !notificationsCollectionRef ? null : query(notificationsCollectionRef, orderBy('createdAt', 'desc')), [notificationsCollectionRef]);
  const booksQuery = useMemoFirebase(() => !booksCollectionRef ? null : query(booksCollectionRef, orderBy('topicId')), [booksCollectionRef]);
  const feedbackQuery = useMemoFirebase(() => !feedbackCollectionRef ? null : query(feedbackCollectionRef, orderBy('submissionDate', 'desc')), [feedbackCollectionRef]);

  const { data: topics, isLoading: topicsLoading } = useCollection<Topic>(topicsQuery);
  const { data: questions, isLoading: questionsLoading } = useCollection<QuizQuestion>(questionsQuery);
  const { data: notifications, isLoading: notificationsLoading } = useCollection<SiteNotification>(notificationsQuery);
  const { data: books, isLoading: booksLoading } = useCollection<Book>(booksQuery);
  const { data: reports, isLoading: reportsLoading } = useCollection<FeedbackType>(feedbackQuery);
  const { data: aboutContent, isLoading: isAboutContentLoading } = useDoc<AboutPageContent>(aboutContentRef);
  const { data: showcaseContent, isLoading: isShowcaseLoading } = useDoc<{slides: FeatureSlide[]}>(showcaseContentRef);
  const { data: siteSettings, isLoading: isSiteSettingsLoading } = useDoc<SiteSettings>(siteSettingsRef);

  const fetchUsers = async (): Promise<UserProfile[]> => {
    if (!usersCollectionRef) return [];
    const snapshot = await getDocs(usersCollectionRef);
    return snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile));
  };

  const { data: users, isLoading: usersLoading } = useQuery<UserProfile[]>({
    queryKey: ['adminUsers'],
    queryFn: fetchUsers,
    enabled: !!usersCollectionRef,
  });


  const topicForm = useForm<TopicFormData>({ resolver: zodResolver(topicSchema), defaultValues: { name: '', description: '', icon: '', displayOrder: 0 }});
  const questionForm = useForm<QuestionFormData>({ resolver: zodResolver(questionSchema), defaultValues: { topicId: '', question: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'A', explanation: '', difficulty: 'medium' }});
  const notificationForm = useForm<NotificationFormData>({ resolver: zodResolver(notificationSchema), defaultValues: { title: '', message: '', type: 'announcement', priority: 'normal' }});
  const bookForm = useForm<BookFormData>({ resolver: zodResolver(bookSchema), defaultValues: { topicId: '', title: '', author: '', imageUrl: '', content: '' }});
  const aboutForm = useForm<AboutContentFormData>({ resolver: zodResolver(aboutContentSchema), defaultValues: { 
    mainParagraph: 'LegalMasters PH is a revolutionary platform designed to empower law students, legal professionals, and enthusiasts with comprehensive and accessible legal knowledge tailored for the Philippines. Our mission is to democratize legal education and provide powerful tools that make learning the law engaging, efficient, and effective.',
    vision: `I’ve always been drawn to the inner workings of technology—curious about how systems connect, evolve, and solve problems. What started as late-night tinkering with software and troubleshooting devices gradually turned into a full-fledged passion for IT. Over the years, I’ve carved out a path focused on systems architecture, mobile integration, and secure document workflows.

My strength lies in designing modular, scalable solutions that don’t just work—they look and feel right. I enjoy blending technical precision with clean, creative presentation, whether I’m building responsive web interfaces, refining backend logic, or adapting workflows for mobile environments. Every project is an opportunity to push for clarity, polish, and performance.

I believe great systems should be intuitive and visually engaging. That’s why I’m always learning, experimenting, and refining—staying ahead of the curve in a field that never stands still.`,
    team: 'For any questions, support requests, or suggestions, please do not hesitate to reach out. Your feedback is invaluable in the continuous improvement of LegalMasters PH.',
    gcashQrUrl: '',
   }});
  const featureSlideForm = useForm<FeatureSlideFormData>({ resolver: zodResolver(featureSlideSchema), defaultValues: { title: '', description: '', icon: 'Library', gradient: 'from-blue-500 to-indigo-600' } });

  React.useEffect(() => {
    if (editingTopic) topicForm.reset(editingTopic);
    else topicForm.reset({ name: '', description: '', icon: '', displayOrder: topics ? topics.length : 0 });
  }, [editingTopic, topicForm, topics]);

  React.useEffect(() => {
    if (editingQuestion) questionForm.reset(editingQuestion);
    else questionForm.reset({ topicId: '', question: '', optionA: '', optionB: '', optionC: '', optionD: 'A', correctAnswer: 'A', explanation: '', difficulty: 'medium' });
  }, [editingQuestion, questionForm]);

  React.useEffect(() => {
    if (editingBook) bookForm.reset(editingBook);
    else bookForm.reset({ topicId: '', title: '', author: '', imageUrl: '', content: '' });
  }, [editingBook, bookForm]);

   React.useEffect(() => {
    if (aboutContent) {
      aboutForm.reset(aboutContent);
    }
  }, [aboutContent, aboutForm]);
  
  React.useEffect(() => {
    if (editingSlide) {
      featureSlideForm.reset(editingSlide);
    } else {
      featureSlideForm.reset({ title: '', description: '', icon: 'Library', gradient: 'from-blue-500 to-indigo-600' });
    }
  }, [editingSlide, featureSlideForm]);


  const createContentNotification = async (title: string, message: string) => {
    if (!notificationsCollectionRef) return;
    const notificationData = {
        title,
        message,
        type: "info" as const,
        priority: "normal" as const,
        createdAt: new Date().toISOString(),
        isActive: true,
    };
    await addDoc(notificationsCollectionRef, notificationData);
  }

  const onTopicSubmit = async (data: TopicFormData) => {
    if (!topicsCollectionRef || !firestore) return;
    try {
      if (editingTopic) {
        await updateDoc(doc(firestore, 'legal_topics', editingTopic.id), data);
        toast({ title: 'Success', description: 'Topic updated successfully.' });
      } else {
        const newTopic = { ...data, bookCount: 0, questionCount: 0 };
        await addDoc(topicsCollectionRef, newTopic);
        await createContentNotification('New Topic Added', `A new topic is available for study: "${data.name}".`);
        toast({ title: 'Success', description: 'New topic added and users notified.' });
      }
      setEditingTopic(null);
      topicForm.reset({ name: '', description: '', icon: '', displayOrder: topics ? topics.length + 1 : 0 });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };
  
  const onQuestionSubmit = async (data: QuestionFormData) => {
    if (!questionsCollectionRef || !firestore) return;
    try {
        const topicRef = doc(firestore, 'legal_topics', data.topicId);
        if (editingQuestion) {
            const questionRef = doc(questionsCollectionRef, editingQuestion.id);
            if (editingQuestion.topicId !== data.topicId) {
                const oldTopicRef = doc(firestore, 'legal_topics', editingQuestion.topicId);
                await runTransaction(firestore, async (transaction) => {
                    transaction.update(oldTopicRef, { questionCount: increment(-1) });
                    transaction.update(topicRef, { questionCount: increment(1) });
                    transaction.update(questionRef, data);
                });
            } else {
                 await updateDoc(questionRef, data);
            }
            toast({ title: 'Success', description: 'Question updated successfully.' });
        } else {
            await runTransaction(firestore, async (transaction) => {
                transaction.set(doc(questionsCollectionRef), data);
                transaction.update(topicRef, { questionCount: increment(1) });
            });
            const topic = topics?.find(t => t.id === data.topicId);
            if (topic) {
                await createContentNotification('New Quiz Questions', `New questions have been added to the "${topic.name}" topic. Test your knowledge!`);
            }
            toast({ title: 'Success', description: 'New question added and users notified.' });
        }
        setEditingQuestion(null);
        questionForm.reset();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const onNotificationSubmit = async (data: NotificationFormData) => {
    if (!notificationsCollectionRef) return;
    try {
        const notificationData = {
            ...data,
            createdAt: new Date().toISOString(),
            isActive: true,
        };
        await addDoc(notificationsCollectionRef, notificationData);
        toast({ title: 'Success', description: 'Notification has been posted.' });
        notificationForm.reset();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const onBookSubmit = async (data: BookFormData) => {
    if (!booksCollectionRef || !firestore) return;
    try {
        const bookData = {
            ...data,
            isAiGenerated: data.author === 'AI Generated',
            updatedAt: new Date().toISOString(),
        };

        if (editingBook) {
            const bookRef = doc(firestore, 'books', editingBook.id);
            await runTransaction(firestore, async (transaction) => {
                 if (editingBook.topicId !== data.topicId) {
                    const oldTopicRef = doc(firestore, 'legal_topics', editingBook.topicId);
                    const newTopicRef = doc(firestore, 'legal_topics', data.topicId);
                    transaction.update(oldTopicRef, { bookCount: increment(-1) });
                    transaction.update(newTopicRef, { bookCount: increment(1) });
                }
                transaction.update(bookRef, bookData);
            });
            toast({ title: 'Success', description: 'Book updated successfully.' });
        } else {
            const topicRef = doc(firestore, 'legal_topics', data.topicId);
            await runTransaction(firestore, async (transaction) => {
                const newBookRef = doc(booksCollectionRef);
                transaction.set(newBookRef, {...bookData, createdAt: new Date().toISOString()});
                transaction.update(topicRef, { bookCount: increment(1) });
            });
            const topic = topics?.find(t => t.id === data.topicId);
            if (topic) {
                await createContentNotification('New Study Material', `A new book, "${data.title}", is now available in the "${topic.name}" topic.`);
            }
            toast({ title: 'Success', description: 'New book added and users notified.' });
        }
        setEditingBook(null);
        bookForm.reset();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const onAboutContentSubmit = async (data: AboutContentFormData) => {
    if (!aboutContentRef) return;
    try {
      await setDoc(aboutContentRef, data, { merge: true });
      toast({ title: 'Success', description: 'About page content has been updated.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };
  
    const onFeatureSlideSubmit = async (data: FeatureSlideFormData) => {
    if (!showcaseContentRef) return;
    
    let updatedSlides = showcaseContent?.slides ? [...showcaseContent.slides] : [];
    
    if (editingSlide) {
      // Update existing slide
      const index = updatedSlides.findIndex(s => s.id === editingSlide.id);
      if (index > -1) {
        updatedSlides[index] = { ...editingSlide, ...data };
      }
    } else {
      // Add new slide
      const newSlide: FeatureSlide = { ...data, id: new Date().toISOString() };
      updatedSlides.push(newSlide);
    }

    try {
      await setDoc(showcaseContentRef, { slides: updatedSlides }, { merge: true });
      toast({ title: 'Success', description: `Feature slide has been ${editingSlide ? 'updated' : 'added'}.` });
      setEditingSlide(null);
      featureSlideForm.reset();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: `Failed to save slide: ${error.message}` });
    }
  };

  const handleDeleteFeatureSlide = async (slideId: string) => {
    if (!showcaseContentRef || !showcaseContent?.slides) return;
    
    const updatedSlides = showcaseContent.slides.filter(s => s.id !== slideId);

    try {
      await updateDoc(showcaseContentRef, { slides: updatedSlides });
      toast({ title: 'Success', description: 'Feature slide has been deleted.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: `Failed to delete slide: ${error.message}` });
    }
  };
  
  const onSiteSettingsToggle = async (key: 'isMultiplayerEnabled' | 'isLeaderboardEnabled' | 'showFeatureShowcase', isEnabled: boolean) => {
    if (!siteSettingsRef) return;
    try {
      await setDoc(siteSettingsRef, { [key]: isEnabled }, { merge: true });
      let featureName = '';
      switch (key) {
        case 'isMultiplayerEnabled': featureName = '1v1 Battle'; break;
        case 'isLeaderboardEnabled': featureName = 'Leaderboard'; break;
        case 'showFeatureShowcase': featureName = 'Feature Showcase'; break;
      }
      toast({ title: 'Success', description: `${featureName} has been ${isEnabled ? 'enabled' : 'disabled'}.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: `Failed to update ${key}.` });
    }
  };


  const handleDeleteTopic = async (topicId: string) => {
    if (!firestore) return;
    try {
      const batch = writeBatch(firestore);
      
      const q = query(collection(firestore, 'questions'), where('topicId', '==', topicId));
      const questionsSnapshot = await getDocs(q);
      questionsSnapshot.forEach(doc => batch.delete(doc.ref));
      
      const booksQuery = query(collection(firestore, 'books'), where('topicId', '==', topicId));
      const booksSnapshot = await getDocs(booksQuery);
      booksSnapshot.forEach(doc => batch.delete(doc.ref));

      batch.delete(doc(firestore, 'legal_topics', topicId));
      
      await batch.commit();
      toast({ title: 'Success', description: 'Topic and all its questions and books have been deleted.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: `Failed to delete topic: ${error.message}` });
    }
  };

  const handleDeleteQuestion = async (question: QuizQuestion) => {
    if (!firestore) return;
    try {
        const questionRef = doc(firestore, 'questions', question.id);
        const topicRef = doc(firestore, 'legal_topics', question.topicId);
        
        await runTransaction(firestore, async (transaction) => {
            transaction.delete(questionRef);
            transaction.update(topicRef, { questionCount: increment(-1) });
        });
      
      toast({ title: 'Success', description: 'Question deleted.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };
  
   const handleDeleteNotification = async (notificationId: string) => {
    if (!firestore) return;
    try {
        await deleteDoc(doc(firestore, 'notifications', notificationId));
        toast({ title: 'Success', description: 'Notification deleted.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };
  
  const handleDeleteAllNotifications = async () => {
    if (!notificationsCollectionRef) return;
    try {
      const snapshot = await getDocs(notificationsCollectionRef);
      if (snapshot.empty) {
        toast({ title: 'No notifications to delete.' });
        return;
      }
      const batch = writeBatch(firestore!);
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      toast({ title: 'Success', description: `All ${snapshot.size} notifications have been deleted.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: `Failed to delete notifications: ${error.message}` });
    }
  };

  const handleDeleteBook = async (book: Book) => {
    if (!firestore) return;
    try {
        const bookRef = doc(firestore, 'books', book.id);
        const topicRef = doc(firestore, 'legal_topics', book.topicId);
        
        await runTransaction(firestore, async (transaction) => {
            transaction.delete(bookRef);
            transaction.update(topicRef, { bookCount: increment(-1) });
        });

      toast({ title: 'Success', description: 'Book deleted.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleCsvUpload = (file: File, type: 'topics' | 'questions' | 'books') => {
    if (!firestore || !questionsCollectionRef || !topicsCollectionRef || !booksCollectionRef) return;
    setIsUploading(true);
  
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const batch = writeBatch(firestore);
        let addedCount = 0;
        let skippedCount = 0;
  
        try {
          const topicCountUpdates: Record<string, { book: number; question: number }> = {};
          
          // Pre-fetch all valid topic IDs to validate against
          const topicsSnapshot = await getDocs(topicsCollectionRef);
          const validTopicIds = new Set(topicsSnapshot.docs.map(doc => doc.id));


          const processRow = async (row: any) => {
             if (type === 'topics') {
                if (!row.name || !row.description) {
                    skippedCount++;
                    return;
                }
                const newTopicRef = doc(topicsCollectionRef);
                const parsedOrder = parseInt(row.displayOrder, 10);
                const displayOrder = isNaN(parsedOrder) ? 0 : parsedOrder;
                
                batch.set(newTopicRef, {
                    name: row.name,
                    description: row.description,
                    icon: row.icon || 'Book',
                    displayOrder: displayOrder,
                    bookCount: 0,
                    questionCount: 0,
                });
                addedCount++;
            } else if (type === 'questions') {
                 const requiredFields = ['topicId', 'question', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer', 'explanation'];
                 const hasAllFields = requiredFields.every(field => row[field] && row[field].trim() !== '');
                 // Also check if the topicId from the CSV is valid
                 if (!hasAllFields || !validTopicIds.has(row.topicId)) {
                    skippedCount++;
                    return;
                 }
                 const { topicId, question, optionA, optionB, optionC, optionD, correctAnswer, explanation, difficulty } = row;
                 const newQuestionRef = doc(questionsCollectionRef);
                 batch.set(newQuestionRef, { topicId, question, optionA, optionB, optionC, optionD, correctAnswer, explanation, difficulty: difficulty || 'medium' });
                 addedCount++;
                 topicCountUpdates[topicId] = { book: 0, question: (topicCountUpdates[topicId]?.question || 0) + 1 };
             } else if (type === 'books') {
                const requiredFields = ['topicId', 'title', 'author', 'content'];
                const hasAllFields = requiredFields.every(field => row[field] && row[field].trim() !== '');
                if (!hasAllFields || !validTopicIds.has(row.topicId)) {
                    skippedCount++;
                    return;
                }
                const { topicId, title, author, content, imageUrl } = row as BookCSVRow;
                const newBookRef = doc(booksCollectionRef);
                batch.set(newBookRef, { 
                    topicId, title, author, content, imageUrl: imageUrl || '',
                    isAiGenerated: author === 'AI Generated',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                addedCount++;
                topicCountUpdates[topicId] = { question: 0, book: (topicCountUpdates[topicId]?.book || 0) + 1 };
            }
          };

          await Promise.all(results.data.map(row => processRow(row)));

          // Update topic counts
          for (const [topicId, counts] of Object.entries(topicCountUpdates)) {
            if (!topicId) continue;
            const topicRef = doc(firestore, 'legal_topics', topicId);
            if (counts.question > 0) batch.update(topicRef, { questionCount: increment(counts.question) });
            if (counts.book > 0) batch.update(topicRef, { bookCount: increment(counts.book) });
          }

          if (addedCount > 0) {
            await createContentNotification(`New Content Added`, `${addedCount} new ${type} have been added via CSV upload.`);
          }
          
          await batch.commit();
          
          let description = `${addedCount} new ${type} have been added.`;
          if (skippedCount > 0) {
            description += ` ${skippedCount} invalid or duplicate records were skipped.`;
          }
          
          toast({ title: 'Upload Successful', description });
        } catch(e: any) {
             toast({ variant: 'destructive', title: `Upload Failed`, description: e.message });
        } finally {
            setIsUploading(false);
            if (topicCsvInputRef.current) topicCsvInputRef.current.value = '';
            if (questionCsvInputRef.current) questionCsvInputRef.current.value = '';
            if (bookCsvInputRef.current) bookCsvInputRef.current.value = '';
        }
      },
      error: (error: any) => {
        toast({ variant: 'destructive', title: 'CSV Parsing Error', description: error.message });
        setIsUploading(false);
      }
    });
  };

  const onFileSelected = (event: React.ChangeEvent<HTMLInputElement>, type: 'topics' | 'questions' | 'books') => {
    const file = event.target.files?.[0];
    if (file) {
        handleCsvUpload(file, type);
    }
  };

  const handleBookContentFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            bookForm.setValue('content', content);
            toast({ title: 'Success', description: 'Book content loaded from file.' });
        };
        reader.readAsText(file);
    } else {
        toast({ variant: 'destructive', title: 'Invalid File', description: 'Please select a .txt file.' });
    }
  };
  
  const handleDeleteAllQuestions = async () => {
    if (!firestore || !questionsCollectionRef) return;
    try {
      const batch = writeBatch(firestore);
      const questionsSnapshot = await getDocs(questionsCollectionRef);
      if (questionsSnapshot.empty) {
          toast({ title: 'No questions to delete', description: 'The questions collection is already empty.' });
          return;
      }
      
      // Reset all topic question counts
      const topicsSnapshot = await getDocs(topicsCollectionRef!);
      topicsSnapshot.forEach(topicDoc => {
          batch.update(topicDoc.ref, { questionCount: 0 });
      });

      questionsSnapshot.forEach(doc => batch.delete(doc.ref));
      
      await batch.commit();
      toast({ title: 'Success', description: `All ${questionsSnapshot.size} quiz questions have been deleted and topic counts have been reset.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: `Failed to delete all questions: ${error.message}` });
    }
  };

  const handleDeleteAllBooks = async () => {
    if (!firestore || !booksCollectionRef) return;
    try {
      const batch = writeBatch(firestore);
      const booksSnapshot = await getDocs(booksCollectionRef);
       if (booksSnapshot.empty) {
          toast({ title: 'No books to delete', description: 'The books collection is already empty.' });
          return;
      }

      // Reset all topic book counts
      const topicsSnapshot = await getDocs(topicsCollectionRef!);
      topicsSnapshot.forEach(topicDoc => {
          batch.update(topicDoc.ref, { bookCount: 0 });
      });

      booksSnapshot.forEach(doc => batch.delete(doc.ref));
      
      await batch.commit();
      toast({ title: 'Success', description: `All ${booksSnapshot.size} books have been deleted and topic counts have been reset.` });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to delete all books: ${error.message}` });
    }
  };

  const handleDeleteAllTopics = async () => {
     if (!firestore || !topicsCollectionRef || !questionsCollectionRef || !booksCollectionRef) return;
    try {
        const batch = writeBatch(firestore);

        const topicsSnapshot = await getDocs(topicsCollectionRef);
        if (topicsSnapshot.empty) {
            toast({ title: 'No topics to delete.' });
            return;
        }

        const questionsSnapshot = await getDocs(questionsCollectionRef);
        questionsSnapshot.forEach(doc => batch.delete(doc.ref));

        const booksSnapshot = await getDocs(booksCollectionRef);
        booksSnapshot.forEach(doc => batch.delete(doc.ref));
        
        topicsSnapshot.forEach(doc => batch.delete(doc.ref));

        await batch.commit();
        toast({ title: 'Success', description: 'All topics and their associated books and questions have been deleted.' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Failed to delete all topics: ${error.message}` });
    }
  };

  const handleClearLeaderboard = async () => {
    if (!firestore || !gameResultsCollectionRef) return;
    try {
      const batch = writeBatch(firestore);
      const snapshot = await getDocs(gameResultsCollectionRef);
      if (snapshot.empty) {
        toast({ title: 'Leaderboard is already empty.' });
        return;
      }
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      toast({ title: 'Success', description: `Cleared ${snapshot.size} entries from the leaderboard.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: `Failed to clear leaderboard: ${error.message}` });
    }
  };
  
    const handleCopySchema = () => {
        navigator.clipboard.writeText(backendJsonString).then(() => {
            setHasCopied(true);
            setTimeout(() => setHasCopied(false), 2000);
        });
    };

    const handleUpdateReportStatus = async (reportId: string, status: FeedbackType['status']) => {
        if (!firestore) return;
        const reportRef = doc(firestore, 'feedback', reportId);
        try {
            await updateDoc(reportRef, { status });
            toast({ title: 'Success', description: `Report status updated to ${status}.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to update status: ${error.message}` });
        }
    };

    const handleDeleteReport = async (reportId: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'feedback', reportId));
            toast({ title: 'Success', description: 'Report deleted.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Failed to delete report: ${error.message}` });
        }
    };


  return (
    <MainLayout onAuthDialogOpen={onAuthDialogOpen}>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Users" value={users?.length ?? 0} icon={Users2} isLoading={usersLoading} />
          <StatCard title="Total Topics" value={topics?.length ?? 0} icon={Library} isLoading={topicsLoading} />
          <StatCard title="Total Books" value={books?.length ?? 0} icon={BookIcon} isLoading={booksLoading} />
          <StatCard title="Total Questions" value={questions?.length ?? 0} icon={HelpCircleIcon} isLoading={questionsLoading} />
        </div>

        <Tabs defaultValue="content" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="content"><FileText className="mr-2"/>Content</TabsTrigger>
            <TabsTrigger value="users"><Users className="mr-2"/>Users</TabsTrigger>
            <TabsTrigger value="moderation"><ShieldAlert className="mr-2"/>Moderation</TabsTrigger>
            <TabsTrigger value="tools"><Database className="mr-2"/>Data Tools</TabsTrigger>
            <TabsTrigger value="site"><Settings className="mr-2"/>Site</TabsTrigger>
          </TabsList>
          
          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookIcon />{editingBook ? 'Edit Book' : 'Add a New Book'}</CardTitle>
                <CardDescription>{editingBook ? `You are editing "${editingBook.title}".` : 'Add study content for a topic.'}</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...bookForm}>
                  <form onSubmit={bookForm.handleSubmit(onBookSubmit)} className="space-y-6">
                    <FormField control={bookForm.control} name="topicId" render={({ field }) => (<FormItem><FormLabel>Topic</FormLabel><Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a topic for this book" /></SelectTrigger></FormControl><SelectContent>{topicsLoading ? <SelectItem value="loading" disabled>Loading topics...</SelectItem> : topics?.map(topic => <SelectItem key={topic.id} value={topic.id}>{topic.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={bookForm.control} name="title" render={({ field }) => (<FormItem><FormLabel>Book Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={bookForm.control} name="author" render={({ field }) => (<FormItem><FormLabel>Author</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                     <FormField control={bookForm.control} name="imageUrl" render={({ field }) => (<FormItem><FormLabel>Image URL (Optional)</FormLabel><FormControl><Input {...field} placeholder="https://example.com/image.jpg" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={bookForm.control} name="content" render={({ field }) => (
                        <FormItem>
                            <div className="flex justify-between items-center">
                                <FormLabel>Content (Markdown)</FormLabel>
                                <Button type="button" variant="outline" size="sm" onClick={() => bookContentFileInputRef.current?.click()}>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload .txt
                                </Button>
                                <input type="file" ref={bookContentFileInputRef} accept=".txt" className="hidden" onChange={handleBookContentFile} />
                            </div>
                            <FormControl><Textarea {...field} rows={15} placeholder="Write your book content here using Markdown..." /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <div className="flex gap-4">
                      <Button type="submit" disabled={bookForm.formState.isSubmitting}>{editingBook ? 'Update Book' : 'Add Book'}</Button>
                      {editingBook && (<Button variant="outline" onClick={() => setEditingBook(null)}>Cancel</Button>)}
                    </div>
                  </form>
                </Form>
              </CardContent>
               <CardFooter>
                 <ScrollArea className="h-[400px] w-full border rounded-md">
                    {booksLoading ? (
                        <TableSkeleton rows={5} cells={3} />
                    ) : (
                        <Table>
                            <TableHeader><TableRow><TableHead>Topic</TableHead><TableHead>Book Title</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {books && books.map((book) => {
                                    const topicName = topics?.find(t => t.id === book.topicId)?.name || 'Unknown';
                                    return (
                                        <TableRow key={book.id}>
                                            <TableCell className="font-medium">{topicName}</TableCell>
                                            <TableCell>{book.title}</TableCell>
                                            <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => setEditingBook(book)}><Edit className="h-4 w-4" /><span className="sr-only">Edit</span></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></Button></AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>This action will permanently delete the book "{book.title}".</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteBook(book)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </ScrollArea>
              </CardFooter>
            </Card>

            <Separator />

             <Card>
                <CardHeader>
                    <CardTitle>{editingTopic ? 'Edit Topic' : 'Add a New Topic'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...topicForm}>
                    <form onSubmit={topicForm.handleSubmit(onTopicSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={topicForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Topic Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={topicForm.control} name="icon" render={({ field }) => (<FormItem><FormLabel>Lucide Icon Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Book, Gavel" /></FormControl><FormMessage /></FormItem>)}/>
                        </div>
                        <FormField control={topicForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={topicForm.control} name="displayOrder" render={({ field }) => (<FormItem><FormLabel>Display Order</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <div className="flex gap-4">
                            <Button type="submit" disabled={topicForm.formState.isSubmitting}>{editingTopic ? 'Update Topic' : 'Add Topic'}</Button>
                            {editingTopic && (<Button variant="outline" onClick={() => setEditingTopic(null)}>Cancel</Button>)}
                        </div>
                    </form>
                    </Form>
                </CardContent>
                <CardFooter>
                     <ScrollArea className="h-[400px] w-full border rounded-md">
                        {topicsLoading ? (
                            <TableSkeleton rows={5} cells={4} />
                        ) : (
                            <Table>
                                <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Name</TableHead><TableHead className="hidden md:table-cell">Description</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {topics && topics.map((topic) => (
                                    <TableRow key={topic.id}>
                                        <TableCell>{(typeof topic.displayOrder === 'number' && !isNaN(topic.displayOrder)) ? topic.displayOrder : 0}</TableCell>
                                        <TableCell className="font-medium">{topic.name}</TableCell>
                                        <TableCell className="hidden md:table-cell line-clamp-2">{topic.description}</TableCell>
                                        <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => setEditingTopic(topic)}><Edit className="h-4 w-4" /><span className="sr-only">Edit</span></Button>
                                            <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete the topic "{topic.name}" and ALL of its associated questions and books. This action cannot be undone.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteTopic(topic.id)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                        </TableCell>
                                    </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </ScrollArea>
                </CardFooter>
            </Card>

            <Separator />

             <Card>
                <CardHeader>
                    <CardTitle>{editingQuestion ? 'Edit Question' : 'Add a New Quiz Question'}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...questionForm}>
                        <form onSubmit={questionForm.handleSubmit(onQuestionSubmit)} className="space-y-6">
                            <FormField control={questionForm.control} name="topicId" render={({ field }) => (<FormItem><FormLabel>Topic</FormLabel><Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a topic for this question" /></SelectTrigger></FormControl><SelectContent>{topicsLoading && <SelectItem value="loading" disabled>Loading topics...</SelectItem>}{topics?.map(topic => <SelectItem key={topic.id} value={topic.id}>{topic.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                            <FormField control={questionForm.control} name="question" render={({ field }) => (<FormItem><FormLabel>Question Text</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={questionForm.control} name="optionA" render={({ field }) => (<FormItem><FormLabel>Option A</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={questionForm.control} name="optionB" render={({ field }) => (<FormItem><FormLabel>Option B</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={questionForm.control} name="optionC" render={({ field }) => (<FormItem><FormLabel>Option C</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={questionForm.control} name="optionD" render={({ field }) => (<FormItem><FormLabel>Option D</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={questionForm.control} name="correctAnswer" render={({ field }) => (<FormItem><FormLabel>Correct Answer</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="A">Option A</SelectItem><SelectItem value="B">Option B</SelectItem><SelectItem value="C">Option C</SelectItem><SelectItem value="D">Option D</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                                <FormField control={questionForm.control} name="difficulty" render={({ field }) => (<FormItem><FormLabel>Difficulty</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem><SelectItem value="expert">Expert</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                            </div>
                            <FormField control={questionForm.control} name="explanation" render={({ field }) => (<FormItem><FormLabel>Explanation</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <div className="flex gap-4">
                                <Button type="submit" disabled={questionForm.formState.isSubmitting}>{editingQuestion ? 'Update Question' : 'Add Question'}</Button>
                                {editingQuestion && (<Button variant="outline" onClick={() => setEditingQuestion(null)}>Cancel</Button>)}
                            </div>
                        </form>
                    </Form>
                </CardContent>
                 <CardFooter>
                    <ScrollArea className="h-[400px] w-full border rounded-md">
                        {questionsLoading ? (
                            <TableSkeleton rows={5} cells={3} />
                        ) : (
                            <Table>
                                <TableHeader><TableRow><TableHead>Topic</TableHead><TableHead>Question</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {questions && questions.map((q) => {
                                        const topicName = topics?.find(t => t.id === q.topicId)?.name || 'Unknown';
                                        return (
                                            <TableRow key={q.id}>
                                                <TableCell className="font-medium">{topicName}</TableCell>
                                                <TableCell className="line-clamp-2">{q.question}</TableCell>
                                                <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => setEditingQuestion(q)}><Edit className="h-4 w-4" /><span className="sr-only">Edit</span></Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></Button></AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>This action cannot be undone. This will permanently delete the question.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteQuestion(q)}>Delete</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </ScrollArea>
                </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
              <UserManagement />
          </TabsContent>
          
          <TabsContent value="moderation" className="space-y-6">
              <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2"><ShieldAlert /> User Feedback & Reports</CardTitle>
                      <CardDescription>Review and manage user-submitted feedback.</CardDescription>
                  </CardHeader>
                  <CardContent>
                       <ScrollArea className="h-[600px] w-full border rounded-md">
                        {reportsLoading ? (
                            <TableSkeleton rows={5} cells={4} />
                        ) : !reports || reports.length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground">No reports found.</div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Submitted</TableHead>
                                        <TableHead>Message</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reports.map((report) => (
                                        <TableRow key={report.id}>
                                            <TableCell className="text-xs">
                                                {report.submissionDate?.seconds ? formatDistanceToNow(new Date(report.submissionDate.seconds * 1000), { addSuffix: true }) : 'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                <p className="font-semibold line-clamp-2">{report.message}</p>
                                                <p className="text-sm text-muted-foreground">User ID: {report.userProfileId}</p>
                                            </TableCell>
                                            <TableCell>
                                                 <Select 
                                                    value={report.status} 
                                                    onValueChange={(newStatus: FeedbackType['status']) => handleUpdateReportStatus(report.id, newStatus)}
                                                >
                                                    <SelectTrigger className="w-[120px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="new"><Badge variant="destructive" className="text-xs">New</Badge></SelectItem>
                                                        <SelectItem value="reviewed"><Badge variant="secondary" className="text-xs">Reviewed</Badge></SelectItem>
                                                        <SelectItem value="resolved"><Badge variant="default" className="bg-green-600 text-xs">Resolved</Badge></SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" title="Delete Report" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>This action will permanently delete this report.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteReport(report.id)}>Delete</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </ScrollArea>
                  </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="tools" className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileUp /> Bulk Data Management</CardTitle>
                    <CardDescription>Upload CSV files to quickly add topics, questions, or books to the database.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4">
                        <Button variant="outline" onClick={() => topicCsvInputRef.current?.click()} disabled={isUploading}>
                            {isUploading ? 'Uploading...' : 'Upload Topics CSV'}
                        </Button>
                        <Button variant="outline" onClick={() => questionCsvInputRef.current?.click()} disabled={isUploading}>
                            {isUploading ? 'Uploading...' : 'Upload Questions CSV'}
                        </Button>
                        <Button variant="outline" onClick={() => bookCsvInputRef.current?.click()} disabled={isUploading}>
                            {isUploading ? 'Uploading...' : 'Upload Books CSV'}
                        </Button>
                        <input type="file" ref={topicCsvInputRef} accept=".csv" className="hidden" onChange={(e) => onFileSelected(e, 'topics')} />
                        <input type="file" ref={questionCsvInputRef} accept=".csv" className="hidden" onChange={(e) => onFileSelected(e, 'questions')} />
                        <input type="file" ref={bookCsvInputRef} accept=".csv" className="hidden" onChange={(e) => onFileSelected(e, 'books')} />
                    </div>
                    <div className="text-sm text-muted-foreground mt-4 space-y-2">
                        <p><strong>Topics CSV format:</strong> The CSV must have columns: `name`, `description`, `icon`, `displayOrder`.</p>
                        <p><strong>Questions CSV format:</strong> Must have columns: `topicId`, `question`, `optionA`, `optionB`, `optionC`, `optionD`, `correctAnswer`, `explanation`, `difficulty`.</p>
                        <p><strong>Books CSV format:</strong> Must have columns: `topicId`, `title`, `author`, `content`.</p>
                    </div>
                </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">Application Schema</CardTitle>
                  <CardDescription>This is the `backend.json` schema for tracing and debugging purposes.</CardDescription>
              </CardHeader>
              <CardContent>
                  <div className="relative">
                      <Button variant="outline" size="sm" onClick={handleCopySchema} className="absolute top-2 right-2">
                          {hasCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                          {hasCopied ? 'Copied!' : 'Copy Schema'}
                      </Button>
                      <Textarea value={backendJsonString} readOnly rows={16} className="bg-muted font-mono text-xs" />
                  </div>
              </CardContent>
            </Card>
          </TabsContent>

           {/* SITE MANAGEMENT TAB */}
           <TabsContent value="site" className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Settings />Feature Toggles</CardTitle>
                        <CardDescription>Enable or disable major features for all users.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         <div className="flex items-center space-x-4 rounded-md border p-4">
                            <Presentation />
                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium leading-none">Feature Showcase</p>
                                <p className="text-sm text-muted-foreground">
                                    {siteSettings?.showFeatureShowcase ? "Showcase is VISIBLE to logged-out users" : "Showcase is HIDDEN from logged-out users"}
                                </p>
                            </div>
                            <Switch
                                id="showcase-toggle"
                                checked={siteSettings?.showFeatureShowcase ?? true}
                                onCheckedChange={(checked) => onSiteSettingsToggle('showFeatureShowcase', checked)}
                                disabled={isSiteSettingsLoading}
                            />
                        </div>
                        <div className="flex items-center space-x-4 rounded-md border p-4">
                            <Swords />
                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium leading-none">1v1 Battle (Multiplayer)</p>
                                <p className="text-sm text-muted-foreground">
                                    {siteSettings?.isMultiplayerEnabled ? "Multiplayer is ACTIVE" : "Multiplayer is DISABLED"}
                                </p>
                            </div>
                            <Switch
                                id="multiplayer-toggle"
                                checked={siteSettings?.isMultiplayerEnabled ?? true}
                                onCheckedChange={(checked) => onSiteSettingsToggle('isMultiplayerEnabled', checked)}
                                disabled={isSiteSettingsLoading}
                            />
                        </div>
                         <div className="flex items-center space-x-4 rounded-md border p-4">
                            <Trophy />
                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium leading-none">Leaderboard</p>
                                <p className="text-sm text-muted-foreground">
                                    {siteSettings?.isLeaderboardEnabled ? "Leaderboard is ACTIVE" : "Leaderboard is DISABLED"}
                                </p>
                            </div>
                             <Switch
                                id="leaderboard-toggle"
                                checked={siteSettings?.isLeaderboardEnabled ?? true}
                                onCheckedChange={(checked) => onSiteSettingsToggle('isLeaderboardEnabled', checked)}
                                disabled={isSiteSettingsLoading}
                            />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Presentation /> Feature Showcase Editor</CardTitle>
                        <CardDescription>Manage the slides shown to logged-out users on the dashboard.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...featureSlideForm}>
                            <form onSubmit={featureSlideForm.handleSubmit(onFeatureSlideSubmit)} className="space-y-6 p-4 border rounded-lg">
                                <h3 className="text-lg font-medium">{editingSlide ? 'Edit Slide' : 'Add New Slide'}</h3>
                                <FormField control={featureSlideForm.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={featureSlideForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={featureSlideForm.control} name="icon" render={({ field }) => (<FormItem><FormLabel>Lucide Icon Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Library, Gamepad2" /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={featureSlideForm.control} name="gradient" render={({ field }) => (<FormItem><FormLabel>Tailwind Gradient</FormLabel><FormControl><Input {...field} placeholder="e.g., from-blue-500 to-indigo-600" /></FormControl><FormMessage /></FormItem>)} />
                                <div className="flex gap-2">
                                    <Button type="submit">{editingSlide ? 'Update Slide' : 'Add Slide'}</Button>
                                    {editingSlide && <Button variant="outline" onClick={() => setEditingSlide(null)}>Cancel</Button>}
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                    <CardFooter>
                        <ScrollArea className="h-[300px] w-full">
                            <div className="space-y-4">
                            {isShowcaseLoading && <p>Loading slides...</p>}
                            {showcaseContent?.slides?.map(slide => {
                                const Icon = (LucideIcons as any)[slide.icon] || Presentation;
                                return (
                                <div key={slide.id} className="flex items-center justify-between p-3 rounded-lg border">
                                    <div className="flex items-center gap-4">
                                        <div className={`flex items-center justify-center h-10 w-10 rounded-md bg-gradient-to-br ${slide.gradient}`}><Icon className="h-6 w-6 text-white" /></div>
                                        <div>
                                            <p className="font-semibold">{slide.title}</p>
                                            <p className="text-sm text-muted-foreground line-clamp-1">{slide.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => setEditingSlide(slide)}><Edit className="h-4 w-4" /></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the slide "{slide.title}".</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteFeatureSlide(slide.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                                );
                            })}
                            </div>
                        </ScrollArea>
                    </CardFooter>
                </Card>
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div className="space-y-1.5">
                                <CardTitle className="flex items-center gap-2"><Bell /> Post a Notification</CardTitle>
                                <CardDescription>Create an announcement that will be displayed on the user dashboard.</CardDescription>
                            </div>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">Clear All</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>This action will permanently delete all notifications and cannot be undone.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteAllNotifications}>
                                        Yes, delete all
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Form {...notificationForm}>
                            <form onSubmit={notificationForm.handleSubmit(onNotificationSubmit)} className="space-y-6">
                                <FormField control={notificationForm.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={notificationForm.control} name="message" render={({ field }) => (<FormItem><FormLabel>Message</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField control={notificationForm.control} name="type" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="announcement">Announcement</SelectItem><SelectItem value="info">Info</SelectItem><SelectItem value="warning">Warning</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={notificationForm.control} name="priority" render={({ field }) => (<FormItem><FormLabel>Priority</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                </div>
                                <Button type="submit" disabled={notificationForm.formState.isSubmitting}>Post Notification</Button>
                            </form>
                        </Form>
                    </CardContent>
                    <CardFooter>
                        <ScrollArea className="h-[300px] w-full border rounded-md">
                           {notificationsLoading ? (
                               <TableSkeleton rows={3} cells={3} />
                           ) : (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Message</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {notifications && notifications.map((n) => (
                                            <TableRow key={n.id}><TableCell>{n.title}</TableCell><TableCell className="line-clamp-2">{n.message}</TableCell><TableCell className="text-right">
                                                <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone and will permanently delete the notification.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteNotification(n.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                                            </TableCell></TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                           )}
                        </ScrollArea>
                    </CardFooter>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Info /> About Page Content</CardTitle>
                        <CardDescription>Edit the text content displayed on the public "About Us" page.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...aboutForm}>
                        <form onSubmit={aboutForm.handleSubmit(onAboutContentSubmit)} className="space-y-6">
                            <FormField
                            control={aboutForm.control}
                            name="mainParagraph"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Main Introduction</FormLabel>
                                <FormControl>
                                    <Textarea rows={5} {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={aboutForm.control}
                            name="vision"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>From the Developer</FormLabel>
                                <FormControl>
                                    <Textarea rows={10} {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={aboutForm.control}
                            name="team"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Support & Feedback</FormLabel>
                                <FormControl>
                                    <Textarea rows={3} {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                             <FormField
                              control={aboutForm.control}
                              name="gcashQrUrl"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>GCash QR Code Image URL</FormLabel>
                                  <FormControl>
                                    <Input placeholder="https://example.com/your-qr-code.png" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button type="submit" disabled={aboutForm.formState.isSubmitting}>
                            {isAboutContentLoading || aboutForm.formState.isSubmitting ? 'Saving...' : 'Save About Content'}
                            </Button>
                        </form>
                        </Form>
                    </CardContent>
                </Card>
                <Card className="border-destructive">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle /> Danger Zone</CardTitle>
                    <CardDescription>These actions are irreversible. Please proceed with caution.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex flex-col items-start gap-2">
                        <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">Clear Leaderboard</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This action will permanently delete all entries from the global leaderboard. This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleClearLeaderboard}>
                                Yes, clear leaderboard
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                        </AlertDialog>
                        <p className="text-sm text-muted-foreground">This will permanently remove all documents from the 'game_results' collection.</p>
                    </div>
                     <Separator />
                    <div className="flex flex-col items-start gap-2">
                        <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">Delete All Books</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This action will permanently delete all books from the database and reset book counts on all topics. This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteAllBooks}>
                                Yes, delete all books
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                        </AlertDialog>
                        <p className="text-sm text-muted-foreground">This will permanently remove all books from the 'books' collection.</p>
                    </div>
                     <div className="flex flex-col items-start gap-2">
                        <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">Delete All Quiz Questions</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This action will permanently delete all quiz questions from the database and reset question counts on all topics. This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteAllQuestions}>
                                Yes, delete all questions
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                        </AlertDialog>
                        <p className="text-sm text-muted-foreground">This will permanently remove all questions from the 'questions' collection.</p>
                    </div>
                     <div className="flex flex-col items-start gap-2">
                        <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">Delete All Topics</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>DANGER: Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>This action will permanently delete ALL topics, and consequently, ALL books and questions associated with them. This is the most destructive action and cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteAllTopics}>
                                Yes, delete all topics
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                        </AlertDialog>
                        <p className="text-sm text-muted-foreground">This will permanently remove all topics, books, and questions from the database.</p>                    </div>
                  </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
