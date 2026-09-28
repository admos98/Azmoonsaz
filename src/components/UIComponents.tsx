/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useLayoutEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { useOriginFromTrigger } from '../hooks/useOriginFromTrigger';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Info,
  ChevronDown,
  AlertTriangle,
  ArrowRight,
  Search,
  RefreshCw,
} from 'lucide-react';

/* ==========================================
   1. BUTTON COMPONENT
   ========================================== */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      icon,
      iconPosition = 'start',
      className = '',
      disabled,
      ...props
    },
    ref,
  ) => {
    const baseStyle =
      'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:opacity-50 disabled:pointer-events-none';

    const variants: Record<ButtonProps['variant'] & {}, string> = {
      primary:
        'bg-[var(--color-accent-solid)] hover:bg-[var(--color-accent-solid-hover)] text-[var(--color-text-on-solid)] shadow-sm',
      secondary: 'glx-inset hover:brightness-105 text-[var(--color-text-primary)]',
      outline:
        'bg-transparent hover:glx-inset border border-[var(--color-glass-light-stroke)] text-[var(--color-text-primary)]',
      ghost: 'bg-transparent hover:glx-inset text-[var(--color-text-secondary)]',
      danger:
        'bg-[var(--color-danger-solid)] hover:bg-[var(--color-danger-solid)]/90 text-[var(--color-text-on-solid)] shadow-sm',
      success:
        'bg-[var(--color-success-solid)] hover:bg-[var(--color-success-solid)]/90 text-[var(--color-text-on-solid)] shadow-sm',
      gold: 'bg-[var(--color-gold)] hover:bg-[var(--color-gold)]/90 text-[var(--color-ink)] shadow-sm',
    };

    const sizes: Record<ButtonProps['size'] & {}, string> = {
      sm: 'px-3 py-1.5 text-caption',
      md: 'px-4.5 py-2.5 text-caption md:text-label',
      lg: 'px-6 py-3.5 text-label md:text-body',
    };

    return (
      <button
        type="button"
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
        {!isLoading && icon && iconPosition === 'start' && icon}
        {children}
        {!isLoading && icon && iconPosition === 'end' && icon}
      </button>
    );
  },
);

/* ==========================================
   2. CARD COMPONENT
   ========================================== */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  glassLayer?: 'light' | 'strong' | 'inset';
  children?: React.ReactNode;
  className?: string;
  id?: string;
  key?: React.Key;
}

export const Card = ({
  children,
  hoverable = false,
  glassLayer = 'light',
  className = '',
  ...props
}: CardProps) => {
  const glassClass = {
    light: 'glx',
    strong: 'glx-strong',
    inset: 'glx-inset',
    /* No material at all — for content nested inside an already-glass panel.
       Glass-on-glass multiplies backdrop-filter cost and muddies the read:
       real glass doesn't refract inside itself. */
    none: '',
  }[glassLayer];
  const edgeClass =
    glassLayer === 'light' || glassLayer === 'strong' ? 'glass-edge' : '';
  /* 'inset' and 'none' sit INSIDE other panels — they get no rim ring.
     A rim on every nested row is what made panels read as double-framed
     plastic; iOS nests rows as quiet fills under the host panel's rim. */

  if (hoverable) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spreadProps = props as any;
    return (
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.995 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={`${glassClass} ${edgeClass} rounded-xl p-5 md:p-6 transition-all ${className}`.trim()}
        {...spreadProps}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <div
      className={`${glassClass} ${edgeClass} rounded-xl p-5 md:p-6 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
};

/* ==========================================
   3. BADGE COMPONENT
   ========================================== */
interface BadgeProps {
  variant?: 'primary' | 'slate' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  children: React.ReactNode;
  className?: string;
}

export const Badge = ({ variant = 'info', children, className = '' }: BadgeProps) => {
  const variantStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
    primary:
      'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent-soft)]',
    slate: 'glx-inset text-[var(--color-text-secondary)] border-[var(--color-glass-light-stroke)]',
    success:
      'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/10',
    warning:
      'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]/10',
    danger:
      'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger)]/10',
    info: 'bg-[var(--color-info-soft)] text-[var(--color-info)] border-[var(--color-info)]/10',
    accent:
      'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent)]/10',
  };

  const styleString = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-micro font-bold rounded-lg border leading-none ${styleString} ${className}`}
    >
      {children}
    </span>
  );
};

/* ==========================================
   4. STATUS BADGE COMPONENT
   ========================================== */
interface StatusBadgeProps {
  status:
    | 'draft'
    | 'scheduled'
    | 'active'
    | 'completed'
    | 'ongoing'
    | 'submitted'
    | 'graded'
    | 'absent'
    | 'present'
    | 'needs-grading';
  className?: string;
}

export const StatusBadge = ({ status, className = '' }: StatusBadgeProps) => {
  // Canonical status labels + tones for the whole app (one source of truth).
  // Live states pulse — the only place that animation is allowed.
  const config: Record<
    StatusBadgeProps['status'],
    { variant: BadgeProps['variant']; label: string; live?: boolean }
  > = {
    draft: { variant: 'info', label: 'پیش\u200cنویس' },
    scheduled: { variant: 'info', label: 'برنامه\u200cریزی شده' },
    active: { variant: 'warning', label: 'در حال برگزاری', live: true },
    completed: { variant: 'success', label: 'برگزار شده' },
    ongoing: { variant: 'warning', label: 'در حال آزمون', live: true },
    submitted: { variant: 'info', label: 'تحویل داده شده' },
    graded: { variant: 'success', label: 'تصحیح شده' },
    absent: { variant: 'danger', label: 'غایب' },
    present: { variant: 'success', label: 'حاضر' },
    'needs-grading': { variant: 'warning', label: 'نیازمند تصحیح' },
  };

  const item = config[status] || { variant: 'info' as const, label: String(status) };

  return (
    <Badge
      variant={item.variant}
      className={`${item.live ? 'animate-pulse ' : ''}${className}`}
    >
      {item.label}
    </Badge>
  );
};

/* ==========================================
   4B. DIFFICULTY BADGE COMPONENT
   ========================================== */
interface DifficultyBadgeProps {
  difficulty?: 'easy' | 'medium' | 'hard';
  className?: string;
}

export const DifficultyBadge = ({ difficulty, className = '' }: DifficultyBadgeProps) => {
  const config: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    easy: { variant: 'success', label: 'آسان' },
    medium: { variant: 'warning', label: 'متوسط' },
    hard: { variant: 'danger', label: 'سخت' },
  };

  const item = config[difficulty ?? 'medium'];

  return (
    <Badge variant={item.variant} className={className}>
      {item.label}
    </Badge>
  );
};

/* ==========================================
   5. INPUT COMPONENT
   ========================================== */
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
  /** Leading decorative icon (inline-start / physical right in this RTL app) — non-interactive */
  icon?: React.ReactNode;
  /** Trailing interactive slot (physical left in this RTL app) — e.g. a show-password button */
  trailing?: React.ReactNode;
  /** sm: compact fields inside dense editor rows; md (default): standard form field */
  size?: 'sm' | 'md';
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      icon,
      trailing,
      size = 'md',
      id,
      className = '',
      wrapperClassName = '',
      type = 'text',
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const sizeBase =
      size === 'sm'
        ? 'text-micro px-2.5 py-1.5 rounded-lg'
        : 'text-label px-4 py-2.5 rounded-xl';
    return (
      <div className={`space-y-1.5 text-right w-full ${wrapperClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-caption md:text-label font-bold text-[var(--color-text-secondary)]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            type={type}
            className={`w-full ${sizeBase} glx-inset hover:brightness-105 border outline-hidden focus:border-[var(--color-accent)] transition-all text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] ${error ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]' : 'border-[var(--color-glass-light-stroke)]'} ${icon ? 'pr-11' : ''} ${trailing ? 'pl-11' : ''} ${className}`}
            {...props}
          />
          {icon && (
            <div className="absolute top-1/2 -translate-y-1/2 right-3 text-[var(--color-text-tertiary)] pointer-events-none">
              {icon}
            </div>
          )}
          {trailing && (
            <div className="absolute top-1/2 -translate-y-1/2 left-2 flex items-center">
              {trailing}
            </div>
          )}
        </div>
        {error && (
          <p className="text-micro text-[var(--color-danger)] font-bold flex items-center gap-1 mt-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </p>
        )}
        {!error && helperText && (
          <p className="text-micro text-[var(--color-text-tertiary)] font-semibold">{helperText}</p>
        )}
      </div>
    );
  },
);

/* ==========================================
   6B. DROPDOWN COMPONENT
   ========================================== */
interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Renders a sticky group header above this option when it differs from the previous one */
  group?: string;
}
interface DropdownProps {
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
      (opts.find((o) => o.getAttribute('aria-selected') === 'true') || opts[0])?.focus();
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
          aria-controls={open ? `${dropdownId}-list` : undefined}
          className={`relative w-full flex items-center justify-between glx glass-edge border rounded-xl font-bold transition-all text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-accent)] focus:bg-[var(--color-accent-soft)]/30 ${
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
                aria-label={label || placeholder}
                onKeyDown={handleListKeyDown}
                className="relative glx-strong glass-edge rounded-xl max-h-56 overflow-y-auto"
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
                      className={`w-full text-right px-3.5 py-2.5 text-label font-bold transition-all ${value === opt.value ? 'bg-[var(--color-accent-soft)]/60 text-[var(--color-accent)]' : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]/70'} ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
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
          <p className="text-micro text-[var(--color-danger)] font-bold flex items-center gap-1 mt-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  },
);

/* ==========================================
   7. TABS COMPONENT
   ========================================== */
interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  /** Accessible name for the tablist */
  ariaLabel?: string;
}

export const Tabs = ({ tabs, activeTab, onChange, className = '', ariaLabel }: TabsProps) => {
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    tabRefs.current[next]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const current = tabs.findIndex((t) => t.id === activeTab);
    // RTL reading order: ArrowLeft advances to the next tab, ArrowRight goes back
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusTab(current + 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusTab(current - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusTab(tabs.length - 1);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`flex items-center gap-1 glx-inset p-1.5 rounded-2xl w-fit ${className}`}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            type="button"
            key={tab.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            id={`${baseId}-tab-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-caption md:text-label font-bold rounded-xl transition-all cursor-pointer select-none ${isActive ? 'bg-[var(--color-gold)]/10 text-[var(--color-ink)] shadow-sm border border-[var(--color-glass-light-stroke)]' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-glass-light-stroke)]/20'}`}
          >
            {tab.icon && tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

/* ==========================================
   8. MODAL COMPONENT
   ========================================== */
interface ModalProps {
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
        <div className={`fixed inset-0 z-50 ${isSide ? '' : 'flex items-end justify-center p-0 sm:items-center sm:p-4'}`}>
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
                  ? `relative glx-strong glass-edge flex h-full w-full flex-col ${sideWidth}`
                  : 'relative glx-strong glass-edge flex max-h-[min(90vh,90dvh)] w-full flex-col rounded-t-3xl pb-[env(safe-area-inset-bottom)] sm:rounded-3xl sm:pb-0'
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
                  className="p-1 rounded-lg text-[var(--color-text-tertiary)] hover:glx-inset hover:text-[var(--color-text-primary)] transition-all cursor-pointer"
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
                <div className={`px-6 py-4 glx-inset border-t border-[var(--color-glass-light-stroke)] flex items-center ${footerClassName ?? 'justify-end'} gap-3`}>
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

/* ==========================================
   11. EMPTY STATE COMPONENT
   ========================================== */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  /** Compact variant for inline spots: table cells, pickers, modal bodies */
  compact?: boolean;
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) => {
  return (
    <div
      className={`relative flex flex-col items-center justify-center text-center border border-dashed glx glass-edge ${
        compact ? 'p-6 md:p-8 space-y-2.5 rounded-2xl' : 'p-10 md:p-14 space-y-4 rounded-3xl'
      }`}
    >
      <div
        className={`bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded-full ${
          compact ? 'p-2.5' : 'p-4'
        }`}
      >
        {icon || <HelpCircle className={compact ? 'w-5 h-5' : 'w-8 h-8'} />}
      </div>
      <div className={`space-y-1 w-full ${compact ? 'max-w-xs' : 'max-w-sm'}`}>
        <h4
          className={`font-bold text-[var(--color-text-primary)] ${
            compact ? 'text-caption md:text-label' : 'text-label md:text-body'
          }`}
        >
          {title}
        </h4>
        <p
          className={`text-[var(--color-text-tertiary)] font-medium leading-relaxed ${
            compact ? 'text-micro md:text-caption' : 'text-caption'
          }`}
        >
          {description}
        </p>
      </div>
      {action && <div className={compact ? 'pt-1' : 'pt-2'}>{action}</div>}
    </div>
  );
};

/* ==========================================
   12. CONFIRM DIALOG COMPONENT
   ========================================== */
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'primary' | 'success';
}

export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmText = 'تایید',
  cancelText = 'انصراف',
  onConfirm,
  onCancel,
  variant = 'danger',
}: ConfirmDialogProps) => {
  const iconBg =
    variant === 'danger'
      ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
      : 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant={variant} size="sm" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-4 text-right">
        <div className={`p-2.5 rounded-full ${iconBg}`}>
          <AlertTriangle className="w-5 h-5 text-current" />
        </div>
        <div className="space-y-1">
          <p className="font-bold text-[var(--color-text-primary)] text-caption md:text-label">
            {title}
          </p>
          <p className="text-caption text-[var(--color-text-tertiary)] leading-relaxed font-semibold">
            {message}
          </p>
        </div>
      </div>
    </Modal>
  );
};

/* ==========================================
   14. RESPONSIVE CUSTOM TABLE COMPONENT
   ========================================== */
interface TableColumn {
  key: string;
  label: string;
  align?: 'right' | 'center' | 'left';
}

interface TableProps<T> {
  headers: TableColumn[];
  data: T[];
  renderRow: (row: T, idx: number) => React.ReactNode;
  renderMobileCard?: (row: T, idx: number) => React.ReactNode;
  emptyTitle?: string;
  emptyDesc?: string;
  emptyAction?: React.ReactNode;
  /** Standard retry handler — renders the designed retry button in the empty state.
   *  The design system never falls back to a full page reload. */
  onRetry?: () => void;
}

export const Table = <T,>({
  headers,
  data,
  renderRow,
  renderMobileCard,
  emptyTitle = 'هیچ اطلاعاتی یافت نشد',
  emptyDesc = 'اطلاعاتی سازگار با فیلترهای کنونی در سیستم وجود ندارد.',
  emptyAction,
  onRetry,
}: TableProps<T>) => {
  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDesc}
        action={
          emptyAction ??
          (onRetry ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={onRetry}
            >
              تلاش دوباره
            </Button>
          ) : undefined)
        }
      />
    );
  }

  return (
    <div className="w-full">
      {/* Table for Desktop Viewports */}
      <div
        tabIndex={0}
        role="region"
        aria-label="جدول داده؛ برای مشاهده ستون‌های بیشتر به‌صورت افقی پیمایش کنید"
        className={`overflow-x-auto rounded-2xl border border-[var(--color-glass-light-stroke)] hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${renderMobileCard ? 'md:block' : 'block'}`}
      >
        <table className="w-full text-right border-collapse text-caption md:text-label glx-inset">
          <thead>
            <tr className="border-b border-[var(--color-glass-light-stroke)] text-[var(--color-text-tertiary)] font-bold text-micro md:text-caption">
              {headers.map((col, idx) => {
                const alignStyles: Record<NonNullable<TableColumn['align']>, string> = {
                  right: 'text-right',
                  center: 'text-center',
                  left: 'text-left',
                };
                return (
                  <th
                    key={col.key}
                    className={`p-4 font-bold ${alignStyles[col.align || 'right']} ${idx === 0 ? 'rounded-r-2xl' : ''} ${idx === headers.length - 1 ? 'rounded-l-2xl' : ''}`}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)]">
            {data.map((row, idx) => renderRow(row, idx))}
          </tbody>
        </table>
      </div>

      {/* Cards for Mobile Viewports */}
      {renderMobileCard && (
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {data.map((row, idx) => renderMobileCard(row, idx))}
        </div>
      )}
    </div>
  );
};

/* ==========================================
   18. PAGE HEADER COMPONENT
   One h1 per page (level=1 default); h2 only for sub-view headers.
   ========================================== */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Accent chip icon rendered before the title */
  icon?: React.ReactNode;
  /** Action buttons rendered at the far (inline-end) side */
  actions?: React.ReactNode;
  /** Optional back button (RTL-aware: arrow points toward the start edge) */
  back?: { label: string; onClick: () => void };
  level?: 1 | 2;
  className?: string;
}

export const PageHeader = ({
  title,
  subtitle,
  icon,
  actions,
  back,
  level = 1,
  className = '',
}: PageHeaderProps) => {
  const Heading = (level === 1 ? 'h1' : 'h2') as 'h1';
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {back && (
        <Button
          variant="ghost"
          size="sm"
          onClick={back.onClick}
          icon={<ArrowRight className="w-4 h-4" />}
          className="shrink-0"
        >
          {back.label}
        </Button>
      )}
      {icon && (
        <div className="p-2.5 bg-[var(--color-accent-soft)] rounded-xl text-[var(--color-accent)] shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <Heading className="text-heading-3 font-black text-[var(--color-text-primary)]">
          {title}
        </Heading>
        {subtitle && (
          <p className="text-caption text-[var(--color-text-tertiary)] font-medium mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5 ms-auto shrink-0">{actions}</div>}
    </div>
  );
};

/* ==========================================
   19. STAT CARD COMPONENT
   ========================================== */
interface StatCardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** Micro footnote under the value — color comes from footnoteTone */
  footnote?: React.ReactNode;
  footnoteTone?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  /** Color override for the value line (defaults to primary ink) */
  valueClassName?: string;
  icon?: React.ReactNode;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  /** inset when the card sits inside an already-glass panel, light when standalone */
  glassLayer?: 'light' | 'inset';
  valueSize?: 'lg' | 'md';
  id?: string;
  className?: string;
}

const statToneChips: Record<NonNullable<StatCardProps['tone']>, string> = {
  accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  info: 'bg-[var(--color-info-soft)] text-[var(--color-info)]',
  neutral: 'glx-inset text-[var(--color-text-secondary)]',
};

const statToneText: Record<NonNullable<StatCardProps['footnoteTone']>, string> = {
  accent: 'text-[var(--color-accent)]',
  success: 'text-[var(--color-success)]',
  warning: 'text-[var(--color-warning)]',
  danger: 'text-[var(--color-danger)]',
  info: 'text-[var(--color-info)]',
  /* neutral footnotes read as text-secondary, not tertiary — tertiary on the
     inset fill measured ~1.9:1 in the pics audit ("invisible values"). */
  neutral: 'text-[var(--color-text-secondary)]',
};

export const StatCard = ({
  label,
  value,
  unit,
  footnote,
  footnoteTone = 'neutral',
  valueClassName = '',
  icon,
  tone = 'accent',
  glassLayer = 'inset',
  valueSize = 'lg',
  id,
  className = '',
}: StatCardProps) => {
  return (
    <Card glassLayer={glassLayer} id={id} className={`flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-micro font-bold text-[var(--color-text-tertiary)]">{label}</span>
        {icon && <div className={`p-2.5 rounded-xl shrink-0 ${statToneChips[tone]}`}>{icon}</div>}
      </div>
      <div className="mt-4">
        <span
          className={`font-black tracking-tight leading-tight block ${
            valueSize === 'lg' ? 'text-heading-1' : 'text-heading-2'
          } ${valueClassName || 'text-[var(--color-text-primary)]'}`}
        >
          {value}
          {unit && (
            <span className="text-caption font-normal text-[var(--color-text-secondary)]">
              {' '}
              {unit}
            </span>
          )}
        </span>
        {footnote && (
          <span className={`text-micro font-semibold mt-1.5 block ${statToneText[footnoteTone]}`}>
            {footnote}
          </span>
        )}
      </div>
    </Card>
  );
};

/* ==========================================
   20. SEARCH INPUT COMPONENT
   ========================================== */
export type SearchInputProps = Omit<InputProps, 'type' | 'icon'>;

export const SearchInput = (props: SearchInputProps) => {
  return <Input type="search" icon={<Search className="h-4 w-4" />} {...props} />;
};

/* ==========================================
   21. TEXTAREA COMPONENT
   ========================================== */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
  /** sm: compact fields inside dense editor rows; md (default): standard form field */
  size?: 'sm' | 'md';
  /** When set, renders an LTR `used/max` counter under the field (controlled `value` required) */
  maxCount?: number;
  wrapperClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      size = 'md',
      maxCount,
      value,
      id,
      className = '',
      wrapperClassName = '',
      rows = 3,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const fieldId = id || generatedId;
    const sizeBase =
      size === 'sm'
        ? 'text-micro px-2.5 py-1.5 rounded-lg'
        : 'text-label px-4 py-2.5 rounded-xl';
    const valueLength = typeof value === 'string' ? value.length : 0;
    return (
      <div className={`space-y-1.5 text-right w-full ${wrapperClassName}`}>
        {label && (
          <label
            htmlFor={fieldId}
            className="block text-caption md:text-label font-bold text-[var(--color-text-secondary)]"
          >
            {label}
          </label>
        )}
        <textarea
          id={fieldId}
          ref={ref}
          rows={rows}
          value={value}
          className={`w-full ${sizeBase} glx-inset hover:brightness-105 border outline-hidden focus:border-[var(--color-accent)] transition-all text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] resize-y leading-relaxed ${error ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]' : 'border-[var(--color-glass-light-stroke)]'} ${className}`}
          {...props}
        />
        {maxCount !== undefined && (
          <p
            className="text-micro text-[var(--color-text-tertiary)] font-semibold tabular-nums text-left"
            dir="ltr"
            aria-live="polite"
          >
            {valueLength}/{maxCount}
          </p>
        )}
        {error && (
          <p className="text-micro text-[var(--color-danger)] font-bold flex items-center gap-1 mt-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </p>
        )}
        {!error && helperText && (
          <p className="text-micro text-[var(--color-text-tertiary)] font-semibold">{helperText}</p>
        )}
      </div>
    );
  },
);

/* ==========================================
   22. TOGGLE (SWITCH) COMPONENT
   Accessible switch: role=switch + aria-checked; knob slides toward the
   inline-end edge when on (correct in both RTL and LTR via dir variants).
   ========================================== */
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export const Toggle = ({
  checked,
  onChange,
  label,
  description,
  id,
  disabled = false,
  className = '',
}: ToggleProps) => {
  const generatedId = useId();
  const toggleId = id || generatedId;
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <button
        type="button"
        id={toggleId}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border px-0.5 transition-all cursor-pointer select-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
          checked
            ? 'bg-[var(--color-accent-solid)] border-transparent'
            : 'glx-inset border-[var(--color-glass-light-stroke)]'
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 rounded-full shadow-sm transition-transform duration-200 ${
            checked
              ? 'bg-[var(--color-text-on-solid)] rtl:-translate-x-[1.375rem] ltr:translate-x-[1.375rem]'
              : 'translate-x-0 bg-[var(--color-surface-secondary)]'
          }`}
        />
      </button>
      {(label || description) && (
        <div className="space-y-0.5 min-w-0">
          {label && (
            <span className="block text-caption font-bold text-[var(--color-text-primary)]">
              {label}
            </span>
          )}
          {description && (
            <span className="block text-micro text-[var(--color-text-tertiary)] leading-normal">
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/* ==========================================
   23. FILTER BAR COMPONENT
   One row: search + dropdown filters + optional clear-all.
   ========================================== */
interface FilterBarProps {
  /** SearchInput slot — rendered first */
  search?: React.ReactNode;
  /** Dropdown filters and other inline controls */
  children?: React.ReactNode;
  hasActiveFilters?: boolean;
  onClearAll?: () => void;
  className?: string;
}

export const FilterBar = ({
  search,
  children,
  hasActiveFilters = false,
  onClearAll,
  className = '',
}: FilterBarProps) => {
  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      {search}
      {children}
      {hasActiveFilters && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          icon={<X className="w-3.5 h-3.5" />}
          className="ms-auto"
        >
          پاک کردن فیلترها
        </Button>
      )}
    </div>
  );
};

/* ==========================================
   17A. TOAST STACK CONTAINER
   Fixed placement for the app's toast column. Toast itself is position-free;
   the stack owns placement (bottom on mobile, top on sm+), so concurrent
   toasts stack instead of overlapping.
   ========================================== */
export const ToastStack = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 max-sm:bottom-[max(1rem,env(safe-area-inset-bottom))] sm:top-4">
      {children}
    </div>
  );
};

/* ==========================================
   17. TOAST COMPONENT
   ========================================== */
interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose?: () => void;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

export const Toast = ({ message, type = 'info', onClose, duration = 4000, action }: ToastProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose?.(), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const styles: Record<ToastProps['type'] & {}, string> = {
    success: 'bg-[var(--color-success-solid)] text-[var(--color-text-on-solid)]',
    error: 'bg-[var(--color-danger-solid)] text-[var(--color-text-on-solid)]',
    warning: 'bg-[var(--color-warning-solid)] text-[var(--color-text-on-solid)]',
    info: 'bg-[var(--color-ink)] text-[var(--color-text-on-solid)]',
  };

  const icons: Record<ToastProps['type'] & {}, React.ReactNode> = {
    success: <CheckCircle className="w-4 h-4" />,
    error: <AlertTriangle className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    info: <Info className="w-4 h-4" />,
  };

  return (
    <div
      className={`pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl px-4 py-3 text-label font-bold shadow-lg transition-all duration-300 ${styles[type]} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
      aria-live={type === 'error' || type === 'warning' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {icons[type]}
      <span>{message}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="rounded-lg border border-current px-2 py-1 text-micro underline-offset-2 hover:underline"
        >
          {action.label}
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن پیام"
          className="mr-2 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
