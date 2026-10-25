/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * The Seal sting (Meraj P1-b) — the ONE sound reserved for moments of
 * commitment (final submit, publish, seal). A deep sub-bass thump with a
 * paper tick on top: "a stamp, not a chime". Never scheduled, never looped,
 * never used twice in a row — the ceremony calls it once per sealing.
 *
 * Design constraints:
 *  · WebAudio only — no asset fetch, ~0 bytes shipped, zero latency after
 *    the submitting user gesture (the AudioContext is created inside the
 *    same task as the click that caused the ceremony).
 *  · Respect the preference key the app's persistence hook owns
 *    (`azmoonsaz:preference:seal-sound`, JSON boolean, default true).
 *  · Every failure is silent: sound must never break the moment it marks.
 */

const PREF_KEY = 'azmoonsaz:preference:seal-sound';

export function isSealSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (raw === null) return true; // default ON — the moment earns it
    return JSON.parse(raw) !== false;
  } catch {
    return true;
  }
}

/** One deep thump (sine drop 130→42 Hz, exponential decay) + one paper tick
 *  (band-passed noise, 26 ms). Both synthesized; total ~0.42 s. */
export function playSealThump(): void {
  if (typeof window === 'undefined' || !isSealSoundEnabled()) return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    // The thump — the wax hitting the paper.
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.26);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.9, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(thumpGain).connect(master);
    osc.start(now);
    osc.stop(now + 0.4);

    // The tick — fibers settling, a 26ms filtered noise burst.
    const len = Math.floor(ctx.sampleRate * 0.026);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 0.9;
    const tickGain = ctx.createGain();
    tickGain.gain.value = 0.24;
    noise.connect(bp).connect(tickGain).connect(master);
    noise.start(now + 0.012);

    // Free the context once the sting is done — one-shot, no reuse.
    osc.onended = () => void ctx.close().catch(() => undefined);
  } catch {
    /* sound is garnish — never let it break the ceremony */
  }
}

/** Haptic twin of the thump (Android/Chromium). One 60ms pulse — a stamp,
 *  not a buzz. Silent no-op where the API is absent. */
export function sealHaptic(): void {
  if (typeof navigator === 'undefined') return;
  try {
    navigator.vibrate?.(60);
  } catch {
    /* haptics are garnish too */
  }
}
