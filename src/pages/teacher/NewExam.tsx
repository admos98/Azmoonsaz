/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { Exam } from '../../types';
import { examService } from '../../services/api';
import { Dropdown, Input, PillButton, Textarea, Toggle } from '../../components/UIComponents';
import { useTeacherCollections } from '../../contexts/TeacherContext';

interface NewExamProps {
  onBack: () => void;
  onAddExam?: (newExam: Exam) => void;
}

export default function NewExam({ onBack, onAddExam }: NewExamProps) {
  const [step, setStep] = useState(1);
  const { showToast, toastElement } = useToast();

  // Step 1 states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [grade, setGrade] = useState('هفتم');
  const [subject, setSubject] = useState('علوم تجربی');
  const [selectedClasses, setSelectedClasses] = useState<string[]>(['c-1']);

  // Step 2 states (Question IDs from bank) — the bank rides the shared cache
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  // Step 3 states
  const [duration, setDuration] = useState(60);
  const [mode, setMode] = useState<'practice' | 'official'>('official');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [allowBacktrack, setAllowBacktrack] = useState(true);
  const [showImmediateResults, _setShowImmediateResults] = useState(false);
  const [browserLockdown, setBrowserLockdown] = useState(true);
  const { questions: questionBank, classGroups, status, upsertExam } = useTeacherCollections();
  const questionsLoading = status.questions === 'loading';

  // Selection never references out-of-bank ids: the checkboxes render from
  // the bank itself, so the old post-fetch prune is inherently unnecessary.

  const filteredQuestionBank = useMemo(() => {
    return questionBank.filter((q) => {
      const gradeOk = !grade || q.grade === grade || String(q.grade).includes(String(grade));
      const subjectOk =
        !subject ||
        q.category === subject ||
        String(q.category || '').includes(subject) ||
        subject.includes(String(q.category || ''));
      return gradeOk || subjectOk;
    });
  }, [questionBank, grade, subject]);

  const selectedQuestions = useMemo(() => {
    return questionBank.filter((q) => selectedQuestionIds.includes(q.id));
  }, [questionBank, selectedQuestionIds]);

  const totalPoints = selectedQuestions.reduce((sum, q) => sum + q.points, 0);

  const handleClassToggle = (classId: string) => {
    if (selectedClasses.includes(classId)) {
      setSelectedClasses(selectedClasses.filter((id) => id !== classId));
    } else {
      setSelectedClasses([...selectedClasses, classId]);
    }
  };

  const handleQuestionToggle = (qId: string) => {
    if (selectedQuestionIds.includes(qId)) {
      setSelectedQuestionIds(selectedQuestionIds.filter((id) => id !== qId));
    } else {
      setSelectedQuestionIds([...selectedQuestionIds, qId]);
    }
  };

  const [_publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    if (!title) {
      showToast('لطفاً عنوان آزمون را وارد نمایید.', 'warning');
      setStep(1);
      return;
    }

    if (selectedQuestionIds.length === 0) {
      showToast('لطفاً حداقل یک سوال برای آزمون خود برگزینید.', 'warning');
      setStep(2);
      return;
    }

    setPublishing(true);
    try {
      const payload: Omit<Exam, 'id' | 'createdAt' | 'examCode'> = {
        title,
        description,
        grade,
        subject,
        duration,
        status: 'scheduled',
        teacherId: 't-1',
        classGroupIds: selectedClasses,
        settings: {
          mode,
          durationMinutes: duration,
          shuffleQuestions,
          shuffleOptions,
          allowBacktrack,
          showImmediateResults,
          maxAttempts: mode === 'official' ? 1 : 3,
          browserLockdown,
        },
        sections: [
          {
            id: 'sec-1',
            title: 'بخش سوالات طرحی نهایی',
            questionIds: selectedQuestionIds,
          },
        ],
        questions: selectedQuestions,
      };

      const createdExam = await examService.createExam(payload);
      // No list refetch exists anymore — patch the shared cache so the new
      // exam is on the Exams page the moment the wizard closes.
      upsertExam(createdExam);

      if (onAddExam) {
        onAddExam(createdExam);
      } else {
        showToast('آزمون جدید با موفقیت ایجاد شد.', 'success');
        onBack();
      }
    } catch (err: unknown) {
      showToast(`خطا در ایجاد آزمون: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="lens rounded-3xl overflow-hidden" id="new-exam-wizard-wrapper">
      {/* Header and Back Button */}
      <div className="px-6 py-5 pane border-b border-[var(--color-glass-light-stroke)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="btn-back-to-exams-from-wizard"
            aria-label="بازگشت به آزمون‌ها"
            onClick={onBack}
            className="p-1.5 btn-glass btn-glass--quiet rounded-lg text-[var(--color-text-tertiary)] cursor-pointer"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-label font-black text-[var(--color-text-primary)]">
              طراح هوشمند و گام‌به‌گام آزمون
            </h3>
            <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
              تخصیص سوالات به همراه بارگذاری همزمان پارامترهای تدارکاتی
            </p>
          </div>
        </div>

        {/* Floating Steps indicators */}
        <div
          className="flex items-center space-x-2 space-x-reverse text-caption font-bold"
          id="stepper-bubble-container"
        >
          {[1, 2, 3, 4].map((sNum) => (
            <div
              key={sNum}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                step >= sNum
                  ? 'bg-[var(--color-accent-solid)] text-[var(--color-text-on-solid)] font-black scale-105'
                  : 'glx-inset text-[var(--color-text-tertiary)] border border-[var(--color-glass-light-stroke)]'
              }`}
            >
              {sNum}
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: General Info */}
      {step === 1 && (
        <div className="p-6 md:p-8 space-y-6 text-right">
          <div className="border-b border-[var(--color-glass-light-stroke)] pb-3">
            <h4 className="text-caption font-black text-[var(--color-text-primary)]">
              گام اول: مشخصات و مقطع تحصیلی آزمون
            </h4>
            <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
              عنوان آزمون و مرجع درسی را برای ثبت در نظام نمرات دانش‌آموزی تنظیم نمایید.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <Input
              label="عنوان اصلی آزمون:"
              id="exam-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: آزمون نوبت دوم ریاضی اول متوسطه"
              className="font-medium"
            />

            {/* Subject */}
            <Input
              label="موضوع درس سنجش:"
              id="exam-subject-input"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="مثال: علوم تجربی"
              className="font-medium"
            />
          </div>

          {/* Details Descriptions */}
          <Textarea
            label="توضیحات راهنما یا مرجع مطالعه برای دانش‌آموز:"
            id="exam-desc-input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="نکات ورود به آزمون را در این بخش مکتوب نمایید..."
            className="font-medium"
          />

          {/* Grade and Class selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label
                htmlFor="exam-grade-select"
                className="text-caption font-bold text-[var(--color-text-secondary)] block"
              >
                پایه آموزشی مرجع:
              </label>
              <Dropdown
                id="exam-grade-select"
                value={grade}
                onChange={(v) => setGrade(v)}
                options={[
                  { value: '', label: 'انتخاب پایه...' },
                  { value: 'اول', label: 'پایه اول', group: 'دبستان' },
                  { value: 'دوم', label: 'پایه دوم', group: 'دبستان' },
                  { value: 'سوم', label: 'پایه سوم', group: 'دبستان' },
                  { value: 'چهارم', label: 'پایه چهارم', group: 'دبستان' },
                  { value: 'پنجم', label: 'پایه پنجم', group: 'دبستان' },
                  { value: 'ششم', label: 'پایه ششم', group: 'دبستان' },
                  { value: 'هفتم', label: 'پایه هفتم', group: 'دوره اول متوسطه' },
                  { value: 'هشتم', label: 'پایه هشتم', group: 'دوره اول متوسطه' },
                  { value: 'نهم', label: 'پایه نهم', group: 'دوره اول متوسطه' },
                  { value: 'دهم', label: 'پایه دهم', group: 'دوره دوم متوسطه' },
                  { value: 'یازدهم', label: 'پایه یازدهم', group: 'دوره دوم متوسطه' },
                  { value: 'دوازدهم', label: 'پایه دوازدهم', group: 'دوره دوم متوسطه' },
                ]}
              />
            </div>

            <div className="space-y-2">
              <span className="text-caption font-bold text-[var(--color-text-secondary)] block">
                تخصیص کلاس‌های دبیرستان (امکان بیش از یک تشکیلات):
              </span>
              <div className="flex flex-wrap gap-2.5">
                {classGroups.map((cg) => (
                  <button
                    key={cg.id}
                    type="button"
                    onClick={() => handleClassToggle(cg.id)}
                    className={`px-3 py-1.5 rounded-xl border text-caption font-bold transition-all cursor-pointer ${
                      selectedClasses.includes(cg.id)
                        ? 'btn-glass btn-glass--accent'
                        : 'btn-glass btn-glass--bare'
                    }`}
                  >
                    {cg.name} ({cg.grade})
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Questions Selection */}
      {step === 2 && (
        <div className="p-6 md:p-8 space-y-6 text-right">
          <div className="border-b border-[var(--color-glass-light-stroke)] pb-3 flex justify-between items-center">
            <div>
              <h4 className="text-caption font-black text-[var(--color-text-primary)]">
                گام دوم: گزینش سوالات تالیفی یا بانک ملی
              </h4>
              <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
                تک‌تک گزینه‌ها را علامت بزنید تا در برگه جایگیری شوند.
              </p>
            </div>

            <span className="text-caption bg-[var(--color-accent-soft)] text-[var(--color-accent)] px-3 py-1.5 rounded-xl font-bold">
              مجموع ارزش تجمعی: {totalPoints} بارم
            </span>
          </div>

          {/* Quick select database */}
          <div className="space-y-3">
            {questionsLoading && (
              <div className="p-6 rounded-2xl border-[var(--color-glass-light-stroke)] pane text-center text-caption font-bold text-[var(--color-text-tertiary)]">
                در حال دریافت سوالات از بانک سوالات...
              </div>
            )}

            {!questionsLoading && filteredQuestionBank.length === 0 && (
              <div className="p-6 rounded-2xl border border-[var(--color-warning)]/20 bg-[var(--color-warning-soft)] text-center text-caption font-bold text-[var(--color-warning)]">
                سوالی برای پایه یا درس انتخاب‌شده پیدا نشد. ابتدا در بانک سوالات، سوال واقعی ثبت
                کنید.
              </div>
            )}

            {!questionsLoading &&
              filteredQuestionBank.map((q) => {
                const checked = selectedQuestionIds.includes(q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => handleQuestionToggle(q.id)}
                    className={`p-4 rounded-xl border text-right transition-all cursor-pointer flex gap-4 items-center ${
                      checked ? 'btn-glass btn-glass--accent' : 'btn-glass btn-glass--bare'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}} // handled by parent div click
                      className="w-4 h-4 text-[var(--color-accent)] rounded-lg cursor-pointer"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-center text-micro text-[var(--color-text-tertiary)]">
                        <span className="glx-inset text-[var(--color-text-secondary)] px-2 py-0.5 rounded-md font-semibold">
                          {q.category}
                        </span>
                        <span className="font-bold text-[var(--color-text-secondary)]">
                          {q.points} امتیاز
                        </span>
                      </div>
                      <h5 className="text-caption font-black text-[var(--color-text-primary)]">
                        {q.title}
                      </h5>
                      <p className="text-micro text-[var(--color-text-tertiary)] leading-normal line-clamp-1">
                        {q.text}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* STEP 3: Specialized settings */}
      {step === 3 && (
        <div className="p-6 md:p-8 space-y-6 text-right">
          <div className="border-b border-[var(--color-glass-light-stroke)] pb-3">
            <h4 className="text-caption font-black text-[var(--color-text-primary)]">
              گام سوم: محدوده‌گذاری زمانی و ابزار ضد تقلب
            </h4>
            <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
              سیستم‌ها و قوانین تصحیح و backtracking را فعال نمایید.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hours */}
            <Input
              label={
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                  <span>مدت زمان آزمون (دقیقه):</span>
                </span>
              }
              id="new-ex-dur"
              type="number"
              min={10}
              max={150}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="font-bold"
            />

            {/* Mode Practice */}
            <div className="space-y-1.5">
              <span className="text-caption font-bold text-[var(--color-text-secondary)] block">
                حالت ارزشیابی:
              </span>
              <div className="grid grid-cols-2 gap-2 text-caption font-bold">
                <button
                  type="button"
                  onClick={() => setMode('official')}
                  className={`p-2 rounded-xl border text-center cursor-pointer ${mode === 'official' ? 'btn-glass btn-glass--accent' : 'btn-glass btn-glass--bare'}`}
                >
                  رسمی (نهایی)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('practice')}
                  className={`p-2 rounded-xl border text-center cursor-pointer ${mode === 'practice' ? 'btn-glass btn-glass--accent' : 'btn-glass btn-glass--bare'}`}
                >
                  تمرینی (مستمر)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 pane rounded-xl border-[var(--color-glass-light-stroke)]">
              <Toggle
                checked={shuffleQuestions}
                onChange={setShuffleQuestions}
                label="ترتیب سوال تصادفی برای دانش‌آموزان"
              />
            </div>

            <div className="flex items-center gap-3 p-3 pane rounded-xl border-[var(--color-glass-light-stroke)]">
              <Toggle
                checked={shuffleOptions}
                onChange={setShuffleOptions}
                label="ترتیب گزینه‌های تستی تصادفی"
              />
            </div>

            <div className="flex items-center gap-3 p-3 pane rounded-xl border-[var(--color-glass-light-stroke)]">
              <Toggle
                checked={allowBacktrack}
                onChange={setAllowBacktrack}
                label="اجازه تصحیح مجدد سوال رد شده"
              />
            </div>

            <div className="flex items-center gap-3 p-3 bg-[var(--color-danger-soft)]/40/30 rounded-xl border border-[var(--color-danger)]/10">
              <Toggle
                checked={browserLockdown}
                onChange={setBrowserLockdown}
                label="فعال‌سازی قفل مرورگر ضدهک و تقلب"
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Review publish info */}
      {step === 4 && (
        <div className="p-6 md:p-8 space-y-6 text-right">
          <div className="border-b border-[var(--color-glass-light-stroke)] pb-3 flex items-center justify-between">
            <div>
              <h4 className="text-caption font-black text-[var(--color-text-primary)]">
                گام پایانی: مرور کلی ساختار آزمون
              </h4>
              <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
                تنظیمات را بررسی کنید و سپس کدهای ورود را منتشر کنید.
              </p>
            </div>
            <span className="px-3 py-1 bg-[var(--color-success-soft)] text-[var(--color-success)] text-micro font-bold rounded-full">
              آماده برای انتشار نهایی
            </span>
          </div>

          <div className="p-5 rounded-2xl border-[var(--color-glass-light-stroke)] pane space-y-4 max-w-2xl text-caption text-[var(--color-text-secondary)] leading-relaxed">
            <div>
              <span className="text-[var(--color-text-tertiary)] block mb-1">عنوان آزمون:</span>
              <p className="font-bold text-[var(--color-text-primary)] text-label">
                {title || 'امتحان معرفی نشده'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[var(--color-text-tertiary)] block mb-1">
                  موضوع درس و پایه:
                </span>
                <p className="font-bold text-[var(--color-text-primary)]">
                  {subject} | پایه {grade}
                </p>
              </div>
              <div>
                <span className="text-[var(--color-text-tertiary)] block mb-1">کلاس‌ها:</span>
                <p className="font-bold text-[var(--color-text-primary)]">
                  {selectedClasses
                    .map((id) => classGroups.find((c) => c.id === id)?.name || id)
                    .join(' و ')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[var(--color-text-tertiary)] block mb-1">
                  کل تعداد سوالات انتخابی:
                </span>
                <p className="font-bold text-[var(--color-text-primary)]">
                  {selectedQuestionIds.length} سوال
                </p>
              </div>
              <div>
                <span className="text-[var(--color-text-tertiary)] block mb-1">
                  بارم به ازای کل آزمون:
                </span>
                <p className="font-bold text-[var(--color-accent)] text-label">
                  {totalPoints} نمره
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[var(--color-text-tertiary)] block mb-1">
                  مدت زمان آزمون:
                </span>
                <p className="font-bold text-[var(--color-text-primary)]">{duration} دقیقه</p>
              </div>
              <div>
                <span className="text-[var(--color-text-tertiary)] block mb-1">سیستم امنیتی:</span>
                <p className="font-bold text-[var(--color-danger)]">
                  {browserLockdown ? 'قفل سخت مرورگر (فعال)' : 'غیر فعال'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER NAV CONTROLS */}
      <div className="p-5 border-t border-[var(--color-glass-light-stroke)] pane flex justify-between items-center">
        <div>
          {step > 1 && (
            <button
              type="button"
              id="wizard-btn-prev"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 btn-glass btn-glass--quiet text-[var(--color-text-secondary)] rounded-xl text-caption font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>مرحله قبلی</span>
            </button>
          )}
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 btn-glass btn-glass--quiet text-[var(--color-text-tertiary)] rounded-xl text-caption font-semibold cursor-pointer"
          >
            انصراف و خروج
          </button>

          {step < 4 ? (
            <PillButton
              fill="accent-solid"
              size="none"
              radius="xl"
              text="caption"
              id="wizard-btn-next"
              onClick={() => {
                if (step === 1 && !title) {
                  showToast('لطفاً عنوان آزمون را برای پیشروی وارد نمایید.', 'warning');
                  return;
                }
                if (step === 2 && selectedQuestionIds.length === 0) {
                  showToast('لطفاً حداقل یک سوال برگزینید.', 'warning');
                  return;
                }
                setStep(step + 1);
              }}
              className="px-5 py-2 hover:bg-[var(--color-accent-solid-hover)] shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>مرحله بعدی</span>
              <ArrowLeft className="w-4 h-4" />
            </PillButton>
          ) : (
            <button
              type="button"
              id="wizard-btn-publish"
              onClick={handlePublish}
              className="px-5 py-2 btn-glass btn-glass--success rounded-xl text-caption font-black flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4.5 h-4.5" />
              <span>ثبت، زمان‌بندی و انتشار آزمون عمومی</span>
            </button>
          )}
        </div>
      </div>
      {toastElement}
    </div>
  );
}
