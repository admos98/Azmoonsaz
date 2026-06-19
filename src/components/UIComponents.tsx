/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Loader2, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle 
} from 'lucide-react';
import { formatPersianNumber } from '../services/persianHelpers';

/* ==========================================
   1. BUTTON COMPONENT
   ========================================== */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'indigo';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  iconPosition = 'start',
  className = '',
  disabled,
  ...props
}, ref) => {
  const baseStyle = "inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all select-none cursor-pointer focus-visible:outline-4 focus-visible:outline-indigo-500/30 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/10",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-800",
    outline: "bg-transparent hover:bg-slate-50 border border-slate-200 text-slate-700",
    ghost: "bg-transparent hover:bg-slate-100 text-slate-600",
    danger: "bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/10",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/10",
    indigo: "bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4.5 py-2.5 text-xs md:text-sm",
    lg: "px-6 py-3.5 text-sm md:text-md"
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
});

/* ==========================================
   2. CARD COMPONENT
   ========================================== */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  children?: React.ReactNode;
  className?: string;
  id?: string;
  key?: React.Key;
}

export const Card = ({
  children,
  hoverable = false,
  className = '',
  ...props
}: CardProps) => {
  if (hoverable) {
    return (
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.995 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={`bg-white/80 backdrop-blur-sm border border-white/30 rounded-3xl p-5 md:p-6 shadow-sm hover:shadow-lg hover:shadow-indigo-100/40 ${className}`}
        {...(props as any)}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <div
      className={`bg-white/80 backdrop-blur-sm border border-white/30 rounded-3xl p-5 md:p-6 shadow-sm ${className}`}
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
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'slate' | 'info';
  children: React.ReactNode;
  className?: string;
}

export const Badge = ({
  variant = 'slate',
  children,
  className = ''
}: BadgeProps) => {
  const styles = {
    primary: "bg-indigo-55 bg-indigo-50 text-indigo-700 border-indigo-100",
    success: "bg-emerald-50 text-emerald-700 border-emerald-110",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    danger: "bg-rose-50 text-rose-700 border-rose-100",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
    info: "bg-blue-50 text-blue-700 border-blue-100"
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border leading-none ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
};

/* ==========================================
   4. STATUS BADGE COMPONENT
   ========================================== */
interface StatusBadgeProps {
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'ongoing' | 'submitted' | 'graded' | 'absent';
  className?: string;
}

export const StatusBadge = ({ status, className = '' }: StatusBadgeProps) => {
  const config = {
    draft: { variant: 'slate' as const, label: 'پیش‌نویس' },
    scheduled: { variant: 'info' as const, label: 'زمان‌بندی شده' },
    active: { variant: 'success' as const, label: 'فعال / در حال برگزاری' },
    completed: { variant: 'primary' as const, label: 'پایان یافته' },
    ongoing: { variant: 'warning' as const, label: 'در حال آزمون' },
    submitted: { variant: 'info' as const, label: 'تحویل داده شده' },
    graded: { variant: 'success' as const, label: 'تصحیح شده' },
    absent: { variant: 'danger' as const, label: 'غایب' }
  };

  const item = config[status] || { variant: 'slate' as const, label: String(status) };

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

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  icon,
  id,
  className = '',
  wrapperClassName = '',
  type = 'text',
  ...props
}, ref) => {
  const inputId = id || `input-${Date.now()}`;
  return (
    <div className={`space-y-1.5 text-right w-full ${wrapperClassName}`}>
      {label && (
        <label htmlFor={inputId} className="block text-xs md:text-sm font-bold text-slate-700">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          ref={ref}
          type={type}
          className={`w-full text-xs md:text-sm px-4 py-2.5 bg-slate-50/50 hover:bg-slate-50 border rounded-xl outline-hidden focus:border-indigo-500 transition-all text-slate-800 placeholder-slate-400 ${
            error ? 'border-rose-350 focus:border-rose-500' : 'border-slate-200'
          } ${icon ? 'pr-11' : ''} ${className}`}
          {...props}
        />
        {icon && (
          <div className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none">
            {icon}
          </div>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1 mt-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </p>
      )}
      {!error && helperText && (
        <p className="text-[11px] text-slate-400 font-semibold">{helperText}</p>
      )}
    </div>
  );
});

/* ==========================================
   6. SELECT COMPONENT
   ========================================== */
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  wrapperClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  options,
  id,
  className = '',
  wrapperClassName = '',
  ...props
}, ref) => {
  const selectId = id || `select-${Date.now()}`;
  return (
    <div className={`space-y-1.5 text-right w-full ${wrapperClassName}`}>
      {label && (
        <label htmlFor={selectId} className="block text-xs md:text-sm font-bold text-slate-700">
          {label}
        </label>
      )}
      <select
        id={selectId}
        ref={ref}
        className={`w-full text-xs md:text-sm px-4 py-2.5 bg-slate-50/50 hover:bg-slate-50 border rounded-xl outline-hidden focus:border-indigo-500 transition-all text-slate-800 ${
          error ? 'border-rose-350 focus:border-rose-500' : 'border-slate-200'
        } ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1 mt-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
});

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
  onChange: (id: string | any) => void;
  className?: string;
}

export const Tabs = ({
  tabs,
  activeTab,
  onChange,
  className = ''
}: TabsProps) => {
  return (
    <div className={`flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl w-fit ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer select-none ${
              isActive 
                ? 'bg-white text-indigo-700 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
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
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'md'
}: ModalProps) => {
  
  const widthStyles = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl"
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className={`relative bg-white/90 backdrop-blur-xl w-full ${widthStyles[maxWidth]} rounded-3xl shadow-2xl border border-white/30 overflow-hidden flex flex-col max-h-[90vh] z-10`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-105">
              <h3 className="text-sm md:text-md font-black text-slate-800 text-right">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto text-xs md:text-sm text-slate-600 leading-relaxed text-right">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-105 flex items-center justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

/* ==========================================
   9. CONSTANT DRAWER COMPONENT
   ========================================== */
interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  placement?: 'left' | 'right';
  children: React.ReactNode;
}

export const Drawer = ({
  isOpen,
  onClose,
  title,
  placement = 'right',
  children
}: DrawerProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-3xs"
          />

          {/* Drawer container body */}
          <div className={`absolute inset-y-0 ${placement === 'right' ? 'right-0' : 'left-0'} max-w-full flex`}>
            <motion.div
              initial={{ x: placement === 'right' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: placement === 'right' ? '100%' : '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="w-screen max-w-md bg-white shadow-2xl flex flex-col divide-y divide-slate-105"
            >
              {/* Head */}
              <div className="p-6 flex items-center justify-between">
                <h2 className="text-md font-black text-slate-800">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Children scroll */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs md:text-sm">
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
      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
      
      {/* Animated active path */}
      <div 
        className="absolute top-1/2 right-0 h-0.5 bg-indigo-600 -translate-y-1/2 z-0 transition-all duration-500"
        style={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
      />

      {steps.map((step, idx) => {
        const isCompleted = idx < activeStep;
        const isActive = idx === activeStep;
        return (
          <div key={idx} className="flex flex-col items-center gap-2 z-10 relative">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs select-none ring-4 ring-white transition-all duration-300 ${
                isCompleted 
                  ? 'bg-indigo-600 text-white' 
                  : isActive 
                    ? 'bg-white border-2 border-indigo-600 text-indigo-700 font-extrabold' 
                    : 'bg-slate-50 border-2 border-slate-200 text-slate-400'
              }`}
            >
              {isCompleted ? '✓' : formatPersianNumber(idx + 1)}
            </div>
            <span className={`text-[10px] md:text-xs font-bold transition-all duration-300 ${isActive ? 'text-indigo-600 font-black' : isCompleted ? 'text-slate-600' : 'text-slate-400'}`}>
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

export const EmptyState = ({
  icon,
  title,
  description,
  action
}: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-10 md:p-14 border border-dashed border-slate-200 bg-slate-50/50 rounded-3xl space-y-4">
      <div className="p-4 bg-indigo-50 text-indigo-500 rounded-full">
        {icon || <HelpCircle className="w-8 h-8" />}
      </div>
      <div className="space-y-1 w-full max-w-sm">
        <h4 className="text-sm md:text-md font-bold text-slate-800">{title}</h4>
        <p className="text-xs text-slate-400 font-medium leading-relaxed">{description}</p>
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
  variant = 'danger'
}: ConfirmDialogProps) => {
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
        <div className={`p-2.5 rounded-full ${variant === 'danger' ? 'bg-rose-50 text-rose-605' : 'bg-indigo-50 text-indigo-500'}`}>
          <AlertTriangle className="w-5 h-5 text-current" />
        </div>
        <div className="space-y-1">
          <p className="font-bold text-slate-800 text-xs md:text-sm">{title}</p>
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">{message}</p>
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
  label = 'بارگذاری فایل اکسل و اسناد اکسل دانش‌آموزان',
  description = 'فایل را به اینجا بکشید یا برای انتخاب فایل کلیک کنید'
}: FileDropzoneProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
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
      className={`border-2 border-dashed rounded-3xl p-8 hover:border-indigo-500 hover:bg-slate-50/50 transition-all text-center cursor-pointer flex flex-col items-center justify-center space-y-3 ${
        isDragActive ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200 bg-white'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
      <div className="p-3 bg-indigo-50 rounded-full text-indigo-500">
        <UploadCloud className="w-6 h-6" />
      </div>
      <div>
        <p className="text-xs md:text-sm font-bold text-slate-800">{label}</p>
        <p className="text-[11px] text-slate-400 font-medium mt-1">{description}</p>
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

interface TableProps {
  headers: TableColumn[];
  data: any[];
  renderRow: (row: any, idx: number) => React.ReactNode;
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
  emptyDesc = 'اطلاعاتی سازگار با فیلترهای کنونی در سیستم وجود ندارد.'
}: TableProps) => {
  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDesc} />;
  }

  return (
    <div className="w-full">
      {/* Table for Desktop Viewports */}
      <div className={`overflow-x-auto rounded-2xl border border-slate-100 hidden ${renderMobileCard ? 'md:block' : 'block'}`}>
        <table className="w-full text-right border-collapse text-xs md:text-sm bg-white">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-[11px] md:text-xs">
              {headers.map((col, idx) => {
                const alignStyles = {
                  right: "text-right",
                  center: "text-center",
                  left: "text-left"
                };
                return (
                  <th key={col.key} className={`p-4 font-bold ${alignStyles[col.align || 'right']} ${idx === 0 ? 'rounded-r-2xl' : ''} ${idx === headers.length - 1 ? 'rounded-l-2xl' : ''}`}>
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
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
  warningMinutes = 5
}: ExamTimerProps) => {
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const onTimeoutRef = useRef(onTimeout);
  const onWarningRef = useRef(onWarning);

  // Sync refs to prevent resetting timer on prop changes
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    onWarningRef.current = onWarning;
  }, [onWarning]);

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
    <div className={`inline-flex items-center gap-2.5 px-3 py-1.5 md:px-4 md:py-2.5 rounded-2xl border font-mono font-bold text-xs select-none transition-all ${
      isWarning 
        ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse ring-2 ring-rose-500/20' 
        : 'bg-indigo-50 text-indigo-700 border-indigo-100'
    }`}>
      <Clock className={`w-4 h-4 ${isWarning ? 'text-rose-605' : 'text-indigo-650'}`} />
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
      <span className="text-[10px] text-current font-sans leading-none pb-0.5">زمان باقی‌مانده</span>
    </div>
  );
};
