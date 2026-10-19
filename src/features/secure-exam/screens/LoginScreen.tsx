/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { Lock, Loader2, ShieldCheck } from 'lucide-react';
import { Button, Input } from '../../../ui';
import type { ExamSession } from '../useExamSession';
import { TURNSTILE_SITE_KEY } from '../protocol';

/** Login form: exam code + national ID + 6-digit PIN, plus the Wave-B
 * Turnstile widget when the site key is deployed. */
export function LoginScreen({ session }: { session: ExamSession }) {
  const {
    handleStartSession,
    loading,
    nationalId,
    normalizeNationalId,
    normalizePinInput,
    pin,
    setExamCode,
    setNationalId,
    setPin,
    turnstileRef,
    turnstileToken,
    examCode,
  } = session;

  return (
    <form
      onSubmit={handleStartSession}
      className="lens rounded-3xl p-6 md:p-8 max-w-xl mx-auto space-y-5"
    >
      <div className="text-center space-y-2">
        <Lock className="w-12 h-12 mx-auto text-[var(--color-accent)]" />
        <h2 className="font-black text-[var(--color-text-primary)]">ورود امن دانش‌آموز</h2>
        <p className="text-caption text-[var(--color-text-secondary)] leading-relaxed">
          کد ملی در مرورگر ذخیره نمی‌شود؛ اعتبارسنجی و تطبیق آن فقط در بک‌اند انجام می‌شود.
        </p>
      </div>
      <Input
        label="کد آزمون"
        value={examCode}
        onChange={(e) => setExamCode(e.target.value.toUpperCase())}
        className="font-bold text-left ltr"
      />
      <Input
        label="کد ملی دانش‌آموز"
        value={nationalId}
        onChange={(e) => setNationalId(normalizeNationalId(e.target.value))}
        placeholder="مثلاً 1000000001"
        className="font-bold text-left tracking-widest"
        inputMode="numeric"
      />
      <Input
        label="رمز ۶ رقمی"
        value={pin}
        onChange={(e) => setPin(normalizePinInput(e.target.value))}
        placeholder="۶ رقم"
        inputMode="numeric"
        autoComplete="off"
        className="font-bold text-left tracking-widest"
      />
      {TURNSTILE_SITE_KEY && <div ref={turnstileRef} className="flex justify-center" />}
      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={
          loading ||
          nationalId.length !== 10 ||
          pin.length !== 6 ||
          Boolean(TURNSTILE_SITE_KEY && !turnstileToken)
        }
        icon={
          loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )
        }
        className="w-full py-3 text-label"
      >
        ورود امن به آزمون
      </Button>
    </form>
  );
}

