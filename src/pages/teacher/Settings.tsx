/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  Settings as SettingsIcon,
  Server,
  Shield,
  Wifi,
  WifiOff,
  Info,
  CheckCircle,
} from 'lucide-react';
import { Card, Badge } from '../../components/UIComponents';
import { isSecureBackendMode, getRuntimeModeLabel } from '../../config/runtimeMode';
import { publicEnv } from '../../config/env';

export default function Settings() {
  const isSecure = isSecureBackendMode();
  const modeLabel = getRuntimeModeLabel();
  const supabaseConfigured = publicEnv.isSupabaseConfigured;



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
          <div className="p-2.5 bg-[var(--color-accent-soft)] rounded-xl text-[var(--color-accent)]">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-heading-3 font-black text-[var(--color-text-primary)]">
              تنظیمات سامانه
            </h2>
            <p className="text-caption text-[var(--color-text-tertiary)] font-medium mt-0.5">
              وضعیت اجرا، امنیت و اطلاعات سامانه
            </p>
          </div>
        </div>
      </div>

      {/* Runtime Status Card */}
      <Card>
        <h3 className="text-label font-bold text-[var(--color-text-primary)] flex items-center gap-2 mb-5">
          <Server className="w-4 h-4 text-[var(--color-accent)]" />
          وضعیت سیستم
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-[var(--color-glass-light-fill)] rounded-2xl">
            <div
              className={`p-2 rounded-full ${isSecure ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]' : 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]'}`}
            >
              {isSecure ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-micro text-[var(--color-text-tertiary)] font-bold">حالت اجرا</p>
              <p className="text-caption text-[var(--color-text-secondary)] font-bold">
                {modeLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-[var(--color-glass-light-fill)] rounded-2xl">
            <div
              className={`p-2 rounded-full ${supabaseConfigured ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]' : 'bg-[var(--color-glass-light-fill)] text-[var(--color-text-tertiary)]'}`}
            >
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="text-micro text-[var(--color-text-tertiary)] font-bold">سوپابیس</p>
              <Badge variant={supabaseConfigured ? 'success' : 'slate'}>
                {supabaseConfigured ? 'پیکربندی شده' : 'پیکربندی نشده'}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-[var(--color-glass-light-fill)] rounded-2xl">
            <div className="p-2 rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)]">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-micro text-[var(--color-text-tertiary)] font-bold">حالت آزمایشی</p>
              <Badge variant="success">غیرفعال</Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-label font-bold text-[var(--color-text-primary)] flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-[var(--color-gold)]" />
          راهنمای امنیت آزمون
        </h3>
        <p className="text-caption text-[var(--color-text-secondary)] leading-7">
          برای آزمون‌های رسمی می‌توانید قفل مرورگر، ثبت خروج از صفحه و ارسال خودکار پاسخ‌برگ را از تنظیمات همان آزمون فعال کنید. پیش از انتشار، حالت پیش‌نمایش را بررسی کنید.
        </p>
      </Card>

      {/* App Info Card */}
      <Card>
        <h3 className="text-label font-bold text-[var(--color-text-primary)] flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-[var(--color-accent)]" />
          درباره برنامه
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-[var(--color-glass-light-fill)] rounded-xl">
            <p className="text-micro text-[var(--color-text-tertiary)] font-bold">نام سامانه</p>
            <p className="text-caption text-[var(--color-text-secondary)] font-bold mt-1">
              آزمون‌ساز
            </p>
          </div>
          <div className="p-3 bg-[var(--color-glass-light-fill)] rounded-xl">
            <p className="text-micro text-[var(--color-text-tertiary)] font-bold">نسخه</p>
            <p className="text-caption text-[var(--color-text-secondary)] font-bold mt-1">۰.۱.۰</p>
          </div>
          <div className="p-3 bg-[var(--color-glass-light-fill)] rounded-xl">
            <p className="text-micro text-[var(--color-text-tertiary)] font-bold">فریمورک</p>
            <p className="text-caption text-[var(--color-text-secondary)] font-bold mt-1">
              React 19 + Vite
            </p>
          </div>
          <div className="p-3 bg-[var(--color-glass-light-fill)] rounded-xl">
            <p className="text-micro text-[var(--color-text-tertiary)] font-bold">میزبانی</p>
            <p className="text-caption text-[var(--color-text-secondary)] font-bold mt-1">Vercel</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
