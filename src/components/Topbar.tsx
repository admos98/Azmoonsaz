/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Bell, Sun, ArrowLeftRight } from 'lucide-react';
import BackendModeBadge from './BackendModeBadge';
import { useTeacher } from '../contexts/TeacherContext';
import { formatPersianDate } from '../services/persianHelpers';

interface TopbarProps {
  currentTab: string;
  onSwitchRole: () => void;
  onLogout: () => void;
  activeExamNotifications?: number;
}

export default function Topbar({ currentTab, onSwitchRole, onLogout, activeExamNotifications = 2 }: TopbarProps) {
  const { teacher } = useTeacher();
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const getTabTitle = () => {
    if (currentTab === 'dashboard') return 'داشبورد مدیریتی';
    if (currentTab === 'students') return 'دانش‌آموزان';
    if (currentTab === 'questions') return 'بانک سوالات';
    if (currentTab.startsWith('exams/new')) return 'آزمون جدید';
    if (currentTab.startsWith('exams') && currentTab.includes('/settings')) return 'تنظیمات آزمون';
    if (currentTab.startsWith('exams') && currentTab.includes('/preview')) return 'پیش‌نمایش';
    if (currentTab.startsWith('exams') && currentTab.includes('/results')) return 'نتایج';
    if (currentTab === 'exams') return 'آزمون‌ها';
    if (currentTab === 'results') return 'نتایج';
    if (currentTab === 'settings') return 'تنظیمات';
    return 'آزمون‌ساز';
  };

  const getPersianDateString = () => formatPersianDate(new Date().toISOString());

  return (
    <header
      className="sticky top-0 z-10 h-16 glass-1 border-b border-white/20 px-4 lg:px-8 flex items-center justify-between select-none"
      id="topbar-wrapper"
    >
      {/* Title & Search */}
      <div className="flex items-center gap-6" id="topbar-left-side">
        <div className="hidden lg:block">
          <h2 className="text-sm font-bold text-[var(--color-text-primary)]">{getTabTitle()}</h2>
          <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{getPersianDateString()}</p>
        </div>

        {/* Search */}
        <div className="relative w-56 lg:w-72 group max-sm:hidden">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)] group-focus-within:text-[var(--color-accent)] transition-colors pointer-events-none" />
          <input
            type="text"
            id="global-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو..."
            className="w-full bg-slate-100/80 border-none text-xs text-[var(--color-text-primary)] pr-9 pl-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:bg-white transition-all placeholder-[var(--color-text-tertiary)]"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 lg:gap-3" id="topbar-actions-right">
        <div className="max-lg:hidden"><BackendModeBadge /></div>

        {/* Quick Role Switch */}
        <button
          id="quick-role-switch"
          onClick={onSwitchRole}
          className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-indigo-100 text-[var(--color-accent)] bg-[var(--color-accent-soft)] hover:bg-indigo-100 transition-all cursor-pointer"
          title="سوییچ به آزمون دانش‌آموز"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span className="max-md:hidden">شبیه‌ساز</span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            id="notifications-bell-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-slate-100 rounded-xl relative transition-colors cursor-pointer"
          >
            <Bell className="w-4.5 h-4.5" />
            {activeExamNotifications > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--color-danger)] rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute left-0 mt-2 w-80 glass-2 rounded-2xl shadow-xl z-20 overflow-hidden" id="notification-dropdown">
              <div className="p-3 flex items-center justify-between border-b border-slate-100">
                <span className="text-xs font-bold text-[var(--color-text-primary)]">اطلاعیه‌ها</span>
                <span className="text-[10px] bg-[var(--color-accent-soft)] text-[var(--color-accent)] px-2 py-0.5 rounded-full font-bold">{activeExamNotifications} جدید</span>
              </div>
              <div className="max-h-56 overflow-y-auto text-xs divide-y divide-slate-100">
                <div className="p-3 hover:bg-slate-50/70 transition-colors">
                  <p className="font-semibold text-[var(--color-text-primary)]">تحویل آزمون تجربی هفتم</p>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">امیرحسین رضایی پاسخ‌برگ خود را ارسال نمود.</p>
                  <span className="text-[9px] text-[var(--color-text-tertiary)] mt-2 block">۱۰ دقیقه پیش</span>
                </div>
                <div className="p-3 hover:bg-slate-50/70 transition-colors">
                  <p className="font-semibold text-[var(--color-text-primary)]">آزمون ادبیات فارسی نهم</p>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">مریم احمدی آماده تصحیح بخش سئوال تشریحی است.</p>
                  <span className="text-[9px] text-[var(--color-text-tertiary)] mt-2 block">۱ ساعت پیش</span>
                </div>
              </div>
              <div className="p-2 bg-slate-50/50 text-center border-t border-slate-100">
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-[11px] text-[var(--color-accent)] font-semibold hover:underline cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <span className="w-px h-7 bg-slate-200 max-sm:hidden" />

        {/* Teacher Avatar */}
        <div className="flex items-center gap-2 cursor-pointer">
          <div className="text-right max-md:hidden">
            <p className="text-xs font-bold text-[var(--color-text-primary)] leading-tight">{teacher?.name || '...'}</p>
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{teacher?.schoolName || ''}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[var(--color-accent)]/10 border-2 border-[var(--color-accent)]/20 flex items-center justify-center text-[var(--color-accent)] font-bold overflow-hidden">
            {teacher?.avatarUrl ? (
              <img src={teacher.avatarUrl} alt={teacher.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs">{teacher?.name?.[0] || '?'}</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
