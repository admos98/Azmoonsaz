/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The "reset link sent" confirmation view of the Login flow — extracted
 * verbatim from Login.tsx for the size ratchet. Tone: state + way out
 * (docs/tone-of-voice.md §4).
 */

import { CheckCircle2 } from 'lucide-react';

import { TextLink } from '../ui';

interface ResetSentNoticeProps {
  email: string;
  onBack: () => void;
}

export function ResetSentNotice({ email, onBack }: ResetSentNoticeProps) {
  return (
    <div className="text-center space-y-4 py-4">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--color-warning-soft)] rounded-full mb-2">
        <CheckCircle2 className="w-8 h-8 text-[var(--color-warning)]" />
      </div>
      <h2 className="text-heading-3 text-[var(--color-text-primary)]">لینک بازیابی ارسال شد</h2>
      <p className="text-label text-[var(--color-text-secondary)] leading-relaxed">
        ایمیلی حاوی لینک بازیابی رمز عبور برای شما ارسال شد.
        <br />
        لینک را باز کنید و رمز جدید انتخاب کنید.
      </p>
      <div className="glx-inset field rounded-xl px-4 py-3">
        <p className="text-caption text-[var(--color-text-tertiary)]">ارسال شده به:</p>
        <p className="text-label text-[var(--color-text-primary)]" dir="ltr">
          {email}
        </p>
      </div>
      <TextLink size="md" bold onClick={onBack}>
        بازگشت به ورود
      </TextLink>
    </div>
  );
}
