/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Plus,
  Eye,
  Settings as SettingsIcon,
  Clock,
  CheckSquare,
  Calendar,
  Play,
} from 'lucide-react';
import { logger } from '../../lib/logger';
import { Exam, ClassGroup } from '../../types';
import { classService, examService } from '../../services/api';
import { useToast } from '../../hooks/useToast';

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

export default function Exams({
  onNavigate,
  selectedExamId: propExamId,
  subView: propSubView = 'list',
  onSubViewChange,
}: ExamsProps) {
  const { showToast, toastElement } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [_loading, setLoading] = useState(true);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);

  useEffect(() => {
    const fetchExams = async () => {
      setLoading(true);
      try {
        const data = await examService.getExams();
        setExams(data);
      } catch (err) {
        logger.error('Error fetching exams:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
    classService
      .getClassGroups()
      .then(setClassGroups)
      .catch(() => {});
  }, []);

  const [activeTab, setActiveTab] = useState<
    'all' | 'active' | 'scheduled' | 'draft' | 'completed'
  >('all');
  const [localSubView, setLocalSubView] = useState<'list' | 'settings' | 'preview' | 'results'>(
    propSubView,
  );
  const [selectedExamId, setSelectedExamId] = useState<string | null>(propExamId || null);

  // URL-backed parents remain the source of truth; standalone usage falls back
  // to local navigation state without effect-driven prop synchronization.
  const effectiveSubView = onSubViewChange ? propSubView : localSubView;
  const effectiveExamId = onSubViewChange ? propExamId || null : selectedExamId;
  const currentExam = exams.find((e) => e.id === effectiveExamId);

  const handleStatusChange = async (examId: string, newStatus: Exam['status']) => {
    try {
      const updated = await examService.updateExam(examId, { status: newStatus });
      setExams(exams.map((e) => (e.id === examId ? { ...e, ...updated } : e)));
    } catch (_err) {
      showToast('خطا در تغییر وضعیت آزمون', 'error');
    }
  };

  const handleUpdateExam = async (updatedExam: Exam) => {
    try {
      const updated = await examService.updateExam(updatedExam.id, updatedExam);
      setExams(exams.map((e) => (e.id === updatedExam.id ? { ...e, ...updated } : e)));
      showToast('تنظیمات آزمون ذخیره شد.', 'success');
      setLocalSubView('list');
      if (onSubViewChange) onSubViewChange('list');
    } catch (_err) {
      showToast('خطا در بروزرسانی آزمون', 'error');
    }
  };

  const _handleDeleteExam = async (examId: string) => {
    try {
      await examService.deleteExam(examId);
      setExams(exams.filter((e) => e.id !== examId));
    } catch (_err) {
      showToast('خطا در حذف آزمون', 'error');
    }
  };

  // Filter exams by tab
  const filteredExams = exams.filter((e) => {
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
      draft:
        'glx-inset text-[var(--color-text-secondary)] border-[var(--color-glass-light-stroke)]',
      scheduled:
        'bg-[var(--color-info-soft)] text-[var(--color-info)] border-[var(--color-info)]/20',
      active:
        'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]/20 animate-pulse',
      completed:
        'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/20',
    };
    return styles[status] || 'glx-inset text-[var(--color-text-secondary)]';
  };

  const getClassNamesForExam = (classGroupIds: string[]) => {
    return classGroupIds
      .map((id) => classGroups.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(' و ');
  };

  const navigateToSubView = (view: 'list' | 'settings' | 'preview' | 'results', examId: string) => {
    setSelectedExamId(examId);
    setLocalSubView(view);
    if (onSubViewChange) onSubViewChange(view, examId);
  };

  // Rendering conditional subviews
  if (effectiveSubView === 'settings' && currentExam) {
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

  if (effectiveSubView === 'preview' && currentExam) {
    return (
      <ExamPreview
        key={currentExam.id}
        exam={currentExam}
        onBack={() => {
          setLocalSubView('list');
          if (onSubViewChange) onSubViewChange('list');
        }}
        onSave={(updatedExam) => {
          setExams((prev) => prev.map((e) => (e.id === updatedExam.id ? updatedExam : e)));
          showToast('تغییرات پیش‌نویس ذخیره شد.', 'success');
        }}
        onNavigateToSettings={(updatedExam) => {
          setExams((prev) => prev.map((e) => (e.id === updatedExam.id ? updatedExam : e)));
          setLocalSubView('settings');
          if (onSubViewChange) onSubViewChange('settings', currentExam.id);
        }}
      />
    );
  }

  if (effectiveSubView === 'results' && currentExam) {
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
      {toastElement}
      {/* Upper Panel Header Section */}
      <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glx glass-edge p-6 rounded-2xl">
        <div>
          <h2 className="text-heading-3 font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--color-accent)]" />
            <span>مدیریت آزمون‌های دوره‌ای و هماهنگ کشوری</span>
          </h2>
          <p className="text-micro text-[var(--color-text-tertiary)] mt-1">
            امکان تعریف، زمان‌بندی، فعال‌سازی با یک کلیک و ارجاع به کلاس‌ها و ثبت نمره‌برگ نهایی
          </p>
        </div>
        <button
          type="button"
          id="btn-create-exam-trigger"
          onClick={() => onNavigate('exams/new')}
          className="px-4 py-2.5 bg-[var(--color-accent-solid)] hover:bg-[var(--color-accent-solid-hover)] text-[var(--color-text-on-solid)] rounded-xl text-caption font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>طراحی آزمون نو</span>
        </button>
      </div>

      {/* Tabs list for Status categories */}
      <div
        className="flex items-center space-x-2 space-x-reverse border-b border-[var(--color-glass-light-stroke)] pb-1"
        id="exam-status-tabs"
      >
        {[
          { id: 'all', label: 'همه آزمون‌ها' },
          { id: 'active', label: 'در حال برگزاری (زنده)' },
          { id: 'scheduled', label: 'برنامه‌ریزی شده' },
          { id: 'draft', label: 'پیش‌نویس‌ها' },
          { id: 'completed', label: 'برگزار شده' },
        ].map((tab) => (
          <button
            type="button"
            key={tab.id}
            id={`tab-status-${tab.id}`}
            onClick={() =>
              setActiveTab(tab.id as 'all' | 'active' | 'scheduled' | 'draft' | 'completed')
            }
            className={`px-3.5 py-2 text-caption font-bold transition-all relative cursor-pointer ${
              activeTab === tab.id
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeExamTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent-solid)] rounded-full"
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
                className="glx glass-edge rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between space-y-4 relative overflow-hidden"
                id={`exam-box-${ex.id}`}
              >
                {/* Visual Status Indicator Strip on Top */}
                <span
                  className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-l ${
                    ex.status === 'active'
                      ? 'from-[var(--color-warning)] to-[var(--color-danger)]'
                      : ex.status === 'completed'
                        ? 'from-[var(--color-success)] to-teal-500'
                        : ex.status === 'scheduled'
                          ? 'from-[var(--color-info)] to-[var(--color-accent)]'
                          : 'from-slate-400 to-slate-500'
                  }`}
                />

                {/* Box details top */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-micro font-bold border ${getStatusBadgeStyles(ex.status)}`}
                    >
                      {getStatusLabelInPersian(ex.status)}
                    </span>
                    <span className="text-micro text-[var(--color-text-tertiary)] font-mono font-bold select-all glx px-2 py-0.5 rounded-md border">
                      کد ورود: {ex.examCode}
                    </span>
                  </div>

                  <h3 className="text-caption font-bold text-[var(--color-text-primary)] leading-snug line-clamp-1">
                    {ex.title}
                  </h3>
                  <p className="text-micro text-[var(--color-text-tertiary)] leading-relaxed line-clamp-2 h-[34px]">
                    {ex.description || 'توضیحاتی برای این آزمون ثبت نگردیده است.'}
                  </p>
                </div>

                {/* Sub Metadata parameters */}
                <div className="py-2 border-y border-[var(--color-glass-light-stroke)] grid grid-cols-2 gap-2 text-micro text-[var(--color-text-tertiary)]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                    <span>
                      پایه {ex.grade} (در کلاس: {getClassNamesForExam(ex.classGroupIds)})
                    </span>
                  </span>
                  <span className="flex items-center gap-1 justify-end">
                    <Clock className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                    <span>
                      مدت زمان: <b>{ex.duration} دقیقه</b>
                    </span>
                  </span>
                </div>

                {/* Footer Controls / Trigger Actions */}
                <div className="flex items-center justify-between gap-1 pt-1">
                  <div className="flex gap-1">
                    {/* Preview Option */}
                    <button
                      type="button"
                      id={`exam-pre-${ex.id}`}
                      onClick={() => navigateToSubView('preview', ex.id)}
                      className="p-2 glx hover:brightness-105 text-[var(--color-text-secondary)] rounded-xl transition-colors border cursor-pointer"
                      title="پیش‌نمایش آزمون"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Settings Option */}
                    <button
                      type="button"
                      id={`exam-set-${ex.id}`}
                      onClick={() => navigateToSubView('settings', ex.id)}
                      className="p-2 glx hover:brightness-105 text-[var(--color-text-secondary)] rounded-xl transition-colors border cursor-pointer"
                      title="تنظیمات فنی آزمون"
                    >
                      <SettingsIcon className="w-4 h-4" />
                    </button>

                    {/* Results / Answers sheet review */}
                    <button
                      type="button"
                      id={`exam-res-${ex.id}`}
                      onClick={() => navigateToSubView('results', ex.id)}
                      className="p-2 glx hover:brightness-105 text-[var(--color-accent)] rounded-xl transition-colors border border-[var(--color-accent-soft)] hover:bg-[var(--color-accent-soft)] cursor-pointer"
                      title="مشاهده کارنامه‌ها و نتایج"
                    >
                      <CheckSquare className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Status switcher actions */}
                  <div className="flex items-center">
                    {ex.status === 'draft' && (
                      <button
                        type="button"
                        id={`ex-act-${ex.id}`}
                        onClick={() => handleStatusChange(ex.id, 'active')}
                        className="px-2.5 py-1.5 bg-[var(--color-accent-soft)] hover:bg-[var(--color-accent-soft)]/50 text-[var(--color-accent)] font-bold text-micro rounded-lg border border-[var(--color-accent)]/20 flex items-center gap-1 cursor-pointer animate-pulse"
                      >
                        <Play className="w-3 h-3" />
                        <span>فعال‌سازی آزمون</span>
                      </button>
                    )}
                    {ex.status === 'active' && (
                      <button
                        type="button"
                        id={`ex-comp-${ex.id}`}
                        onClick={() => handleStatusChange(ex.id, 'completed')}
                        className="px-2.5 py-1.5 bg-[var(--color-danger-soft)] hover:bg-[var(--color-danger-soft)]/50 text-[var(--color-danger)] font-bold text-micro rounded-lg border border-[var(--color-danger)]/10 flex items-center gap-1 cursor-pointer"
                      >
                        <span>اتمام برگزاری آزمون</span>
                      </button>
                    )}
                    {ex.status === 'completed' && (
                      <span className="text-micro text-[var(--color-success)] font-semibold bg-[var(--color-success-soft)] px-2.5 py-1 rounded-md">
                        ثبت نهایی شده
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-16 text-center glx rounded-2xl text-[var(--color-text-tertiary)]">
              هیچ آزمونی با ویژگی‌های بالا یافت نشد. می‌توانید با «طراحی آزمون نو» اولین سنجش خود را
              راه‌اندازی کنید.
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
