import { useTheme } from '../contexts/ThemeContext';
import type { ArtKind } from './EmptyStateArt';

/**
 * Cut — the chrome icon set (Art Master Plan C.1/D.3): one motif's
 * signature element alone, generated natively at icon composition (never
 * cropped from the 1254px parent), keyed per theme like EmptyStateArt —
 * the theme pair is a file pick, not a runtime recolor.
 *
 * Sizes: 20 / 24 / 28 — the three slots the icon family was drawn for —
 * plus 56 for the one empty-state host (notifications, C.5). `aria-hidden`
 * always: a cut decorates an existing label, the text
 * carries the meaning (same contract as the crest rail).
 *
 * Migration order: nav → quick-actions → dropdowns → panel headers.
 * lucide stays where no cut exists (Dashboard home, Plus, Settings …) —
 * never invent a one-off glyph.
 */
type CutSize = 20 | 24 | 28 | 56;

const CUT_FILES: Record<ArtKind, string> = {
  questions: 'cut-1', // gold = the third answer bubble
  students: 'cut-2', // gold = the third head
  exams: 'cut-3', // gold = the "now" dot at the clock center
  grading: 'cut-4', // gold = the stamp at the pen tip
  scheduled: 'cut-5', // gold = the marked day tile
  classes: 'cut-6', // gold = the third head in the pane corner
};

interface CutProps {
  kind: ArtKind;
  /** px slot — 20 (inline rows) / 24 (headers) / 28 (feature) */
  size?: CutSize;
  className?: string;
}

export function Cut({ kind, size = 24, className }: CutProps) {
  const { resolvedTheme } = useTheme();
  return (
    <img
      src={`/empty-art/cuts/${resolvedTheme}/${CUT_FILES[kind]}.png`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`block shrink-0 ${className ?? ''}`}
      draggable={false}
    />
  );
}
