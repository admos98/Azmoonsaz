/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GraduationCap, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { IconButton, Input, TextLink } from '../../components/UIComponents';
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
  const [validating, setValidating] = useState(() => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    return Boolean(params.get('access_token') && params.get('refresh_token'));
  });
  const [tokenValid, setTokenValid] = useState(false);

  // Extract tokens from URL hash and exchange them for a session
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes('type=recovery')) return;

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
      <div className="min-h-dvh bg-[var(--color-page-bg)] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[var(--color-accent-soft)] rounded-3xl mb-4">
            <GraduationCap className="w-10 h-10 text-[var(--color-accent)]" />
          </div>
          <p className="text-label text-[var(--color-text-tertiary)]">در حال بررسی لینک...</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-dvh bg-[var(--color-page-bg)] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[var(--color-accent-soft)] rounded-3xl mb-4">
              <GraduationCap className="w-10 h-10 text-[var(--color-accent)]" />
            </div>
            <h1 className="text-heading-1 font-black text-[var(--color-text-primary)] tracking-tight">
              آزمون‌ساز
            </h1>
          </div>
          <div className="lens rounded-3xl shadow-2xl p-8 text-center space-y-4">
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
              type="button"
              onClick={onDone}
              className="w-full btn-glass btn-glass--primary font-bold text-label py-3 rounded-xl cursor-pointer"
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
      <div className="min-h-dvh bg-[var(--color-page-bg)] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[var(--color-accent-soft)] rounded-3xl mb-4">
              <GraduationCap className="w-10 h-10 text-[var(--color-accent)]" />
            </div>
            <h1 className="text-heading-1 font-black text-[var(--color-text-primary)] tracking-tight">
              آزمون‌ساز
            </h1>
          </div>
          <div className="lens rounded-3xl shadow-2xl p-8 text-center space-y-4">
            <p className="text-label text-[var(--color-danger)]">
              {error || 'لینک بازیابی نامعتبر یا منقضی شده است.'}
            </p>
            <TextLink size="md" bold onClick={onDone}>
              بازگشت به ورود
            </TextLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--color-page-bg)] flex items-center justify-center p-4">
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

        <div className="lens rounded-3xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="رمز عبور جدید"
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="حداقل ۶ کاراکتر"
              icon={<Lock className="w-4 h-4" />}
              trailing={
                <IconButton
                  label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                  size="xs"
                  radius="md"
                  tone="tertiary"
                  surface="plainMuted"
                  motion={false}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </IconButton>
              }
              autoFocus
            />

            {error && (
              <p className="text-caption text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-glass btn-glass--primary font-bold text-label py-3 rounded-xl cursor-pointer"
            >
              {loading ? 'در حال ذخیره...' : 'ذخیره رمز جدید'}
            </button>

            <TextLink
              size="md"
              tone="tertiary"
              hover="secondary"
              onClick={onDone}
              className="w-full text-center"
            >
              بازگشت به ورود
            </TextLink>
          </form>
        </div>
      </div>
    </div>
  );
}
