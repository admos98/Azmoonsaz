/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LayoutDashboard, Users, HelpCircle, FileText, CheckSquare, Settings, LogOut, GraduationCap, ArrowLeftRight } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { mockTeacher } from '../mockData';
import { Teacher } from '../types';
import { authService } from '../services/api';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  onSwitchRole: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ currentTab, onTabChange, onLogout, onSwitchRole, isOpen = false, onClose }: SidebarProps) {
  const [teacher, setTeacher] = useState<Teacher>(mockTeacher);

  useEffect(() => {
    let active = true;
    authService.getCurrentTeacher()
      .then((current) => {
        if (active && current) setTeacher({ ...mockTeacher, ...current });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
    { id: 'students', label: 'دانش‌آموزان', icon: Users },
    { id: 'questions', label: 'بانک سوالات', icon: HelpCircle },
    { id: 'exams', label: 'آزمون‌ها', icon: FileText },
    { id: 'results', label: 'نتایج و تصحیح', icon: CheckSquare },
    { id: 'settings', label: 'تنظیمات سامانه', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div>
        {/* Logo / Header */}
        <div className="h-20 flex items-center gap-3 px-6 border-b border-slate-100" id="logo-section">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <GraduationCap className="w-5.5 h-5.5" />
          </div>
          <div>
            <h1 className="text-md font-bold text-slate-800 tracking-tight">آزمون‌ساز</h1>
            <p className="text-[10px] text-slate-400">پنل مدیریت دبیران</p>
          </div>
        </div>

        {/* Teacher Mini Profile */}
        <div className="p-4 mx-3 my-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center space-x-3 space-x-reverse shadow-2xs" id="sidebar-profile">
          <img
            src={teacher.avatarUrl}
            alt={teacher.name}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
          />
          <div className="flex-1 overflow-hidden">
            <h4 className="text-xs font-bold text-slate-800 truncate">{teacher.name}</h4>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">{teacher.schoolName}</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="px-4 space-y-1" id="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id || (item.id === 'exams' && currentTab.startsWith('exams'));
            return (
              <button
                key={item.id}
                id={`sidebar-item-${item.id}`}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative group cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3 space-x-reverse">
                  <Icon className={`w-4 h-4 mr-0.5 transition-transform group-hover:scale-105 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Area */}
      <div className="p-4 border-t border-slate-100 space-y-3 mt-auto" id="sidebar-footer">
        {/* Subscription box */}
        <div className="p-4 bg-slate-900 rounded-2xl text-white relative overflow-hidden">
          <div className="relative z-10 text-right">
            <p className="text-[10px] text-slate-400 mb-0.5">اشتراک فعلی</p>
            <p className="text-xs font-bold">نسخه حرفه‌ای (طلایی)</p>
          </div>
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
        </div>

        {/* Switch Role Trigger */}
        <button
          id="btn-switch-role"
          onClick={onSwitchRole}
          className="w-full flex items-center justify-center space-x-2 space-x-reverse py-2.5 px-3 rounded-xl text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors font-bold cursor-pointer"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>بخش دانش‌آموزی (آزمون)</span>
        </button>

        {/* Logout */}
        <button
          id="btn-logout"
          onClick={onLogout}
          className="w-full flex items-center justify-center space-x-2 space-x-reverse py-2 px-3 rounded-xl text-xs text-rose-600 hover:bg-rose-50 transition-colors font-semibold cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>خروج از پنل</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — always visible on md+ */}
      <aside className="hidden md:flex fixed inset-y-0 right-0 z-20 w-64 bg-white border-l border-slate-200 flex-col justify-between text-slate-700 shadow-xs select-none" id="sidebar-container">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar — slides in from right with backdrop */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="md:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            />

            {/* Sliding panel */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="md:hidden fixed inset-y-0 right-0 z-50 w-64 bg-white border-l border-slate-200 shadow-2xl flex flex-col text-slate-700 select-none"
              id="sidebar-container-mobile"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
