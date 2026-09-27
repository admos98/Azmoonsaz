/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TeacherContext — the single data layer of the teacher workspace.
 *
 * Owns two related but separable concerns on two React contexts so that
 * identity-only consumers (Topbar avatar) don't re-render when a question
 * is saved, and bank-heavy consumers don't re-render on profile edits:
 *
 *   1. TeacherContext   — the authenticated teacher's profile.
 *   2. CollectionsContext — the five teacher collections (exams, students,
 *      questions, classGroups, submissions) plus per-collection status,
 *      reload, and cache-patch helpers.
 *
 * The provider mounts once inside the auth/onboarding gates. App.tsx hands
 * over the profile it already fetched during boot/login via `initialTeacher`
 * (one `/api/teacher/me` round-trip per session entry, zero on handoff);
 * the provider only self-fetches when no profile was handed over.
 *
 * All collections load in parallel on mount — the exact network cost the
 * Dashboard used to pay alone — and every page now reads the cache instead
 * of re-fetching on navigation. Mutations patch the cache through the
 * upsert/remove helpers so every consumer stays coherent without a single
 * cross-page refetch.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { ClassGroup, Exam, Question, Student, Submission, Teacher } from '../types';
import { logger } from '../lib/logger';
import {
  authService,
  classService,
  examService,
  gradingService,
  questionService,
  studentService,
} from '../services/api';

/* ------------------------------- teacher ------------------------------- */

interface TeacherContextValue {
  teacher: Teacher | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateTeacher: (updates: Partial<Teacher>) => void;
}

const TeacherContext = createContext<TeacherContextValue>({
  teacher: null,
  loading: true,
  refresh: async () => {},
  updateTeacher: () => {},
});

/* ----------------------------- collections ----------------------------- */

export type CollectionKey = 'exams' | 'students' | 'questions' | 'classGroups' | 'submissions';

export type CollectionStatus = 'loading' | 'ready' | 'error';

export type CollectionsStatus = Record<CollectionKey, CollectionStatus>;

interface CollectionsContextValue {
  exams: Exam[];
  students: Student[];
  questions: Question[];
  classGroups: ClassGroup[];
  submissions: Submission[];
  status: CollectionsStatus;
  /** Re-fetches one collection (error recovery, post-mutation resync). */
  reload: (key: CollectionKey) => Promise<void>;
  /* Cache patches — pages call these after a mutation succeeds instead of
   * maintaining a private copy of the collection. */
  upsertExam: (exam: Exam) => void;
  removeExam: (id: string) => void;
  upsertStudent: (student: Student) => void;
  addStudents: (students: Student[]) => void;
  removeStudent: (id: string) => void;
  upsertQuestion: (question: Question) => void;
  removeQuestion: (id: string) => void;
  upsertClassGroup: (classGroup: ClassGroup) => void;
  removeClassGroup: (id: string) => void;
  upsertSubmission: (submission: Submission) => void;
}

const CollectionsContext = createContext<CollectionsContextValue>({
  exams: [],
  students: [],
  questions: [],
  classGroups: [],
  submissions: [],
  status: {
    exams: 'loading',
    students: 'loading',
    questions: 'loading',
    classGroups: 'loading',
    submissions: 'loading',
  },
  reload: async () => {},
  upsertExam: () => {},
  removeExam: () => {},
  upsertStudent: () => {},
  addStudents: () => {},
  removeStudent: () => {},
  upsertQuestion: () => {},
  removeQuestion: () => {},
  upsertClassGroup: () => {},
  removeClassGroup: () => {},
  upsertSubmission: () => {},
});

/* ------------------------------- provider ------------------------------ */

const EMPTY_STATUS: CollectionsStatus = {
  exams: 'loading',
  students: 'loading',
  questions: 'loading',
  classGroups: 'loading',
  submissions: 'loading',
};

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [item, ...list];
  const next = list.slice();
  next[index] = item;
  return next;
}

export function TeacherProvider({
  children,
  initialTeacher,
}: {
  children: ReactNode;
  /** Profile already fetched by App during boot/login. `undefined` = fetch. */
  initialTeacher?: Teacher;
}) {
  /* ------------------------------- teacher ------------------------------- */
  const [teacher, setTeacher] = useState<Teacher | null>(() => initialTeacher ?? null);
  const [loading, setLoading] = useState(() => initialTeacher === undefined);

  const fetchTeacher = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await authService.getCurrentTeacher();
      setTeacher(profile);
    } catch {
      setTeacher(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialTeacher !== undefined) return; // handoff: App already owns the profile
    // eslint-disable-next-line react-hooks/set-state-in-effect -- boot fetch for the post-onboarding/self-heal path; syncs with an external system (the API), not derived state
    void fetchTeacher();
  }, [fetchTeacher, initialTeacher]);

  const updateTeacher = useCallback((updates: Partial<Teacher>) => {
    // Server-synced state only — the previous localStorage mirror was a
    // write-only cache nothing ever read back.
    setTeacher((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  /* ----------------------------- collections ----------------------------- */

  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [status, setStatus] = useState<CollectionsStatus>(EMPTY_STATUS);

  const loadCollection = useCallback(async (key: CollectionKey) => {
    // Manual reloads re-mark 'loading' from user handlers; the mount effect
    // hits this too but status is already 'loading' then — a state no-op.
    setStatus((current) => ({ ...current, [key]: 'loading' }));
    try {
      switch (key) {
        case 'exams':
          setExams(await examService.getExams({ throwOnError: true }));
          break;
        case 'students':
          setStudents(await studentService.getStudents({ throwOnError: true }));
          break;
        case 'questions':
          setQuestions(await questionService.getQuestions({ throwOnError: true }));
          break;
        case 'classGroups':
          setClassGroups(await classService.getClassGroups({ throwOnError: true }));
          break;
        case 'submissions':
          setSubmissions(await gradingService.getSubmissions(undefined, { throwOnError: true }));
          break;
      }
      setStatus((current) => ({ ...current, [key]: 'ready' }));
    } catch (error) {
      logger.error(`TeacherContext: failed to load ${key}:`, error);
      setStatus((current) => ({ ...current, [key]: 'error' }));
    }
  }, []);

  useEffect(() => {
    // Five parallel GETs — the exact cost the Dashboard's useDashboardData
    // used to pay. Every other page now rides the same cache for free.
    const keys: CollectionKey[] = ['exams', 'students', 'questions', 'classGroups', 'submissions'];
    keys.forEach((key) => void loadCollection(key));
  }, [loadCollection]);

  const reload = useCallback(
    async (key: CollectionKey) => {
      await loadCollection(key);
    },
    [loadCollection],
  );

  /* --------------------------- cache patches ----------------------------- */

  const upsertExam = useCallback((exam: Exam) => setExams((prev) => upsertById(prev, exam)), []);
  const removeExam = useCallback(
    (id: string) => setExams((prev) => prev.filter((exam) => exam.id !== id)),
    [],
  );
  const upsertStudent = useCallback(
    (student: Student) => setStudents((prev) => upsertById(prev, student)),
    [],
  );
  const addStudents = useCallback(
    (imported: Student[]) => setStudents((prev) => [...imported, ...prev]),
    [],
  );
  const removeStudent = useCallback(
    (id: string) => setStudents((prev) => prev.filter((student) => student.id !== id)),
    [],
  );
  const upsertQuestion = useCallback(
    (question: Question) => setQuestions((prev) => upsertById(prev, question)),
    [],
  );
  const removeQuestion = useCallback(
    (id: string) => setQuestions((prev) => prev.filter((question) => question.id !== id)),
    [],
  );
  const upsertClassGroup = useCallback(
    (classGroup: ClassGroup) => setClassGroups((prev) => upsertById(prev, classGroup)),
    [],
  );
  const removeClassGroup = useCallback(
    (id: string) => setClassGroups((prev) => prev.filter((classGroup) => classGroup.id !== id)),
    [],
  );
  const upsertSubmission = useCallback(
    (submission: Submission) => setSubmissions((prev) => upsertById(prev, submission)),
    [],
  );

  const collectionsValue = useMemo<CollectionsContextValue>(
    () => ({
      exams,
      students,
      questions,
      classGroups,
      submissions,
      status,
      reload,
      upsertExam,
      removeExam,
      upsertStudent,
      addStudents,
      removeStudent,
      upsertQuestion,
      removeQuestion,
      upsertClassGroup,
      removeClassGroup,
      upsertSubmission,
    }),
    [
      exams,
      students,
      questions,
      classGroups,
      submissions,
      status,
      reload,
      upsertExam,
      removeExam,
      upsertStudent,
      addStudents,
      removeStudent,
      upsertQuestion,
      removeQuestion,
      upsertClassGroup,
      removeClassGroup,
      upsertSubmission,
    ],
  );

  const teacherValue = useMemo<TeacherContextValue>(
    () => ({ teacher, loading, refresh: fetchTeacher, updateTeacher }),
    [teacher, loading, fetchTeacher, updateTeacher],
  );

  return (
    <TeacherContext.Provider value={teacherValue}>
      <CollectionsContext.Provider value={collectionsValue}>{children}</CollectionsContext.Provider>
    </TeacherContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTeacher = () => useContext(TeacherContext);

// eslint-disable-next-line react-refresh/only-export-components
export const useTeacherCollections = () => useContext(CollectionsContext);
