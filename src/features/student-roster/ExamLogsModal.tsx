/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


/**
 * Student exam-logs modal — the submissions-history JSX moved verbatim
 * from src/pages/teacher/Students.tsx (de-indented). Presentational: the
 * active student, their submissions and the exam index in, JSX out.
 */
import { FileText, Info } from 'lucide-react';
import type { RefObject } from 'react';
import { EmptyState, Modal } from '../../ui';
import { toPersianDigits } from '../../utils/persian';
import type { Exam, Student, Submission } from '../../types';

export type ExamLogsModalProps = {
  showExamLogsModal: boolean;
  setShowExamLogsModal: (value: boolean) => void;
  activeLogStudent: Student;
  activeLogSubmissions: Submission[];
  allExams: Exam[];
  logsTriggerRef: RefObject<HTMLElement | null>;
};

export function ExamLogsModal({
  showExamLogsModal,
  setShowExamLogsModal,
  activeLogStudent,
  activeLogSubmissions,
  allExams,
  logsTriggerRef,
}: ExamLogsModalProps) {
  return (
    <>
      <Modal
        isOpen={showExamLogsModal}
        onClose={() => setShowExamLogsModal(false)}
        title={`پرونده سنجش‌ها تحصیلی و مشارکت «${activeLogStudent.name}»`}
        icon={<FileText className="w-5 h-5" />}
        maxWidth="md"
        triggerRef={logsTriggerRef}
      >
        <div className="space-y-5">
          <div className="flex justify-between items-center pane p-4.5 rounded-2xl">
            <div>
              <p className="font-bold text-[var(--color-text-primary)] text-caption">
                {activeLogStudent.name}
              </p>
              <p className="text-micro text-[var(--color-text-tertiary)] mt-0.5">
                پایه {activeLogStudent.grade} - شناسنامه {activeLogStudent.id}
              </p>
            </div>
            <div className="text-left font-mono text-micro">
              <p className="text-[var(--color-text-tertiary)]">کد ملی ورود:</p>
              <p className="font-bold text-[var(--color-text-secondary)]">
                {toPersianDigits(activeLogStudent.nationalId)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-micro text-[var(--color-text-primary)] block">
              امتحانات ثبت شده در دیتابیس کلاس‌ها:
            </span>

            {activeLogSubmissions.length > 0 ? (
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {activeLogSubmissions.map((sub, index) => {
                  const examItem = allExams.find((e) => e.id === sub.examId);
                  return (
                    <div
                      key={sub.id || index}
                      className="p-3.5 pane rounded-2xl flex justify-between items-center hover:bg-[var(--color-accent-soft)]/10 transition-colors"
                    >
                      <div>
                        <h5 className="text-[var(--color-text-secondary)] text-micro">
                          {examItem?.title || sub.examCode}
                        </h5>
                        <span className="text-micro text-[var(--color-text-tertiary)] mt-1 block">
                          کد یکتای برگ پاسخ: {sub.id}
                        </span>
                      </div>

                      <div className="text-left">
                        <span
                          className={`px-2 py-0.5 rounded-md text-micro font-bold block mb-1 text-center ${
                            sub.status === 'graded'
                              ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/10'
                              : 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]/80 border border-[var(--color-warning)]/10 animate-pulse'
                          }`}
                        >
                          {sub.status === 'graded'
                            ? 'تصحیح نهایی شده'
                            : 'در حال سنجش یا نیازمند تصحیح'}
                        </span>
                        <span className="text-micro text-[var(--color-text-primary)]">
                          نمره:{' '}
                          <strong className="text-caption font-bold text-[var(--color-accent)]">
                            {toPersianDigits(sub.score)}
                          </strong>{' '}
                          از {toPersianDigits(sub.maxScore)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                compact
                icon={<Info className="w-6 h-6" />}
                title="سابقه‌ای ثبت نشده"
                description="هیچ سابقه مشارکتی یا برگ پاسخی برای این دانش‌آموز در امتحانات فعال مندرج ثبت نگردیده است."
              />
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
