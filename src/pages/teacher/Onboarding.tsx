/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GraduationCap, Building2, BookOpen } from 'lucide-react';
import { authService } from '../../services/api';
import { Dropdown } from '../../components/UIComponents';
import { usePersistentPreference } from '../../hooks/usePersistentPreference';

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
  const [schoolName, setSchoolName, resetSchoolName] = usePersistentPreference(
    'onboarding:school-name',
    '',
  );
  const [subject, setSubject, resetSubject] = usePersistentPreference('onboarding:subject', '');
  const [customSubject, setCustomSubject, resetCustomSubject] = usePersistentPreference(
    'onboarding:custom-subject',
    '',
  );
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
      resetSchoolName();
      resetSubject();
      resetCustomSubject();
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطا در ذخیره اطلاعات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-accent)] via-white to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[var(--color-accent-soft)] rounded-3xl mb-4 shadow-lg shadow-[var(--color-accent)]/10">
            <GraduationCap className="w-10 h-10 text-[var(--color-accent)]" />
          </div>
          <h1 className="text-heading-1 font-black text-[var(--color-text-primary)] tracking-tight">
            خوش آمدید!
          </h1>
          <p className="text-label text-[var(--color-text-tertiary)] mt-1">
            برای شروع، اطلاعات زیر را تکمیل کنید
          </p>
        </div>

        <div className="mb-4" aria-label="پیشرفت تکمیل اطلاعات">
          <div className="mb-1 flex justify-between text-micro font-bold text-[var(--color-text-secondary)]">
            <span>تکمیل اطلاعات اولیه</span>
            <span>
              {schoolName.trim() && (subject !== 'سایر' ? subject : customSubject).trim()
                ? '۲ از ۲'
                : schoolName.trim() || (subject !== 'سایر' ? subject : customSubject).trim()
                  ? '۱ از ۲'
                  : '۰ از ۲'}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-secondary)]">
            <div
              className="h-full bg-[var(--color-accent-solid)] transition-[width]"
              style={{
                width: `${((Number(Boolean(schoolName.trim())) + Number(Boolean((subject !== 'سایر' ? subject : customSubject).trim()))) / 2) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Form */}
        <div className="glx-strong rounded-3xl border p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* School Name */}
            <div>
              <label className="block text-caption font-bold text-[var(--color-text-secondary)] mb-2">
                <Building2 className="w-3.5 h-3.5 inline-block ml-1" />
                نام مدرسه
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="مثال: دبیرستان نمونه دولتی علوم"
                className="w-full glx border text-label text-[var(--color-text-primary)] px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all placeholder-[var(--color-text-tertiary)]"
                autoFocus
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-caption font-bold text-[var(--color-text-secondary)] mb-2">
                <BookOpen className="w-3.5 h-3.5 inline-block ml-1" />
                رشته تدریس
              </label>
              <Dropdown
                value={subject}
                onChange={(v) => setSubject(v)}
                options={[
                  { value: '', label: 'انتخاب کنید...' },
                  ...SUBJECTS.map((s) => ({ value: s, label: s })),
                ]}
              />
            </div>

            {/* Custom Subject */}
            {subject === 'سایر' && (
              <div>
                <label className="block text-caption font-bold text-[var(--color-text-secondary)] mb-2">
                  رشته دیگر
                </label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="رشته خود را وارد کنید"
                  className="w-full glx border text-label text-[var(--color-text-primary)] px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all placeholder-[var(--color-text-tertiary)]"
                />
              </div>
            )}

            {error && (
              <p className="text-caption text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--color-accent-solid)] hover:bg-[var(--color-accent-solid-hover)] disabled:bg-[var(--color-accent-soft)]/40 text-[var(--color-text-on-solid)] font-bold text-label py-3 rounded-xl transition-colors shadow-lg shadow-[var(--color-accent)]/10 cursor-pointer"
            >
              {loading ? 'در حال ذخیره...' : 'شروع کنید'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
