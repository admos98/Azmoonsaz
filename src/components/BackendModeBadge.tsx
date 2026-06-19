import { ShieldCheck, FlaskConical, AlertTriangle } from 'lucide-react';
import { isSecureBackendMode, getRuntimeModeLabel } from '../config/runtimeMode';

export default function BackendModeBadge() {
  const secure = isSecureBackendMode();
  const Icon = secure ? ShieldCheck : AlertTriangle;
  return (
    <span
      title={secure ? 'اتصال به بک‌اند امن برقرار است' : 'هشدار: سامانه در حالت آزمایشی/آفلاین است — داده‌ها در مرورگر ذخیره می‌شوند'}
      className={(secure
        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
        : 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-200/50 animate-pulse'
      ) + ' inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-[10px] font-black select-none'}
    >
      <Icon className="w-3.5 h-3.5" />
      {secure ? 'بک‌اند امن' : 'حالت آزمایشی'}
    </span>
  );
}
