/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Teacher,
  Student,
  StudentImportFailure,
  ClassGroup,
  Question,
  Exam,
  Submission,
} from '../types';
import { getSupabasePublicClient } from '../lib/supabasePublic';
import { publicEnv } from '../config/env';
import { teacherGet, teacherPost, getTeacherAccessToken } from './teacherApi';
import { uploadTeacherAvatar } from './storageService';

export const authService = {
  async loginTeacher(email: string, password = ''): Promise<Teacher> {
    const supabase = getSupabasePublicClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('ایمیل یا رمز عبور معتبر نیست.');
    const me = await teacherGet<{ teacher: Teacher }>('/api/teacher/me');
    const teacher: Teacher = {
      ...me.teacher,
      schoolName: me.teacher.schoolName || '',
      subject: me.teacher.subject || '',
      isOnboarded: me.teacher.isOnboarded ?? false,
    };
    return teacher;
  },

  async signupTeacher(email: string, password: string): Promise<{ ok: boolean; message: string }> {
    const supabase = getSupabasePublicClient();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      // F-09: registration status must never leak. An existing account answers
      // byte-identically to a fresh signup — the caller sees the same success
      // either way, so probing an email list through this form is useless.
      const code = (error as { code?: string }).code;
      const existingAccount =
        code === 'user_already_exists' ||
        code === 'email_exists' ||
        error.message?.includes('already registered') ||
        error.message?.includes('already been registered');
      if (existingAccount) return { ok: true, message: 'verification_email_sent' };
      throw new Error(error.message || 'خطا در ثبت‌نام');
    }
    return { ok: true, message: 'verification_email_sent' };
  },

  async resetPassword(email: string): Promise<void> {
    const supabase = getSupabasePublicClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: publicEnv.appUrl || window.location.origin,
    });
    if (error) throw new Error(error.message || 'خطا در ارسال ایمیل بازیابی');
  },

  async completeOnboarding(schoolName: string, subject: string): Promise<void> {
    // CQ-9 fix: this was the one raw-fetch call in the service layer,
    // bypassing both wrappers — it lacked the JSON content-type guard and
    // `response.json()` threw unhandled on non-JSON error responses. Route
    // through the shared teacherPost (typed ApiError, same-origin, auth).
    await teacherPost('/api/auth/onboarding', { schoolName, subject });
  },

  async logoutTeacher(): Promise<void> {
    const supabase = getSupabasePublicClient();
    await supabase.auth.signOut();
  },

  async getCurrentTeacher(): Promise<Teacher | null> {
    const token = await getTeacherAccessToken();
    if (!token) return null;
    try {
      const me = await teacherGet<{ teacher: Teacher }>('/api/teacher/me');
      return {
        ...me.teacher,
        schoolName: me.teacher.schoolName || '',
        subject: me.teacher.subject || '',
        isOnboarded: me.teacher.isOnboarded ?? false,
      };
    } catch {
      return null;
    }
  },
};

export const teacherProfileService = {
  async save(
    profile: Pick<Teacher, 'name' | 'subject' | 'bio' | 'avatarUrl' | 'schools' | 'schedule'>,
  ): Promise<Teacher> {
    const response = await teacherPost<{ teacher: Teacher }>('/api/teacher/profile', profile);
    return response.teacher;
  },
  uploadAvatar: uploadTeacherAvatar,
};

export const classService = {
  // CQ-9 fix: these getters used to swallow every error and answer [] ,
  // rendering outages as indistinguishable-from-real empty states. They now
  // throw by default — the single production caller (TeacherContext) owns
  // the error UI via its CollectionsStatus state machine.
  async getClassGroups(): Promise<ClassGroup[]> {
    const response = await teacherGet<{ classes: ClassGroup[] }>('/api/teacher/classes');
    return response.classes;
  },
  async createClassGroup(name: string, grade: string): Promise<ClassGroup> {
    const response = await teacherPost<{ classGroup: ClassGroup }>('/api/teacher/classes', {
      action: 'create',
      name,
      grade,
    });
    return response.classGroup;
  },
  async updateClassGroup(id: string, name: string, grade: string): Promise<ClassGroup> {
    const response = await teacherPost<{ classGroup: ClassGroup }>('/api/teacher/classes', {
      action: 'update',
      id,
      name,
      grade,
    });
    return response.classGroup;
  },
  async deleteClassGroup(id: string): Promise<boolean> {
    await teacherPost('/api/teacher/classes', { action: 'delete', id });
    return true;
  },
};

export const studentService = {
  /** CQ-9 fix: throws by default — TeacherContext renders the error state. */
  async getStudents(): Promise<Student[]> {
    const response = await teacherGet<{ students: Student[] }>('/api/teacher/students');
    return response.students;
  },

  /**
   * Import the whole batch in ONE request — the server validates, dedupes and
   * reports every row. Failures come back per row, never as a silent count.
   */
  async importStudents(
    studentsToImport: (Omit<Student, 'id' | 'maskedNationalId'> & { row?: number })[],
    options?: { signal?: AbortSignal },
  ): Promise<{ imported: Student[]; failed: StudentImportFailure[] }> {
    const response = await teacherPost<{
      imported: Student[];
      failed: StudentImportFailure[];
    }>(
      '/api/teacher/students/bulk',
      {
        students: studentsToImport.map((student, index) => ({
          row: student.row ?? index + 1,
          name: student.name,
          nationalId: student.nationalId,
          grade: student.grade,
          classGroupId: student.classGroupId,
          phoneNumber: student.phoneNumber,
          email: student.email,
          status: student.status,
        })),
      },
      options,
    );
    return {
      imported: response.imported || [],
      failed: response.failed || [],
    };
  },

  async createStudent(student: Omit<Student, 'id' | 'maskedNationalId'>): Promise<Student> {
    const response = await teacherPost<{ student: Student }>('/api/teacher/students', {
      action: 'create',
      student,
    });
    return response.student;
  },

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student> {
    const response = await teacherPost<{ student: Student }>('/api/teacher/students', {
      action: 'update',
      student: { id, ...updates },
    });
    return response.student;
  },

  /** T7: teacher-only PIN reset — clears the hash; student sets a new PIN next login. */
  async resetStudentPin(id: string): Promise<Student> {
    const response = await teacherPost<{ student: Student }>('/api/teacher/students', {
      action: 'reset-pin',
      id,
    });
    return response.student;
  },

  async deleteStudent(id: string): Promise<boolean> {
    await teacherPost('/api/teacher/students', { action: 'delete', id });
    return true;
  },
};

export const questionService = {
  /** CQ-9 fix: throws by default — TeacherContext renders the error state. */
  async getQuestions(): Promise<Question[]> {
    const response = await teacherGet<{ questions: Question[] }>('/api/teacher/questions');
    return response.questions;
  },

  async createQuestion(question: Omit<Question, 'id' | 'createdAt'>): Promise<Question> {
    const response = await teacherPost<{ question: Question }>('/api/teacher/questions', {
      action: 'create',
      question,
    });
    return response.question;
  },

  async updateQuestion(id: string, updates: Partial<Question>): Promise<Question> {
    const response = await teacherPost<{ question: Question }>('/api/teacher/questions', {
      action: 'update',
      question: { id, ...updates },
    });
    return response.question;
  },

  async deleteQuestion(id: string): Promise<boolean> {
    await teacherPost('/api/teacher/questions', { action: 'delete', id });
    return true;
  },
};

export const examService = {
  /** CQ-9 fix: throws by default — TeacherContext renders the error state. */
  async getExams(): Promise<Exam[]> {
    const response = await teacherGet<{ exams: Exam[] }>('/api/teacher/exams');
    return response.exams;
  },

  async createExam(exam: Omit<Exam, 'id' | 'createdAt' | 'examCode'>): Promise<Exam> {
    const response = await teacherPost<{ exam: Exam }>('/api/teacher/exams', {
      action: 'create',
      exam,
    });
    return response.exam;
  },

  async updateExam(id: string, updates: Partial<Exam>): Promise<Exam> {
    const response = await teacherPost<{ exam: Exam }>('/api/teacher/exams', {
      action: 'update',
      id,
      exam: { id, ...updates },
    });
    return response.exam;
  },

  async deleteExam(id: string): Promise<boolean> {
    await teacherPost('/api/teacher/exams', { action: 'delete', id });
    return true;
  },

  async publishExam(id: string): Promise<Exam> {
    return examService.updateExam(id, { status: 'active' });
  },
  // CQ-2 fix: seven dead methods removed (generateExamDraft, getExamByCode,
  // getExamForStudent, startStudentExam, saveStudentAnswer, submitExam — and
  // gradingService.autoGradeSubmission below). Repo-wide grep proved zero
  // production callers; the throwing stubs implied a student data path that
  // AGENTS.md explicitly says does not exist (students join via the secure
  // exam portal only), misleading contributors.
};

export const gradingService = {
  /** CQ-9 fix: throws by default — TeacherContext renders the error state. */
  async getSubmissions(examId?: string): Promise<Submission[]> {
    const suffix = examId ? '?examId=' + encodeURIComponent(examId) : '';
    const response = await teacherGet<{ submissions: Submission[] }>(
      '/api/teacher/submissions' + suffix,
    );
    return response.submissions;
  },

  /** Wave C: disciplinary action — first call warns + restarts the session,
   *  the server turns the second call into a permanent block. */
  async invalidateSubmission(submissionId: string): Promise<{
    ok: boolean;
    action: 'warned' | 'blocked';
    warningCount: number;
  }> {
    return teacherPost('/api/teacher/submissions', { sessionId: submissionId });
  },

  /** Persists one answer grade. The caller owns the cache patch — the endpoint
   *  answers { ok } only, so the previous full-list refetch here was pure
   *  waste (and ran once per answer inside grading loops). */
  async updateManualGrade(
    submissionId: string,
    questionId: string,
    scoreGained: number,
    comment = '',
  ): Promise<void> {
    await teacherPost('/api/teacher/grade-answer', {
      submissionId,
      questionId,
      scoreGained,
      comment,
    });
  },

  /** Marks a submission graded server-side so it stops appearing as
   *  "needs grading" in notifications after reload. Cache patch is the
   *  caller's job. */
  async finalizeGrade(submissionId: string): Promise<void> {
    await teacherPost('/api/teacher/finalize-submission', { submissionId });
  },
};
