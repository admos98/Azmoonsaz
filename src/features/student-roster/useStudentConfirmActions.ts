/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reset-PIN (T7) and delete-student confirmation state + handlers — moved
 * verbatim from src/pages/teacher/Students.tsx. The page threads in the
 * shared collections and toast the closures previously captured.
 */
import { useState } from 'react';
import { Student } from '../../types';
import { studentService } from '../../services/api';

interface UseStudentConfirmActionsParams {
  students: Student[];
  upsertStudent: (student: Student) => void;
  removeStudent: (id: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export function useStudentConfirmActions({
  students,
  upsertStudent,
  removeStudent,
  showToast,
}: UseStudentConfirmActionsParams) {
  // ConfirmDialog state for PIN reset (T7) — the teacher never sees the PIN;
  // reset clears it so the student's next login shows the set-PIN screen.
  const [studentToResetPin, setStudentToResetPin] = useState<{ id: string; name: string } | null>(
    null,
  );

  const handleResetPin = (id: string, name: string) => {
    setStudentToResetPin({ id, name });
  };

  const confirmResetPin = async () => {
    if (!studentToResetPin) return;
    try {
      const updated = await studentService.resetStudentPin(studentToResetPin.id);
      const existing = students.find((s) => s.id === studentToResetPin.id);
      if (existing) upsertStudent({ ...existing, ...updated });
      showToast('رمز دانش‌آموز بازنشانی شد. در ورود بعدی رمز جدید تعیین می‌کند.', 'success');
    } catch (err: unknown) {
      showToast(`خطا در بازنشانی رمز: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setStudentToResetPin(null);
    }
  };

  // ConfirmDialog state for student deletion
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteStudent = (id: string, name: string) => {
    setStudentToDelete({ id, name });
  };

  const confirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    try {
      await studentService.deleteStudent(studentToDelete.id);
      removeStudent(studentToDelete.id);
      showToast('دانش‌آموز حذف شد.', 'success');
    } catch (err: unknown) {
      showToast(`خطا در حذف: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setStudentToDelete(null);
    }
  };

  return {
    studentToResetPin,
    setStudentToResetPin,
    handleResetPin,
    confirmResetPin,
    studentToDelete,
    setStudentToDelete,
    handleDeleteStudent,
    confirmDeleteStudent,
  };
}
