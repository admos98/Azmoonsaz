import { useTheme } from '../contexts/ThemeContext';

/**
 * C.3 — the one seal for full-panel successes (ExamSettings "published"
 * banner, import completed). The art IS the mark: gold disc stamped over a
 * rising sweep. 96px default — full-panel moments only; never a toast
 * (carried rejection: 96px art in a one-line toast).
 *
 * Entrance: `.seal` runs `seal-draw` — one 240ms sweep reveal, then static;
 * no loop (pulse-discipline). Reduced motion parks it via the shared
 * attribute + media paths in index.css.
 *
 * A11y: aria-hidden — the host's title/description carry the meaning.
 */
export function Seal({ size = 96, className = '' }: { size?: number; className?: string }) {
  const { resolvedTheme } = useTheme();
  return (
    <img
      src={`/empty-art/seal/${resolvedTheme}/seal.png`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`block seal ${className}`}
      draggable={false}
    />
  );
}
