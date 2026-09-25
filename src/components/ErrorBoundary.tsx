/** @license SPDX-License-Identifier: Apache-2.0 */

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { logger } from '../lib/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="min-h-screen flex items-center justify-center bg-[var(--color-glass-light-fill)] p-8"
          dir="rtl"
        >
          <div className="max-w-md w-full  bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-danger)]/20 p-8 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-heading-2 font-bold text-[var(--color-text-primary)] mb-2">
              خطایی رخ داد
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-1 text-label">
              بخشی از برنامه با خطا مواجه شد. لطفاً دوباره تلاش کنید.
            </p>
            {this.state.error && (
              <p
                className="text-caption text-[var(--color-text-tertiary)] mb-4 font-mono"
                dir="ltr"
              >
                {this.state.error.message}
              </p>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="px-6 py-2 bg-[var(--color-info-soft)] text-[var(--color-text-on-solid)] rounded-lg hover:bg-[var(--color-info-soft)] transition-colors font-medium"
            >
              تلاش مجدد
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
