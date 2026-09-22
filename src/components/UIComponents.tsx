/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Loader2,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Info,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { formatPersianNumber } from '../services/persianHelpers';

/* ==========================================
   1. BUTTON COMPONENT
   ========================================== */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'gold' | 'indigo';
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
      'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';

    const variants: Record<ButtonProps['variant'] & {}, string> = {
      primary: 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow-sm',
      indigo: 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow-sm',
      secondary: 'glx-inset hover:brightness-105 text-[var(--color-text-primary)]',
      outline:
        'bg-transparent hover:glx-inset border border-[var(--color-glass-light-stroke)] text-[var(--color-text-primary)]',
      ghost: 'bg-transparent hover:glx-inset text-[var(--color-text-secondary)]',
      danger: 'bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/90 text-white shadow-sm',
      success: 'bg-[var(--color-success)] hover:bg-[var(--color-success)]/90 text-white shadow-sm',
      gold: 'bg-[var(--color-gold)] hover:bg-[var(--color-gold)]/90 text-[var(--color-ink)] shadow-sm',
    };

    const sizes: Record<ButtonProps['size'] & {}, string> = {
      sm: 'px-3 py-1.5 text-caption',
      md: 'px-4.5 py-2.5 text-caption md:text-label',
      lg: 'px-6 py-3.5 text-label md:text-md',
    };

    return (
      <button
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
  }[glassLayer];

  if (hoverable) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spreadProps = props as any;
    return (
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.995 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={`glx rounded-xl p-5 md:p-6 hover:shadow-lg hover:shadow-[var(--color-accent-soft)]/40 transition-all ${className}`}
        {...spreadProps}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <div className={`${glassClass} rounded-xl p-5 md:p-6 ${className}`} {...props}>
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
    'draft' | 'scheduled' | 'active' | 'completed' | 'ongoing' | 'submitted' | 'graded' | 'absent';
  className?: string;
}

export const StatusBadge = ({ status, className = '' }: StatusBadgeProps) => {
  const config: Record<
    StatusBadgeProps['status'],
    { variant: BadgeProps['variant']; label: string }
  > = {
    draft: { variant: 'info', label: 'پیش\u200cنویس' },
    scheduled: { variant: 'info', label: 'زمان\u200cبندی شده' },
    active: { variant: 'success', label: 'فعال / در حال برگزاری' },
    completed: { variant: 'primary', label: 'پایان یافته' },
    ongoing: { variant: 'warning', label: 'در حال آزمون' },
    submitted: { variant: 'info', label: 'تحویل داده شده' },
    graded: { variant: 'success', label: 'تصحیح شده' },
    absent: { variant: 'danger', label: 'غایب' },
  };

  const item = config[status] || { variant: 'info' as const, label: String(status) };

  return (
    <Badge variant={item.variant} className={className}>
      {item.label}
    </Badge>
  );
};

/* ==========================================
   5. INPUT COMPONENT
   ========================================== */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      icon,
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
            className={`w-full text-label px-4 py-2.5 glx-inset hover:brightness-105 border rounded-xl outline-hidden focus:border-[var(--color-accent)] transition-all text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] ${error ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]' : 'border-[var(--color-glass-light-stroke)]'} ${icon ? 'pr-11' : ''} ${className}`}
            {...props}
          />
          {icon && (
            <div className="absolute top-1/2 -translate-y-1/2 right-3 text-[var(--color-text-tertiary)] pointer-events-none">
              {icon}
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

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
          className={`w-full flex items-center justify-between glx border rounded-xl font-bold transition-all text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-accent)] focus:bg-[var(--color-accent-soft)]/30 ${
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
        <AnimatePresence>
          {open && (
            /* Static wrapper: the area-blur halo must never sit under an opacity-animated ancestor */
            <div className="absolute top-full z-[100] mt-1 w-full">
              <motion.div
                aria-hidden="true"
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute -inset-2.5 rounded-2xl area-blur"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="relative glx-strong rounded-xl shadow-2xl max-h-56 overflow-y-auto"
              >
                {options.map((opt, i) => (
                  <React.Fragment key={opt.value}>
                    {opt.group && options[i - 1]?.group !== opt.group && (
                      <div className="px-3.5 pt-2.5 pb-1 text-micro font-black text-[var(--color-text-tertiary)] sticky top-0 bg-[var(--color-paper-warm)]/90 backdrop-blur-sm">
                        {opt.group}
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={`w-full text-right px-3.5 py-2.5 text-label font-bold transition-all ${value === opt.value ? 'bg-[var(--color-accent-soft)]/40 text-[var(--color-accent)]' : 'text-[var(--color-text-primary)] hover:bg-[var(--color-glass-light-stroke)]/20'} ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {opt.label}
                    </button>
                  </React.Fragment>
                ))}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
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
}

export const Tabs = ({ tabs, activeTab, onChange, className = '' }: TabsProps) => {
  return (
    <div className={`flex items-center gap-1 glx-inset p-1.5 rounded-2xl w-fit ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
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
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional trigger button ref — modal animates from/into this button */
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'md',
  triggerRef,
}: ModalProps) => {
  const widthStyles: Record<NonNullable<ModalProps['maxWidth']>, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const [originStyle, setOriginStyle] = useState<React.CSSProperties | undefined>(undefined);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !triggerRef?.current || !panelRef.current) {
      setOriginStyle(undefined);
      return;
    }
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const trigger = triggerRef.current;
      if (!panel || !trigger) return;
      const panelRect = panel.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const cx = triggerRect.left + triggerRect.width / 2 - panelRect.left;
      const cy = triggerRect.top + triggerRect.height / 2 - panelRect.top;
      setOriginStyle({ transformOrigin: `${cx}px ${cy}px` });
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, triggerRef]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop — dim only; blur is localized to the halo below */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30"
          />

          {/* Card + area-blur halo — static wrapper so the halo never sits under an opacity-animated ancestor */}
          <div className={`relative w-full ${widthStyles[maxWidth]} z-10`}>
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              style={originStyle}
              className="absolute -inset-4 rounded-[36px] area-blur"
            />
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              style={originStyle}
              className="relative glx-strong w-full rounded-3xl shadow-2xl flex flex-col max-h-[90vh]"
              role="dialog"
              aria-modal="true"
              aria-label={title}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-glass-light-stroke)]">
                <h3 className="text-label md:text-md font-black text-[var(--color-text-primary)] text-right">
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg text-[var(--color-text-tertiary)] hover:glx-inset hover:text-[var(--color-text-primary)] transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-6 overflow-y-auto text-caption md:text-label text-[var(--color-text-secondary)] leading-relaxed text-right">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div className="px-6 py-4 glx-inset border-t border-[var(--color-glass-light-stroke)] flex items-center justify-end gap-3">
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
   9. DRAWER COMPONENT
   ========================================== */
interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  placement?: 'left' | 'right';
  width?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export const Drawer = ({
  isOpen,
  onClose,
  title,
  placement = 'right',
  width = 'md',
  children,
}: DrawerProps) => {
  const widthStyles: Record<NonNullable<DrawerProps['width']>, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop — dim only; blur is localized to the halo below */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/30"
          />

          {/* Drawer container */}
          <div
            className={`absolute inset-y-0 ${placement === 'right' ? 'right-0' : 'left-0'} max-w-full flex`}
          >
            {/* Area-blur halo — follows the drawer slide (own transform, static ancestor) */}
            <motion.div
              aria-hidden="true"
              initial={{ x: placement === 'right' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: placement === 'right' ? '100%' : '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="absolute -inset-4 area-blur rounded-[28px]"
            />
            <motion.div
              initial={{ x: placement === 'right' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: placement === 'right' ? '100%' : '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className={`relative w-screen ${widthStyles[width]} glx-strong shadow-2xl flex flex-col divide-y divide-[var(--color-glass-light-stroke)]`}
            >
              {/* Head */}
              <div className="p-6 flex items-center justify-between">
                <h2 className="text-md font-black text-[var(--color-text-primary)]">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg text-[var(--color-text-tertiary)] hover:glx-inset hover:text-[var(--color-text-primary)] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Children scroll */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-caption md:text-label">
                {children}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

/* ==========================================
   10. STEPPER COMPONENT
   ========================================== */
interface StepperProps {
  steps: string[];
  activeStep: number;
}

export const Stepper = ({ steps, activeStep }: StepperProps) => {
  return (
    <div className="flex items-center justify-between w-full relative mb-6">
      {/* Background connector line */}
      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[var(--color-glass-light-stroke)] -translate-y-1/2 z-0" />

      {/* Animated active path */}
      <div
        className="absolute top-1/2 right-0 h-0.5 bg-[var(--color-accent)] -translate-y-1/2 z-0 transition-all duration-500"
        style={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
      />

      {steps.map((step, idx) => {
        const isCompleted = idx < activeStep;
        const isActive = idx === activeStep;
        return (
          <div key={idx} className="flex flex-col items-center gap-2 z-10 relative">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-caption select-none ring-4 ring-white transition-all duration-300 ${isCompleted ? 'bg-[var(--color-accent)] text-white' : isActive ? 'glx border-2 border-[var(--color-accent)] text-[var(--color-accent)] font-extrabold' : 'glx border-2 border-[var(--color-glass-light-stroke)] text-[var(--color-text-tertiary)]'}`}
            >
              {isCompleted ? '✓' : formatPersianNumber(idx + 1)}
            </div>
            <span
              className={`text-micro md:text-caption font-bold transition-all duration-300 ${isActive ? 'text-[var(--color-accent)] font-black' : isCompleted ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-tertiary)]'}`}
            >
              {step}
            </span>
          </div>
        );
      })}
    </div>
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
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-10 md:p-14 border border-dashed border-[var(--color-glass-light-stroke)] glx rounded-3xl space-y-4">
      <div className="p-4 bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded-full">
        {icon || <HelpCircle className="w-8 h-8" />}
      </div>
      <div className="space-y-1 w-full max-w-sm">
        <h4 className="text-label md:text-md font-bold text-[var(--color-text-primary)]">
          {title}
        </h4>
        <p className="text-caption text-[var(--color-text-tertiary)] font-medium leading-relaxed">
          {description}
        </p>
      </div>
      {action && <div className="pt-2">{action}</div>}
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
   13. FILE DROPZONE COMPONENT
   ========================================== */
interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  label?: string;
  description?: string;
}

export const FileDropzone = ({
  onFileSelect,
  accept = '.csv, .xlsx, .xls',
  label = 'بارگذاری فایل اکسل و اسناد اکسل دانش\u200cآموزان',
  description = 'فایل را به اینجا بکشید یا برای انتخاب فایل کلیک کنید',
}: FileDropzoneProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const triggerInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={triggerInput}
      className={`border-2 border-dashed rounded-3xl p-8 hover:border-[var(--color-accent)]/100 hover:brightness-105 transition-all text-center cursor-pointer flex flex-col items-center justify-center space-y-3 ${isDragActive ? 'border-[var(--color-accent)]/100 glx' : 'border-[var(--color-glass-light-stroke)] glx'}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
      <div className="p-3 bg-[var(--color-accent-soft)] rounded-full text-[var(--color-accent)]">
        <UploadCloud className="w-6 h-6" />
      </div>
      <div>
        <p className="text-caption md:text-label font-bold text-[var(--color-text-primary)]">
          {label}
        </p>
        <p className="text-micro text-[var(--color-text-tertiary)] font-medium mt-1">
          {description}
        </p>
      </div>
    </div>
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TableRow = any;
interface TableProps {
  headers: TableColumn[];
  data: TableRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderRow: (row: any, idx: number) => React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderMobileCard?: (row: any, idx: number) => React.ReactNode;
  emptyTitle?: string;
  emptyDesc?: string;
}

export const Table = ({
  headers,
  data,
  renderRow,
  renderMobileCard,
  emptyTitle = 'هیچ اطلاعاتی یافت نشد',
  emptyDesc = 'اطلاعاتی سازگار با فیلترهای کنونی در سیستم وجود ندارد.',
}: TableProps) => {
  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDesc} />;
  }

  return (
    <div className="w-full">
      {/* Table for Desktop Viewports */}
      <div
        className={`overflow-x-auto rounded-2xl border border-[var(--color-glass-light-stroke)] hidden ${renderMobileCard ? 'md:block' : 'block'}`}
      >
        <table className="w-full text-right border-collapse text-caption md:text-label glx-inset">
          <thead>
            <tr className="glx-inset border-b border-[var(--color-glass-light-stroke)] text-[var(--color-text-tertiary)] font-bold text-micro md:text-caption">
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
   15. EXAM TIMER COMPONENT
   ========================================== */
interface ExamTimerProps {
  durationMinutes: number;
  onTimeout: () => void;
  onWarning?: () => void;
  warningMinutes?: number;
}

export const ExamTimer = ({
  durationMinutes,
  onTimeout,
  onWarning,
  warningMinutes = 5,
}: ExamTimerProps) => {
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const onTimeoutRef = useRef(onTimeout);
  const onWarningRef = useRef(onWarning);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    onWarningRef.current = onWarning;
  }, [onWarning]);

  useEffect(() => {
    setSecondsLeft(durationMinutes * 60);
  }, [durationMinutes]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeoutRef.current();
          return 0;
        }
        if (prev === warningMinutes * 60 && onWarningRef.current) {
          onWarningRef.current();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [warningMinutes]);

  const hrs = Math.floor(secondsLeft / 3600);
  const mins = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;

  const isWarning = secondsLeft < warningMinutes * 60;

  const formatTime = (num: number) => String(num).padStart(2, '0');

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-3 py-1.5 md:px-4 md:py-2.5 rounded-2xl border font-mono font-bold text-caption select-none transition-all ${isWarning ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger)]/10 animate-pulse ring-2 ring-[var(--color-danger)]/20' : 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent-soft)]'}`}
    >
      <Clock
        className={`w-4 h-4 ${isWarning ? 'text-[var(--color-danger)]' : 'text-[var(--color-accent)]'}`}
      />
      <div className="flex items-center gap-0.5" dir="ltr">
        {hrs > 0 && (
          <>
            <span>{formatPersianNumber(formatTime(hrs))}</span>
            <span className="animate-pulse">:</span>
          </>
        )}
        <span>{formatPersianNumber(formatTime(mins))}</span>
        <span className="animate-pulse">:</span>
        <span>{formatPersianNumber(formatTime(secs))}</span>
      </div>
      <span className="text-micro text-current font-sans leading-none pb-0.5">زمان باقی‌مانده</span>
    </div>
  );
};

/* ==========================================
   16. PROGRESS BAR COMPONENT
   ========================================== */
interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  label?: string;
}

export const ProgressBar = ({ value, max = 100, className = '', label }: ProgressBarProps) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`w-full text-right ${className}`}>
      {label && (
        <div className="flex justify-between text-caption font-bold text-[var(--color-text-secondary)] mb-1">
          <span>{label}</span>
          <span>{formatPersianNumber(Math.round(percentage))}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-[var(--color-glass-light-stroke)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--color-accent)] transition-all duration-300 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
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
}

export const Toast = ({ message, type = 'info', onClose, duration = 4000 }: ToastProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose?.(), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const styles: Record<ToastProps['type'] & {}, string> = {
    success: 'bg-[var(--color-success)] text-white',
    error: 'bg-[var(--color-danger)] text-white',
    warning: 'bg-[var(--color-warning)] text-white',
    info: 'bg-[var(--color-ink)] text-white',
  };

  const icons: Record<ToastProps['type'] & {}, React.ReactNode> = {
    success: <CheckCircle className="w-4 h-4" />,
    error: <AlertTriangle className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    info: <Info className="w-4 h-4" />,
  };

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl shadow-lg text-label font-bold flex items-center gap-2 transition-all duration-300 ${styles[type]} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
      role="alert"
      aria-live="polite"
    >
      {icons[type]}
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="mr-2 cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

/* Re-export ChevronLeft and ChevronRight for consumers */
export { ChevronLeft, ChevronRight };
