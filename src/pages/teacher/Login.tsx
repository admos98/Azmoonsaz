/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowLeftRight,
  CheckCircle2,
  ArrowRight,
  KeyRound,
  Send,
} from 'lucide-react';
import { TheMark } from '../../components/TheMark';
import { authService } from '../../services/api';

interface LoginProps {
  onLoginSuccess: () => void;
  onSwitchToStudent: () => void;
}

type View = 'email' | 'password' | 'signup' | 'signup-sent' | 'forgot-password' | 'forgot-password-sent';

export default function Login({ onLoginSuccess, onSwitchToStudent }: LoginProps) {
  const [view, setView] = useState<View>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('ایمیل را وارد کنید');
      return;
    }
    setView('password');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.loginTeacher(email, password);
      onLoginSuccess();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('تایید') || msg.includes('confirm')) {
        setError('حساب شما هنوز تأیید نشده. لطفاً ایمیل خود را بررسی کنید.');
      } else {
        setError('ایمیل یا رمز عبور اشتباه است.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }
    setLoading(true);
    try {
      await authService.signupTeacher(email, password);
      setView('signup-sent');
    } catch (err: any) {
      if (err?.message?.includes('ثبت شده')) {
        setError('این ایمیل قبلاً ثبت شده است.');
      } else {
        setError(err?.message || 'خطا در ثبت‌نام');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.resetPassword(email);
      setView('forgot-password-sent');
    } catch (err: any) {
      setError(err?.message || 'خطا در ارسال ایمیل');
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setView('email');
    setEmail('');
    setPassword('');
    setError(null);
  };

  const inputBase = "w-full text-sm text-[var(--color-text-primary)] pr-10 pl-4 py-3 rounded-xl glx-inset focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:brightness-105 transition-all placeholder-[var(--color-text-tertiary)]";

  return (
    <div className="min-h-screen bg-[var(--color-paper-warm)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header — The Mark logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 glx-dark rounded-2xl mb-4 shadow-xl flex-shrink-0">
            <TheMark variant="core" size={48} animated={false} />
          </div>
          <h1 className="text-2xl font-black text-[var(--color-ink)] tracking-tight">آزمون‌ساز</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">پنل مدیریت اساتید</p>
        </div>

        {/* Card — glx glass surface */}
        <div className="glx rounded-3xl shadow-xl p-8">

          {/* View: Enter Email */}
          {view === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-2">ایمیل</label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
                  <input
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className={inputBase}
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                className="w-full bg-[var(--color-ink)] hover:bg-[var(--color-ink)]/90 text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-md shadow-[var(--color-ink)]/10 cursor-pointer flex items-center justify-center gap-2"
              >
                ادامه
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* View: Enter Password (Login) */}
          {view === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div className="text-center">
                <p className="text-xs text-[var(--color-text-tertiary)]">ورود با</p>
                <p className="text-sm font-bold text-[var(--color-text-primary)]" dir="ltr">{email}</p>
                <button
                  type="button"
                  onClick={() => { setView('email'); setError(null); setPassword(''); }}
                  className="text-[10px] text-[var(--color-accent)] hover:underline cursor-pointer mt-1"
                >
                  تغییر ایمیل
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-2">رمز عبور</label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputBase}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[var(--color-ink)] hover:bg-[var(--color-ink)]/90 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-md shadow-[var(--color-ink)]/10 cursor-pointer"
              >
                {loading ? 'در حال بررسی...' : 'ورود'}
              </button>

              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => { setView('forgot-password'); setError(null); setPassword(''); }}
                  className="text-[var(--color-accent)] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <KeyRound className="w-3 h-3" />
                  رمز عبور را فراموش کردم
                </button>
                <button
                  type="button"
                  onClick={() => { setView('signup'); setError(null); setPassword(''); }}
                  className="text-[var(--color-success)] hover:underline cursor-pointer"
                >
                  ایجاد حساب جدید
                </button>
              </div>
            </form>
          )}

          {/* View: Signup (create new account) */}
          {view === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-5">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-[var(--color-success-soft)] rounded-full mb-2">
                  <CheckCircle2 className="w-6 h-6 text-[var(--color-success)]" />
                </div>
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">ایجاد حساب جدید</h2>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">یک رمز عبور برای حساب خود انتخاب کنید</p>
                <p className="text-sm font-bold text-[var(--color-text-primary)] mt-2" dir="ltr">{email}</p>
                <button
                  type="button"
                  onClick={() => { setView('password'); setError(null); setPassword(''); }}
                  className="text-[10px] text-[var(--color-accent)] hover:underline cursor-pointer mt-1"
                >
                  تغییر ایمیل
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-2">رمز عبور</label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="حداقل ۶ کاراکتر"
                    className={inputBase}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[var(--color-success)] hover:bg-[var(--color-success)]/90 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-md shadow-[var(--color-success)]/10 cursor-pointer"
              >
                {loading ? 'در حال ثبت‌نام...' : 'ساخت حساب'}
              </button>

              <button
                type="button"
                onClick={() => { setView('password'); setError(null); setPassword(''); }}
                className="w-full text-center text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] cursor-pointer"
              >
                بازگشت به ورود
              </button>
            </form>
          )}

          {/* View: Signup Email Sent */}
          {view === 'signup-sent' && (
            <div className="text-center space-y-4 py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--color-success-soft)] rounded-full mb-2">
                <CheckCircle2 className="w-8 h-8 text-[var(--color-success)]" />
              </div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">ایمیل تأیید ارسال شد</h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                لطفاً ایمیل خود را بررسی کنید و لینک تأیید را کلیک کنید.
                <br />
                پس از تأیید، با همین ایمیل و رمز عبور وارد شوید.
              </p>
              <div className="glx-inset rounded-xl px-4 py-3">
                <p className="text-xs text-[var(--color-text-tertiary)]">ارسال شده به:</p>
                <p className="text-sm font-bold text-[var(--color-text-primary)]" dir="ltr">{email}</p>
              </div>
              <button
                onClick={resetAll}
                className="text-xs text-[var(--color-accent)] font-bold hover:underline cursor-pointer"
              >
                بازگشت به ورود
              </button>
            </div>
          )}

          {/* View: Forgot Password */}
          {view === 'forgot-password' && (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-5">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-[var(--color-warning-soft)] rounded-full mb-2">
                  <KeyRound className="w-6 h-6 text-[var(--color-warning)]" />
                </div>
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">بازیابی رمز عبور</h2>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  لینک بازیابی رمز عبور به ایمیل شما ارسال می‌شود
                </p>
                <p className="text-sm font-bold text-[var(--color-text-primary)] mt-2" dir="ltr">{email}</p>
              </div>

              {error && (
                <p className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[var(--color-warning)] hover:bg-[var(--color-warning)]/90 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-md shadow-[var(--color-warning)]/10 cursor-pointer flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {loading ? 'در حال ارسال...' : 'ارسال لینک بازیابی'}
              </button>

              <button
                type="button"
                onClick={() => { setView('password'); setError(null); setPassword(''); }}
                className="w-full text-center text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] cursor-pointer"
              >
                بازگشت به ورود
              </button>
            </form>
          )}

          {/* View: Forgot Password Email Sent */}
          {view === 'forgot-password-sent' && (
            <div className="text-center space-y-4 py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--color-warning-soft)] rounded-full mb-2">
                <CheckCircle2 className="w-8 h-8 text-[var(--color-warning)]" />
              </div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">لینک بازیابی ارسال شد</h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                ایمیلی حاوی لینک بازیابی رمز عبور برای شما ارسال شد.
                <br />
                لینک را باز کنید و رمز جدید انتخاب کنید.
              </p>
              <div className="glx-inset rounded-xl px-4 py-3">
                <p className="text-xs text-[var(--color-text-tertiary)]">ارسال شده به:</p>
                <p className="text-sm font-bold text-[var(--color-text-primary)]" dir="ltr">{email}</p>
              </div>
              <button
                onClick={resetAll}
                className="text-xs text-[var(--color-accent)] font-bold hover:underline cursor-pointer"
              >
                بازگشت به ورود
              </button>
            </div>
          )}
        </div>

        {/* Student switch */}
        <div className="mt-6 text-center">
          <button
            onClick={onSwitchToStudent}
            className="inline-flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            ورود دانش‌آموز
          </button>
        </div>
      </div>
    </div>
  );
}
