import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * CQ-9: the five collection getters THROW by default now. Their previous
 * swallow-and-return-[] contract rendered API outages as empty states that
 * were indistinguishable from real empty data — and the old version of this
 * suite passed vacuously through exactly that swallow path (it mocked
 * supabasePublic while the services call teacherGet/fetch, so every case
 * "passed" by asserting Array.isArray([])).
 *
 * These tests mock the actual transport (services/teacherApi) and pin both
 * sides of the contract: happy path returns the payload field, failure
 * rejects (TeacherContext's CollectionsStatus owns the error UI).
 */
vi.mock('../../services/teacherApi', () => ({
  teacherGet: vi.fn(),
  teacherPost: vi.fn(),
  getTeacherAccessToken: vi.fn(),
}));

import {
  classService,
  questionService,
  studentService,
  examService,
  gradingService,
} from '../../services/api';
import { teacherGet } from '../../services/teacherApi';

const mockedGet = vi.mocked(teacherGet);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('collection getters (throw-by-default contract)', () => {
  it('classService.getClassGroups returns the classes payload', async () => {
    mockedGet.mockResolvedValueOnce({ classes: [{ id: 'c-1', name: 'کلاس ۷۰۱' }] });
    const result = await classService.getClassGroups();
    expect(result).toEqual([{ id: 'c-1', name: 'کلاس ۷۰۱' }]);
    expect(mockedGet).toHaveBeenCalledWith('/api/teacher/classes');
  });

  it('studentService.getStudents returns the students payload', async () => {
    mockedGet.mockResolvedValueOnce({ students: [{ id: 's-1' }] });
    const result = await studentService.getStudents();
    expect(result).toEqual([{ id: 's-1' }]);
    expect(mockedGet).toHaveBeenCalledWith('/api/teacher/students');
  });

  it('questionService.getQuestions returns the questions payload', async () => {
    mockedGet.mockResolvedValueOnce({ questions: [{ id: 'q-1' }] });
    const result = await questionService.getQuestions();
    expect(result).toEqual([{ id: 'q-1' }]);
    expect(mockedGet).toHaveBeenCalledWith('/api/teacher/questions');
  });

  it('examService.getExams returns the exams payload', async () => {
    mockedGet.mockResolvedValueOnce({ exams: [{ id: 'e-1' }] });
    const result = await examService.getExams();
    expect(result).toEqual([{ id: 'e-1' }]);
    expect(mockedGet).toHaveBeenCalledWith('/api/teacher/exams');
  });

  it('gradingService.getSubmissions appends the examId filter when given', async () => {
    mockedGet.mockResolvedValueOnce({ submissions: [{ id: 'sub-1' }] });
    const result = await gradingService.getSubmissions('exam-9');
    expect(result).toEqual([{ id: 'sub-1' }]);
    expect(mockedGet).toHaveBeenCalledWith('/api/teacher/submissions?examId=exam-9');
  });

  it('gradingService.getSubmissions skips the filter when no examId', async () => {
    mockedGet.mockResolvedValueOnce({ submissions: [] });
    await gradingService.getSubmissions();
    expect(mockedGet).toHaveBeenCalledWith('/api/teacher/submissions');
  });

  it('every getter rejects on transport failure instead of answering []', async () => {
    const boom = new Error('network down');
    const cases: Array<() => Promise<unknown>> = [
      () => classService.getClassGroups(),
      () => studentService.getStudents(),
      () => questionService.getQuestions(),
      () => examService.getExams(),
      () => gradingService.getSubmissions(),
    ];
    for (const run of cases) {
      mockedGet.mockReset();
      mockedGet.mockRejectedValueOnce(boom);
      await expect(run()).rejects.toThrow('network down');
    }
  });
});
