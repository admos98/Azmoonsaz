/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Settings as SettingsIcon,
  User,
  School,
  Mail,
  Server,
  Shield,
  Wifi,
  WifiOff,
  Info,
  CheckCircle,
  AlertTriangle,
  Edit3,
  Save,
  X
} from 'lucide-react';
import { Card, Button, Input, Badge } from '../../components/UIComponents';
import { Teacher } from '../../types';
import { authService } from '../../services/api';
import { isSecureBackendMode, getRuntimeModeLabel } from '../../config/runtimeMode';
import { publicEnv } from '../../config/env';

export default function Settings() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSchoolName, setEditSchoolName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadTeacher = async () => {
      setLoading(true);
      try {
        const current = await authService.getCurrentTeacher();
        setTeacher(current);
      } catch (err) {
        console.error('Error loading teacher:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTeacher();
  }, []);

  const handleStartEdit = () => {
    if (!teacher) return;
    setEditName(teacher.name);
    setEditSchoolName(teacher.schoolName);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!teacher) return;
    setSaving(true);
    const updated: Teacher = { ...teacher, name: editName, schoolName: editSchoolName };
    localStorage.setItem('azmoonsaz_current_teacher', JSON.stringify(updated));
    setTeacher(updated);
    setIsEditing(false);
    setSaving(false);
  };

  const isSecure = isSecureBackendMode();
  const modeLabel = getRuntimeModeLabel();
  const supabaseConfigured = publicEnv.isSupabaseConfigured;
  const mockModeEnabled = publicEnv.enableMockMode;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded-xl animate-pulse" />
        <div className="h-40 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-40 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      dir="rtl"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800">تنظیمات سامانه</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              مدیریت پروفایل و وضعیت سیستم
            </p>
          </div>
        </div>
      </div>

      {/* Teacher Profile Card */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-500" />
            پروفایل دبیر
          </h3>
          {!isEditing && (
            <Button variant="ghost" size="sm" icon={<Edit3 className="w-3.5 h-3.5" />} onClick={handleStartEdit}>
              ویرایش
            </Button>
          )}
        </div>

        {teacher && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
              <img
                src={teacher.avatarUrl}
                alt={teacher.name}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md"
              />
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-3">
                    <Input
                      label="نام و نام خانوادگی"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      icon={<User className="w-4 h-4" />}
                    />
                    <Input
                      label="نام مدرسه"
                      value={editSchoolName}
                      onChange={(e) => setEditSchoolName(e.target.value)}
                      icon={<School className="w-4 h-4" />}
                    />
                    <div className="flex items-center gap-2 pt-1">
                      <Button variant="primary" size="sm" isLoading={saving} icon={<Save className="w-3.5 h-3.5" />} onClick={handleSave}>
                        ذخیره
                      </Button>
                      <Button variant="ghost" size="sm" icon={<X className="w-3.5 h-3.5" />} onClick={handleCancelEdit}>
                        انصراف
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h4 className="text-sm font-bold text-slate-800">{teacher.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{teacher.schoolName}</p>
                  </>
                )}
              </div>
            </div>

            {!isEditing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold">ایمیل</p>
                    <p className="text-xs text-slate-700 font-semibold">{teacher.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <School className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold">شناسه دبیر</p>
                    <p className="text-xs text-slate-700 font-semibold font-mono" dir="ltr">{teacher.id}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Runtime Status Card */}
      <Card>
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-5">
          <Server className="w-4 h-4 text-indigo-500" />
          وضعیت سیستم
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
            <div className={`p-2 rounded-full ${isSecure ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              {isSecure ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold">حالت اجرا</p>
              <p className="text-xs text-slate-700 font-bold">{modeLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
            <div className={`p-2 rounded-full ${supabaseConfigured ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold">سوپابیس</p>
              <Badge variant={supabaseConfigured ? 'success' : 'slate'}>
                {supabaseConfigured ? 'پیکربندی شده' : 'پیکربندی نشده'}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
            <div className={`p-2 rounded-full ${mockModeEnabled ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {mockModeEnabled ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold">حالت آزمایشی</p>
              <Badge variant={mockModeEnabled ? 'warning' : 'success'}>
                {mockModeEnabled ? 'فعال' : 'غیرفعال'}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* App Info Card */}
      <Card>
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-indigo-500" />
          درباره برنامه
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-[10px] text-slate-400 font-bold">نام سامانه</p>
            <p className="text-xs text-slate-700 font-bold mt-1">آزمون‌ساز</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-[10px] text-slate-400 font-bold">نسخه</p>
            <p className="text-xs text-slate-700 font-bold mt-1">۰.۱.۰</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-[10px] text-slate-400 font-bold">فریمورک</p>
            <p className="text-xs text-slate-700 font-bold mt-1">React 19 + Vite</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-[10px] text-slate-400 font-bold">میزبانی</p>
            <p className="text-xs text-slate-700 font-bold mt-1">Vercel</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
