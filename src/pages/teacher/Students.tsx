/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PlusCircle,
  Filter,
  Trash2,
  Edit,
  GraduationCap,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  Info,
  FileText,
  Smartphone,
  Mail,
  Eye,
  Activity,
  UserPlus,
} from 'lucide-react';

import { Student, Submission } from '../../types';
import { studentService } from '../../services/api';
import {
  Button,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PillButton,
  SearchInput,
} from '../../ui';
import { PanelCrest } from '../../components/PanelCrest';
import { AbsenceArt } from '../../components/AbsenceArt';
import StudentImportWizard from '../../features/student-import/StudentImportWizard';
import { useToast } from '../../hooks/useToast';
import { usePersistentPreference } from '../../hooks/usePersistentPreference';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useTeacherCollections } from '../../contexts/TeacherContext';
import SaveStatusIndicator, { type SaveState } from '../../components/SaveStatusIndicator';
import { normalizePersianText, toPersianDigits } from '../../utils/persian';

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

  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = usePersistentPreference<'name' | 'grade'>(
    'students:sort',
    'name',
    (value): value is 'name' | 'grade' => value === 'name' || value === 'grade',
  );
  const [pageSize, setPageSize] = usePersistentPreference<number>(
    'students:page-size',
    20,
    (value): value is number => value === 10 || value === 20 || value === 50,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGrade, setSelectedGrade, resetSelectedGrade] = usePersistentPreference(
    'students:grade',
    'all',
  );
  const [selectedClassGroup, setSelectedClassGroup, resetSelectedClassGroup] =
    usePersistentPreference('students:class', 'all');
  const [selectedStatus, setSelectedStatus, resetSelectedStatus] = usePersistentPreference(
    'students:status',
    'all',
  );
  const urlFiltersReady = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setIfPresent = (key: string, setter: (value: string) => void) => {
      const value = params.get(key);
      if (value) setter(value);
    };
    setIfPresent('q', setSearchQuery);
    setIfPresent('grade', setSelectedGrade);
    setIfPresent('class', setSelectedClassGroup);
    setIfPresent('status', setSelectedStatus);
    const urlSort = params.get('sort');
    if (urlSort === 'name' || urlSort === 'grade') setSortOrder(urlSort);
    const urlPageSize = Number(params.get('pageSize'));
    if (urlPageSize === 10 || urlPageSize === 20 || urlPageSize === 50) setPageSize(urlPageSize);
    urlFiltersReady.current = true;
  }, [setPageSize, setSelectedClassGroup, setSelectedGrade, setSelectedStatus, setSortOrder]);

  useEffect(() => {
    if (!urlFiltersReady.current) return;
    const params = new URLSearchParams(window.location.search);
    const values: Record<string, string> = {
      q: searchQuery,
      grade: selectedGrade,
      class: selectedClassGroup,
      status: selectedStatus,
      sort: sortOrder,
      pageSize: String(pageSize),
    };
    Object.entries(values).forEach(([key, value]) => {
      if (
        !value ||
        value === 'all' ||
        (key === 'sort' && value === 'name') ||
        (key === 'pageSize' && value === '20')
      )
        params.delete(key);
      else params.set(key, value);
    });
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [pageSize, searchQuery, selectedClassGroup, selectedGrade, selectedStatus, sortOrder]);

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
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
  const guardStudentDraft = useUnsavedChanges(
    showAddEditModal && formSnapshot !== savedFormSnapshot,
  );
  const closeStudentEditor = () => guardStudentDraft(() => setShowAddEditModal(false));

  // Convert English digits to Persian/Farsi format

  // Iranian National ID validation
  const validateIranianNationalId = (id: string): { isValid: boolean; message: string } => {
    if (!id) return { isValid: false, message: 'لطفاً کد ملی را وارد نمایید.' };
    const cleanId = id.trim().replace(/\D/g, '');
    if (cleanId.length !== 10)
      return { isValid: false, message: 'کد ملی باید دقیقاً ۱۰ رقم عددی باشد.' };
    if (/^(\d)\1{9}$/.test(cleanId))
      return { isValid: false, message: 'شماره ملی نامعتبر است (ارقام تکراری هستند).' };

    const digits = cleanId.split('').map(Number);
    const checkDigit = digits[9];
    const sum = digits.slice(0, 9).reduce((acc, digit, idx) => acc + digit * (10 - idx), 0);
    const remainder = sum % 11;
    const computedCheck = remainder < 2 ? remainder : 11 - remainder;

    if (checkDigit === computedCheck) {
      return { isValid: true, message: 'کد ملی وارد شده معتبر و تایید شده است.' };
    } else {
      return {
        isValid: false,
        message: 'الگوریتم رقم کنترلی کد ملی با استانداردهای ثبت احوال همخوانی ندارد.',
      };
    }
  };

  // Mask function: ۱۲۳****۸۹۰
  const maskNationalIdPersian = (id: string): string => {
    const clean = id.trim().replace(/\D/g, '');
    if (clean.length < 10) return toPersianDigits(clean);
    const part1 = clean.slice(0, 3);
    const part2 = clean.slice(7);
    return toPersianDigits(`${part1}****${part2}`);
  };

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

      {/* Multi-Filter Panel: Search, Grade, Class Group, and Status! */}
      <div
        className="relative lens p-5 rounded-2xl flex flex-col xl:flex-row gap-4 justify-between items-stretch xl:items-center"
        id="multi-filter-wrapper"
      >
        {/* Real-time search by name/nationalId */}
        <div className="flex-1 max-w-md">
          <SearchInput
            placeholder="جستجوی دانش‌آموز با نام و کد ملی..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Selective Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Grade filter */}
          <div className="flex items-center gap-1.5 glx field border px-3 py-1.5 rounded-xl">
            <Filter className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
            <span className="text-micro text-[var(--color-text-tertiary)] font-semibold">
              پایه تحصیلی:
            </span>
            <Dropdown
              id="filter-grade"
              compact
              value={selectedGrade}
              onChange={(v) => setSelectedGrade(v)}
              options={[
                { value: 'all', label: 'همه پایه‌ها' },
                { value: 'هفتم', label: 'پایه هفتم' },
                { value: 'هشتم', label: 'پایه هشتم' },
                { value: 'نهم', label: 'پایه نهم' },
              ]}
            />
          </div>

          {/* Class Group filter */}
          <div className="flex items-center gap-1.5 glx field border px-3 py-1.5 rounded-xl">
            <GraduationCap className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
            <span className="text-micro text-[var(--color-text-tertiary)] font-semibold">
              گروه کلاسی:
            </span>
            <Dropdown
              id="filter-class"
              compact
              value={selectedClassGroup}
              onChange={(v) => setSelectedClassGroup(v)}
              options={[
                { value: 'all', label: 'همه کلاس‌ها' },
                ...classGroups.map((cg) => ({ value: cg.id, label: cg.name })),
              ]}
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5 glx field border px-3 py-1.5 rounded-xl">
            <Activity className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
            <span className="text-micro text-[var(--color-text-tertiary)] font-semibold">
              وضعیت دانش‌آموز:
            </span>
            <Dropdown
              id="filter-status"
              compact
              value={selectedStatus}
              onChange={(v) => setSelectedStatus(v)}
              options={[
                { value: 'all', label: 'همه وضعیت‌ها' },
                { value: 'active', label: 'فعال' },
                { value: 'examining', label: 'در حال آزمون' },
                { value: 'suspended', label: 'کاربر غیرفعال' },
              ]}
            />
          </div>

          {/* Clear Filter button if active */}
          {(searchQuery ||
            selectedGrade !== 'all' ||
            selectedClassGroup !== 'all' ||
            selectedStatus !== 'all') && (
            <PillButton
              fill="danger-soft"
              size="sm"
              radius="lg"
              onClick={() => {
                setSearchQuery('');
                resetSelectedGrade();
                resetSelectedClassGroup();
                resetSelectedStatus();
              }}
              className="hover:bg-[var(--color-danger-soft)]/40 transition-all"
            >
              حذف فیلترها
            </PillButton>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-caption">
          <label htmlFor="student-sort" className="font-bold">
            مرتب‌سازی
          </label>
          <Dropdown
            id="student-sort"
            compact
            value={sortOrder}
            onChange={(v) => {
              setSortOrder(v as 'name' | 'grade');
              setCurrentPage(1);
            }}
            options={[
              { value: 'name', label: 'نام' },
              { value: 'grade', label: 'پایه' },
            ]}
            className="w-24"
          />
          <label htmlFor="student-page-size" className="font-bold">
            در هر صفحه
          </label>
          <Dropdown
            id="student-page-size"
            compact
            value={String(pageSize)}
            onChange={(v) => {
              setPageSize(Number(v));
              setCurrentPage(1);
            }}
            options={[
              { value: '10', label: '۱۰' },
              { value: '20', label: '۲۰' },
              { value: '50', label: '۵۰' },
            ]}
            className="w-20"
          />
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-caption">
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              قبلی
            </Button>
            <span aria-live="polite">
              صفحه {toPersianDigits(safePage)} از {toPersianDigits(totalPages)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              بعدی
            </Button>
          </div>
        )}
      </div>

      {/* Main Student Representation Area (Responsive Table vs Mobile Cards) */}
      <div className="lens rounded-3xl overflow-hidden" id="students-grid-box">
        <PanelCrest kind="students" state={filteredStudents.length > 0 ? 'filled' : 'empty'}>
        {/* Desktop View (Table Layout) */}
        <div className="hidden md:block overflow-x-auto text-right">
          <table className="w-full text-caption" id="students-desk-table">
            <thead className="border-b text-[var(--color-text-primary)]">
              <tr>
                <th className="p-4 font-bold text-right">نام و نام خانوادگی</th>
                <th className="p-4 font-bold text-right">کد ملی (ماسک زنده)</th>
                <th className="p-4 font-bold text-right">پایه</th>
                <th className="p-4 font-bold text-right">کلاس اختصاصی</th>
                <th className="p-4 font-bold text-center">وضعیت</th>
                <th className="p-4 font-bold text-right">راه‌های ارتباطی</th>
                <th className="p-4 font-bold text-center">عملیات تصحیح و پرونده</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-glass-light-stroke)]">
              <AnimatePresence initial={false}>
                {filteredStudents.length > 0 ? (
                  visibleStudents.map((student) => {
                    const classGroup = classGroups.find((c) => c.id === student.classGroupId);

                    return (
                      <motion.tr
                        key={student.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:brightness-105 transition-colors"
                        id={`stud-row-${student.id}`}
                      >
                        {/* Name */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full glx-inset text-[var(--color-text-secondary)] font-black text-caption flex items-center justify-center">
                              {student.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-[var(--color-text-primary)] text-caption">
                                {student.name}
                              </p>
                              <p className="text-micro text-[var(--color-text-tertiary)] mt-0.5">
                                شناسه: {student.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Masked National ID: ۱۲۳****۸۹۰ */}
                        <td className="p-4">
                          <span className="font-mono frost px-2 py-1 rounded-md select-all font-semibold text-[var(--color-text-secondary)] text-micro hover:text-[var(--color-accent)] transition-colors">
                            {maskNationalIdPersian(student.nationalId)}
                          </span>
                        </td>

                        {/* Grade */}
                        <td className="p-4 text-[var(--color-text-secondary)] font-medium">
                          پایه {student.grade}
                        </td>

                        {/* Class */}
                        <td className="p-4 text-[var(--color-text-secondary)] font-bold">
                          {classGroup ? classGroup.name : 'انتساب نیافته'}
                        </td>

                        {/* Status */}
                        <td className="p-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-micro font-bold ${
                              student.status === 'examining'
                                ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[var(--color-warning)]/10 animate-pulse'
                                : student.status === 'suspended'
                                  ? 'bg-[var(--color-danger-soft)]/40 text-[var(--color-danger)] border border-[var(--color-danger)]/10'
                                  : 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/10'
                            }`}
                          >
                            {student.status === 'examining'
                              ? 'در حال آزمون'
                              : student.status === 'suspended'
                                ? 'غیرفعال / مسدود'
                                : 'فعال'}
                          </span>
                        </td>

                        {/* Channels */}
                        <td className="p-4 text-[var(--color-text-tertiary)]">
                          <div className="space-y-1 text-right">
                            {student.phoneNumber && (
                              <p className="text-caption font-mono flex items-center gap-1">
                                <Smartphone className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                                <span>{toPersianDigits(student.phoneNumber)}</span>
                              </p>
                            )}
                            {student.email ? (
                              <p className="text-caption font-mono flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                                <span>{student.email}</span>
                              </p>
                            ) : (
                              !student.phoneNumber && (
                                <p className="text-micro text-[var(--color-text-tertiary)] italic">
                                  بدون اطلاعات تماس
                                </p>
                              )
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* Student exams history */}
                            <IconButton
                              id={`logs-std-${student.id}`}
                              label="سوابق آزمون"
                              title="سوابق آزمون"
                              size="md"
                              radius="xl"
                              tone="accent"
                              surface="wash"
                              onClick={() => openStudentExamHistory(student)}
                            >
                              <Eye className="w-4 h-4" />
                            </IconButton>

                            {/* Edit */}
                            <IconButton
                              id={`edit-std-${student.id}`}
                              label="ویرایش شناسنامه"
                              title="ویرایش شناسنامه"
                              size="md"
                              radius="xl"
                              tone="tertiary"
                              surface="bright"
                              onClick={() => openEditModal(student)}
                            >
                              <Edit className="w-4 h-4" />
                            </IconButton>

                            {/* Delete */}
                            <IconButton
                              id={`delete-std-${student.id}`}
                              label="حذف اطلاعات"
                              title="حذف اطلاعات"
                              size="md"
                              radius="xl"
                              tone="danger"
                              surface="wash"
                              onClick={() => handleDeleteStudent(student.id, student.name)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </IconButton>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="p-4 md:p-6">
                      {/* C.2 abs-4 — filtered to nothing: an absence, not a
                          neutral empty (compact dropped so the art shows). */}
                      <EmptyState
                        art={<AbsenceArt kind="no-results" size={112} />}
                        title="دانش‌آموزی یافت نشد"
                        description="هیچ دانش‌آموزی همسان با فیلترهای بالا یافت نگردید."
                      />
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile View (Card Layout) */}
        <div className="block md:hidden p-4 space-y-3.5" id="students-mob-cards">
          <AnimatePresence initial={false}>
            {filteredStudents.length > 0 ? (
              visibleStudents.map((student) => {
                const classGroup = classGroups.find((c) => c.id === student.classGroupId);
                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="pane p-4.5 rounded-2xl flex flex-col gap-3 text-right text-caption"
                    id={`stud-card-${student.id}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full glx-inset text-[var(--color-text-secondary)] font-bold flex items-center justify-center">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-[var(--color-text-primary)] text-caption">
                            {student.name}
                          </p>
                          <span className="text-micro text-[var(--color-text-tertiary)]">
                            شناسه: {student.id}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-micro font-bold ${
                          student.status === 'examining'
                            ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] animate-pulse'
                            : student.status === 'suspended'
                              ? 'bg-[var(--color-danger-soft)]/40 text-[var(--color-danger)]'
                              : 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                        }`}
                      >
                        {student.status === 'examining'
                          ? 'در حال آزمون'
                          : student.status === 'suspended'
                            ? 'غیرفعال'
                            : 'فعال'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-[var(--color-glass-light-stroke)]/60 pt-3 text-micro text-[var(--color-text-secondary)]">
                      <div>
                        <span className="text-[var(--color-text-tertiary)] block pb-0.5">
                          پایه تحصیلی
                        </span>
                        <span className="font-bold">{student.grade}</span>
                      </div>
                      <div>
                        <span className="text-[var(--color-text-tertiary)] block pb-0.5">
                          کلاس ثبت‌شده
                        </span>
                        <span className="font-bold">{classGroup?.name || 'بدون انتساب'}</span>
                      </div>
                      <div className="col-span-2 pt-1">
                        <span className="text-[var(--color-text-tertiary)] block pb-0.5">
                          کد ملی ورود به آزمون
                        </span>
                        <span className="font-mono bg-[var(--color-surface)] px-2 py-0.5 rounded-md border border-[var(--color-glass-light-stroke)]">
                          {maskNationalIdPersian(student.nationalId)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1 border-t border-[var(--color-glass-light-stroke)]/60 pt-3.5">
                      <PillButton
                        fill="accent-soft"
                        size="md"
                        radius="xl"
                        onClick={() => openStudentExamHistory(student)}
                      >
                        سوابق آزمون
                      </PillButton>
                      <button
                        type="button"
                        onClick={() => openEditModal(student)}
                        className="px-3 py-1.5 btn-glass btn-glass--quiet text-[var(--color-text-secondary)] rounded-xl font-bold text-micro"
                      >
                        ویرایش
                      </button>
                      <PillButton
                        fill="danger-soft"
                        size="md"
                        radius="xl"
                        onClick={() => handleDeleteStudent(student.id, student.name)}
                      >
                        حذف
                      </PillButton>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <EmptyState
                art={<AbsenceArt kind="no-results" size={112} />}
                title="موردی یافت نشد"
                description="هیچ موردی منطبق با فیلترها و مقادیر بالا یافت نشد."
              />
            )}
          </AnimatePresence>
        </div>
        </PanelCrest>
      </div>

      {/* Manual Add / Edit Modal — library chrome: scrim, veil, halo, focus trap */}
      <Modal
        isOpen={showAddEditModal}
        onClose={closeStudentEditor}
        title={
          modalMode === 'add'
            ? 'ایجاد پرونده تحصیلی دانش‌آموز نو'
            : 'ویرایش شناسنامه تحصیلی دانش‌آموز'
        }
        icon={<UserPlus className="w-5 h-5" />}
        maxWidth="sm"
        triggerRef={addEditTriggerRef}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeStudentEditor}>
              انصراف
            </Button>
            <Button type="submit" form="student-editor-form" size="sm" disabled={!formName}>
              {modalMode === 'add' ? 'ثبت دانش‌آموز' : 'ذخیره تغییرات'}
            </Button>
          </>
        }
      >
        <form
          id="student-editor-form"
          onSubmit={handleSaveStudentSubmit}
          className="space-y-4 text-label"
        >
          {/* Family name */}
          <Input
            label="نام و نام خانوادگی:"
            type="text"
            required
            placeholder="مثال: بردیا مهدوی"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />

          {/* National ID + Interactive Live Validation logic */}
          <Input
            label="کد ملی ۱۰ رقمی (رمز عبور دانش‌آموز):"
            type="text"
            required
            maxLength={10}
            placeholder="مثال: 0012487654"
            value={formNationalId}
            onChange={(e) => setFormNationalId(e.target.value.replace(/\D/g, ''))}
            className="font-mono tracking-widest"
          />

          {/* Live validation feedback display! */}
          {formNationalId && (
            <div
              className={`p-2.5 rounded-lg border flex items-start gap-1.5 transition-all text-micro leading-relaxed ${
                validateIranianNationalId(formNationalId).isValid
                  ? 'bg-[var(--color-success-soft)] border-[var(--color-success)]/10/60 text-[var(--color-success)]'
                  : 'bg-[var(--color-danger-soft)]/40 border-[var(--color-danger)]/10/60 text-[var(--color-danger)]/80'
              }`}
            >
              {validateIranianNationalId(formNationalId).isValid ? (
                <CheckCircle className="w-3.5 h-3.5 text-[var(--color-success)] shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-danger)] shrink-0 mt-0.5" />
              )}
              <span>{validateIranianNationalId(formNationalId).message}</span>
            </div>
          )}

          {/* Grade and Class Row */}
          <div className="grid grid-cols-2 gap-4">
            <Dropdown
              label="پایه تحصیلی:"
              value={formGrade}
              onChange={setFormGrade}
              options={[
                { value: 'هفتم', label: 'پایه هفتم' },
                { value: 'هشتم', label: 'پایه هشتم' },
                { value: 'نهم', label: 'پایه نهم' },
              ]}
            />

            <Dropdown
              label="کلاس اختصاصی:"
              value={formClassGroupId}
              onChange={setFormClassGroupId}
              options={[
                { value: '', label: 'بدون کلاس', disabled: true },
                ...classGroups.map((c) => ({ value: c.id, label: c.name })),
              ]}
              placeholder="انتخاب کلاس"
            />
          </div>

          {/* Status Selector */}
          <div className="space-y-1.5">
            <span className="font-semibold text-[var(--color-text-secondary)] block">
              وضعیت دانش‌آموز:
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'active', label: 'فعال' },
                { val: 'suspended', label: 'غیرفعال / مسدود' },
                { val: 'examining', label: 'در حال آزمون' },
              ].map((s) => (
                <button
                  key={s.val}
                  type="button"
                  onClick={() => setFormStatus(s.val as 'active' | 'suspended' | 'examining')}
                  className={`py-2 text-micro rounded-xl border font-bold transition-all cursor-pointer ${
                    formStatus === s.val
                      ? 'btn-glass btn-glass--accent'
                      : 'btn-glass btn-glass--bare'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Phone and Email Optional */}
          <div className="grid grid-cols-2 gap-4 border-t border-[var(--color-glass-light-stroke)] pt-4.5">
            <Input
              label="همراه ولی (اختیاری):"
              type="text"
              placeholder="مثال: 09123456789"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              className="font-mono"
            />

            <Input
              label="پست الکترونیک (ایمیل):"
              type="email"
              placeholder="stud@school.ir"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              className="font-mono text-left"
            />
          </div>

          {/* Error messages if form is incomplete */}
          {!formName && (
            <p className="text-micro text-[var(--color-danger)] text-center font-bold">
              برای ذخیره، فیلد نام و فامیل دانش‌آموز الزامی است.
            </p>
          )}
        </form>
      </Modal>

      <StudentImportWizard
        open={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        triggerRef={wizardTriggerRef}
        classGroups={classGroups}
        existingStudents={students}
        onImported={addStudents}
      />

      {activeLogStudent && (
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
              <span className="text-micro font-bold text-[var(--color-text-primary)] block">
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
                          <h5 className="font-bold text-[var(--color-text-secondary)] text-micro">
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
                          <span className="text-micro font-bold text-[var(--color-text-primary)]">
                            نمره:{' '}
                            <strong className="text-caption font-black text-[var(--color-accent)]">
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
      )}

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
    </div>
  );
}
