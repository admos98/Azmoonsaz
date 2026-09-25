import { describe, expect, it } from 'vitest';
import { teacherPathFromTab, teacherTabFromPath } from '../../utils/teacherRoutes';

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
});
