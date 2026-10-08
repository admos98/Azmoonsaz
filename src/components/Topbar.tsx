/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, Bell, X } from 'lucide-react';
import { useTeacher, useTeacherCollections } from '../contexts/TeacherContext';
import { formatPersianNumber } from '../services/persianHelpers';
import { TheMark } from './TheMark';
import { Cut } from './Cut';
import { usePersistentPreference } from '../hooks/usePersistentPreference';
import CommandPalette from './CommandPalette';

interface TopbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
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

// TheMark Hamburger — four rounded pills stacked vertically, 3rd gold-filled.
// When open, the pills form the brand X IN PLACE: the three ink rings travel to
// center and land inside one another as the hollow "/" arm, the gold pill swings
// into the solid "\" arm — the menu lines literally become the close button.
function TheMarkHamburger({
  size = 48,
  isHovered = false,
  isOpen = false,
}: {
  size?: number;
  isHovered?: boolean;
  isOpen?: boolean;
}) {
  const ink = 'var(--color-ink, #221E4A)';
  const gold = 'var(--color-gold, #F5B301)';
  const baseScale = isHovered && !isOpen ? 1.1 : 1; // pills expand on hover
  const pillWidth = size * 0.65 * baseScale; // horizontal bar width
  const pillHeight = size * 0.1 * baseScale; // bar thickness (thinner)
  const gap = ((size - pillHeight * 4) / 3) * 0.5; // pills closer together
  const x = (size - pillWidth * baseScale) / 2;
  const rx = pillHeight / 2.5; // rounded corners
  const stretch = 0.74 / 0.65; // pill width -> full X-arm length
  // opening morphs at 0.5s; CLOSING must beat the menu's 0.22s shrink-to-
  // hamburger, or the X keeps unwinding after the panels are already gone
  const morph = isOpen
    ? 'transform 0.5s cubic-bezier(0.25, 1, 0.35, 1)'
    : 'transform 0.2s cubic-bezier(0.25, 1, 0.35, 1)';
  const armAt = (i: number, angle: number) => ({
    transformBox: 'fill-box' as const,
    transformOrigin: 'center',
    transition: morph,
    transform: isOpen
      ? `translateY(${size / 2 - ((gap + pillHeight) * i + pillHeight / 2)}px) rotate(${angle}deg) scaleX(${stretch})`
      : 'none',
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Pill 1 — ink ring → "/" arm */}
      <rect
        x={x}
        y={gap * 0 + pillHeight * 0}
        width={pillWidth}
        height={pillHeight}
        rx={rx}
        stroke={ink}
        strokeWidth={size * 0.035}
        style={armAt(0, -45)}
      />
      {/* Pill 2 — ink ring → "/" arm (lands inside pill 1) */}
      <rect
        x={x}
        y={gap * 1 + pillHeight * 1}
        width={pillWidth}
        height={pillHeight}
        rx={rx}
        stroke={ink}
        strokeWidth={size * 0.035}
        style={armAt(1, -45)}
      />
      {/* Pill 3 — gold filled → "\" arm */}
      <rect
        x={x}
        y={gap * 2 + pillHeight * 2}
        width={pillWidth}
        height={pillHeight}
        rx={rx}
        fill={gold}
        style={armAt(2, 45)}
      />
      {/* Pill 4 — ink ring → "/" arm (lands inside the others) */}
      <rect
        x={x}
        y={gap * 3 + pillHeight * 3}
        width={pillWidth}
        height={pillHeight}
        rx={rx}
        stroke={ink}
        strokeWidth={size * 0.035}
        style={armAt(3, -45)}
      />
    </svg>
  );
}

export default function Topbar({
  currentTab,
  onTabChange,
  onLogout,
  onSelectExamForResults,
}: TopbarProps) {
  const { teacher } = useTeacher();
  const { exams, submissions, status, reload } = useTeacherCollections();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [hamburgerHover, setHamburgerHover] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [avatarExpanded, setAvatarExpanded] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const loadingNotifs = status.submissions === 'loading';
  const [submissionNotifications] = usePersistentPreference('notifications:submissions', true);
  const [examNotifications] = usePersistentPreference('notifications:active-exams', true);
  const [readNotificationIds, setReadNotificationIds] = usePersistentPreference<string[]>(
    'notifications:read',
    [],
    (value): value is string[] =>
      Array.isArray(value) && value.every((item) => typeof item === 'string'),
  );
  const [bellRect, setBellRect] = useState<DOMRect | null>(null);
  const [hamburgerRect, setHamburgerRect] = useState<DOMRect | null>(null);
  const [notifClosing, setNotifClosing] = useState(false);
  const [topScrolled, setTopScrolled] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const avatarLeaveTimer = useRef<number | null>(null);

  // Top veil — iOS nav-bar behavior: while content scrolls UNDER the floating
  // topbar, a page-colored gradient fades in behind it so the icons never
  // collide with passing text (the crop the user sent). At rest it is fully
  // transparent, so the hero composition at scrollY=0 is untouched. One
  // passive listener, rAF-gated, keyed on a boolean — no re-render churn.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        setTopScrolled(window.scrollY > 24);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // --- Notifications ---
  const notifRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const hamburgerDropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLButtonElement>(null);

  // Notifications are pure derivations of the shared collections cache —
  // no private fetch, no setState-in-effect. Freshness: one submissions
  // reload when the panel opens plus a 60s poll while it stays open (the
  // exact cadence the old private poll used, but now every other consumer
  // benefits from the refreshed cache too).
  useEffect(() => {
    if (!showNotifications) return;
    void reload('submissions');
    const timer = setInterval(() => void reload('submissions'), 60000);
    return () => clearInterval(timer);
  }, [reload, showNotifications]);

  const notifications = useMemo<NotificationItem[]>(() => {
    const activeExams = exams.filter((e) => e.status === 'active');
    const now = new Date();

    const items: NotificationItem[] = [];

    const ungraded = submissions
      .filter((s) => s.status === 'submitted' || s.status === 'ongoing')
      .sort(
        (a, b) =>
          new Date(b.submittedAt || b.startedAt).getTime() -
          new Date(a.submittedAt || a.startedAt).getTime(),
      );

    ungraded.slice(0, 6).forEach((s) => {
      const when = new Date(s.submittedAt || s.startedAt);
      const mins = Math.floor((now.getTime() - when.getTime()) / 60000);
      const timeAgo = mins < 60 ? `${mins} دقیقه پیش` : `${Math.floor(mins / 60)} ساعت پیش`;
      items.push({
        id: `sub-${s.id}`,
        title: `پاسخ‌برگ «${s.studentName}»`,
        description:
          s.status === 'submitted'
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

    return items.filter(
      (item) =>
        (item.type === 'exam' && examNotifications) ||
        (item.type !== 'exam' && submissionNotifications),
    );
  }, [examNotifications, exams, onSelectExamForResults, submissionNotifications, submissions]);

  // --- Hamburger menu ---
  const openHamburgerMenu = useCallback(() => {
    if (hamburgerRef.current) {
      setHamburgerRect(hamburgerRef.current.getBoundingClientRect());
    }
    setShowNotifications(false);
    setShowHamburgerMenu(true);
    setMenuClosing(false);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuClosing(true);
    setTimeout(() => {
      setShowHamburgerMenu(false);
      setMenuClosing(false);
    }, 230);
  }, []);

  useEffect(() => {
    if (!showHamburgerMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    const onClick = (e: MouseEvent) => {
      if (
        !menuClosing &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(e.target as Node) &&
        hamburgerDropdownRef.current &&
        !hamburgerDropdownRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onClick);
    };
  }, [showHamburgerMenu]); // eslint-disable-line react-hooks/exhaustive-deps -- onKey/onClick are recreated each render intentionally

  // Close notifications when avatar expands (bell gets pushed)
  const closeNotifications = useCallback(() => {
    setNotifClosing(true);
    setTimeout(() => {
      setShowNotifications(false);
      setBellRect(null);
      setNotifClosing(false);
    }, 230);
  }, []);

  // --- Notifications ---
  const openNotifications = useCallback(() => {
    setNotifClosing(false);
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

  const unreadCount = notifications.filter((item) => !readNotificationIds.includes(item.id)).length;

  // Notification dropdown position (fixed, anchored to bell — on left side, so use left)
  const notificationStyle: React.CSSProperties = { position: 'fixed' };
  if (bellRect) {
    const dropdownWidth = 320;
    const gap = 12;
    // getBoundingClientRect() is VIEWPORT-relative and `position: fixed`
    // resolves against the viewport (the header is plain `sticky` — no
    // transform/filter ancestor re-anchors fixed), so the coordinates are used
    // AS-IS. The old `+ window.scrollY/scrollX` double-counted the scroll: the
    // sticky header keeps the button at viewport top, so scrolled down S px the
    // panel rendered S px too low — "the menu opens down or on center instead
    // of top" (user report). The earlier 'match the hamburger' scroll
    // compensation above was written for a since-removed transformed ancestor.
    const top = bellRect.bottom + gap;
    notificationStyle.left = `${bellRect.left}px`;
    notificationStyle.top = `${top}px`;
    notificationStyle.width = `${dropdownWidth}px`;
  }

  // Hamburger dropdown position (fixed, anchored to hamburger button) —
  // viewport coordinates, no scroll compensation (see notification note).
  const hamburgerTop = hamburgerRect ? hamburgerRect.bottom + 12 : 0;
  const hamburgerRight = hamburgerRect ? window.innerWidth - hamburgerRect.right : 0;
  const hamburgerDropdownStyle: React.CSSProperties = {
    position: 'fixed',
    right: `${hamburgerRight}px`,
    top: `${hamburgerTop}px`,
    width: '280px',
  };

  // Panels now FLOW inside one fixed container (flex column) — the old
  // estimated-heights stacking (panelHeights + computePanelTop) drifted from
  // real content, leaving dead space and overlaps (pics audit #10).
  const panelGap = 12; // px between panels
  // Transform origin relative to each panel: hamburger button center.
  // The button is above the container by hamburgerRect.height/2 + 12 (gap).
  const panelWidth = 280;
  const computeHamburgerTransformOrigin = (index: number) => {
    if (!hamburgerRect) return 'center top';
    const originX = `${panelWidth - hamburgerRect.width / 2}px`;
    const offset = index === 0 ? 0 : index * (panelGap + 4); // approximate offset for stacked panels
    const originY = `${-hamburgerRect.height / 2 - 12 - offset}px`;
    return `${originX} ${originY}`;
  };

  return (
    <header
      className={`sticky top-0 ${
        showHamburgerMenu || menuClosing || showNotifications || notifClosing ? 'z-[65]' : 'z-30'
      } h-14 px-4 lg:px-8 flex items-center justify-between select-none flex-row-reverse bg-transparent`}
      id="topbar-wrapper"
      data-scrolled={topScrolled ? 'on' : 'off'}
    >
      {/* LEFT SIDE: Avatar then Bell — the avatar's name panel PUSHES the bell
          aside when it slides out from behind the circle (iOS neighbor-push;
          the user: "the name panel should push the bell away"). RTL flex lays
          the group right-to-left: bell first = rightmost, avatar to its left. */}
      <div
        className={`flex items-center gap-3 ${showHamburgerMenu ? 'opacity-40' : ''}`}
        id="topbar-left-group"
      >
        {/* Bell — desktop: the name panel grows rightward under the bell zone,
            so the bell slides right clear of it while open (md: prefix —
            on touch there is no hover panel, the bell never moves).
            Transform only: no layout, no reflow; getBoundingClientRect for
            the dropdown anchor already includes transforms. */}
        <div
          className={`transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            avatarExpanded ? 'md:translate-x-[124px] lg:translate-x-[174px]' : 'translate-x-0'
          }`}
        >
          <button
            type="button"
            ref={bellRef}
            id="notifications-bell-btn"
            onClick={() => {
              if (showHamburgerMenu) return;
              if (showNotifications || notifClosing) {
                closeNotifications();
              } else {
                openNotifications();
              }
            }}
            className="btn-glass relative z-[60] grid h-11 w-11 md:h-10 md:w-10 place-items-center rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
            aria-label="اعلان‌ها"
            aria-expanded={showNotifications}
            aria-haspopup="true"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span
                className="absolute top-1.5 right-1.5 flex items-center justify-center text-micro font-bold text-[var(--color-text-on-solid)] bg-[var(--color-danger-solid)] rounded-full ring-2 ring-[var(--color-surface)]"
                style={{ width: '18px', height: '18px' }}
                aria-label={`${unreadCount} اعلان خوانه‌نشده`}
              >
                {formatPersianNumber(unreadCount > 9 ? '9+' : unreadCount.toString())}
              </span>
            )}
          </button>
        </div>

        {/* Avatar pill — now on EVERY viewport. On touch there is no hover:
            the circle button taps open/closed, exactly like desktop click. */}
        <div className="relative flex items-center">
          {/* Rest = a perfect circle button that HOLDS the name panel behind
              it; on hover (desktop) the panel slides out from behind the
              circle and merges back on leave. The circle never moves, never
              resizes. No hover on touch: the panel is desktop-only (hidden
              below md) and the avatar renders bigger instead. */}
          <div
            className="relative h-11 w-11 md:h-10 md:w-10 cursor-pointer"
            onMouseEnter={() => {
              // Clear any pending collapse — stacked mouseleave timers used to
              // re-close the pill right after a re-enter (hover flicker).
              if (avatarLeaveTimer.current) window.clearTimeout(avatarLeaveTimer.current);
              if (!showHamburgerMenu) {
                if (showNotifications) closeNotifications();
                setAvatarExpanded(true);
              }
            }}
            onMouseLeave={() => {
              avatarLeaveTimer.current = window.setTimeout(() => {
                if (!showHamburgerMenu) setAvatarExpanded(false);
              }, 200);
            }}
          >
            {/* Name panel — DESKTOP ONLY (hidden below md): no hover on touch,
                so mobile gets a bigger avatar instead of a broken panel.
                Grows rightward from the physical screen-left circle, under
                the bell zone; text hugs the circle (justify-end in RTL). */}
            <div
              className={`absolute top-0 left-[14px] h-10 rounded-full overflow-hidden pane transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hidden md:block ${
                avatarExpanded ? 'w-[150px] lg:w-[200px]' : 'w-0'
              }`}
            >
              <div
                className="absolute inset-y-0 left-[44px] right-[14px] flex items-center justify-end whitespace-nowrap"
                style={{ direction: 'rtl' }}
              >
                <p className="text-body font-bold text-[var(--color-text-primary)] truncate">
                  {teacher?.name || '...'}
                </p>
              </div>
            </div>

            {/* The circle — fixed location, perfectly centered content */}
            <button
              type="button"
              className="btn-glass absolute left-0 top-0 z-10 grid h-full w-full place-items-center rounded-full cursor-pointer overflow-hidden"
              onClick={() => {
                if (!avatarExpanded && showNotifications) closeNotifications();
                setAvatarExpanded(!avatarExpanded);
              }}
              aria-label={teacher?.name || 'پروفایل'}
              aria-expanded={avatarExpanded}
            >
              <span className="w-9 h-9 md:w-8 md:h-8 rounded-full bg-[var(--color-accent-solid)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center text-[var(--color-accent)] font-bold overflow-hidden">
                {teacher?.avatarUrl ? (
                  <img
                    loading="eager"
                    decoding="async"
                    src={teacher.avatarUrl}
                    alt={teacher.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-caption">{teacher?.name?.[0] || '?'}</span>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Search + Hamburger */}
      <div className="flex items-center gap-3" id="topbar-right-group">
        {/* TheMark Hamburger — rightmost */}
        <button
          type="button"
          ref={hamburgerRef}
          id="hamburger-menu-btn"
          onClick={() => {
            // The mark morphs into an X while open, so this must toggle.
            // An open-with-no-op left the X dead: the outside-click handler
            // deliberately excludes this button, so nothing else closed it.
            if (menuClosing) return;
            if (showHamburgerMenu) closeMenu();
            else openHamburgerMenu();
          }}
          onMouseEnter={() => setHamburgerHover(true)}
          onMouseLeave={() => setHamburgerHover(false)}
          className="btn-glass btn-glass--bare btn-glass--still relative z-[70] p-2 transition-colors duration-300 cursor-pointer flex items-center justify-center w-11 h-11 rounded-full"
          aria-label="منوی اصلی"
          aria-expanded={showHamburgerMenu}
          aria-haspopup="true"
        >
          <TheMarkHamburger size={32} isHovered={hamburgerHover} isOpen={showHamburgerMenu} />
        </button>

        {/* Search — a pill that opens the CommandPalette. Collapsed: a 44px
            icon. Hover/expand reveals a "جستجو" label; clicking anywhere on
            the pill opens the palette, which is the actual search field (the
            old in-pill input typed into a void). Same `drop` droplet
            material as the bell / menu icon buttons, no kbd hint. */}
        <div
          className="relative h-11 w-11"
          onMouseEnter={() => !showHamburgerMenu && setShowSearch(true)}
          onMouseLeave={() => !showHamburgerMenu && setShowSearch(false)}
        >
          {/* Label panel — pane glass that slides out from behind the circle
              and merges back into it on leave. The circle never moves. */}
          <div
            className={`absolute top-0 right-[14px] h-11 rounded-full overflow-hidden pane transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              showSearch ? 'w-[176px]' : 'w-0'
            }`}
          >
            <span
              className={`absolute inset-y-0 right-[46px] flex items-center whitespace-nowrap text-caption text-[var(--color-text-secondary)] transition-opacity duration-200 delay-150 ${
                showSearch ? 'opacity-100' : 'opacity-0'
              }`}
            >
              جستجو…
            </span>
          </div>
          <button
            type="button"
            ref={searchRef}
            className="btn-glass absolute right-0 top-0 z-10 grid h-11 w-11 place-items-center rounded-full cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="جستجو — باز کردن پالت فرمان‌ها"
            aria-expanded={showSearch}
          >
            <Search className="w-4.5 h-4.5 shrink-0" />
          </button>
        </div>
      </div>

      <CommandPalette
        onNavigate={onTabChange}
        open={commandPaletteOpen}
        setOpen={setCommandPaletteOpen}
        initialQuery=""
      />

      {/* Hamburger Dropdown — 4 separate glass panels dropping in sequence */}
      {(showHamburgerMenu || menuClosing) && (
        <>
          {/* Click-away catcher — fully transparent. NO dim, NO halo: iOS menus
              cast nothing on the page; separation comes from the panel's own
              blur + refracted rim. The div stays only to close on outside click. */}
          <div className="fixed inset-0 z-[55]" onClick={closeMenu} />

          {/* All panels container — one fixed anchor; panels FLOW inside it
              (flex column, real heights). No estimated stacking, no drift. */}
          <div
            ref={hamburgerDropdownRef}
            className="fixed z-[60] flex flex-col gap-3 contain-menu"
            style={hamburgerDropdownStyle}
          >
            {/* Panel 1: App info + date */}
            <div
              className="lens lens--menu rounded-2xl overflow-hidden"
              style={{
                transformOrigin: computeHamburgerTransformOrigin(0),
                animation: menuClosing
                  ? 'shrinkToHamburger 0.22s cubic-bezier(0.4, 0, 0.2, 1) 0ms both'
                  : 'growFromHamburger 0.32s cubic-bezier(0.22, 1, 0.36, 1) 0ms both',
              }}
              id="hamburger-panel-1"
            >
              <div className="p-3 min-w-[240px]">
                <div className="flex items-center gap-3">
                  <TheMark variant="row" size={36} animated={false} />
                  <div>
                    <p className="text-body font-extrabold text-[var(--color-text-primary)]">
                      آزمون‌ساز
                    </p>
                    <p className="text-caption text-[var(--color-text-secondary)]">
                      پنل مدیریت دبیران
                    </p>
                  </div>
                </div>
                {/* date dropped (1H): the hero already owns ۱۲ مهر ۱۴۰۵ —
                    showing it twice on one screen is noise, not info */}
              </div>
            </div>

            {/* Panel 2: Teacher profile */}
            <div
              className="lens lens--menu rounded-2xl overflow-hidden"
              style={{
                transformOrigin: computeHamburgerTransformOrigin(1),
                animation: menuClosing
                  ? 'shrinkToHamburger 0.22s cubic-bezier(0.4, 0, 0.2, 1) 0ms both'
                  : 'growFromHamburger 0.32s cubic-bezier(0.22, 1, 0.36, 1) 45ms both',
              }}
              id="hamburger-panel-2"
            >
              <button
                type="button"
                onClick={() => {
                  onTabChange('profile');
                  closeMenu();
                }}
                className="btn-glass btn-glass--bare p-3 min-w-[240px] w-full text-right cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[var(--color-accent-solid)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center overflow-hidden">
                    {teacher?.avatarUrl ? (
                      <img
                        loading="eager"
                        decoding="async"
                        src={teacher.avatarUrl}
                        alt={teacher.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-caption text-[var(--color-accent)] font-bold">
                        {teacher?.name?.[0] || '?'}
                      </span>
                    )}
                  </span>
                  <span className="flex-1 overflow-hidden block">
                    <span className="text-body font-bold text-[var(--color-text-primary)] truncate block">
                      {teacher?.name || '...'}
                    </span>
                    <span className="text-caption text-[var(--color-text-secondary)] truncate block">
                      {teacher?.schoolName || ''}
                    </span>
                  </span>
                </span>
              </button>
            </div>

            {/* Panel 3: Management options */}
            <div
              className="lens lens--menu rounded-2xl overflow-hidden"
              style={{
                transformOrigin: computeHamburgerTransformOrigin(2),
                animation: menuClosing
                  ? 'shrinkToHamburger 0.22s cubic-bezier(0.4, 0, 0.2, 1) 0ms both'
                  : 'growFromHamburger 0.32s cubic-bezier(0.22, 1, 0.36, 1) 90ms both',
              }}
              id="hamburger-panel-3"
            >
              <div className="p-3 min-w-[240px]">
                <button
                  type="button"
                  className={`w-full text-right flex items-center gap-3 p-2.5 rounded-lg text-label font-semibold cursor-pointer transition-all duration-300 ${
                    currentTab === 'dashboard'
                      ? 'btn-glass btn-glass--gold'
                      : 'btn-glass btn-glass--bare'
                  }`}
                  onClick={() => {
                    onTabChange('dashboard');
                    closeMenu();
                  }}
                >
                  <span>داشبورد مدیریتی</span>
                </button>
                <button
                  type="button"
                  className={`w-full text-right flex items-center gap-3 p-2.5 rounded-lg text-label font-semibold cursor-pointer transition-all duration-300 ${currentTab === 'profile' ? 'btn-glass btn-glass--gold' : 'btn-glass btn-glass--bare'}`}
                  onClick={() => {
                    onTabChange('profile');
                    closeMenu();
                  }}
                >
                  <span>پروفایل، دانش‌آموزان و کلاس‌ها</span>
                </button>
              </div>
            </div>

            {/* Panel 4: Exam panel + settings */}
            <div
              className="lens lens--menu rounded-2xl overflow-hidden"
              style={{
                transformOrigin: computeHamburgerTransformOrigin(3),
                animation: menuClosing
                  ? 'shrinkToHamburger 0.22s cubic-bezier(0.4, 0, 0.2, 1) 0ms both'
                  : 'growFromHamburger 0.32s cubic-bezier(0.22, 1, 0.36, 1) 135ms both',
              }}
              id="hamburger-panel-4"
            >
              <div className="p-3 min-w-[240px]">
                <button
                  type="button"
                  className={`w-full text-right flex items-center gap-3 p-2.5 rounded-lg text-label font-semibold cursor-pointer transition-all duration-300 ${
                    currentTab.startsWith('exams')
                      ? 'btn-glass btn-glass--gold'
                      : 'btn-glass btn-glass--bare'
                  }`}
                  onClick={() => {
                    onTabChange('exams');
                    closeMenu();
                  }}
                >
                  <span>آزمون‌ها</span>
                </button>
                <button
                  type="button"
                  className={`w-full text-right flex items-center gap-3 p-2.5 rounded-lg text-label font-semibold cursor-pointer transition-all duration-300 ${
                    currentTab === 'settings'
                      ? 'btn-glass btn-glass--gold'
                      : 'btn-glass btn-glass--bare'
                  }`}
                  onClick={() => {
                    onTabChange('settings');
                    closeMenu();
                  }}
                >
                  <span>تنظیمات</span>
                </button>
                <button
                  type="button"
                  className="w-full text-right flex items-center gap-3 p-2.5 rounded-lg text-label font-semibold btn-glass btn-glass--danger cursor-pointer transition-all duration-300"
                  onClick={() => {
                    onLogout();
                    closeMenu();
                  }}
                >
                  <span>خروج از سامانه</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Notifications Dropdown — animates from bell origin */}
      {(showNotifications || notifClosing) && (
        <>
          {/* Click-away catcher — transparent (no dim, no halo; same rule as the menu). */}
          <div className="fixed inset-0 z-[55]" onClick={closeNotifications} />
          <div className="fixed z-[60] @container contain-menu" style={notificationStyle}>
            <div
              ref={notifRef}
              className="relative w-full lens lens--menu rounded-2xl overflow-hidden"
              style={{
                transformOrigin: bellRect
                  ? `${bellRect.width / 2}px ${-bellRect.height / 2 - 12}px`
                  : 'center',
                animation: notifClosing
                  ? 'shrinkToBell 0.22s cubic-bezier(0.4, 0, 0.2, 1) both'
                  : 'growFromBell 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
              }}
              id="notification-dropdown"
            >
              <div className="p-3 flex items-center justify-between border-b border-[var(--color-glass-light-stroke)]">
                <span className="text-body font-bold text-[var(--color-text-primary)]">
                  اعلان‌ها
                </span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <span className="text-caption bg-[var(--color-accent-soft)] text-[var(--color-accent)] px-2 py-0.5 rounded-full font-bold">
                      {formatPersianNumber(unreadCount.toString())} جدید
                    </span>
                  )}
                  {/* Quiet close — Apple's notification chrome: a neutral glass
                      circle, not a danger button (the panel itself is the
                      dismissal affordance; X is a secondary convenience). */}
                  <button
                    type="button"
                    onClick={closeNotifications}
                    aria-label="بستن"
                    className="btn-glass btn-glass--danger modal-close grid h-8 w-8 place-items-center rounded-full cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto text-caption divide-y divide-[var(--color-glass-light-stroke)]">
                {loadingNotifs ? (
                  <div className="p-4 text-center text-[var(--color-text-secondary)]">
                    در حال بارگذاری...
                  </div>
                ) : notifications.length === 0 ? (
                  /* C.5: the bubble row at empty-state scale — neutral, not
                     absent (parent grammar: title/description carry it). */
                  <div className="p-6 flex flex-col items-center gap-3 text-center">
                    <Cut kind="questions" size={56} />
                    <p className="text-[var(--color-text-secondary)]">
                      هیچ اعلانی نیست.
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="btn-glass btn-glass--bare p-3 transition-colors cursor-pointer rounded-md mx-2 my-1"
                      role="button"
                      tabIndex={0}
                      aria-label={`${n.title}${readNotificationIds.includes(n.id) ? '، خوانده‌شده' : '، خوانده‌نشده'}`}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') event.currentTarget.click();
                      }}
                      onClick={() => {
                        setReadNotificationIds((current) =>
                          current.includes(n.id) ? current : [...current, n.id].slice(-100),
                        );
                        if (n.onClick) n.onClick();
                        closeNotifications();
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {!readNotificationIds.includes(n.id) && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]"
                            aria-hidden="true"
                          />
                        )}
                        <p className="text-body font-semibold text-[var(--color-text-primary)]">
                          {n.title}
                        </p>
                        <span
                          className={`mr-auto rounded-full px-2 py-0.5 text-caption font-bold ${n.type === 'exam' ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]' : 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'}`}
                        >
                          {n.type === 'exam' ? 'فوری' : 'اطلاع‌رسانی'}
                        </span>
                      </div>
                      <p className="text-caption text-[var(--color-text-secondary)] mt-1">
                        {n.description}
                      </p>
                      <span className="text-caption text-[var(--color-text-secondary)] mt-2 block">
                        {n.timeAgo}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* The X button in the header closes the panel — a bottom close
                  button duplicated it (user spec: X present → no bottom close). */}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
