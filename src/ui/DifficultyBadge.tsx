/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { Badge, type BadgeProps } from './Badge';

/* ==========================================
   4B. DIFFICULTY BADGE COMPONENT
   ========================================== */
export interface DifficultyBadgeProps {
  difficulty?: 'easy' | 'medium' | 'hard';
  className?: string;
}

export const DifficultyBadge = ({ difficulty, className = '' }: DifficultyBadgeProps) => {
  const config: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    easy: { variant: 'success', label: 'آسان' },
    medium: { variant: 'warning', label: 'متوسط' },
    hard: { variant: 'danger', label: 'سخت' },
  };

  // No stored difficulty (legacy rows) → render nothing. Never invent a
  // default level for display.
  const item = difficulty ? config[difficulty] : undefined;
  if (!item) return null;

  return (
    <Badge variant={item.variant} className={className}>
      {item.label}
    </Badge>
  );
};
