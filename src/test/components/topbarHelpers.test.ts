/**
 * Topbar pure helpers — notification derivation + fixed-dropdown anchor
 * styles, extracted from Topbar.tsx (CQ-8/CQ-11).
 */
import { describe, it, expect, vi } from 'vitest';
import { buildNotificationItems } from '../../components/topbar/notifications';
import {
  buildNotificationStyle,
  buildHamburgerDropdownStyle,
} from '../../components/topbar/positioning';
import type { Exam, Submission } from '../../types';

const NOW = Date.now();
const MIN = 60_000;

function makeSub(overrides: Partial<Submission>): Submission {
  return {
    id: 'sub-1',
    status: 'submitted',
    studentName: 'دانش‌آموز',
    examId: 'exam-1',
    submittedAt: new Date(NOW - 5 * MIN).toISOString(),
    startedAt: new Date(NOW - 30 * MIN).toISOString(),
    ...overrides,
  } as unknown as Submission;
}

function makeExam(overrides: Partial<Exam>): Exam {
  return { id: 'exam-1', title: 'آزمون ریاضی', status: 'active', ...overrides } as unknown as Exam;
}

describe('buildNotificationItems', () => {
  it('lists submitted and ongoing submissions (newest first), excluding graded', () => {
    const items = buildNotificationItems(
      [],
      [
        makeSub({ id: 'old', submittedAt: new Date(NOW - 90 * MIN).toISOString() }),
        makeSub({ id: 'new', submittedAt: new Date(NOW - 2 * MIN).toISOString() }),
        makeSub({ id: 'graded-one', status: 'graded' }),
      ],
      true,
      true,
      undefined,
    );
    const subItems = items.filter((i) => i.id.startsWith('sub-'));
    expect(subItems.map((i) => i.id)).toEqual(['sub-new', 'sub-old']);
    expect(subItems[0].description).toContain('تصحیح');
  });

  it('uses startedAt for ongoing submissions with the "in progress" description', () => {
    const items = buildNotificationItems(
      [],
      [makeSub({ id: 'live', status: 'ongoing', submittedAt: undefined })],
      true,
      true,
      undefined,
    );
    expect(items).toHaveLength(1);
    expect(items[0].description).toContain('در حال پاسخ');
    expect(items[0].timeAgo).toContain('دقیقه');
  });

  it('expresses waits of an hour or more in hours', () => {
    const items = buildNotificationItems(
      [],
      [makeSub({ id: 'old', submittedAt: new Date(NOW - 130 * MIN).toISOString() })],
      true,
      true,
      undefined,
    );
    expect(items[0].timeAgo).toContain('ساعت');
  });

  it('caps at 6 submission items and 3 active-exam items', () => {
    const subs = Array.from({ length: 9 }, (_, i) =>
      makeSub({ id: `s${i}`, submittedAt: new Date(NOW - (i + 1) * MIN).toISOString() }),
    );
    const exams = Array.from({ length: 5 }, (_, i) => makeExam({ id: `e${i}` }));
    const items = buildNotificationItems(exams, subs, true, true, undefined);
    expect(items.filter((i) => i.type === 'submission')).toHaveLength(6);
    expect(items.filter((i) => i.type === 'exam')).toHaveLength(3);
  });

  it('honors the two notification toggles independently', () => {
    const subs = [makeSub({})];
    const exams = [makeExam({})];
    expect(buildNotificationItems(exams, subs, true, false, undefined)).toHaveLength(1);
    expect(buildNotificationItems(exams, subs, false, true, undefined)).toHaveLength(1);
    expect(buildNotificationItems(exams, subs, true, true, undefined)).toHaveLength(2);
    expect(buildNotificationItems(exams, subs, false, false, undefined)).toHaveLength(0);
  });

  it('routes clicks to the submission’s exam results screen', () => {
    const onSelect = vi.fn();
    const items = buildNotificationItems(
      [],
      [makeSub({ examId: 'exam-42' })],
      true,
      true,
      onSelect,
    );
    items[0].onClick?.();
    expect(onSelect).toHaveBeenCalledWith('exam-42');
  });

  it('ignores non-active exams', () => {
    const exams = [
      makeExam({ id: 'draft', status: 'draft' }),
      makeExam({ id: 'done', status: 'completed' }),
    ];
    expect(buildNotificationItems(exams, [], true, true, undefined)).toEqual([]);
  });
});

function rect(overrides: { left?: number; right?: number; top?: number; bottom?: number }) {
  return {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: 44,
    height: 44,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect;
}

describe('dropdown anchor styles', () => {
  it('notification panel anchors below the bell with a 12px gap and 320px width', () => {
    expect(buildNotificationStyle(null)).toEqual({ position: 'fixed' });
    const style = buildNotificationStyle(rect({ left: 100, bottom: 50 }));
    expect(style).toEqual({ position: 'fixed', left: '100px', top: '62px', width: '320px' });
  });

  it('hamburger panel anchors below-right of the button (viewport coordinates)', () => {
    const style = buildHamburgerDropdownStyle(rect({ bottom: 40, right: 80 }));
    // window.innerWidth in jsdom is 1024
    expect(style).toEqual({
      position: 'fixed',
      right: `${1024 - 80}px`,
      top: '52px',
      width: '280px',
    });
    expect(buildHamburgerDropdownStyle(null)).toEqual({
      position: 'fixed',
      right: '0px',
      top: '0px',
      width: '280px',
    });
  });
});
