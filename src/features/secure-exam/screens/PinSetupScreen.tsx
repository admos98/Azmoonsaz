/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { Lock, Loader2, ShieldCheck } from 'lucide-react';
import { Button, Input } from '../../../ui';
import type { ExamSession } from '../useExamSession';

/** First-login PIN creation: greet, two fields, local match validation. */
export function PinSetupScreen({ session }: { session: ExamSession }) {
  const { student, handleSetPin, loading, pin, pinConfirm, setPin, setPinConfirm, normalizePinInput } =
    session;

  return (
    <form
      onSubmit={handleSetPin}
      className="lens rounded-3xl p-6 md:p-8 max-w-xl mx-auto space-y-5"
    >
      <div className="text-center space-y-2">
        <Lock className="w-12 h-12 mx-auto text-[var(--color-accent)]" />
        <h2 className="font-black text-[var(--color-text-primary)]">سلام، {student.name}</h2>
        <p className="text-caption text-[var(--color-text-secondary)] leading-relaxed">
          برای نخستین ورود، یک رمز ۶ رقمی برای خودت انتخاب کن. از این پس با همین رمز وارد
          آزمون‌ها می‌شوی؛ آن را به خاطر بسپار و به کسی نده.
        </p>
      </div>
      <Input
        label="رمز ۶ رقمی جدید"
        value={pin}
        onChange={(e) => setPin(normalizePinInput(e.target.value))}
        placeholder="۶ رقم"
        inputMode="numeric"
        autoComplete="new-password"
        className="font-bold text-left tracking-widest"
      />
      <Input
        label="تکرار رمز ۶ رقمی"
        value={pinConfirm}
        onChange={(e) => setPinConfirm(normalizePinInput(e.target.value))}
        placeholder="تکرار ۶ رقم"
        inputMode="numeric"
        autoComplete="new-password"
        className="font-bold text-left tracking-widest"
      />
      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={loading || pin.length !== 6 || pinConfirm.length !== 6}
        icon={
          loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )
        }
        className="w-full py-3 text-label"
      >
        ثبت رمز و ورود به آزمون
      </Button>
    </form>
  );
}
