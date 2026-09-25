import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, X } from 'lucide-react';

type ConnectionState = 'online' | 'offline' | 'reconnected';

export default function ConnectivityStatus() {
  const [state, setState] = useState<ConnectionState>(() =>
    navigator.onLine ? 'online' : 'offline',
  );
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    const handleOffline = () => {
      clearTimer();
      setState('offline');
    };
    const handleOnline = () => {
      clearTimer();
      setState('reconnected');
      timerRef.current = window.setTimeout(() => setState('online'), 4000);
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      clearTimer();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (state === 'online') return null;
  const offline = state === 'offline';

  return (
    <div
      role={offline ? 'alert' : 'status'}
      aria-live={offline ? 'assertive' : 'polite'}
      className={`fixed inset-x-3 top-3 z-[200] mx-auto flex min-h-12 max-w-xl items-center gap-3 rounded-2xl border px-4 py-2.5 shadow-lg sm:inset-x-auto ${
        offline
          ? 'border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] text-[var(--color-warning)]'
          : 'border-[var(--color-success)]/30 bg-[var(--color-success-soft)] text-[var(--color-success)]'
      }`}
    >
      {offline ? (
        <WifiOff className="h-5 w-5 shrink-0" aria-hidden="true" />
      ) : (
        <Wifi className="h-5 w-5 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <strong className="block text-caption">
          {offline ? 'اتصال اینترنت قطع است' : 'اتصال دوباره برقرار شد'}
        </strong>
        <span className="block text-micro text-[var(--color-text-secondary)]">
          {offline
            ? 'اطلاعات ذخیره‌نشده را نگه دارید؛ پس از اتصال دوباره تلاش کنید.'
            : 'اکنون می‌توانید عملیات ناموفق را دوباره انجام دهید.'}
        </span>
      </div>
      {!offline && (
        <button
          type="button"
          onClick={() => setState('online')}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-[var(--color-surface-secondary)]"
          aria-label="بستن پیام اتصال"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
