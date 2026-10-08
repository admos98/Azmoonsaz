/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useOriginFromTrigger } from '../hooks/useOriginFromTrigger';

/* ==========================================
   8. MODAL COMPONENT
   ========================================== */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Optional icon rendered before the title inside the header */
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Tailwind max-w tokens: sm=md · md=lg · lg=2xl · 3xl=3xl · xl=4xl · 5xl=5xl */
  maxWidth?: 'sm' | 'md' | 'lg' | '3xl' | 'xl' | '5xl';
  /** 'center' (default): dialog / mobile bottom-sheet · 'side': full-height panel docked to the physical left edge */
  variant?: 'center' | 'side';
  /** Width classes for variant="side" (default 'max-w-xl') */
  sideWidth?: string;
  /** Replaces the default body classes (p-6 + scroll) — for custom layouts like two-pane editors */
  bodyClassName?: string;
  /** Replaces the default footer alignment (justify-end) — e.g. 'justify-between' */
  footerClassName?: string;
  /** Optional trigger button ref — modal animates from/into this button */
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  maxWidth = 'md',
  variant = 'center',
  sideWidth = 'max-w-xl border-r border-[var(--color-glass-light-stroke)]',
  bodyClassName,
  footerClassName,
  triggerRef,
}: ModalProps) => {
  const widthStyles: Record<NonNullable<ModalProps['maxWidth']>, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    '3xl': 'max-w-3xl',
    xl: 'max-w-4xl',
    '5xl': 'max-w-5xl',
  };
  const isSide = variant === 'side';

  const panelRef = useRef<HTMLDivElement>(null);
  // The old area-blur halo is gone (painted shadow — removed). The hook's
  // companion slot stays unthreaded: it null-guards a missing ref.
  const [originStyle] = useOriginFromTrigger(triggerRef, panelRef, isOpen);

  // F-9: lock background scroll while the dialog is open (mobile browsers
  // otherwise rubber-band the page behind a bottom-sheet). Saves and restores
  // the exact previous value, so nested dialogs unwind correctly.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    const trigger = triggerRef?.current;
    panel?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      trigger?.focus();
    };
  }, [isOpen, onClose, triggerRef]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={`fixed inset-0 z-50 ${isSide ? '' : 'flex items-end justify-center p-0 sm:items-center sm:p-4'}`}
        >
          {/* Scrim — fades via opacity, carries NO backdrop-filter. Animating opacity
              on a filtered layer freezes its last frame, and that frozen frame
              outlives the unmount — the ghost print left behind after closing. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 scrim"
          />

          {/* Veil blur — static sibling: full blur exists on the first frame (no
              latency); its exit ramps the filter to none before unmount. */}
          <motion.div
            aria-hidden="true"
            initial={false}
            exit={{
              backdropFilter: 'blur(0px) saturate(1) brightness(1) contrast(1)',
              transition: { duration: 0.12 },
            }}
            className="fixed inset-0 pointer-events-none veil-blur"
          />

          <div
            className={
              isSide
                ? 'absolute left-0 top-0 h-full z-10'
                : `relative w-full ${widthStyles[maxWidth]} z-10 @container max-sm:max-w-none`
            }
          >
            {/* Grows out of the trigger button and collapses ALL the way back into it —
                scale endpoints at 0.x made panels vanish mid-travel. Opacity resolves
                faster than scale so the small panel is visible from the first frames. */}
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{
                opacity: 0,
                scale: 0,
                transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
              }}
              transition={{
                opacity: { duration: 0.16 },
                scale: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
              }}
              style={originStyle}
              className={
                isSide
                  ? `relative lens flex h-full w-full flex-col overflow-hidden ${sideWidth}`
                  : /* overflow-hidden: the glx-inset footer is a nearly-opaque child;
                       without the clip its square corners painted OVER the panel's
                       rounded bottom corners (the "sharp corners on the down side"
                       in the user's photos of the manual-add modal). Dropdowns are
                       portalled to body, so nothing legitimate is clipped. */
                    'relative lens flex max-h-[min(90vh,90dvh)] w-full flex-col overflow-hidden rounded-t-3xl pb-[env(safe-area-inset-bottom)] sm:rounded-3xl sm:pb-0'
              }
              role="dialog"
              tabIndex={-1}
              aria-modal="true"
              aria-label={title}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-glass-light-stroke)] shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  {icon && <span className="shrink-0 text-[var(--color-accent)]">{icon}</span>}
                  <h3 className="text-label md:text-body font-black text-[var(--color-text-primary)] text-right">
                    {title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="بستن پنجره"
                  className="btn-glass btn-glass--danger modal-close grid h-9 w-9 shrink-0 place-items-center rounded-full cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body — bodyClassName replaces the default for custom layouts */}
              <div
                className={
                  bodyClassName ??
                  'p-6 overflow-y-auto text-caption md:text-label text-[var(--color-text-secondary)] leading-relaxed text-right'
                }
              >
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div
                  className={`px-6 py-4 glx-inset border-t border-[var(--color-glass-light-stroke)] flex items-center ${footerClassName ?? 'justify-end'} gap-3`}
                >
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
