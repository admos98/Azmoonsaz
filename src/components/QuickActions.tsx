/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Quick Actions row (Dashboard section 3) — extracted verbatim from
 * Dashboard.tsx to keep both files under their size ratchets. The tile
 * family stays pixel-identical; ids are load-bearing for e2e.
 */

import { CheckSquare, Eye, FileText, Plus, Sparkles, Upload } from 'lucide-react';

import { formatPersianNumber } from '../utils/persian';

interface QuickActionsProps {
  onNavigate: (tab: string) => void;
  pendingGradings: number;
  /** Opens the Excel-import modal; receives the tile button for focus return. */
  onOpenExcelImport: (trigger: HTMLElement) => void;
}

export function QuickActions({ onNavigate, pendingGradings, onOpenExcelImport }: QuickActionsProps) {
  return (
    <>
        {/* 3. Quick Actions Row — was Dashboard section 3, extracted whole */}
<div className="relative lens p-6 rounded-2xl text-right" id="quick-actions-section">
  <h2 className="text-label text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
    <span>اقدامات سریع</span>
  </h2>

  <div className="grid grid-cols-2 gap-3.5" id="quick-action-btns">
    <button
      type="button"
      id="qa-btn-import-excel"
      onClick={(e) => {
        onOpenExcelImport(e.currentTarget);
      }}
      className="p-4 btn-glass rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
    >
<div className="p-2.5 glx-inset glx-inset-clear text-[var(--color-accent)] rounded-xl group-hover:scale-105 transition-transform">
  <Upload className="w-5 h-5" />
</div>
<span className="text-caption font-bold text-[var(--color-text-primary)]">
  ورود از اکسل
</span>
    </button>

    <button
type="button"
id="qa-btn-add-question"
onClick={() => onNavigate('questions')}
className="p-4 btn-glass rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
    >
<div className="p-2.5 glx-inset glx-inset-clear text-[var(--color-success)] rounded-xl group-hover:scale-105 transition-transform">
  <Plus className="w-5 h-5" />
</div>
<span className="text-caption font-bold text-[var(--color-text-primary)]">
  سوال جدید
</span>
    </button>

    <button
type="button"
id="qa-btn-new-exam"
onClick={() => onNavigate('exams/new')}
className="p-4 btn-glass rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
    >
<div className="p-2.5 glx-inset glx-inset-clear text-[var(--color-warning)] rounded-xl group-hover:scale-105 transition-transform">
  <FileText className="w-5 h-5" />
</div>
<span className="text-caption font-bold text-[var(--color-text-primary)]">
  آزمون جدید
</span>
    </button>

    <button
type="button"
id="qa-btn-view-results"
onClick={() => onNavigate('results')}
className="p-4 btn-glass rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
    >
<div className="p-2.5 glx-inset glx-inset-clear text-[var(--color-accent)] rounded-xl group-hover:scale-105 transition-transform">
  <Eye className="w-5 h-5" />
</div>
<span className="text-caption font-bold text-[var(--color-text-primary)]">
  مشاهده نتایج
</span>
    </button>

    {/* Wrapped (Meraj P3): the year's legend lives one tap away —
  gold accent, because it is a promise-point, not chrome. */}
    <button
type="button"
id="qa-btn-wrapped"
onClick={() => onNavigate('wrapped')}
className="p-4 btn-glass rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
    >
<div className="p-2.5 glx-inset glx-inset-clear text-[var(--color-gold-ink)] rounded-xl group-hover:scale-105 transition-transform">
  <Sparkles className="w-5 h-5" />
</div>
<span className="text-caption font-bold text-[var(--color-text-primary)]">
  روایت سال
</span>
    </button>

    {/* Grading tile = traffic light (1F): red only when there is
  work, calm green when the queue is empty — state-driven
  colour is information; always-on alarm colour is noise */}
    <button
type="button"
id="qa-btn-correct-essays"
onClick={() => onNavigate('results')}
className={`p-4 btn-glass ${
  pendingGradings > 0 ? 'btn-glass--danger' : 'btn-glass--success'
} rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center col-span-2 group cursor-pointer`}
    >
<div
  className={`p-2.5 glx-inset glx-inset-clear rounded-xl group-hover:scale-105 transition-transform ${
    pendingGradings > 0
      ? 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'
      : 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
  }`}
>
  <CheckSquare className="w-5 h-5" />
</div>
<span
  className={`text-caption font-bold ${
    pendingGradings > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'
  }`}
>
  {pendingGradings > 0
    ? `${formatPersianNumber(pendingGradings)} پاسخ‌برگ در انتظار تصحیح`
    : 'تصحیح تشریحی — موردی در انتظار نیست'}
</span>
    </button>
  </div>
</div>
    </>
  );
}