import { ShieldCheck } from 'lucide-react';

export default function BackendModeBadge() {
  return (
    <span
      title="اتصال به بک‌اند امن برقرار است"
      className="bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/10 inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-micro font-black select-none"
    >
      <ShieldCheck className="w-3.5 h-3.5" />
      بک‌اند امن
    </span>
  );
}
