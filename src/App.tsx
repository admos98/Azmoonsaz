/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Suspense, lazy, useCallback } from 'react';
import { TeacherProvider } from './contexts/TeacherContext';
import type { Teacher } from './types';
import Topbar from './components/Topbar';
import { BootScreen } from './shell/BootScreens';
import { AbsencePage } from './components/AbsencePage';
import Login from './pages/teacher/Login';
import Onboarding from './pages/teacher/Onboarding';
import ResetPassword from './pages/teacher/ResetPassword';
import { authService } from './services/api';
import { getSupabasePublicClient } from './lib/supabasePublic';
import { publicEnv } from './config/env';
import { isKnownTeacherPath, teacherPathFromTab, teacherTabFromPath } from './utils/teacherRoutes';
import { usePersistentPreference } from './hooks/usePersistentPreference';
import { requestAppNavigation } from './hooks/useUnsavedChanges';
import { usePopstateGuard } from './hooks/usePopstateGuard';
import { useMotionPreference } from './contexts/MotionContext';
import { runInViewTransition } from './utils/viewTransition';
import { mountGlassEngine } from './glass/glassController';
import { applySeasonalGirih } from './glass/seasonalGirih';
import { TeacherRouterBoundary } from './components/TeacherRouter';

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

export default function App() {
  const [isTeacherLoggedIn, setIsTeacherLoggedIn] = useState(false);
  // Hermetic boot: the student portal talks to /api only and never needs the
  // teacher Supabase client. Without configured env the client factory throws,
  // so start uninitialized only when there is something to initialize.
  const [authInitializing, setAuthInitializing] = useState(() => publicEnv.isSupabaseConfigured);
  /** A session we HAD just went away — C.2 session-expired interstitial
   *  instead of a silent drop to the Login page. */
  const [sessionExpired, setSessionExpired] = useState(false);
  /** Mirrors isTeacherLoggedIn for the auth listener: detecting the
   *  logged-in → out TRANSITION needs a ref (updaters must stay pure). */
  const loggedInRef = useRef(false);
  const [isOnboarded, setIsOnboarded] = useState(true);
  /** Profile fetched during boot or handed over by Login. `undefined` tells
   *  TeacherProvider to fetch for itself (self-heal / post-onboarding). */
  const [bootTeacher, setBootTeacher] = useState<Teacher | undefined>(undefined);
  const [currentTab, setCurrentTab] = useState<string>(() =>
    teacherTabFromPath(window.location.pathname),
  );
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  /** The live mirror of currentPath for the popstate guard: the handler runs
   *  with a mount-time closure ([] deps), so restoring a refused back-nav
   *  needs the CURRENT path, not the stale one. */
  const currentPathRef = useRef(window.location.pathname);
  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);
  // FE-3 fix: the results deep link was parsed ONLY in the popstate handler,
  // which never runs on first mount — a fresh load / F5 at
  // /teacher/exams/<id>/results initialized examSubView to 'list' and showed
  // the exam list at a results URL. Parse the URL once in the initializers,
  // exactly as handlePopState does.
  const initialResultsMatch = window.location.pathname.match(
    /^\/teacher\/exams\/([^/]+)\/results$/,
  );
  const [selectedExamId, setSelectedExamId] = useState<string | undefined>(
    initialResultsMatch?.[1],
  );
  const [examSubView, setExamSubView] = useState<'list' | 'settings' | 'preview' | 'results'>(
    initialResultsMatch ? 'results' : 'list',
  );

  /* View Transitions (Meraj): navigations are page morphs, boot repairs are
     not. resolvedMotion arrives from MotionProvider (mounted above App in
     main.tsx); the ref keeps the navigation closures dep-stable. */
  const { resolvedMotion } = useMotionPreference();
  const reducedMotionRef = useRef(resolvedMotion === 'reduce');
  useEffect(() => {
    reducedMotionRef.current = resolvedMotion === 'reduce';
  }, [resolvedMotion]);

  useEffect(() => {
    // mount the per-panel liquid-glass engine once, after first paint.
    // Seasonal girih (Meraj P3) sets its fold on :root FIRST — the engines
    // read the token from computed style when the first maps are built.
    applySeasonalGirih();
    const id = requestAnimationFrame(() => mountGlassEngine());
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let active = true;
    // E2E hermetic boot: the student portal talks to /api only and never
    // needs the teacher Supabase client. Without configured env the client
    // factory throws — skip teacher boot instead of crashing the route.
    // (authInitializing already starts false in that case; see useState.)
    if (!publicEnv.isSupabaseConfigured) return;
    const supabase = getSupabasePublicClient();
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setIsTeacherLoggedIn(Boolean(data.session));
      loggedInRef.current = Boolean(data.session);
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
      // Losing a session we HAD is the C.2 absence moment — interstitial,
      // not a silent drop to Login. Signing back in clears it.
      if (session) setSessionExpired(false);
      else if (loggedInRef.current) setSessionExpired(true);
      loggedInRef.current = Boolean(session);
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

  // URL state management — the popstate handler (dirty guard + morph) lives
  // in usePopstateGuard (extracted at v7 for the size ratchet); App keeps
  // only the dep-stable applier.
  const applyPopstatePath = useCallback((path: string) => {
    setCurrentPath(path);
    if (path.startsWith('/teacher')) {
      setCurrentTab(teacherTabFromPath(path));
      const resultMatch = path.match(/^\/teacher\/exams\/([^/]+)\/results$/);
      setSelectedExamId(resultMatch?.[1]);
      setExamSubView(resultMatch ? 'results' : 'list');
    }
  }, []);
  usePopstateGuard(applyPopstatePath, currentPathRef, reducedMotionRef);

  const navigateToLocalPath = (path: string, replace = false) => {
    window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
    setCurrentPath(path);
  };

  const navigateTeacher = (tab: string) => {
    if (!requestAppNavigation()) return;
    runInViewTransition(() => {
      setCurrentTab(tab);
      setExamSubView('list');
      setSelectedExamId(undefined);
      navigateToLocalPath(teacherPathFromTab(tab));
    }, reducedMotionRef.current);
  };

  // Check onboarding status after login — handled by Login's onLoginSuccess
  // handoff (it already holds the profile from the sign-in response), so the
  // previous duplicate getCurrentTeacher effect is gone.

  // Handle addition of designed exam — the exam itself is persisted by the
  // service; the shared cache patches itself, so no local copy is needed.
  const handleAddNewExam = () => {
    runInViewTransition(() => {
      setCurrentTab('exams');
      setExamSubView('list');
      navigateToLocalPath('/teacher/exams');
    }, reducedMotionRef.current);
  };

  /** Single source of exam sub-view navigation — App.tsx had three verbatim
   *  copies of this closure (two <Exams> mounts + results selection). */
  const handleExamSubViewChange = useCallback(
    (view: 'list' | 'settings' | 'preview' | 'results', id?: string) => {
      runInViewTransition(() => {
        setExamSubView(view);
        setSelectedExamId(id);
        if (view === 'results' && id) {
          navigateToLocalPath(`/teacher/exams/${id}/results`);
        } else if (view === 'list') {
          navigateToLocalPath('/teacher/exams');
        }
      }, reducedMotionRef.current);
    },
    // navigateToLocalPath closes over currentTab-free setters only; the empty
    // dep list keeps this handler stable for the whole session (reducedMotion
    // rides the ref, runInViewTransition is a module import).
    [],
  );

  const handleSelectExamForResults = (examId: string) => {
    // One morph, one paint: the tab flip and the results swap must land in
    // the same snapshot, so this bypasses the two-call composition.
    runInViewTransition(() => {
      setCurrentTab('exams');
      setExamSubView('results');
      setSelectedExamId(examId);
      navigateToLocalPath(`/teacher/exams/${examId}/results`);
    }, reducedMotionRef.current);
  };

  /** Login hands over the profile it already fetched during sign-in —
   *  no second /api/teacher/me round-trip after a fresh login. */
  const handleLoginSuccess = (teacher: Teacher) => {
    setBootTeacher(teacher);
    setIsOnboarded(teacher.isOnboarded ?? true);
    setIsTeacherLoggedIn(true);
    loggedInRef.current = true;
    setSessionExpired(false);
  };

  /** Return point for the student portal (its "بازگشت" affordance). */
  const returnToTeacherHome = () => {
    runInViewTransition(() => {
      navigateToLocalPath('/teacher/dashboard');
      setCurrentTab('dashboard');
    }, reducedMotionRef.current);
  };

  // Main layout router — the tab->page switch lives in TeacherRouter
  // (extracted for the size ratchet); motion policy stays here in App.
  const renderTeacherContent = () => (
    <TeacherRouterBoundary
      currentTab={currentTab}
      selectedExamId={selectedExamId}
      examSubView={examSubView}
      navigateTeacher={navigateTeacher}
      onSelectExamForResults={handleSelectExamForResults}
      onExamSubViewChange={handleExamSubViewChange}
      onAddNewExam={handleAddNewExam}
    />
  );

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

  // FE-2 fix: an active recovery link is an explicit intent and must outrank
  // BOTH the workspace and Login. ResetPassword calls
  // supabase.auth.setSession(...) (and the client runs with
  // detectSessionInUrl), which fires SIGNED_IN and flips isTeacherLoggedIn —
  // when this check lived inside the !isTeacherLoggedIn branch, the workspace
  // replaced the password form the moment the session landed and the user
  // could never submit a new password.
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

  if (!isTeacherLoggedIn) {
    // Session expired mid-use (C.2): the interstitial explains WHY before
    // Login shows.
    if (sessionExpired) {
      return (
        <AbsencePage
          kind="session-expired"
          title="نشست شما به پایان رسید"
          description="برای ادامهٔ کار دوباره وارد حساب خود شوید."
          actionLabel="ورود دوباره"
          onAction={() => setSessionExpired(false)}
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

  // C.2 route 404 — unknown paths no longer fall through to the dashboard.
  if (!isKnownTeacherPath(currentPath)) {
    return (
      <AbsencePage
        kind="not-found"
        title="صفحه‌ای پیدا نشد"
        description="نشانی درست نیست یا این صفحه جابه‌جا شده است."
        actionLabel="بازگشت به داشبورد"
        onAction={() => navigateTeacher('dashboard')}
      />
    );
  }

  return (
    <TeacherProvider initialTeacher={bootTeacher}>
      <WorkspacePreferenceApplier />
      {/* Skip link — first focusable in the app. Visually hidden until
          keyboard focus; the global focus-visible ring announces it. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-[300] focus:rounded-xl focus:bg-[var(--color-accent-solid)] focus:px-4 focus:py-2 focus:text-caption focus:font-bold focus:text-[var(--color-text-on-solid)]"
      >
        پرش به محتوا
      </a>
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
              // Intentional sign-out: flag the ref FIRST so the SIGNED_OUT
              // event does not read as an unexpected expiry.
              loggedInRef.current = false;
              void authService.logoutTeacher().finally(() => {
                setIsTeacherLoggedIn(false);
                setBootTeacher(undefined);
                setIsOnboarded(true);
              });
            }}
            onSelectExamForResults={handleSelectExamForResults}
          />

          {/* Dynamic Page Router — floats above bg stage */}
          <main className="p-4 lg:p-8 flex-1 bg-transparent" id="router-view-box" aria-label="محتوای اصلی">
            <div id="main-content" tabIndex={-1} className="outline-none">
            {renderTeacherContent()}
            </div>
          </main>
        </div>
      </div>
    </TeacherProvider>
  );
}
