/**
 * collectValidationWarnings — the exam-preview publish-gate validator,
 * extracted from ExamPreview.tsx (CQ-8/CQ-11). Pure function, no DOM.
 */
import { describe, it, expect } from 'vitest';
import { collectValidationWarnings } from '../../features/exam-preview/validation';
import type { Exam, Question, ExamSection } from '../../types';

const baseQuestion = {
  id: 'q1',
  title: 'سوال یک',
  type: 'single_choice',
  category: 'ریاضی',
  grade: 'هفتم',
  points: 2,
  text: 'متن سوال',
  createdAt: '2026-01-01T00:00:00.000Z',
} as unknown as Question;

function makeExam(
  questions: Partial<Question>[],
  sections: Partial<ExamSection>[] = [{ id: 's1', title: 'بخش ۱', questionIds: ['q1'] }],
): Exam {
  return {
    sections: sections as ExamSection[],
    questions: questions as Question[],
  } as unknown as Exam;
}

describe('collectValidationWarnings', () => {
  it('flags empty sections as section_no_question', () => {
    const warnings = collectValidationWarnings(
      makeExam([{ ...baseQuestion, id: 'q1' }], [
        { id: 's-empty', title: 'بخش خالی', questionIds: [] },
        { id: 's-missing', title: 'بخش بی‌شناسه' },
      ]),
    );
    const types = warnings.filter((w) => w.type === 'section_no_question');
    expect(types.map((w) => w.targetId)).toEqual(['s-empty', 's-missing']);
    expect(types[0].id).toBe('sec-em-s-empty');
    expect(types[0].message).toContain('بخش خالی');
  });

  it('flags missing or non-positive points', () => {
    const warnings = collectValidationWarnings(
      makeExam([
        { ...baseQuestion, id: 'q-nopoints', points: undefined },
        { ...baseQuestion, id: 'q-zero', points: 0 },
      ]),
    );
    const pts = warnings.filter((w) => w.type === 'no_points');
    expect(pts.map((w) => w.targetId)).toEqual(['q-nopoints', 'q-zero']);
  });

  it('flags single_choice questions without a correct answer', () => {
    const warnings = collectValidationWarnings(
      makeExam([{ ...baseQuestion, id: 'q-nokey', correctAnswer: undefined }]),
    );
    expect(warnings.some((w) => w.id === 'q-key-sc-q-nokey')).toBe(true);
  });

  it('flags true_false questions without a boolean key', () => {
    const warnings = collectValidationWarnings(
      makeExam([{ ...baseQuestion, id: 'q-tf', type: 'true_false', correctAnswer: undefined }]),
    );
    expect(warnings.some((w) => w.id === 'q-key-tf-q-tf')).toBe(true);
    // a T/F question WITH a key is clean
    const ok = collectValidationWarnings(
      makeExam([{ ...baseQuestion, id: 'q-tf2', type: 'true_false', correctAnswer: true }]),
    );
    expect(ok.some((w) => w.id === 'q-key-tf-q-tf2')).toBe(false);
  });

  it('flags multiple_choice questions with an empty key array', () => {
    const warnings = collectValidationWarnings(
      makeExam([{ ...baseQuestion, id: 'q-mc', type: 'multiple_choice', correctAnswer: [] }]),
    );
    expect(warnings.some((w) => w.id === 'q-key-mc-q-mc')).toBe(true);
    const ok = collectValidationWarnings(
      makeExam([{ ...baseQuestion, id: 'q-mc2', type: 'multiple_choice', correctAnswer: ['a'] }]),
    );
    expect(ok.some((w) => w.id === 'q-key-mc-q-mc2')).toBe(false);
  });

  it('flags long_answer questions without rubrics', () => {
    const warnings = collectValidationWarnings(
      makeExam([{ ...baseQuestion, id: 'q-long', type: 'long_answer' }]),
    );
    const rub = warnings.find((w) => w.id === 'q-rub-q-long');
    expect(rub?.type).toBe('descriptive_no_rubric');
    const ok = collectValidationWarnings(
      makeExam([
        { ...baseQuestion, id: 'q-long2', type: 'long_answer', rubrics: [{ title: 'r', score: 1 }] },
      ]),
    );
    expect(ok.some((w) => w.id === 'q-rub-q-long2')).toBe(false);
  });

  it('flags image_based questions without media', () => {
    const warnings = collectValidationWarnings(
      makeExam([{ ...baseQuestion, id: 'q-img', type: 'image_based' }]),
    );
    expect(warnings.some((w) => w.id === 'q-img-q-img')).toBe(true);
    const ok = collectValidationWarnings(
      makeExam([
        { ...baseQuestion, id: 'q-img2', type: 'image_based', imageUrl: 'x.webp', correctAnswer: 'a' },
      ]),
    );
    expect(ok.some((w) => w.id === 'q-img-q-img2')).toBe(false);
  });

  it('returns an empty list for a fully valid exam', () => {
    const exam = makeExam(
      [{ ...baseQuestion, correctAnswer: 'opt-1' }],
      [{ id: 's1', title: 'بخش ۱', questionIds: ['q1'] }],
    );
    expect(collectValidationWarnings(exam)).toEqual([]);
  });

  it('stacks independent warnings for the same question (no points AND no key)', () => {
    const warnings = collectValidationWarnings(
      makeExam([{ ...baseQuestion, id: 'q-bad', points: 0, correctAnswer: undefined }]),
    );
    const ids = warnings.map((w) => w.targetId);
    expect(ids).toEqual(['q-bad', 'q-bad']);
  });
});
