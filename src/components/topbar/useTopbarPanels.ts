/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Hamburger menu + notifications panel state machine for the Topbar:
 * open/close/escape/outside-click/focus-restore/poll behaviors.
 *
 * Extracted verbatim from src/components/Topbar.tsx.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CollectionKey } from '../../contexts/TeacherContext';

export function useTopbarPanels(reload: (key: CollectionKey) => Promise<void>) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [bellRect, setBellRect] = useState<DOMRect | null>(null);
  const [hamburgerRect, setHamburgerRect] = useState<DOMRect | null>(null);
  const [notifClosing, setNotifClosing] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

 // --- Notifications ---
  const notifRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const hamburgerDropdownRef = useRef<HTMLDivElement>(null);

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

  // Focus restore — when the menu finishes closing, keyboard users land back
  // on the trigger instead of body. Effect, not timeout body: the refs rule
  // forbids ref access inside callbacks treated as render-time. The was-open
  // ref guards mount (both flags start false — no steal on page load).
  const menuWasOpen = useRef(false);
  useEffect(() => {
    if (showHamburgerMenu || menuClosing) {
      menuWasOpen.current = true;
      return;
    }
    if (menuWasOpen.current) {
      menuWasOpen.current = false;
      hamburgerRef.current?.focus();
    }
  }, [showHamburgerMenu, menuClosing]);

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

  // Focus restore — same pattern as the hamburger menu above.
  const notifWasOpen = useRef(false);
  useEffect(() => {
    if (showNotifications || notifClosing) {
      notifWasOpen.current = true;
      return;
    }
    if (notifWasOpen.current) {
      notifWasOpen.current = false;
      bellRef.current?.focus();
    }
  }, [showNotifications, notifClosing]);

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

 return {
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
 };
}
