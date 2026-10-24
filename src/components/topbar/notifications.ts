/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Notification derivation for the Topbar bell — builds the items from the
 * shared collections cache. Extracted verbatim from src/components/Topbar.tsx.
 */
import { Exam, Submission } from '../../types';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timeAgo: string;
  type: 'submission' | 'grading' | 'exam';
  onClick?: () => void;
}

export function buildNotificationItems(
 exams: Exam[],
 submissions: Submission[],
 submissionNotifications: boolean,
 examNotifications: boolean,
 onSelectExamForResults: ((examId: string) => void) | undefined,
): NotificationItem[] {
    const activeExams = exams.filter((e) => e.status === 'active');
    const now = new Date();

    const items: NotificationItem[] = [];

    const ungraded = submissions
      .filter((s) => s.status === 'submitted' || s.status === 'ongoing')
      .sort(
        (a, b) =>
          new Date(b.submittedAt || b.startedAt).getTime() -
          new Date(a.submittedAt || a.startedAt).getTime(),
      );

    ungraded.slice(0, 6).forEach((s) => {
      const when = new Date(s.submittedAt || s.startedAt);
      const mins = Math.floor((now.getTime() - when.getTime()) / 60000);
      const timeAgo = mins < 60 ? `${mins} دقیقه پیش` : `${Math.floor(mins / 60)} ساعت پیش`;
      items.push({
        id: `sub-${s.id}`,
        title: `پاسخ‌برگ «${s.studentName}»`,
        description:
          s.status === 'submitted'
            ? 'پاسخ‌برگ خود را ارسال نمود. نیاز به تصحیح دارد.'
            : 'در حال پاسخ به آزمون است.',
        timeAgo,
        type: 'submission',
        onClick: () => onSelectExamForResults && onSelectExamForResults(s.examId),
      });
    });

    activeExams.slice(0, 3).forEach((e) => {
      items.push({
        id: `exam-${e.id}`,
        title: `آزمون فعال: ${e.title}`,
        description: 'در حال برگزاری — دانش‌آموزان در حال پاسخ دهی هستند.',
        timeAgo: 'هم‌اکنون',
        type: 'exam',
        onClick: () => onSelectExamForResults && onSelectExamForResults(e.id),
      });
    });

    return items.filter(
      (item) =>
        (item.type === 'exam' && examNotifications) ||
        (item.type !== 'exam' && submissionNotifications),
    );
}
