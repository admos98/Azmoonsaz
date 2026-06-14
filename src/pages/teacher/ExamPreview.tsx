/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Eye, 
  ShieldAlert, 
  Award, 
  Clock, 
  AlertCircle, 
  Sparkles, 
  Sliders, 
  Check, 
  CheckSquare, 
  PlusCircle, 
  Trash2, 
  Edit, 
  Save, 
  List, 
  Grid, 
  Info, 
  ChevronUp, 
  ChevronDown, 
  CheckCircle, 
  RefreshCw, 
  X, 
  Play, 
  Settings, 
  FileText, 
  HelpCircle, 
  Layers, 
  Image as ImageIcon, 
  Plus, 
  Trash,
  Settings2
} from 'lucide-react';
import { Exam, Question, QuestionType, QuestionOption, QuestionPart, RubricCriterion, ExamSection } from '../../types';
import { mockQuestions, mockClassGroups } from '../../mockData';

interface ExamPreviewProps {
  exam: Exam;
  onBack: () => void;
  onSave?: (updatedExam: Exam) => void;
  onNavigateToSettings?: (updatedExam: Exam) => void;
}

interface ValidationWarning {
  id: string;
  type: 'no_correct_answer' | 'no_points' | 'descriptive_no_rubric' | 'section_no_question' | 'image_missing';
  message: string;
  targetId: string; // questionId or sectionId
  targetName: string;
}

export default function ExamPreview({ exam, onBack, onSave, onNavigateToSettings }: ExamPreviewProps) {
  // Local reactive exam state
  const [localExam, setLocalExam] = useState<Exam>({ ...exam });

  // Mode state: 'teacher' (معلم) or 'student' (دانش‌آموز)
  const [viewMode, setViewMode] = useState<'teacher' | 'student'>('teacher');

  // Student response Simulation State (interactive inputs)
  const [studentAnswers, setStudentAnswers] = useState<Record<string, any>>({});

  // Active question being edited in drawer/modal (null means closed)
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
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

  // Sync state if initial prop changes
  useEffect(() => {
    setLocalExam({ ...exam });
  }, [exam]);

  // Persian digit converter helper
  const toPersianDigits = (str: string | number | undefined): string => {
    if (str === undefined) return '';
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  const getDifficultyLabel = (diff: string | undefined): string => {
    if (diff === 'easy') return 'آسان';
    if (diff === 'medium') return 'متوسط';
    if (diff === 'hard') return 'سخت';
    return 'متوسط';
  };

  const getDifficultyColor = (diff: string | undefined): string => {
    if (diff === 'easy') return 'bg-emerald-50 text-emerald-700 border-emerald-150';
    if (diff === 'hard') return 'bg-rose-50 text-rose-700 border-rose-150';
    return 'bg-amber-50 text-amber-700 border-amber-150';
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

  // 1. Dynamic Validation System
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);

  useEffect(() => {
    const list: ValidationWarning[] = [];

    // Analyze empty sections
    localExam.sections.forEach(sec => {
      if (!sec.questionIds || sec.questionIds.length === 0) {
        list.push({
          id: `sec-em-${sec.id}`,
          type: 'section_no_question',
          message: `بخش «${sec.title}» صدمه دیده یا فاقد هرگونه سوال انتصابی است.`,
          targetId: sec.id,
          targetName: sec.title
        });
      }
    });

    // Analyze individual questions
    localExam.questions.forEach(q => {
      // No grade/points check
      if (q.points === undefined || q.points <= 0) {
        list.push({
          id: `q-pt-${q.id}`,
          type: 'no_points',
          message: `سوال «${q.title || 'بدون مشخصه'}» فاقد امتیاز یا بارم عددی است (نمره صفر یا نامعتبر).`,
          targetId: q.id,
          targetName: q.title
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
            targetName: q.title
          });
        } else if (['single_choice', 'image_based'].includes(q.type) && !q.correctAnswer) {
          list.push({
            id: `q-key-sc-${q.id}`,
            type: 'no_correct_answer',
            message: `سوال چهارگزینه‌ای «${q.title}» فاقد گزینه کلید پاسخ صحیح معرفی شده است.`,
            targetId: q.id,
            targetName: q.title
          });
        } else if (q.type === 'multiple_choice' && (!Array.isArray(q.correctAnswer) || q.correctAnswer.length === 0)) {
          list.push({
            id: `q-key-mc-${q.id}`,
            type: 'no_correct_answer',
            message: `سوال چندگزینه‌ای چندپاسخ «${q.title}» فاقد حداقل یک کلید درست است.`,
            targetId: q.id,
            targetName: q.title
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
          targetName: q.title
        });
      }

      // Image Based missing media
      if (q.type === 'image_based' && !q.imageUrl) {
        list.push({
          id: `q-img-${q.id}`,
          type: 'image_missing',
          message: `سوال تصویری «${q.title}» تصویر یا نمودار پیوست بارگذاری شده معتبری ندارد.`,
          targetId: q.id,
          targetName: q.title
        });
      }
    });

    setWarnings(list);
  }, [localExam]);

  // Total scores summary
  const totalScore = localExam.questions.reduce((sum, q) => sum + (q.points || 0), 0);
  const totalQuestions = localExam.questions.length;

  // Assigned Classes String Lookup
  const getAssignedClassesString = () => {
    if (!localExam.classGroupIds || localExam.classGroupIds.length === 0) return 'به کلاسی تخصیص داده نشده';
    return localExam.classGroupIds
      .map(cid => mockClassGroups.find(c => c.id === cid)?.name)
      .filter(Boolean)
      .join(' و ');
  };

  // Move Question up/down inside section allocation index
  const moveQuestion = (questionId: string, direction: 'up' | 'down') => {
    // Find section containing it
    const updatedSections = localExam.sections.map(sec => {
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
      sections: updatedSections
    });
  };

  // Delete question from section and questions array
  const deleteQuestion = (questionId: string) => {
    const confirmed = window.confirm('آیا از حذف این سوال از برگه آزمون مطمئن هستید؟');
    if (!confirmed) return;

    const updatedSections = localExam.sections.map(sec => ({
      ...sec,
      questionIds: sec.questionIds.filter(id => id !== questionId)
    }));

    const updatedQuestions = localExam.questions.filter(q => q.id !== questionId);

    setLocalExam({
      ...localExam,
      sections: updatedSections,
      questions: updatedQuestions
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
    const randId = `q-rep-${Date.now()}`;
    const clonedQ: Question = { ...selectedBankQ, id: randId };

    // Update in questions array
    const updatedQuestions = localExam.questions.map(q => q.id === replacingQuestionId ? clonedQ : q);

    // Update in section arrays list
    const updatedSections = localExam.sections.map(sec => {
      if (sec.id === replacingSectionId) {
        return {
          ...sec,
          questionIds: sec.questionIds.map(qid => qid === replacingQuestionId ? randId : qid)
        };
      }
      return sec;
    });

    setLocalExam({
      ...localExam,
      questions: updatedQuestions,
      sections: updatedSections
    });

    setReplacingQuestionId(null);
    setReplacingSectionId(null);
  };

  // Open Edit Dialog Drawer for existing question, or create new question representation
  const triggerEditQuestion = (q: Question) => {
    setEditingQuestion({ ...q });
    setIsAddingNew(false);
  };

  const triggerAddManualQuestion = (sectionId: string) => {
    setTargetSectionIdForNew(sectionId);
    setEditingQuestion({
      id: `q-man-${Date.now()}`,
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
        { id: 'o4', text: 'گزینه چهارم تستی', isCorrect: false }
      ],
      rubrics: [],
      parts: []
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
      createdAt: editingQuestion.createdAt || new Date().toISOString()
    };

    if (isAddingNew) {
      // Append questioning to dynamic container list
      const updatedQuestions = [...localExam.questions, validatedQ];
      const updatedSections = localExam.sections.map(sec => {
        if (sec.id === targetSectionIdForNew) {
          return {
            ...sec,
            questionIds: [...sec.questionIds, validatedQ.id]
          };
        }
        return sec;
      });

      setLocalExam({
        ...localExam,
        questions: updatedQuestions,
        sections: updatedSections
      });
    } else {
      const updatedQuestions = localExam.questions.map(q => q.id === validatedQ.id ? validatedQ : q);
      setLocalExam({
        ...localExam,
        questions: updatedQuestions
      });
    }

    setEditingQuestion(null);
  };

  // Option row controls in edit question drawer
  const updateOptionTextInDrawer = (optId: string, text: string) => {
    if (!editingQuestion || !editingQuestion.options) return;
    const nextOpts = editingQuestion.options.map(o => o.id === optId ? { ...o, text } : o);
    setEditingQuestion({ ...editingQuestion, options: nextOpts });
  };

  const toggleOptionCorrectInDrawer = (optId: string) => {
    if (!editingQuestion || !editingQuestion.options) return;
    const isSingle = ['single_choice', 'image_based'].includes(editingQuestion.type || '');
    
    let nextOpts: QuestionOption[] = [];
    if (isSingle) {
      nextOpts = editingQuestion.options.map(o => ({
        ...o,
        isCorrect: o.id === optId
      }));
      setEditingQuestion({
        ...editingQuestion,
        options: nextOpts,
        correctAnswer: optId
      });
    } else {
      nextOpts = editingQuestion.options.map(o => o.id === optId ? { ...o, isCorrect: !o.isCorrect } : o);
      const multipleCorrectKeys = nextOpts.filter(o => o.isCorrect).map(o => o.id);
      setEditingQuestion({
        ...editingQuestion,
        options: nextOpts,
        correctAnswer: multipleCorrectKeys
      });
    }
  };

  const addNewOptionInDrawer = () => {
    if (!editingQuestion) return;
    const currentOpts = editingQuestion.options || [];
    const newOptId = `o-rand-${Date.now()}`;
    const nextOpts: QuestionOption[] = [
      ...currentOpts,
      { id: newOptId, text: `گزینه تستی شماره ${toPersianDigits(currentOpts.length + 1)}`, isCorrect: false }
    ];
    setEditingQuestion({ ...editingQuestion, options: nextOpts });
  };

  const removeOptionInDrawer = (optId: string) => {
    if (!editingQuestion || !editingQuestion.options) return;
    const nextOpts = editingQuestion.options.filter(o => o.id !== optId);
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
        { id: 'po2', text: 'گزینه ب زیرسوال', isCorrect: false }
      ],
      correctAnswer: 'po1'
    };
    setEditingQuestion({
      ...editingQuestion,
      parts: [...currentParts, newPart]
    });
  };

  const removeSubquestionPartInDrawer = (partId: string) => {
    if (!editingQuestion || !editingQuestion.parts) return;
    setEditingQuestion({
      ...editingQuestion,
      parts: editingQuestion.parts.filter(p => p.id !== partId)
    });
  };

  const updateSubquestionTextInDrawer = (partId: string, text: string) => {
    if (!editingQuestion || !editingQuestion.parts) return;
    setEditingQuestion({
      ...editingQuestion,
      parts: editingQuestion.parts.map(p => p.id === partId ? { ...p, text } : p)
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
      maxPoints: 1.0
    };
    setEditingQuestion({
      ...editingQuestion,
      rubrics: [...currentRubrics, newRubric]
    });
  };

  const removeRubricInDrawer = (rubId: string) => {
    if (!editingQuestion || !editingQuestion.rubrics) return;
    setEditingQuestion({
      ...editingQuestion,
      rubrics: editingQuestion.rubrics.filter(r => r.id !== rubId)
    });
  };

  const updateRubricInDrawer = (rubId: string, fields: Partial<RubricCriterion>) => {
    if (!editingQuestion || !editingQuestion.rubrics) return;
    setEditingQuestion({
      ...editingQuestion,
      rubrics: editingQuestion.rubrics.map(r => r.id === rubId ? { ...r, ...fields } : r)
    });
  };

  // Student answer update simulation helper
  const handleStudentAnswerChange = (qId: string, val: any) => {
    setStudentAnswers({
      ...studentAnswers,
      [qId]: val
    });
  };

  // Replacement search filter pipeline
  const filteredBankQuestions = mockQuestions.filter(bq => {
    // Exclude physical matches already assigned in exam to avoid duplication
    if (localExam.questions.some(eq => eq.text === bq.text)) return false;

    const matchQuery = !replaceSearchQuery || 
      bq.title.toLowerCase().includes(replaceSearchQuery.toLowerCase()) ||
      bq.text.toLowerCase().includes(replaceSearchQuery.toLowerCase());

    const matchGrade = replaceFilterGrade === 'all' || bq.grade === replaceFilterGrade;
    const matchSubject = replaceFilterSubject === 'all' || bq.category.includes(replaceFilterSubject) || bq.category === replaceFilterSubject;
    const matchType = replaceFilterType === 'all' || bq.type === replaceFilterType;
    const matchDiff = replaceFilterDifficulty === 'all' || (bq as any).difficulty === replaceFilterDifficulty;

    return matchQuery && matchGrade && matchSubject && matchType && matchDiff;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-right bg-slate-50/50 p-1 md:p-3 rounded-2xl" dir="rtl" id="exam-preview-edit-canvas">
      
      {/* Upper header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            id="btn-back-to-exams-list"
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer border border-slate-150 transition-all font-bold"
            title="رجوع به بانک لیست آزمون‌ها"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm md:text-md font-extrabold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>پیش‌نمایش و ویرایش آزمون</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-1">تغییر ساختار فصل‌ها، جابه‌جایی نمرات، برسی الگوهای دانش‌آموزان و رفع نواقص فنی قبل از انتشار</p>
          </div>
        </div>

        {/* View mode toggle switcher layout */}
        <div className="flex items-center gap-2 w-full lg:w-auto self-end lg:self-center">
          <div className="bg-slate-100 p-1 rounded-2xl border border-slate-200 flex items-center gap-1 w-full lg:w-auto">
            <button
              onClick={() => setViewMode('teacher')}
              className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                viewMode === 'teacher' 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span>حالت ویرایش طراح (معلم)</span>
            </button>
            <button
              onClick={() => setViewMode('student')}
              className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                viewMode === 'student' 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
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
        <div className="bg-rose-50 border border-rose-150 rounded-2xl p-4.5 space-y-3" id="validation-errors-alert">
          <div className="flex items-center gap-2 text-rose-800">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <h3 className="text-xs font-extrabold">بررسی خودکار عیوب طراح ({toPersianDigits(warnings.length)} اشکال برجا مانده)</h3>
          </div>
          <p className="text-[11px] text-rose-700">دبیـر گرامی، سوالات برای انتشار امن و بدون خطا نیازمند برطرف کردن نواقص زیر می‌باشند:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10.5px]">
            {warnings.map(warn => (
              <div 
                key={warn.id} 
                className="bg-white/80 p-2.5 rounded-xl border border-rose-100 flex items-start gap-2 text-rose-900 cursor-pointer hover:bg-white transition-all"
                onClick={() => {
                  const targetElement = document.getElementById(`editor-q-box-${warn.targetId}`);
                  if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetElement.classList.add('ring-2', 'ring-rose-400');
                    setTimeout(() => targetElement.classList.remove('ring-2', 'ring-rose-400'), 2500);
                  }
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
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
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4 text-right">
            <h3 className="text-xs font-extrabold text-slate-800 pb-2.5 border-b border-slate-100 flex items-center gap-1.5">
              <Layers className="w-4.5 h-4.5 text-slate-500" />
              <span>جزییات شناسنامه آزمون</span>
            </h3>
            
            <div className="space-y-3.5 text-xs text-slate-705">
              <div className="flex justify-between items-center bg-slate-50/60 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-400">عنوان آزمون:</span>
                <span className="font-extrabold text-slate-800 text-[11px] max-w-[130px] truncate" title={localExam.title}>
                  {localExam.title}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">نوع بازخورد:</span>
                <span className={`font-bold px-2 py-0.5 rounded-md text-[10.5px] ${
                  localExam.settings.mode === 'official' 
                    ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                }`}>
                  {localExam.settings.mode === 'official' ? 'رسمی (بارم‌دار)' : 'تمرینی (خودسنجی)'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">پایه تحصیلی:</span>
                <span className="font-bold text-slate-700">پایه {localExam.grade}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-slate-400">درس هدف:</span>
                <span className="font-bold text-slate-700">{localExam.subject}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-slate-400">کـلاس اختصاصی:</span>
                <span className="font-bold text-slate-700 text-[11px] truncate max-w-[120px]" title={getAssignedClassesString()}>
                  {getAssignedClassesString()}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-slate-400">تعداد کل سوالات:</span>
                <span className="bg-slate-100 px-2.5 py-0.5 rounded-md font-extrabold text-slate-850 font-mono text-[11.5px]">
                  {toPersianDigits(totalQuestions)}
                </span>
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t border-slate-150/60">
                <span className="text-slate-800 font-bold">مجموع کل نمرات:</span>
                <span className="bg-amber-50 border border-amber-200/60 text-amber-800 px-3 py-1 rounded-xl font-black font-mono text-xs">
                  {toPersianDigits(totalScore)} نمره
                </span>
              </div>
            </div>

            {/* Completeness Status alert block */}
            <div className={`mt-4 p-3 rounded-2xl border flex items-center gap-2 ${
              warnings.length === 0 
                ? 'bg-emerald-50 text-emerald-950 border-emerald-200' 
                : 'bg-amber-50 text-amber-950 border-amber-205'
            }`}>
              {warnings.length === 0 ? (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-extrabold">آماده همگام زیستی</p>
                    <p className="text-[9.5px] text-emerald-600 leading-normal">آزمون کامل است و خطایی در پیکربندی یافت نشد.</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-extrabold">نیاز به تصحیح طراح</p>
                    <p className="text-[9.5px] text-amber-600 leading-normal">{toPersianDigits(warnings.length)} هشدار فعال روی برگه یافت شد.</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Guidelines info block */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-3xs text-xs space-y-3">
            <h4 className="font-bold text-slate-700 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-500" />
              <span>ملاحظات پاسخ‌نامه‌ها</span>
            </h4>
            <ul className="space-y-2 text-[10px] text-slate-500 list-disc pr-4 leading-relaxed">
              <li>جابه‌جایی نمره هر سوال مستقیماً بارم کل ورقه نهایی را تغییر می‌دهد.</li>
              <li>سوالات تشریحی نیاز به تعریف معیارهای مشخص بارم‌بندی برای صحت ارزیابی نهایی دارند.</li>
              <li>در حالت پیش‌نمایش دانش‌آموزی، پاسخ‌ها در کش موقت شبیه‌سازی خواهند شد.</li>
            </ul>
          </div>

        </div>

        {/* Left side core list of questions rendered perfectly (3/4 width) */}
        <div className="lg:col-span-3 space-y-6" id="questions-canvas">
          
          {localExam.sections.map((section, sIdx) => {
            const sectionQuestions = localExam.questions.filter(q => section.questionIds.includes(q.id));
            
            return (
              <div 
                key={section.id} 
                className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5"
                id={`pview-section-${section.id}`}
              >
                
                {/* Section Header */}
                <div className="border-b border-indigo-50/60 pb-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-600 text-white font-extrabold rounded-md px-2.5 py-0.5 text-[10px]">
                        بخش {toPersianDigits(sIdx + 1)}
                      </span>
                      <h4 className="text-xs font-slate-800 font-extrabold">{section.title}</h4>
                    </div>
                    {section.description && (
                      <p className="text-[10px] text-slate-400">{section.description}</p>
                    )}
                  </div>

                  {/* Manual Question Button per Section */}
                  {viewMode === 'teacher' && (
                    <button
                      type="button"
                      onClick={() => triggerAddManualQuestion(section.id)}
                      className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10.5px] font-bold border border-indigo-100 flex items-center gap-1.5 cursor-pointer transition-all self-end md:self-center"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>افزودن سوال دستی به این بخش</span>
                    </button>
                  )}
                </div>

                {/* Question rendering */}
                <div className="space-y-8 divide-y divide-slate-100 pr-1">
                  {sectionQuestions.map((q, qIdx) => {
                    const hasImage = !!q.imageUrl;
                    const optionsHaveImages = q.options?.some(o => (o as any).imageUrl);
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
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                              شماره {toPersianDigits(qIdx + 1)}
                            </span>
                            <span className="bg-indigo-50 text-indigo-800 border border-indigo-100/50 px-2 py-0.5 rounded-md font-semibold">
                              {getTypeNameInPersian(q.type)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="bg-amber-50 text-amber-700 font-bold border border-amber-250 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                              <Award className="w-3.5 h-3.5 text-amber-500" />
                              <span>{toPersianDigits(q.points)} امتیاز</span>
                            </span>
                          </div>
                        </div>

                        {/* Visual Image/Diagram in question Prompt if available */}
                        <div className="space-y-3.5">
                          <p className="text-xs text-slate-800 font-bold leading-relaxed">{q.text}</p>
                          
                          {q.imageUrl && (
                            <div className="max-w-md bg-slate-50 border border-slate-200 rounded-2xl p-2 relative group inline-block">
                              <img
                                src={q.imageUrl}
                                alt="سوال پیوست"
                                referrerPolicy="no-referrer"
                                className="max-h-56 rounded-xl object-contain bg-white transition-all shadow-3xs"
                              />
                              <span className="absolute bottom-3 right-3 bg-slate-900/70 text-white rounded-md px-2 py-0.5 text-[9px]">
                                تصویر ضمیمه سوال
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Rendering different input templates if Mode is Student vs Teacher */}

                        {/* 1. Choices / Options render */}
                        {(q.type === 'single_choice' || q.type === 'multiple_choice' || q.type === 'image_based') && q.options && (
                          <div className={`mt-3 ${optionsHaveImages ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-2'}`}>
                            {q.options.map((opt) => {
                              const isCorrectOption = opt.isCorrect || q.correctAnswer === opt.id || (Array.isArray(q.correctAnswer) && q.correctAnswer.includes(opt.id));
                              const currentSelected = studentAnswers[q.id] === opt.id || (Array.isArray(studentAnswers[q.id]) && studentAnswers[q.id].includes(opt.id));

                              return (
                                <div
                                  key={opt.id}
                                  onClick={() => {
                                    if (viewMode === 'student') {
                                      if (q.type === 'multiple_choice') {
                                        const old: string[] = studentAnswers[q.id] || [];
                                        const next = old.includes(opt.id) ? old.filter(x => x !== opt.id) : [...old, opt.id];
                                        handleStudentAnswerChange(q.id, next);
                                      } else {
                                        handleStudentAnswerChange(q.id, opt.id);
                                      }
                                    }
                                  }}
                                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                                    viewMode === 'teacher' && isCorrectOption
                                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 font-semibold shadow-3xs'
                                      : currentSelected && viewMode === 'student'
                                      ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-semibold shadow-3xs'
                                      : 'bg-slate-50 border-slate-150 text-slate-700 hover:border-slate-350'
                                  }`}
                                >
                                  <div className="flex items-start gap-2.5">
                                    <div className="pt-0.5">
                                      {q.type === 'multiple_choice' ? (
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                          (viewMode === 'teacher' && isCorrectOption) || (viewMode === 'student' && currentSelected)
                                            ? 'bg-indigo-600 border-indigo-600 text-white'
                                            : 'border-slate-300 bg-white'
                                        }`}>
                                          <Check className="w-3 h-3" />
                                        </div>
                                      ) : (
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                          (viewMode === 'teacher' && isCorrectOption) || (viewMode === 'student' && currentSelected)
                                            ? 'bg-indigo-600 border-indigo-600 text-white'
                                            : 'border-slate-300 bg-white'
                                        }`}>
                                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="space-y-2 flex-1 text-right">
                                      <span className="leading-relaxed">{opt.text}</span>
                                      
                                      {(opt as any).imageUrl && (
                                        <div className="mt-2 block max-w-xs">
                                          <img
                                            src={(opt as any).imageUrl}
                                            alt="گزینه"
                                            referrerPolicy="no-referrer"
                                            className="rounded-lg border border-slate-200/80 max-h-32 object-contain bg-white w-full"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {viewMode === 'teacher' && isCorrectOption && (
                                    <div className="mr-6 mt-2 flex items-center gap-1 text-[10px] font-bold text-emerald-700">
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
                              { label: 'غلط / نادرست', val: false }
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
                                  className={`flex-1 p-3.5 rounded-xl border text-center font-bold text-xs flex items-center justify-center cursor-pointer gap-2 ${
                                    viewMode === 'teacher' && isCorrect
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-3xs'
                                      : viewMode === 'student' && isSelected
                                      ? 'bg-indigo-50 border-indigo-400 text-indigo-800 shadow-3xs'
                                      : 'bg-slate-50 border-slate-150 text-slate-600 hover:border-slate-300'
                                  }`}
                                >
                                  <span>{item.label}</span>
                                  {((viewMode === 'teacher' && isCorrect) || (viewMode === 'student' && isSelected)) && (
                                    <span className="bg-indigo-600 text-white p-0.5 rounded-full">
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
                            <label className="text-[10px] text-slate-400 font-bold block">محل پاسخ کوتاه دانش‌آموز:</label>
                            <input
                              type="text"
                              disabled={viewMode === 'teacher'}
                              placeholder={viewMode === 'teacher' ? 'فقط در حالت پیش‌نمایش دانش‌آموز قابل پاسخ‌دهی است...' : 'پاسخ کوتاه خود را در اینجا بنویسید...'}
                              value={studentAnswers[q.id] || ''}
                              onChange={(e) => handleStudentAnswerChange(q.id, e.target.value)}
                              className="w-full bg-white border border-slate-200 text-xs text-slate-750 px-3.5 py-2.5 rounded-xl focus:outline-hidden focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 placeholder-slate-300"
                            />
                            {viewMode === 'teacher' && q.correctAnswer && (
                              <div className="bg-emerald-50 text-emerald-800 border-l-2 border-emerald-400 p-2 text-[10.5px] rounded-md font-medium">
                                کلید پاسخ مورد قبول سیستم: «{String(q.correctAnswer)}»
                              </div>
                            )}
                          </div>
                        )}

                        {/* 4. Long Answer Form / Area */}
                        {isLongAnswer && (
                          <div className="space-y-3.5 mt-2">
                            <label className="text-[10px] text-slate-400 font-bold block">محل پاسخ تشریحی دانش‌آموز:</label>
                            <textarea
                              rows={3}
                              disabled={viewMode === 'teacher'}
                              placeholder={viewMode === 'teacher' ? 'فقط در حالت پیش‌نمایش دانش‌آموز قابل پاسخ‌دهی است...' : 'پاسخ کامل تشریحی خود را در زیر بنویسید... برای سوالات درس محاسباتی حتماً فرمول‌ها را وارد کنید.'}
                              value={studentAnswers[q.id] || ''}
                              onChange={(e) => handleStudentAnswerChange(q.id, e.target.value)}
                              className="w-full bg-white border border-slate-200 text-xs text-slate-750 p-3.5 rounded-xl focus:outline-hidden focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 placeholder-slate-350 leading-relaxed text-right"
                            />
                            
                            {/* Rubric evaluation criteria info boxes */}
                            {q.rubrics && q.rubrics.length > 0 && (
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-2.5 text-[11px]">
                                <span className="block font-bold text-slate-700">معیارهای توزیع بارم تصحیح معلم:</span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {q.rubrics.map((rub: RubricCriterion) => (
                                    <div key={rub.id} className="p-3 bg-white border border-slate-150 rounded-xl space-y-1">
                                      <div className="flex justify-between items-center text-slate-900 border-b border-slate-100 pb-1">
                                        <strong className="font-bold">{rub.title}</strong>
                                        <span className="bg-indigo-50 text-indigo-700 rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold">{toPersianDigits(rub.maxPoints)} نمره</span>
                                      </div>
                                      <p className="text-[9.5px] text-slate-400">{rub.description}</p>
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
                            <label className="text-[10px] text-slate-400 font-bold block">محل جایگذاری جاهای خالی:</label>
                            {viewMode === 'student' ? (
                              <div className="flex flex-wrap gap-2">
                                {(q.correctFillBlanks || ['']).map((_, fIdx) => (
                                  <div key={fIdx} className="flex items-center gap-1 text-xs">
                                    <span className="text-slate-400 font-bold">جای خالی ({toPersianDigits(fIdx + 1)}):</span>
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
                                      className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-indigo-400 w-28 text-center"
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1 bg-emerald-50 p-2 rounded-xl text-[10.5px] border border-emerald-100/60 text-emerald-800">
                                <span className="font-bold block mr-2">کلید کل کلمات گمشده:</span>
                                {q.correctFillBlanks?.map((word, idx) => (
                                  <span key={idx} className="bg-white px-2 py-0.5 rounded-md font-bold font-mono text-emerald-700 ml-1">
                                    {toPersianDigits(idx + 1)}. {word}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 6. Matching Pairs elements rendering */}
                        {q.type === 'matching' && q.matchingPairs && (
                          <div className="bg-slate-50/70 rounded-2xl p-4.5 border border-slate-150 mt-2 space-y-3.5 text-xs">
                            <span className="block font-bold text-slate-700">تطبیق ستون الف با ب:</span>
                            <div className="space-y-2">
                              {q.matchingPairs.map((pair, pIdx) => (
                                <div key={pIdx} className="flex items-center justify-between gap-2.5 bg-white px-3 py-2 rounded-xl border border-slate-150">
                                  <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-bold flex-1 text-center">
                                    {pair.right}
                                  </span>
                                  <span className="text-slate-300 font-black">➔</span>
                                  <span className="bg-indigo-50 text-indigo-800 border border-indigo-100 px-3 py-1.5 rounded-lg font-bold flex-1 text-center">
                                    {pair.left}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 7. Ordering array rendering */}
                        {q.type === 'ordering' && q.orderingItems && (
                          <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-150 mt-2 text-xs">
                            <span className="font-bold text-slate-755 block mb-2.5">ترتیب قرارگیری مراحل صحیح:</span>
                            <div className="flex flex-wrap gap-2 items-center">
                              {q.orderingItems.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="bg-white border border-slate-200 text-slate-800 px-3.5 py-2 font-black rounded-xl shadow-3xs">
                                    {toPersianDigits(idx + 1)}. {item}
                                  </span>
                                  {idx < (q.orderingItems?.length || 0) - 1 && (
                                    <span className="text-slate-400 font-extrabold text-[12px]">➔</span>
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
                                <span className="block font-bold text-slate-700 text-xs border-r-2 border-indigo-500 pr-2 pb-0.5">زیرسوالات درک مطلب:</span>
                                {q.parts.map((part: QuestionPart, idx: number) => {
                                  return (
                                    <div key={part.id} className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-3">
                                      <h6 className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                        <span className="bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">
                                          {toPersianDigits(idx + 1)}
                                        </span>
                                        <span>{part.text}</span>
                                      </h6>

                                      {/* Mini options in subquestions */}
                                      {part.options && part.options.length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] mr-5">
                                          {part.options.map((opt) => {
                                            const isCorrect = opt.isCorrect || part.correctAnswer === opt.id;
                                            return (
                                              <div 
                                                key={opt.id}
                                                className={`p-2 rounded-lg border ${
                                                  viewMode === 'teacher' && isCorrect
                                                    ? 'bg-emerald-50 border-emerald-250 text-emerald-900 font-bold'
                                                    : 'bg-white border-slate-200 text-slate-700'
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
                                  <div key={p.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-2">
                                    <strong className="text-indigo-900 font-bold text-[10.5px] block text-right">جای خالی کلوز شماره {toPersianDigits(pIdx + 1)}</strong>
                                    <div className="flex flex-wrap gap-1.5 text-[10.5px]">
                                      {p.options?.map((opt) => (
                                        <span 
                                          key={opt.id} 
                                          className={`px-2 py-0.5 rounded-md border text-center ${
                                            (opt.isCorrect || p.correctAnswer === opt.id) && viewMode === 'teacher'
                                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800 font-bold font-mono'
                                              : 'bg-white border-slate-200 text-slate-650'
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
                          <div className="bg-slate-50 -mx-5 -mb-6 mt-4 p-3.5 border-t border-slate-150 flex flex-wrap items-center justify-between gap-3.5 rounded-b-3xl">
                            
                            {/* Order Moving Controls */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => moveQuestion(q.id, 'up')}
                                className="p-2 bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 cursor-pointer text-[10px] font-bold flex items-center gap-1 transition-all"
                                title="جابه‌جایی سوال به بالا"
                              >
                                <ChevronUp className="w-4 h-4 text-indigo-600" />
                                <span>بالاتر</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => moveQuestion(q.id, 'down')}
                                className="p-2 bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 cursor-pointer text-[10px] font-bold flex items-center gap-1 transition-all"
                                title="جابه‌جایی سوال به پایین"
                              >
                                <ChevronDown className="w-4 h-4 text-indigo-600" />
                                <span>پایین‌تر</span>
                              </button>
                            </div>

                            {/* Core Action Tools */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => triggerEditQuestion(q)}
                                className="p-2 bg-white hover:bg-slate-150 text-indigo-700 hover:text-indigo-900 rounded-lg border border-indigo-100 hover:border-indigo-200 cursor-pointer text-[10.5px] font-bold flex items-center gap-1.5 transition-all"
                              >
                                <Edit className="w-3.5 h-3.5 text-indigo-600" />
                                <span>ویرایش محتوا و گزینه‌ها</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => triggerReplaceQuestion(q.id, section.id)}
                                className="p-2 bg-white hover:bg-slate-150 text-amber-700 hover:text-amber-900 rounded-lg border border-amber-100 hover:border-amber-200 cursor-pointer text-[10.5px] font-bold flex items-center gap-1.5 transition-all"
                              >
                                <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                                <span>جایگزینی از بانک سوالات</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteQuestion(q.id)}
                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-100 cursor-pointer text-[10.5px] font-bold flex items-center gap-1 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>حذف سوال</span>
                              </button>
                            </div>

                          </div>
                        )}

                      </div>
                    );
                  })}

                  {sectionQuestions.length === 0 && (
                    <div className="py-12 text-center text-slate-400 select-none space-y-2">
                      <HelpCircle className="w-10 h-10 mx-auto text-slate-300" />
                      <p className="text-xs font-bold text-slate-600">این بخش فاقد هرگونه سوال انتصابی است</p>
                      <p className="text-[10px] text-slate-400">می‌توانید با دکمه بالا سوال دستی اضافه کنید یا از بانک سوالات کپی نمایید.</p>
                    </div>
                  )}
                </div>

              </div>
            );
          })}

        </div>

      </div>

      {/* FOOTER ACTIONS BAR */}
      <div className="border-t border-slate-200 bg-white p-5 rounded-3xl mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-3xs" id="preview-footer-plate">
        <button
          onClick={onBack}
          className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer text-center"
        >
          بازگشت به ساخت آزمون
        </button>

        <div className="flex gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => {
              if (onSave) {
                onSave(localExam);
              } else {
                alert('پیش‌نویس جدید آزمون با موفقیت در فضای ابری ذخیره شد.');
              }
            }}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-all border border-indigo-100 cursor-pointer text-center"
          >
            ذخیره پیش‌نویس موقت
          </button>
          
          <button
            onClick={() => {
              if (onNavigateToSettings) {
                onNavigateToSettings(localExam);
              } else {
                alert('تغییرات شما ذخیره شد. در حال هدایت به تنظیمات توزیع آزمون...');
              }
            }}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer text-center"
          >
            ادامه به تنظیمات توزیع آزمون
          </button>
        </div>
      </div>

      {/* MODAL 1: REPLACE QUESTION BANK */}
      {replacingQuestionId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4" id="replace-modal-backdrop">
          <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] text-right font-sans" dir="rtl">
            
            {/* Modal Header */}
            <div className="px-6 py-4.5 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-xs md:text-sm flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin-slow" />
                <span>جایگزینی سوال با مخزن بانک سوالات همگام</span>
              </h3>
              <button
                onClick={() => setReplacingQuestionId(null)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Smart Filters Header block inside modal */}
            <div className="p-4 bg-slate-100/60 border-b border-slate-150 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold block">پایه تحصیلی:</label>
                  <select
                    value={replaceFilterGrade}
                    onChange={(e) => setReplaceFilterGrade(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-[11px] p-1.5 rounded-lg text-slate-700 cursor-pointer focus:outline-hidden"
                  >
                    <option value="all">همه پایه‌ها</option>
                    <option value="هفتم">پایه هفتم</option>
                    <option value="هشتم">پایه هشتم</option>
                    <option value="نهم">پایه نهم</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold block">درس هدف:</label>
                  <select
                    value={replaceFilterSubject}
                    onChange={(e) => setReplaceFilterSubject(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-[11px] p-1.5 rounded-lg text-slate-700 cursor-pointer focus:outline-hidden"
                  >
                    <option value="all">همه درس‌ها</option>
                    <option value={localExam.subject}>{localExam.subject}</option>
                    <option value="علوم تجربی">علوم تجربی</option>
                    <option value="ریاضی پایه هفتم">ریاضی پایه هفتم</option>
                    <option value="ادبیات">ادبیات</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold block">قالب سوال قالب:</label>
                  <select
                    value={replaceFilterType}
                    onChange={(e) => setReplaceFilterType(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-[11px] p-1.5 rounded-lg text-slate-700 cursor-pointer focus:outline-hidden"
                  >
                    <option value="all">همه قالب‌ها</option>
                    <option value="single_choice">چهارگزینه‌ای</option>
                    <option value="true_false">درست/غلط</option>
                    <option value="short_answer">پاسخ کوتاه</option>
                    <option value="long_answer">تشریحی</option>
                    <option value="matching">وصل‌کردنی</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold block">سطح سختی:</label>
                  <select
                    value={replaceFilterDifficulty}
                    onChange={(e) => setReplaceFilterDifficulty(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-[11px] p-1.5 rounded-lg text-slate-700 cursor-pointer focus:outline-hidden"
                  >
                    <option value="all">همه سطوح</option>
                    <option value="easy">آسان</option>
                    <option value="medium">متوسط</option>
                    <option value="hard">سخت</option>
                  </select>
                </div>

              </div>

              {/* Text search querying inside modal */}
              <input
                type="text"
                placeholder="جستجو در کل صورت سوال یا موضوعات..."
                value={replaceSearchQuery}
                onChange={(e) => setReplaceSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 text-xs text-slate-750 px-3 py-2 rounded-xl focus:outline-hidden focus:border-indigo-400 text-right"
              />
            </div>

            {/* Questions Bank scrolling container list */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50">
              {filteredBankQuestions.length > 0 ? (
                filteredBankQuestions.map(bq => {
                  const hasImg = !!bq.imageUrl;
                  return (
                    <div 
                      key={bq.id} 
                      className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-indigo-400 transition-all shadow-3xs flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2 text-right">
                        
                        {/* Upper indicators bar */}
                        <div className="flex items-center justify-between gap-1 text-[9px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded-md">پایه {bq.grade}</span>
                            <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-md">{bq.category}</span>
                            <span className="bg-slate-50 text-slate-500 rounded-md px-1.5 py-0.5 font-medium border border-slate-150">
                              {getTypeNameInPersian(bq.type)}
                            </span>
                          </div>
                          
                          <div className={`px-2 py-0.5 rounded-full border font-bold ${getDifficultyColor((bq as any).difficulty || 'medium')}`}>
                            {getDifficultyLabel((bq as any).difficulty || 'medium')}
                          </div>
                        </div>

                        {/* Text */}
                        <h4 className="font-extrabold text-slate-800 text-[11.5px] line-clamp-1">{bq.title}</h4>
                        <p className="text-[10.5px] text-slate-500 leading-relaxed line-clamp-2">{bq.text}</p>
                        
                        {hasImg && (
                          <div className="text-[9.5px] text-indigo-600 bg-indigo-50/50 rounded-lg px-2 py-0.5 w-fit border border-indigo-100 font-semibold">
                            دارای تصویر ضمیمه مرتبط
                          </div>
                        )}
                      </div>

                      {/* Select and apply button */}
                      <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center text-[10px] text-slate-400">
                        <span>بارم استاندارد: {toPersianDigits(bq.points)} نمره</span>
                        <button
                          onClick={() => handleExecuteReplacement(bq)}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-[10.5px] cursor-pointer transition-all shadow-3xs"
                        >
                          تایید و جایگزینی این سوال
                        </button>
                      </div>

                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-400 select-none space-y-2">
                  <HelpCircle className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-650">سوال همخوانی داری در بانک یافت نشد</p>
                  <p className="text-[10px]">فیلترها را بردارید یا کلمه جستجو را کوتاه کنید.</p>
                </div>
              )}
            </div>

            {/* Modal Footer comments */}
            <div className="bg-slate-50 border-t border-slate-150 p-3 text-center text-[9px] text-slate-400 font-semibold">
              <span>تطبیق‌دهنده هوشمند آزمون‌ساز همگام دبیـران</span>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: MEGA ADD/EDIT MANUAL QUESTION PANEL (SIDE DRAWER DESIGN) */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex justify-end" id="drawer-container-backdrop">
          <div className="fixed inset-0" onClick={() => setEditingQuestion(null)} />
          
          <div
            className="w-full max-w-xl bg-slate-50 shadow-2xl z-10 flex flex-col h-full border-r border-slate-250 overflow-hidden text-xs text-right animate-in slide-in-from-right duration-300 font-sans"
            dir="rtl"
            id="drawer-edit-form"
          >
            {/* Drawer Header */}
            <div className="px-5 py-4 bg-white border-b border-slate-150 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-xs md:text-sm flex items-center gap-1.5">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <span>
                  {isAddingNew ? 'طرح سوال تازه برای برگه آزمون' : 'ویرایش جزئیات فنی و بارم سوال'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="p-1 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold cursor-pointer"
              >
                انصراف ×
              </button>
            </div>

            {/* Drawer scrolling form content */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              
              {/* Type selector */}
              <div className="space-y-1 bg-white p-3 rounded-2xl border border-slate-200">
                <label className="text-[10px] text-slate-400 font-bold block">نوع قالب‌بندی سوال:</label>
                <select
                  value={editingQuestion.type}
                  onChange={(e) => {
                    const nextVal = e.target.value as QuestionType;
                    setEditingQuestion({
                      ...editingQuestion,
                      type: nextVal,
                      // populate default structures if missing
                      options: ['single_choice', 'multiple_choice', 'image_based'].includes(nextVal)
                        ? editingQuestion.options || [
                            { id: 'o1', text: 'گزینه الف', isCorrect: true },
                            { id: 'o2', text: 'گزینه ب', isCorrect: false }
                          ]
                        : undefined,
                      rubrics: nextVal === 'long_answer' ? [] : undefined,
                      parts: nextVal === 'reading_comprehension' ? [] : undefined
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-700 p-2 rounded-xl focus:outline-hidden font-bold cursor-pointer"
                >
                  <option value="single_choice">چهارگزینه‌ای یا کتبی تستی</option>
                  <option value="multiple_choice">چندگزینه‌ای چندپاسخ</option>
                  <option value="true_false">درست / نادرست</option>
                  <option value="short_answer">پاسخ کوتاه (نیم‌تشریحی)</option>
                  <option value="long_answer">پاسخ تشریحی بلند</option>
                  <option value="fill_blank">پر کردن جاهای خالی</option>
                  <option value="matching">وصل‌کردنی ارتباطی</option>
                  <option value="ordering">مرتب‌سازی ترتیبی</option>
                  <option value="image_based">سوال تصویری یا تحلیلی</option>
                </select>
              </div>

              {/* Title & Points row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1 bg-white p-3.5 rounded-2xl border border-slate-200">
                  <label className="text-[10px] text-slate-400 font-bold block">عنوان خلاصه سوال:</label>
                  <input
                    type="text"
                    value={editingQuestion.title || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, title: e.target.value })}
                    className="w-full bg-slate-55 border border-slate-200/80 text-xs px-2.5 py-1.5 rounded-lg focus:outline-hidden focus:border-indigo-400"
                    placeholder="مثال: سوال مضاف‌الیه ادبیات"
                  />
                </div>

                <div className="space-y-1 bg-white p-3.5 rounded-2xl border border-slate-200 text-center">
                  <label className="text-[10px] text-slate-400 font-bold block text-right">بارم (امتیاز عددی):</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={editingQuestion.points || 0}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, points: Number(e.target.value) })}
                    className="w-full bg-slate-55 border border-slate-200/80 text-xs text-center font-bold px-2 py-1.5 rounded-lg focus:outline-hidden font-mono focus:border-indigo-400"
                  />
                </div>
              </div>

              {/* Question Text Prompt */}
              <div className="space-y-1 bg-white p-4 rounded-2xl border border-slate-200">
                <label className="text-[10px] text-slate-400 font-bold block">متن اصلی صورت سوال:</label>
                <textarea
                  rows={4}
                  value={editingQuestion.text || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, text: e.target.value })}
                  className="w-full bg-slate-55 border border-slate-200/80 text-xs p-3 rounded-lg focus:outline-hidden focus:border-indigo-400 leading-relaxed text-right placeholder-slate-300"
                  placeholder="صورت سوال علمی، پیوند‌ها و نمادها را در اینجا تایپ کنید..."
                />
              </div>

              {/* Image URL / media upload simulation */}
              <div className="space-y-2 bg-white p-3.5 rounded-2xl border border-slate-200">
                <label className="text-[10px] text-slate-400 font-bold block">تصویر یا نمودار پیوست سوال:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingQuestion.imageUrl || ''}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, imageUrl: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-xs px-2.5 py-1.5 rounded-lg placeholder-slate-300 focus:outline-hidden"
                    placeholder="آدرس اینترنتی تصویر (http://...) یا فرمت داده‌ها"
                  />
                  {editingQuestion.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setEditingQuestion({ ...editingQuestion, imageUrl: undefined })}
                      className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] transition-all cursor-pointer font-bold shrink-0"
                    >
                      حذف
                    </button>
                  )}
                </div>
                {/* Simulative quick presets to populate mock images safely */}
                <div className="flex flex-wrap gap-1 mt-1 justify-start">
                  <span className="text-[9px] text-slate-400 font-semibold self-center ml-1">چند پیوست پیش‌فرض:</span>
                  {[
                    { label: 'سلول گیاهی', url: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=500&auto=format&fit=crop&q=60' },
                    { label: 'نمودار اهرم‌ها', url: 'https://images.unsplash.com/photo-1632571401005-458e9d244591?w=500&auto=format&fit=crop&q=60' }
                  ].map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => setEditingQuestion({ ...editingQuestion, imageUrl: preset.url })}
                      className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100 hover:bg-indigo-100 transition-all text-[9px] font-bold"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific template setups according to chosen type! */}

              {/* A. Choice Options edit area */}
              {['single_choice', 'multiple_choice', 'image_based'].includes(editingQuestion.type || '') && (
                <div className="space-y-3 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/50">
                  <div className="flex justify-between items-center border-b border-indigo-100/60 pb-1.5">
                    <span className="text-[10.5px] text-indigo-900 font-extrabold">گزینه‌های پاسخ و تخصیص کلید:</span>
                    <button
                      type="button"
                      onClick={addNewOptionInDrawer}
                      className="bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-all font-bold text-[9.5px] flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن گزینه جدید</span>
                    </button>
                  </div>
                  
                  <div className="space-y-2.5">
                    {(editingQuestion.options || []).map((opt, oIdx) => (
                      <div key={opt.id} className="flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-200">
                        
                        {/* Correct trigger */}
                        <button
                          type="button"
                          onClick={() => toggleOptionCorrectInDrawer(opt.id)}
                          className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                            opt.isCorrect 
                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs' 
                              : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                          }`}
                          title={opt.isCorrect ? 'کلید پاسخ صحیح (غیرفعال‌سازی)' : 'تبدیل به کلید پاسخ صحیح'}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>

                        {/* Input */}
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => updateOptionTextInDrawer(opt.id, e.target.value)}
                          className="w-full bg-transparent border-none py-1 px-1.5 text-xs focus:ring-0 focus:outline-hidden"
                          placeholder={`متن گزینه ${toPersianDigits(oIdx + 1)} را بنویسید...`}
                        />

                        {/* Image Option helper */}
                        <input
                          type="text"
                          value={(opt as any).imageUrl || ''}
                          onChange={(e) => {
                            const updatedOpts = (editingQuestion.options || []).map(o => o.id === opt.id ? { ...o, imageUrl: e.target.value } : o);
                            setEditingQuestion({ ...editingQuestion, options: updatedOpts });
                          }}
                          className="bg-slate-50 border border-slate-150 text-[10px] w-28 px-1 rounded-md"
                          placeholder="آدرس تصویر گزینه"
                        />

                        {/* Remove Option */}
                        <button
                          type="button"
                          onClick={() => removeOptionInDrawer(opt.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
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
                <div className="space-y-2 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/50">
                  <span className="text-[10.5px] text-indigo-900 font-extrabold block">مشخص‌سازی کلید پاسخ درست:</span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingQuestion({ ...editingQuestion, correctAnswer: true })}
                      className={`flex-1 p-2.5 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                        editingQuestion.correctAnswer === true
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      صحیح
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingQuestion({ ...editingQuestion, correctAnswer: false })}
                      className={`flex-1 p-2.5 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                        editingQuestion.correctAnswer === false
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      غلط
                    </button>
                  </div>
                </div>
              )}

              {/* C. Fill Blanks input tag builders */}
              {editingQuestion.type === 'fill_blank' && (
                <div className="space-y-3 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/50">
                  <span className="text-[10.5px] text-indigo-900 font-extrabold block">کلید واژه‌های صحیح برای پرکردن جاهای خالی (به ترتیب):</span>
                  <div className="space-y-2">
                    {(editingQuestion.correctFillBlanks || ['']).map((word, wIdx) => (
                      <div key={wIdx} className="flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-slate-400 font-bold font-mono">جای خالی ({toPersianDigits(wIdx + 1)}):</span>
                        <input
                          type="text"
                          value={word}
                          onChange={(e) => {
                            const nextWords = [...(editingQuestion.correctFillBlanks || [])];
                            nextWords[wIdx] = e.target.value;
                            setEditingQuestion({ ...editingQuestion, correctFillBlanks: nextWords });
                          }}
                          className="w-full bg-transparent border-none text-xs focus:ring-0"
                          placeholder="کلمه معتبر..."
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nextWords = (editingQuestion.correctFillBlanks || []).filter((_, i) => i !== wIdx);
                            setEditingQuestion({ ...editingQuestion, correctFillBlanks: nextWords });
                          }}
                          className="p-1 hover:bg-slate-100 text-rose-500 rounded-lg"
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
                    className="w-full bg-white text-indigo-700 text-[10.5px] py-1.5 rounded-xl border border-indigo-200 font-bold hover:bg-indigo-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن جای خالی گمشده دیگر</span>
                  </button>
                </div>
              )}

              {/* D. Rubrics Metrics setup (Descriptive Long Answer) */}
              {editingQuestion.type === 'long_answer' && (
                <div className="space-y-3 bg-rose-50/40 p-4 rounded-2xl border border-rose-100">
                  <div className="flex justify-between items-center border-b border-rose-100 pb-1.5">
                    <span className="text-[10.5px] text-rose-950 font-extrabold">معیارهای واگذاری بارم تصحیح:</span>
                    <button
                      type="button"
                      onClick={addNewRubricInDrawer}
                      className="bg-rose-600 text-white px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-all font-bold text-[9.5px] flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن معیار بارم</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(editingQuestion.rubrics || []).map((rub) => (
                      <div key={rub.id} className="bg-white p-3 rounded-xl border border-rose-100 space-y-2">
                        <div className="flex gap-2 justify-between">
                          <input
                            type="text"
                            value={rub.title}
                            onChange={(e) => updateRubricInDrawer(rub.id, { title: e.target.value })}
                            className="w-full bg-slate-50 border-none px-2 py-1 rounded-md text-slate-800 font-bold font-sans"
                            placeholder="نام معیار (مثال: رسم درست نمودار)"
                          />
                          <input
                            type="number"
                            step="0.25"
                            value={rub.maxPoints}
                            onChange={(e) => updateRubricInDrawer(rub.id, { maxPoints: Number(e.target.value) })}
                            className="w-20 bg-slate-50 border-none px-2 py-1 rounded-md font-bold font-mono text-center"
                            placeholder="بارم"
                          />
                        </div>
                        <input
                          type="text"
                          value={rub.description}
                          onChange={(e) => updateRubricInDrawer(rub.id, { description: e.target.value })}
                          className="w-full bg-slate-50/60 border-none px-2 py-1 rounded-md"
                          placeholder="شرح کوتاه برای دبیـر تصحیح‌کننده..."
                        />
                        <button
                          type="button"
                          onClick={() => removeRubricInDrawer(rub.id)}
                          className="text-rose-500 font-bold hover:bg-rose-50 px-2 py-1 rounded-md block text-[9px] transition-all"
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
                <div className="space-y-3 bg-teal-50/40 p-4 rounded-2xl border border-teal-100">
                  <div className="flex justify-between items-center border-b border-teal-150 pb-1.5">
                    <span className="text-[10.5px] text-teal-950 font-extrabold">زیرسوالات درک مطلب (مینی‌سوال‌ها):</span>
                    <button
                      type="button"
                      onClick={addNewSubquestionPartInDrawer}
                      className="bg-teal-600 text-white px-2.5 py-1 rounded-xl font-bold text-[9.5px]"
                    >
                      افزودن زیرسوال جدید
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(editingQuestion.parts || []).map((part, pIdx) => (
                      <div key={part.id} className="bg-white p-3 rounded-xl border border-teal-100 space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span>زیرسوال شماره {toPersianDigits(pIdx + 1)}</span>
                          <button
                            type="button"
                            onClick={() => removeSubquestionPartInDrawer(part.id)}
                            className="text-rose-600"
                          >
                            حذف
                          </button>
                        </div>
                        <input
                          type="text"
                          value={part.text}
                          onChange={(e) => updateSubquestionTextInDrawer(part.id, e.target.value)}
                          className="w-full bg-slate-50 border-none p-1.5 rounded-md font-semibold text-slate-850"
                          placeholder="نمام متن مینی‌سوال..."
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Save trigger inside drawer */}
            <div className="p-4 bg-white border-t border-slate-150 flex gap-2">
              <button
                type="button"
                onClick={handleSaveDrawerQuestion}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-center shadow-xs cursor-pointer text-xs"
              >
                ثبت نهایی و بازگشت به ورقه املاکی
              </button>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold rounded-xl text-center cursor-pointer text-xs"
              >
                لغو تغییرات
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
