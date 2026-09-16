/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { TeacherProvider } from './contexts/TeacherContext';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Login from './pages/teacher/Login';
import Onboarding from './pages/teacher/Onboarding';
import ResetPassword from './pages/teacher/ResetPassword';
import ExamPortal from './pages/student/ExamPortal';
import SecureExamPortal from './pages/student/SecureExamPortal';
import { Exam, Teacher } from './types';

// Lazy-loaded teacher pages (code-split)
const Dashboard = lazy(() => import('./pages/teacher/Dashboard'));
const Students = lazy(() => import('./pages/teacher/Students'));
const Classes = lazy(() => import('./pages/teacher/Classes'));
const Questions = lazy(() => import('./pages/teacher/Questions'));
const Exams = lazy(() => import('./pages/teacher/Exams'));
const NewExam = lazy(() => import('./pages/teacher/NewExam'));
const Settings = lazy(() => import('./pages/teacher/Settings'));

export default function App() {
  const [userRole, setUserRole] = useState<'teacher' | 'student'>('teacher');
  const [isTeacherLoggedIn, setIsTeacherLoggedIn] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(true); // assume onboarded until checked
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

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
    alert(`آزمون « ${newExam.title} » با موفقیت طراحی شد و کد ورود ${newExam.examCode} به دانش‌آموزان اختصاص یافت.`);
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
        // Drill down to the first active exam results for demonstration if no specific id chosen
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

  // ROUTE INTERCEPTION:
  // Check if current URL matches public student exam subroutes:
  // /exam/:examCode
  // /exam/:examCode/start | take | submitted
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

  // 1. If we are in STUDENT mode, render the Student exam portal instantly to standard code
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

  // 2. If we are in TEACHER mode but not logged in, show the Login Page
  if (userRole === 'teacher' && !isTeacherLoggedIn) {
    // Password reset link detected
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

  // 2.5. If logged in but not onboarded, show onboarding
  if (userRole === 'teacher' && isTeacherLoggedIn && !isOnboarded) {
    return (
      <Onboarding onComplete={() => setIsOnboarded(true)} />
    );
  }

  // 3. Otherwise, render the complete gorgeous Teacher Dashboard Shell
  return (
    <TeacherProvider>
    <div className="min-h-screen bg-slate-50 flex" dir="rtl" id="app-teacher-shell">
      {/* Sidebar - fixed on the right */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          // Reset subrouting when shifting tabs
          setExamSubView('list');
          setSelectedExamId(undefined);
        }}
        onLogout={() => setIsTeacherLoggedIn(false)}
        onSwitchRole={handleSwitchUserRole}
      />

      {/* Main Container - offset by sidebar width (256px / w-64) */}
      <div className="flex-1 mr-64 flex flex-col min-h-screen" id="main-content-layout">
        {/* Topbar */}
        <Topbar
          currentTab={currentTab}
          onSwitchRole={handleSwitchUserRole}
          onLogout={() => setIsTeacherLoggedIn(false)}
        />

        {/* Dynamic Page Router */}
        <div className="p-6 md:p-8 flex-1 bg-slate-50/50" id="router-view-box">
          <Suspense fallback={
            <div className="space-y-6 animate-pulse">
              <div className="h-8 w-48 bg-slate-200 rounded-xl" />
              <div className="h-40 bg-slate-100 rounded-2xl" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-32 bg-slate-100 rounded-2xl" />
                ))}
              </div>
            </div>
          }>
            {renderTeacherContent()}
          </Suspense>
        </div>
      </div>
    </div>
    </TeacherProvider>
  );
}
