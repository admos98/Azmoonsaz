/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  FileText,
  Users,
  CheckSquare,
  Plus,
  Clock,
  ChevronLeft,
  Upload,
  Eye,
  BookOpen,
} from 'lucide-react';

import { Button, Card, StatusBadge, EmptyState, Table } from '../../components/UIComponents';
import { TheMark } from '../../components/TheMark';
import { formatPersianNumber, formatPersianDate } from '../../services/persianHelpers';
import { useTeacher } from '../../contexts/TeacherContext';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useToast } from '../../hooks/useToast';
import StudentImportWizard from '../../features/student-import/StudentImportWizard';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  onSelectExamForResults?: (examId: string) => void;
}

export default function Dashboard({ onNavigate, onSelectExamForResults }: DashboardProps) {
  const { teacher } = useTeacher();
  const { toastElement } = useToast();
  const {
    students: localStudents,
    exams: localExams,
    submissions: localSubmissions,
    classGroups,
    questions: localQuestions,
    addImportedStudents,
  } = useDashboardData();

  // Shared, real CSV/XLSX import workflow. The trigger is retained so the
  // wizard grows from and collapses back into the button that opened it.
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const excelTriggerRef = useRef<HTMLElement | null>(null);

  // Simulated new students parsed from file
  // Dynamic values based on actual data
  const currentStudents = localStudents;
  const currentExams = localExams;
  const currentSubmissions = localSubmissions;
  const upcomingExams = currentExams.filter(
    (exam) => exam.status === 'active' || exam.status === 'scheduled',
  );

  // Stats computation
  const activeExams = currentExams.filter((e) => e.status === 'active').length;
  const scheduledExams = currentExams.filter((e) => e.status === 'scheduled').length;
  const totalStudents = currentStudents.length;
  const pendingGradings = currentSubmissions.filter((s) => s.status === 'submitted').length;

  // Helper resolvers for table
  const getStudentClassLabel = (studentId: string) => {
    const student = currentStudents.find((s) => s.id === studentId);
    if (!student) return 'کلاس نامشخص';
    const group = classGroups.find((cg) => cg.id === student.classGroupId);
    return group ? group.name : `پایه ${student.grade}`;
  };

  const getExamTitle = (examId: string) => {
    return currentExams.find((e) => e.id === examId)?.title || 'آزمون عمومی';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-350" id="teacher-dashboard-full">
      {toastElement}

      {/* 1. Welcome Card Hero — liquid glass with The Mark watermark */}
      <div
        className="relative overflow-hidden p-6 md:p-8 rounded-2xl glx glass-edge-strong"
        id="dashboard-hero-banner"
      >
        <div className="absolute top-0 right-0 w-[28rem] h-[28rem] bg-[var(--color-gold)]/10 rounded-full blur-[100px] filter" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[var(--color-accent-solid)]/8 rounded-full blur-[80px] filter" />

        <div className="dashboard-hero-content relative z-10">
          <div className="dashboard-hero-copy text-right">
            <span className="bg-[var(--color-glass-light-fill)] text-[var(--color-text-secondary)] text-micro font-bold px-3 py-1 rounded-full border border-[var(--color-glass-light-stroke)]">
              {formatPersianDate(new Date().toISOString())} — پنل مدیریت
            </span>
            <h2 className="text-heading-2 md:text-heading-1 font-black mt-3 leading-snug text-[var(--color-text-primary)]">
              سلام، استاد {teacher?.name || 'گرمی'} عزیز
            </h2>
            <p className="text-caption md:text-label mt-2 max-w-2xl leading-relaxed text-[var(--color-text-secondary)]">
              {formatPersianNumber(activeExams)} آزمون فعال و {formatPersianNumber(pendingGradings)}{' '}
              پاسخ‌برگ در صف تصحیح.
            </p>
          </div>
          {/* Buttons: bottom-left, with blurred Mark logo centered above */}
          <div className="dashboard-hero-controls">
            <div className="dashboard-hero-mark">
              <TheMark
                variant="row"
                size={80}
                animated={false}
                className="blur-[4px] brightness-200 invert"
              />
            </div>
            <div className="dashboard-hero-actions">
              <button
                id="hero-btn-new-exam"
                type="button"
                onClick={() => onNavigate('exams/new')}
                className="px-5 py-3 bg-[var(--color-accent-solid)] hover:bg-[var(--color-accent-solid-hover)] text-[var(--color-text-on-solid)] rounded-xl text-caption font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>طراحی آزمون نو</span>
              </button>
              <button
                id="hero-btn-questions"
                type="button"
                onClick={() => onNavigate('questions')}
                className="px-5 py-3 bg-[var(--color-glass-light-fill)] hover:bg-[var(--color-glass-light-fill)]/30 text-[var(--color-text-primary)] border border-[var(--color-glass-light-stroke)] rounded-xl text-caption font-semibold transition-all cursor-pointer"
              >
                افزودن سوال جدید
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch"
        id="dashboard-widget-pair"
      >
        {/* 2. Stats Grid (5 Cards) */}
        <div
          className="relative glx glass-edge rounded-2xl p-5 grid grid-cols-2 gap-3 content-stretch"
          id="stats-grid-layouts"
        >
          {/* Card 1: Students */}
          <Card className="flex flex-col justify-between" id="stat-card-total-students">
            <div className="flex items-center justify-between">
              <span className="text-micro font-bold text-[var(--color-text-tertiary)]">
                تعداد دانش‌آموزان
              </span>
              <div className="p-2.5 rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-heading-1 font-black text-[var(--color-text-primary)] tracking-tight leading-tight block">
                {formatPersianNumber(totalStudents)}{' '}
                <span className="text-caption font-normal text-[var(--color-text-tertiary)]">
                  نفر
                </span>
              </span>
            </div>
          </Card>

          {/* Card 2: Total Questions */}
          <Card className="flex flex-col justify-between" id="stat-card-total-questions">
            <div className="flex items-center justify-between">
              <span className="text-micro font-bold text-[var(--color-text-tertiary)]">
                تعداد کل سوالات
              </span>
              <div className="p-2.5 rounded-xl bg-[var(--color-success-soft)] text-[var(--color-success)]">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-heading-1 font-black text-[var(--color-text-primary)] tracking-tight leading-tight block">
                {formatPersianNumber(localQuestions.length)}{' '}
                <span className="text-caption font-normal text-[var(--color-text-tertiary)]">
                  سوال
                </span>
              </span>
              <span className="text-micro text-[var(--color-text-tertiary)] mt-1.5 block">
                منطبق با کتب درسی جدید
              </span>
            </div>
          </Card>

          {/* Card 3: Active Exams */}
          <Card className="flex flex-col justify-between" id="stat-card-active-exams">
            <div className="flex items-center justify-between">
              <span className="text-micro font-bold text-[var(--color-text-tertiary)]">
                آزمون‌های فعال در کلاس
              </span>
              <div className="p-2.5 rounded-xl bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-heading-1 font-black text-[var(--color-text-primary)] tracking-tight leading-tight block">
                {formatPersianNumber(activeExams)}{' '}
                <span className="text-caption font-normal text-[var(--color-text-tertiary)]">
                  آزمون
                </span>
              </span>
              <span
                className={`text-micro font-bold mt-1.5 block ${activeExams > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-tertiary)]'}`}
              >
                {activeExams > 0
                  ? 'هم‌اکنون درگاه پاسخ فعال است'
                  : 'هیچ آزمونی در حال برگزاری نیست'}
              </span>
            </div>
          </Card>

          {/* Card 4: Submissions Pending Grading */}
          <Card className="flex flex-col justify-between" id="stat-card-pending-reviews">
            <div className="flex items-center justify-between">
              <span className="text-micro font-bold text-[var(--color-text-tertiary)]">
                نیازمند تصحیح تشریحی
              </span>
              <div className="p-2.5 rounded-xl bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
                <CheckSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-heading-1 font-black text-[var(--color-text-primary)] tracking-tight leading-tight block">
                {formatPersianNumber(pendingGradings)}{' '}
                <span className="text-caption font-normal text-[var(--color-text-tertiary)]">
                  برگه
                </span>
              </span>
              <span className="text-micro text-[var(--color-danger)] font-bold mt-1.5 block">
                پاسخ‌های تشریحی در انتظار نمره
              </span>
            </div>
          </Card>

          {/* Card 5: Scheduled Exams */}
          <Card className="flex flex-col justify-between" id="stat-card-scheduled-exams">
            <div className="flex items-center justify-between">
              <span className="text-micro font-bold text-[var(--color-text-tertiary)]">
                آزمون‌های زمان‌بندی‌شده
              </span>
              <div className="p-2.5 rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <CalendarIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-heading-1 font-black text-[var(--color-text-primary)] tracking-tight leading-tight block">
                {formatPersianNumber(scheduledExams)}{' '}
                <span className="text-caption font-normal text-[var(--color-text-tertiary)]">
                  مورد
                </span>
              </span>
              <span className="text-micro text-[var(--color-text-tertiary)] mt-1.5 block">
                برنامه‌ریزی آغاز در روزهای آتی
              </span>
            </div>
          </Card>
        </div>

        {/* 3. Quick Actions Row */}
        <div className="relative glx glass-edge p-6 rounded-2xl text-right" id="quick-actions-section">
          <h3 className="text-label font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <span>اقدامات سریع</span>
          </h3>

          <div className="grid grid-cols-2 gap-3.5" id="quick-action-btns">
            <button
              type="button"
              id="qa-btn-import-excel"
              onClick={(e) => {
                excelTriggerRef.current = e.currentTarget;
                setIsExcelModalOpen(true);
              }}
              className="p-4 glx-inset hover:brightness-105 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
            >
              <div className="p-2.5 bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded-xl group-hover:scale-105 transition-transform">
                <Upload className="w-5 h-5" />
              </div>
              <span className="text-caption font-bold text-[var(--color-text-secondary)]">
                ورود از اکسل
              </span>
            </button>

            <button
              type="button"
              id="qa-btn-add-question"
              onClick={() => onNavigate('questions')}
              className="p-4 glx-inset hover:brightness-105 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
            >
              <div className="p-2.5 bg-[var(--color-success-soft)] text-[var(--color-success)] rounded-xl group-hover:scale-105 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-caption font-bold text-[var(--color-text-secondary)]">
                سوال جدید
              </span>
            </button>

            <button
              type="button"
              id="qa-btn-new-exam"
              onClick={() => onNavigate('exams/new')}
              className="p-4 glx-inset hover:brightness-105 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
            >
              <div className="p-2.5 bg-[var(--color-warning-soft)] text-[var(--color-warning)] rounded-xl group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-caption font-bold text-[var(--color-text-secondary)]">
                آزمون جدید
              </span>
            </button>

            <button
              type="button"
              id="qa-btn-view-results"
              onClick={() => onNavigate('results')}
              className="p-4 glx-inset hover:brightness-105 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
            >
              <div className="p-2.5 bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded-xl group-hover:scale-105 transition-transform">
                <Eye className="w-5 h-5" />
              </div>
              <span className="text-caption font-bold text-[var(--color-text-secondary)]">
                مشاهده نتایج
              </span>
            </button>

            <button
              type="button"
              id="qa-btn-correct-essays"
              onClick={() => onNavigate('results')}
              className="p-4 bg-[var(--color-danger-soft)]/70 hover:bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/10 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center col-span-2 group cursor-pointer"
            >
              <div className="p-2.5 bg-[var(--color-danger-solid)]/10 text-[var(--color-danger)] rounded-xl group-hover:scale-105 transition-transform">
                <CheckSquare className="w-5 h-5" />
              </div>
              <span className="text-caption font-bold text-[var(--color-danger)]">
                تصحیح تشریحی
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Core Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="dashboard-core-split">
        {/* Equal operational panels */}
        <div className="contents">
          {/* 4. Upcoming and Active Exams Section */}
          <div className="glx p-6 rounded-2xl" id="section-upcoming-exams">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-label font-bold text-[var(--color-text-primary)]">
                  آزمون‌های فعال و پیش‌رو
                </h3>
                <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
                  سنجش‌های در حال آماده‌سازی یا فعال کنونی
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('exams')}
                className="text-micro text-[var(--color-accent)] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>مدیریت آزمون‌ها</span>
                <ChevronLeft className="w-3 h-3" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {upcomingExams.length > 0 ? (
                <div className="space-y-3" id="upcoming-exams-list">
                  {upcomingExams.map((ex) => (
                    <div
                      key={ex.id}
                      className="p-4 rounded-2xl glx hover:brightness-105 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 text-right"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-caption font-bold text-[var(--color-text-primary)]">
                            {ex.title}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-md text-micro font-bold ${
                              ex.settings.mode === 'official'
                                ? 'bg-[var(--color-warning-soft)]/10 text-[var(--color-warning)] border border-[var(--color-warning)]/20'
                                : 'glx-inset text-[var(--color-text-secondary)]'
                            }`}
                          >
                            {ex.settings.mode === 'official' ? 'رسمی' : 'تمرینی'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-micro text-[var(--color-text-tertiary)]">
                          <span>پایه: {ex.grade}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-glass-light-stroke)]" />
                          <span>
                            کلاس:{' '}
                            {ex.classGroupIds
                              .map((cid) => classGroups.find((c) => c.id === cid)?.name)
                              .filter(Boolean)
                              .join(' و ')}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-glass-light-stroke)]" />
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                            {formatPersianNumber(ex.duration)} دقیقه
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-[var(--color-glass-light-stroke)]">
                        <div className="text-right sm:text-left">
                          <p className="text-micro text-[var(--color-text-tertiary)] font-medium">
                            مهلت شروع/ثبت شده
                          </p>
                          <p className="text-micro text-[var(--color-text-secondary)] font-semibold mt-0.5 dir-ltr">
                            {ex.settings.startTime
                              ? new Date(ex.settings.startTime).toLocaleTimeString('fa-IR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'نامنظم'}
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
                    <Button onClick={() => onNavigate('exams/new')} variant="primary" size="sm">
                      همین الان آزمون نو بسازید
                    </Button>
                  }
                />
              )}
            </AnimatePresence>
          </div>

          {/* 5. Recent Submissions Section */}
          <div className="glx rounded-2xl overflow-hidden" id="section-recent-submissions">
            <div className="p-6 border-b border-[var(--color-glass-light-stroke)] flex justify-between items-center">
              <div>
                <h3 className="text-label font-bold text-[var(--color-text-primary)]">
                  آخرین پاسخ‌برگ‌های ارسال شده دانش‌آموزان
                </h3>
                <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
                  سنجش‌های زنده با قابلیت تصحیح سریع معلم
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('results')}
                className="text-micro text-[var(--color-accent)] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>مشاهده نتایج</span>
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
                      { key: 'action', label: 'اقدام', align: 'center' },
                    ]}
                    data={currentSubmissions}
                    renderRow={(sub) => {
                      const exam = currentExams.find((e) => e.id === sub.examId);
                      const isGraded = sub.status === 'graded';
                      const isOngoing = sub.status === 'ongoing';
                      return (
                        <tr
                          key={sub.id}
                          className="hover:brightness-105 transition-colors text-caption md:text-label"
                        >
                          <td className="p-4 font-bold text-[var(--color-text-secondary)]">
                            {sub.studentName}
                          </td>
                          <td className="p-4 text-[var(--color-text-tertiary)] font-semibold">
                            {getStudentClassLabel(sub.studentId)}
                          </td>
                          <td className="p-4 font-medium text-[var(--color-text-secondary)] max-w-xs truncate">
                            {getExamTitle(sub.examId)}
                          </td>
                          <td className="p-4 text-center text-[var(--color-text-tertiary)] font-medium">
                            {sub.submittedAt
                              ? new Date(sub.submittedAt).toLocaleTimeString('fa-IR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'درجریان'}
                          </td>
                          <td className="p-4 text-center">
                            <StatusBadge status={sub.status} />
                          </td>
                          <td className="p-4 text-center font-bold text-[var(--color-text-primary)]">
                            {isOngoing
                              ? '-'
                              : `${formatPersianNumber(sub.score)} / ${formatPersianNumber(sub.maxScore)}`}
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
                              variant={isGraded ? 'primary' : 'danger'}
                              size="sm"
                              disabled={isOngoing}
                            >
                              {isGraded
                                ? 'ویرایش نمره‌دهی'
                                : isOngoing
                                  ? 'درگاه زنده'
                                  : 'تصحیح ورقه'}
                            </Button>
                          </td>
                        </tr>
                      );
                    }}
                    renderMobileCard={(sub) => {
                      const exam = currentExams.find((e) => e.id === sub.examId);
                      const isGraded = sub.status === 'graded';
                      const isOngoing = sub.status === 'ongoing';
                      return (
                        <Card
                          hoverable
                          key={sub.id}
                          className="p-4 space-y-3"
                          id={`submission-mob-card-${sub.id}`}
                        >
                          <div className="flex justify-between items-center text-caption">
                            <span className="font-bold text-[var(--color-text-primary)]">
                              {sub.studentName}
                            </span>
                            <StatusBadge status={sub.status} />
                          </div>
                          <div className="text-micro text-[var(--color-text-tertiary)] space-y-1">
                            <p>کلاس: {getStudentClassLabel(sub.studentId)}</p>
                            <p>آزمون: {getExamTitle(sub.examId)}</p>
                            <p>
                              زمان ارسال:{' '}
                              {sub.submittedAt
                                ? new Date(sub.submittedAt).toLocaleTimeString('fa-IR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'در جریان'}
                            </p>
                            <p className="font-bold text-[var(--color-accent)] font-mono">
                              نمره:{' '}
                              {isOngoing
                                ? '-'
                                : `${formatPersianNumber(sub.score)} / ${formatPersianNumber(sub.maxScore)}`}
                            </p>
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
                              variant={isGraded ? 'primary' : 'danger'}
                              size="sm"
                              disabled={isOngoing}
                              className="w-full"
                            >
                              {isGraded
                                ? 'ویرایش نمره‌دهی'
                                : isOngoing
                                  ? 'درگاه زنده'
                                  : 'تصحیح ورقه'}
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
                      onClick={(e) => {
                        excelTriggerRef.current = e.currentTarget;
                        setIsExcelModalOpen(true);
                      }}
                      variant="primary"
                      size="sm"
                    >
                      بارگذاری اکسل دانش‌آموزان
                    </Button>
                  }
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <StudentImportWizard
        open={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        triggerRef={excelTriggerRef}
        classGroups={classGroups}
        existingStudents={currentStudents}
        onImported={addImportedStudents}
      />
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
