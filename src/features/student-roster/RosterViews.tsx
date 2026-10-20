/**
 * RosterViews — the responsive student listing: the desktop table row set
 * and the mobile card stack, rendered verbatim from the page (de-indented).
 * Presentational: students/classGroups in, five action callbacks out. The
 * page owns all state, filters, pagination and modal wiring.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Edit, Eye, KeyRound, Mail, Smartphone, Trash2 } from 'lucide-react';
import { EmptyState } from '../../ui';
import { AbsenceArt } from '../../components/AbsenceArt';
import { IconButton, PillButton } from '../../ui';
import { toPersianDigits } from '../../utils/persian';
import { maskNationalIdPersian } from './nationalId';
import type { Student } from '../../types';

export type RosterViewsProps = {
  filteredStudents: Student[];
  visibleStudents: Student[];
  classGroups: { id: string; name: string }[];
  onExamHistory: (student: Student) => void;
  onEdit: (student: Student) => void;
  onResetPin: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
};

export function RosterViews({
  filteredStudents,
  visibleStudents,
  classGroups,
  onExamHistory,
  onEdit,
  onResetPin,
  onDelete,
}: RosterViewsProps) {
  return (
    <>
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
                    {/* T7: PIN-set indicator — hash never leaves the server. */}
                    <span
                      className={`mt-1 px-2.5 py-1 rounded-full text-micro font-bold block ${
                        student.pinSet
                          ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/10'
                          : 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]/80 border border-[var(--color-warning)]/10'
                      }`}
                    >
                      {student.pinSet ? 'رمز تعیین شده' : 'بدون رمز'}
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
                        onClick={() => onExamHistory(student)}
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
                        onClick={() => onEdit(student)}
                      >
                        <Edit className="w-4 h-4" />
                      </IconButton>

                      {/* Reset PIN (T7) — clears the hash; student sets a new one next login */}
                      <IconButton
                        id={`reset-pin-std-${student.id}`}
                        label="بازنشانی رمز"
                        title="بازنشانی رمز"
                        size="md"
                        radius="xl"
                        tone="accent"
                        surface="wash"
                        onClick={() => onResetPin(student.id, student.name)}
                      >
                        <KeyRound className="w-4 h-4" />
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
                        onClick={() => onDelete(student.id, student.name)}
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
                  onClick={() => onExamHistory(student)}
                >
                  سوابق آزمون
                </PillButton>
                <PillButton
                  fill="surface"
                  size="md"
                  radius="xl"
                  text="micro"
                  weight="bold"
                  onClick={() => onEdit(student)}
                >
                  ویرایش
                </PillButton>
                <PillButton
                  fill="surface"
                  size="md"
                  radius="xl"
                  text="micro"
                  weight="bold"
                  onClick={() => onResetPin(student.id, student.name)}
                >
                  بازنشانی رمز
                </PillButton>
                <PillButton
                  fill="danger-soft"
                  size="md"
                  radius="xl"
                  onClick={() => onDelete(student.id, student.name)}
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
    </>
  );
}
