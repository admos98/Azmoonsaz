/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Suspense, lazy } from 'react';
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
import {
  Button,
  EmptyState,
  PageHeader,
  PillButton,
  StatusBadge,
} from '../../components/UIComponents';
import { EmptyStateArt } from '../../components/EmptyStateArt';
import { PanelCrest } from '../../components/PanelCrest';
import { Exam } from '../../types';
import { examService } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { useTeacherCollections } from '../../contexts/TeacherContext';

// Sub-views are lazy: together they weigh ~166 KB raw, and a teacher only
// ever opens one at a time. Settings/Preview/Results each get their own chunk.
const ExamSettings = lazy(() => import('./ExamSettings'));
const ExamPreview = lazy(() => import('./ExamPreview'));
const ExamResults = lazy(() => import('./ExamResults'));

/** Sub-view loading state — mirrors the shell's page skeleton. */
function SubViewLoader() {
  return (
    <div
      className="space-y-4 p-6 rounded-2xl lens"
      role="status"
      aria-label="در حال بارگذاری بخش آزمون"
    >
      <div className="h-8 w-56 bg-[var(--color-glass-light-fill)] skeleton rounded-xl" />
      <div className="h-24 bg-[var(--color-glass-light-fill)] skeleton rounded-2xl" />
      <div className="h-64 bg-[var(--color-glass-light-fill)] skeleton rounded-2xl" />
    </div>
  );
}

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
  const { exams, classGroups, upsertExam } = useTeacherCollections();

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
      const existing = exams.find((e) => e.id === examId);
      if (existing) upsertExam({ ...existing, ...updated });
    } catch (_err) {
      showToast('خطا در تغییر وضعیت آزمون', 'error');
    }
  };

  const handleUpdateExam = async (updatedExam: Exam) => {
    try {
      const updated = await examService.updateExam(updatedExam.id, updatedExam);
      const existing = exams.find((e) => e.id === updatedExam.id);
      if (existing) upsertExam({ ...existing, ...updated });
      showToast('تنظیمات آزمون ذخیره شد.', 'success');
      setLocalSubView('list');
      if (onSubViewChange) onSubViewChange('list');
    } catch (_err) {
      showToast('خطا در بروزرسانی آزمون', 'error');
    }
  };

  // Filter exams by tab
  const filteredExams = exams.filter((e) => {
    if (activeTab === 'all') return true;
    return e.status === activeTab;
  });

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
      <Suspense fallback={<SubViewLoader />}>
        <ExamSettings
          exam={currentExam}
          onSave={handleUpdateExam}
          onBack={() => {
            setLocalSubView('list');
            if (onSubViewChange) onSubViewChange('list');
          }}
        />
      </Suspense>
    );
  }

  if (effectiveSubView === 'preview' && currentExam) {
    return (
      <Suspense fallback={<SubViewLoader />}>
        <ExamPreview
          key={currentExam.id}
          exam={currentExam}
          onBack={() => {
            setLocalSubView('list');
            if (onSubViewChange) onSubViewChange('list');
          }}
          onSave={(updatedExam) => {
            upsertExam(updatedExam);
            showToast('تغییرات پیش‌نویس ذخیره شد.', 'success');
          }}
          onNavigateToSettings={(updatedExam) => {
            upsertExam(updatedExam);
            setLocalSubView('settings');
            if (onSubViewChange) onSubViewChange('settings', currentExam.id);
          }}
        />
      </Suspense>
    );
  }

  if (effectiveSubView === 'results' && currentExam) {
    return (
      <Suspense fallback={<SubViewLoader />}>
        <ExamResults
          exam={currentExam}
          onBack={() => {
            setLocalSubView('list');
            if (onSubViewChange) onSubViewChange('list');
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="space-y-6" id="exams-tab-view">
      {toastElement}
      {/* Upper Panel Header Section */}
      <div className="relative lens p-6 rounded-2xl">
        <PageHeader
          title="مدیریت آزمون‌های دوره‌ای و هماهنگ کشوری"
          subtitle="امکان تعریف، زمان‌بندی، فعال‌سازی با یک کلیک و ارجاع به کلاس‌ها و ثبت نمره‌برگ نهایی"
          actions={
            <Button
              id="btn-create-exam-trigger"
              onClick={() => onNavigate('exams/new')}
              icon={<Plus className="w-4 h-4" />}
            >
              طراحی آزمون نو
            </Button>
          }
        />
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
      <PanelCrest kind="exams" state={filteredExams.length > 0 ? 'filled' : 'empty'}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="exams-grid-wrapper">
        <AnimatePresence initial={false}>
          {filteredExams.length > 0 ? (
            filteredExams.map((ex) => (
              <motion.div
                key={ex.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="lens rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between space-y-4 relative overflow-hidden"
                id={`exam-box-${ex.id}`}
              >
                {/* Visual Status Indicator Strip on Top */}
                <span
                  className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-l ${
                    ex.status === 'active'
                      ? 'from-[var(--color-warning)] to-[var(--color-danger)]'
                      : ex.status === 'completed'
                        ? 'from-[var(--color-success)] to-[var(--color-success-solid)]'
                        : ex.status === 'scheduled'
                          ? 'from-[var(--color-info)] to-[var(--color-accent)]'
                          : 'from-[var(--color-text-secondary)] to-[var(--color-text-tertiary)]'
                  }`}
                />

                {/* Box details top */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <StatusBadge status={ex.status} />
                    <span className="text-micro text-[var(--color-text-tertiary)] font-mono font-bold select-all frost px-2 py-0.5 rounded-md">
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
                      className="p-2 btn-glass btn-glass--quiet text-[var(--color-text-secondary)] rounded-xl transition-colors cursor-pointer"
                      title="پیش‌نمایش آزمون"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Settings Option */}
                    <button
                      type="button"
                      id={`exam-set-${ex.id}`}
                      onClick={() => navigateToSubView('settings', ex.id)}
                      className="p-2 btn-glass btn-glass--quiet text-[var(--color-text-secondary)] rounded-xl transition-colors cursor-pointer"
                      title="تنظیمات فنی آزمون"
                    >
                      <SettingsIcon className="w-4 h-4" />
                    </button>

                    {/* Results / Answers sheet review */}
                    <button
                      type="button"
                      id={`exam-res-${ex.id}`}
                      onClick={() => navigateToSubView('results', ex.id)}
                      className="p-2 btn-glass btn-glass--quiet text-[var(--color-accent)] rounded-xl transition-colors border-[var(--color-accent-soft)] hover:bg-[var(--color-accent-soft)] cursor-pointer"
                      title="مشاهده کارنامه‌ها و نتایج"
                    >
                      <CheckSquare className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Status switcher actions */}
                  <div className="flex items-center">
                    {ex.status === 'draft' && (
                      <PillButton
                        fill="accent-soft"
                        size="sm"
                        radius="lg"
                        id={`ex-act-${ex.id}`}
                        onClick={() => handleStatusChange(ex.id, 'active')}
                        className="hover:bg-[var(--color-accent-soft)]/50 border border-[var(--color-accent)]/20 flex items-center gap-1 animate-pulse"
                      >
                        <Play className="w-3 h-3" />
                        <span>فعال‌سازی آزمون</span>
                      </PillButton>
                    )}
                    {ex.status === 'active' && (
                      <PillButton
                        fill="danger-soft"
                        size="sm"
                        radius="lg"
                        id={`ex-comp-${ex.id}`}
                        onClick={() => handleStatusChange(ex.id, 'completed')}
                        className="hover:bg-[var(--color-danger-soft)]/50 border border-[var(--color-danger)]/10 flex items-center gap-1"
                      >
                        <span>اتمام برگزاری آزمون</span>
                      </PillButton>
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
            <div className="col-span-full">
              <EmptyState
                icon={<FileText className="w-6 h-6" />}
                art={<EmptyStateArt kind="exams" />}
                title="آزمونی یافت نشد"
                description="هیچ آزمونی با ویژگی‌های بالا یافت نشد. اولین سنجش خود را راه‌اندازی کنید."
                action={
                  <Button
                    size="sm"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={() => onNavigate('exams/new')}
                  >
                    طراحی آزمون نو
                  </Button>
                }
              />
            </div>
          )}
        </AnimatePresence>
      </div>
      </PanelCrest>
    </div>
  );
}
