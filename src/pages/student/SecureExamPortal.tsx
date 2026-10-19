/**
 * The secure-exam wiring shell: the state machine lives in
 * features/secure-exam/useExamSession (all server logic, persistence,
 * debounce, offline queue); the phase screens are presentational. This
 * file only routes phases to screens and renders the shared chrome.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { ShieldCheck } from 'lucide-react';
import { TextLink } from '../../ui';
import { useExamSession } from '../../features/secure-exam/useExamSession';
import {
  ExamConfirmDialogs,
  ExamErrorBanner,
  LoginScreen,
  PinSetupScreen,
  ReadyScreen,
  SubmittedScreen,
  TakeScreen,
} from '../../features/secure-exam/screens';

interface SecureExamPortalProps {
  presetExamCode: string;
  onBackToTeacher: () => void;
}

export default function SecureExamPortal({
  presetExamCode,
  onBackToTeacher,
}: SecureExamPortalProps) {
  const session = useExamSession(presetExamCode);

  return (
    <div
      dir="rtl"
      className="min-h-dvh bg-[var(--color-on-dark-subtle)] text-[var(--color-text-primary)] flex flex-col"
    >
      <header className="lens border-b border-[var(--color-glass-light-stroke)]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-accent-solid)] text-[var(--color-text-on-solid)] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-label text-[var(--color-text-primary)]">
                درگاه امن آزمون (آلفا نسخه ۲)
              </h1>
              <p className="text-micro text-[var(--color-text-secondary)]">
                مجهز به ذخیره‌ساز هوشمند آفلاین در قطعی اینترنت
              </p>
            </div>
          </div>
          <TextLink size="md" bold onClick={onBackToTeacher}>
            بازگشت به پنل معلم
          </TextLink>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <ExamErrorBanner error={session.error} />

        {session.phase === 'login' && <LoginScreen session={session} />}
        {session.phase === 'pin-setup' && session.student && <PinSetupScreen session={session} />}
        {session.phase === 'ready' && <ReadyScreen session={session} />}
        {session.phase === 'take' && <TakeScreen session={session} />}
        {session.phase === 'submitted' && <SubmittedScreen />}
      </main>

      <ExamConfirmDialogs session={session} />
    </div>
  );
}
