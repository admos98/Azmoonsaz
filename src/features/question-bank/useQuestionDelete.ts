/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Question deletion (ConfirmDialog state + confirm handler).
 *
 * Extracted verbatim from src/pages/teacher/Questions.tsx.
 */
import { useState } from 'react';
import { questionService } from '../../services/api';
import { useTeacherCollections } from '../../contexts/TeacherContext';

export function useQuestionDelete(
  showToast: (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
    action?: { label: string; onClick: () => void },
  ) => void,
) {
  const { removeQuestion } = useTeacherCollections();

    // ConfirmDialog state for question deletion
    const [questionToDelete, setQuestionToDelete] = useState<{ id: string; name: string } | null>(
      null,
    );
  
    const handleDeleteQuestion = (id: string, name: string) => {
      setQuestionToDelete({ id, name });
    };
  
    const confirmDeleteQuestion = async () => {
      if (!questionToDelete) return;
      try {
        await questionService.deleteQuestion(questionToDelete.id);
        removeQuestion(questionToDelete.id);
        showToast('سوال حذف شد.', 'success');
      } catch (_err) {
        const failedQuestion = questionToDelete;
        showToast('سؤال حذف نشد؛ دوباره تلاش کنید.', 'error', {
          label: 'تلاش دوباره',
          onClick: () => setQuestionToDelete(failedQuestion),
        });
      } finally {
        setQuestionToDelete(null);
      }
    };

  const cancelDelete = () => {
    setQuestionToDelete(null);
  };

  return { questionToDelete, handleDeleteQuestion, confirmDeleteQuestion, cancelDelete };
}
