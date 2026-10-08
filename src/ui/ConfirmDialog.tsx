/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

/* ==========================================
   12. CONFIRM DIALOG COMPONENT
   ========================================== */
export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'primary' | 'success';
}

export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmText = 'تایید',
  cancelText = 'انصراف',
  onConfirm,
  onCancel,
  variant = 'danger',
}: ConfirmDialogProps) => {
  const iconBg =
    variant === 'danger'
      ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
      : 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant={variant} size="sm" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-4 text-right">
        <div className={`p-2.5 rounded-full ${iconBg}`}>
          <AlertTriangle className="w-5 h-5 text-current" />
        </div>
        {/* no title echo here — the Modal header already announces it;
            repeating it in the body read the title twice */}
        <p className="text-caption text-[var(--color-text-tertiary)] leading-relaxed font-semibold">
          {message}
        </p>
      </div>
    </Modal>
  );
};
