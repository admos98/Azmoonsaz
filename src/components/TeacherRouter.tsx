/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TeacherRouter — the page switch extracted from App.tsx for the size
 * ratchet. Pure mapping from the current tab to the lazy page; all motion
 * and navigation policy stay in App (this component only renders).
 */

import { lazy, Suspense } from 'react';
import { PageSkeleton } from '../shell/BootScreens';
import {
  loadDashboard,
  loadExams,
  loadNewExam,
  loadSettingsHub,
  loadTeacherProfile,
  loadWrapped,
} from '../utils/teacherPageLoaders';

const Dashboard = lazy(loadDashboard);
const Exams = lazy(loadExams);
const NewExam = lazy(loadNewExam);
const SettingsHub = lazy(loadSettingsHub);
const TeacherProfile = lazy(loadTeacherProfile);
const Wrapped = lazy(loadWrapped);

type ExamSubView = 'list' | 'settings' | 'preview' | 'results';

interface TeacherRouterProps {
  currentTab: string;
  selectedExamId: string | undefined;
  examSubView: ExamSubView;
  navigateTeacher: (tab: string) => void;
  onSelectExamForResults: (examId: string) => void;
  onExamSubViewChange: (view: ExamSubView, id?: string) => void;
  onAddNewExam: () => void;
}

export function TeacherRouter({
  currentTab,
  selectedExamId,
  examSubView,
  navigateTeacher,
  onSelectExamForResults,
  onExamSubViewChange,
  onAddNewExam,
}: TeacherRouterProps) {
  switch (currentTab) {
    case 'dashboard':
      return (
        <Dashboard onNavigate={navigateTeacher} onSelectExamForResults={onSelectExamForResults} />
      );
    case 'students':
    case 'classes':
    case 'profile':
      return (
        <TeacherProfile
          initialTab={currentTab === 'profile' ? undefined : (currentTab as 'students' | 'classes')}
          onNavigate={navigateTeacher}
        />
      );
    case 'questions':
      return <SettingsHub initialTab="questions" onNavigate={navigateTeacher} />;
    case 'exams/new':
      return <NewExam onBack={() => navigateTeacher('exams')} onAddExam={onAddNewExam} />;
    case 'exams':
    case 'results':
      // 'results' is the Dashboard quick-links tab: the results sub-view is
      // forced; otherwise App's examSubView state decides.
      return (
        <Exams
          onNavigate={navigateTeacher}
          selectedExamId={selectedExamId}
          subView={currentTab === 'results' ? 'results' : examSubView}
          onSubViewChange={onExamSubViewChange}
        />
      );
    case 'settings':
      return <SettingsHub onNavigate={navigateTeacher} />;
    case 'wrapped':
      return <Wrapped />;
    default:
      // Unknown tabs fall back to the dashboard WITH the full prop set —
      // the previous default silently dropped onSelectExamForResults.
      return (
        <Dashboard onNavigate={navigateTeacher} onSelectExamForResults={onSelectExamForResults} />
      );
  }
}

/** The Suspense boundary that hosts the lazy pages (kept beside the router). */
export function TeacherRouterBoundary(props: TeacherRouterProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TeacherRouter {...props} />
    </Suspense>
  );
}
