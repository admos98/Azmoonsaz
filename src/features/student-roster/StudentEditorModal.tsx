/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


/**
 * Manual Add/Edit student modal — the form JSX moved verbatim from
 * src/pages/teacher/Students.tsx (de-indented). Presentational: form state,
 * setters, submit handler and class groups in, JSX out.
 */
import { AlertTriangle, CheckCircle, UserPlus } from 'lucide-react';
import type { FormEvent, RefObject } from 'react';
import { Button, Dropdown, Input, Modal, PillButton } from '../../ui';
import { validateIranianNationalId } from './nationalId';
import type { ClassGroup } from '../../types';

export type StudentEditorModalProps = {
  showAddEditModal: boolean;
  closeStudentEditor: () => void;
  modalMode: 'add' | 'edit';
  addEditTriggerRef: RefObject<HTMLElement | null>;
  handleSaveStudentSubmit: (e: FormEvent) => void;
  formName: string;
  setFormName: (value: string) => void;
  formNationalId: string;
  setFormNationalId: (value: string) => void;
  formGrade: string;
  setFormGrade: (value: string) => void;
  formClassGroupId: string;
  setFormClassGroupId: (value: string) => void;
  formPhone: string;
  setFormPhone: (value: string) => void;
  formEmail: string;
  setFormEmail: (value: string) => void;
  formStatus: 'active' | 'suspended' | 'examining';
  setFormStatus: (value: 'active' | 'suspended' | 'examining') => void;
  classGroups: ClassGroup[];
};

export function StudentEditorModal({
  showAddEditModal,
  closeStudentEditor,
  modalMode,
  addEditTriggerRef,
  handleSaveStudentSubmit,
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
  classGroups,
}: StudentEditorModalProps) {
  return (
    <>
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
              <PillButton
                key={s.val}
                fill={formStatus === s.val ? 'accent-soft' : 'surface'}
                size="md"
                radius="xl"
                text="micro"
                weight="bold"
                textColor={formStatus === s.val ? 'accent' : 'secondary'}
                aria-pressed={formStatus === s.val}
                onClick={() => setFormStatus(s.val as 'active' | 'suspended' | 'examining')}
                className={`py-2 border ${formStatus === s.val ? 'btn-glass btn-glass--accent' : ''}`}
              >
                {s.label}
              </PillButton>
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
          <p className="text-micro text-[var(--color-danger)] text-center">
            برای ذخیره، فیلد نام و فامیل دانش‌آموز الزامی است.
          </p>
        )}
      </form>
    </Modal>
    </>
  );
}
