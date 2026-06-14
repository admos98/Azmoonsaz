/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Teacher, Student, ClassGroup, Question, Exam, Submission, StudentAnswer } from '../types';
import { mockTeacher, mockTeachers } from '../mock/teachers';
import { mockStudents as initialStudents, mockClassGroups } from '../mock/students';
import { mockQuestions as initialQuestions } from '../mock/questions';
import { mockExams as initialExams } from '../mock/exams';
import { mockSubmissions as initialSubmissions } from '../mock/submissions';
import { maskNationalId } from './persianHelpers';
import { publicEnv } from '../config/env';
import { getSupabasePublicClient } from '../lib/supabasePublic';
import { teacherGet, teacherPost, isSecureTeacherModeAvailable, getTeacherAccessToken } from './teacherApi';

// Helper to delay simulation (make mock actions asynchronous and premium)
const delay = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));

// Stateful Storage Keys
const KEYS = {
  TEACHER: 'azmoonsaz_current_teacher',
  STUDENTS: 'azmoonsaz_students',
  QUESTIONS: 'azmoonsaz_questions',
  EXAMS: 'azmoonsaz_exams',
  SUBMISSIONS: 'azmoonsaz_submissions'
};

// Stateful Memory Sync
function initializeStorage() {
  if (typeof window === 'undefined') return;
  
  if (!localStorage.getItem(KEYS.TEACHER)) {
    localStorage.setItem(KEYS.TEACHER, JSON.stringify(mockTeacher));
  }
  if (!localStorage.getItem(KEYS.STUDENTS)) {
    localStorage.setItem(KEYS.STUDENTS, JSON.stringify(initialStudents));
  }
  if (!localStorage.getItem(KEYS.QUESTIONS)) {
    localStorage.setItem(KEYS.QUESTIONS, JSON.stringify(initialQuestions));
  }
  if (!localStorage.getItem(KEYS.EXAMS)) {
    localStorage.setItem(KEYS.EXAMS, JSON.stringify(initialExams));
  }
  if (!localStorage.getItem(KEYS.SUBMISSIONS)) {
    localStorage.setItem(KEYS.SUBMISSIONS, JSON.stringify(initialSubmissions));
  }
}

initializeStorage();

// Retrieve utility helpers
function getItem<T>(key: string, defaultValue: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, val: T): void {
  localStorage.setItem(key, JSON.stringify(val));
}

export const authService = {
  async loginTeacher(email: string, password = ''): Promise<Teacher> {
    if (publicEnv.isSupabaseConfigured) {
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
      setItem(KEYS.TEACHER, teacher);
      return teacher;
    }

    await delay(600);
    const target = mockTeachers.find(t => t.email === email) || mockTeacher;
    setItem(KEYS.TEACHER, target);
    return target;
  },

  async logoutTeacher(): Promise<void> {
    if (publicEnv.isSupabaseConfigured) {
      const supabase = getSupabasePublicClient();
      await supabase.auth.signOut();
    }
    await delay(100);
    localStorage.removeItem(KEYS.TEACHER);
  },

  async getCurrentTeacher(): Promise<Teacher | null> {
    if (publicEnv.isSupabaseConfigured) {
      const token = await getTeacherAccessToken();
      if (!token) return null;
      const me = await teacherGet<{ teacher: { id: string; email: string; name: string; schoolName: string } }>('/api/teacher/me');
      return {
        id: me.teacher.id,
        email: me.teacher.email,
        name: me.teacher.name,
        schoolName: me.teacher.schoolName || '',
      };
    }
    await delay(200);
    return getItem<Teacher | null>(KEYS.TEACHER, null);
  }
};

export const studentService = {
  /**
   * Fetches all registered students.
   * Integration point: DB select query, e.g. `const { data } = await supabase.from('students').select('*')`
   */
  async getStudents(): Promise<Student[]> {
    if (isSecureTeacherModeAvailable()) {
      try {
        const response = await teacherGet<{ students: Student[] }>('/api/teacher/students');
        return response.students;
      } catch (err) {
        console.warn('Secure student fetch failed; falling back to mock data.', err);
      }
    }
    await delay(300);
    return getItem<Student[]>(KEYS.STUDENTS, []);
  },

  /**
   * Bulk imports multiple student rows.
   */
  async importStudents(studentsToImport: Omit<Student, 'id' | 'maskedNationalId'>[]): Promise<Student[]> {
    if (isSecureTeacherModeAvailable()) {
      const created: Student[] = [];
      for (const student of studentsToImport) {
        const response = await teacherPost<{ student: Student }>('/api/teacher/students', {
          action: 'create',
          student,
        });
        created.push(response.student);
      }
      return created;
    }

    await delay(1000);
    const current = getItem<Student[]>(KEYS.STUDENTS, []);
    const imported: Student[] = studentsToImport.map((s, idx) => ({
      ...s,
      id: `std-imported-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
      maskedNationalId: maskNationalId(s.nationalId)
    }));
    const combined = [...current, ...imported];
    setItem(KEYS.STUDENTS, combined);
    return imported;
  },

  /**
   * Inserts single student profile.
   */
  async createStudent(student: Omit<Student, 'id' | 'maskedNationalId'>): Promise<Student> {
    if (isSecureTeacherModeAvailable()) {
      const response = await teacherPost<{ student: Student }>('/api/teacher/students', {
        action: 'create',
        student,
      });
      return response.student;
    }

    await delay(400);
    const current = getItem<Student[]>(KEYS.STUDENTS, []);
    const created: Student = {
      ...student,
      id: `std-${Date.now()}`,
      maskedNationalId: maskNationalId(student.nationalId)
    };
    setItem(KEYS.STUDENTS, [created, ...current]);
    return created;
  },

  /**
   * Updates an existing student's data.
   */
  async updateStudent(id: string, updates: Partial<Student>): Promise<Student> {
    if (isSecureTeacherModeAvailable()) {
      const response = await teacherPost<{ student: Student }>('/api/teacher/students', {
        action: 'update',
        student: { id, ...updates },
      });
      return response.student;
    }

    await delay(400);
    const current = getItem<Student[]>(KEYS.STUDENTS, []);
    let updatedObj: Student | null = null;
    const updated = current.map(item => {
      if (item.id === id) {
        updatedObj = {
          ...item,
          ...updates,
          maskedNationalId: updates.nationalId ? maskNationalId(updates.nationalId) : item.maskedNationalId
        };
        return updatedObj;
      }
      return item;
    });
    if (!updatedObj) throw new Error('Student not found for update');
    setItem(KEYS.STUDENTS, updated);
    return updatedObj;
  },

  /**
   * Deletes a student profile.
   */
  async deleteStudent(id: string): Promise<boolean> {
    if (isSecureTeacherModeAvailable()) {
      await teacherPost('/api/teacher/students', { action: 'delete', id });
      return true;
    }

    await delay(300);
    const current = getItem<Student[]>(KEYS.STUDENTS, []);
    const filtered = current.filter(item => item.id !== id);
    setItem(KEYS.STUDENTS, filtered);
    return true;
  }
};

export const questionService = {
  async getQuestions(): Promise<Question[]> {
    if (isSecureTeacherModeAvailable()) {
      try {
        const response = await teacherGet<{ questions: Question[] }>('/api/teacher/questions');
        return response.questions;
      } catch (err) {
        console.warn('Secure question fetch failed; falling back to mock data.', err);
      }
    }
    await delay(300);
    return getItem<Question[]>(KEYS.QUESTIONS, []);
  },

  async createQuestion(question: Omit<Question, 'id' | 'createdAt'>): Promise<Question> {
    if (isSecureTeacherModeAvailable()) {
      const response = await teacherPost<{ question: Question }>('/api/teacher/questions', { action: 'create', question });
      return response.question;
    }
    await delay(400);
    const current = getItem<Question[]>(KEYS.QUESTIONS, []);
    const created: Question = { ...question, id: `q-${Date.now()}`, createdAt: new Date().toISOString() } as Question;
    setItem(KEYS.QUESTIONS, [created, ...current]);
    return created;
  },

  async updateQuestion(id: string, updates: Partial<Question>): Promise<Question> {
    if (isSecureTeacherModeAvailable()) {
      const response = await teacherPost<{ question: Question }>('/api/teacher/questions', { action: 'update', question: { id, ...updates } });
      return response.question;
    }
    await delay(400);
    const current = getItem<Question[]>(KEYS.QUESTIONS, []);
    let updatedObj: Question | null = null;
    const updated = current.map(item => item.id === id ? (updatedObj = { ...item, ...updates } as Question) : item);
    if (!updatedObj) throw new Error('Question not found for update');
    setItem(KEYS.QUESTIONS, updated);
    return updatedObj;
  },

  async deleteQuestion(id: string): Promise<boolean> {
    if (isSecureTeacherModeAvailable()) {
      await teacherPost('/api/teacher/questions', { action: 'delete', id });
      return true;
    }
    await delay(300);
    const current = getItem<Question[]>(KEYS.QUESTIONS, []);
    setItem(KEYS.QUESTIONS, current.filter(item => item.id !== id));
    return true;
  },

  async uploadQuestionImage(questionId: string, base64OrFile: any): Promise<string> {
    await delay(800);
    return 'https://images.unsplash.com/photo-1543128639-4cb7e6eeef1b?q=80&w=400&auto=format&fit=crop';
  }
};

export const examService = {
  async getExams(): Promise<Exam[]> {
    if (isSecureTeacherModeAvailable()) {
      try {
        const response = await teacherGet<{ exams: Exam[] }>('/api/teacher/exams');
        return response.exams;
      } catch (err) {
        console.warn('Secure exam fetch failed; falling back to mock data.', err);
      }
    }
    await delay(300);
    return getItem<Exam[]>(KEYS.EXAMS, []);
  },

  async createExam(exam: Omit<Exam, 'id' | 'createdAt' | 'examCode'>): Promise<Exam> {
    if (isSecureTeacherModeAvailable()) {
      const response = await teacherPost<{ exam: Exam }>('/api/teacher/exams', { action: 'create', exam });
      return response.exam;
    }
    await delay(500);
    const current = getItem<Exam[]>(KEYS.EXAMS, []);
    const alphNum = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += alphNum.charAt(Math.floor(Math.random() * alphNum.length));
    const created: Exam = { ...exam, id: `e-${Date.now()}`, examCode: code, createdAt: new Date().toISOString() } as Exam;
    setItem(KEYS.EXAMS, [created, ...current]);
    return created;
  },

  async updateExam(id: string, updates: Partial<Exam>): Promise<Exam> {
    if (isSecureTeacherModeAvailable()) {
      const response = await teacherPost<{ exam: Exam }>('/api/teacher/exams', { action: 'update', id, exam: { id, ...updates } });
      return response.exam;
    }
    await delay(400);
    const current = getItem<Exam[]>(KEYS.EXAMS, []);
    let updatedObj: Exam | null = null;
    const updated = current.map(item => item.id === id ? (updatedObj = { ...item, ...updates } as Exam) : item);
    if (!updatedObj) throw new Error('Exam not found for update');
    setItem(KEYS.EXAMS, updated);
    return updatedObj;
  },

  async deleteExam(id: string): Promise<boolean> {
    if (isSecureTeacherModeAvailable()) {
      await teacherPost('/api/teacher/exams', { action: 'delete', id });
      return true;
    }
    await delay(300);
    const current = getItem<Exam[]>(KEYS.EXAMS, []);
    setItem(KEYS.EXAMS, current.filter(item => item.id !== id));
    return true;
  },

  async generateExamDraft(subject: string, grade: string, settings: any): Promise<Exam> {
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
      teacherId: 't-1',
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
    return this.createExam(draft);
  },

  async publishExam(id: string): Promise<Exam> {
    return this.updateExam(id, { status: 'active' });
  },

  async getExamByCode(code: string): Promise<Exam | null> {
    await delay(500);
    const exams = getItem<Exam[]>(KEYS.EXAMS, []);
    return exams.find(e => e.examCode.toUpperCase() === code.toUpperCase().trim()) || null;
  },

  async getExamForStudent(examId: string): Promise<Exam> {
    await delay(300);
    const exams = getItem<Exam[]>(KEYS.EXAMS, []);
    const match = exams.find(e => e.id === examId);
    if (!match) throw new Error('Exam not found');
    return match;
  },

  async startStudentExam(examCode: string, studentName: string, nationalId: string): Promise<Submission> {
    await delay(600);
    const exams = getItem<Exam[]>(KEYS.EXAMS, []);
    const exam = exams.find(e => e.examCode.toUpperCase() === examCode.toUpperCase().trim());
    if (!exam) throw new Error('آزمونی با این کد رهگیری پیدا نشد.');
    const submissions = getItem<Submission[]>(KEYS.SUBMISSIONS, []);
    const existing = submissions.find(s => s.examId === exam.id && s.nationalId === nationalId);
    if (existing) return existing;
    const maxScore = exam.questions.reduce((sum, q) => sum + q.points, 0);
    const newSubmission: Submission = { id: `sub-${Date.now()}`, examId: exam.id, examCode: exam.examCode, studentId: `s-stu-${Date.now()}`, studentName, nationalId, startedAt: new Date().toISOString(), status: 'ongoing', score: 0, maxScore, answers: [] };
    setItem(KEYS.SUBMISSIONS, [newSubmission, ...submissions]);
    return newSubmission;
  },

  async saveStudentAnswer(submissionId: string, questionId: string, answer: any): Promise<Submission> {
    const submissions = getItem<Submission[]>(KEYS.SUBMISSIONS, []);
    let updatedSubmission: Submission | null = null;
    const updated = submissions.map(sub => {
      if (sub.id === submissionId) {
        const answersFiltered = sub.answers.filter(a => a.questionId !== questionId);
        updatedSubmission = { ...sub, answers: [...answersFiltered, { questionId, answer }] };
        return updatedSubmission;
      }
      return sub;
    });
    if (!updatedSubmission) throw new Error('Submission state index out of bounds');
    setItem(KEYS.SUBMISSIONS, updated);
    return updatedSubmission;
  },

  async submitExam(submissionId: string): Promise<Submission> {
    await delay(800);
    const submissions = getItem<Submission[]>(KEYS.SUBMISSIONS, []);
    const submission = submissions.find(s => s.id === submissionId);
    if (!submission) throw new Error('Submission not found');
    const updatedSubValue: Submission = { ...submission, status: 'submitted', submittedAt: new Date().toISOString() };
    setItem(KEYS.SUBMISSIONS, submissions.map(item => item.id === submissionId ? updatedSubValue : item));
    return updatedSubValue;
  }
};

export const gradingService = {
  /**
   * Fetches submission answered sheets.
   */
  async getSubmissions(examId?: string): Promise<Submission[]> {
    await delay(300);
    const subs = getItem<Submission[]>(KEYS.SUBMISSIONS, []);
    if (examId) {
      return subs.filter(s => s.examId === examId);
    }
    return subs;
  },

  /**
   * Forces manual auto grade.
   */
  async autoGradeSubmission(submissionId: string): Promise<Submission> {
    return examService.submitExam(submissionId);
  },

  /**
   * Updates scoring of a single manual question from teacher interface.
   */
  async updateManualGrade(submissionId: string, questionId: string, scoreGained: number, comment = ''): Promise<Submission> {
    const subs = getItem<Submission[]>(KEYS.SUBMISSIONS, []);
    let updatedSub: Submission | null = null;
    
    const updated = subs.map(sub => {
      if (sub.id === submissionId) {
        const updatedAns = sub.answers.map(ans => {
          if (ans.questionId === questionId) {
            return {
              ...ans,
              scoreGained,
              teacherComment: comment,
              isCorrect: scoreGained > 0
            };
          }
          return ans;
        });

        // Recalculate full scorecard
        const newScore = updatedAns.reduce((sum, item) => sum + (item.scoreGained || 0), 0);
        
        updatedSub = {
          ...sub,
          answers: updatedAns,
          score: Number(newScore.toFixed(2))
        };
        return updatedSub;
      }
      return sub;
    });

    if (!updatedSub) throw new Error('Submission id out of scope');
    setItem(KEYS.SUBMISSIONS, updated);
    return updatedSub;
  },

  /**
   * Finalizes the submission grading and updates status to graded.
   */
  async finalizeGrade(submissionId: string): Promise<Submission> {
    await delay(500);
    const subs = getItem<Submission[]>(KEYS.SUBMISSIONS, []);
    let updatedSub: Submission | null = null;

    const updated = subs.map(sub => {
      if (sub.id === submissionId) {
        updatedSub = {
          ...sub,
          status: 'graded',
          gradedBy: 'حمیدرضا علیزاده',
          gradedAt: new Date().toISOString()
        };
        return updatedSub;
      }
      return sub;
    });

    if (!updatedSub) throw new Error('Submission not found for final grade updates');
    setItem(KEYS.SUBMISSIONS, updated);
    return updatedSub;
  }
};
