import { memo, useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { toPersianDigits } from '../utils/persian';

interface ExamCountdownProps {
  durationMinutes: number;
  startedAt?: string;
  onExpire: () => void;
}

export const ExamCountdown = memo(function ExamCountdown({
  durationMinutes,
  startedAt,
  onExpire,
}: ExamCountdownProps) {
  const calculateRemaining = () => {
    const duration = durationMinutes * 60;
    if (!startedAt) return duration;
    return Math.max(0, duration - Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  };
  const [seconds, setSeconds] = useState(calculateRemaining);
  const expireRef = useRef(onExpire);

  useEffect(() => {
    expireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          queueMicrotask(() => expireRef.current());
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [durationMinutes, startedAt]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <div
      role="timer"
      aria-label={`زمان باقی‌مانده ${toPersianDigits(mins)} دقیقه و ${toPersianDigits(secs)} ثانیه`}
      className={`px-3 py-1.5 rounded-xl font-bold font-mono text-caption md:text-label flex items-center gap-1.5 ${seconds < 300 ? 'bg-[var(--color-danger-soft)]/40 border border-[var(--color-danger)]/20 text-[var(--color-danger)] animate-pulse' : 'bg-[var(--color-glass-light-fill)] text-[var(--color-text-secondary)]'}`}
    >
      <Clock className="w-4 h-4" aria-hidden="true" />
      <span aria-hidden="true">
        {toPersianDigits(mins.toString().padStart(2, '0'))}:
        {toPersianDigits(secs.toString().padStart(2, '0'))}
      </span>
    </div>
  );
});
