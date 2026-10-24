/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reusable live preview question modal (library chrome) for the question
 * bank.
 *
 * Extracted verbatim from src/pages/teacher/Questions.tsx. The code-split
 * QuestionRenderer is threaded in from the page so the single lazy chunk
 * (idle-preloaded there) is shared.
 */
import type { ComponentProps, ComponentType, RefObject } from 'react';
import { Sparkles } from 'lucide-react';
import { Modal } from '../../ui';
import { formatPersianDate, toPersianDigits } from '../../utils/persian';
import type QuestionRendererType from '../../components/QuestionRenderer';
import type { RichQuestion } from './types';

export function QuestionPreviewModal({
  previewQuestion,
  setPreviewQuestion,
  previewTriggerRef,
  QuestionRenderer,
}: {
  previewQuestion: RichQuestion | null;
  setPreviewQuestion: (q: RichQuestion | null) => void;
  previewTriggerRef: RefObject<HTMLElement | null>;
  QuestionRenderer: ComponentType<ComponentProps<typeof QuestionRendererType>>;
}) {
  return (
      <Modal
        isOpen={previewQuestion !== null}
        onClose={() => setPreviewQuestion(null)}
        title="شبیه‌ساز پیش‌نمایش سوال در برگه پاسخ‌نامه"
        icon={<Sparkles className="w-4 h-4" />}
        maxWidth="lg"
        triggerRef={previewTriggerRef}
        footerClassName="justify-between"
        footer={
          previewQuestion && (
            <>
              <span>شناسه تخصصی سوال: {previewQuestion.id}</span>
              <span>
                بروزرسانی شده در: {toPersianDigits(formatPersianDate(previewQuestion.createdAt))}
              </span>
            </>
          )
        }
      >
        {previewQuestion && (
          <QuestionRenderer question={previewQuestion} showCorrectAnswers={true} />
        )}
      </Modal>
  );
}
