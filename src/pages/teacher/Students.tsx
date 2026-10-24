/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  PlusCircle,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';

import { Student, Submission } from '../../types';
import { RosterViews } from '../../features/student-roster/RosterViews';
import { useStudentFilters } from '../../features/student-roster/useStudentFilters';
import { useStudentForm } from '../../features/student-roster/useStudentForm';
import { useStudentConfirmActions } from '../../features/student-roster/useStudentConfirmActions';
import { StudentFiltersPanel, StudentSortBar } from '../../features/student-roster/StudentFiltersPanel';
import { StudentEditorModal } from '../../features/student-roster/StudentEditorModal';
import { ExamLogsModal } from '../../features/student-roster/ExamLogsModal';
import {
  Button,
  ConfirmDialog,
  PageHeader,
  UnsavedChangesGuard,} from '../../ui';
import { PanelCrest } from '../../components/PanelCrest';
import StudentImportWizard from '../../features/student-import/StudentImportWizard';
import { useToast } from '../../hooks/useToast';
import { useTeacherCollections } from '../../contexts/TeacherContext';
import SaveStatusIndicator, { type SaveState } from '../../components/SaveStatusIndicator';
import { normalizePersianText } from '../../utils/persian';

export default function Students() {
  const { showToast, toastElement } = useToast();
  // Collections ride the shared cache — no private fetches here anymore.
  const {
    students: rawStudents,
    classGroups,
    submissions,
    exams: allExams,
    status,
    upsertStudent,
    addStudents,
    removeStudent,
  } = useTeacherCollections();

  // Server-shaped status (mapStudent normalizes active/suspended) — the old
  // index-derived demo statuses are gone.
  const students = rawStudents;
  const loading = status.students === 'loading';
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const {
    searchQuery,
    setSearchQuery,
    sortOrder,
    setSortOrder,
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    selectedGrade,
    setSelectedGrade,
    resetSelectedGrade,
    selectedClassGroup,
    setSelectedClassGroup,
    resetSelectedClassGroup,
    selectedStatus,
    setSelectedStatus,
    resetSelectedStatus,
  } = useStudentFilters();

  // Modals state
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showExamLogsModal, setShowExamLogsModal] = useState(false);
  const [activeLogSubmissions, setActiveLogSubmissions] = useState<Submission[]>([]);
  const [activeLogStudent, setActiveLogStudent] = useState<Student | null>(null);

  // Panel origins — each overlay grows out of / collapses back into the button
  // that opened it. The library Modal owns the panel/halo refs and origin
  // measurement internally; call sites only capture the trigger element.
  const addEditTriggerRef = useRef<HTMLElement | null>(null);
  const wizardTriggerRef = useRef<HTMLElement | null>(null);
  const logsTriggerRef = useRef<HTMLElement | null>(null);

  // Browsers focus a button on click, so the active element is the opener —
  // lets every call site report its trigger without threading a ref through
  // each one. Falls back to the panel's own centre when there is no element.
  const captureActiveTrigger = (): HTMLElement | null => {
    const el = document.activeElement;
    return el instanceof HTMLElement && el !== document.body ? el : null;
  };

  const {
    showAddEditModal,
    modalMode,
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
  } = useStudentForm({
    classGroups,
    students,
    upsertStudent,
    showToast,
    setSaveState,
    setLastSavedAt,
    addEditTriggerRef,
    captureActiveTrigger,
  });

  const {
    studentToResetPin,
    setStudentToResetPin,
    handleResetPin,
    confirmResetPin,
    studentToDelete,
    setStudentToDelete,
    handleDeleteStudent,
    confirmDeleteStudent,
  } = useStudentConfirmActions({ students, upsertStudent, removeStudent, showToast });

  const openStudentExamHistory = (student: Student) => {
    logsTriggerRef.current = captureActiveTrigger();
    const studentSubs = submissions.filter((sub) => sub.studentId === student.id);
    setActiveLogStudent(student);
    setActiveLogSubmissions(studentSubs);
    setShowExamLogsModal(true);
  };

  // Filters logic
  const normalizedSearch = normalizePersianText(searchQuery);
  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      !normalizedSearch ||
      normalizePersianText(student.name).includes(normalizedSearch) ||
      normalizePersianText(student.nationalId).includes(normalizedSearch);
    const matchesGrade = selectedGrade === 'all' || student.grade === selectedGrade;
    const matchesClass =
      selectedClassGroup === 'all' || student.classGroupId === selectedClassGroup;
    const matchesStatus = selectedStatus === 'all' || student.status === selectedStatus;

    return matchesSearch && matchesGrade && matchesClass && matchesStatus;
  });
  const sortedStudents = [...filteredStudents].sort((a, b) =>
    sortOrder === 'grade'
      ? a.grade.localeCompare(b.grade, 'fa') || a.name.localeCompare(b.name, 'fa')
      : a.name.localeCompare(b.name, 'fa'),
  );
  const totalPages = Math.max(1, Math.ceil(sortedStudents.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const visibleStudents = sortedStudents.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="در حال بارگذاری دانش‌آموزان">
        <div className="h-28 rounded-3xl bg-[var(--color-surface-secondary)] skeleton" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-36 rounded-2xl bg-[var(--color-surface-secondary)] skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="students-tab-view">
      {toastElement}
      <SaveStatusIndicator state={saveState} savedAt={lastSavedAt} />

      {/* Privacy Warning Card (Critical Safeguard) */}
      <div
        className="bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/20 p-4.5 rounded-2xl flex items-start gap-3 shadow-sm"
        id="privacy-warning-banner"
      >
        <AlertTriangle className="w-5 h-5 text-[var(--color-warning)] shrink-0 mt-0.5" />
        <div className="space-y-1 text-right">
          <p className="text-caption font-bold text-[var(--color-warning)]/80">
            هشدار صیانت از اطلاعات حساس سجلی دانش‌آموزان
          </p>
          <p className="text-micro text-[var(--color-warning)] leading-relaxed">
            کد ملی اطلاعات حساس محسوب می‌شود. از اشتراک‌گذاری فایل دانش‌آموزان با افراد غیرمجاز
            خودداری کنید. تمامی کدملی‌ها و پاسخ‌برگ‌های ارسالی همگام با سامانه امتحانات استعدادهای
            درخشان رمزنگاری می‌شوند.
          </p>
        </div>
      </div>

      {/* Primary Tab Headers */}
      <div
        className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 lens p-6 rounded-2xl"
        id="students-control-board"
      >
        <PageHeader
          title="مدیریت دانش‌آموزان و درگاه ورودی"
          subtitle="افزودن، ویرایش و ورود گروهی اطلاعات دانش‌آموزان"
          actions={
            <>
              {/* Add Manual student */}
              <Button
                id="btn-trigger-add-student"
                onClick={openAddModal}
                icon={<PlusCircle className="w-4 h-4" />}
              >
                افزودن دستی دانش‌آموز
              </Button>

              {/* Import Student Wizard Button */}
              <Button
                id="btn-excel-wizard"
                variant="success"
                icon={<FileSpreadsheet className="w-4 h-4" />}
                onClick={() => {
                  wizardTriggerRef.current = captureActiveTrigger();
                  setShowImportWizard(true);
                }}
              >
                ورود از Excel یا CSV
              </Button>
            </>
          }
        />
      </div>

      <StudentFiltersPanel
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedGrade={selectedGrade}
        setSelectedGrade={setSelectedGrade}
        selectedClassGroup={selectedClassGroup}
        setSelectedClassGroup={setSelectedClassGroup}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        resetSelectedGrade={resetSelectedGrade}
        resetSelectedClassGroup={resetSelectedClassGroup}
        resetSelectedStatus={resetSelectedStatus}
        classGroups={classGroups}
      />

      <StudentSortBar
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        pageSize={pageSize}
        setPageSize={setPageSize}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
        safePage={safePage}
      />

      {/* Main Student Representation Area (Responsive Table vs Mobile Cards) */}
      <div className="lens rounded-3xl overflow-hidden" id="students-grid-box">
        <PanelCrest kind="students" state={filteredStudents.length > 0 ? 'filled' : 'empty'}>
          <RosterViews
            filteredStudents={filteredStudents}
            visibleStudents={visibleStudents}
            classGroups={classGroups}
            onExamHistory={openStudentExamHistory}
            onEdit={openEditModal}
            onResetPin={handleResetPin}
            onDelete={handleDeleteStudent}
          />
        </PanelCrest>
      </div>

      <StudentEditorModal
        showAddEditModal={showAddEditModal}
        closeStudentEditor={closeStudentEditor}
        modalMode={modalMode}
        addEditTriggerRef={addEditTriggerRef}
        handleSaveStudentSubmit={handleSaveStudentSubmit}
        formName={formName}
        setFormName={setFormName}
        formNationalId={formNationalId}
        setFormNationalId={setFormNationalId}
        formGrade={formGrade}
        setFormGrade={setFormGrade}
        formClassGroupId={formClassGroupId}
        setFormClassGroupId={setFormClassGroupId}
        formPhone={formPhone}
        setFormPhone={setFormPhone}
        formEmail={formEmail}
        setFormEmail={setFormEmail}
        formStatus={formStatus}
        setFormStatus={setFormStatus}
        classGroups={classGroups}
      />

      <StudentImportWizard
        open={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        triggerRef={wizardTriggerRef}
        classGroups={classGroups}
        existingStudents={students}
        onImported={addStudents}
      />

      {activeLogStudent && (
        <ExamLogsModal
          showExamLogsModal={showExamLogsModal}
          setShowExamLogsModal={setShowExamLogsModal}
          activeLogStudent={activeLogStudent}
          activeLogSubmissions={activeLogSubmissions}
          allExams={allExams}
          logsTriggerRef={logsTriggerRef}
        />
      )}

      {/* Reset PIN Confirmation (T7) */}
      <ConfirmDialog
        isOpen={studentToResetPin !== null}
        title="بازنشانی رمز دانش‌آموز"
        message={`رمز فعلی «${studentToResetPin?.name}» پاک می‌شود، نشست‌های فعال او بسته می‌شود و در ورود بعدی از او خواسته می‌شود رمز ۶ رقمی جدید تعیین کند. رمز فعلی برای هیچ‌کس — از جمله شما — قابل مشاهده نیست.`}
        confirmText="بازنشانی رمز"
        variant="primary"
        onConfirm={confirmResetPin}
        onCancel={() => setStudentToResetPin(null)}
      />

      {/* Delete Student Confirmation */}
      <ConfirmDialog
        isOpen={studentToDelete !== null}
        title="حذف پرونده دانش‌آموز"
        message={`آیا از حذف پرونده تحصیلی دانش‌آموز «${studentToDelete?.name}» و لغو تمامی دسترسی‌های آزمون او مطمئن هستید؟ این کنش غیرقابل بازگشت است.`}
        confirmText="حذف قطعی"
        variant="danger"
        onConfirm={confirmDeleteStudent}
        onCancel={() => setStudentToDelete(null)}
      />

 <UnsavedChangesGuard {...studentDraftDialog} title="خروج بدون ذخیره؟" />
    </div>
  );
}
