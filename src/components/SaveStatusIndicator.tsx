import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { formatPersianDateTime } from '../utils/persian';

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

export default function SaveStatusIndicator({
  state,
  savedAt,
}: {
  state: SaveState;
  savedAt?: Date | null;
}) {
  if (state === 'idle') return null;
  const config = {
    saving: {
      label: 'در حال ذخیره…',
      icon: LoaderCircle,
      tone: 'text-[var(--color-text-tertiary)]',
    },
    saved: {
      label: savedAt ? `ذخیره شد — ${formatPersianDateTime(savedAt)}` : 'ذخیره شد',
      icon: CheckCircle2,
      tone: 'text-[var(--color-success)]',
    },
    failed: {
      label: 'ذخیره نشد؛ اطلاعات واردشده حفظ شده است.',
      icon: AlertCircle,
      tone: 'text-[var(--color-danger)]',
    },
  } as const;
  const current = config[state];
  const Icon = current.icon;
  return (
    <p
      role={state === 'failed' ? 'alert' : 'status'}
      aria-live={state === 'failed' ? 'assertive' : 'polite'}
      className={`flex items-center gap-2 text-caption font-bold ${current.tone}`}
    >
      <Icon className={`h-4 w-4 ${state === 'saving' ? 'animate-spin' : ''}`} aria-hidden="true" />
      {current.label}
    </p>
  );
}
