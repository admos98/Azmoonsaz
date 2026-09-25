import { useEffect, useState } from 'react';
import { logger } from '../lib/logger';
import { ClassGroup, Exam, Question, Student, Submission } from '../types';
import {
  classService,
  examService,
  gradingService,
  questionService,
  studentService,
} from '../services/api';

export function useDashboardData() {
  const [students, setStudents] = useState<Student[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [nextStudents, nextExams, nextSubmissions, nextClasses, nextQuestions] =
          await Promise.all([
            studentService.getStudents(),
            examService.getExams(),
            gradingService.getSubmissions(),
            classService.getClassGroups(),
            questionService.getQuestions(),
          ]);
        if (!active) return;
        setStudents(nextStudents);
        setExams(nextExams);
        setSubmissions(nextSubmissions);
        setClassGroups(nextClasses);
        setQuestions(nextQuestions);
      } catch (error) {
        logger.error('Error loading dashboard:', error);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return {
    students,
    exams,
    submissions,
    classGroups,
    questions,
    loading,
    addImportedStudents(imported: Student[]) {
      setStudents((current) => [...imported, ...current]);
    },
  };
}
