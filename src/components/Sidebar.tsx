/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LayoutDashboard,
  Users,
  GraduationCap,
  HelpCircle,
  FileText,
  CheckSquare,
  Settings,
  LogOut,
  ArrowLeftRight,
  Menu,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTeacher } from '../contexts/TeacherContext';
import { TheMark } from './TheMark';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  onSwitchRole: () => void;
}

type NavGroup = {
  label: string;
  items: { id: string; label: string; icon: typeof LayoutDashboard }[];
};

const navGroups: NavGroup[] = [
  {
    label: 'مدیریت',
    items: [
      { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
      { id: 'classes', label: 'کلاس‌ها', icon: GraduationCap },
      { id: 'students', label: 'دانش‌آموزان', icon: Users },
    ],
  },
  {
    label: 'آزمون‌ها',
    items: [
      { id: 'questions', label: 'بانک سوالات', icon: HelpCircle },
      { id: 'exams', label: 'آزمون‌ها', icon: FileText },
      { id: 'results', label: 'نتایج', icon: CheckSquare },
    ],
  },
  {
    label: 'تنظیمات',
    items: [
      { id: 'settings', label: 'تنظیمات سامانه', icon: Settings },
    ],
  },
];

export default function Sidebar({ currentTab, onTabChange, onLogout, onSwitchRole }: SidebarProps) {
  const { teacher } = useTeacher();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (id: string) =>
    currentTab === id || (id === 'exams' && currentTab.startsWith('exams'));

  const navContent = (
    <>
      {/* TheMark Logo */}
      <div className="h-20 flex items-center gap-3 px-6" id="logo-section">
        <TheMark variant="row" size={48} animated={true} />
        <div>
          <h1 className="text-lg font-black text-[var(--color-text-on-dark)] tracking-tight">آزمون‌ساز</h1>
          <p className="text-[10px] font-medium text-[var(--color-text-on-dark-secondary)]">پنل مدیریت دبیران</p>
        </div>
      </div>

      {/* Teacher Profile */}
      <div className="mx-4 my-4 p-3 rounded-xl bg-white/5 border border-white/8 flex items-center gap-3" id="sidebar-profile">
        {teacher?.avatarUrl ? (
          <img
            src={teacher.avatarUrl}
            alt={teacher.name}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover border-2 border-white/10"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/20 border-2 border-white/10 flex items-center justify-center text-[var(--color-accent)] text-sm font-bold">
            {teacher?.name?.[0] || '?'}
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <h4 className="text-xs font-bold text-[var(--color-text-on-dark)] truncate">{teacher?.name || '...'}</h4>
          <p className="text-[10px] text-[var(--color-text-on-dark-secondary)] truncate mt-0.5">{teacher?.schoolName || ''}</p>
        </div>
      </div>

      {/* Grouped Navigation */}
      <nav className="px-4 space-y-5 flex-1" id="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-2 text-[10px] font-bold tracking-wider text-[var(--color-text-on-dark-secondary)] uppercase">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.id);
                return (
                  <motion.button
                    key={item.id}
                    whileHover={{ x: -2 }}
                    whileTap={{ scale: 0.98 }}
                    id={`sidebar-item-${item.id}`}
                    onClick={() => {
                      onTabChange(item.id);
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative cursor-pointer ${
                      active
                        ? 'bg-white/12 text-white shadow-sm'
                        : 'text-[var(--color-text-on-dark-secondary)] hover:bg-white/6 hover:text-[var(--color-text-on-dark)]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 transition-transform ${active ? 'text-[var(--color-gold)]' : ''}`} />
                    <span>{item.label}</span>
                    {active && (
                      <motion.div
                        layoutId="sidebar-active-pill"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[var(--color-gold)] rounded-r-full"
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );

  const footerContent = (
    <div className="p-4 space-y-2 border-t border-white/8">
      {/* Switch Role */}
      <button
        id="btn-switch-role"
        onClick={() => { onSwitchRole(); setMobileOpen(false); }}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs bg-white/8 text-[var(--color-text-on-dark-secondary)] hover:bg-white/12 hover:text-[var(--color-text-on-dark)] transition-all font-bold cursor-pointer"
      >
        <ArrowLeftRight className="w-3.5 h-3.5" />
        <span>بخش دانش‌آموزی</span>
      </button>

      {/* Logout */}
      <button
        id="btn-logout"
        onClick={() => { onLogout(); setMobileOpen(false); }}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-colors font-semibold cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>خروج از سامانه</span>
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile Hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl glass-1 shadow-lg cursor-pointer"
        onClick={() => setMobileOpen(true)}
        aria-label="باز کردن منو"
      >
        <Menu className="w-5 h-5 text-[var(--color-text-primary)]" />
      </button>

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex fixed inset-y-0 right-0 z-30 w-60 flex-col lg-dark text-[var(--color-text-on-dark)] select-none"
                id="sidebar-container"
      >
        {navContent}
        {footerContent}
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="lg:hidden fixed inset-y-0 right-0 z-50 w-72 flex flex-col lg-strong text-[var(--color-text-on-dark)] select-none"
                        id="sidebar-container-mobile"
          >
            {/* Close button */}
            <button
              className="absolute top-4 left-4 p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
              onClick={() => setMobileOpen(false)}
              aria-label="بستن منو"
            >
              <X className="w-5 h-5" />
            </button>
            {navContent}
            {footerContent}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
