import { useTheme } from '../contexts/ThemeContext';

/**
 * Absence family (Art Master Plan C.2) — the inverted gold rule: ZERO filled
 * shapes, the gold slot drawn outline-only in the gold hue. Errors and
 * missing things, said in the brand's grammar.
 *
 * Assets: public/empty-art/absence/{light,dark}/ — keyed RGBA pairs
 * (same coverage-fit keyer as the parents), so theming is a file pick.
 *
 * A11y: aria-hidden — the host's title/description carry the meaning.
 * Static: no loops, nothing for data-motion to quiet.
 */
export type AbsenceKind =
  | 'not-found'
  | 'session-expired'
  | 'import-failed'
  | 'no-results';

const ABSENCE_FILES: Record<AbsenceKind, string> = {
  'not-found': 'abs-1-404',
  'session-expired': 'abs-2-session-expired',
  'import-failed': 'abs-3-import-failed',
  'no-results': 'abs-4-no-results',
};

interface AbsenceArtProps {
  kind: AbsenceKind;
  /** px box — 160–200 page-level, ≤64 inside alerts */
  size?: number;
}

export function AbsenceArt({ kind, size = 160 }: AbsenceArtProps) {
  const { resolvedTheme } = useTheme();
  return (
    <img
      src={`/empty-art/absence/${resolvedTheme}/${ABSENCE_FILES[kind]}.png`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="block"
      draggable={false}
    />
  );
}
