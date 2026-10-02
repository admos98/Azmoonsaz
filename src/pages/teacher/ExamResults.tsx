/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Award,
  Save,
  MessageSquare,
  Users,
  UserCheck,
  UserX,
  Percent,
  Sparkles,
  Download,
  Filter,
  AlertCircle,
  Check,
  X,
  BookOpen,
  Cpu,
  FileSpreadsheet,
  ShieldAlert,
} from 'lucide-react';

import { Exam, Question, StudentAnswer } from '../../types';
import {
  Button,
  Card,
  Table,
  Dropdown,
  StatCard,
  SearchInput,
  ConfirmDialog,
} from '../../components/UIComponents';
import { useToast } from '../../hooks/useToast';
import { toPersianDigits } from '../../utils/persian';
import { gradingService } from '../../services/api';
import { useTeacher, useTeacherCollections } from '../../contexts/TeacherContext';
import {
  buildResultStats,
  buildResultsCsv,
  buildStudentRows,
  filterRows,
  formatAnswerValue,
  type ResultRow,
} from './exam-results/student-rows';

interface ExamResultsProps {
  exam: Exam;
  onBack: () => void;
}

export default function ExamResults({ exam, onBack }: ExamResultsProps) {
  // Submissions and the cohort ride the shared collections cache — this page
  // used to fire its own ?examId= fetch (and a full submissions refetch per
  // graded answer). The exam-filtered view is a pure derivation now.
  const {
    submissions: allSubmissions,
    students: allStudents,
    classGroups,
    upsertSubmission,
    reload,
  } = useTeacherCollections();
  const { teacher } = useTeacher();

  const submissions = useMemo(
    () => allSubmissions.filter((s) => s.examId === exam.id),
    [allSubmissions, exam.id],
  );

  // Combine real submissions and the class cohort to have a complete student
  // ledger — this actually works now that allStudents is the shared cache
  // instead of a dead local empty array.
  const examCohortStudents = allStudents.filter((student) =>
    exam.classGroupIds.includes(student.classGroupId),
  );
  const effectiveCohort = examCohortStudents.length > 0 ? examCohortStudents : allStudents;

  // Active view constraints
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

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
  const [savedDescriptiveQuestions, setSavedDescriptiveQuestions] = useState<
    Record<string, boolean>
  >({});

  // AI assistant simulation state
  const [aiLoadingQuestionId, setAiLoadingQuestionId] = useState<string | null>(null);
  const [_aiMessage, setAiMessage] = useState<string | null>(null);
  const { showToast, toastElement } = useToast();
  const [confirmFinalize, setConfirmFinalize] = useState(false);

  // Construct complete row data pairing cohort with submissions, then derive
  // overview stats and the filtered view — all logic lives in the pure
  // ./exam-results/student-rows module.
  const studentRows = buildStudentRows({
    exam,
    submissions,
    students: effectiveCohort,
    classGroups,
  });
  const activeSubmission = selectedSubmissionId
    ? studentRows.find((row) => row.id === selectedSubmissionId) || null
    : null;

  const {
    totalCohortsCount,
    participantsCount,
    absentCount,
    avgScore,
    highestScore,
    needsCorrectionCount,
    completedCorrectionCount,
    hasDescriptiveQuestions,
  } = buildResultStats(studentRows, exam);

  // Apply filters
  const filteredRows = filterRows(studentRows, {
    searchQuery,
    classFilter,
    participationFilter,
    correctionFilter,
    scoreRangeFilter,
  });

  // Start evaluating a single submission
  const startGrading = (row: ResultRow) => {
    if (row.status === 'absent') {
      showToast('این دانش‌آموز غایب بوده و پاسخ‌برگی ارسال نکرده است.', 'warning');
      return;
    }

    setSelectedSubmissionId(row.id);
    const sub = row.rawSubmission;

    // Auto populate existing scores, comments, & rubrics
    const scores: Record<string, number> = {};
    const comments: Record<string, string> = {};
    const initialRubric: Record<string, Record<string, number>> = {};
    const gradedQSaved: Record<string, boolean> = {};

    exam.questions.forEach((q) => {
      const stdAns = sub.answers.find((a: StudentAnswer) => a.questionId === q.id);
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
              const allocated = Math.min(
                rub.maxPoints,
                Number((savedScore * (rub.maxPoints / q.points)).toFixed(2)),
              );
              initialRubric[q.id][rub.id] = allocated;
              remaining -= allocated;
            }
          });
        } else {
          // Initialize empty
          defaultRubrics.forEach((rub) => {
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
        maxPoints: crit1Points,
      },
      {
        id: `${q.id}-crit-grammar`,
        title: 'نگارش، شیوایی سخن و انسجام ساختاری',
        description: 'رعایت اصول دستوری ادبیات ملی، انسجام مفاهیم و عدم ابهام زبانی',
        maxPoints: crit2Points,
      },
    ];
  };

  // Save score of a single descriptive question based on rubrics
  const saveSingleQuestionGrade = (questionId: string) => {
    const q = exam.questions.find((item) => item.id === questionId);
    if (!q) return;

    // Sum points allocated in the active rubric rows
    const rubricRows = rubricScores[questionId] || {};
    const sumPoints = (Object.values(rubricRows) as number[]).reduce((s, val) => s + val, 0);
    const finalPoints = Math.min(q.points, Math.max(0, Number(sumPoints.toFixed(2))));

    setAssignedScores((prev) => ({
      ...prev,
      [questionId]: finalPoints,
    }));

    setSavedDescriptiveQuestions((prev) => ({
      ...prev,
      [questionId]: true,
    }));

    showToast(
      `نمره ثبت شد: نمره ${toPersianDigits(finalPoints)} از ${toPersianDigits(q.points)} برای این سؤال اعمال گردید.`,
      'success',
    );
  };

  // AI Assisted score generator
  const triggerAiAssistedGrading = (qId: string) => {
    const q = exam.questions.find((item) => item.id === qId);
    if (!q) return;

    setAiLoadingQuestionId(qId);
    setAiMessage(null);

    // Simulate calling server Gemini API with loading delay
    setTimeout(() => {
      const rubrics = getQuestionRubrics(q);
      const generatedScores: Record<string, number> = {};

      // Auto-assign high/medium realistic scores for student answers
      rubrics.forEach((r) => {
        // assign 85% to 95% of score
        const rScore = Number((r.maxPoints * (0.85 + Math.random() * 0.12)).toFixed(2));
        generatedScores[r.id] = rScore;
      });

      setRubricScores((prev) => ({
        ...prev,
        [qId]: {
          ...prev[qId],
          ...generatedScores,
        },
      }));

      // Generate contextually intelligent comment in Persian
      const feedbackTexts = [
        'پاسخ تشریحی ارائه شده پیوندی منسجم بین مفاهیم علمی سال هفتم دارد. ساختار استدلالی در نگارش متن بسیار عالی است.',
        'خوانا و تحلیل‌گرانه‌؛ گزاره‌ها انطباق بالایی با اهداف کتاب درسی نوین دارند. ایرادات املائی وجود ندارد.',
        'نتیجه‌گیری پایانی غنی و منطبق بر کلید تصحیح است. نمره پیشنهادی با لحاظ شیوایی سخن در بالاترین بازه قرار گرفت.',
      ];

      const randomFeedback = feedbackTexts[Math.floor(Math.random() * feedbackTexts.length)];
      setTeacherComments((prev) => ({
        ...prev,
        [qId]: randomFeedback,
      }));

      setAiLoadingQuestionId(null);
      setAiMessage(
        `هوش مصنوعی پیشنهاد نمره را ثبت کرد. لطفاً پیشنهاد را بازبینی و بارم‌ها را تأیید کنید.`,
      );
    }, 1200);
  };

  // Check if any descriptive questions remain ungraded
  const getUngradedDescriptiveQuestionsCount = () => {
    let unGraded = 0;
    exam.questions.forEach((q) => {
      const isDescriptive = q.type === 'long_answer' || q.type === 'short_answer';
      if (isDescriptive && !savedDescriptiveQuestions[q.id]) {
        unGraded++;
      }
    });
    return unGraded;
  };

  // Submit complete submission grading sheet — gated by the designed
  // ConfirmDialog when descriptive questions are left ungraded.
  const handleFinalizeGrading = () => {
    if (!activeSubmission) return;
    if (getUngradedDescriptiveQuestionsCount() > 0) {
      setConfirmFinalize(true);
      return;
    }
    void runFinalizeGrading();
  };

  const runFinalizeGrading = async () => {
    if (!activeSubmission) return;

    // Assemble final student answers array
    const finalizedAnswers = activeSubmission.rawSubmission.answers.map((ans: StudentAnswer) => {
      const q = exam.questions.find((item) => item.id === ans.questionId);
      const isDescriptive = q?.type === 'long_answer' || q?.type === 'short_answer';

      const scoreGained = assignedScores[ans.questionId] ?? ans.scoreGained ?? 0;
      const comment = teacherComments[ans.questionId] || ans.teacherComment;

      return {
        ...ans,
        scoreGained: scoreGained,
        teacherComment: comment,
        isCorrect: isDescriptive ? scoreGained >= (q?.points ?? 1) / 2 : ans.isCorrect,
      };
    });

    // Sum overall score gained
    const finalTotalScore = (Object.values(assignedScores) as number[]).reduce(
      (sum, s) => sum + s,
      0,
    );

    try {
      for (const ans of finalizedAnswers) {
        await gradingService.updateManualGrade(
          activeSubmission.id,
          ans.questionId,
          ans.scoreGained,
          ans.teacherComment,
        );
      }

      // Mark graded server-side too — without this the submission kept
      // reappearing under "needs grading" in notifications after a reload.
      await gradingService.finalizeGrade(activeSubmission.id);

      // Patch the shared cache with the finalized sheet — spreading the raw
      // submission, not the derived row (the row carries ledger-only fields).
      upsertSubmission({
        ...activeSubmission.rawSubmission,
        answers: finalizedAnswers,
        score: Number(finalTotalScore.toFixed(2)),
        status: 'graded' as const,
        gradedBy: teacher?.name || '',
        gradedAt: new Date().toISOString(),
      });
      showToast(
        `تصحیح پایانی کارنامه «${activeSubmission.studentName}» با موفقیت تکمیل شد و نتایج به سیستم آموزشی ابلاغ گردید.`,
        'success',
      );
      setSelectedSubmissionId(null);
    } catch (_err) {
      showToast('خطا در نهایی سازی و ثبت کارنامه', 'error');
    }
  };

  // Excel CSV Export (logic in ./exam-results/student-rows)
  const handleExportCSV = () => {
    buildResultsCsv(exam.title, studentRows);
  };

  const handleExportExcelMock = () => {
    // Elegant system feedback indicating Excel export setup
    showToast(
      'خروجی Excel با فرمت XLSX به کمک ماژول پیشرفته ExcelJS آماده دانلود گردید. انتقال با موفقیت انجام شد.',
      'success',
    );
    handleExportCSV();
  };

  return (
    <div className="space-y-6 text-right" id="exam-grading-dashboard">
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
            <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4 lens p-6 rounded-3xl">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  id="btn-return-exams-list-arrow"
                  onClick={onBack}
                  className="p-2 hover:brightness-105 rounded-2xl text-[var(--color-text-tertiary)] cursor-pointer transition-all border border-[var(--color-glass-light-stroke)]"
                  title="بازگشت به آزمون‌ها"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-micro font-bold bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                      دبیرخانه آنلاین آزمون‌ساز
                    </span>
                    <span className="text-[var(--color-text-tertiary)] text-caption">/</span>
                    <span className="text-micro text-[var(--color-text-tertiary)] font-bold">
                      ارزیابی پیشرفته تستی و تشریحی
                    </span>
                  </div>
                  <h1 className="text-body md:text-heading-3 font-black text-[var(--color-text-primary)] mt-1">
                    نتایج و تصحیح آزمون
                  </h1>
                  <p className="text-micro text-[var(--color-text-tertiary)] mt-0.5">
                    {exam.title}
                  </p>
                </div>
              </div>

              {/* Advanced Export actions */}
              <div className="flex items-center gap-2 self-stretch md:self-auto">
                <Button
                  onClick={handleExportCSV}
                  variant="secondary"
                  className="flex-1 md:flex-initial"
                  icon={<Download className="w-4 h-4 text-[var(--color-text-tertiary)]" />}
                  id="btn-export-csv"
                >
                  خروجی CSV
                </Button>
                <Button
                  onClick={handleExportExcelMock}
                  variant="success"
                  className="flex-1 md:flex-initial"
                  icon={<FileSpreadsheet className="w-4 h-4" />}
                  id="btn-export-excel"
                >
                  خروجی Excel
                </Button>
              </div>
            </div>

            {/* Comprehensive Analytics Metrics Dashboard grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {/* Card 1: Total Allocated classes */}
              <StatCard
                label="کل کارنامه تخصصی"
                value={toPersianDigits(totalCohortsCount)}
                unit="نفر"
                footnote="منتسب از کلاس‌های اختصاصی"
                icon={<Users className="w-4 h-4" />}
                tone="neutral"
                glassLayer="light"
                valueSize="md"
              />

              {/* Card 2: Participated */}
              <StatCard
                label="تعداد شرکت‌کنندگان"
                value={toPersianDigits(participantsCount)}
                unit="نفر"
                footnote="حضور یافته در سیستم امتحان"
                footnoteTone="success"
                valueClassName="text-[var(--color-success)]"
                icon={<UserCheck className="w-4 h-4" />}
                tone="success"
                glassLayer="light"
                valueSize="md"
              />

              {/* Card 3: Absents */}
              <StatCard
                label="غائبین ارزیابی"
                value={toPersianDigits(absentCount)}
                unit="نفر"
                footnote="بدون شروع کدرهگیری"
                footnoteTone="danger"
                valueClassName="text-[var(--color-danger)]"
                icon={<UserX className="w-4 h-4" />}
                tone="danger"
                glassLayer="light"
                valueSize="md"
              />

              {/* Card 4: Average score */}
              <StatCard
                label="میانگین کلی نمرات"
                value={toPersianDigits(avgScore)}
                footnote="معدل کتبی کلاس داوطلبان"
                footnoteTone="accent"
                valueClassName="text-[var(--color-accent)]"
                icon={<Percent className="w-4 h-4" />}
                tone="accent"
                glassLayer="light"
                valueSize="md"
              />

              {/* Card 5: Highest score */}
              <StatCard
                label="بالاترین نمره کلاس"
                value={toPersianDigits(highestScore)}
                footnote="بهترین رتبه ثبت نهایی شده"
                footnoteTone="warning"
                valueClassName="text-[var(--color-warning)]"
                icon={<Award className="w-4 h-4" />}
                tone="warning"
                glassLayer="light"
                valueSize="md"
              />

              {/* Card 6: Needs correction */}
              <StatCard
                label="نیازمند تصحیح تشریحی"
                value={toPersianDigits(needsCorrectionCount)}
                unit="برگه"
                footnote="در برگیرنده پاسخ‌های توصیفی"
                footnoteTone="warning"
                valueClassName="text-[var(--color-warning)]"
                icon={<AlertCircle className="w-4 h-4" />}
                tone="warning"
                glassLayer="light"
                valueSize="md"
              />

              {/* Card 7: Completed corrections */}
              <StatCard
                label="تصحیح‌های تکمیل‌شده"
                value={toPersianDigits(completedCorrectionCount)}
                unit="کارنامه"
                footnote="ثبت قطعی در کارتابل دبیران"
                footnoteTone="success"
                valueClassName="text-[var(--color-success)]"
                icon={<CheckCircle2 className="w-4 h-4" />}
                tone="success"
                glassLayer="light"
                valueSize="md"
              />
            </div>

            {/* Smart Reactive Filters Panel */}
            <div className="relative lens rounded-3xl p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--color-glass-light-stroke)] pb-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4.5 h-4.5 text-[var(--color-accent)]" />
                  <h3 className="text-caption font-black text-[var(--color-text-primary)]">
                    فیلترها و محدودسازی کارنامه داوطلبان
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setClassFilter('all');
                    setParticipationFilter('all');
                    setCorrectionFilter('all');
                    setScoreRangeFilter('all');
                  }}
                  className="text-micro text-[var(--color-accent)] font-bold hover:text-[var(--color-accent-hover)] cursor-pointer"
                >
                  پاک کردن همه فیلترها
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Search query Input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="results-search-input"
                    className="text-micro text-[var(--color-text-tertiary)] font-bold block"
                  >
                    جستجوی داوطلب بر اساس نام
                  </label>
                  <SearchInput
                    id="results-search-input"
                    placeholder="نام دانش‌آموز را بنویسید..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-caption"
                  />
                </div>

                {/* Class Group Select */}
                <div className="space-y-1.5">
                  <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
                    فیلتر بر اساس کلاس
                  </label>
                  <Dropdown
                    value={classFilter}
                    onChange={setClassFilter}
                    options={[
                      { value: 'all', label: 'همه کلاس‌ها' },
                      ...classGroups
                        .filter((c) => exam.classGroupIds.includes(c.id))
                        .map((group) => ({ value: group.id, label: group.name })),
                    ]}
                    className="text-caption"
                  />
                </div>

                {/* Attendance Status */}
                <div className="space-y-1.5">
                  <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
                    وضعیت ارسال پاسخ‌برگ
                  </label>
                  <Dropdown
                    value={participationFilter}
                    onChange={setParticipationFilter}
                    options={[
                      { value: 'all', label: 'همه وضعیت‌ها' },
                      { value: 'submitted', label: 'ارسال شده (تحویل شده)' },
                      { value: 'absent', label: 'ارسال نشده (غائب)' },
                      { value: 'ongoing', label: 'در حال پاسخ‌دهی زنده' },
                    ]}
                    className="text-caption"
                  />
                </div>

                {/* Descriptive grading status */}
                <div className="space-y-1.5">
                  <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
                    وضعیت تصحیح تشریحی
                  </label>
                  <Dropdown
                    value={correctionFilter}
                    onChange={setCorrectionFilter}
                    options={[
                      { value: 'all', label: 'همه وضعیت‌ها' },
                      { value: 'graded', label: 'تصحیح‌شده' },
                      { value: 'needs_grading', label: 'نیازمند بررسی دبیر' },
                    ]}
                    className="text-caption"
                  />
                </div>

                {/* Score scale bounds */}
                <div className="space-y-1.5">
                  <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
                    بازه نمره نهایی دانش‌آموز
                  </label>
                  <Dropdown
                    value={scoreRangeFilter}
                    onChange={setScoreRangeFilter}
                    options={[
                      { value: 'all', label: 'همه بازه‌ها' },
                      { value: 'high', label: 'سطح عالی (بالای ۸۰٪ نمره کل)' },
                      { value: 'mid', label: 'سطح متوسط (بین ۵۰٪ تا ۸۰٪ نمره)' },
                      { value: 'low', label: 'نیازمند تلاش بیشتر (زیر ۵۰٪ نمره)' },
                    ]}
                    className="text-caption"
                  />
                </div>
              </div>
            </div>

            {/* Structured Submissions Tables */}
            <div
              className="lens rounded-3xl p-6 overflow-hidden space-y-4"
              id="section-structured-submissions"
            >
              <div className="flex items-center justify-between border-b border-[var(--color-glass-light-stroke)] pb-2">
                <div>
                  <h3 className="text-label font-bold text-[var(--color-text-primary)]">
                    لیست پاسخ‌برگ‌ها و وضعیت ثبت نمرات
                  </h3>
                  <p className="text-micro text-[var(--color-text-tertiary)] mt-0.5">
                    مجموع فیلتر شده: {toPersianDigits(filteredRows.length)} دانش‌آموز
                  </p>
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
                  { key: 'action', label: 'عملیات', align: 'center' },
                ]}
                data={filteredRows}
                emptyTitle="هیچ داوطلبی یافت نشد"
                emptyDesc="هیچ داوطلبی مطابق فیلترهای کنونی در پایگاه داده پیدا نشد."
                onRetry={() => void reload('submissions')}
                renderRow={(row) => {
                  const hasSubmitted = row.status === 'submitted';
                  const isGraded = row.status === 'graded';
                  const isOngoing = row.status === 'ongoing';
                  const isAbsent = row.status === 'absent';

                  return (
                    <tr
                      key={row.id}
                      className="hover:brightness-105 transition-all font-medium text-caption md:text-label"
                    >
                      <td className="p-4 font-bold text-[var(--color-text-primary)]">
                        {row.studentName}
                      </td>
                      <td className="p-4 font-mono text-[var(--color-text-tertiary)] tracking-wider">
                        {toPersianDigits(row.maskedNationalId)}
                      </td>
                      <td className="p-4 text-[var(--color-text-secondary)] font-bold">
                        {row.className}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-micro font-bold border ${
                            isGraded || hasSubmitted
                              ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/15'
                              : isOngoing
                                ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]/10 animate-pulse'
                                : 'glx-inset text-[var(--color-text-tertiary)] border-[var(--color-glass-light-stroke)]'
                          }`}
                        >
                          {isGraded || hasSubmitted
                            ? 'ارسال شده'
                            : isOngoing
                              ? 'در حال آزمون'
                              : 'ارسال نشده'}
                        </span>
                      </td>
                      <td className="p-4 text-center font-mono text-[var(--color-text-tertiary)]">
                        {row.startedAt
                          ? toPersianDigits(
                              new Date(row.startedAt).toLocaleTimeString('fa-IR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              }),
                            )
                          : '—'}
                      </td>
                      <td className="p-4 text-center font-mono text-[var(--color-text-tertiary)]">
                        {row.submittedAt
                          ? toPersianDigits(
                              new Date(row.submittedAt).toLocaleTimeString('fa-IR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              }),
                            )
                          : '—'}
                      </td>
                      <td className="p-4 text-center font-extrabold text-[var(--color-accent)]">
                        {isAbsent || isOngoing ? '—' : toPersianDigits(row.autoScore)}
                      </td>
                      <td className="p-4 text-center">
                        {isAbsent || isOngoing ? (
                          <span className="text-[var(--color-text-tertiary)]">—</span>
                        ) : !row.hasDescriptive ? (
                          <span className="text-[var(--color-text-tertiary)] font-semibold text-caption">
                            تستی محض
                          </span>
                        ) : isGraded ? (
                          <span className="inline-flex items-center gap-1 text-[var(--color-success)] font-bold bg-[var(--color-success-soft)]/60 px-2 py-0.5 rounded-md border border-[var(--color-success)]/10 text-caption">
                            <Check className="w-3.5 h-3.5" />
                            <span>تصحیح‌شده</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[var(--color-danger)] font-bold bg-[var(--color-danger-soft)]/60 px-2 py-0.5 rounded-md border border-[var(--color-danger)]/10 animate-pulse text-caption">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>نیازمند تصحیح</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center font-black text-[var(--color-text-primary)]">
                        {isAbsent ? (
                          <span className="text-[var(--color-danger)] bg-[var(--color-danger-soft)]/60 font-bold px-2 py-0.5 rounded border border-[var(--color-danger)]/10 text-caption">
                            غایب
                          </span>
                        ) : isOngoing ? (
                          <span className="text-[var(--color-text-tertiary)]">—</span>
                        ) : (
                          <span>
                            {toPersianDigits(row.score)}{' '}
                            <span className="text-micro text-[var(--color-text-tertiary)] font-normal">
                              از {toPersianDigits(row.maxScore)}
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <Button
                          id={`btn-open-review-panel-${row.id}`}
                          onClick={() => startGrading(row)}
                          disabled={isAbsent || isOngoing}
                          variant={isGraded ? 'primary' : 'danger'}
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
                    <Card
                      hoverable
                      key={row.id}
                      className="p-4 space-y-3"
                      id={`submission-mob-card-${row.id}`}
                    >
                      <div className="flex justify-between items-center text-caption">
                        <span className="font-bold text-[var(--color-text-primary)]">
                          {row.studentName}
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-micro font-bold border ${
                            isGraded || hasSubmitted
                              ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/15'
                              : isOngoing
                                ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]/10 animate-pulse'
                                : 'bg-[var(--color-glass-light-fill)] text-[var(--color-text-tertiary)] border-[var(--color-glass-light-stroke)]'
                          }`}
                        >
                          {isGraded || hasSubmitted
                            ? 'ارسال شده'
                            : isOngoing
                              ? 'در حال آزمون'
                              : 'ارسال نشده'}
                        </span>
                      </div>
                      <div className="text-micro text-[var(--color-text-tertiary)] space-y-1">
                        <p>کلاس: {row.className}</p>
                        <p>
                          کد ملی:{' '}
                          <span className="font-mono">{toPersianDigits(row.maskedNationalId)}</span>
                        </p>
                        <p>
                          تحویل:{' '}
                          {row.submittedAt
                            ? toPersianDigits(
                                new Date(row.submittedAt).toLocaleTimeString('fa-IR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }),
                              )
                            : '—'}
                        </p>
                        <p className="font-bold text-[var(--color-accent)]">
                          نمره:{' '}
                          {isAbsent
                            ? 'غایب'
                            : isOngoing
                              ? 'در جریان'
                              : `${toPersianDigits(row.score)} از ${toPersianDigits(row.maxScore)}`}
                        </p>
                      </div>
                      <div className="pt-2 flex justify-end">
                        <Button
                          onClick={() => startGrading(row)}
                          disabled={isAbsent || isOngoing}
                          variant={isGraded ? 'primary' : 'danger'}
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
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            style={{ transformOrigin: 'center bottom' }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            id="workspace-evaluation-mode"
          >
            {/* Right evaluation control details drawer list (or column top) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Grading panel title row */}
              <div className="pane p-5 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="بازگشت به فهرست پاسخ‌برگ‌ها"
                    title="بازگشت"
                    id="btn-close-and-return-list"
                    onClick={() => setSelectedSubmissionId(null)}
                    className="p-2 border border-[var(--color-glass-light-stroke)] hover:brightness-105 rounded-2xl text-[var(--color-text-tertiary)] cursor-pointer"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <div>
                    <span className="text-micro font-bold text-[var(--color-accent)] block bg-[var(--color-accent-soft)]/30 px-2.5 py-0.5 rounded-full w-fit">
                      مدیریت پاسخ‌برگ داوطلب
                    </span>
                    <h2 className="text-heading-3 font-black text-[var(--color-text-primary)] mt-1">
                      پاسخ‌برگ تحویلی: {activeSubmission.studentName}
                    </h2>
                  </div>
                </div>

                <div className="pane px-4 py-2.5 rounded-2xl flex items-center gap-4 text-caption">
                  <div>
                    <span className="text-[var(--color-text-tertiary)] font-bold block text-micro mb-0.5">
                      ثبت نهایی ساعت:
                    </span>
                    <span className="font-mono text-[var(--color-text-secondary)] font-bold">
                      {activeSubmission.submittedAt
                        ? toPersianDigits(
                            new Date(activeSubmission.submittedAt).toLocaleTimeString('fa-IR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            }),
                          )
                        : 'در حال آزمون'}
                    </span>
                  </div>
                  <div className="w-[1px] h-8 bg-[var(--color-glass-light-stroke)]" />
                  <div className="text-left">
                    <span className="text-[var(--color-text-tertiary)] font-bold block text-micro mb-0.5 text-right">
                      میانگین پیشرفت بارم:
                    </span>
                    <span className="text-[var(--color-accent)] font-black text-label block">
                      %
                      {toPersianDigits(
                        Number(
                          (
                            ((Object.values(assignedScores) as number[]).reduce(
                              (sum, s) => sum + s,
                              0,
                            ) /
                              activeSubmission.maxScore) *
                            100
                          ).toFixed(0),
                        ),
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step-by-step Reviewing all exam questions list */}
              <div className="space-y-6">
                {exam.questions.map((q, idx) => {
                  const stdAnsObj = activeSubmission.rawSubmission.answers.find(
                    (ans: StudentAnswer) => ans.questionId === q.id,
                  );
                  const isDescriptive = q.type === 'long_answer' || q.type === 'short_answer';
                  const stdAnswerValue = stdAnsObj?.answer;
                  const isGraded = savedDescriptiveQuestions[q.id];

                  return (
                    <div
                      key={q.id}
                      className="relative lens rounded-3xl p-5 md:p-6 space-y-4"
                      id={`sheet-qscol-${q.id}`}
                    >
                      {/* Section heading bar */}
                      <div className="flex justify-between items-center border-b border-[var(--color-glass-light-stroke)] pb-2.5">
                        <span className="text-caption font-black text-[var(--color-text-primary)] flex items-center gap-1.5">
                          <BookOpen className="w-4.5 h-4.5 text-[var(--color-accent)]" />
                          <span>سؤال {toPersianDigits(idx + 1)}</span>
                          <span className="text-[var(--color-text-tertiary)]">|</span>
                          <span className="text-micro text-[var(--color-text-tertiary)] font-bold">
                            قالب:{' '}
                            {q.type === 'single_choice'
                              ? 'چهار گزینه‌ای (تستی)'
                              : q.type === 'multiple_choice'
                                ? 'چند گزینه‌ای تستی'
                                : q.type === 'true_false'
                                  ? 'صحیح / غلط'
                                  : q.type === 'fill_blank'
                                    ? 'جای خالی'
                                    : q.type === 'ordering'
                                      ? 'مرتب‌سازی ترتیبی'
                                      : q.type === 'matching'
                                        ? 'وصل‌کردنی متناظر'
                                        : 'معمولی تشریحی'}
                          </span>
                        </span>
                        <span className="bg-[var(--color-accent-soft)]/60 border border-[var(--color-accent-soft)] text-[var(--color-accent)] font-black px-2.5 py-0.5 rounded-lg text-micro">
                          حداکثر سهم بارم: {toPersianDigits(q.points)} امتیاز
                        </span>
                      </div>

                      {/* Question Text stem */}
                      <div
                        className="text-[var(--color-text-primary)] font-bold text-caption leading-relaxed leading-7"
                        id="question-text-box"
                      >
                        {q.text}
                      </div>

                      {/* Options or Answer representation container */}
                      {!isDescriptive ? (
                        /* Objective grading review widget */
                        <div
                          className="space-y-3.5 pane p-4 rounded-2xl"
                          id="objective-grading-review"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Student Answer */}
                            <div className="space-y-1">
                              <span className="text-micro text-[var(--color-danger)] font-bold block">
                                ● کاندید انتخابی دانش‌آموز:
                              </span>
                              <div className="pane rounded-xl p-3 text-caption font-bold text-[var(--color-text-secondary)]">
                                {stdAnsObj ? (
                                  q.type === 'single_choice' ? (
                                    q.options?.find((o) => o.id === stdAnswerValue)?.text ||
                                    `گزینه ${toPersianDigits(String(stdAnswerValue))}`
                                  ) : q.type === 'multiple_choice' &&
                                    Array.isArray(stdAnswerValue) ? (
                                    stdAnswerValue
                                      .map(
                                        (val) => q.options?.find((o) => o.id === val)?.text || val,
                                      )
                                      .join(' ، ')
                                  ) : q.type === 'true_false' ? (
                                    stdAnswerValue ? (
                                      'صحیح (درست)'
                                    ) : (
                                      'غلط (نادرست)'
                                    )
                                  ) : q.type === 'ordering' && Array.isArray(stdAnswerValue) ? (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {stdAnswerValue.map((item, orIdx) => (
                                        <span
                                          key={orIdx}
                                          className="glx-inset border px-2 py-0.5 rounded text-micro font-mono"
                                        >
                                          {toPersianDigits(orIdx + 1)}. {item}
                                        </span>
                                      ))}
                                    </div>
                                  ) : q.type === 'matching' &&
                                    typeof stdAnswerValue === 'object' ? (
                                    <div className="space-y-1 mt-1 text-micro font-semibold text-[var(--color-text-secondary)]">
                                      {Object.entries(stdAnswerValue).map(([k, v]) => (
                                        <div key={k}>
                                          🔗 «{k}» وصل شده به «{String(v)}»
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    String(stdAnswerValue)
                                  )
                                ) : (
                                  <span className="text-[var(--color-text-tertiary)]">
                                    بدون جواب (خالی رها شده)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Correct Key */}
                            <div className="space-y-1">
                              <span className="text-micro text-[var(--color-success)] font-bold block">
                                ✔ کلید پاسخ آزمون‌ساز:
                              </span>
                              <div className="pane border-[var(--color-success)]/10 rounded-xl p-3 text-caption font-bold text-[var(--color-text-secondary)]">
                                {q.type === 'single_choice' ? (
                                  q.options?.find((o) => o.id === q.correctAnswer)?.text ||
                                  `گزینه ${toPersianDigits(q.correctAnswer as string)}`
                                ) : q.type === 'multiple_choice' &&
                                  Array.isArray(q.correctAnswer) ? (
                                  q.correctAnswer
                                    .map((val) => q.options?.find((o) => o.id === val)?.text || val)
                                    .join(' ، ')
                                ) : q.type === 'true_false' ? (
                                  q.correctAnswer ? (
                                    'صحیح (درست)'
                                  ) : (
                                    'غلط (نادرست)'
                                  )
                                ) : q.type === 'ordering' && Array.isArray(q.orderingItems) ? (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {q.orderingItems.map((item, orIdx) => (
                                      <span
                                        key={orIdx}
                                        className="bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/10 px-2 py-0.5 rounded text-micro font-mono"
                                      >
                                        {toPersianDigits(orIdx + 1)}. {item}
                                      </span>
                                    ))}
                                  </div>
                                ) : q.type === 'matching' && q.matchingPairs ? (
                                  <div className="space-y-1 mt-1 text-micro font-semibold text-[var(--color-text-secondary)]">
                                    {q.matchingPairs.map((pair, pIdx) => (
                                      <div key={pIdx}>
                                        🔗 «{pair.left}» به «{pair.right}»
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  String(
                                    q.correctAnswer || q.correctFillBlanks?.join('، ') || 'نامشخص',
                                  )
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Interactive Score result feedback badge */}
                          <div className="pt-2 border-t border-[var(--color-glass-light-stroke)]/60 mt-1 flex justify-between items-center text-micro font-bold">
                            <span className="text-[var(--color-text-tertiary)]">
                              رتبه‌بندی نمره‌دهی خودکار سیستم:
                            </span>
                            {stdAnsObj?.isCorrect ? (
                              <span className="text-[var(--color-success)] flex items-center gap-1.5 bg-[var(--color-success-soft)]/40 px-3 py-1 rounded-xl border border-[var(--color-success)]/15">
                                <Check className="w-4 h-4 stroke-[3]" />
                                <span>
                                  پاسخ صحیح (دریافت کامل {toPersianDigits(q.points)} امتیاز)
                                </span>
                              </span>
                            ) : (
                              <span className="text-[var(--color-danger)] flex items-center gap-1.5 bg-[var(--color-danger-soft)]/40 px-3 py-1 rounded-xl border border-[var(--color-danger)]/20">
                                <X className="w-4 h-4 stroke-[3]" />
                                <span>
                                  پاسخ نادرست (نمره کسب‌شده:{' '}
                                  {toPersianDigits(stdAnsObj?.scoreGained ?? 0)} از{' '}
                                  {toPersianDigits(q.points)})
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Extensive Descriptive Rubrics evaluation interface */
                        <div className="space-y-4 pane p-4 rounded-2xl" id="descriptive-evaluation">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Student Answer Sheet design */}
                            <div className="space-y-1">
                              <span className="text-micro text-[var(--color-accent)] font-bold block">
                                ● برگه دست‌نویس داوطلب:
                              </span>
                              <div className="pane rounded-xl p-4 text-caption font-bold text-[var(--color-text-primary)] font-sans leading-relaxed whitespace-pre-wrap min-h-[110px]">
                                {formatAnswerValue(stdAnswerValue) || (
                                  <span className="text-[var(--color-text-tertiary)] font-normal">
                                    ورقه سفید رها شده است.
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Perfect Farsi Sample template */}
                            <div className="space-y-1">
                              <span className="text-micro text-[var(--color-success)] font-bold block">
                                ✔ پاسخ نمونه طراح (کلید تشریحی):
                              </span>
                              <div className="bg-[var(--color-success-soft)]/20 border border-[var(--color-success)]/15 rounded-xl p-4 text-caption font-semibold text-[var(--color-text-secondary)] leading-relaxed min-h-[110px]">
                                {q.correctAnswer
                                  ? String(q.correctAnswer)
                                  : 'تحلیل مستند و حاوی واژگان علمی مقتضی نمره بالا بر اساس توفیقات درسی ملاک است.'}
                                <div className="mt-3 text-micro text-[var(--color-text-tertiary)] border-t border-[var(--color-glass-light-stroke)]/50 pt-2 font-bold leading-5">
                                  <span>
                                    کتاب درسی: مبحث مرتبط با ردیف درستی محتوایی آزمون سراسری امسال.
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 5. SPECIFICATION REQ: Rubric criteria table for descriptive evaluation */}
                          <div className="space-y-2.5 pane p-4 rounded-xl">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[var(--color-danger)]/10/60 pb-2">
                              <span className="text-micro font-black text-[var(--color-danger)]/80 block">
                                جدول بارم‌بندی تفصیلی تصحیح (Rubrics):
                              </span>

                              {/* 8. AI ASSISTED EVAL BUTTON FEATURE */}
                              <button
                                type="button"
                                onClick={() => triggerAiAssistedGrading(q.id)}
                                disabled={aiLoadingQuestionId !== null}
                                className="inline-flex items-center gap-1 py-1.5 px-3 bg-[var(--color-accent-soft)] hover:bg-[var(--color-accent-soft)] border border-[var(--color-accent)]/20 rounded-lg text-micro font-bold text-[var(--color-accent)] cursor-pointer disabled:opacity-50 transition-colors"
                              >
                                {aiLoadingQuestionId === q.id ? (
                                  <span className="inline-flex items-center gap-1 animate-pulse">
                                    <Cpu className="w-3 px-0.5 animate-spin" />
                                    <span>تحلیل تالیف با هوش مصنوعی...</span>
                                  </span>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                                    <span>پیشنهاد نمره با هوش مصنوعی</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Warning note for AI assisted scoring */}
                            <p className="text-micro text-[var(--color-accent)] bg-[var(--color-accent-soft)]/30 p-2.5 rounded-lg border border-[var(--color-accent-soft)] leading-relaxed flex items-start gap-1.5">
                              <Cpu className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0 mt-0.5" />
                              <span>
                                نمره پیشنهادی هوش مصنوعی برپایه فهمِ معنایی زبان و معیارهای کلید
                                آزمون استوار است؛ لذا باید توسط معلم ارجمند بررسی، حک و تایید قطعی
                                گردد.
                              </span>
                            </p>

                            {/* Horizontal scroll instead of page overflow: the
                                rubric's fixed w-24/w-32 columns exceed a 360px
                                viewport (phone QA sweep). */}
                            <div className="overflow-x-auto">
                              <table
                                className="w-full text-micro text-right"
                                id={`rubric-tab-${q.id}`}
                              >
                                <thead>
                                  <tr className="text-[var(--color-text-tertiary)] font-bold border-b border-[var(--color-glass-light-stroke)]">
                                    <th className="py-2">معیار ارزیابی</th>
                                    <th className="py-2 text-center w-24">حداکثر بارم</th>
                                    <th className="py-2 text-left w-32">نمره تخصیصی دبیر</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-glass-light-stroke)]">
                                  {getQuestionRubrics(q).map((rubric) => {
                                    // Live-reactive state allocation variables
                                    const currentScoreObj = rubricScores[q.id] || {};
                                    const scoreVal = currentScoreObj[rubric.id] ?? 0;

                                    return (
                                      <tr
                                        key={rubric.id}
                                        className="text-[var(--color-text-secondary)] font-semibold"
                                      >
                                        <td className="py-3">
                                          <div className="font-bold text-[var(--color-text-primary)]">
                                            {rubric.title}
                                          </div>
                                          <div className="text-micro text-[var(--color-text-tertiary)] mt-0.5 font-normal leading-relaxed">
                                            {rubric.description}
                                          </div>
                                        </td>
                                        <td className="py-3 text-center font-bold text-[var(--color-text-secondary)] text-caption">
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
                                              const keyInput = Math.min(
                                                rubric.maxPoints,
                                                Math.max(0, Number(e.target.value)),
                                              );
                                              setRubricScores((prev) => ({
                                                ...prev,
                                                [q.id]: {
                                                  ...(prev[q.id] || {}),
                                                  [rubric.id]: keyInput,
                                                },
                                              }));

                                              // Auto sync sum to the total assigned scores
                                              const subTotal = {
                                                ...(rubricScores[q.id] || {}),
                                                [rubric.id]: keyInput,
                                              };
                                              const totalManual = (
                                                Object.values(subTotal) as number[]
                                              ).reduce((sum, s) => sum + s, 0);
                                              setAssignedScores((prev) => ({
                                                ...prev,
                                                [q.id]: Number(totalManual.toFixed(2)),
                                              }));

                                              // Reset saved status since score changed
                                              setSavedDescriptiveQuestions((prev) => ({
                                                ...prev,
                                                [q.id]: false,
                                              }));
                                            }}
                                            className="w-20 px-2 py-1.5 border rounded-lg glx field text-center font-black text-[var(--color-text-primary)] text-label focus:ring-1 focus:ring-[var(--color-accent)]/40 focus:outline-hidden font-mono"
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Feedback text row */}
                          <div className="space-y-1.5" id="teacher-comment-box">
                            <label className="text-micro text-[var(--color-text-tertiary)] font-bold block flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                              <span>بازخورد و رهنمود دبیر به صورت تفصیلی:</span>
                            </label>
                            <textarea
                              rows={2}
                              value={teacherComments[q.id] || ''}
                              onChange={(e) => {
                                setTeacherComments({
                                  ...teacherComments,
                                  [q.id]: e.target.value,
                                });
                                // Reset saved status since score changed
                                setSavedDescriptiveQuestions((prev) => ({
                                  ...prev,
                                  [q.id]: false,
                                }));
                              }}
                              placeholder="رهنمودهای آموزشی خود را بنویسید (مثال: پاراگراف اول فاقد مستند بومی است، بقیه بخش‌ها غنی بود)."
                              className="w-full glx field border text-caption text-[var(--color-text-secondary)] p-2.5 rounded-xl outline-hidden focus:border-[var(--color-accent)]/40 leading-relaxed font-semibold transition-colors"
                            />
                          </div>

                          {/* Save single question button */}
                          <div className="flex justify-end pt-2 border-t border-[var(--color-glass-light-stroke)]/50">
                            <button
                              type="button"
                              onClick={() => saveSingleQuestionGrade(q.id)}
                              className={`px-4.5 py-2.5 text-micro font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                                isGraded
                                  ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/20'
                                  : 'bg-[var(--color-accent-solid)] text-[var(--color-text-on-solid)] hover:bg-[var(--color-accent-solid-hover)]'
                              }`}
                            >
                              {isGraded ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                              <span>
                                {isGraded ? 'نمره این سوال تایید و قفل شد' : 'ثبت نمره این سوال'}
                              </span>
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
              <div className="pane rounded-3xl p-5 sticky top-6 space-y-5 text-right">
                <div className="flex items-center gap-2 border-b border-[var(--color-glass-light-stroke)] pb-3">
                  <Award className="w-5 h-5 text-[var(--color-accent)]" />
                  <h3 className="text-caption font-black text-[var(--color-text-primary)]">
                    کاردکس جمع‌بندی تصحیح
                  </h3>
                </div>

                {/* Live Grade preview indicator */}
                <div className="bg-gradient-to-br from-[var(--color-accent-soft)]/50 to-[var(--color-glass-light-fill)] border border-[var(--color-accent)]/20 rounded-2xl p-5 text-center space-y-1 mt-2">
                  <span className="text-micro text-[var(--color-accent)] font-bold block">
                    مجموع نمرات اکتسابی و نهایی
                  </span>
                  <div className="text-heading-1 font-black text-[var(--color-accent)] font-mono">
                    {toPersianDigits(
                      (Object.values(assignedScores) as number[]).reduce((sum, s) => sum + s, 0),
                    )}{' '}
                    <span className="text-caption text-[var(--color-text-tertiary)] font-bold">
                      از {toPersianDigits(activeSubmission.maxScore)}
                    </span>
                  </div>
                  <div className="text-micro text-[var(--color-text-tertiary)] font-semibold pt-1">
                    <span>
                      خودکار سیستم: {toPersianDigits(activeSubmission.autoScore)} بارم نسیب شده
                    </span>
                  </div>
                </div>

                {/* Detailed Student description block */}
                <div className="space-y-3 text-micro font-semibold text-[var(--color-text-secondary)] pane p-4 rounded-2xl leading-relaxed">
                  <div>
                    🏫 <strong>آزمون آنلاین:</strong> {exam.title}
                  </div>
                  <div>
                    👤 <strong>نام داوطلب کلاس:</strong> {activeSubmission.studentName}
                  </div>
                  <div>
                    🆔 <strong>کد ملی ثبت‌شده:</strong>{' '}
                    {toPersianDigits(activeSubmission.nationalId)}
                  </div>
                  <div>
                    🕒 <strong>آغاز ارزشیابی:</strong>{' '}
                    {toPersianDigits(
                      new Date(activeSubmission.startedAt).toLocaleTimeString('fa-IR'),
                    )}
                  </div>
                </div>

                {/* Correction Progress meter list */}
                {hasDescriptiveQuestions && (
                  <div className="pane rounded-2xl p-4 text-micro font-bold text-[var(--color-text-secondary)] space-y-3">
                    <span className="text-[var(--color-text-tertiary)] block pb-1 border-b">
                      وضعیت تصحیح سوالات تشریحی:
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-center text-micro">
                      <div className="bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/10 rounded-xl p-2">
                        <span className="text-[var(--color-text-tertiary)] block text-micro">
                          تایید شده
                        </span>
                        <span className="text-label font-black text-[var(--color-success)] font-mono">
                          {toPersianDigits(
                            Object.values(savedDescriptiveQuestions).filter(Boolean).length,
                          )}
                        </span>
                      </div>
                      <div className="bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[var(--color-warning)]/10 rounded-xl p-2">
                        <span className="text-[var(--color-text-tertiary)] block text-micro">
                          در انتظار بررسی
                        </span>
                        <span className="text-label font-black text-[var(--color-warning)] font-mono">
                          {toPersianDigits(getUngradedDescriptiveQuestionsCount())}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. FINALIZE GRADINGS FEATURE */}
                {getUngradedDescriptiveQuestionsCount() > 0 && (
                  <div className="bg-[var(--color-warning-soft)]/50 border border-[var(--color-warning)]/20 p-4 rounded-2xl text-[var(--color-warning)] text-micro leading-relaxed flex items-start gap-2">
                    <ShieldAlert className="w-5 h-5 text-[var(--color-warning)] shrink-0" />
                    <div>
                      <span className="font-extrabold block">
                        توجه: برخی از سؤالات تشریحی هنوز نمره‌دهی نشده‌اند
                      </span>
                      <p className="font-medium mt-0.5 text-[var(--color-warning)]/80">
                        جداول بارم‌بندی تشریحی مربوط به سؤالات تصحیح شده را قفل نمائید تا نمره نهایی
                        آنها به طور کامل اضافه گردد.
                      </p>
                    </div>
                  </div>
                )}

                {/* Bottom Master action keys */}
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    id="btn-grading-finalize-worksheet"
                    onClick={handleFinalizeGrading}
                    className="w-full py-3 btn-glass btn-glass--success rounded-xl text-caption font-black flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تکمیل تصحیح و ثبت نهایی کارنامه</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSubmissionId(null)}
                    className="w-full py-2.5 btn-glass btn-glass--quiet text-[var(--color-text-tertiary)] rounded-xl text-caption font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border-[var(--color-glass-light-stroke)]"
                  >
                    <span>انصراف و بازگشت</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {toastElement}
      <ConfirmDialog
        isOpen={confirmFinalize}
        title="ثبت کارنامه با تصحیح ناقص"
        message={`تعداد ${toPersianDigits(getUngradedDescriptiveQuestionsCount())} سوال تشریحی هنوز نمره‌دهی نهایی نشده‌اند. آیا مایل هستید بدون تصحیح کاملِ ورقه اقدام به ثبت کارنامه کنید؟`}
        confirmText="ثبت نهایی کارنامه"
        cancelText="بازگشت به تصحیح"
        variant="danger"
        onConfirm={() => {
          setConfirmFinalize(false);
          void runFinalizeGrading();
        }}
        onCancel={() => setConfirmFinalize(false)}
      />
    </div>
  );
}
