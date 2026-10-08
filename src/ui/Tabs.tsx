/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useRef } from 'react';

/* ==========================================
   7. TABS COMPONENT
   ========================================== */
export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  /** Accessible name for the tablist */
  ariaLabel?: string;
  /** Stable id stem for the ARIA wiring: buttons become `${idPrefix}-tab-${id}`.
      Consumers that pass it must render ONE dynamic panel as
      role="tabpanel" id={`${idPrefix}-panel`}
      aria-labelledby={`${idPrefix}-tab-${activeTab}`} — every tab's
      aria-controls then points at it. Without it, ids stay internal and
      aria-controls is omitted (no dangling reference). */
  idPrefix?: string;
}

export const Tabs = ({
  tabs,
  activeTab,
  onChange,
  className = '',
  ariaLabel,
  idPrefix,
}: TabsProps) => {
  const baseId = useId();
  const stem = idPrefix ?? baseId;
  const panelId = idPrefix ? `${idPrefix}-panel` : undefined;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    tabRefs.current[next]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const current = tabs.findIndex((t) => t.id === activeTab);
    // RTL reading order: ArrowLeft advances to the next tab, ArrowRight goes back
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusTab(current + 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusTab(current - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusTab(tabs.length - 1);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`flex items-center gap-1 glx-inset p-1.5 rounded-2xl w-fit ${className}`}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            type="button"
            key={tab.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            id={`${stem}-tab-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-caption md:text-label font-bold rounded-xl transition-all cursor-pointer select-none ${isActive ? 'btn-glass btn-glass--gold' : 'btn-glass btn-glass--bare'}`}
          >
            {tab.icon && tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
