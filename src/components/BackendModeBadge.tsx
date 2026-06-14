import { ShieldCheck, FlaskConical } from 'lucide-react';
import { isSecureBackendMode, getRuntimeModeLabel } from '../config/runtimeMode';

export default function BackendModeBadge() {
  const secure = isSecureBackendMode();
  const Icon = secure ? ShieldCheck : FlaskConical;
  return (
    <span className={(secure ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100') + ' inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-[10px] font-black'}>
      <Icon className="w-3.5 h-3.5" />
      {getRuntimeModeLabel()}
    </span>
  );
}
