/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GraduationCap, Building2, BookOpen, ArrowLeft } from 'lucide-react';
import { authService } from '../../services/api';

interface OnboardingProps {
  onComplete: () => void;
}

const SUBJECTS = [
  'ریاضی',
  'فیزیک',
  'شیمی',
  'زیست‌شناسی',
  'علوم تجربی',
  'ادبیات فارسی',
  'زبان انگلیسی',
  'تاریخ',
  'جغرافیا',
  'فلسفه و منطق',
  'عربی',
  'مشاوره و پرورشی',
  'هنر',
  'فناوری اطلاعات',
  'سایر',
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [schoolName, setSchoolName] = useState('');
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalSubject = subject === 'سایر' ? customSubject : subject;

    if (!schoolName.trim()) {
      setError('نام مدرسه را وارد کنید');
      return;
    }
    if (!finalSubject.trim()) {
      setError('رشته تدریس را انتخاب کنید');
      return;
    }

    setLoading(true);
    try {
      await authService.completeOnboarding(schoolName.trim(), finalSubject.trim());
      onComplete();
    } catch (err: any) {
      setError(err?.message || 'خطا در ذخیره اطلاعات');
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
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">خوش آمدید!</h1>
          <p className="text-sm text-slate-500 mt-1">برای شروع، اطلاعات زیر را تکمیل کنید</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* School Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                <Building2 className="w-3.5 h-3.5 inline-block ml-1" />
                نام مدرسه
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="مثال: دبیرستان نمونه دولتی علوم"
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-400"
                autoFocus
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                <BookOpen className="w-3.5 h-3.5 inline-block ml-1" />
                رشته تدریس
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none cursor-pointer"
              >
                <option value="">انتخاب کنید...</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Custom Subject */}
            {subject === 'سایر' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">رشته دیگر</label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="رشته خود را وارد کنید"
                  className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-slate-400"
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-lg shadow-indigo-200 cursor-pointer"
            >
              {loading ? 'در حال ذخیره...' : 'شروع کنید'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
