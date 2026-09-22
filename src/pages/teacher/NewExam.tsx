/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { logger } from '../../lib/logger';
import { useToast } from '../../hooks/useToast';
import { Exam, Question, ClassGroup } from '../../types';
import { examService, questionService, classService } from '../../services/api';

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

  // Step 2 states (Question IDs from bank)
  const [questionBank, setQuestionBank] = useState<Question[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  // Step 3 states
  const [duration, setDuration] = useState(60);
  const [mode, setMode] = useState<'practice' | 'official'>('official');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [allowBacktrack, setAllowBacktrack] = useState(true);
  const [showImmediateResults, _setShowImmediateResults] = useState(false);
  const [browserLockdown, setBrowserLockdown] = useState(true);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  useEffect(() => {
    classService
      .getClassGroups()
      .then(setClassGroups)
      .catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    setQuestionsLoading(true);
    questionService
      .getQuestions()
      .then((questions) => {
        if (!active) return;
        setQuestionBank(questions);
        setSelectedQuestionIds((current) =>
          current.filter((id) => questions.some((q) => q.id === id)),
        );
      })
      .catch((err) => {
        logger.error('Failed to load question bank for exam builder:', err);
        if (active) setQuestionBank([]);
      })
      .finally(() => {
        if (active) setQuestionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
    <div
      className="glx rounded-2xl overflow-hidden animate-in fade-in duration-300"
      id="new-exam-wizard-wrapper"
    >
      {/* Header and Back Button */}
      <div className="px-6 py-5 glx border-b border-[var(--color-glass-light-stroke)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            id="btn-back-to-exams-from-wizard"
            onClick={onBack}
            className="p-1.5 hover:glx-inset rounded-lg text-[var(--color-text-tertiary)] cursor-pointer"
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
                  ? 'bg-[var(--color-accent)] text-white font-black scale-105'
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
        <div className="p-6 md:p-8 space-y-6 text-right animate-in fade-in slide-in-from-left-4 duration-250">
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
            <div className="space-y-1.5">
              <label
                htmlFor="exam-title-input"
                className="text-caption font-bold text-[var(--color-text-secondary)] block"
              >
                عنوان اصلی آزمون:
              </label>
              <input
                type="text"
                id="exam-title-input"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: آزمون نوبت دوم ریاضی اول متوسطه"
                className="w-full glx border text-caption font-medium pr-3.5 pl-4 py-2.5 rounded-xl focus:outline-hidden focus:border-[var(--color-accent)]/40"
              />
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label
                htmlFor="exam-subject-input"
                className="text-caption font-bold text-[var(--color-text-secondary)] block text-right font-sans"
              >
                موضوع درس سنجش:
              </label>
              <input
                type="text"
                id="exam-subject-input"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: علوم تجربی"
                className="w-full glx border text-caption font-medium pr-3.5 pl-4 py-2.5 rounded-xl focus:outline-hidden focus:border-[var(--color-accent)]/40"
              />
            </div>
          </div>

          {/* Details Descriptions */}
          <div className="space-y-1.5">
            <label
              htmlFor="exam-desc-input"
              className="text-caption font-bold text-[var(--color-text-secondary)] block"
            >
              توضیحات راهنما یا مرجع مطالعه برای دانش‌آموز:
            </label>
            <textarea
              id="exam-desc-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="نکات ورود به آزمون را در این بخش مکتوب نمایید..."
              className="w-full glx border text-caption font-medium pr-3.5 pl-4 py-2.5 rounded-xl focus:outline-hidden focus:border-[var(--color-accent)]/40"
            />
          </div>

          {/* Grade and Class selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label
                htmlFor="exam-grade-select"
                className="text-caption font-bold text-[var(--color-text-secondary)] block"
              >
                پایه آموزشی مرجع:
              </label>
              <select
                id="exam-grade-select"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full glx border text-caption text-[var(--color-text-secondary)] px-3.5 py-2 rounded-xl focus:outline-hidden focus:border-[var(--color-accent)]/40"
              >
                <option value="">انتخاب پایه...</option>
                <optgroup label="دبستان">
                  <option value="اول">پایه اول</option>
                  <option value="دوم">پایه دوم</option>
                  <option value="سوم">پایه سوم</option>
                  <option value="چهارم">پایه چهارم</option>
                  <option value="پنجم">پایه پنجم</option>
                  <option value="ششم">پایه ششم</option>
                </optgroup>
                <optgroup label="دوره اول متوسطه">
                  <option value="هفتم">پایه هفتم</option>
                  <option value="هشتم">پایه هشتم</option>
                  <option value="نهم">پایه نهم</option>
                </optgroup>
                <optgroup label="دوره دوم متوسطه">
                  <option value="دهم">پایه دهم</option>
                  <option value="یازدهم">پایه یازدهم</option>
                  <option value="دوازدهم">پایه دوازدهم</option>
                </optgroup>
              </select>
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
                        ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)]/20 text-[var(--color-accent)]'
                        : 'glx border-[var(--color-glass-light-stroke)] text-[var(--color-text-tertiary)]'
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
        <div className="p-6 md:p-8 space-y-6 text-right animate-in fade-in slide-in-from-left-4 duration-250">
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
              <div className="p-6 rounded-2xl border border-[var(--color-glass-light-stroke)] glx text-center text-caption font-bold text-[var(--color-text-tertiary)]">
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
                      checked
                        ? 'bg-[var(--color-accent-soft)]/40 border-[var(--color-accent)]/20'
                        : 'glx border border-[var(--color-glass-light-stroke)] hover:border-[var(--color-glass-light-stroke)]'
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
        <div className="p-6 md:p-8 space-y-6 text-right animate-in fade-in slide-in-from-left-4 duration-250">
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
            <div className="space-y-1.5">
              <label
                htmlFor="new-ex-dur"
                className="text-caption font-bold text-[var(--color-text-secondary)] block flex items-center gap-1.5"
              >
                <Clock className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                <span>مدت زمان آزمون (دقیقه):</span>
              </label>
              <input
                type="number"
                id="new-ex-dur"
                min={10}
                max={150}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full glx border text-caption font-bold p-2 rounded-xl focus:outline-hidden"
              />
            </div>

            {/* Mode Practice */}
            <div className="space-y-1.5">
              <span className="text-caption font-bold text-[var(--color-text-secondary)] block">
                حالت ارزشیابی:
              </span>
              <div className="grid grid-cols-2 gap-2 text-caption font-bold">
                <button
                  type="button"
                  onClick={() => setMode('official')}
                  className={`p-2 rounded-xl border text-center cursor-pointer ${mode === 'official' ? 'border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)]/30 text-[var(--color-accent)]' : 'glx text-[var(--color-text-secondary)]'}`}
                >
                  رسمی (نهایی)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('practice')}
                  className={`p-2 rounded-xl border text-center cursor-pointer ${mode === 'practice' ? 'border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)]/30 text-[var(--color-accent)]' : 'glx text-[var(--color-text-secondary)]'}`}
                >
                  تمرینی (مستمر)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 glx rounded-xl border border-[var(--color-glass-light-stroke)]">
              <input
                type="checkbox"
                id="sh-q"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="w-4 h-4 text-[var(--color-accent)] rounded-md cursor-pointer"
              />
              <label
                htmlFor="sh-q"
                className="text-caption font-bold text-[var(--color-text-secondary)] cursor-pointer"
              >
                ترتیب سوال تصادفی برای دانش‌آموزان
              </label>
            </div>

            <div className="flex items-center gap-3 p-3 glx rounded-xl border border-[var(--color-glass-light-stroke)]">
              <input
                type="checkbox"
                id="sh-opt"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="w-4 h-4 text-[var(--color-accent)] rounded-md cursor-pointer"
              />
              <label
                htmlFor="sh-opt"
                className="text-caption font-bold text-[var(--color-text-secondary)] cursor-pointer"
              >
                ترتیب گزینه‌های تستی تصادفی
              </label>
            </div>

            <div className="flex items-center gap-3 p-3 glx rounded-xl border border-[var(--color-glass-light-stroke)]">
              <input
                type="checkbox"
                id="btr"
                checked={allowBacktrack}
                onChange={(e) => setAllowBacktrack(e.target.checked)}
                className="w-4 h-4 text-[var(--color-accent)] rounded-md cursor-pointer"
              />
              <label
                htmlFor="btr"
                className="text-caption font-bold text-[var(--color-text-secondary)] cursor-pointer"
              >
                اجازه تصحیح مجدد سوال رد شده
              </label>
            </div>

            <div className="flex items-center gap-3 p-3 bg-[var(--color-danger-soft)]/40/30 rounded-xl border border-[var(--color-danger)]/10">
              <input
                type="checkbox"
                id="locks"
                checked={browserLockdown}
                onChange={(e) => setBrowserLockdown(e.target.checked)}
                className="w-4 h-4 text-[var(--color-danger)] rounded-md cursor-pointer"
              />
              <label
                htmlFor="locks"
                className="text-caption font-bold text-[var(--color-danger)] cursor-pointer"
              >
                فعال‌سازی قفل مرورگر ضدهک و تقلب
              </label>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Review publish info */}
      {step === 4 && (
        <div className="p-6 md:p-8 space-y-6 text-right animate-in fade-in slide-in-from-left-4 duration-250">
          <div className="border-b border-[var(--color-glass-light-stroke)] pb-3 flex items-center justify-between">
            <div>
              <h4 className="text-caption font-black text-[var(--color-text-primary)]">
                گام پایانی: مرور کلی ساختار آزمون
              </h4>
              <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
                کلیه پارامترها را بازرسی کنید تا کدهای ورود توزیع گردند.
              </p>
            </div>
            <span className="px-3 py-1 bg-[var(--color-success-soft)] text-[var(--color-success)] text-micro font-bold rounded-full">
              آماده برای انتشار نهایی
            </span>
          </div>

          <div className="p-5 rounded-2xl border border-[var(--color-glass-light-stroke)] glx space-y-4 max-w-2xl text-caption text-[var(--color-text-secondary)] leading-relaxed">
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
      <div className="p-5 border-t border-[var(--color-glass-light-stroke)] glx flex justify-between items-center">
        <div>
          {step > 1 && (
            <button
              id="wizard-btn-prev"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 glx hover:brightness-105 text-[var(--color-text-secondary)] rounded-xl text-caption font-semibold border transition-all flex items-center gap-1.5 cursor-pointer"
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
            className="px-4 py-2 glx-inset hover:glx-inset text-[var(--color-text-tertiary)] rounded-xl text-caption font-semibold cursor-pointer"
          >
            انصراف و خروج
          </button>

          {step < 4 ? (
            <button
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
              className="px-5 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl text-caption font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>مرحله بعدی</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              id="wizard-btn-publish"
              onClick={handlePublish}
              className="px-5 py-2 bg-[var(--color-success)] hover:bg-[var(--color-success)]/90 text-white rounded-xl text-caption font-black shadow-xs flex items-center gap-2 cursor-pointer"
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
