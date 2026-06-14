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
import { teacherGet, teacherPost, isSecureTeacherModeAvailable } from './teacherApi';

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
      const token = await import('./teacherApi').then(m => m.getTeacherAccessToken());
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
  /**
   * Fetches all questions from the question bank.
   */
  async getQuestions(): Promise<Question[]> {
    await delay(300);
    return getItem<Question[]>(KEYS.QUESTIONS, []);
  },

  /**
   * Creates a new question in the system.
   */
  async createQuestion(question: Omit<Question, 'id' | 'createdAt'>): Promise<Question> {
    await delay(400);
    const current = getItem<Question[]>(KEYS.QUESTIONS, []);
    
    const created: Question = {
      ...question,
      id: `q-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    setItem(KEYS.QUESTIONS, [created, ...current]);
    return created;
  },

  /**
   * Updates a question.
   */
  async updateQuestion(id: string, updates: Partial<Question>): Promise<Question> {
    await delay(400);
    const current = getItem<Question[]>(KEYS.QUESTIONS, []);
    
    let updatedObj: Question | null = null;
    const updated = current.map(item => {
      if (item.id === id) {
        updatedObj = { ...item, ...updates } as Question;
        return updatedObj;
      }
      return item;
    });

    if (!updatedObj) {
      throw new Error('Question not found for update');
    }

    setItem(KEYS.QUESTIONS, updated);
    return updatedObj;
  },

  /**
   * Deletes a question from the question bank.
   */
  async deleteQuestion(id: string): Promise<boolean> {
    await delay(300);
    const current = getItem<Question[]>(KEYS.QUESTIONS, []);
    const filtered = current.filter(item => item.id !== id);
    setItem(KEYS.QUESTIONS, filtered);
    return true;
  },

  /**
   * Simulates image uploaded to Cloud Storage with descriptive questions.
   * Integration point: Replace with Supabase storage upload, e.g. `supabase.storage.from('questions').upload(...)`
   */
  async uploadQuestionImage(questionId: string, base64OrFile: any): Promise<string> {
    await delay(800);
    return 'https://images.unsplash.com/photo-1543128639-4cb7e6eeef1b?q=80&w=400&auto=format&fit=crop';
  }
};

export const examService = {
  /**
   * Fetches all registered exams.
   */
  async getExams(): Promise<Exam[]> {
    await delay(300);
    return getItem<Exam[]>(KEYS.EXAMS, []);
  },

  /**
   * Creates a new exam sheet.
   */
  async createExam(exam: Omit<Exam, 'id' | 'createdAt' | 'examCode'>): Promise<Exam> {
    await delay(500);
    const current = getItem<Exam[]>(KEYS.EXAMS, []);
    
    // Generate a random 5 digit short alpha-numeric code
    const alphNum = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += alphNum.charAt(Math.floor(Math.random() * alphNum.length));
    }

    const created: Exam = {
      ...exam,
      id: `e-${Date.now()}`,
      examCode: code,
      createdAt: new Date().toISOString()
    };

    setItem(KEYS.EXAMS, [created, ...current]);
    return created;
  },

  /**
   * Updates an existing exam properties.
   */
  async updateExam(id: string, updates: Partial<Exam>): Promise<Exam> {
    await delay(400);
    const current = getItem<Exam[]>(KEYS.EXAMS, []);
    
    let updatedObj: Exam | null = null;
    const updated = current.map(item => {
      if (item.id === id) {
        updatedObj = { ...item, ...updates } as Exam;
        return updatedObj;
      }
      return item;
    });

    if (!updatedObj) {
      throw new Error('Exam not found for update');
    }

    setItem(KEYS.EXAMS, updated);
    return updatedObj;
  },

  /**
   * Deletes an exam.
   */
  async deleteExam(id: string): Promise<boolean> {
    await delay(300);
    const current = getItem<Exam[]>(KEYS.EXAMS, []);
    const filtered = current.filter(item => item.id !== id);
    setItem(KEYS.EXAMS, filtered);
    return true;
  },

  /**
   * Simulates generator drafting of AI or template driven exams based on grade and subject.
   */
  async generateExamDraft(subject: string, grade: string, settings: any): Promise<Exam> {
    await delay(1200); // Simulate processing rules and questions filtering
    
    // Retrieve registered questions matching class parameters
    const allQuestions = getItem<Question[]>(KEYS.QUESTIONS, []);
    const matchQuestions = allQuestions.filter(q => q.grade === grade).slice(0, 4);
    
    const draft: Omit<Exam, 'id' | 'createdAt' | 'examCode'> = {
      title: `پیش‌نویس آزمون خودکار ${subject} پایه ${grade}`,
      description: 'آزمون تولید شده به صورت الگوریتمی بر مبنای بودجه‌بندی سالانه دروس مپ شده صادر گردید.',
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
      sections: [
        {
          id: 'draft-sec-1',
          title: 'سوالات طراحی شده بر خط',
          questionIds: matchQuestions.map(q => q.id)
        }
      ],
      questions: matchQuestions
    };

    return this.createExam(draft);
  },

  /**
   * Publishes a draft exam.
   */
  async publishExam(id: string): Promise<Exam> {
    return this.updateExam(id, { status: 'active' });
  },

  /**
   * Fetches an exam by its unique entrance code (for student portals).
   */
  async getExamByCode(code: string): Promise<Exam | null> {
    await delay(500);
    const exams = getItem<Exam[]>(KEYS.EXAMS, []);
    const match = exams.find(e => e.examCode.toUpperCase() === code.toUpperCase().trim());
    return match || null;
  },

  /**
   * Resolves exams for students.
   */
  async getExamForStudent(examId: string): Promise<Exam> {
    await delay(300);
    const exams = getItem<Exam[]>(KEYS.EXAMS, []);
    const match = exams.find(e => e.id === examId);
    if (!match) throw new Error('Exam not found');
    return match;
  },

  /**
   * Simulates entrance of a student in a target exam, creating a submission.
   */
  async startStudentExam(examCode: string, studentName: string, nationalId: string): Promise<Submission> {
    await delay(600);
    const exams = getItem<Exam[]>(KEYS.EXAMS, []);
    const exam = exams.find(e => e.examCode.toUpperCase() === examCode.toUpperCase().trim());
    if (!exam) {
      throw new Error('آزمونی با این کد رهگیری پیدا نشد.');
    }

    // Check if student submission already exists
    const submissions = getItem<Submission[]>(KEYS.SUBMISSIONS, []);
    const existing = submissions.find(s => s.examId === exam.id && s.nationalId === nationalId);
    
    if (existing) {
      if (existing.status !== 'ongoing') {
        throw new Error('شما قبلاً در این آزمون شرکت کرده و پاسخ‌برگ خود را نهایی ساخته‌اید.');
      }
      return existing;
    }

    // Determine total maximum score
    const maxScore = exam.questions.reduce((sum, q) => sum + q.points, 0);

    const newSubmission: Submission = {
      id: `sub-${Date.now()}`,
      examId: exam.id,
      examCode: exam.examCode,
      studentId: `s-stu-${Date.now()}`,
      studentName,
      nationalId,
      startedAt: new Date().toISOString(),
      status: 'ongoing',
      score: 0,
      maxScore,
      answers: []
    };

    setItem(KEYS.SUBMISSIONS, [newSubmission, ...submissions]);
    return newSubmission;
  },

  /**
   * Saves student's partial answer.
   */
  async saveStudentAnswer(submissionId: string, questionId: string, answer: any): Promise<Submission> {
    const submissions = getItem<Submission[]>(KEYS.SUBMISSIONS, []);
    
    let updatedSubmission: Submission | null = null;
    const updated = submissions.map(sub => {
      if (sub.id === submissionId) {
        // Exclude and append new answer
        const answersFiltered = sub.answers.filter(a => a.questionId !== questionId);
        const newAnswer: StudentAnswer = { questionId, answer };
        
        updatedSubmission = {
          ...sub,
          answers: [...answersFiltered, newAnswer]
        };
        return updatedSubmission;
      }
      return sub;
    });

    if (!updatedSubmission) {
      throw new Error('Submission state index out of bounds');
    }

    setItem(KEYS.SUBMISSIONS, updated);
    return updatedSubmission;
  },

  /**
   * Submits the student answer sheet for grading. Includes immediate auto-grading of objective parts!
   */
  async submitExam(submissionId: string): Promise<Submission> {
    await delay(800);
    const submissions = getItem<Submission[]>(KEYS.SUBMISSIONS, []);
    let submission = submissions.find(s => s.id === submissionId);
    if (!submission) throw new Error('Submission not found');

    const exams = getItem<Exam[]>(KEYS.EXAMS, []);
    const exam = exams.find(e => e.id === submission.examId);
    if (!exam) throw new Error('Exam specifications not found');

    // Run Auto Grading logic instantly
    const gradedAnswers = submission.answers.map(ans => {
      const q = exam.questions.find(item => item.id === ans.questionId);
      if (!q) return ans;

      const isDescriptive = q.type === 'long_answer' || q.type === 'short_answer';
      if (isDescriptive) {
        // Keep descriptive score in pending teacher states
        return ans;
      }

      // Exact matching rules for objective elements
      let scoreGained = 0;
      let isCorrect = false;

      if (q.type === 'single_choice' || q.type === 'true_false' || q.type === 'cloze' || q.type === 'image_based') {
        isCorrect = String(ans.answer) === String(q.correctAnswer);
        scoreGained = isCorrect ? q.points : 0;
      } else if (q.type === 'multiple_choice') {
        const stdAnsArr = Array.isArray(ans.answer) ? ans.answer.map(String).sort() : [];
        const correctAnswersArr = Array.isArray(q.correctAnswer) ? q.correctAnswer.map(String).sort() : [];
        
        isCorrect = stdAnsArr.length === correctAnswersArr.length && 
                    stdAnsArr.every((v, i) => v === correctAnswersArr[i]);
        
        // Handle partial scores if requested, but default to binary correct or half correct
        scoreGained = isCorrect ? q.points : 0;
      } else if (q.type === 'fill_blank') {
        const stdText = String(ans.answer).trim();
        const correctBlanks = q.correctFillBlanks || [];
        isCorrect = correctBlanks.some(item => item.trim() === stdText);
        scoreGained = isCorrect ? q.points : 0;
      } else if (q.type === 'ordering') {
        const jsonStd = JSON.stringify(ans.answer);
        const jsonCorrect = JSON.stringify(q.correctAnswer || q.orderingItems);
        isCorrect = jsonStd === jsonCorrect;
        scoreGained = isCorrect ? q.points : 0;
      } else if (q.type === 'matching') {
        // ans.answer: Record<string, string> connecting left to right
        const stdMap = ans.answer || {};
        const isMatchedCorrectly = (q.matchingPairs || []).every(pair => stdMap[pair.left] === pair.right);
        isCorrect = isMatchedCorrectly;
        scoreGained = isCorrect ? q.points : 0;
      }

      return {
        ...ans,
        isCorrect,
        scoreGained
      };
    });

    // Determine current cumulative auto score
    const totalAutoScore = gradedAnswers.reduce((sum, item) => sum + (item.scoreGained || 0), 0);

    const hasDescriptive = exam.questions.some(q => q.type === 'long_answer' || q.type === 'short_answer');

    const updatedSubValue: Submission = {
      ...submission,
      status: hasDescriptive ? 'submitted' : 'graded', // auto completed if no descriptive items!
      answers: gradedAnswers,
      score: totalAutoScore,
      submittedAt: new Date().toISOString()
    };

    const updatedCol = submissions.map(item => item.id === submissionId ? updatedSubValue : item);
    setItem(KEYS.SUBMISSIONS, updatedCol);
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
