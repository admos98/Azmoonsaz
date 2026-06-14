/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, GraduationCap, Eye, EyeOff, Lock, Mail, ArrowLeftRight } from 'lucide-react';
import { mockTeacher } from '../../mockData';
import { authService } from '../../services/api';

interface LoginProps {
  onLoginSuccess: () => void;
  onSwitchToStudent: () => void;
}

export default function Login({ onLoginSuccess, onSwitchToStudent }: LoginProps) {
  const [email, setEmail] = useState(mockTeacher.email);
  const [password, setPassword] = useState('demo1234');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      await authService.loginTeacher(email, password);
      onLoginSuccess();
    } catch (err: any) {
      setError(err?.message || 'کد کاربری یا رمز عبور نامعتبر است.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage('بازیابی رمز عبور در نسخه آزمایشی فعال نیست.');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden select-none" id="login-wrapper">
      {/* Absolute Decorative Circles representing dashboard design premium */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card panel */}
      <div className="w-full max-w-md bg-slate-850/80 backdrop-blur-md rounded-3xl border border-slate-800 shadow-2xl p-6 md:p-8 space-y-6 relative z-10 text-right text-slate-200">
        
        {/* Brand Banner */}
        <div className="text-center space-y-3" id="brand-header">
          <div className="w-12 h-12 bg-linear-to-tr from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-550/20">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">سامانه هوشمند آزمون‌ساز</h1>
            <p className="text-[11px] text-slate-400 mt-1">امتحانات آنلاین مدارس و مراکز آموزش عالی تراز اول کشور</p>
          </div>
        </div>

        {/* Input fields form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Email or Username */}
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="text-xs font-semibold text-slate-300 block">پست الکترونیک (ایمیل):</label>
            <div className="relative">
              <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                id="login-email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@example.com"
                className="w-full bg-slate-900/60 border border-slate-800 text-xs text-slate-200 pr-10 pl-4 py-2.5 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:bg-slate-950 font-mono text-left"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor="login-pass" className="text-xs font-semibold text-slate-300 block">رمز عبور ورود:</label>
              <a href="#" onClick={handleForgotPassword} className="text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline">فراموشی رمز عبور؟</a>
            </div>
            <div className="relative">
              <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="login-pass"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/60 border border-slate-800 text-xs text-slate-200 pr-10 pl-11 py-2.5 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:bg-slate-950 font-mono text-left"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs rounded-xl text-center">
              {error}
            </div>
          )}

          {/* Info Message (Forgot Password etc.) */}
          {infoMessage && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-xs rounded-xl text-center">
              {infoMessage}
            </div>
          )}

          {/* Remember Me */}
          <div className="flex items-center space-x-2 space-x-reverse text-xs pt-1 select-none">
            <input
              type="checkbox"
              id="remember-me"
              defaultChecked
              className="w-4 h-4 text-indigo-600 rounded-md border-slate-800 bg-slate-900 cursor-pointer focus:ring-indigo-550"
            />
            <label htmlFor="remember-me" className="text-[11px] text-slate-400 cursor-pointer">مرا به خاطر بسپار</label>
          </div>

          {/* Sign in Button */}
          <button
            type="submit"
            id="btn-login-submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4.5 h-4.5" />
                <span>ورود امن به پنل معلم</span>
              </>
            )}
          </button>
        </form>

        {/* Quick shortcut demo guide */}
        <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800 text-[10px] text-slate-400 leading-normal" id="login-protips">
          💡 <strong>راهنما:</strong> این اولین نسخه آزمایشی است. شما می‌توانید مستقیماً دکمه ورود روی فرم را بزنید تا وارد کلیه اطلاعات شبیه‌ساز شوید.
        </div>

        {/* Student panel swap visual trigger */}
        <div className="pt-4 border-t border-slate-800 text-center space-y-2">
          <p className="text-[10px] text-slate-400">آیا شما دانش‌آموز هستید؟</p>
          <button
            id="swap-to-student-mode-login"
            onClick={onSwitchToStudent}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-550/20 transition-all cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>انتقال مستقیم به پرتال شروع آزمون دانش‌آموزان</span>
          </button>
        </div>

      </div>
    </div>
  );
}
