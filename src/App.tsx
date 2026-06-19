/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Login from './pages/teacher/Login';
import Dashboard from './pages/teacher/Dashboard';
import Students from './pages/teacher/Students';
import Questions from './pages/teacher/Questions';
import Exams from './pages/teacher/Exams';
import NewExam from './pages/teacher/NewExam';
import Settings from './pages/teacher/Settings';
import ExamPortal from './pages/student/ExamPortal';
import SecureExamPortal from './pages/student/SecureExamPortal';
import { Exam } from './types';
import { mockExams } from './mockData';
import { isSecureBackendMode } from './config/runtimeMode';

export default function App() {
  const [userRole, setUserRole] = useState<'teacher' | 'student'>('teacher');
  const [isTeacherLoggedIn, setIsTeacherLoggedIn] = useState(false);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  // Exam sub-routing state
  const [selectedExamId, setSelectedExamId] = useState<string | undefined>(undefined);
  const [examSubView, setExamSubView] = useState<'list' | 'settings' | 'preview' | 'results'>('list');

  // Handle addition of designed exam
  const [customExams, setCustomExams] = useState<Exam[]>(mockExams);

  const handleAddNewExam = (newExam: Exam) => {
    mockExams.push(newExam); // Appends to static list for student portal lookup
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
      navigateToLocalPath(isSecureBackendMode() ? '/secure-exam/DEMO7' : '/exam/8AF39');
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

  const mockExamRouteMatch = currentPath.match(/^\/mock-exam\/([^/]+)(?:\/(start|take|submitted))?$/);

  if (mockExamRouteMatch) {
    const code = mockExamRouteMatch[1];
    const subRoute = mockExamRouteMatch[2] || 'login';
    return (
      <ExamPortal
        onBackToTeacher={() => {
          navigateToLocalPath('/');
          setUserRole('teacher');
        }}
        presetExamCode={code}
        subRoute={subRoute as 'login' | 'start' | 'take' | 'submitted'}
        onNavigate={navigateToLocalPath}
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
    const subRoute = examRouteMatch[2] || 'login';

    if (isSecureBackendMode()) {
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

    return (
      <ExamPortal
        onBackToTeacher={() => {
          navigateToLocalPath('/');
          setUserRole('teacher');
        }}
        presetExamCode={code}
        subRoute={subRoute as 'login' | 'start' | 'take' | 'submitted'}
        onNavigate={navigateToLocalPath}
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
    return (
      <Login
        onLoginSuccess={() => setIsTeacherLoggedIn(true)}
        onSwitchToStudent={() => {
          setUserRole('student');
          navigateToLocalPath(isSecureBackendMode() ? '/secure-exam/DEMO7' : '/exam/8AF39');
        }}
      />
    );
  }

  // 3. Otherwise, render the complete gorgeous Teacher Dashboard Shell
  return (
    <div className="min-h-screen bg-slate-50 flex" dir="rtl" id="app-teacher-shell">
      {/* Sidebar - fixed on the right */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          setExamSubView('list');
          setSelectedExamId(undefined);
          setIsSidebarOpen(false);
        }}
        onLogout={() => setIsTeacherLoggedIn(false)}
        onSwitchRole={handleSwitchUserRole}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Container - offset by sidebar width on desktop only */}
      <div className="flex-1 md:mr-64 flex flex-col min-h-screen" id="main-content-layout">
        {/* Topbar */}
        <Topbar
          currentTab={currentTab}
          onSwitchRole={handleSwitchUserRole}
          onLogout={() => setIsTeacherLoggedIn(false)}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />

        {/* Dynamic Page Router */}
        <div className="p-4 md:p-8 flex-1 bg-slate-50/50" id="router-view-box">
          {renderTeacherContent()}
        </div>
      </div>
    </div>
  );
}
