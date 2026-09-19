/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Bell } from 'lucide-react';
import { useTeacher } from '../contexts/TeacherContext';
import { formatPersianDate, formatPersianNumber } from '../services/persianHelpers';
import { gradingService, examService } from '../services/api';
import { Exam, Submission } from '../types';
import { logger } from '../lib/logger';
import { TheMark } from './TheMark';

interface TopbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
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

// TheMark Hamburger — four rounded pills stacked vertically, 3rd gold-filled
function TheMarkHamburger({ size = 48, isHovered = false }: { size?: number; isHovered?: boolean }) {
  const ink = 'var(--color-ink, #221E4A)';
  const gold = 'var(--color-gold, #F5B301)';
  const baseScale = isHovered ? 1.1 : 1;       // pills expand on hover
  const pillWidth = size * 0.65 * baseScale;   // horizontal bar width
  const pillHeight = size * 0.10 * baseScale;  // bar thickness (thinner)
  const gap = (size - pillHeight * 4) / 3 * 0.5;  // pills closer together
  const x = (size - pillWidth * baseScale) / 2;
  const rx = pillHeight / 2.5;                 // rounded corners
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Pill 1 — ink ring */ }
      <rect
        x={x}
        y={gap * 0 + pillHeight * 0}
        width={pillWidth}
        height={pillHeight}
        rx={rx}
        stroke={ink}
        strokeWidth={size * 0.035}
      />
      {/* Pill 2 — ink ring */ }
      <rect
        x={x}
        y={gap * 1 + pillHeight * 1}
        width={pillWidth}
        height={pillHeight}
        rx={rx}
        stroke={ink}
        strokeWidth={size * 0.035}
      />
      {/* Pill 3 — gold filled */ }
      <rect
        x={x}
        y={gap * 2 + pillHeight * 2}
        width={pillWidth}
        height={pillHeight}
        rx={rx}
        fill={gold}
      />
      {/* Pill 4 — ink ring */ }
      <rect
        x={x}
        y={gap * 3 + pillHeight * 3}
        width={pillWidth}
        height={pillHeight}
        rx={rx}
        stroke={ink}
        strokeWidth={size * 0.035}
      />
    </svg>
  );
}

export default function Topbar({
  currentTab,
  onTabChange,
  onSwitchRole,
  onLogout,
  onSelectExamForResults,
}: TopbarProps) {
  const { teacher } = useTeacher();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [hamburgerHover, setHamburgerHover] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [avatarExpanded, setAvatarExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [bellRect, setBellRect] = useState<DOMRect | null>(null);
  const [hamburgerRect, setHamburgerRect] = useState<DOMRect | null>(null);
  const [notifClosing, setNotifClosing] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  // --- Notifications ---
  const notifRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const hamburgerDropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch real notifications
  useEffect(() => {
    const cancelled = false;
    const fetchNotifications = async () => {
      setLoadingNotifs(true);
      try {
        const submissions: Submission[] = await gradingService.getSubmissions();
        const exams: Exam[] = await examService.getExams();
        const activeExams = exams.filter((e) => e.status === 'active');
        const now = new Date();

        const items: NotificationItem[] = [];

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

  // --- Hamburger menu ---
  const openHamburgerMenu = useCallback(() => {
    if (hamburgerRef.current) {
      setHamburgerRect(hamburgerRef.current.getBoundingClientRect());
    }
    setShowNotifications(false);
    setShowHamburgerMenu(true);
  }, []);

  useEffect(() => {
    if (!showHamburgerMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowHamburgerMenu(false);
    };
    const onClick = (e: MouseEvent) => {
      if (
        hamburgerRef.current && !hamburgerRef.current.contains(e.target as Node) &&
        hamburgerDropdownRef.current && !hamburgerDropdownRef.current.contains(e.target as Node)
      ) {
        setShowHamburgerMenu(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onClick);
    };
  }, [showHamburgerMenu]);

  // Close notifications when avatar expands (bell gets pushed)
  const closeNotifications = useCallback(() => {
    setNotifClosing(true);
    setTimeout(() => {
      setShowNotifications(false);
      setBellRect(null);
    }, 400);
  }, []);

  useEffect(() => {
    if (avatarExpanded && showNotifications) {
      closeNotifications();
    }
  }, [avatarExpanded, showNotifications, closeNotifications]);

  // --- Notifications ---
  const openNotifications = useCallback(() => {
    if (bellRef.current) {
      setBellRect(bellRef.current.getBoundingClientRect());
    }
    setShowHamburgerMenu(false);
    setShowNotifications(true);
  }, []);

  useEffect(() => {
    if (!showNotifications) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeNotifications();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showNotifications, closeNotifications]);

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
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showNotifications, closeNotifications]);

  const unreadCount = notifications.length;

  // Notification dropdown position (fixed, anchored to bell — on left side, so use left)
  const notificationStyle: React.CSSProperties = { position: 'fixed' };
  if (bellRect) {
    const dropdownWidth = 320;
    const gap = 12;
    const top = bellRect.bottom + gap;
    notificationStyle.left = `${bellRect.left + window.scrollX}px`;
    notificationStyle.top = `${top}px`;
    notificationStyle.width = `${dropdownWidth}px`;
  }

  // Hamburger dropdown position (fixed, anchored to hamburger button)
  const hamburgerTop = hamburgerRect ? hamburgerRect.bottom + 12 + window.scrollY : 0;
  const hamburgerRight = hamburgerRect ? window.innerWidth - hamburgerRect.right + window.scrollX : 0;
  const hamburgerDropdownStyle: React.CSSProperties = {
    position: 'fixed',
    right: `${hamburgerRight}px`,
    top: `${hamburgerTop}px`,
    width: '280px',
  };

  // Panel offset — each panel drops below the previous one
  const panelGap = 12; // px between panels
  // Estimated panel heights for stacking (actual content may vary slightly)
  const panelHeights = [95, 85, 125, 180];
  const computePanelTop = (index: number) => {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += panelHeights[i] + panelGap;
    }
    return `${hamburgerTop + offset}px`;
  };

  return (
    <header
      className="sticky top-0 z-30 h-14 px-4 lg:px-8 flex items-center justify-between select-none flex-row-reverse bg-transparent"
      id="topbar-wrapper"
    >
      {/* LEFT SIDE: Bell then Avatar */ }
      <div className={`flex items-center gap-3 ${showHamburgerMenu ? 'opacity-40' : ''}`} id="topbar-left-group">
        {/* Bell */ }
        <div className="transition-all duration-500 ease-out">
          <button
            ref={bellRef}
            id="notifications-bell-btn"
            onClick={() => !showHamburgerMenu && openNotifications()}
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
                aria-label={`${unreadCount} اعلان خوانه‌نشده`}
              >
                {formatPersianNumber(unreadCount > 9 ? '9+' : unreadCount.toString())}
              </span>
            )}
          </button>
        </div>

        {/* Avatar pill — pic absolutely pinned (never moves), only pill width animates */ }
        <div className="relative flex items-center">
          <div
            className={`relative h-10 rounded-full overflow-hidden glx-strong cursor-pointer transition-[width] duration-500 ease-out ${
              avatarExpanded ? 'w-[200px]' : 'w-10'
            }`}
            onMouseEnter={() => !showHamburgerMenu && setAvatarExpanded(true)}
            onMouseLeave={() => {
              setTimeout(() => {
                if (!showHamburgerMenu) setAvatarExpanded(false);
              }, 200);
            }}
          >
            {/* Pic — absolute, pinned left-1/top-1: centered in collapsed 40px pill, stays put when expanded */ }
            <div
              className="absolute left-1 top-1 w-8 h-8 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center text-[var(--color-accent)] font-bold overflow-hidden"
              onClick={() => setAvatarExpanded(!avatarExpanded)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setAvatarExpanded(!avatarExpanded);
                }
              }}
              aria-label={teacher?.name || 'پروفایل'}
            >
              {teacher?.avatarUrl ? (
                <img
                  src={teacher.avatarUrl}
                  alt={teacher.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs">
                  {teacher?.name?.[0] || '?'}
                </span>
              )}
            </div>

            {/* Name panel — absolute, fade only (no width/layout change, zero pic movement) */ }
            <div
              className={`absolute left-[42px] top-1/2 -translate-y-1/2 transition-opacity duration-500 ease-out ${
                avatarExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              style={{ direction: 'rtl', textAlign: 'right' }}
            >
              <p className="text-xs font-bold text-[var(--color-text-primary)] truncate max-w-[140px]">
                {teacher?.name || '...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Search + Hamburger */ }
      <div className={`flex items-center gap-3 ${showHamburgerMenu ? 'opacity-40' : ''}`} id="topbar-right-group">
        {/* TheMark Hamburger — rightmost */ }
        <button
          ref={hamburgerRef}
          id="hamburger-menu-btn"
          onClick={openHamburgerMenu}
          onMouseEnter={() => setHamburgerHover(true)}
          onMouseLeave={() => setHamburgerHover(false)}
          className="p-2 rounded-xl hover:bg-white/5 transition-all duration-300 cursor-pointer flex items-center justify-center w-11 h-11"
          aria-label="منوی اصلی"
          aria-expanded={showHamburgerMenu}
          aria-haspopup="true"
        >
          <TheMarkHamburger size={32} isHovered={hamburgerHover} />
        </button>

        {/* Search — smooth pill expand from icon */ }
        <div
          ref={searchRef}
          className={`relative flex items-center overflow-hidden rounded-full transition-all duration-500 ease-out ${
            showSearch
              ? 'w-[200px] glx-inset'
              : 'w-11 glx-inset'
          }`}
          onMouseEnter={() => !showHamburgerMenu && setShowSearch(true)}
          onMouseLeave={() => !showHamburgerMenu && setShowSearch(false)}
        >
          <button
            id="search-toggle-btn"
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-full hover:bg-[var(--color-glass-light-stroke)]/20 transition-all duration-300 cursor-pointer flex items-center justify-center w-11 h-11 flex-shrink-0"
            aria-label="جستجو"
            aria-expanded={showSearch}
            style={{ marginRight: showSearch ? '-1px' : '0' }}
          >
            <Search className="w-4.5 h-4.5" />
          </button>
          {showSearch && (
            <input
              type="text"
              id="global-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو..."
              className="outline-none bg-transparent text-xs md:text-sm w-full text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] pr-2"
            />
          )}
        </div>
      </div>

      {/* Hamburger Dropdown — 4 separate glass panels dropping in sequence */ }
      {showHamburgerMenu && (
        <>
          {/* Backdrop — blocks interaction with underlying UI, full blur */ }
          <div
            className="fixed inset-0 z-[55] bg-black/10 backdrop-blur-sm"
            onClick={() => setShowHamburgerMenu(false)}
          />

          {/* All panels container (for click-outside detection) */ }
          <div ref={hamburgerDropdownRef}>
            {/* Panel 1: App info + date */ }
          <div
            className="fixed z-[60] glx-strong rounded-2xl shadow-2xl"
            style={{
              ...hamburgerDropdownStyle,
              top: computePanelTop(0),
              animation: 'dropIn 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) 0ms both',
            }}
            id="hamburger-panel-1"
          >
            <div className="p-3 min-w-[240px]">
              <div className="flex items-center gap-3">
                <TheMark variant="row" size={36} animated={false} />
                <div>
                  <p className="text-xs font-bold text-[var(--color-text-primary)]">آزمون‌ساز</p>
                  <p className="text-[9px] text-[var(--color-text-secondary)]">پنل مدیریت دبیران</p>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-[var(--color-text-tertiary)]">
                {formatPersianDate(new Date().toISOString())}
              </div>
            </div>
          </div>

          {/* Panel 2: Teacher profile */ }
          <div
            className="fixed z-[60] glx-strong rounded-2xl shadow-2xl"
            style={{
              ...hamburgerDropdownStyle,
              top: computePanelTop(1),
              animation: 'dropIn 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) 80ms both',
            }}
            id="hamburger-panel-2"
          >
            <div className="p-3 min-w-[240px]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center overflow-hidden">
                  {teacher?.avatarUrl ? (
                    <img
                      src={teacher.avatarUrl}
                      alt={teacher.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-[var(--color-accent)] font-bold">
                      {teacher?.name?.[0] || '?'}
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                    {teacher?.name || '...'}
                  </p>
                  <p className="text-[9px] text-[var(--color-text-secondary)] truncate">
                    {teacher?.schoolName || ''}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Panel 3: Management options */ }
          <div
            className="fixed z-[60] glx-strong rounded-2xl shadow-2xl"
            style={{
              ...hamburgerDropdownStyle,
              top: computePanelTop(2),
              animation: 'dropIn 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) 160ms both',
            }}
            id="hamburger-panel-3"
          >
            <div className="p-3 min-w-[240px]">
              <div
                className={`flex items-center gap-3 p-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-300 ${
                  currentTab === 'dashboard'
                    ? 'bg-[var(--color-gold)]/20 text-[var(--color-text-primary)] shadow-inner'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-gold)]/8 hover:text-[var(--color-text-primary)]'
                }`}
                onClick={() => { onTabChange('dashboard'); setShowHamburgerMenu(false); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onTabChange('dashboard');
                    setShowHamburgerMenu(false);
                  }
                }}
              >
                <span>داشبورد مدیریتی</span>
              </div>
              <div
                className="flex items-center gap-3 p-2.5 rounded-lg text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-gold)]/8 hover:text-[var(--color-text-primary)] cursor-pointer transition-all duration-300"
                onClick={() => { onTabChange('students'); setShowHamburgerMenu(false); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onTabChange('students');
                    setShowHamburgerMenu(false);
                  }
                }}
              >
                <span>دانش‌آموزان</span>
              </div>
              <div
                className="flex items-center gap-3 p-2.5 rounded-lg text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-gold)]/8 hover:text-[var(--color-text-primary)] cursor-pointer transition-all duration-300"
                onClick={() => { onTabChange('classes'); setShowHamburgerMenu(false); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onTabChange('classes');
                    setShowHamburgerMenu(false);
                  }
                }}
              >
                <span>کلاس‌ها</span>
              </div>
            </div>
          </div>

          {/* Panel 4: Exam panel + settings */ }
          <div
            className="fixed z-[60] glx-strong rounded-2xl shadow-2xl"
            style={{
              ...hamburgerDropdownStyle,
              top: computePanelTop(3),
              animation: 'dropIn 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) 240ms both',
            }}
            id="hamburger-panel-4"
          >
            <div className="p-3 min-w-[240px]">
              <div
                className="flex items-center gap-3 p-2.5 rounded-lg text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-gold)]/8 hover:text-[var(--color-text-primary)] cursor-pointer transition-all duration-300"
                onClick={() => { onTabChange('questions'); setShowHamburgerMenu(false); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onTabChange('questions');
                    setShowHamburgerMenu(false);
                  }
                }}
              >
                <span>بانک سوالات</span>
              </div>
              <div
                className="flex items-center gap-3 p-2.5 rounded-lg text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-gold)]/8 hover:text-[var(--color-text-primary)] cursor-pointer transition-all duration-300"
                onClick={() => { onTabChange('exams'); setShowHamburgerMenu(false); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onTabChange('exams');
                    setShowHamburgerMenu(false);
                  }
                }}
              >
                <span>آزمون‌ها</span>
              </div>
              <div
                className="flex items-center gap-3 p-2.5 rounded-lg text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-gold)]/8 hover:text-[var(--color-text-primary)] cursor-pointer transition-all duration-300"
                onClick={() => { onSwitchRole(); setShowHamburgerMenu(false); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSwitchRole();
                    setShowHamburgerMenu(false);
                  }
                }}
              >
                <span>بخش دانش‌آموزی</span>
              </div>
              <div
                className="flex items-center gap-3 p-2.5 rounded-lg text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 cursor-pointer transition-all duration-300"
                onClick={() => { onLogout(); setShowHamburgerMenu(false); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onLogout();
                    setShowHamburgerMenu(false);
                  }
                }}
              >
                <span>خروج از سامانه</span>
              </div>
            </div>
          </div>
          </div>
        </>
      )}

      {/* Notifications Dropdown — animates from bell origin */ }
      {(showNotifications || notifClosing) && (
        <div
          ref={notifRef}
          className={`fixed glx-strong rounded-2xl shadow-2xl z-[60] overflow-hidden glx-sheen ${
            notifClosing ? 'notification-shrink' : 'notification-grow'
          }`}
          style={{
            ...notificationStyle,
            // Scale animates from bell center. Bell is above dropdown, left-aligned.
            // transformOrigin computed relative to dropdown element:
            // X = bell center X - dropdown left = bellWidth/2 (since dropdown.left = bellRect.left)
            // Y = bell center Y - dropdown top = (bellRect.top + bellHeight/2) - (bellRect.bottom + 12)
            //   = -bellHeight/2 - 12 (negative = above element)
            transformOrigin: bellRect
              ? `${bellRect.width / 2}px ${-bellRect.height / 2 - 12}px`
              : 'center',
            animation: notifClosing
              ? 'shrinkToBell 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) both'
              : 'growFromBell 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) both',
          }}
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
    </header>
  );
}
