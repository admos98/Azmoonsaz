import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import ConnectivityStatus from './components/ConnectivityStatus';
import { ThemeProvider } from './contexts/ThemeContext';
import { MotionProvider } from './contexts/MotionContext';
import { GlassProvider } from './contexts/GlassContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <MotionProvider>
          <GlassProvider>
            <ConnectivityStatus />
            <App />
          </GlassProvider>
        </MotionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
