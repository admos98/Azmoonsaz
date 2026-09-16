/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Teacher, Student, ClassGroup, Question, Exam, Submission, StudentAnswer, ExamSettings } from '../types';
import { logger } from '../lib/logger';
import { getSupabasePublicClient } from '../lib/supabasePublic';
import { publicEnv } from '../config/env';
import { teacherGet, teacherPost, getTeacherAccessToken } from './teacherApi';
import { uploadQuestionImage as storageUploadQuestionImage } from './storageService';

export const authService = {
  async loginTeacher(email: string, password = ''): Promise<Teacher> {
    const supabase = getSupabasePublicClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('ایمیل یا رمز عبور معتبر نیست.');
    const me = await teacherGet<{ teacher: { id: string; email: string; name: string; schoolName: string } }>('/api/teacher/me');
    const teacher: Teacher = {
      id: me.teacher.id,
      email: me.teacher.email,
      name: me.teacher.name,
      schoolName: me.teacher.schoolName || '',
    };
    return teacher;
  },

  async logoutTeacher(): Promise<void> {
    const supabase = getSupabasePublicClient();
    await supabase.auth.signOut();
  },

  async getCurrentTeacher(): Promise<Teacher | null> {
    const token = await getTeacherAccessToken();
    if (!token) return null;
    try {
      const me = await teacherGet<{ teacher: { id: string; email: string; name: string; schoolName: string } }>('/api/teacher/me');
      return {
        id: me.teacher.id,
        email: me.teacher.email,
        name: me.teacher.name,
        schoolName: me.teacher.schoolName || '',
      };
    } catch {
      return null;
    }
  }
};

export const classService = {
  async getClassGroups(): Promise<ClassGroup[]> {
    try {
      const response = await teacherGet<{ classes: ClassGroup[] }>('/api/teacher/classes');
      return response.classes;
    } catch (err) {
      logger.error('Class group fetch failed:', err);
      return [];
    }
  },
  async createClassGroup(name: string, grade: string): Promise<ClassGroup> {
    const response = await teacherPost<{ classGroup: ClassGroup }>('/api/teacher/classes', { action: 'create', name, grade });
    return response.classGroup;
  },
  async updateClassGroup(id: string, name: string, grade: string): Promise<ClassGroup> {
    const response = await teacherPost<{ classGroup: ClassGroup }>('/api/teacher/classes', { action: 'update', id, name, grade });
    return response.classGroup;
  },
  async deleteClassGroup(id: string): Promise<boolean> {
    await teacherPost('/api/teacher/classes', { action: 'delete', id });
    return true;
  }
};

export const studentService = {
  async getStudents(): Promise<Student[]> {
    try {
      const response = await teacherGet<{ students: Student[] }>('/api/teacher/students');
      return response.students;
    } catch (err) {
      logger.error('Student fetch failed:', err);
      return [];
    }
  },

  async importStudents(studentsToImport: Omit<Student, 'id' | 'maskedNationalId'>[]): Promise<Student[]> {
    const created: Student[] = [];
    for (const student of studentsToImport) {
      const response = await teacherPost<{ student: Student }>('/api/teacher/students', { action: 'create', student });
      created.push(response.student);
    }
    return created;
  },

  async createStudent(student: Omit<Student, 'id' | 'maskedNationalId'>): Promise<Student> {
    const response = await teacherPost<{ student: Student }>('/api/teacher/students', { action: 'create', student });
    return response.student;
  },

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student> {
    const response = await teacherPost<{ student: Student }>('/api/teacher/students', { action: 'update', student: { id, ...updates } });
    return response.student;
  },

  async deleteStudent(id: string): Promise<boolean> {
    await teacherPost('/api/teacher/students', { action: 'delete', id });
    return true;
  }
};

export const questionService = {
  async getQuestions(): Promise<Question[]> {
    try {
      const response = await teacherGet<{ questions: Question[] }>('/api/teacher/questions');
      return response.questions;
    } catch (err) {
      logger.error('Question fetch failed:', err);
      return [];
    }
  },

  async createQuestion(question: Omit<Question, 'id' | 'createdAt'>): Promise<Question> {
    const response = await teacherPost<{ question: Question }>('/api/teacher/questions', { action: 'create', question });
    return response.question;
  },

  async updateQuestion(id: string, updates: Partial<Question>): Promise<Question> {
    const response = await teacherPost<{ question: Question }>('/api/teacher/questions', { action: 'update', question: { id, ...updates } });
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
  }
};

export const examService = {
  async getExams(): Promise<Exam[]> {
    try {
      const response = await teacherGet<{ exams: Exam[] }>('/api/teacher/exams');
      return response.exams;
    } catch (err) {
      logger.error('Exam fetch failed:', err);
      return [];
    }
  },

  async createExam(exam: Omit<Exam, 'id' | 'createdAt' | 'examCode'>): Promise<Exam> {
    const response = await teacherPost<{ exam: Exam }>('/api/teacher/exams', { action: 'create', exam });
    return response.exam;
  },

  async updateExam(id: string, updates: Partial<Exam>): Promise<Exam> {
    const response = await teacherPost<{ exam: Exam }>('/api/teacher/exams', { action: 'update', id, exam: { id, ...updates } });
    return response.exam;
  },

  async deleteExam(id: string): Promise<boolean> {
    await teacherPost('/api/teacher/exams', { action: 'delete', id });
    return true;
  },

  async generateExamDraft(subject: string, grade: string, settings: ExamSettings): Promise<Exam> {
    const allQuestions = await questionService.getQuestions();
    const matchQuestions = allQuestions.filter(q => q.grade === grade).slice(0, 4);
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
        maxAttempts: 1
      },
      sections: [{ id: 'draft-sec-1', title: 'سوالات طراحی شده', questionIds: matchQuestions.map(q => q.id) }],
      questions: matchQuestions
    };
    return examService.createExam(draft);
  },

  async publishExam(id: string): Promise<Exam> {
    return examService.updateExam(id, { status: 'active' });
  },

  async getExamByCode(code: string): Promise<Exam | null> {
    const response = await teacherGet<{ exams: Exam[] }>('/api/teacher/exams');
    return response.exams.find(e => e.examCode.toUpperCase() === code.toUpperCase().trim()) || null;
  },

  async getExamForStudent(examId: string): Promise<Exam> {
    const response = await teacherGet<{ exams: Exam[] }>('/api/teacher/exams');
    const match = response.exams.find(e => e.id === examId);
    if (!match) throw new Error('Exam not found');
    return match;
  },

  async startStudentExam(examCode: string, studentName: string, nationalId: string): Promise<Submission> {
    // This is a student-facing endpoint — should use the student API, not teacher API.
    // For now, throw an error directing to the secure exam portal.
    throw new Error('Student exam start should use the secure exam portal.');
  },

  async saveStudentAnswer(submissionId: string, questionId: string, answer: StudentAnswer["answer"]): Promise<Submission> {
    throw new Error('Student answer save should use the secure exam portal.');
  },

  async submitExam(submissionId: string): Promise<Submission> {
    throw new Error('Student exam submit should use the secure exam portal.');
  }
};

export const gradingService = {
  async getSubmissions(examId?: string): Promise<Submission[]> {
    try {
      const suffix = examId ? '?examId=' + encodeURIComponent(examId) : '';
      const response = await teacherGet<{ submissions: Submission[] }>('/api/teacher/submissions' + suffix);
      return response.submissions;
    } catch (err) {
      logger.error('Submissions fetch failed:', err);
      return [];
    }
  },

  async autoGradeSubmission(submissionId: string): Promise<Submission> {
    throw new Error('Auto-grade should use the secure exam portal.');
  },

  async updateManualGrade(submissionId: string, questionId: string, scoreGained: number, comment = ''): Promise<Submission> {
    await teacherPost('/api/teacher/grade-answer', { submissionId, questionId, scoreGained, comment });
    const submissions = await this.getSubmissions();
    const updated = submissions.find(s => s.id === submissionId);
    if (!updated) throw new Error('Submission not found after grading');
    return updated;
  },

  async finalizeGrade(submissionId: string): Promise<Submission> {
    await teacherPost('/api/teacher/finalize-submission', { submissionId });
    const submissions = await this.getSubmissions();
    const updated = submissions.find(s => s.id === submissionId);
    if (!updated) throw new Error('Submission not found after finalize');
    return updated;
  }
};
