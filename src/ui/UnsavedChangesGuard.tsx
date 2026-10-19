/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { ConfirmDialog } from './ConfirmDialog';
import type { UnsavedChangesDialogProps } from '../hooks/useUnsavedChanges';

/**
 * The unsaved-changes guard, wired to the ConfirmDialog surface.
 * One mount per page instead of a hand-rolled <ConfirmDialog> block:
 * the hook (userUnsavedChanges) returns dialogProps, the page renders
 * <UnsavedChangesGuard {...dialogProps} title="…" confirmText="…" />.
 */
export type UnsavedChangesGuardProps = UnsavedChangesDialogProps & {
  /** Dialog headline. */
  title: string;
  /** Confirm-button label — name the destructive act, never “تایید”. */
  confirmText?: string;
};

export function UnsavedChangesGuard({
  isOpen,
  message,
  onConfirm,
  onCancel,
  title,
  confirmText = 'خروج بدون ذخیره',
}: UnsavedChangesGuardProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={title}
      message={message}
      confirmText={confirmText}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
