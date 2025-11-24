

'use client';


export type Topic = {
  id: string;
  name: string;
  description: string;
  icon: string;
  displayOrder: number;
  bookCount?: number;
  questionCount?: number;
};

export type Book = {
    id: string;
    topicId: string;
    title: string;
    content: string; // Markdown content
    author: string;
    imageUrl?: string;
    isAiGenerated: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export type BookCSVRow = {
  topicId: string;
  title: string;
  author: string;
  content: string;
  imageUrl?: string;
}

export type QuizQuestion = {
    id:string;
    topicId: string;
    question: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: "A" | "B" | "C" | "D";
    explanation: string;
    difficulty: "easy" | "medium" | "hard" | "expert";
}

export type FormattedQuizQuestion = {
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    difficulty: string;
}

export type SiteNotification = {
    id: string;
    title: string;
    message: string;
    type: "announcement" | "warning" | "info";
    priority: "normal" | "high";
    createdAt: string; // ISO 8601 date string
    isActive: boolean;
}

export type GameResult = {
    id?: string;
    userId: string;
    gameMode: string;
    topicId: string;
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    timeTaken: number; // in seconds
    maxCombo: number;
    completedAt: string; // ISO 8601 date string
};

export type UserStatistics = {
    id?: string;
    userId: string;
    timedBest?: number;
    survivalRecord?: number;
    lightningHigh?: number;
    bossLevel?: number;
    dailyStreak?: number;
    globalRank?: string;
    totalGamesPlayed?: number;
    totalCorrectAnswers?: number;
totalQuestionsAttempted?: number;
    averageAccuracy?: number;
    favoriteTopic?: string;
    lastPlayed?: string; // ISO 8601 date string
};

export type UserProfile = {
    userId: string;
    email?: string;
    firstName: string;
    lastName: string;
    username?: string;
    displayNamePreference?: 'fullName' | 'username';
    leaderboardAnonymity?: boolean;
    userType: 'student' | 'professional' | 'admin';
    schoolFirm?: string;
    bio?: string;
    avatarUrl?: string;
    createdAt?: any; // Can be a server timestamp
};

export type AboutPageContent = {
  id: string;
  mainParagraph: string;
  vision: string;
  team: string;
  gcashQrUrl?: string;
};

export type FeatureSlide = {
  id: string;
  title: string;
  description: string;
  icon: string;
  gradient: string;
};

export type FeatureShowcaseContent = {
  id: string;
  showShowcase: boolean;
  slides: FeatureSlide[];
};


export type SiteSettings = {
    id: string;
    isMultiplayerEnabled: boolean;
    isLeaderboardEnabled: boolean;
    showFeatureShowcase?: boolean;
};

export type Feedback = {
    id: string;
    userProfileId: string;
    submissionDate: any; // serverTimestamp
    message: string;
    status: 'new' | 'reviewed' | 'resolved';
}

export type Player = {
    userId: string;
    displayName: string;
    score: number;
    answers: number[];
};

export type Match = {
    id: string;
    topicId: string;
    topicName: string;
    players: (Player | null)[];
    opponentId: string; // ID of the player being challenged
    questions: FormattedQuizQuestion[];
    currentQuestionIndex: number;
    status: 'waiting' | 'active' | 'finished' | 'declined';
    winnerId: string | null; // userId of the winner, 'draw', or null
    createdAt: any; // serverTimestamp
    updatedAt: any; // serverTimestamp
};

export type QuestionReport = {
    id: string;
    questionId: string;
    questionText: string;
    reporterId: string;
    reporterComment: string;
    status: 'new' | 'reviewed' | 'resolved';
    createdAt: any; // serverTimestamp
};
    
    