/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit3, AlertCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dropdown,
  Modal,
  Table,
} from '../../components/UIComponents';
import { classService } from '../../services/api';
import { ClassGroup } from '../../types';
import { formatPersianNumber } from '../../services/persianHelpers';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useTeacherCollections } from '../../contexts/TeacherContext';
import { BubbleLoader } from '../../components/BubbleLoader';
import { PanelCrest } from '../../components/PanelCrest';
import { AbsenceArt } from '../../components/AbsenceArt';

export default function Classes() {
  // The class list rides the shared cache — this page used to refetch the
  // whole collection after every mutation; patches make that unnecessary.
  const {
    classGroups: classes,
    status,
    upsertClassGroup,
    removeClassGroup,
  } = useTeacherCollections();
  const loading = status.classGroups === 'loading';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
  const [formData, setFormData] = useState({ name: '', grade: '' });
  const [savedFormData, setSavedFormData] = useState(formData);
  const guardClassDraft = useUnsavedChanges(
    isModalOpen && JSON.stringify(formData) !== JSON.stringify(savedFormData),
  );
  const closeClassEditor = () => guardClassDraft(() => setIsModalOpen(false));
  const [error, setError] = useState<string | null>(null);
  const loadError = status.classGroups === 'error';

  const handleOpenModal = (cls?: ClassGroup) => {
    if (cls) {
      setEditingClass(cls);
      setFormData({ name: cls.name, grade: cls.grade });
    } else {
      setEditingClass(null);
      setFormData({ name: '', grade: '' });
    }
    setSavedFormData(cls ? { name: cls.name, grade: cls.grade } : { name: '', grade: '' });
    setIsModalOpen(true);
    setError(null);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.grade) {
      setError('لطفاً تمامی فیلدها را پر کنید.');
      return;
    }

    try {
      if (editingClass) {
        const updated = await classService.updateClassGroup(
          editingClass.id,
          formData.name,
          formData.grade,
        );
        upsertClassGroup(updated);
      } else {
        const created = await classService.createClassGroup(formData.name, formData.grade);
        upsertClassGroup(created);
      }
      setIsModalOpen(false);
    } catch (_err) {
      setError('خطایی در ذخیره‌سازی رخ داد.');
    }
  };

  const [classToDelete, setClassToDelete] = useState<string | null>(null);
  const [undoDelete, setUndoDelete] = useState<ClassGroup | null>(null);
  const deleteTimerRef = useRef<number | null>(null);
  const addClassTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(
    () => () => {
      if (deleteTimerRef.current) window.clearTimeout(deleteTimerRef.current);
    },
    [],
  );

  const handleDelete = (id: string) => {
    setClassToDelete(id);
  };

  const confirmDeleteClass = () => {
    if (!classToDelete) return;
    const removed = classes.find((item) => item.id === classToDelete);
    if (!removed) return;
    if (deleteTimerRef.current) window.clearTimeout(deleteTimerRef.current);
    removeClassGroup(removed.id);
    setUndoDelete(removed);
    setClassToDelete(null);
    deleteTimerRef.current = window.setTimeout(async () => {
      try {
        await classService.deleteClassGroup(removed.id);
        setUndoDelete(null);
      } catch (_err) {
        upsertClassGroup(removed);
        setUndoDelete(null);
        setError('کلاس حذف نشد و به فهرست بازگردانده شد. دوباره تلاش کنید.');
      }
    }, 5000);
  };

  const undoClassDeletion = () => {
    if (!undoDelete) return;
    if (deleteTimerRef.current) window.clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = null;
    upsertClassGroup(undoDelete);
    setUndoDelete(null);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-1 font-black text-[var(--color-text-primary)]">
            مدیریت گروه‌های کلاسی
          </h1>
          <p className="text-label text-[var(--color-text-tertiary)] mt-1">
            سازماندهی دانش‌آموزان بر اساس پایه و کلاس
          </p>
        </div>
        <Button
          ref={addClassTriggerRef}
          onClick={() => handleOpenModal()}
          variant="primary"
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>افزودن کلاس جدید</span>
        </Button>
      </div>

      {(error || loadError) && (
        <div className="bg-[var(--color-danger-soft)]/40 border border-[var(--color-danger)]/20 text-[var(--color-danger)]/80 p-4 rounded-2xl text-caption font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error || 'خطا در بارگذاری گروه‌های کلاسی.'}
        </div>
      )}

      {undoDelete && (
        <div
          role="status"
          className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--color-warning-soft)] p-4 text-caption font-bold text-[var(--color-text-primary)]"
        >
          <span>کلاس «{undoDelete.name}» حذف شد.</span>
          <Button variant="secondary" size="sm" onClick={undoClassDeletion}>
            بازگردانی
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <BubbleLoader />
        </div>
      ) : (
        <Card className="overflow-hidden border-[var(--color-glass-light-stroke)] shadow-sm">
          <PanelCrest kind="classes" state={classes.length > 0 ? 'filled' : 'empty'}>
          <Table
            headers={[
              { key: 'name', label: 'نام کلاس' },
              { key: 'grade', label: 'پایه تحصیلی' },
              { key: 'count', label: 'تعداد دانش‌آموزان', align: 'center' },
              { key: 'actions', label: 'عملیات', align: 'center' },
            ]}
            data={classes}
            renderRow={(cls) => (
              <tr
                key={cls.id}
                className="hover:brightness-105 transition-colors text-caption md:text-label"
              >
                <td className="p-4 font-bold text-[var(--color-text-secondary)]">{cls.name}</td>
                <td className="p-4">
                  <Badge variant="slate" className="glx-inset text-[var(--color-text-secondary)]">
                    {cls.grade}
                  </Badge>
                </td>
                <td className="p-4 text-center font-mono text-[var(--color-text-secondary)]">
                  {formatPersianNumber(cls.studentCount)} نفر
                </td>
                <td className="p-4 flex items-center justify-center gap-2">
                  <Button
                    onClick={() => handleOpenModal(cls)}
                    variant="ghost"
                    size="sm"
                    className="text-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(cls.id)}
                    disabled={Boolean(undoDelete)}
                    variant="ghost"
                    size="sm"
                    className="text-[var(--color-danger)] hover:text-[var(--color-danger)]/80 hover:bg-[var(--color-danger-soft)]/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            )}
            renderMobileCard={(cls) => (
              <Card key={cls.id} glassLayer="strong" className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-[var(--color-text-primary)]">{cls.name}</h4>
                    <p className="text-micro text-[var(--color-text-tertiary)]">پایه {cls.grade}</p>
                  </div>
                  <span className="text-micro font-bold bg-[var(--color-accent-soft)] text-[var(--color-accent)] px-2 py-1 rounded-lg">
                    {formatPersianNumber(cls.studentCount)} دانش‌آموز
                  </span>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-glass-light-stroke)]">
                  <Button onClick={() => handleOpenModal(cls)} variant="ghost" size="sm">
                    ویرایش
                  </Button>
                  <Button
                    onClick={() => handleDelete(cls.id)}
                    disabled={Boolean(undoDelete)}
                    variant="danger"
                    size="sm"
                  >
                    حذف
                  </Button>
                </div>
              </Card>
            )}
            emptyTitle="هنوز کلاسی ندارید"
            emptyDesc="اولین کلاس خود را بسازید تا دانش‌آموزان را دسته‌بندی کنید."
            emptyArt={<AbsenceArt kind="no-classes" size={112} />}
            emptyAction={
              <Button variant="primary" size="sm" onClick={() => handleOpenModal()}>
                <Plus className="w-4 h-4" />
                افزودن کلاس جدید
              </Button>
            }
          />
          </PanelCrest>
        </Card>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeClassEditor}
        title={editingClass ? 'ویرایش اطلاعات کلاس' : 'افزودن کلاس جدید'}
        triggerRef={addClassTriggerRef}
      >
        <div className="space-y-4 text-right" dir="rtl">
          <div className="space-y-1.5">
            <label className="text-caption font-bold text-[var(--color-text-secondary)] block">
              نام کلاس / گروه
            </label>
            <input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="مثلاً کلاس ۷۰۱ یا گروه پیشرفته نهم"
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-glass-light-stroke)] glx field text-label focus:ring-2 focus:ring-[var(--color-accent)] outline-none transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-caption font-bold text-[var(--color-text-secondary)] block">
              پایه تحصیلی
            </label>
            <Dropdown
              value={formData.grade}
              onChange={(v) => setFormData({ ...formData, grade: v })}
              options={[
                { value: '', label: 'انتخاب پایه...' },
                { value: 'اول', label: 'اول', group: 'دبستان' },
                { value: 'دوم', label: 'دوم', group: 'دبستان' },
                { value: 'سوم', label: 'سوم', group: 'دبستان' },
                { value: 'چهارم', label: 'چهارم', group: 'دبستان' },
                { value: 'پنجم', label: 'پنجم', group: 'دبستان' },
                { value: 'ششم', label: 'ششم', group: 'دبستان' },
                { value: 'هفتم', label: 'هفتم', group: 'دوره اول متوسطه' },
                { value: 'هشتم', label: 'هشتم', group: 'دوره اول متوسطه' },
                { value: 'نهم', label: 'نهم', group: 'دوره اول متوسطه' },
                { value: 'دهم', label: 'دهم', group: 'دوره دوم متوسطه' },
                { value: 'یازدهم', label: 'یازدهم', group: 'دوره دوم متوسطه' },
                { value: 'دوازدهم', label: 'دوازدهم', group: 'دوره دوم متوسطه' },
              ]}
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button onClick={closeClassEditor} variant="ghost">
              انصراف
            </Button>
            <Button onClick={handleSave} variant="primary">
              ذخیره تغییرات
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Class Confirmation */}
      <ConfirmDialog
        isOpen={classToDelete !== null}
        title="حذف کلاس"
        message="آیا از حذف این کلاس و تمامی ارتباطات آن با دانش‌آموزان مطمئن هستید؟"
        confirmText="حذف قطعی"
        variant="danger"
        onConfirm={confirmDeleteClass}
        onCancel={() => setClassToDelete(null)}
      />
    </div>
  );
}
