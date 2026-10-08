import { Button } from '../ui';
import { AbsenceArt, type AbsenceKind } from './AbsenceArt';

/**
 * Full-page absence host (Art Master Plan C.2: route 404 + session-expired
 * interstitial). One component, two moods — the art carries tone, the
 * Persian title/description carry meaning, aria-hidden on the art.
 * Plain page bg (same contract as BootScreen — outside #app-teacher-shell,
 * so the topo plate does not apply here).
 */
export function AbsencePage({
  kind,
  title,
  description,
  actionLabel,
  onAction,
}: {
  kind: AbsenceKind;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <main
      dir="rtl"
      className="grid min-h-dvh place-items-center bg-[var(--color-page-bg)] p-6"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
        <AbsenceArt kind={kind} size={200} />
        <div className="space-y-2">
          <h1 className="text-heading-2 font-black text-[var(--color-text-primary)]">
            {title}
          </h1>
          <p className="text-caption text-[var(--color-text-tertiary)]">{description}</p>
        </div>
        <Button onClick={onAction}>{actionLabel}</Button>
      </div>
    </main>
  );
}
