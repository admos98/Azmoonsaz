/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Save, 
  Clock, 
  HelpCircle, 
  ShieldAlert, 
  BadgeHelp, 
  RefreshCw,
  Calendar,
  Users,
  Lock,
  Compass,
  Check,
  CheckSquare,
  Sparkles,
  Info,
  Copy,
  Link,
  CheckCircle,
  AlertTriangle,
  Play,
  FileText,
  UserCheck,
  Zap,
  Laptop,
  Eye
} from 'lucide-react';
import { Exam, ExamSettings as SettingsType, ClassGroup, Student } from '../../types';
import { classService, studentService } from '../../services/api';


interface ExamSettingsProps {
  exam: Exam;
  onSave: (updatedExam: Exam) => void;
  onBack: () => void;
}

export default function ExamSettings({ exam, onSave, onBack }: ExamSettingsProps) {
  // 1. Core Scheduling States
  const [startDate, setStartDate] = useState<string>(exam.settings.startDate || '2026-06-15');
  const [startHour, setStartHour] = useState<string>(exam.settings.startHour || '08:30');
  const [endDate, setEndDate] = useState<string>(exam.settings.endDate || '2026-06-15');
  const [endHour, setEndHour] = useState<string>(exam.settings.endHour || '10:30');
  const [durationMinutes, setDurationMinutes] = useState<number>(exam.settings.durationMinutes || exam.duration || 60);
  const [timezone] = useState<string>('IRDT - تهران (GMT+3:30)');

  // 2. Student Access States
  const [allowedClasses, setAllowedClasses] = useState<string[]>(exam.settings.allowedClasses || exam.classGroupIds || []);
  const [requireNationalId, setRequireNationalId] = useState<boolean>(exam.settings.requireNationalId ?? true);
  const [entryCode, setEntryCode] = useState<string>(exam.settings.entryCode || '');
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);

  useEffect(() => {
    classService.getClassGroups().then(setClassGroups).catch(() => {});
    studentService.getStudents().then(setAllStudents).catch(() => {});
  }, []);
  const [maxAttempts, setMaxAttempts] = useState<number>(exam.settings.maxAttempts || 1);
  const [limitToSpecificStudents, setLimitToSpecificStudents] = useState<boolean>(
    !!(exam.settings.allowedStudents && exam.settings.allowedStudents.length > 0)
  );
  const [allowedStudents, setAllowedStudents] = useState<string[]>(exam.settings.allowedStudents || []);
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');

  // 3. Exam Behavior Options
  const [autoSubmit, setAutoSubmit] = useState<boolean>(exam.settings.autoSubmit ?? true);
  const [allowBacktrack, setAllowBacktrack] = useState<boolean>(exam.settings.allowBacktrack ?? true);
  const [showOneQuestionPerPage, setShowOneQuestionPerPage] = useState<boolean>(exam.settings.showOneQuestionPerPage ?? false);
  const [autoSaveAnswers, setAutoSaveAnswers] = useState<boolean>(exam.settings.autoSaveAnswers ?? true);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(exam.settings.shuffleQuestions ?? false);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(exam.settings.shuffleOptions ?? false);
  const [beastMode, setBeastMode] = useState<boolean>(exam.settings.beastMode ?? false);

  // 4. Results Display Configuration
  // 'immediate_score' | 'immediate_score_answers' | 'after_approval' | 'none'
  const [resultsDisplayMode, setResultsDisplayMode] = useState<'immediate_score' | 'immediate_score_answers' | 'after_approval' | 'none'>(
    exam.settings.resultsDisplayMode || (exam.settings.showImmediateResults ? 'immediate_score_answers' : 'after_approval')
  );

  // 5. Start Guidelines Instruction Intro Text
  const [startInstructions, setStartInstructions] = useState<string>(
    exam.settings.startInstructions || 'دبیر گرامی یادداشت ابتدایی را جهت هدایت ذهن آماده کرده است:\n۱. لطفاً پیش از کلیک بر روی دکمه شروع آزمون، از پایداری ترافیک اینترنت خود اطمینان کامل حاصل کنید.\n۲. هرگونه سوییچ یا جابه‌جایی روی سایر نرم‌افزارهای دسکتاپ یا تب‌های مرورگر ثبت شده و تخلف محسوب می‌گردد.\n۳. زمان اجرای آزمون محدود است و پاسخ‌ها به صورت مستمر و پیوسته در ابر ذخیره می‌شوند.'
  );

  // 6. Syncing States On Component mount
  const [examStatus, setExamStatus] = useState<Exam['status']>(exam.status || 'draft');
  const [examLink, setExamLink] = useState<string>(exam.settings.examLink || '');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [showRecommendationsApplied, setShowRecommendationsApplied] = useState<boolean>(false);

  // Jalali/Shamsi Date Converter Helper
  const getPersianDateStr = (dateStr?: string): string => {
    if (!dateStr) return 'نامشخص';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return 'نامشخص';
    const gy = parseInt(parts[0]);
    const gm = parseInt(parts[1]);
    const gd = parseInt(parts[2]);
    if (isNaN(gy) || isNaN(gm) || isNaN(gd)) return 'نامشخص';
    
    // Gregorian to Jalali mapping algorithm
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
    let jy = -1595 + (33 * Math.floor(days / 12053));
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      jy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    const jm = (days < 186) ? (1 + Math.floor(days / 31)) : (7 + Math.floor((days - 186) / 30));
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    
    const months = [
      'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
    ];
    
    const daysOfWeek = [
      'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'
    ];
    
    try {
      const dateObj = new Date(gy, gm - 1, gd);
      const dayOfWeekStr = daysOfWeek[dateObj.getDay()];
      const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
      const toFarsiNum = (n: number) => String(n).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
      return `${dayOfWeekStr}، ${toFarsiNum(jd)} ${months[jm - 1]} ${toFarsiNum(jy)}`;
    } catch {
      return '';
    }
  };

  const toPersianDigits = (str: string | number | undefined): string => {
    if (str === undefined) return '';
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  // Class selection handler
  const handleToggleClass = (classId: string) => {
    if (allowedClasses.includes(classId)) {
      setAllowedClasses(allowedClasses.filter(id => id !== classId));
      // Remove students that are no longer in allowed classes
      const relatedStudents = allStudents.filter(s => s.classGroupId === classId).map(s => s.id);
      setAllowedStudents(allowedStudents.filter(sid => !relatedStudents.includes(sid)));
    } else {
      setAllowedClasses([...allowedClasses, classId]);
    }
  };

  // Student selection handler
  const handleToggleStudent = (studentId: string) => {
    if (allowedStudents.includes(studentId)) {
      setAllowedStudents(allowedStudents.filter(id => id !== studentId));
    } else {
      setAllowedStudents([...allowedStudents, studentId]);
    }
  };

  // Checkbox/Toggle toggler helpers
  const handleSelectAllStudentsForClass = (classId: string) => {
    const classStudents = allStudents.filter(s => s.classGroupId === classId).map(s => s.id);
    const allSelected = classStudents.every(sId => allowedStudents.includes(sId));
    
    if (allSelected) {
      setAllowedStudents(allowedStudents.filter(sId => !classStudents.includes(sId)));
    } else {
      const union = Array.from(new Set([...allowedStudents, ...classStudents]));
      setAllowedStudents(union);
    }
  };

  // Real-time student calculation list
  const activeClassStudents = allStudents.filter(s => allowedClasses.includes(s.classGroupId));
  const filteredStudents = activeClassStudents.filter(s => 
    s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) || 
    s.nationalId.includes(studentSearchQuery)
  );

  const totalCalculatedStudents = limitToSpecificStudents 
    ? allowedStudents.length 
    : allowedClasses.reduce((sum, cid) => {
        const found = classGroups.find(c => c.id === cid);
        return sum + (found ? found.studentCount : 0);
      }, 0);

  const questionsCount = exam.questions?.length || 0;
  const totalPoints = exam.questions?.reduce((sum, q) => sum + (q.points || 0), 0) || 0;

  // Real-time checker for descriptive items
  const longAnswersCount = exam.questions?.filter(q => q.type === 'long_answer').length || 0;
  const longAnswersMissingRubric = exam.questions?.filter(
    q => q.type === 'long_answer' && (!q.rubrics || q.rubrics.length === 0)
  ) || [];

  // Recommended template applier
  const handleApplyOfficialRecommendations = () => {
    setMaxAttempts(1);
    setResultsDisplayMode('after_approval');
    setAutoSubmit(true);
    setShowOneQuestionPerPage(true);
    setAllowBacktrack(false);
    setBeastMode(true);
    setRequireNationalId(true);
    
    setShowRecommendationsApplied(true);
    setTimeout(() => {
      setShowRecommendationsApplied(false);
    }, 4000);
  };

  // Real-time validations list to assist teacher before publish
  const getValidationErrors = () => {
    const errors: string[] = [];
    
    // Blocker 1: No questions in exam
    if (questionsCount === 0) {
      errors.push('ورقه آزمون فاقد سوال است. ابتدا سوالات آزمون را در بخش ویرایش برگه اضافه کنید.');
    }
    
    // Blocker 2: Start Date/hour missing
    if (!startDate || !startHour) {
      errors.push('تاریخ یا ساعت مشخص شروع مجاز آزمون تعیین نگردیده است.');
    }
    
    // Blocker 3: Duration missing or invalid
    if (!durationMinutes || durationMinutes <= 0) {
      errors.push('مدت زمان پاسخ‌دهی باید عددی بزرگتر از صفر (دقیقه) باشد.');
    }
    
    // Blocker 4: No classes or students selected
    if (allowedClasses.length === 0) {
      errors.push('دسترسی هیچ کلاس یا پایه درسی برای این آزمون فعال نگردیده است.');
    } else if (limitToSpecificStudents && allowedStudents.length === 0) {
      errors.push('محدودسازی به دانش‌آموزان فعال است، اما هیچ دانش‌آموزی علامت نخورده است.');
    }
    
    // Blocker 5: Descriptive questions missing rubric metrics
    if (longAnswersMissingRubric.length > 0) {
      longAnswersMissingRubric.forEach((q, idx) => {
        errors.push(`سوال تشریحی شماره ${toPersianDigits(idx + 1)} («${q.title || 'بدون عنوان'}») فاقد بارم معیارهای ارزیابی است.`);
      });
    }

    return errors;
  };

  const validationErrors = getValidationErrors();

  // Handle Form Submission Save
  const handleSaveSettings = () => {
    const settings: SettingsType = {
      mode: exam.settings.mode, // Preserve 'official' or 'practice'
      durationMinutes,
      startTime: `${startDate}T${startHour}:00`,
      endTime: `${endDate}T${endHour}:00`,
      shuffleQuestions,
      shuffleOptions,
      allowBacktrack,
      showImmediateResults: resultsDisplayMode === 'immediate_score' || resultsDisplayMode === 'immediate_score_answers',
      maxAttempts,
      browserLockdown: beastMode,
      
      // Extended fields mapped
      startDate,
      endDate,
      startHour,
      endHour,
      allowedClasses,
      allowedStudents: limitToSpecificStudents ? allowedStudents : [],
      requireNationalId,
      entryCode,
      autoSubmit,
      showOneQuestionPerPage,
      autoSaveAnswers,
      beastMode,
      resultsDisplayMode,
      startInstructions,
      examLink
    };

    onSave({
      ...exam,
      duration: durationMinutes,
      classGroupIds: allowedClasses,
      status: examStatus,
      settings
    });
  };

  // Handle Publishing Action with link generation
  const handlePublishExam = () => {
    if (validationErrors.length > 0) {
      alert('پیکربندی آزمون دارای برخی خطاهای اساسی است و قابل انتشار نیست. لطفاً ابتدا خطاهای موجود در پنل مرور چپ را اصلاح نمایید.');
      return;
    }

    // Generate random code for safe unique route mapping
    const randCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const gradeLetter = exam.grade === 'هفتم' ? '7' : exam.grade === 'هشتم' ? '8' : exam.grade === 'نهم' ? '9' : 'GEN';
    const generatedLink = `/exam/AZMOON-${gradeLetter}-${randCode}`;

    setExamLink(generatedLink);

    // Set correct status depending on current local time comparison (mocked to 2026-06-13)
    // For demo purposes, we activate it right away so they can view, or scheduler logic is respected
    const nowTimestamp = new Date('2026-06-13T18:36:44-07:00').getTime();
    const startTimestamp = new Date(`${startDate}T${startHour}:00`).getTime();
    
    let targetStatus: Exam['status'] = 'active';
    if (startTimestamp > nowTimestamp) {
      targetStatus = 'scheduled';
    }

    setExamStatus(targetStatus);

    // Trigger save automatically right after
    const settings: SettingsType = {
      mode: exam.settings.mode,
      durationMinutes,
      startTime: `${startDate}T${startHour}:00`,
      endTime: `${endDate}T${endHour}:00`,
      shuffleQuestions,
      shuffleOptions,
      allowBacktrack,
      showImmediateResults: resultsDisplayMode === 'immediate_score' || resultsDisplayMode === 'immediate_score_answers',
      maxAttempts,
      browserLockdown: beastMode,
      
      startDate,
      endDate,
      startHour,
      endHour,
      allowedClasses,
      allowedStudents: limitToSpecificStudents ? allowedStudents : [],
      requireNationalId,
      entryCode,
      autoSubmit,
      showOneQuestionPerPage,
      autoSaveAnswers,
      beastMode,
      resultsDisplayMode,
      startInstructions,
      examLink: generatedLink
    };

    onSave({
      ...exam,
      duration: durationMinutes,
      classGroupIds: allowedClasses,
      status: targetStatus,
      settings
    });
  };

  // Copy Link function
  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}${examLink}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    });
  };

  return (
    <div className="space-y-6 text-right animate-in fade-in duration-300" dir="rtl" id="exam-settings-subview">
      
      {/* 1. Header and navigation row */}
      <div className="bg-white px-6 py-5 rounded-3xl border border-[var(--color-glass-light-stroke)] shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            id="btn-back-to-exams-list-from-settings"
            onClick={onBack}
            className="p-2 hover:bg-white/4 rounded-xl text-[var(--color-text-tertiary)] cursor-pointer border border-[var(--color-glass-light-stroke)] transition-all font-semibold"
            title="بازگشت به فهرست آزمون‌ها"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm md:text-md font-extrabold text-[var(--color-text-primary)] flex items-center gap-2">
              <Compass className="w-5 h-5 text-indigo-600" />
              <span>تنظیمات و انتشار آزمون</span>
            </h2>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">پیکربندی زمان‌بندی، سطوح محدودیت دسترسی، کلیدها، رفتار تصادفی سیستم و صدور لینک ورودی</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto self-end md:self-center">
          <button
            id="btn-settings-save-shortcut"
            onClick={handleSaveSettings}
            className="flex-1 md:flex-none px-4.5 py-2 hover:bg-white/3 text-[var(--color-text-secondary)] bg-white border border-[var(--color-glass-light-stroke)] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره پیش‌نویس موقت</span>
          </button>
        </div>
      </div>

      {/* 2. Main Double-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Right Columns (2/3 width) - Content Inputs and Custom Options */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* A. Recommended Option Panel (One-click template helper) */}
          <div className="bg-gradient-to-r from-indigo-900 to-indigo-805 text-white p-5 rounded-3xl relative overflow-hidden shadow-xs">
            <div className="absolute top-0 left-0 translate-x-1/10 -translate-y-1/10 opacity-10">
              <Compass className="w-48 h-48" />
            </div>
            
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[var(--color-warning)]/70 animate-pulse shrink-0" />
                <h4 className="text-xs font-extrabold text-white">سامانه هوشمند پیکربندی رسمی (ویژه ارزشیابی نهایی)</h4>
              </div>
              <p className="text-[11px] text-indigo-150 leading-relaxed max-w-xl">
                آیا این آزمون به صورت رسمی از دانش‌آموزان گرفته می‌شود؟ برای بستن روزنه‌های تخلف و بالا بردن امنیت فنی به صورت خودکار، کلیک کنید تا تنظیمات حفاظتی استاندارد ما اعمال شود.
              </p>
              
              <div className="pt-2 flex flex-wrap gap-2 text-[9.5px] text-indigo-100">
                <span className="bg-white/3 px-2 py-0.5 rounded-md flex items-center gap-1">۱ تلاش مجاز</span>
                <span className="bg-white/3 px-2 py-0.5 rounded-md flex items-center gap-1">حفاظت Beast Mode</span>
                <span className="bg-white/3 px-2 py-0.5 rounded-md flex items-center gap-1">ارسال خودکار</span>
                <span className="bg-white/3 px-2 py-0.5 rounded-md flex items-center gap-1">عدم نمایش بلادرنگ کارنامه</span>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleApplyOfficialRecommendations}
                  className="px-4.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border border-amber-300"
                >
                  <Zap className="w-4 h-4" />
                  <span>اعمال خودکار تنظیمات پیشنهادی امنیت هوشمند</span>
                </button>
              </div>

              {showRecommendationsApplied && (
                <div className="p-3 bg-[var(--color-success)]/25 border border-emerald-400 text-emerald-200 rounded-xl text-[10.5px] font-bold animate-in slide-in-from-top-2 duration-300 flex items-center gap-2">
                  <CheckCircle className="w-4.5 h-4.5" />
                  <span>معیارهای امنیتی با موفقیت روی برگه آزمون سوار و ذخیره شدند!</span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 1: زمان‌بندی آزمون */}
          <div className="bg-white p-6 rounded-3xl border border-[var(--color-glass-light-stroke)] shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold text-[var(--color-text-primary)] flex items-center gap-2 pb-2.5 border-b border-[var(--color-glass-light-stroke)]">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <span>۱. زمان‌بندی دقیق برگزاری آزمون</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Start Date & Hour */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-[var(--color-text-secondary)] block">شروع دسترسی به آزمون:</label>
                <div className="grid grid-cols-5 gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="col-span-3 bg-white/3 border border-[var(--color-glass-light-stroke)] text-xs font-bold text-[var(--color-text-secondary)] p-2.5 rounded-xl focus:outline-hidden focus:border-[var(--color-accent)]/40 focus:bg-white"
                  />
                  <input
                    type="time"
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="col-span-2 bg-white/3 border border-[var(--color-glass-light-stroke)] text-xs font-bold text-[var(--color-text-secondary)] p-2.5 rounded-xl focus:outline-hidden focus:border-[var(--color-accent)]/40 focus:bg-white text-center"
                  />
                </div>
                {/* Real-time Shamsi displays */}
                {startDate && (
                  <div className="p-2 bg-[var(--color-success-soft)] rounded-lg text-[var(--color-success)] border border-[var(--color-success)]/10/50 text-[10px] font-semibold flex items-center gap-1 px-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] shrink-0" />
                    <span>تقویم شمسی معادل:</span>
                    <strong className="text-emerald-950">{getPersianDateStr(startDate)}</strong>
                  </div>
                )}
              </div>

              {/* End Date & Hour */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-[var(--color-text-secondary)] block">پایان مهلت شرکت در آزمون:</label>
                <div className="grid grid-cols-5 gap-2">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="col-span-3 bg-white/3 border border-[var(--color-glass-light-stroke)] text-xs font-bold text-[var(--color-text-secondary)] p-2.5 rounded-xl focus:outline-hidden focus:border-[var(--color-accent)]/40 focus:bg-white"
                  />
                  <input
                    type="time"
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="col-span-2 bg-white/3 border border-[var(--color-glass-light-stroke)] text-xs font-bold text-[var(--color-text-secondary)] p-2.5 rounded-xl focus:outline-hidden focus:border-[var(--color-accent)]/40 focus:bg-white text-center"
                  />
                </div>
                {endDate && (
                  <div className="p-2 bg-[var(--color-success-soft)] rounded-lg text-[var(--color-success)] border border-[var(--color-success)]/10/50 text-[10px] font-semibold flex items-center gap-1 px-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] shrink-0" />
                    <span>تقویم شمسی معادل:</span>
                    <strong className="text-emerald-950">{getPersianDateStr(endDate)}</strong>
                  </div>
                )}
              </div>

            </div>

            {/* Duration and Timezone in same row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[var(--color-glass-light-stroke)]">
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--color-text-secondary)] block flex items-center gap-1">
                  <Clock className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                  <span>مدت زمان مجاز آزمون پس از ورود (دقیقه):</span>
                </label>
                <input
                  type="number"
                  min={5}
                  max={240}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full bg-white/3 border border-[var(--color-glass-light-stroke)] text-xs font-bold text-slate-750 p-2.5 rounded-xl focus:outline-hidden focus:border-[var(--color-accent)]/40 focus:bg-white"
                />
                <span className="text-[9.5px] text-[var(--color-text-tertiary)] block leading-relaxed">هر دانش‌آموز پس از ورود دقیقاً این میزان فرصت دارد پیش از قفل شدن آزمون پاسخ‌ها را بفرستد.</span>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[var(--color-text-secondary)] block">منطقه زمانی هماهنگ سامانه:</span>
                <div className="bg-white/3 border border-[var(--color-glass-light-stroke)] p-2.5 rounded-xl text-xs font-bold text-[var(--color-text-secondary)] flex justify-between items-center px-4">
                  <span>نمایش منطقه زمانی:</span>
                  <span className="text-indigo-600 bg-white border border-[var(--color-glass-light-stroke)] px-3 py-0.5 rounded-lg text-[10.5px]">تهران (Tehran)</span>
                </div>
                <span className="text-[9.5px] text-[var(--color-text-tertiary)] block leading-relaxed">ساعت سرور بر حسب زمان رسمی ایران هماهنگ شده است.</span>
              </div>

            </div>
          </div>

          {/* SECTION 2: دسترسی دانش‌آموزان */}
          <div className="bg-white p-6 rounded-3xl border border-[var(--color-glass-light-stroke)] shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold text-[var(--color-text-primary)] flex items-center gap-2 pb-2.5 border-b border-[var(--color-glass-light-stroke)]">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>۲. سطوح دسترسی و حضور دانش‌آموزان</span>
            </h3>

            {/* Allowed classes groups */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-[var(--color-text-secondary)] block">کلاس‌های درسی مجاز جهت شرکت در آزمون:</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {classGroups.map(cls => {
                  const isChecked = allowedClasses.includes(cls.id);
                  return (
                    <div
                      key={cls.id}
                      onClick={() => handleToggleClass(cls.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked 
                          ? 'border-indigo-600 bg-[var(--color-accent-soft)]/40 text-indigo-900 font-bold' 
                          : 'border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:bg-white/3'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                          isChecked ? 'bg-[var(--color-accent)] border-indigo-600 text-white' : 'border-[var(--color-glass-light-stroke)] bg-white'
                        }`}>
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                        <span className="text-xs">{cls.name}</span>
                      </div>
                      <span className="bg-white/4/80 border border-[var(--color-glass-light-stroke)] text-[10px] text-[var(--color-text-tertiary)] px-2 py-0.5 rounded-md font-mono">
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
                    <span className="text-xs font-bold text-[var(--color-text-secondary)] block">انتخاب انتخابی دانش‌آموزان (فیلتر بر اساس نام):</span>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">به صورت پیش‌فرض تمام اعضای کلاس‌ها مجازند. در غیر این صورت دستی محدود نمایید.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLimitToSpecificStudents(!limitToSpecificStudents)}
                    className={`px-3 py-1 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer ${
                      limitToSpecificStudents 
                        ? 'bg-rose-50 text-[var(--color-danger)] border border-rose-200' 
                        : 'bg-white/4 text-[var(--color-text-secondary)] hover:bg-white/6'
                    }`}
                  >
                    {limitToSpecificStudents ? 'محدودسازی به افراد خاص: فعال ⚠️' : 'آزاد برای کل کلاس'}
                  </button>
                </div>

                {limitToSpecificStudents && (
                  <div className="space-y-3 p-4 bg-white/3 rounded-2xl border border-[var(--color-glass-light-stroke)] animate-in slide-in-from-top-1.5 duration-300">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="جستجوی دانش‌آموز با نام یا کدملی..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        className="flex-1 bg-white border border-[var(--color-glass-light-stroke)] px-3 py-2 rounded-xl text-xs"
                      />
                    </div>
                    
                    <div className="max-h-48 overflow-y-auto space-y-1 bg-white p-2 rounded-xl border border-[var(--color-glass-light-stroke)]">
                      {filteredStudents.length === 0 ? (
                        <p className="text-[10.5px] text-[var(--color-text-tertiary)] text-center py-4">دانش‌آموزی از کلاس‌های انتخاب شده یافت نشد.</p>
                      ) : (
                        filteredStudents.map(student => {
                          const isChecked = allowedStudents.includes(student.id);
                          const clsName = classGroups.find(c => c.id === student.classGroupId)?.name || '';
                          return (
                            <div
                              key={student.id}
                              onClick={() => handleToggleStudent(student.id)}
                              className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer hover:bg-white/3 transition-all ${
                                isChecked ? 'bg-[var(--color-accent-soft)]/30 font-bold text-indigo-850' : 'text-[var(--color-text-secondary)]'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center ${
                                  isChecked ? 'bg-[var(--color-accent)] border-indigo-600 text-white' : 'border-[var(--color-glass-light-stroke)] bg-white'
                                }`}>
                                  {isChecked && <Check className="w-2.5 h-2.5" />}
                                </div>
                                <span>{student.name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-tertiary)]">
                                <span>{clsName}</span>
                                <span className="bg-white/4 px-1.5 rounded font-mono text-[9px]">کدملی: {toPersianDigits(student.nationalId)}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    
                    {/* Select/deselect helper */}
                    <div className="flex justify-between items-center text-[10px] text-[var(--color-accent)] font-semibold px-1">
                      <span>کل افراد منتخب: {toPersianDigits(allowedStudents.length)} از {toPersianDigits(activeClassStudents.length)} نفر</span>
                      <div className="flex gap-3">
                        {allowedClasses.map(cid => {
                          const clsName = classGroups.find(c => c.id === cid)?.name || '';
                          return (
                            <button
                              key={cid}
                              type="button"
                              onClick={() => handleSelectAllStudentsForClass(cid)}
                              className="hover:underline cursor-pointer text-[9.5px]"
                            >
                              وارونه کردن دسترسی {clsName}
                            </button>
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
              
              <div className="flex items-start gap-3 p-3 bg-white/3/60 border border-[var(--color-glass-light-stroke)] rounded-2xl">
                <input
                  type="checkbox"
                  id="national-id-login-toggle"
                  checked={requireNationalId}
                  onChange={(e) => setRequireNationalId(e.target.checked)}
                  className="mt-1 w-4.5 h-4.5 text-indigo-600 rounded-md border-[var(--color-glass-light-stroke)] focus:ring-[var(--color-accent)] cursor-pointer"
                />
                <div className="space-y-0.5">
                  <label htmlFor="national-id-login-toggle" className="text-xs font-bold text-[var(--color-text-primary)] cursor-pointer">ورود با اعتبارسنجی کد ملی</label>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] leading-normal">تطابق هویت الزامی دانش‌آموز بر اساس شماره کد ملی او در سیستم به هنگام کلیک ورود.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="optional-entry-code-input" className="text-xs font-bold text-[var(--color-text-primary)] display block">کد ورود اختیاری (رمز آزمون):</label>
                <input
                  type="text"
                  id="optional-entry-code-input"
                  placeholder="مثال: MATH2026 (اختیاری)"
                  value={entryCode}
                  onChange={(e) => setEntryCode(e.target.value)}
                  className="w-full bg-white/3 border border-[var(--color-glass-light-stroke)] text-xs text-[var(--color-text-secondary)] p-2 rounded-xl focus:outline-hidden focus:border-[var(--color-accent)]/40 focus:bg-white font-semibold text-center"
                />
                <p className="text-[9px] text-slate-405 leading-normal">رمز مشترکی است که کل دانش‌آموزان قبل آغاز باید آن را در کیبورد خود کلید کنند.</p>
              </div>

            </div>

            {/* Max attempts */}
            <div className="pt-3 border-t border-[var(--color-glass-light-stroke)] flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-text-secondary)]">تعداد تلاش مجاز برای شرکت در کل آزمون:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                  className="w-20 bg-white/3 border border-[var(--color-glass-light-stroke)] text-xs font-bold text-[var(--color-text-secondary)] p-1.5 rounded-lg text-center"
                />
                <span className="text-xs text-[var(--color-text-tertiary)]">مرتبه آزمون مجدد</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: رفتار آزمون */}
          <div className="bg-white p-6 rounded-3xl border border-[var(--color-glass-light-stroke)] shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold text-[var(--color-text-primary)] flex items-center gap-2 pb-2.5 border-b border-[var(--color-glass-light-stroke)]">
              <Lock className="w-5 h-5 text-indigo-600" />
              <span>۳. نحوه رفتار و ابزار کنترلی آزمون</span>
            </h3>

            {/* Custom checkboxes behavior */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              <div className="flex items-start gap-3 p-3.5 bg-white/3/50 border border-[var(--color-glass-light-stroke)] rounded-2xl">
                <input
                  type="checkbox"
                  id="auto-submit-toggle"
                  checked={autoSubmit}
                  onChange={(e) => setAutoSubmit(e.target.checked)}
                  className="mt-1 w-4.5 h-4.5 text-indigo-600 rounded-md border-[var(--color-glass-light-stroke)] focus:ring-[var(--color-accent)] cursor-pointer"
                />
                <div className="space-y-0.5">
                  <label htmlFor="auto-submit-toggle" className="text-xs font-bold text-[var(--color-text-primary)] cursor-pointer">ارسال خودکار پس از پایان زمان</label>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] leading-normal">بسته شدن سیستم و ثبت نهایی امن برگه به محض صفر شدن ثانیه‌شمار.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-white/3/50 border border-[var(--color-glass-light-stroke)] rounded-2xl">
                <input
                  type="checkbox"
                  id="allow-backtrack-behavior"
                  checked={allowBacktrack}
                  onChange={(e) => setAllowBacktrack(e.target.checked)}
                  className="mt-1 w-4.5 h-4.5 text-indigo-600 rounded-md border-[var(--color-glass-light-stroke)] focus:ring-[var(--color-accent)] cursor-pointer"
                />
                <div className="space-y-0.5">
                  <label htmlFor="allow-backtrack-behavior" className="text-xs font-bold text-[var(--color-text-primary)] cursor-pointer">امکان بازگشت به سوالات قبلی</label>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] leading-normal">دانش‌آموز بتواند سوالات رد کرده را برگردد و مجدد جواب دهد.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-white/3/50 border border-[var(--color-glass-light-stroke)] rounded-2xl">
                <input
                  type="checkbox"
                  id="auto-save-answers-toggle"
                  checked={autoSaveAnswers}
                  onChange={(e) => setAutoSaveAnswers(e.target.checked)}
                  className="mt-1 w-4.5 h-4.5 text-indigo-600 rounded-md border-[var(--color-glass-light-stroke)] focus:ring-[var(--color-accent)] cursor-pointer"
                />
                <div className="space-y-0.5">
                  <label htmlFor="auto-save-answers-toggle" className="text-xs font-bold text-[var(--color-text-primary)] cursor-pointer">ذخیره خودکار پاسخ‌ها (Auto-saves)</label>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] leading-normal">پشتیبان‌گیری پیوسته بر ابر پس از زدن هر دکمه جهت جلوگیری از قطعی برق دسکتاپ.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-white/3/50 border border-[var(--color-glass-light-stroke)] rounded-2xl">
                <input
                  type="checkbox"
                  id="shuffle-questions-behavior"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="mt-1 w-4.5 h-4.5 text-indigo-600 rounded-md border-[var(--color-glass-light-stroke)] focus:ring-[var(--color-accent)] cursor-pointer"
                />
                <div className="space-y-0.5">
                  <label htmlFor="shuffle-questions-behavior" className="text-xs font-bold text-[var(--color-text-primary)] cursor-pointer">جابه‌جایی ترتیب سوالات (Shuffle)</label>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] leading-normal">تولید خودکار دفترچه‌های مجزا با ترتیب سوالات به هم‌ریخته برای کنترل تقلب.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-white/3/50 border border-[var(--color-glass-light-stroke)] rounded-2xl">
                <input
                  type="checkbox"
                  id="shuffle-options-behavior"
                  checked={shuffleOptions}
                  onChange={(e) => setShuffleOptions(e.target.checked)}
                  className="mt-1 w-4.5 h-4.5 text-indigo-600 rounded-md border-[var(--color-glass-light-stroke)] focus:ring-[var(--color-accent)] cursor-pointer"
                />
                <div className="space-y-0.5">
                  <label htmlFor="shuffle-options-behavior" className="text-xs font-bold text-[var(--color-text-primary)] cursor-pointer">جابه‌جایی ترتیب گزینه‌ها</label>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] leading-normal">جابه‌جایی الف-ب-ج-د به صورت تصادفی در سیستم روی مرورگر دانش‌آموزان به هنگام لود.</p>
                </div>
              </div>

            </div>

            {/* Question pagination layouts (1 question per page vs all in one page) */}
            <div className="pt-3.5 border-t border-[var(--color-glass-light-stroke)] space-y-2">
              <span className="text-xs font-bold text-[var(--color-text-secondary)] block text-right">نحوه نمایش صفحات سوالات آزمون:</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  onClick={() => setShowOneQuestionPerPage(true)}
                  className={`p-3.5 rounded-2xl border text-right cursor-pointer transition-all ${
                    showOneQuestionPerPage 
                      ? 'border-indigo-600 bg-[var(--color-accent-soft)]/40 font-bold text-indigo-900 shadow-3xs' 
                      : 'border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:bg-white/3'
                  }`}
                >
                  <span className="block text-xs font-extrabold flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-indigo-600" />
                    <span>نمایش یک سوال در هر صفحه</span>
                  </span>
                  <p className="text-[9.5px] text-[var(--color-text-tertiary)] mt-1">تضمین تمرکز بالا، مهار عکس گرفتن گروهی از کل اوراق از روی مانیتورها.</p>
                </div>

                <div
                  onClick={() => setShowOneQuestionPerPage(false)}
                  className={`p-3.5 rounded-2xl border text-right cursor-pointer transition-all ${
                    !showOneQuestionPerPage 
                      ? 'border-indigo-600 bg-[var(--color-accent-soft)]/40 font-bold text-indigo-900 shadow-3xs' 
                      : 'border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:bg-white/3'
                  }`}
                >
                  <span className="block text-xs font-extrabold flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>نمایش همه سوالات در یک صفحه</span>
                  </span>
                  <p className="text-[9.5px] text-[var(--color-text-tertiary)] mt-1">امکان مرور یکجای تمام آزمون در ارتفاع کوتاه اسکرول به صورت چاپی سنتی.</p>
                </div>
              </div>
            </div>

            {/* Beast Mode high security system */}
            <div className={`p-4.5 rounded-2xl border transition-all ${
              beastMode 
                ? 'bg-rose-50 border-rose-350 text-rose-955 shadow-sm' 
                : 'bg-white/3/50 border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)]'
            }`}>
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  id="beast-mode-toggle"
                  checked={beastMode}
                  onChange={(e) => setBeastMode(e.target.checked)}
                  className="mt-1.5 w-5 h-5 text-[var(--color-danger)] rounded-md border-rose-300 focus:ring-rose-500 cursor-pointer"
                />
                <div className="space-y-1.5 flex-1">
                  <label htmlFor="beast-mode-toggle" className="text-xs font-black text-[var(--color-text-primary)] flex items-center gap-2 cursor-pointer">
                    <ShieldAlert className={`w-5 h-5 ${beastMode ? 'text-rose-650 animate-bounce' : 'text-[var(--color-text-tertiary)]'}`} />
                    <span>فعال‌سازی وضعیت فراحفاظتی (Beast Mode 🔒)</span>
                  </label>
                  <p className="text-[10.5px] leading-relaxed text-[var(--color-text-tertiary)]">
                    ضد تقبل تمام عیار! با فعال‌سازی گارد فوق‌سخت، خروج از تب امتحان، جابه‌جایی مانیتور، زدن دکمه کلیک راست کپی/پیست و عکس‌برداری قفل خواهند شد و دفعات لغزش به کارنامه نهایی ضمیمه می‌گردند.
                  </p>
                  
                  {beastMode && (
                    <div className="pt-2 flex items-center gap-1.5 text-[9px] font-bold text-[var(--color-danger)]">
                      <Zap className="w-3.5 h-3.5 text-[var(--color-danger)] animate-pulse" />
                      <span>حفاظت فعال دسکتاپی روشن - سیستم ضد شبیه‌سازها به صف شدند</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* SECTION 4: نمایش نتیجه */}
          <div className="bg-white p-6 rounded-3xl border border-[var(--color-glass-light-stroke)] shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold text-[var(--color-text-primary)] flex items-center gap-2 pb-2.5 border-b border-[var(--color-glass-light-stroke)]">
              <Eye className="w-5 h-5 text-indigo-600" />
              <span>۴. الگوهای انتشار نتایج و کارنامه</span>
            </h3>

            <span className="text-xs font-bold text-[var(--color-text-secondary)] block">انتخاب نحوه نمایش نتیجه بلافاصله پس از فشردن دکمه پایان:</span>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              
              {/* Option 1: Immediate Score */}
              <div
                onClick={() => setResultsDisplayMode('immediate_score')}
                className={`p-3.5 rounded-2xl border text-right cursor-pointer transition-all ${
                  resultsDisplayMode === 'immediate_score' 
                    ? 'border-indigo-600 bg-[var(--color-accent-soft)]/40 text-indigo-900 font-bold' 
                    : 'border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:bg-white/3'
                }`}
              >
                <span className="text-xs font-bold block">۱. نمایش نمره بلافاصله بعد از ارسال</span>
                <p className="text-[9.5px] text-[var(--color-text-tertiary)] mt-1">دانش‌آموز نمره کسب شده تستی را سریعاً در یک کارنامه سردست می‌بیند.</p>
              </div>

              {/* Option 2: Immediate Score and Answers */}
              <div
                onClick={() => setResultsDisplayMode('immediate_score_answers')}
                className={`p-3.5 rounded-2xl border text-right cursor-pointer transition-all ${
                  resultsDisplayMode === 'immediate_score_answers' 
                    ? 'border-indigo-600 bg-[var(--color-accent-soft)]/40 text-indigo-950 font-bold' 
                    : 'border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:bg-white/3'
                }`}
              >
                <span className="text-xs font-bold block">۲. نمایش پاسخ‌های صحیح بعد از ارسال</span>
                <p className="text-[9.5px] text-[var(--color-text-tertiary)] mt-1">نشان دادن تک تک گزینه‌های اشتباه و بازخوردهای تشریحی بلافاصله.</p>
              </div>

              {/* Option 3: Only after manual teacher check */}
              <div
                onClick={() => setResultsDisplayMode('after_approval')}
                className={`p-3.5 rounded-2xl border text-right cursor-pointer transition-all ${
                  resultsDisplayMode === 'after_approval' 
                    ? 'border-indigo-600 bg-[var(--color-accent-soft)]/40 text-indigo-900 font-bold' 
                    : 'border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:bg-white/3'
                }`}
              >
                <span className="text-xs font-bold block">۳. نمایش نتیجه فقط پس از تایید معلم (پیشنهادی)</span>
                <p className="text-[9.5px] text-[var(--color-text-tertiary)] mt-1">تا قبل تایید و ثبت نمرات تشریحی توسط دبیر کارنامه صادر نمی‌شود.</p>
              </div>

              {/* Option 4: Secret Exam (Never Show) */}
              <div
                onClick={() => setResultsDisplayMode('none')}
                className={`p-3.5 rounded-2xl border text-right cursor-pointer transition-all ${
                  resultsDisplayMode === 'none' 
                    ? 'border-indigo-600 bg-[var(--color-accent-soft)]/40 text-indigo-900 font-bold' 
                    : 'border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:bg-white/3'
                }`}
              >
                <span className="text-xs font-bold block">۴. عدم نمایش نتیجه به دانش‌آموز</span>
                <p className="text-[9.5px] text-[var(--color-text-tertiary)] mt-1">مکانیزم محرمانه - نتایج آزمون فقط برای شخص معلم بایگانی خواهند شد.</p>
              </div>

            </div>

            {/* Manual Grading caution recommendation note */}
            {longAnswersCount > 0 && (
              <div className="bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/20 p-3.5 rounded-2xl text-[10.5px] text-amber-850 flex items-start gap-2.5">
                <Info className="w-4.5 h-4.5 text-[var(--color-warning)] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-extrabold block">توزیع بارم تشریحی شناسایی شد ({toPersianDigits(longAnswersCount)} سوال تشریحی):</span>
                  <p className="text-[10px] text-[var(--color-warning)] leading-relaxed">
                    این برگه دارای پاسخ تشریحی است. طبق الگوریتم‌های آزمون‌ساز، توصیه می‌گردد گزینه «نمایش نتیجه فقط پس از تایید معلم» حتماً فعال باشد تا دبیر بتواند با معیارهای روان‌سنجی نمرات نهایی را دستی ثبت کند.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5: دستورالعمل قبل از شروع */}
          <div className="bg-white p-6 rounded-3xl border border-[var(--color-glass-light-stroke)] shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold text-[var(--color-text-primary)] flex items-center gap-2 pb-2.5 border-b border-[var(--color-glass-light-stroke)]">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>۵. دستورالعمل نمایش قبل از شروع آزمون</span>
            </h3>

            <div className="space-y-2">
              <label htmlFor="intro-instructions" className="text-xs font-bold text-slate-705 block">متن راهنمای شروع آزمون برای دانش‌آموزان:</label>
              <textarea
                id="intro-instructions"
                rows={4}
                value={startInstructions}
                onChange={(e) => setStartInstructions(e.target.value)}
                placeholder="توضیحات و قوانین ورود به برگه را در اینجا بنویسید..."
                className="w-full bg-white/3 border border-[var(--color-glass-light-stroke)] text-xs text-slate-850 p-3.5 rounded-2xl focus:outline-hidden focus:border-[var(--color-accent)]/40 focus:bg-white leading-relaxed text-right"
              />
              <div className="flex justify-between items-center text-[10px] text-[var(--color-text-tertiary)]">
                <span>دستور فوق درست قبل شرکت دانش‌آموز بر مانیتور او هک خواهد شد.</span>
                <span>تعداد کل کاراکتر: {toPersianDigits(startInstructions.length)} حرف</span>
              </div>
            </div>
          </div>

        </div>

        {/* Left Column (1/3 width) - Final Review, Validation Alerts & Publishing Link Panel */}
        <div className="col-span-1 space-y-5">
          
          {/* SECTION 6: پنل مرور نهایی */}
          <div className="bg-white p-5 rounded-3xl border border-[var(--color-glass-light-stroke)] shadow-xs space-y-4">
            <h3 className="text-xs font-black text-[var(--color-text-primary)] pb-2.5 border-b border-[var(--color-glass-light-stroke)] flex items-center gap-1.5">
              <Compass className="w-5 h-5 text-indigo-600" />
              <span>مرور نهایی برگه</span>
            </h3>

            <div className="space-y-3.5 text-xs text-[var(--color-text-secondary)]">
              
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-text-tertiary)] text-[11px]">عنوان امتحان:</span>
                <span className="font-extrabold text-[var(--color-text-primary)] max-w-[120px] truncate" title={exam.title}>{exam.title}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[var(--color-text-tertiary)] text-[11px]">ارزیابی مستهدف:</span>
                <span className="font-bold text-[var(--color-text-secondary)]">{exam.subject} ({exam.grade})</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[var(--color-text-tertiary)] text-[11px]">پایه و نوع کلاس:</span>
                <span className="font-semibold bg-white/4 text-[var(--color-text-secondary)] px-2 py-0.5 rounded-md text-[10px] max-w-[130px] truncate" title={allowedClasses.map(cid => classGroups.find(c => c.id === cid)?.name).join(' و ')}>
                  {allowedClasses.length > 0 
                    ? allowedClasses.map(cid => classGroups.find(c => c.id === cid)?.name).join(' و ') 
                    : 'کلاسی تعیین نشده'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[var(--color-text-tertiary)] text-[11px]">تعداد کل شرکت‌کنندگان:</span>
                <span className="font-black text-[var(--color-accent)] font-mono text-[12px] bg-[var(--color-accent-soft)] px-2 py-0.5 rounded-md">
                  {toPersianDigits(totalCalculatedStudents)} دانش‌آموز
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[var(--color-text-tertiary)] text-[11px]">تعداد کل سوالات:</span>
                <span className="font-extrabold text-[var(--color-text-primary)] font-mono">{toPersianDigits(questionsCount)} سوال</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-[var(--color-glass-light-stroke)]">
                <span className="text-[var(--color-text-tertiary)] text-[11px]">مجموع بارم و نمرات:</span>
                <span className="font-extrabold text-[var(--color-warning)] bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/20 px-2 py-0.5 rounded-md font-mono">
                  {toPersianDigits(totalPoints)} نمره
                </span>
              </div>

              {/* Timing specifications */}
              <div className="space-y-2 pt-1 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-450">تاریخ و ساعت شروع:</span>
                  <span className="font-semibold text-[var(--color-text-primary)] font-mono text-[10px]">{toPersianDigits(startDate)} | {toPersianDigits(startHour)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-450">تاریخ و ساعت پایان:</span>
                  <span className="font-semibold text-[var(--color-text-primary)] font-mono text-[10px]">{toPersianDigits(endDate)} | {toPersianDigits(endHour)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-450">مدت انقضای پاسخ‌گو:</span>
                  <span className="font-bold text-slate-750 font-mono text-[10.5px]">{toPersianDigits(durationMinutes)} دقیقه</span>
                </div>
              </div>

              {/* Status parameters checkboxes */}
              <div className="space-y-2 pt-2 border-t border-[var(--color-glass-light-stroke)] text-[10.5px]">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-text-tertiary)]">وضعیت Beast Mode ضد تقلب:</span>
                  <span className={`font-bold ${beastMode ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-tertiary)]'}`}>
                    {beastMode ? '🔒 فعال فوق‌حفاظتی' : 'غیرفعال'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-text-tertiary)]">تصحیح خودکار تستی:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>فعال در کل سیستم</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-text-tertiary)]">نیاز به تصحیح دستی تشریحی:</span>
                  <span className={`font-bold ${longAnswersCount > 0 ? 'text-[var(--color-warning)]' : 'text-slate-450'}`}>
                    {longAnswersCount > 0 ? `بله، دارای ${toPersianDigits(longAnswersCount)} سوال تشریحی` : 'خیر، تماماً تستی'}
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 7: بررسی عیوب و اعتبارسنجی قبل انتشار */}
          <div className="bg-white p-5 rounded-3xl border border-[var(--color-glass-light-stroke)] shadow-xs space-y-3.5">
            <h4 className="text-xs font-extrabold text-[var(--color-text-primary)] flex items-center gap-1.5 pb-2 border-b border-[var(--color-glass-light-stroke)]">
              <ShieldAlert className="w-4.5 h-4.5 text-[var(--color-text-tertiary)]" />
              <span>پایش عیوب طراحی (اعتبارسنجی)</span>
            </h4>

            {validationErrors.length === 0 ? (
              <div className="p-3 bg-[var(--color-success-soft)] text-emerald-950 border border-emerald-250 rounded-2xl flex items-start gap-2 text-[10.5px] leading-relaxed">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="font-extrabold block">آمادگی صددرصدی لایو</strong>
                  <p className="text-[9.5px] text-emerald-600">هیچ خطای منطقی یا امنیتی در برگه پیدا نشد. می‌توانید با خیال راحت آزمون را لایو مندرج کنید.</p>
                </div>
              </div>
            ) : (
              <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4.5 space-y-2.5">
                <div className="flex items-center gap-2 text-[var(--color-danger)]/80">
                  <AlertTriangle className="w-4.5 h-4.5 text-[var(--color-danger)] shrink-0" />
                  <span className="text-[11px] font-black">خطاهای برجا مانده از طراحی ({toPersianDigits(validationErrors.length)} مورد):</span>
                </div>
                <ul className="space-y-2 pr-2.5 text-[9.5px] text-rose-900 list-decimal leading-relaxed">
                  {validationErrors.map((err, idx) => (
                    <li key={idx} className="font-semibold text-rose-850">{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* SECTION 8: عملیات انتشار و ساخت لینک */}
          <div className="bg-white p-5 rounded-3xl border border-indigo-150/80 shadow-3xs space-y-4">
            <h3 className="text-xs font-black text-[var(--color-text-primary)] pb-2 border-b border-[var(--color-accent)]/10/50 flex items-center gap-1.5">
              <Play className="w-4.5 h-4.5 text-indigo-600" />
              <span>انتشار نهایی برگه آزمون</span>
            </h3>

            {/* Current layout status displaying */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--color-text-tertiary)] font-bold">وضعیت فعلی آزمون:</span>
              <span className={`px-2.5 py-0.5 rounded-lg font-black text-[10.5px] ${
                examStatus === 'draft' 
                  ? 'bg-white/4 text-[var(--color-text-secondary)] border border-[var(--color-glass-light-stroke)]' 
                  : examStatus === 'scheduled'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : examStatus === 'active'
                  ? 'bg-orange-500/15 text-orange-600 border border-orange-200/50 animate-pulse'
                  : 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/20'
              }`}>
                {examStatus === 'draft' && 'پیش‌نویس طراح'}
                {examStatus === 'scheduled' && 'زمان‌بندی‌شده (آینده)'}
                {examStatus === 'active' && 'فعال نهایی (زنده 🟢)'}
                {examStatus === 'completed' && 'پایان‌یافته / زمان سپری شده'}
              </span>
            </div>

            {/* Publish Actions Trigger button */}
            {examStatus === 'draft' ? (
              <button
                type="button"
                onClick={handlePublishExam}
                disabled={validationErrors.length > 0}
                className={`w-full py-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                  validationErrors.length > 0
                    ? 'bg-slate-150 text-[var(--color-text-tertiary)] border border-slate-205 cursor-not-allowed'
                    : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white border border-indigo-750'
                }`}
              >
                <Play className="w-4 h-4" />
                <span>بررسی نهایی و انتشار آزمون</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-[var(--color-success)]/10 text-[var(--color-success)] border-2 border-[var(--color-success)]/20 rounded-2xl p-3 flex items-start gap-2.5">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-black block">آزمون به جریان منتشر شد!</span>
                    <p className="text-[9.5px] text-emerald-600/90 leading-normal">ورود دانش‌آموزان به صورت لایو با لینک زیر برقرار و گزارش پاسخ‌ها زنده بر مانیتور معلم در دسترس است.</p>
                  </div>
                </div>

                {/* Regenerate/Rollback Draft helper to let them revert state */}
                <button
                  type="button"
                  onClick={() => {
                    setExamStatus('draft');
                    setExamLink('');
                  }}
                  className="w-full py-2 bg-white/4 hover:bg-white/6 text-[var(--color-text-secondary)] rounded-xl text-[10.5px] font-bold border border-[var(--color-glass-light-stroke)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>برگرداندن به حالت پیش‌نویس (انصراف موقت)</span>
                </button>
              </div>
            )}

            {/* Mock link generator display panel */}
            {examLink && (
              <div className="p-3 bg-white/3 rounded-2xl border border-indigo-150 space-y-2.5 animate-in slide-in-from-top-2 duration-300">
                <span className="text-[10px] font-bold text-slate-450 flex items-center gap-1">
                  <Link className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  <span>لینک اختصاصی شرکت در آزمون صادر شد:</span>
                </span>
                
                <div className="bg-white border border-[var(--color-glass-light-stroke)] p-2.5 rounded-xl flex items-center justify-between text-xs font-mono text-[var(--color-accent)] font-bold overflow-x-auto gap-2">
                  <span className="truncate text-[10.5px] select-all" title={examLink}>{examLink}</span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`p-1 px-2.5 rounded-lg text-[9.5px] font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
                      isCopied 
                        ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/20' 
                        : 'bg-[var(--color-accent-soft)] hover:bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-indigo-150'
                    }`}
                  >
                    <Copy className="w-3 h-3" />
                    <span>{isCopied ? 'کپی شد! ✅' : 'کپی لینک'}</span>
                  </button>
                </div>
                
                <p className="text-[9px] text-[var(--color-text-tertiary)] leading-normal text-center">این کد یکتا مختص ورود دانش‌آموزان کلاس‌های تعیین شده می‌باشد.</p>
              </div>
            )}

          </div>

          {/* Action buttons footer */}
          <div className="flex gap-2.5 justify-end">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 bg-white/4 hover:bg-white/6 text-[var(--color-text-secondary)] rounded-xl text-xs font-black cursor-pointer shadow-3xs border border-[var(--color-glass-light-stroke)]"
            >
              انصراف و بازگشت
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              className="px-5 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>ثبت تغییرات پیکربندی</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
