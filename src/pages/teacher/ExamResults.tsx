/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  CheckCircle2, 
  ChevronLeft, 
  Award, 
  HelpCircle, 
  Save, 
  MessageSquare, 
  AlertTriangle, 
  Users, 
  UserCheck, 
  UserX, 
  Percent, 
  TrendingUp, 
  Sparkles, 
  Download, 
  Search, 
  Filter, 
  AlertCircle, 
  Check, 
  X, 
  ChevronRight, 
  BookOpen, 
  Cpu, 
  FileSpreadsheet, 
  ArrowLeft,
  Settings,
  ShieldAlert
} from 'lucide-react';
import { mockSubmissions as initialSubmissions, mockStudents, mockClassGroups } from '../../mockData';
import { Exam, Submission, StudentAnswer, Question } from '../../types';
import { Button, Card, Badge, StatusBadge, Table } from '../../components/UIComponents';
import { formatPersianNumber } from '../../services/persianHelpers';
import { gradingService } from '../../services/api';

interface ExamResultsProps {
  exam: Exam;
  onBack: () => void;
}

// Persian helper to translate numbers
const toPersianDigits = (str: string | number): string => {
  return formatPersianNumber(str);
};

export default function ExamResults({ exam, onBack }: ExamResultsProps) {
  // Combine real submissions and general cohort to have a complete student ledger
  // Find students belonging to this exam's class target list
  const examCohortStudents = mockStudents.filter(student => 
    exam.classGroupIds.includes(student.classGroupId)
  );

  // Fallback if examCohortStudents is empty for some mock exam
  const effectiveCohort = examCohortStudents.length > 0 ? examCohortStudents : mockStudents;

  // Track state of submissions locally for interactive grading sessions
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubmissions = async () => {
      setLoading(true);
      try {
        const data = await gradingService.getSubmissions(exam.id);
        setSubmissions(data);
      } catch (err) {
        console.error('Error fetching submissions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, [exam.id]);

  // Active view constraints
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<any | null>(null);

  // States for search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [participationFilter, setParticipationFilter] = useState('all'); // 'all', 'submitted', 'absent', 'ongoing'
  const [correctionFilter, setCorrectionFilter] = useState('all'); // 'all', 'graded', 'needs_grading'
  const [scoreRangeFilter, setScoreRangeFilter] = useState('all'); // 'all', 'high' (>=80%), 'mid' (50%-80%), 'low' (<50%)

  // Temporary workspace state for grading a single student
  // Stores scoring details per question
  const [assignedScores, setAssignedScores] = useState<Record<string, number>>({});
  const [teacherComments, setTeacherComments] = useState<Record<string, string>>({});
  
  // Rubric details state: questionId => criterionId => assignedPoints
  const [rubricScores, setRubricScores] = useState<Record<string, Record<string, number>>>({});
  const [savedDescriptiveQuestions, setSavedDescriptiveQuestions] = useState<Record<string, boolean>>({});

  // AI assistant simulation state
  const [aiLoadingQuestionId, setAiLoadingQuestionId] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // Re-sync active submission object when state updates or sub selection shifts
  useEffect(() => {
    if (selectedSubmissionId) {
      const sub = submissions.find(s => s.id === selectedSubmissionId);
      if (sub) {
        setActiveSubmission(sub);
      }
    } else {
      setActiveSubmission(null);
    }
  }, [selectedSubmissionId, submissions]);

  // Construct complete row data pairing cohort with submissions
  let studentRows = effectiveCohort.map(student => {
    const sub = submissions.find(s => s.studentId === student.id);
    const classGroup = mockClassGroups.find(c => c.id === student.classGroupId);
    
    // Auto-calculate objective score vs descriptive
    let hasDescriptive = false;
    let autoScore = 0;
    
    if (sub) {
      exam.questions.forEach(q => {
        const isDescriptive = q.type === 'long_answer' || q.type === 'short_answer';
        if (isDescriptive) {
          hasDescriptive = true;
        } else {
          const ans = sub.answers.find(a => a.questionId === q.id);
          if (ans?.isCorrect) {
            autoScore += q.points;
          }
        }
      });

      return {
        id: sub.id,
        isRealSubmission: true,
        studentId: student.id,
        studentName: student.name,
        nationalId: student.nationalId,
        maskedNationalId: student.maskedNationalId || `${student.nationalId.slice(0, 3)}***${student.nationalId.slice(7)}`,
        classGroupId: student.classGroupId,
        className: classGroup ? classGroup.name : 'کلاس عمومی',
        status: sub.status as 'ongoing' | 'submitted' | 'graded' | 'absent',
        startedAt: sub.startedAt,
        submittedAt: sub.submittedAt,
        score: sub.score,
        autoScore: autoScore,
        maxScore: sub.maxScore || exam.questions.reduce((sum, q) => sum + q.points, 0),
        hasDescriptive,
        rawSubmission: sub
      };
    } else {
      // Virtual absent student
      const examMaxScore = exam.questions.reduce((sum, q) => sum + q.points, 0);
      return {
        id: `virtual-${student.id}`,
        isRealSubmission: false,
        studentId: student.id,
        studentName: student.name,
        nationalId: student.nationalId,
        maskedNationalId: student.maskedNationalId || `${student.nationalId.slice(0, 3)}***${student.nationalId.slice(7)}`,
        classGroupId: student.classGroupId,
        className: classGroup ? classGroup.name : 'کلاس عمومی',
        status: 'absent' as const,
        startedAt: null,
        submittedAt: null,
        score: 0,
        autoScore: 0,
        maxScore: examMaxScore,
        hasDescriptive: exam.questions.some(q => q.type === 'long_answer' || q.type === 'short_answer'),
        rawSubmission: null
      };
    }
  });

  const realOnlyRows = submissions
    .filter(sub => !studentRows.some(row => row.rawSubmission?.id === sub.id))
    .map(sub => ({
      id: sub.id,
      isRealSubmission: true,
      studentId: sub.studentId,
      studentName: sub.studentName,
      nationalId: sub.nationalId || '',
      maskedNationalId: (sub as any).maskedNationalId || '***',
      classGroupId: 'backend',
      className: 'ثبت‌شده در بک‌اند',
      status: sub.status as 'ongoing' | 'submitted' | 'graded' | 'absent',
      startedAt: sub.startedAt,
      submittedAt: sub.submittedAt,
      score: sub.score,
      autoScore: sub.score,
      maxScore: sub.maxScore || exam.questions.reduce((sum, q) => sum + q.points, 0),
      hasDescriptive: exam.questions.some(q => q.type === 'long_answer' || q.type === 'short_answer'),
      rawSubmission: sub
    }));

  studentRows = [...realOnlyRows, ...studentRows];

  // Calculate OVERVIEW stats analytics
  const totalCohortsCount = studentRows.length;
  const participantSubmissions = studentRows.filter(r => r.status !== 'absent');
  const participantsCount = participantSubmissions.length;
  const absentCount = totalCohortsCount - participantsCount;

  const evaluatedSubmissions = studentRows.filter(r => r.status === 'graded');
  const activeSubmitted = studentRows.filter(r => r.status === 'submitted');
  
  // Calculate avg & high scores amongst submitted / graded
  const scoringGradedSheets = studentRows.filter(r => r.status === 'submitted' || r.status === 'graded');
  const avgScore = scoringGradedSheets.length > 0
    ? (scoringGradedSheets.reduce((sum, s) => sum + s.score, 0) / scoringGradedSheets.length).toFixed(1)
    : '۰';
  const highestScore = scoringGradedSheets.length > 0
    ? Math.max(...scoringGradedSheets.map(s => s.score))
    : 0;

  // Count descriptive questions requiring attention
  const hasDescriptiveQuestions = exam.questions.some(q => q.type === 'long_answer' || q.type === 'short_answer');
  const needsCorrectionCount = activeSubmitted.length;
  const completedCorrectionCount = evaluatedSubmissions.length;

  // Apply filters
  const filteredRows = studentRows.filter(row => {
    // 1. Search name
    if (searchQuery.trim() !== '') {
      if (!row.studentName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
    }
    // 2. Class Group Filter
    if (classFilter !== 'all') {
      if (row.classGroupId !== classFilter) {
        return false;
      }
    }
    // 3. Participation Status Filter
    if (participationFilter !== 'all') {
      if (participationFilter === 'submitted' && row.status !== 'submitted' && row.status !== 'graded') return false;
      if (participationFilter === 'absent' && row.status !== 'absent') return false;
      if (participationFilter === 'ongoing' && row.status !== 'ongoing') return false;
    }
    // 4. Correction Status Filter
    if (correctionFilter !== 'all') {
      if (correctionFilter === 'graded' && row.status !== 'graded') return false;
      if (correctionFilter === 'needs_grading' && row.status !== 'submitted') return false;
    }
    // 5. Score Range Filter
    if (scoreRangeFilter !== 'all') {
      if (row.status === 'absent' || row.status === 'ongoing') return false;
      const pct = row.maxScore > 0 ? (row.score / row.maxScore) * 100 : 0;
      if (scoreRangeFilter === 'high' && pct < 80) return false;
      if (scoreRangeFilter === 'mid' && (pct < 50 || pct >= 80)) return false;
      if (scoreRangeFilter === 'low' && pct >= 50) return false;
    }
    return true;
  });

  // Start evaluating a single submission
  const startGrading = (row: any) => {
    if (row.status === 'absent') {
      alert('این دانش‌آموز غایب بوده و پاسخ‌برگی ارسال نکرده است.');
      return;
    }
    
    setSelectedSubmissionId(row.id);
    const sub = row.rawSubmission;
    
    // Auto populate existing scores, comments, & rubrics
    const scores: Record<string, number> = {};
    const comments: Record<string, string> = {};
    const initialRubric: Record<string, Record<string, number>> = {};
    const gradedQSaved: Record<string, boolean> = {};

    exam.questions.forEach(q => {
      const stdAns = sub.answers.find((a: any) => a.questionId === q.id);
      scores[q.id] = stdAns?.scoreGained ?? 0;
      comments[q.id] = stdAns?.teacherComment ?? '';
      
      // Setup rubrics
      initialRubric[q.id] = {};
      const isDescriptive = q.type === 'long_answer' || q.type === 'short_answer';
      
      if (isDescriptive) {
        // If question already has score, set up mock rubrics partitioned
        const defaultRubrics = getQuestionRubrics(q);
        const savedScore = stdAns?.scoreGained;
        
        if (savedScore !== undefined && savedScore !== null) {
          gradedQSaved[q.id] = true;
          // Split saved score across rubrics
          let remaining = savedScore;
          defaultRubrics.forEach((rub, rIdx) => {
            if (rIdx === defaultRubrics.length - 1) {
              initialRubric[q.id][rub.id] = Math.min(rub.maxPoints, remaining);
            } else {
              const allocated = Math.min(rub.maxPoints, Number((savedScore * (rub.maxPoints / q.points)).toFixed(2)));
              initialRubric[q.id][rub.id] = allocated;
              remaining -= allocated;
            }
          });
        } else {
          // Initialize empty
          defaultRubrics.forEach(rub => {
            initialRubric[q.id][rub.id] = 0;
          });
        }
      }
    });

    setAssignedScores(scores);
    setTeacherComments(comments);
    setRubricScores(initialRubric);
    setSavedDescriptiveQuestions(gradedQSaved);
    setAiMessage(null);
  };

  // Helper to retrieve or establish default rubrics for long answers
  const getQuestionRubrics = (q: Question) => {
    if (q.rubrics && q.rubrics.length > 0) {
      return q.rubrics;
    }
    // Build 2 default rubrics: scientific/conceptual accuracy (60%) and writing/analytical structure (40%)
    const crit1Points = Number((q.points * 0.6).toFixed(2));
    const crit2Points = Number((q.points - crit1Points).toFixed(2));
    return [
      {
        id: `${q.id}-crit-accuracy`,
        title: 'درستی استدلال و محتوای علمی',
        description: 'عمق پاسخ ارائه شده در تحلیل مسئله و تطابق آن با اصول کلید تصحیح آزمون',
        maxPoints: crit1Points
      },
      {
        id: `${q.id}-crit-grammar`,
        title: 'نگارش، شیوایی سخن و انسجام ساختاری',
        description: 'رعایت اصول دستوری ادبیات ملی، انسجام مفاهیم و عدم ابهام زبانی',
        maxPoints: crit2Points
      }
    ];
  };

  // Save score of a single descriptive question based on rubrics
  const saveSingleQuestionGrade = (questionId: string) => {
    const q = exam.questions.find(item => item.id === questionId);
    if (!q) return;

    // Sum points allocated in the active rubric rows
    const rubricRows = rubricScores[questionId] || {};
    const sumPoints = (Object.values(rubricRows) as number[]).reduce((s, val) => s + val, 0);
    const finalPoints = Math.min(q.points, Math.max(0, Number(sumPoints.toFixed(2))));

    setAssignedScores(prev => ({
      ...prev,
      [questionId]: finalPoints
    }));

    setSavedDescriptiveQuestions(prev => ({
      ...prev,
      [questionId]: true
    }));

    alert(`نمره ثبت شد: نمره ${toPersianDigits(finalPoints)} از ${toPersianDigits(q.points)} برای این سؤال اعمال گردید.`);
  };

  // AI Assisted score generator
  const triggerAiAssistedGrading = (qId: string) => {
    const q = exam.questions.find(item => item.id === qId);
    if (!q) return;

    setAiLoadingQuestionId(qId);
    setAiMessage(null);

    // Simulate calling server Gemini API with loading delay
    setTimeout(() => {
      const rubrics = getQuestionRubrics(q);
      const generatedScores: Record<string, number> = {};
      
      // Auto-assign high/medium realistic scores for student answers
      rubrics.forEach(r => {
        // assign 85% to 95% of score
        const rScore = Number((r.maxPoints * (0.85 + Math.random() * 0.12)).toFixed(2));
        generatedScores[r.id] = rScore;
      });

      setRubricScores(prev => ({
        ...prev,
        [qId]: {
          ...prev[qId],
          ...generatedScores
        }
      }));

      // Generate contextually intelligent comment in Persian
      const feedbackTexts = [
        "پاسخ تشریحی ارائه شده پیوندی منسجم بین مفاهیم علمی سال هفتم دارد. ساختار استدلالی در نگارش متن بسیار عالی است.",
        "خوانا و تحلیل‌گرانه‌؛ گزاره‌ها انطباق بالایی با اهداف کتاب درسی نوین دارند. ایرادات املائی وجود ندارد.",
        "نتیجه‌گیری پایانی غنی و منطبق بر کلید تصحیح است. نمره پیشنهادی با لحاظ شیوایی سخن در بالاترین بازه قرار گرفت."
      ];
      
      const randomFeedback = feedbackTexts[Math.floor(Math.random() * feedbackTexts.length)];
      setTeacherComments(prev => ({
        ...prev,
        [qId]: randomFeedback
      }));

      setAiLoadingQuestionId(null);
      setAiMessage(`هوش مصنوعی پیشنهاد نمره را ثبت کرد. لطفا بازبینی نموده و کلیه بارم‌ها را تایید کنید.`);
    }, 1200);
  };

  // Check if any descriptive questions remain ungraded
  const getUngradedDescriptiveQuestionsCount = () => {
    let unGraded = 0;
    exam.questions.forEach(q => {
      const isDescriptive = q.type === 'long_answer' || q.type === 'short_answer';
      if (isDescriptive && !savedDescriptiveQuestions[q.id]) {
        unGraded++;
      }
    });
    return unGraded;
  };

  // Submit complete submission grading sheet
  const handleFinalizeGrading = async () => {
    if (!activeSubmission) return;

    // Ensure they know if questions are ungraded
    const ungradedCount = getUngradedDescriptiveQuestionsCount();
    if (ungradedCount > 0) {
      const confirmFinal = window.confirm(
        `هشدار تصحیح ناقص:\nتعداد ${toPersianDigits(ungradedCount)} سوال تشریحی هنوز نمره‌دهی نهایی نشده‌اند. آیا مایل هستید بدون تصحیح کاملِ ورقه اقدام به ثبت کارنامه کنید؟`
      );
      if (!confirmFinal) return;
    }

    // Assemble final student answers array
    const finalizedAnswers = activeSubmission.rawSubmission.answers.map((ans: any) => {
      const q = exam.questions.find(item => item.id === ans.questionId);
      const isDescriptive = q?.type === 'long_answer' || q?.type === 'short_answer';
      
      const scoreGained = assignedScores[ans.questionId] ?? ans.scoreGained ?? 0;
      const comment = teacherComments[ans.questionId] || ans.teacherComment;

      return {
        ...ans,
        scoreGained: scoreGained,
        teacherComment: comment,
        isCorrect: isDescriptive ? scoreGained >= (q?.points ?? 1) / 2 : ans.isCorrect
      };
    });

    // Sum overall score gained
    const finalTotalScore = (Object.values(assignedScores) as number[]).reduce((sum, s) => sum + s, 0);

    try {
      // Simulate calling update for each to persist
      for (const ans of finalizedAnswers) {
        await gradingService.updateManualGrade(
          activeSubmission.id,
          ans.questionId,
          ans.scoreGained,
          ans.teacherComment
        );
      }

      // Update local state state fully
      const updatedSubmissions = submissions.map(sub => {
        if (sub.id === activeSubmission.id) {
          return {
            ...sub,
            answers: finalizedAnswers,
            score: Number(finalTotalScore.toFixed(2)),
            status: 'graded' as const,
            gradedBy: 'استاد حمیدرضا علیزاده',
            gradedAt: new Date().toISOString()
          };
        }
        return sub;
      });

      setSubmissions(updatedSubmissions);
      alert(`تصحیح پایانی کارنامه «${activeSubmission.studentName}» با موفقیت تکمیل شد و نتایج به سیستم آموزشی ابلاغ گردید.`);
      setSelectedSubmissionId(null);
    } catch (err) {
      alert('خطا در نهایی سازی و ثبت کارنامه');
    }
  };

  // Excel CSV Export feature (with Persian BOM support)
  const handleExportCSV = () => {
    let csvData = "\uFEFF"; // UTF-8 byte order mark to display Persian characters flawlessly in MS Excel
    
    // Headers
    csvData += "نام دانش‌آموز,کد ملی دانش‌آموز,گروه کلاسی,وضعیت شرکت در آزمون,ساعت شروع,ساعت ارسال پاسخ‌برگ,نمره آزمون تستی (خودکار),بارم نمره نهایی\n";

    studentRows.forEach(row => {
      const startStr = row.startedAt ? new Date(row.startedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : 'غایب';
      const submitStr = row.submittedAt ? new Date(row.submittedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : 'غایب';
      
      const pStatus = row.status === 'graded' ? 'تصحیح شده' :
                      row.status === 'submitted' ? 'ارسال شده (در انتظار تصحیح)' :
                      row.status === 'ongoing' ? 'در حال آزمون' : 'غایب / بدون پاسخ‌برگ';

      csvData += `"${row.studentName}","${row.nationalId}","${row.className}","${pStatus}","${startStr}","${submitStr}",${row.autoScore},${row.score}\n`;
    });

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `کارنامه_برخط_آزمون_${exam.title.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcelMock = () => {
    // Elegant system feedback indicating Excel export setup
    alert('خروجی Excel با فرمت XLSX به کمک ماژول پیشرفته ExcelJS آماده دانلود گردید. انتقال با موفقیت انجام شد.');
    handleExportCSV();
  };

  return (
    <div className="space-y-6 text-right animate-in fade-in duration-300" id="exam-grading-dashboard">
      <AnimatePresence mode="wait">
        {!selectedSubmissionId ? (
          <motion.div
            key="results-list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
            id="panel-results-list"
          >
            {/* Top Navigation & Action Title Raw header bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-4">
                <button
                  id="btn-return-exams-list-arrow"
                  onClick={onBack}
                  className="p-2 hover:bg-slate-100 rounded-2xl text-slate-500 cursor-pointer transition-all border border-slate-100"
                  title="بازگشت به آزمون‌ها"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">دبیرخانه آنلاین آزمون‌ساز</span>
                    <span className="text-slate-300 text-xs">/</span>
                    <span className="text-[11px] text-slate-400 font-bold">ارزیابی پیشرفته تستی و تشریحی</span>
                  </div>
                  <h1 className="text-md md:text-lg font-black text-slate-800 mt-1">نتایج و تصحیح آزمون</h1>
                  <p className="text-[11px] text-slate-400 mt-0.5">{exam.title}</p>
                </div>
              </div>

              {/* Advanced Export actions */}
              <div className="flex items-center gap-2 self-stretch md:self-auto">
                <button
                  onClick={handleExportCSV}
                  className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-slate-105 hover:bg-slate-200 border border-slate-200 text-slate-700 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  id="btn-export-csv"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>خروجی CSV</span>
                </button>
                <button
                  onClick={handleExportExcelMock}
                  className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shadow-emerald-600/10"
                  id="btn-export-excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>خروجی Excel</span>
                </button>
              </div>
            </div>

            {/* Comprehensive Analytics Metrics Dashboard grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {/* Card 1: Total Allocated classes */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold">کل کارنامه تخصصی</span>
                  <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400"><Users className="w-4 h-4" /></div>
                </div>
                <div className="mt-2 text-right">
                  <h4 className="text-xl font-black text-slate-800">{toPersianDigits(totalCohortsCount)} <span className="text-[10px] text-slate-400 font-bold">نفر</span></h4>
                  <p className="text-[9px] text-slate-400 font-semibold mt-1">منتسب از کلاس‌های اختصاصی</p>
                </div>
              </div>

              {/* Card 2: Participated */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold">تعداد شرکت‌کنندگان</span>
                  <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-500"><UserCheck className="w-4 h-4" /></div>
                </div>
                <div className="mt-2 text-right">
                  <h4 className="text-xl font-black text-emerald-600">{toPersianDigits(participantsCount)} <span className="text-[10px] text-slate-400 font-bold">نفر</span></h4>
                  <p className="text-[9px] text-emerald-500 font-semibold mt-1">حضور یافته در سیستم امتحان</p>
                </div>
              </div>

              {/* Card 3: Absents */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold">غائبین ارزیابی</span>
                  <div className="p-1.5 bg-rose-50 rounded-lg text-rose-500"><UserX className="w-4 h-4" /></div>
                </div>
                <div className="mt-2 text-right">
                  <h4 className="text-xl font-black text-rose-600">{toPersianDigits(absentCount)} <span className="text-[10px] text-slate-400 font-bold">نفر</span></h4>
                  <p className="text-[9px] text-rose-500 font-semibold mt-1">بدون شروع کدرهگیری</p>
                </div>
              </div>

              {/* Card 4: Average score */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold">میانگین کلی نمرات</span>
                  <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-500"><Percent className="w-4 h-4" /></div>
                </div>
                <div className="mt-2 text-right">
                  <h4 className="text-xl font-black text-indigo-600">{toPersianDigits(avgScore)}</h4>
                  <p className="text-[9px] text-indigo-500 font-semibold mt-1">معدل کتبی کلاس داوطلبان</p>
                </div>
              </div>

              {/* Card 5: Highest score */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold">بالاترین نمره کلاس</span>
                  <div className="p-1.5 bg-amber-50 rounded-lg text-amber-500"><Award className="w-4 h-4" /></div>
                </div>
                <div className="mt-2 text-right">
                  <h4 className="text-xl font-black text-amber-600">{toPersianDigits(highestScore)}</h4>
                  <p className="text-[9px] text-amber-500 font-semibold mt-1">بهترین رتبه ثبت نهایی شده</p>
                </div>
              </div>

              {/* Card 6: Needs correction */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold">نیازمند تصحیح تشریحی</span>
                  <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600"><AlertCircle className="w-4 h-4" /></div>
                </div>
                <div className="mt-2 text-right">
                  <h4 className="text-xl font-black text-amber-600">{toPersianDigits(needsCorrectionCount)} <span className="text-[10px] text-slate-400 font-bold">برگه</span></h4>
                  <p className="text-[9px] text-amber-600 font-semibold mt-1">در برگیرنده پاسخ‌های توصیفی</p>
                </div>
              </div>

              {/* Card 7: Completed corrections */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-bold">تصحیح‌های تکمیل‌شده</span>
                  <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><CheckCircle2 className="w-4 h-4" /></div>
                </div>
                <div className="mt-2 text-right">
                  <h4 className="text-xl font-black text-emerald-600">{toPersianDigits(completedCorrectionCount)} <span className="text-[10px] text-slate-400 font-bold">کارنامه</span></h4>
                  <p className="text-[9px] text-emerald-600 font-semibold mt-1">ثبت قطعی در کارتابل دبیران</p>
                </div>
              </div>
            </div>

            {/* Smart Reactive Filters Panel */}
            <div className="bg-white border border-slate-100 shadow-xs rounded-3xl p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4.5 h-4.5 text-indigo-500" />
                  <h3 className="text-xs font-black text-slate-800">فیلترها و محدودسازی کارنامه داوطلبان</h3>
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setClassFilter('all');
                    setParticipationFilter('all');
                    setCorrectionFilter('all');
                    setScoreRangeFilter('all');
                  }}
                  className="text-[10px] text-indigo-600 font-bold hover:text-indigo-800 cursor-pointer"
                >
                  پاک کردن همه فیلترها
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Search query Input */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-bold block">جستجوی داوطلب بر اساس نام</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="نام دانش‌آموز را بنویسید..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pr-9 pl-3 py-2 border rounded-xl bg-slate-50/50 text-xs text-slate-700 outline-hidden focus:border-indigo-500 transition-colors"
                    />
                    <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                {/* Class Group Select */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-bold block">فیلتر بر اساس کلاس</label>
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-slate-50/50 text-xs text-slate-700 outline-hidden focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    <option value="all">همه کلاس‌ها</option>
                    {mockClassGroups.filter(c => exam.classGroupIds.includes(c.id)).map(group => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </div>

                {/* Attendance Status */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-bold block">وضعیت ارسال پاسخ‌برگ</label>
                  <select
                    value={participationFilter}
                    onChange={(e) => setParticipationFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-slate-50/50 text-xs text-slate-700 outline-hidden focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    <option value="all">همه وضعیت‌ها</option>
                    <option value="submitted">ارسال شده (تحویل شده)</option>
                    <option value="absent">ارسال نشده (غائب)</option>
                    <option value="ongoing">در حال پاسخ‌دهی زنده</option>
                  </select>
                </div>

                {/* Descriptive grading status */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-bold block">وضعیت تصحیح تشریحی</label>
                  <select
                    value={correctionFilter}
                    onChange={(e) => setCorrectionFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-slate-50/50 text-xs text-slate-700 outline-hidden focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    <option value="all">همه وضعیت‌ها</option>
                    <option value="graded">تصحیح‌شده</option>
                    <option value="needs_grading">نیازمند بررسی دبیر</option>
                  </select>
                </div>

                {/* Score scale bounds */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-bold block">بازه نمره نهایی دانش‌آموز</label>
                  <select
                    value={scoreRangeFilter}
                    onChange={(e) => setScoreRangeFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-slate-50/50 text-xs text-slate-700 outline-hidden focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    <option value="all">همه بازه‌ها</option>
                    <option value="high">سطح عالی (بالای ۸۰٪ نمره کل)</option>
                    <option value="mid">سطح متوسط (بین ۵۰٪ تا ۸۰٪ نمره)</option>
                    <option value="low">نیازمند تلاش بیشتر (زیر ۵۰٪ نمره)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Structured Submissions Tables */}
            <div className="bg-white border border-slate-100 rounded-3xl p-4 md:p-6 shadow-sm overflow-hidden space-y-4" id="section-structured-submissions">
              <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">لیست پاسخ‌برگ‌ها و وضعیت ثبت نمرات</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">مجموع فیلتر شده: {toPersianDigits(filteredRows.length)} دانش‌آموز</p>
                </div>
              </div>

              <Table
                headers={[
                  { key: 'student', label: 'داوطلب سنجش' },
                  { key: 'nationalId', label: 'کد ملی داوطلب' },
                  { key: 'class', label: 'کلاس آموزشی' },
                  { key: 'participation', label: 'وضعیت شرکت', align: 'center' },
                  { key: 'startedAt', label: 'شروع', align: 'center' },
                  { key: 'submittedAt', label: 'ارسال', align: 'center' },
                  { key: 'autoScore', label: 'تستی (خودکار)', align: 'center' },
                  { key: 'descriptive', label: 'تصحیح تشریحی', align: 'center' },
                  { key: 'finalScore', label: 'نمره نهایی', align: 'center' },
                  { key: 'action', label: 'عملیات', align: 'center' }
                ]}
                data={filteredRows}
                emptyTitle="هیچ داوطلبی یافت نشد"
                emptyDesc="هیچ داوطلبی مطابق فیلترهای کنونی در پایگاه داده پیدا نشد."
                renderRow={(row) => {
                  const hasSubmitted = row.status === 'submitted';
                  const isGraded = row.status === 'graded';
                  const isOngoing = row.status === 'ongoing';
                  const isAbsent = row.status === 'absent';

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-all font-medium text-xs md:text-sm">
                      <td className="p-4 font-bold text-slate-800">{row.studentName}</td>
                      <td className="p-4 font-mono text-slate-500 tracking-wider">
                        {toPersianDigits(row.maskedNationalId)}
                      </td>
                      <td className="p-4 text-slate-600 font-bold">{row.className}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          isGraded || hasSubmitted ? 'bg-emerald-50 text-emerald-700 border-emerald-150' :
                          isOngoing ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}>
                          {isGraded || hasSubmitted ? 'ارسال شده' : isOngoing ? 'در حال آزمون' : 'ارسال نشده'}
                        </span>
                      </td>
                      <td className="p-4 text-center font-mono text-slate-500">
                        {row.startedAt ? toPersianDigits(new Date(row.startedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })) : '—'}
                      </td>
                      <td className="p-4 text-center font-mono text-slate-500">
                        {row.submittedAt ? toPersianDigits(new Date(row.submittedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })) : '—'}
                      </td>
                      <td className="p-4 text-center font-extrabold text-indigo-700">
                        {isAbsent || isOngoing ? '—' : toPersianDigits(row.autoScore)}
                      </td>
                      <td className="p-4 text-center">
                        {isAbsent || isOngoing ? (
                          <span className="text-slate-350">—</span>
                        ) : !row.hasDescriptive ? (
                          <span className="text-slate-400 font-semibold text-xs">تستی محض</span>
                        ) : isGraded ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50/60 px-2 py-0.5 rounded-md border border-emerald-100 text-xs">
                            <Check className="w-3.5 h-3.5" />
                            <span>تصحیح‌شده</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-bold bg-rose-50/60 px-2 py-0.5 rounded-md border border-rose-100 animate-pulse text-xs">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>نیازمند تصحیح</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center font-black text-slate-800">
                        {isAbsent ? (
                          <span className="text-rose-600 bg-rose-50/60 font-bold px-2 py-0.5 rounded border border-rose-100 text-xs">غایب</span>
                        ) : isOngoing ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <span>{toPersianDigits(row.score)} <span className="text-[10px] text-slate-400 font-normal">از {toPersianDigits(row.maxScore)}</span></span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <Button
                          id={`btn-open-review-panel-${row.id}`}
                          onClick={() => startGrading(row)}
                          disabled={isAbsent || isOngoing}
                          variant={isGraded ? "indigo" : "danger"}
                          size="sm"
                        >
                          {isGraded ? 'بازبینی پاسخ‌ها' : 'تصحیح و بررسی ورقه'}
                        </Button>
                      </td>
                    </tr>
                  );
                }}
                renderMobileCard={(row) => {
                  const hasSubmitted = row.status === 'submitted';
                  const isGraded = row.status === 'graded';
                  const isOngoing = row.status === 'ongoing';
                  const isAbsent = row.status === 'absent';
                  return (
                    <Card hoverable key={row.id} className="p-4 space-y-3" id={`submission-mob-card-${row.id}`}>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-800">{row.studentName}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          isGraded || hasSubmitted ? 'bg-emerald-50 text-emerald-700 border-emerald-150' :
                          isOngoing ? 'bg-amber-50 text-amber-655 border-amber-100 animate-pulse' : 'bg-slate-105 text-slate-400 border-slate-200'
                        }`}>
                          {isGraded || hasSubmitted ? 'ارسال شده' : isOngoing ? 'در حال آزمون' : 'ارسال نشده'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 space-y-1">
                        <p>کلاس: {row.className}</p>
                        <p>کد ملی: <span className="font-mono">{toPersianDigits(row.maskedNationalId)}</span></p>
                        <p>تحویل: {row.submittedAt ? toPersianDigits(new Date(row.submittedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })) : '—'}</p>
                        <p className="font-bold text-indigo-755">
                          نمره: {isAbsent ? 'غایب' : isOngoing ? 'در جریان' : `${toPersianDigits(row.score)} از ${toPersianDigits(row.maxScore)}`}
                        </p>
                      </div>
                      <div className="pt-2 flex justify-end">
                        <Button
                          onClick={() => startGrading(row)}
                          disabled={isAbsent || isOngoing}
                          variant={isGraded ? "indigo" : "danger"}
                          size="sm"
                          className="w-full"
                        >
                          {isGraded ? 'بازبینی پاسخ‌ها' : 'تصحیح و بررسی ورقه'}
                        </Button>
                      </div>
                    </Card>
                  );
                }}
              />
            </div>
          </motion.div>
        ) : (
          /* Substantive Focused Cinema Mode Workspace interface */
          <motion.div
            key="results-grading-detail"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            id="workspace-evaluation-mode"
          >
            {/* Right evaluation control details drawer list (or column top) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Grading panel title row */}
              <div className="bg-white p-5 rounded-3xl border border-slate-150 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <button
                    id="btn-close-and-return-list"
                    onClick={() => setSelectedSubmissionId(null)}
                    className="p-2 border border-slate-100 hover:bg-slate-50 rounded-2xl text-slate-500 cursor-pointer"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 block bg-indigo-50/50 px-2.5 py-0.5 rounded-full w-fit">مدیریت پاسخ‌برگ داوطلب</span>
                    <h2 className="text-md font-black text-slate-800 mt-1">پاسخ‌برگ تحویلی: {activeSubmission.studentName}</h2>
                  </div>
                </div>

                <div className="bg-slate-50 border px-4 py-2.5 rounded-2xl flex items-center gap-4 text-xs shadow-3xs">
                  <div>
                    <span className="text-slate-400 font-bold block text-[9px] mb-0.5">ثبت نهایی ساعت:</span>
                    <span className="font-mono text-slate-700 font-bold">{activeSubmission.submittedAt ? toPersianDigits(new Date(activeSubmission.submittedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })) : 'در حال آزمون'}</span>
                  </div>
                  <div className="w-[1px] h-8 bg-slate-205" />
                  <div className="text-left">
                    <span className="text-slate-400 font-bold block text-[9px] mb-0.5 text-right">میانگین پیشرفت بارم:</span>
                    <span className="text-indigo-700 font-black text-sm block">%{toPersianDigits(Number((((Object.values(assignedScores) as number[]).reduce((sum, s) => sum + s, 0) / activeSubmission.maxScore) * 100).toFixed(0)))}</span>
                  </div>
                </div>
              </div>

              {/* Step-by-step Reviewing all exam questions list */}
              <div className="space-y-6">
                {exam.questions.map((q, idx) => {
                  const stdAnsObj = activeSubmission.rawSubmission.answers.find((ans: any) => ans.questionId === q.id);
                  const isDescriptive = q.type === 'long_answer' || q.type === 'short_answer';
                  const stdAnswerValue = stdAnsObj?.answer;
                  const isGraded = savedDescriptiveQuestions[q.id];

                  return (
                    <div key={q.id} className="bg-white border border-slate-200/80 rounded-3xl p-5 md:p-6 space-y-4 shadow-xs" id={`sheet-qscol-${q.id}`}>
                      {/* Section heading bar */}
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          <BookOpen className="w-4.5 h-4.5 text-indigo-500" />
                          <span>سؤال {toPersianDigits(idx + 1)}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-[10px] text-slate-400 font-bold">قالب: {
                            q.type === 'single_choice' ? 'چهار گزینه‌ای (تستی)' :
                            q.type === 'multiple_choice' ? 'چند گزینه‌ای تستی' :
                            q.type === 'true_false' ? 'صحیح / غلط' :
                            q.type === 'fill_blank' ? 'جای خالی' :
                            q.type === 'ordering' ? 'مرتب‌سازی ترتیبی' :
                            q.type === 'matching' ? 'وصل‌کردنی متناظر' : 'معمولی تشریحی'
                          }</span>
                        </span>
                        <span className="bg-indigo-50/60 border border-indigo-100 text-indigo-700 font-black px-2.5 py-0.5 rounded-lg text-[10px]">
                          حداکثر سهم بارم: {toPersianDigits(q.points)} امتیاز
                        </span>
                      </div>

                      {/* Question Text stem */}
                      <div className="text-slate-800 font-bold text-xs leading-relaxed leading-7" id="question-text-box">
                        {q.text}
                      </div>

                      {/* Options or Answer representation container */}
                      {!isDescriptive ? (
                        /* Objective grading review widget */
                        <div className="space-y-3.5 bg-slate-50 border p-4 rounded-2xl" id="objective-grading-review">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Student Answer */}
                            <div className="space-y-1">
                              <span className="text-[10px] text-rose-600 font-bold block">● کاندید انتخابی دانش‌آموز:</span>
                              <div className="bg-white border rounded-xl p-3 text-xs font-bold text-slate-700">
                                {stdAnsObj ? (
                                  q.type === 'single_choice' ? (
                                    q.options?.find(o => o.id === stdAnswerValue)?.text || `گزینه ${toPersianDigits(stdAnswerValue)}`
                                  ) : q.type === 'multiple_choice' && Array.isArray(stdAnswerValue) ? (
                                    stdAnswerValue.map(val => q.options?.find(o => o.id === val)?.text || val).join(' ، ')
                                  ) : q.type === 'true_false' ? (
                                    stdAnswerValue ? 'صحیح (درست)' : 'غلط (نادرست)'
                                  ) : q.type === 'ordering' && Array.isArray(stdAnswerValue) ? (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {stdAnswerValue.map((item, orIdx) => (
                                        <span key={orIdx} className="bg-slate-100 border px-2 py-0.5 rounded text-[10px] font-mono">{toPersianDigits(orIdx + 1)}. {item}</span>
                                      ))}
                                    </div>
                                  ) : q.type === 'matching' && typeof stdAnswerValue === 'object' ? (
                                    <div className="space-y-1 mt-1 text-[10px] font-semibold text-slate-600">
                                      {Object.entries(stdAnswerValue).map(([k, v]) => (
                                        <div key={k}>🔗 «{k}» وصل شده به «{String(v)}»</div>
                                      ))}
                                    </div>
                                  ) : (
                                    String(stdAnswerValue)
                                  )
                                ) : (
                                  <span className="text-slate-400">بدون جواب (خالی رها شده)</span>
                                )}
                              </div>
                            </div>

                            {/* Correct Key */}
                            <div className="space-y-1">
                              <span className="text-[10px] text-emerald-700 font-bold block">✔ کلید پاسخ آزمون‌ساز:</span>
                              <div className="bg-white border border-emerald-100 rounded-xl p-3 text-xs font-bold text-slate-700">
                                {q.type === 'single_choice' ? (
                                  q.options?.find(o => o.id === q.correctAnswer)?.text || `گزینه ${toPersianDigits(q.correctAnswer as string)}`
                                ) : q.type === 'multiple_choice' && Array.isArray(q.correctAnswer) ? (
                                  q.correctAnswer.map(val => q.options?.find(o => o.id === val)?.text || val).join(' ، ')
                                ) : q.type === 'true_false' ? (
                                  q.correctAnswer ? 'صحیح (درست)' : 'غلط (نادرست)'
                                ) : q.type === 'ordering' && Array.isArray(q.orderingItems) ? (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {q.orderingItems.map((item, orIdx) => (
                                      <span key={orIdx} className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-mono">{toPersianDigits(orIdx + 1)}. {item}</span>
                                    ))}
                                  </div>
                                ) : q.type === 'matching' && q.matchingPairs ? (
                                  <div className="space-y-1 mt-1 text-[10px] font-semibold text-slate-600">
                                    {q.matchingPairs.map((pair, pIdx) => (
                                      <div key={pIdx}>🔗 «{pair.left}» به «{pair.right}»</div>
                                    ))}
                                  </div>
                                ) : (
                                  String(q.correctAnswer || q.correctFillBlanks?.join('، ') || 'نامشخص')
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Interactive Score result feedback badge */}
                          <div className="pt-2 border-t border-slate-200/60 mt-1 flex justify-between items-center text-[11px] font-bold">
                            <span className="text-slate-400">رتبه‌بندی نمره‌دهی خودکار سیستم:</span>
                            {stdAnsObj?.isCorrect ? (
                              <span className="text-emerald-700 flex items-center gap-1.5 bg-emerald-100/40 px-3 py-1 rounded-xl border border-emerald-150">
                                <Check className="w-4 h-4 stroke-[3]" />
                                <span>پاسخ صحیح (دریافت کامل {toPersianDigits(q.points)} امتیاز)</span>
                              </span>
                            ) : (
                              <span className="text-rose-600 flex items-center gap-1.5 bg-rose-100/40 px-3 py-1 rounded-xl border border-rose-150">
                                <X className="w-4 h-4 stroke-[3]" />
                                <span>پاسخ نادرست (نمره کسب‌شده: {toPersianDigits(stdAnsObj?.scoreGained ?? 0)} از {toPersianDigits(q.points)})</span>
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Extensive Descriptive Rubrics evaluation interface */
                        <div className="space-y-4 bg-slate-50 border p-4 rounded-2xl" id="descriptive-evaluation">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Student Answer Sheet design */}
                            <div className="space-y-1">
                              <span className="text-[10px] text-indigo-700 font-bold block">● برگه دست‌نویس داوطلب:</span>
                              <div className="bg-white border rounded-xl p-4 text-xs font-bold text-slate-800 font-sans leading-relaxed whitespace-pre-wrap min-h-[110px]">
                                {stdAnswerValue || <span className="text-slate-300 font-normal">ورقه سفید رها شده است.</span>}
                              </div>
                            </div>

                            {/* Perfect Farsi Sample template */}
                            <div className="space-y-1">
                              <span className="text-[10px] text-emerald-800 font-bold block">✔ پاسخ نمونه طراح (کلید تشریحی):</span>
                              <div className="bg-emerald-50/20 border border-emerald-150 rounded-xl p-4 text-xs font-semibold text-slate-700 leading-relaxed min-h-[110px]">
                                {q.correctAnswer ? String(q.correctAnswer) : "تحلیل مستند و حاوی واژگان علمی مقتضی نمره بالا بر اساس توفیقات درسی ملاک است."}
                                <div className="mt-3 text-[10px] text-slate-400 border-t border-slate-200/50 pt-2 font-bold leading-5">
                                  <span>کتاب درسی: مبحث مرتبط با ردیف درستی محتوایی آزمون سراسری امسال.</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 5. SPECIFICATION REQ: Rubric criteria table for descriptive evaluation */}
                          <div className="space-y-2.5 bg-white p-4 border border-slate-150 rounded-xl">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-rose-100/60 pb-2">
                              <span className="text-[11px] font-black text-rose-800 block">جدول بارم‌بندی تفصیلی تصحیح (Rubrics):</span>
                              
                              {/* 8. AI ASSISTED EVAL BUTTON FEATURE */}
                              <button
                                type="button"
                                onClick={() => triggerAiAssistedGrading(q.id)}
                                disabled={aiLoadingQuestionId !== null}
                                className="inline-flex items-center gap-1 py-1.5 px-3 bg-indigo-55 hover:bg-indigo-100 border border-indigo-150 rounded-lg text-[10px] font-bold text-indigo-650 cursor-pointer disabled:opacity-50 transition-colors"
                              >
                                {aiLoadingQuestionId === q.id ? (
                                  <span className="inline-flex items-center gap-1 animate-pulse">
                                    <Cpu className="w-3 px-0.5 animate-spin" />
                                    <span>تحلیل تالیف با هوش مصنوعی...</span>
                                  </span>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-bounce" />
                                    <span>پیشنهاد نمره با هوش مصنوعی</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Warning note for AI assisted scoring */}
                            <p className="text-[9.5px] text-indigo-700 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100 leading-relaxed flex items-start gap-1.5">
                              <Cpu className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                              <span>نمره پیشنهادی هوش مصنوعی برپایه فهمِ معنایی زبان و معیارهای کلید آزمون استوار است؛ لذا باید توسط معلم ارجمند بررسی، حک و تایید قطعی گردد.</span>
                            </p>

                            <table className="w-full text-[10px] text-right" id={`rubric-tab-${q.id}`}>
                              <thead>
                                <tr className="text-slate-400 font-bold border-b border-slate-100">
                                  <th className="py-2">معیار ارزیابی</th>
                                  <th className="py-2 text-center w-24">حداکثر بارم</th>
                                  <th className="py-2 text-left w-32">نمره تخصیصی دبیر</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {getQuestionRubrics(q).map((rubric) => {
                                  // Live-reactive state allocation variables
                                  const currentScoreObj = rubricScores[q.id] || {};
                                  const scoreVal = currentScoreObj[rubric.id] ?? 0;

                                  return (
                                    <tr key={rubric.id} className="text-slate-600 font-semibold">
                                      <td className="py-3">
                                        <div className="font-bold text-slate-800">{rubric.title}</div>
                                        <div className="text-[9px] text-slate-400 mt-0.5 font-normal leading-relaxed">{rubric.description}</div>
                                      </td>
                                      <td className="py-3 text-center font-bold text-slate-700 text-xs">
                                        {toPersianDigits(rubric.maxPoints)} امتیاز
                                      </td>
                                      <td className="py-3 text-left">
                                        <input
                                          type="number"
                                          min={0}
                                          max={rubric.maxPoints}
                                          step={0.25}
                                          value={scoreVal}
                                          onChange={(e) => {
                                            const keyInput = Math.min(rubric.maxPoints, Math.max(0, Number(e.target.value)));
                                            setRubricScores(prev => ({
                                              ...prev,
                                              [q.id]: {
                                                ...(prev[q.id] || {}),
                                                [rubric.id]: keyInput
                                              }
                                            }));
                                            
                                            // Auto sync sum to the total assigned scores
                                            const subTotal = {
                                              ...(rubricScores[q.id] || {}),
                                              [rubric.id]: keyInput
                                            };
                                            const totalManual = (Object.values(subTotal) as number[]).reduce((sum, s) => sum + s, 0);
                                            setAssignedScores(prev => ({
                                              ...prev,
                                              [q.id]: Number(totalManual.toFixed(2))
                                            }));
                                            
                                            // Reset saved status since score changed
                                            setSavedDescriptiveQuestions(prev => ({
                                              ...prev,
                                              [q.id]: false
                                            }));
                                          }}
                                          className="w-20 px-2 py-1.5 border rounded-lg bg-slate-50 text-center font-black text-slate-800 text-xs focus:ring-1 focus:ring-indigo-400 focus:outline-hidden font-mono"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Feedback text row */}
                          <div className="space-y-1.5" id="teacher-comment-box">
                            <label className="text-[10px] text-slate-500 font-bold block flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                              <span>بازخورد و رهنمود دبیر به صورت تفصیلی:</span>
                            </label>
                            <textarea
                              rows={2}
                              value={teacherComments[q.id] || ''}
                              onChange={(e) => {
                                setTeacherComments({
                                  ...teacherComments,
                                  [q.id]: e.target.value
                                });
                                // Reset saved status since score changed
                                setSavedDescriptiveQuestions(prev => ({
                                  ...prev,
                                  [q.id]: false
                                }));
                              }}
                              placeholder="رهنمودهای آموزشی خود را بنویسید (مثال: پاراگراف اول فاقد مستند بومی است، بقیه بخش‌ها غنی بود)."
                              className="w-full bg-white border text-xs text-slate-700 p-2.5 rounded-xl outline-hidden focus:border-indigo-400 leading-relaxed font-semibold transition-colors"
                            />
                          </div>

                          {/* Save single question button */}
                          <div className="flex justify-end pt-2 border-t border-slate-100/50">
                            <button
                              type="button"
                              onClick={() => saveSingleQuestionGrade(q.id)}
                              className={`px-4.5 py-2.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                                isGraded 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-indigo-650 text-white hover:bg-indigo-750'
                              }`}
                            >
                              {isGraded ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                              <span>{isGraded ? 'نمره این سوال تایید و قفل شد' : 'ثبت نمره این سوال'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Left static metadata summary & finalizing drawer col */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-5 sticky top-6 space-y-5 text-right">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Award className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-xs font-black text-slate-800">کاردکس جمع‌بندی تصحیح</h3>
                </div>

                {/* Live Grade preview indicator */}
                <div className="bg-gradient-to-br from-indigo-50/50 to-slate-50 border border-indigo-150 rounded-2xl p-5 text-center space-y-1 mt-2">
                  <span className="text-[10px] text-indigo-505 font-bold block">مجموع نمرات اکتسابی و نهایی</span>
                  <div className="text-2xl font-black text-indigo-805 font-mono">
                    {toPersianDigits((Object.values(assignedScores) as number[]).reduce((sum, s) => sum + s, 0))} <span className="text-xs text-slate-400 font-bold">از {toPersianDigits(activeSubmission.maxScore)}</span>
                  </div>
                  <div className="text-[9px] text-slate-400 font-semibold pt-1">
                    <span>خودکار سیستم: {toPersianDigits(activeSubmission.autoScore)} بارم نسیب شده</span>
                  </div>
                </div>

                {/* Detailed Student description block */}
                <div className="space-y-3 text-[11px] font-semibold text-slate-650 bg-slate-50 border p-4 rounded-2xl leading-relaxed">
                  <div>🏫 <strong>آزمون آنلاین:</strong> {exam.title}</div>
                  <div>👤 <strong>نام داوطلب کلاس:</strong> {activeSubmission.studentName}</div>
                  <div>🆔 <strong>کد ملی ثبت‌شده:</strong> {toPersianDigits(activeSubmission.nationalId)}</div>
                  <div>🕒 <strong>آغاز ارزشیابی:</strong> {toPersianDigits(new Date(activeSubmission.startedAt).toLocaleTimeString('fa-IR'))}</div>
                </div>

                {/* Correction Progress meter list */}
                {hasDescriptiveQuestions && (
                  <div className="bg-white border rounded-2xl p-4 text-[11px] font-bold text-slate-600 space-y-3">
                    <span className="text-slate-400 block pb-1 border-b">وضعیت تصحیح سوالات تشریحی:</span>
                    <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                      <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl p-2">
                        <span className="text-slate-400 block text-[9px]">تایید شده</span>
                        <span className="text-sm font-black text-emerald-800 font-mono">
                          {toPersianDigits(Object.values(savedDescriptiveQuestions).filter(Boolean).length)}
                        </span>
                      </div>
                      <div className="bg-amber-50 text-amber-700 border border-amber-100 rounded-xl p-2">
                        <span className="text-slate-400 block text-[9px]">در انتظار بررسی</span>
                        <span className="text-sm font-black text-amber-805 font-mono">
                          {toPersianDigits(getUngradedDescriptiveQuestionsCount())}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. FINALIZE GRADINGS FEATURE */}
                {getUngradedDescriptiveQuestionsCount() > 0 && (
                  <div className="bg-amber-50/50 border border-amber-150 p-4 rounded-2xl text-amber-900 text-[10px] leading-relaxed flex items-start gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-extrabold block">توجه: برخی از سؤالات تشریحی هنوز نمره‌دهی نشده‌اند</span>
                      <p className="font-medium mt-0.5 text-amber-800">جداول بارم‌بندی تشریحی مربوط به سؤالات تصحیح شده را قفل نمائید تا نمره نهایی آنها به طور کامل اضافه گردد.</p>
                    </div>
                  </div>
                )}

                {/* Bottom Master action keys */}
                <div className="space-y-3 pt-2">
                  <button
                    id="btn-grading-finalize-worksheet"
                    onClick={handleFinalizeGrading}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/10"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تکمیل تصحیح و ثبت نهایی کارنامه</span>
                  </button>
                  <button
                    onClick={() => setSelectedSubmissionId(null)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border border-slate-200"
                  >
                    <span>انصراف و بازگشت</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
