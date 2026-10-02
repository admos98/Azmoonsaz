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
  CalendarDays,
  Upload,
  Eye,
  BookOpen,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  StatusBadge,
  EmptyState,
  Table,
  StatCard,
} from '../../components/UIComponents';
import { TheMark } from '../../components/TheMark';
import { formatPersianNumber, formatPersianDate } from '../../services/persianHelpers';
import { useTeacher, useTeacherCollections } from '../../contexts/TeacherContext';
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
    addStudents,
  } = useTeacherCollections();

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
    <div className="space-y-6" id="teacher-dashboard-full">
      {toastElement}

      {/* 1. Welcome Card Hero — liquid glass with The Mark watermark */}
      <div
        className="relative overflow-hidden p-6 md:p-10 rounded-3xl lens"
        id="dashboard-hero-banner"
      >
        <div className="absolute top-0 right-0 w-[28rem] h-[28rem] bg-[var(--color-gold)]/10 rounded-full blur-[100px] filter" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[var(--color-accent-solid)]/8 rounded-full blur-[80px] filter" />

        <div className="dashboard-hero-content relative z-10">
          <div className="dashboard-hero-copy text-right">
            <span className="text-[var(--color-text-secondary)] text-micro font-bold tracking-wide px-0 py-1 block w-fit opacity-80">
              {formatPersianDate(new Date().toISOString())} — پنل مدیریت
            </span>
            <h2 className="text-heading-2 md:text-display font-black mt-3 leading-tight text-[var(--color-text-primary)]">
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
              {/* Per-theme filter/opacity lives in .dashboard-hero-mark (CSS) —
                  the mark must not carry its own dark-slab legacy filters. */}
              <TheMark variant="row" size={80} animated={false} />
            </div>
            <div className="dashboard-hero-actions">
              <button
                id="hero-btn-new-exam"
                type="button"
                onClick={() => onNavigate('exams/new')}
                className="px-5 py-3 btn-glass btn-glass--primary rounded-xl text-caption font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>طراحی آزمون نو</span>
              </button>
              <button
                id="hero-btn-questions"
                type="button"
                onClick={() => onNavigate('questions')}
                className="px-5 py-3 btn-glass btn-glass--primary text-[var(--color-text-primary)] rounded-xl text-caption font-semibold transition-all cursor-pointer"
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
          className="relative lens rounded-2xl p-5 grid grid-cols-2 gap-3 content-stretch"
          id="stats-grid-layouts"
        >
          {/* Card 1: Students */}
          <StatCard
            id="stat-card-total-students"
            label="تعداد دانش‌آموزان"
            value={formatPersianNumber(totalStudents)}
            unit="نفر"
            icon={<Users className="w-4 h-4" />}
            tone="accent"
          />

          {/* Card 2: Total Questions */}
          <StatCard
            id="stat-card-total-questions"
            label="تعداد کل سوالات"
            value={formatPersianNumber(localQuestions.length)}
            unit="سوال"
            footnote="منطبق با کتب درسی جدید"
            icon={<BookOpen className="w-4 h-4" />}
            tone="success"
          />

          {/* Card 3: Active Exams */}
          <StatCard
            id="stat-card-active-exams"
            label="آزمون‌های فعال در کلاس"
            value={formatPersianNumber(activeExams)}
            unit="آزمون"
            footnote={
              activeExams > 0 ? 'هم‌اکنون درگاه پاسخ فعال است' : 'هیچ آزمونی در حال برگزاری نیست'
            }
            footnoteTone={activeExams > 0 ? 'warning' : 'neutral'}
            icon={<Clock className="w-4 h-4" />}
            tone="warning"
          />

          {/* Card 4: Submissions Pending Grading */}
          <StatCard
            id="stat-card-pending-reviews"
            label="نیازمند تصحیح تشریحی"
            value={formatPersianNumber(pendingGradings)}
            unit="برگه"
            footnote="پاسخ‌های تشریحی در انتظار نمره"
            footnoteTone="danger"
            icon={<CheckSquare className="w-4 h-4" />}
            tone="danger"
          />

          {/* Card 5: Scheduled Exams */}
          <StatCard
            id="stat-card-scheduled-exams"
            label="آزمون‌های زمان‌بندی‌شده"
            value={formatPersianNumber(scheduledExams)}
            unit="مورد"
            footnote="برنامه‌ریزی آغاز در روزهای آتی"
            icon={<CalendarDays className="w-4 h-4" />}
            tone="accent"
          />
        </div>

        {/* 3. Quick Actions Row */}
        <div className="relative lens p-6 rounded-2xl text-right" id="quick-actions-section">
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
              className="p-4 btn-glass rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
            >
              <div className="p-2.5 glx-inset glx-inset-clear text-[var(--color-accent)] rounded-xl group-hover:scale-105 transition-transform">
                <Upload className="w-5 h-5" />
              </div>
              <span className="text-caption font-bold text-[var(--color-text-primary)]">
                ورود از اکسل
              </span>
            </button>

            <button
              type="button"
              id="qa-btn-add-question"
              onClick={() => onNavigate('questions')}
              className="p-4 btn-glass rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
            >
              <div className="p-2.5 glx-inset glx-inset-clear text-[var(--color-success)] rounded-xl group-hover:scale-105 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-caption font-bold text-[var(--color-text-primary)]">
                سوال جدید
              </span>
            </button>

            <button
              type="button"
              id="qa-btn-new-exam"
              onClick={() => onNavigate('exams/new')}
              className="p-4 btn-glass rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
            >
              <div className="p-2.5 glx-inset glx-inset-clear text-[var(--color-warning)] rounded-xl group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-caption font-bold text-[var(--color-text-primary)]">
                آزمون جدید
              </span>
            </button>

            <button
              type="button"
              id="qa-btn-view-results"
              onClick={() => onNavigate('results')}
              className="p-4 btn-glass rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group cursor-pointer"
            >
              <div className="p-2.5 glx-inset glx-inset-clear text-[var(--color-accent)] rounded-xl group-hover:scale-105 transition-transform">
                <Eye className="w-5 h-5" />
              </div>
              <span className="text-caption font-bold text-[var(--color-text-primary)]">
                مشاهده نتایج
              </span>
            </button>

            <button
              type="button"
              id="qa-btn-correct-essays"
              onClick={() => onNavigate('results')}
              className="p-4 btn-glass rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all text-center col-span-2 group cursor-pointer"
            >
              <div className="p-2.5 glx-inset glx-inset-clear bg-[var(--color-danger)]/15 text-[var(--color-danger)] rounded-xl group-hover:scale-105 transition-transform">
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
          <div className="lens p-6 rounded-3xl" id="section-upcoming-exams">
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
                      className="p-4 rounded-2xl pane transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 text-right"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-caption font-bold text-[var(--color-text-primary)]">
                            {ex.title}
                          </h4>
                          <Badge variant={ex.settings.mode === 'official' ? 'warning' : 'slate'}>
                            {ex.settings.mode === 'official' ? 'رسمی' : 'تمرینی'}
                          </Badge>
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
          <div className="lens rounded-3xl overflow-hidden" id="section-recent-submissions">
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
        onImported={addStudents}
      />
    </div>
  );
}
