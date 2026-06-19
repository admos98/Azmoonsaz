/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useInView } from 'motion/react';
import { 
  FileText, 
  Users, 
  HelpCircle, 
  CheckSquare, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  Award, 
  ShieldAlert, 
  ChevronLeft, 
  Upload, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle, 
  Flame, 
  Eye, 
  BookOpen, 
  Trash2,
  ListFilter
} from 'lucide-react';
import { 
  mockExams, 
  mockStudents, 
  mockSubmissions, 
  mockClassGroups, 
  mockQuestions, 
  mockTeacher 
} from '../../mockData';
import { Student, Exam, Submission, Question } from '../../types';
import { Button, Card, Badge, StatusBadge, Modal, EmptyState, FileDropzone, Table } from '../../components/UIComponents';
import { formatPersianNumber, formatPersianDate } from '../../services/persianHelpers';
import { studentService, examService, gradingService } from '../../services/api';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  onSelectExamForResults?: (examId: string) => void;
}

export default function Dashboard({ onNavigate, onSelectExamForResults }: DashboardProps) {
  // Setup local state to support real-time user mutations (e.g. excel import, sandbox simulation)
  const [localStudents, setLocalStudents] = useState<Student[]>([]);
  const [localExams, setLocalExams] = useState<Exam[]>([]);
  const [localSubmissions, setLocalSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const [studentsData, examsData, submissionsData] = await Promise.all([
          studentService.getStudents(),
          examService.getExams(),
          gradingService.getSubmissions()
        ]);
        setLocalStudents(studentsData);
        setLocalExams(examsData);
        setLocalSubmissions(submissionsData);
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, []);
  
  // Sandbox modes for empty state preview
  const [simulateNoExams, setSimulateNoExams] = useState(false);
  const [simulateNoStudents, setSimulateNoStudents] = useState(false);

  // Excel import simulator state
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importStep, setImportStep] = useState<'idle' | 'reading' | 'mapping' | 'preview' | 'done'>('idle');
  const [importProgress, setImportProgress] = useState(0);

  // Simulated new students parsed from file
  const parsedSampleStudents: Student[] = [
    { id: 's-new-9', name: 'پیمان مشیری', nationalId: '0075482143', maskedNationalId: '007***2143', grade: 'هفتم', classGroupId: 'c-1', email: 'peyman@example.com' },
    { id: 's-new-10', name: 'کیمیا شریفی', nationalId: '1284567890', maskedNationalId: '128***7890', grade: 'نهم', classGroupId: 'c-4', email: 'kimia@example.com' },
    { id: 's-new-11', name: 'بردیا ابراهیمی', nationalId: '2283451290', maskedNationalId: '228***1290', grade: 'هشتم', classGroupId: 'c-3', email: 'bardia@example.com' },
  ];

  // Dynamic values based on sandbox simulation is enabled
  const currentStudents = simulateNoStudents ? [] : localStudents;
  const currentExams = simulateNoExams ? [] : localExams;
  const currentSubmissions = simulateNoExams || simulateNoStudents ? [] : localSubmissions;

  // Stats computation
  const totalExams = currentExams.length;
  const activeExams = currentExams.filter(e => e.status === 'active').length;
  const scheduledExams = currentExams.filter(e => e.status === 'scheduled').length;
  const totalStudents = currentStudents.length;
  const pendingGradings = currentSubmissions.filter(s => s.status === 'submitted').length;

  // Excel Drag Drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setExcelFile(file);
    setImportStep('reading');
    setImportProgress(10);
    
    // Simulate Reading Steps
    setTimeout(() => {
      setImportProgress(40);
      setImportStep('mapping');
      
      setTimeout(() => {
        setImportProgress(75);
        
        setTimeout(() => {
          setImportProgress(100);
          setImportStep('preview');
        }, 600);
      }, 700);
    }, 600);
  };

  const handleConfirmImport = () => {
    // Append simulated students to local standard state
    setLocalStudents(prev => [...prev, ...parsedSampleStudents]);
    setImportStep('done');
    
    // Auto reset modal after short success notification delay
    setTimeout(() => {
      setIsExcelModalOpen(false);
      setImportStep('idle');
      setExcelFile(null);
      setImportProgress(0);
    }, 1500);
  };

  // Helper resolvers for table
  const getStudentClassLabel = (studentId: string) => {
    const student = currentStudents.find(s => s.id === studentId);
    if (!student) return 'کلاس نامشخص';
    const group = mockClassGroups.find(cg => cg.id === student.classGroupId);
    return group ? group.name : `پایه ${student.grade}`;
  };

  const getExamTitle = (examId: string) => {
    return currentExams.find(e => e.id === examId)?.title || 'آزمون عمومی';
  };

  // Compute Question Bank health counts
  const qBankTotal = mockQuestions.length;
  const grade7QCount = mockQuestions.filter(q => q.grade === 'هفتم').length;
  const grade8QCount = mockQuestions.filter(q => q.grade === 'هشتم').length;
  const grade9QCount = mockQuestions.filter(q => q.grade === 'نهم').length;

  const typeMultiChoiceCount = mockQuestions.filter(q => q.type === 'single_choice' || q.type === 'multiple_choice').length;
  const typeEssayCount = mockQuestions.filter(q => q.type === 'long_answer' || q.type === 'short_answer').length;
  const typeRestCount = qBankTotal - (typeMultiChoiceCount + typeEssayCount);

  return (
    <div className="space-y-6" id="teacher-dashboard-full">
      
      {/* Dynamic Sandbox Simulator Controls Box (Reviewer-friendly widget) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-white/70 backdrop-blur-sm border border-white/30 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 select-none" id="sandbox-simulator-panel"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600"></span>
          </span>
          <div>
            <h4 className="text-xs font-bold text-slate-800">شبیه‌ساز وضعیت‌ها و بررسی تعاملی قابلیت‌ها</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">برای مشاهده آسان حالت‌های خالی (Empty States)، تیک‌های زیر را فعال کنید:</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-4 text-xs font-medium text-slate-700">
          <label className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 transition-colors px-3 py-1.5 rounded-xl border border-slate-100 cursor-pointer">
            <input
              type="checkbox"
              id="chk-simulate-no-exams"
              checked={simulateNoExams}
              onChange={(e) => setSimulateNoExams(e.target.checked)}
              className="accent-indigo-600 w-4 h-4 rounded-md"
            />
            <span>بدون آزمون (حالت خالی)</span>
          </label>

          <label className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 transition-colors px-3 py-1.5 rounded-xl border border-slate-100 cursor-pointer">
            <input
              type="checkbox"
              id="chk-simulate-no-students"
              checked={simulateNoStudents}
              onChange={(e) => setSimulateNoStudents(e.target.checked)}
              className="accent-indigo-600 w-4 h-4 rounded-md"
            />
            <span>بدون دانش‌آموز (حالت خالی)</span>
          </label>

          {(simulateNoExams || simulateNoStudents) && (
            <button
              onClick={() => {
                setSimulateNoExams(false);
                setSimulateNoStudents(false);
              }}
              className="text-[10px] text-indigo-600 font-bold hover:underline"
            >
              بازنشانی پیش‌فرض
            </button>
          )}
        </div>
      </motion.div>

      {/* 1. Welcome Card Hero */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.05 }}
        className="relative overflow-hidden p-6 md:p-8 rounded-3xl bg-slate-900 text-white shadow-xl" id="dashboard-hero-banner"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="text-right">
            <span className="bg-indigo-500/20 text-indigo-300 text-[11px] font-bold px-3 py-1 rounded-full border border-indigo-400/20">
              شنبه، ۲۳ خرداد ۱۴۰۵ - هوش مصنوعی همکار
            </span>
            <h2 className="text-xl md:text-2xl font-black mt-3 leading-snug">سلام، استاد {mockTeacher.name} عزیز</h2>
            <p className="text-xs md:text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
              خلاصه وضعیت امروز: سیستم هوشمند آماده پذیرش پاسخ‌برگ‌هاست. در حال حاضر {activeExams} آزمون جاری در کلاس‌ها فعال بوده و تعداد {pendingGradings} ورقه‌ پاسخ‌برگ تستی/تشریحی ارسالی دانش‌آموزان در صف بررسی نهایی و تصحیح معلم قرار گرفته است.
            </p>
          </div>
          <div className="flex gap-3 shrink-0 self-start md:self-auto">
            <button
              id="hero-btn-new-exam"
              onClick={() => onNavigate('exams/new')}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>طراحی آزمون نو</span>
            </button>
            <button
              id="hero-btn-questions"
              onClick={() => onNavigate('questions')}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              افزودن سوال جدید
            </button>
          </div>
        </div>
      </motion.div>

      {/* 2. Bento Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5" id="stats-grid-layouts">
        
        {/* Card 1: Students — spans 2 cols on large */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.1 }}
          className="col-span-2"
        >
          <Card hoverable className="flex flex-col justify-between h-full" id="stat-card-total-students">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">تعداد دانش‌آموزان</span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-slate-800 tracking-tight block">
              {formatPersianNumber(totalStudents)} <span className="text-xs font-normal text-slate-400">نفر</span>
            </span>
            <span className="text-[10px] text-emerald-600 font-bold mt-1.5 block">
              +{formatPersianNumber(3)} نفر آماده تأیید اکسل
            </span>
          </div>
        </Card>
        </motion.div>

        {/* Card 2: Total Questions */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.15 }}
        >
        <Card hoverable className="flex flex-col justify-between h-full" id="stat-card-total-questions">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">تعداد کل سوالات</span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-slate-800 tracking-tight block">
              {formatPersianNumber(qBankTotal)} <span className="text-xs font-normal text-slate-400">سوال</span>
            </span>
            <span className="text-[10px] text-slate-500 mt-1.5 block">
              منطبق با کتب درسی جدید
            </span>
          </div>
        </Card>
        </motion.div>

        {/* Card 3: Active Exams */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.2 }}
        >
        <Card hoverable className="flex flex-col justify-between h-full" id="stat-card-active-exams">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">آزمون‌های فعال</span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-slate-800 tracking-tight block">
              {formatPersianNumber(activeExams)}
            </span>
            <span className={`text-[10px] font-bold mt-1.5 block ${activeExams > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`}>
              {activeExams > 0 ? 'درگاه پاسخ فعال' : 'بدون آزمون فعال'}
            </span>
          </div>
        </Card>
        </motion.div>

        {/* Card 4: Submissions Pending Grading */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.25 }}
        >
        <Card hoverable className="flex flex-col justify-between h-full" id="stat-card-pending-reviews">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">نیازمند تصحیح</span>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-slate-800 tracking-tight block">
              {formatPersianNumber(pendingGradings)}
            </span>
            <span className="text-[10px] text-rose-600 font-bold mt-1.5 block">
              پاسخ‌های تشریحی در صف
            </span>
          </div>
        </Card>
        </motion.div>

      </div>

      {/* 3. Quick Actions Row */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        className="bg-white/70 backdrop-blur-sm border border-white/30 p-6 rounded-3xl shadow-sm text-right" id="quick-actions-section"
      >
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>⚡ اقدامات و دسترسی‌های سریع معلم</span>
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5" id="quick-action-btns">
          
          <button
            id="qa-btn-import-excel"
            onClick={() => setIsExcelModalOpen(true)}
            className="p-4 bg-slate-50 hover:bg-slate-100 active:bg-slate-150 border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
          >
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-105 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-700">ورود دانش‌آموزان از اکسل</span>
          </button>

          <button
            id="qa-btn-add-question"
            onClick={() => onNavigate('questions')}
            className="p-4 bg-slate-50 hover:bg-slate-100 active:bg-slate-150 border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
          >
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-105 transition-transform">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-700">افزودن سوال جدید</span>
          </button>

          <button
            id="qa-btn-new-exam"
            onClick={() => onNavigate('exams/new')}
            className="p-4 bg-slate-50 hover:bg-slate-100 active:bg-slate-150 border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
          >
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-700">ساخت آزمون جدید</span>
          </button>

          <button
            id="qa-btn-view-results"
            onClick={() => onNavigate('results')}
            className="p-4 bg-slate-50 hover:bg-slate-100 active:bg-slate-150 border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
          >
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-105 transition-transform">
              <Eye className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-700">مشاهده نتایج کل</span>
          </button>

          <button
            id="qa-btn-correct-essays"
            onClick={() => onNavigate('results')}
            className="p-4 bg-rose-50/70 hover:bg-rose-50 hover:border-rose-150 border border-rose-100 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center col-span-2 md:col-span-1 group cursor-pointer"
          >
            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl group-hover:scale-105 transition-transform animate-pulse">
              <CheckSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-rose-800">تصحیح پاسخ‌های تشریحی</span>
          </button>

        </div>
      </motion.div>

      {/* Main Core Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-core-split">
        
        {/* Left Columns (2/3 Width) */}
        <div className="lg:col-span-2 space-y-6">

          {/* 4. Upcoming and Active Exams Section */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="bg-white/70 backdrop-blur-sm border border-white/30 p-6 rounded-3xl shadow-sm" id="section-upcoming-exams"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">آزمون‌های زمان‌بندی‌شده مابعد و پیش‌رو</h3>
                <p className="text-[10px] text-slate-400 mt-1">سنجش‌های در حال آماده‌سازی یا فعال کنونی</p>
              </div>
              <button
                onClick={() => onNavigate('exams')}
                className="text-[11px] text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>مدیریت کلیه آزمون‌ها</span>
                <ChevronLeft className="w-3 h-3" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {currentExams.length > 0 ? (
                <div className="space-y-3" id="upcoming-exams-list">
                  {currentExams.map((ex) => (
                    <div 
                      key={ex.id} 
                      className="p-4 rounded-2xl bg-slate-50/70 hover:bg-white hover:shadow-xs border border-slate-100/80 hover:border-slate-200 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 text-right"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-800">{ex.title}</h4>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                            ex.settings.mode === 'official' ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {ex.settings.mode === 'official' ? 'رسمی' : 'تمرینی'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-450">
                          <span>پایه: {ex.grade}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span>کلاس: {ex.classGroupIds.map(cid => mockClassGroups.find(c => c.id === cid)?.name).filter(Boolean).join(' و ')}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {formatPersianNumber(ex.duration)} دقیقه
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-right sm:text-left">
                          <p className="text-[10px] text-slate-400 font-medium">مهلت شروع/ثبت شده</p>
                          <p className="text-[10px] text-slate-700 font-semibold mt-0.5 dir-ltr">
                            {ex.settings.startTime ? new Date(ex.settings.startTime).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : 'نامنظم'}
                          </p>
                        </div>
                        <StatusBadge status={ex.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* 7. Exams Empty State */
                <EmptyState
                  icon={<FileText className="w-8 h-8" />}
                  title="هیچ آزمونی برای نمایش یافت نشد!"
                  description="در حال حاضر هیچ آزمون فعالی تعریف نگردیده است. با فشردن دکمه طراح زیر، اولین سنجش تحصیلی هماهنگ خود را پایه‌ریزی کنید."
                  action={
                    <Button 
                      onClick={() => onNavigate('exams/new')}
                      variant="primary"
                      size="sm"
                    >
                      همین الان آزمون نو بسازید
                    </Button>
                  }
                />
              )}
            </AnimatePresence>
          </motion.div>

          {/* 5. Recent Submissions Section */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="bg-white/70 backdrop-blur-sm border border-white/30 rounded-3xl shadow-sm overflow-hidden" id="section-recent-submissions"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-800">آخرین پاسخ‌برگ‌های ارسال شده دانش‌آموزان</h3>
                <p className="text-[10px] text-slate-400 mt-1">سنجش‌های زنده با قابلیت تصحیح سریع معلم</p>
              </div>
              <button
                onClick={() => onNavigate('results')}
                className="text-[11px] text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>مشاهده کلیه نتایج</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {currentSubmissions.length > 0 ? (
                <div className="p-6">
                  <Table
                    headers={[
                      { key: 'student', label: 'دانش‌آموز' },
                      { key: 'class', label: 'کلاس' },
                      { key: 'title', label: 'عنوان آزمون' },
                      { key: 'time', label: 'جزئیات زمان', align: 'center' },
                      { key: 'status', label: 'وضعیت تصحیح', align: 'center' },
                      { key: 'score', label: 'نمره', align: 'center' },
                      { key: 'action', label: 'اقدام', align: 'center' }
                    ]}
                    data={currentSubmissions}
                    renderRow={(sub) => {
                      const exam = currentExams.find(e => e.id === sub.examId);
                      const isGraded = sub.status === 'graded';
                      const isOngoing = sub.status === 'ongoing';
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors text-xs md:text-sm">
                          <td className="p-4 font-bold text-slate-700">{sub.studentName}</td>
                          <td className="p-4 text-slate-500 font-semibold">{getStudentClassLabel(sub.studentId)}</td>
                          <td className="p-4 font-medium text-slate-650 max-w-xs truncate">{getExamTitle(sub.examId)}</td>
                          <td className="p-4 text-center text-slate-400 font-medium">
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : 'درجریان'}
                          </td>
                          <td className="p-4 text-center">
                            <StatusBadge status={sub.status} />
                          </td>
                          <td className="p-4 text-center font-bold text-slate-705">
                            {isOngoing ? '-' : `${formatPersianNumber(sub.score)} / ${formatPersianNumber(sub.maxScore)}`}
                          </td>
                          <td className="p-4 text-center">
                            <Button
                              onClick={() => {
                                if (onSelectExamForResults && exam) {
                                  onSelectExamForResults(exam.id);
                                } else {
                                  onNavigate('results');
                                }
                              }}
                              variant={isGraded ? "indigo" : "danger"}
                              size="sm"
                              disabled={isOngoing}
                            >
                              {isGraded ? 'ویرایش نمره‌دهی' : isOngoing ? 'درگاه زنده' : 'تصحیح ورقه'}
                            </Button>
                          </td>
                        </tr>
                      );
                    }}
                    renderMobileCard={(sub) => {
                      const exam = currentExams.find(e => e.id === sub.examId);
                      const isGraded = sub.status === 'graded';
                      const isOngoing = sub.status === 'ongoing';
                      return (
                        <Card hoverable key={sub.id} className="p-4 space-y-3" id={`submission-mob-card-${sub.id}`}>
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-800">{sub.studentName}</span>
                            <StatusBadge status={sub.status} />
                          </div>
                          <div className="text-[11px] text-slate-500 space-y-1">
                            <p>کلاس: {getStudentClassLabel(sub.studentId)}</p>
                            <p>آزمون: {getExamTitle(sub.examId)}</p>
                            <p>زمان ارسال: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : 'در جریان'}</p>
                            <p className="font-bold text-indigo-700 font-mono">نمره: {isOngoing ? '-' : `${formatPersianNumber(sub.score)} / ${formatPersianNumber(sub.maxScore)}`}</p>
                          </div>
                          <div className="pt-2 flex justify-end">
                            <Button
                              onClick={() => {
                                if (onSelectExamForResults && exam) {
                                  onSelectExamForResults(exam.id);
                                } else {
                                  onNavigate('results');
                                }
                              }}
                              variant={isGraded ? "indigo" : "danger"}
                              size="sm"
                              disabled={isOngoing}
                              className="w-full"
                            >
                              {isGraded ? 'ویرایش نمره‌دهی' : isOngoing ? 'درگاه زنده' : 'تصحیح ورقه'}
                            </Button>
                          </div>
                        </Card>
                      );
                    }}
                  />
                </div>
              ) : (
                /* 7. Submissions / Students Empty State */
                <EmptyState
                  icon={<Users className="w-8 h-8" />}
                  title="موردی برای تصحیح یافت نشد!"
                  description="هیچ دانش‌آموزی در کلاس جاری ثبت‌نام نشده یا پاسخی دریافت نگردیده است. شما می‌توانید فایل اکسل رسمی دانش‌آموزان را برای شروع بارگذاری کنید."
                  action={
                    <Button 
                      onClick={() => setIsExcelModalOpen(true)}
                      variant="primary"
                      size="sm"
                    >
                      بارگذاری اکسل دانش‌آموزان
                    </Button>
                  }
                />
              )}
            </AnimatePresence>
          </motion.div>

        </div>

        {/* Right Sidebar Column (1/3 Width) */}
        <div className="space-y-6" id="dashboard-right-sidebar">

          {/* 6. Question Bank Health Section */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="bg-white/70 backdrop-blur-sm border border-white/30 p-6 rounded-3xl shadow-sm text-right" id="section-q-bank-health"
          >
            <h3 className="text-xs font-black text-slate-800 mb-4 flex items-center gap-2">
              <span>📊 وضعیت سلامت بانک سوالات چندگزینه‌ای و تشریحی</span>
            </h3>

            {/* CSS-Only Visual Stacked Health Charts */}
            <div className="space-y-5" id="charts-q-bank">
              
              {/* Chart A: Question Count by base/grade */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 block">پراکندگی سوالات بر اساس پایه‌های درسی</span>
                <div className="flex bg-slate-100 h-6 rounded-lg overflow-hidden text-[9px] font-semibold text-white">
                  <div 
                    className="bg-indigo-600 h-full flex items-center justify-center transition-all duration-300 hover:brightness-95" 
                    style={{ width: `${(grade7QCount / qBankTotal) * 100}%` }}
                    title={`هفتم: ${grade7QCount} سوال`}
                  >
                    {grade7QCount > 0 && `هفتم (${grade7QCount})`}
                  </div>
                  <div 
                    className="bg-violet-500 h-full flex items-center justify-center transition-all duration-300 hover:brightness-95" 
                    style={{ width: `${(grade8QCount / qBankTotal) * 100}%` }}
                    title={`هشتم: ${grade8QCount} سوال`}
                  >
                    {grade8QCount > 0 && `هشتم (${grade8QCount})`}
                  </div>
                  <div 
                    className="bg-emerald-500 h-full flex items-center justify-center transition-all duration-300 hover:brightness-95" 
                    style={{ width: `${(grade9QCount / qBankTotal) * 100}%` }}
                    title={`نهم: ${grade9QCount} سوال`}
                  >
                    {grade9QCount > 0 && `نهم (${grade9QCount})`}
                  </div>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 px-1">
                  <span>هفتم: {grade7QCount}س</span>
                  <span>هشتم: {grade8QCount}س</span>
                  <span>نهم: {grade9QCount}س</span>
                </div>
              </div>

              {/* Chart B: Count by Type */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 block">تفکیک ساختاری نوع سوالات بانک</span>
                <div className="flex bg-slate-100 h-6 rounded-lg overflow-hidden text-[9px] font-semibold text-white">
                  <div 
                    className="bg-rose-500 h-full flex items-center justify-center transition-all duration-300 hover:brightness-95" 
                    style={{ width: `${(typeMultiChoiceCount / qBankTotal) * 100}%` }}
                    title={`تستی: ${typeMultiChoiceCount} سوال`}
                  >
                    {typeMultiChoiceCount > 0 && `تستی (${typeMultiChoiceCount})`}
                  </div>
                  <div 
                    className="bg-indigo-500 h-full flex items-center justify-center transition-all duration-300 hover:brightness-95" 
                    style={{ width: `${(typeEssayCount / qBankTotal) * 100}%` }}
                    title={`تشریحی: ${typeEssayCount} سوال`}
                  >
                    {typeEssayCount > 0 && `تشریحی (${typeEssayCount})`}
                  </div>
                  <div 
                    className="bg-amber-500 h-full flex items-center justify-center transition-all duration-300 hover:brightness-95" 
                    style={{ width: `${(typeRestCount / qBankTotal) * 100}%` }}
                    title={`سایر: ${typeRestCount} سوال`}
                  >
                    {typeRestCount > 0 && `سایر (${typeRestCount})`}
                  </div>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 px-1">
                  <span>تستی: {typeMultiChoiceCount} مورد</span>
                  <span>تشریحی: {typeEssayCount} مورد</span>
                  <span>سایر: {typeRestCount} مورد</span>
                </div>
              </div>

            </div>

            {/* Custom Beast Mode Prompt Warning Box */}
            <div className="mt-5 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start gap-3" id="beast-mode-alert">
              <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="text-[11px] font-bold text-orange-800">کمبود جدی بانک سوالات</h5>
                <p className="text-[10px] text-orange-705 leading-relaxed">
                  برای حالت Beast Mode سوالات کافی نیست.
                </p>
                <button
                  onClick={() => onNavigate('questions')}
                  className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 hover:underline block pt-1 cursor-pointer"
                >
                  بهبود سوالات و خروج از بحران 🚀
                </button>
              </div>
            </div>

          </motion.div>

          {/* Active Class Groups List */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="bg-white/70 backdrop-blur-sm border border-white/30 p-6 rounded-3xl shadow-sm" id="section-class-groups-list"
          >
            <h3 className="text-xs font-black text-slate-800 mb-4">آمار کلاس‌های تحت پوشش پایه‌ها</h3>
            <div className="space-y-3">
              {mockClassGroups.map((cg) => (
                <div key={cg.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex justify-between items-center hover:bg-white hover:border-slate-300 hover:shadow-2xs transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                      {cg.grade.slice(0, 2)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{cg.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">پایه {cg.grade}</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-slate-200/50 text-slate-600 px-2.5 py-1 rounded-full font-bold">
                    {cg.studentCount} دانش‌آموز
                  </span>
                </div>
              ))}
            </div>
            
            <button
              id="sidebar-add-class-dashboard"
              onClick={() => onNavigate('students')}
              className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold mt-4 border border-dashed border-slate-200 transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ایجاد کلاس یا گروه جدید</span>
            </button>
          </motion.div>

          {/* Quick Security Checklist / Protip */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="bg-gradient-to-tr from-indigo-50/50 to-violet-50/50 p-6 rounded-3xl border border-indigo-100/50 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-white text-indigo-600 rounded-xl shadow-2xs">
                <Award className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h4 className="text-xs font-bold text-slate-800">راهنمای هوشمند آزمون‌ساز</h4>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  آیا می‌دانید با فعال‌سازی گزینه «قفل کردن مرورگر (حالت حفاظتی)»، دانش‌آموز در صورت خارج شدن دائم از تب امتحان، پاسخ‌برگش به صورت خودکار بایگانی خواهد شد؟
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => onNavigate('exams')}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                  >
                    تنظیمات تخصصی آزمون
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

        </div>

      </div>

      {/* 8. Interactively Functional Excel Import Modal Component */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" id="excel-import-modal-backdrop">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-150 text-right text-xs"
            id="excel-import-dialog"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <button 
                onClick={() => {
                  setIsExcelModalOpen(false);
                  setImportStep('idle');
                  setExcelFile(null);
                }}
                className="p-1 px-2.5 bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-xl transition-colors font-bold cursor-pointer"
              >
                بستن ×
              </button>
              <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                ورود اطلاعات دانش‌آموزان از طریق فایل اکسل / CSV
              </span>
            </div>

            {/* Modal Body / Active Step Controls */}
            <div className="p-6 space-y-5">
              
              {importStep === 'idle' && (
                <div className="space-y-4">
                  <p className="text-slate-500 leading-relaxed text-[11px]">
                    برای ورود فله‌ای مشخصات دانش‌آموزان و قراردهی آن‌ها در کلاس‌ها، می‌توانید فایل خروجی سناد یا فایل دستی اکسل با پسوندهای <strong className="font-semibold text-slate-700">.xlsx</strong> یا <strong className="font-semibold text-slate-700">.csv</strong> را بارگذاری کنید.
                  </p>
                  <p className="text-amber-700 font-bold text-[10.5px] bg-amber-50 border border-amber-100 p-2 rounded-xl text-center">
                    ⚠️ در نسخه آزمایشی، داده‌ها به صورت شبیه‌سازی‌شده خوانده می‌شوند.
                  </p>

                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all ${
                      dragActive ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-250 bg-slate-50 hover:bg-slate-100/50'
                    }`}
                  >
                    <Upload className="w-10 h-10 text-slate-400 animate-bounce" />
                    <div className="text-center space-y-1">
                      <p className="font-bold text-slate-700">فایل خود را به این قسمت بکشید و رها کنید</p>
                      <p className="text-[10px] text-slate-400">یا برای انتخاب فایل از روی حافظه کلیک کنید</p>
                    </div>

                    <label className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-[10px] cursor-pointer shadow-xs transition-all">
                      انتخاب فایل اکسل
                      <input 
                        type="file" 
                        accept=".xlsx,.xls,.csv" 
                        className="hidden" 
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>

                  <div className="p-3.5 bg-indigo-50/50 border border-indigo-100/40 rounded-xl text-indigo-800 flex items-start gap-2 text-[10px]">
                    <span className="font-bold">💡 نکته راهنما:</span>
                    <span>ستون‌های الزامی در فایل اکسل باید شامل «نام و نام خانوادگی»، «کد ملی» و «پایه تحصیلی» باشد.</span>
                  </div>
                </div>
              )}

              {/* Progress Loading Simulated Screen */}
              {(importStep === 'reading' || importStep === 'mapping') && (
                <div className="py-8 space-y-4 text-center">
                  <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin mx-auto" />
                  <div className="space-y-1.5">
                    <p className="font-bold text-slate-800">
                      {importStep === 'reading' ? 'درحال بارگذاری و استخراج بیت‌های فایل...' : 'درحال قرینه‌سازی با سطوح سنادی استان...'}
                    </p>
                    <p className="text-[10px] text-slate-400">لطفاً از بستن این کادر یا رفرش تب مرورگر خود خودداری نمایید.</p>
                  </div>
                  <div className="w-64 bg-slate-100 h-2.5 rounded-full overflow-hidden mx-auto mt-2">
                    <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Simulated Excel Preview Screen prior Confirmation */}
              {importStep === 'preview' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span className="font-bold">فایل به خوبی تحلیل گردید! تعداد ۳ دانش‌آموز معتبر جدید استخراج شد.</span>
                  </div>

                  <p className="text-slate-500 text-[11px]">پیش‌نمایش رکوردهای خوانده‌شده قبل از درج نهایی دیتابیس:</p>

                  <div className="border border-slate-150 rounded-xl overflow-hidden bg-slate-50 max-h-48 overflow-y-auto">
                    <table className="w-full text-[10px] text-right">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="p-2.5 font-bold">نام و فامیل</th>
                          <th className="p-2.5 font-bold">کد ملی</th>
                          <th className="p-2.5 font-bold">پایه تحصیلی</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedSampleStudents.map((stud) => (
                          <tr key={stud.id} className="bg-white">
                            <td className="p-2.5 font-bold text-slate-700">{stud.name}</td>
                            <td className="p-2.5 font-mono text-slate-500">{stud.nationalId}</td>
                            <td className="p-2.5 text-slate-600">پایه {stud.grade} (کلاس ۷۰۱/۹۰۱)</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                    <button 
                      onClick={() => {
                        setImportStep('idle');
                        setExcelFile(null);
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl cursor-pointer"
                    >
                      لغو و تفکیک دگر
                    </button>
                    <button 
                      onClick={handleConfirmImport}
                      className="px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer shadow-xs active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      تأیید و افزودن به لیست دانش‌آموزان
                    </button>
                  </div>
                </div>
              )}

              {/* SUCCESS final Simulation state */}
              {importStep === 'done' && (
                <div className="py-8 space-y-3 text-center">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">عملیات انتقال پرونده‌ها پیروز بود!</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                    تعداد ۳ دانش‌آموز جدید وارد بانک اطلاعاتی گردید و اینک در بخش آمار و کلاس‌بندی سازماندهی شده‌اند.
                  </p>
                </div>
              )}

            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}

// Custom simple calendar icon representing for Scheduled exams stat card
function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
    </svg>
  );
}
