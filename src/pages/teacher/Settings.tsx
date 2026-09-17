/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
import { useTeacher } from '../../contexts/TeacherContext';
import { isSecureBackendMode, getRuntimeModeLabel } from '../../config/runtimeMode';
import { publicEnv } from '../../config/env';

export default function Settings() {
  const { teacher, loading, updateTeacher } = useTeacher();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSchoolName, setEditSchoolName] = useState('');
  const [saving, setSaving] = useState(false);

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
    updateTeacher({ name: editName, schoolName: editSchoolName });
    setIsEditing(false);
    setSaving(false);
  };

  const isSecure = isSecureBackendMode();
  const modeLabel = getRuntimeModeLabel();
  const supabaseConfigured = publicEnv.isSupabaseConfigured;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-white/6 rounded-xl animate-pulse" />
        <div className="h-40 bg-white/4 rounded-3xl animate-pulse" />
        <div className="h-40 bg-white/4 rounded-3xl animate-pulse" />
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
          <div className="p-2.5 bg-[var(--color-accent-soft)] rounded-xl text-indigo-600">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[var(--color-text-primary)]">تنظیمات سامانه</h2>
            <p className="text-xs text-[var(--color-text-tertiary)] font-medium mt-0.5">
              مدیریت پروفایل و وضعیت سیستم
            </p>
          </div>
        </div>
      </div>

      {/* Teacher Profile Card */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--color-accent)]" />
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
            <div className="flex items-center gap-4 p-4 bg-white/3 rounded-2xl">
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
                    <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{teacher.name}</h4>
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{teacher.schoolName}</p>
                  </>
                )}
              </div>
            </div>

            {!isEditing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 bg-white/3 rounded-xl">
                  <Mail className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                  <div>
                    <p className="text-[10px] text-[var(--color-text-tertiary)] font-bold">ایمیل</p>
                    <p className="text-xs text-[var(--color-text-secondary)] font-semibold">{teacher.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white/3 rounded-xl">
                  <School className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                  <div>
                    <p className="text-[10px] text-[var(--color-text-tertiary)] font-bold">شناسه دبیر</p>
                    <p className="text-xs text-[var(--color-text-secondary)] font-semibold font-mono" dir="ltr">{teacher.id}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Runtime Status Card */}
      <Card>
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2 mb-5">
          <Server className="w-4 h-4 text-[var(--color-accent)]" />
          وضعیت سیستم
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-white/3 rounded-2xl">
            <div className={`p-2 rounded-full ${isSecure ? 'bg-[var(--color-success-soft)] text-emerald-600' : 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]'}`}>
              {isSecure ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-tertiary)] font-bold">حالت اجرا</p>
              <p className="text-xs text-[var(--color-text-secondary)] font-bold">{modeLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-white/3 rounded-2xl">
            <div className={`p-2 rounded-full ${supabaseConfigured ? 'bg-[var(--color-success-soft)] text-emerald-600' : 'bg-white/4 text-[var(--color-text-tertiary)]'}`}>
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-tertiary)] font-bold">سوپابیس</p>
              <Badge variant={supabaseConfigured ? 'success' : 'slate'}>
                {supabaseConfigured ? 'پیکربندی شده' : 'پیکربندی نشده'}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-white/3 rounded-2xl">
            <div className="p-2 rounded-full bg-[var(--color-success-soft)] text-emerald-600">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-tertiary)] font-bold">حالت آزمایشی</p>
              <Badge variant="success">
                غیرفعال
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* App Info Card */}
      <Card>
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-[var(--color-accent)]" />
          درباره برنامه
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-white/3 rounded-xl">
            <p className="text-[10px] text-[var(--color-text-tertiary)] font-bold">نام سامانه</p>
            <p className="text-xs text-[var(--color-text-secondary)] font-bold mt-1">آزمون‌ساز</p>
          </div>
          <div className="p-3 bg-white/3 rounded-xl">
            <p className="text-[10px] text-[var(--color-text-tertiary)] font-bold">نسخه</p>
            <p className="text-xs text-[var(--color-text-secondary)] font-bold mt-1">۰.۱.۰</p>
          </div>
          <div className="p-3 bg-white/3 rounded-xl">
            <p className="text-[10px] text-[var(--color-text-tertiary)] font-bold">فریمورک</p>
            <p className="text-xs text-[var(--color-text-secondary)] font-bold mt-1">React 19 + Vite</p>
          </div>
          <div className="p-3 bg-white/3 rounded-xl">
            <p className="text-[10px] text-[var(--color-text-tertiary)] font-bold">میزبانی</p>
            <p className="text-xs text-[var(--color-text-secondary)] font-bold mt-1">Vercel</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
