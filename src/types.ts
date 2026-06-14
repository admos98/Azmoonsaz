/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Teacher {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  schoolName: string;
}

export interface Student {
  id: string;
  name: string;
  nationalId: string; // Iran style, e.g. "0012345678"
  maskedNationalId: string; // masked for security, e.g. "001***5678"
  email?: string;
  phoneNumber?: string;
  grade: string; // e.g. "Grade 7", "Grade 8", "Grade 9" - in Persian, e.g., "هفتم"
  classGroupId: string;
}

export interface ClassGroup {
  id: string;
  name: string; // e.g. "کلاس ۷۰۱", "کلاس ۸۰۲"
  grade: string; // e.g. "هفتم", "هشتم"
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
  correctAnswer?: string | string[]; // For fill in the blanks or sub-questions
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
  title: string; // A short descriptive title
  text: string;  // The actual question text (Markdown supported)
  points: number;
  category: string; // e.g. "ریاضی", "فیزیک", "ادبیات"
  grade: string;    // e.g. "هفتم", "هشتم", "نهم"
  options?: QuestionOption[]; // for choice, image_based, etc.
  matchingPairs?: { left: string; right: string }[]; // for matching
  orderingItems?: string[]; // for ordering
  correctFillBlanks?: string[]; // for fill_blank
  correctAnswer?: string | string[] | boolean; // general correct answer
  imageUrl?: string; // for image_based questions
  parts?: QuestionPart[]; // for cloze or reading_comprehension
  rubrics?: RubricCriterion[]; // for long_answer evaluation
  createdAt: string;
}

export type ExamMode = 'practice' | 'official';

export interface ExamSettings {
  mode: ExamMode;
  durationMinutes: number;
  startTime?: string; // ISO timestamp
  endTime?: string; // ISO timestamp
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowBacktrack: boolean;
  showImmediateResults: boolean;
  maxAttempts: number;
  browserLockdown?: boolean; // Secure mode

  // Extended fields
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
  title: string; // e.g. "بخش اول: سوالات عمومی"
  description?: string;
  questionIds: string[];
}

export interface Exam {
  id: string;
  examCode: string; // e.g. "MATH-102" or unique code "8AF39"
  title: string;
  description?: string;
  grade: string;
  subject: string;
  duration: number; // in minutes (duplicated for convenience or template reference)
  settings: ExamSettings;
  sections: ExamSection[];
  questions: Question[]; // Embedded or resolved list of questions
  classGroupIds: string[]; // Assigned classes
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
  variantCode: string; // A, B, C...
  questionOrder: string[]; // randomized question IDs
}

export interface StudentAnswer {
  questionId: string;
  // Can be a choice ID, true/false, list of ordered items, map of matching left-to-right, text for short/long, or parts
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
  score: number; // Total points scored
  maxScore: number; // Maximum possible points
  gradedBy?: string;
  gradedAt?: string;
}
