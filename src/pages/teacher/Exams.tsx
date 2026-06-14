/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Plus, Eye, Settings as SettingsIcon, Award, Clock, ArrowLeft, Check, CheckSquare, Calendar, Users, Flame, Play, Trash2, ArrowRight } from 'lucide-react';
import { mockExams as initialExams, mockClassGroups, mockQuestions, mockTeacher } from '../../mockData';
import { Exam, ClassGroup, Question } from '../../types';
import { examService } from '../../services/api';

// Import subviews
import ExamSettings from './ExamSettings';
import ExamPreview from './ExamPreview';
import ExamResults from './ExamResults';

interface ExamsProps {
  onNavigate: (tab: string) => void;
  selectedExamId?: string;
  subView?: 'list' | 'settings' | 'preview' | 'results';
  onSubViewChange?: (view: 'list' | 'settings' | 'preview' | 'results', id?: string) => void;
}

export default function Exams({ onNavigate, selectedExamId: propExamId, subView: propSubView = 'list', onSubViewChange }: ExamsProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExams = async () => {
      setLoading(true);
      try {
        const data = await examService.getExams();
        const enriched = data.map(e => {
          // Make sure we have the questions fully populated
          if (!e.questions || e.questions.length === 0) {
            e.questions = mockQuestions.filter(q => {
              return e.sections.some(sec => sec.questionIds.includes(q.id));
            });
          }
          return e;
        });
        setExams(enriched);
      } catch (err) {
        console.error('Error fetching exams:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
  }, []);

  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'scheduled' | 'draft' | 'completed'>('all');
  const [localSubView, setLocalSubView] = useState<'list' | 'settings' | 'preview' | 'results'>(propSubView);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(propExamId || null);

  // Sync prop changes
  React.useEffect(() => {
    if (propSubView) setLocalSubView(propSubView);
    if (propExamId) setSelectedExamId(propExamId);
  }, [propSubView, propExamId]);

  const currentExam = exams.find(e => e.id === selectedExamId);

  const handleStatusChange = async (examId: string, newStatus: Exam['status']) => {
    try {
      const updated = await examService.updateExam(examId, { status: newStatus });
      setExams(exams.map(e => e.id === examId ? { ...e, ...updated } : e));
    } catch (err) {
      alert('خطا در تغییر وضعیت آزمون');
    }
  };

  const handleUpdateExam = async (updatedExam: Exam) => {
    try {
      const updated = await examService.updateExam(updatedExam.id, updatedExam);
      setExams(exams.map(e => e.id === updatedExam.id ? { ...e, ...updated } : e));
      alert('تنظیمات آزمون با موفقیت ذخیره گردید.');
      setLocalSubView('list');
      if (onSubViewChange) onSubViewChange('list');
    } catch (err) {
      alert('خطا در بروزرسانی آزمون');
    }
  };

  const handleDeleteExam = async (examId: string) => {
    try {
      await examService.deleteExam(examId);
      setExams(exams.filter(e => e.id !== examId));
    } catch (err) {
      alert('خطا در حذف آزمون');
    }
  };

  // Filter exams by tab
  const filteredExams = exams.filter(e => {
    if (activeTab === 'all') return true;
    return e.status === activeTab;
  });

  const getStatusLabelInPersian = (status: Exam['status']) => {
    const labels = {
      draft: 'پیش‌نویس / غیرفعال',
      scheduled: 'برنامه‌ریزی شده',
      active: 'در حال برگزاری (زنده)',
      completed: 'برگزار شده / خاتمه‌یافته',
    };
    return labels[status];
  };

  const getStatusBadgeStyles = (status: Exam['status']) => {
    const styles = {
      draft: 'bg-slate-100 text-slate-600 border-slate-200',
      scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
      active: 'bg-orange-500/10 text-orange-600 border-orange-500/20 animate-pulse',
      completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
    return styles[status] || 'bg-slate-150 text-slate-600';
  };

  const getClassNamesForExam = (classGroupIds: string[]) => {
    return classGroupIds
      .map(id => mockClassGroups.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join(' و ');
  };

  const navigateToSubView = (view: 'list' | 'settings' | 'preview' | 'results', examId: string) => {
    setSelectedExamId(examId);
    setLocalSubView(view);
    if (onSubViewChange) onSubViewChange(view, examId);
  };

  // Rendering conditional subviews
  if (localSubView === 'settings' && currentExam) {
    return (
      <ExamSettings
        exam={currentExam}
        onSave={handleUpdateExam}
        onBack={() => {
          setLocalSubView('list');
          if (onSubViewChange) onSubViewChange('list');
        }}
      />
    );
  }

  if (localSubView === 'preview' && currentExam) {
    return (
      <ExamPreview
        exam={currentExam}
        onBack={() => {
          setLocalSubView('list');
          if (onSubViewChange) onSubViewChange('list');
        }}
        onSave={(updatedExam) => {
          setExams(prev => prev.map(e => e.id === updatedExam.id ? updatedExam : e));
          alert('تغییرات پیش‌نویس آزمون با موفقیت ذخیره گردید.');
        }}
        onNavigateToSettings={(updatedExam) => {
          setExams(prev => prev.map(e => e.id === updatedExam.id ? updatedExam : e));
          setLocalSubView('settings');
          if (onSubViewChange) onSubViewChange('settings', currentExam.id);
        }}
      />
    );
  }

  if (localSubView === 'results' && currentExam) {
    return (
      <ExamResults
        exam={currentExam}
        onBack={() => {
          setLocalSubView('list');
          if (onSubViewChange) onSubViewChange('list');
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300" id="exams-tab-view">
      {/* Upper Panel Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-md font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            <span>مدیریت آزمون‌های دوره‌ای و هماهنگ کشوری</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-1">امکان تعریف، زمان‌بندی، فعال‌سازی با یک کلیک و ارجاع به کلاس‌ها و ثبت نمره‌برگ نهایی</p>
        </div>
        <button
          id="btn-create-exam-trigger"
          onClick={() => onNavigate('exams/new')}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>طراحی آزمون نو</span>
        </button>
      </div>

      {/* Tabs list for Status categories */}
      <div className="flex items-center space-x-2 space-x-reverse border-b border-slate-200/80 pb-1" id="exam-status-tabs">
        {[
          { id: 'all', label: 'همه آزمون‌ها' },
          { id: 'active', label: '🔴 در حال برگزاری (زنده)' },
          { id: 'scheduled', label: '🗓️ برنامه‌ریزی شده' },
          { id: 'draft', label: '✒️ پیش‌نویس‌ها' },
          { id: 'completed', label: '✅ برگزار شده' },
        ].map(tab => (
          <button
            key={tab.id}
            id={`tab-status-${tab.id}`}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 text-xs font-bold transition-all relative cursor-pointer ${
              activeTab === tab.id
                ? 'text-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeExamTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* Grid List representation of Exams */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="exams-grid-wrapper">
        <AnimatePresence initial={false}>
          {filteredExams.length > 0 ? (
            filteredExams.map((ex) => (
              <motion.div
                key={ex.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4 relative overflow-hidden"
                id={`exam-box-${ex.id}`}
              >
                {/* Visual Status Indicator Strip on Top */}
                <span className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-l ${
                  ex.status === 'active' ? 'from-amber-500 to-orange-500' :
                  ex.status === 'completed' ? 'from-emerald-500 to-teal-500' :
                  ex.status === 'scheduled' ? 'from-indigo-500 to-blue-500' : 'from-slate-400 to-slate-500'
                }`} />

                {/* Box details top */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${getStatusBadgeStyles(ex.status)}`}>
                      {getStatusLabelInPersian(ex.status)}
                    </span>
                    <span className="text-[10px] text-slate-450 font-mono font-bold select-all bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                      کد ورود: {ex.examCode}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-800 leading-snug line-clamp-1">{ex.title}</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 h-[34px]">{ex.description || 'توضیحاتی برای این آزمون ثبت نگردیده است.'}</p>
                </div>

                {/* Sub Metadata parameters */}
                <div className="py-2 border-y border-slate-100 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>پایه {ex.grade} (در کلاس: {getClassNamesForExam(ex.classGroupIds)})</span>
                  </span>
                  <span className="flex items-center gap-1 justify-end">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>مدت زمان: <b>{ex.duration} دقیقه</b></span>
                  </span>
                </div>

                {/* Footer Controls / Trigger Actions */}
                <div className="flex items-center justify-between gap-1 pt-1">
                  <div className="flex gap-1">
                    {/* Preview Option */}
                    <button
                      id={`exam-pre-${ex.id}`}
                      onClick={() => navigateToSubView('preview', ex.id)}
                      className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors border border-slate-150 cursor-pointer"
                      title="پیش‌نمایش آزمون"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Settings Option */}
                    <button
                      id={`exam-set-${ex.id}`}
                      onClick={() => navigateToSubView('settings', ex.id)}
                      className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors border border-slate-150 cursor-pointer"
                      title="تنظیمات فنی آزمون"
                    >
                      <SettingsIcon className="w-4 h-4" />
                    </button>

                    {/* Results / Answers sheet review */}
                    <button
                      id={`exam-res-${ex.id}`}
                      onClick={() => navigateToSubView('results', ex.id)}
                      className="p-2 bg-slate-50 hover:bg-slate-100 text-indigo-600 rounded-xl transition-colors border border-indigo-100 hover:bg-indigo-50 cursor-pointer"
                      title="مشاهده کارنامه‌ها و نتایج"
                    >
                      <CheckSquare className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Status switcher actions */}
                  <div className="flex items-center">
                    {ex.status === 'draft' && (
                      <button
                        id={`ex-act-${ex.id}`}
                        onClick={() => handleStatusChange(ex.id, 'active')}
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-105 text-indigo-700 font-bold text-[10px] rounded-lg border border-indigo-150 flex items-center gap-1 cursor-pointer animate-pulse"
                      >
                        <Play className="w-3 h-3" />
                        <span>فعال‌سازی آزمون</span>
                      </button>
                    )}
                    {ex.status === 'active' && (
                      <button
                        id={`ex-comp-${ex.id}`}
                        onClick={() => handleStatusChange(ex.id, 'completed')}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] rounded-lg border border-rose-100 flex items-center gap-1 cursor-pointer"
                      >
                        <span>اتمام برگزاری آزمون</span>
                      </button>
                    )}
                    {ex.status === 'completed' && (
                      <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md">
                        ثبت نهایی شده
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-100 shadow-sm text-slate-400">
              هیچ آزمونی با ویژگی‌های بالا یافت نشد. می‌توانید با «طراحی آزمون نو» اولین سنجش خود را راه‌اندازی کنید.
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
