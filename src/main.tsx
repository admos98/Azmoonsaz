import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import ConnectivityStatus from './components/ConnectivityStatus';
import GlassTierApplier from './components/GlassTierApplier';
import { ThemeProvider } from './contexts/ThemeContext';
import { MotionProvider } from './contexts/MotionContext';
import './index.css';

// Dev-only frame-timing recorder. NOTHING is installed without ?perf=1, so the
// production bundle pays one URLSearchParams read and nothing else. Open
//   https://azmoon-three.vercel.app/?perf=1
// to get a Record/Stop/Copy panel that profiles the real session.
if (new URLSearchParams(location.search).has('perf')) {
  import('./glass/perfRecorder').then((m) => m.installPerfRecorder());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <MotionProvider>
          {/* `user` makes every framer-motion spring/transition defer to the OS
             "reduce motion" switch — the same ceiling MotionContext enforces
             for CSS animation. JS motion can no longer bypass it. */}
          <MotionConfig reducedMotion="user">
            {/* Re-applies the user's glass tier on change; the boot probe in
               index.html covers the pre-React first paint. Mounted at the root
               so every route (teacher, student portal) honors the choice. */}
            <GlassTierApplier />
            <ConnectivityStatus />
            <App />
          </MotionConfig>
        </MotionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
