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
          className="min-h-dvh flex items-center justify-center bg-[var(--color-glass-light-fill)] p-8"
          dir="rtl"
        >
          <div className="max-w-md w-full lens rounded-3xl p-8 text-center">
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
              className="btn-glass btn-glass--primary px-6 py-2 rounded-xl font-medium cursor-pointer"
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
