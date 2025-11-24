
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookCopy,
  Gamepad2,
  Gavel,
  Info,
  LayoutDashboard,
  MessageSquare,
  Scale,
  Settings,
  TrendingUp,
  UserCircle,
  LogOut,
  RefreshCw,
  LogIn,
  BookOpen,
  Trophy,
  Swords,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, useUser, useFirestore, useMemoFirebase } from "@/firebase";
import { signOut } from "firebase/auth";
import { AuthDialog } from "./auth/auth-dialog";
import { doc, onSnapshot } from "firebase/firestore";
import { useDoc } from "@/firebase/firestore/use-doc";
import { Skeleton } from "./ui/skeleton";
import type { SiteSettings, UserProfile } from "@/lib/types";
import { usePresence, useConnectionStatus } from "@/hooks/use-presence";

const allMenuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/books", label: "Books", icon: BookOpen },
  { href: "/review-mode", label: "Review Mode", icon: BookCopy },
  { href: "/gaming-mode", label: "Gaming Mode", icon: Gamepad2 },
  { href: "/multiplayer", label: "1v1 Battle", icon: Swords, id: 'multiplayer', protected: true },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy, id: "leaderboard", protected: true },
  { href: "/progress-tracking", label: "Progress Tracking", icon: TrendingUp, protected: true },
  { href: "/settings", label: "Customize", icon: Settings, protected: true },
  { href: "/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/about", label: "About", icon: Info },
];


function UserDisplay({ onAuthDialogOpen }: { onAuthDialogOpen?: () => void }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { isConnected } = useConnectionStatus();

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, `users`, user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);
  
  const handleLogout = async () => {
    if(auth) {
      await signOut(auth);
    }
  };

  const getDisplayName = () => {
    if (!userProfile) return user?.email || 'Legal Eagle';
    if (userProfile.displayNamePreference === 'username' && userProfile.username) {
      return userProfile.username;
    }
    if (userProfile.firstName && userProfile.lastName) {
      return `${userProfile.firstName} ${userProfile.lastName}`;
    }
    return userProfile.username || userProfile.firstName || user?.email || 'Legal Eagle';
  };
  
  if (isProfileLoading) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }
  
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onAuthDialogOpen}>Login</Button>
        <Button onClick={onAuthDialogOpen}>Sign Up</Button>
      </div>
    )
  }

  return (
     <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={userProfile?.avatarUrl || user?.photoURL || undefined} alt={getDisplayName()} />
                    <AvatarFallback>
                        <User className="h-5 w-5" />
                    </AvatarFallback>
                </Avatar>
                <span 
                  className={cn(
                    "absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background",
                    isConnected ? "bg-green-500" : "bg-red-500"
                  )}
                  title={isConnected ? "Online" : "Offline"}
                />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{getDisplayName()}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                    </p>
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <Link href="/profile">
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
                <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
  );
}


export function MainLayout({ children, onAuthDialogOpen }: { children: React.ReactNode, onAuthDialogOpen?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const wasUserLoading = React.useRef(isUserLoading);
  
  usePresence(); // Activate the presence system for the current user
  const firestore = useFirestore();

  const siteSettingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'site_content/site_settings');
  }, [firestore]);

  const { data: siteSettings, isLoading: isLoadingSiteSettings } = useDoc<SiteSettings>(siteSettingsRef);

  React.useEffect(() => {
    const isProtected = allMenuItems.some(item => item.protected && pathname.startsWith(item.href));

    // If the page is protected and the user is definitively logged out, redirect them.
    if (!isUserLoading && !user && isProtected) {
      router.push('/dashboard');
    }
    
    // When user explicitly logs out, also redirect.
    if (wasUserLoading.current && !isUserLoading && !user) {
      router.push('/dashboard');
    }
    wasUserLoading.current = isUserLoading;

  }, [isUserLoading, user, router, pathname]);

  const menuItems = React.useMemo(() => {
    if (isLoadingSiteSettings) return [];
    
    const isMultiplayerEnabled = siteSettings?.isMultiplayerEnabled ?? true;
    const isLeaderboardEnabled = siteSettings?.isLeaderboardEnabled ?? true;
    
    return allMenuItems.filter(item => {
        if (item.id === 'multiplayer' && !isMultiplayerEnabled) return false;
        if (item.id === 'leaderboard' && !isLeaderboardEnabled) return false;
        if (item.protected && !user) return false; // Hide protected links if not logged in
        return true;
    });
  }, [siteSettings, isLoadingSiteSettings, user]);


  const getPageTitle = () => {
    // Handle special cases for nested routes
    if (pathname.startsWith('/books/')) return 'Books';
    if (pathname.startsWith('/review-mode/')) return 'Review Mode';
    if (pathname.startsWith('/multiplayer/lobby')) return '1v1 Battle Lobby';
    if (pathname.startsWith('/multiplayer/match')) return '1v1 Match';
    if (pathname.startsWith('/legal-topics')) return 'Legal Topics';


    const currentPath = pathname.split('/')[1];
    const menuItem = allMenuItems.find(item => item.href.startsWith(`/${currentPath}`) && currentPath !== '');
    
    // Default title for dynamic sub-routes if no specific menu item matches
    if (!menuItem && currentPath) {
      return currentPath.charAt(0).toUpperCase() + currentPath.slice(1).replace(/-/g, ' ');
    }
    
    return menuItem ? menuItem.label : 'LegalMasters PH';
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Scale className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold text-sidebar-foreground">
              LegalMasters PH
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarMenu>
            {isLoadingSiteSettings ? (
               [...Array(8)].map((_, i) => <SidebarMenuSkeleton key={i} showIcon />)
            ) : menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    size="lg"
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-6">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1">
                <h1 className="font-headline text-2xl font-bold text-primary">
                    {getPageTitle()}
                </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
                    <RefreshCw className="h-5 w-5" />
                    <span className="sr-only">Refresh</span>
                </Button>
                {isUserLoading ? (
                  <Skeleton className="h-10 w-24 rounded-md" />
                ) : (
                   <UserDisplay onAuthDialogOpen={onAuthDialogOpen} />
                )}
            </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
