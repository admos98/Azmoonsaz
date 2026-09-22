import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase module before importing api
const mockSelect = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockReturnThis();
const mockUpdate = vi.fn().mockReturnThis();
const mockDelete = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockIn = vi.fn().mockReturnThis();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const _mockRpc = vi.fn();

vi.mock('../../lib/supabasePublic', () => ({
  getSupabasePublicClient: () => ({
    from: vi.fn().mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    }),
  }),
}));

import {
  classService,
  questionService,
  studentService,
  examService,
  gradingService,
} from '../../services/api';

beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockReturnValue({
    select: mockSelect,
    eq: mockEq,
    in: mockIn,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    data: [],
    error: null,
  });
  mockEq.mockReturnValue({
    select: mockSelect,
    eq: mockEq,
    in: mockIn,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    data: [],
    error: null,
  });
  mockIn.mockReturnValue({
    select: mockSelect,
    eq: mockEq,
    in: mockIn,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    data: [],
    error: null,
  });
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
});

describe('classService.getClassGroups', () => {
  it('returns array of class groups', async () => {
    mockSelect.mockReturnValueOnce({
      data: [{ id: 'c-1', name: 'کلاس ۷۰۱' }],
      error: null,
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
    });
    const result = await classService.getClassGroups();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('studentService.getStudents', () => {
  it('returns array of students', async () => {
    mockSelect.mockReturnValueOnce({
      data: [{ id: 's-1', name: 'test', nationalId: '001' }],
      error: null,
      select: mockSelect,
      eq: mockEq,
      in: mockIn,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
    });
    const result = await studentService.getStudents();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('questionService.getQuestions', () => {
  it('returns array of questions', async () => {
    mockSelect.mockReturnValueOnce({
      data: [
        {
          id: 'q-1',
          text: 'test',
          type: 'single_choice',
          category: 'test',
          grade: 'هفتم',
          points: 2,
          title: 't',
          createdAt: new Date().toISOString(),
        },
      ],
      error: null,
      select: mockSelect,
      eq: mockEq,
      in: mockIn,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
    });
    const result = await questionService.getQuestions();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('examService.getExams', () => {
  it('returns array of exams', async () => {
    mockSelect.mockReturnValueOnce({
      data: [],
      error: null,
      select: mockSelect,
      eq: mockEq,
      in: mockIn,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
    });
    const result = await examService.getExams();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('gradingService.getSubmissions', () => {
  it('returns array of submissions', async () => {
    mockSelect.mockReturnValueOnce({
      data: [],
      error: null,
      select: mockSelect,
      eq: mockEq,
      in: mockIn,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
    });
    const result = await gradingService.getSubmissions();
    expect(Array.isArray(result)).toBe(true);
  });
});
