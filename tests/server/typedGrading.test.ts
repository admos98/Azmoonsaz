/**
 * T1 — typed auto-grading: verdicts per question type against stored keys.
 * No network, no database — pure function coverage.
 */
import { describe, expect, it } from 'vitest';
import { gradeTypedAnswer } from '../../api/_lib/examSecurity.js';

describe('gradeTypedAnswer (T1 typed verdicts)', () => {
  it('grades true/false by boolean equality', () => {
    const q = { type: 'true_false', answer_key: { correctAnswer: true }, body: {} };
    expect(gradeTypedAnswer(q, true)).toEqual({ correct: true });
    expect(gradeTypedAnswer(q, false)).toEqual({ correct: false });
    // Missing key → teacher grades.
    expect(gradeTypedAnswer({ type: 'true_false', answer_key: {}, body: {} }, true)).toBe(null);
  });

  it('grades single choice by exact id equality', () => {
    const q = { type: 'single_choice', answer_key: { correctAnswer: 'B' }, body: {} };
    expect(gradeTypedAnswer(q, 'B')).toEqual({ correct: true });
    expect(gradeTypedAnswer(q, 'A')).toEqual({ correct: false });
    expect(gradeTypedAnswer({ type: 'single_choice', answer_key: {}, body: {} }, 'B')).toBe(null);
  });

  it('grades multiple choice by set equality — order-free, duplicates ignored', () => {
    const q = { type: 'multiple_choice', answer_key: { correctAnswer: ['A', 'B'] }, body: {} };
    expect(gradeTypedAnswer(q, ['A', 'B'])).toEqual({ correct: true });
    expect(gradeTypedAnswer(q, ['B', 'A'])).toEqual({ correct: true });
    expect(gradeTypedAnswer(q, ['A', 'B', 'A'])).toEqual({ correct: true });
    // Partial, over-, and scalar answers are incorrect — never half credit.
    expect(gradeTypedAnswer(q, ['A'])).toEqual({ correct: false });
    expect(gradeTypedAnswer(q, ['A', 'B', 'C'])).toEqual({ correct: false });
    expect(gradeTypedAnswer(q, 'A')).toEqual({ correct: false });
    expect(gradeTypedAnswer({ type: 'multiple_choice', answer_key: {}, body: {} }, ['A'])).toBe(
      null,
    );
  });

  it('grades fill-blank positionally, trimmed and case-insensitive', () => {
    const q = {
      type: 'fill_blank',
      answer_key: { correctFillBlanks: ['تهران', 'دماوند'] },
      body: {},
    };
    expect(gradeTypedAnswer(q, ['تهران', 'دماوند'])).toEqual({ correct: true });
    expect(gradeTypedAnswer(q, [' تهران ', 'دماوند'])).toEqual({ correct: true });
    expect(gradeTypedAnswer(q, ['تهران'])).toEqual({ correct: false });
    expect(gradeTypedAnswer(q, ['تهران', 'اشتباه'])).toEqual({ correct: false });
    expect(gradeTypedAnswer({ type: 'fill_blank', answer_key: {}, body: {} }, ['a'])).toBe(null);
  });

  it('grades matching on canonical left->right mappings', () => {
    const q = {
      type: 'matching',
      answer_key: {},
      body: {
        matchingPairs: [
          { left: 'ایران', right: 'تهران' },
          { left: 'فرانسه', right: 'پاریس' },
        ],
      },
    };
    expect(gradeTypedAnswer(q, { ایران: 'تهران', فرانسه: 'پاریس' })).toEqual({ correct: true });
    expect(gradeTypedAnswer(q, { ایران: 'پاریس', فرانسه: 'تهران' })).toEqual({ correct: false });
    expect(gradeTypedAnswer(q, { ایران: 'تهران' })).toEqual({ correct: false });
    expect(gradeTypedAnswer({ type: 'matching', answer_key: {}, body: {} }, {})).toBe(null);
  });

  it('grades ordering on exact sequence equality', () => {
    const q = {
      type: 'ordering',
      answer_key: {},
      body: { orderingItems: ['اول', 'دوم', 'سوم'] },
    };
    expect(gradeTypedAnswer(q, ['اول', 'دوم', 'سوم'])).toEqual({ correct: true });
    expect(gradeTypedAnswer(q, ['دوم', 'اول', 'سوم'])).toEqual({ correct: false });
    expect(gradeTypedAnswer(q, ['اول', 'دوم'])).toEqual({ correct: false });
    expect(gradeTypedAnswer({ type: 'ordering', answer_key: {}, body: {} }, [])).toBe(null);
  });

  it('grades short answer trimmed and case-insensitive when a key exists', () => {
    const q = { type: 'short_answer', answer_key: { correctAnswer: 'نیوتن' }, body: {} };
    expect(gradeTypedAnswer(q, 'نیوتن')).toEqual({ correct: true });
    expect(gradeTypedAnswer(q, ' نیوتن ')).toEqual({ correct: true });
    expect(gradeTypedAnswer(q, 'انیشتین')).toEqual({ correct: false });
    expect(gradeTypedAnswer({ type: 'short_answer', answer_key: {}, body: {} }, 'x')).toBe(null);
  });

  it('defers subjective and unknown types to the teacher', () => {
    for (const type of ['long_answer', 'cloze', 'reading_comprehension', 'mystery']) {
      expect(gradeTypedAnswer({ type, answer_key: {}, body: {} }, 'anything')).toBe(null);
    }
  });

  it('grades blank input as incorrect, never crashes on hostile shapes', () => {
    const q = { type: 'fill_blank', answer_key: { correctFillBlanks: ['a'] }, body: {} };
    expect(gradeTypedAnswer(q, undefined)).toEqual({ correct: false });
    expect(gradeTypedAnswer(q, null)).toEqual({ correct: false });
    expect(gradeTypedAnswer(q, '')).toEqual({ correct: false });
    expect(gradeTypedAnswer(q, { hostile: 'object' })).toEqual({ correct: false });
    // Null question has no type or key — defers to the teacher, never crashes.
    expect(gradeTypedAnswer(null, 'x')).toBe(null);
  });
});
