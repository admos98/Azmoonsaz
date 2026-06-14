/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  ClipboardCheck, 
  Clock, 
  Award, 
  ShieldAlert, 
  ArrowLeft, 
  ArrowRight, 
  BookOpen, 
  AlertCircle, 
  RefreshCw, 
  Send, 
  CheckCircle2, 
  Lock, 
  User, 
  HelpCircle,
  FileText,
  Flag,
  ChevronDown,
  ChevronUp,
  X,
  Menu,
  Check,
  AlertTriangle
} from 'lucide-react';
import { mockExams, mockStudents, mockSubmissions } from '../../mockData';
import { Exam, Question, StudentAnswer, Submission } from '../../types';

interface ExamPortalProps {
  onBackToTeacher: () => void;
  presetExamCode?: string;
  isStartPath?: boolean; // backwards compatibility
  subRoute?: 'login' | 'start' | 'take' | 'submitted';
  onNavigate?: (path: string) => void;
}

export default function ExamPortal({ 
  onBackToTeacher, 
  presetExamCode = '8AF39', 
  isStartPath = false, 
  subRoute,
  onNavigate 
}: ExamPortalProps) {
  
  // Resolve active views: map old boolean logic to new route views
  const activeView = subRoute || (isStartPath ? 'take' : 'login');

  // --- Core States ---
  const [examCode, setExamCode] = useState(presetExamCode);
  const [nationalId, setNationalId] = useState('');
  const [entryCodeInput, setEntryCodeInput] = useState('');
  const [validationError, setValidationError] = useState('');
  const [generalError, setGeneralError] = useState('');
  
  // Authenticated Student State
  const [loggedInStudent, setLoggedInStudent] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('azmoonsaz_logged_in_student');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Current Active Exam
  const [activeExam, setActiveExam] = useState<Exam | null>(() => {
    const resolved = mockExams.find(ex => ex.examCode.toUpperCase() === presetExamCode.toUpperCase());
    return resolved || null;
  });

  // Active taking exam states
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, any>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [antiCheatWarnings, setAntiCheatWarnings] = useState(0);
  const [savingStatus, setSavingStatus] = useState<'saving' | 'saved' | 'error'>('saved');
  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isPassageExpanded, setIsPassageExpanded] = useState(true);

  // Live Timer references
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Live countdown to exam start
  const [timeUntilStartStr, setTimeUntilStartStr] = useState<string>('');
  const [isExamSoonToOpen, setIsExamSoonToOpen] = useState(false);

  // Sync exam code if prop changes
  useEffect(() => {
    if (presetExamCode) {
      setExamCode(presetExamCode);
      const resolved = mockExams.find(ex => ex.examCode.toUpperCase() === presetExamCode.toUpperCase());
      setActiveExam(resolved || null);
    }
  }, [presetExamCode]);

  // Read student ongoing answers from local storage
  useEffect(() => {
    if (loggedInStudent && activeExam) {
      const savedAnswers = localStorage.getItem(`azmoonsaz_session_ANSWERS_${loggedInStudent.id}_${activeExam.id}`);
      if (savedAnswers) {
        try {
          setStudentAnswers(JSON.parse(savedAnswers));
        } catch (e) {
          console.error(e);
        }
      }
      
      const savedFlags = localStorage.getItem(`azmoonsaz_session_FLAGS_${loggedInStudent.id}_${activeExam.id}`);
      if (savedFlags) {
        try {
          setFlaggedQuestions(JSON.parse(savedFlags));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [loggedInStudent, activeExam]);

  // Persist student answers and flags on changes, plus autosave status toggler
  useEffect(() => {
    if (loggedInStudent && activeExam && Object.keys(studentAnswers).length > 0) {
      localStorage.setItem(
        `azmoonsaz_session_ANSWERS_${loggedInStudent.id}_${activeExam.id}`, 
        JSON.stringify(studentAnswers)
      );

      // Autosave status indicator mock trigger
      setSavingStatus('saving');
      const mockSaveTimeout = setTimeout(() => {
        setSavingStatus('saved');
      }, 500);

      return () => clearTimeout(mockSaveTimeout);
    }
  }, [studentAnswers, loggedInStudent, activeExam]);

  useEffect(() => {
    if (loggedInStudent && activeExam && Object.keys(flaggedQuestions).length > 0) {
      localStorage.setItem(
        `azmoonsaz_session_FLAGS_${loggedInStudent.id}_${activeExam.id}`, 
        JSON.stringify(flaggedQuestions)
      );
    }
  }, [flaggedQuestions, loggedInStudent, activeExam]);

  // --- Helpers for formatting ---
  const toPersianDigits = (num: number | string | undefined): string => {
    if (num === undefined || num === null) return '';
    const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(num).replace(/[0-9]/g, (w) => id[+w]);
  };

  const getPersianDateStr = (dateStr?: string): string => {
    if (!dateStr) return 'نامشخص';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length !== 3) return 'نامشخص';
    const gy = parseInt(parts[0]);
    const gm = parseInt(parts[1]);
    const gd = parseInt(parts[2]);
    if (isNaN(gy) || isNaN(gm) || isNaN(gd)) return 'نامشخص';
    
    // Gregorian to Jalali mapping algorithm
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
    let jy = -1595 + (33 * Math.floor(days / 12053));
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      jy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    let jm = (days < 186) ? (1 + Math.floor(days / 31)) : (7 + Math.floor((days - 186) / 30));
    let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    
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
      return `${dayOfWeekStr}، ${toPersianDigits(jd)} ${months[jm - 1]} ${toPersianDigits(jy)}`;
    } catch {
      return '';
    }
  };

  // --- Scheduling State Checks ---
  const getExamScheduleState = (): 'not_started' | 'closed' | 'open' => {
    if (!activeExam) return 'open'; // fallback if no settings

    const now = new Date();
    
    // Resolve dates and hours
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (activeExam.settings.startTime) {
      startDate = new Date(activeExam.settings.startTime);
    } else if (activeExam.settings.startDate) {
      const hr = activeExam.settings.startHour || '00:00';
      startDate = new Date(`${activeExam.settings.startDate}T${hr}:00`);
    }

    if (activeExam.settings.endTime) {
      endDate = new Date(activeExam.settings.endTime);
    } else if (activeExam.settings.endDate) {
      const hr = activeExam.settings.endHour || '23:59';
      endDate = new Date(`${activeExam.settings.endDate}T${hr}:00`);
    }

    // Check specific states
    if (activeExam.status === 'completed') {
      return 'closed';
    }

    if (startDate && now < startDate) {
      return 'not_started';
    }

    if (endDate && now > endDate) {
      return 'closed';
    }

    // Default by active status
    if (activeExam.status === 'scheduled') {
      return 'not_started';
    }

    return 'open';
  };

  const scheduleState = getExamScheduleState();

  // --- Count down timer until exam start ---
  useEffect(() => {
    if (scheduleState !== 'not_started' || !activeExam) {
      setTimeUntilStartStr('');
      return;
    }

    let startDate: Date | null = null;
    if (activeExam.settings.startTime) {
      startDate = new Date(activeExam.settings.startTime);
    } else if (activeExam.settings.startDate) {
      const hr = activeExam.settings.startHour || '00:00';
      startDate = new Date(`${activeExam.settings.startDate}T${hr}:00`);
    }

    if (!startDate) return;

    const updateCountdown = () => {
      const now = new Date();
      const diffMs = startDate!.getTime() - now.getTime();
      if (diffMs <= 0) {
        setTimeUntilStartStr('');
        setIsExamSoonToOpen(true);
        return;
      }

      const totalSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;

      let timerStr = '';
      if (hours > 0) {
        timerStr += `${hours} ساعت و `;
      }
      timerStr += `${minutes} دقیقه و ${seconds} ثانیه`;
      setTimeUntilStartStr(toPersianDigits(timerStr));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [activeExam, scheduleState]);

  // --- Prevent entering /take or /start directly without a logged in student ---
  useEffect(() => {
    if ((activeView === 'take' || activeView === 'start') && !loggedInStudent && activeExam && onNavigate) {
      onNavigate(`/exam/${presetExamCode}`);
    }
  }, [activeView, loggedInStudent, activeExam, presetExamCode, onNavigate]);

  // --- Search for mock submission ---
  const getSubmissionsForLoggedIn = () => {
    if (!loggedInStudent || !activeExam) return null;
    return mockSubmissions.find(sub => sub.studentId === loggedInStudent.id && sub.examId === activeExam.id);
  };

  const currentSubmission = getSubmissionsForLoggedIn();

  // Active question-taking timer
  useEffect(() => {
    if (activeView === 'take' && loggedInStudent && activeExam) {
      const subs = mockSubmissions.find(s => s.studentId === loggedInStudent.id && s.examId === activeExam.id);
      
      const sessionDurationMinutes = activeExam.duration || 60;
      let targetSeconds = sessionDurationMinutes * 60;

      if (subs && subs.startedAt) {
        const elapsedSecs = Math.floor((new Date().getTime() - new Date(subs.startedAt).getTime()) / 1000);
        targetSeconds = Math.max(0, targetSeconds - elapsedSecs);
      }

      setTimerSeconds(targetSeconds);

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }

      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            handleAutoSubmit(true); // timed out auto submit
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      };
    }
  }, [activeView, loggedInStudent, activeExam]);

  // Handle anti-cheat blur detection
  useEffect(() => {
    if (activeView === 'take' && activeExam?.settings?.browserLockdown && loggedInStudent) {
      const handleBlur = () => {
        setAntiCheatWarnings(prev => {
          const updated = prev + 1;
          alert(`⚠️ هشدار امنیتی آزمون‌ساز: شما از منوی فعال آزمون خارج شدید! خروج‌های مکرر موجب ثبت نمره منفی و ابطال احتمالی پاسخ‌برگ خواهد شد. (خطا: ${updated}/۳)`);
          if (updated >= 3) {
            handleAutoSubmit(true);
          }
          return updated;
        });
      };
      window.addEventListener('blur', handleBlur);
      return () => window.removeEventListener('blur', handleBlur);
    }
  }, [activeView, activeExam, loggedInStudent]);

  // --- Standard Validation & Forms ---
  const validateNationalIdFormat = (id: string) => {
    setValidationError('');
    setGeneralError('');

    if (id === '') return false;

    if (/[^\d]/.test(id)) {
      setValidationError('فقط عدد وارد کنید');
      return false;
    }

    if (id.length !== 10) {
      setValidationError('کد ملی باید ۱۰ رقم باشد');
      return false;
    }

    if (/^(\d)\1{9}$/.test(id)) {
      setValidationError('کد ملی معتبر نیست');
      return false;
    }

    return true;
  };

  const handleNationalIdChange = (val: string) => {
    setNationalId(val);
    if (val.length > 0) {
      validateNationalIdFormat(val);
    }
  };

  const handleValidateForm = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    if (!activeExam) return;

    const formattedId = nationalId.trim();
    const isValidFormat = validateNationalIdFormat(formattedId);
    if (!isValidFormat) return;

    // Search for student in mock list
    const foundStudent = mockStudents.find(s => s.nationalId === formattedId);

    // Security check: Check if student exists and is assigned to the classes or students of this exam
    let isStudentAllowed = false;
    if (foundStudent) {
      const isClassAllowed = activeExam.classGroupIds.includes(foundStudent.classGroupId) || 
                             activeExam.settings.allowedClasses?.includes(foundStudent.classGroupId);
      
      const isSpecificAllowed = activeExam.settings?.allowedStudents && activeExam.settings.allowedStudents.length > 0
        ? activeExam.settings.allowedStudents.includes(foundStudent.id)
        : true;

      isStudentAllowed = !!(isClassAllowed && isSpecificAllowed);
    }

    // Entry code evaluation if required
    const requiresCode = activeExam.settings?.entryCode && activeExam.settings.entryCode.trim().length > 0;
    const isCodeCorrect = requiresCode 
      ? entryCodeInput.trim().toUpperCase() === activeExam.settings.entryCode!.trim().toUpperCase()
      : true;

    if (!isStudentAllowed || !isCodeCorrect) {
      setGeneralError('اطلاعات وارد شده معتبر نیست یا شما اجازه شرکت در این آزمون را ندارید.');
      return;
    }

    // Save authentic student representation
    localStorage.setItem('azmoonsaz_logged_in_student', JSON.stringify(foundStudent));
    setLoggedInStudent(foundStudent);

    // Redirect to welcome start page
    if (onNavigate) {
      onNavigate(`/exam/${activeExam.examCode}/start`);
    }
  };

  const handleStartExamAction = () => {
    if (!activeExam || !loggedInStudent) return;

    // Check if there is already an ongoing submission for this exam
    let sub = mockSubmissions.find(s => s.studentId === loggedInStudent.id && s.examId === activeExam.id);
    
    if (!sub) {
      // Create a live new ongoing submission representation
      sub = {
        id: `sub-${Date.now()}`,
        examId: activeExam.id,
        examCode: activeExam.examCode,
        studentId: loggedInStudent.id,
        studentName: loggedInStudent.name,
        nationalId: loggedInStudent.nationalId,
        startedAt: new Date().toISOString(),
        status: 'ongoing',
        score: 0,
        maxScore: activeExam.questions?.reduce((acc, q) => acc + q.points, 0) || 20,
        answers: []
      };
      mockSubmissions.push(sub);
      
      // Wipe clean start state
      localStorage.removeItem(`azmoonsaz_session_ANSWERS_${loggedInStudent.id}_${activeExam.id}`);
      localStorage.removeItem(`azmoonsaz_session_FLAGS_${loggedInStudent.id}_${activeExam.id}`);
      setStudentAnswers({});
      setFlaggedQuestions({});
    }

    // Navigate to live take page
    if (onNavigate) {
      onNavigate(`/exam/${activeExam.examCode}/take`);
    }
  };

  const handleAutoSubmit = (wasTimeOut = false) => {
    if (!activeExam || !loggedInStudent) return;
    
    // Finalize submission
    const subIdx = mockSubmissions.findIndex(s => s.studentId === loggedInStudent.id && s.examId === activeExam.id);
    
    const formattedAnswers = Object.entries(studentAnswers).map(([qid, ans]) => ({
      questionId: qid,
      answer: ans
    }));

    if (subIdx !== -1) {
      mockSubmissions[subIdx].status = 'submitted';
      mockSubmissions[subIdx].submittedAt = new Date().toISOString();
      mockSubmissions[subIdx].answers = formattedAnswers;
    } else {
      // Push if missing
      mockSubmissions.push({
        id: `sub-${Date.now()}`,
        examId: activeExam.id,
        examCode: activeExam.examCode,
        studentId: loggedInStudent.id,
        studentName: loggedInStudent.name,
        nationalId: loggedInStudent.nationalId,
        startedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        status: 'submitted',
        score: 0,
        maxScore: activeExam.questions?.reduce((acc, q) => acc + q.points, 0) || 20,
        answers: formattedAnswers
      });
    }

    // Clean up local temp caches
    localStorage.removeItem(`azmoonsaz_session_ANSWERS_${loggedInStudent.id}_${activeExam.id}`);
    localStorage.removeItem(`azmoonsaz_session_FLAGS_${loggedInStudent.id}_${activeExam.id}`);
    
    if (onNavigate) {
      onNavigate(`/exam/${activeExam.examCode}/submitted`);
    }
  };

  const triggerSubmitDialog = () => {
    setIsConfirmSubmitOpen(true);
  };

  const handleExitToPortal = () => {
    localStorage.removeItem('azmoonsaz_logged_in_student');
    setLoggedInStudent(null);
    setValidationError('');
    setGeneralError('');
    setNationalId('');
    setEntryCodeInput('');
    if (onNavigate && activeExam) {
      onNavigate(`/exam/${activeExam.examCode}`);
    }
  };

  // --- Navigation Index Check Helpers ---
  const checkIsQuestionAnswered = (qid: string, type: string) => {
    const ans = studentAnswers[qid];
    if (ans === undefined || ans === null || ans === '') return false;
    if (type === 'multiple_choice' && Array.isArray(ans)) return ans.length > 0;
    if ((type === 'cloze' || type === 'reading_comprehension' || type === 'matching') && typeof ans === 'object') {
      return Object.keys(ans).length > 0;
    }
    return true;
  };

  // --- Handlers for answering questions ---
  const handleOptionSelect = (questionId: string, optionId: string) => {
    setStudentAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const handleMultipleSelectToggle = (questionId: string, optionId: string) => {
    const current = (studentAnswers[questionId] as string[]) || [];
    const updated = current.includes(optionId)
      ? current.filter(id => id !== optionId)
      : [...current, optionId];
    setStudentAnswers(prev => ({ ...prev, [questionId]: updated }));
  };

  const handleTextAnswerChange = (questionId: string, value: string) => {
    setStudentAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleMatchingChange = (questionId: string, leftItem: string, value: string) => {
    const currentMap = (studentAnswers[questionId] as Record<string, string>) || {};
    setStudentAnswers(prev => ({
      ...prev,
      [questionId]: { ...currentMap, [leftItem]: value }
    }));
  };

  const handleOrderingShift = (questionId: string, currentItems: string[]) => {
    setStudentAnswers(prev => ({ ...prev, [questionId]: currentItems }));
  };

  const handleSubPartChange = (questionId: string, partId: string, optionId: string) => {
    const currentMap = (studentAnswers[questionId] as Record<string, string>) || {};
    setStudentAnswers(prev => ({
      ...prev,
      [questionId]: { ...currentMap, [partId]: optionId }
    }));
  };

  const toggleFlagQuestion = (qid: string) => {
    setFlaggedQuestions(prev => ({
      ...prev,
      [qid]: !prev[qid]
    }));
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${toPersianDigits(mins.toString().padStart(2, '0'))}:${toPersianDigits(secs.toString().padStart(2, '0'))}`;
  };

  const questionsCount = activeExam?.questions?.length || 0;
  const activeQuestion: Question | undefined = activeExam?.questions?.[currentQuestionIdx];
  const allowBacktrack = activeExam?.settings?.allowBacktrack ?? true;

  // Question Answer Statistics
  const totalAnsweredCount = activeExam?.questions?.filter(q => checkIsQuestionAnswered(q.id, q.type)).length || 0;
  const totalUnansweredCount = questionsCount - totalAnsweredCount;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between select-none" dir="rtl" id="exam-portal-outermost">
      
      {/* 1. PORTAL HEADER (For general non-answering views) */}
      {activeView !== 'take' && (
        <header className="max-w-4xl w-full mx-auto flex justify-between items-center border-b border-slate-200 py-4 px-4 select-none" id="exam-general-header">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600 focus:outline-hidden" />
            <span className="text-xs font-black text-slate-800">سامانه سنجش و آزمون هوشمند</span>
          </div>

          <button
            onClick={onBackToTeacher}
            className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer hover:underline"
            id="btn-back-to-teacher-control"
          >
            <span>بازگشت به پنل طراحان</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </header>
      )}

      {/* 2. MAIN WORKSPACE */}
      <main className={`w-full mx-auto flex-1 flex flex-col justify-center ${activeView === 'take' ? 'py-0' : 'py-8 px-4 max-w-2xl'}`} id="exam-portal-workspace">
        
        {/* ==================== VIEW 1: LOGIN ==================== */}
        {activeView === 'login' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-slate-250 shadow-2xl p-6 md:p-8 space-y-6"
            id="student-login-card"
          >
            <div className="text-center space-y-2 pb-4 border-b border-slate-100">
              <ClipboardCheck className="w-12 h-12 text-indigo-600 mx-auto" />
              <h1 className="text-md md:text-lg font-black text-slate-800">{activeExam.title}</h1>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto leading-normal">
                {activeExam.description || 'سیستم برخط ارزیابی تحصیلی دوره اول و دوم متوسطه'}
              </p>
            </div>

            {scheduleState === 'not_started' && (
              <div className="space-y-4 text-center py-2" id="login-state-not-started">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 space-y-1">
                  <span className="text-xs font-black block">این آزمون هنوز شروع نشده است.</span>
                  {activeExam.settings.startTime ? (
                    <p className="text-[11px] text-amber-700">
                      تاریخ برگزاری: {getPersianDateStr(activeExam.settings.startTime)} ساعت {toPersianDigits(activeExam.settings.startTime.split('T')[1]?.substring(0, 5))}
                    </p>
                  ) : activeExam.settings.startDate ? (
                    <p className="text-[11px] text-amber-700">
                      تاریخ برگزاری: {getPersianDateStr(activeExam.settings.startDate)} ساعت {toPersianDigits(activeExam.settings.startHour)}
                    </p>
                  ) : null}
                </div>

                {timeUntilStartStr && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block font-bold">زمان باقی‌مانده تا بازگشایی خودکار:</span>
                    <span className="text-xs font-black text-indigo-600 bg-indigo-50/50 border border-indigo-100 inline-block px-4 py-1.5 rounded-xl">{timeUntilStartStr}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled
                  className="w-full py-3 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed border border-slate-200"
                >
                  <span>ورود غیرفعال است (منتظر زمان سنجش)</span>
                  <Lock className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {scheduleState === 'closed' && (
              <div className="space-y-4 text-center py-2" id="login-state-closed">
                <div className="bg-rose-50 border border-rose-150 rounded-2xl p-4 text-rose-900 space-y-1">
                  <span className="text-xs font-black block">زمان شرکت در این آزمون به پایان رسیده است.</span>
                  <p className="text-[11px] text-rose-700 leading-normal">
                    فرصت مقرر قانونی جهت ارسال پاسخ‌برگ سپری گردیده است.
                  </p>
                </div>

                <button
                  type="button"
                  disabled
                  className="w-full py-3 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold cursor-not-allowed border border-slate-150"
                >
                  برگزاری آزمون خاتمه یافته است
                </button>
              </div>
            )}

            {scheduleState === 'open' && (
              <div className="space-y-4" id="login-state-open">
                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-3 rounded-2xl border border-slate-150 text-[11px] text-slate-600">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-400 block font-bold">نوع آزمون:</span>
                    <span className="font-extrabold text-slate-800">
                      {activeExam.settings.mode === 'practice' ? 'تمرینی' : 'رسمی'}
                    </span>
                  </div>
                  <div className="space-y-0.5 border-x border-slate-200">
                    <span className="text-[9px] text-slate-400 block font-bold">پایه و درس:</span>
                    <span className="font-extrabold text-slate-800">پایه {activeExam.grade} - {activeExam.subject}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-slate-400 block font-bold">زمان مجاز:</span>
                    <span className="font-black text-indigo-700">{toPersianDigits(activeExam.duration)} دقیقه</span>
                  </div>
                </div>

                {!loggedInStudent ? (
                  <form onSubmit={handleValidateForm} className="space-y-4 text-right" id="login-nationalid-form">
                    {generalError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-bold leading-relaxed">
                        {generalError}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label htmlFor="student-national-id" className="text-xs font-black text-slate-600 block">کد ملی</label>
                      <input
                        type="text"
                        id="student-national-id"
                        maxLength={10}
                        required
                        value={toPersianDigits(nationalId)}
                        onChange={(e) => handleNationalIdChange(e.target.value.replace(/\D/g, ''))}
                        placeholder="مشخصه ۱۰ رقمی کد ملی خود را وارد کنید"
                        className={`w-full bg-slate-50 border p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white tracking-wide ${validationError ? 'border-rose-300' : 'border-slate-205'}`}
                      />
                      {validationError && (
                        <p className="text-[10px] text-rose-600 font-bold pr-1 pt-0.5 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{validationError}</span>
                        </p>
                      )}
                    </div>

                    {activeExam.settings?.entryCode && activeExam.settings?.entryCode.trim().length > 0 && (
                      <div className="space-y-1">
                        <label htmlFor="exam-entry-pass-code" className="text-xs font-black text-slate-600 block">کد ورود آزمون (رمز اختصاصی)</label>
                        <input
                          type="text"
                          id="exam-entry-pass-code"
                          required
                          value={entryCodeInput}
                          onChange={(e) => setEntryCodeInput(e.target.value)}
                          placeholder="رمز ورود ابلاغ شده از معلم را وارد کنید"
                          className="w-full bg-slate-50 border border-slate-205 p-3 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white tracking-widest text-center uppercase"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      id="btn-login-submit"
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                    >
                      <span>تایید هویت و ورود به درگاه</span>
                      <Play className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <div className="space-y-3 text-center" id="login-already-authed">
                    <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl text-xs text-slate-700 flex justify-between items-center text-right">
                      <div>
                        <span className="block font-bold">احراز هویت قبلی موفقیت‌آمیز بوده است:</span>
                        <span className="text-indigo-700 font-black">{loggedInStudent.name}</span>
                      </div>
                      <button onClick={handleExitToPortal} className="text-[10px] text-rose-600 underline font-bold">خروج و لاگین مجدد</button>
                    </div>
                    <button
                      onClick={() => onNavigate && onNavigate(`/exam/${activeExam.examCode}/start`)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md"
                    >
                      ورود به صفحه انتظار آزمون
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ==================== VIEW 2: WELCOME/START SUMMARY ==================== */}
        {activeView === 'start' && loggedInStudent && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-slate-250 shadow-2xl p-6 md:p-8 space-y-6"
            id="student-start-greeting-card"
          >
            {/* Header info */}
            <div className="text-center space-y-2 pb-4 border-b border-slate-100">
              <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full text-[10px] font-black tracking-wide border border-indigo-150 select-none">آماده‌سازی آزمون</span>
              <h1 className="text-md md:text-lg font-black text-slate-800">{activeExam.title}</h1>
              <p className="text-[11px] text-slate-400">دانش‌آموز گرامی، لطفاً شرایط زیر را برای شروع آزمون بررسی کنید.</p>
            </div>

            {/* Student profile profile summary card */}
            <div className="p-4 bg-indigo-50/40 border border-indigo-150 rounded-2xl flex items-center justify-between text-right">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">نام و نام خانوادگی داوطلب:</span>
                  <span className="text-xs font-black text-slate-800">{loggedInStudent.name}</span>
                </div>
              </div>
              <div className="text-left">
                <span className="text-[9px] text-slate-400 block font-semibold">کد ملی:</span>
                <span className="text-xs font-bold text-slate-700 font-mono tracking-wider">{toPersianDigits(loggedInStudent.maskedNationalId)}</span>
              </div>
            </div>

            {/* Instruction List rules */}
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2 text-xs text-indigo-700">
                <ShieldAlert className="w-4.5 h-4.5 text-indigo-600 animate-bounce" />
                <span>دستورالعمل و ضوابط فنی سنجش:</span>
              </h3>
              <ul className="space-y-2.5 text-[11px] text-slate-650 pr-4 list-decimal font-semibold leading-relaxed">
                <li>زمان پاسخ‌گویی به کل سوالات این آزمون دقیقاً <strong className="text-indigo-700">{toPersianDigits(activeExam.duration)} دقیقه</strong> می‌باشد.</li>
                <li>سامانه مجهز به سیستم <strong className="text-indigo-700">ذخیره‌سازی خودکار برخط (Autosave)</strong> است؛ لذا نگران قطعی احتمالی اینترنت نباشید.</li>
                {!allowBacktrack && (
                  <li className="text-amber-700 font-black">⚠️ توجه: در این برگه امکان بازگشت به سوالات پاسخ‌داده‌شده قبلی وجود ندارد؛ لذا هر سوال را پیش از خروج، با دقت نهایی کنید.</li>
                )}
                {activeExam.settings?.browserLockdown && (
                  <li className="text-rose-600 font-black">⚠️ توجه مهم: خروج از برگه آزمون (یا حرکت به تبلت‌ها و برنامه‌های دیگر) رصد شده و سیستم پس از ۳ خطا برگه را خودکار تحویل می‌دهد.</li>
                )}
              </ul>
            </div>

            {/* Actions panel */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleExitToPortal}
                className="px-4 py-3 bg-slate-150 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                انصراف و خروج
              </button>

              {currentSubmission && (currentSubmission.status === 'submitted' || currentSubmission.status === 'graded') ? (
                <div className="flex-1 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl font-bold text-center text-xs">
                  این آزمون قبلاً ارسال و تحویل گردیده است.
                </div>
              ) : currentSubmission ? (
                <button
                  type="button"
                  onClick={handleStartExamAction}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <span>ادامه آزمون نیمه‌کاره</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartExamAction}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <span>شروع آزمون جدید</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ==================== VIEW 3: LIVE EXAM-TAKING WORKSPACE ==================== */}
        {activeView === 'take' && loggedInStudent && activeQuestion && (
          <div className="flex flex-col min-h-screen bg-slate-50 text-right" id="exam-taking-portal">
            
            {/* STICKY TOP STATUS BAR */}
            <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs p-3.5 flex justify-between items-center px-4 md:px-8 select-none" id="sticky-exam-top-bar">
              <div className="flex flex-col text-right">
                <span className="text-xs md:text-sm font-black text-slate-800">{activeExam.title}</span>
                <span className="text-[10px] text-slate-400 font-bold">
                  داوطلب: <span className="text-slate-650">{loggedInStudent.name}</span> (پایه {activeExam.grade})
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Autosave notification status */}
                <div className="hidden sm:block text-[10px] font-bold">
                  {savingStatus === 'saving' && (
                    <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded-md flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      در حال ذخیره...
                    </span>
                  )}
                  {savingStatus === 'saved' && (
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      ذخیره شد
                    </span>
                  )}
                  {savingStatus === 'error' && (
                    <span className="text-rose-600 bg-rose-50 px-2 py-1 rounded-md flex items-center gap-1 border border-rose-100">
                      <AlertCircle className="w-3 h-3 text-rose-500" />
                      خطا در ذخیره
                    </span>
                  )}
                </div>

                {/* Countdown timer clock */}
                <div className={`px-3 py-1.5 rounded-xl font-bold font-mono text-xs md:text-sm flex items-center gap-1.5 ${timerSeconds < 300 ? 'bg-rose-50 border border-rose-200 text-rose-600 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>{formatTime(timerSeconds)}</span>
                </div>

                {/* Mobile Navigator trigger */}
                <button
                  onClick={() => setMobileNavOpen(true)}
                  className="sm:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
                  title="نمایش فهرست سوالات"
                >
                  <Menu className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* COMPACT TOP ALERTS */}
            {!allowBacktrack && (
              <div className="bg-amber-50 border-b border-amber-150 p-2 text-center text-[10px] font-black text-amber-900">
                ⚠️ دقت کنید: امکان بازگردانی سوال قبلی وجود ندارد. حتماً پاسخ خود را نهایی کرده و سپس به سوال بعد بروید.
              </div>
            )}

            {/* TWO-COLUMN LAYOUT CONFORM */}
            <div className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6" id="exam-take-body-grid">
              
              {/* LEFT SIDE/RIGHT SIDE INTERACTIVE QUESTION BOX */}
              <div className="lg:col-span-9 space-y-5" id="interactive-question-box">
                
                {/* Information Header of Question */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex justify-between items-center text-[11px] font-black text-slate-500 shadow-2xs">
                  <span>بخش: <span className="text-slate-800">{activeExam.subject}</span></span>
                  <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full px-3 py-1 text-xs font-black">سوال {toPersianDigits(currentQuestionIdx + 1)} از {toPersianDigits(questionsCount)}</span>
                  <span>بارم: <span className="text-slate-800">{toPersianDigits(activeQuestion.points)} نمره</span></span>
                </div>

                {/* CORE QUESTION CARD */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 relative" id={`qcard-${activeQuestion.id}`}>
                  
                  {/* Flag indicator on card top corner */}
                  {flaggedQuestions[activeQuestion.id] && (
                    <div className="absolute top-4 left-4 text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[10px] font-bold flex items-center gap-1 select-none animate-pulse">
                      <Flag className="w-3.5 h-3.5 fill-current" />
                      <span>نشاندار شده</span>
                    </div>
                  )}

                  {/* Question Stem Text */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-indigo-600 font-extrabold block">صورت سوال سنجش:</span>
                    <h2 className="text-xs md:text-sm text-slate-800 font-black leading-relaxed whitespace-pre-wrap">{activeQuestion.text}</h2>
                  </div>

                  {/* Question Image Attachment */}
                  {activeQuestion.imageUrl && (
                    <div className="my-3 text-right" id="question-image-frame">
                      <span className="text-[9px] text-slate-400 block mb-1">تصویر پیوست و کانتکست سوال:</span>
                      <img
                        src={activeQuestion.imageUrl}
                        alt="Question Visual Context"
                        referrerPolicy="no-referrer"
                        className="rounded-xl border border-slate-200 max-h-56 object-contain w-full max-w-lg shadow-sm hover:scale-[1.01] transition-transform"
                      />
                    </div>
                  )}

                  {/* ================== READING COMPREHENSION / CLOZE (With passage side drawer) ================== */}
                  {activeQuestion.type === 'reading_comprehension' && (
                    <div className="mt-4 p-4 bg-indigo-50/30 border border-indigo-150 rounded-xl text-xs space-y-3" id="comperhension-container">
                      {/* Mobile Passage Collapser */}
                      <div className="flex items-center justify-between sm:hidden">
                        <span className="font-extrabold text-indigo-800 text-[11px]">متن درک مطلب مربوطه</span>
                        <button
                          onClick={() => setIsPassageExpanded(!isPassageExpanded)}
                          className="text-[10px] bg-white border px-2 py-1 rounded-md text-slate-600 font-bold flex items-center gap-1"
                        >
                          <span>{isPassageExpanded ? 'مخفی‌سازی متن' : 'نمایش متن کامل'}</span>
                          {isPassageExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <AnimatePresence>
                        {isPassageExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-white border p-3 rounded-lg text-slate-700 leading-relaxed font-semibold overflow-hidden whitespace-pre-wrap text-[11px]"
                          >
                            {/* In standard question mock, we have the reading passage loaded within activeQuestion.text or custom fields */}
                            سلجوقیان یک سلسله ترک‌تبار مسلمان بودند که در سده‌های پنجم تا ششم هجری بر بخش‌های پهناوری از آسیای غربی و ایران فرمان راندند. آلپ ارسلان یکی از مقتدرترین پادشاهان این سلسله با همکاری وزیر دانا، خواجه نظام‌الملک طوسی، توانست مدارس زنجیره‌ای نظامیه را برای اولین بار تأسیس کند.
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* INPUT / CHOICES ANSWERING MODAL WIDGETS */}
                  <div className="pt-3 border-t border-slate-100" id="answering-widgets-container">
                    
                    {/* TYPE 1: Single Choice (Radio Button Style, supporting image options!) */}
                    {activeQuestion.type === 'single_choice' && activeQuestion.options && (
                      <div className={activeQuestion.options.some(opt => opt.imageUrl) ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-2.5"} id="rendered-single-selection">
                        {activeQuestion.options.map((opt) => {
                          const checked = studentAnswers[activeQuestion.id] === opt.id;
                          const hasImg = !!opt.imageUrl;

                          return (
                            <div
                              key={opt.id}
                              onClick={() => handleOptionSelect(activeQuestion.id, opt.id)}
                              className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all flex ${hasImg ? 'flex-col items-center gap-3 overflow-hidden' : 'items-center gap-3'} ${
                                checked
                                  ? 'bg-indigo-50 border-2 border-indigo-400 text-indigo-850 font-extrabold shadow-sm'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                              }`}
                            >
                              {hasImg && opt.imageUrl && (
                                <img
                                  src={opt.imageUrl}
                                  alt={opt.text}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-32 object-cover rounded-xl border border-slate-150"
                                />
                              )}
                              <div className="flex items-center gap-2.5 w-full">
                                <div className={`w-4 .h-4 rounded-full border flex items-center justify-center shrink-0 ${checked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
                                  {checked && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                </div>
                                <span>{opt.text}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* TYPE 2: Multiple Choice Style (Checkboxes) */}
                    {activeQuestion.type === 'multiple_choice' && activeQuestion.options && (
                      <div className="space-y-2.5" id="rendered-multi-selection">
                        {activeQuestion.options.map((opt) => {
                          const checked = ((studentAnswers[activeQuestion.id] as string[]) || []).includes(opt.id);
                          return (
                            <div
                              key={opt.id}
                              onClick={() => handleMultipleSelectToggle(activeQuestion.id, opt.id)}
                              className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all flex items-center gap-3 ${
                                checked
                                  ? 'bg-indigo-50 border-2 border-indigo-400 text-indigo-850 font-extrabold shadow-sm'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {}} // dummy mock to silence React warning
                                className="w-4 h-4 text-indigo-600 rounded cursor-pointer shrink-0"
                              />
                              <span>{opt.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* TYPE 3: True / False Indicator */}
                    {activeQuestion.type === 'true_false' && (
                      <div className="grid grid-cols-2 gap-4" id="rendered-tf-blocks">
                        {[
                          { val: true, text: 'درست (گزینه صحیح است) ✔️' },
                          { val: false, text: 'نادرست (گزینه غلط است) ❌' },
                        ].map((tf) => {
                          const checked = studentAnswers[activeQuestion.id] === tf.val;
                          return (
                            <button
                              key={String(tf.val)}
                              type="button"
                              onClick={() => setStudentAnswers(prev => ({ ...prev, [activeQuestion.id]: tf.val }))}
                              className={`py-4 px-3 rounded-2xl border text-xs font-black transition-all cursor-pointer text-center ${
                                checked
                                  ? 'bg-indigo-600 border-indigo-700 text-white shadow-md'
                                  : 'bg-slate-50 border-slate-205 text-slate-600 hover:bg-white hover:border-slate-300'
                              }`}
                            >
                              {tf.text}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* TYPE 4: Matching Lists Dropdown Column match */}
                    {activeQuestion.type === 'matching' && activeQuestion.matchingPairs && (
                      <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs" id="rendered-matching-box">
                        <span className="text-[10px] text-slate-400 font-extrabold block mb-1">کلمات متناظر را در فیلد بازشو انتخاب کنید:</span>
                        {activeQuestion.matchingPairs.map((pair, idx) => {
                          const currentMap = studentAnswers[activeQuestion.id] || {};
                          const selectedVal = currentMap[pair.right] || '';

                          return (
                            <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-150 shadow-2xs">
                              <span className="font-extrabold text-slate-755">{pair.right}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-405 font-bold">معادل با:</span>
                                <select
                                  value={selectedVal}
                                  onChange={(e) => handleMatchingChange(activeQuestion.id, pair.right, e.target.value)}
                                  className="bg-slate-50 border border-slate-200 text-[11px] font-bold py-1 px-2 rounded-lg focus:outline-hidden"
                                >
                                  <option value="">-- انتخاب جفت کلمه --</option>
                                  {activeQuestion.matchingPairs?.map(mp => (
                                    <option key={mp.left} value={mp.left}>{mp.left}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* TYPE 5: Ordering sorting blocks */}
                    {activeQuestion.type === 'ordering' && activeQuestion.orderingItems && (
                      <div className="space-y-3 text-xs" id="rendered-sorting-box">
                        <p className="text-[10px] text-slate-400 font-extrabold">بر روی فلش‌های جابجایی کلیک کنید تا گزینه‌ها بر مبنای ترتیب صائب ردیف شوند:</p>
                        <div className="space-y-2">
                          {(() => {
                            const items = (studentAnswers[activeQuestion.id] as string[]) || [...activeQuestion.orderingItems!];
                            
                            const moveItem = (idx: number, dir: 'up' | 'down') => {
                              const newArr = [...items];
                              if (dir === 'up' && idx > 0) {
                                [newArr[idx], newArr[idx - 1]] = [newArr[idx - 1], newArr[idx]];
                              } else if (dir === 'down' && idx < newArr.length - 1) {
                                [newArr[idx], newArr[idx + 1]] = [newArr[idx + 1], newArr[idx]];
                              }
                              handleOrderingShift(activeQuestion.id, newArr);
                            };

                            return items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-2xs">
                                <span className="font-extrabold text-slate-800">{item}</span>
                                <div className="flex gap-1.5">
                                  {idx > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => moveItem(idx, 'up')}
                                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-650 rounded-lg border border-slate-200 text-[10px] font-black"
                                    >
                                      ▲ بالا
                                    </button>
                                  )}
                                  {idx < items.length - 1 && (
                                    <button
                                      type="button"
                                      onClick={() => moveItem(idx, 'down')}
                                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-650 rounded-lg border border-slate-200 text-[10px] font-black"
                                    >
                                      ▼ پایین
                                    </button>
                                  )}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}

                    {/* TYPE 6: Fill the blank single-word input */}
                    {activeQuestion.type === 'fill_blank' && (
                      <div className="space-y-2 text-xs font-bold" id="rendered-fillblank">
                        <label htmlFor="fill-blank-field" className="text-[10px] text-slate-400 block font-black">واژگان گمشده را با تایپ دستی تکمیل فرمایید:</label>
                        <input
                          type="text"
                          id="fill-blank-field"
                          value={studentAnswers[activeQuestion.id] || ''}
                          onChange={(e) => handleTextAnswerChange(activeQuestion.id, e.target.value)}
                          placeholder="کلمه صحیح جاهای خالی را جایگذاری نمایید..."
                          className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-850 p-3 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:bg-white font-extrabold"
                        />
                      </div>
                    )}

                    {/* TYPE 7: Short Answer */}
                    {activeQuestion.type === 'short_answer' && (
                      <div className="space-y-2 text-xs" id="rendered-shortanswer">
                        <label htmlFor="short-answer-field" className="text-[10px] text-slate-400 block font-black">پاسخ کوتاه خود را تایپ فرمایید:</label>
                        <input
                          type="text"
                          id="short-answer-field"
                          value={studentAnswers[activeQuestion.id] || ''}
                          onChange={(e) => handleTextAnswerChange(activeQuestion.id, e.target.value)}
                          placeholder="پاسخ نهایی به اجمال قید شود..."
                          className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-850 p-3 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:bg-white font-extrabold"
                        />
                      </div>
                    )}

                    {/* TYPE 8: Long Essay answer (textarea, with autosave representation and character count!) */}
                    {activeQuestion.type === 'long_answer' && (
                      <div className="space-y-2 text-xs" id="rendered-longessay">
                        <div className="flex justify-between items-center">
                          <label htmlFor="long-answer-field" className="text-[10px] text-slate-400 block font-black">پاسخنامه تشریحی تفصیلی خود را شرح دهید:</label>
                          <span className="text-[10px] text-slate-405 font-bold">
                            تعداد کاراکترها: {toPersianDigits(String(studentAnswers[activeQuestion.id] || '').length)} حرف
                          </span>
                        </div>
                        <textarea
                          id="long-answer-field"
                          rows={6}
                          value={studentAnswers[activeQuestion.id] || ''}
                          onChange={(e) => handleTextAnswerChange(activeQuestion.id, e.target.value)}
                          placeholder="تحلیل استدلالی یا پاراگراف بررسی خود را به صورت شیوا قید فرمایید..."
                          className="w-full bg-slate-50 border border-slate-210 text-xs text-slate-850 p-3.5 rounded-2xl focus:outline-hidden focus:border-indigo-500 focus:bg-white font-extrabold leading-relaxed"
                        />
                      </div>
                    )}

                    {/* TYPE 9: Reading Comprehension and Cloze Sub-parts options rendering */}
                    {(activeQuestion.type === 'cloze' || activeQuestion.type === 'reading_comprehension') && activeQuestion.parts && (
                      <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl space-y-3" id="rendered-parts-group">
                        <span className="text-[10px] text-slate-400 font-extrabold block mb-1">زیرسوالات و بخش‌های تکمیلی:</span>
                        {activeQuestion.parts.map((part, pIdx) => {
                          const currentMap = studentAnswers[activeQuestion.id] || {};
                          const selectedOptId = currentMap[part.id] || '';

                          return (
                            <div key={part.id} className="p-3 bg-white rounded-xl border border-slate-200 space-y-3 text-xs">
                              <p className="font-extrabold text-slate-800">بخش {toPersianDigits(pIdx + 1)}: {part.text}</p>
                              {part.options && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                  {part.options.map(opt => {
                                    const checked = selectedOptId === opt.id;
                                    return (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => handleSubPartChange(activeQuestion.id, part.id, opt.id)}
                                        className={`p-2.5 rounded-lg border text-[11px] transition-all cursor-pointer ${
                                          checked
                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-805 font-black'
                                            : 'bg-slate-50 text-slate-550 border-slate-200 hover:bg-white hover:border-slate-350'
                                        }`}
                                      >
                                        {opt.text}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* TYPE 10: Image based visualizer (already processed with stem imageUrl) */}
                    {activeQuestion.type === 'image_based' && activeQuestion.options && (
                      <div className="space-y-2.5 mt-3" id="rendered-image-options">
                        {activeQuestion.options.map((opt) => {
                          const checked = studentAnswers[activeQuestion.id] === opt.id;
                          return (
                            <div
                              key={opt.id}
                              onClick={() => handleOptionSelect(activeQuestion.id, opt.id)}
                              className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all flex items-center gap-3 ${
                                checked
                                  ? 'bg-indigo-50 border-2 border-indigo-400 text-indigo-850 font-extrabold shadow-sm'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${checked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
                                {checked && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              </div>
                              <span>{opt.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>

                </div>

                {/* BOTTOM INTERACTIVE NAVIGATION BLOCK LIST */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-xs" id="interactive-actions-tray">
                  
                  {/* QUESTION FLAGGING TRIGGER */}
                  <button
                    type="button"
                    onClick={() => toggleFlagQuestion(activeQuestion.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      flaggedQuestions[activeQuestion.id]
                        ? 'bg-amber-100/80 hover:bg-amber-150 text-amber-800 border-amber-300 shadow-3xs'
                        : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <Flag className={`w-4 h-4 ${flaggedQuestions[activeQuestion.id] ? 'fill-current' : ''}`} />
                    <span>{flaggedQuestions[activeQuestion.id] ? 'نشاندار شده برای مرور مجدد' : 'علامت‌گذاری برای مرور'}</span>
                  </button>

                  <div className="flex gap-2.5">
                    {/* Previous Button constraint to allowBacktrack */}
                    {currentQuestionIdx > 0 && allowBacktrack && (
                      <button
                        type="button"
                        onClick={() => setCurrentQuestionIdx(currentQuestionIdx - 1)}
                        className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5"
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>سوال قبلی</span>
                      </button>
                    )}

                    {currentQuestionIdx < questionsCount - 1 ? (
                      <button
                        type="button"
                        onClick={() => setCurrentQuestionIdx(currentQuestionIdx + 1)}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5"
                      >
                        <span>ثبت و سوال بعدی</span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={triggerSubmitDialog}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5"
                      >
                        <span>ثبت و اتمام آزمون</span>
                        <CheckCircle2 className="w-4.5 h-4.5" />
                      </button>
                    )}
                  </div>

                </div>

              </div>

              {/* RIGHT SIDE FIXED DESKTOP INDEX PANEL */}
              <div className="hidden lg:block lg:col-span-3 space-y-5" id="desktop-side-index-panel">
                
                {/* Navigator Summary statistics card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
                  <h3 className="font-extrabold text-slate-800 text-xs border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>فهرست و کارنامه سوالات</span>
                  </h3>

                  {/* LEGEND KEYS SUMMARY LIST */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-bold border-b border-slate-50 pb-3">
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-100 border border-emerald-300 shrink-0" />
                      <span>پاسخ داده شده</span>
                    </div>
                    <div className="flex items-center gap-1 flex-row-reverse justify-end">
                      <span>بدون پاسخ</span>
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-100 border border-slate-300 shrink-0" />
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-100 border border-amber-300 shrink-0" />
                      <span>علامت‌گذاری شده</span>
                    </div>
                    <div className="flex items-center gap-1 flex-row-reverse justify-end text-indigo-700">
                      <span>سوال فعلی</span>
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-50 border-2 border-indigo-600" />
                    </div>
                  </div>

                  {/* GRID FOR NAV */}
                  <div className="grid grid-cols-4 gap-2 text-center text-xs font-black">
                    {activeExam.questions.map((q, idx) => {
                      const ans = checkIsQuestionAnswered(q.id, q.type);
                      const flg = !!flaggedQuestions[q.id];
                      const cur = idx === currentQuestionIdx;
                      
                      // Clicking is disabled if backtrack is forbidden unless we click on current
                      const isClickable = allowBacktrack || cur;

                      return (
                        <button
                          key={q.id}
                          type="button"
                          disabled={!isClickable}
                          onClick={() => setCurrentQuestionIdx(idx)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
                            cur 
                              ? 'bg-indigo-50 border-2 border-indigo-600 text-indigo-700 ring-2 ring-indigo-150'
                              : flg
                              ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-150'
                              : ans
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                          } ${!isClickable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        >
                          {toPersianDigits(idx + 1)}
                        </button>
                      );
                    })}
                  </div>

                  {/* BACKTRACK BLOCKED WARNING */}
                  {!allowBacktrack && (
                    <div className="text-[10px] bg-amber-50 rounded-xl p-2.5 text-amber-800 font-bold leading-normal border border-amber-150 flex gap-1 items-start">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>با تائید سوال، فیلدهای آزمون به صورت ترتیبی قفل میشود. امکان بازگشت نیست.</span>
                    </div>
                  )}

                  {/* FLOATING SUBMIT AT THE PANEL */}
                  <button
                    type="button"
                    onClick={triggerSubmitDialog}
                    className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-220 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-3xs"
                  >
                    <Send className="w-3.5 h-3.5 animate-pulse" />
                    <span>تحویل و پایان آزمون</span>
                  </button>

                </div>
              </div>

            </div>

          </div>
        )}

        {/* ==================== VIEW 4: SUBMISSION SUCCESS SCREEN ==================== */}
        {activeView === 'submitted' && loggedInStudent && activeExam && (
          (() => {
            // Calculation of Student Score & stats for auto-graded questions
            let correctAnswersCount = 0;
            let needsTeacherCorrectionCount = 0;
            let totalPoints = 0;
            let studentScore = 0;

            const answersToGrade = (currentSubmission && currentSubmission.answers && currentSubmission.answers.length > 0)
              ? (() => {
                  const rec: Record<string, any> = {};
                  currentSubmission.answers.forEach(item => {
                    rec[item.questionId] = item.answer;
                  });
                  return rec;
                })()
              : studentAnswers;

            if (activeExam.questions) {
              activeExam.questions.forEach((q) => {
                totalPoints += q.points;
                
                const isDescriptive = q.type === 'long_answer' || q.type === 'short_answer';
                if (isDescriptive) {
                  needsTeacherCorrectionCount++;
                }

                const ans = answersToGrade[q.id];
                if (ans === undefined || ans === null || ans === '') {
                  return;
                }

                if (q.type === 'single_choice' || q.type === 'true_false' || q.type === 'image_based') {
                  const isCorrectIdOrBool = q.correctAnswer !== undefined && 
                    (String(ans).toLowerCase() === String(q.correctAnswer).toLowerCase());
                  
                  const isCorrectOption = q.options?.find(opt => opt.id === ans)?.isCorrect;

                  if (isCorrectIdOrBool || isCorrectOption) {
                    correctAnswersCount++;
                    studentScore += q.points;
                  }
                } else if (q.type === 'multiple_choice') {
                  const correctOptionIds = q.options?.filter(opt => opt.isCorrect).map(opt => opt.id) || [];
                  const formattedCorrectAnswer = Array.isArray(q.correctAnswer) ? q.correctAnswer : correctOptionIds;

                  if (Array.isArray(ans) && ans.length === formattedCorrectAnswer.length) {
                    const allCorrect = ans.every(id => formattedCorrectAnswer.includes(id));
                    if (allCorrect) {
                      correctAnswersCount++;
                      studentScore += q.points;
                    }
                  }
                } else if (q.type === 'fill_blank') {
                  const correctBlanks = q.correctFillBlanks || (Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer]);
                  const firstBlankLower = String(correctBlanks[0] || '').trim().toLowerCase();
                  const ansLower = String(ans).trim().toLowerCase();
                  
                  if (ansLower === firstBlankLower) {
                    correctAnswersCount++;
                    studentScore += q.points;
                  }
                } else if (q.type === 'ordering') {
                  const correctOrder = q.orderingItems || (Array.isArray(q.correctAnswer) ? q.correctAnswer : []);
                  if (Array.isArray(ans) && ans.length === correctOrder.length) {
                    const allCorrect = ans.every((val, idx) => val === correctOrder[idx]);
                    if (allCorrect) {
                      correctAnswersCount++;
                      studentScore += q.points;
                    }
                  }
                } else if (q.type === 'matching') {
                  const matchingPairs = q.matchingPairs || [];
                  let allPairsMatched = true;
                  matchingPairs.forEach(pair => {
                    if (ans[pair.left] !== pair.right) {
                      allPairsMatched = false;
                    }
                  });
                  if (allPairsMatched && matchingPairs.length > 0) {
                    correctAnswersCount++;
                    studentScore += q.points;
                  }
                } else if (q.type === 'short_answer') {
                  if (q.correctAnswer) {
                    const isCorrect = String(ans).trim() === String(q.correctAnswer).trim();
                    if (isCorrect) {
                      correctAnswersCount++;
                      studentScore += q.points;
                    }
                  }
                }
              });
            }

            // Fallback for mock Tracking code
            const trackingCode = (currentSubmission?.id || `TRK-${activeExam.examCode}-${loggedInStudent.id}`).toUpperCase();

            // Settings determine results display
            const displayMode = activeExam.settings?.resultsDisplayMode || (activeExam.settings?.showImmediateResults ? 'immediate_score' : 'none');
            const showImmediate = displayMode === 'immediate_score' || displayMode === 'immediate_score_answers';
            const showPending = displayMode === 'after_approval';

            // Custom Submission time formatting
            const submissionTimeStr = currentSubmission?.submittedAt
              ? toPersianDigits(new Date(currentSubmission.submittedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
              : toPersianDigits(new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 md:p-8 text-center space-y-6 max-w-lg mx-auto my-8 text-right"
                id="student-exam-submitted-receipt"
              >
                {/* Reassuring green Check circle with animation */}
                <div className="relative flex items-center justify-center mx-auto w-20 h-20 mb-2">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                    className="absolute inset-0 rounded-full bg-emerald-50 border border-emerald-150 shadow-xs"
                  />
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 250 }}
                  >
                    <Check className="w-10 h-10 text-emerald-600 stroke-[3]" />
                  </motion.div>
                </div>

                <div className="space-y-1.5 text-center">
                  <h1 className="text-base md:text-lg font-black text-emerald-700">پاسخ شما با موفقیت ثبت شد.</h1>
                  <p className="text-[11px] text-slate-400 font-bold">پاسخ‌برگ الکترونیکی شما با موفقیت تحویل داده شد و در سوابق سامانه ذخیره گردید.</p>
                </div>

                {/* Patient / Calm feedback summary metadata list */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-right text-xs text-slate-650 space-y-2.5 font-semibold shadow-xs">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-slate-400 font-bold">داوطلب آزمون:</span>
                    <span className="text-slate-800 font-extrabold">{loggedInStudent.name}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-slate-400 font-bold">عنوان آزمون آزمایشی/رسمی:</span>
                    <span className="text-slate-800 font-extrabold">{activeExam.title}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-slate-400 font-bold">زمان تحویل برگه:</span>
                    <span className="text-slate-800 font-mono tracking-wider font-extrabold">{submissionTimeStr}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold">کد رهگیری ثبت پاسخ‌برگ:</span>
                    <span className="text-indigo-600 font-mono tracking-wider font-black select-all">{trackingCode}</span>
                  </div>
                </div>

                {/* Dynamic Conditional Exam Result Blocks based on mode */}
                <div className="pt-2">
                  {showImmediate ? (
                    <div className="bg-indigo-50/50 border border-indigo-150 rounded-2xl p-4 text-right space-y-3 shadow-3xs" id="result-immediate-avail">
                      <h3 className="text-xs font-black text-indigo-900 flex items-center gap-1.5 border-b border-indigo-100 pb-2">
                        <Award className="w-4.5 h-4.5 text-indigo-600" />
                        <span>نتایج و کارنامه اولیه آزمون شما:</span>
                      </h3>
                      <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-extrabold text-slate-700">
                        <div className="bg-white border rounded-xl p-2.5">
                          <span className="text-[9px] text-slate-400 block mb-1">نمره شما</span>
                          <span className="text-indigo-700 text-sm font-black">{toPersianDigits(studentScore)} <span className="text-[9px] text-slate-400 font-bold">از {toPersianDigits(totalPoints)}</span></span>
                        </div>
                        <div className="bg-white border rounded-xl p-2.5">
                          <span className="text-[9px] text-slate-400 block mb-1">پاسخ‌های صحیح</span>
                          <span className="text-emerald-700 text-sm font-black">{toPersianDigits(correctAnswersCount)}</span>
                        </div>
                        <div className="bg-white border rounded-xl p-2.5">
                          <span className="text-[9px] text-slate-400 block mb-1">نیازمند تصحیح</span>
                          <span className="text-amber-600 text-sm font-black">{toPersianDigits(needsTeacherCorrectionCount)}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-bold border-t border-indigo-100/50 pt-2 flex items-start gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                        <span>توجه: پاسخ‌های تشریحی/کوتاه پس از بررسی و تصحیح دستی توسط معلم ممکن است نمره نهایی را تغییر دهند.</span>
                      </p>
                    </div>
                  ) : showPending ? (
                    <div className="bg-amber-50/40 border border-amber-150 text-amber-900 rounded-2xl p-4 text-center py-5 space-y-1" id="result-pending-review">
                      <RefreshCw className="w-6 h-6 text-amber-600 mx-auto animate-spin mb-1" />
                      <span className="text-xs font-black block">نتیجه آزمون پس از بررسی معلم اعلام خواهد شد.</span>
                      <p className="text-[10.5px] text-amber-700 font-bold">پاسخ‌برگ‌ها جهت تصحیح دستی سوالات هم‌اکنون به کارتابل معلم ارسال شده‌اند.</p>
                    </div>
                  ) : (
                    <div className="bg-slate-100/60 border border-slate-205 text-slate-700 rounded-2xl p-4 text-center py-5 space-y-1" id="result-no-display">
                      <Lock className="w-5 h-5 text-slate-500 mx-auto mb-1" />
                      <span className="text-xs font-black block">نتیجه این آزمون توسط معلم اعلام خواهد شد.</span>
                      <p className="text-[10.5px] text-slate-400 font-bold">بنابر تنظیمات اعمال شده توسط طراح، کارنامه‌ها به صورت کلی پس از اتمام مهلت آزمون منتشر می‌گردد.</p>
                    </div>
                  )}
                </div>

                {/* Substantive calming instructions with return action button */}
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={handleExitToPortal}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    id="btn-return-to-main"
                  >
                    <span>بازگشت به صفحه اصلی آزمون</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })()
        )}

      </main>

      {/* ==================== 3. ABSOLUTE CONFIRMATION SUBMIT DIALOG MODAL ==================== */}
      <AnimatePresence>
        {isConfirmSubmitOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none" dir="rtl" id="modal-submit-confirmation">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 space-y-5 shadow-2xl text-right"
            >
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-slate-800">تأیید نهایی و ارسال برگه آزمون</h3>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-extrabold text-slate-650 leading-relaxed">
                  آیا اطمینان دارید که مایل به ثبت نهایی و تحویل برگه آزمون خود هستید؟ پس از تحویل، دسترسی شما خاتمه یافته و پاسخ‌برگ برای تصحیح برای معلم ارسال می‌گردد.
                </p>

                {/* Question Status Grid */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-150 text-xs font-bold text-slate-600">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block">سوالات پاسخ داده شده:</span>
                    <span className="text-emerald-700 font-black text-sm">{toPersianDigits(totalAnsweredCount)}</span>
                  </div>
                  <div className="space-y-0.5 border-r border-slate-200 pr-3">
                    <span className="text-[10px] text-slate-400 block">سوالات بدون پاسخ:</span>
                    <span className={totalUnansweredCount > 0 ? "text-amber-600 font-black text-sm" : "text-slate-700 text-sm"}>
                      {toPersianDigits(totalUnansweredCount)}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-red-50/50 border border-red-150 rounded-xl text-[11px] text-rose-800 leading-relaxed font-semibold">
                  <strong>توجه:</strong> پس از ارسال، تصحیح خودکار انجام شده و امکان ویرایش یا بازیابی پاسخ‌ها برای دانش‌آموز غیرفعال خواهد شد.
                </div>
              </div>

              {/* Action Buttons inside Modal */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmSubmitOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border transition-colors cursor-pointer"
                >
                  انصراف و بازگشت به آزمون
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmSubmitOpen(false);
                    handleAutoSubmit();
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>تأیید و ارسال نهایی</span>
                  <Check className="w-4 h-4" />
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== 4. MOBILE PERSISTENT INDEX BOTTOM DRAWER ==================== */}
      <AnimatePresence>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-xs sm:hidden" dir="rtl" id="mobile-navigation-drawer-backdrop">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-3xl max-w-md w-full p-5 space-y-4 shadow-2xl text-right max-h-[70vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>بروشور سوالات برگه</span>
                </h3>
                <button onClick={() => setMobileNavOpen(false)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2 text-center text-xs font-black py-2">
                {activeExam.questions.map((q, idx) => {
                  const ans = checkIsQuestionAnswered(q.id, q.type);
                  const flg = !!flaggedQuestions[q.id];
                  const cur = idx === currentQuestionIdx;
                  
                  const isClickable = allowBacktrack || cur;

                  return (
                    <button
                      key={q.id}
                      disabled={!isClickable}
                      onClick={() => {
                        setCurrentQuestionIdx(idx);
                        setMobileNavOpen(false);
                      }}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                        cur 
                          ? 'bg-indigo-50 border-2 border-indigo-600 text-indigo-700'
                          : flg
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : ans
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      } ${!isClickable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                    >
                      {toPersianDigits(idx + 1)}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  triggerSubmitDialog();
                }}
                className="w-full py-3 bg-rose-600 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>تحویل و پایان آزمون برخط</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      {activeView !== 'take' && (
        <footer className="max-w-4xl w-full mx-auto text-center text-[10px] text-slate-400 border-t border-slate-200 py-4 px-4 select-none" id="exam-footer">
          امتحانات سراسری مدارس و مراکز آموزش عالی کشور | کلیه حقوق و امتیازات این پرتال محفوظ است.
        </footer>
      )}

    </div>
  );
}
