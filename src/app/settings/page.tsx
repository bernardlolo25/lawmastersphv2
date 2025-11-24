
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MainLayout } from '@/components/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth, useUser } from '@/firebase';
import { updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const emailSchema = z.object({
  newEmail: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required to confirm changes'),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords don't match",
    path: ['confirmPassword'],
  });

type EmailFormData = z.infer<typeof emailSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

const themes = [
  {
    name: 'Default',
    colors: {
      background: '240 10% 97%',
      foreground: '240 10% 20%',
      primary: '235 62% 29%',
      secondary: '233 40% 41%',
      accent: '231 48% 54%',
      card: '0 0% 100%',
    },
  },
  {
    name: 'Midnight Dusk',
    colors: {
      background: '240 10% 10%',
      foreground: '0 0% 98%',
      primary: '231 48% 58%',
      secondary: '233 40% 45%',
      accent: '231 48% 54%',
      card: '240 10% 15%',
    },
  },
  {
    name: 'Oceanic',
    colors: {
      background: '200 100% 97%',
      foreground: '210 20% 25%',
      primary: '210 90% 40%',
      secondary: '205 80% 55%',
      accent: '190 100% 45%',
      card: '0 0% 100%',
    },
  },
  {
    name: 'Sunset',
    colors: {
      background: '20 50% 98%',
      foreground: '25 30% 20%',
      primary: '15 85% 55%',
      secondary: '30 90% 65%',
      accent: '45 100% 60%',
      card: '0 0% 100%',
    },
  },
  {
    name: 'Mint',
    colors: {
      background: '150 60% 98%',
      foreground: '160 20% 20%',
      primary: '160 80% 35%',
      secondary: '155 70% 45%',
      accent: '150 90% 60%',
      card: '0 0% 100%',
    },
  },
];

export default function SettingsPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [selectedTheme, setSelectedTheme] = React.useState(themes[0].name);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: '', password: '' },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const handleReauthenticate = async (password: string) => {
    if (!user || !user.email) throw new Error('User not found or has no email.');
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
  };

  const onEmailSubmit = async (data: EmailFormData) => {
    if (!user) return;
    try {
      await handleReauthenticate(data.password);
      await updateEmail(user, data.newEmail);
      toast({ title: 'Success', description: 'Your email has been updated.' });
      emailForm.reset();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error updating email',
        description: error.message || 'An unknown error occurred.',
      });
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    if (!user) return;
    try {
      await handleReauthenticate(data.currentPassword);
      await updatePassword(user, data.newPassword);
      toast({ title: 'Success', description: 'Your password has been changed.' });
      passwordForm.reset();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error changing password',
        description: error.message || 'An unknown error occurred.',
      });
    }
  };

  const applyTheme = React.useCallback((themeName: string) => {
    const theme = themes.find(t => t.name === themeName);
    if (!theme) return;
    
    setSelectedTheme(themeName);
    
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });

    if (theme.name.toLowerCase().includes('dusk')) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Store in localStorage to persist
    localStorage.setItem('app-theme', themeName);
  }, []);
  
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme');
    if (savedTheme) {
      applyTheme(savedTheme);
    }
  }, [applyTheme]);

  if (isUserLoading) {
    return (
        <MainLayout>
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-12 w-12 animate-spin" />
            </div>
        </MainLayout>
    )
  }

  if (!user) {
    // This is a failsafe. MainLayout should handle the redirect.
    return (
        <MainLayout>
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-12 w-12 animate-spin" />
            </div>
        </MainLayout>
    )
}

  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-2">
          <h2 className="font-headline text-3xl font-bold">Settings</h2>
          <p className="text-muted-foreground">Manage your account and app preferences.</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize the look and feel of the application.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {themes.map(theme => (
                <div key={theme.name} className="space-y-2">
                  <button
                    onClick={() => applyTheme(theme.name)}
                    className={cn(
                      'w-full h-20 rounded-lg border-2 flex items-center justify-center',
                       selectedTheme === theme.name ? 'border-primary' : 'border-transparent'
                    )}
                  >
                     <div className="flex -space-x-2">
                        <div className="w-10 h-10 rounded-full border-2 border-card" style={{ backgroundColor: `hsl(${theme.colors.primary})` }}></div>
                        <div className="w-10 h-10 rounded-full border-2 border-card" style={{ backgroundColor: `hsl(${theme.colors.accent})` }}></div>
                     </div>
                  </button>
                  <p className="text-center text-sm font-medium">{theme.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>Update your email address and password.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Form {...emailForm}>
                    <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                        <FormField
                            control={emailForm.control}
                            name="newEmail"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>New Email</FormLabel>
                                <FormControl><Input type="email" placeholder="new.email@example.com" {...field} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={emailForm.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Current Password</FormLabel>
                                <FormControl><Input type="password" placeholder="Enter your password to confirm" {...field} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={emailForm.formState.isSubmitting}>
                            {emailForm.formState.isSubmitting ? 'Updating Email...' : 'Update Email'}
                        </Button>
                    </form>
                </Form>

                <Separator className="my-6" />

                <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                         <FormField
                            control={passwordForm.control}
                            name="currentPassword"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Current Password</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={passwordForm.control}
                            name="newPassword"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>New Password</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={passwordForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Confirm New Password</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                            {passwordForm.formState.isSubmitting ? 'Changing Password...' : 'Change Password'}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>

      </div>
    </MainLayout>
  );
}
