/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LayoutDashboard, Users, HelpCircle, FileText, CheckSquare, Settings, LogOut, GraduationCap, ArrowLeftRight } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { mockTeacher } from '../mockData';
import { Teacher } from '../types';
import { authService } from '../services/api';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  onSwitchRole: () => void;
}

export default function Sidebar({ currentTab, onTabChange, onLogout, onSwitchRole }: SidebarProps) {
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
    { id: 'classes', label: 'مدیریت کلاس‌ها', icon: GraduationCap },
    { id: 'students', label: 'دانش‌آموزان', icon: Users },
    { id: 'questions', label: 'بانک سوالات', icon: HelpCircle },
    { id: 'exams', label: 'آزمون‌ها', icon: FileText },
    { id: 'results', label: 'نتایج و تصحیح', icon: CheckSquare },
    { id: 'settings', label: 'تنظیمات سامانه', icon: Settings },
  ];

  return (
    <aside className="fixed inset-y-0 right-0 z-20 w-64 bg-white/80 backdrop-blur-xl border-l border-slate-200/60 flex flex-col justify-between text-slate-700 shadow-xl transition-all select-none" id="sidebar-container">
      <div>
        {/* Logo / Header */}
        <div className="h-24 flex items-center gap-3 px-6 border-b border-slate-100/50" id="logo-section">
          <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 ring-4 ring-indigo-50">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">آزمون‌ساز</h1>
            <p className="text-[10px] font-medium text-slate-400">پنل مدیریت دبیران</p>
          </div>
        </div>

        {/* Teacher Mini Profile */}
        <div className="p-4 mx-4 my-6 bg-indigo-50/40 rounded-3xl border border-indigo-100/50 flex items-center space-x-3 space-x-reverse shadow-sm" id="sidebar-profile">
          <img
            src={teacher.avatarUrl}
            alt={teacher.name}
            referrerPolicy="no-referrer"
            className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm ring-2 ring-indigo-100"
          />
          <div className="flex-1 overflow-hidden">
            <h4 className="text-xs font-bold text-slate-800 truncate">{teacher.name}</h4>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">{teacher.schoolName}</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="px-4 space-y-1.5" id="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id || (item.id === 'exams' && currentTab.startsWith('exams'));
            return (
              <motion.button
                key={item.id}
                whileHover={{ x: -4 }}
                whileTap={{ scale: 0.98 }}
                id={`sidebar-item-${item.id}`}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 relative group cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center space-x-3 space-x-reverse">
                  <Icon className={`w-4 h-4 mr-0.5 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    className="w-1.5 h-5 bg-white rounded-full"
                  />
                )}
              </motion.button>
            );
          })}
        </nav>
      </div>

      {/* Footer Area */}
      <div className="p-6 border-t border-slate-100/60 space-y-4" id="sidebar-footer">
        {/* Subscription box */}
        <div className="p-4 bg-slate-900 rounded-3xl text-white relative overflow-hidden shadow-xl shadow-slate-200">
          <div className="relative z-10 text-right">
            <p className="text-[10px] text-slate-400 mb-1">اشتراک فعال</p>
            <p className="text-xs font-black tracking-tight">نسخه حرفه‌ای (طلایی)</p>
          </div>
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-indigo-500/20 rounded-full blur-2xl"></div>
        </div>

        {/* Switch Role Trigger */}
        <button
          id="btn-switch-role"
          onClick={onSwitchRole}
          className="w-full flex items-center justify-center space-x-2 space-x-reverse py-3 px-4 rounded-2xl text-xs bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all font-bold cursor-pointer shadow-sm"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
          <span>بخش دانش‌آموزی</span>
        </button>

        {/* Logout */}
        <button
          id="btn-logout"
          onClick={onLogout}
          className="w-full flex items-center justify-center space-x-2 space-x-reverse py-2 px-3 rounded-xl text-xs text-rose-500 hover:bg-rose-50 transition-colors font-semibold cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>خروج از سامانه</span>
        </button>
      </div>
    </aside>
  );
}
