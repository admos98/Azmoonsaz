import type { CSSProperties } from 'react';

/**
 * Bubble-row loader — four outline bubbles, the gold "answered" fill hops
 * 1→2→3→4 at 180ms/step. THE sanctioned infinite loop: the exception record
 * sits next to the pulse-discipline cap in `index.css` — do not copy the
 * loop pattern elsewhere.
 *
 * Block/page loading only. Inline button slots keep the compact ring: a
 * four-bubble row does not fit a w-4 icon slot.
 *
 * Pass `label={null}` when the loader sits INSIDE an existing live region
 * (`role="status"` parent): the region already names the state, and a nested
 * status would double-announce. Reduced motion renders the static third
 * bubble — the brand's resting state (see index.css).
 */
interface BubbleLoaderProps {
  /** Announced via role="status"; `null` → decorative (outer live region owns the message) */
  label?: string | null;
  className?: string;
}

export function BubbleLoader({ label = 'در حال بارگذاری…', className = '' }: BubbleLoaderProps) {
  const bubbles = [0, 1, 2, 3].map((i) => <i key={i} style={{ '--i': i } as CSSProperties} />);

  if (label === null) {
    return (
      <span aria-hidden="true" className={`bubble-loader ${className}`}>
        {bubbles}
      </span>
    );
  }

  return (
    <span role="status" aria-label={label} className={`bubble-loader ${className}`}>
      {bubbles}
    </span>
  );
}
