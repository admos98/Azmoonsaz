export interface Teacher {
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
  status?: 'active' | 'suspended' | 'examining';
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
