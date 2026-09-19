/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { TeacherProvider } from './contexts/TeacherContext';
import Topbar from './components/Topbar';
import { GlassFilters, GlassSheen } from './components/GlassSystem';
import Login from './pages/teacher/Login';
import Onboarding from './pages/teacher/Onboarding';
import ResetPassword from './pages/teacher/ResetPassword';
import ExamPortal from './pages/student/ExamPortal';
import SecureExamPortal from './pages/student/SecureExamPortal';
import { Toast } from './components/UIComponents';
import { Exam, Teacher } from './types';

// Lazy-loaded teacher pages (code-split)
const Dashboard = lazy(() => import('./pages/teacher/Dashboard'));
const Students = lazy(() => import('./pages/teacher/Students'));
const Classes = lazy(() => import('./pages/teacher/Classes'));
const Questions = lazy(() => import('./pages/teacher/Questions'));
const Exams = lazy(() => import('./pages/teacher/Exams'));
const NewExam = lazy(() => import('./pages/teacher/NewExam'));
const Settings = lazy(() => import('./pages/teacher/Settings'));

// Toast state shared via simple emitter for App-level toasts
const toastQueue: Array<{ id: number; message: string; type: 'success' | 'error' | 'warning' | 'info' }> = [];
let toastNextId = 0;
const toastListeners: Array<() => void> = [];
export const showAppToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  const id = ++toastNextId;
  toastQueue.push({ id, message, type });
  toastListeners.forEach((l) => l());
  setTimeout(() => {
    toastQueue.splice(toastQueue.findIndex((t) => t.id === id), 1);
    toastListeners.forEach((l) => l());
  }, 4000);
};

export default function App() {
  const [userRole, setUserRole] = useState<'teacher' | 'student'>('teacher');
  const [isTeacherLoggedIn, setIsTeacherLoggedIn] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(true);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [toastSnapshot, setToastSnapshot] = useState<Array<typeof toastQueue[0]>>([]);

  const flushToasts = () => setToastSnapshot([...toastQueue]);
  useEffect(() => {
    flushToasts();
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
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToLocalPath = (path: string) => {
    window.history.pushState(null, '', path);
    setCurrentPath(path);
  };

  useEffect(() => {
    const resultsMatch = currentPath.match(/^\/teacher\/exams\/([^/]+)\/results$/);
    if (resultsMatch) {
      const examId = resultsMatch[1];
      setUserRole('teacher');
      setIsTeacherLoggedIn(true);
      setCurrentTab('exams');
      setSelectedExamId(examId);
      setExamSubView('results');
    }
  }, [currentPath]);

  // Check onboarding status after login
  useEffect(() => {
    if (!isTeacherLoggedIn) return;
    import('./services/api').then(({ authService }) => {
      authService.getCurrentTeacher().then((teacher) => {
        if (teacher) setIsOnboarded(teacher.isOnboarded ?? true);
      });
    });
  }, [isTeacherLoggedIn]);

  // Exam sub-routing state
  const [selectedExamId, setSelectedExamId] = useState<string | undefined>(undefined);
  const [examSubView, setExamSubView] = useState<'list' | 'settings' | 'preview' | 'results'>('list');

  // Handle addition of designed exam
  const [customExams, setCustomExams] = useState<Exam[]>([]);

  const handleAddNewExam = (newExam: Exam) => {
    setCustomExams([newExam, ...customExams]);
    setCurrentTab('exams');
    setExamSubView('list');
    showAppToast('آزمون جدید با موفقیت ایجاد شد.', 'success');
  };

  const handleSelectExamForResults = (examId: string) => {
    setCurrentTab('exams');
    setSelectedExamId(examId);
    setExamSubView('results');
  };

  // Switch Role
  const handleSwitchUserRole = () => {
    if (userRole === 'teacher') {
      setUserRole('student');
      navigateToLocalPath('/secure-exam/DEMO7');
    } else {
      setUserRole('teacher');
      navigateToLocalPath('/');
    }
  };

  // Main layout router
  const renderTeacherContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigate={(tab) => {
              setCurrentTab(tab);
              setExamSubView('list');
            }}
            onSelectExamForResults={handleSelectExamForResults}
          />
        );
      case 'students':
        return <Students />;
      case 'classes':
        return <Classes />;
      case 'questions':
        return <Questions />;
      case 'exams/new':
        return (
          <NewExam
            onBack={() => setCurrentTab('exams')}
            onAddExam={handleAddNewExam}
          />
        );
      case 'exams':
        return (
          <Exams
            onNavigate={(tab) => {
              setCurrentTab(tab);
              setExamSubView('list');
              navigateToLocalPath('/');
            }}
            selectedExamId={selectedExamId}
            subView={examSubView}
            onSubViewChange={(view, id) => {
              setExamSubView(view);
              setSelectedExamId(id);
              if (view === 'results' && id) {
                navigateToLocalPath(`/teacher/exams/${id}/results`);
              } else if (view === 'list') {
                navigateToLocalPath('/');
              }
            }}
          />
        );
      case 'results':
        const firstExam = customExams[0];
        return (
          <Exams
            onNavigate={(tab) => {
              setCurrentTab(tab);
              setExamSubView('list');
              navigateToLocalPath('/');
            }}
            selectedExamId={selectedExamId || firstExam?.id}
            subView="results"
            onSubViewChange={(view, id) => {
              setExamSubView(view);
              setSelectedExamId(id);
              if (view === 'results' && id) {
                navigateToLocalPath(`/teacher/exams/${id}/results`);
              } else if (view === 'list') {
                navigateToLocalPath('/');
              }
            }}
          />
        );
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onNavigate={setCurrentTab} />;
    }
  };

  const secureExamRouteMatch = currentPath.match(/^\/secure-exam\/([^/]+)$/);

  if (secureExamRouteMatch) {
    return (
      <SecureExamPortal
        presetExamCode={secureExamRouteMatch[1]}
        onBackToTeacher={() => {
          navigateToLocalPath('/');
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
          navigateToLocalPath('/');
          setUserRole('teacher');
        }}
      />
    );
  }

  if (userRole === 'student') {
    return (
      <ExamPortal
        onBackToTeacher={() => {
          navigateToLocalPath('/');
          setUserRole('teacher');
        }}
        presetExamCode="8AF39"
        subRoute="login"
        onNavigate={navigateToLocalPath}
      />
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
    return (
      <Onboarding onComplete={() => setIsOnboarded(true)} />
    );
  }

  return (
    <TeacherProvider>
      <GlassFilters />
      <div className="min-h-screen bg-[var(--color-page-bg)] flex" dir="rtl" id="app-teacher-shell">
        {/* Background depth layer — stage surface that main panel floats above */}
        <div className="fixed inset-0 z-0 pointer-events-none" id="app-bg-stage">
          <div className="absolute inset-0 bg-[var(--color-surface-secondary)]" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[42rem] h-[42rem] bg-[var(--color-accent)]/2 rounded-full blur-[140px]" />
          <div className="absolute top-3/4 right-1/4 w-80 h-80 bg-[var(--color-gold)]/4 rounded-full blur-[120px]" />
        </div>

        {/* Main Container — layer 10 (floats above bg stage) */}
        <div className="relative z-10 flex-1 pt-14 lg:pt-0 flex flex-col min-h-screen" id="main-content-layout">
          <Topbar
            currentTab={currentTab}
            onTabChange={(tab) => {
              setCurrentTab(tab);
              setExamSubView('list');
              setSelectedExamId(undefined);
              navigateToLocalPath('/');
            }}
            onSwitchRole={handleSwitchUserRole}
            onLogout={() => setIsTeacherLoggedIn(false)}
            onSelectExamForResults={handleSelectExamForResults}
          />

          {/* Dynamic Page Router — floats above bg stage on a glx surface */}
          <div className="p-4 lg:p-8 flex-1 glx" id="router-view-box">
            <Suspense fallback={
              <div className="space-y-6" id="page-skeleton">
                <div className="h-8 w-48 bg-white/3 skeleton rounded-xl" />
                <div className="h-40 bg-white/3 skeleton rounded-3xl" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-32 bg-white/3 skeleton rounded-3xl" />
                  ))}
                </div>
                <div className="h-60 bg-white/3 skeleton rounded-3xl" />
              </div>
            }>
              <GlassSheen>{renderTeacherContent()}</GlassSheen>
            </Suspense>
          </div>
        </div>
      </div>

      {/* App-level Toast container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2" id="app-toasts">
        {toastSnapshot.map((t) => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            onClose={() => {
              toastQueue.splice(toastQueue.findIndex((q) => q.id === t.id), 1);
              setToastSnapshot([...toastQueue]);
            }}
          />
        ))}
      </div>
    </TeacherProvider>
  );
}
