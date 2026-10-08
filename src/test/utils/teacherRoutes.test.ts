import { describe, expect, it } from 'vitest';
import {
  isKnownTeacherPath,
  teacherPathFromTab,
  teacherTabFromPath,
} from '../../utils/teacherRoutes';

describe('teacher routes', () => {
  it.each([
    ['/teacher/dashboard', 'dashboard'],
    ['/teacher/profile', 'profile'],
    ['/teacher/profile/students', 'students'],
    ['/teacher/profile/classes', 'classes'],
    ['/teacher/settings', 'settings'],
    ['/teacher/settings/questions', 'questions'],
    ['/teacher/exams', 'exams'],
    ['/teacher/exams/new', 'exams/new'],
    ['/teacher/results', 'results'],
  ])('maps %s to %s and back', (path, tab) => {
    expect(teacherTabFromPath(path)).toBe(tab);
    expect(teacherPathFromTab(tab)).toBe(path);
  });

  it('recognizes exam result detail links', () => {
    expect(teacherTabFromPath('/teacher/exams/abc-123/results')).toBe('exams');
  });

  it('falls back safely for unknown paths and tabs', () => {
    expect(teacherTabFromPath('/teacher/unknown')).toBe('dashboard');
    expect(teacherPathFromTab('unknown')).toBe('/teacher/dashboard');
  });

  // C.2 (P0-2): the 404 branch needs the INVERSE — a real signal, not the
  // tab fallback (which by design still says 'dashboard').
  it('isKnownTeacherPath keeps the known set and rejects strays (C.2)', () => {
    expect(isKnownTeacherPath('/')).toBe(true);
    expect(isKnownTeacherPath('/teacher/dashboard')).toBe(true);
    expect(isKnownTeacherPath('/teacher/exams/new')).toBe(true);
    expect(isKnownTeacherPath('/teacher/exams/abc-123/results')).toBe(true);
    expect(isKnownTeacherPath('/teacher/unknown')).toBe(false);
    expect(isKnownTeacherPath('/nope')).toBe(false);
    expect(isKnownTeacherPath('/teacher')).toBe(false);
    expect(isKnownTeacherPath('/teacher/exams/abc-123')).toBe(false);
  });
});
