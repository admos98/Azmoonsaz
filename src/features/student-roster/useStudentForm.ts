/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Manual Add/Edit student form — moved verbatim from
 * src/pages/teacher/Students.tsx: modal-open state, the form fields, the
 * dirty snapshot + unsaved-changes guard, the add/edit openers and the
 * submit pipeline (create/update + national-id validation). The page
 * threads in the shared collections, toast, save-indicator state and the
 * trigger ref/capture helper the closures previously captured.
 */
import React, { useState } from 'react';
import { ClassGroup, Student } from '../../types';
import { validateIranianNationalId } from './nationalId';
import { studentService } from '../../services/api';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import type { SaveState } from '../../components/SaveStatusIndicator';

interface UseStudentFormParams {
  classGroups: ClassGroup[];
  students: Student[];
  upsertStudent: (student: Student) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  setSaveState: (value: SaveState) => void;
  setLastSavedAt: (value: Date | null) => void;
  addEditTriggerRef: React.RefObject<HTMLElement | null>;
  captureActiveTrigger: () => HTMLElement | null;
}

export function useStudentForm({
  classGroups,
  students,
  upsertStudent,
  showToast,
  setSaveState,
  setLastSavedAt,
  addEditTriggerRef,
  captureActiveTrigger,
}: UseStudentFormParams) {
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Manual Add/Edit form state
  const [formName, setFormName] = useState('');
  const [formNationalId, setFormNationalId] = useState('');
  const [formGrade, setFormGrade] = useState('هفتم');
  const [formClassGroupId, setFormClassGroupId] = useState('c-1');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'suspended' | 'examining'>('active');
  const formSnapshot = JSON.stringify([
    formName,
    formNationalId,
    formGrade,
    formClassGroupId,
    formPhone,
    formEmail,
    formStatus,
  ]);
  const [savedFormSnapshot, setSavedFormSnapshot] = useState(formSnapshot);
  const { guarded: guardStudentDraft, dialogProps: studentDraftDialog } = useUnsavedChanges(
    showAddEditModal && formSnapshot !== savedFormSnapshot,
  );
  const closeStudentEditor = () => guardStudentDraft(() => setShowAddEditModal(false));

  // Open Add Student Modal
  const openAddModal = () => {
    addEditTriggerRef.current = captureActiveTrigger();
    setModalMode('add');
    setSelectedStudentId(null);
    setFormName('');
    setFormNationalId('');
    setFormGrade('هفتم');
    setFormClassGroupId(classGroups[0]?.id || 'c-1');
    setFormPhone('');
    setFormEmail('');
    setFormStatus('active');
    setSavedFormSnapshot(
      JSON.stringify(['', '', 'هفتم', classGroups[0]?.id || 'c-1', '', '', 'active']),
    );
    setShowAddEditModal(true);
  };

  // Open Edit Student Modal
  const openEditModal = (student: Student) => {
    addEditTriggerRef.current = captureActiveTrigger();
    setModalMode('edit');
    setSelectedStudentId(student.id);
    setFormName(student.name);
    setFormNationalId(student.nationalId);
    setFormGrade(student.grade);
    setFormClassGroupId(student.classGroupId);
    setFormPhone(student.phoneNumber || '');
    setFormEmail(student.email || '');
    setFormStatus(student.status || 'active');
    setSavedFormSnapshot(
      JSON.stringify([
        student.name,
        student.nationalId,
        student.grade,
        student.classGroupId,
        student.phoneNumber || '',
        student.email || '',
        student.status || 'active',
      ]),
    );
    setShowAddEditModal(true);
  };

  // Handle Save (Add or Edit)
  const handleSaveStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;

    const validationResult = validateIranianNationalId(formNationalId);
    if (!validationResult.isValid) {
      showToast(`خطای کدملی: ${validationResult.message}`, 'error');
      return;
    }

    setSaveState('saving');
    try {
      if (modalMode === 'add') {
        // Check for duplicated National ID
        const isDuplicate = students.some((s) => s.nationalId === formNationalId);
        if (isDuplicate) {
          showToast('دانش‌آموزی با این کد ملی قبلاً ثبت شده است.', 'error');
          return;
        }

        const created = await studentService.createStudent({
          name: formName,
          nationalId: formNationalId,
          grade: formGrade,
          classGroupId: formClassGroupId,
          phoneNumber: formPhone || undefined,
          email: formEmail || undefined,
        });

        const newStudent: Student = {
          ...created,
          status: formStatus,
        };
        upsertStudent(newStudent);
      } else {
        // Edit mode
        if (!selectedStudentId) return;
        const updated = await studentService.updateStudent(selectedStudentId, {
          name: formName,
          nationalId: formNationalId,
          grade: formGrade,
          classGroupId: formClassGroupId,
          phoneNumber: formPhone || undefined,
          email: formEmail || undefined,
        });

        const existing = students.find((s) => s.id === selectedStudentId);
        if (!existing) return;
        upsertStudent({
          ...existing,
          ...updated,
          status: formStatus,
        });
      }
      const savedAt = new Date();
      setLastSavedAt(savedAt);
      setSaveState('saved');
      showToast(
        modalMode === 'add' ? 'دانش‌آموز جدید ثبت شد.' : 'اطلاعات دانش‌آموز ذخیره شد.',
        'success',
      );
      setShowAddEditModal(false);
    } catch (err: unknown) {
      setSaveState('failed');
      showToast(`خطا در ذخیره‌سازی: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  return {
    showAddEditModal,
    modalMode,
    selectedStudentId,
    formName,
    setFormName,
    formNationalId,
    setFormNationalId,
    formGrade,
    setFormGrade,
    formClassGroupId,
    setFormClassGroupId,
    formPhone,
    setFormPhone,
    formEmail,
    setFormEmail,
    formStatus,
    setFormStatus,
    closeStudentEditor,
    openAddModal,
    openEditModal,
    handleSaveStudentSubmit,
    studentDraftDialog,
  };
}
