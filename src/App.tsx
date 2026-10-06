/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { TeacherProvider } from './contexts/TeacherContext';
import type { Teacher } from './types';
import Topbar from './components/Topbar';
import { BubbleLoader } from './components/BubbleLoader';
import Login from './pages/teacher/Login';
import Onboarding from './pages/teacher/Onboarding';
import ResetPassword from './pages/teacher/ResetPassword';
import { authService } from './services/api';
import { getSupabasePublicClient } from './lib/supabasePublic';
import { teacherPathFromTab, teacherTabFromPath } from './utils/teacherRoutes';
import { usePersistentPreference } from './hooks/usePersistentPreference';
import { requestAppNavigation } from './hooks/useUnsavedChanges';
import { mountGlassEngine } from './glass/glassController';
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

// Student portal — the highest-stakes surface is code-split: teachers never
// download it and it stays out of the entry chunk.
const SecureExamPortal = lazy(() => import('./pages/student/SecureExamPortal'));

// Dev-only material laboratory (`/dev/fixtures`). DEV-gated at build time:
// in production `import.meta.env.DEV` folds to `false`, these conditional
// lazy() calls dead-code-eliminate — the chunks never reach dist.
const FixtureGallery = import.meta.env.DEV
  ? lazy(() => import('./pages/dev/FixtureGallery'))
  : null;
// Dev-only topbar harness (`/dev/topbar`) — same gate, real Topbar + mock teacher.
const TopbarHarness = import.meta.env.DEV ? lazy(() => import('./pages/dev/TopbarHarness')) : null;

/** Full-page boot state. Used for the auth handshake and as the Suspense
 *  fallback on route-level code boundaries. */
function BootScreen({ label }: { label: string }) {
  return (
    <div
      className="grid min-h-dvh place-items-center bg-[var(--color-page-bg)]"
      role="status"
      aria-label={label}
    >
      <div className="space-y-4 text-center">
        <BubbleLoader label={null} />
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
    // mount the per-panel liquid-glass engine once, after first paint
    const id = requestAnimationFrame(() => mountGlassEngine());
    return () => cancelAnimationFrame(id);
  }, []);

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
            initialTab={
              currentTab === 'profile' ? undefined : (currentTab as 'students' | 'classes')
            }
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
  // inspected without a backend session. Gated on import.meta.env.DEV so
  // production builds DCE the whole branch (lazy imports + chunks included).
  if (import.meta.env.DEV && currentPath.startsWith('/dev/')) {
    const DevPage = currentPath.startsWith('/dev/topbar') ? TopbarHarness : FixtureGallery;
    // Unreachable: prod folds both consts to null and the DEV guard above
    // never opens; kept so the narrow type renders without a cast.
    if (!DevPage) return null;
    return (
      <Suspense
        fallback={
          <div
            className="min-h-dvh bg-[var(--color-page-bg)]"
            role="status"
            aria-label="در حال بارگذاری آزمایشگاه مواد"
          />
        }
      >
        <DevPage />
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
      {/* id="app-teacher-shell" is the anchor for the page-plate ::before
          (fixed, z-0). The shell itself must stay transparent so the plate
          reads; leaving the bg-[--color-page-bg] utility here would re-paint
          the base over it. */}
      <div className="min-h-dvh flex" dir="rtl" id="app-teacher-shell">
        {/* ONE background: the topo page plate painted by #app-teacher-shell::before
            (index.css). The old depth-field stage (blobs/rings/bands) is gone — it
            rendered as a second background over the plate. The plate's contour
            lines are the structure the blur and lens bend reveal. */}

        {/* Main Container — layer 10 */}
        <div
          className="relative z-10 flex-1 pt-14 lg:pt-0 flex flex-col min-h-dvh"
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
