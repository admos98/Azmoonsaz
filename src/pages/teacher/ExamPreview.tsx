/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  Eye,
  Award,
  AlertCircle,
  Sliders,
  Check,
  PlusCircle,
  Trash2,
  Edit,
  Info,
  ChevronUp,
  ChevronDown,
  CheckCircle,
  RefreshCw,
  X,
  FileText,
  HelpCircle,
  Layers,
  Plus,
  Trash,
  Settings2,
} from 'lucide-react';
import {
  Exam,
  Question,
  QuestionType,
  QuestionOption,
  QuestionPart,
  RubricCriterion,
  ClassGroup,
} from '../../types';
import { classService, questionService } from '../../services/api';
import { Dropdown } from '../../components/UIComponents';
import { useOriginFromTrigger } from '../../hooks/useOriginFromTrigger';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { motion, AnimatePresence } from 'motion/react';
import { toPersianDigits } from '../../utils/persian';

interface ExamPreviewProps {
  exam: Exam;
  onBack: () => void;
  onSave?: (updatedExam: Exam) => void;
  onNavigateToSettings?: (updatedExam: Exam) => void;
}

const createDraftQuestionId = (prefix: 'q-rep' | 'q-man') => `${prefix}-${crypto.randomUUID()}`;

interface ValidationWarning {
  id: string;
  type:
    | 'no_correct_answer'
    | 'no_points'
    | 'descriptive_no_rubric'
    | 'section_no_question'
    | 'image_missing';
  message: string;
  targetId: string; // questionId or sectionId
  targetName: string;
}

export default function ExamPreview({
  exam,
  onBack,
  onSave,
  onNavigateToSettings,
}: ExamPreviewProps) {
  // Local reactive exam state
  const [localExam, setLocalExam] = useState<Exam>({ ...exam });
  const [savedFingerprint, setSavedFingerprint] = useState(() => JSON.stringify(exam));
  const hasUnsavedChanges = JSON.stringify(localExam) !== savedFingerprint;
  const confirmDiscard = useUnsavedChanges(hasUnsavedChanges);
  const handleBack = () => confirmDiscard(onBack);

  // Mode state: 'teacher' (معلم) or 'student' (دانش‌آموز)
  const [viewMode, setViewMode] = useState<'teacher' | 'student'>('teacher');

  // Student response Simulation State (interactive inputs)
  const [studentAnswers, setStudentAnswers] = useState<Record<string, any>>({}); // eslint-disable-line @typescript-eslint/no-explicit-any

  // Active question being edited in drawer/modal (null means closed)
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const drawerPanelRef = useRef<HTMLDivElement>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);
  // Area-blur halo: bigger negative-inset box, same viewport origin point —
  // the hook measures and returns its origin alongside the panel's.
  const drawerHaloRef = useRef<HTMLDivElement>(null);
  const [drawerOrigin, drawerHaloOrigin] = useOriginFromTrigger(
    drawerTriggerRef,
    drawerPanelRef,
    editingQuestion !== null,
    drawerHaloRef,
  );
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [targetSectionIdForNew, setTargetSectionIdForNew] = useState<string>('');

  // Search/Filter matching compatibility on replacing (null means closed)
  const [replacingQuestionId, setReplacingQuestionId] = useState<string | null>(null);
  const [replacingSectionId, setReplacingSectionId] = useState<string | null>(null);
  const [replaceFilterGrade, setReplaceFilterGrade] = useState<string>('all');
  const [replaceFilterSubject, setReplaceFilterSubject] = useState<string>('all');
  const [replaceFilterType, setReplaceFilterType] = useState<string>('all');
  const [replaceFilterDifficulty, setReplaceFilterDifficulty] = useState<string>('all');
  const [replaceSearchQuery, setReplaceSearchQuery] = useState<string>('');
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  useEffect(() => {
    classService
      .getClassGroups()
      .then(setClassGroups)
      .catch(() => {});
    questionService
      .getQuestions()
      .then(setBankQuestions)
      .catch(() => {});
  }, []);

  // Persian digit converter helper

  const getDifficultyLabel = (diff: string | undefined): string => {
    if (diff === 'easy') return 'آسان';
    if (diff === 'medium') return 'متوسط';
    if (diff === 'hard') return 'سخت';
    return 'متوسط';
  };

  const getDifficultyColor = (diff: string | undefined): string => {
    if (diff === 'easy')
      return 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/15';
    if (diff === 'hard')
      return 'bg-[var(--color-danger-soft)]/40 text-[var(--color-danger)] border-[var(--color-danger)]/20';
    return 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]/20';
  };

  const getTypeNameInPersian = (type: QuestionType | undefined): string => {
    if (!type) return '';
    const names: Record<QuestionType, string> = {
      single_choice: 'چهارگزینه‌ای تک‌پاسخ',
      multiple_choice: 'چندگزینه‌ای چندپاسخ',
      true_false: 'درست / نادرست',
      matching: 'وصل‌کردنی',
      ordering: 'مرتب‌سازی',
      fill_blank: 'جای خالی',
      short_answer: 'پاسخ کوتاه',
      long_answer: 'تشریحی بلند',
      cloze: 'کلوز تست',
      reading_comprehension: 'درک مطلب متنی',
      image_based: 'سوال تصویری',
    };
    return names[type] || 'طرح عمومی';
  };

  // 1. Dynamic Validation System — pure derived state
  const warnings = (() => {
    const list: ValidationWarning[] = [];

    // Analyze empty sections
    localExam.sections.forEach((sec) => {
      if (!sec.questionIds || sec.questionIds.length === 0) {
        list.push({
          id: `sec-em-${sec.id}`,
          type: 'section_no_question',
          message: `بخش «${sec.title}» صدمه دیده یا فاقد هرگونه سوال انتصابی است.`,
          targetId: sec.id,
          targetName: sec.title,
        });
      }
    });

    // Analyze individual questions
    localExam.questions.forEach((q) => {
      // No grade/points check
      if (q.points === undefined || q.points <= 0) {
        list.push({
          id: `q-pt-${q.id}`,
          type: 'no_points',
          message: `سوال «${q.title || 'بدون مشخصه'}» فاقد امتیاز یا بارم عددی است (نمره صفر یا نامعتبر).`,
          targetId: q.id,
          targetName: q.title,
        });
      }

      // No correct answers configured (choice based)
      if (['single_choice', 'multiple_choice', 'true_false', 'image_based'].includes(q.type)) {
        if (q.type === 'true_false' && q.correctAnswer === undefined) {
          list.push({
            id: `q-key-tf-${q.id}`,
            type: 'no_correct_answer',
            message: `سوال درست/نادرست «${q.title}» فاقد کلید ارزش پاسخ صحیح فرضی است.`,
            targetId: q.id,
            targetName: q.title,
          });
        } else if (['single_choice', 'image_based'].includes(q.type) && !q.correctAnswer) {
          list.push({
            id: `q-key-sc-${q.id}`,
            type: 'no_correct_answer',
            message: `سوال چهارگزینه‌ای «${q.title}» فاقد گزینه کلید پاسخ صحیح معرفی شده است.`,
            targetId: q.id,
            targetName: q.title,
          });
        } else if (
          q.type === 'multiple_choice' &&
          (!Array.isArray(q.correctAnswer) || q.correctAnswer.length === 0)
        ) {
          list.push({
            id: `q-key-mc-${q.id}`,
            type: 'no_correct_answer',
            message: `سوال چندگزینه‌ای چندپاسخ «${q.title}» فاقد حداقل یک کلید درست است.`,
            targetId: q.id,
            targetName: q.title,
          });
        }
      }

      // Long answer without rubric metrics
      if (q.type === 'long_answer' && (!q.rubrics || q.rubrics.length === 0)) {
        list.push({
          id: `q-rub-${q.id}`,
          type: 'descriptive_no_rubric',
          message: `سوال تشریحی تشخیصی «${q.title}» فاقد معیارهای ارزیابی (بارم‌بندی روان) است.`,
          targetId: q.id,
          targetName: q.title,
        });
      }

      // Image Based missing media
      if (q.type === 'image_based' && !q.imageUrl) {
        list.push({
          id: `q-img-${q.id}`,
          type: 'image_missing',
          message: `سوال تصویری «${q.title}» تصویر یا نمودار پیوست بارگذاری شده معتبری ندارد.`,
          targetId: q.id,
          targetName: q.title,
        });
      }
    });

    return list;
  })();

  // Total scores summary
  const totalScore = localExam.questions.reduce((sum, q) => sum + (q.points || 0), 0);
  const totalQuestions = localExam.questions.length;

  // Assigned Classes String Lookup
  const getAssignedClassesString = () => {
    if (!localExam.classGroupIds || localExam.classGroupIds.length === 0)
      return 'به کلاسی تخصیص داده نشده';
    return localExam.classGroupIds
      .map((cid) => classGroups.find((c) => c.id === cid)?.name)
      .filter(Boolean)
      .join(' و ');
  };

  // Move Question up/down inside section allocation index
  const moveQuestion = (questionId: string, direction: 'up' | 'down') => {
    // Find section containing it
    const updatedSections = localExam.sections.map((sec) => {
      if (sec.questionIds.includes(questionId)) {
        const idx = sec.questionIds.indexOf(questionId);
        const newQuestionIds = [...sec.questionIds];
        if (direction === 'up' && idx > 0) {
          // Swap with previous
          const temp = newQuestionIds[idx - 1];
          newQuestionIds[idx - 1] = newQuestionIds[idx];
          newQuestionIds[idx] = temp;
        } else if (direction === 'down' && idx < newQuestionIds.length - 1) {
          // Swap with next
          const temp = newQuestionIds[idx + 1];
          newQuestionIds[idx + 1] = newQuestionIds[idx];
          newQuestionIds[idx] = temp;
        }
        return { ...sec, questionIds: newQuestionIds };
      }
      return sec;
    });

    setLocalExam({
      ...localExam,
      sections: updatedSections,
    });
  };

  // Delete question from section and questions array
  const deleteQuestion = (questionId: string) => {
    const confirmed = window.confirm('آیا از حذف این سوال از برگه آزمون مطمئن هستید؟');
    if (!confirmed) return;

    const updatedSections = localExam.sections.map((sec) => ({
      ...sec,
      questionIds: sec.questionIds.filter((id) => id !== questionId),
    }));

    const updatedQuestions = localExam.questions.filter((q) => q.id !== questionId);

    setLocalExam({
      ...localExam,
      sections: updatedSections,
      questions: updatedQuestions,
    });
  };

  // Open Replace Question Dialogue box
  const triggerReplaceQuestion = (questionId: string, sectionId: string) => {
    setReplacingQuestionId(questionId);
    setReplacingSectionId(sectionId);
    setReplaceFilterGrade(localExam.grade || 'all');
    setReplaceFilterSubject(localExam.subject || 'all');
    setReplaceFilterType('all');
    setReplaceFilterDifficulty('all');
    setReplaceSearchQuery('');
  };

  const handleExecuteReplacement = (selectedBankQ: Question) => {
    if (!replacingQuestionId || !replacingSectionId) return;

    // Build replacement
    const randId = createDraftQuestionId('q-rep');
    const clonedQ: Question = { ...selectedBankQ, id: randId };

    // Update in questions array
    const updatedQuestions = localExam.questions.map((q) =>
      q.id === replacingQuestionId ? clonedQ : q,
    );

    // Update in section arrays list
    const updatedSections = localExam.sections.map((sec) => {
      if (sec.id === replacingSectionId) {
        return {
          ...sec,
          questionIds: sec.questionIds.map((qid) => (qid === replacingQuestionId ? randId : qid)),
        };
      }
      return sec;
    });

    setLocalExam({
      ...localExam,
      questions: updatedQuestions,
      sections: updatedSections,
    });

    setReplacingQuestionId(null);
    setReplacingSectionId(null);
  };

  // Open Edit Dialog Drawer for existing question, or create new question representation
  const triggerEditQuestion = (q: Question, trigger?: HTMLElement) => {
    drawerTriggerRef.current = trigger ?? null;
    setEditingQuestion({ ...q });
    setIsAddingNew(false);
  };

  const triggerAddManualQuestion = (sectionId: string, trigger?: HTMLElement) => {
    drawerTriggerRef.current = trigger ?? null;
    setTargetSectionIdForNew(sectionId);
    setEditingQuestion({
      id: createDraftQuestionId('q-man'),
      title: 'عنوان سوال جدید',
      text: 'صورت سوال را در اینجا یادداشت کنید.',
      type: 'single_choice',
      points: 2,
      category: localExam.subject,
      grade: localExam.grade,
      options: [
        { id: 'o1', text: 'گزینه اول تستی', isCorrect: true },
        { id: 'o2', text: 'گزینه دوم تستی', isCorrect: false },
        { id: 'o3', text: 'گزینه سوم تستی', isCorrect: false },
        { id: 'o4', text: 'گزینه چهارم تستی', isCorrect: false },
      ],
      rubrics: [],
      parts: [],
    });
    setIsAddingNew(true);
  };

  // Handle drawer update changes safely
  const handleSaveDrawerQuestion = () => {
    if (!editingQuestion || !editingQuestion.id) return;

    const validatedQ: Question = {
      id: editingQuestion.id,
      type: editingQuestion.type || 'single_choice',
      title: editingQuestion.title || 'سوال تازه',
      text: editingQuestion.text || 'بدون متن',
      points: Number(editingQuestion.points) || 0,
      category: editingQuestion.category || localExam.subject,
      grade: editingQuestion.grade || localExam.grade,
      options: editingQuestion.options,
      matchingPairs: editingQuestion.matchingPairs,
      orderingItems: editingQuestion.orderingItems,
      correctFillBlanks: editingQuestion.correctFillBlanks,
      correctAnswer: editingQuestion.correctAnswer,
      imageUrl: editingQuestion.imageUrl,
      parts: editingQuestion.parts,
      rubrics: editingQuestion.rubrics,
      createdAt: editingQuestion.createdAt || new Date().toISOString(),
    };

    if (isAddingNew) {
      // Append questioning to dynamic container list
      const updatedQuestions = [...localExam.questions, validatedQ];
      const updatedSections = localExam.sections.map((sec) => {
        if (sec.id === targetSectionIdForNew) {
          return {
            ...sec,
            questionIds: [...sec.questionIds, validatedQ.id],
          };
        }
        return sec;
      });

      setLocalExam({
        ...localExam,
        questions: updatedQuestions,
        sections: updatedSections,
      });
    } else {
      const updatedQuestions = localExam.questions.map((q) =>
        q.id === validatedQ.id ? validatedQ : q,
      );
      setLocalExam({
        ...localExam,
        questions: updatedQuestions,
      });
    }

    setEditingQuestion(null);
  };

  // Option row controls in edit question drawer
  const updateOptionTextInDrawer = (optId: string, text: string) => {
    if (!editingQuestion || !editingQuestion.options) return;
    const nextOpts = editingQuestion.options.map((o) => (o.id === optId ? { ...o, text } : o));
    setEditingQuestion({ ...editingQuestion, options: nextOpts });
  };

  const toggleOptionCorrectInDrawer = (optId: string) => {
    if (!editingQuestion || !editingQuestion.options) return;
    const isSingle = ['single_choice', 'image_based'].includes(editingQuestion.type || '');

    let nextOpts: QuestionOption[];
    if (isSingle) {
      nextOpts = editingQuestion.options.map((o) => ({
        ...o,
        isCorrect: o.id === optId,
      }));
      setEditingQuestion({
        ...editingQuestion,
        options: nextOpts,
        correctAnswer: optId,
      });
    } else {
      nextOpts = editingQuestion.options.map((o) =>
        o.id === optId ? { ...o, isCorrect: !o.isCorrect } : o,
      );
      const multipleCorrectKeys = nextOpts.filter((o) => o.isCorrect).map((o) => o.id);
      setEditingQuestion({
        ...editingQuestion,
        options: nextOpts,
        correctAnswer: multipleCorrectKeys,
      });
    }
  };

  const addNewOptionInDrawer = () => {
    if (!editingQuestion) return;
    const currentOpts = editingQuestion.options || [];
    const newOptId = `o-rand-${Date.now()}`;
    const nextOpts: QuestionOption[] = [
      ...currentOpts,
      {
        id: newOptId,
        text: `گزینه تستی شماره ${toPersianDigits(currentOpts.length + 1)}`,
        isCorrect: false,
      },
    ];
    setEditingQuestion({ ...editingQuestion, options: nextOpts });
  };

  const removeOptionInDrawer = (optId: string) => {
    if (!editingQuestion || !editingQuestion.options) return;
    const nextOpts = editingQuestion.options.filter((o) => o.id !== optId);
    setEditingQuestion({ ...editingQuestion, options: nextOpts });
  };

  // Subquestions parts control list inside drawer
  const addNewSubquestionPartInDrawer = () => {
    if (!editingQuestion) return;
    const currentParts = editingQuestion.parts || [];
    const newPart: QuestionPart = {
      id: `p-part-${Date.now()}`,
      text: 'زیرسوال درک مطلب جدید',
      type: 'single_choice',
      options: [
        { id: 'po1', text: 'گزینه الف زیرسوال', isCorrect: true },
        { id: 'po2', text: 'گزینه ب زیرسوال', isCorrect: false },
      ],
      correctAnswer: 'po1',
    };
    setEditingQuestion({
      ...editingQuestion,
      parts: [...currentParts, newPart],
    });
  };

  const removeSubquestionPartInDrawer = (partId: string) => {
    if (!editingQuestion || !editingQuestion.parts) return;
    setEditingQuestion({
      ...editingQuestion,
      parts: editingQuestion.parts.filter((p) => p.id !== partId),
    });
  };

  const updateSubquestionTextInDrawer = (partId: string, text: string) => {
    if (!editingQuestion || !editingQuestion.parts) return;
    setEditingQuestion({
      ...editingQuestion,
      parts: editingQuestion.parts.map((p) => (p.id === partId ? { ...p, text } : p)),
    });
  };

  // Rubrics Criterion checklist inside edit drawer (for Descriptive long_answer)
  const addNewRubricInDrawer = () => {
    if (!editingQuestion) return;
    const currentRubrics = editingQuestion.rubrics || [];
    const newRubric: RubricCriterion = {
      id: `rub-${Date.now()}`,
      title: 'معیار ارزیابی علمی',
      description: 'شرح نحوه تصحیح و تخصیص بارم این معیار',
      maxPoints: 1.0,
    };
    setEditingQuestion({
      ...editingQuestion,
      rubrics: [...currentRubrics, newRubric],
    });
  };

  const removeRubricInDrawer = (rubId: string) => {
    if (!editingQuestion || !editingQuestion.rubrics) return;
    setEditingQuestion({
      ...editingQuestion,
      rubrics: editingQuestion.rubrics.filter((r) => r.id !== rubId),
    });
  };

  const updateRubricInDrawer = (rubId: string, fields: Partial<RubricCriterion>) => {
    if (!editingQuestion || !editingQuestion.rubrics) return;
    setEditingQuestion({
      ...editingQuestion,
      rubrics: editingQuestion.rubrics.map((r) => (r.id === rubId ? { ...r, ...fields } : r)),
    });
  };

  // Student answer update simulation helper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleStudentAnswerChange = (qId: string, val: any) => {
    setStudentAnswers({
      ...studentAnswers,
      [qId]: val,
    });
  };

  // Replacement search filter pipeline
  const filteredBankQuestions = bankQuestions.filter((bq) => {
    // Exclude physical matches already assigned in exam to avoid duplication
    if (localExam.questions.some((eq) => eq.text === bq.text)) return false;

    const matchQuery =
      !replaceSearchQuery ||
      bq.title.toLowerCase().includes(replaceSearchQuery.toLowerCase()) ||
      bq.text.toLowerCase().includes(replaceSearchQuery.toLowerCase());

    const matchGrade = replaceFilterGrade === 'all' || bq.grade === replaceFilterGrade;
    const matchSubject =
      replaceFilterSubject === 'all' ||
      bq.category.includes(replaceFilterSubject) ||
      bq.category === replaceFilterSubject;
    const matchType = replaceFilterType === 'all' || bq.type === replaceFilterType;
    const matchDiff =
      replaceFilterDifficulty === 'all' || bq.difficulty === replaceFilterDifficulty;

    return matchQuery && matchGrade && matchSubject && matchType && matchDiff;
  });

  return (
    <div
      className="space-y-6 animate-in fade-in duration-300 text-right glx p-1 md:p-3 rounded-2xl"
      dir="rtl"
      id="exam-preview-edit-canvas"
    >
      {/* Upper header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 glx p-6 rounded-3xl border">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="btn-back-to-exams-list"
            onClick={handleBack}
            className="p-2 hover:brightness-105 rounded-xl text-[var(--color-text-tertiary)] cursor-pointer border border-[var(--color-glass-light-stroke)] transition-all font-bold"
            title="رجوع به بانک لیست آزمون‌ها"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-label md:text-md font-extrabold text-[var(--color-text-primary)] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--color-accent)]" />
              <span>پیش‌نمایش و ویرایش آزمون</span>
            </h2>
            <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
              تغییر ساختار فصل‌ها، جابه‌جایی نمرات، برسی الگوهای دانش‌آموزان و رفع نواقص فنی قبل از
              انتشار
            </p>
          </div>
        </div>

        {/* View mode toggle switcher layout */}
        <div className="flex items-center gap-2 w-full lg:w-auto self-end lg:self-center">
          <div className="glx-inset p-1 rounded-2xl border border-[var(--color-glass-light-stroke)] flex items-center gap-1 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('teacher')}
              className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-caption font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                viewMode === 'teacher'
                  ? 'glx text-[var(--color-accent)] shadow-sm'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span>حالت ویرایش طراح (معلم)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('student')}
              className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-caption font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                viewMode === 'student'
                  ? 'glx text-[var(--color-accent)] shadow-sm'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>پیش‌نمایش نهایی (دانش‌آموز)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Validation Alert Warnings bar */}
      {viewMode === 'teacher' && warnings.length > 0 && (
        <div
          className="bg-[var(--color-danger-soft)]/40 border border-[var(--color-danger)]/20 rounded-2xl p-4.5 space-y-3"
          id="validation-errors-alert"
        >
          <div className="flex items-center gap-2 text-[var(--color-danger)]/80">
            <AlertCircle className="w-5 h-5 text-[var(--color-danger)] shrink-0" />
            <h3 className="text-caption font-extrabold">
              بررسی خودکار عیوب طراح ({toPersianDigits(warnings.length)} اشکال برجا مانده)
            </h3>
          </div>
          <p className="text-micro text-[var(--color-danger)]">
            دبیـر گرامی، سوالات برای انتشار امن و بدون خطا نیازمند برطرف کردن نواقص زیر می‌باشند:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-micro">
            {warnings.map((warn) => (
              <div
                key={warn.id}
                className="glx0 p-2.5 rounded-xl border border-[var(--color-danger)]/10 flex items-start gap-2 text-[var(--color-danger)] cursor-pointer hover:brightness-105 transition-all"
                onClick={() => {
                  const targetElement = document.getElementById(`editor-q-box-${warn.targetId}`);
                  if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetElement.classList.add('ring-2', 'ring-[var(--color-danger)]');
                    setTimeout(
                      () => targetElement.classList.remove('ring-2', 'ring-[var(--color-danger)]'),
                      2500,
                    );
                  }
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-danger-soft)]/40 shrink-0 mt-1.5" />
                <span className="leading-relaxed font-semibold">{warn.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Body Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Right side specifications details (1/4 width) */}
        <div className="col-span-1 space-y-5" id="specifications-column">
          {/* 1. Exam Static Summary Panel */}
          <div className="glx p-5 rounded-3xl border space-y-4 text-right">
            <h3 className="text-caption font-extrabold text-[var(--color-text-primary)] pb-2.5 border-b border-[var(--color-glass-light-stroke)] flex items-center gap-1.5">
              <Layers className="w-4.5 h-4.5 text-[var(--color-text-tertiary)]" />
              <span>جزییات شناسنامه آزمون</span>
            </h3>

            <div className="space-y-3.5 text-caption text-[var(--color-text-primary)]">
              <div className="flex justify-between items-center glx p-2 rounded-xl border">
                <span className="text-[var(--color-text-tertiary)]">عنوان آزمون:</span>
                <span
                  className="font-extrabold text-[var(--color-text-primary)] text-micro max-w-[130px] truncate"
                  title={localExam.title}
                >
                  {localExam.title}
                </span>
              </div>

              <div className="flex justify-between items-center text-caption">
                <span className="text-[var(--color-text-tertiary)]">نوع بازخورد:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-md text-micro ${
                    localExam.settings.mode === 'official'
                      ? 'bg-[var(--color-danger-soft)]/40 text-[var(--color-danger)] border border-[var(--color-danger)]/10'
                      : 'bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success)]/10'
                  }`}
                >
                  {localExam.settings.mode === 'official' ? 'رسمی (بارم‌دار)' : 'تمرینی (خودسنجی)'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[var(--color-text-tertiary)]">پایه تحصیلی:</span>
                <span className="font-bold text-[var(--color-text-secondary)]">
                  پایه {localExam.grade}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[var(--color-text-tertiary)]">درس هدف:</span>
                <span className="font-bold text-[var(--color-text-secondary)]">
                  {localExam.subject}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[var(--color-text-tertiary)]">کـلاس اختصاصی:</span>
                <span
                  className="font-bold text-[var(--color-text-secondary)] text-micro truncate max-w-[120px]"
                  title={getAssignedClassesString()}
                >
                  {getAssignedClassesString()}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[var(--color-text-tertiary)]">تعداد کل سوالات:</span>
                <span className="glx-inset px-2.5 py-0.5 rounded-md font-extrabold text-[var(--color-text-primary)] font-mono text-caption">
                  {toPersianDigits(totalQuestions)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-[var(--color-glass-light-stroke)]/60">
                <span className="text-[var(--color-text-primary)] font-bold">مجموع کل نمرات:</span>
                <span className="bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/20/60 text-[var(--color-warning)]/80 px-3 py-1 rounded-xl font-black font-mono text-caption">
                  {toPersianDigits(totalScore)} نمره
                </span>
              </div>
            </div>

            {/* Completeness Status alert block */}
            <div
              className={`mt-4 p-3 rounded-2xl border flex items-center gap-2 ${
                warnings.length === 0
                  ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/20'
                  : 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]/20'
              }`}
            >
              {warnings.length === 0 ? (
                <>
                  <CheckCircle className="w-5 h-5 text-[var(--color-success)] shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-micro font-extrabold">آماده همگام زیستی</p>
                    <p className="text-micro text-[var(--color-success)] leading-normal">
                      آزمون کامل است و خطایی در پیکربندی یافت نشد.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-[var(--color-warning)] shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-micro font-extrabold">نیاز به تصحیح طراح</p>
                    <p className="text-micro text-[var(--color-warning)] leading-normal">
                      {toPersianDigits(warnings.length)} هشدار فعال روی برگه یافت شد.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Guidelines info block */}
          <div className="glx p-5 rounded-3xl border text-caption space-y-3">
            <h4 className="font-bold text-[var(--color-text-secondary)] flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[var(--color-accent)]" />
              <span>ملاحظات پاسخ‌نامه‌ها</span>
            </h4>
            <ul className="space-y-2 text-micro text-[var(--color-text-tertiary)] list-disc pr-4 leading-relaxed">
              <li>جابه‌جایی نمره هر سوال مستقیماً بارم کل ورقه نهایی را تغییر می‌دهد.</li>
              <li>
                سوالات تشریحی نیاز به تعریف معیارهای مشخص بارم‌بندی برای صحت ارزیابی نهایی دارند.
              </li>
              <li>در حالت پیش‌نمایش دانش‌آموزی، پاسخ‌ها در کش موقت شبیه‌سازی خواهند شد.</li>
            </ul>
          </div>
        </div>

        {/* Left side core list of questions rendered perfectly (3/4 width) */}
        <div className="lg:col-span-3 space-y-6" id="questions-canvas">
          {localExam.sections.map((section, sIdx) => {
            const sectionQuestions = localExam.questions.filter((q) =>
              section.questionIds.includes(q.id),
            );

            return (
              <div
                key={section.id}
                className="glx p-5 md:p-6 rounded-3xl border space-y-5"
                id={`pview-section-${section.id}`}
              >
                {/* Section Header */}
                <div className="border-b border-[var(--color-accent)]/10/60 pb-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-[var(--color-accent-solid)] text-[var(--color-text-on-solid)] font-extrabold rounded-md px-2.5 py-0.5 text-micro">
                        بخش {toPersianDigits(sIdx + 1)}
                      </span>
                      <h4 className="text-caption font-slate-800 font-extrabold">
                        {section.title}
                      </h4>
                    </div>
                    {section.description && (
                      <p className="text-micro text-[var(--color-text-tertiary)]">
                        {section.description}
                      </p>
                    )}
                  </div>

                  {/* Manual Question Button per Section */}
                  {viewMode === 'teacher' && (
                    <button
                      type="button"
                      onClick={(e) =>
                        triggerAddManualQuestion(section.id, e.currentTarget as HTMLElement)
                      }
                      className="px-3.5 py-1.5 bg-[var(--color-accent-soft)] hover:bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded-xl text-micro font-bold border border-[var(--color-accent-soft)] flex items-center gap-1.5 cursor-pointer transition-all self-end md:self-center"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>افزودن سوال دستی به این بخش</span>
                    </button>
                  )}
                </div>

                {/* Question rendering */}
                <div className="space-y-8 divide-y divide-[var(--color-glass-light-stroke)] pr-1">
                  {sectionQuestions.map((q, qIdx) => {
                    const _hasImage = !!q.imageUrl;
                    const optionsHaveImages = q.options?.some((o) => o.imageUrl);
                    const isLongAnswer = q.type === 'long_answer';
                    const isShortAnswer = q.type === 'short_answer';
                    const isFillBlank = q.type === 'fill_blank';

                    return (
                      <div
                        key={q.id}
                        className={`pt-6 first:pt-0 space-y-4`}
                        id={`editor-q-box-${q.id}`}
                      >
                        {/* Upper mini spec line inside (Teacher edit vs student meta) */}
                        <div className="flex items-center justify-between gap-2 text-micro">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="glx-inset text-[var(--color-text-secondary)] px-2 py-0.5 rounded-md font-bold">
                              شماره {toPersianDigits(qIdx + 1)}
                            </span>
                            <span className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-[var(--color-accent-soft)]/50 px-2 py-0.5 rounded-md font-semibold">
                              {getTypeNameInPersian(q.type)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="bg-[var(--color-warning-soft)] text-[var(--color-warning)] font-bold border border-[var(--color-warning)]/20 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                              <Award className="w-3.5 h-3.5 text-[var(--color-warning-soft)]/500" />
                              <span>{toPersianDigits(q.points)} امتیاز</span>
                            </span>
                          </div>
                        </div>

                        {/* Visual Image/Diagram in question Prompt if available */}
                        <div className="space-y-3.5">
                          <p className="text-caption text-[var(--color-text-primary)] font-bold leading-relaxed">
                            {q.text}
                          </p>

                          {q.imageUrl && (
                            <div className="max-w-md glx border rounded-2xl p-2 relative group inline-block">
                              <img
                                loading="lazy"
                                decoding="async"
                                src={q.imageUrl}
                                alt="سوال پیوست"
                                referrerPolicy="no-referrer"
                                className="max-h-56 rounded-xl object-contain  bg-[var(--color-surface)] transition-all shadow-3xs"
                              />
                              <span className="absolute bottom-3 right-3 bg-black/30 text-[var(--color-text-on-solid)] rounded-md px-2 py-0.5 text-micro">
                                تصویر ضمیمه سوال
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Rendering different input templates if Mode is Student vs Teacher */}

                        {/* 1. Choices / Options render */}
                        {(q.type === 'single_choice' ||
                          q.type === 'multiple_choice' ||
                          q.type === 'image_based') &&
                          q.options && (
                            <div
                              className={`mt-3 ${optionsHaveImages ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-2'}`}
                            >
                              {q.options.map((opt) => {
                                const isCorrectOption =
                                  opt.isCorrect ||
                                  q.correctAnswer === opt.id ||
                                  (Array.isArray(q.correctAnswer) &&
                                    q.correctAnswer.includes(opt.id));
                                const currentSelected =
                                  studentAnswers[q.id] === opt.id ||
                                  (Array.isArray(studentAnswers[q.id]) &&
                                    studentAnswers[q.id].includes(opt.id));

                                return (
                                  <div
                                    key={opt.id}
                                    onClick={() => {
                                      if (viewMode === 'student') {
                                        if (q.type === 'multiple_choice') {
                                          const old: string[] = studentAnswers[q.id] || [];
                                          const next = old.includes(opt.id)
                                            ? old.filter((x) => x !== opt.id)
                                            : [...old, opt.id];
                                          handleStudentAnswerChange(q.id, next);
                                        } else {
                                          handleStudentAnswerChange(q.id, opt.id);
                                        }
                                      }
                                    }}
                                    className={`p-3.5 rounded-xl border text-caption cursor-pointer transition-all flex flex-col justify-between ${
                                      viewMode === 'teacher' && isCorrectOption
                                        ? 'bg-[var(--color-success-soft)]/70 border-[var(--color-success)]/30 text-[var(--color-success)] font-semibold shadow-3xs'
                                        : currentSelected && viewMode === 'student'
                                          ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)]/20 text-[var(--color-accent)] font-semibold shadow-3xs'
                                          : 'glx border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:border-[var(--color-glass-light-stroke)]'
                                    }`}
                                  >
                                    <div className="flex items-start gap-2.5">
                                      <div className="pt-0.5">
                                        {q.type === 'multiple_choice' ? (
                                          <div
                                            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                              (viewMode === 'teacher' && isCorrectOption) ||
                                              (viewMode === 'student' && currentSelected)
                                                ? 'bg-[var(--color-accent-solid)] border-[var(--color-accent)]/20 text-[var(--color-text-on-solid)]'
                                                : 'border-[var(--color-glass-light-stroke)] glx'
                                            }`}
                                          >
                                            <Check className="w-3 h-3" />
                                          </div>
                                        ) : (
                                          <div
                                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                              (viewMode === 'teacher' && isCorrectOption) ||
                                              (viewMode === 'student' && currentSelected)
                                                ? 'bg-[var(--color-accent-solid)] border-[var(--color-accent)]/20 text-[var(--color-text-on-solid)]'
                                                : 'border-[var(--color-glass-light-stroke)] glx'
                                            }`}
                                          >
                                            <div className="w-1.5 h-1.5 rounded-full  bg-[var(--color-surface)]" />
                                          </div>
                                        )}
                                      </div>
                                      <div className="space-y-2 flex-1 text-right">
                                        <span className="leading-relaxed">{opt.text}</span>

                                        {opt.imageUrl && (
                                          <div className="mt-2 block max-w-xs">
                                            <img
                                              loading="lazy"
                                              decoding="async"
                                              src={opt.imageUrl}
                                              alt="گزینه"
                                              referrerPolicy="no-referrer"
                                              className="rounded-lg border border-[var(--color-glass-light-stroke)] max-h-32 object-contain  bg-[var(--color-surface)] w-full"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {viewMode === 'teacher' && isCorrectOption && (
                                      <div className="mr-6 mt-2 flex items-center gap-1 text-micro font-bold text-[var(--color-success)]">
                                        <Check className="w-3.5 h-3.5" />
                                        <span>گزینه کلید پاسخ صحیح (معلم)</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                        {/* 2. True False Option render */}
                        {q.type === 'true_false' && (
                          <div className="flex gap-4 mt-2">
                            {[
                              { label: 'صحیح / درست', val: true },
                              { label: 'غلط / نادرست', val: false },
                            ].map((item, idx) => {
                              const isCorrect = q.correctAnswer === item.val;
                              const isSelected = studentAnswers[q.id] === item.val;

                              return (
                                <div
                                  key={idx}
                                  onClick={() => {
                                    if (viewMode === 'student') {
                                      handleStudentAnswerChange(q.id, item.val);
                                    }
                                  }}
                                  className={`flex-1 p-3.5 rounded-xl border text-center font-bold text-caption flex items-center justify-center cursor-pointer gap-2 ${
                                    viewMode === 'teacher' && isCorrect
                                      ? 'bg-[var(--color-success-soft)] border-[var(--color-success)]/30 text-[var(--color-success)] shadow-3xs'
                                      : viewMode === 'student' && isSelected
                                        ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)]/20 text-[var(--color-accent)] shadow-3xs'
                                        : 'glx border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)] hover:border-[var(--color-glass-light-stroke)]'
                                  }`}
                                >
                                  <span>{item.label}</span>
                                  {((viewMode === 'teacher' && isCorrect) ||
                                    (viewMode === 'student' && isSelected)) && (
                                    <span className="bg-[var(--color-accent-solid)] text-[var(--color-text-on-solid)] p-0.5 rounded-full">
                                      <Check className="w-3 h-3" />
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 3. Short Answer Area */}
                        {isShortAnswer && (
                          <div className="space-y-2 mt-2">
                            <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
                              محل پاسخ کوتاه دانش‌آموز:
                            </label>
                            <input
                              type="text"
                              disabled={viewMode === 'teacher'}
                              placeholder={
                                viewMode === 'teacher'
                                  ? 'فقط در حالت پیش‌نمایش دانش‌آموز قابل پاسخ‌دهی است...'
                                  : 'پاسخ کوتاه خود را در اینجا بنویسید...'
                              }
                              value={studentAnswers[q.id] || ''}
                              onChange={(e) => handleStudentAnswerChange(q.id, e.target.value)}
                              className="w-full glx border text-label text-[var(--color-text-primary)] px-3.5 py-2.5 rounded-xl focus:outline-hidden focus:border-[var(--color-accent)]/40 focus:ring-1 focus:ring-[var(--color-accent-soft)] placeholder-[var(--color-text-tertiary)]"
                            />
                            {viewMode === 'teacher' && q.correctAnswer && (
                              <div className="bg-[var(--color-success-soft)] text-[var(--color-success)] border-l-2 border-[var(--color-success)]/20 p-2 text-micro rounded-md font-medium">
                                کلید پاسخ مورد قبول سیستم: «{String(q.correctAnswer)}»
                              </div>
                            )}
                          </div>
                        )}

                        {/* 4. Long Answer Form / Area */}
                        {isLongAnswer && (
                          <div className="space-y-3.5 mt-2">
                            <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
                              محل پاسخ تشریحی دانش‌آموز:
                            </label>
                            <textarea
                              rows={3}
                              disabled={viewMode === 'teacher'}
                              placeholder={
                                viewMode === 'teacher'
                                  ? 'فقط در حالت پیش‌نمایش دانش‌آموز قابل پاسخ‌دهی است...'
                                  : 'پاسخ کامل تشریحی خود را در زیر بنویسید... برای سوالات درس محاسباتی حتماً فرمول‌ها را وارد کنید.'
                              }
                              value={studentAnswers[q.id] || ''}
                              onChange={(e) => handleStudentAnswerChange(q.id, e.target.value)}
                              className="w-full glx border text-label text-[var(--color-text-primary)] p-3.5 rounded-xl focus:outline-hidden focus:border-[var(--color-accent)]/40 focus:ring-1 focus:ring-[var(--color-accent-soft)] placeholder-[var(--color-text-tertiary)] leading-relaxed text-right"
                            />

                            {/* Rubric evaluation criteria info boxes */}
                            {q.rubrics && q.rubrics.length > 0 && (
                              <div className="glx border rounded-2xl p-4.5 space-y-2.5 text-micro">
                                <span className="block font-bold text-[var(--color-text-secondary)]">
                                  معیارهای توزیع بارم تصحیح معلم:
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {q.rubrics.map((rub: RubricCriterion) => (
                                    <div
                                      key={rub.id}
                                      className="p-3 glx border rounded-xl space-y-1"
                                    >
                                      <div className="flex justify-between items-center text-[var(--color-text-primary)] border-b border-[var(--color-glass-light-stroke)] pb-1">
                                        <strong className="font-bold">{rub.title}</strong>
                                        <span className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded-md px-1.5 py-0.5 text-micro font-extrabold">
                                          {toPersianDigits(rub.maxPoints)} نمره
                                        </span>
                                      </div>
                                      <p className="text-micro text-[var(--color-text-tertiary)]">
                                        {rub.description}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 5. Fill Blank input area */}
                        {isFillBlank && (
                          <div className="space-y-2 mt-2">
                            <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
                              محل جایگذاری جاهای خالی:
                            </label>
                            {viewMode === 'student' ? (
                              <div className="flex flex-wrap gap-2">
                                {(q.correctFillBlanks || ['']).map((_, fIdx) => (
                                  <div key={fIdx} className="flex items-center gap-1 text-caption">
                                    <span className="text-[var(--color-text-tertiary)] font-bold">
                                      جای خالی ({toPersianDigits(fIdx + 1)}):
                                    </span>
                                    <input
                                      type="text"
                                      placeholder="کلمه گمشده..."
                                      value={(studentAnswers[q.id] || [])[fIdx] || ''}
                                      onChange={(e) => {
                                        const oldList = studentAnswers[q.id] || [];
                                        const nextList = [...oldList];
                                        nextList[fIdx] = e.target.value;
                                        handleStudentAnswerChange(q.id, nextList);
                                      }}
                                      className="glx border px-3 py-1.5 rounded-lg text-caption font-semibold focus:outline-hidden focus:border-[var(--color-accent)]/40 w-28 text-center"
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1 bg-[var(--color-success-soft)] p-2 rounded-xl text-micro border border-[var(--color-success)]/10/60 text-[var(--color-success)]">
                                <span className="font-bold block mr-2">کلید کل کلمات گمشده:</span>
                                {q.correctFillBlanks?.map((word, idx) => (
                                  <span
                                    key={idx}
                                    className="glx px-2 py-0.5 rounded-md font-bold font-mono text-[var(--color-success)] ml-1"
                                  >
                                    {toPersianDigits(idx + 1)}. {word}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 6. Matching Pairs elements rendering */}
                        {q.type === 'matching' && q.matchingPairs && (
                          <div className="glx rounded-2xl p-4.5 border mt-2 space-y-3.5 text-caption">
                            <span className="block font-bold text-[var(--color-text-secondary)]">
                              تطبیق ستون الف با ب:
                            </span>
                            <div className="space-y-2">
                              {q.matchingPairs.map((pair, pIdx) => (
                                <div
                                  key={pIdx}
                                  className="flex items-center justify-between gap-2.5 glx px-3 py-2 rounded-xl border"
                                >
                                  <span className="glx-inset text-[var(--color-text-secondary)] px-3 py-1.5 rounded-lg font-bold flex-1 text-center">
                                    {pair.right}
                                  </span>
                                  <span className="text-[var(--color-text-primary)] font-black">
                                    ➔
                                  </span>
                                  <span className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-[var(--color-accent-soft)] px-3 py-1.5 rounded-lg font-bold flex-1 text-center">
                                    {pair.left}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 7. Ordering array rendering */}
                        {q.type === 'ordering' && q.orderingItems && (
                          <div className="glx rounded-2xl p-4.5 border mt-2 text-caption">
                            <span className="font-bold text-[var(--color-text-primary)] block mb-2.5">
                              ترتیب قرارگیری مراحل صحیح:
                            </span>
                            <div className="flex flex-wrap gap-2 items-center">
                              {q.orderingItems.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="glx border text-[var(--color-text-primary)] px-3.5 py-2 font-black rounded-xl">
                                    {toPersianDigits(idx + 1)}. {item}
                                  </span>
                                  {idx < (q.orderingItems?.length || 0) - 1 && (
                                    <span className="text-[var(--color-text-tertiary)] font-extrabold text-caption">
                                      ➔
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 8. Reading Comprehension logic parts */}
                        {q.type === 'reading_comprehension' && (
                          <div className="space-y-4 mt-2">
                            {q.parts && q.parts.length > 0 && (
                              <div className="space-y-3" id="comprehension-parts">
                                <span className="block font-bold text-[var(--color-text-secondary)] text-caption border-r-2 border-[var(--color-accent)]/100 pr-2 pb-0.5">
                                  زیرسوالات درک مطلب:
                                </span>
                                {q.parts.map((part: QuestionPart, idx: number) => {
                                  return (
                                    <div
                                      key={part.id}
                                      className="glx border rounded-xl p-3.5 space-y-3"
                                    >
                                      <h6 className="text-micro font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                                        <span className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] w-5 h-5 rounded-full flex items-center justify-center text-micro font-black">
                                          {toPersianDigits(idx + 1)}
                                        </span>
                                        <span>{part.text}</span>
                                      </h6>

                                      {/* Mini options in subquestions */}
                                      {part.options && part.options.length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-micro mr-5">
                                          {part.options.map((opt) => {
                                            const isCorrect =
                                              opt.isCorrect || part.correctAnswer === opt.id;
                                            return (
                                              <div
                                                key={opt.id}
                                                className={`p-2 rounded-lg border ${
                                                  viewMode === 'teacher' && isCorrect
                                                    ? 'bg-[var(--color-success-soft)] border-[var(--color-success)]/20 text-[var(--color-success)] font-bold'
                                                    : 'glx border border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)]'
                                                }`}
                                              >
                                                <span>{opt.text}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 9. Cloze Test inline blanks list */}
                        {q.type === 'cloze' && (
                          <div className="space-y-3 mt-2">
                            {q.parts && q.parts.length > 0 && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {q.parts.map((p, pIdx) => (
                                  <div key={p.id} className="p-3 glx border rounded-xl space-y-2">
                                    <strong className="text-[var(--color-accent)] font-bold text-micro block text-right">
                                      جای خالی کلوز شماره {toPersianDigits(pIdx + 1)}
                                    </strong>
                                    <div className="flex flex-wrap gap-1.5 text-micro">
                                      {p.options?.map((opt) => (
                                        <span
                                          key={opt.id}
                                          className={`px-2 py-0.5 rounded-md border text-center ${
                                            (opt.isCorrect || p.correctAnswer === opt.id) &&
                                            viewMode === 'teacher'
                                              ? 'bg-[var(--color-success-soft)] border-[var(--color-success)]/30 text-[var(--color-success)] font-bold font-mono'
                                              : 'glx border border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)]'
                                          }`}
                                        >
                                          {opt.text}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Teacher Edit Controls (ONLY visible in teacher view mode) */}
                        {viewMode === 'teacher' && (
                          <div className="glx -mx-5 -mb-6 mt-4 p-3.5 border-t flex flex-wrap items-center justify-between gap-3.5 rounded-b-3xl">
                            {/* Order Moving Controls */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => moveQuestion(q.id, 'up')}
                                className="p-2 glx hover:brightness-105 text-[var(--color-text-secondary)] rounded-lg border cursor-pointer text-micro font-bold flex items-center gap-1 transition-all"
                                title="جابه‌جایی سوال به بالا"
                              >
                                <ChevronUp className="w-4 h-4 text-[var(--color-accent)]" />
                                <span>بالاتر</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => moveQuestion(q.id, 'down')}
                                className="p-2 glx hover:brightness-105 text-[var(--color-text-secondary)] rounded-lg border cursor-pointer text-micro font-bold flex items-center gap-1 transition-all"
                                title="جابه‌جایی سوال به پایین"
                              >
                                <ChevronDown className="w-4 h-4 text-[var(--color-accent)]" />
                                <span>پایین‌تر</span>
                              </button>
                            </div>

                            {/* Core Action Tools */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) =>
                                  triggerEditQuestion(q, e.currentTarget as HTMLElement)
                                }
                                className="p-2 glx-inset hover:brightness-105 text-[var(--color-accent)] hover:text-[var(--color-accent)] rounded-lg border border-[var(--color-accent-soft)] hover:border-[var(--color-accent)]/20 cursor-pointer text-micro font-bold flex items-center gap-1.5 transition-all"
                              >
                                <Edit className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                                <span>ویرایش محتوا و گزینه‌ها</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => triggerReplaceQuestion(q.id, section.id)}
                                className="p-2 glx-inset hover:brightness-105 text-[var(--color-warning)] hover:text-[var(--color-warning)] rounded-lg border border-[var(--color-warning)]/10 hover:border-[var(--color-warning)]/20 cursor-pointer text-micro font-bold flex items-center gap-1.5 transition-all"
                              >
                                <RefreshCw className="w-3.5 h-3.5 text-[var(--color-warning)]" />
                                <span>جایگزینی از بانک سوالات</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteQuestion(q.id)}
                                className="p-2 bg-[var(--color-danger-soft)]/40 hover:bg-[var(--color-danger-soft)]/40 text-[var(--color-danger)] rounded-lg border border-[var(--color-danger)]/10 cursor-pointer text-micro font-bold flex items-center gap-1 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-[var(--color-danger)]" />
                                <span>حذف سوال</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {sectionQuestions.length === 0 && (
                    <div className="py-12 text-center text-[var(--color-text-tertiary)] select-none space-y-2">
                      <HelpCircle className="w-10 h-10 mx-auto text-[var(--color-text-primary)]" />
                      <p className="text-caption font-bold text-[var(--color-text-secondary)]">
                        این بخش فاقد هرگونه سوال انتصابی است
                      </p>
                      <p className="text-micro text-[var(--color-text-tertiary)]">
                        می‌توانید با دکمه بالا سوال دستی اضافه کنید یا از بانک سوالات کپی نمایید.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FOOTER ACTIONS BAR */}
      <div
        className="border-t glx p-5 rounded-3xl mt-6 flex flex-col sm:flex-row justify-between items-center gap-4"
        id="preview-footer-plate"
      >
        <button
          type="button"
          onClick={handleBack}
          className="w-full sm:w-auto px-5 py-2.5 glx-inset hover:glx-inset text-[var(--color-text-secondary)] font-bold rounded-xl text-caption transition-all cursor-pointer text-center"
        >
          بازگشت به ساخت آزمون
        </button>

        <div className="flex gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              if (onSave) {
                onSave(localExam);
                setSavedFingerprint(JSON.stringify(localExam));
              } else {
                alert('پیش‌نویس جدید آزمون با موفقیت در فضای ابری ذخیره شد.');
              }
            }}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-[var(--color-accent-soft)] hover:bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-bold rounded-xl text-caption transition-all border border-[var(--color-accent-soft)] cursor-pointer text-center"
          >
            ذخیره پیش‌نویس موقت
          </button>

          <button
            type="button"
            onClick={() => {
              if (onNavigateToSettings) {
                setSavedFingerprint(JSON.stringify(localExam));
                onNavigateToSettings(localExam);
              } else {
                alert('تغییرات شما ذخیره شد. در حال هدایت به تنظیمات توزیع آزمون...');
              }
            }}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-[var(--color-accent-solid)] hover:bg-[var(--color-accent-solid-hover)] text-[var(--color-text-on-solid)] font-bold rounded-xl text-caption shadow-xs hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer text-center"
          >
            ادامه به تنظیمات توزیع آزمون
          </button>
        </div>
      </div>

      {/* MODAL 1: REPLACE QUESTION BANK */}
      {replacingQuestionId && (
        <div
          className="fixed inset-0 z-50 bg-[var(--color-glass-light-fill)]/60 flex items-center justify-center p-4"
          id="replace-modal-backdrop"
        >
          <div
            className="glx-strong rounded-3xl w-full max-w-3xl overflow-hidden border flex flex-col max-h-[85vh] text-right font-sans"
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="px-6 py-4.5 glx border-b flex items-center justify-between">
              <h3 className="font-extrabold text-[var(--color-text-primary)] text-caption md:text-label flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[var(--color-accent)] animate-spin-slow" />
                <span>جایگزینی سوال با مخزن بانک سوالات همگام</span>
              </h3>
              <button
                type="button"
                aria-label="بستن پنجره جایگزینی سؤال"
                title="بستن"
                onClick={() => setReplacingQuestionId(null)}
                className="p-1 hover:glx-inset rounded-lg text-[var(--color-text-tertiary)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Smart Filters Header block inside modal */}
            <div className="p-4 glx-inset border-b border-[var(--color-glass-light-stroke)] space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-caption">
                <div className="space-y-1">
                  <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
                    پایه تحصیلی:
                  </label>
                  <Dropdown
                    value={replaceFilterGrade}
                    onChange={setReplaceFilterGrade}
                    options={[
                      { value: 'all', label: 'همه پایه‌ها' },
                      { value: 'هفتم', label: 'پایه هفتم' },
                      { value: 'هشتم', label: 'پایه هشتم' },
                      { value: 'نهم', label: 'پایه نهم' },
                    ]}
                    className="text-micro"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
                    درس هدف:
                  </label>
                  <Dropdown
                    value={replaceFilterSubject}
                    onChange={setReplaceFilterSubject}
                    options={[
                      { value: 'all', label: 'همه درس‌ها' },
                      { value: localExam.subject, label: localExam.subject },
                      { value: 'علوم تجربی', label: 'علوم تجربی' },
                      { value: 'ریاضی پایه هفتم', label: 'ریاضی پایه هفتم' },
                      { value: 'ادبیات', label: 'ادبیات' },
                    ]}
                    className="text-micro"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
                    قالب سوال قالب:
                  </label>
                  <Dropdown
                    value={replaceFilterType}
                    onChange={setReplaceFilterType}
                    options={[
                      { value: 'all', label: 'همه قالب‌ها' },
                      { value: 'single_choice', label: 'چهارگزینه‌ای' },
                      { value: 'multiple_choice', label: 'چندگزینه‌ای' },
                      { value: 'true_false', label: 'درست/غلط' },
                      { value: 'short_answer', label: 'پاسخ کوتاه' },
                      { value: 'long_answer', label: 'تشریحی' },
                      { value: 'matching', label: 'وصل‌کردنی' },
                      { value: 'image_based', label: 'تصویری' },
                    ]}
                    className="text-micro"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
                    سطح سختی:
                  </label>
                  <Dropdown
                    compact
                    value={replaceFilterDifficulty}
                    onChange={setReplaceFilterDifficulty}
                    options={[
                      { value: 'all', label: 'همه سطوح' },
                      { value: 'easy', label: 'آسان' },
                      { value: 'medium', label: 'متوسط' },
                      { value: 'hard', label: 'سخت' },
                    ]}
                  />
                </div>
              </div>

              {/* Text search querying inside modal */}
              <input
                type="text"
                placeholder="جستجو در کل صورت سوال یا موضوعات..."
                value={replaceSearchQuery}
                onChange={(e) => setReplaceSearchQuery(e.target.value)}
                className="w-full glx border text-label text-[var(--color-text-primary)] px-3 py-2 rounded-xl focus:outline-hidden focus:border-[var(--color-accent)]/40 text-right"
              />
            </div>

            {/* Questions Bank scrolling container list */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 glx">
              {filteredBankQuestions.length > 0 ? (
                filteredBankQuestions.map((bq) => {
                  const hasImg = !!bq.imageUrl;
                  return (
                    <div
                      key={bq.id}
                      className="glx p-4 rounded-2xl border hover:border-[var(--color-accent)]/20 transition-all flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2 text-right">
                        {/* Upper indicators bar */}
                        <div className="flex items-center justify-between gap-1 text-micro text-[var(--color-text-tertiary)]">
                          <div className="flex items-center gap-1.5">
                            <span className="glx-inset text-[var(--color-text-secondary)] font-bold px-1.5 py-0.5 rounded-md">
                              پایه {bq.grade}
                            </span>
                            <span className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold px-2 py-0.5 rounded-md">
                              {bq.category}
                            </span>
                            <span className="glx text-[var(--color-text-tertiary)] rounded-md px-1.5 py-0.5 font-medium border">
                              {getTypeNameInPersian(bq.type)}
                            </span>
                          </div>

                          <div
                            className={`px-2 py-0.5 rounded-full border font-bold ${getDifficultyColor(bq.difficulty || 'medium')}`}
                          >
                            {getDifficultyLabel(bq.difficulty || 'medium')}
                          </div>
                        </div>

                        {/* Text */}
                        <h4 className="font-extrabold text-[var(--color-text-primary)] text-caption line-clamp-1">
                          {bq.title}
                        </h4>
                        <p className="text-micro text-[var(--color-text-tertiary)] leading-relaxed line-clamp-2">
                          {bq.text}
                        </p>

                        {hasImg && (
                          <div className="text-micro text-[var(--color-accent)] bg-[var(--color-accent-soft)]/30 rounded-lg px-2 py-0.5 w-fit border border-[var(--color-accent-soft)] font-semibold">
                            دارای تصویر ضمیمه مرتبط
                          </div>
                        )}
                      </div>

                      {/* Select and apply button */}
                      <div className="border-t border-[var(--color-glass-light-stroke)] pt-2.5 flex justify-between items-center text-micro text-[var(--color-text-tertiary)]">
                        <span>بارم استاندارد: {toPersianDigits(bq.points)} نمره</span>
                        <button
                          type="button"
                          onClick={() => handleExecuteReplacement(bq)}
                          className="px-4 py-1.5 bg-[var(--color-accent-solid)] hover:bg-[var(--color-accent-solid-hover)] text-[var(--color-text-on-solid)] font-bold rounded-xl text-micro cursor-pointer transition-all shadow-3xs"
                        >
                          تایید و جایگزینی این سوال
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-[var(--color-text-tertiary)] select-none space-y-2">
                  <HelpCircle className="w-10 h-10 mx-auto text-[var(--color-text-primary)]" />
                  <p className="text-caption font-bold text-[var(--color-text-secondary)]">
                    سوال همخوانی داری در بانک یافت نشد
                  </p>
                  <p className="text-micro">فیلترها را بردارید یا کلمه جستجو را کوتاه کنید.</p>
                </div>
              )}
            </div>

            {/* Modal Footer comments */}
            <div className="glx border-t p-3 text-center text-micro text-[var(--color-text-tertiary)] font-semibold">
              <span>تطبیق‌دهنده هوشمند آزمون‌ساز همگام دبیـران</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MEGA ADD/EDIT MANUAL QUESTION PANEL (SIDE DRAWER DESIGN) */}
      <AnimatePresence>
        {editingQuestion && (
          <div className="fixed inset-0 z-50" id="drawer-container-backdrop">
            {/* Scrim — opacity-only: a backdrop-filter under an opacity animation
              freezes its last frame, which lingers after close. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              onClick={() => setEditingQuestion(null)}
              className="fixed inset-0 scrim"
            />
            {/* Veil blur — static: full blur on frame 1 (no latency), ramped off on exit */}
            <motion.div
              aria-hidden="true"
              initial={false}
              exit={{
                backdropFilter: 'blur(0px) saturate(1) brightness(1) contrast(1)',
                transition: { duration: 0.12 },
              }}
              className="fixed inset-0 pointer-events-none veil-blur"
            />

            {/* Container sized to the panel (left dock preserved) so the ratio halo resolves */}
            <div className="absolute left-0 top-0 h-full w-full max-w-xl @container z-10">
              {/* Halo rides the panel's grow/shrink (same origin + curves) so no detached
                glow floats where the panel lands; NO opacity — that would freeze the
                filter's last frame past unmount. */}
              <motion.div
                aria-hidden="true"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{
                  scale: 0,
                  backdropFilter: 'blur(0px) saturate(1) brightness(1)',
                  backgroundColor: 'rgba(26, 28, 34, 0)',
                  transition: {
                    scale: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
                    backdropFilter: { duration: 0.14 },
                    backgroundColor: { duration: 0.14 },
                  },
                }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                ref={drawerHaloRef}
                style={drawerHaloOrigin}
                className="pointer-events-none absolute area-blur"
              />
              <motion.div
                ref={drawerPanelRef}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{
                  opacity: 0,
                  scale: 0,
                  transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
                }}
                transition={{
                  opacity: { duration: 0.16 },
                  scale: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                }}
                style={drawerOrigin}
                className="relative w-full h-full glx-strong z-10 flex flex-col border-r overflow-hidden text-caption text-right font-sans"
                dir="rtl"
                id="drawer-edit-form"
              >
                {/* Drawer Header */}
                <div className="px-5 py-4 glx border-b flex items-center justify-between">
                  <h3 className="font-extrabold text-[var(--color-text-primary)] text-caption md:text-label flex items-center gap-1.5">
                    <Sliders className="w-5 h-5 text-[var(--color-accent)]" />
                    <span>
                      {isAddingNew
                        ? 'طرح سوال تازه برای برگه آزمون'
                        : 'ویرایش جزئیات فنی و بارم سوال'}
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingQuestion(null)}
                    className="p-1 px-3 bg-[var(--color-danger-soft)]/40 hover:bg-[var(--color-danger-soft)]/40 text-[var(--color-danger)] rounded-xl font-bold cursor-pointer"
                  >
                    انصراف ×
                  </button>
                </div>

                {/* Drawer scrolling form content */}
                <div className="p-5 overflow-y-auto space-y-5 flex-1">
                  {/* Type selector */}
                  <div className="space-y-1 glx p-3 rounded-2xl border">
                    <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
                      نوع قالب‌بندی سوال:
                    </label>
                    <Dropdown
                      value={editingQuestion.type}
                      onChange={(v) => {
                        const nextVal = v as QuestionType;
                        setEditingQuestion({
                          ...editingQuestion,
                          type: nextVal,
                          // populate default structures if missing
                          options: ['single_choice', 'multiple_choice', 'image_based'].includes(
                            nextVal,
                          )
                            ? editingQuestion.options || [
                                { id: 'o1', text: 'گزینه الف', isCorrect: true },
                                { id: 'o2', text: 'گزینه ب', isCorrect: false },
                              ]
                            : undefined,
                          rubrics: nextVal === 'long_answer' ? [] : undefined,
                          parts: nextVal === 'reading_comprehension' ? [] : undefined,
                        });
                      }}
                      options={[
                        { value: 'single_choice', label: 'چهارگزینه‌ای یا کتبی تستی' },
                        { value: 'multiple_choice', label: 'چندگزینه‌ای چندپاسخ' },
                        { value: 'true_false', label: 'درست / نادرست' },
                        { value: 'short_answer', label: 'پاسخ کوتاه (نیم‌تشریحی)' },
                        { value: 'long_answer', label: 'پاسخ تشریحی بلند' },
                        { value: 'fill_blank', label: 'پر کردن جاهای خالی' },
                        { value: 'matching', label: 'وصل‌کردنی ارتباطی' },
                        { value: 'ordering', label: 'مرتب‌سازی ترتیبی' },
                        { value: 'image_based', label: 'سوال تصویری یا تحلیلی' },
                      ]}
                    />
                  </div>

                  {/* Title & Points row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 space-y-1 glx p-3.5 rounded-2xl border">
                      <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
                        عنوان خلاصه سوال:
                      </label>
                      <input
                        type="text"
                        value={editingQuestion.title || ''}
                        onChange={(e) =>
                          setEditingQuestion({ ...editingQuestion, title: e.target.value })
                        }
                        className="w-full bg-[var(--color-glass-light-fill)] border border-[var(--color-glass-light-stroke)] text-caption px-2.5 py-1.5 rounded-lg focus:outline-hidden focus:border-[var(--color-accent)]/40"
                        placeholder="مثال: سوال مضاف‌الیه ادبیات"
                      />
                    </div>

                    <div className="space-y-1 glx p-3.5 rounded-2xl border text-center">
                      <label className="text-micro text-[var(--color-text-tertiary)] font-bold block text-right">
                        بارم (امتیاز عددی):
                      </label>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={editingQuestion.points || 0}
                        onChange={(e) =>
                          setEditingQuestion({ ...editingQuestion, points: Number(e.target.value) })
                        }
                        className="w-full bg-[var(--color-glass-light-fill)] border border-[var(--color-glass-light-stroke)] text-caption text-center font-bold px-2 py-1.5 rounded-lg focus:outline-hidden font-mono focus:border-[var(--color-accent)]/40"
                      />
                    </div>
                  </div>

                  {/* Question Text Prompt */}
                  <div className="space-y-1 glx p-4 rounded-2xl border">
                    <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
                      متن اصلی صورت سوال:
                    </label>
                    <textarea
                      rows={4}
                      value={editingQuestion.text || ''}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, text: e.target.value })
                      }
                      className="w-full bg-[var(--color-glass-light-fill)] border border-[var(--color-glass-light-stroke)] text-caption p-3 rounded-lg focus:outline-hidden focus:border-[var(--color-accent)]/40 leading-relaxed text-right placeholder-[var(--color-text-tertiary)]"
                      placeholder="صورت سوال علمی، پیوند‌ها و نمادها را در اینجا تایپ کنید..."
                    />
                  </div>

                  {/* Image URL / media upload simulation */}
                  <div className="space-y-2 glx p-3.5 rounded-2xl border">
                    <label className="text-micro text-[var(--color-text-tertiary)] font-bold block">
                      تصویر یا نمودار پیوست سوال:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingQuestion.imageUrl || ''}
                        onChange={(e) =>
                          setEditingQuestion({ ...editingQuestion, imageUrl: e.target.value })
                        }
                        className="w-full glx border text-caption px-2.5 py-1.5 rounded-lg placeholder-[var(--color-text-tertiary)] focus:outline-hidden"
                        placeholder="آدرس اینترنتی تصویر (http://...) یا فرمت داده‌ها"
                      />
                      {editingQuestion.imageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditingQuestion({ ...editingQuestion, imageUrl: undefined })
                          }
                          className="px-2 py-1 bg-[var(--color-danger-soft)]/40 hover:bg-[var(--color-danger-soft)]/40 text-[var(--color-danger)] rounded-lg text-micro transition-all cursor-pointer font-bold shrink-0"
                        >
                          حذف
                        </button>
                      )}
                    </div>
                    {/* Simulative quick presets to populate mock images safely */}
                    <div className="flex flex-wrap gap-1 mt-1 justify-start">
                      <span className="text-micro text-[var(--color-text-tertiary)] font-semibold self-center ml-1">
                        چند پیوست پیش‌فرض:
                      </span>
                      {[
                        {
                          label: 'سلول گیاهی',
                          url: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=500&auto=format&fit=crop&q=60',
                        },
                        {
                          label: 'نمودار اهرم‌ها',
                          url: 'https://images.unsplash.com/photo-1632571401005-458e9d244591?w=500&auto=format&fit=crop&q=60',
                        },
                      ].map((preset, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() =>
                            setEditingQuestion({ ...editingQuestion, imageUrl: preset.url })
                          }
                          className="bg-[var(--color-accent-soft)] text-[var(--color-accent)] px-2 py-0.5 rounded-md border border-[var(--color-accent-soft)] hover:bg-[var(--color-accent-soft)] transition-all text-micro font-bold"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Specific template setups according to chosen type! */}

                  {/* A. Choice Options edit area */}
                  {['single_choice', 'multiple_choice', 'image_based'].includes(
                    editingQuestion.type || '',
                  ) && (
                    <div className="space-y-3 bg-[var(--color-accent-soft)]/40 p-4 rounded-2xl border border-[var(--color-accent-soft)]/50">
                      <div className="flex justify-between items-center border-b border-[var(--color-accent-soft)]/60 pb-1.5">
                        <span className="text-micro text-[var(--color-accent)] font-extrabold">
                          گزینه‌های پاسخ و تخصیص کلید:
                        </span>
                        <button
                          type="button"
                          onClick={addNewOptionInDrawer}
                          className="bg-[var(--color-accent-solid)] text-[var(--color-text-on-solid)] px-2.5 py-1 rounded-lg hover:bg-[var(--color-glass-light-fill)] transition-all font-bold text-micro flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>افزودن گزینه جدید</span>
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {(editingQuestion.options || []).map((opt, oIdx) => (
                          <div
                            key={opt.id}
                            className="flex gap-2 items-center glx p-2 rounded-xl border"
                          >
                            {/* Correct trigger */}
                            <button
                              type="button"
                              onClick={() => toggleOptionCorrectInDrawer(opt.id)}
                              className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                                opt.isCorrect
                                  ? 'bg-[var(--color-success-solid)] border-[var(--color-success)]/20 text-[var(--color-text-on-solid)] shadow-xs'
                                  : 'border-[var(--color-glass-light-stroke)] glx hover:brightness-105'
                              }`}
                              title={
                                opt.isCorrect
                                  ? 'کلید پاسخ صحیح (غیرفعال‌سازی)'
                                  : 'تبدیل به کلید پاسخ صحیح'
                              }
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>

                            {/* Input */}
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => updateOptionTextInDrawer(opt.id, e.target.value)}
                              className="w-full bg-transparent border-none py-1 px-1.5 text-caption focus:ring-0 focus:outline-hidden"
                              placeholder={`متن گزینه ${toPersianDigits(oIdx + 1)} را بنویسید...`}
                            />

                            {/* Image Option helper */}
                            <input
                              type="text"
                              value={opt.imageUrl || ''}
                              onChange={(e) => {
                                const updatedOpts = (editingQuestion.options || []).map((o) =>
                                  o.id === opt.id ? { ...o, imageUrl: e.target.value } : o,
                                );
                                setEditingQuestion({ ...editingQuestion, options: updatedOpts });
                              }}
                              className="glx border text-micro w-28 px-1 rounded-md"
                              placeholder="آدرس تصویر گزینه"
                            />

                            {/* Remove Option */}
                            <button
                              type="button"
                              onClick={() => removeOptionInDrawer(opt.id)}
                              className="p-1 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]/40 rounded-lg cursor-pointer"
                              title="حذف این گزینه"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* B. True False setup */}
                  {editingQuestion.type === 'true_false' && (
                    <div className="space-y-2 bg-[var(--color-accent-soft)]/40 p-4 rounded-2xl border border-[var(--color-accent-soft)]/50">
                      <span className="text-micro text-[var(--color-accent)] font-extrabold block">
                        مشخص‌سازی کلید پاسخ درست:
                      </span>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingQuestion({ ...editingQuestion, correctAnswer: true })
                          }
                          className={`flex-1 p-2.5 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                            editingQuestion.correctAnswer === true
                              ? 'bg-[var(--color-success-solid)] border-[var(--color-success)]/20 text-[var(--color-text-on-solid)] shadow-xs'
                              : 'glx border border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)]'
                          }`}
                        >
                          صحیح
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingQuestion({ ...editingQuestion, correctAnswer: false })
                          }
                          className={`flex-1 p-2.5 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                            editingQuestion.correctAnswer === false
                              ? 'bg-[var(--color-success-solid)] border-[var(--color-success)]/20 text-[var(--color-text-on-solid)] shadow-xs'
                              : 'glx border border-[var(--color-glass-light-stroke)] text-[var(--color-text-secondary)]'
                          }`}
                        >
                          غلط
                        </button>
                      </div>
                    </div>
                  )}

                  {/* C. Fill Blanks input tag builders */}
                  {editingQuestion.type === 'fill_blank' && (
                    <div className="space-y-3 bg-[var(--color-accent-soft)]/40 p-4 rounded-2xl border border-[var(--color-accent-soft)]/50">
                      <span className="text-micro text-[var(--color-accent)] font-extrabold block">
                        کلید واژه‌های صحیح برای پرکردن جاهای خالی (به ترتیب):
                      </span>
                      <div className="space-y-2">
                        {(editingQuestion.correctFillBlanks || ['']).map((word, wIdx) => (
                          <div
                            key={wIdx}
                            className="flex gap-2 items-center glx p-2 rounded-xl border"
                          >
                            <span className="text-[var(--color-text-tertiary)] font-bold font-mono">
                              جای خالی ({toPersianDigits(wIdx + 1)}):
                            </span>
                            <input
                              type="text"
                              value={word}
                              onChange={(e) => {
                                const nextWords = [...(editingQuestion.correctFillBlanks || [])];
                                nextWords[wIdx] = e.target.value;
                                setEditingQuestion({
                                  ...editingQuestion,
                                  correctFillBlanks: nextWords,
                                });
                              }}
                              className="w-full bg-transparent border-none text-caption focus:ring-0"
                              placeholder="کلمه معتبر..."
                            />
                            <button
                              type="button"
                              aria-label={`حذف پاسخ معتبر شماره ${toPersianDigits(wIdx + 1)}`}
                              title="حذف پاسخ"
                              onClick={() => {
                                const nextWords = (editingQuestion.correctFillBlanks || []).filter(
                                  (_, i) => i !== wIdx,
                                );
                                setEditingQuestion({
                                  ...editingQuestion,
                                  correctFillBlanks: nextWords,
                                });
                              }}
                              className="p-1 hover:brightness-105 text-[var(--color-danger)] rounded-lg"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const nextWords = [...(editingQuestion.correctFillBlanks || []), ''];
                          setEditingQuestion({ ...editingQuestion, correctFillBlanks: nextWords });
                        }}
                        className="w-full glx text-[var(--color-accent)] text-micro py-1.5 rounded-xl border border-[var(--color-accent)]/20 font-bold hover:bg-[var(--color-accent-soft)] transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>افزودن جای خالی گمشده دیگر</span>
                      </button>
                    </div>
                  )}

                  {/* D. Rubrics Metrics setup (Descriptive Long Answer) */}
                  {editingQuestion.type === 'long_answer' && (
                    <div className="space-y-3 bg-[var(--color-danger-soft)]/40 p-4 rounded-2xl border border-[var(--color-danger)]/10">
                      <div className="flex justify-between items-center border-b border-[var(--color-danger)]/10 pb-1.5">
                        <span className="text-micro text-[var(--color-danger)] font-extrabold">
                          معیارهای واگذاری بارم تصحیح:
                        </span>
                        <button
                          type="button"
                          onClick={addNewRubricInDrawer}
                          className="bg-[var(--color-danger-solid)] text-[var(--color-text-on-solid)] px-2.5 py-1 rounded-lg hover:bg-[var(--color-glass-light-fill)] transition-all font-bold text-micro flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>افزودن معیار بارم</span>
                        </button>
                      </div>

                      <div className="space-y-3">
                        {(editingQuestion.rubrics || []).map((rub) => (
                          <div
                            key={rub.id}
                            className="glx p-3 rounded-xl border border-[var(--color-danger)]/10 space-y-2"
                          >
                            <div className="flex gap-2 justify-between">
                              <input
                                type="text"
                                value={rub.title}
                                onChange={(e) =>
                                  updateRubricInDrawer(rub.id, { title: e.target.value })
                                }
                                className="w-full glx border-none px-2 py-1 rounded-md text-[var(--color-text-primary)] font-bold font-sans"
                                placeholder="نام معیار (مثال: رسم درست نمودار)"
                              />
                              <input
                                type="number"
                                step="0.25"
                                value={rub.maxPoints}
                                onChange={(e) =>
                                  updateRubricInDrawer(rub.id, {
                                    maxPoints: Number(e.target.value),
                                  })
                                }
                                className="w-20 glx border-none px-2 py-1 rounded-md font-bold font-mono text-center"
                                placeholder="بارم"
                              />
                            </div>
                            <input
                              type="text"
                              value={rub.description}
                              onChange={(e) =>
                                updateRubricInDrawer(rub.id, { description: e.target.value })
                              }
                              className="w-full glx border-none px-2 py-1 rounded-md"
                              placeholder="شرح کوتاه برای دبیـر تصحیح‌کننده..."
                            />
                            <button
                              type="button"
                              onClick={() => removeRubricInDrawer(rub.id)}
                              className="text-[var(--color-danger)] font-bold hover:bg-[var(--color-danger-soft)]/40 px-2 py-1 rounded-md block text-micro transition-all"
                            >
                              پاک کردن این گزینه معیار
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* E. Subquestions parts list (Reading comprehension) */}
                  {editingQuestion.type === 'reading_comprehension' && (
                    <div className="space-y-3 bg-[var(--color-info-soft)]/30/40 p-4 rounded-2xl border border-[var(--color-info)]/20">
                      <div className="flex justify-between items-center border-b border-[var(--color-info)]/20 pb-1.5">
                        <span className="text-micro text-[var(--color-info)] font-extrabold">
                          زیرسوالات درک مطلب (مینی‌سوال‌ها):
                        </span>
                        <button
                          type="button"
                          onClick={addNewSubquestionPartInDrawer}
                          className="bg-[var(--color-info-soft)]/80 text-[var(--color-text-on-solid)] px-2.5 py-1 rounded-xl font-bold text-micro"
                        >
                          افزودن زیرسوال جدید
                        </button>
                      </div>

                      <div className="space-y-3">
                        {(editingQuestion.parts || []).map((part, pIdx) => (
                          <div
                            key={part.id}
                            className="glx p-3 rounded-xl border border-[var(--color-info)]/20 space-y-2"
                          >
                            <div className="flex justify-between items-center text-micro text-[var(--color-text-tertiary)]">
                              <span>زیرسوال شماره {toPersianDigits(pIdx + 1)}</span>
                              <button
                                type="button"
                                onClick={() => removeSubquestionPartInDrawer(part.id)}
                                className="text-[var(--color-danger)]"
                              >
                                حذف
                              </button>
                            </div>
                            <input
                              type="text"
                              value={part.text}
                              onChange={(e) =>
                                updateSubquestionTextInDrawer(part.id, e.target.value)
                              }
                              className="w-full glx border-none p-1.5 rounded-md font-semibold text-[var(--color-text-primary)]"
                              placeholder="نمام متن مینی‌سوال..."
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Save trigger inside drawer */}
                <div className="p-4 glx border-t flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDrawerQuestion}
                    className="flex-1 py-2.5 bg-[var(--color-accent-solid)] hover:bg-[var(--color-accent-solid-hover)] text-[var(--color-text-on-solid)] font-bold rounded-xl text-center shadow-xs cursor-pointer text-caption"
                  >
                    ثبت نهایی و بازگشت به ورقه املاکی
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingQuestion(null)}
                    className="flex-1 py-2.5 glx-inset hover:glx-inset text-[var(--color-text-secondary)] font-bold rounded-xl text-center cursor-pointer text-caption"
                  >
                    لغو تغییرات
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
