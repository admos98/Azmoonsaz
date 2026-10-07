import type { ReactNode } from 'react';
import { EmptyStateArt } from './EmptyStateArt';
import type { ArtKind } from './EmptyStateArt';

/**
 * PanelCrest — identity rail for list panels (Master Plan D.2 / V2).
 *
 * Layout: content column + crest column (≥lg only; the rail folds away on
 * mobile, single column below 1024px). In RTL the second grid column lands
 * on the physical left — art reads on the left, content on the right, like
 * the mock.
 *
 * Zero-shift contract: the rail column is reserved in BOTH states, so
 * empty↔filled swaps only --crest-op (60% light / 75% dark at filled,
 * full strength when empty — CSS hides the content column's centered art
 * ≥lg so the rail is the single illustration there; below lg the rail is
 * gone and the centered art keeps the small-screen path). No animation
 * beyond a 160ms opacity ease; the reduced-motion paths kill even that.
 *
 * A11y: aria-hidden rail — panel heading/description carry the meaning
 * (same contract as EmptyStateArt).
 */
type CrestState = 'filled' | 'empty';

interface PanelCrestProps {
  kind: ArtKind;
  state: CrestState;
  children: ReactNode;
  className?: string;
}

export function PanelCrest({ kind, state, children, className }: PanelCrestProps) {
  return (
    <div className={`panel-crest ${className ?? ''}`} data-state={state}>
      <div className="panel-crest__content min-w-0">{children}</div>
      <div className="panel-crest__rail" aria-hidden="true">
        <EmptyStateArt kind={kind} size={112} />
      </div>
    </div>
  );
}
