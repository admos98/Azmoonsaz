/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * usePreviewDrawerHandlers — the ExamPreview drawer row-control contract.
 * Pins option/parts/rubric add/remove/update operations.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePreviewDrawerHandlers } from '../../features/exam-preview/usePreviewDrawerHandlers';
import type { Question } from '../../types';

const editing = (overrides: Partial<Question> = {}): Partial<Question> => ({
  id: 'q1',
  type: 'single_choice',
  title: 'سوال',
  text: 'متن',
  points: 2,
  options: [
    { id: 'o1', text: 'الف', isCorrect: true },
    { id: 'o2', text: 'ب', isCorrect: false },
  ],
  parts: [],
  rubrics: [],
  ...overrides,
});

const setup = (q: Partial<Question> | null = editing()) => {
  const setEditingQuestion = vi.fn();
  const { result } = renderHook(() => usePreviewDrawerHandlers(q, setEditingQuestion));
  return { result, setEditingQuestion };
};

describe('usePreviewDrawerHandlers', () => {
  it('updateOptionTextInDrawer rewrites the option text', () => {
    const { result, setEditingQuestion } = setup();
    act(() => result.current.updateOptionTextInDrawer('o1', 'الف جدید'));
    expect(setEditingQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.arrayContaining([expect.objectContaining({ id: 'o1', text: 'الف جدید' })]),
      }),
    );
  });

  it('toggleOptionCorrectInDrawer is exclusive for single_choice', () => {
    const { result, setEditingQuestion } = setup();
    act(() => result.current.toggleOptionCorrectInDrawer('o2'));
    const next = vi.mocked(setEditingQuestion).mock.calls[0][0] as Partial<Question>;
    expect(next.options?.find((o) => o.id === 'o2')?.isCorrect).toBe(true);
    expect(next.options?.find((o) => o.id === 'o1')?.isCorrect).toBe(false);
    expect(next.correctAnswer).toBe('o2');
  });

  it('toggleOptionCorrectInDrawer toggles independently for multiple_choice', () => {
    const { result, setEditingQuestion } = setup(
      editing({
        type: 'multiple_choice',
        options: [
          { id: 'o1', text: 'الف', isCorrect: true },
          { id: 'o2', text: 'ب', isCorrect: false },
        ],
      }),
    );
    act(() => result.current.toggleOptionCorrectInDrawer('o2'));
    const next = vi.mocked(setEditingQuestion).mock.calls[0][0] as Partial<Question>;
    expect(next.options?.find((o) => o.id === 'o1')?.isCorrect).toBe(true);
    expect(next.options?.find((o) => o.id === 'o2')?.isCorrect).toBe(true);
    expect(next.correctAnswer).toEqual(['o1', 'o2']);
  });

  it('addNewOptionInDrawer appends and removeOptionInDrawer deletes', () => {
    const { result, setEditingQuestion } = setup();
    act(() => result.current.addNewOptionInDrawer());
    const added = vi.mocked(setEditingQuestion).mock.calls[0][0] as Partial<Question>;
    expect(added.options).toHaveLength(3);

    vi.clearAllMocks();
    act(() => result.current.removeOptionInDrawer('o1'));
    const removed = vi.mocked(setEditingQuestion).mock.calls[0][0] as Partial<Question>;
    expect(removed.options).toHaveLength(1);
    expect(removed.options?.[0].id).toBe('o2');
  });

  it('subquestion part add/remove/update round-trips', () => {
    const { result, setEditingQuestion } = setup();
    act(() => result.current.addNewSubquestionPartInDrawer());
    const added = vi.mocked(setEditingQuestion).mock.calls[0][0] as Partial<Question>;
    expect(added.parts).toHaveLength(1);
    const partId = added.parts![0].id;

    vi.clearAllMocks();
    // update/remove read the hook's closure value, so drive them from the added state
    const { result: r2, setEditingQuestion: set2 } = setup(added);
    act(() => r2.current.updateSubquestionTextInDrawer(partId, 'متن جدید'));
    expect(vi.mocked(set2).mock.calls[0][0]).toMatchObject({
      parts: [expect.objectContaining({ id: partId, text: 'متن جدید' })],
    });

    const { result: r3, setEditingQuestion: set3 } = setup(added);
    act(() => r3.current.removeSubquestionPartInDrawer(partId));
    expect(vi.mocked(set3).mock.calls[0][0]).toMatchObject({ parts: [] });
  });

  it('rubric add/remove/update round-trips', () => {
    const { result, setEditingQuestion } = setup();
    act(() => result.current.addNewRubricInDrawer());
    const added = vi.mocked(setEditingQuestion).mock.calls[0][0] as Partial<Question>;
    expect(added.rubrics).toHaveLength(1);
    const rubId = added.rubrics![0].id;

    const { result: r2, setEditingQuestion: set2 } = setup(added);
    act(() => r2.current.updateRubricInDrawer(rubId, { title: 'عنوان جدید' }));
    expect(vi.mocked(set2).mock.calls[0][0]).toMatchObject({
      rubrics: [expect.objectContaining({ id: rubId, title: 'عنوان جدید' })],
    });

    const { result: r3, setEditingQuestion: set3 } = setup(added);
    act(() => r3.current.removeRubricInDrawer(rubId));
    expect(vi.mocked(set3).mock.calls[0][0]).toMatchObject({ rubrics: [] });
  });

  it('handlers no-op when nothing is being edited', () => {
    const { result, setEditingQuestion } = setup(null);
    act(() => {
      result.current.addNewOptionInDrawer();
      result.current.removeOptionInDrawer('o1');
      result.current.addNewSubquestionPartInDrawer();
      result.current.addNewRubricInDrawer();
    });
    expect(setEditingQuestion).not.toHaveBeenCalled();
  });
});
