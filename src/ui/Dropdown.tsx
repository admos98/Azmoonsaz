/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useLayoutEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, AlertCircle } from 'lucide-react';

/* ==========================================
   6B. DROPDOWN COMPONENT
   ========================================== */
export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Renders a sticky group header above this option when it differs from the previous one */
  group?: string;
}
export interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  className?: string;
  label?: string;
  error?: string;
  id?: string;
  /** Compact variant for inline filter pills */
  compact?: boolean;
}
export const Dropdown = React.forwardRef<HTMLButtonElement, DropdownProps>(
  (
    { value, onChange, options, placeholder, label, error, className = '', id, compact = false },
    ref,
  ) => {
    const generatedId = useId();
    const dropdownId = id || generatedId;
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        const t = e.target as Node;
        // The options list is portaled to <body>, so it sits OUTSIDE dropdownRef —
        // without this clause the list would close on mousedown, before the click
        // on an option ever fired.
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(t) &&
          !(listRef.current && listRef.current.contains(t))
        ) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Listbox keyboard model: ArrowDown/ArrowUp move focus between enabled
    // options (Enter/Space activate natively), Escape closes back to the trigger.
    const handleListKeyDown = (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        dropdownRef.current?.querySelector('button')?.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const opts = Array.from(
        listRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
      );
      if (!opts.length) return;
      const current = opts.indexOf(document.activeElement as HTMLButtonElement);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      opts[(current + delta + opts.length) % opts.length]?.focus();
    };

    // When the list opens, park focus on the selected option (or first enabled)
    // so screen readers and keyboard users start inside the listbox.
    useLayoutEffect(() => {
      if (!open) return;
      const opts = Array.from(
        listRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
      );
      const target = opts.find((o) => o.getAttribute('aria-selected') === 'true') || opts[0];
      target?.focus();
      // F-9: also scroll the list onto the selection — the portalled listbox
      // is its own scroller (max-h-56), so opening long a list used to show
      // the top while focus sat on an option below the fold. Optional call:
      // jsdom doesn't implement scrollIntoView.
      target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }, [open]);

    // Portal geometry: anchored to the trigger button and measured in a layout
    // effect so the list never flashes at the document origin before first paint.
    const [listStyle, setListStyle] = useState<React.CSSProperties>({
      position: 'fixed',
      left: 0,
      top: 0,
      width: 0,
      zIndex: 9999,
    });

    useLayoutEffect(() => {
      if (!open) return;
      const measure = () => {
        const btn = dropdownRef.current?.querySelector('button');
        if (!btn) return;
        const r = btn.getBoundingClientRect();
        setListStyle({
          position: 'fixed',
          left: r.left,
          top: r.bottom + 4,
          width: r.width,
          zIndex: 9999,
        });
      };
      measure();
      window.addEventListener('resize', measure);
      // capture: re-anchor when any scrollable ancestor moves the trigger
      window.addEventListener('scroll', measure, true);
      return () => {
        window.removeEventListener('resize', measure);
        window.removeEventListener('scroll', measure, true);
      };
    }, [open]);

    const selectedLabel = options.find((o) => o.value === value)?.label || placeholder || '';

    return (
      <div className={`relative text-right ${className}`} ref={dropdownRef}>
        {label && (
          <label
            htmlFor={dropdownId}
            className="block text-caption md:text-label font-bold text-[var(--color-text-secondary)] mb-1"
          >
            {label}
          </label>
        )}
        <button
          id={dropdownId}
          ref={ref}
          type="button"
          onClick={() => setOpen(!open)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${dropdownId}-error` : undefined}
          aria-controls={open ? `${dropdownId}-list` : undefined}
          className={`relative w-full flex items-center justify-between glx field border rounded-xl font-bold transition-all text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-accent)] focus:bg-[var(--color-accent-soft)]/30 ${
            compact ? 'px-2.5 py-1.5 text-caption' : 'px-3.5 py-2.5 text-label'
          } ${error ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]' : 'border-[var(--color-glass-light-stroke)] hover:brightness-105'}`}
        >
          <span
            className={
              selectedLabel
                ? 'text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-tertiary)]'
            }
          >
            {selectedLabel || placeholder}
          </span>
          <ChevronDown
            className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] transition-transform"
            style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </button>
        {/* Portal to body: a list rendered inside a z-50/z-60 panel inherits that
            panel's stacking context, so a sibling panel could paint over it.
            Body level + a high z-index makes it topmost, always. */}
        {createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="dropdown-options"
                ref={listRef}
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                /* No area-blur halo and no drop shadow: the trigger button already
                   carries the glass, and a floating list needs neither. */
                style={{ ...listStyle, boxShadow: 'none', transformOrigin: 'top center' }}
                id={`${dropdownId}-list`}
                role="listbox"
                /* F-9: named by the TRIGGER (its visible text = the current
                   selection), not a copied aria-label that can drift */
                aria-labelledby={dropdownId}
                onKeyDown={handleListKeyDown}
                className="relative glx-strong field rounded-xl max-h-56 overflow-y-auto"
              >
                {options.map((opt, i) => (
                  <React.Fragment key={opt.value}>
                    {opt.group && options[i - 1]?.group !== opt.group && (
                      <div className="px-3.5 pt-2.5 pb-1 text-micro font-black text-[var(--color-text-tertiary)] sticky top-0 bg-[var(--color-paper-warm)]/90 chrome-blur">
                        {opt.group}
                      </div>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === opt.value}
                      aria-disabled={opt.disabled || undefined}
                      disabled={opt.disabled}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={`w-full text-right px-3.5 py-2.5 text-label font-bold transition-all ${value === opt.value ? 'btn-glass btn-glass--accent' : 'btn-glass btn-glass--bare'} ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {opt.label}
                    </button>
                  </React.Fragment>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
        {error && (
          <p
            id={`${dropdownId}-error`}
            className="text-micro text-[var(--color-danger)] font-bold flex items-center gap-1 mt-1"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  },
);
