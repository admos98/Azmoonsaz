/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { TeacherProvider } from './contexts/TeacherContext';
import Topbar from './components/Topbar';
import { GlassFilters } from './components/GlassSystem';
import Login from './pages/teacher/Login';
import Onboarding from './pages/teacher/Onboarding';
import ResetPassword from './pages/teacher/ResetPassword';
import ExamPortal from './pages/student/ExamPortal';
import SecureExamPortal from './pages/student/SecureExamPortal';
import { Toast } from './components/UIComponents';
import { Exam } from './types';
import { getSupabasePublicClient } from './lib/supabasePublic';
import { authService } from './services/api';
import { teacherPathFromTab, teacherTabFromPath } from './utils/teacherRoutes';
import { usePersistentPreference } from './hooks/usePersistentPreference';
import CommandPalette from './components/CommandPalette';
import { requestAppNavigation } from './hooks/useUnsavedChanges';
import {
  loadDashboard,
  loadExams,
  loadNewExam,
  loadSettingsHub,
  loadTeacherProfile,
} from './utils/teacherPageLoaders';

function WorkspacePreferenceApplier() {
  const [density] = usePersistentPreference<'comfortable' | 'compact'>(
    'workspace:density',
    'comfortable',
    (value): value is 'comfortable' | 'compact' => value === 'comfortable' || value === 'compact',
  );
  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);
  return null;
}

// Lazy-loaded teacher pages (code-split)
const Dashboard = lazy(loadDashboard);
const Exams = lazy(loadExams);
const NewExam = lazy(loadNewExam);
const SettingsHub = lazy(loadSettingsHub);
const TeacherProfile = lazy(loadTeacherProfile);

// Dev-only material laboratory (`/dev/fixtures`). Rendered before auth so the
// visual baseline can be captured without a backend; never linked from nav.
const FixtureGallery = lazy(() => import('./pages/dev/FixtureGallery'));

// Toast state shared via simple emitter for App-level toasts
const toastQueue: Array<{
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}> = [];
let toastNextId = 0;
const toastListeners: Array<() => void> = [];
// eslint-disable-next-line react-refresh/only-export-components
export const showAppToast = (
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
) => {
  if (toastQueue.some((toast) => toast.message === message && toast.type === type)) return;
  const id = ++toastNextId;
  toastQueue.push({ id, message, type });
  toastListeners.forEach((l) => l());
  setTimeout(() => {
    toastQueue.splice(
      toastQueue.findIndex((t) => t.id === id),
      1,
    );
    toastListeners.forEach((l) => l());
  }, 4000);
};

export default function App() {
  const [userRole, setUserRole] = useState<'teacher' | 'student'>('teacher');
  const [isTeacherLoggedIn, setIsTeacherLoggedIn] = useState(false);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(true);
  const [currentTab, setCurrentTab] = useState<string>(() =>
    teacherTabFromPath(window.location.pathname),
  );
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const [selectedExamId, setSelectedExamId] = useState<string | undefined>(undefined);
  const [examSubView, setExamSubView] = useState<'list' | 'settings' | 'preview' | 'results'>(
    'list',
  );
  const [toastSnapshot, setToastSnapshot] = useState<Array<(typeof toastQueue)[0]>>([]);

  useEffect(() => {
    let active = true;
    const supabase = getSupabasePublicClient();
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setIsTeacherLoggedIn(Boolean(data.session));
      if (data.session && window.location.pathname === '/') {
        window.history.replaceState(null, '', '/teacher/dashboard');
        setCurrentPath('/teacher/dashboard');
        setCurrentTab('dashboard');
      }
      if (data.session) {
        const teacher = await authService.getCurrentTeacher();
        if (active && teacher) setIsOnboarded(teacher.isOnboarded ?? true);
      }
      if (active) setAuthInitializing(false);
    };
    void bootstrap();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setIsTeacherLoggedIn(Boolean(session));
      setAuthInitializing(false);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const flushToasts = () => setToastSnapshot([...toastQueue]);
  useEffect(() => {
    toastListeners.push(flushToasts);
    return () => {
      const idx = toastListeners.indexOf(flushToasts);
      if (idx > -1) toastListeners.splice(idx, 1);
    };
  }, []);

  // Detect password reset link in URL hash
  const [isPasswordReset, setIsPasswordReset] = useState(() => {
    return window.location.hash.includes('type=recovery');
  });

  // URL state management
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setCurrentPath(path);
      if (path.startsWith('/teacher')) {
        setCurrentTab(teacherTabFromPath(path));
        const resultMatch = path.match(/^\/teacher\/exams\/([^/]+)\/results$/);
        setSelectedExamId(resultMatch?.[1]);
        setExamSubView(resultMatch ? 'results' : 'list');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToLocalPath = (path: string, replace = false) => {
    window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
    setCurrentPath(path);
  };

  const navigateTeacher = (tab: string) => {
    if (!requestAppNavigation()) return;
    setCurrentTab(tab);
    setExamSubView('list');
    setSelectedExamId(undefined);
    navigateToLocalPath(teacherPathFromTab(tab));
  };

  // Check onboarding status after login
  useEffect(() => {
    if (!isTeacherLoggedIn) return;
    authService.getCurrentTeacher().then((teacher) => {
      if (teacher) setIsOnboarded(teacher.isOnboarded ?? true);
    });
  }, [isTeacherLoggedIn]);

  // Handle addition of designed exam
  const [customExams, setCustomExams] = useState<Exam[]>([]);

  const handleAddNewExam = (newExam: Exam) => {
    setCustomExams([newExam, ...customExams]);
    setCurrentTab('exams');
    setExamSubView('list');
    navigateToLocalPath('/teacher/exams');
    showAppToast('آزمون جدید با موفقیت ایجاد شد.', 'success');
  };

  const handleSelectExamForResults = (examId: string) => {
    setCurrentTab('exams');
    setSelectedExamId(examId);
    setExamSubView('results');
    navigateToLocalPath(`/teacher/exams/${examId}/results`);
  };

  // Switch Role
  const handleSwitchUserRole = () => {
    if (userRole === 'teacher') {
      setUserRole('student');
      navigateToLocalPath('/secure-exam/DEMO7');
    } else {
      setUserRole('teacher');
      navigateToLocalPath('/teacher/dashboard');
    }
  };

  // Main layout router
  const renderTeacherContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigate={navigateTeacher}
            onSelectExamForResults={handleSelectExamForResults}
          />
        );
      case 'students':
        return <TeacherProfile initialTab="students" onNavigate={navigateTeacher} />;
      case 'classes':
        return <TeacherProfile initialTab="classes" onNavigate={navigateTeacher} />;
      case 'profile':
        return <TeacherProfile onNavigate={navigateTeacher} />;
      case 'questions':
        return <SettingsHub initialTab="questions" onNavigate={navigateTeacher} />;
      case 'exams/new':
        return <NewExam onBack={() => navigateTeacher('exams')} onAddExam={handleAddNewExam} />;
      case 'exams':
        return (
          <Exams
            onNavigate={navigateTeacher}
            selectedExamId={selectedExamId}
            subView={examSubView}
            onSubViewChange={(view, id) => {
              setExamSubView(view);
              setSelectedExamId(id);
              if (view === 'results' && id) {
                navigateToLocalPath(`/teacher/exams/${id}/results`);
              } else if (view === 'list') {
                navigateToLocalPath('/teacher/exams');
              }
            }}
          />
        );
      case 'results': {
        const firstExam = customExams[0];
        return (
          <Exams
            onNavigate={navigateTeacher}
            selectedExamId={selectedExamId || firstExam?.id}
            subView="results"
            onSubViewChange={(view, id) => {
              setExamSubView(view);
              setSelectedExamId(id);
              if (view === 'results' && id) {
                navigateToLocalPath(`/teacher/exams/${id}/results`);
              } else if (view === 'list') {
                navigateToLocalPath('/teacher/exams');
              }
            }}
          />
        );
      }
      case 'settings':
        return <SettingsHub onNavigate={navigateTeacher} />;
      default:
        return <Dashboard onNavigate={navigateTeacher} />;
    }
  };

  const secureExamRouteMatch = currentPath.match(/^\/secure-exam\/([^/]+)$/);

  if (secureExamRouteMatch) {
    return (
      <SecureExamPortal
        presetExamCode={secureExamRouteMatch[1]}
        onBackToTeacher={() => {
          navigateToLocalPath('/teacher/dashboard');
          setCurrentTab('dashboard');
          setUserRole('teacher');
        }}
      />
    );
  }

  const examRouteMatch = currentPath.match(/^\/exam\/([^/]+)(?:\/(start|take|submitted))?$/);

  if (examRouteMatch) {
    const code = examRouteMatch[1];
    return (
      <SecureExamPortal
        presetExamCode={code}
        onBackToTeacher={() => {
          navigateToLocalPath('/teacher/dashboard');
          setCurrentTab('dashboard');
          setUserRole('teacher');
        }}
      />
    );
  }

  // Dev-only material laboratory — bypasses auth so primitives can be
  // inspected without a backend session.
  if (currentPath.startsWith('/dev/')) {
    return (
      <Suspense
        fallback={
          <div
            className="min-h-screen bg-[var(--color-page-bg)]"
            role="status"
            aria-label="در حال بارگذاری آزمایشگاه مواد"
          />
        }
      >
        <FixtureGallery />
      </Suspense>
    );
  }

  if (userRole === 'student') {
    return (
      <ExamPortal
        onBackToTeacher={() => {
          navigateToLocalPath('/teacher/dashboard');
          setCurrentTab('dashboard');
          setUserRole('teacher');
        }}
        presetExamCode="8AF39"
        subRoute="login"
        onNavigate={navigateToLocalPath}
      />
    );
  }

  if (userRole === 'teacher' && authInitializing) {
    return (
      <div
        className="grid min-h-screen place-items-center bg-[var(--color-page-bg)]"
        role="status"
        aria-label="در حال بررسی نشست کاربری"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-glass-light-stroke)] border-t-[var(--color-ink)]" />
          <p className="text-label text-[var(--color-text-secondary)]">در حال آماده‌سازی حساب…</p>
        </div>
      </div>
    );
  }

  if (userRole === 'teacher' && !isTeacherLoggedIn) {
    if (isPasswordReset) {
      return (
        <ResetPassword
          onDone={() => {
            setIsPasswordReset(false);
            window.history.replaceState(null, '', window.location.pathname);
          }}
        />
      );
    }
    return (
      <Login
        onLoginSuccess={() => setIsTeacherLoggedIn(true)}
        onSwitchToStudent={() => {
          setUserRole('student');
          navigateToLocalPath('/secure-exam/DEMO7');
        }}
      />
    );
  }

  if (userRole === 'teacher' && isTeacherLoggedIn && !isOnboarded) {
    return <Onboarding onComplete={() => setIsOnboarded(true)} />;
  }

  return (
    <TeacherProvider>
      <WorkspacePreferenceApplier />
      <GlassFilters />
      <div className="min-h-screen bg-[var(--color-page-bg)] flex" dir="rtl" id="app-teacher-shell">
        {/* Background depth layer — stage surface that main panel floats above */}
        <div className="fixed inset-0 z-0 pointer-events-none" id="app-bg-stage">
          <div className="absolute inset-0 bg-[var(--color-surface-secondary)]" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[42rem] h-[42rem] bg-[var(--color-accent-solid)]/2 rounded-full blur-[140px]" />
          <div className="absolute top-3/4 right-1/4 w-80 h-80 bg-[var(--color-gold)]/4 rounded-full blur-[120px]" />
        </div>

        {/* Main Container — layer 10 (floats above bg stage) */}
        <div
          className="relative z-10 flex-1 pt-14 lg:pt-0 flex flex-col min-h-screen"
          id="main-content-layout"
        >
          <Topbar
            currentTab={currentTab}
            onTabChange={navigateTeacher}
            onSwitchRole={handleSwitchUserRole}
            onLogout={() => {
              void authService.logoutTeacher().finally(() => setIsTeacherLoggedIn(false));
            }}
            onSelectExamForResults={handleSelectExamForResults}
          />
          <CommandPalette onNavigate={navigateTeacher} />

          {/* Dynamic Page Router — floats above bg stage */}
          <div className="p-4 lg:p-8 flex-1 bg-transparent" id="router-view-box">
            <Suspense
              fallback={
                <div className="space-y-6" id="page-skeleton">
                  <div className="h-8 w-48 bg-[var(--color-glass-light-fill)] skeleton rounded-xl" />
                  <div className="h-40 bg-[var(--color-glass-light-fill)] skeleton rounded-3xl" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-32 bg-[var(--color-glass-light-fill)] skeleton rounded-3xl"
                      />
                    ))}
                  </div>
                  <div className="h-60 bg-[var(--color-glass-light-fill)] skeleton rounded-3xl" />
                </div>
              }
            >
              {renderTeacherContent()}
            </Suspense>
          </div>
        </div>
      </div>

      {/* App-level Toast container */}
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2"
        id="app-toasts"
      >
        {toastSnapshot.map((t) => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            onClose={() => {
              toastQueue.splice(
                toastQueue.findIndex((q) => q.id === t.id),
                1,
              );
              setToastSnapshot([...toastQueue]);
            }}
          />
        ))}
      </div>
    </TeacherProvider>
  );
}
