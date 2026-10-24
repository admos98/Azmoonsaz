/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, lazy } from 'react';
import { CloudLightning } from 'lucide-react';
import type { RichQuestion } from '../../features/question-bank/types';
import { useQuestionForm } from '../../features/question-bank/useQuestionForm';
import { useQuestionFilters } from '../../features/question-bank/useQuestionFilters';
import { useQuestionDelete } from '../../features/question-bank/useQuestionDelete';
import { useQuestionEditor } from '../../features/question-bank/useQuestionEditor';
import { useImageMaintenance } from '../../features/question-bank/useImageMaintenance';
import { QuestionHeaderBoard } from '../../features/question-bank/QuestionHeaderBoard';
import {
  QuestionFilterPanel,
  QuestionSortPaginationBar,
} from '../../features/question-bank/QuestionFilterPanel';
import { QuestionListViews } from '../../features/question-bank/QuestionListViews';
import { QuestionPreviewModal } from '../../features/question-bank/QuestionPreviewModal';
import { QuestionDrawerPreview } from '../../features/question-bank/QuestionDrawerPreview';
import { QuestionEditorForm } from '../../features/question-bank/QuestionEditorForm';
/* The drawer preview renderer is code-split: it is the heaviest tree in the
   add/edit modal (full question render + nested panels), and mounting it in
   the same commit as the modal open animation janked the open. The chunk
   preloads at page idle (below) so first open never waits on network; the
   drawer mounts the preview one frame past open (previewReady) with a
   skeleton meanwhile. End state identical — only the open choreography. */
const QuestionRenderer = lazy(() => import('../../components/QuestionRenderer'));
const preloadQuestionRenderer = () => import('../../components/QuestionRenderer');
import {
  Button,
  ConfirmDialog,
  Modal,
  UnsavedChangesGuard,
} from '../../ui';
import { PanelCrest } from '../../components/PanelCrest';
import SaveStatusIndicator, { type SaveState } from '../../components/SaveStatusIndicator';
import { useToast } from '../../hooks/useToast';
import { usePersistentPreference } from '../../hooks/usePersistentPreference';
import { useTeacherCollections } from '../../contexts/TeacherContext';

export default function Questions() {
  const { showToast, toastElement } = useToast();
  // The question bank rides the shared cache — NewExam and ExamPreview see a
  // new question immediately, no remount refetch needed.
  const {
    questions: rawQuestions,
    status,
    upsertQuestion,
  } = useTeacherCollections();
  const loading = status.questions === 'loading';

  // The list is now honestly server-shaped: difficulty/section/tags/
  // completenessStatus persist in the payload (see handleSaveQuestion) and
  // come back on every fetch — the old index-derived fabrication is gone.
  const questions = useMemo<RichQuestion[]>(() => rawQuestions, [rawQuestions]);

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Orphan image sweep + legacy migration handlers (extracted verbatim from
  // this page).
  const {
    cleaningImages,
    handleCleanupImages,
    migratingImages,
    handleMigrateImages,
  } = useImageMaintenance(showToast);

  // View & UI State
  const [viewMode, setViewMode] = usePersistentPreference<'card' | 'table'>(
    'questions:view',
    'card',
    (value): value is 'card' | 'table' => value === 'card' || value === 'table',
  );
  const [previewQuestion, setPreviewQuestion] = useState<RichQuestion | null>(null);
  const [showAddEditDrawer, setShowAddEditDrawer] = useState(false);

  // Add/edit drawer form state lives in the question-bank feature (extracted
  // verbatim from this page). Setters below feed openEditDrawer and
  // handleSaveQuestion further down.
  const questionForm = useQuestionForm(showAddEditDrawer, setShowAddEditDrawer, showToast);
  const { closeQuestionEditor, questionDraftDialog } = questionForm;
  /* Preview mounts one frame past drawer open (see drawer-live-visual): the
     open animation's first frame commits the light form tree only, then the
     heavy renderer tree builds while the panel grows (transform-only,
     compositor-side). Reset on close so every open replays the choreography. */
  const [previewReady, setPreviewReady] = useState(false);
  useEffect(() => {
    if (!showAddEditDrawer) return;
    const raf = requestAnimationFrame(() => setPreviewReady(true));
    return () => cancelAnimationFrame(raf);
  }, [showAddEditDrawer]);
  /* Idle-preload the split renderer chunk: by the time a drawer opens the
     code is already cached, so Suspense never flashes on first open.
     requestIdleCallback where available, setTimeout fallback elsewhere. */
  useEffect(() => {
    const preload = () => void preloadQuestionRenderer();
    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;
    if (ric) {
      const id = ric(preload, { timeout: 3000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(preload, 1500);
    return () => window.clearTimeout(t);
  }, []);

  // Panel origins — each overlay grows out of (and collapses back into) the
  // button that opened it. The library Modal owns panel/halo refs and origin
  // measurement internally; call sites only capture the trigger element.
  const previewTriggerRef = useRef<HTMLElement | null>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);

  // Filter/sort/pagination + filtered view live in the question-bank feature
  // (extracted verbatim from this page).
  const {
    searchQuery, setSearchQuery,
    sortOrder, setSortOrder,
    pageSize, setPageSize,
    currentPage: _currentPage, setCurrentPage,
    selectedGrade, setSelectedGrade,
    selectedSubject, setSelectedSubject,
    selectedSection, setSelectedSection,
    selectedType, setSelectedType,
    selectedDifficulty, setSelectedDifficulty,
    selectedTag, setSelectedTag,
    selectedStatus, setSelectedStatus,
    clearAllFilters, hasActiveFilters,
    filteredQuestions, visibleQuestions, totalPages, safePage,
  } = useQuestionFilters(questions);

  // Unique list generators for filter indicators
  const uniqueSubjects = Array.from(new Set(questions.map((q) => q.category).filter(Boolean)));
  // CQ-1 (strict): type predicates — plain filter(Boolean) left string | undefined.
  const uniqueSections = Array.from(new Set(questions.map((q) => q.section).filter((s): s is string => Boolean(s))));
  const uniqueTags = Array.from(new Set(questions.flatMap((q) => q.tags || []).filter((t): t is string => Boolean(t))));

  // Persiarized helper converters

  // Image upload handler: FileReader → dataURL, stored on the question
  // (main imageUrl / option imageUrl) and persisted through questionToBody.

  // Drawer open/save orchestration (extracted verbatim from this page).
  const { drawerMode, openCreateDrawer, openEditDrawer, handleSaveQuestion } = useQuestionEditor({
    form: questionForm,
    showToast,
    upsertQuestion,
    setSaveState,
    setLastSavedAt,
    setPreviewReady,
    setShowAddEditDrawer,
  });

  // Question deletion lives in the question-bank feature (extracted verbatim
  // from this page).
  const { questionToDelete, handleDeleteQuestion, confirmDeleteQuestion, cancelDelete } =
    useQuestionDelete(showToast);


  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="در حال بارگذاری اطلاعات">
        <div className="h-28 rounded-3xl bg-[var(--color-surface-secondary)] skeleton" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-36 rounded-2xl bg-[var(--color-surface-secondary)] skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-right font-sans mb-12" dir="rtl" id="questions-tab-view">
      {toastElement}
      <SaveStatusIndicator state={saveState} savedAt={lastSavedAt} />

      {/* Page Title Board */}
      <QuestionHeaderBoard
        viewMode={viewMode}
        setViewMode={setViewMode}
        drawerTriggerRef={drawerTriggerRef}
        openCreateDrawer={openCreateDrawer}
        cleaningImages={cleaningImages}
        handleCleanupImages={handleCleanupImages}
        migratingImages={migratingImages}
        handleMigrateImages={handleMigrateImages}
      />

      {/* COMPREHENSIVE MULTI-FILTER PANEL */}
      <QuestionFilterPanel
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        selectedGrade={selectedGrade}
        setSelectedGrade={setSelectedGrade}
        selectedSubject={selectedSubject}
        setSelectedSubject={setSelectedSubject}
        uniqueSubjects={uniqueSubjects}
        selectedSection={selectedSection}
        setSelectedSection={setSelectedSection}
        uniqueSections={uniqueSections}
        selectedDifficulty={selectedDifficulty}
        setSelectedDifficulty={setSelectedDifficulty}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        uniqueTags={uniqueTags}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        hasActiveFilters={hasActiveFilters}
        clearAllFilters={clearAllFilters}
      />

      <QuestionSortPaginationBar
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        setCurrentPage={setCurrentPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        totalPages={totalPages}
        safePage={safePage}
      />

      {/* QUESTION REPRESENTATION (CARD GRAPHICS OR ROW GRAPHICS) */}
      <div id="questions-pool-canvas">
        <PanelCrest kind="questions" state={filteredQuestions.length > 0 ? 'filled' : 'empty'}>
        <QuestionListViews
          viewMode={viewMode}
          filteredQuestions={filteredQuestions}
          visibleQuestions={visibleQuestions}
          previewTriggerRef={previewTriggerRef}
          setPreviewQuestion={setPreviewQuestion}
          drawerTriggerRef={drawerTriggerRef}
          openEditDrawer={openEditDrawer}
          handleDeleteQuestion={handleDeleteQuestion}
        />
        </PanelCrest>
      </div>

      {/* REUSABLE live preview question modal — library chrome */}
      <QuestionPreviewModal
        previewQuestion={previewQuestion}
        setPreviewQuestion={setPreviewQuestion}
        previewTriggerRef={previewTriggerRef}
        QuestionRenderer={QuestionRenderer}
      />

      {/* MEGA ADD / EDIT — same centered, rounded glass panel as every other
          overlay (was a full-height side slab with a border-l and a halo sized
          off its full height, which read as an odd, mismatched ratio). */}
      <Modal
        isOpen={showAddEditDrawer}
        onClose={closeQuestionEditor}
        title={
          drawerMode === 'add'
            ? 'افزودن و پیکربندی سوال نو در بانک'
            : 'ویرایش شناسنامه فنی و فرمول‌های سوال'
        }
        icon={<CloudLightning className="w-5 h-5" />}
        maxWidth="5xl"
        triggerRef={drawerTriggerRef}
        bodyClassName="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 text-caption text-right"
        footer={
          <>
            <Button variant="ghost" onClick={closeQuestionEditor}>
              انصراف
            </Button>
            <Button type="submit" form="question-editor-form">
              {drawerMode === 'add' ? 'ثبت و الحاق به بانک سوالات ملی' : 'ذخیره تغییرات'}
            </Button>
          </>
        }
      >
        {/* Left Column (Realtime live visual preview of QuestionRenderer as the teacher types!) */}
        <QuestionDrawerPreview
          form={questionForm}
          previewReady={previewReady}
          QuestionRenderer={QuestionRenderer}
        />

        {/* Right Column (Intense Form controls) */}
        <QuestionEditorForm form={questionForm} handleSaveQuestion={handleSaveQuestion} />
      </Modal>

      {/* Delete Question Confirmation */}
      <ConfirmDialog
        isOpen={questionToDelete !== null}
        title="حذف سوال"
        message={`آیا از پاک کردن سوال «${questionToDelete?.name}» از بانک تخصصی مطمئن هستید؟ این کنش غیرقابل بازگشت است.`}
        confirmText="حذف قطعی"
        variant="danger"
        onConfirm={confirmDeleteQuestion}
        onCancel={cancelDelete}
      />

      <UnsavedChangesGuard {...questionDraftDialog} title="بستن بدون ذخیره؟" confirmText="بستن بدون ذخیره" />
    </div>
  );
}
