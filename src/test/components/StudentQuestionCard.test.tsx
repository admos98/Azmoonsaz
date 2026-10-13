import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StudentQuestionCard from '../../components/StudentQuestionCard';

const base = {
  id: 'q1',
  title: 'سوال ۱',
  points: 2,
};

describe('StudentQuestionCard (T1 typed inputs)', () => {
  it('single choice calls onAnswer with the option id', () => {
    const onAnswer = vi.fn();
    render(
      <StudentQuestionCard
        question={{
          ...base,
          type: 'single_choice',
          body: {
            text: 'متن',
            options: [
              { id: 'A', text: 'الف' },
              { id: 'B', text: 'ب' },
            ],
          },
        }}
        index={0}
        answer={undefined}
        onAnswer={onAnswer}
        disabled={false}
      />,
    );
    fireEvent.click(screen.getByText('ب'));
    expect(onAnswer).toHaveBeenCalledWith('q1', 'B');
  });

  it('multiple choice toggles an id array', () => {
    const onAnswer = vi.fn();
    const { rerender } = render(
      <StudentQuestionCard
        question={{
          ...base,
          type: 'multiple_choice',
          body: {
            text: 'متن',
            options: [
              { id: 'A', text: 'الف' },
              { id: 'B', text: 'ب' },
            ],
          },
        }}
        index={0}
        answer={[]}
        onAnswer={onAnswer}
        disabled={false}
      />,
    );
    fireEvent.click(screen.getByText('الف'));
    expect(onAnswer).toHaveBeenCalledWith('q1', ['A']);
    rerender(
      <StudentQuestionCard
        question={{
          ...base,
          type: 'multiple_choice',
          body: {
            text: 'متن',
            options: [
              { id: 'A', text: 'الف' },
              { id: 'B', text: 'ب' },
            ],
          },
        }}
        index={0}
        answer={['A']}
        onAnswer={onAnswer}
        disabled={false}
      />,
    );
    fireEvent.click(screen.getByText('ب'));
    expect(onAnswer).toHaveBeenCalledWith('q1', ['A', 'B']);
  });

  it('true/false calls onAnswer with a boolean', () => {
    const onAnswer = vi.fn();
    render(
      <StudentQuestionCard
        question={{ ...base, type: 'true_false', body: { text: 'متن' } }}
        index={0}
        answer={undefined}
        onAnswer={onAnswer}
        disabled={false}
      />,
    );
    fireEvent.click(screen.getByText('درست'));
    expect(onAnswer).toHaveBeenCalledWith('q1', true);
  });

  it('fill-blank renders one input per restored row and commits arrays', () => {
    const onAnswer = vi.fn();
    render(
      <StudentQuestionCard
        question={{ ...base, type: 'fill_blank', body: { text: 'متن ___ و ___' } }}
        index={0}
        answer={['اول', '']}
        onAnswer={onAnswer}
        disabled={false}
      />,
    );
    const inputs = screen.getAllByPlaceholderText('پاسخ خود را بنویسید');
    expect(inputs).toHaveLength(2);
    fireEvent.change(inputs[1], { target: { value: 'دوم' } });
    expect(onAnswer).toHaveBeenCalledWith('q1', ['اول', 'دوم']);
  });

  it('short and long answers commit text', () => {
    const onAnswer = vi.fn();
    const { unmount } = render(
      <StudentQuestionCard
        question={{ ...base, type: 'short_answer', body: { text: 'متن' } }}
        index={0}
        answer={undefined}
        onAnswer={onAnswer}
        disabled={false}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('پاسخ خود را بنویسید'), {
      target: { value: 'پاسخ کوتاه' },
    });
    expect(onAnswer).toHaveBeenCalledWith('q1', 'پاسخ کوتاه');
    unmount();

    const onLong = vi.fn();
    render(
      <StudentQuestionCard
        question={{ ...base, type: 'long_answer', body: { text: 'متن' } }}
        index={0}
        answer={undefined}
        onAnswer={onLong}
        disabled={false}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('پاسخ تشریحی خود را بنویسید'), {
      target: { value: 'شرح کامل' },
    });
    expect(onLong).toHaveBeenCalledWith('q1', 'شرح کامل');
  });

  it('matching selects right-text keyed by left', () => {
    const onAnswer = vi.fn();
    render(
      <StudentQuestionCard
        question={{
          ...base,
          type: 'matching',
          body: {
            text: 'وصل کنید',
            displayPairs: [
              { left: 'ایران', right: 'تهران' },
              { left: 'فرانسه', right: 'پاریس' },
            ],
          },
        }}
        index={0}
        answer={{}}
        onAnswer={onAnswer}
        disabled={false}
      />,
    );
    // Matching uses the library Dropdown (listbox trigger + portaled options),
    // not a native select — open the row trigger, then pick the option.
    const trigger = screen.getByRole('button', { name: 'معادل ایران' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'تهران' }));
    expect(onAnswer).toHaveBeenCalledWith('q1', { ایران: 'تهران' });
  });

  it('ordering moves items and commits the sequence', () => {
    const onAnswer = vi.fn();
    render(
      <StudentQuestionCard
        question={{
          ...base,
          type: 'ordering',
          body: { text: 'مرتب کنید', displayItems: ['اول', 'دوم', 'سوم'] },
        }}
        index={0}
        answer={['اول', 'دوم', 'سوم']}
        onAnswer={onAnswer}
        disabled={false}
      />,
    );
    const downButtons = screen.getAllByLabelText('انتقال به پایین');
    fireEvent.click(downButtons[0]);
    expect(onAnswer).toHaveBeenCalledWith('q1', ['دوم', 'اول', 'سوم']);
  });

  it('ordering commits the pristine sequence on mount (untouched order is an answer)', () => {
    const onAnswer = vi.fn();
    render(
      <StudentQuestionCard
        question={{
          ...base,
          type: 'ordering',
          body: { text: 'مرتب کنید', displayItems: ['اول', 'دوم', 'سوم'] },
        }}
        index={0}
        answer={undefined}
        onAnswer={onAnswer}
        disabled={false}
      />,
    );
    expect(onAnswer).toHaveBeenCalledWith('q1', ['اول', 'دوم', 'سوم']);
  });

  it('fill-blank renders blankCount fields before any answer exists', () => {
    render(
      <StudentQuestionCard
        question={{ ...base, type: 'fill_blank', body: { text: 'متن', blankCount: 3 } }}
        index={0}
        answer={undefined}
        onAnswer={vi.fn()}
        disabled={false}
      />,
    );
    expect(screen.getAllByLabelText(/جای خالی/)).toHaveLength(3);
  });

  it('disabled matching renders the answer as static text', () => {
    render(
      <StudentQuestionCard
        question={{
          ...base,
          type: 'matching',
          body: { text: 'وصل کنید', displayPairs: [{ left: 'ایران', right: 'تهران' }] },
        }}
        index={0}
        answer={{ ایران: 'تهران' }}
        onAnswer={vi.fn()}
        disabled
      />,
    );
    expect(screen.queryByRole('button', { name: 'معادل ایران' })).toBeNull();
    expect(screen.getByText('تهران')).toBeVisible();
  });

  it('cloze renders per-part inputs keyed by part id', () => {
    const onAnswer = vi.fn();
    render(
      <StudentQuestionCard
        question={{
          ...base,
          type: 'cloze',
          body: {
            text: 'متن کلوز',
            parts: [{ id: 'p1', text: 'مینی‌سوال', type: 'short_answer' }],
          },
        }}
        index={0}
        answer={{}}
        onAnswer={onAnswer}
        disabled={false}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('پاسخ خود را بنویسید'), {
      target: { value: 'پاسخ مینی' },
    });
    expect(onAnswer).toHaveBeenCalledWith('q1', { p1: 'پاسخ مینی' });
  });

  it('disabled freezes every control', () => {
    const onAnswer = vi.fn();
    render(
      <StudentQuestionCard
        question={{
          ...base,
          type: 'single_choice',
          body: {
            text: 'متن',
            options: [{ id: 'A', text: 'الف' }],
          },
        }}
        index={0}
        answer={undefined}
        onAnswer={onAnswer}
        disabled
      />,
    );
    fireEvent.click(screen.getByText('الف'));
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
