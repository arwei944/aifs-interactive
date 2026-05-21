import { useState, useEffect, useCallback } from 'react';

export interface LessonProgress {
  completed: boolean;
  quizScore?: { correct: number; total: number };
  completedAt?: string; // ISO date
}

export interface ProgressState {
  lessons: Record<string, LessonProgress>;
  streak: number;
  lastStudyDate: string;
}

const STORAGE_KEY = 'aifs-progress';

function getToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getYesterday(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function loadProgress(): ProgressState {
  if (typeof window === 'undefined') {
    return {
      lessons: {},
      streak: 0,
      lastStudyDate: '',
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as ProgressState;
    }
  } catch {
    // ignore parse errors
  }

  return {
    lessons: {},
    streak: 0,
    lastStudyDate: '',
  };
}

function saveProgress(state: ProgressState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export default function useProgress() {
  const [progress, setProgress] = useState<ProgressState>(loadProgress);

  // Persist to localStorage on every state change
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const markLessonCompleted = useCallback((lessonId: string) => {
    setProgress((prev) => ({
      ...prev,
      lessons: {
        ...prev.lessons,
        [lessonId]: {
          ...prev.lessons[lessonId],
          completed: true,
          completedAt: new Date().toISOString(),
        },
      },
    }));
  }, []);

  const markQuizCompleted = useCallback(
    (lessonId: string, correct: number, total: number) => {
      setProgress((prev) => ({
        ...prev,
        lessons: {
          ...prev.lessons,
          [lessonId]: {
            ...prev.lessons[lessonId],
            completed: true,
            quizScore: { correct, total },
            completedAt: new Date().toISOString(),
          },
        },
      }));
    },
    []
  );

  const isLessonCompleted = useCallback(
    (lessonId: string): boolean => {
      return progress.lessons[lessonId]?.completed ?? false;
    },
    [progress]
  );

  const getLessonProgress = useCallback(
    (lessonId: string): LessonProgress | undefined => {
      return progress.lessons[lessonId];
    },
    [progress]
  );

  const getPhaseProgress = useCallback(
    (phaseId: string, lessonIds: string[]): number => {
      if (lessonIds.length === 0) return 0;
      const completedCount = lessonIds.filter(
        (id) => progress.lessons[id]?.completed
      ).length;
      return Math.round((completedCount / lessonIds.length) * 100);
    },
    [progress]
  );

  const getTotalCompleted = useCallback((): number => {
    return Object.values(progress.lessons).filter((l) => l.completed).length;
  }, [progress]);

  const updateStreak = useCallback(() => {
    const today = getToday();
    const yesterday = getYesterday();

    setProgress((prev) => {
      if (prev.lastStudyDate === today) {
        // Already studied today, no change
        return prev;
      }

      if (prev.lastStudyDate === yesterday) {
        // Studied yesterday, increment streak
        return {
          ...prev,
          streak: prev.streak + 1,
          lastStudyDate: today,
        };
      }

      // Streak broken or first time, reset to 1
      return {
        ...prev,
        streak: 1,
        lastStudyDate: today,
      };
    });
  }, []);

  return {
    progress,
    markLessonCompleted,
    markQuizCompleted,
    isLessonCompleted,
    getLessonProgress,
    getPhaseProgress,
    getTotalCompleted,
    updateStreak,
  };
}
