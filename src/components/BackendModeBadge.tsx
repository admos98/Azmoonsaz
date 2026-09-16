import { ShieldCheck } from 'lucide-react';

export default function BackendModeBadge() {
  return (
    <span
      title="اتصال به بک‌اند امن برقرار است"
      className="bg-emerald-50 text-emerald-700 border-emerald-100 inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-[10px] font-black select-none"
    >
      <ShieldCheck className="w-3.5 h-3.5" />
      بک‌اند امن
    </span>
  );
}
