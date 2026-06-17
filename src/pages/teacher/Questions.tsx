/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  HelpCircle, 
  Search, 
  Filter, 
  PlusCircle, 
  Award, 
  Image as ImageIcon,
  Layers, 
  Check, 
  CheckSquare, 
  Grid, 
  List, 
  Edit, 
  Trash2, 
  Eye, 
  Tag as TagIcon, 
  AlertCircle,
  X,
  FileText,
  Bookmark,
  ChevronDown,
  Sparkles,
  Info,
  Calendar,
  Activity,
  Plus,
  Trash,
  Sliders,
  CloudLightning,
  BookOpen
} from 'lucide-react';
import { mockQuestions as initialQuestions } from '../../mockData';
import { Question, QuestionType, QuestionOption, QuestionPart, RubricCriterion } from '../../types';
import QuestionRenderer from '../../components/QuestionRenderer';
import { questionService } from '../../services/api';
import { uploadQuestionImage } from '../../services/storageService';

// Local enhanced interface to handle optional tags, chapters, difficulty, and completeness statuses
interface RichQuestion extends Question {
  difficulty?: 'easy' | 'medium' | 'hard'; // آسان، متوسط، سخت
  tags?: string[]; // برچسب‌ها
  section?: string; // بخش / فصل
  completenessStatus?: 'complete' | 'incomplete'; // وضعیت کامل بودن
  explanation?: string; // توضیح پاسخ تشریحی / پاسخ کاغذی
  sampleAnswer?: string; // پاسخ نمونه تشریحی
}

export default function Questions() {
  // Rich list state
  const [questions, setQuestions] = useState<RichQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const data = await questionService.getQuestions();
        const enriched = data.map((q, idx) => {
          const difficulties: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
          const sections = ['بخش اول: مفاهیم مبنا', 'بخش دوم: ساختار سلولی', 'فصل سوم: منطق عددی', 'بخش چهارم: قواعد صرفی'];
          const tagSets = [
            ['کنکوری', 'محاسباتی', 'فرمول‌محور'],
            ['زیست', 'درک_شکل', 'آزمایشگاهی'],
            ['دستورزبان', 'درک_ادبی', 'واژگان'],
            ['کلوز', 'مهارت_درک_بهتر', 'ترجمه_فوری']
          ];
          return {
            ...q,
            difficulty: (q as any).difficulty || difficulties[idx % difficulties.length],
            section: (q as any).section || sections[idx % sections.length],
            tags: (q as any).tags || tagSets[idx % tagSets.length],
            completenessStatus: (q as any).completenessStatus || (idx % 6 === 5 ? 'incomplete' : 'complete')
          };
        });
        setQuestions(enriched);
      } catch (err) {
        console.error('Error fetching questions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Layout View Mode (Card / Table)
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // Preview Question Modal State
  const [previewQuestion, setPreviewQuestion] = useState<RichQuestion | null>(null);

  // Add / Edit Modal State
  const [showAddEditDrawer, setShowAddEditDrawer] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit'>('add');
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  // Dynamic Form Fields state
  const [formGrade, setFormGrade] = useState('هفتم');
  const [formSubject, setFormSubject] = useState('علوم تجربی');
  const [formSection, setFormSection] = useState('فصل اول');
  const [formType, setFormType] = useState<QuestionType>('single_choice');
  const [formDifficulty, setFormDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [formPoints, setFormPoints] = useState<number>(2);
  const [formText, setFormText] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formTagsString, setFormTagsString] = useState('پیش_فرض');
  const [formExplanation, setFormExplanation] = useState('');
  const [formSampleAnswer, setFormSampleAnswer] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  
  // Choice Options builder state
  const [formOptions, setFormOptions] = useState<Array<{ id: string; text: string; isCorrect: boolean; imageUrl?: string }>>([
    { id: 'o1', text: 'گزینه الف', isCorrect: true, imageUrl: '' },
    { id: 'o2', text: 'گزینه ب', isCorrect: false, imageUrl: '' },
    { id: 'o3', text: 'گزینه ج', isCorrect: false, imageUrl: '' },
    { id: 'o4', text: 'گزینه د', isCorrect: false, imageUrl: '' },
  ]);

  // True/False correct state
  const [formCorrectTrueFalse, setFormCorrectTrueFalse] = useState<boolean>(true);

  // Fill Blanks key words
  const [formFillBlanks, setFormFillBlanks] = useState<string[]>(['']);

  // Matchings pairs state
  const [formMatchingPairs, setFormMatchingPairs] = useState<Array<{ left: string; right: string }>>([
    { left: 'سمت چپ ۱', right: 'سمت راست ۱' }
  ]);

  // Ordering list state
  const [formOrderingItems, setFormOrderingItems] = useState<string[]>(['مرحله نخست', 'مرحله دوم']);

  // Rubrics Criterion checklist
  const [formRubrics, setFormRubrics] = useState<RubricCriterion[]>([
    { id: 'r1', title: 'به شیوایی مفهوم پرداخته باشد', description: 'نگارش بدون غلط دستوری', maxPoints: 1.5 }
  ]);

  // Parts / subquestions state (for Reading Comprehension & Cloze Test)
  const [formParts, setFormParts] = useState<QuestionPart[]>([
    { 
      id: 'part-1', 
      text: 'مینی سوال الف', 
      type: 'single_choice',
      options: [
        { id: 'p1-o1', text: 'گزینه صحیح', isCorrect: true },
        { id: 'p1-o2', text: 'گزینه فرعی', isCorrect: false }
      ],
      correctAnswer: 'p1-o1'
    }
  ]);

  // Unique list generators for filter indicators
  const uniqueSubjects = Array.from(new Set(questions.map(q => q.category).filter(Boolean)));
  const uniqueSections = Array.from(new Set(questions.map(q => q.section).filter(Boolean)));
  const uniqueTags = Array.from(new Set(questions.flatMap(q => q.tags || []).filter(Boolean)));

  // Persiarized helper converters
  const toPersianDigits = (str: string | number | undefined): string => {
    if (str === undefined) return '';
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  const getTypeNameInPersian = (type: QuestionType) => {
    const names: Record<QuestionType, string> = {
      single_choice: 'چهارگزینه‌ای تک‌پاسخ',
      multiple_choice: 'چندگزینه‌ای چندپاسخ',
      true_false: 'درست / نادرست',
      matching: 'وصل‌کردنی',
      ordering: 'مرتب‌سازی ترتیبی',
      fill_blank: 'جای خالی (کوتاه)',
      short_answer: 'پاسخ کوتاه',
      long_answer: 'تشریحی (طرح درس)',
      cloze: 'کلوز تست (Cloze Test)',
      reading_comprehension: 'درک مطلب متنی',
      image_based: 'سوال تصویری',
    };
    return names[type] || 'طرح متفرقه';
  };

  const getDifficultyLabel = (diff: string | undefined): string => {
    if (diff === 'easy') return 'آسان';
    if (diff === 'medium') return 'متوسط';
    if (diff === 'hard') return 'سخت';
    return 'متوسط';
  };

  const getDifficultyBadgeColor = (diff: string | undefined): string => {
    if (diff === 'easy') return 'bg-emerald-50 text-emerald-700 border-emerald-150';
    if (diff === 'hard') return 'bg-rose-50 text-rose-700 border-rose-150';
    return 'bg-amber-50 text-amber-700 border-amber-150';
  };

  // Image Upload handler (Simulation)
  const handleMockImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'main' | { optIndex: number } | { partIndex: number }) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (target === 'main') {
          setFormImageUrl(dataUrl);
        } else if ('optIndex' in target) {
          const updated = [...formOptions];
          updated[target.optIndex].imageUrl = dataUrl;
          setFormOptions(updated);
        } else if ('partIndex' in target) {
          // Additional mock mapping
          alert('تصویر به بخش زیرسوال الحاق گردید.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Quick action options modifications
  const addOptionRow = () => {
    const nextChar = formOptions.length + 1;
    setFormOptions([...formOptions, { id: `o-new-${Date.now()}`, text: `گزینه شماره ${nextChar}`, isCorrect: false, imageUrl: '' }]);
  };

  const removeOptionRow = (idx: number) => {
    if (formOptions.length <= 2) {
      alert('خطا: سوال چند گزینه‌ای حداقل نیازمند وجود دو گزینه است.');
      return;
    }
    setFormOptions(formOptions.filter((_, i) => i !== idx));
  };

  const handleOptionCorrectChange = (index: number) => {
    if (formType === 'single_choice' || formType === 'image_based') {
      setFormOptions(formOptions.map((opt, i) => ({
        ...opt,
        isCorrect: i === index
      })));
    } else {
      // Multiple correct allows toggling independently
      const updated = [...formOptions];
      updated[index].isCorrect = !updated[index].isCorrect;
      setFormOptions(updated);
    }
  };

  // Rubrics Criteria handlers
  const addRubricRow = () => {
    setFormRubrics([...formRubrics, { id: `r-${Date.now()}`, title: 'معیار نمره‌دهی جدید', description: 'شرح ملاک ارزیابی دبیر', maxPoints: 1.0 }]);
  };

  const removeRubricRow = (id: string) => {
    setFormRubrics(formRubrics.filter(r => r.id !== id));
  };

  // Subquestion parts handlers
  const addPartRow = () => {
    setFormParts([...formParts, { 
      id: `part-${Date.now()}`, 
      text: 'زیرسوال جدید', 
      type: 'single_choice',
      options: [{ id: 'po1', text: 'گزینه اول', isCorrect: true }]
    }]);
  };

  const removePartRow = (idx: number) => {
    setFormParts(formParts.filter((_, i) => i !== idx));
  };

  // Form Reset Trigger
  const resetFormValues = () => {
    setFormGrade('هفتم');
    setFormSubject('علوم تجربی');
    setFormSection('فصل اول');
    setFormType('single_choice');
    setFormDifficulty('medium');
    setFormPoints(2);
    setFormText('');
    setFormTitle('');
    setFormTagsString('کنکوری, نهایی');
    setFormExplanation('');
    setFormSampleAnswer('');
    setFormImageUrl('');
    setFormOptions([
      { id: 'o1', text: 'گزینه الف', isCorrect: true, imageUrl: '' },
      { id: 'o2', text: 'گزینه ب', isCorrect: false, imageUrl: '' },
      { id: 'o3', text: 'گزینه ج', isCorrect: false, imageUrl: '' },
      { id: 'o4', text: 'گزینه د', isCorrect: false, imageUrl: '' },
    ]);
    setFormCorrectTrueFalse(true);
    setFormFillBlanks(['']);
    setFormMatchingPairs([{ left: '', right: '' }]);
    setFormOrderingItems(['اول', 'دوم']);
    setFormRubrics([{ id: 'r1', title: 'صحت روابط علمی', description: 'توضیح کافی معیار', maxPoints: 1.5 }]);
    setFormParts([{ id: 'part-1', text: 'زیر بهر مینی سوال', type: 'single_choice', options: [{ id: 'po1', text: 'بخش اول', isCorrect: true }] }]);
  };

  // Create Question Trigger
  const openCreateDrawer = () => {
    setDrawerMode('add');
    resetFormValues();
    setShowAddEditDrawer(true);
  };

  // Edit Question Drawer loader
  const openEditDrawer = (q: RichQuestion) => {
    setDrawerMode('edit');
    setActiveQuestionId(q.id);
    setFormGrade(q.grade);
    setFormSubject(q.category);
    setFormSection(q.section || 'فصل اول');
    setFormType(q.type);
    setFormDifficulty(q.difficulty || 'medium');
    setFormPoints(q.points);
    setFormText(q.text);
    setFormTitle(q.title);
    setFormTagsString(q.tags?.join(', ') || '');
    setFormExplanation(q.explanation || '');
    setFormSampleAnswer(q.sampleAnswer || '');
    setFormImageUrl(q.imageUrl || '');
    
    // Type specifics
    if (q.options) {
      setFormOptions(q.options.map(o => ({
        id: o.id,
        text: o.text,
        isCorrect: !!o.isCorrect,
        imageUrl: (o as any).imageUrl || ''
      })));
    }
    if (q.type === 'true_false') {
      setFormCorrectTrueFalse(q.correctAnswer === true);
    }
    if (q.correctFillBlanks) {
      setFormFillBlanks(q.correctFillBlanks);
    }
    if (q.matchingPairs) {
      setFormMatchingPairs(q.matchingPairs);
    }
    if (q.orderingItems) {
      setFormOrderingItems(q.orderingItems);
    }
    if (q.rubrics) {
      setFormRubrics(q.rubrics);
    }
    if (q.parts) {
      setFormParts(q.parts);
    }

    setShowAddEditDrawer(true);
  };

  // Handle Submit Form (Add or Edit)
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formText) {
      alert('لطفاً عنوان سوال و متن اصلی را وارد نمایید.');
      return;
    }

    // Standardize tags in string separation
    const parsedTags = formTagsString.split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // Build the dynamic correctAnswer key based on type chosen
    let resolvedCorrectAnswer: any = undefined;
    if (formType === 'true_false') {
      resolvedCorrectAnswer = formCorrectTrueFalse;
    } else if (formType === 'single_choice' || formType === 'image_based') {
      const correctOpt = formOptions.find(o => o.isCorrect);
      resolvedCorrectAnswer = correctOpt ? correctOpt.id : (formOptions[0]?.id || 'o1');
    } else if (formType === 'multiple_choice') {
      resolvedCorrectAnswer = formOptions.filter(o => o.isCorrect).map(o => o.id);
    }

    const modifiedQuestionPayload: Omit<Question, 'id' | 'createdAt'> = {
      title: formTitle,
      text: formText,
      type: formType,
      points: Number(formPoints),
      category: formSubject,
      grade: formGrade,
      imageUrl: formImageUrl || undefined,
      options: (formType === 'single_choice' || formType === 'multiple_choice' || formType === 'image_based') ? formOptions : undefined,
      correctAnswer: resolvedCorrectAnswer,
      correctFillBlanks: formType === 'fill_blank' ? formFillBlanks : undefined,
      matchingPairs: formType === 'matching' ? formMatchingPairs : undefined,
      orderingItems: formType === 'ordering' ? formOrderingItems : undefined,
      rubrics: formType === 'long_answer' ? formRubrics : undefined,
      parts: (formType === 'cloze' || formType === 'reading_comprehension') ? formParts : undefined,
    };

    try {
      if (drawerMode === 'add') {
        const created = await questionService.createQuestion(modifiedQuestionPayload);
        const enrichedCreated: RichQuestion = {
          ...created,
          difficulty: formDifficulty,
          tags: parsedTags,
          section: formSection,
          completenessStatus: 'complete',
          sampleAnswer: formType === 'long_answer' ? formSampleAnswer : undefined,
          explanation: formExplanation || undefined
        };
        setQuestions([enrichedCreated, ...questions]);
      } else {
        if (!activeQuestionId) return;
        const updated = await questionService.updateQuestion(activeQuestionId, modifiedQuestionPayload);
        const enrichedUpdated: RichQuestion = {
          ...updated,
          difficulty: formDifficulty,
          tags: parsedTags,
          section: formSection,
          completenessStatus: 'complete',
          sampleAnswer: formType === 'long_answer' ? formSampleAnswer : undefined,
          explanation: formExplanation || undefined
        };
        setQuestions(questions.map(q => q.id === activeQuestionId ? enrichedUpdated : q));
      }
      setShowAddEditDrawer(false);
    } catch (err) {
      alert('خطا در ذخیره‌سازی سوال');
    }
  };

  // Handle Delete Question File entry
  const handleDeleteQuestion = async (id: string, name: string) => {
    const confirmDelete = window.confirm(`آیا از پاک کردن سوال «${name}» از بانک تخصصی مطمئن هستید؟ این کنش غیرقابل بازگشت است.`);
    if (confirmDelete) {
      try {
        await questionService.deleteQuestion(id);
        setQuestions(questions.filter(q => q.id !== id));
      } catch (err) {
        alert('خطا در پاک کردن سوال');
      }
    }
  };

  // Filter application pipeline
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = 
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      q.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
      q.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesGrade = selectedGrade === 'all' || q.grade === selectedGrade;
    const matchesSubject = selectedSubject === 'all' || q.category === selectedSubject;
    const matchesSection = selectedSection === 'all' || q.section === selectedSection;
    const matchesType = selectedType === 'all' || q.type === selectedType;
    const matchesDifficulty = selectedDifficulty === 'all' || q.difficulty === selectedDifficulty;
    const matchesTag = selectedTag === 'all' || q.tags?.includes(selectedTag);
    const matchesStatus = selectedStatus === 'all' || q.completenessStatus === selectedStatus;

    return (
      matchesSearch && 
      matchesGrade && 
      matchesSubject && 
      matchesSection && 
      matchesType && 
      matchesDifficulty && 
      matchesTag && 
      matchesStatus
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-right font-sans mb-12" dir="rtl" id="questions-tab-view">
      
      {/* Page Title Board */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-150 shadow-xs" id="questions-title-plate">
        <div className="space-y-1">
          <h2 className="text-md font-bold text-slate-800 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            <span>مدیریت بانک سوالات نهایی و تستی</span>
          </h2>
          <p className="text-[11px] text-slate-400">بانک تخصصی با پشتیبانی از ۱۱ نوع قالب تستی، تشریحی، وصل‌کردنی، مرتب‌سازی، درک‌مطلب و کلوز تست با بارگذاری متنی و تصویری</p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Card / Table Toggle */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-1 flex items-center gap-1 shrink-0">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'card' ? 'bg-white text-indigo-600 shadow-3xs' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="نمایش کارتی بخر"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-indigo-600 shadow-3xs' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="نمایش جدولی منظم"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Add Question Button */}
          <button
            id="btn-add-question-trigger"
            onClick={openCreateDrawer}
            className="flex-1 md:flex-none px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.01] active:scale-[0.99] text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>افزودن سوال جدید</span>
          </button>
        </div>
      </div>

      {/* COMPREHENSIVE MULTI-FILTER PANEL */}
      <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-2xs space-y-4" id="filters-container">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-2">
          <Sliders className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs font-bold text-slate-700">جستجوی موضوعی و پالایش هوشمند سوالات</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          
          {/* Search text */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">جستجو در متن سوال یا برچسب‌ها:</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="کلمه کلیدی، عنوان، هشتگ یا درس..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-150 text-xs text-slate-750 pr-9 pl-3.5 py-2 rounded-xl focus:outline-hidden focus:border-indigo-400 focus:bg-white transition-all text-right"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">نوع قالب‌بندی سوال:</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-150 text-xs text-slate-750 p-2 rounded-xl focus:outline-hidden font-medium cursor-pointer"
            >
              <option value="all">همه قالب‌ها (۱۱ نوع)</option>
              <option value="single_choice">چهارگزینه‌ای تک‌پاسخ</option>
              <option value="multiple_choice">چندگزینه‌ای چندپاسخ</option>
              <option value="true_false">درست / نادرست</option>
              <option value="matching">وصل‌کردنی / تطبیقی</option>
              <option value="ordering">مرتب‌سازی ترتیبی</option>
              <option value="fill_blank">جای خالی (تک کلمه‌ای)</option>
              <option value="short_answer">پاسخ کوتاه تشریحی</option>
              <option value="long_answer">تشریحی بلند</option>
              <option value="cloze">کلوز تست (Cloze)</option>
              <option value="reading_comprehension">درک مطلب متنی</option>
              <option value="image_based">سوال تصویری</option>
            </select>
          </div>

          {/* Grade Filter */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">پایه تحصیلی:</label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full bg-slate-50 border border-slate-150 text-xs text-slate-750 p-2 rounded-xl focus:outline-hidden font-medium cursor-pointer"
            >
              <option value="all">همه پایه‌ها</option>
              <option value="هفتم">پایه هفتم</option>
              <option value="هشتم">پایه هشتم</option>
              <option value="نهم">پایه نهم</option>
            </select>
          </div>

          {/* Subject Filter */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">درس یا موضوع:</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full bg-slate-50 border border-slate-150 text-xs text-slate-750 p-2 rounded-xl focus:outline-hidden font-medium cursor-pointer"
            >
              <option value="all">همه درس‌ها</option>
              {uniqueSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          {/* Section/Chapter Filter */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">بخش یا فصل کتاب:</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full bg-slate-50 border border-slate-150 text-xs text-slate-750 p-2 rounded-xl focus:outline-hidden font-medium cursor-pointer"
            >
              <option value="all">همه فصل‌ها</option>
              {uniqueSections.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Difficulty Filter */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">سطح سختی سوال:</label>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full bg-slate-50 border border-slate-150 text-xs text-slate-750 p-2 rounded-xl focus:outline-hidden font-medium cursor-pointer"
            >
              <option value="all">همه سطوح</option>
              <option value="easy">آسان</option>
              <option value="medium">متوسط</option>
              <option value="hard">سخت</option>
            </select>
          </div>

          {/* Selective Tag Filter */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">برچسب‌ها (هشتگ):</label>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full bg-slate-50 border border-slate-150 text-xs text-slate-750 p-2 rounded-xl focus:outline-hidden font-medium cursor-pointer"
            >
              <option value="all">همه برچسب‌ها</option>
              {uniqueTags.map(t => (
                <option key={t} value={t}>#{t}</option>
              ))}
            </select>
          </div>

          {/* Completeness Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">وضعیت کاملی سوال:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-150 text-xs text-slate-750 p-2 rounded-xl focus:outline-hidden font-medium cursor-pointer"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="complete">کامل (دارای جواب معتبر)</option>
              <option value="incomplete">ناقص (پیشنویس)</option>
            </select>
          </div>

        </div>

        {/* Clear Filter tags */}
        {(searchQuery || selectedGrade !== 'all' || selectedSubject !== 'all' || selectedSection !== 'all' || selectedType !== 'all' || selectedDifficulty !== 'all' || selectedTag !== 'all' || selectedStatus !== 'all') && (
          <div className="flex justify-start pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedGrade('all');
                setSelectedSubject('all');
                setSelectedSection('all');
                setSelectedType('all');
                setSelectedDifficulty('all');
                setSelectedTag('all');
                setSelectedStatus('all');
              }}
              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
            >
              حذف فیلترها و نمایش همگانی
            </button>
          </div>
        )}
      </div>

      {/* QUESTION REPRESENTATION (CARD GRAPHICS OR ROW GRAPHICS) */}
      <div id="questions-pool-canvas">
        <AnimatePresence mode="popLayout" initial={false}>
          {filteredQuestions.length > 0 ? (
            viewMode === 'card' ? (
              /* CARD GRID VIEW MODE */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5" id="questions-grid">
                {filteredQuestions.map(q => {
                  const hasImage = !!q.imageUrl || q.options?.some(o => (o as any).imageUrl);
                  const subquestionsCount = q.parts?.length || 0;
                  
                  return (
                    <motion.div
                      key={q.id}
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      className="bg-white rounded-3xl p-5 border border-slate-150 hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col justify-between gap-4 relative overflow-hidden"
                      id={`card-q-${q.id}`}
                    >
                      <div className="space-y-3.5">
                        
                        {/* Upper line metadata */}
                        <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md">پایه {q.grade}</span>
                            <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md">{q.category}</span>
                            {q.section && <span className="text-slate-500 italic">فصل: {q.section}</span>}
                          </div>
                          
                          <div className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${getDifficultyBadgeColor(q.difficulty)}`}>
                            {getDifficultyLabel(q.difficulty)}
                          </div>
                        </div>

                        {/* Title block */}
                        <div>
                          <h4 className="font-bold text-slate-800 text-xs lines-1 flex items-center gap-1.5">
                            <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{q.title}</span>
                          </h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed mt-1.5 line-clamp-2">
                            {q.text}
                          </p>
                        </div>

                        {/* Middle specific indicators badges */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                          <span className="bg-slate-50 text-slate-600 rounded-md px-2 py-0.5 text-[10px] font-semibold border border-slate-150/60">
                            {getTypeNameInPersian(q.type)}
                          </span>

                          <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-0.5 rounded-md text-[10px] font-bold">
                            نمره: {toPersianDigits(q.points)}
                          </span>

                          {subquestionsCount > 0 && (
                            <span className="bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded-md text-[10px] font-bold font-semibold">
                              {toPersianDigits(subquestionsCount)} مینی‌سوال تابعه
                            </span>
                          )}

                          {hasImage && (
                            <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-md text-[10px] flex items-center gap-1 font-semibold">
                              <ImageIcon className="w-3 h-3 text-purple-600" />
                              <span>تصویردار</span>
                            </span>
                          )}

                          {q.completenessStatus === 'incomplete' && (
                            <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-0.5">
                              <AlertCircle className="w-3" />
                              پیش‌نویس
                            </span>
                          )}
                        </div>

                      </div>

                      {/* Card Action footer operations */}
                      <div className="border-t border-slate-100 pt-3.5 flex justify-between items-center bg-slate-50/50 -m-5 mt-2 px-5 py-3">
                        <div className="flex gap-1.5">
                          {q.tags?.slice(0, 2).map((tag, i) => (
                            <span key={i} className="text-[9px] text-indigo-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md font-bold">
                              #{tag}
                            </span>
                          ))}
                        </div>

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setPreviewQuestion(q)}
                            className="p-1.5 text-indigo-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                            title="پیش‌نمایش زنده"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditDrawer(q)}
                            className="p-1.5 text-slate-650 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-all cursor-pointer"
                            title="ویرایش سوال"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id, q.title)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="حذف سوال"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* TABLE ROW VIEW MODE */
              <div className="bg-white rounded-3xl border border-slate-150 shadow-3xs overflow-hidden" id="questions-table-view-box">
                <div className="overflow-x-auto text-right">
                  <table className="w-full text-xs text-slate-700" id="questions-table">
                    <thead className="bg-slate-50 border-b border-slate-150 text-slate-500">
                      <tr>
                        <th className="p-4 font-bold text-right">خلاصه متن سوال</th>
                        <th className="p-4 font-bold text-right">پایه</th>
                        <th className="p-4 font-bold text-right">درس / فصل</th>
                        <th className="p-4 font-bold text-right">نوع قالب سوال</th>
                        <th className="p-4 font-bold text-center">سختی</th>
                        <th className="p-4 font-bold text-center">نمره (بارم)</th>
                        <th className="p-4 font-bold text-center">زیرسوال‌ها</th>
                        <th className="p-4 font-bold text-center">پیوست عکس</th>
                        <th className="p-4 font-bold text-center font-sans">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredQuestions.map(q => {
                        const hasImage = !!q.imageUrl || q.options?.some(o => (o as any).imageUrl);
                        const subquestionsCount = q.parts?.length || 0;
                        
                        return (
                          <motion.tr
                            key={q.id}
                            layout
                            className="hover:bg-slate-50/40 transition-colors"
                          >
                            {/* Short question text */}
                            <td className="p-4 max-w-xs md:max-w-sm">
                              <div>
                                <h5 className="font-bold text-slate-800 line-clamp-1">{q.title}</h5>
                                <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{q.text}</p>
                              </div>
                            </td>

                            {/* Grade */}
                            <td className="p-4 text-slate-600 font-medium">پایه {q.grade}</td>

                            {/* Subject & Section */}
                            <td className="p-4 text-slate-650">
                              <span className="font-semibold block">{q.category}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">{q.section || 'فصل کلی'}</span>
                            </td>

                            {/* Grade Type */}
                            <td className="p-4">
                              <span className="text-indigo-700 font-semibold bg-indigo-50 text-[10px] px-2 py-0.5 rounded-full border border-indigo-100">
                                {getTypeNameInPersian(q.type)}
                              </span>
                            </td>

                            {/* Difficulty */}
                            <td className="p-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getDifficultyBadgeColor(q.difficulty)}`}>
                                {getDifficultyLabel(q.difficulty)}
                              </span>
                            </td>

                            {/* Score Gained */}
                            <td className="p-4 text-center font-bold text-amber-700 font-mono text-[11px]">
                              {toPersianDigits(q.points)}
                            </td>

                            {/* Subquestions count */}
                            <td className="p-4 text-center">
                              <span className={`font-semibold ${subquestionsCount > 0 ? 'text-teal-600' : 'text-slate-350'}`}>
                                {subquestionsCount > 0 ? toPersianDigits(subquestionsCount) : '—'}
                              </span>
                            </td>

                            {/* Has image? */}
                            <td className="p-4 text-center">
                              <span className={`inline-block w-2.5 h-2.5 rounded-full ${hasImage ? 'bg-purple-505 border border-purple-500 bg-purple-500 shadow-3xs' : 'bg-slate-200'}`} title={hasImage ? 'دارای تصویر ضمیمه' : 'فاقد تصویر'}></span>
                            </td>

                            {/* Row Actions */}
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setPreviewQuestion(q)}
                                  className="p-1 hover:bg-slate-100 text-indigo-600 rounded-lg cursor-pointer"
                                  title="پیش‌نمایش"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => openEditDrawer(q)}
                                  className="p-1 hover:bg-slate-100 text-slate-500 cursor-pointer"
                                  title="ویرایش"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteQuestion(q.id, q.title)}
                                  className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg cursor-pointer"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            /* EMPTY FILTERED QUESTIONS STATE */
            <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center text-slate-400 select-none space-y-3" id="empty-questions">
              <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-150 mx-auto flex items-center justify-center text-slate-300 shadow-3xs">
                <HelpCircle className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-slate-700 text-xs">هیچ سوالی با فیلترهای بالا همخوانی ندارد</h4>
              <p className="text-[10px] text-slate-400 max-w-md mx-auto">می‌توانید فیلترهای جستجو، سطح سختی یا نوع سوالات را تغییر دهید یا نسبت به افزودن سوال جدید به مخزن اقدام کنید.</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* REUSABLE live preview question modal overlay */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" id="live-preview-overlay">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-50 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-250 flex flex-col max-h-[90vh]"
            id="preview-box"
          >
            {/* Header */}
            <div className="px-6 py-4.5 bg-white border-b border-slate-150 flex items-center justify-between">
              <button
                onClick={() => setPreviewQuestion(null)}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 transition-all font-bold rounded-xl text-[10px] cursor-pointer"
              >
                بستن پیش‌نمایش ×
              </button>
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>شبیه‌ساز پیش‌نمایش سوال در برگه پاسخ‌نامه</span>
              </h3>
            </div>

            {/* Renderer core scroll */}
            <div className="p-6 overflow-y-auto flex-1">
              <QuestionRenderer 
                question={previewQuestion} 
                showCorrectAnswers={true} 
              />
            </div>
            
            {/* Footer comments */}
            <div className="bg-white border-t border-slate-150 p-4 flex justify-between items-center text-[10px] text-slate-400 font-medium">
              <span>شناسه تخصصی سوال: {previewQuestion.id}</span>
              <span>بروزرسانی شده در: {toPersianDigits(new Date(previewQuestion.createdAt).toLocaleDateString('fa-IR'))}</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* MEGA ADD / EDIT DRAWER (Saves into state cleanly with live options form build!) */}
      {showAddEditDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end" id="add-edit-drawer-overlay">
          <div className="fixed inset-0" onClick={() => setShowAddEditDrawer(false)} />
          
          <motion.div
            initial={{ opacity: 0, x: 200 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 200 }}
            transition={{ type: 'spring', damping: 25 }}
            className="w-full max-w-3xl bg-slate-50 shadow-2xl z-10 flex flex-col h-full border-l border-slate-200 overflow-hidden text-xs text-right"
            id="add-edit-drawer"
          >
            {/* Drawer Header */}
            <div className="px-6 py-5 bg-white border-b border-slate-150 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowAddEditDrawer(false)}
                className="p-1 px-3 bg-rose-50 text-rose-600 rounded-xl font-bold cursor-pointer"
              >
                بستن قالب ×
              </button>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <CloudLightning className="w-5 h-5 text-indigo-600 animate-pulse" />
                <span>
                  {drawerMode === 'add' ? 'افزودن و پیکربندی سوال نو در بانک' : 'ویرایش شناسنامه فنی و فرمول‌های سوال'}
                </span>
              </h3>
            </div>

            {/* Split layout inside drawer: Form on right, instant Realtime-rendered Live Preview on left! */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
              
              {/* Left Column (Realtime live visual preview of QuestionRenderer as the teacher types!) */}
              <div className="hidden lg:block lg:col-span-5 bg-slate-100 p-5 overflow-y-auto border-l border-slate-200" id="drawer-live-visual">
                <div className="sticky top-0 space-y-3.5">
                  <div className="flex items-center gap-1 text-slate-500 font-bold mb-1">
                    <Eye className="w-4 h-4 text-indigo-500" />
                    <span className="text-[11px]">محیط پیش‌نمایش لحظه‌ای دبیر:</span>
                  </div>
                  
                  {/* Construct temporary dummy question to feed to high-fidelity QuestionRenderer in real-time! */}
                  <QuestionRenderer 
                    question={{
                      id: 'dummy-drawer',
                      type: formType,
                      title: formTitle || 'بدون عنوان',
                      text: formText || 'لطفاً متن صورت سوال را بنویسید...',
                      points: formPoints,
                      category: formSubject,
                      grade: formGrade,
                      section: formSection,
                      difficulty: formDifficulty,
                      options: (formType === 'single_choice' || formType === 'multiple_choice' || formType === 'image_based') ? formOptions : undefined,
                      correctAnswer: formType === 'true_false' ? formCorrectTrueFalse : undefined, // choices mapping takes formOptions isCorrect in renderer
                      correctFillBlanks: formType === 'fill_blank' ? formFillBlanks : undefined,
                      matchingPairs: formType === 'matching' ? formMatchingPairs : undefined,
                      orderingItems: formType === 'ordering' ? formOrderingItems : undefined,
                      imageUrl: formImageUrl || undefined,
                      explanation: formExplanation || undefined,
                      sampleAnswer: formSampleAnswer || undefined,
                      rubrics: formType === 'long_answer' ? formRubrics : undefined,
                      parts: (formType === 'cloze' || formType === 'reading_comprehension') ? formParts : undefined,
                      tags: formTagsString.split(',').map(s => s.trim()).filter(Boolean)
                    }}
                    showCorrectAnswers={true}
                  />

                  <div className="bg-white/80 border border-slate-200 p-3.5 rounded-2xl text-[9.5px] leading-relaxed text-slate-500 flex items-start gap-1.5 shadow-3xs">
                    <Info className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
                    <span>تغیرات بالا بلافاصله با تایپ کردن فرم زیر، به‌روزرسانی می‌شوند تا ساختار نهایی را بررسی نمایید.</span>
                  </div>
                </div>
              </div>

              {/* Right Column (Intense Form controls) */}
              <div className="lg:col-span-7 overflow-y-auto p-6 bg-white space-y-5" id="drawer-form-contents">
                <form onSubmit={handleSaveQuestion} className="space-y-4">
                  
                  {/* 1. Grade, Subject, Section, Difficulty */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3">
                    <span className="font-bold text-slate-800 text-[11px] block border-r-2 border-indigo-500 pr-2 mb-2">شناسنامه علمی سوال</span>
                    
                    <div className="grid grid-cols-2 gap-3.5">
                      {/* Grade Selector */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold block">پایه تحصیلی:</label>
                        <select
                          value={formGrade}
                          onChange={(e) => setFormGrade(e.target.value)}
                          className="w-full bg-white border border-slate-200 p-2 rounded-xl focus:outline-hidden font-bold"
                        >
                          <option value="هفتم">پایه هفتم</option>
                          <option value="هشتم">پایه هشتم</option>
                          <option value="نهم">پایه نهم</option>
                        </select>
                      </div>

                      {/* Subject */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold block">موضوع درس:</label>
                        <input
                          type="text"
                          required
                          value={formSubject}
                          onChange={(e) => setFormSubject(e.target.value)}
                          placeholder="مثال: علوم تجربی، ریاضی"
                          className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl focus:outline-hidden focus:border-indigo-400"
                        />
                      </div>

                      {/* Section */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold block">بخش / فصل کتاب:</label>
                        <input
                          type="text"
                          required
                          value={formSection}
                          onChange={(e) => setFormSection(e.target.value)}
                          placeholder="مثال: فصل اول یا مبحث فیزیک"
                          className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl focus:outline-hidden focus:border-indigo-400"
                        />
                      </div>

                      {/* Difficulty */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold block">سطح سختی علمی:</label>
                        <select
                          value={formDifficulty}
                          onChange={(e) => setFormDifficulty(e.target.value as any)}
                          className="w-full bg-white border border-slate-200 p-2 rounded-xl focus:outline-hidden font-bold"
                        >
                          <option value="easy">آسان</option>
                          <option value="medium">متوسط</option>
                          <option value="hard">سخت / استعداد درخشان</option>
                        </select>
                      </div>

                      {/* Points / Barom */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold block">امتیاز / بارم نمره:</label>
                        <input
                          type="number"
                          min={0.25}
                          max={20}
                          step={0.25}
                          value={formPoints}
                          onChange={(e) => setFormPoints(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 p-2 rounded-xl focus:outline-hidden font-bold"
                        />
                      </div>

                      {/* Tags separated */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold block">کلمات کلیدی / تگ‌ها (کاما جدا کننده):</label>
                        <input
                          type="text"
                          value={formTagsString}
                          onChange={(e) => setFormTagsString(e.target.value)}
                          placeholder="کنکوری، تستی، مهم"
                          className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl focus:outline-hidden text-indigo-700 font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Type selection picker */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-bold block">انتخاب قالب بندی ساختاری سوال (۱۱ نوع):</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as QuestionType)}
                      className="w-full bg-indigo-50/50 border border-indigo-200 p-2.5 rounded-xl font-bold text-indigo-900 focus:outline-white cursor-pointer"
                    >
                      <option value="single_choice">چهارگزینه‌ای تک‌پاسخ</option>
                      <option value="multiple_choice">چندگزینه‌ای چندپاسخ</option>
                      <option value="true_false">درست / نادرست</option>
                      <option value="fill_blank">جای خالی</option>
                      <option value="short_answer">پاسخ کوتاه تشریحی</option>
                      <option value="long_answer">پاسخ تشریحی بلند</option>
                      <option value="matching">وصل‌کردنی</option>
                      <option value="ordering">مرتب‌سازی ترتیبی</option>
                      <option value="cloze">کلوز تست (Cloze)</option>
                      <option value="reading_comprehension">درک مطلب passage</option>
                      <option value="image_based">سوال تصویری اختصاصی</option>
                    </select>
                  </div>

                  {/* 3. Title & Text prompts */}
                  <div className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold block">عنوان خلاصه سوال (برای معلم):</label>
                      <input
                        type="text"
                        required
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="ماشاالله: محاسبه سرعت زاویه‌ای"
                        className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl focus:bg-white focus:border-indigo-400 font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold block">متن اصلی صورت سوال / مسئله (فرمول گذاری):</label>
                      <textarea
                        required
                        rows={4}
                        value={formText}
                        onChange={(e) => setFormText(e.target.value)}
                        placeholder="متن کامل سوال خود را به زبان فارسی روان تالیف کنید..."
                        className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl focus:bg-white focus:border-indigo-400 font-medium leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* 4. IMAGE SUPPORT: MOCK UPLOAD & PREVIEW */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2">
                    <span className="text-[10px] text-slate-550 font-bold block">الصاق پرونده تصویر برای کل سوال (اختیاری):</span>
                    
                    <div className="flex items-center gap-3">
                      {/* Hidden manual selector */}
                      <label className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 text-[11px] rounded-xl font-bold cursor-pointer transition-all flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>انتخاب فایل تصویر</span>
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden" 
                          onChange={(e) => handleMockImageUpload(e, 'main')}
                        />
                      </label>

                      {formImageUrl ? (
                        <div className="flex items-center gap-2">
                          <img 
                            src={formImageUrl} 
                            alt="تصویر بارگذاری شده در فرم" 
                            className="w-12 h-12 rounded-lg object-cover border border-slate-250 bg-white" 
                          />
                          <button
                            type="button"
                            onClick={() => setFormImageUrl('')}
                            className="text-rose-500 font-bold hover:underline"
                          >
                            حذف پیوست ×
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">تصویری ضمیمه نشده است (فرمت .png, .jpg و .gif پشتیبانی می‌شود)</span>
                      )}
                    </div>
                    {/* Outline structure for Supabase integration comment per specs */}
                    <p className="text-[9px] text-indigo-400 bg-indigo-50/50 p-2 rounded-lg italic leading-normal">
                      داده به صورت base64 محلی ذخیره می‌شود. ساختار تابع آماده ارتقای سنکرون به خدمات استوریج ابری Supabase Storage از بستر کلاینت است.
                    </p>
                  </div>

                  {/* 5. TYPE SPECIFIC OPTIONS BUILDERS */}

                  {/* Choice builder (single_choice, multiple_choice, image_based) */}
                  {(formType === 'single_choice' || formType === 'multiple_choice' || formType === 'image_based') && (
                    <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-150 pb-2 mb-1">
                        <span className="font-bold text-slate-800 text-[11px]">سازنده گزینه‌های آزمون (تعداد کلید گزینه‌ها)</span>
                        <button
                          type="button"
                          onClick={addOptionRow}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          + افزودن گزینه نو
                        </button>
                      </div>

                      <div className="space-y-3">
                        {formOptions.map((opt, oIdx) => (
                          <div key={opt.id} className="bg-white p-3 rounded-xl border border-slate-150 space-y-2 text-right">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Is correct tick check */}
                              <label className="flex items-center gap-1 text-[10px] font-bold text-slate-650 cursor-pointer">
                                <input
                                  type={formType === 'multiple_choice' ? 'checkbox' : 'radio'}
                                  name="drawer-opt-correct"
                                  checked={opt.isCorrect}
                                  onChange={() => handleOptionCorrectChange(oIdx)}
                                  className="w-4 h-4 text-emerald-600 border-slate-250 cursor-pointer accent-emerald-500"
                                />
                                <span className={opt.isCorrect ? 'text-emerald-700 font-black' : ''}>پاسخ صحیح</span>
                              </label>

                              {/* Remove opt */}
                              <button
                                type="button"
                                onClick={() => removeOptionRow(oIdx)}
                                className="mr-auto p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                              {/* Option text */}
                              <div className="space-y-1">
                                <span className="text-[9px] text-slate-400 block">متن گزینه:</span>
                                <input
                                  type="text"
                                  required
                                  value={opt.text}
                                  onChange={(e) => {
                                    const updated = [...formOptions];
                                    updated[oIdx].text = e.target.value;
                                    setFormOptions(updated);
                                  }}
                                  placeholder={`عبارت گزینه ${oIdx + 1}`}
                                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-lg text-[11px]"
                                />
                              </div>

                              {/* Option image */}
                              <div className="space-y-1">
                                <span className="text-[9px] text-slate-400 block">پیوست عکس گزینه (الزامی برای سوال تصویری):</span>
                                <div className="flex items-center gap-2">
                                  <label className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 rounded-md text-[9px] font-bold cursor-pointer shrink-0">
                                    <span>الحاق تصویر</span>
                                    <input 
                                      type="file" 
                                      accept="image/*"
                                      className="hidden" 
                                      onChange={(e) => handleMockImageUpload(e, { optIndex: oIdx })}
                                    />
                                  </label>
                                  {opt.imageUrl ? (
                                    <div className="flex items-center gap-1.5">
                                      <img src={opt.imageUrl} className="w-6 h-6 rounded object-cover border" alt="گزینه" />
                                      <button type="button" onClick={() => {
                                        const updated = [...formOptions];
                                        updated[oIdx].imageUrl = '';
                                        setFormOptions(updated);
                                      }} className="text-rose-500 text-[9px]">حذف</button>
                                    </div>
                                  ) : (
                                    <span className="text-[9px] text-slate-350 italic">عکسی نیست</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* True / False picker builder */}
                  {formType === 'true_false' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2">
                      <span className="font-bold text-slate-700 text-[11px] block">انتخاب گزینه پاسخ درست:</span>
                      <div className="flex gap-4">
                        <label className={`flex-1 p-3 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                          formCorrectTrueFalse === true ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-slate-200'
                        }`}>
                          <input 
                            type="radio" 
                            name="drawer-tf-key" 
                            checked={formCorrectTrueFalse === true}
                            onChange={() => setFormCorrectTrueFalse(true)}
                            className="hidden" 
                          />
                          <span>صحیح / درست</span>
                        </label>

                        <label className={`flex-1 p-3 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                          formCorrectTrueFalse === false ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-slate-200'
                        }`}>
                          <input 
                            type="radio" 
                            name="drawer-tf-key" 
                            checked={formCorrectTrueFalse === false}
                            onChange={() => setFormCorrectTrueFalse(false)}
                            className="hidden" 
                          />
                          <span>غلط / نادرست</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Fill blank builder */}
                  {formType === 'fill_blank' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-3">
                      <div className="flex justify-between items-center mb-1 bg-white p-2 rounded-lg border">
                        <strong className="text-slate-800 text-[11px]">کلید واژه‌های صحیح برای جاهای خالی:</strong>
                        <button
                          type="button"
                          onClick={() => setFormFillBlanks([...formFillBlanks, ''])}
                          className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold"
                        >
                          + الحاق محل جدید
                        </button>
                      </div>

                      <div className="space-y-2">
                        {formFillBlanks.map((fb, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <span className="text-[10px] text-slate-400 font-bold w-12 shrink-0">جای خالی {idx + 1}:</span>
                            <input
                              type="text"
                              required
                              value={fb}
                              onChange={(e) => {
                                const updated = [...formFillBlanks];
                                updated[idx] = e.target.value;
                                setFormFillBlanks(updated);
                              }}
                              placeholder="کلمه کلید صحیح"
                              className="w-full bg-white border border-slate-250 px-2.5 py-1.5 rounded-md text-[11px]"
                            />
                            {formFillBlanks.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setFormFillBlanks(formFillBlanks.filter((_, i) => i !== idx))}
                                className="text-rose-500 font-bold p-1 text-sm"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching matchingPairs builder */}
                  {formType === 'matching' && (
                    <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-150 space-y-3">
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="font-bold text-slate-800 text-[11px]">پلاس لغات تطبیقی وصل‌کردنی</span>
                        <button
                          type="button"
                          onClick={() => setFormMatchingPairs([...formMatchingPairs, { left: '', right: '' }])}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          + درج جفت جدید
                        </button>
                      </div>

                      <div className="space-y-3">
                        {formMatchingPairs.map((pair, idx) => (
                          <div key={idx} className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-150 relative">
                            <button
                              type="button"
                              onClick={() => setFormMatchingPairs(formMatchingPairs.filter((_, i) => i !== idx))}
                              className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center font-bold"
                            >
                              &times;
                            </button>
                            <div className="space-y-1">
                              <span className="text-[9px] text-slate-400 block">سطر چپ (هدف):</span>
                              <input
                                type="text"
                                required
                                value={pair.left}
                                onChange={(e) => {
                                  const updated = [...formMatchingPairs];
                                  updated[idx].left = e.target.value;
                                  setFormMatchingPairs(updated);
                                }}
                                className="w-full bg-slate-50 px-2 py-1.5 rounded-md"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] text-slate-400 block">سطر راست (مبدا):</span>
                              <input
                                type="text"
                                required
                                value={pair.right}
                                onChange={(e) => {
                                  const updated = [...formMatchingPairs];
                                  updated[idx].right = e.target.value;
                                  setFormMatchingPairs(updated);
                                }}
                                className="w-full bg-slate-50 px-2 py-1.5 rounded-md"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ordering lists builder */}
                  {formType === 'ordering' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b">
                        <span className="font-bold text-[11px] text-slate-800">سازنده ترتیب قرارگیری گام‌ها (قدیم به جدید)</span>
                        <button
                          type="button"
                          onClick={() => setFormOrderingItems([...formOrderingItems, ''])}
                          className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold"
                        >
                          + گام جدید
                        </button>
                      </div>

                      <div className="space-y-2">
                        {formOrderingItems.map((item, idx) => (
                          <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-lg border">
                            <span className="text-[10px] font-bold text-slate-450 w-12 shrink-0">رتبه {idx + 1}:</span>
                            <input
                              type="text"
                              required
                              value={item}
                              onChange={(e) => {
                                const updated = [...formOrderingItems];
                                updated[idx] = e.target.value;
                                setFormOrderingItems(updated);
                              }}
                              className="w-full bg-slate-50 px-2 py-1.5 rounded-md text-[11px]"
                            />
                            {formOrderingItems.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setFormOrderingItems(formOrderingItems.filter((_, i) => i !== idx))}
                                className="text-rose-500 font-bold"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Descriptive elements, criteria & rubrics (Long Answer) */}
                  {formType === 'long_answer' && (
                    <div className="space-y-4">
                      {/* Sample answer */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">پاسخ تشریحی استاندارد نمونه (برای تصحیح و مقایسه هوشمند):</span>
                        <textarea
                          rows={3}
                          value={formSampleAnswer}
                          onChange={(e) => setFormSampleAnswer(e.target.value)}
                          placeholder="نمونه پاسخ ایده‌آل بنویسید..."
                          className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl"
                        />
                      </div>

                      {/* Rubric Criteria dynamic builder */}
                      <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-150 space-y-3">
                        <div className="flex justify-between items-center border-b border-rose-100 pb-2">
                          <span className="font-bold text-rose-950 text-[11px]">معیارهای خرد بارم‌بندی پاسخ تشریحی (Rubrics Builder)</span>
                          <button
                            type="button"
                            onClick={addRubricRow}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                          >
                            + معیار جدید
                          </button>
                        </div>

                        <div className="space-y-2">
                          {formRubrics.map((rub) => (
                            <div key={rub.id} className="bg-white p-3 rounded-xl border border-rose-100 space-y-2 relative">
                              <button
                                type="button"
                                onClick={() => removeRubricRow(rub.id)}
                                className="absolute top-2 left-2 text-rose-500 font-bold text-sm"
                              >
                                &times;
                              </button>
                              
                              <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2 space-y-1">
                                  <span className="text-[9px] text-slate-400 block">عنوان معیار:</span>
                                  <input
                                    type="text"
                                    required
                                    value={rub.title}
                                    onChange={(e) => {
                                      const updated = formRubrics.map(r => r.id === rub.id ? { ...r, title: e.target.value } : r);
                                      setFormRubrics(updated);
                                    }}
                                    className="w-full bg-slate-50 px-2 py-1 rounded text-[11px]"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[9px] text-slate-400 block">سقف نمره:</span>
                                  <input
                                    type="number"
                                    required
                                    step={0.25}
                                    value={rub.maxPoints}
                                    onChange={(e) => {
                                      const updated = formRubrics.map(r => r.id === rub.id ? { ...r, maxPoints: Number(e.target.value) } : r);
                                      setFormRubrics(updated);
                                    }}
                                    className="w-full bg-slate-50 p-1 text-center rounded text-[11px]"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[9px] text-slate-400 block">توضیح ملاک نمره‌دهی:</span>
                                <input
                                  type="text"
                                  value={rub.description}
                                  onChange={(e) => {
                                    const updated = formRubrics.map(r => r.id === rub.id ? { ...r, description: e.target.value } : r);
                                    setFormRubrics(updated);
                                  }}
                                  placeholder="ملاک نیم‌نمره چیست..."
                                  className="w-full bg-slate-50 px-2 py-1 rounded text-[10px] text-slate-500"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Manual correct warning representation in drawer */}
                      <div className="bg-amber-50 border border-amber-200.5 rounded-xl p-3 text-[10px] text-amber-800 flex items-start gap-1.5 leading-relaxed">
                        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>توجه تصحیح آزمون:</strong>
                          <p>تصحیح سوالات تشریحی به صورت دستی انجام می‌شود. در آینده می‌توان پیشنهاد نمره با هوش مصنوعی اضافه کرد.</p>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Reading comprehension & Cloze parts dynamic details */}
                  {(formType === 'reading_comprehension' || formType === 'cloze') && (
                    <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="font-bold text-slate-800 text-[11px]">بخش‌ها و زیرسوالات تابعه ({formParts.length} مینی‌سوال)</span>
                        <button
                          type="button"
                          onClick={addPartRow}
                          className="px-2.5 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold"
                        >
                          + افزودن زیرسوال تابعه
                        </button>
                      </div>

                      <div className="space-y-3">
                        {formParts.map((part, idx) => (
                          <div key={part.id} className="bg-white p-3 rounded-xl border border-slate-150 relative space-y-2">
                            <button
                              type="button"
                              onClick={() => removePartRow(idx)}
                              className="absolute top-2 left-2 text-rose-500 font-bold"
                            >
                              &times;
                            </button>
                            <span className="bg-slate-100 rounded px-1.5 py-0.5 text-[9px] font-bold text-slate-650 block w-20 text-center">بخش شماره {idx + 1}</span>

                            <div className="space-y-1">
                              <span className="text-[9px] text-slate-400 block">صورت مینی‌سوال:</span>
                              <input
                                type="text"
                                required
                                value={part.text}
                                onChange={(e) => {
                                  const updated = [...formParts];
                                  updated[idx].text = e.target.value;
                                  setFormParts(updated);
                                }}
                                className="w-full bg-slate-50 px-2 py-1 rounded text-[11px]"
                              />
                            </div>

                            <div className="space-y-1">
                              <span className="text-[9px] text-slate-400 block">پاسخ صحیح مینی سوال:</span>
                              <input
                                type="text"
                                required
                                value={String(part.correctAnswer || '')}
                                onChange={(e) => {
                                  const updated = [...formParts];
                                  updated[idx].correctAnswer = e.target.value;
                                  setFormParts(updated);
                                }}
                                placeholder="گزینه یا عبارت کلید مینی‌سوال"
                                className="w-full bg-slate-50 px-2 py-1 rounded text-[11px] font-mono"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 6. General explanation (teacher comments / solutions) */}
                  <div className="space-y-1 pt-3.5 border-t border-slate-100">
                    <label className="text-[10px] text-slate-400 font-bold block">توضیح پاسخ تشریحی / راهنمای نمره‌دهی متفرقه (اختیاری):</label>
                    <textarea
                      rows={2}
                      value={formExplanation}
                      onChange={(e) => setFormExplanation(e.target.value)}
                      placeholder="این یادداشت به دانش‌آموزان در قالب پاسخ‌برگ تشریحی سیستم نشان داده خواهد گردید..."
                      className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-[11px] leading-relaxed"
                    />
                  </div>

                  {/* Submission triggers */}
                  <div className="pt-4 border-t border-slate-100 flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAddEditDrawer(false)}
                      className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-2xs cursor-pointer"
                    >
                      {drawerMode === 'add' ? 'ثبت و الحاق به بانک سوالات ملی' : 'ذخیره دگرگونی ها'}
                    </button>
                  </div>

                </form>
              </div>

            </div>

          </motion.div>
        </div>
      )}

    </div>
  );
}
