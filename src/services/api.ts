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
  StudentAnswer,
  ExamSettings,
} from '../types';
import { logger } from '../lib/logger';
import { getSupabasePublicClient } from '../lib/supabasePublic';
import { publicEnv } from '../config/env';
import { teacherGet, teacherPost, getTeacherAccessToken } from './teacherApi';
import {
  uploadQuestionImage as storageUploadQuestionImage,
  uploadTeacherAvatar,
} from './storageService';

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
    const response = await fetch('/api/auth/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await getTeacherAccessToken()}`,
      },
      body: JSON.stringify({ schoolName, subject }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'خطا در تکمیل اطلاعات');
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
  async getClassGroups(options?: { throwOnError?: boolean }): Promise<ClassGroup[]> {
    try {
      const response = await teacherGet<{ classes: ClassGroup[] }>('/api/teacher/classes');
      return response.classes;
    } catch (err) {
      logger.error('Class group fetch failed:', err);
      if (options?.throwOnError) throw err;
      return [];
    }
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
  async getStudents(options?: { throwOnError?: boolean }): Promise<Student[]> {
    try {
      const response = await teacherGet<{ students: Student[] }>('/api/teacher/students');
      return response.students;
    } catch (err) {
      logger.error('Student fetch failed:', err);
      if (options?.throwOnError) throw err;
      return [];
    }
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

  async deleteStudent(id: string): Promise<boolean> {
    await teacherPost('/api/teacher/students', { action: 'delete', id });
    return true;
  },
};

export const questionService = {
  async getQuestions(options?: { throwOnError?: boolean }): Promise<Question[]> {
    try {
      const response = await teacherGet<{ questions: Question[] }>('/api/teacher/questions');
      return response.questions;
    } catch (err) {
      logger.error('Question fetch failed:', err);
      if (options?.throwOnError) throw err;
      return [];
    }
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

  async uploadQuestionImage(questionId: string, base64OrFile: File | string): Promise<string> {
    let file: File;
    if (base64OrFile instanceof File) {
      file = base64OrFile;
    } else if (typeof base64OrFile === 'string') {
      const res = await fetch(base64OrFile);
      const blob = await res.blob();
      file = new File([blob], `question_${questionId}.png`, { type: blob.type || 'image/png' });
    } else {
      throw new Error('Invalid image input: expected File or base64 string');
    }
    return storageUploadQuestionImage(file);
  },
};

export const examService = {
  async getExams(options?: { throwOnError?: boolean }): Promise<Exam[]> {
    try {
      const response = await teacherGet<{ exams: Exam[] }>('/api/teacher/exams');
      return response.exams;
    } catch (err) {
      logger.error('Exam fetch failed:', err);
      if (options?.throwOnError) throw err;
      return [];
    }
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

  async generateExamDraft(subject: string, grade: string, settings: ExamSettings): Promise<Exam> {
    const allQuestions = await questionService.getQuestions();
    const matchQuestions = allQuestions.filter((q) => q.grade === grade).slice(0, 4);
    const draft: Omit<Exam, 'id' | 'createdAt' | 'examCode'> = {
      title: `پیش‌نویس آزمون خودکار ${subject} پایه ${grade}`,
      description: 'آزمون تولید شده بر اساس سوالات موجود در بانک سوالات.',
      grade,
      subject,
      duration: settings.durationMinutes || 45,
      status: 'draft',
      classGroupIds: settings.allowedClasses || [],
      teacherId: '',
      settings: {
        mode: 'official',
        durationMinutes: settings.durationMinutes || 45,
        shuffleQuestions: true,
        shuffleOptions: true,
        allowBacktrack: true,
        showImmediateResults: false,
        maxAttempts: 1,
      },
      sections: [
        {
          id: 'draft-sec-1',
          title: 'سوالات طراحی شده',
          questionIds: matchQuestions.map((q) => q.id),
        },
      ],
      questions: matchQuestions,
    };
    return examService.createExam(draft);
  },

  async publishExam(id: string): Promise<Exam> {
    return examService.updateExam(id, { status: 'active' });
  },

  async getExamByCode(code: string): Promise<Exam | null> {
    const response = await teacherGet<{ exams: Exam[] }>('/api/teacher/exams');
    return (
      response.exams.find((e) => e.examCode.toUpperCase() === code.toUpperCase().trim()) || null
    );
  },

  async getExamForStudent(examId: string): Promise<Exam> {
    const response = await teacherGet<{ exams: Exam[] }>('/api/teacher/exams');
    const match = response.exams.find((e) => e.id === examId);
    if (!match) throw new Error('Exam not found');
    return match;
  },

  async startStudentExam(
    _examCode: string,
    _studentName: string,
    _nationalId: string,
  ): Promise<Submission> {
    // This is a student-facing endpoint — should use the student API, not teacher API.
    // For now, throw an error directing to the secure exam portal.
    throw new Error('Student exam start should use the secure exam portal.');
  },

  async saveStudentAnswer(
    _submissionId: string,
    _questionId: string,
    _answer: StudentAnswer['answer'],
  ): Promise<Submission> {
    throw new Error('Student answer save should use the secure exam portal.');
  },

  async submitExam(_submissionId: string): Promise<Submission> {
    throw new Error('Student exam submit should use the secure exam portal.');
  },
};

export const gradingService = {
  async getSubmissions(
    examId?: string,
    options?: { throwOnError?: boolean },
  ): Promise<Submission[]> {
    try {
      const suffix = examId ? '?examId=' + encodeURIComponent(examId) : '';
      const response = await teacherGet<{ submissions: Submission[] }>(
        '/api/teacher/submissions' + suffix,
      );
      return response.submissions;
    } catch (err) {
      logger.error('Submissions fetch failed:', err);
      if (options?.throwOnError) throw err;
      return [];
    }
  },

  async autoGradeSubmission(_submissionId: string): Promise<Submission> {
    throw new Error('Auto-grade should use the secure exam portal.');
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
