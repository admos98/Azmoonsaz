/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Left column of the add/edit drawer: realtime live visual preview of
 * QuestionRenderer as the teacher types.
 *
 * Extracted verbatim from src/pages/teacher/Questions.tsx. The form bundle
 * produced by useQuestionForm is threaded in as-is and destructured to the
 * same identifiers the page previously closed over; the code-split
 * QuestionRenderer is threaded in from the page so the single lazy chunk
 * (idle-preloaded there) is shared.
 */
import type { ComponentProps, ComponentType } from 'react';
import { Eye, Info } from 'lucide-react';
import { Suspense } from 'react';
import type QuestionRendererType from '../../components/QuestionRenderer';
import type { useQuestionForm } from './useQuestionForm';

type QuestionFormApi = ReturnType<typeof useQuestionForm>;

export function QuestionDrawerPreview({
  form,
  previewReady,
  QuestionRenderer,
}: {
  form: QuestionFormApi;
  previewReady: boolean;
  QuestionRenderer: ComponentType<ComponentProps<typeof QuestionRendererType>>;
}) {
  const {
    formGrade,
    formSubject,
    formSection,
    formType,
    formDifficulty,
    formPoints,
    formText,
    formTitle,
    formTagsString,
    formExplanation,
    formSampleAnswer,
    formImageUrl,
    formOptions,
    formCorrectTrueFalse,
    formFillBlanks,
    formMatchingPairs,
    formOrderingItems,
    formRubrics,
    formParts,
  } = form;

  return (
        <div
          className="hidden lg:block lg:col-span-5 glx-inset p-5 overflow-y-auto border-l border-[var(--color-glass-light-stroke)]"
          id="drawer-live-visual"
        >
          <div className="sticky top-0 space-y-3.5">
            <div className="flex items-center gap-1 text-[var(--color-text-tertiary)] font-bold mb-1">
              <Eye className="w-4 h-4 text-[var(--color-accent)]" />
              <span className="text-micro">محیط پیش‌نمایش لحظه‌ای دبیر:</span>
            </div>

            {/* Live preview — mounts one frame past drawer open (previewReady):
                the open commit carries the light form tree only; this heavy
                tree builds while the panel grows. Skeleton meanwhile (and
                Suspense until the idle-preloaded chunk resolves). */}
            {previewReady ? (
              <Suspense
                fallback={
                  <div className="space-y-3" role="status" aria-label="در حال بارگذاری پیش‌نمایش">
                    <div className="h-8 rounded-xl bg-[var(--color-surface-secondary)] skeleton" />
                    <div className="h-40 rounded-2xl bg-[var(--color-surface-secondary)] skeleton" />
                  </div>
                }
              >
                <QuestionRenderer
                  question={{
                    id: 'dummy-drawer',
                    type: formType,
                    title: formTitle || 'بدون عنوان',
                    text: formText || 'لطفاً متن صورت سوال را بنویسید...',
                    points: formPoints,
                    category: formSubject,
                    grade: formGrade,
                    section: formSection,
                    difficulty: formDifficulty,
                    options:
                      formType === 'single_choice' ||
                      formType === 'multiple_choice' ||
                      formType === 'image_based'
                        ? formOptions
                        : undefined,
                    correctAnswer: formType === 'true_false' ? formCorrectTrueFalse : undefined, // choices mapping takes formOptions isCorrect in renderer
                    correctFillBlanks: formType === 'fill_blank' ? formFillBlanks : undefined,
                    matchingPairs: formType === 'matching' ? formMatchingPairs : undefined,
                    orderingItems: formType === 'ordering' ? formOrderingItems : undefined,
                    imageUrl: formImageUrl || undefined,
                    explanation: formExplanation || undefined,
                    sampleAnswer: formSampleAnswer || undefined,
                    rubrics: formType === 'long_answer' ? formRubrics : undefined,
                    parts:
                      formType === 'cloze' || formType === 'reading_comprehension'
                        ? formParts
                        : undefined,
                    tags: formTagsString
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }}
                  showCorrectAnswers={true}
                />
              </Suspense>
            ) : (
              <div className="space-y-3" role="status" aria-label="در حال بارگذاری پیش‌نمایش">
                <div className="h-8 rounded-xl bg-[var(--color-surface-secondary)] skeleton" />
                <div className="h-40 rounded-2xl bg-[var(--color-surface-secondary)] skeleton" />
              </div>
            )}

            <div className="glx0 border border-[var(--color-glass-light-stroke)] p-3.5 rounded-2xl text-micro leading-relaxed text-[var(--color-text-tertiary)] flex items-start gap-1.5 shadow-xs">
              <Info className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-tertiary)] mt-0.5" />
              <span>
                تغیرات بالا بلافاصله با تایپ کردن فرم زیر، به‌روزرسانی می‌شوند تا ساختار نهایی را
                بررسی نمایید.
              </span>
            </div>
          </div>
        </div>
  );
}
