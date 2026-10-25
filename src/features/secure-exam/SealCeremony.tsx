/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * The Sealing Ceremony (Meraj P1-a) — the exam-submit moment as a rite,
 * not a spinner. The most anxious instant in a student's day becomes a
 * moment of dignity: the answers fold closed, wax rises, the crest stamps.
 *
 * Contract:
 *  · One-shot on mount, ~1.9s, then it removes itself (onDone). Never
 *    blocks the actual submission — by the time it plays, the server has
 *    already accepted (this renders from SubmittedScreen).
 *  · Reduced motion (MotionContext 'reduce'): the overlay never mounts —
 *    the terminal card alone carries the moment, no timers at all.
 *  · Sound + haptic fire once, on the stamp beat, honoring the
 *    seal-sound preference (see lib/sealSound.ts).
 *  · A11y: role="status" + aria-live="polite" — screen readers get the
 *    outcome text immediately, not the choreography.
 */

import { useEffect, useRef, useState } from 'react';
import { Seal } from '../../components/Seal';
import { useMotionPreference } from '../../contexts/MotionContext';
import { playSealThump, sealHaptic } from '../../lib/sealSound';
import { SEAL_BEATS, SEAL_FADE_MS, SEAL_SETTLE_MS } from './sealBeats';

type Stage = 'fold' | 'wax' | 'stamp' | 'done';

export function SealCeremony({ onDone }: { onDone?: () => void }) {
  const { resolvedMotion } = useMotionPreference();
  const [stage, setStage] = useState<Stage>('fold');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (resolvedMotion === 'reduce') {
      // No ceremony for reduced motion — done before the first paint.
      onDone?.();
      return;
    }
    const schedule = (fn: () => void, ms: number) => {
      timers.current.push(window.setTimeout(fn, ms));
    };
    schedule(() => setStage('wax'), SEAL_BEATS.wax);
    schedule(() => setStage('stamp'), SEAL_BEATS.stamp);
    schedule(() => {
      playSealThump();
      sealHaptic();
    }, SEAL_BEATS.stamp + 40); // on wax-contact frame
    schedule(() => setStage('done'), SEAL_BEATS.stamp + SEAL_SETTLE_MS);
    schedule(() => onDone?.(), SEAL_BEATS.stamp + SEAL_SETTLE_MS + SEAL_FADE_MS);
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedMotion]);

  if (resolvedMotion === 'reduce') return null;

  return (
    <div
      className={`seal-ceremony seal-ceremony--${stage}`}
      role="status"
      aria-live="polite"
      data-testid="seal-ceremony"
    >
      <div className="seal-ceremony__paper" aria-hidden="true">
        <div className="seal-ceremony__flap seal-ceremony__flap--top" />
        <div className="seal-ceremony__flap seal-ceremony__flap--bottom" />
        <div className="seal-ceremony__wax" />
        <div className="seal-ceremony__ring" />
        <div className="seal-ceremony__crest">
          <Seal size={72} />
        </div>
      </div>
      <p className="seal-ceremony__caption">آزمون با موفقیت مهر و موم شد</p>
    </div>
  );
}
