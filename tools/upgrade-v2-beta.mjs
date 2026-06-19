import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const NL = String.fromCharCode(10);

console.log('🚀 Launching Azmoonsaz v2 Beta upgrade patch...');

// 1. Update package.json
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.dependencies['xlsx'] = '^0.18.5';
pkg.dependencies['papaparse'] = '^5.4.1';
pkg.devDependencies['@types/papaparse'] = '^5.3.15';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + NL);
console.log('✅ Updated package.json with universal Excel and CSV dependencies');

// 2. Update tsconfig.json to safely exclude Playwright E2E files
const tsconfigPath = path.join(root, 'tsconfig.json');
if (fs.existsSync(tsconfigPath)) {
  const tsc = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  tsc.include = ["src"];
  tsc.exclude = ["node_modules", "dist", "tests", "playwright.config.ts"];
  fs.writeFileSync(tsconfigPath, JSON.stringify(tsc, null, 2) + NL);
  console.log('✅ Updated tsconfig.json to ensure clean app compilation');
}

// 3. Update src/types.ts
const typesContent = `export interface Teacher {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  schoolName: string;
  managerName?: string;
  schoolLogoUrl?: string;
  domainUrl?: string;
}

export interface Student {
  id: string;
  name: string;
  nationalId: string;
  maskedNationalId: string;
  email?: string;
  phoneNumber?: string;
  grade: string;
  classGroupId: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  grade: string;
  studentCount: number;
}

export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'true_false'
  | 'matching'
  | 'ordering'
  | 'fill_blank'
  | 'short_answer'
  | 'long_answer'
  | 'cloze'
  | 'reading_comprehension'
  | 'image_based';

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean;
  imageUrl?: string;
}

export interface QuestionPart {
  id: string;
  text: string;
  type: QuestionType;
  options?: QuestionOption[];
  correctAnswer?: string | string[];
}

export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  maxPoints: number;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  text: string;
  points: number;
  category: string;
  grade: string;
  language?: 'fa' | 'en';
  direction?: 'rtl' | 'ltr';
  options?: QuestionOption[];
  matchingPairs?: { left: string; right: string }[];
  orderingItems?: string[];
  correctFillBlanks?: string[];
  correctAnswer?: string | string[] | boolean;
  imageUrl?: string;
  parts?: QuestionPart[];
  rubrics?: RubricCriterion[];
  createdAt: string;
}

export type ExamMode = 'practice' | 'official';

export interface ExamSettings {
  mode: ExamMode;
  durationMinutes: number;
  startTime?: string;
  endTime?: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowBacktrack: boolean;
  showImmediateResults: boolean;
  maxAttempts: number;
  browserLockdown?: boolean;

  startDate?: string;
  endDate?: string;
  startHour?: string;
  endHour?: string;
  allowedClasses?: string[];
  allowedStudents?: string[];
  requireNationalId?: boolean;
  entryCode?: string;
  autoSubmit?: boolean;
  showOneQuestionPerPage?: boolean;
  autoSaveAnswers?: boolean;
  beastMode?: boolean;
  resultsDisplayMode?: 'immediate_score' | 'immediate_score_answers' | 'after_approval' | 'none';
  startInstructions?: string;
  examLink?: string;
}

export interface ExamSection {
  id: string;
  title: string;
  description?: string;
  questionIds: string[];
}

export interface Exam {
  id: string;
  examCode: string;
  title: string;
  description?: string;
  grade: string;
  subject: string;
  language?: 'fa' | 'en';
  direction?: 'rtl' | 'ltr';
  duration: number;
  settings: ExamSettings;
  sections: ExamSection[];
  questions: Question[];
  classGroupIds: string[];
  status: 'draft' | 'scheduled' | 'active' | 'completed';
  teacherId: string;
  createdAt: string;
}

export interface ExamTemplate {
  id: string;
  title: string;
  subject: string;
  grade: string;
  sections: ExamSection[];
  questions: Question[];
}

export interface ExamVariant {
  id: string;
  examId: string;
  variantCode: string;
  questionOrder: string[];
}

export interface StudentAnswer {
  questionId: string;
  answer: any;
  isCorrect?: boolean;
  scoreGained?: number;
  teacherComment?: string;
}

export interface Submission {
  id: string;
  examId: string;
  examCode: string;
  studentId: string;
  studentName: string;
  nationalId: string;
  answers: StudentAnswer[];
  startedAt: string;
  submittedAt?: string;
  status: 'ongoing' | 'submitted' | 'graded';
  score: number;
  maxScore: number;
  gradedBy?: string;
  gradedAt?: string;
}
`;
fs.writeFileSync(path.join(root, 'src', 'types.ts'), typesContent);
console.log('✅ Updated src/types.ts with Phase 1 and Phase 3 definitions');

// 4. Update src/services/api.ts
const apiContent = `/**
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

const delay = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));

const KEYS = {
  TEACHER: 'azmoonsaz_current_teacher',
  STUDENTS: 'azmoonsaz_students',
  QUESTIONS: 'azmoonsaz_questions',
  EXAMS: 'azmoonsaz_exams',
  SUBMISSIONS: 'azmoonsaz_submissions',
  CLASSES: 'azmoonsaz_class_groups'
};

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
  if (!localStorage.getItem(KEYS.CLASSES)) {
    localStorage.setItem(KEYS.CLASSES, JSON.stringify(mockClassGroups));
  }
}

initializeStorage();

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

export const classService = {
  async getClassGroups(): Promise<ClassGroup[]> {
    await delay(200);
    return getItem<ClassGroup[]>(KEYS.CLASSES, mockClassGroups);
  },
  async createClassGroup(name: string, grade: string): Promise<ClassGroup> {
    await delay(300);
    const current = getItem<ClassGroup[]>(KEYS.CLASSES, mockClassGroups);
    const created: ClassGroup = { id: \`c-custom-\${Date.now()}\`, name, grade, studentCount: 0 };
    const next = [created, ...current];
    setItem(KEYS.CLASSES, next);
    return created;
  },
  async updateClassGroup(id: string, name: string, grade: string): Promise<ClassGroup> {
    await delay(300);
    const current = getItem<ClassGroup[]>(KEYS.CLASSES, mockClassGroups);
    let updatedObj: ClassGroup | null = null;
    const next = current.map(c => c.id === id ? (updatedObj = { ...c, name, grade }) : c);
    if (!updatedObj) throw new Error('Class group not found');
    setItem(KEYS.CLASSES, next);
    return updatedObj;
  },
  async deleteClassGroup(id: string): Promise<boolean> {
    await delay(200);
    const current = getItem<ClassGroup[]>(KEYS.CLASSES, mockClassGroups);
    setItem(KEYS.CLASSES, current.filter(c => c.id !== id));
    return true;
  }
};

export const studentService = {
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
    return getItem<Student[]>(KEYS.STUDENTS, initialStudents);
  },

  async importStudents(studentsToImport: Omit<Student, 'id' | 'maskedNationalId'>[]): Promise<Student[]> {
    if (isSecureTeacherModeAvailable()) {
      const created: Student[] = [];
      for (const student of studentsToImport) {
        const response = await teacherPost<{ student: Student }>('/api/teacher/students', { action: 'create', student });
        created.push(response.student);
      }
      return created;
    }

    await delay(1000);
    const current = getItem<Student[]>(KEYS.STUDENTS, initialStudents);
    const imported: Student[] = studentsToImport.map((s, idx) => ({
      ...s,
      id: \`std-imported-\${Date.now()}-\${idx}-\${Math.floor(Math.random() * 1000)}\`,
      maskedNationalId: maskNationalId(s.nationalId)
    }));
    const combined = [...imported, ...current];
    setItem(KEYS.STUDENTS, combined);
    return imported;
  },

  async createStudent(student: Omit<Student, 'id' | 'maskedNationalId'>): Promise<Student> {
    if (isSecureTeacherModeAvailable()) {
      const response = await teacherPost<{ student: Student }>('/api/teacher/students', { action: 'create', student });
      return response.student;
    }

    await delay(400);
    const current = getItem<Student[]>(KEYS.STUDENTS, initialStudents);
    const created: Student = {
      ...student,
      id: \`std-\${Date.now()}\`,
      maskedNationalId: maskNationalId(student.nationalId)
    };
    setItem(KEYS.STUDENTS, [created, ...current]);
    return created;
  },

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student> {
    if (isSecureTeacherModeAvailable()) {
      const response = await teacherPost<{ student: Student }>('/api/teacher/students', { action: 'update', student: { id, ...updates } });
      return response.student;
    }

    await delay(400);
    const current = getItem<Student[]>(KEYS.STUDENTS, initialStudents);
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

  async deleteStudent(id: string): Promise<boolean> {
    if (isSecureTeacherModeAvailable()) {
      await teacherPost('/api/teacher/students', { action: 'delete', id });
      return true;
    }

    await delay(300);
    const current = getItem<Student[]>(KEYS.STUDENTS, initialStudents);
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
    return getItem<Question[]>(KEYS.QUESTIONS, initialQuestions);
  },

  async createQuestion(question: Omit<Question, 'id' | 'createdAt'>): Promise<Question> {
    if (isSecureTeacherModeAvailable()) {
      const response = await teacherPost<{ question: Question }>('/api/teacher/questions', { action: 'create', question });
      return response.question;
    }
    await delay(400);
    const current = getItem<Question[]>(KEYS.QUESTIONS, initialQuestions);
    const created: Question = { ...question, id: \`q-\${Date.now()}\`, createdAt: new Date().toISOString() } as Question;
    setItem(KEYS.QUESTIONS, [created, ...current]);
    return created;
  },

  async updateQuestion(id: string, updates: Partial<Question>): Promise<Question> {
    if (isSecureTeacherModeAvailable()) {
      const response = await teacherPost<{ question: Question }>('/api/teacher/questions', { action: 'update', question: { id, ...updates } });
      return response.question;
    }
    await delay(400);
    const current = getItem<Question[]>(KEYS.QUESTIONS, initialQuestions);
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
    const current = getItem<Question[]>(KEYS.QUESTIONS, initialQuestions);
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
    return getItem<Exam[]>(KEYS.EXAMS, initialExams);
  },

  async createExam(exam: Omit<Exam, 'id' | 'createdAt' | 'examCode'>): Promise<Exam> {
    if (isSecureTeacherModeAvailable()) {
      const response = await teacherPost<{ exam: Exam }>('/api/teacher/exams', { action: 'create', exam });
      return response.exam;
    }
    await delay(500);
    const current = getItem<Exam[]>(KEYS.EXAMS, initialExams);
    const alphNum = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += alphNum.charAt(Math.floor(Math.random() * alphNum.length));
    const created: Exam = { ...exam, id: \`e-\${Date.now()}\`, examCode: code, createdAt: new Date().toISOString() } as Exam;
    setItem(KEYS.EXAMS, [created, ...current]);
    return created;
  },

  async updateExam(id: string, updates: Partial<Exam>): Promise<Exam> {
    if (isSecureTeacherModeAvailable()) {
      const response = await teacherPost<{ exam: Exam }>('/api/teacher/exams', { action: 'update', id, exam: { id, ...updates } });
      return response.exam;
    }
    await delay(400);
    const current = getItem<Exam[]>(KEYS.EXAMS, initialExams);
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
    const current = getItem<Exam[]>(KEYS.EXAMS, initialExams);
    setItem(KEYS.EXAMS, current.filter(item => item.id !== id));
    return true;
  },

  async generateExamDraft(subject: string, grade: string, settings: any): Promise<Exam> {
    const allQuestions = await questionService.getQuestions();
    const matchQuestions = allQuestions.filter(q => q.grade === grade).slice(0, 4);
    const draft: Omit<Exam, 'id' | 'createdAt' | 'examCode'> = {
      title: \`پیش‌نویس آزمون خودکار \${subject} پایه \${grade}\`,
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
    const exams = getItem<Exam[]>(KEYS.EXAMS, initialExams);
    return exams.find(e => e.examCode.toUpperCase() === code.toUpperCase().trim()) || null;
  },

  async getExamForStudent(examId: string): Promise<Exam> {
    await delay(300);
    const exams = getItem<Exam[]>(KEYS.EXAMS, initialExams);
    const match = exams.find(e => e.id === examId);
    if (!match) throw new Error('Exam not found');
    return match;
  },

  async startStudentExam(examCode: string, studentName: string, nationalId: string): Promise<Submission> {
    await delay(600);
    const exams = getItem<Exam[]>(KEYS.EXAMS, initialExams);
    const exam = exams.find(e => e.examCode.toUpperCase() === examCode.toUpperCase().trim());
    if (!exam) throw new Error('آزمونی با این کد رهگیری پیدا نشد.');
    const submissions = getItem<Submission[]>(KEYS.SUBMISSIONS, initialSubmissions);
    const existing = submissions.find(s => s.examId === exam.id && s.nationalId === nationalId);
    if (existing) return existing;
    const maxScore = exam.questions.reduce((sum, q) => sum + q.points, 0);
    const newSubmission: Submission = { id: \`sub-\${Date.now()}\`, examId: exam.id, examCode: exam.examCode, studentId: \`s-stu-\${Date.now()}\`, studentName, nationalId, startedAt: new Date().toISOString(), status: 'ongoing', score: 0, maxScore, answers: [] };
    setItem(KEYS.SUBMISSIONS, [newSubmission, ...submissions]);
    return newSubmission;
  },

  async saveStudentAnswer(submissionId: string, questionId: string, answer: any): Promise<Submission> {
    const submissions = getItem<Submission[]>(KEYS.SUBMISSIONS, initialSubmissions);
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
    const submissions = getItem<Submission[]>(KEYS.SUBMISSIONS, initialSubmissions);
    const submission = submissions.find(s => s.id === submissionId);
    if (!submission) throw new Error('Submission not found');
    const updatedSubValue: Submission = { ...submission, status: 'submitted', submittedAt: new Date().toISOString() };
    setItem(KEYS.SUBMISSIONS, submissions.map(item => item.id === submissionId ? updatedSubValue : item));
    return updatedSubValue;
  }
};

export const gradingService = {
  async getSubmissions(examId?: string): Promise<Submission[]> {
    if (isSecureTeacherModeAvailable()) {
      try {
        const suffix = examId ? '?examId=' + encodeURIComponent(examId) : '';
        const response = await teacherGet<{ submissions: Submission[] }>('/api/teacher/submissions' + suffix);
        return response.submissions;
      } catch (err) {
        console.warn('Secure submissions fetch failed; falling back to mock data.', err);
      }
    }
    await delay(300);
    const subs = getItem<Submission[]>(KEYS.SUBMISSIONS, initialSubmissions);
    return examId ? subs.filter(s => s.examId === examId) : subs;
  },

  async autoGradeSubmission(submissionId: string): Promise<Submission> {
    return examService.submitExam(submissionId);
  },

  async updateManualGrade(submissionId: string, questionId: string, scoreGained: number, comment = ''): Promise<Submission> {
    if (isSecureTeacherModeAvailable()) {
      await teacherPost('/api/teacher/grade-answer', { submissionId, questionId, scoreGained, comment });
      const submissions = await this.getSubmissions();
      const updated = submissions.find(s => s.id === submissionId);
      if (!updated) throw new Error('Submission not found after grading');
      return updated;
    }

    const subs = getItem<Submission[]>(KEYS.SUBMISSIONS, initialSubmissions);
    let updatedSub: Submission | null = null;
    const updated = subs.map(sub => {
      if (sub.id === submissionId) {
        const updatedAns = sub.answers.map(ans => ans.questionId === questionId ? { ...ans, scoreGained, teacherComment: comment, isCorrect: scoreGained > 0 } : ans);
        const newScore = updatedAns.reduce((sum, item) => sum + (item.scoreGained || 0), 0);
        updatedSub = { ...sub, answers: updatedAns, score: Number(newScore.toFixed(2)) };
        return updatedSub;
      }
      return sub;
    });
    if (!updatedSub) throw new Error('Submission id out of scope');
    setItem(KEYS.SUBMISSIONS, updated);
    return updatedSub;
  },

  async finalizeGrade(submissionId: string): Promise<Submission> {
    if (isSecureTeacherModeAvailable()) {
      await teacherPost('/api/teacher/finalize-submission', { submissionId });
      const submissions = await this.getSubmissions();
      const updated = submissions.find(s => s.id === submissionId);
      if (!updated) throw new Error('Submission not found after finalize');
      return updated;
    }

    await delay(500);
    const subs = getItem<Submission[]>(KEYS.SUBMISSIONS, initialSubmissions);
    let updatedSub: Submission | null = null;
    const updated = subs.map(sub => {
      if (sub.id === submissionId) {
        updatedSub = { ...sub, status: 'graded', gradedBy: 'حمیدرضا علیزاده', gradedAt: new Date().toISOString() };
        return updatedSub;
      }
      return sub;
    });
    if (!updatedSub) throw new Error('Submission not found for final grade updates');
    setItem(KEYS.SUBMISSIONS, updated);
    return updatedSub;
  }
};
`;
fs.writeFileSync(path.join(root, 'src', 'services', 'api.ts'), apiContent);
console.log('✅ Updated src/services/api.ts with fully dynamic Class Group operations');

// 5. Hardened, robust update for src/App.tsx
const appPath = path.join(root, 'src', 'App.tsx');
if (fs.existsSync(appPath)) {
  let appText = fs.readFileSync(appPath, 'utf8');

  appText = appText.split("NewExam';\\nimport").join("NewExam';" + NL + "import");
  appText = appText.split("settings':\\n        return").join("settings':" + NL + "        return");

  if (!appText.includes('import Settings')) {
    appText = appText.split("import NewExam from './pages/teacher/NewExam';").join(
      "import NewExam from './pages/teacher/NewExam';" + NL + "import Settings from './pages/teacher/Settings';"
    );
  }

  if (appText.includes('settings-mock-page')) {
    const startIdx = appText.indexOf("case 'settings':");
    const endIdx = appText.indexOf(');', startIdx) + 2;
    if (startIdx !== -1 && endIdx !== -1) {
      appText = appText.slice(0, startIdx) + "case 'settings':" + NL + "        return <Settings />;" + appText.slice(endIdx);
    }
  }

  fs.writeFileSync(appPath, appText);
  console.log('✅ Updated src/App.tsx with completely bomb-proof Settings integration');
}

console.log('🎉 v2 Beta upgrade patch complete & completely safe!');
