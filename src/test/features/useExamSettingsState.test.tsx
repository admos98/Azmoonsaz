/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * useExamSettingsState — the ExamSettings useReducer contract.
 * Pins the three slices (schedule / access / rules / publish), the
 * class-cascade transitions, and the official-recommendations preset.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useExamSettingsState } from '../../features/exam-settings/useExamSettingsState';
import type { Exam } from '../../types';

const baseExam = (overrides: Partial<Exam['settings']> = {}): Exam => ({
  id: 'e1',
  examCode: 'X1',
  title: 'آزمون',
  grade: 'هفتم',
  subject: 'علوم',
  duration: 60,
  settings: {
    mode: 'official',
    durationMinutes: 60,
    shuffleQuestions: false,
    shuffleOptions: false,
    allowBacktrack: true,
    showImmediateResults: false,
    maxAttempts: 1,
    ...overrides,
  },
  sections: [],
  questions: [],
  classGroupIds: [],
  status: 'draft',
  teacherId: 't1',
  createdAt: '2026-01-01',
});

describe('useExamSettingsState', () => {
  it('initializes schedule defaults from wall-clock fallbacks', () => {
    const { result } = renderHook(() => useExamSettingsState(baseExam()));
    expect(result.current.state.startHour).toBe('08:30');
    expect(result.current.state.endHour).toBe('10:30');
    expect(result.current.state.durationMinutes).toBe(60);
    expect(result.current.state.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('recovers wall clock from persisted instants for legacy exams', () => {
    const { result } = renderHook(() =>
      useExamSettingsState(
        baseExam({ startTime: '2026-05-01T05:00:00.000Z', endTime: '2026-05-01T06:30:00.000Z' }),
      ),
    );
    // +03:30 Tehran: 05:00Z → 08:30, 06:30Z → 10:00
    expect(result.current.state.startHour).toBe('08:30');
    expect(result.current.state.endHour).toBe('10:00');
  });

  it('patches a single field without touching the rest', () => {
    const { result } = renderHook(() => useExamSettingsState(baseExam()));
    act(() => result.current.setDurationMinutes(90));
    expect(result.current.state.durationMinutes).toBe(90);
    expect(result.current.state.maxAttempts).toBe(1);
  });

  it('toggleClass adds a class, and removes it with its students on second toggle', () => {
    const { result } = renderHook(() =>
      useExamSettingsState(baseExam({ allowedClasses: ['c1'], allowedStudents: ['s1', 's2'] })),
    );
    act(() => result.current.dispatch({ type: 'toggleClass', classId: 'c2', relatedStudentIds: [] }));
    expect(result.current.state.allowedClasses).toEqual(['c1', 'c2']);
    expect(result.current.state.allowedStudents).toEqual(['s1', 's2']);
    act(() =>
      result.current.dispatch({ type: 'toggleClass', classId: 'c1', relatedStudentIds: ['s1'] }),
    );
    expect(result.current.state.allowedClasses).toEqual(['c2']);
    expect(result.current.state.allowedStudents).toEqual(['s2']);
  });

  it('toggleStudent flips membership both ways', () => {
    const { result } = renderHook(() => useExamSettingsState(baseExam()));
    act(() => result.current.dispatch({ type: 'toggleStudent', studentId: 's1' }));
    expect(result.current.state.allowedStudents).toEqual(['s1']);
    act(() => result.current.dispatch({ type: 'toggleStudent', studentId: 's1' }));
    expect(result.current.state.allowedStudents).toEqual([]);
  });

  it('selectAllForClass unions, then subtracts when all are selected', () => {
    const { result } = renderHook(() =>
      useExamSettingsState(baseExam({ allowedStudents: ['s0'] })),
    );
    act(() => result.current.dispatch({ type: 'selectAllForClass', classStudentIds: ['s1', 's2'] }));
    expect(result.current.state.allowedStudents).toEqual(['s0', 's1', 's2']);
    act(() => result.current.dispatch({ type: 'selectAllForClass', classStudentIds: ['s1', 's2'] }));
    expect(result.current.state.allowedStudents).toEqual(['s0']);
  });

  it('applyOfficialRecommendations sets the full preset in one transition', () => {
    const { result } = renderHook(() => useExamSettingsState(baseExam()));
    act(() => result.current.dispatch({ type: 'applyOfficialRecommendations' }));
    const s = result.current.state;
    expect(s.maxAttempts).toBe(1);
    expect(s.resultsDisplayMode).toBe('after_approval');
    expect(s.autoSubmit).toBe(true);
    expect(s.showOneQuestionPerPage).toBe(true);
    expect(s.allowBacktrack).toBe(false);
    expect(s.beastMode).toBe(true);
    expect(s.requireNationalId).toBe(true);
  });
});
