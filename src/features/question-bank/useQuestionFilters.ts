/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Filter/sort/pagination state for the question bank + the filtered view.
 *
 * Extracted verbatim from src/pages/teacher/Questions.tsx. Owns the search
 * query, sort order, page size, all seven facet filters with their reset
 * functions, the URL read/write sync, and the filter→sort→paginate pipeline.
 */
import { useEffect, useRef, useState } from 'react';
import { usePersistentPreference } from '../../hooks/usePersistentPreference';
import { normalizePersianText } from '../../utils/persian';
import type { RichQuestion } from './types';

export function useQuestionFilters(questions: RichQuestion[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = usePersistentPreference<'newest' | 'oldest' | 'title'>(
    'questions:sort',
    'newest',
    (value): value is 'newest' | 'oldest' | 'title' =>
      value === 'newest' || value === 'oldest' || value === 'title',
  );
  const [pageSize, setPageSize] = usePersistentPreference<number>(
    'questions:page-size',
    20,
    (value): value is number => value === 10 || value === 20 || value === 50,
  );
  const [currentPage, setCurrentPage] = useState(1);

  // Filters state
  const [selectedGrade, setSelectedGrade, resetSelectedGrade] = usePersistentPreference(
    'questions:grade',
    'all',
  );
  const [selectedSubject, setSelectedSubject, resetSelectedSubject] = usePersistentPreference(
    'questions:subject',
    'all',
  );
  const [selectedSection, setSelectedSection, resetSelectedSection] = usePersistentPreference(
    'questions:section',
    'all',
  );
  const [selectedType, setSelectedType, resetSelectedType] = usePersistentPreference(
    'questions:type',
    'all',
  );
  const [selectedDifficulty, setSelectedDifficulty, resetSelectedDifficulty] =
    usePersistentPreference('questions:difficulty', 'all');
  const [selectedTag, setSelectedTag, resetSelectedTag] = usePersistentPreference(
    'questions:tag',
    'all',
  );
  const [selectedStatus, setSelectedStatus, resetSelectedStatus] = usePersistentPreference(
    'questions:status',
    'all',
  );
  const urlFiltersReady = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setIfPresent = (key: string, setter: (value: string) => void) => {
      const value = params.get(key);
      if (value) setter(value);
    };
    setIfPresent('q', setSearchQuery);
    setIfPresent('grade', setSelectedGrade);
    setIfPresent('subject', setSelectedSubject);
    setIfPresent('section', setSelectedSection);
    setIfPresent('type', setSelectedType);
    setIfPresent('difficulty', setSelectedDifficulty);
    setIfPresent('tag', setSelectedTag);
    setIfPresent('status', setSelectedStatus);
    const urlSort = params.get('sort');
    if (urlSort === 'newest' || urlSort === 'oldest' || urlSort === 'title') setSortOrder(urlSort);
    const urlPageSize = Number(params.get('pageSize'));
    if (urlPageSize === 10 || urlPageSize === 20 || urlPageSize === 50) setPageSize(urlPageSize);
    urlFiltersReady.current = true;
  }, [
    setPageSize,
    setSelectedDifficulty,
    setSelectedGrade,
    setSelectedSection,
    setSelectedStatus,
    setSelectedSubject,
    setSelectedTag,
    setSelectedType,
    setSortOrder,
  ]);

  useEffect(() => {
    if (!urlFiltersReady.current) return;
    const params = new URLSearchParams(window.location.search);
    const values: Record<string, string> = {
      q: searchQuery,
      grade: selectedGrade,
      subject: selectedSubject,
      section: selectedSection,
      type: selectedType,
      difficulty: selectedDifficulty,
      tag: selectedTag,
      status: selectedStatus,
      sort: sortOrder,
      pageSize: String(pageSize),
    };
    Object.entries(values).forEach(([key, value]) => {
      if (
        !value ||
        value === 'all' ||
        (key === 'sort' && value === 'newest') ||
        (key === 'pageSize' && value === '20')
      )
        params.delete(key);
      else params.set(key, value);
    });
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [
    pageSize,
    searchQuery,
    selectedDifficulty,
    selectedGrade,
    selectedSection,
    selectedStatus,
    selectedSubject,
    selectedTag,
    selectedType,
    sortOrder,
  ]);

  // Filter application pipeline
  const normalizedSearch = normalizePersianText(searchQuery);
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch =
      !normalizedSearch ||
      [q.title, q.text, q.category, ...(q.tags || [])].some((value) =>
        normalizePersianText(value).includes(normalizedSearch),
      );

    const matchesGrade = selectedGrade === 'all' || q.grade === selectedGrade;
    const matchesSubject = selectedSubject === 'all' || q.category === selectedSubject;
    const matchesSection = selectedSection === 'all' || q.section === selectedSection;
    const matchesType = selectedType === 'all' || q.type === selectedType;
    const matchesDifficulty = selectedDifficulty === 'all' || q.difficulty === selectedDifficulty;
    const matchesTag = selectedTag === 'all' || q.tags?.includes(selectedTag);
    const matchesStatus = selectedStatus === 'all' || q.completenessStatus === selectedStatus;

    return (
      matchesSearch &&
      matchesGrade &&
      matchesSubject &&
      matchesSection &&
      matchesType &&
      matchesDifficulty &&
      matchesTag &&
      matchesStatus
    );
  });

  const sortedQuestions = [...filteredQuestions].sort((a, b) => {
    if (sortOrder === 'title') return a.title.localeCompare(b.title, 'fa');
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return sortOrder === 'oldest' ? aTime - bTime : bTime - aTime;
  });
  const totalPages = Math.max(1, Math.ceil(sortedQuestions.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const visibleQuestions = sortedQuestions.slice((safePage - 1) * pageSize, safePage * pageSize);

  const clearAllFilters = () => {
    setSearchQuery('');
    resetSelectedGrade();
    resetSelectedSubject();
    resetSelectedSection();
    resetSelectedType();
    resetSelectedDifficulty();
    resetSelectedTag();
    resetSelectedStatus();
  };

  const hasActiveFilters =
    !!searchQuery ||
    selectedGrade !== 'all' ||
    selectedSubject !== 'all' ||
    selectedSection !== 'all' ||
    selectedType !== 'all' ||
    selectedDifficulty !== 'all' ||
    selectedTag !== 'all' ||
    selectedStatus !== 'all';

  return {
    searchQuery, setSearchQuery,
    sortOrder, setSortOrder,
    pageSize, setPageSize,
    currentPage, setCurrentPage,
    selectedGrade, setSelectedGrade, resetSelectedGrade,
    selectedSubject, setSelectedSubject, resetSelectedSubject,
    selectedSection, setSelectedSection, resetSelectedSection,
    selectedType, setSelectedType, resetSelectedType,
    selectedDifficulty, setSelectedDifficulty, resetSelectedDifficulty,
    selectedTag, setSelectedTag, resetSelectedTag,
    selectedStatus, setSelectedStatus, resetSelectedStatus,
    clearAllFilters, hasActiveFilters,
    filteredQuestions, sortedQuestions, visibleQuestions, totalPages, safePage,
  };
}
