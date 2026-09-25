import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { useOriginFromTrigger } from '../../hooks/useOriginFromTrigger';
import { usePersistentPreference } from '../../hooks/usePersistentPreference';
import { studentService } from '../../services/api';
import { ClassGroup, Student } from '../../types';
import {
  isValidIranianNationalId,
  parseStudentFile,
  StudentImportIssue,
  StudentImportRow,
} from './parseStudentFile';

type Props = {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  classGroups: ClassGroup[];
  existingStudents: Student[];
  onImported: (students: Student[]) => void;
};
type Step = 'select' | 'parsing' | 'preview' | 'importing' | 'done';

export default function StudentImportWizard({
  open,
  onClose,
  triggerRef,
  classGroups,
  existingStudents,
  onImported,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const [origin, haloOrigin] = useOriginFromTrigger(triggerRef, panelRef, open, haloRef);
  const [step, setStep] = useState<Step>('select');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<StudentImportRow[]>([]);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [showFieldGuidance, setShowFieldGuidance] = usePersistentPreference(
    'guidance:student-import-fields',
    true,
  );
  const [importResult, setImportResult] = useState({ imported: 0, failed: 0 });

  const validation = useMemo(() => {
    const valid: StudentImportRow[] = [];
    const issues: StudentImportIssue[] = [];
    const seen = new Set(existingStudents.map((student) => student.nationalId));
    for (const row of rows) {
      const hasMatchingClass = classGroups.some(
        (group) =>
          group.name === row.className ||
          group.name.includes(row.className) ||
          row.className.includes(group.name),
      );
      if (!row.name || !row.nationalId || !row.className || !row.grade) {
        issues.push({
          row: row.row,
          source: row,
          message: 'نام، کد ملی، کلاس و پایه الزامی هستند.',
        });
      } else if (!isValidIranianNationalId(row.nationalId)) {
        issues.push({ row: row.row, source: row, message: 'کد ملی معتبر نیست.' });
      } else if (seen.has(row.nationalId)) {
        issues.push({ row: row.row, source: row, message: 'کد ملی تکراری است.' });
      } else if (!hasMatchingClass) {
        issues.push({ row: row.row, source: row, message: 'کلاس واردشده در سامانه پیدا نشد.' });
      } else {
        seen.add(row.nationalId);
        valid.push(row);
      }
    }
    return { valid, issues };
  }, [classGroups, existingStudents, rows]);

  const resetAndClose = () => {
    onClose();
    triggerRef.current?.focus();
    window.setTimeout(() => {
      setStep('select');
      setRows([]);
      setFileName('');
      setError('');
      setImportResult({ imported: 0, failed: 0 });
    }, 300);
  };

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        resetAndClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- close captures current reset state

  const downloadTemplate = () => {
    const csv =
      '\uFEFFنام,کد ملی,کلاس,پایه,تلفن,ایمیل\nعلی رضایی,0000000019,کلاس ۷۰۱,هفتم,09120000000,student@example.com\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'azmoonsaz-student-import-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const processFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('حجم فایل باید کمتر از ۱۰ مگابایت باشد.');
      return;
    }
    setError('');
    setFileName(file.name);
    setStep('parsing');
    try {
      const parsed = await parseStudentFile(file);
      if (!parsed.length) throw new Error('هیچ ردیف دانش‌آموزی در فایل پیدا نشد.');
      setRows(parsed);
      setStep('preview');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'خواندن فایل انجام نشد.');
      setStep('select');
    }
  };

  const importRows = async () => {
    if (!validation.valid.length) return;
    setStep('importing');
    setError('');
    const imported: Student[] = [];
    let failed = 0;
    for (const row of validation.valid) {
      const matched = classGroups.find(
        (group) =>
          group.name === row.className ||
          group.name.includes(row.className) ||
          row.className.includes(group.name),
      );
      if (!matched) {
        failed += 1;
        continue;
      }
      try {
        const student = await studentService.createStudent({
          name: row.name,
          nationalId: row.nationalId,
          grade: row.grade,
          classGroupId: matched.id,
          phoneNumber: row.phone,
          email: row.email,
        });
        imported.push({ ...student, status: student.status || 'active' });
      } catch {
        failed += 1;
      }
    }
    if (imported.length) onImported(imported);
    setImportResult({ imported: imported.length, failed });
    if (!imported.length) {
      setError('هیچ ردیفی ثبت نشد. اطلاعات فایل و اتصال شبکه را بررسی کنید.');
      setStep('preview');
      return;
    }
    setStep('done');
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-import-title"
        >
          <motion.button
            type="button"
            aria-label="بستن پنجره ورود دانش‌آموز"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 scrim"
            onClick={resetAndClose}
          />
          <motion.div
            aria-hidden="true"
            initial={false}
            exit={{ backdropFilter: 'blur(0px)', transition: { duration: 0.12 } }}
            className="pointer-events-none absolute inset-0 veil-blur"
          />
          <div className="relative w-full max-w-3xl @container">
            <motion.div
              ref={haloRef}
              aria-hidden="true"
              initial={false}
              exit={{
                backdropFilter: 'blur(0px)',
                backgroundColor: 'rgba(26,28,34,0)',
                transition: { duration: 0.14 },
              }}
              style={haloOrigin ?? undefined}
              className="pointer-events-none absolute area-blur"
            />
            <motion.div
              ref={panelRef}
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={origin ?? { transformOrigin: 'center' }}
              className="relative max-h-[90vh] overflow-y-auto rounded-3xl glx-strong"
            >
              <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-glass-light-stroke)] p-5 glx-inset">
                <div>
                  <h2
                    id="student-import-title"
                    className="flex items-center gap-2 text-heading-3 font-black"
                  >
                    <FileSpreadsheet className="h-5 w-5" />
                    ورود گروهی دانش‌آموزان
                  </h2>
                  <p className="mt-1 text-caption text-[var(--color-text-tertiary)]">
                    CSV و Excel واقعی، با اعتبارسنجی پیش از ثبت
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="grid h-11 w-11 place-items-center rounded-xl hover:bg-[var(--color-surface-secondary)]"
                  aria-label="بستن"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>
              <div className="space-y-5 p-5 sm:p-6">
                {error && (
                  <div
                    role="alert"
                    className="flex gap-2 rounded-xl bg-[var(--color-danger-soft)] p-3 text-caption text-[var(--color-danger)]"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}
                {step === 'select' && (
                  <label
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      processFile(event.dataTransfer.files[0]);
                    }}
                    className={`flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center ${dragging ? 'border-[var(--color-ink)] bg-[var(--color-glass-panel-fill)]' : 'border-[var(--color-glass-light-stroke)] bg-[var(--color-glass-light-fill)]'}`}
                  >
                    <Upload className="h-9 w-9" />
                    <strong>فایل را اینجا رها کنید یا انتخاب کنید</strong>
                    <span className="text-caption text-[var(--color-text-tertiary)]">
                      CSV، XLSX یا XLS · حداکثر ۱۰ مگابایت
                    </span>
                    {showFieldGuidance && (
                      <span className="relative max-w-xl rounded-xl bg-[var(--color-surface-secondary)] p-3 pl-10 text-micro leading-6 text-[var(--color-text-tertiary)]">
                        ستون‌های الزامی: نام، کد ملی، کلاس و پایه. نام کلاس باید با یکی از کلاس‌های
                        ثبت‌شده یکسان باشد؛ تلفن و ایمیل اختیاری‌اند.
                        <button
                          type="button"
                          aria-label="دیگر این راهنما نمایش داده نشود"
                          className="absolute left-1 top-1 rounded-lg p-2"
                          onClick={(event) => {
                            event.preventDefault();
                            setShowFieldGuidance(false);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn-soft mt-2 inline-flex items-center gap-2"
                      onClick={(event) => {
                        event.preventDefault();
                        downloadTemplate();
                      }}
                    >
                      <Download className="h-4 w-4" />
                      دانلود فایل نمونه CSV
                    </button>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="sr-only"
                      onChange={(event) => processFile(event.target.files?.[0])}
                    />
                  </label>
                )}
                {(step === 'parsing' || step === 'importing') && (
                  <div role="status" className="grid min-h-64 place-items-center text-center">
                    <div>
                      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-glass-light-stroke)] border-t-[var(--color-ink)]" />
                      <p>
                        {step === 'parsing' ? 'در حال خواندن فایل…' : 'در حال ثبت دانش‌آموزان…'}
                      </p>
                    </div>
                  </div>
                )}
                {step === 'preview' && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <Summary label="کل ردیف‌ها" value={rows.length} />
                      <Summary label="آماده ورود" value={validation.valid.length} good />
                      <Summary label="نیازمند اصلاح" value={validation.issues.length} bad />
                    </div>
                    <p className="text-caption text-[var(--color-text-secondary)]">{fileName}</p>
                    <div className="max-h-72 overflow-auto rounded-2xl border border-[var(--color-glass-light-stroke)]">
                      <table className="w-full text-caption">
                        <thead className="sticky top-0 bg-[var(--color-surface)]">
                          <tr>
                            <th className="p-3">ردیف</th>
                            <th className="p-3">نام</th>
                            <th className="p-3">کد ملی</th>
                            <th className="p-3">کلاس</th>
                            <th className="p-3">وضعیت</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => {
                            const issue = validation.issues.find((item) => item.row === row.row);
                            return (
                              <tr
                                key={row.row}
                                className="border-t border-[var(--color-glass-light-stroke)]"
                              >
                                <td className="p-3">{row.row}</td>
                                <td className="p-3">{row.name || '—'}</td>
                                <td className="p-3" dir="ltr">
                                  {row.nationalId || '—'}
                                </td>
                                <td className="p-3">{row.className || '—'}</td>
                                <td
                                  className={`p-3 ${issue ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}
                                >
                                  {issue?.message || 'آماده ورود'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-wrap justify-between gap-3">
                      <button
                        type="button"
                        className="btn-soft"
                        onClick={() => {
                          setStep('select');
                          setRows([]);
                        }}
                      >
                        انتخاب فایل دیگر
                      </button>
                      <button
                        type="button"
                        className="btn-brand"
                        disabled={!validation.valid.length}
                        onClick={importRows}
                      >
                        ورود {validation.valid.length.toLocaleString('fa-IR')} دانش‌آموز معتبر
                      </button>
                    </div>
                  </>
                )}
                {step === 'done' && (
                  <div role="status" className="grid min-h-64 place-items-center text-center">
                    <div>
                      <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-[var(--color-success)]" />
                      <h3 className="text-heading-3 font-black">ورود اطلاعات انجام شد</h3>
                      <p className="mt-2 text-caption text-[var(--color-text-secondary)]">
                        {importResult.imported.toLocaleString('fa-IR')} دانش‌آموز اضافه شد.
                      </p>
                      {importResult.failed > 0 && (
                        <p className="mt-2 text-caption text-[var(--color-danger)]">
                          ثبت {importResult.failed.toLocaleString('fa-IR')} ردیف انجام نشد.
                        </p>
                      )}
                      <button type="button" onClick={resetAndClose} className="btn-brand mt-5">
                        بستن
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Summary({
  label,
  value,
  good,
  bad,
}: {
  label: string;
  value: number;
  good?: boolean;
  bad?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 text-center ${good ? 'bg-[var(--color-success-soft)]' : bad ? 'bg-[var(--color-danger-soft)]' : 'bg-[var(--color-glass-panel-fill)]'}`}
    >
      <b className="block text-heading-2">{value.toLocaleString('fa-IR')}</b>
      <span className="text-caption">{label}</span>
    </div>
  );
}
