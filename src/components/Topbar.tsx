/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useMemo, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { useTeacher, useTeacherCollections } from '../contexts/TeacherContext';
import { formatPersianNumber } from '../utils/persian';
import { Cut } from './Cut';
import { usePersistentPreference } from '../hooks/usePersistentPreference';
import CommandPalette from './CommandPalette';
import { buildNotificationItems } from './topbar/notifications';
import type { NotificationItem } from './topbar/notifications';
import { useTopbarScrollVeil } from './topbar/useTopbarScrollVeil';
import { useTopbarPanels } from './topbar/useTopbarPanels';
import { buildNotificationStyle, buildHamburgerDropdownStyle } from './topbar/positioning';
import { TheMarkHamburger } from './topbar/TheMarkHamburger';
import { HamburgerPanels } from './topbar/HamburgerPanels';
import { TopbarSearchPill } from './topbar/TopbarSearchPill';
import { NotificationRow } from './topbar/NotificationRow';

interface TopbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  onSelectExamForResults?: (examId: string) => void;
}

export type { NotificationItem } from './topbar/notifications';

export default function Topbar({
  currentTab,
  onTabChange,
  onLogout,
  onSelectExamForResults,
}: TopbarProps) {
  const { teacher } = useTeacher();
  const { exams, submissions, status, reload } = useTeacherCollections();
  const [hamburgerHover, setHamburgerHover] = useState(false);
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
  const avatarLeaveTimer = useRef<number | null>(null);

  const topScrolled = useTopbarScrollVeil();

  const {
  showNotifications,
  showHamburgerMenu,
  menuClosing,
  notifClosing,
  bellRect,
  hamburgerRect,
  bellRef,
  notifRef,
  hamburgerRef,
  hamburgerDropdownRef,
  openHamburgerMenu,
  closeMenu,
  openNotifications,
  closeNotifications,
  } = useTopbarPanels(reload);

  const notifications = useMemo<NotificationItem[]>(
  () =>
  buildNotificationItems(
  exams,
  submissions,
  submissionNotifications,
  examNotifications,
  onSelectExamForResults,
  ),
  [examNotifications, exams, onSelectExamForResults, submissionNotifications, submissions],
  );

  const unreadCount = notifications.filter((item) => !readNotificationIds.includes(item.id)).length;

  // Notification dropdown position (fixed, anchored to bell) + hamburger
  // dropdown position — computed in ./topbar/positioning (moved verbatim).
  const notificationStyle = buildNotificationStyle(bellRect);
  const hamburgerDropdownStyle = buildHamburgerDropdownStyle(hamburgerRect);

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
                className="absolute top-1.5 right-1.5 flex items-center justify-center text-micro text-[var(--color-text-on-solid)] bg-[var(--color-danger-solid)] rounded-full ring-2 ring-[var(--color-surface)]"
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

  <TopbarSearchPill
  showHamburgerMenu={showHamburgerMenu}
  setCommandPaletteOpen={setCommandPaletteOpen}
  />
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
  <HamburgerPanels
  menuClosing={menuClosing}
  currentTab={currentTab}
  onTabChange={onTabChange}
  onLogout={onLogout}
  closeMenu={closeMenu}
  hamburgerRect={hamburgerRect}
  />
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
                    <NotificationRow
                      key={n.id}
                      n={n}
                      readNotificationIds={readNotificationIds}
                      setReadNotificationIds={setReadNotificationIds}
                      closeNotifications={closeNotifications}
                    />
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
