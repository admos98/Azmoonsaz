/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowLeft, CheckCircle2, Award, Clock, FileText, Check, CheckSquare, Plus, Layers, ShieldAlert } from 'lucide-react';
import { mockClassGroups } from '../../mockData';
import { Exam, ExamSection, Question } from '../../types';
import { examService, questionService } from '../../services/api';

interface NewExamProps {
  onBack: () => void;
  onAddExam?: (newExam: Exam) => void;
}

export default function NewExam({ onBack, onAddExam }: NewExamProps) {
  const [step, setStep] = useState(1);

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
  const [showImmediateResults, setShowImmediateResults] = useState(false);
  const [browserLockdown, setBrowserLockdown] = useState(true);
  useEffect(() => {
    let active = true;
    setQuestionsLoading(true);
    questionService.getQuestions()
      .then((questions) => {
        if (!active) return;
        setQuestionBank(questions);
        setSelectedQuestionIds((current) => current.filter((id) => questions.some((q) => q.id === id)));
      })
      .catch((err) => {
        console.error('Failed to load question bank for exam builder:', err);
        if (active) setQuestionBank([]);
      })
      .finally(() => { if (active) setQuestionsLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredQuestionBank = useMemo(() => {
    return questionBank.filter((q) => {
      const gradeOk = !grade || q.grade === grade || String(q.grade).includes(String(grade));
      const subjectOk = !subject || q.category === subject || String(q.category || '').includes(subject) || subject.includes(String(q.category || ''));
      return gradeOk || subjectOk;
    });
  }, [questionBank, grade, subject]);

  const selectedQuestions = useMemo(() => {
    return questionBank.filter(q => selectedQuestionIds.includes(q.id));
  }, [questionBank, selectedQuestionIds]);

  const totalPoints = selectedQuestions.reduce((sum, q) => sum + q.points, 0);

  const handleClassToggle = (classId: string) => {
    if (selectedClasses.includes(classId)) {
      setSelectedClasses(selectedClasses.filter(id => id !== classId));
    } else {
      setSelectedClasses([...selectedClasses, classId]);
    }
  };

  const handleQuestionToggle = (qId: string) => {
    if (selectedQuestionIds.includes(qId)) {
      setSelectedQuestionIds(selectedQuestionIds.filter(id => id !== qId));
    } else {
      setSelectedQuestionIds([...selectedQuestionIds, qId]);
    }
  };

  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    if (!title) {
      alert('لطفاً عنوان آزمون را وارد نمایید.');
      setStep(1);
      return;
    }

    if (selectedQuestionIds.length === 0) {
      alert('لطفاً حداقل یک سوال برای آزمون خود برگزینید.');
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
        alert('آزمون جدید با موفقیت ایجاد و کدهای ورود به دانش‌آموزان تخصیص داده شد.');
        onBack();
      }
    } catch (err: any) {
      alert(`خطا در ایجاد آزمون: ${err?.message || err}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300" id="new-exam-wizard-wrapper">
      {/* Header and Back Button */}
      <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            id="btn-back-to-exams-from-wizard"
            onClick={onBack}
            className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-sm font-black text-slate-800">طراح هوشمند و گام‌به‌گام آزمون</h3>
            <p className="text-[10px] text-slate-400 mt-1">تخصیص سوالات به همراه بارگذاری همزمان پارامترهای تدارکاتی</p>
          </div>
        </div>

        {/* Floating Steps indicators */}
        <div className="flex items-center space-x-2 space-x-reverse text-xs font-bold" id="stepper-bubble-container">
          {[1, 2, 3, 4].map(sNum => (
            <div
              key={sNum}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                step >= sNum
                  ? 'bg-indigo-600 text-white font-black scale-105'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
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
          <div className="border-b border-slate-100 pb-3">
            <h4 className="text-xs font-black text-slate-800">گام اول: مشخصات و مقطع تحصیلی آزمون</h4>
            <p className="text-[10px] text-slate-400 mt-1">عنوان آزمون و مرجع درسی را برای ثبت در نظام نمرات دانش‌آموزی تنظیم نمایید.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div className="space-y-1.5">
              <label htmlFor="exam-title-input" className="text-xs font-bold text-slate-700 block">عنوان اصلی آزمون:</label>
              <input
                type="text"
                id="exam-title-input"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: آزمون نوبت دوم ریاضی اول متوسطه"
                className="w-full bg-slate-50 border border-slate-200 text-xs font-medium pr-3.5 pl-4 py-2.5 rounded-xl focus:outline-hidden focus:border-indigo-400"
              />
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label htmlFor="exam-subject-input" className="text-xs font-bold text-slate-700 block text-right font-sans">موضوع درس سنجش:</label>
              <input
                type="text"
                id="exam-subject-input"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: علوم تجربی"
                className="w-full bg-slate-50 border border-slate-200 text-xs font-medium pr-3.5 pl-4 py-2.5 rounded-xl focus:outline-hidden focus:border-indigo-400"
              />
            </div>
          </div>

          {/* Details Descriptions */}
          <div className="space-y-1.5">
            <label htmlFor="exam-desc-input" className="text-xs font-bold text-slate-700 block">توضیحات راهنما یا مرجع مطالعه برای دانش‌آموز:</label>
            <textarea
              id="exam-desc-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="نکات ورود به آزمون را در این بخش مکتوب نمایید..."
              className="w-full bg-slate-50 border border-slate-200 text-xs font-medium pr-3.5 pl-4 py-2.5 rounded-xl focus:outline-hidden focus:border-indigo-400"
            />
          </div>

          {/* Grade and Class selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="exam-grade-select" className="text-xs font-bold text-slate-700 block">پایه آموزشی مرجع:</label>
            <select
              id="exam-grade-select"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-700 px-3.5 py-2 rounded-xl focus:outline-hidden focus:border-indigo-400"
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
              <span className="text-xs font-bold text-slate-700 block">تخصیص کلاس‌های دبیرستان (امکان بیش از یک تشکیلات):</span>
              <div className="flex flex-wrap gap-2.5">
                {mockClassGroups.map(cg => (
                  <button
                    key={cg.id}
                    type="button"
                    onClick={() => handleClassToggle(cg.id)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      selectedClasses.includes(cg.id)
                        ? 'bg-indigo-50 border-indigo-250 text-indigo-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
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
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <div>
              <h4 className="text-xs font-black text-slate-800">گام دوم: گزینش سوالات تالیفی یا بانک ملی</h4>
              <p className="text-[10px] text-slate-400 mt-1">تک‌تک گزینه‌ها را علامت بزنید تا در برگه جایگیری شوند.</p>
            </div>

            <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl font-bold">
              مجموع ارزش تجمعی: {totalPoints} بارم
            </span>
          </div>

          {/* Quick select database */}
          <div className="space-y-3">
            {questionsLoading && (
              <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-500">در حال دریافت سوالات از بانک سوالات...</div>
            )}

            {!questionsLoading && filteredQuestionBank.length === 0 && (
              <div className="p-6 rounded-2xl border border-amber-200 bg-amber-50 text-center text-xs font-bold text-amber-700">
                سوالی برای پایه یا درس انتخاب‌شده پیدا نشد. ابتدا در بانک سوالات، سوال واقعی ثبت کنید.
              </div>
            )}

            {!questionsLoading && filteredQuestionBank.map((q) => {
              const checked = selectedQuestionIds.includes(q.id);
              return (
                <div
                  key={q.id}
                  onClick={() => handleQuestionToggle(q.id)}
                  className={`p-4 rounded-xl border text-right transition-all cursor-pointer flex gap-4 items-center ${
                    checked
                      ? 'bg-indigo-50/40 border-indigo-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {}} // handled by parent div click
                    className="w-4 h-4 text-indigo-600 rounded-lg cursor-pointer"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">{q.category}</span>
                      <span className="font-bold text-slate-600">{q.points} امتیاز</span>
                    </div>
                    <h5 className="text-xs font-black text-slate-800">{q.title}</h5>
                    <p className="text-[11px] text-slate-500 leading-normal line-clamp-1">{q.text}</p>
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
          <div className="border-b border-slate-100 pb-3">
            <h4 className="text-xs font-black text-slate-800">گام سوم: محدوده‌گذاری زمانی و ابزار ضد تقلب</h4>
            <p className="text-[10px] text-slate-400 mt-1">سیستم‌ها و قوانین تصحیح و backtracking را فعال نمایید.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hours */}
            <div className="space-y-1.5">
              <label htmlFor="new-ex-dur" className="text-xs font-bold text-slate-700 block flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>مدت زمان آزمون (دقیقه):</span>
              </label>
              <input
                type="number"
                id="new-ex-dur"
                min={10}
                max={150}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 text-xs font-bold p-2 rounded-xl focus:outline-hidden"
              />
            </div>

            {/* Mode Practice */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 block">حالت ارزشیابی:</span>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMode('official')}
                  className={`p-2 rounded-xl border text-center cursor-pointer ${mode === 'official' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'bg-slate-50 text-slate-600'}`}
                >
                  رسمی (نهایی)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('practice')}
                  className={`p-2 rounded-xl border text-center cursor-pointer ${mode === 'practice' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'bg-slate-50 text-slate-600'}`}
                >
                  تمرینی (مستمر)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-150">
              <input type="checkbox" id="sh-q" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded-md cursor-pointer" />
              <label htmlFor="sh-q" className="text-xs font-bold text-slate-700 cursor-pointer">ترتیب سوال تصادفی برای دانش‌آموزان</label>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-150">
              <input type="checkbox" id="sh-opt" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded-md cursor-pointer" />
              <label htmlFor="sh-opt" className="text-xs font-bold text-slate-700 cursor-pointer">ترتیب گزینه‌های تستی تصادفی</label>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-150">
              <input type="checkbox" id="btr" checked={allowBacktrack} onChange={(e) => setAllowBacktrack(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded-md cursor-pointer" />
              <label htmlFor="btr" className="text-xs font-bold text-slate-700 cursor-pointer">اجازه تصحیح مجدد سوال رد شده</label>
            </div>

            <div className="flex items-center gap-3 p-3 bg-rose-50/30 rounded-xl border border-rose-100">
              <input type="checkbox" id="locks" checked={browserLockdown} onChange={(e) => setBrowserLockdown(e.target.checked)} className="w-4 h-4 text-rose-550 rounded-md cursor-pointer" />
              <label htmlFor="locks" className="text-xs font-bold text-rose-900 cursor-pointer">فعال‌سازی قفل مرورگر ضدهک و تقلب</label>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Review publish info */}
      {step === 4 && (
        <div className="p-6 md:p-8 space-y-6 text-right animate-in fade-in slide-in-from-left-4 duration-250">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black text-slate-800">گام پایانی: مرور کلی ساختار آزمون</h4>
              <p className="text-[10px] text-slate-400 mt-1">کلیه پارامترها را بازرسی کنید تا کدهای ورود توزیع گردند.</p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
              آماده برای انتشار نهایی
            </span>
          </div>

          <div className="p-5 rounded-2xl border border-slate-150 bg-slate-50/40 space-y-4 max-w-2xl text-xs text-slate-700 leading-relaxed">
            <div>
              <span className="text-slate-400 block mb-1">عنوان آزمون:</span>
              <p className="font-bold text-slate-900 text-sm">{title || 'امتحان معرفی نشده'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 block mb-1">موضوع درس و پایه:</span>
                <p className="font-bold text-slate-800">{subject} | پایه {grade}</p>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">کلاس‌ها:</span>
                <p className="font-bold text-slate-800">
                  {selectedClasses.map(id => mockClassGroups.find(c => c.id === id)?.name || id).join(' و ')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 block mb-1">کل تعداد سوالات انتخابی:</span>
                <p className="font-bold text-slate-800">{selectedQuestionIds.length} سوال</p>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">بارم به ازای کل آزمون:</span>
                <p className="font-bold text-indigo-700 text-sm">{totalPoints} نمره</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 block mb-1">مدت زمان آزمون:</span>
                <p className="font-bold text-slate-800">{duration} دقیقه</p>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">سیستم امنیتی:</span>
                <p className="font-bold text-rose-600">{browserLockdown ? 'قفل سخت مرورگر (فعال)' : 'غیر فعال'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER NAV CONTROLS */}
      <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
        <div>
          {step > 1 && (
            <button
              id="wizard-btn-prev"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 bg-white hover:bg-slate-150 text-slate-700 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer"
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
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-xs font-semibold cursor-pointer"
          >
            انصراف و خروج
          </button>

          {step < 4 ? (
            <button
              id="wizard-btn-next"
              onClick={() => {
                if (step === 1 && !title) {
                  alert('لطفاً عنوان آزمون را برای پیشروی وارد نمایید.');
                  return;
                }
                if (step === 2 && selectedQuestionIds.length === 0) {
                  alert('لطفاً حداقل یک سوال برگزینید تا توازن ورقه صورت گیرد.');
                  return;
                }
                setStep(step + 1);
              }}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>مرحله بعدی</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              id="wizard-btn-publish"
              onClick={handlePublish}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4.5 h-4.5" />
              <span>ثبت، زمان‌بندی و انتشار آزمون عمومی</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
