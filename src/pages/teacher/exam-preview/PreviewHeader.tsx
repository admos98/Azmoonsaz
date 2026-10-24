/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Dispatch, SetStateAction } from 'react';
import { ArrowRight, Eye, FileText, Settings2 } from 'lucide-react';
import { IconButton } from '../../../ui';

type PreviewHeaderProps = {
  viewMode: 'teacher' | 'student';
  setViewMode: Dispatch<SetStateAction<'teacher' | 'student'>>;
  handleBack: () => void;
};

export function PreviewHeader({ viewMode, setViewMode, handleBack }: PreviewHeaderProps) {
 return (
 <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pane p-6 rounded-3xl">
 <div className="flex items-center gap-3">
 <IconButton
 id="btn-back-to-exams-list"
 label="رجوع به بانک لیست آزمون‌ها"
 title="رجوع به بانک لیست آزمون‌ها"
 size="md"
 radius="xl"
 tone="tertiary"
 surface="bright"
 border
 onClick={handleBack}
 className="font-bold"
 >
 <ArrowRight className="w-5 h-5" />
 </IconButton>
 <div>
 <h1 className="text-label md:text-body text-[var(--color-text-primary)] flex items-center gap-2">
 <FileText className="w-5 h-5 text-[var(--color-accent)]" />
 <span>پیش‌نمایش و ویرایش آزمون</span>
 </h1>
 <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
 تغییر ساختار فصل‌ها، جابه‌جایی نمرات، برسی الگوهای دانش‌آموزان و رفع نواقص فنی قبل از
 انتشار
 </p>
 </div>
 </div>

 {/* View mode toggle switcher layout */}
 <div className="flex items-center gap-2 w-full lg:w-auto self-end lg:self-center">
 <div className="glx-inset p-1 rounded-2xl border border-[var(--color-glass-light-stroke)] flex items-center gap-1 w-full lg:w-auto">
 <button
 type="button"
 onClick={() => setViewMode('teacher')}
 className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-caption font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
 viewMode === 'teacher' ? 'btn-glass btn-glass--accent' : 'btn-glass btn-glass--bare'
 }`}
 >
 <Settings2 className="w-4 h-4" />
 <span>حالت ویرایش طراح (معلم)</span>
 </button>
 <button
 type="button"
 onClick={() => setViewMode('student')}
 className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-caption font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
 viewMode === 'student' ? 'btn-glass btn-glass--accent' : 'btn-glass btn-glass--bare'
 }`}
 >
 <Eye className="w-4 h-4" />
 <span>پیش‌نمایش نهایی (دانش‌آموز)</span>
 </button>
 </div>
 </div>
 </div>
 );
}
