/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Bell, ArrowLeftRight } from 'lucide-react';
import BackendModeBadge from './BackendModeBadge';
import { useTeacher } from '../contexts/TeacherContext';
import { formatPersianDate, formatPersianNumber } from '../services/persianHelpers';
import { gradingService, examService } from '../services/api';
import { Exam, Submission } from '../types';
import { logger } from '../lib/logger';

interface TopbarProps {
  currentTab: string;
  onSwitchRole: () => void;
  onLogout: () => void;
  onSelectExamForResults?: (examId: string) => void;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timeAgo: string;
  type: 'submission' | 'grading' | 'exam';
  onClick?: () => void;
}

export default function Topbar({
  currentTab,
  onSwitchRole,
  onLogout,
  onSelectExamForResults,
}: TopbarProps) {
  const { teacher } = useTeacher();
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [bellRect, setBellRect] = useState<DOMRect | null>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Fetch real notifications from grading + exam services
  useEffect(() => {
    let cancelled = false;
    const fetchNotifications = async () => {
      setLoadingNotifs(true);
      try {
        const submissions: Submission[] = await gradingService.getSubmissions();
        const exams: Exam[] = await examService.getExams();
        const activeExams = exams.filter((e) => e.status === 'active');
        const now = new Date();

        const items: NotificationItem[] = [];

        // Submission notifications (most recent first)
        const ungraded = submissions
          .filter((s) => s.status === 'submitted' || s.status === 'ongoing')
          .sort((a, b) => new Date(b.submittedAt || b.startedAt).getTime() - new Date(a.submittedAt || a.startedAt).getTime());

        ungraded.slice(0, 6).forEach((s) => {
          const when = new Date(s.submittedAt || s.startedAt);
          const mins = Math.floor((now.getTime() - when.getTime()) / 60000);
          const timeAgo = mins < 60 ? `${mins} دقیقه پیش` : `${Math.floor(mins / 60)} ساعت پیش`;
          items.push({
            id: `sub-${s.id}`,
            title: `پاسخ‌برگ «${s.studentName}»`,
            description: s.status === 'submitted'
              ? 'پاسخ‌برگ خود را ارسال نمود. نیاز به تصحیح دارد.'
              : 'در حال پاسخ به آزمون است.',
            timeAgo,
            type: 'submission',
            onClick: () => onSelectExamForResults && onSelectExamForResults(s.examId),
          });
        });

        // Active exam notifications
        activeExams.slice(0, 3).forEach((e) => {
          items.push({
            id: `exam-${e.id}`,
            title: `آزمون فعال: ${e.title}`,
            description: 'در حال برگزاری — دانش‌آموزان در حال پاسخ دهی هستند.',
            timeAgo: 'هم‌اکنون',
            type: 'exam',
            onClick: () => onSelectExamForResults && onSelectExamForResults(e.id),
          });
        });

        if (!cancelled) setNotifications(items);
      } catch (err) {
        logger.error('Notification fetch failed:', err);
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled) setLoadingNotifs(false);
      }
    };

    fetchNotifications();
    if (showNotifications) {
      const timer = setInterval(fetchNotifications, 60000);
      return () => clearInterval(timer);
    }
  }, [onSelectExamForResults, showNotifications]);

  // Measure bell button position when notifications open
  const openNotifications = useCallback(() => {
    if (bellRef.current) {
      setBellRect(bellRef.current.getBoundingClientRect());
    }
    setShowNotifications(true);
  }, []);

  const closeNotifications = useCallback(() => {
    setShowNotifications(false);
    setBellRect(null);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!showNotifications) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeNotifications();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        notifRef.current &&
        !notifRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        closeNotifications();
      }
    };
    // Use pointerdown for better mobile support
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showNotifications]);

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
  const unreadCount = notifications.length;

  // Compute dropdown position: fixed relative to viewport, anchored to bell
  // This avoids flex-container positioning bugs and z-index conflicts
  const dropdownStyle: React.CSSProperties = {};
  if (bellRect) {
    const dropdownWidth = 320; // w-80 = 20rem
    const gap = 12; // mt-3 = 12px
    // Position dropdown below bell, right-aligned with bell's right edge
    const left = Math.max(16, bellRect.right - dropdownWidth);
    const top = bellRect.bottom + gap;
    dropdownStyle.left = `${left}px`;
    dropdownStyle.top = `${top}px`;
    dropdownStyle.width = `${dropdownWidth}px`;
  }

  return (
    <header
      className="sticky top-0 z-30 h-16 glx px-4 lg:px-8 flex items-center justify-between select-none"
      id="topbar-wrapper"
    >
      {/* Title & Search */}
      <div className="flex items-center gap-6" id="topbar-left-side">
        <div className="hidden lg:block">
          <h2 className="text-sm font-bold text-[var(--color-text-primary)]">{getTabTitle()}</h2>
          <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{getPersianDateString()}</p>
        </div>

        {/* Search */}
        <div className="relative w-56 lg:w-72 max-sm:hidden">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)] transition-colors pointer-events-none" />
          <input
            type="text"
            id="global-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو..."
            className="w-full text-xs md:text-sm pr-9 pl-4 py-2.5 rounded-full glx-inset focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:brightness-110 transition-all placeholder-[var(--color-text-tertiary)]"
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
          className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-[var(--color-accent)]/20 text-[var(--color-accent)] bg-[var(--color-accent-soft)] hover:bg-indigo-100 transition-all cursor-pointer"
          title="سوییچ به آزمون دانش‌آموز"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span className="max-md:hidden">شبیه‌ساز</span>
        </button>

        {/* Notifications — REAL DATA */}
        <div className="relative">
          <button
            id="notifications-bell-btn"
            ref={bellRef}
            onClick={openNotifications}
            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-glass-light-stroke)]/20 rounded-xl relative transition-all cursor-pointer"
            aria-label="اعلان‌ها"
            aria-expanded={showNotifications}
            aria-haspopup="true"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span
                className="absolute top-1.5 right-1.5 flex items-center justify-center text-[9px] font-bold text-white bg-[var(--color-danger)] rounded-full ring-2 ring-white"
                style={{ width: '18px', height: '18px' }}
                aria-label={`${unreadCount} اعلان خوانده‌نشده`}
              >
                {formatPersianNumber(unreadCount > 9 ? '9+' : unreadCount.toString())}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              ref={notifRef}
              className="fixed glx-strong rounded-2xl shadow-2xl z-[60] overflow-hidden glx-sheen"
              style={dropdownStyle}
              id="notification-dropdown"
            >
              <div className="p-3 flex items-center justify-between border-b border-[var(--color-glass-light-stroke)]">
                <span className="text-xs font-bold text-[var(--color-text-primary)]">اعلان‌ها</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-[var(--color-accent-soft)] text-[var(--color-accent)] px-2 py-0.5 rounded-full font-bold">
                    {formatPersianNumber(unreadCount.toString())} جدید
                  </span>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto text-xs divide-y divide-[var(--color-glass-light-stroke)]">
                {loadingNotifs ? (
                  <div className="p-4 text-center text-[var(--color-text-tertiary)]">
                    در حال بارگذاری...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-6 text-center text-[var(--color-text-tertiary)]">
                    هیچ اعلانی نیست.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-3 hover:bg-[var(--color-accent-soft)]/30 transition-colors cursor-pointer rounded-md mx-2 my-1"
                      onClick={() => {
                        if (n.onClick) n.onClick();
                        closeNotifications();
                      }}
                    >
                      <p className="font-semibold text-[var(--color-text-primary)]">{n.title}</p>
                      <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">{n.description}</p>
                      <span className="text-[9px] text-[var(--color-text-tertiary)] mt-2 block">{n.timeAgo}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2 bg-[var(--color-glass-light-fill)] text-center border-t border-[var(--color-glass-light-stroke)]">
                <button
                  onClick={closeNotifications}
                  className="text-[11px] text-[var(--color-accent)] font-semibold hover:underline cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <span className="w-px h-7 bg-[var(--color-glass-light-stroke)] max-sm:hidden" />

        {/* Teacher Avatar */}
        <div className="flex items-center gap-2 cursor-pointer">
          <div className="text-right max-md:hidden">
            <p className="text-xs font-bold text-[var(--color-text-primary)] leading-tight">{teacher?.name || '...'}</p>
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{teacher?.schoolName || ''}</p>
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
