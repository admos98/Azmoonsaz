/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Settings as SettingsIcon,
  Server,
  Shield,
  Wifi,
  WifiOff,
  Info,
  CheckCircle,
  Sun,
  Moon,
  Monitor,
  Accessibility,
  Gauge,
  Rows3,
  List,
  RotateCcw,
  Sparkles,
  Feather,
  Square,
} from 'lucide-react';
import {
  Card,
  Badge,
  Button,
  PageHeader,
  Toggle,
  ConfirmDialog,
} from '../../components/UIComponents';
import PreferenceSelector from '../../components/PreferenceSelector';
import { useGlassTierPreference, type GlassTier } from '../../components/GlassTierApplier';
import { useTheme, type ThemePreference } from '../../contexts/ThemeContext';
import { useMotionPreference, type MotionPreference } from '../../contexts/MotionContext';
import { isSecureBackendMode, getRuntimeModeLabel } from '../../config/runtimeMode';
import { publicEnv } from '../../config/env';
import {
  resetWorkspacePreferences,
  usePersistentPreference,
} from '../../hooks/usePersistentPreference';
import { toPersianDigits } from '../../utils/persian';

export default function Settings() {
  const isSecure = isSecureBackendMode();
  const modeLabel = getRuntimeModeLabel();
  const supabaseConfigured = publicEnv.isSupabaseConfigured;
  const { preference, setPreference } = useTheme();
  const { motionPreference, setMotionPreference } = useMotionPreference();
  const [confirmReset, setConfirmReset] = useState(false);
  const [density, setDensity] = usePersistentPreference<'comfortable' | 'compact'>(
    'workspace:density',
    'comfortable',
    (value): value is 'comfortable' | 'compact' => value === 'comfortable' || value === 'compact',
  );
  const [resetMessage, setResetMessage] = useState('');
  const [submissionNotifications, setSubmissionNotifications] = usePersistentPreference(
    'notifications:submissions',
    true,
  );
  const [examNotifications, setExamNotifications] = usePersistentPreference(
    'notifications:active-exams',
    true,
  );
  const themeOptions: Array<{
    value: ThemePreference;
    label: string;
    description: string;
    icon: typeof Sun;
  }> = [
    { value: 'light', label: 'روشن', description: 'همیشه روشن', icon: Sun },
    { value: 'dark', label: 'تیره', description: 'همیشه تیره', icon: Moon },
    { value: 'system', label: 'سیستم', description: 'هماهنگ با دستگاه', icon: Monitor },
  ];
  const motionOptions: Array<{
    value: MotionPreference;
    label: string;
    description: string;
    icon: typeof Monitor;
  }> = [
    { value: 'system', label: 'سیستم', description: 'هماهنگ با دستگاه', icon: Monitor },
    { value: 'reduced', label: 'کاهش‌یافته', description: 'کمترین حرکت ممکن', icon: Accessibility },
    { value: 'full', label: 'کامل', description: 'حرکت‌های رابط کاربری', icon: Gauge },
  ];
  const densityOptions: Array<{
    value: 'comfortable' | 'compact';
    label: string;
    description: string;
    icon: typeof Rows3;
  }> = [
    {
      value: 'comfortable' as const,
      label: 'راحت',
      description: 'فاصله بیشتر برای خوانایی و لمس',
      icon: Rows3,
    },
    {
      value: 'compact' as const,
      label: 'فشرده',
      description: 'نمایش ردیف‌های بیشتر در فهرست‌ها',
      icon: List,
    },
  ];
  // Raw boot-probe key (see GlassTierApplier) — NOT usePersistentPreference,
  // whose prefixed/JSON-encoded key the pre-paint probe can never see.
  const [glassTier, setGlassTier] = useGlassTierPreference();
  const glassOptions: Array<{
    value: GlassTier;
    label: string;
    description: string;
    icon: typeof Sparkles;
  }> = [
    {
      value: 'auto' as const,
      label: 'خودکار',
      description: 'بررسی توان دستگاه، همانند سیستم‌عامل',
      icon: Monitor,
    },
    {
      value: 'full' as const,
      label: 'کامل',
      description: 'همه لایه‌های شیشه‌ای فعال',
      icon: Sparkles,
    },
    {
      value: 'lite' as const,
      label: 'سبک',
      description: 'بدون مات‌کردن پس‌زمینه؛ برای دستگاه‌های قدیمی‌تر',
      icon: Feather,
    },
    {
      value: 'off' as const,
      label: 'خاموش',
      description: 'سطوح توپر؛ حداکثر کارایی باتری',
      icon: Square,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      dir="rtl"
    >
      {/* Page Header */}
      <PageHeader
        icon={<SettingsIcon className="w-5 h-5" />}
        title="تنظیمات سامانه"
        subtitle="وضعیت اجرا، امنیت و اطلاعات سامانه"
      />

      <Card>
        <div className="mb-5">
          <h3 className="text-label font-bold text-[var(--color-text-primary)]">ظاهر برنامه</h3>
          <p className="mt-1 text-caption text-[var(--color-text-tertiary)]">
            حالت سیستم با تغییر تنظیمات دستگاه، خودکار به‌روز می‌شود.
          </p>
        </div>
        <PreferenceSelector
          label="انتخاب ظاهر برنامه"
          value={preference}
          options={themeOptions}
          onChange={setPreference}
        />
      </Card>

      <Card>
        <div className="mb-5">
          <h3 className="text-label font-bold text-[var(--color-text-primary)]">میزان حرکت</h3>
          <p className="mt-1 text-caption text-[var(--color-text-tertiary)]">
            درخواست کاهش حرکت در تنظیمات دستگاه همیشه در اولویت است.
          </p>
        </div>
        <PreferenceSelector
          label="انتخاب میزان حرکت رابط کاربری"
          value={motionPreference}
          options={motionOptions}
          onChange={setMotionPreference}
        />
      </Card>

      <Card>
        <div className="mb-5">
          <h3 className="text-label font-bold text-[var(--color-text-primary)]">
            کیفیت شیشه‌ای (Liquid Glass)
          </h3>
          <p className="mt-1 text-caption text-[var(--color-text-tertiary)]">
            حالت خودکار مانند سیستم‌عامل توان دستگاه را می‌سنجد؛ انتخاب دستی همیشه در اولویت است.
          </p>
        </div>
        <PreferenceSelector<GlassTier>
          label="انتخاب کیفیت شیشه‌ای"
          value={glassTier}
          options={glassOptions}
          onChange={setGlassTier}
        />
        {/* Live material preview. The tier switch must be visible the moment it
            is clicked: over the flat page background, stripping blur changes
            almost nothing (blur of a flat colour is the same colour) — which is
            why the selector used to feel dead. The stage puts a saturated,
            high-detail backdrop under a REAL a REAL lens panel, so blur (lite/off
            strip it), the lens bend (full only) and the rim light can all be
            judged at a glance, in the current theme. The field is built from
            brand-coloured light BLOBS instead of the old harsh stripes: still
            high-frequency enough to judge blur, no longer a test pattern. */}
        <div
          className="relative mt-4 h-28 overflow-hidden rounded-2xl border border-[var(--color-glass-light-stroke)]"
          aria-hidden="true"
        >
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(90px 70px at 18% 22%, rgb(99 102 241 / 0.85), transparent 70%),
                radial-gradient(110px 80px at 72% 8%, rgb(245 179 1 / 0.85), transparent 70%),
                radial-gradient(100px 90px at 42% 78%, rgb(4 120 87 / 0.8), transparent 70%),
                radial-gradient(90px 70px at 92% 68%, rgb(190 24 93 / 0.7), transparent 70%)`,
            }}
          >
            <p className="p-2 text-caption font-bold text-[var(--color-text-on-solid)] [text-shadow:0_1px_3px_rgb(0_0_0/0.55)]">
              پس‌زمینه پرجزئیات — این متن باید زیر پنل مات شود
            </p>
            <p className="px-2 text-micro text-[var(--color-text-on-solid)] opacity-80 [text-shadow:0_1px_3px_rgb(0_0_0/0.55)]">
              لبه‌های پنل، پس‌زمینه را مثل عدسی خم می‌کنند
            </p>
          </div>
          <div className="pane absolute start-6 top-1/2 h-16 w-44 -translate-y-1/2 rounded-xl">
            <p className="grid h-full place-items-center text-caption font-bold text-[var(--color-text-primary)]">
              پنل شیشه‌ای زنده
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-5">
          <h3 className="text-label font-bold text-[var(--color-text-primary)]">تراکم اطلاعات</h3>
          <p className="mt-1 text-caption text-[var(--color-text-tertiary)]">
            حالت فشرده فقط فاصله فهرست‌ها و جدول‌ها را کاهش می‌دهد و اندازه ناحیه‌های لمسی اصلی را
            حفظ می‌کند.
          </p>
        </div>
        <PreferenceSelector<'comfortable' | 'compact'>
          label="انتخاب تراکم نمایش"
          value={density}
          options={densityOptions}
          onChange={setDensity}
        />
      </Card>

      <Card>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-label font-bold text-[var(--color-text-primary)]">
              بازنشانی فضای کاری
            </h3>
            <p className="mt-1 text-caption text-[var(--color-text-tertiary)]">
              فیلترها، نوع نمایش و تراکم ذخیره‌شده در این مرورگر پاک می‌شوند؛ ظاهر و میزان حرکت
              تغییر نمی‌کنند.
            </p>
            {resetMessage && (
              <p role="status" className="mt-2 text-caption font-bold text-[var(--color-success)]">
                {resetMessage}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={() => setConfirmReset(true)}
            className="shrink-0"
            icon={<RotateCcw className="h-4 w-4" />}
          >
            بازنشانی
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <h3 className="text-label font-bold text-[var(--color-text-primary)]">اعلان‌ها</h3>
          <p className="mt-1 text-caption text-[var(--color-text-tertiary)]">
            اعلان‌های آزمون فعال فوری نمایش داده می‌شوند؛ پاسخ‌برگ‌ها در گروه اطلاع‌رسانی قرار
            می‌گیرند.
          </p>
        </div>
        <div className="space-y-3">
          <Toggle
            checked={examNotifications}
            onChange={setExamNotifications}
            label="آزمون‌های فعال و رویدادهای فوری"
            description="پیشنهادشده برای امنیت و نظارت آزمون"
            className="min-h-11 w-full flex-row-reverse items-center justify-between rounded-xl bg-[var(--color-glass-light-fill)] p-3"
          />
          <Toggle
            checked={submissionNotifications}
            onChange={setSubmissionNotifications}
            label="پاسخ‌برگ‌ها و فعالیت دانش‌آموز"
            description="ارسال پاسخ‌برگ و فعالیت در آزمون"
            className="min-h-11 w-full flex-row-reverse items-center justify-between rounded-xl bg-[var(--color-glass-light-fill)] p-3"
          />
        </div>
      </Card>

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
          <Shield className="w-4 h-4 text-[var(--color-gold-ink)]" />
          راهنمای امنیت آزمون
        </h3>
        <p className="text-caption text-[var(--color-text-secondary)] leading-7">
          برای آزمون‌های رسمی می‌توانید قفل مرورگر، ثبت خروج از صفحه و ارسال خودکار پاسخ‌برگ را از
          تنظیمات همان آزمون فعال کنید. پیش از انتشار، حالت پیش‌نمایش را بررسی کنید.
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
            <p className="text-caption text-[var(--color-text-secondary)] font-bold mt-1">
              {toPersianDigits(__APP_VERSION__)}
            </p>
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

      <ConfirmDialog
        isOpen={confirmReset}
        title="بازنشانی فضای کاری"
        message="فیلترها، نوع نمایش و تراکم ذخیره‌شده در این مرورگر پاک می‌شوند؛ ظاهر و میزان حرکت تغییر نمی‌کنند. بازنشانی انجام شود؟"
        confirmText="بازنشانی"
        cancelText="انصراف"
        variant="danger"
        onConfirm={() => {
          setConfirmReset(false);
          resetWorkspacePreferences();
          setResetMessage('تنظیمات فضای کاری بازنشانی شد.');
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </motion.div>
  );
}
