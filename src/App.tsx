/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { TeacherProvider } from './contexts/TeacherContext';
import type { Teacher } from './types';
import Topbar from './components/Topbar';
import Login from './pages/teacher/Login';
import Onboarding from './pages/teacher/Onboarding';
import ResetPassword from './pages/teacher/ResetPassword';
import { authService } from './services/api';
import { getSupabasePublicClient } from './lib/supabasePublic';
import { teacherPathFromTab, teacherTabFromPath } from './utils/teacherRoutes';
import { usePersistentPreference } from './hooks/usePersistentPreference';
import { useEdgeLight } from './hooks/useEdgeLight';
import { useMotionPreference } from './contexts/MotionContext';
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

/** Drives the glass rim. Rendered null, like WorkspacePreferenceApplier — it
 *  only exists to install its delegated pointer listener. Uses the RESOLVED
 *  motion value, not the raw preference: a "system" user whose OS requests
 *  reduced motion must also get a static rim. */
function EdgeLightDriver() {
  const { resolvedMotion } = useMotionPreference();
  useEdgeLight(resolvedMotion !== 'reduce');
  return null;
}

// Lazy-loaded teacher pages (code-split)
const Dashboard = lazy(loadDashboard);
const Exams = lazy(loadExams);
const NewExam = lazy(loadNewExam);
const SettingsHub = lazy(loadSettingsHub);
const TeacherProfile = lazy(loadTeacherProfile);

// Student portal — the highest-stakes surface is code-split: teachers never
// download it and it stays out of the entry chunk.
const SecureExamPortal = lazy(() => import('./pages/student/SecureExamPortal'));

// Dev-only material laboratory (`/dev/fixtures`). Rendered before auth so the
// visual baseline can be captured without a backend; never linked from nav.
const FixtureGallery = lazy(() => import('./pages/dev/FixtureGallery'));

/** Full-page boot state. Used for the auth handshake and as the Suspense
 *  fallback on route-level code boundaries. */
function BootScreen({ label }: { label: string }) {
  return (
    <div
      className="grid min-h-screen place-items-center bg-[var(--color-page-bg)]"
      role="status"
      aria-label={label}
    >
      <div className="space-y-4 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-glass-light-stroke)] border-t-[var(--color-ink)]" />
        <p className="text-label text-[var(--color-text-secondary)]">{label}</p>
      </div>
    </div>
  );
}

export default function App() {
  const [isTeacherLoggedIn, setIsTeacherLoggedIn] = useState(false);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(true);
  /** Profile fetched during boot or handed over by Login. `undefined` tells
   *  TeacherProvider to fetch for itself (self-heal / post-onboarding). */
  const [bootTeacher, setBootTeacher] = useState<Teacher | undefined>(undefined);
  const [currentTab, setCurrentTab] = useState<string>(() =>
    teacherTabFromPath(window.location.pathname),
  );
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const [selectedExamId, setSelectedExamId] = useState<string | undefined>(undefined);
  const [examSubView, setExamSubView] = useState<'list' | 'settings' | 'preview' | 'results'>(
    'list',
  );

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
        // The ONE /api/teacher/me call of the boot path. Login hands its own
        // profile over via onLoginSuccess; TeacherProvider receives this one
        // as initialTeacher — no second round-trip anywhere.
        const teacher = await authService.getCurrentTeacher();
        if (active && teacher) {
          setBootTeacher(teacher);
          setIsOnboarded(teacher.isOnboarded ?? true);
        }
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

  // Check onboarding status after login — handled by Login's onLoginSuccess
  // handoff (it already holds the profile from the sign-in response), so the
  // previous duplicate getCurrentTeacher effect is gone.

  // Handle addition of designed exam — the exam itself is persisted by the
  // service; the shared cache patches itself, so no local copy is needed.
  const handleAddNewExam = () => {
    setCurrentTab('exams');
    setExamSubView('list');
    navigateToLocalPath('/teacher/exams');
  };

  /** Single source of exam sub-view navigation — App.tsx had three verbatim
   *  copies of this closure (two <Exams> mounts + results selection). */
  const handleExamSubViewChange = useCallback(
    (view: 'list' | 'settings' | 'preview' | 'results', id?: string) => {
      setExamSubView(view);
      setSelectedExamId(id);
      if (view === 'results' && id) {
        navigateToLocalPath(`/teacher/exams/${id}/results`);
      } else if (view === 'list') {
        navigateToLocalPath('/teacher/exams');
      }
    },
    // navigateToLocalPath closes over currentTab-free setters only; the empty
    // dep list keeps this handler stable for the whole session.
    [],
  );

  const handleSelectExamForResults = (examId: string) => {
    setCurrentTab('exams');
    handleExamSubViewChange('results', examId);
  };

  /** Login hands over the profile it already fetched during sign-in —
   *  no second /api/teacher/me round-trip after a fresh login. */
  const handleLoginSuccess = (teacher: Teacher) => {
    setBootTeacher(teacher);
    setIsOnboarded(teacher.isOnboarded ?? true);
    setIsTeacherLoggedIn(true);
  };

  /** Return point for the student portal (its "بازگشت" affordance). */
  const returnToTeacherHome = () => {
    navigateToLocalPath('/teacher/dashboard');
    setCurrentTab('dashboard');
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
      case 'classes':
      case 'profile':
        return (
          <TeacherProfile
            initialTab={currentTab === 'profile' ? undefined : (currentTab as 'students' | 'classes')}
            onNavigate={navigateTeacher}
          />
        );
      case 'questions':
        return <SettingsHub initialTab="questions" onNavigate={navigateTeacher} />;
      case 'exams/new':
        return <NewExam onBack={() => navigateTeacher('exams')} onAddExam={handleAddNewExam} />;
      case 'exams':
      case 'results':
        // 'results' is the Dashboard quick-links tab: the results sub-view is
        // forced; otherwise App's examSubView state decides.
        return (
          <Exams
            onNavigate={navigateTeacher}
            selectedExamId={selectedExamId}
            subView={currentTab === 'results' ? 'results' : examSubView}
            onSubViewChange={handleExamSubViewChange}
          />
        );
      case 'settings':
        return <SettingsHub onNavigate={navigateTeacher} />;
      default:
        // Unknown tabs fall back to the dashboard WITH the full prop set —
        // the previous default silently dropped onSelectExamForResults.
        return (
          <Dashboard
            onNavigate={navigateTeacher}
            onSelectExamForResults={handleSelectExamForResults}
          />
        );
    }
  };

  // Student entry routes — two URL shapes, one portal. The portal is lazy:
  // teachers never download it, and the boundary keeps the route swap smooth.
  const studentPortalMatch =
    currentPath.match(/^\/secure-exam\/([^/]+)$/) ??
    currentPath.match(/^\/exam\/([^/]+)(?:\/(start|take|submitted))?$/);

  if (studentPortalMatch) {
    return (
      <Suspense fallback={<BootScreen label="در حال بارگذاری سامانه آزمون" />}>
        <SecureExamPortal
          presetExamCode={studentPortalMatch[1]}
          onBackToTeacher={returnToTeacherHome}
        />
      </Suspense>
    );
  }

  // Dev-only material laboratory — bypasses auth so primitives can be
  // inspected without a backend session. Compiled out of production builds:
  // the bypass-auth design must never ship.
  if (import.meta.env.DEV && currentPath.startsWith('/dev/')) {
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

  if (authInitializing) {
    return <BootScreen label="در حال آماده‌سازی حساب…" />;
  }

  if (!isTeacherLoggedIn) {
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
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (isTeacherLoggedIn && !isOnboarded) {
    // Clear the pre-onboarding handoff profile: it predates the school/subject
    // the teacher just entered, so the provider must fetch a fresh one.
    return (
      <Onboarding
        onComplete={() => {
          setBootTeacher(undefined);
          setIsOnboarded(true);
        }}
      />
    );
  }

  return (
    <TeacherProvider initialTeacher={bootTeacher}>
      <WorkspacePreferenceApplier />
      <EdgeLightDriver />
      <div className="min-h-screen bg-[var(--color-page-bg)] flex" dir="rtl" id="app-teacher-shell">
        {/* Background depth layer — stage surface that main panel floats above */}
        <div className="fixed inset-0 z-0 pointer-events-none" id="app-bg-stage">
          <div className="absolute inset-0 bg-[var(--color-surface-secondary)]" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[42rem] h-[42rem] bg-[var(--color-accent-solid)]/2 rounded-full blur-[140px]" />
          <div className="absolute top-3/4 right-1/4 w-80 h-80 bg-[var(--color-gold)]/4 rounded-full blur-[120px]" />
          {/* Defined features — the glass needs structure behind it. iOS panels
              float over app icons: blurred icon shapes + the lens bend on those
              shapes are what make the material read. Mega-blurred colour blobs
              alone give the blur nothing to reveal, so panels read as flat
              tinted ceramic. Alphas 20–30%: strong enough to survive the panel
              blur + wash as visible blobs (measured: 6–14% vanish). All paint,
              no filters of their own beyond static blurs on non-glass layers. */}
          <div className="absolute top-[10%] left-[6%] h-72 w-72 rounded-full border-[12px] border-[var(--color-accent-solid)]/22 blur-[13px]" />
          <div className="absolute top-[46%] left-[40%] h-44 w-44 rounded-full bg-[var(--color-gold)]/30 blur-[8px]" />
          <div className="absolute top-[6%] right-[10%] h-32 w-32 rounded-full bg-[var(--color-accent-solid)]/26 blur-[6px]" />
          <div className="absolute top-[34%] right-[28%] h-80 w-80 rounded-full border-[7px] border-[var(--color-gold)]/24 blur-[14px]" />
          <div className="absolute top-[72%] left-[4%] h-24 w-[30rem] -rotate-12 rounded-full bg-[var(--color-accent-solid)]/22 blur-[13px]" />
          <div className="absolute top-[18%] right-[2%] h-48 w-48 rounded-full border-[9px] border-[var(--color-accent-solid)]/20 blur-[11px]" />
          <div className="absolute top-[60%] right-[6%] h-20 w-56 rotate-6 rounded-full bg-[var(--color-gold)]/24 blur-[9px]" />
        </div>

        {/* Main Container — layer 10 (floats above bg stage) */}
        <div
          className="relative z-10 flex-1 pt-14 lg:pt-0 flex flex-col min-h-screen"
          id="main-content-layout"
        >
          <Topbar
            currentTab={currentTab}
            onTabChange={navigateTeacher}
            onLogout={() => {
              void authService.logoutTeacher().finally(() => {
                setIsTeacherLoggedIn(false);
                setBootTeacher(undefined);
                setIsOnboarded(true);
              });
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
    </TeacherProvider>
  );
}
