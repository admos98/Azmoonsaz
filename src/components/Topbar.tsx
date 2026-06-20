/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Search, Bell, Sun, ArrowLeftRight } from 'lucide-react';
import { mockTeacher } from '../mockData';
import BackendModeBadge from './BackendModeBadge';
import { Teacher } from '../types';
import { authService } from '../services/api';
import { formatPersianDate } from '../services/persianHelpers';


interface TopbarProps {
  currentTab: string;
  onSwitchRole: () => void;
  onLogout: () => void;
  activeExamNotifications?: number;
}

export default function Topbar({ currentTab, onSwitchRole, onLogout, activeExamNotifications = 2 }: TopbarProps) {
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

  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Format Persian title based on the active route
  const getTabTitle = () => {
    if (currentTab === 'dashboard') return 'داشبورد مدیریتی و گزارشات';
    if (currentTab === 'students') return 'مدیریت و بانک اطلاعات دانش‌آموزان';
    if (currentTab === 'questions') return 'بانک جامع سوالات چندگزینه‌ای و تشریحی';
    if (currentTab.startsWith('exams/new')) return 'طراحی و ساخت آزمون جدید آنلاین';
    if (currentTab.startsWith('exams') && currentTab.includes('/settings')) return 'تنظیمات تخصصی آزمون';
    if (currentTab.startsWith('exams') && currentTab.includes('/preview')) return 'پیش‌نمایش زنده آزمون طراحی‌شده';
    if (currentTab.startsWith('exams') && currentTab.includes('/results')) return 'نتایج، کارنامه و تصحیح پاسخ‌برگ‌ها';
    if (currentTab === 'exams') return 'مدیریت آزمون‌های دوره‌ای و جامع';
    if (currentTab === 'results') return 'نتایج ارزیابی و تصحیح مکانیزه پاسخ‌ها';
    if (currentTab === 'settings') return 'تنظیمات حساب کاربری و سامانه';
    return 'پنل مدیریت آزمون‌ساز';
  };

const getPersianDateString = () => {
    return formatPersianDate(new Date().toISOString());
  };

  return (
    <header className="sticky top-0 z-10 h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-2xs select-none" id="topbar-wrapper">
      {/* Search Bar & Title */}
      <div className="flex items-center space-x-8 space-x-reverse" id="topbar-left-side">
        <div className="hidden lg:block">
          <h2 className="text-md font-bold text-slate-850">{getTabTitle()}</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">{getPersianDateString()}</p>
        </div>

        {/* Search Bar Input */}
        <div className="relative w-64 lg:w-80 group max-sm:hidden">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
          <input
            type="text"
            id="global-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در سیستم..."
            className="w-full bg-slate-100 border-none text-xs text-slate-705 pr-10 pl-4 py-2.5 rounded-full focus:outline-hidden focus:ring-0 focus:bg-slate-150 transition-all placeholder-slate-400"
          />
        </div>
      </div>

      {/* Notifications, Settings & Actions */}
      <div className="flex items-center space-x-4 space-x-reverse" id="topbar-actions-right">
        <div className="max-lg:hidden"><BackendModeBadge /></div>
        {/* Switch Role Trigger Quick */}
        <button
          id="quick-role-switch"
          onClick={onSwitchRole}
          className="flex items-center space-x-2 space-x-reverse px-4 py-2 rounded-xl text-xs font-bold border border-indigo-100 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-all cursor-pointer"
          title="سوییچ به آزمون دانش‌آموز"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span className="max-md:hidden">شبیه‌ساز آزمون دانش‌آموز</span>
        </button>

        {/* Notifications Icon Button */}
        <div className="relative">
          <button
            id="notifications-bell-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-100/90 hover:bg-slate-150 rounded-full relative transition-colors cursor-pointer"
          >
            <Bell className="w-4.5 h-4.5" />
            {activeExamNotifications > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute left-0 mt-3 w-80 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100 animate-in fade-in slide-in-from-top-3 duration-250" id="notification-dropdown">
              <div className="p-3.5 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">اطلاعیه‌ها و رویدادها</span>
                <span className="text-[10px] bg-slate-200/80 text-slate-600 px-2 py-0.5 rounded-full">۲ جدید</span>
              </div>
              <div className="max-h-64 overflow-y-auto text-xs divide-y divide-slate-100">
                <div className="p-3 hover:bg-slate-50/70 transition-colors">
                  <p className="font-semibold text-slate-700">تحویل آزمون تجربی هفتم</p>
                  <p className="text-[11px] text-slate-500 mt-1">امیرحسین رضایی پاسخ‌برگ خود را ارسال نمود.</p>
                  <span className="text-[9px] text-slate-400 mt-2 block">۱۰ دقیقه پیش</span>
                </div>
                <div className="p-3 hover:bg-slate-50/70 transition-colors">
                  <p className="font-semibold text-slate-700">آزمون ادبیات فارسی نهم</p>
                  <p className="text-[11px] text-slate-500 mt-1">مریم احمدی آماده تصحیح بخش سئوال تشریحی است.</p>
                  <span className="text-[9px] text-slate-400 mt-2 block">۱ ساعت پیش</span>
                </div>
              </div>
              <div className="p-2.5 bg-slate-50 text-center">
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-[11px] text-indigo-600 font-semibold hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  بستن اطلاعیه‌ها
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Micro Theme indicator icon */}
        <div className="p-2.5 text-slate-500 bg-slate-100 rounded-full flex items-center justify-center max-sm:hidden">
          <Sun className="w-4.5 h-4.5 text-indigo-600" />
        </div>

        {/* Separator */}
        <span className="w-px h-8 bg-slate-200 max-sm:hidden" />

        {/* Teacher Micro Avatar info */}
        <div className="flex items-center gap-3 cursor-pointer pl-2">
          <div className="text-right max-md:hidden">
            <p className="text-sm font-bold text-slate-800 leading-tight">{teacher.name}</p>
            <p className="text-[10px] text-slate-500 text-right mt-0.5">{teacher.schoolName}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-100 border-2 border-indigo-200 flex items-center justify-center text-indigo-700 font-bold overflow-hidden shadow-xs">
            <img
              src={teacher.avatarUrl}
              alt={teacher.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
