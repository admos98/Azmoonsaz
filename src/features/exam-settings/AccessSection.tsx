/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SECTION 2: access levels and student presence (classes, student picker,
 * national-id/entry-code, max attempts) — moved verbatim from
 * src/pages/teacher/ExamSettings.tsx. Presentational: state + handlers in.
 */
import { Check, Users } from 'lucide-react';
import { Input, SearchInput, TextLink, Toggle } from '../../ui';
import { toPersianDigits } from '../../utils/persian';
import { ClassGroup, Student } from '../../types';

interface AccessSectionProps {
  classGroups: ClassGroup[];
  allowedClasses: string[];
  handleToggleClass: (classId: string) => void;
  limitToSpecificStudents: boolean;
  setLimitToSpecificStudents: (value: boolean) => void;
  studentSearchQuery: string;
  setStudentSearchQuery: (value: string) => void;
  filteredStudents: Student[];
  handleToggleStudent: (studentId: string) => void;
  allowedStudents: string[];
  activeClassStudents: Student[];
  handleSelectAllStudentsForClass: (classId: string) => void;
  requireNationalId: boolean;
  setRequireNationalId: (value: boolean) => void;
  entryCode: string;
  setEntryCode: (value: string) => void;
  maxAttempts: number;
  setMaxAttempts: (value: number) => void;
}

export function AccessSection({
  classGroups,
  allowedClasses,
  handleToggleClass,
  limitToSpecificStudents,
  setLimitToSpecificStudents,
  studentSearchQuery,
  setStudentSearchQuery,
  filteredStudents,
  handleToggleStudent,
  allowedStudents,
  activeClassStudents,
  handleSelectAllStudentsForClass,
  requireNationalId,
  setRequireNationalId,
  entryCode,
  setEntryCode,
  maxAttempts,
  setMaxAttempts,
}: AccessSectionProps) {
 return (
 <>
 {/* SECTION 2: دسترسی دانش‌آموزان */}
 <div className="relative lens p-6 rounded-3xl space-y-4">
 <h2 className="text-caption font-bold text-[var(--color-text-primary)] flex items-center gap-2 pb-2.5 border-b border-[var(--color-glass-light-stroke)]">
 <Users className="w-5 h-5 text-[var(--color-accent)]" />
 <span>۲. سطوح دسترسی و حضور دانش‌آموزان</span>
 </h2>

 {/* Allowed classes groups */}
 <div className="space-y-2">
 <span className="text-caption font-bold text-[var(--color-text-secondary)] block">
 کلاس‌های درسی مجاز جهت شرکت در آزمون:
 </span>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
 {classGroups.map((cls) => {
 const isChecked = allowedClasses.includes(cls.id);
 return (
 <div
 key={cls.id}
 onClick={() => handleToggleClass(cls.id)}
 className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
 isChecked
 ? 'border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)]/40 text-[var(--color-accent)] font-bold'
 : 'border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:brightness-105'
 }`}
 >
 <div className="flex items-center gap-2">
 <div
 className={`w-4 h-4 rounded-md border flex items-center justify-center ${
 isChecked ? 'btn-glass btn-glass--accent' : 'btn-glass btn-glass--bare'
 }`}
 >
 {isChecked && <Check className="w-3 h-3" />}
 </div>
 <span className="text-caption">{cls.name}</span>
 </div>
 <span className="glx-inset border border-[var(--color-glass-light-stroke)] text-micro text-[var(--color-text-tertiary)] px-2 py-0.5 rounded-md font-mono">
 {toPersianDigits(cls.studentCount)} نفر
 </span>
 </div>
 );
 })}
 </div>
 </div>

 {/* Advanced limit to specific students filter toggler */}
 {allowedClasses.length > 0 && (
 <div className="pt-3 border-t border-[var(--color-glass-light-stroke)] space-y-3">
 <div className="flex items-center justify-between">
 <div className="space-y-0.5 text-right">
 <span className="text-caption font-bold text-[var(--color-text-secondary)] block">
 انتخاب انتخابی دانش‌آموزان (فیلتر بر اساس نام):
 </span>
 <p className="text-micro text-[var(--color-text-tertiary)]">
 به صورت پیش‌فرض تمام اعضای کلاس‌ها مجازند. در غیر این صورت دستی محدود نمایید.
 </p>
 </div>
 <button
 type="button"
 onClick={() => setLimitToSpecificStudents(!limitToSpecificStudents)}
 className={`px-3 py-1 rounded-xl text-micro font-bold transition-all cursor-pointer ${
 limitToSpecificStudents
 ? 'bg-[var(--color-danger-soft)]/40 text-[var(--color-danger)] border border-[var(--color-danger)]/20'
 : 'glx-inset text-[var(--color-text-secondary)] hover:glx-inset'
 }`}
 >
 {limitToSpecificStudents
 ? 'محدودسازی به افراد خاص: فعال ⚠️'
 : 'آزاد برای کل کلاس'}
 </button>
 </div>

 {limitToSpecificStudents && (
 <div className="space-y-3 p-4 pane rounded-2xl">
 <SearchInput
 placeholder="جستجوی دانش‌آموز با نام یا کدملی..."
 value={studentSearchQuery}
 onChange={(e) => setStudentSearchQuery(e.target.value)}
 className="text-caption"
 />

 <div className="max-h-48 overflow-y-auto space-y-1 pane p-2 rounded-xl">
 {filteredStudents.length === 0 ? (
 <p className="text-micro text-[var(--color-text-tertiary)] text-center py-4">
 دانش‌آموزی از کلاس‌های انتخاب شده یافت نشد.
 </p>
 ) : (
 filteredStudents.map((student) => {
 const isChecked = allowedStudents.includes(student.id);
 const clsName =
 classGroups.find((c) => c.id === student.classGroupId)?.name || '';
 return (
 <div
 key={student.id}
 onClick={() => handleToggleStudent(student.id)}
 className={`p-2 rounded-lg text-caption flex items-center justify-between cursor-pointer hover:brightness-105 transition-all ${
 isChecked
 ? 'bg-[var(--color-accent-soft)]/30 font-bold text-[var(--color-accent)]'
 : 'text-[var(--color-text-secondary)]'
 }`}
 >
 <div className="flex items-center gap-2">
 <div
 className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center ${
 isChecked
 ? 'btn-glass btn-glass--accent'
 : 'btn-glass btn-glass--bare'
 }`}
 >
 {isChecked && <Check className="w-2.5 h-2.5" />}
 </div>
 <span>{student.name}</span>
 </div>
 <div className="flex items-center gap-2 text-micro text-[var(--color-text-tertiary)]">
 <span>{clsName}</span>
 <span className="glx-inset px-1.5 rounded font-mono text-micro">
 کدملی: {toPersianDigits(student.nationalId)}
 </span>
 </div>
 </div>
 );
 })
 )}
 </div>

 {/* Select/deselect helper */}
 <div className="flex justify-between items-center text-micro text-[var(--color-accent)] font-semibold px-1">
 <span>
 کل افراد منتخب: {toPersianDigits(allowedStudents.length)} از{' '}
 {toPersianDigits(activeClassStudents.length)} نفر
 </span>
 <div className="flex gap-3">
 {allowedClasses.map((cid) => {
 const clsName = classGroups.find((c) => c.id === cid)?.name || '';
 return (
 <TextLink
 key={cid}
 size="sm"
 tone="inherit"
 onClick={() => handleSelectAllStudentsForClass(cid)}
 >
 وارونه کردن دسترسی {clsName}
 </TextLink>
 );
 })}
 </div>
 </div>
 </div>
 )}
 </div>
 )}

 {/* National Id toggle & Entry custom Password */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[var(--color-glass-light-stroke)]">
 <Toggle
 id="national-id-login-toggle"
 checked={requireNationalId}
 onChange={setRequireNationalId}
 label="ورود با اعتبارسنجی کد ملی"
 description="تطابق هویت الزامی دانش‌آموز بر اساس شماره کد ملی او در سیستم به هنگام کلیک ورود."
 className="p-3.5 pane rounded-2xl"
 />

 <Input
 label="کد ورود اختیاری (رمز آزمون):"
 id="optional-entry-code-input"
 type="text"
 placeholder="مثال: MATH2026 (اختیاری)"
 value={entryCode}
 onChange={(e) => setEntryCode(e.target.value)}
 className="font-semibold text-center"
 helperText="رمز مشترکی است که کل دانش‌آموزان قبل آغاز باید آن را در کیبورد خود کلید کنند."
 />
 </div>

 {/* Max attempts */}
 <div className="pt-3 border-t border-[var(--color-glass-light-stroke)] flex items-center justify-between">
 <span className="text-caption font-bold text-[var(--color-text-secondary)]">
 تعداد تلاش مجاز برای شرکت در کل آزمون:
 </span>
 <div className="flex items-center gap-2">
 <Input
 wrapperClassName="w-20 shrink-0"
 size="sm"
 type="number"
 min={1}
 max={5}
 value={maxAttempts}
 onChange={(e) => setMaxAttempts(Number(e.target.value))}
 className="font-bold text-center"
 />
 <span className="text-caption text-[var(--color-text-tertiary)]">
 مرتبه آزمون مجدد
 </span>
 </div>
 </div>
 </div>
 </>
 );
}
