/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * One row of the notifications dropdown list.
 * Extracted verbatim from src/components/Topbar.tsx (the React key moved to
 * the map call site).
 */
import type { Dispatch, SetStateAction } from 'react';
import type { NotificationItem } from './notifications';

interface NotificationRowProps {
 n: NotificationItem;
 readNotificationIds: string[];
 setReadNotificationIds: Dispatch<SetStateAction<string[]>>;
 closeNotifications: () => void;
}

export function NotificationRow({
 n,
 readNotificationIds,
 setReadNotificationIds,
 closeNotifications,
}: NotificationRowProps) {
 return (
                    <div
                      className="btn-glass btn-glass--bare p-3 transition-colors cursor-pointer rounded-md mx-2 my-1"
                      role="button"
                      tabIndex={0}
                      aria-label={`${n.title}${readNotificationIds.includes(n.id) ? '، خوانده‌شده' : '، خوانده‌نشده'}`}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') event.currentTarget.click();
                      }}
                      onClick={() => {
                        setReadNotificationIds((current) =>
                          current.includes(n.id) ? current : [...current, n.id].slice(-100),
                        );
                        if (n.onClick) n.onClick();
                        closeNotifications();
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {!readNotificationIds.includes(n.id) && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]"
                            aria-hidden="true"
                          />
                        )}
                        <p className="text-body font-semibold text-[var(--color-text-primary)]">
                          {n.title}
                        </p>
                        <span
                          className={`mr-auto rounded-full px-2 py-0.5 text-caption font-bold ${n.type === 'exam' ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]' : 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'}`}
                        >
                          {n.type === 'exam' ? 'فوری' : 'اطلاع‌رسانی'}
                        </span>
                      </div>
                      <p className="text-caption text-[var(--color-text-secondary)] mt-1">
                        {n.description}
                      </p>
                      <span className="text-caption text-[var(--color-text-secondary)] mt-2 block">
                        {n.timeAgo}
                      </span>
                    </div>
 );
}
