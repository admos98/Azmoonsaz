/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  GraduationCap,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowLeftRight,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { authService } from '../../services/api';

interface LoginProps {
  onLoginSuccess: () => void;
  onSwitchToStudent: () => void;
}

type View = 'email' | 'password' | 'signup-sent';

export default function Login({ onLoginSuccess, onSwitchToStudent }: LoginProps) {
  const [view, setView] = useState<View>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: User enters email
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('ایمیل را وارد کنید');
      return;
    }
    // Just move to password step — we'll determine login vs signup on submit
    setView('password');
  };

  // Step 2: User enters password → try login, if user not found → signup
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Try login first
      await authService.loginTeacher(email, password);
      onLoginSuccess();
    } catch (loginErr: any) {
      const msg = loginErr?.message || '';

      // If the error suggests wrong credentials, try signup
      if (msg.includes('عتبر نیست') || msg.includes('Invalid') || msg.includes('invalid')) {
        try {
          await authService.signupTeacher(email, password);
          setView('signup-sent');
        } catch (signupErr: any) {
          // If signup says already registered, show login error
          if (signupErr?.message?.includes('ثبت شده')) {
            setError('رمز عبور اشتباه است.');
          } else {
            setError(signupErr?.message || 'خطا در ثبت‌نام');
          }
        }
      } else {
        setError(msg || 'خطا در ورود');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-3xl mb-4 shadow-lg shadow-indigo-100">
            <GraduationCap className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">آزمون‌ساز</h1>
          <p className="text-sm text-slate-500 mt-1">پنل مدیریت دبیران</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
          {/* View: Enter Email */}
          {view === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">ایمیل</label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-800 pr-10 pl-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-400"
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-lg shadow-indigo-200 cursor-pointer"
              >
                ادامه
              </button>
            </form>
          )}

          {/* View: Enter Password */}
          {view === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div className="text-center">
                <p className="text-xs text-slate-500">ورود با</p>
                <p className="text-sm font-bold text-slate-800" dir="ltr">{email}</p>
                <button
                  type="button"
                  onClick={() => { setView('email'); setError(null); setPassword(''); }}
                  className="text-[10px] text-indigo-600 hover:underline cursor-pointer mt-1"
                >
                  تغییر ایمیل
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">رمز عبور</label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-800 pr-10 pl-10 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-400"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-lg shadow-indigo-200 cursor-pointer"
              >
                {loading ? 'در حال بررسی...' : 'ورود'}
              </button>

              <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                اگر حساب کاربری ندارید، با همین ایمیل و رمز عبور حساب جدید ساخته می‌شود
              </p>
            </form>
          )}

          {/* View: Signup Email Sent */}
          {view === 'signup-sent' && (
            <div className="text-center space-y-4 py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">ایمیل تأیید ارسال شد</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                لطفاً ایمیل خود را بررسی کنید و لینک تأیید را کلیک کنید.
                <br />
                پس از تأیید، با همین ایمیل و رمز عبور وارد شوید.
              </p>
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400">ارسال شده به:</p>
                <p className="text-sm font-bold text-slate-700" dir="ltr">{email}</p>
              </div>
              <button
                onClick={() => { setView('email'); setEmail(''); setPassword(''); setError(null); }}
                className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
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
            className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            ورود دانش‌آموز
          </button>
        </div>
      </div>
    </div>
  );
}
