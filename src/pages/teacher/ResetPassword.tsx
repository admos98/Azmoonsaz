/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GraduationCap, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { getSupabasePublicClient } from '../../lib/supabasePublic';

interface ResetPasswordProps {
  onDone: () => void;
}

export default function ResetPassword({ onDone }: ResetPasswordProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  // Extract tokens from URL hash and exchange them for a session
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes('type=recovery')) {
      setValidating(false);
      return;
    }

    const supabase = getSupabasePublicClient();
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            setError('لینک بازیابی منقضی شده یا نامعتبر است.');
          } else {
            setTokenValid(true);
          }
        })
        .finally(() => setValidating(false));
    } else {
      setValidating(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabasePublicClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Sign out after password change so user must log in again
      await supabase.auth.signOut();
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطا در تغییر رمز عبور');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--color-accent-soft)] via-[var(--color-surface)] to-[var(--color-info-soft)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[var(--color-accent-soft)] rounded-3xl mb-4 animate-pulse">
            <GraduationCap className="w-10 h-10 text-[var(--color-accent)]" />
          </div>
          <p className="text-label text-[var(--color-text-tertiary)]">در حال بررسی لینک...</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--color-accent-soft)] via-[var(--color-surface)] to-[var(--color-info-soft)] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[var(--color-accent-soft)] rounded-3xl mb-4">
              <GraduationCap className="w-10 h-10 text-[var(--color-accent)]" />
            </div>
            <h1 className="text-heading-1 font-black text-[var(--color-text-primary)] tracking-tight">
              آزمون‌ساز
            </h1>
          </div>
          <div className="glx-strong rounded-3xl shadow-2xl border border-[var(--color-glass-light-stroke)] p-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--color-success-soft)] rounded-full">
              <CheckCircle2 className="w-8 h-8 text-[var(--color-success)]" />
            </div>
            <h2 className="text-heading-3 font-bold text-[var(--color-text-primary)]">
              رمز عبور با موفقیت تغییر کرد
            </h2>
            <p className="text-label text-[var(--color-text-tertiary)]">
              حالا می‌توانید با رمز جدید وارد شوید.
            </p>
            <button
              onClick={onDone}
              className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-label py-3 rounded-xl transition-colors cursor-pointer"
            >
              ورود
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--color-accent-soft)] via-[var(--color-surface)] to-[var(--color-info-soft)] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[var(--color-accent-soft)] rounded-3xl mb-4">
              <GraduationCap className="w-10 h-10 text-[var(--color-accent)]" />
            </div>
            <h1 className="text-heading-1 font-black text-[var(--color-text-primary)] tracking-tight">
              آزمون‌ساز
            </h1>
          </div>
          <div className="glx-strong rounded-3xl shadow-2xl border border-[var(--color-glass-light-stroke)] p-8 text-center space-y-4">
            <p className="text-label text-[var(--color-danger)]">
              {error || 'لینک بازیابی نامعتبر یا منقضی شده است.'}
            </p>
            <button
              onClick={onDone}
              className="text-caption text-[var(--color-accent)] font-bold hover:underline cursor-pointer"
            >
              بازگشت به ورود
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-accent-soft)] via-[var(--color-surface)] to-[var(--color-info-soft)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[var(--color-accent-soft)] rounded-3xl mb-4 shadow-lg shadow-lg">
            <GraduationCap className="w-10 h-10 text-[var(--color-accent)]" />
          </div>
          <h1 className="text-heading-1 font-black text-[var(--color-text-primary)] tracking-tight">
            آزمون‌ساز
          </h1>
          <p className="text-label text-[var(--color-text-tertiary)] mt-1">تغییر رمز عبور</p>
        </div>

        <div className="glx-strong rounded-3xl shadow-2xl border border-[var(--color-glass-light-stroke)] p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-caption font-bold text-[var(--color-text-secondary)] mb-2">
                رمز عبور جدید
              </label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="حداقل ۶ کاراکتر"
                  className="w-full glx border text-label text-[var(--color-text-primary)] pr-10 pl-10 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all placeholder-[var(--color-text-tertiary)]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-caption text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-accent-soft)]/40 text-white font-bold text-label py-3 rounded-xl transition-colors shadow-lg shadow-lg cursor-pointer"
            >
              {loading ? 'در حال ذخیره...' : 'ذخیره رمز جدید'}
            </button>

            <button
              type="button"
              onClick={onDone}
              className="w-full text-center text-caption text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] cursor-pointer"
            >
              بازگشت به ورود
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
