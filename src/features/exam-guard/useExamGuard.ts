import { useEffect, useMemo, useState } from 'react';

/**
 * Wave A (exam hardening): client-side deterrence for the taking phase.
 *
 * Every counter here is a *deterrent signal*, not a security boundary — the
 * student controls their device (browsers expose no screenshot API, so the
 * watermark + these blocks are attribution/copy prevention, not a wall).
 * Counters are surfaced in the UI as a warning and are intended to be
 * reported server-side (Wave B/C) as teacher-visible proctor flags.
 * No PII is collected — counters only (F-21 lesson).
 */
export type GuardFlags = {
  tabHidden: number;
  windowBlur: number;
  copyAttempt: number;
  contextMenu: number;
  printAttempt: number;
  shortcutBlocked: number;
  fullscreenExit: number;
};

const ZERO_FLAGS: GuardFlags = {
  tabHidden: 0,
  windowBlur: 0,
  copyAttempt: 0,
  contextMenu: 0,
  printAttempt: 0,
  shortcutBlocked: 0,
  fullscreenExit: 0,
};

const CLIPBOARD_SHORTCUTS = new Set(['c', 'x', 'u', 's', 'p']);
const DEVTOOLS_SHORTCUTS = new Set(['i', 'j', 'c']);

export function useExamGuard(active: boolean) {
  const [flags, setFlags] = useState<GuardFlags>(ZERO_FLAGS);

  const bump = useMemo(
    () => (key: keyof GuardFlags) => setFlags((prev) => ({ ...prev, [key]: prev[key] + 1 })),
    [],
  );

  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    // Drives the @media print kill-switch in index.css while an exam is live.
    html.classList.add('exam-guard-active');

    const stop = (event: Event) => event.preventDefault();
    const onCopyAttempt = (event: Event) => {
      bump('copyAttempt');
      event.preventDefault();
    };
    const onContextMenu = (event: Event) => {
      bump('contextMenu');
      event.preventDefault();
    };
    const onSelectStart = stop;

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      // F5 / Ctrl+R / Ctrl+L stay allowed — refresh and navigation are not
      // attacks, and browsers ignore preventDefault on them anyway.
      const blocked =
        key === 'f12' ||
        key === 'printscreen' ||
        (modifier && !event.altKey && CLIPBOARD_SHORTCUTS.has(key)) ||
        (modifier && event.shiftKey && DEVTOOLS_SHORTCUTS.has(key));
      if (!blocked) return;
      // Count it, but note browsers cannot stop OS-level PrintScreen —
      // preventDefault only matters for the in-page shortcuts.
      event.preventDefault();
      bump('shortcutBlocked');
    };

    const onVisibility = () => {
      if (document.hidden) bump('tabHidden');
    };
    const onBlur = () => bump('windowBlur');
    const onBeforePrint = () => {
      bump('printAttempt');
      // Printing is additionally killed by CSS (.exam-guard-active).
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) bump('fullscreenExit');
    };

    document.addEventListener('copy', onCopyAttempt);
    document.addEventListener('cut', onCopyAttempt);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('selectstart', onSelectStart);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('blur', onBlur);
    window.addEventListener('beforeprint', onBeforePrint);

    return () => {
      html.classList.remove('exam-guard-active');
      document.removeEventListener('copy', onCopyAttempt);
      document.removeEventListener('cut', onCopyAttempt);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('selectstart', onSelectStart);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('beforeprint', onBeforePrint);
    };
  }, [active, bump]);

  const total = useMemo(
    () => Object.values(flags).reduce((sum, count) => sum + count, 0),
    [flags],
  );

  return { flags, total };
}
