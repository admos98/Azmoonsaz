import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { AbsenceArt } from '../../components/AbsenceArt';
import { Seal } from '../../components/Seal';
import { usePersistentPreference } from '../../hooks/usePersistentPreference';
import { studentService } from '../../services/api';
import { ClassGroup, Student, StudentImportFailure } from '../../types';
import { isValidIranianNationalId } from './nationalId';
import type { StudentImportIssue, StudentImportRow } from './parseStudentFile';
import { Button, IconButton, Modal } from '../../ui';
import { BubbleLoader } from '../../components/BubbleLoader';

/* The parsers (xlsx + papaparse, ~121 KB gz together) are the heaviest thing
   in the app. They are imported ONLY when a file is actually parsed, so the
   Dashboard route — which hosts this wizard — never downloads them. */
type ParseModule = typeof import('./parseStudentFile');
let parseModulePromise: Promise<ParseModule> | null = null;
const loadParseModule = () => {
  parseModulePromise ??= import('./parseStudentFile');
  return parseModulePromise;
};

type Props = {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  classGroups: ClassGroup[];
  existingStudents: Student[];
  onImported: (students: Student[]) => void;
};
type Step = 'select' | 'parsing' | 'preview' | 'importing' | 'done';

/** Server failure reason -> the sentence shown to the teacher. */
const FAIL_REASON_LABELS: Record<string, string> = {
  missing_student_name: 'نام وارد نشده است.',
  missing_student_grade: 'پایه تحصیلی وارد نشده است.',
  invalid_national_id: 'کد ملی معتبر نیست.',
  class_not_found: 'کلاس در سامانه پیدا نشد.',
  duplicate_student: 'کد ملی تکراری است.',
  student_create_failed: 'ثبت این ردیف ناموفق بود.',
};

const failReasonLabel = (reason: string) =>
  FAIL_REASON_LABELS[reason] || 'ثبت این ردیف ناموفق بود.';

export default function StudentImportWizard({
  open,
  onClose,
  triggerRef,
  classGroups,
  existingStudents,
  onImported,
}: Props) {
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
  const [failedRows, setFailedRows] = useState<StudentImportFailure[]>([]);
  // One controller for the in-flight import; closing the modal aborts it.
  const importAbortRef = useRef<AbortController | null>(null);

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
    importAbortRef.current?.abort();
    importAbortRef.current = null;
    onClose();
    window.setTimeout(() => {
      setStep('select');
      setRows([]);
      setFileName('');
      setError('');
      setImportResult({ imported: 0, failed: 0 });
      setFailedRows([]);
    }, 300);
  };

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
      const { parseStudentFile } = await loadParseModule();
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
    setFailedRows([]);

    // Resolve class ids once, then ship the entire batch in ONE request.
    const payload: (Omit<Student, 'id' | 'maskedNationalId'> & { row?: number })[] = [];
    for (const row of validation.valid) {
      const matched = classGroups.find(
        (group) =>
          group.name === row.className ||
          group.name.includes(row.className) ||
          row.className.includes(group.name),
      );
      if (!matched) continue; // pre-validated; guards against a stale class list
      payload.push({
        row: row.row,
        name: row.name,
        nationalId: row.nationalId,
        grade: row.grade,
        classGroupId: matched.id,
        phoneNumber: row.phone,
        email: row.email,
      });
    }
    if (!payload.length) {
      setError('هیچ ردیفی قابل ثبت نیست. فهرست کلاس‌ها را بررسی کنید.');
      setStep('preview');
      return;
    }

    const controller = new AbortController();
    importAbortRef.current = controller;
    try {
      const result = await studentService.importStudents(payload, { signal: controller.signal });
      const importedStudents: Student[] = result.imported;
      setFailedRows(result.failed);
      setImportResult({ imported: importedStudents.length, failed: result.failed.length });
      if (importedStudents.length) onImported(importedStudents);
      // The request answered — show the outcome even when every row failed,
      // because the per-row reasons ARE the answer (no partial silence).
      setStep('done');
    } catch (caught) {
      if (controller.signal.aborted) return; // modal closed mid-flight
      setError(
        caught instanceof Error && caught.message
          ? `ورود گروهی قطع شد: ${caught.message}`
          : 'ورود گروهی انجام نشد. اتصال شبکه را بررسی کنید.',
      );
      setStep('preview');
    } finally {
      importAbortRef.current = null;
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={resetAndClose}
      title="ورود گروهی دانش‌آموزان"
      icon={<FileSpreadsheet className="h-5 w-5" />}
      maxWidth="3xl"
      triggerRef={triggerRef}
      footerClassName="justify-between"
      footer={
        step === 'preview' ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setStep('select');
                setRows([]);
              }}
            >
              انتخاب فایل دیگر
            </Button>
            <Button disabled={!validation.valid.length} onClick={importRows}>
              ورود {validation.valid.length.toLocaleString('fa-IR')} دانش‌آموز معتبر
            </Button>
          </>
        ) : undefined
      }
      bodyClassName="p-5 sm:p-6 space-y-5 overflow-y-auto text-caption md:text-label text-[var(--color-text-secondary)] leading-relaxed text-right"
    >
      <p className="text-caption text-[var(--color-text-tertiary)]">
        CSV و Excel واقعی، با اعتبارسنجی پیش از ثبت
      </p>
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl bg-[var(--color-danger-soft)] p-3 text-caption text-[var(--color-danger)]"
        >
          {/* C.2 abs-3 — the import-failed piece carries the moment; the
              message beside it carries the meaning. */}
          <AbsenceArt kind="import-failed" size={56} />
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
            <span className="relative max-w-xl rounded-xl frost p-3 pl-10 text-micro leading-6 text-[var(--color-text-tertiary)]">
              ستون‌های الزامی: نام، کد ملی، کلاس و پایه. نام کلاس باید با یکی از کلاس‌های ثبت‌شده
              یکسان باشد؛ تلفن و ایمیل اختیاری‌اند.
              <IconButton
                label="دیگر این راهنما نمایش داده نشود"
                size="md"
                radius="lg"
                tone="inherit"
                surface="none"
                motion={false}
                className="absolute left-1 top-1"
                onClick={(event) => {
                  event.preventDefault();
                  setShowFieldGuidance(false);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </IconButton>
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            icon={<Download className="h-4 w-4" />}
            onClick={(event) => {
              event.preventDefault();
              downloadTemplate();
            }}
          >
            دانلود فایل نمونه CSV
          </Button>
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
            <div className="mb-4">
              <BubbleLoader label={null} />
            </div>
            <p>{step === 'parsing' ? 'در حال خواندن فایل…' : 'در حال ثبت دانش‌آموزان…'}</p>
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
              <thead className="sticky top-0 chrome-blur">
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
                    <tr key={row.row} className="border-t border-[var(--color-glass-light-stroke)]">
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
        </>
      )}
      {step === 'done' && (
        <div role="status" className="space-y-4 py-2 text-center">
          <div>
            {importResult.imported > 0 ? (
              /* C.3 — full-panel success wears the seal (never a toast). */
              <Seal size={96} className="mx-auto mb-3" />
            ) : (
              <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-[var(--color-danger)]" />
            )}
            <h3 className="text-heading-3 font-black">
              {importResult.imported > 0 ? 'ورود اطلاعات انجام شد' : 'هیچ ردیفی ثبت نشد'}
            </h3>
            <p className="mt-2 text-caption text-[var(--color-text-secondary)]">
              {importResult.imported.toLocaleString('fa-IR')} دانش‌آموز اضافه شد.
            </p>
            {importResult.failed > 0 && (
              <p className="mt-2 text-caption text-[var(--color-danger)]">
                ثبت {importResult.failed.toLocaleString('fa-IR')} ردیف انجام نشد:
              </p>
            )}
          </div>
          {/* Every failed row is named — a count alone is partial silence. */}
          {failedRows.length > 0 && (
            <ul className="max-h-56 space-y-1.5 overflow-auto rounded-2xl border border-[var(--color-glass-light-stroke)] p-3 text-right text-caption">
              {failedRows.map((failure) => (
                <li
                  key={`${failure.row}-${failure.reason}`}
                  className="flex items-baseline justify-between gap-3 rounded-xl bg-[var(--color-danger-soft)] px-3 py-2"
                >
                  <span className="font-bold text-[var(--color-text-primary)]">
                    ردیف {failure.row.toLocaleString('fa-IR')}
                  </span>
                  <span className="text-[var(--color-danger)]">
                    {failReasonLabel(failure.reason)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {/* The modal's X closes (resetAndClose) — no duplicate close button. */}
        </div>
      )}
    </Modal>
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
